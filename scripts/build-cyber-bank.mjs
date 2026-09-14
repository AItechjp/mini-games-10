import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('../cyber-quiz/',import.meta.url);
const raw=await readFile(new URL('../source/cyber-quiz/curriculum.txt',import.meta.url),'utf8');
const categories=[],units=[];let cat;
for(const line of raw.split('\n').map(l=>l.trim()).filter(Boolean)){
 if(line.startsWith('#')){const [id,name,en,source,title]=line.slice(1).split('|');cat={id,name,en,source,title};categories.push(cat);continue;}
 const values=line.split('|');if(values.length!==9)throw new Error(`Expected 9 fields: ${line.slice(0,45)} (${values.length})`);
 if(!cat||values.some(x=>!x.trim()))throw new Error('Empty curriculum field');
 const [term,definition,control,unsafe,fact,myth,correction,judgment,badJudgment]=values;
 units.push({id:`${cat.id}-${String(units.filter(u=>u.category===cat.id).length+1).padStart(2,'0')}`,category:cat.id,term,definition,control,unsafe,fact,myth,correction,judgment,badJudgment});
}
const questions=[];
for(const u of units){const others=units.filter(x=>x.category===u.category&&x.id!==u.id);const peers=others.filter(x=>x.term!==u.term).slice(0,3);const c=categories.find(x=>x.id===u.category);
 const add=(kind,prompt,choices,answer,explanation,level,role)=>questions.push({id:u.id+'-'+kind,unit:u.id,category:u.category,term:u.term,kind,prompt,choices,answer,explanation,level,role,source:c.source,sourceTitle:c.title});
 add('identify',`次の説明が指すものは？\n${u.definition}`,[u.term,...peers.map(x=>x.term)],0,`${u.term}：${u.definition}`,1,'trace');
 add('defend',`${u.term}の対策・設計として、適切なのは？`,[u.control,u.unsafe],0,`選ぶべき対応は「${u.control}」。${u.correction}`,2,'patch');
 add('mechanism',`${u.term}について、次の説明は正しい？\n${u.fact}`,['正しい','誤り'],0,`${u.fact}。${u.definition}`,2,'trace');
 add('myth',`レビュー中の説明を判定しよう。\n「${u.myth}」`,['正しい','誤り'],1,u.correction,3,'patch');
 add('judgment',`${u.term}：現場の判断として適切なのは？`,[u.judgment,u.badJudgment],0,`${u.judgment}。${u.correction}`,3,'either');
}
const scenarios=JSON.parse(await readFile(new URL('../source/cyber-quiz/scenarios.json',import.meta.url),'utf8'));
for(const s of scenarios){const q=questions.find(q=>q.id===s.id);if(!q)throw new Error('Unknown scenario '+s.id);Object.assign(q,s,{scenario:true});}
if(categories.length!==20||units.length!==200||questions.length!==1000)throw new Error(`Incomplete: ${categories.length} / ${units.length} / ${questions.length}`);
const stems=new Set();for(const q of questions){if(stems.has(q.prompt))throw new Error('Duplicate prompt '+q.id);stems.add(q.prompt);if(new Set(q.choices).size!==q.choices.length)throw new Error('Duplicate choice '+q.id);}
for(const c of categories){const count=questions.filter(q=>q.category===c.id).length;if(count!==50)throw new Error(c.id+' count '+count);c.count=count;}
await writeFile(new URL('bank.json',dir),JSON.stringify({version:'2026-09-14.1',original:true,description:'200テーマについて5つの異なる観点を問う1,000問。並べ替えや言い換えを別問題として数えない。',categories,questions}));
console.log(JSON.stringify({categories:categories.length,themes:units.length,questions:questions.length,uniquePrompts:stems.size}));
