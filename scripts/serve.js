#!/usr/bin/env node
/* Minimal static server for dist/ on http://localhost:<port> (default 8000), bound to 127.0.0.1.
 * Webcam tracking needs http(s) or localhost, and WebGazer's MediaPipe files need the wasm MIME type.
 * Usage: node scripts/serve.js [port] [dir] */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2]) || 8000;
const root = path.resolve(process.argv[3] || path.join(__dirname, '..', 'dist'));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.ts': 'text/plain; charset=utf-8',
  '.data': 'application/octet-stream', '.binarypb': 'application/octet-stream', '.zip': 'application/zip',
};

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400).end(); return; }
  if (rel.endsWith('/')) rel += 'QuikKart_Stimulus_App.html';
  const file = path.join(root, path.normalize(rel));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size, 'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://localhost:${port}/QuikKart_Stimulus_App.html (Ctrl+C to stop)`);
});
