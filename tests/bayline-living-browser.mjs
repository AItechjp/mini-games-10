import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='test-output/bayline-living';fs.mkdirSync(out,{recursive:true});
const result={tests:[],errors:[],screenshots:[],started:new Date().toISOString(),renderer:'Real Chromium WebGL2 / SwiftShader; not a hardware FPS benchmark'};
const save=()=>fs.writeFileSync(out+'/browser.json',JSON.stringify(result,null,2));
const browsers=new Set();
const deadline=setTimeout(()=>{result.failure='Browser verification exceeded 7 minutes at '+result.current;save();process.exit(1);},420000);deadline.unref();
const args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'];
async function open(mobile=false){
 const browser=await chromium.launch({headless:true,args});browsers.add(browser);
 const ctx=await browser.newContext(mobile?{viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:960,height:540},deviceScaleFactor:1});
 await ctx.addInitScript(()=>localStorage.setItem('bayline.settings.v1',JSON.stringify({quality:'low',visualBuild:2,autoQuality:false,sound:false,rain:false})));
 const page=await ctx.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>{result.errors.push(e.message);save();});
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404')){result.errors.push(m.text());save();}});
 await page.goto('http://127.0.0.1:4173/bayline/?test=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__BAYLINE_BUILD__==='03-LIVING-CITY-20260912',undefined,{timeout:90000});
 return{browser,page};
}
async function close(browser){await Promise.race([browser.close(),new Promise(r=>setTimeout(r,8000))]);browsers.delete(browser);}
async function check(name,fn){result.current=name;save();console.log('START',name);await fn();assert.equal(result.errors.length,0,result.errors.join('\n'));result.tests.push({name,pass:true});save();console.log('PASS',name);}
async function capture(p,name){
 const data=await p.evaluate(()=>{const t=window.__BAYLINE_TEST__;t.view.draw(t.state,t.localId,1/60,t.cam,!t.running);return{png:t.view.canvas.toDataURL('image/png'),quality:t.view.quality,people:t.view.living.people.count};});
 const bytes=Buffer.from(data.png.split(',')[1],'base64');assert.ok(bytes.length>20000,'Real nonempty rendered image required');fs.writeFileSync(out+'/'+name,bytes);result.screenshots.push(name);result[name]={quality:data.quality,people:data.people};save();
}
async function dismiss(p){if(await p.locator('#panel').evaluate(el=>el.open))await p.click('#closePanel');}
try{
 result.current='Initial renderer';save();const visual=await open(),p=visual.page;
 await check('Real WebGL2 startup, 288 citizens, and articulated player',async()=>{
  await p.click('#continue');await dismiss(p);await p.waitForTimeout(800);
  assert.ok(await p.evaluate(()=>{const t=window.__BAYLINE_TEST__;return t.running&&t.state.civilians.length===288&&t.view.living.people.count>0&&[...t.view.actors.values()].some(m=>m.userData.livingRig);}));
 });
 await check('High quality and window parallax compile and render',async()=>{await p.evaluate(()=>window.__BAYLINE_TEST__.setQuality('high'));await capture(p,'street-high.png');});
 await check('Ultra rain renders actual planar puddle reflections',async()=>{await p.evaluate(()=>{const t=window.__BAYLINE_TEST__;t.setQuality('ultra');t.view.setWeather(true);});await capture(p,'rain-ultra.png');assert.ok(await p.evaluate(()=>window.__BAYLINE_TEST__.view.living.art.reflection.visible));});
 await p.evaluate(()=>{const t=window.__BAYLINE_TEST__;t.setQuality('low');t.view.setWeather(false);});
 await check('Keyboard sprint moves the actual player',async()=>{
  await p.evaluate(()=>{const t=window.__BAYLINE_TEST__;Object.assign(t.state.players[0],{x:0,z:0,car:-1});t.cam.yaw=0;});
  await p.keyboard.down('Shift');await p.keyboard.down('w');await p.waitForFunction(()=>window.__BAYLINE_TEST__.state.players[0].z>1,undefined,{timeout:20000});await p.keyboard.up('w');await p.keyboard.up('Shift');
 });
 await p.evaluate(()=>{const t=window.__BAYLINE_TEST__,a=t.state.civilians.find(p=>p.id===24);Object.assign(t.state.players[0],{x:a.x+2,z:a.z-2,car:-1});t.cam.yaw=-.55;t.cam.pitch=.08;});
 await capture(p,'pedestrians-close.png');await close(visual.browser);
 // Separate foreground processes avoid cross-tab rAF suspension during joining.
 await check('Real two-process Supabase co-op synchronizes pedestrians',async()=>{
  const host=await open();await host.page.evaluate(()=>window.__BAYLINE_TEST__.host());await dismiss(host.page);
  await host.page.waitForFunction(()=>window.__BAYLINE_TEST__.room.joined,undefined,{timeout:30000});
  const invite=await host.page.evaluate(()=>window.__BAYLINE_TEST__.invite);assert.ok(invite);
  const guest=await open();await guest.page.evaluate(i=>window.__BAYLINE_TEST__.join(i),invite);
  await guest.page.waitForFunction(()=>{const t=window.__BAYLINE_TEST__;return t.running&&t.state.players.length===2&&t.state.civilians.length>0;},undefined,{timeout:45000});
  result.coop=await guest.page.evaluate(()=>({mode:window.__BAYLINE_TEST__.mode,citizens:window.__BAYLINE_TEST__.state.civilians.length}));assert.equal(result.coop.mode,'guest');
  await capture(guest.page,'coop-guest.png');await close(guest.browser);await close(host.browser);
 });
 await check('Mobile portrait and landscape preserve touch controls',async()=>{
  const mobile=await open(true),m=mobile.page;await m.click('#continue');await dismiss(m);
  await m.locator('#hud [data-orientation="toggle"]').click();await m.waitForTimeout(800);assert.ok(await m.locator('#stick').isVisible());assert.ok(await m.locator('#touchEnter').isVisible());
  await m.screenshot({path:out+'/phone-landscape.png',timeout:45000});result.screenshots.push('phone-landscape.png');
  await m.locator('#hud [data-orientation="toggle"]').click();await m.waitForTimeout(800);assert.ok(await m.locator('#touchEnter').isVisible());
  await m.screenshot({path:out+'/phone-portrait.png',timeout:45000});result.screenshots.push('phone-portrait.png');await close(mobile.browser);
 });
 result.ok=true;
}catch(error){result.failure=String(error.stack||error);result.ok=false;console.error(error);process.exitCode=1;}
finally{result.finished=new Date().toISOString();save();for(const b of browsers)await close(b).catch(()=>{});clearTimeout(deadline);}
