import JSZip from 'jszip';

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

  const { githubUrl, files, zipBase64 } = req.body || {};
  let repoFiles = [];

  const headers = {
    'User-Agent': 'VegasAI-CodeAnalyzer/1.0',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
  };

  const skipExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg', '.mp4', '.mov', '.webm', '.mp3', '.wav', '.pdf', '.lock', '.zip', '.tar', '.gz', '.bin', '.exe', '.woff', '.woff2', '.ttf', '.eot', '.map'];
  const skipFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock'];
  const skipDirs = ['node_modules/', '.git/', 'dist/', 'build/', '.next/', '.cache/'];

  // Case 1: ZIP Archive Uploaded
  if (zipBase64 && typeof zipBase64 === 'string') {
    try {
      const cleanB64 = zipBase64.replace(/^data:application\/[^;]+;base64,/, '');
      const zip = await JSZip.loadAsync(cleanB64, { base64: true });
      let totalBytes = 0;

      const entries = Object.keys(zip.files).filter((relPath) => {
        const item = zip.files[relPath];
        if (item.dir) return false;
        const p = relPath.toLowerCase();
        if (skipDirs.some((d) => p.includes(d))) return false;
        if (skipFiles.some((f) => p.endsWith(f))) return false;
        if (skipExts.some((ext) => p.endsWith(ext))) return false;
        return true;
      });

      // Prioritize entry points and config
      entries.sort((a, b) => {
        const score = (p) => {
          if (p === 'index.html' || p === 'package.json') return 0;
          if (p.startsWith('src/') || p.startsWith('api/') || p.includes('server')) return 1;
          return 2;
        };
        return score(a) - score(b);
      });

      for (const p of entries.slice(0, 35)) {
        if (totalBytes >= 350 * 1024) break;
        try {
          const content = await zip.files[p].async('string');
          if (totalBytes + content.length <= 350 * 1024) {
            repoFiles.push({ path: p, content });
            totalBytes += content.length;
          }
        } catch (_e) {}
      }
    } catch (err) {
      return res.status(400).json({ error: `Failed to unpack ZIP archive: ${err.message}` });
    }
  }
  // Case 2: GitHub Repository URL
  else if (githubUrl && typeof githubUrl === 'string') {
    const ghMatch = githubUrl.trim().match(/github\.com\/([^\/]+)\/([^\/#?]+)/i);
    if (!ghMatch) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL.' });
    }
    const owner = ghMatch[1];
    const repo = ghMatch[2].replace(/\.git$/i, '');

    try {
      const repoMetaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoMetaRes.ok) {
        return res.status(400).json({
          error: `GitHub repository not accessible (Status ${repoMetaRes.status}). Ensure it is public or GITHUB_TOKEN is valid.`,
        });
      }
      const repoMeta = await repoMetaRes.json();
      const defaultBranch = repoMeta.default_branch || 'main';

      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        { headers }
      );
      if (!treeRes.ok) {
        return res.status(400).json({ error: 'Failed to retrieve repository file tree from GitHub.' });
      }
      const treeData = await treeRes.json();
      const treeItems = Array.isArray(treeData.tree) ? treeData.tree : [];

      const candidateFiles = treeItems.filter((item) => {
        if (item.type !== 'blob') return false;
        const p = item.path.toLowerCase();
        if (skipDirs.some((d) => p.includes(d))) return false;
        if (skipFiles.some((f) => p.endsWith(f))) return false;
        if (skipExts.some((ext) => p.endsWith(ext))) return false;
        if (item.size && item.size > 200 * 1024) return false;
        return true;
      });

      candidateFiles.sort((a, b) => {
        const score = (p) => {
          if (p === 'index.html' || p === 'package.json') return 0;
          if (p.startsWith('api/') || p.startsWith('src/') || p.includes('server')) return 1;
          return 2;
        };
        return score(a.path) - score(b.path);
      });

      let totalBytes = 0;
      const filesToFetch = candidateFiles.slice(0, 30);

      for (const f of filesToFetch) {
        if (totalBytes >= 300 * 1024) break;
        try {
          const fileRes = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${f.path}`,
            { headers }
          );
          if (fileRes.ok) {
            const content = await fileRes.text();
            if (totalBytes + content.length <= 300 * 1024) {
              repoFiles.push({ path: f.path, content });
              totalBytes += content.length;
            }
          }
        } catch (_e) {}
      }
    } catch (err) {
      return res.status(500).json({ error: `GitHub API error: ${err.message}` });
    }
  }
  // Case 3: Pre-extracted files list
  else if (Array.isArray(files) && files.length > 0) {
    let totalBytes = 0;
    for (const f of files.slice(0, 35)) {
      if (totalBytes >= 350 * 1024) break;
      const content = String(f.content || f.textContent || '');
      const p = String(f.path || f.name || 'file.txt').toLowerCase();
      if (skipExts.some((ext) => p.endsWith(ext))) continue;
      if (skipFiles.some((sf) => p.endsWith(sf))) continue;

      if (content.length <= 200 * 1024 && totalBytes + content.length <= 350 * 1024) {
        repoFiles.push({ path: f.path || f.name || 'file.txt', content });
        totalBytes += content.length;
      }
    }
  } else {
    return res.status(400).json({ error: 'Provide either a ZIP archive, uploaded code files, or a GitHub repository URL.' });
  }

  // Code inspection logic
  const issues = [];
  const filePaths = new Set(repoFiles.map((f) => f.path.replace(/^\.\//, '')));
  const lowerFilePaths = new Set(repoFiles.map((f) => f.path.toLowerCase().replace(/^\.\//, '')));

  let hasTypeScript = false;
  let hasTsConfig = false;

  repoFiles.forEach((f) => {
    if (f.path.endsWith('.ts') || f.path.endsWith('.tsx')) hasTypeScript = true;
    if (f.path.toLowerCase().includes('tsconfig.json')) hasTsConfig = true;
  });

  repoFiles.forEach((file) => {
    const code = file.content;
    const path = file.path;

    // 1. API Keys and secrets written directly in code
    const keyPatterns = [
      { regex: /AIzaSy[A-Za-z0-9-_]{33}/, label: 'Google / Gemini API Key' },
      { regex: /sk-[A-Za-z0-9-_]{20,}/, label: 'OpenAI API Secret Key' },
      { regex: /ghp_[A-Za-z0-9]{36}/, label: 'GitHub Personal Access Token' },
      { regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/, label: 'Private Cryptographic Key' },
      { regex: /(?:api_key|secret_key|client_secret)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i, label: 'Hardcoded API Secret' },
    ];
    for (const pat of keyPatterns) {
      if (pat.regex.test(code)) {
        issues.push({
          severity: 'high',
          category: 'security',
          location: path,
          description: `Exposed ${pat.label} hardcoded directly in source code.`,
          fix: 'Move sensitive keys to environment variables (e.g. process.env.API_KEY) and add secret files to .gitignore.',
        });
        break;
      }
    }

    // 2. Broken internal links & missing referenced assets/files
    const assetMatches = code.matchAll(/(?:src|href)=["']([^"'#:]+)["']/g);
    for (const match of assetMatches) {
      const ref = match[1].trim();
      if (!ref || ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('//') || ref.startsWith('mailto:') || ref.startsWith('tel:') || ref.startsWith('data:')) {
        continue;
      }
      const cleanRef = ref.replace(/^\.\//, '').replace(/^\//, '');
      const found =
        filePaths.has(cleanRef) ||
        lowerFilePaths.has(cleanRef.toLowerCase()) ||
        filePaths.has('public/' + cleanRef) ||
        lowerFilePaths.has(('public/' + cleanRef).toLowerCase()) ||
        filePaths.has('src/' + cleanRef) ||
        lowerFilePaths.has(('src/' + cleanRef).toLowerCase());

      if (!found && cleanRef.length > 2 && !cleanRef.includes('${') && !cleanRef.includes('{{')) {
        issues.push({
          severity: 'medium',
          category: 'missing-file',
          location: path,
          description: `Referenced local file or asset "${ref}" was not found in the project directory.`,
          fix: `Verify the file path or ensure "${ref}" is included in the project or public directory.`,
        });
      }
    }

    // 3. Broken internal JS/TS imports
    const importMatches = code.matchAll(/(?:from\s+|require\s*\(\s*)["'](\.[^"']+)["']/g);
    for (const impMatch of importMatches) {
      const relImport = impMatch[1];
      // Resolve against current directory
      const curDir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      const resolved = curDir ? `${curDir}/${relImport}` : relImport;
      const normalized = resolved.replace(/\/\.\//g, '/').replace(/^\.\//, '');

      const possiblePaths = [
        normalized,
        `${normalized}.ts`,
        `${normalized}.tsx`,
        `${normalized}.js`,
        `${normalized}.jsx`,
        `${normalized}.json`,
        `${normalized}/index.ts`,
        `${normalized}/index.tsx`,
        `${normalized}/index.js`
      ];

      const exists = possiblePaths.some((p) => filePaths.has(p) || lowerFilePaths.has(p.toLowerCase()));
      if (!exists) {
        issues.push({
          severity: 'high',
          category: 'broken-import',
          location: path,
          description: `Relative module import "${relImport}" could not be resolved to any file.`,
          fix: `Check the import path and ensure the module file exists.`,
        });
      }
    }

    // 4. Configuration & Arrangement Errors (غلط ترتیب)
    if (path.endsWith('package.json')) {
      try {
        const pkg = JSON.parse(code);
        if (!pkg.scripts || (!pkg.scripts.build && !pkg.scripts.dev && !pkg.scripts.start)) {
          issues.push({
            severity: 'medium',
            category: 'configuration',
            location: path,
            description: 'package.json is missing standard lifecycle scripts ("dev", "build", or "start").',
            fix: 'Define standard build and start scripts in package.json.',
          });
        }
        if (pkg.main && !filePaths.has(pkg.main.replace(/^\.\//, '')) && !filePaths.has('dist/' + pkg.main)) {
          issues.push({
            severity: 'low',
            category: 'configuration',
            location: path,
            description: `package.json "main" points to "${pkg.main}" which was not found in source files.`,
            fix: 'Confirm the build output path matches the main entry point.',
          });
        }
      } catch (jsonErr) {
        issues.push({
          severity: 'high',
          category: 'syntax',
          location: path,
          description: `JSON syntax error in package.json: ${jsonErr.message}`,
          fix: 'Fix malformed JSON structure in package.json.',
        });
      }
    }

    // 5. Check if .env file is included with real secrets
    if (path === '.env' || path.endsWith('/.env')) {
      if (code.includes('=') && !code.includes('YOUR_KEY_HERE')) {
        issues.push({
          severity: 'high',
          category: 'security',
          location: path,
          description: 'Production .env file with values is present in source archive.',
          fix: 'Remove .env and commit only a sanitized .env.example with placeholders.',
        });
      }
    }
  });

  if (hasTypeScript && !hasTsConfig) {
    issues.push({
      severity: 'medium',
      category: 'configuration',
      location: 'tsconfig.json',
      description: 'Project contains TypeScript files (.ts/.tsx) but is missing a tsconfig.json configuration file.',
      fix: 'Add a tsconfig.json file to configure the TypeScript compiler options.',
    });
  }

  return res.status(200).json({
    totalAnalyzedFiles: repoFiles.length,
    analyzedFiles: repoFiles.map((f) => f.path),
    issues,
    summary: {
      highCount: issues.filter((i) => i.severity === 'high').length,
      mediumCount: issues.filter((i) => i.severity === 'medium').length,
      lowCount: issues.filter((i) => i.severity === 'low').length,
      totalIssues: issues.length
    }
  });
}
