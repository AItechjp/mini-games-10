// Existing deployment gate: exercise the real learning journey on a fresh mobile browser.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=(process.env.YOBI_BASE_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'yobi-quiz.html',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#homeView:not([hidden]) .subject-card');
 assert.equal(await page.locator('.subject-card').count(),8);
 assert.equal(await page.locator('script[src*="yobi-complete"]').count(),0);
 assert((await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<4,'mobile overflow');
 await page.click('[data-subject="民法"]');
 const id='shihou_yobi_2025_民法商法民事訴訟法_001';
 await page.locator('[data-open="'+id+'"]').click();
 await page.waitForSelector('#sessionView:not([hidden]) .question-text');
 const bank=await(await page.request.get(root+'assets/tanto/bank.json')).json();const q=bank.find(q=>q.id===id);
 for(let i=0;i<q.answer.length;i++)await page.locator('[data-slot="'+(q.kind==='vector'?i:0)+'"][data-choice="'+q.answer[i]+'"]').click();
 await page.click('[data-grade="sure"]');
 await page.waitForSelector('.feedback');assert(await page.locator('.feedback').getByRole('heading',{name:'正解',exact:true}).isVisible());
 await page.fill('#answerMemo','根拠を翌日確認する。');
 await page.click('[data-action="bookmark"]');await page.click('[data-action="saveExit"]');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-action="resume"]');await page.click('[data-action="resume"]');
 assert.equal(await page.inputValue('#answerMemo'),'根拠を翌日確認する。');
 assert.equal(await page.locator('[data-action="bookmark"]').getAttribute('aria-pressed'),'true');
 await page.click('[data-action="saveExit"]');await page.click('.navigation [data-view="exam"]');
 await page.click('[data-examtype="bar"]');await page.selectOption('#examYear','2024');
 page.once('dialog',d=>d.accept());await page.click('[data-test="憲法"]');
 await page.waitForSelector('#sessionView:not([hidden]) #examClock');
 assert.equal(await page.locator('.feedback').count(),0,'test reveals answers before submission');
 assert((await page.locator('#examClock').textContent()).startsWith('49:')||(await page.locator('#examClock').textContent())==='50:00');
 // Persist an elapsed deadline and reload, reproducing background-tab timeout behavior.
 await page.evaluate(()=>{const x=JSON.parse(localStorage.getItem('yobiTantoNotebookV3'));x.session.deadline=Date.now()-5000;localStorage.setItem('yobiTantoNotebookV3',JSON.stringify(x));});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#resultView:not([hidden]) .result-score',{timeout:15000});
 assert((await page.locator('#resultView').innerText()).includes('時間切れで提出'));
 assert(errors.length===0,errors.join('\n'));
 console.log(JSON.stringify({ok:true,mode:'past-question-notebook',mobile:true,grading:true,memoPersisted:true,timeoutSubmitted:true}));
} finally {await browser.close();}
