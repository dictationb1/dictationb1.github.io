'use strict';
/* Shared static file server for the Chromium gates.
 * contract: docs/ARCHITECTURE_MAP.md §H1 — the gates serve the real repository
 * root over http://127.0.0.1 so Service Workers, fetch() and visualViewport all
 * behave exactly as they do on GitHub Pages. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg'
};

/**
 * start({root, overrides}) → {origin, port, close(), setOverride(path, body)}
 * overrides maps a URL path (e.g. '/data/version.json') to a string body.
 */
function start(opts) {
  opts = opts || {};
  const root = path.resolve(opts.root || path.join(__dirname, '..'));
  const overrides = Object.assign({}, opts.overrides || {});
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    requests.push({ method: req.method, path: pathname });
    if (overrides[pathname] !== undefined) {
      const body = overrides[pathname];
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(pathname)] || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Service-Worker-Allowed': '/'
      });
      res.end(body);
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    let file = path.join(root, pathname);
    if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Service-Worker-Allowed': '/',
        'Content-Length': buf.length
      });
      res.end(buf);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        origin: 'http://127.0.0.1:' + port,
        port,
        requests,
        overrides,
        setOverride(p, body) { overrides[p] = body; },
        clearOverride(p) { delete overrides[p]; },
        close() { return new Promise((done) => server.close(done)); }
      });
    });
  });
}

module.exports = { start, MIME };
