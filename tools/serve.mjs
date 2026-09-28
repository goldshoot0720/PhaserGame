import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import path from 'node:path';
const root = await realpath(process.cwd());
const port = Number(process.env.PORT || 8787);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav', '.md':'text/plain; charset=utf-8', '.ts':'text/plain; charset=utf-8' };
http.createServer(async (req, res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const parts = decodeURIComponent(url.pathname).split('/');
    if (parts.some(p => p.startsWith('.') || ['node_modules','tools'].includes(p))) throw Error('hidden');
    let target = path.join(root, ...parts);
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    target = await realpath(target);
    if (!target.startsWith(root + path.sep)) throw Error('outside');
    const info = await stat(target);
    const headers = { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache', 'Accept-Ranges':'bytes' };
    let start = 0, end = info.size - 1, code = 200;
    if (req.headers.range) {
      const m = req.headers.range.match(/^bytes=(\d+)-(\d*)$/);
      if (!m || Number(m[1]) >= info.size || (m[2] && Number(m[2]) < Number(m[1]))) { res.writeHead(416, { 'Content-Range':`bytes */${info.size}` }); res.end(); return; }
      start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), end) : end; code = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = Math.max(0, end - start + 1);
    res.writeHead(code, headers);
    if (req.method === 'HEAD' || !info.size) res.end(); else createReadStream(target, { start, end }).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); res.end('找不到檔案'); }
}).listen(port, '127.0.0.1', () => console.log(`萌友遊戲館：http://127.0.0.1:${port}`));
