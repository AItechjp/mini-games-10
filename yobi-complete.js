(() => {
'use strict';

const DATA = globalThis.YOBI_COMPLETE_DATA;
if (!DATA || !Array.isArray(DATA.cards) || !Array.isArray(DATA.scenarios)) {
  document.body.innerHTML = '<main style="padding:32px;color:white;background:#070b16;min-height:100vh">問題データの読み込みに失敗しました。</main>';
  throw new Error('YOBI_COMPLETE_DATA is missing');
}

const SUBJECT_META = [
  ['憲法','⚖','人権・統治'],
  ['行政法','🏛','行政手続・救済'],
  ['民法','🤝','総則・物権・債権・家族'],
  ['商法','🏢','会社法中心'],
  ['民事訴訟法','📄','訴訟・証拠・判決'],
  ['刑法','🛡','総論・各論'],
  ['刑事訴訟法','🔎','捜査・公判・証拠'],
  ['一般教養','🧠','論理・数理・科学・社会']
];

const STORAGE_KEY = 'yobiQuizProgressCompleteV2';
const LEGACY_KEY = 'yobiQuizProgressV1';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededOrder(items, seed) {
  return [...items].sort((a, b) => hash(seed + a.id) - hash(seed + b.id));
}
function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function distractors(card, field, n = 3) {
  const seen = new Set([card[field]]);
  const pool = seededOrder(
    DATA.cards.filter(x => x.subject === card.subject && x.id !== card.id && x[field] !== card[field]),
    card.id + ':' + field
  );
  const out = [];
  for (const item of pool) {
    const value = item[field];
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
      if (out.length === n) break;
    }
  }
  if (out.length < n) throw new Error(`Not enough distractors for ${card.id}/${field}`);
  return out;
}
function cardQuestion(card, variant) {
  const base = {
    subject: card.subject,
    difficulty: card.difficulty,
    tag: card.tag,
    explanation: card.statement,
    basis: card.basis,
    sourceType: '中核論点'
  };
  if (variant === 'desc') return {
    ...base, id: `${card.id}-desc`,
    question: `「${card.title}」の説明として最も適切なものはどれか。`,
    options: [card.statement, ...distractors(card, 'statement')], correct: 0
  };
  if (variant === 'term') return {
    ...base, id: `${card.id}-term`,
    question: `次の説明が示す論点・制度として最も適切なものはどれか。\n\n${card.statement}`,
    options: [card.title, ...distractors(card, 'title')], correct: 0
  };
  if (variant === 'basis') return {
    ...base, id: `${card.id}-basis`,
    question: `「${card.title}」の主要な根拠として最も適切なものはどれか。`,
    options: [card.basis, ...distractors(card, 'basis')], correct: 0
  };
  return {
    ...base, id: `${card.id}-reverse`,
    question: `「${card.basis}」に対応する内容として最も適切なものはどれか。`,
    options: [card.statement, ...distractors(card, 'statement')], correct: 0
  };
}

const GENERATED = DATA.cards.flatMap(card => ['desc','term','basis','reverse'].map(v => cardQuestion(card, v)));
const SCENARIOS = DATA.scenarios.map(s => ({...s, sourceType:'事例・計算'}));
const QUESTIONS = [...GENERATED, ...SCENARIOS];

if (QUESTIONS.length !== 1000) {
  throw new Error(`Question bank must contain exactly 1000 questions, got ${QUESTIONS.length}`);
}
const BY_ID = new Map(QUESTIONS.map(q => [q.id, q]));

function emptyState() {
  return {version:2, progress:{}, starred:[], sessions:[], updatedAt:Date.now()};
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return {...emptyState(), ...JSON.parse(raw)};
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      const next = emptyState();
      Object.entries(legacy.progress || {}).forEach(([id, p]) => {
        const target = BY_ID.has(`${id}-desc`) ? `${id}-desc` : null;
        if (target) next.progress[target] = {...p};
      });
      next.starred = (legacy.starred || []).map(id => `${id}-desc`).filter(id => BY_ID.has(id));
      return next;
    }
  } catch (e) {
    console.warn('progress load failed', e);
  }
  return emptyState();
}
let saved = loadState();
function persist() {
  saved.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

let session = [];
let sessionAnswers = [];
let index = 0;
let locked = false;
let timerHandle = null;
let deadline = null;
let sessionLabel = '';
let sessionMode = 'practice';
let lastWrongIds = [];

const homeView = $('#homeView');
const quizView = $('#quizView');
const resultView = $('#resultView');

function show(view) {
  [homeView, quizView, resultView].forEach(v => v.classList.remove('active'));
  view.classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
}

function progressFor(id) {
  return saved.progress[id] || {attempts:0, correct:0, lastOk:null, streak:0};
}
function statsFor(items = QUESTIONS) {
  let attempts=0, correct=0, wrongStock=0, mastered=0;
  items.forEach(q => {
    const p = saved.progress[q.id];
    if (!p) return;
    attempts += p.attempts || 0;
    correct += p.correct || 0;
    if (p.lastOk === false) wrongStock++;
    if ((p.attempts || 0) >= 3 && (p.correct || 0) / p.attempts >= .8) mastered++;
  });
  return {attempts, correct, wrongStock, mastered, rate: attempts ? Math.round(correct/attempts*100) : null};
}
function masteryRate(subject) {
  const items = QUESTIONS.filter(q => q.subject === subject);
  const mastered = items.filter(q => {
    const p = saved.progress[q.id];
    return p && p.attempts >= 3 && p.correct / p.attempts >= .8;
  }).length;
  return Math.round(mastered/items.length*100);
}
function weakScore(q) {
  const p = progressFor(q.id);
  if (!p.attempts) return 0;
  return (p.attempts - p.correct) * 4 + (p.lastOk === false ? 4 : 0) - (p.streak || 0);
}
function renderWeakTopics() {
  const holder = $('#weakTopics');
  if (!holder) return;
  const map = new Map();
  QUESTIONS.forEach(q => {
    const p = saved.progress[q.id];
    if (!p || !p.attempts) return;
    const key = `${q.subject}｜${q.tag}`;
    const cur = map.get(key) || {subject:q.subject,tag:q.tag,attempts:0,correct:0};
    cur.attempts += p.attempts;
    cur.correct += p.correct;
    map.set(key, cur);
  });
  const rows = [...map.values()]
    .filter(x => x.attempts >= 2)
    .map(x => ({...x, rate:Math.round(x.correct/x.attempts*100)}))
    .sort((a,b) => a.rate-b.rate || b.attempts-a.attempts)
    .slice(0,6);
  holder.innerHTML = rows.length ? rows.map(x =>
    `<button class="weak-chip" type="button" data-subject="${x.subject}" data-tag="${x.tag}"><strong>${x.subject} / ${x.tag}</strong><span>${x.rate}% ・ ${x.attempts}回答</span></button>`
  ).join('') : '<p class="empty compact">まだ分析データがありません。20問ほど解くと苦手論点が表示されます。</p>';
  holder.querySelectorAll('.weak-chip').forEach(btn => btn.addEventListener('click', () => {
    $('#subjectSelect').value = btn.dataset.subject;
    refreshTags();
    $('#tagSelect').value = btn.dataset.tag;
    startQuiz({subject:btn.dataset.subject, tag:btn.dataset.tag, count:20, order:'weak'});
  }));
}
function renderHome() {
  const s = statsFor();
  $('#statAttempts').textContent = s.attempts.toLocaleString();
  $('#statCorrect').textContent = s.correct.toLocaleString();
  $('#statWrong').textContent = s.wrongStock.toLocaleString();
  $('#statStarred').textContent = saved.starred.length.toLocaleString();
  $('#overallRate').textContent = s.rate == null ? '--%' : `${s.rate}%`;
  $('#masteredCount').textContent = s.mastered.toLocaleString();
  $('#bankCount').textContent = QUESTIONS.length.toLocaleString();
  $('#subjectGrid').innerHTML = SUBJECT_META.map(([name,icon,desc]) => {
    const st = statsFor(QUESTIONS.filter(q => q.subject === name));
    const mastery = masteryRate(name);
    return `<button class="subject-card" type="button" data-subject="${name}">
      <span class="icon">${icon}</span><h3>${name}</h3>
      <p>${desc} / 125問</p>
      <div class="subject-rate"><span>${st.attempts}回答</span><span>${st.rate == null ? '未着手' : st.rate+'%'}</span></div>
      <div class="mini-bar"><i style="width:${st.rate || 0}%"></i></div>
      <small>習熟 ${mastery}%</small>
    </button>`;
  }).join('');
  $$('#subjectGrid .subject-card').forEach(btn => btn.addEventListener('click', () =>
    startQuiz({subject:btn.dataset.subject,count:20,order:'random'})
  ));
  renderWeakTopics();
}

function populateControls() {
  const subject = $('#subjectSelect');
  subject.innerHTML = '<option value="all">全科目ミックス</option>' +
    SUBJECT_META.map(([name]) => `<option value="${name}">${name}</option>`).join('');
  subject.addEventListener('change', refreshTags);
  refreshTags();
}
function refreshTags() {
  const subject = $('#subjectSelect').value;
  const tags = [...new Set(QUESTIONS.filter(q => subject === 'all' || q.subject === subject).map(q => q.tag))].sort();
  $('#tagSelect').innerHTML = '<option value="all">全論点</option>' + tags.map(t => `<option value="${t}">${t}</option>`).join('');
}

function filterPool({subject='all',difficulty='all',tag='all',onlyIds=null,starredOnly=false}) {
  let pool = QUESTIONS.filter(q =>
    (subject === 'all' || q.subject === subject) &&
    (difficulty === 'all' || q.difficulty === difficulty) &&
    (tag === 'all' || q.tag === tag)
  );
  if (onlyIds) {
    const ids = new Set(onlyIds);
    pool = pool.filter(q => ids.has(q.id));
  }
  if (starredOnly) {
    const stars = new Set(saved.starred);
    pool = pool.filter(q => stars.has(q.id));
  }
  return pool;
}
function sortPool(pool, order) {
  if (order === 'weak') return [...pool].sort((a,b) => weakScore(b)-weakScore(a) || Math.random()-.5);
  if (order === 'new') return [...pool].sort((a,b) => (progressFor(a.id).attempts?1:0)-(progressFor(b.id).attempts?1:0) || Math.random()-.5);
  if (order === 'recentWrong') return [...pool].sort((a,b) => (progressFor(a.id).lastOk===false?-1:1)-(progressFor(b.id).lastOk===false?-1:1) || Math.random()-.5);
  return shuffle(pool);
}
function choosePool(config) {
  const pool = sortPool(filterPool(config), config.order || 'random');
  if (config.count === 'all') return pool;
  return pool.slice(0, Math.min(Number(config.count || 20), pool.length));
}

function sampleBalanced(subjects, total) {
  const result = [];
  const per = Math.floor(total / subjects.length);
  let extra = total % subjects.length;
  subjects.forEach(subject => {
    const need = per + (extra-- > 0 ? 1 : 0);
    result.push(...shuffle(QUESTIONS.filter(q => q.subject === subject)).slice(0, need));
  });
  return result;
}

function startQuiz(config, opts={}) {
  stopTimer();
  session = choosePool(config);
  if (!session.length) {
    alert('この条件に合う問題がありません。');
    return;
  }
  sessionAnswers = [];
  lastWrongIds = [];
  index = 0;
  locked = false;
  sessionLabel = opts.label || 'カスタム演習';
  sessionMode = opts.mode || 'practice';
  $('#sessionLabel').textContent = sessionLabel;
  show(quizView);
  if (opts.minutes) startTimer(opts.minutes);
  else $('#timerText').hidden = true;
  renderQuestion();
}
function startOfficialBlock(id) {
  const block = DATA.official.blocks.find(b => b.id === id);
  if (!block) return;
  stopTimer();
  session = sampleBalanced(block.subjects, block.practiceCount);
  sessionAnswers = [];
  lastWrongIds = [];
  index = 0; locked = false;
  sessionLabel = `${block.label} 本番時間演習`;
  sessionMode = `block:${id}`;
  $('#sessionLabel').textContent = sessionLabel;
  show(quizView);
  startTimer(block.minutes);
  renderQuestion();
}
function startFullMock() {
  stopTimer();
  session = [];
  DATA.official.blocks.forEach(block => {
    const chosen = sampleBalanced(block.subjects, block.practiceCount);
    chosen.forEach(q => session.push({...q, mockBlock:block.label}));
  });
  sessionAnswers=[]; lastWrongIds=[]; index=0; locked=false;
  sessionLabel='2026時間割ベース フル模試';
  sessionMode='fullMock';
  $('#sessionLabel').textContent=sessionLabel;
  show(quizView);
  startTimer(DATA.official.blocks.reduce((n,b)=>n+b.minutes,0));
  renderQuestion();
}

function startTimer(minutes) {
  deadline = Date.now() + minutes*60*1000;
  $('#timerText').hidden = false;
  updateTimer();
  timerHandle = setInterval(updateTimer, 1000);
}
function updateTimer() {
  if (!deadline) return;
  const remain = Math.max(0, Math.ceil((deadline-Date.now())/1000));
  const h = Math.floor(remain/3600);
  const m = Math.floor((remain%3600)/60);
  const s = remain%60;
  $('#timerText').textContent = `残り ${h ? h+':' : ''}${String(m).padStart(h?2:1,'0')}:${String(s).padStart(2,'0')}`;
  if (remain <= 0) finish(true);
}
function stopTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle=null; deadline=null;
  if ($('#timerText')) $('#timerText').hidden=true;
}

