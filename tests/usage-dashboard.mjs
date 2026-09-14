import assert from 'node:assert/strict';
import {quota,validateManual,validateSnapshot,fresh,validateBuild} from '../commons/usage/model.mjs';
import {measurePublicUsage} from '../scripts/measure-public-usage.mjs';
import {mkdtemp,mkdir,writeFile,readFile,readdir,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
assert.equal(quota(null,500),null);assert.equal(quota(undefined,500),null);assert.equal(quota(NaN,500),null);assert.equal(quota(-1,500),null);
assert.equal(quota(0,500).remaining,500);assert.equal(quota(400,500).level,'warn');assert.equal(quota(700,500).remaining,0);assert.equal(quota(700,500).exceeded,200);assert.equal(quota(700,500).bar,100);
const now=Date.parse('2026-09-14T16:00:00Z'),entry={used:0,periodStart:'2026-09-01',periodEnd:'2026-09-30',observedAt:'2026-09-14T15:00:00Z'};
assert.equal(validateManual(entry,now).active,true);assert.equal(validateManual(entry,Date.parse('2026-09-30T15:00:00Z')).active,false);assert.equal(validateManual({...entry,used:null},now).valid,false);assert.equal(validateManual({...entry,observedAt:'2026-10-01T00:00:00Z'},now).valid,false);
assert.equal(validateManual({...entry,periodStart:'2026-02-31'},now).valid,false);
assert.equal(validateSnapshot({database_bytes:0,storage_bytes:0,storage_objects:0,checked_at:new Date(now).toISOString()}),true);assert.equal(validateSnapshot({database_bytes:null,storage_bytes:0,storage_objects:0,checked_at:new Date(now).toISOString()}),false);assert.equal(fresh('2026-09-14T15:50:00Z',now),false);assert.equal(fresh('2026-09-15T00:00:00Z',now),false);
const dir=await mkdtemp(join(tmpdir(),'aitech-usage-'));
try{await mkdir(join(dir,'assets'));await writeFile(join(dir,'assets/sample.txt'),'a'.repeat(512));const report=await measurePublicUsage(dir);let bytes=0,files=0;async function walk(d){for(const e of await readdir(d,{withFileTypes:true})){const p=join(d,e.name);if(e.isDirectory())await walk(p);else{bytes+=(await stat(p)).size;files++;}}}await walk(dir);assert.equal(report.bytes,bytes);assert.equal(report.files,files);assert.equal(report.largestFileBytes,512);assert.equal(validateBuild(JSON.parse(await readFile(join(dir,'commons/usage/build-usage.json')))),true);}finally{await rm(dir,{recursive:true,force:true});}
console.log('Usage: unknown/zero/over-limit, stale data, billing periods and exact public build size passed.');
