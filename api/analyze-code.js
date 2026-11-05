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

  const { githubUrl, files } = req.body || {};
  let repoFiles = [];

  const headers = {
    'User-Agent': 'VegasAI-CodeAnalyzer/1.0',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
  };

  if (githubUrl && typeof githubUrl === 'string') {
    const ghMatch = githubUrl.trim().match(/github\.com\/([^\/]+)\/([^\/#?]+)/i);
    if (!ghMatch) {
      return res.status(400).json({ error: 'Invalid GitHub repository URL.' });
    }
    const owner = ghMatch[1];
    const repo = ghMatch[2].replace(/\.git$/i, '');

    try {
      // 1. Get default branch or tree
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

      // Filter and prioritize files
      const skipExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.mp4', '.mov', '.pdf', '.lock', '.zip', '.tar', '.gz'];
      const skipDirs = ['node_modules/', '.git/', 'dist/', 'build/'];

      const candidateFiles = treeItems.filter((item) => {
        if (item.type !== 'blob') return false;
        const p = item.path.toLowerCase();
        if (skipDirs.some((d) => p.includes(d))) return false;
        if (skipExts.some((ext) => p.endsWith(ext))) return false;
        if (p.includes('package-lock.json') || p.includes('yarn.lock') || p.includes('pnpm-lock.yaml')) return false;
        if (item.size && item.size > 200 * 1024) return false;
        return true;
      });

      // Prioritize key files: index.html, package.json, server, api, src
      candidateFiles.sort((a, b) => {
        const score = (p) => {
          if (p === 'index.html' || p === 'package.json') return 0;
          if (p.startsWith('api/') || p.startsWith('src/') || p.includes('server')) return 1;
          return 2;
        };
        return score(a.path) - score(b.path);
      });

      let totalBytes = 0;
      const filesToFetch = candidateFiles.slice(0, 25);

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
  } else if (Array.isArray(files) && files.length > 0) {
    let totalBytes = 0;
    for (const f of files.slice(0, 25)) {
      if (totalBytes >= 300 * 1024) break;
      const content = String(f.content || '');
      if (content.length <= 200 * 1024 && totalBytes + content.length <= 300 * 1024) {
        repoFiles.push({ path: f.path || 'file.txt', content });
        totalBytes += content.length;
      }
    }
  } else {
    return res.status(400).json({ error: 'Provide either a GitHub repository URL or uploaded code files.' });
  }

  // Code inspection logic
  const issues = [];
  const filePaths = new Set(repoFiles.map((f) => f.path));
  const fileContentsMap = new Map(repoFiles.map((f) => [f.path, f.content]));

  let packageJsonDeps = {};
  const pkgFile = repoFiles.find((f) => f.path.endsWith('package.json'));
  if (pkgFile) {
    try {
      const parsed = JSON.parse(pkgFile.content);
      packageJsonDeps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
    } catch (_e) {}
  }

  repoFiles.forEach((file) => {
    const code = file.content;
    const path = file.path;

    // 1. API Keys written in code
    const keyPatterns = [
      /AIzaSy[A-Za-z0-9-_]{33}/,
      /sk-[A-Za-z0-9]{20,}/,
      /ghp_[A-Za-z0-9]{36}/,
      /bearer\s+[a-z0-9_\-\.]{20,}/i,
    ];
    for (const pat of keyPatterns) {
      if (pat.test(code)) {
        issues.push({
          severity: 'high',
          location: path,
          description: 'Hardcoded API key or secret token detected in source code.',
          fix: 'Move the secret to environment variables (e.g. process.env.API_KEY) and never commit keys to repository.',
        });
        break;
      }
    }

    // 2. Fetch without error handling (fetch( without .catch or try/catch)
    const fetchMatches = code.match(/fetch\s*\(/g);
    if (fetchMatches && !code.includes('catch') && !code.includes('try')) {
      issues.push({
        severity: 'medium',
        location: path,
        description: 'Network fetch call used without visible try/catch or .catch error handling.',
        fix: 'Wrap fetch calls in try/catch blocks or add .catch() handlers to prevent uncaught promise rejections.',
      });
    }

    // 3. Unsafe display of user text (innerHTML without sanitization)
    if (code.includes('innerHTML') && !code.includes('escape') && !code.includes('DOMPurify')) {
      issues.push({
        severity: 'medium',
        location: path,
        description: 'Direct assignment to innerHTML without sanitization can lead to XSS vulnerabilities.',
        fix: 'Use textContent or sanitize HTML content before assigning to innerHTML.',
      });
    }

    // 4. Broken file references (checking href/src paths)
    const refMatches = code.matchAll(/(?:src|href)=["']([^"'#:]+)["']/g);
    for (const match of refMatches) {
      const ref = match[1];
      if (ref.startsWith('/') && ref.length > 1) {
        const cleanRef = ref.slice(1);
        // check if file exists in repo (accounting for public/ or root)
        const exists = filePaths.has(cleanRef) || filePaths.has('public/' + cleanRef) || filePaths.has('src/' + cleanRef);
        if (!exists && !cleanRef.startsWith('http') && !cleanRef.includes('cdn.')) {
          issues.push({
            severity: 'low',
            location: path,
            description: `Referenced asset or file "${ref}" may not exist in the repository.`,
            fix: `Verify the file path or ensure "${ref}" is included in the project directory.`,
          });
        }
      }
    }
  });

  return res.status(200).json({
    analyzedFiles: repoFiles.map((f) => f.path),
    issues,
  });
}
