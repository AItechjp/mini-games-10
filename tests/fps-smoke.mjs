import { chromium } from 'playwright';

const root=(process.env.FPS_BASE_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('console',m=>{
  if(m.type()!=='error')return;
  const text=m.text();
  if(/Failed to load resource/i.test(text))return;
  if(/\[Report Only\].*Content Security Policy/i.test(text))return;
  errors.push(`console: ${text}`);
});

await page.goto(root+'fps.html?mode=solo',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForFunction(()=>window.ARCADE_GAME?.title?.includes('REBORN'),null,{timeout:10000});
const initial=await page.evaluate(()=>({
  title:window.ARCADE_GAME?.title||'',
  canvasW:document.querySelector('#arcade-canvas')?.width||0,
  canvasH:document.querySelector('#arcade-canvas')?.height||0,
  start:document.querySelector('#arcade-start')?.textContent||'',
  utilButtons:document.querySelectorAll('#mobile-controls [data-fps="sprint"],#mobile-controls [data-fps="reload"],#mobile-controls [data-fps="flash"]').length
}));
if(!initial.title.includes('REBORN'))throw new Error(`unexpected title ${initial.title}`);
if(initial.canvasW<100||initial.canvasH<100)throw new Error(`canvas invalid ${JSON.stringify(initial)}`);
if(initial.utilButtons!==3)throw new Error(`mobile utility controls ${initial.utilButtons}, expected 3`);
if(errors.length)throw new Error(`initial load\n${errors.join('\n')}`);

await page.locator('#arcade-start').tap({timeout:10000});
await page.waitForFunction(()=>document.querySelector('#arcade-overlay')?.classList.contains('hidden'),null,{timeout:6000});
await page.waitForTimeout(700);
const started=await page.evaluate(()=>{
  const c=document.querySelector('#arcade-canvas');
  const ctx=c?.getContext('2d');
  let variation=0;
  if(ctx&&c){
    const data=ctx.getImageData(Math.floor(c.width*.35),Math.floor(c.height*.25),Math.floor(c.width*.3),Math.floor(c.height*.45)).data;
    let min=255,max=0;
    for(let i=0;i<data.length;i+=64){const v=(data[i]+data[i+1]+data[i+2])/3;min=Math.min(min,v);max=Math.max(max,v);}
    variation=max-min;
  }
  return {
    overlayHidden:document.querySelector('#arcade-overlay')?.classList.contains('hidden')||false,
    time:document.querySelector('#arcade-time')?.textContent||'',
    variation,
    fireVisible:getComputedStyle(document.querySelector('#fps-fire-button')).display!=='none'
  };
});
if(!started.overlayHidden)throw new Error(`FPS did not start ${JSON.stringify(started)}`);
if(started.variation<8)throw new Error(`canvas appears blank/static ${JSON.stringify(started)}`);
if(!started.fireVisible)throw new Error('FIRE button is not visible');

await page.locator('#fps-fire-button').tap({timeout:5000});
await page.waitForTimeout(180);
const afterShot=await page.evaluate(()=>({toast:document.querySelector('#arcade-toast')?.textContent||'',time:document.querySelector('#arcade-time')?.textContent||''}));
if(errors.length)throw new Error(`during gameplay\n${errors.join('\n')}`);
console.log('FPS smoke OK',JSON.stringify({initial,started,afterShot}));
await browser.close();