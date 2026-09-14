import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.PIXEL_WALLPAPERS_BASE_URL||'https://aitechd.com/';
const entry=new URL('pixel-wallpapers/',base).href;
const output='test-output/pixel-wallpapers';
await mkdir(output,{recursive:true});
const errors=[],checks=[],requests=[],evidence={entry,passed:false,checks,errors};
let browser,page;
const ready=async(target,id)=>target.waitForFunction(expected=>{
  const selected=document.querySelector('#grid .wallpaper-card[aria-pressed="true"]');
  return selected?.dataset.id===String(expected)&&document.getElementById('loading')?.hidden&&document.getElementById('save')?.disabled===false;
},id,{timeout:20000});
async function canvas2d(target){
  const result=await target.locator('#scene').evaluate(canvas=>{
    const ctx=canvas.getContext('2d');
    return {active:ctx instanceof CanvasRenderingContext2D,visible:getComputedStyle(canvas).opacity!=='0',canvases:canvas.parentElement.querySelectorAll('canvas').length,width:canvas.width,height:canvas.height,contexts:window.__wallpaperContextRequests};
  });
  assert.ok(result.active&&result.visible&&result.canvases===1,'The displayed illustration must use one visible Canvas2D surface');
  assert.ok(result.width>0&&result.height>0);
  assert.ok(result.contexts.every(type=>!/webgl|experimental-webgl/i.test(type)),'The illustration must never request a WebGL context');
  return result;
}
async function frame(target){
  return target.locator('#scene').evaluate(canvas=>{
    // Downsampling reads the actual displayed illustration rather than a renderer test hook.
    const sample=document.createElement('canvas');sample.width=72;sample.height=162;
    const ctx=sample.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(canvas,0,0,sample.width,sample.height);
    return Array.from(ctx.getImageData(0,0,sample.width,sample.height).data);
  });
}
function changedPixels(before,after){
  let changed=0;
  for(let i=0;i<before.length;i+=4)if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2]||before[i+3]!==after[i+3])changed++;
  return changed;
}
async function moving(target,id){
  const before=await frame(target);
  let changed=0;
  for(let attempt=0;attempt<4&&changed<12;attempt++){
    await target.waitForTimeout(250);
    changed=changedPixels(before,await frame(target));
  }
  assert.ok(changed>=12,`Design ${id} must visibly animate; changed ${changed} of 11664 sampled pixels`);
  return changed;
}
async function fits(target,label){
  assert.ok(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' must fit the viewport');
}
async function expanded(target,label,fallback=false){
  await target.waitForFunction(()=>document.fullscreenElement?.id==='stage'||document.getElementById('stage')?.classList.contains('expanded'));
  const state=await target.locator('#stage').evaluate(stage=>{
    const box=stage.getBoundingClientRect();
    const points=[[.5,.5],[.75,.3],[.9,.7]];
    return {fallback:stage.classList.contains('expanded'),fillsViewport:Math.abs(box.width-innerWidth)<=2&&Math.abs(box.height-innerHeight)<=2,hits:points.map(([x,y])=>{const el=document.elementFromPoint(innerWidth*x,innerHeight*y);return {inside:!!el&&stage.contains(el),tag:el?.tagName,id:el?.id,className:el?.getAttribute('class')};})};
  });
  assert.ok(state.fillsViewport,label+' must fill the viewport');
  assert.ok(state.hits.every(hit=>hit.inside),label+' must cover the gallery: '+JSON.stringify(state.hits));
  if(fallback)assert.ok(state.fallback,label+' must exercise the CSS fallback');
  assert.ok(await target.locator('#closeFullscreen').isVisible());
}
async function closeExpanded(target){
  await target.locator('#closeFullscreen').click();
  await target.waitForFunction(()=>!document.fullscreenElement&&!document.getElementById('stage')?.classList.contains('expanded'));
}
async function observe(target){
  target.on('pageerror',error=>errors.push(error.message));
  target.on('request',request=>requests.push(request.url()));
  await target.addInitScript(()=>{
    window.__wallpaperContextRequests=[];
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      window.__wallpaperContextRequests.push(String(type));
      return original.call(this,type,...args);
    };
  });
}

