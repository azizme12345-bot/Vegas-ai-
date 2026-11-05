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

  const { url } = req.body || {};
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 VegasAI/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ur;q=0.8'
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

  // Cheerio HTML analysis
  const $ = cheerio.load(htmlText);
  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const viewport = $('meta[name="viewport"]').attr('content') || '';
  const langAttr = $('html').attr('lang') || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const robotsMeta = $('meta[name="robots"]').attr('content') || '';

  const ogTags = {
    title: $('meta[property="og:title"]').attr('content') || '',
    description: $('meta[property="og:description"]').attr('content') || '',
    image: $('meta[property="og:image"]').attr('content') || '',
  };

  const h1Elements = [];
  $('h1').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt && h1Elements.length < 5) h1Elements.push(txt);
  });
  const h2Count = $('h2').length;

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

  // Check external assets & links
  const assetsToCheck = externalAssets.slice(0, 25);
  const linksToCheck = Array.from(internalLinks).slice(0, 15);

  const [assetResults, linkResults] = await Promise.all([
    Promise.all(
      assetsToCheck.map(async (u) => {
        try {
          const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(3500) });
          return { url: u, ok: r.ok, status: r.status };
        } catch (_e) {
          return { url: u, ok: false, status: 0 };
        }
      })
    ),
    Promise.all(
      linksToCheck.map(async (u) => {
        try {
          const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(3500) });
          return { url: u, ok: r.ok, status: r.status };
        } catch (_e) {
          return { url: u, ok: false, status: 0 };
        }
      })
    ),
  ]);

  const brokenAssets = assetResults.filter((a) => !a.ok);
  const brokenLinks = linkResults.filter((l) => !l.ok || l.status >= 400);

  // 5. Google Indexability Assessment (noindex, robots.txt, sitemap, canonical, title, description)
  let robotsTxtFound = false;
  let robotsDisallowsRoot = false;
  let sitemapUrlFromRobots = '';
  let sitemapReachable = false;

  try {
    const origin = new URL(finalUrl).origin;
    const robotsRes = await fetch(`${origin}/robots.txt`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (robotsRes.ok) {
      robotsTxtFound = true;
      const robotsTxtBody = await robotsRes.text();
      // Check for Disallow: /
      if (/(?:user-agent:\s*\*|user-agent:\s*googlebot)[\s\S]*?disallow:\s*\/\s*(?:\r?\n|$)/i.test(robotsTxtBody)) {
        robotsDisallowsRoot = true;
      }
      const sitemapMatch = robotsTxtBody.match(/sitemap:\s*([^\r\n]+)/i);
      if (sitemapMatch) {
        sitemapUrlFromRobots = sitemapMatch[1].trim();
      }
    }
    // Check sitemap availability
    const testSitemapUrl = sitemapUrlFromRobots || `${origin}/sitemap.xml`;
    const sitemapProbe = await fetch(testSitemapUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    if (sitemapProbe.ok) sitemapReachable = true;
  } catch (_e) {}

  const hasNoindex = /noindex/i.test(robotsMeta);
  const hasNofollow = /nofollow/i.test(robotsMeta);

  const indexabilityReasons = [];
  let isGoogleIndexable = true;

  if (statusCode >= 400) {
    isGoogleIndexable = false;
    indexabilityReasons.push(`HTTP status code is error (${statusCode}).`);
  }
  if (hasNoindex) {
    isGoogleIndexable = false;
    indexabilityReasons.push('Meta tag contains "noindex", blocking Google from indexing this page.');
  }
  if (robotsDisallowsRoot) {
    isGoogleIndexable = false;
    indexabilityReasons.push('robots.txt disallows crawling of the root path ("Disallow: /").');
  }
  if (!title) {
    indexabilityReasons.push('Page is missing a <title> tag, which hinders search appearance.');
  }
  if (!metaDesc) {
    indexabilityReasons.push('Page is missing a meta description tag.');
  }
  if (canonical) {
    indexabilityReasons.push(`Canonical URL declared: ${canonical}`);
  } else {
    indexabilityReasons.push('No canonical URL tag defined (not blocking, but recommended).');
  }
  if (robotsTxtFound) {
    indexabilityReasons.push(`robots.txt found and accessible (${robotsDisallowsRoot ? 'Disallows crawling' : 'Allows crawling'}).`);
  } else {
    indexabilityReasons.push('No robots.txt found at domain root (Google will crawl by default).');
  }
  if (sitemapReachable) {
    indexabilityReasons.push(`Sitemap accessible at ${sitemapUrlFromRobots || 'sitemap.xml'}.`);
  }

  // 6. How Google Sees & Understands the Page (Purely HTML based, no definitive claims)
  // Structured Data / Schema check
  const jsonLdSchemas = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      if (data && (data['@type'] || data['@context'])) jsonLdSchemas.push(data['@type'] || 'Custom Schema');
    } catch (_e) {}
  });

  const firstParagraph = $('main p, article p, p').first().text().trim().slice(0, 160);
  const googleSnippetPreview = {
    title: title || 'Untitled Page',
    displayUrl: finalUrl,
    snippet: metaDesc || firstParagraph || 'No description preview available.'
  };

  const semanticLayout = {
    hasMain: $('main').length > 0,
    hasHeader: $('header').length > 0,
    hasNav: $('nav').length > 0,
    hasArticle: $('article').length > 0,
    hasFooter: $('footer').length > 0,
    headingsHierarchy: {
      h1Count: $('h1').length,
      h1Samples: h1Elements,
      h2Count: h2Count
    }
  };

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
      canonical,
      robotsMeta,
      ogTags,
      h1Count: $('h1').length,
      h2Count,
      imagesWithoutAlt,
      emptyOrHashLinks,
    },
    googleIndexability: {
      isIndexable: isGoogleIndexable,
      hasNoindex,
      hasNofollow,
      robotsTxtFound,
      robotsDisallowsRoot,
      sitemapReachable,
      canonical,
      reasons: indexabilityReasons
    },
    googleInterpretation: {
      disclaimer: 'Based strictly on parsed HTML structure and visible metadata. Google uses proprietary algorithms and search engines cannot be guaranteed.',
      snippetPreview: googleSnippetPreview,
      structuredData: jsonLdSchemas,
      semanticLayout
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
