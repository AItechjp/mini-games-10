import { readdir, readFile, mkdir, copyFile, rm, stat } from 'node:fs/promises';
import { resolve, join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// The same artifact can be served by GitHub Pages, Cloudflare Pages or Workers Assets.
// Build tools, tests, plans and database code never enter the public artifact.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = join(root, 'dist');
const excludedDirs = new Set(['dist','commons-src','node_modules','supabase','backend','cloudflare','scripts','tests','docs','roadmap','coverage','test-results','test-output','_site','playwright-report']);
const excludedFiles = new Set(['https-hardening.mjs','supabase-config.example.js','package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','tsconfig.json','jsconfig.json']);
const publicFiles = new Set(['CNAME','.nojekyll','_headers','_redirects']);
const extensions = new Set(['.html','.css','.js','.mjs','.json','.txt','.xml','.svg','.png','.jpg','.jpeg','.webp','.avif','.gif','.ico','.woff','.woff2','.ttf','.otf','.mp3','.ogg','.wav','.m4a','.mp4','.webm','.glb','.gltf','.bin','.obj','.mtl','.ktx2','.basis','.wasm','.webmanifest']);
let count = 0, bytes = 0;
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
    await copyFile(src, target);
    bytes += (await stat(src)).size;
    count++;
  }
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyPublic(root);
for (const path of ['index.html','games.html','aitech-home.css','collection-nav.css','hub.css','archive.html','game23.html','smash.html','legal.html','supabase-config.js']) await stat(join(output, path));
const index = await readFile(join(output, 'index.html'), 'utf8');
if (/src=["'][^"']*(?:supabase|game-backend|game23|smash\.js)/i.test(index)) throw new Error('The hub must not initialize a game engine or an online connection.');
console.log(JSON.stringify({ output, files: count, bytes }, null, 2));
