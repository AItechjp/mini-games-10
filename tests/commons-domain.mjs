import assert from 'node:assert/strict';
import {readFile,access,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const pages=['','study','tools/whiteboard','tools/chat','r','ramen','sauna','camera','weather','bitcoin','onion','openings/ramen','openings/restaurants','openings/sauna','local/supermarkets','local/saunas','local/sento','local/fishmongers'];
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
const staticBuilder=await readFile('scripts/build-static.mjs','utf8');
assert.match(staticBuilder,/'commons-src'/);
console.log(JSON.stringify({passed:true,localCommonsRoutes:pages.length,portalAndStudyLinks:4,serverSourceExcluded:true}));
