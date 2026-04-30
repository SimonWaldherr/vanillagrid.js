#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i !== -1 && args[i+1]) return args[i+1];
  return fallback;
};

const host = getArg('host', '127.0.0.1');
const port = parseInt(getArg('port', '8000'), 10);
const root = process.cwd();

// Ensure dist/ is built before serving. The repository ignores `dist/` on
// `main`, so a fresh clone has no built assets and the demos would fail with
// "Can't find variable: VanillaGrid" because `dist/vanillagrid.min.js` 404s.
// Build automatically when the expected entry file is missing.
const distEntry = path.join(root, 'dist', 'vanillagrid.min.js');
if (!fs.existsSync(distEntry)) {
  console.log('dist/ not found - running `npm run build` to generate assets...');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', 'build'], { stdio: 'inherit', cwd: root });
  if (result.status !== 0) {
    console.error('Build failed; cannot start dev server.');
    process.exit(result.status || 1);
  }
}

const mime = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.mjs': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=UTF-8',
  '.md': 'text/markdown; charset=UTF-8'
};

const send = (res, status, headers, body) => {
  res.writeHead(status, headers);
  if (body) res.end(body); else res.end();
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(root, urlPath);

  // Directory handling
  try {
    const stat = fs.existsSync(filePath) && fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      // Map /demo to /demo/ and serve its index
      if (!urlPath.endsWith('/')) {
        res.writeHead(301, { Location: urlPath + '/' });
        return res.end();
      }
      const indexFile = path.join(filePath, 'index.html');
      if (fs.existsSync(indexFile)) filePath = indexFile;
      else filePath = path.join(filePath, 'index.htm');
    }
  } catch {}

  // Fallbacks for root
  if (!fs.existsSync(filePath)) {
    if (urlPath === '/' || urlPath === '') {
      const candidates = ['index.html', 'demo/index.html', 'demo.html'];
      for (const c of candidates) {
        const p = path.join(root, c);
        if (fs.existsSync(p)) { filePath = p; break; }
      }
    }
  }

  if (!fs.existsSync(filePath)) {
    return send(res, 404, { 'Content-Type': 'text/plain; charset=UTF-8' }, 'Not Found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = mime[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return send(res, 500, { 'Content-Type': 'text/plain; charset=UTF-8' }, 'Server Error');
    }
    send(res, 200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    }, data);
  });
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}/`;
  console.log(`VanillaGrid dev server running at ${url}`);
  console.log('Serving:', root);
});