try{
  browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
  const desktop=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true,reducedMotion:'no-preference'});
  page=await desktop.newPage();await observe(page);page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(30000);
  const response=await page.goto(entry);assert.ok(response?.ok(),'Wallpaper entry must load successfully');
  await ready(page,1);
  const ids=await page.locator('#grid .wallpaper-card').evaluateAll(cards=>cards.map(card=>Number(card.dataset.id)).sort((a,b)=>a-b));
  assert.deepEqual(ids,Array.from({length:100},(_,i)=>i+1),'Exactly 100 distinct selectable designs');
  assert.equal(await page.locator('#filters button[data-theme]').count(),11,'All worlds plus ten world filters');
  evidence.desktopCanvas2D=await canvas2d(page);
  assert.ok(await page.locator('#motion').isChecked(),'Illustrations should move by default when reduced motion is not requested');
  await fits(page,'Desktop');
  checks.push('100 unique designs and ten world filters');

  // Select every design through the real gallery and observe its displayed pixels over time.
  const samples=[];evidence.samples=samples;
  const animationCheckStarted=Date.now();
  for(let theme=0;theme<10;theme++){
    await page.locator(`#filters button[data-theme="${theme}"]`).click();
    assert.equal(await page.locator('#grid .wallpaper-card').count(),10,'Each world must offer ten compositions');
    for(let variant=0;variant<10;variant++){
      const id=theme*10+variant+1;
      const card=page.locator(`#grid .wallpaper-card[data-id="${id}"]`);
      const title=(await card.locator('.card-title').innerText()).trim();
      await card.click();await ready(page,id);
      assert.equal((await page.locator('#sceneTitle').innerText()).trim(),title);
      assert.equal(new URL(page.url()).searchParams.get('id'),String(id));
      samples.push({id,title,changedPixels:await moving(page,id)});
    }
  }
  evidence.animationCheckMs=Date.now()-animationCheckStarted;
  checks.push('All 100 illustrations across ten worlds load, select and visibly animate');
  await page.locator('#motion').uncheck();
  await page.waitForTimeout(200);
  const pausedFrame=await frame(page);
  await page.waitForTimeout(250);
  assert.equal(changedPixels(pausedFrame,await frame(page)),0,'Pausing must freeze the entire illustration');
  await page.locator('#motion').check();
  assert.ok(await moving(page,100)>=12,'Resuming must restart illustration movement');
  checks.push('Pause freezes the rendered pixels; resume restarts movement');
  await page.locator('#filters button[data-theme="-1"]').click();
  await page.locator('#grid .wallpaper-card[data-id="1"]').click();await ready(page,1);
  await page.locator('#clockToggle').check();
  await page.locator('#save').scrollIntoViewIfNeeded();
  await page.screenshot({path:output+'/desktop.png'});

  // Exercise the actual Save button and browser download, without replacing the exporter.
  const downloadEvent=page.waitForEvent('download',{timeout:30000});
  await page.locator('#save').click();
  const download=await downloadEvent;
  assert.equal(await download.failure(),null,'The browser must complete the PNG download');
  assert.equal(download.suggestedFilename(),'nocturne-pixel10-001.png');
  const pngPath=output+'/'+download.suggestedFilename();
  await download.saveAs(pngPath);
  const png=await readFile(pngPath);
  assert.ok(png.length>1024,'PNG must contain image data');
  assert.deepEqual(png.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]),'PNG signature');
  assert.equal(png.readUInt32BE(8),13,'IHDR length');
  assert.equal(png.toString('ascii',12,16),'IHDR');
  assert.equal(png.readUInt32BE(16),1080,'Pixel 10 export width');
  assert.equal(png.readUInt32BE(20),2424,'Pixel 10 export height');
  const pixels=await page.evaluate(async encoded=>{
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
    const canvas=document.createElement('canvas');canvas.width=108;canvas.height=242;
    const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,colors=new Set();
    let visible=0,min=255,max=0;
    for(let i=0;i<rgba.length;i+=4){if(rgba[i+3])visible++;colors.add((rgba[i]<<16)|(rgba[i+1]<<8)|rgba[i+2]);const light=Math.max(rgba[i],rgba[i+1],rgba[i+2]);min=Math.min(min,light);max=Math.max(max,light);}
    const result={width:bitmap.width,height:bitmap.height,visible,samples:rgba.length/4,colors:colors.size,range:max-min};bitmap.close();return result;
  },png.toString('base64'));
  assert.equal(pixels.width,1080);assert.equal(pixels.height,2424);
  assert.ok(pixels.visible>pixels.samples*.95&&pixels.colors>16&&pixels.range>20,'Decoded PNG must contain visible, varying artwork, not a blank frame');
  evidence.png={file:download.suggestedFilename(),bytes:png.length,sha256:createHash('sha256').update(png).digest('hex'),...pixels};
  await canvas2d(page);checks.push('Real save-button download: valid, nonblank 1080 × 2424 PNG');

  await page.locator('#expand').click();
  await expanded(page,'Desktop fullscreen');
  await page.screenshot({path:output+'/fullscreen.png'});
  await closeExpanded(page);
  // Simulate an unsupported browser API while retaining the real expand handler and CSS.
  await page.locator('#stage').evaluate(stage=>Object.defineProperty(stage,'requestFullscreen',{configurable:true,value:undefined}));
  await page.locator('#expand').click();
  await expanded(page,'Desktop fullscreen fallback',true);
  await page.screenshot({path:output+'/fullscreen-fallback.png'});
  await closeExpanded(page);
  await page.locator('#stage').evaluate(stage=>{delete stage.requestFullscreen;});
  checks.push('Fullscreen and unsupported-API fallback cover the gallery and close');
  await desktop.close();

  const mobile=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  page=await mobile.newPage();await observe(page);page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(30000);
  await page.goto(new URL('?id=100',entry).href);await ready(page,100);
  assert.equal(await page.locator('#grid .wallpaper-card').count(),100);
  evidence.mobileCanvas2D=await canvas2d(page);
  assert.equal(await page.locator('#motion').isChecked(),false,'Reduced motion must disable animation on initial load');
  await page.waitForTimeout(200);
  const reducedFrame=await frame(page);
  await page.waitForTimeout(250);
  assert.equal(changedPixels(reducedFrame,await frame(page)),0,'Reduced-motion artwork must remain still');
  await fits(page,'Mobile portrait');
  await page.screenshot({path:output+'/mobile-portrait.png'});
  await page.setViewportSize({width:740,height:393});
  await fits(page,'Mobile landscape');
  // A rejected permission request must take the same safe, viewport-wide fallback path.
  await page.locator('#stage').evaluate(stage=>Object.defineProperty(stage,'requestFullscreen',{configurable:true,value:()=>Promise.reject(new Error('Simulated unsupported fullscreen request'))}));
  await page.locator('#expand').click();
  await expanded(page,'Mobile fullscreen fallback',true);
  await page.screenshot({path:output+'/mobile-fullscreen.png'});
  await closeExpanded(page);
  await fits(page,'Mobile after fullscreen');
  checks.push('Reduced motion on load, mobile design 100, portrait/landscape overflow and fullscreen');
  await canvas2d(page);
  evidence.renderingDependencies=requests.filter(url=>/\/(?:three|babylon)(?:[.\/-]|[?#]|$)/i.test(new URL(url).pathname));
  assert.deepEqual(evidence.renderingDependencies,[],'The 2D illustrations must not request a 3D rendering library');
  checks.push('Canvas2D on desktop and mobile, without WebGL requests or Three.js dependencies');
  assert.deepEqual(errors,[],'No uncaught page errors');
  evidence.passed=true;
  console.log(JSON.stringify(evidence,null,2));
}catch(error){
  evidence.failure=error.stack||String(error);
  if(page&&!page.isClosed())await page.screenshot({path:output+'/failure.png',timeout:5000}).catch(()=>{});
  throw error;
}finally{
  await writeFile(output+'/results.json',JSON.stringify(evidence,null,2));
  await browser?.close();
}
