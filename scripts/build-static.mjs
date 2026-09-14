// Build the original 1,000-question bank from the private curriculum source.
await import('./build-cyber-bank.mjs');
import { readdir, readFile, writeFile, mkdir, copyFile, rm, stat } from 'node:fs/promises';
import { addFullscreen } from './fullscreen-html.mjs';
import { addAppGuide } from './app-guide-html.mjs';
import { addQuality } from './quality-html.mjs';
import { resolve, join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { runInNewContext } from 'node:vm';

// The same artifact can be served by GitHub Pages, Cloudflare Pages or Workers Assets.
// Build tools, tests, plans and database code never enter the public artifact.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = join(root, 'dist');
const excludedDirs = new Set(['dist','commons-src','source','src','node_modules','supabase','backend','cloudflare','scripts','tests','docs','roadmap','coverage','test-results','test-output','_site','playwright-report']);
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
      if (!item.name.startsWith('.') && !excludedDirs.has(item.name)) await copyPublic(src);
      continue;
    }
    if (!item.isFile() || excludedFiles.has(item.name)) continue;
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
// The legacy loader concatenates these text fragments before execution. Compile them
// together so the browser receives executable output rather than editable fragments.
const legacyParts = Array.from({length:8},(_,i)=>`game23-v2-p${i+1}.txt`);
const legacyCode = (await Promise.all(legacyParts.map(p=>readFile(join(root,p),'utf8')))).join('\n').replace(/^import[^;]+;\s*/, '');
const legacyOutput = await compress(legacyCode, 'js');
for (let i=0;i<legacyParts.length;i++) await writeFile(join(output,legacyParts[i]), i === 0 ? legacyOutput : '');
// V3 shares lexical bindings across its fragments. Minify the complete program,
// then point the distribution loader at one module to preserve those bindings.
const v3Loader = await readFile(join(root,'game23-v3-loader.js'),'utf8');
const v3Definition = v3Loader.match(/const PARTS = ([\s\S]*?);\s*const THREE_IMPORT/);
if (!v3Definition) throw new Error('Cannot locate the V3 fragment manifest');
const v3Parts = runInNewContext(v3Definition[1], Object.create(null), {timeout:1000});
if (!Array.isArray(v3Parts) || v3Parts.some(p=>!/^game23-[\w-]+\.js(?:\?[\w=-]+)?$/.test(p))) throw new Error('Invalid V3 fragment manifest');
const v3Program = (await Promise.all(v3Parts.map(p=>readFile(join(root,p.split('?')[0]),'utf8')))).join('\n');
await writeFile(join(output,'game23-runtime.mjs'),await compress(v3Program,'js'));
await writeFile(join(output,'game23-v3-loader.js'),await compress(v3Loader.replace(`const PARTS = ${v3Definition[1]};`,"const PARTS = ['game23-runtime.mjs?v=20260914-commercial1'];"),'js'));
for (const path of ['index.html','games.html','aitech-home.css','collection-nav.css','hub.css','archive.html','game23.html','smash.html','legal.html','supabase-config.js']) await stat(join(output, path));
const index = await readFile(join(output, 'index.html'), 'utf8');
if (/src=["'][^"']*(?:supabase|game-backend|game23|smash\.js)/i.test(index)) throw new Error('The hub must not initialize a game engine or an online connection.');
console.log(JSON.stringify({ output, files: count, bytes }, null, 2));
