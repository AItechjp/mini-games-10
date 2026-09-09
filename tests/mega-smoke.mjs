import { chromium } from 'playwright';

const root = (process.env.MEGA_BASE_URL || 'http://127.0.0.1:4173/').replace(/\/?$/, '/');
const full = process.env.MEGA_FULL !== '0';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
const errors = [];
page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
page.on('console', msg => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });

async function failIfErrors(where){
  if(errors.length) throw new Error(`${where}\n${errors.splice(0).join('\n')}`);
}

await page.goto(root + 'mega-arcade.html', {waitUntil:'networkidle'});
await page.waitForSelector('#gameGrid .game-card');
const total = await page.locator('#gameGrid .game-card').count();
if(total !== 320) throw new Error(`catalog count ${total}, expected 320`);
const stats = await page.evaluate(() => window.MEGA_ARCADE_STATS);
if(!stats || stats.total !== 320 || stats.mobile !== 100 || stats.card !== 100 || stats.board !== 100 || stats.playing !== 20 || stats.uniqueProfiles !== 320){
  throw new Error(`invalid stats ${JSON.stringify(stats)}`);
}
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if(overflow > 4) throw new Error(`mobile horizontal overflow ${overflow}px`);
await failIfErrors('initial load');

const expected = {mobile:100, card:100, board:100, playing:20};
for (const [cat,count] of Object.entries(expected)){
  await page.click(`[data-cat="${cat}"]`);
  await page.waitForFunction(n => document.querySelectorAll('#gameGrid .game-card').length === n, count);
  const actual = await page.locator('#gameGrid .game-card').count();
  if(actual !== count) throw new Error(`${cat} count ${actual}, expected ${count}`);
}
await page.click('[data-cat="all"]');

let ids = await page.locator('#gameGrid .game-card').evaluateAll(nodes => nodes.map(n => n.dataset.open));
if(!full) ids = ['m001','m061','m077','m083','c001','c058','c092','b001','b085','b099','p002','p009','p017','p020'];
for(const id of ids){
  await page.evaluate(gameId => {
    openGame(gameId);
    const play = document.querySelector('#playScreen');
    const stage = document.querySelector('#gameStage');
    if(!play || play.classList.contains('hidden')) throw new Error(`${gameId}: play screen did not open`);
    if(!stage || stage.children.length === 0) throw new Error(`${gameId}: empty game stage`);
  }, id);
  await page.waitForTimeout(12);
  await failIfErrors(`mount ${id}`);
  await page.evaluate(() => closeGame());
}

await page.goto(root + 'index.html', {waitUntil:'networkidle'});
const megaLinks = await page.locator('a[href="mega-arcade.html"], [data-mode-href="mega-arcade.html"]').count();
if(megaLinks < 1) throw new Error('index.html has no MEGA ARCADE entry');
await failIfErrors('index navigation');

console.log(`MEGA ARCADE smoke OK: ${full ? ids.length : 'representative'} modes; catalog=320; profiles=320`);
await browser.close();