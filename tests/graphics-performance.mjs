import assert from 'node:assert/strict';
import '../graphics-performance.js';
import {SurfaceCache} from '../arcade100/surfaces.mjs';
const Budget=globalThis.AitechFrameBudget;
for(const hz of [60,90,120,144,240]){const b=new Budget();let frames=0;for(let t=0;t<10000;t+=1000/hz)frames+=b.shouldDraw(t)?1:0;assert.ok(frames>=599&&frames<=602,`60 FPS pacing at ${hz} Hz: ${frames}`);}
const still=new Budget();let frames=0;for(let t=0;t<10000;t+=1000/144)frames+=still.shouldDraw(t,true,true)?1:0;assert.ok(frames>=299&&frames<=302);
const b=new Budget();for(let i=0;i<500;i++)b.sample(40,16,i*40);assert.equal(b.factor,.55);assert.equal(b.targetFps,30);const lower=b.factor;for(let i=0;i<1200;i++)b.sample(16.667,3,21000+i*16.667);assert.ok(b.factor>lower&&b.factor<=1);
const severe=new Budget();for(let i=0;i<50;i++)severe.sample(150,25,i*150);assert.equal(severe.factor,.55,'persistent very slow frames must trigger adaptation');severe.sample(NaN,0,10000);assert.ok(Number.isFinite(severe.frameMs));
const saved=b.factor;for(let i=0;i<500;i++)b.sample(80,80,50000+i*80,false);assert.equal(b.factor,saved);b.sample(30000,5,100000);assert.equal(b.factor,saved);
for(const mode of ['auto','high','balanced','low']){const v=new Budget({mode,coarse:true,maxPixels:1500000});for(const [w,h,dpr] of [[390,844,3],[1920,1080,2],[7680,4320,2]]){const r=v.scale(w,h,dpr);assert.ok(w*h*r*r<=1500000.01);assert.ok(r<=dpr);}if(mode!=='auto'){for(let i=0;i<300;i++)v.sample(60,40,i*60);assert.equal(v.factor,1);}}
let closed=0;globalThis.OffscreenCanvas=class {constructor(w,h){this.width=w;this.height=h;}getContext(){return {};}transferToImageBitmap(){return {width:this.width,height:this.height,close(){closed++;}};}};
const cache=new SurfaceCache(10000);cache.get('a',70,70,()=>{});cache.get('b',70,70,()=>{});assert.equal(cache.pixels,9800);assert.ok(cache.get('a',70,70,()=>assert.fail('should hit')));cache.get('c',70,70,()=>{});assert.equal(cache.entries.has('b'),false);assert.ok(closed>0);cache.get('parent',90,90,()=>cache.get('child',40,40,()=>{}));assert.ok(cache.pixels<=10000);assert.equal(cache.get('huge',101,101,()=>assert.fail()),null);cache.clear();assert.equal(cache.pixels,0);
console.log('PASS: 60 FPS pacing on 60–240 Hz, still scenes at 30, adaptive hysteresis, hidden-tab handling, pixel caps, immutable bitmap cache eviction');
// Timer results are read only after availability; slow GPUs must not stall JS.
{
  let active=null,disjoint=false,lost=false,reads=0,deletes=0;const all=[];
  const ext={TIME_ELAPSED_EXT:10,GPU_DISJOINT_EXT:11};
  const gl={QUERY_RESULT_AVAILABLE:1,QUERY_RESULT:2,CURRENT_QUERY:3,
    createQuery:()=>{const q={ready:false,ms:18000000};all.push(q);return q;},
    getExtension:()=>ext,isContextLost:()=>lost,getParameter:()=>disjoint,
    getQuery:()=>active,beginQuery:(_,q)=>{active=q;},endQuery:()=>{active=null;},
    deleteQuery:()=>{deletes++;},getQueryParameter:(q,p)=>{if(p===1)return q.ready;assert.ok(q.ready,'never synchronously read unfinished GPU timer');reads++;return q.ms;}};
  const meter=new globalThis.AitechGpuBudget(gl);
  for(let i=0;i<60;i++){meter.begin();meter.end();}
  assert.equal(meter.pending.length,3);assert.equal(reads,0);assert.equal(all.length,3);
  all.forEach(q=>q.ready=true);assert.equal(meter.poll(),18);assert.equal(reads,3);
  for(let i=0;i<6;i++){meter.begin();meter.end();}assert.equal(all.length,3,'reuse completed queries');
  disjoint=true;assert.equal(meter.poll(),0);assert.equal(meter.pending.length,0);assert.ok(deletes>=3);
  lost=true;assert.equal(meter.begin(),false);assert.equal(meter.poll(),0);
  const unsupported=new globalThis.AitechGpuBudget({});assert.equal(unsupported.begin(),false);assert.equal(unsupported.stats.gpuMs,null);
  console.log('PASS: GPU timings remain asynchronous, bounded, reusable and optional');
}
