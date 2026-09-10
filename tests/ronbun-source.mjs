import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),E=require('../ronbun-engine.js');
const read=n=>JSON.parse(fs.readFileSync('assets/ronbun/'+n+'.json','utf8'));
const papers=read('papers'),lessons=read('lessons'),sources=read('sources'),articles=read('articles');
const paperIds=new Set(papers.map(p=>p.id)),lessonIds=new Set(lessons.map(l=>l.id));
assert.equal(papers.length,135);assert.equal(paperIds.size,135);assert.equal(lessons.length,86);assert.equal(lessonIds.size,86);
for(let year=2011;year<=2025;year++){
 const subset=papers.filter(p=>p.year===year);assert.equal(subset.length,9,'year '+year);assert.deepEqual(new Set(subset.map(p=>p.subject)),new Set(E.SUBJECTS));
}
for(const p of papers){
 assert(p.text.length>200&&p.purpose.length>80,p.id+' truncated');
 assert.match(p.pdf,/^https:\/\/www\.moj\.go\.jp\/content\/\d+\.pdf$/);
 assert(Number.isInteger(p.sourcePage)&&p.sourcePage>0&&Number.isInteger(p.purposePage)&&p.purposePage>=p.sourcePage);
 assert(!p.text.includes('(cid:')&&!p.purpose.includes('(cid:'),'unreadable text '+p.id);
 const row=sources.audit.find(a=>a.id===p.id);assert(row,'missing source audit '+p.id);assert.equal(row.questionChars,[...p.text].length);assert.equal(row.purposeChars,[...p.purpose].length);
 assert(sources.documents.some(d=>d.year===p.year&&d.url===p.pdf),'wrong year/source '+p.id);
 const points=E.purposePoints(p.purpose);assert(points.length>=1&&points.length<=8,'purpose checklist '+p.id);const normalized=p.purpose.replace(/\s+/g,' ').trim();for(const point of points)assert(normalized.includes(point),'purpose text altered '+p.id);
}
for(const d of sources.documents)assert.match(d.sha256,/^[a-f0-9]{64}$/);
for(const l of lessons){
 assert(['答案の基本',...E.SUBJECTS].includes(l.subject),'elective or unknown subject');
 for(const field of ['title','rule','pitfall','example'])assert(l[field].length>5,l.id+' '+field);
 assert(l.steps.length>=4&&l.recall.length>0&&l.keywords.length>1,l.id);
 for(const s of l.sources)for(const n of s.articles){const a=articles.articles[s.lawId+':'+n];assert(a&&a.text.length>0,'missing article '+l.id+' '+n);assert.equal(a.url,'https://laws.e-gov.go.jp/law/'+s.lawId);}
}
for(const subject of E.SUBJECTS)assert(lessons.filter(l=>l.subject===subject).length>=8,subject);
const html=fs.readFileSync('yobi-ronbun.html','utf8'),ui=fs.readFileSync('ronbun.js','utf8');
for(const asset of ['ronbun.js','ronbun-engine.js','ronbun.css'])assert(html.includes(asset));
assert(!/ads-bootstrap|adsbygoogle|admax|analytics|supabase/.test(html+ui));
assert(fs.readFileSync('index.html','utf8').includes('yobi-ronbun.html'));
assert(fs.readFileSync('yobi-quiz.html','utf8').includes('yobi-ronbun.html'));
// The page estimate includes explicit newlines and Unicode, without truncating the saved answer.
assert.deepEqual(E.measure(''),{characters:0,rows:0,pages:0,limit:2760,over:false});
assert.equal(E.measure('あ'.repeat(2760)).pages,4);assert.equal(E.measure('あ'.repeat(2761)).over,true);
assert.equal(E.measure('あ\r\nい').characters,2);assert.equal(E.measure('あ\r\nい').rows,2);
assert.equal(E.measure('😀'.repeat(30)).rows,1);assert.equal(E.measure('あ\n'.repeat(92)).over,true);
const time=Date.UTC(2026,8,10,12),ids=papers.filter(p=>p.year===2025&&['憲法','行政法'].includes(p.subject)).map(p=>p.id),state=E.fresh();
state.session=E.newSession(ids,'exam',140,'2025年 公法系',time);
state.session.drafts[ids[0]].outline='設問1の請求と根拠';state.session.drafts[ids[0]].answer='<script>原答案は安全に文字として保持</script>';
state.session.drafts[ids[1]].answer='行政法も失わない';
E.pause(state.session,time+20*60000);assert.equal(E.remaining(state.session,time+500*60000),120*60000);
E.resume(state.session,time+500*60000);assert.equal(E.remaining(state.session,time+510*60000),110*60000);
const checkpoint=JSON.parse(JSON.stringify(state));const restored=E.validateBackup({data:checkpoint},paperIds,lessonIds);
assert.equal(restored.session.drafts[ids[1]].answer,'行政法も失わない');
assert.equal(E.remaining(restored.session,time+621*60000),0,'reload does not restart deadline');
const attempts=E.completeSession(restored,time+621*60000,true);assert.equal(attempts.length,2);assert.equal(restored.session,null);
assert.equal(attempts[0].answer,'<script>原答案は安全に文字として保持</script>');assert.equal(attempts[1].answer,'行政法も失わない');
assert(attempts.every(a=>a.automatic&&a.pauses===1&&a.elapsed===140*60000));
attempts[0].rewrite='改善した別の答案';assert.equal(attempts[0].answer,state.session.drafts[ids[0]].answer,'rewriting overwrote original');
assert.equal(E.completeSession(restored,time).length,0,'duplicate submit creates duplicate answer');
const lessonId=lessons[0].id;E.recordLesson(restored,lessonId,'sure',time);E.recordLesson(restored,lessonId,'sure',time+1000);assert.equal(restored.lessons[lessonId].stage,1);
E.recordLesson(restored,lessonId,'sure',time+E.DAY);assert.equal(restored.lessons[lessonId].stage,2);
E.recordLesson(restored,lessonId,'again',time+2*E.DAY);assert.equal(restored.lessons[lessonId].stage,0);assert.equal(restored.lessons[lessonId].due,time+3*E.DAY);
const a=attempts[0];assert.equal(E.rubricResult(a).filled,0);a.ratings.demand=0;a.ratings.issue=2;assert.equal(E.rubricResult(a).filled,2);assert.deepEqual(E.rubricResult(a).gaps,['問いに答える']);
E.reviewAttempt(a,'sure',time);E.reviewAttempt(a,'sure',time+1000);assert.equal(a.round,1);
E.reviewAttempt(a,'sure',time+E.DAY);E.reviewAttempt(a,'sure',time+2*E.DAY);assert.equal(a.status,'retained');
E.reviewAttempt(a,'again',time+3*E.DAY);assert.equal(a.round,0);assert.equal(a.status,'weak');
assert.equal(E.validateBackup(JSON.parse(JSON.stringify(restored)),paperIds,lessonIds).attempts[0].rewrite,'改善した別の答案');
assert.throws(()=>E.validateBackup({schema:9},paperIds,lessonIds));
for(const mutate of [x=>x.attempts.push(x.attempts[0]),x=>x.attempts[0].paperId='unknown',x=>x.attempts[0].answer='x'.repeat(50001)]){
 const bad=JSON.parse(JSON.stringify(restored));mutate(bad);assert.throws(()=>E.validateBackup(bad,paperIds,lessonIds));
}
const badSession=JSON.parse(JSON.stringify(checkpoint));badSession.session.paperIds.push(ids[0]);assert.throws(()=>E.validateBackup(badSession,paperIds,lessonIds));
checkpoint.session.index=0.8;assert.equal(E.validateBackup(checkpoint,paperIds,lessonIds).session.index,0);
assert.deepEqual(E.BLOCKS.map(b=>b.minutes),[140,210,140,180]);
assert(!E.readiness(E.fresh(),papers,lessons,time).passed,'empty notebook must not pass readiness');
const complete=E.fresh();for(const l of lessons)complete.lessons[l.id]={stage:3,confidence:'sure'};
let serial=0;const add=(paper,sessionId,mode,answer,outline='構成',rewrite='',status='retained')=>complete.attempts.push({id:'ready-'+serial++,paperId:paper.id,sessionId,mode,answer,outline,rewrite,pauses:0,status,due:time+30*E.DAY});
for(const block of E.BLOCKS)for(let run=0;run<2;run++)for(const subject of block.subjects)add(papers.filter(p=>p.subject===subject).sort((a,b)=>b.year-a.year)[run],block.id+'-'+run,'exam','あ'.repeat(1200),'構成','あ'.repeat(200));
for(const subject of E.SUBJECTS){const ps=papers.filter(p=>p.subject===subject).sort((a,b)=>b.year-a.year);add(ps[2],subject+'-single','essay','あ'.repeat(1200),'構成','あ'.repeat(200));add(ps[3],subject+'-outline-1','outline','','構成');add(ps[4],subject+'-outline-2','outline','','構成');}
const ready=E.readiness(complete,papers,lessons,time);assert(ready.passed,JSON.stringify(ready));assert.equal(ready.subjects.filter(x=>x.passed).length,9);assert.equal(ready.blocks.filter(x=>x.passes>=2).length,4);
console.log(JSON.stringify({ok:true,essayPapers:papers.length,lessons:lessons.length,articles:Object.keys(articles.articles).length,subjects:9,years:15,timer:'pause, resume, reload, expiry',answers:'all subjects preserved; original and rewrite distinct',backup:'valid restore and invalid-input rejection',review:'separate-day repetition verified'}));
