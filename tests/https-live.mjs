import { chromium } from 'playwright';

const base = new URL(process.env.HTTPS_BASE_URL || 'https://aitechd.com/');
const pages = [
  '', 'solo.html', 'online.html', 'chat.html', 'whiteboard.html', 'apps.html',
  'mega-arcade.html', 'fps.html', 'shooting.html', 'typing.html',
  'game15.html', 'game16.html', 'game23.html', 'racing.html', 'party.html',
  'yobi-quiz.html', 'legal.html'
];

if (base.protocol !== 'https:') throw new Error(`HTTPS_BASE_URL must use https: ${base}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: false });
const failures = [];

for (const path of pages) {
  const target = new URL(path, base).href;
  const insecure = new Set();
  const pageErrors = [];
  const page = await context.newPage();

  page.on('request', request => {
    const url = request.url();
    if (/^(?:http|ws):\/\//i.test(url)) insecure.add(url);
  });
  page.on('requestfailed', request => {
    const url = request.url();
    const reason = request.failure()?.errorText || '';
    if (/mixed[- ]content|blocked:mixed-content/i.test(reason) || /^(?:http|ws):\/\//i.test(url)) {
      insecure.add(`${url} (${reason || 'request failed'})`);
    }
  });
  page.on('pageerror', error => pageErrors.push(String(error?.message || error)));

  let response = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (response && response.ok()) break;
      lastError = new Error(`${target} returned ${response?.status() ?? 'no response'}`);
    } catch (error) {
      lastError = error;
    }
    await page.waitForTimeout(5000);
  }

  if (!response?.ok()) {
    failures.push(`${target}: navigation failed: ${lastError?.message || response?.status() || 'unknown error'}`);
    await page.close();
    continue;
  }

  await page.waitForTimeout(path === 'game23.html' || path === 'fps.html' ? 5000 : 1500);
  const finalProtocol = await page.evaluate(() => location.protocol);
  const perfInsecure = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(name => /^(?:http|ws):\/\//i.test(name)));
  for (const url of perfInsecure) insecure.add(url);

  if (finalProtocol !== 'https:') failures.push(`${target}: final protocol is ${finalProtocol}`);
  if (insecure.size) failures.push(`${target}: insecure requests: ${[...insecure].join(' | ')}`);

  // Page script errors are reported for diagnostics but do not fail this transport audit;
  // the purpose here is to guarantee HTTPS/mixed-content cleanliness across the site.
  if (pageErrors.length) console.warn(`${target}: page errors observed: ${pageErrors.join(' | ')}`);
  console.log(`HTTPS OK: ${target}`);
  await page.close();
}

await browser.close();
if (failures.length) {
  console.error('HTTPS live audit failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`HTTPS live audit passed for ${pages.length} pages at ${base.origin}.`);
