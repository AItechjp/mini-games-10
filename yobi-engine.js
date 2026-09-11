/* Pure study and scoring rules. Question answers are imported, never generated. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const SUBJECTS = ['憲法','行政法','民法','商法','民事訴訟法','刑法','刑事訴訟法','一般教養'];
  const BLOCKS = {public:{label:'憲法・行政法',minutes:60,subjects:['憲法','行政法']},civil:{label:'民法・商法・民事訴訟法',minutes:90,subjects:['民法','商法','民事訴訟法']},criminal:{label:'刑法・刑事訴訟法',minutes:60,subjects:['刑法','刑事訴訟法']},general:{label:'一般教養',minutes:90,subjects:['一般教養']}};
  const dayKey = (time = Date.now()) => new Date(time).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
  const normalize = value => String(value ?? '').normalize('NFKC').trim();
  function answers(value) { return Array.isArray(value) ? value.map(normalize) : normalize(value).split(/[,、\s]+/).filter(Boolean); }
  function grade(q, value) {
    let actual = answers(value), expected = answers(q.answer);
    const complete = q.kind === 'set' ? actual.length === expected.length && new Set(actual).size === actual.length : actual.length === expected.length && actual.every(Boolean);
    if (q.kind === 'set') { actual = actual.slice().sort(); expected = expected.slice().sort(); }
    const correct = complete && actual.every((v,i)=>v===expected[i]);
    const matched = q.kind === 'set' ? actual.filter(v=>expected.includes(v)).length : actual.filter((v,i)=>v===expected[i]).length;
    let points = correct ? q.points : 0;
    if (!correct && q.partial && complete) points = q.partial[String(matched)] || 0;
    return {correct,complete,matched,points,max:q.points,expected:answers(q.answer),actual:answers(value)};
  }
  function emptyStore() {return {schema:3,records:{},history:[],daily:{},settings:{goal:20,large:false},session:null,legacy:{}};}
  function recordAttempt(store,q,value,confidence='sure',now=Date.now(),reason='') {
    const result = grade(q,value), old=store.records[q.id] || {}, previousDay = old.lastDay;
    const r = {...old,attempts:(old.attempts||0)+1,correct:(old.correct||0)+(result.correct?1:0),lastCorrect:result.correct,lastAnswer:answers(value),confidence,lastAt:now,lastDay:dayKey(now),reason};
    if (!old.attempts) r.firstCorrect=result.correct;
    let stage=old.stage||0;
    if (!result.correct || confidence!=='sure') stage=0;
    else if (previousDay!==dayKey(now)) stage=Math.min(stage+1,5);
    r.stage=stage;
    r.due=now+(!result.correct?10*60000:confidence!=='sure'?DAY:[1,1,3,7,14,30][stage]*DAY);
    store.records[q.id]=r;
    const key=dayKey(now),d=store.daily[key]||{attempts:0,correct:0};d.attempts++;d.correct+=result.correct?1:0;store.daily[key]=d;
    return result;
  }
  function stats(bank,store,now=Date.now()) {
    const seen=bank.filter(q=>store.records[q.id]?.attempts), rs=seen.map(q=>store.records[q.id]);
    const first=rs.filter(r=>r.firstCorrect).length, latest=rs.filter(r=>r.lastCorrect).length;
    return {total:bank.length,seen:seen.length,first,latest,firstRate:seen.length?Math.round(first/seen.length*100):null,latestRate:seen.length?Math.round(latest/seen.length*100):null,mastered:rs.filter(r=>r.stage>=3&&r.lastCorrect&&r.confidence==='sure').length,due:rs.filter(r=>r.due<=now).length,wrong:rs.filter(r=>!r.lastCorrect).length,unsure:rs.filter(r=>r.confidence!=='sure').length,bookmarks:bank.filter(q=>store.records[q.id]?.bookmark).length};
  }
  function filterBank(bank,store,f={},now=Date.now()) {
    const query=normalize(f.search).toLowerCase().split(/\s+/).filter(Boolean);
    return bank.filter(q=>{
      const r=store.records[q.id]||{};
      if (f.exam&&f.exam!=='all'&&q.exam!==f.exam)return false;
      if (f.subject&&f.subject!=='all'&&q.subject!==f.subject)return false;
      if (f.year==='recent'&&q.year<2020)return false;
      if (f.year&&f.year!=='all'&&f.year!=='recent'&&q.year!==Number(f.year))return false;
      if (f.topic&&f.topic!=='all'&&!q.topics.includes(f.topic))return false;
      if (f.source==='official'&&!q.answerSource)return false;
      if (f.source==='dataset'&&q.answerSource)return false;
      if (f.status==='new'&&r.attempts)return false;
      if (f.status==='wrong'&&(!r.attempts||r.lastCorrect))return false;
      if (f.status==='due'&&(!r.attempts||r.due>now))return false;
      if (f.status==='unsure'&&(!r.attempts||r.confidence==='sure'))return false;
      if (f.status==='bookmark'&&!r.bookmark)return false;
      if (f.status==='mastered'&&!(r.stage>=3&&r.lastCorrect&&r.confidence==='sure'))return false;
      if (f.status==='choiceReviewed'&&!r.choiceReviewed)return false;
      const hay=normalize(q.text+' '+q.subject+' '+q.topics.join(' ')+' '+(r.note||'')+' '+q.year).toLowerCase();
      return query.every(term=>hay.includes(term));
    });
  }
  function shuffle(a,rng=Math.random){const r=a.slice();for(let i=r.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}
  function dailyQueue(bank,store,count=20,now=Date.now()) {
    const due=shuffle(filterBank(bank,store,{status:'due'},now));
    const unseen=filterBank(bank,store,{status:'new',year:'recent'},now);
    const groups=SUBJECTS.map(s=>shuffle(unseen.filter(q=>q.subject===s))),fresh=[];
    while(groups.some(g=>g.length)){for(const group of groups)if(group.length)fresh.push(group.pop());}
    const used=new Set();return [...due,...fresh,...shuffle(bank)].filter(q=>{if(used.has(q.id))return false;used.add(q.id);return true;}).slice(0,count);
  }
  function historyBlock(h) {
    if (['public','civil','criminal','general'].includes(h?.block)) return h.block;
    const title=String(h?.title||'');
    if (title.includes('憲法・行政法')) return 'public';
    if (title.includes('民法・商法・民事訴訟法')) return 'civil';
    if (title.includes('刑法・刑事訴訟法')) return 'criminal';
    if (title.includes('一般教養')) return 'general';
    return '';
  }
  function readiness(bank,store,now=Date.now()) {
    const legalSubjects=SUBJECTS.filter(s=>s!=='一般教養');
    const legal=bank.filter(q=>q.exam==='preliminary'&&legalSubjects.includes(q.subject)&&!q.pdfOnly);
    const subjects=legalSubjects.map(subject=>{
      const z=stats(legal.filter(q=>q.subject===subject),store,now);
      const coverage=z.total?Math.round(z.seen/z.total*100):0;
      const retention=z.total?Math.round(z.mastered/z.total*100):0;
      return {subject,...z,coverage,retention,coverageReady:coverage>=90,accuracyReady:(z.latestRate||0)>=85,retentionReady:retention>=60};
    });
    const recentYears=[...new Set(bank.filter(q=>q.exam==='preliminary').map(q=>q.year))].sort((a,b)=>b-a).slice(0,2),exams=(store.history||[]).filter(h=>h?.mode==='exam'&&!h.pauses&&h.exam==='preliminary'&&recentYears.includes(h.year)&&Number(h.max)>0);
    const blocks=['public','civil','criminal'].map(block=>({block,passes:new Set(exams.filter(h=>historyBlock(h)===block&&h.points/h.max>=.8).map(h=>h.year)).size}));
    const generalPasses=new Set(exams.filter(h=>historyBlock(h)==='general'&&h.total>=20&&h.correct/h.total>=.7).map(h=>h.year)).size;
    const due=stats(legal,store,now).due;
    const gates=[
      {id:'coverage',label:'法律7科目を各90%以上演習',done:subjects.filter(x=>x.coverageReady).length,total:7,passed:subjects.every(x=>x.coverageReady)},
      {id:'accuracy',label:'各科目の直近正答率85%以上',done:subjects.filter(x=>x.accuracyReady).length,total:7,passed:subjects.every(x=>x.accuracyReady)},
      {id:'retention',label:'各科目60%以上を別日に3回定着',done:subjects.filter(x=>x.retentionReady).length,total:7,passed:subjects.every(x=>x.retentionReady)},
      {id:'timed',label:'直近2年度の法律3科目群を各8割以上・中断なし',done:blocks.filter(x=>x.passes>=2).length,total:3,passed:blocks.every(x=>x.passes>=2)},
      {id:'general',label:'直近2年度の一般教養を20問・7割以上・中断なし',done:Math.min(generalPasses,2),total:2,passed:generalPasses>=2},
      {id:'due',label:'期限到来の法律問題を解消',done:due===0?1:0,total:1,passed:due===0&&subjects.some(x=>x.seen>0)}
    ];
    return {subjects,blocks,generalPasses,due,gates,passed:gates.every(g=>g.passed)};
  }
  function remaining(session,now=Date.now()) {if(!session.duration)return null;return Math.max(0,Math.ceil(((session.paused?session.remainingMs:session.deadline-now)||0)/1000));}
  function pause(session,now=Date.now()){if(!session.paused){session.remainingMs=Math.max(0,session.deadline-now);session.paused=true;session.pauses=(session.pauses||0)+1;}}
  function resume(session,now=Date.now()){if(session.paused){session.deadline=now+session.remainingMs;session.paused=false;}}
  function validateBackup(raw,bank) {
    if (!raw || raw.schema!==3 || typeof raw.records!=='object'||Array.isArray(raw.records)||!raw.records)throw new Error('短答ノートのバックアップではありません。');
    const valid=new Set(bank.map(q=>q.id)),out=emptyStore();
    for(const [id,r]of Object.entries(raw.records)){
      if(!valid.has(id)||!r||typeof r!=='object')continue;
      const item={};
      for(const k of ['attempts','correct','stage','due','lastAt'])if(Number.isFinite(r[k])&&r[k]>=0)item[k]=Math.min(r[k],1e15);
      item.stage=Math.min(item.stage||0,5);
      for(const k of ['lastCorrect','firstCorrect','bookmark','choiceReviewed'])item[k]=r[k]===true;
      for(const k of ['note','reason','lastDay'])if(typeof r[k]==='string')item[k]=r[k].slice(0,12000);
      item.confidence=['sure','unsure','guess'].includes(r.confidence)?r.confidence:'unsure';item.lastAnswer=answers(r.lastAnswer||[]).slice(0,10);out.records[id]=item;
    }
    out.settings={goal:Math.max(5,Math.min(100,Number(raw.settings?.goal)||20)),large:raw.settings?.large===true};
    if(raw.daily&&typeof raw.daily==='object')for(const [key,d]of Object.entries(raw.daily)){if(/^\d{4}-\d{2}-\d{2}$/.test(key)&&Number.isFinite(d?.attempts)&&Number.isFinite(d?.correct)&&d.attempts>=0&&d.correct>=0&&d.correct<=d.attempts)out.daily[key]={attempts:d.attempts,correct:d.correct};}
    if(Array.isArray(raw.history))out.history=raw.history.filter(h=>h&&typeof h.title==='string'&&Number.isFinite(h.at)&&Number.isFinite(h.correct)&&Number.isFinite(h.total)).slice(-100).map(h=>({id:String(h.id||''),title:h.title.slice(0,200),at:h.at,correct:h.correct,total:h.total,points:Number(h.points)||0,max:Number(h.max)||0,mode:h.mode==='exam'?'exam':'practice',pauses:Number(h.pauses)||0,block:['public','civil','criminal','general'].includes(h.block)?h.block:'',exam:['preliminary','bar'].includes(h.exam)?h.exam:'',year:Number.isInteger(h.year)&&h.year>=2011&&h.year<=2100?h.year:0,wrong:Array.isArray(h.wrong)?h.wrong.filter(id=>valid.has(id)):[]}));
    if(raw.legacy&&typeof raw.legacy==='object'&&!Array.isArray(raw.legacy)&&JSON.stringify(raw.legacy).length<2000000)out.legacy=JSON.parse(JSON.stringify(raw.legacy));
    if(raw.session!==null&&raw.session!==undefined){
      const s=raw.session,obj=v=>v&&typeof v==='object'&&!Array.isArray(v),finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
      if(!obj(s)||typeof s.id!=='string'||s.id.length>100||typeof s.title!=='string'||s.title.length>200||!['practice','exam'].includes(s.mode)||!Array.isArray(s.ids)||!s.ids.length||s.ids.length>bank.length||new Set(s.ids).size!==s.ids.length||s.ids.some(id=>!valid.has(id))||!Number.isInteger(s.index)||s.index<0||s.index>=s.ids.length||!obj(s.answers)||!obj(s.confidence)||!obj(s.graded)||!obj(s.flags)||!finite(s.started)||!finite(s.duration)||s.duration>86400000||!finite(s.deadline)||!finite(s.remainingMs)||s.remainingMs>s.duration||typeof s.paused!=='boolean')throw Error('中断中の演習を読み取れません。元データを保管し、バックアップを確認してください。');
      const restored={id:s.id,title:s.title,mode:s.mode,ids:[...s.ids],index:s.index,answers:{},confidence:{},graded:{},flags:{},started:s.started,duration:s.duration,deadline:s.deadline,remainingMs:s.remainingMs,paused:s.paused,pauses:Number.isSafeInteger(s.pauses)&&s.pauses>=0?s.pauses:0,block:typeof s.block==='string'?s.block.slice(0,40):''};
      const byId=new Map(bank.map(q=>[q.id,q]));
      for(const id of s.ids){
        if(s.answers[id]!==undefined){const a=s.answers[id];if(!Array.isArray(a)||a.length>10||a.some(v=>!['string','number'].includes(typeof v)||String(v).length>40))throw Error('中断中の回答の形式が不正です。');restored.answers[id]=answers(a);}
        if(['sure','unsure','guess'].includes(s.confidence[id]))restored.confidence[id]=s.confidence[id];
        if(s.graded[id]===true){if(!grade(byId.get(id),restored.answers[id]||[]).complete)throw Error('採点済みの回答を確認できません。');restored.graded[id]=true;}
        if(s.flags[id]===true)restored.flags[id]=true;
      }
      out.session=restored;
    }
    return out;
  }
  root.YobiEngine={DAY,SUBJECTS,BLOCKS,dayKey,normalize,answers,grade,emptyStore,recordAttempt,stats,filterBank,shuffle,dailyQueue,readiness,remaining,pause,resume,validateBackup};
})(typeof globalThis!=='undefined'?globalThis:this);
