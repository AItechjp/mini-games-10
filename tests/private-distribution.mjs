import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

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
assert.ok(!release.pages.some(p=>p.startsWith('dist/')),'A rebuild must not treat the previous distribution as source');
for(const file of files) {
  const name=relative(dist,file);
  assert.ok(!/(^|\/)(?:\.git|\.env[^/]*|commons-src|src|source|scripts|tests|supabase|backend|node_modules)(\/|$)/.test(name),`Private file in distribution: ${name}`);
  assert.ok(!/\.(?:map|ts|tsx|cs|sql|md)$/.test(name),`Development source in distribution: ${name}`);
  if(/\.(?:js|mjs|css|html)$/.test(name)) {
    const content=await readFile(file,'utf8');
    assert.ok(!/(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/.test(content),`Source map reference in ${name}`);
  }
}
for(const route of ['index.html','games.html','game23.html','smash.html','commons/index.html','commons/camera/index.html','unity/Build/Web.wasm','board-games/vendor/tsshogi-LICENSE.txt']) {
  assert.ok((await stat(join(dist,route))).size>0,`Missing public asset: ${route}`);
}
const rules=await readFile(join(dist,'board-games/vendor/rules.mjs'),'utf8');
const v3Loader=await readFile(join(dist,'game23-v3-loader.js'),'utf8');
const v3Runtime=await readFile(join(dist,'game23-runtime.mjs'),'utf8');
assert.ok(v3Loader.includes('game23-runtime.mjs'),'V3 must load the complete compiled module');
assert.match(v3Runtime,/import\s*\*\s*as\s+[\w$]+\s*from\s*['"]https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.180\.0\/build\/three\.module\.js['"]\s*;/,'V3 loader must be able to replace the compiled engine import');
assert.ok(!/shogiops|GPL-3\.0/.test(rules),'Removed GPL dependency is still in the current bundle');
for(const name of ['game23.js','game-backend.js','board-games/table.mjs']) {
  const source=await stat(join(root,name)),built=await stat(join(dist,name));
  assert.ok(built.size<source.size,`Uncompiled source: ${name}`);
}
const result=spawnSync(process.execPath,[join(root,'tests/board-games.mjs')],{env:{...process.env,BOARD_TEST_DIST:'1'},encoding:'utf8'});
assert.equal(result.status,0,result.stdout+result.stderr);
console.log(result.stdout.trim());
console.log(`Public distribution: ${files.length} files, no development sources or source maps, compiled game rules passed.`);
