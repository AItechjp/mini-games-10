import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.QUALITY_BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['camera']});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Simulate a slow game script: a click must wait for working event handlers.
 let releaseHop;const hopReady=new Promise(resolve=>releaseHop=resolve);
 await page.route('**/quick-hop/game.js*',async route=>{await hopReady;await route.continue();});
 await page.addInitScript(()=>localStorage.setItem('aitech-quickhop-best','Infinity'));
 try{
  await page.goto(base+'quick-hop/',{waitUntil:'commit'});
  await page.locator('#start').waitFor();
  assert(!(await page.locator('#start').isEnabled()),'Start must be disabled while its script is loading');
  assert(!(await page.locator('#restart').isEnabled()));
 }finally{releaseHop();}
 await page.locator('#start:not(:disabled)').waitFor();
 assert.equal(await page.locator('#best').textContent(),'');
 await page.locator('#start').click();await page.waitForFunction(()=>Number(document.querySelector('#time').textContent)>0);
 await page.unroute('**/quick-hop/game.js*');
 await page.goto(base+'board-games/?game=gomoku&mode=local');
 const first=page.locator('#board [data-index="0"]');await first.waitFor();await first.focus();
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.index),'16');
 await page.keyboard.press('Enter');assert.equal(await page.locator('#board .stone').count(),1);
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.index),'16');
 assert.equal(await page.locator('#board button[tabindex="0"]').count(),1);
 await page.keyboard.press('Control+End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.index),'224');
 await page.locator('#game').selectOption('chess');await page.locator('#confirm-yes').click();await page.waitForFunction(()=>document.querySelector('#aitech-app-guide')?.dataset.app==='chess');
 await page.goto(base+'board-games/?game=monopoly&mode=local');
 await page.waitForFunction(()=>document.querySelector('#board')?.getAttribute('aria-label')==='盤面。進行は操作ボタンで行います。');
 await page.goto(base+'trump/?game=memory');
 await page.getByRole('button',{name:'アプリメニューを開く',exact:true}).click();
 const pane=page.locator('#aitech-app-guide');await pane.getByRole('tab',{name:'個人メモ',exact:true}).click();
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('aitech.app-guide.note.'))throw new DOMException('full','QuotaExceededError');return original.call(this,key,value)};});
 await pane.getByRole('textbox',{name:'個人メモ',exact:true}).fill('保存できない入力も保持する');
 await pane.getByRole('button',{name:'アプリメニューを閉じる'}).click();
 assert(await pane.getByRole('dialog').isVisible());
 assert.equal(await pane.getByRole('textbox',{name:'個人メモ',exact:true}).inputValue(),'保存できない入力も保持する');
 await pane.getByRole('button',{name:'入力をこの画面に残して閉じる'}).click();
 assert(!await pane.getByRole('dialog').isVisible());
 await page.getByRole('button',{name:'アプリメニューを開く',exact:true}).click();
 assert.equal(await pane.getByRole('textbox',{name:'個人メモ',exact:true}).inputValue(),'保存できない入力も保持する');
 // Use a fresh page so the deliberately unsaved note's unload warning stays meaningful.
 const camera=await context.newPage();camera.on('pageerror',e=>errors.push(e.message));
 await camera.goto(base+'commons/camera/');await camera.locator('#start-button').click();
 await camera.waitForFunction(()=>!document.getElementById('capture-button').disabled);
 await camera.locator('#capture-delay').selectOption('3');await camera.locator('#capture-button').click();
 await camera.getByRole('button',{name:'アプリメニューを開く',exact:true}).click();
 assert(!await camera.locator('#capture-countdown').isVisible());
 await camera.waitForTimeout(3300);assert(!(await camera.locator('#thumbnail').getAttribute('src')));
 assert.deepEqual(errors,[]);await context.close();
 console.log('Commercial UI regressions: board keyboard/focus, failed-note-save retention, explicit defer and camera countdown cancellation passed.');
}finally{await browser.close();}
