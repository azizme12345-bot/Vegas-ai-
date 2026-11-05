import * as cheerio from 'cheerio';

function isBlockedUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return true;
    }
    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      const o1 = parseInt(ipMatch[1], 10);
      const o2 = parseInt(ipMatch[2], 10);
      if (o1 === 10) return true;
      if (o1 === 127) return true;
      if (o1 === 169 && o2 === 254) return true;
      if (o1 === 192 && o2 === 168) return true;
      if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
      if (o1 === 0) return true;
    }
    return false;
  } catch (e) {
    return true;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { url, language } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required.' });
  }

  const cleanUrl = url.trim();
  if (isBlockedUrl(cleanUrl)) {
    return res.status(400).json({
      error: 'This URL is blocked for security reasons (localhost, private network, or invalid protocol).',
    });
  }

  const startTime = Date.now();
  let ttfb = 0;
  let finalUrl = cleanUrl;
  let statusCode = 0;
  let sizeBytes = 0;
  let contentType = '';
  let htmlText = '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const fetchRes = await fetch(cleanUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VegasAI-SiteAnalyzer/1.0 (+https://vegas.ai)',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    ttfb = Date.now() - startTime;
    finalUrl = fetchRes.url || cleanUrl;
    statusCode = fetchRes.status;
    contentType = fetchRes.headers.get('content-type') || '';

    const buffer = await fetchRes.arrayBuffer();
    sizeBytes = buffer.byteLength;
    htmlText = new TextDecoder().decode(buffer);
  } catch (err) {
    clearTimeout(timeoutId);
    const errReason = err.name === 'AbortError' ? 'Request timed out after 10 seconds' : err.message;
    return res.status(200).json({
      error: `Failed to fetch URL: ${errReason}`,
      metrics: { url: cleanUrl, statusCode: 0, ttfb: 10000, totalTime: 10000, sizeBytes: 0, speedLabel: 'slow' },
    });
  }

  const totalTime = Date.now() - startTime;
  const speedLabel = totalTime < 1000 ? 'fast' : totalTime <= 3000 ? 'ok' : 'slow';
  const isHeavy = sizeBytes > 2 * 1024 * 1024;

  // Cheerio analysis
  const $ = cheerio.load(htmlText);
  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const viewport = $('meta[name="viewport"]').attr('content') || '';
  const langAttr = $('html').attr('lang') || '';
  const ogTags = {
    title: $('meta[property="og:title"]').attr('content') || '',
    description: $('meta[property="og:description"]').attr('content') || '',
    image: $('meta[property="og:image"]').attr('content') || '',
  };
  const h1Count = $('h1').length;

  let imagesWithoutAlt = 0;
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    if (!alt || !alt.trim()) imagesWithoutAlt++;
  });

  let emptyOrHashLinks = 0;
  const internalLinks = new Set();
  const externalAssets = [];

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href === '#' || href.trim() === '') {
      emptyOrHashLinks++;
    } else {
      try {
        const resolved = new URL(href, finalUrl);
        if (resolved.origin === new URL(finalUrl).origin) {
          internalLinks.add(resolved.href);
        }
      } catch (_e) {}
    }
  });

  $('script[src], link[rel="stylesheet"]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('href');
    if (src) {
      try {
        const assetUrl = new URL(src, finalUrl).href;
        externalAssets.push(assetUrl);
      } catch (_e) {}
    }
  });

  // Check up to 30 assets & 20 internal links in parallel
  const assetsToCheck = externalAssets.slice(0, 30);
  const linksToCheck = Array.from(internalLinks).slice(0, 20);

  const [assetResults, linkResults] = await Promise.all([
    Promise.all(
      assetsToCheck.map(async (u) => {
        try {
          const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
          return { url: u, ok: r.ok, status: r.status };
        } catch (_e) {
          return { url: u, ok: false, status: 0 };
        }
      })
    ),
    Promise.all(
      linksToCheck.map(async (u) => {
        try {
          const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
          return { url: u, ok: r.ok, status: r.status };
        } catch (_e) {
          return { url: u, ok: false, status: 0 };
        }
      })
    ),
  ]);

  const brokenAssets = assetResults.filter((a) => !a.ok);
  const brokenLinks = linkResults.filter((l) => !l.ok || l.status >= 400);

  return res.status(200).json({
    metrics: {
      finalUrl,
      statusCode,
      ttfb,
      totalTime,
      sizeBytes,
      sizeMb: (sizeBytes / (1024 * 1024)).toFixed(2),
      contentType,
      speedLabel,
      isHeavy,
    },
    seo: {
      title,
      metaDesc,
      viewport,
      langAttr,
      ogTags,
      h1Count,
      imagesWithoutAlt,
      emptyOrHashLinks,
    },
    assets: {
      checked: assetsToCheck.length,
      broken: brokenAssets,
    },
    links: {
      checked: linksToCheck.length,
      broken: brokenLinks,
    },
  });
}
