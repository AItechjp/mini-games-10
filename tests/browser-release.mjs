import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve('dist');
for(const [path,allow] of [['unity',['black-site.html','skybreak-rivals.html','startrail.html']],['trump-unity',['index.html']]]){
 const files=await readdir(join(root,path));assert.deepEqual(files.sort(),allow.sort(),`${path} must contain only compatibility redirects`);
 for(const file of files){const html=await readFile(join(root,path,file),'utf8');assert(!/createUnityInstance|Web\.loader|\.wasm|\.unityweb/.test(html));}
}
const routes=['index.html','games.html','games-3d.html','games-2d.html','games-trump.html','games-board.html','game23.html','smash.html','startrail/index.html','quick-hop/index.html','babanuki.html','trump/index.html','trump/game.mjs','trump/rules.mjs','board-games/index.html','commons/index.html','commons/tools/whiteboard/index.html','commons/tools/chat/index.html','commons/study/index.html','commons/hotels/index.html','commons/rentals/index.html','commons/local/supermarkets/index.html','commons/local/saunas/index.html','commons/local/sento/index.html','commons/local/fishmongers/index.html','commons/ramen/index.html','commons/sauna/index.html','commons/openings/ramen/index.html','commons/openings/sauna/index.html','commons/camera/index.html','commons/weather/index.html','commons/bitcoin/index.html','commons/onion/index.html'];
for(const route of routes){
 assert((await stat(join(root,route))).size>0,`Missing app: ${route}`);
 if(!route.endsWith('.html'))continue;
 const html=await readFile(join(root,route),'utf8');
 assert(!/<meta\b[^>]*name=["']viewport["'][^>]*(?:user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:[,"']))/i.test(html),`Browser zoom disabled: ${route}`);
 for(const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)){
   const ref=match[1];if(/^(https?:|data:|\/\/|#)/.test(ref))continue;
   const url=new URL(ref,'https://aitechd.com/'+route);await stat(join(root,decodeURIComponent(url.pathname)));
 }
}
for(const route of ['games-3d.html','games-2d.html','games-trump.html','games-board.html']){
 const html=await readFile(join(root,route),'utf8');assert(!/Unity|href=["'][^"']*(?:trump-unity|unity\/)/i.test(html),'Unity catalog entry remains');
}
const trump=await readFile(join(root,'games-trump.html'),'utf8');
for(const href of ['babanuki.html','trump/?game=memory','trump/?game=speed'])assert(trump.includes(`href="${href}"`));
console.log(JSON.stringify({passed:true,checkedRoutes:routes.length,unityRuntimeRemoved:true,browserZoom:true,catalogPreserved:true}));
