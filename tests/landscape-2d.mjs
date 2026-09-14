import assert from 'node:assert/strict';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.LANDSCAPE_BASE_URL||'http://127.0.0.1:4187/';
const output='test-output/landscape';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const failures=[],records=[];
const games=[
 ['quick-hop/','#game','#start','[data-control]'],
 ['startrail/','#game','#start','[data-action="left"],[data-action="right"],[data-action="jump"]'],
 ['lantern-duo/','#gameCanvas','#startButton','[data-player]'],
 ['babanuki.html','.table',null,'#draw-cards .card,#own-cards .card'],
 ['trump/?game=memory','#memory-board',null,'#memory-board .card'],
 ['trump/?game=speed','#table',null,'#hand .card,#piles .card'],
 ['classic.html?game=daifugo','#game-stage',null,'.you-area .playing-card,#play-selected'],
 ...['gomoku','shogi','go','othello','chess','monopoly','life'].map(game=>[`board-games/?game=${game}&mode=local`,'#board',null,'#board button.cell']),
];
for(const path of ['quiz-raid/','cyber-quiz/']){
 try{await access(`dist/${path}index.html`);games.push([path,'#play','#start',path.startsWith('quiz')?'.answers button':'.questions button']);}catch{}
}
const rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
try{
 for(const viewport of [{width:844,height:390},{width:667,height:375},{width:740,height:320}]){
  for(const [path,surface,start,controls] of games){
   const name=path.replaceAll(/[^a-z0-9]+/gi,'-');
   const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(base+path,{waitUntil:'networkidle',timeout:30000});
    await page.waitForFunction(()=>document.documentElement.classList.contains('aitech-play-mode'));
    if(start){await page.locator(`${start}:not(:disabled)`).waitFor();await page.locator(start).click();}
    await page.locator(surface).waitFor({state:'visible'});
    if(path.includes('board-games'))await page.locator('#board > :first-child').waitFor();
    if(path.includes('daifugo'))await page.locator('.you-area .playing-card').first().waitFor();
    // Allow ResizeObserver and one layout frame after the game initializes.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const bounds=await page.locator(surface).evaluate(rect);
    const documentSize=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewWidth:innerWidth,viewHeight:innerHeight}));
    assert(bounds.width>100&&bounds.height>100,`${path}: play surface collapsed ${JSON.stringify(bounds)}`);
    assert(bounds.y>=46&&bounds.bottom<=viewport.height+2,`${path}: surface exceeds viewport ${JSON.stringify(bounds)}`);
    assert(documentSize.width<=viewport.width+2&&documentSize.height<=viewport.height+2,`${path}: page scroll ${JSON.stringify(documentSize)}`);
    const bad=await page.locator(controls).evaluateAll(elements=>elements.filter(el=>{
      const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1);
    }).map(el=>({text:el.textContent,rect:el.getBoundingClientRect().toJSON()})));
    assert.deepEqual(bad,[],`${path}: clipped controls`);
    if(path==='quick-hop/')await page.waitForFunction(()=>Number(document.getElementById('time').textContent)>0);
    if(path.includes('game=memory')){
      assert.equal(await page.locator('#memory-board .card').count(),24);
      const card=page.locator('#memory-board .card').first();await card.click();
      assert(!await card.getAttribute('class').then(c=>c.includes('back-card')),'Memory card must flip');
    }
    if(path.includes('game=gomoku')){
      await page.locator('#board button.cell').first().click();
      assert.equal(await page.locator('#board .stone').count(),1);
    }
    if(path.includes('daifugo')){
      const card=page.locator('.you-area .playing-card').first();await card.click();
      assert.equal(await page.locator('.you-area .playing-card.selected').count(),1);
    }
    if(path.includes('quiz-raid'))assert.equal(await page.locator('.answers button').count(),8);
    if(path.includes('cyber-quiz')){
      assert.equal(await page.locator('.question-card').count(),2);
      const answers=await page.locator('.answers button').count();assert(answers>=4&&answers<=8);
    }
    await page.screenshot({path:`${output}/${viewport.width}-${viewport.height}-${name}.png`});
    if(viewport.width===844&&['quick-hop/','trump/?game=memory','classic.html?game=daifugo','board-games/?game=gomoku&mode=local','quiz-raid/','cyber-quiz/'].includes(path)){
      console.log('QA_IMAGE '+path+' '+(await page.screenshot({type:'jpeg',quality:40})).toString('base64'));
    }
    await page.locator('#aitech-play-settings').click();
    assert(await page.locator('#aitech-play-menu').isVisible());
    if(path.includes('cyber-quiz'))assert.equal(await page.locator('#pause').textContent(),'再開する');
    await page.locator('#aitech-play-close').click();
    assert(!await page.locator('#aitech-play-menu').isVisible());
    if(path.includes('cyber-quiz')){
      await page.waitForFunction(()=>document.getElementById('pause').textContent==='一時停止');
      await page.locator('[data-skill="0"]').click();
      const outside=await page.locator('.questions button').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().bottom>innerHeight+1).length);
      assert.equal(outside,0,'Cyber hint must leave the answer buttons visible');
      await page.locator('[data-side="0"]:not(:disabled)').first().click();
      await page.locator('[data-side="1"]:not(:disabled)').first().click();
      await page.locator('#result:not([hidden])').waitFor();
      await page.locator('[data-next]').click();
      assert.equal(await page.locator('#result').isVisible(),false);
    }
    await page.locator('#aitech-play-view').click();
    await page.waitForFunction(()=>!document.documentElement.classList.contains('aitech-play-mode'));
    // Native fullscreen and the orientation API can be denied. The fallback
    // must still expand and its exit must restore settings to their original DOM.
    await page.evaluate(()=>{document.documentElement.requestFullscreen=()=>Promise.reject(new DOMException('Unavailable in this browser','NotAllowedError'));});
    await page.locator('#aitech-play-fullscreen').click();
    await page.waitForFunction(()=>document.documentElement.classList.contains('aitech-play-mode'));
    await page.waitForFunction(()=>document.getElementById('aitech-play-fullscreen').getAttribute('aria-pressed')==='true');
    await page.locator('#aitech-play-fullscreen').click();
    await page.waitForFunction(()=>!document.documentElement.classList.contains('aitech-play-mode'));
    assert.deepEqual(errors,[],`${path}: browser errors`);
    records.push({path,viewport,bounds,status:'passed'});
    console.log(`PASS ${viewport.width}x${viewport.height} ${path} ${Math.round(bounds.width)}x${Math.round(bounds.height)}`);
   }catch(error){failures.push({path,viewport,error:error.message});console.log(`FAIL ${viewport.width}x${viewport.height} ${path}: ${error.message}`);await page.screenshot({path:`${output}/FAIL-${viewport.width}-${name}.png`}).catch(()=>{});}
   finally{await context.close();}
  }
 }
 // Actual fullscreen at desktop dimensions, plus portrait-to-landscape reflow.
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 await page.goto(base+'quick-hop/');await page.locator('#aitech-play-fullscreen').click();
 await page.waitForFunction(()=>document.fullscreenElement||document.getElementById('aitech-play-fullscreen').getAttribute('aria-pressed')==='true');
 await page.waitForFunction(()=>document.documentElement.classList.contains('aitech-play-mode'));
 await page.locator('#aitech-play-fullscreen').click();
 await page.setViewportSize({width:390,height:844});
 await page.reload();await page.locator('#start:not(:disabled)').waitFor();
 assert(!await page.evaluate(()=>document.documentElement.classList.contains('aitech-play-mode')));
 await page.locator('#start').click();await page.waitForFunction(()=>Number(document.getElementById('time').textContent)>0);
 await page.setViewportSize({width:844,height:390});
 await page.waitForFunction(()=>document.documentElement.classList.contains('aitech-play-mode'));
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>!document.documentElement.classList.contains('aitech-play-mode'));
 assert.equal(await page.locator('header #sound').count(),1,'Sound control must return to its original header');
 await context.close();
}catch(error){failures.push({error:error.stack});}
finally{await browser.close();await writeFile(`${output}/results.json`,JSON.stringify({records,failures},null,2));}
assert.equal(failures.length,0,JSON.stringify(failures,null,2));
console.log(`${records.length} landscape game/viewport checks, fullscreen fallback, portrait rotation and desktop fullscreen passed.`);
