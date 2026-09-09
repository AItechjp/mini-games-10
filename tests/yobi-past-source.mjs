import fs from 'node:fs';

const html = fs.readFileSync('yobi-quiz.html','utf8');
const js = fs.readFileSync('yobi-past.js','utf8');

if (!html.includes('yobi-past.js')) throw new Error('past-only engine is not loaded');
for (const forbidden of ['yobi-complete.js','yobi-complete-data.js','yobi-complete-fixes.js','yobi-quiz.js','yobi-quiz-randomize.js']) {
  if (html.includes(forbidden)) throw new Error(`legacy/generated quiz engine is still connected: ${forbidden}`);
}
if (!html.includes('オリジナル問題を、出題しない。')) throw new Error('past-only declaration missing');

const urls = [...js.matchAll(/https:\/\/www\.moj\.go\.jp\/jinji\/shihoushiken\/[A-Za-z0-9_./-]+\.html/g)].map(m => m[0]);
if (urls.length < 12) throw new Error(`expected official problem/answer links, found ${urls.length}`);
if (urls.some(url => !url.startsWith('https://www.moj.go.jp/'))) throw new Error('non-MOJ source detected');

for (const year of ['2026','2025','2024']) {
  if (!js.includes(`${year}: {`)) throw new Error(`missing detailed past-paper year ${year}`);
}
for (const label of ['憲法・行政法','民法・商法・民事訴訟法','刑法・刑事訴訟法','一般教養科目']) {
  if (!js.includes(label)) throw new Error(`missing preliminary block ${label}`);
}
for (const label of ['司法試験の公式短答式・憲法','司法試験の公式短答式・民法','司法試験の公式短答式・刑法']) {
  if (!js.includes(label)) throw new Error(`missing bar-exam block ${label}`);
}

if (html.includes('1,000問') || html.includes('1000問')) throw new Error('old generated-bank wording remains on past-only page');

console.log(JSON.stringify({ok:true,mode:'past-only',years:3,sets:21,officialUrls:urls.length}));
