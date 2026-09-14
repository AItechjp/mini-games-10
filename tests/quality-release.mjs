import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {apps,appFor,commonImprovements,specificImprovements} from '../quality/apps.mjs';
import {validPrefs,safeLink} from '../quality/assist.mjs';
assert.equal(apps.length,33);assert.equal(new Set(apps.map(a=>a.id)).size,33);
assert.equal(commonImprovements.length,15);
assert.deepEqual(validPrefs({text:'900px',motion:true,contrast:'false',touch:1}),{text:'normal',spacing:false,contrast:false,motion:'system',touch:false});
assert.equal(safeLink('javascript:alert(1)','https://aitechd.com'),null);
assert.equal(safeLink('data:text/html,x','https://aitechd.com'),null);
assert.equal(safeLink('/legal.html','https://aitechd.com'),'https://aitechd.com/legal.html');
let routes=0;
for(const app of apps){
  assert.equal(specificImprovements(app).length,5,app.name);
  if(app.id==='aether')continue;
  assert.equal(appFor(app.path)?.id,app.id);
  for(const path of [app.path,...app.aliases??[]]){
    const url=new URL(path,'https://aitechd.com');const file='dist'+url.pathname+(url.pathname.endsWith('/')?'index.html':'');
    const html=await readFile(file,'utf8');assert.match(html,/data-aitech-quality/,file);routes++;
  }
}
for(const f of ['quality/assist.css','quality/assist.mjs','quality/apps.mjs','commons/camera/quality.css'])assert.ok((await stat('dist/'+f)).size>0);
const camera=await readFile('dist/commons/camera/index.html','utf8');for(const id of ['capture-countdown','capture-delay','camera-grid','cancel-countdown'])assert.ok(camera.includes('id="'+id+'"'));
assert.match(await readFile('dist/commons/camera/camera.js','utf8'),/requestCapture/);
console.log(JSON.stringify({apps:33,improvementsPerApp:20,applications:660,localRoutes:routes,preferences:'validated',externalLinks:'HTTP(S) only'}));
