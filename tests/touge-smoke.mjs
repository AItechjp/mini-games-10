import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTrack } from '../touge/world.js';
import { fresh,step,clamp } from '../touge/physics.mjs';
const base=process.env.TOUGE_BASE_URL||'http://127.0.0.1:4173/';
const live=!base.includes('127.0.0.1')&&!base.includes('localhost');
await mkdir('test-output',{recursive:true});
const track=createTrack(),report={length:track.length,live,checks:[]};
let r=fresh();r.v=30;step(r,1,{brake:1},track);assert(r.v<20);report.checks.push('braking');
r=fresh();r.v=30;r.rival=600;for(let i=0;i<90;i++)step(r,1/120,{gas:1,steer:.6,drift:true},track);assert(r.score>0&&Math.abs(r.slip)>.1&&r.contacts===0);report.checks.push('isolated drift and score');
r=fresh();r.v=35;r.x=5.44;step(r,.1,{steer:1},track);assert(r.contacts>0&&r.v<35);report.checks.push('guardrail impact');
r=fresh();r.v=30;r.rival=11;r.x=track.rivalLane(11);step(r,.01,{gas:1},track);assert(r.contacts>0&&r.v<30);report.checks.push('rival collision');
r=fresh();for(let j=0;j<36001&&!r.finished;j++)step(r,1/120,{gas:0},track);assert(r.finished&&r.reason==='time'&&r.t===300);report.checks.push('300-second timeout');
for(const hz of [60,120]){r=fresh();for(let j=0;j<hz*301&&!r.finished;j++){const k=track.at(r.s).k,steer=clamp((k*r.v*r.v*.092*.24+(-2.7-r.x)*2)/(1.5+r.v*.105),-1,1);step(r,1/hz,{gas:1,steer},track);}assert.equal(r.reason,'finish');report['lap'+hz]={time:r.t,contacts:r.contacts,s:r.s};}
assert(Math.abs(report.lap60.time-report.lap120.time)<.15);report.checks.push('full-course finish and frame-rate independence');
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const errors=[];
function listen(page){page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text());});}
async function load(page){listen(page);await page.goto(base+(live?'racing.html?build=touge-3':'touge/?test=1'),{waitUntil:'networkidle',timeout:120000});await page.waitForFunction(()=>window.__touge?.stats.version==='touge-3'&&!__touge.stats.warming,null,{timeout:120000});assert.equal(await page.evaluate(()=>__touge.state),'menu');}
async function shot(page,name){await page.screenshot({path:'test-output/'+name+'.png',timeout:90000,animations:'disabled'});}
try{
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage();await load(page);
 if(!live)await page.evaluate(()=>__touge.test.freeze(true));
 await shot(page,'01-garage');assert.equal(errors.length,0,errors.join('\n'));report.checks.push('high-quality WebGL scene and shaders boot');
 await page.locator('#quality').selectOption('balanced');await page.waitForFunction(()=>!__touge.stats.warming);await page.locator('#start-btn').click();
 if(!live){await page.evaluate(()=>{const t=__touge.test;t.step(3.5,{gas:1});t.set({s:1200,x:-1.5,v:30,rival:1225,rv:30});});await shot(page,'02-race');report.camera=await page.evaluate(()=>__touge.test.metrics());assert(Math.hypot(...report.camera.camera.map((v,i)=>v-report.camera.player[i]))<12);await page.evaluate(()=>{__touge.test.clear();__touge.test.freeze(false);});}
 await page.waitForFunction(()=>__touge.state==='race',null,{timeout:90000});const initial=await page.evaluate(()=>__touge.stats);
 await page.waitForFunction(a=>__touge.stats.frames>a.frames+8&&__touge.stats.s>a.s+1,initial,{timeout:90000});report.checks.push('real animation loop advances driving');
 await page.locator('#pause-btn').click();assert.equal(await page.evaluate(()=>__touge.state),'paused');const paused=await page.evaluate(()=>__touge.stats.t);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>__touge.stats.t),paused);
 if(live){await page.locator('#pause-layer').evaluate(e=>e.style.visibility='hidden');await shot(page,'02-race');await page.locator('#pause-layer').evaluate(e=>e.style.visibility='');}
 await page.locator('#resume-btn').click();assert.equal(await page.evaluate(()=>__touge.state),'race');report.checks.push('pause and resume');
 if(!live){await page.evaluate(()=>__touge.test.freeze(true));await page.keyboard.press('KeyC');await page.evaluate(()=>__touge.test.render());await shot(page,'03-bonnet');await page.keyboard.press('KeyC');await page.keyboard.press('KeyC');await page.evaluate(()=>{const t=__touge.test;t.set({s:__touge.stats.length-1,v:30,rival:__touge.stats.length-15,rivalFinish:null});t.step(.1,{gas:1});});await page.locator('#finish-layer:not(.hidden)').waitFor();assert.match(await page.locator('#finish-title').innerText(),/WIN|FINISH/);await shot(page,'04-finish');await page.locator('#retry-btn').click();assert.equal(await page.evaluate(()=>__touge.stats.score),0);assert.equal(await page.evaluate(()=>__touge.state),'count');report.checks.push('camera modes, finish UI and clean retry');}
 assert.equal(errors.length,0,errors.join('\n'));await context.close();
 const mobile=await browser.newContext({viewport:{width:915,height:412},deviceScaleFactor:1,isMobile:true,hasTouch:true});await mobile.addInitScript(()=>{HTMLElement.prototype.requestFullscreen=()=>Promise.resolve();});const mp=await mobile.newPage();await load(mp);await mp.locator('#start-btn').scrollIntoViewIfNeeded();assert(await mp.locator('#start-btn').isVisible());await mp.locator('#start-btn').click();
 if(!live)await mp.evaluate(()=>{const t=__touge.test;t.step(3.5,{gas:1});t.set({s:100,v:30,rival:160,x:0});t.clear();});
 await mp.waitForFunction(()=>__touge.state==='race',null,{timeout:90000});
 if(live)await mp.waitForFunction(()=>__touge.stats.v>12,null,{timeout:90000});
 const left=await mp.locator('[data-hold="left"]').boundingBox(),drift=await mp.locator('[data-hold="drift"]').boundingBox();const session=await mobile.newCDPSession(mp);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:left.x+left.width/2,y:left.y+left.height/2,id:0},{x:drift.x+drift.width/2,y:drift.y+drift.height/2,id:1}]});await mp.waitForFunction(()=>__touge.stats.drift&&__touge.stats.score>0,null,{timeout:90000});
 if(!live)await mp.evaluate(()=>{__touge.test.freeze(true);__touge.test.render();});await shot(mp,'05-mobile-drift');await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});report.checks.push('simultaneous touch steering and drift');
 if(!live)await mp.evaluate(()=>__touge.test.freeze(false));await mp.locator('#pause-btn').click();await mp.setViewportSize({width:412,height:915});await shot(mp,'06-portrait');assert.equal(errors.length,0,errors.join('\n'));report.checks.push('scrolling menu and portrait resize');await mobile.close();
 report.ok=true;await writeFile('test-output/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
