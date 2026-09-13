import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import ts from 'typescript';
import {guides} from '../aitech/help.mjs';
const source=await readFile(new URL('../aitech/route.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {routePath}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
assert.equal(routePath('/commons/'),'');
assert.equal(routePath('/commons/tools/chat/'),'tools/chat');
assert.equal(routePath('/commons/%E3%81%82/'),'あ');
assert.equal(routePath('/commons/%E0%A4%A/'),null);
assert.equal(routePath('/commons/%/'),null);
assert.equal(guides.length,17);
assert.equal(new Set(guides.map(x=>x[0])).size,17);
const help=await readFile(new URL('../../commons/help/index.html',import.meta.url),'utf8');
assert.equal((help.match(/<article id=/g)||[]).length,17);
for(const [id,,path] of guides){
  assert.ok(help.includes(`id="${id}"`));
  await access(new URL(`../../commons/${path}/index.html`,import.meta.url));
}
assert.ok(!help.includes('<script'),'Help must remain available when scripts fail');
const index=await readFile(new URL('../../commons/index.html',import.meta.url),'utf8');
assert.match(index,/<noscript>/);
assert.match(index,/使い方・読み込めないときは/);
console.log(JSON.stringify({passed:true,malformedUrls:2,guideRoutes:17,scriptIndependentHelp:true}));
