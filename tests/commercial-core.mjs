import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {nextCell} from '../board-games/keyboard.mjs';
const ts=async path=>{const {code}=await transform(await readFile(new URL(path,import.meta.url),'utf8'),{loader:'ts',format:'esm'});return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));};
const {LatestRequest}=await ts('../commons-src/lib/request-lifecycle.ts');
const owner=new LatestRequest(),first=owner.begin(1000),second=owner.begin(1000);
assert(first.signal.aborted);assert(!first.current());assert(second.current());
first.finish();assert(second.current());assert(!second.signal.aborted);
owner.cancel();assert(second.signal.aborted);assert(!second.current());
const timeout=owner.begin(5);await new Promise(r=>setTimeout(r,15));
assert(timeout.signal.aborted);assert(timeout.timedOut());assert(timeout.current(),'Timeout must still be able to report its error');timeout.finish();
for(const size of [8,9,15]){
 assert.equal(nextCell(0,'ArrowLeft',size),0);assert.equal(nextCell(0,'ArrowUp',size),0);
 assert.equal(nextCell(size-1,'ArrowRight',size),size-1);
 assert.equal(nextCell(size*size-1,'ArrowDown',size),size*size-1);
 assert.equal(nextCell(size+3,'Home',size),size);assert.equal(nextCell(size+3,'End',size),size*2-1);
 assert.equal(nextCell(size+3,'Home',size,true),0);assert.equal(nextCell(size+3,'End',size,true),size*size-1);
}
const {validForecast}=await ts('../commons-src/lib/weather.ts');
const current={time:'2026-09-14T12:00:00+09:00',temperature:28,feelsLike:29,humidity:60,windSpeed:2,windDirection:90,code:1,isDay:1};
const forecast={cityId:'gifu',fetchedAt:'2026-09-14T03:00:00Z',current,days:[{date:'2026-09-14',code:1,high:30,low:21,probability:20,precipitation:0,sunrise:null,sunset:null}],hourly:[]};
assert(validForecast(forecast,'gifu'));
for(const f of [null,{}, {...forecast,cityId:'ogaki'}, {...forecast,days:[]},{...forecast,fetchedAt:'broken'},{...forecast,current:{...current,temperature:'28'}},{...forecast,current:{...current,time:'broken'}},{...forecast,days:[null]}])assert(!validForecast(f,'gifu'));
const report=JSON.parse(await readFile(new URL('../docs/AItech-100-improvements.json',import.meta.url)));
assert.equal(report.apps.length,33);assert.equal(report.total,3300);
for(const app of report.apps){assert.equal(app.items.length,100);assert.deepEqual(app.items.map(i=>i.number),Array.from({length:100},(_,i)=>i+1));assert(app.items.every(i=>i.title&&i.status));}
console.log('Commercial regressions: stale-request exclusion, timeout recovery, board navigation, malformed forecasts and 33 × 100 item accounting passed.');
