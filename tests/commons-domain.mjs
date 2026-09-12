import assert from 'node:assert/strict';
import {readFile,access,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const pages=['','study','tools/whiteboard','tools/chat','r','ramen','sauna','camera','weather','bitcoin','onion','openings/ramen','openings/restaurants','openings/sauna','local/supermarkets','local/saunas','local/sento','local/fishmongers','hotels','rentals'];
for(const path of pages){
  const html=await readFile(`commons/${path?path+'/':''}index.html`,'utf8');
  assert.match(html,/lang="ja"/);
  assert.doesNotMatch(html,/commons-100\.[^"\s]+|<iframe\b|http-equiv="refresh"/i);
  for(const [,asset] of html.matchAll(/(?:src|href)="(\/commons\/[^"#?]+)"/g)){
    if(/\.(?:js|css|svg)$/.test(asset))await access(resolve('.'+asset));
  }
}
for(const path of ['index.html','games.html','yobi-quiz.html','yobi-ronbun.html']){
  const html=await readFile(path,'utf8');
  assert.doesNotMatch(html,/commons-100\.[^"\s]+/);
  assert.match(html,/href="\/commons\//);
}
const assets=await readdir('commons/assets');
assert(assets.some(p=>p.startsWith('room-')&&p.endsWith('.js')));
assert(assets.some(p=>p.startsWith('sauna-')&&p.endsWith('.js')));
assert(!assets.some(p=>p.startsWith('auth-gate-')),'The public bundle must not contain the account gate');
for(const asset of assets.filter(p=>p.endsWith('.js'))){
  const code=await readFile('commons/assets/'+asset,'utf8');
  assert.doesNotMatch(code,/コモンズにサインイン|signin-with-chatgpt|\/auth\/v1\//,'A Commons page must not start a sign-in flow');
}
const camera=await readFile('commons/camera/index.html','utf8');
assert.doesNotMatch(camera,/camera-auth|id="camera-site" hidden|type="password"/,'Camera must open without an account gate');
const staticBuilder=await readFile('scripts/build-static.mjs','utf8');
assert.match(staticBuilder,/'commons-src'/);
// Catalog entries and room history must point to real pages on the new host.
const catalog=await readFile('commons-src/lib/site-catalog.ts','utf8');
for(const [,href] of catalog.matchAll(/href:\s*['"]([^'"]+)['"]/g)){
  const url=new URL(href,'https://aitechd.com');
  assert.equal(url.origin,'https://aitechd.com');
  await access(resolve('.'+url.pathname+(url.pathname.endsWith('/')?'index.html':'')));
}
for(const route of ['hotels','rentals'])assert(catalog.includes(`/commons/${route}/`),`${route} must remain in the Commons catalog`);
const hub=await readFile('commons-src/app/ui/hub.tsx','utf8');
assert.doesNotMatch(hub,/href=\{['"]\/r\//,'Room history must use the migrated room URL');
console.log(JSON.stringify({passed:true,localCommonsRoutes:pages.length,portalAndStudyLinks:4,serverSourceExcluded:true}));
