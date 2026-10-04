// Build the original 1,000-question bank from the private curriculum source.
await import('./build-cyber-bank.mjs');
import { readdir, readFile, writeFile, mkdir, copyFile, rm, stat } from 'node:fs/promises';
import { addFullscreen } from './fullscreen-html.mjs';
import { addAppGuide } from './app-guide-html.mjs';
import { addQuality } from './quality-html.mjs';
import { resolve, join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { isPublicPath, containsPublicPath } from './public-scope.mjs';
import { measurePublicUsage } from './measure-public-usage.mjs';

// The same artifact can be served by GitHub Pages, Cloudflare Pages or Workers Assets.
// Build tools, tests, plans and database code never enter the public artifact.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = join(root, 'dist');
// ONE PIECE is distributed as an Android app; retain its source outside the website.
const excludedDirs = new Set(['dist','commons-src','source','src','node_modules','supabase','backend','cloudflare','scripts','tests','docs','roadmap','coverage','test-results','test-output','_site','playwright-report','onepiece-battle']);
const excludedFiles = new Set(['https-hardening.mjs','shogi-adapter.mjs','supabase-config.example.js','package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','tsconfig.json','jsconfig.json']);
const publicFiles = new Set(['CNAME','.nojekyll','_headers','_redirects']);
const extensions = new Set(['.html','.css','.js','.mjs','.json','.txt','.xml','.svg','.png','.jpg','.jpeg','.webp','.avif','.gif','.ico','.woff','.woff2','.ttf','.otf','.mp3','.ogg','.wav','.m4a','.mp4','.webm','.glb','.gltf','.bin','.obj','.mtl','.ktx2','.basis','.wasm','.data','.unityweb','.webmanifest']);
let count = 0, bytes = 0;
const compress = async (source, loader) => (await transform(source, {
  loader, minify: true, keepNames: loader === 'js', legalComments: 'inline', sourcemap: false,
  target: 'es2022',
})).code;
async function compileHtml(html) {
  // Compile only executable inline JavaScript; JSON, import maps and shaders are data.
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  const matches = [...html.matchAll(pattern)];
  for (const m of matches.reverse()) {
    const type = m[1].match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1].toLowerCase();
    if (/\bsrc\s*=/i.test(m[1]) || !m[2].trim() || (type && !['module','text/javascript','application/javascript'].includes(type))) continue;
    const code = (await compress(m[2], 'js')).replace(/<\/script/gi, '<\\/script');
    html = html.slice(0,m.index) + `<script${m[1]}>${code}</script>` + html.slice(m.index+m[0].length);
  }
  return html;
}
async function copyPublic(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const src = join(dir, item.name);
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) {
      if (!item.name.startsWith('.') && !excludedDirs.has(item.name) && containsPublicPath(relative(root, src))) await copyPublic(src);
      continue;
    }
    if (!item.isFile() || excludedFiles.has(item.name) || !isPublicPath(relative(root, src))) continue;
    if (relative(root,src).startsWith('arcade100/assets/') && extname(item.name)==='.png') continue;
    if (!publicFiles.has(item.name) && (item.name.startsWith('.') || !extensions.has(extname(item.name)))) continue;
    const target = join(output, relative(root, src));
    await mkdir(resolve(target, '..'), { recursive: true });
    const extension = extname(item.name);
    if (extension === '.html') await writeFile(target, await compileHtml(addAppGuide(addQuality(addFullscreen(await readFile(src, 'utf8'), src, root), src, root),src,root)));
    // Unity loaders serialize decompression workers with Function.toString().
    // Re-minifying them injects outer-scope helpers that do not exist in the worker.
    else if (item.name.endsWith('.loader.js')) await copyFile(src, target);
    else if (['.js','.mjs','.css'].includes(extension)) await writeFile(target, await compress(await readFile(src,'utf8'), extension === '.css' ? 'css' : 'js'));
    else await copyFile(src, target);
    bytes += (await stat(target)).size;
    count++;
  }
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyPublic(root);
for (const path of ['index.html','games.html','games-2d.html','aitech-home.css','collection-nav.css','hub.css','commons/index.html','yobi-quiz.html','yobi-ronbun.html','legal.html','supabase-config.js']) await stat(join(output, path));
const index = await readFile(join(output, 'index.html'), 'utf8');
if (/src=["'][^"']*(?:supabase|game-backend|game23|smash\.js)/i.test(index)) throw new Error('The hub must not initialize a game engine or an online connection.');
console.log(JSON.stringify({ output, files: count, bytes }, null, 2));
console.log('Usage dashboard public build:', JSON.stringify(await measurePublicUsage(output)));
