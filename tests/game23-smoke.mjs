import { chromium } from 'playwright';

const root=(process.env.GAME23_BASE_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
const browser=await chromium.launch({headless:true,args:['--ignore-gpu-blocklist','--enable-webgl','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36'});
const page=await context.newPage();
const errors=[];
const failed=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('console',m=>{
  if(m.type()!=='error')return;
  const text=m.text();
  // Chromium reports favicon/optional third-party 404s as generic console errors.
  // Startup correctness is asserted explicitly below, so only real JS errors are fatal.
  if(/Failed to load resource/i.test(text))return;
  errors.push(`console: ${text}`);
});
page.on('response',r=>{
  if(r.status()<400)return;
  const u=r.url();
  if(/game23(?:-v3)?(?:-loader|-part\d+)?\.js|game23(?:-v3|-controls)?\.css/i.test(u))failed.push(`${r.status()} ${u}`);
});

function fail(where){
  const all=[...errors,...failed.map(x=>`critical resource: ${x}`)];
  if(all.length)throw new Error(`${where}\n${all.join('\n')}`);
}

await page.goto(root+'game23.html?mode=solo',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(1200);
const loadState=await page.evaluate(()=>({
  title:document.querySelector('#overlay-title')?.textContent||'',
  text:document.querySelector('#overlay-text')?.textContent||'',
  disabled:!!document.querySelector('#game23-start')?.disabled,
  button:document.querySelector('#game23-start')?.textContent||'',
  loader:[...document.scripts].map(s=>s.src).find(s=>s.includes('game23-v3-loader'))||''
}));
if(loadState.title==='LOAD ERROR')throw new Error(`loader failed: ${loadState.text}`);
await page.waitForFunction(()=>{const b=document.querySelector('#game23-start');return b&&!b.disabled;},null,{timeout:25000});
fail('before start');

await page.locator('#game23-start').tap({timeout:10000});
await page.waitForFunction(()=>document.querySelector('#game23-overlay')?.classList.contains('hidden'),null,{timeout:15000});
await page.waitForTimeout(2200);

const started=await page.evaluate(()=>({
  overlayHidden:document.querySelector('#game23-overlay')?.classList.contains('hidden')||false,
  area:document.querySelector('#hud-area')?.textContent||'',
  life:document.querySelector('#hud-life')?.textContent||'',
  canvasW:document.querySelector('#game23-canvas')?.width||0,
  canvasH:document.querySelector('#game23-canvas')?.height||0,
  frameW:document.querySelector('#game23-frame')?.getBoundingClientRect().width||0,
  frameH:document.querySelector('#game23-frame')?.getBoundingClientRect().height||0
}));
if(!started.overlayHidden)throw new Error(`start overlay still visible: ${JSON.stringify(started)}`);
if(started.canvasW<10||started.canvasH<10)throw new Error(`canvas not rendering: ${JSON.stringify(started)}`);
if(!/^1\s*\/\s*6/.test(started.area))throw new Error(`AREA 1 did not start: ${JSON.stringify(started)}`);
fail('after start');
console.log('GAME23 smoke OK',JSON.stringify({loadState,started}));
await browser.close();