let visualOptions = [];
function renderQuestion() {
  locked=false;
  const item=session[index];
  const progress = (index/session.length)*100;
  $('#progressText').textContent=`${index+1} / ${session.length}`;
  $('#progressBar').style.width=`${progress}%`;
  $('#qSubject').textContent=item.subject;
  $('#qDifficulty').textContent=item.difficulty;
  $('#qTag').textContent=item.tag;
  $('#qSourceType').textContent=item.sourceType || '演習';
  $('#questionText').textContent=item.question;
  $('#starQuestion').textContent=saved.starred.includes(item.id)?'★':'☆';
  $('#feedback').hidden=true;
  $('#feedback').className='feedback';
  if (sessionMode === 'fullMock' && item.mockBlock) $('#sessionLabel').textContent=`フル模試 / ${item.mockBlock}`;
  else $('#sessionLabel').textContent=sessionLabel;

  visualOptions = shuffle(item.options.map((text, sourceIndex)=>({text,sourceIndex})));
  const labels=['A','B','C','D'];
  $('#options').innerHTML='';
  visualOptions.forEach((opt, visualIndex) => {
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='option';
    btn.innerHTML=`<span class="num">${labels[visualIndex]}</span><span>${opt.text}</span>`;
    btn.addEventListener('click',()=>answer(opt.sourceIndex, visualIndex));
    $('#options').appendChild(btn);
  });
}

