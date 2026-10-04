import assert from 'node:assert/strict';
import { readFile, readdir, access, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { build } from 'esbuild';
const root = resolve('dist');
const commons = ['tools/whiteboard','study','tools/chat','hotels','rentals',
  'local/supermarkets','local/saunas','local/sento','local/fishmongers','ramen','sauna',
  'openings/ramen','openings/sauna','camera','weather','bitcoin','onion','cyber-news',
  'government-network','reemployment-network','law','documents','manga','mtg-flavor',
  'duel-masters-flavor','yugioh-flavor','onepiece-cards','pokemon-cards','zx-cards','usage','constitution'];
const games = ['pulse-drums','pixel-wallpapers','cyber-quiz','music','law-quiz','it-quiz',
  'hacking-story','lantern-duo','quick-hop','startrail'];
const removed = ['games-3d.html','games-trump.html','games-board.html','game23.html','game23-runtime.mjs',
  'smash.html','fps.html','bayline/index.html','touge/index.html','trump/index.html','board-games/index.html',
  'classic.html','babanuki.html','gomoku.html','digimon-card/index.html','dungeon-dice/index.html',
  'onepiece-battle/index.html','mega-arcade.html','archive.html','apps.html','apps100/index.html',
  'solo.html','online.html','whiteboard.html','chat.html','quiz-raid/index.html'];
for (const path of [...commons.map(p => `commons/${p}/index.html`), ...games.map(p => `${p}/index.html`),
  'yobi-quiz.html','yobi-ronbun.html','assets/tanto/bank.json','assets/ronbun/papers.json','peer-supabase-shim.js']) {
  await access(resolve(root,path));
}
for (const path of removed) await assert.rejects(access(resolve(root,path)), { code: 'ENOENT' }, path);
const compiled = await build({entryPoints:['commons-src/lib/site-catalog.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {sites} = await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const catalogPaths = sites.map(site=>site.href);
assert.deepEqual(catalogPaths.sort(), commons.map(p => `/commons/${p}/`).sort(), 'Preserve every Commons31 catalog route');
const hub = await readFile(resolve(root,'commons/index.html'),'utf8');
const hubScript = hub.match(/src="(\/commons\/assets\/index-[^"]+\.js)"/)[1];
const hubBundle = await readFile(resolve(root,'.'+hubScript),'utf8');
for (const path of catalogPaths.filter(p=>!p.startsWith('/commons/tools/') && !p.startsWith('/commons/local/'))) assert(hubBundle.includes(path), `Built Commons catalog missing ${path}`);
for (const page of ['games.html','games-2d.html']) {
  const html = await readFile(resolve(root,page),'utf8');
  for (const game of games) assert(html.includes(`${game}/`), `${page} missing ${game}`);
  assert.doesNotMatch(html, /games-(?:3d|trump|board)\.html|naruto-card|zx-solo|digimon-card|dungeon-dice|aether-card/);
}
const files=[];
async function walk(dir='') {
  for(const entry of await readdir(resolve(root,dir),{withFileTypes:true})) {
    const path=dir?`${dir}/${entry.name}`:entry.name;
    if(entry.isDirectory()) await walk(path); else files.push(path);
  }
}
await walk();
const manifest = JSON.parse(await readFile(resolve(root,'https-release.json'),'utf8'));
assert.deepEqual(manifest.pages.sort(),files.filter(p=>p.endsWith('.html')).sort(),'HTTPS manifest only lists actual published pages');
const broken=[];
async function checkRef(file, ref) {
  if(!ref || /^(?:#|data:|blob:|mailto:|tel:|javascript:)/i.test(ref)) return;
  const url=new URL(ref,`https://aitechd.com/${file}`);
  if(url.origin!=='https://aitechd.com') return;
  let path=decodeURIComponent(url.pathname).replace(/^\//,'');
  if(path.endsWith('/')) path+='index.html';
  if(path==='') path='index.html';
  try { if(!(await stat(resolve(root,path))).isFile()) broken.push(`${file} -> ${ref}`); }
  catch { broken.push(`${file} -> ${ref}`); }
}
for(const file of files) {
  const ext=extname(file);
  if(!['.html','.mjs','.js','.css'].includes(ext))continue;
  const source=await readFile(resolve(root,file),'utf8');
  if(ext==='.html')for(const m of source.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/g))await checkRef(file,m[1]);
  if(ext==='.css')for(const m of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))await checkRef(file,m[1]);
  // Validate local ESM dependencies, including lazy split chunks from Commons.
  if(['.mjs','.js'].includes(ext))for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']((?:\.\.?\/|\/)[^"']+)["']/g))await checkRef(file,m[1]);
}
assert.deepEqual(broken,[],'Retained pages must not contain broken local links/assets');
console.log(JSON.stringify({passed:true,commons:commons.length,games:games.length,removed:removed.length,publishedPages:manifest.pages.length,files:files.length}));
