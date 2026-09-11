import assert from 'node:assert/strict';
import '../graphics-performance.js';
import {SurfaceCache} from '../arcade100/surfaces.mjs';
const Budget=globalThis.AitechFrameBudget;
for(const hz of [60,90,120,144,240]){const b=new Budget();let frames=0;for(let t=0;t<10000;t+=1000/hz)frames+=b.shouldDraw(t)?1:0;assert.ok(frames>=599&&frames<=602,`60 FPS pacing at ${hz} Hz: ${frames}`);}
const still=new Budget();let frames=0;for(let t=0;t<10000;t+=1000/144)frames+=still.shouldDraw(t,true,true)?1:0;assert.ok(frames>=299&&frames<=302);
const b=new Budget();for(let i=0;i<500;i++)b.sample(40,16,i*40);assert.equal(b.factor,.55);assert.equal(b.targetFps,30);const lower=b.factor;for(let i=0;i<1200;i++)b.sample(16.667,3,21000+i*16.667);assert.ok(b.factor>lower&&b.factor<=1);
const saved=b.factor;for(let i=0;i<500;i++)b.sample(80,80,50000+i*80,false);assert.equal(b.factor,saved);b.sample(30000,5,100000);assert.equal(b.factor,saved);
for(const mode of ['auto','high','balanced','low']){const v=new Budget({mode,coarse:true,maxPixels:1500000});for(const [w,h,dpr] of [[390,844,3],[1920,1080,2],[7680,4320,2]]){const r=v.scale(w,h,dpr);assert.ok(w*h*r*r<=1500000.01);assert.ok(r<=dpr);}if(mode!=='auto'){for(let i=0;i<300;i++)v.sample(60,40,i*60);assert.equal(v.factor,1);}}
let closed=0;globalThis.OffscreenCanvas=class {constructor(w,h){this.width=w;this.height=h;}getContext(){return {};}transferToImageBitmap(){return {width:this.width,height:this.height,close(){closed++;}};}};
const cache=new SurfaceCache(10000);cache.get('a',70,70,()=>{});cache.get('b',70,70,()=>{});assert.equal(cache.pixels,9800);assert.ok(cache.get('a',70,70,()=>assert.fail('should hit')));cache.get('c',70,70,()=>{});assert.equal(cache.entries.has('b'),false);assert.ok(closed>0);cache.get('parent',90,90,()=>cache.get('child',40,40,()=>{}));assert.ok(cache.pixels<=10000);assert.equal(cache.get('huge',101,101,()=>assert.fail()),null);cache.clear();assert.equal(cache.pixels,0);
console.log('PASS: 60 FPS pacing on 60–240 Hz, still scenes at 30, adaptive hysteresis, hidden-tab handling, pixel caps, immutable bitmap cache eviction');