function answer(sourceIndex, visualIndex) {
  if (locked) return;
  locked=true;
  const item=session[index];
  const ok=sourceIndex===item.correct;
  const p=progressFor(item.id);
  const next={...p};
  next.attempts=(p.attempts||0)+1;
  next.correct=(p.correct||0)+(ok?1:0);
  next.lastOk=ok;
  next.streak=ok?(p.streak||0)+1:0;
  next.lastAnswered=Date.now();
  saved.progress[item.id]=next;
  sessionAnswers.push({id:item.id,subject:item.subject,tag:item.tag,ok});
  if (!ok) lastWrongIds.push(item.id);
  persist();

  const correctVisualIndex=visualOptions.findIndex(x=>x.sourceIndex===item.correct);
  [...$('#options').children].forEach((btn,i)=>{
    btn.disabled=true;
    if(i===correctVisualIndex)btn.classList.add('correct');
    if(i===visualIndex&&!ok)btn.classList.add('wrong');
  });
  const f=$('#feedback');
  f.hidden=false;
  f.classList.add(ok?'good':'bad');
  $('#feedbackHeadline').textContent=ok?'正解。知識を維持できています。':`不正解。正答は ${String.fromCharCode(65+correctVisualIndex)}。`;
  $('#explanation').textContent=item.explanation;
  $('#basis').textContent=`根拠・確認: ${item.basis}`;
  $('#nextQuestion').textContent=index===session.length-1?'結果を見る':'次の問題';
  renderHome();
}
function nextQuestion() {
  if (!locked) return;
  if (index<session.length-1) {
    index++;
    renderQuestion();
    window.scrollTo({top:0,behavior:'smooth'});
  } else finish(false);
}
function finish(timedOut=false) {
  if (!quizView.classList.contains('active')) return;
  stopTimer();
  const total=sessionAnswers.length;
  const correct=sessionAnswers.filter(a=>a.ok).length;
  const rate=total?Math.round(correct/total*100):0;
  const unanswered=Math.max(0,session.length-total);
  $('#resultRate').textContent=`${rate}%`;
  $('#resultCount').textContent=`${correct} / ${total}${unanswered ? `（未回答 ${unanswered}）` : ''}`;
  $('.result-score').style.setProperty('--rate',`${rate}%`);
  $('#resultTitle').textContent=timedOut?'時間終了':'演習完了';
  $('#resultMessage').textContent =
    rate>=80?'安定圏です。応用・事例と苦手論点を中心に回してください。':
    rate>=70?'かなり良い水準です。誤答をその日のうちに潰すと安定します。':
    rate>=62?'2026年の実際の合格点165/270（約61.1%）を上回る目安ですが、この問題集では70%以上を継続目標にしてください。':
    '基礎論点を科目別に反復し、まず60%台後半を安定させましょう。';

  const groups={};
  sessionAnswers.forEach(a=>{
    groups[a.subject]??={c:0,t:0};
    groups[a.subject].t++;
    if(a.ok)groups[a.subject].c++;
  });
  $('#resultBreakdown').innerHTML=Object.entries(groups).map(([sub,v])=>
    `<div class="break-row"><span>${sub}</span><span>${v.c}/${v.t} ・ ${Math.round(v.c/v.t*100)}%</span></div>`
  ).join('') || '<p class="empty">回答がありません。</p>';

  const sessionRecord={at:Date.now(),label:sessionLabel,mode:sessionMode,total,correct,rate};
  saved.sessions=[sessionRecord,...(saved.sessions||[])].slice(0,50);
  persist();
  show(resultView);
  renderHome();
}

