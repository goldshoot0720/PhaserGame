import http from 'node:http';
import path from 'node:path';
import { stat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from './build-local.mjs';
await build();
const root = await realpath(fileURLToPath(new URL('../dist', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const url = new URL(req.url, 'http://localhost');
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    file = await realpath(file);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('找不到檔案'); }
}).listen(Number(process.env.PORT ?? 8788), '127.0.0.1', function () { console.log(`Local source games: http://127.0.0.1:${this.address().port}`); });
