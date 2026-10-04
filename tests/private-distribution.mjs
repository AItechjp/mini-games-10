import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {retained2D,commons31,removedEntries} from './release-scope.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)), dist=join(root,'dist');
const files=[];
async function walk(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const file=join(dir,entry.name);
    if(entry.isDirectory()) await walk(file); else files.push(file);
  }
}
await walk(dist);
const release=JSON.parse(await readFile(join(dist,'https-release.json'),'utf8'));
const publicHTML=files.map(file=>relative(dist,file)).filter(file=>/\.html?$/i.test(file)).sort();
assert.deepEqual([...release.pages].sort(),publicHTML,'The HTTPS audit must include exactly the published HTML');
for(const file of files) {
  const name=relative(dist,file);
  assert.ok(!/(^|\/)(?:\.git|\.env[^/]*|commons-src|src|source|scripts|tests|supabase|backend|node_modules|onepiece-battle)(\/|$)/.test(name),`Private file in distribution: ${name}`);
  assert.ok(!/\.(?:map|ts|tsx|cs|sql|md)$/.test(name),`Development source in distribution: ${name}`);
  if(/\.(?:js|mjs|css|html)$/.test(name)) {
    const content=await readFile(file,'utf8');
    assert.ok(!/(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/.test(content),`Source map reference in ${name}`);
  }
}
for(const route of ['index.html','games.html','games-2d.html','commons/index.html','yobi-quiz.html','yobi-ronbun.html','board-games/vendor/three.mjs',...retained2D.map(path=>`${path}/index.html`),...commons31.map(path=>`commons/${path}/index.html`)]) {
  assert.ok((await stat(join(dist,route))).size>0,`Missing public asset: ${route}`);
}
for(const route of removedEntries) {
  await assert.rejects(stat(join(dist,route)),{code:'ENOENT'},`Removed content remains public: ${route}`);
  assert.ok(!release.pages.includes(route),`Removed route remains in audit manifest: ${route}`);
}
const boardFiles=files.map(file=>relative(dist,file)).filter(file=>file.startsWith('board-games/'));
assert.deepEqual(boardFiles.sort(),['board-games/vendor/three-LICENSE.txt','board-games/vendor/three.mjs'],'Only the quiz renderer and its license may remain under the former board-game directory');
console.log(`Public distribution: ${files.length} files, all Commons 31 and retained 2D 10, no removed apps, development sources or source maps.`);
