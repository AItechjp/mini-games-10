import { chromium } from 'playwright';

const root = (process.env.YOBI_BASE_URL || process.env.MEGA_BASE_URL || 'http://127.0.0.1:4173/').replace(/\/?$/, '/');
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors = [];
page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
page.on('console', msg => { if (msg.type()==='error') errors.push(`console: ${msg.text()}`); });

await page.goto(root + 'yobi-quiz.html', {waitUntil:'networkidle'});
await page.waitForSelector('#paperGrid .paper-card');

const zero = (await page.locator('.zero-card strong').textContent())?.trim();
if (zero !== '0') throw new Error(`original-question count is ${zero}, expected 0`);
let cards = await page.locator('#paperGrid .paper-card').count();
if (cards !== 4) throw new Error(`preliminary cards ${cards}, expected 4`);

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 4) throw new Error(`mobile horizontal overflow ${overflow}px`);

await page.click('[data-exam="bar"]');
await page.waitForFunction(() => document.querySelectorAll('#paperGrid .paper-card').length === 3);
cards = await page.locator('#paperGrid .paper-card').count();
if (cards !== 3) throw new Error(`bar-exam cards ${cards}, expected 3`);

await page.click('#yearGroup .year-btn:nth-child(2)');
await page.locator('#paperGrid [data-start]').first().click();
await page.waitForSelector('#runner.active');
const problemHref = await page.locator('#officialProblem').getAttribute('href');
const answerHref = await page.locator('#officialAnswer').getAttribute('href');
if (!problemHref?.startsWith('https://www.moj.go.jp/')) throw new Error(`invalid problem source ${problemHref}`);
if (!answerHref?.startsWith('https://www.moj.go.jp/')) throw new Error(`invalid answer source ${answerHref}`);
if (!problemHref.includes('jinji08_00267')) throw new Error(`2025 judicial problem page mismatch ${problemHref}`);
if (!answerHref.includes('jinji08_00270')) throw new Error(`2025 judicial answer page mismatch ${answerHref}`);

const before = (await page.locator('#timerText').textContent())?.trim();
if (before !== '50:00') throw new Error(`judicial constitution timer ${before}, expected 50:00`);
await page.click('#timerStart');
await page.waitForTimeout(1150);
const after = (await page.locator('#timerText').textContent())?.trim();
if (after === before) throw new Error('timer did not run');
await page.click('#timerPause');

await page.fill('#answerMemo','過去問メモ smoke test');
await page.click('#markComplete');
const stored = await page.evaluate(() => localStorage.getItem('yobiPastOnlyProgressV1'));
if (!stored || !stored.includes('過去問メモ smoke test')) throw new Error('progress memo was not persisted');

if (errors.length) throw new Error(errors.join('\n'));
await browser.close();
console.log(JSON.stringify({ok:true,mode:'past-only',preliminaryCards:4,barCards:3,problemHref,answerHref}));
