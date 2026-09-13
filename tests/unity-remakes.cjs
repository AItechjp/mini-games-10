// UNITY_BASE_URL=http://localhost:4173/ node tests/unity-remakes.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.UNITY_BASE_URL||'https://aitechd.com/';
const output=process.env.UNITY_OUTPUT||'test-output/unity';
const entries=[['startrail',8],['skybreak-rivals',2],['black-site',1]];
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.UNITY_CHROME?{channel:'chrome'}:{}),args:['--enable-webgl']});
 const results=[];
 try {for(const [slug,mode] of entries){
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.setDefaultTimeout(90000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!errors.includes(m.text()))errors.push(m.text());});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  await page.goto(new URL('unity/'+slug+'.html',base).href);
  await page.waitForFunction(()=>window.aitechUnity&&!document.getElementById('start').disabled,null,{timeout:180000});
  await page.click('#start');
  await page.waitForFunction(()=>window.aitechUnitySnapshot?.playing&&window.aitechUnitySnapshot.time>.5);
  const before=await page.evaluate(()=>window.aitechUnitySnapshot);
  assert.equal(before.game,mode,'URL must select the correct Unity game');
  await page.locator('#unity-canvas').focus();
  const key=mode===1?'w':'d';await page.keyboard.down(key);await page.waitForTimeout(1800);await page.keyboard.up(key);
  const after=await page.evaluate(()=>window.aitechUnitySnapshot);
  assert.ok(Math.abs(after.x-before.x)+Math.abs(after.z-before.z)>.3,'Movement must change the player position');
  if(mode===8)assert.match(after.status,/COINS [1-9]/,'Coins must be collectible');
  if(mode===1){
   await page.evaluate(()=>window.aitechUnity.SendMessage('Arcade','Control','fire:1'));await page.waitForTimeout(800);
   await page.evaluate(()=>window.aitechUnity.SendMessage('Arcade','Control','fire:0'));
   const status=(await page.evaluate(()=>window.aitechUnitySnapshot)).status;
   assert.ok(!status.includes('PILGRIM 18/18'),'Shooting must consume ammunition');
  }
  await page.evaluate(()=>window.aitechUnity.SendMessage('Arcade','PauseGame',''));
  await page.waitForFunction(()=>window.aitechUnitySnapshot.paused);
  const time=await page.evaluate(()=>window.aitechUnitySnapshot.time);await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>window.aitechUnitySnapshot.time),time,'Pause must stop the game clock');
  await page.click('#start');await page.waitForFunction(()=>!window.aitechUnitySnapshot.paused);
  await page.screenshot({path:path.join(output,slug+'.png'),fullPage:true});
  await page.evaluate(()=>window.aitechUnity.SendMessage('Arcade','Restart',''));
  await page.waitForFunction(()=>!window.aitechUnitySnapshot.playing&&window.aitechUnitySnapshot.time===0);
  if(mode===2){
   await page.selectOption('[data-option="fighter"]','3');await page.waitForFunction(()=>window.aitechUnitySnapshot.status.startsWith('AERO'));
   await page.selectOption('[data-option="arena"]','8');await page.waitForFunction(()=>window.aitechUnitySnapshot.hint.startsWith('WING CROSSING'));
   await page.selectOption('[data-option="rule"]','2');await page.waitForFunction(()=>window.aitechUnitySnapshot.status.includes('1 STOCK'));
  }
  if(mode===8){
   await page.setViewportSize({width:390,height:844});await page.click('#touch-toggle');await page.click('#start');
   const right=page.locator('[data-input="x:1"]');await right.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',isPrimary:true});
   await page.waitForTimeout(1000);await right.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch',isPrimary:true});
   assert.ok((await page.evaluate(()=>window.aitechUnitySnapshot)).x>2,'Touch controls must move');
   await page.screenshot({path:path.join(output,'startrail-mobile.png'),fullPage:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile page must not overflow');
  }
  assert.deepEqual(errors,[],'No browser or Unity errors');results.push({slug,mode,passed:true,snapshot:after});console.log('PASS',slug);
  await page.close();
 }}finally{await browser.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({base,results},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
