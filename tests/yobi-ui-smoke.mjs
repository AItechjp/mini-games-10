import { chromium } from 'playwright';

const root = (process.env.YOBI_BASE_URL || 'http://127.0.0.1:4173/').replace(/\/?$/, '/');
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors = [];
page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
page.on('console', msg => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });

async function assertNoErrors(where) {
  if (errors.length) throw new Error(`${where}\n${errors.splice(0).join('\n')}`);
}

await page.goto(root + 'yobi-quiz.html', {waitUntil:'networkidle'});
await page.waitForFunction(() => globalThis.__YOBI_COMPLETE__?.questionCount === 1000);
const meta = await page.evaluate(() => globalThis.__YOBI_COMPLETE__);
if (meta.cardCount !== 240 || meta.scenarioCount !== 40 || meta.subjects.length !== 8) {
  throw new Error(`invalid quiz metadata ${JSON.stringify(meta)}`);
}
if ((await page.locator('#bankCount').textContent()).replace(/,/g,'').trim() !== '1000') throw new Error('bank count not visible as 1000');
if (await page.locator('#subjectGrid .subject-card').count() !== 8) throw new Error('subject card count is not 8');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 4) throw new Error(`mobile horizontal overflow ${overflow}px`);
await assertNoErrors('complete home load');

await page.click('#quickStart');
await page.waitForSelector('#quizView.active #options .option');
if (await page.locator('#options .option').count() !== 4) throw new Error('quiz options count is not 4');
const questionBefore = await page.locator('#questionText').textContent();
await page.locator('#options .option').first().click();
await page.waitForSelector('#feedback:not([hidden])');
if (!(await page.locator('#basis').textContent()).includes('根拠・確認:')) throw new Error('basis feedback missing');
await assertNoErrors('answer feedback');
await page.click('#nextQuestion');
await page.waitForFunction(prev => document.querySelector('#questionText')?.textContent !== prev, questionBefore);
await assertNoErrors('next question');

await page.goto(root + 'yobi-quiz.html', {waitUntil:'networkidle'});
await page.waitForFunction(() => globalThis.__YOBI_COMPLETE__?.questionCount === 1000);
await page.click('[data-exam-block="public"]');
await page.waitForSelector('#quizView.active #timerText:not([hidden])');
const timer = await page.locator('#timerText').textContent();
if (!timer.includes('残り')) throw new Error(`timer did not start: ${timer}`);
if (!(await page.locator('#sessionLabel').textContent()).includes('憲法・行政法')) throw new Error('official block label missing');
if (await page.locator('#options .option').count() !== 4) throw new Error('official block options count is not 4');
await assertNoErrors('official timed block');

await browser.close();
console.log(JSON.stringify({ok:true,url:root,questionCount:meta.questionCount}));