function exportProgress() {
  const payload={product:'予備試験 短答クエスト',bankVersion:DATA.version,exportedAt:new Date().toISOString(),state:saved};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`yobi-progress-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function importProgress(file) {
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      const state=parsed.state || parsed;
      if(!state.progress || !Array.isArray(state.starred)) throw new Error('invalid');
      saved={...emptyState(),...state};
      persist();
      renderHome();
      alert('学習データを読み込みました。');
    }catch{
      alert('学習データとして読み込めないファイルです。');
    }
  };
  reader.readAsText(file);
}

function bind() {
  populateControls();
  $('#quickStart').addEventListener('click',()=>startQuiz({count:20,order:'random'}));
  $('#customStart').addEventListener('click',()=>startQuiz({
    subject:$('#subjectSelect').value,
    difficulty:$('#difficultySelect').value,
    tag:$('#tagSelect').value,
    count:$('#countSelect').value,
    order:$('#orderSelect').value,
    starredOnly:$('#orderSelect').value==='starred'
  }, {label:'カスタム演習'}));
  $('#reviewMistakes').addEventListener('click',()=>{
    const ids=QUESTIONS.filter(q=>progressFor(q.id).lastOk===false).map(q=>q.id);
    if(!ids.length){alert('誤答ストックはまだありません。');return;}
    startQuiz({count:'all',order:'weak',onlyIds:ids},{label:'誤答復習'});
  });
  $('#reviewStarred').addEventListener('click',()=>{
    if(!saved.starred.length){alert('お気に入り問題はまだありません。');return;}
    startQuiz({count:'all',order:'random',starredOnly:true},{label:'お気に入り復習'});
  });
  $$('[data-exam-block]').forEach(btn=>btn.addEventListener('click',()=>startOfficialBlock(btn.dataset.examBlock)));
  $('#fullMock').addEventListener('click',startFullMock);
  $('#quitQuiz').addEventListener('click',()=>{
    if(confirm('この演習を終了してホームに戻りますか？')){
      stopTimer(); show(homeView); renderHome();
    }
  });
  $('#nextQuestion').addEventListener('click',nextQuestion);
  $('#backHome').addEventListener('click',()=>{show(homeView);renderHome();});
  $('#retryWrong').addEventListener('click',()=>{
    const ids=[...new Set(lastWrongIds)];
    if(!ids.length){startQuiz({count:20,order:'random'},{label:'追加演習'});return;}
    startQuiz({count:'all',order:'weak',onlyIds:ids},{label:'今回の誤答を解き直す'});
  });
  $('#starQuestion').addEventListener('click',()=>{
    const id=session[index]?.id; if(!id)return;
    const pos=saved.starred.indexOf(id);
    if(pos>=0)saved.starred.splice(pos,1); else saved.starred.push(id);
    persist();
    $('#starQuestion').textContent=saved.starred.includes(id)?'★':'☆';
    renderHome();
  });
  $('#resetProgress').addEventListener('click',()=>{
    if(confirm('回答履歴・誤答・お気に入りをすべてリセットしますか？')){
      saved=emptyState();persist();renderHome();
    }
  });
  $('#exportProgress').addEventListener('click',exportProgress);
  $('#importProgress').addEventListener('click',()=>$('#importFile').click());
  $('#importFile').addEventListener('change',e=>{
    const file=e.target.files?.[0];
    if(file)importProgress(file);
    e.target.value='';
  });
  document.addEventListener('keydown',e=>{
    if(!quizView.classList.contains('active'))return;
    if(!locked&&['1','2','3','4'].includes(e.key)){
      const idx=Number(e.key)-1;
      const opt=visualOptions[idx];
      if(opt)answer(opt.sourceIndex,idx);
    }else if(locked&&e.key==='Enter')nextQuestion();
  });
}

globalThis.__YOBI_COMPLETE__ = {
  questionCount: QUESTIONS.length,
  cardCount: DATA.cards.length,
  scenarioCount: DATA.scenarios.length,
  subjects: SUBJECT_META.map(x=>x[0]),
  version: DATA.version
};

bind();
renderHome();
})();
