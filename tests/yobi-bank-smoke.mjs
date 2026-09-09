await import('../yobi-complete-data.js');
await import('../yobi-complete-fixes.js');

const data = globalThis.YOBI_COMPLETE_DATA;
if (!data) throw new Error('YOBI_COMPLETE_DATA missing');

const subjects = ['憲法','行政法','民法','商法','民事訴訟法','刑法','刑事訴訟法','一般教養'];
if (data.cards.length !== 240) throw new Error(`cards ${data.cards.length}, expected 240`);
if (data.scenarios.length !== 40) throw new Error(`scenarios ${data.scenarios.length}, expected 40`);
if (data.cards.length * 4 + data.scenarios.length !== 1000) throw new Error('generated bank is not exactly 1000');

const ids = new Set();
for (const card of data.cards) {
  for (const field of ['id','subject','difficulty','tag','title','statement','basis']) {
    if (!String(card[field] ?? '').trim()) throw new Error(`empty card field ${card.id}/${field}`);
  }
  if (ids.has(card.id)) throw new Error(`duplicate card id ${card.id}`);
  ids.add(card.id);
}
for (const scenario of data.scenarios) {
  for (const field of ['id','subject','difficulty','tag','question','explanation','basis']) {
    if (!String(scenario[field] ?? '').trim()) throw new Error(`empty scenario field ${scenario.id}/${field}`);
  }
  if (ids.has(scenario.id)) throw new Error(`duplicate scenario id ${scenario.id}`);
  ids.add(scenario.id);
  if (!Array.isArray(scenario.options) || scenario.options.length !== 4) throw new Error(`invalid options ${scenario.id}`);
  if (!Number.isInteger(scenario.correct) || scenario.correct < 0 || scenario.correct > 3) throw new Error(`invalid correct index ${scenario.id}`);
  if (new Set(scenario.options).size !== 4) throw new Error(`duplicate scenario option ${scenario.id}`);
}

for (const subject of subjects) {
  const cards = data.cards.filter(x => x.subject === subject);
  const scenarios = data.scenarios.filter(x => x.subject === subject);
  if (cards.length !== 30) throw new Error(`${subject}: ${cards.length} cards, expected 30`);
  if (scenarios.length !== 5) throw new Error(`${subject}: ${scenarios.length} scenarios, expected 5`);
  const uniqueTitles = new Set(cards.map(x => x.title));
  if (uniqueTitles.size < 27) throw new Error(`${subject}: too many duplicate titles (${uniqueTitles.size})`);
}

const official = data.official?.blocks || [];
if (official.length !== 4) throw new Error(`official blocks ${official.length}, expected 4`);
const minutes = official.reduce((sum, block) => sum + block.minutes, 0);
if (minutes !== 330) throw new Error(`official timer total ${minutes}, expected 330`);

const gen02 = data.cards.find(x => x.id === 'gen02');
if (gen02?.title !== '十分条件') throw new Error('general-education condition label normalization failed');
const gen03 = data.cards.find(x => x.id === 'gen03');
if (!gen03?.statement.includes('「AかつB」の否定')) throw new Error('De Morgan normalization failed');

console.log(JSON.stringify({ok:true,cards:data.cards.length,scenarios:data.scenarios.length,total:1000,subjects:subjects.length,officialMinutes:minutes}));
