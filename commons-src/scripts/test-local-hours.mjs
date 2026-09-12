import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const temp=await mkdtemp(join(tmpdir(),'commons-hours-'));
try {
 const require=createRequire(await realpath(new URL('../node_modules/vite/package.json',import.meta.url)));
 await require('esbuild').build({entryPoints:[new URL('../lib/local-hours.ts',import.meta.url).pathname],outfile:join(temp,'hours.cjs'),bundle:true,platform:'node',format:'cjs'});
 const cases=[
  ['before opening','09:00-21:00','2026-09-12T08:59:59+09:00','closed'],
  ['opening boundary','09:00-21:00','2026-09-12T09:00:00+09:00','open'],
  ['closing boundary','09:00-21:00','2026-09-12T21:00:00+09:00','closed'],
  ['overnight carry','Mo 18:00-02:00','2026-09-15T01:00:00+09:00','open'],
  ['overnight close','Mo 18:00-02:00','2026-09-15T02:00:00+09:00','closed'],
  ['weekly closure','09:00-21:00; Mo off','2026-09-14T12:00:00+09:00','closed'],
  ['holiday hours','09:00-21:00; PH 10:00-18:00','2026-09-21T09:30:00+09:00','closed'],
  ['holiday closure','24/7; PH off','2026-09-21T12:00:00+09:00','closed'],
  ['special closure','24/7','2026-09-12T12:00:00+09:00','closed',{exceptions:{'2026-09-12':'off'}}],
  ['special hours','09:00-21:00','2026-09-12T09:30:00+09:00','closed',{exceptions:{'2026-09-12':'10:00-18:00'}}],
  ['reservation','24/7','2026-09-12T12:00:00+09:00','unknown',{access:'private'}],
  ['missing hours','','2026-09-12T12:00:00+09:00','unknown'],
  ['stale hours','24/7','2027-01-12T12:00:00+09:00','unknown'],
  ['unsupported holiday year','24/7; PH off','2028-01-01T12:00:00+09:00','unknown',{checkedAt:'2028-01-01T00:00:00Z'}],
  ['second Wednesday','16:00-22:30; We[2,4] off','2026-09-09T18:00:00+09:00','closed'],
  ['first Wednesday','16:00-22:30; We[2,4] off','2026-09-02T18:00:00+09:00','open'],
  ['malformed hours','bad schedule','2026-09-12T12:00:00+09:00','unknown'],
  ['missing source date','24/7','2026-09-12T12:00:00+09:00','unknown',{checkedAt:'invalid'}]
 ];
 await writeFile(join(temp,'check.cjs'),`const assert=require('node:assert/strict'),{localStatus}=require('./hours.cjs');const base={prefecture:'岐阜県',checkedAt:'2026-09-12T00:00:00Z'};for(const [name,hours,date,expected,extra] of ${JSON.stringify(cases)})assert.equal(localStatus({...base,hours,...extra},Date.parse(date)).state,expected,name);`);
 for(const TZ of ['UTC','Asia/Tokyo','America/New_York','Europe/London']){
  const result=spawnSync(process.execPath,[join(temp,'check.cjs')],{env:{...process.env,TZ},encoding:'utf8'});
  assert.equal(result.status,0,TZ+' '+result.stderr);
 }
 console.log(`${cases.length} schedule cases passed in four device time zones.`);
} finally {await rm(temp,{recursive:true,force:true})}
