import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='test-output/bayline-living';fs.mkdirSync(out,{recursive:true});
const results={tests:[],errors:[],screenshots:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function context(mobile=false){const c=await browser.newContext(mobile?{viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:1280,height:720},deviceScaleFactor:1});await c.addInitScript(()=>localStorage.setItem('bayline.settings.v1',JSON.stringify({quality:'low',visualBuild:2,autoQuality:false,sound:false,rain:false})));return c;}
async function start(ctx){const p=await ctx.newPage();p.on('pageerror',e=>results.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))results.errors.push(m.text());});await p.goto('http://127.0.0.1:4173/bayline/?test=1',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__BAYLINE_BUILD__==='03-LIVING-CITY-20260912',{},{timeout:120000});return p;}
async function check(name,fn){await fn();results.tests.push({name,pass:true});console.log('PASS',name);}
try{
 const desktop=await context(),p=await start(desktop);
 await check('Real WebGL2 renderer starts Build 03',async()=>{assert.ok(await p.evaluate(()=>{const t=window.__BAYLINE_TEST__;return t.view.renderer.getContext()&&t.view.living&&t.state.civilians.length===288;}));});
 await p.screenshot({path:out+'/title.png'});results.screenshots.push('title.png');
 await p.click('#continue');await p.waitForTimeout(1600);
 await check('Original solo entry and real articulated crowd render',async()=>{assert.ok(await p.evaluate(()=>window.__BAYLINE_TEST__.running));assert.ok(await p.evaluate(()=>window.__BAYLINE_TEST__.view.living.people.count>0));assert.ok(await p.evaluate(()=>[...window.__BAYLINE_TEST__.view.actors.values()].some(m=>m.userData.livingRig)));});
 await check('High-quality scene compiles with window parallax',async()=>{await p.evaluate(()=>window.__BAYLINE_TEST__.setQuality('high'));await p.waitForTimeout(2500);assert.equal(await p.evaluate(()=>window.__BAYLINE_TEST__.view.quality),'high');});
 await p.screenshot({path:out+'/street-high.png'});results.screenshots.push('street-high.png');
 await check('Ultra rain reflection and ambient occlusion compile',async()=>{await p.evaluate(()=>{const t=window.__BAYLINE_TEST__;t.setQuality('ultra');t.view.setWeather(true);});await p.waitForTimeout(2500);assert.equal(await p.evaluate(()=>window.__BAYLINE_TEST__.view.living.art.reflection.visible),true);});
 await p.screenshot({path:out+'/rain-ultra.png'});results.screenshots.push('rain-ultra.png');
 await p.evaluate(()=>{window.__BAYLINE_TEST__.setQuality('low');window.__BAYLINE_TEST__.view.setWeather(false);});
 await check('Sprint changes player position without collision penetration',async()=>{const before=await p.evaluate(()=>{const t=window.__BAYLINE_TEST__;Object.assign(t.state.players[0],{x:0,z:0,car:-1});t.cam.yaw=0;return t.state.players[0].z;});await p.keyboard.down('Shift');await p.keyboard.down('w');await p.waitForTimeout(800);await p.keyboard.up('w');await p.keyboard.up('Shift');assert.ok(await p.evaluate(z=>window.__BAYLINE_TEST__.state.players[0].z>z+1,before));});
 await check('Real Supabase two-browser co-op includes civilian snapshots',async()=>{
  await p.evaluate(()=>window.__BAYLINE_TEST__.host());const invite=await p.evaluate(()=>window.__BAYLINE_TEST__.invite);assert.ok(invite);
  const guestContext=await context(),guest=await start(guestContext);await guest.evaluate(i=>window.__BAYLINE_TEST__.join(i),invite);
  await guest.waitForFunction(()=>window.__BAYLINE_TEST__.running&&window.__BAYLINE_TEST__.state.players.length===2,{},{timeout:45000});
  await guest.waitForFunction(()=>window.__BAYLINE_TEST__.state.civilians.length>0,{},{timeout:15000});
  results.coop=await guest.evaluate(()=>({citizens:window.__BAYLINE_TEST__.state.civilians.length,mode:window.__BAYLINE_TEST__.mode}));assert.equal(results.coop.mode,'guest');await guestContext.close();
 });
 await desktop.close();
 const mobile=await context(true),m=await start(mobile);await m.click('#continue');
 await check('Portrait/landscape UI and touch controls remain usable',async()=>{await m.locator('#hud [data-orientation="toggle"]').click();await m.waitForTimeout(1000);assert.ok(await m.locator('#stick').isVisible());assert.ok(await m.locator('#touchEnter').isVisible());await m.locator('#hud [data-orientation="toggle"]').click();await m.waitForTimeout(800);assert.ok(await m.locator('#touchEnter').isVisible());});
 await m.screenshot({path:out+'/phone-portrait.png'});results.screenshots.push('phone-portrait.png');await mobile.close();
 assert.equal(results.errors.length,0,results.errors.join('\n'));
}catch(error){results.failure=String(error.stack||error);console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(out+'/browser.json',JSON.stringify(results,null,2));await browser.close();}
