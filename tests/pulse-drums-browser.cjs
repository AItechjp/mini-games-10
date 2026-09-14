const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {readFile,mkdir}=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),output=path.join(root,'test-output','pulse-drums');
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error();const body=await readFile(file);res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}});
const report={errors:[],checks:[]};let browser;
function wav(){const rate=22050,duration=12,buf=Buffer.alloc(44+rate*duration*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(rate,24);buf.writeUInt32LE(rate*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(buf.length-44,40);for(let beat=0;beat<23;beat++){const off=Math.round((.25+beat*.5)*rate);for(let j=0;j<1000;j++)buf.writeInt16LE(Math.round(Math.sin(j*.15)*Math.exp(-j/140)*22000),44+(off+j)*2);}return buf;}
async function tapAt(page,t,keys){await page.evaluate(t=>{window.__forcedTime=t;},t);for(const key of keys)await page.keyboard.down(key);for(const key of keys)await page.keyboard.up(key);await page.waitForTimeout(90);}
(async()=>{
  await mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.PULSE_BASE_URL||`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch({headless:true,...(process.env.PULSE_CHROMIUM?{executablePath:process.env.PULSE_CHROMIUM}:{}),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'pulse-drums/');assert.equal(await page.locator('.song-item').count(),11);assert.equal(await page.locator('#selected-title').innerText(),'CITY SIGNAL');
  await page.screenshot({path:path.join(output,'desktop-select.png')});
  await page.evaluate(async()=>{const {AudioEngine}=await import('./music.mjs?v=20260915-1');const play=AudioEngine.prototype.play,position=AudioEngine.prototype.position;AudioEngine.prototype.play=function(...a){window.__pulseAudio=this;window.__forcedTime=null;return play.apply(this,a)};AudioEngine.prototype.position=function(){return window.__forcedTime===null||window.__forcedTime===undefined?position.call(this):window.__forcedTime;};});
  await page.click('#start-button');await page.waitForTimeout(3300);assert.equal(await page.locator('#play-screen').isVisible(),true);
  const activity=await page.evaluate(async()=>{const a=window.__pulseAudio,an=a.ctx.createAnalyser();an.fftSize=1024;a.master.connect(an);const samples=new Float32Array(1024);let energy=0;for(let i=0;i<10;i++){await new Promise(r=>setTimeout(r,60));an.getFloatTimeDomainData(samples);energy+=samples.reduce((s,v)=>s+v*v,0)/samples.length;}a.master.disconnect(an);return{state:a.ctx.state,energy,events:a.index,active:a.active.size};});
  assert.equal(activity.state,'running');assert.ok(activity.energy>.00001,'Audio actually produces samples');assert.ok(activity.events>4);report.checks.push({audio:activity});
  await page.click('#pause-button');await page.waitForTimeout(100);const before=await page.evaluate(()=>window.__pulseAudio.ctx.currentTime);await page.waitForTimeout(400);const after=await page.evaluate(()=>window.__pulseAudio.ctx.currentTime);assert.equal(after,before);await page.click('#resume-button');await page.waitForTimeout(150);assert.ok(await page.evaluate(before=>window.__pulseAudio.ctx.currentTime>before,before));report.checks.push('pause freezes music; resume continues');
  await tapAt(page,4*60/104,['d','Space']);assert.ok(Number(await page.locator('#perfect-count').textContent())>=2,'Simultaneous keyboard hit');
  await page.screenshot({path:path.join(output,'desktop-play.png')});
  await page.evaluate(()=>window.__forcedTime=100);await page.waitForTimeout(200);assert.ok(await page.locator('#result-screen').isVisible());assert.ok(await page.evaluate(()=>!!JSON.parse(localStorage.getItem('aitech-pulse-drums-v1')).bests['city-signal:0']));
  await page.click('#back-to-list');await page.check('#autoplay');await page.click('#start-button');await page.waitForTimeout(150);await page.evaluate(()=>window.__forcedTime=100);await page.waitForTimeout(250);assert.equal(await page.locator('#result-score').textContent(),'1000000');assert.equal(await page.locator('#result-rank').textContent(),'SS');assert.equal(await page.locator('#new-best').isVisible(),false);report.checks.push('full chart completes; demo receives SS and is excluded from records');
  await page.click('#back-to-list');await page.click('[data-track="chronos"]');assert.ok(await page.locator('#start-button').isDisabled());
  await page.setInputFiles('#audio-file',{name:'local-rhythm-test.wav',mimeType:'audio/wav',buffer:wav()});await page.waitForFunction(()=>document.querySelector('#file-status').textContent.includes('読み込み完了'));assert.ok(await page.locator('#start-button').isEnabled());
  await page.click('#start-button');await page.waitForTimeout(200);await page.evaluate(()=>window.__forcedTime=20);await page.waitForTimeout(200);assert.ok(await page.locator('#result-screen').isVisible());assert.equal(await page.locator('#result-title').textContent(),'Chronos');assert.equal(await page.locator('#result-score').textContent(),'1000000');report.checks.push('local audio decodes, makes chart, plays and reaches results');
  await page.click('#back-to-list');await page.click('[data-track="chronos"]');await page.setInputFiles('#audio-file',{name:'broken.wav',mimeType:'audio/wav',buffer:Buffer.from('invalid')});await page.waitForFunction(()=>!document.querySelector('#file-status').textContent.includes('解析中'));assert.ok(await page.locator('#start-button').isDisabled());report.checks.push('invalid local audio cannot start');
  for(const viewport of [{width:844,height:390},{width:568,height:320},{width:390,height:844}]){
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});const mobile=await context.newPage();mobile.on('pageerror',e=>report.errors.push(e.message));await mobile.goto(base+'pulse-drums/');await mobile.waitForTimeout(200);
    await mobile.screenshot({path:path.join(output,`${viewport.width}-select.png`)});
    const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false,'No horizontal overflow');
    await mobile.tap('#start-button');await mobile.waitForTimeout(3500);assert.ok(await mobile.locator('#play-screen').isVisible());
    const pads=await mobile.locator('.pad').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,visible:r.x>=-2&&r.y>=-2&&r.right<=innerWidth+2&&r.bottom<=innerHeight+2}}));assert.ok(pads.every(p=>p.visible),'All six pads visible');
    await mobile.tap('.pad[data-lane="1"]');await mobile.screenshot({path:path.join(output,`${viewport.width}-play.png`)});
    await mobile.tap('#pause-button');assert.ok(await mobile.locator('#pause-dialog').isVisible());await mobile.tap('#quit-button');assert.ok(await mobile.locator('#select-screen').isVisible());report.checks.push({viewport,pads});await context.close();
  }
  assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
