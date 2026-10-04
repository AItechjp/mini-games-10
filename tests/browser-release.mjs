import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {retained2D,commons31,removedEntries} from './release-scope.mjs';
const root=resolve('dist'),routes=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(/\.html?$/i.test(path))routes.push(relative(root,path));}}
await walk(root);
for(const route of ['index.html','games.html','games-2d.html','commons/index.html','yobi-quiz.html','yobi-ronbun.html',...retained2D.map(path=>`${path}/index.html`),...commons31.map(path=>`commons/${path}/index.html`)])assert(routes.includes(route),`Missing public app: ${route}`);
for(const route of removedEntries)assert(!routes.includes(route),`Removed app is still published: ${route}`);
for(const route of routes){
 const html=await readFile(join(root,route),'utf8');
 assert(!/<meta\b[^>]*name=["']viewport["'][^>]*(?:user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:[,"']))/i.test(html),`Browser zoom disabled: ${route}`);
 assert(!/createUnityInstance|Web\.loader|\.unityweb/.test(html),`Unity runtime remains: ${route}`);
 for(const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)){
   const ref=match[1];if(/^(https?:|data:|\/\/|#)/.test(ref))continue;
   const url=new URL(ref,'https://aitechd.com/'+route);
   assert((await stat(join(root,decodeURIComponent(url.pathname)))).size>0,`Missing dependency: ${route} -> ${ref}`);
 }
}
const games=await readFile(join(root,'games-2d.html'),'utf8');
for(const path of retained2D)assert(games.includes(`href="${path}/`),`Retained 2D entry is missing: ${path}`);
for(const removed of ['games-3d.html','games-trump.html','games-board.html','digimon-card','dungeon-dice','naruto-card','zx-solo'])assert(!games.includes(removed),`Removed catalog entry remains: ${removed}`);
console.log(JSON.stringify({passed:true,checkedRoutes:routes.length,commonsTools:commons31.length,retained2D:retained2D.length,browserZoom:true,dependenciesPresent:true}));
