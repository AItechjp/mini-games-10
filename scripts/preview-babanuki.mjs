import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '../dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp'};
console.log('Starting');
http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/babanuki.html' : url.pathname));
    if (!path.startsWith(root + sep)) {res.writeHead(403).end();return;}
    const data = await readFile(path);
    res.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream','Cache-Control':'no-store'}).end(data);
  } catch {
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('このページはローカルプレビューに含まれていません。既存ゲームは https://aitechd.com/games.html から開けます。');
  }
}).listen(4179, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4179/babanuki.html'));
