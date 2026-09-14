'use strict';
const $=id=>document.getElementById(id),job=location.pathname.includes('reemployment-network');
let dataset,jobData,visible=[],edges=[],all=[],byId=new Map(),selected='',camera={x:0,y:0,k:1},bounds={w:1000,h:600};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeLink=(u,text)=>/^https:\/\//.test(u||'')?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`:'';
const norm=s=>String(s).normalize('NFKC').replace(/\s/g,'').toLowerCase();
const palette=n=>n.kind==='人物'?['#f2eaf8','#a980bd']:n.kind==='再就職先'?['#fff1df','#c79855']:n.number?['#e5f4f2','#62a9a6']:['#e9f1fb','#7297bb'];
function descend(id,set){if(set.has(id))return;set.add(id);dataset.edges.filter(e=>e.source===id).forEach(e=>descend(e.target,set));}
function ancestors(id,set){dataset.edges.filter(e=>e.target===id).forEach(e=>{if(!set.has(e.source)){set.add(e.source);ancestors(e.source,set)}})}
function render(){
 const query=norm($('query').value),filter=$('orgFilter').value,kind=$('kind').value;
 let hits=[];
 if(job){
  const records=jobData.records.filter(r=>(!query||norm([r.person,r.fromOrg,r.toOrg,r.role].join(' ')).includes(query))&&($('career').value!== 'confirmed'||r.careerStatus==='確認済み'));
  const nodes=new Map();edges=[];
  records.forEach(r=>{const from='from:'+r.fromOrg,p='person:'+r.person,to='to:'+r.toOrg;
   nodes.set(from,{id:from,name:r.fromOrg,kind:'退職時の府省'});nodes.set(p,{id:p,name:r.person,kind:'人物'});nodes.set(to,{id:to,name:r.toOrg,kind:'再就職先'});
   if(!edges.some(e=>e.source===from&&e.target===p))edges.push({source:from,target:p,type:'退職時の所属'});
   edges.push({source:p,target:to,type:'再就職',record:r});
  });visible=[...nodes.values()];all=visible;byId=new Map(all.map(n=>[n.id,n]));hits=records;
  $('results').innerHTML=hits.map(r=>`<button class="result" data-id="person:${esc(r.person)}">${esc(r.person)}<small>${esc(r.toOrg)} · ${esc(r.role)}<br>${esc(r.joinedAt)}</small></button>`).join('');
  $('count').textContent=records.length+'件';$('graphTitle').textContent='退職時の府省 → 人物 → 再就職先';
 }else{
  let allowed=new Set();filter==='all'?dataset.nodes.forEach(n=>allowed.add(n.id)):descend(filter,allowed);
  hits=dataset.nodes.filter(n=>allowed.has(n.id)&&(!query||norm(n.name+' '+(n.number||'')).includes(query))&&(!kind||n.kind===kind));
  const included=new Set(hits.map(n=>n.id));hits.forEach(n=>ancestors(n.id,included));visible=dataset.nodes.filter(n=>included.has(n.id));edges=dataset.edges.filter(e=>included.has(e.source)&&included.has(e.target));all=dataset.nodes;byId=new Map(all.map(n=>[n.id,n]));
  $('results').innerHTML=hits.map(n=>`<button class="result" data-id="${esc(n.id)}">${esc(n.name)}<small>${esc(n.kind)}</small></button>`).join('');
  $('count').textContent=hits.length+'機関';$('graphTitle').textContent=filter==='all'?'収録機関の全体図':filter+'と関係機関';
 }
 if(!hits.length)$('results').innerHTML='<p class="muted">一致する記録はありません。検索語や条件を変更してください。</p>';
 $('empty').hidden=visible.length>0;$('graph').style.display=visible.length?'block':'none';$('graphCount').textContent=visible.length+'項目 / '+edges.length+'本の関係';
 $('results').querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.id,true));
 draw();fit();if(selected&&byId.has(selected))detail(selected);else{$('detail').innerHTML='<p class="eyebrow">DETAIL</p><h2>項目を選択</h2><p>図または検索結果から選ぶと、関係と根拠資料を確認できます。</p>';}
}
function layout(){
 const positions=new Map();
 if(job){
  const groups=[visible.filter(n=>n.kind==='退職時の府省'),visible.filter(n=>n.kind==='人物'),visible.filter(n=>n.kind==='再就職先')];
  const max=Math.max(...groups.map(g=>g.length),1);groups.forEach((group,col)=>group.forEach((n,i)=>positions.set(n.id,{x:col*350+20,y:40+(i+.5)*Math.max(90,max*94/group.length)})));bounds={w:1040,h:max*94+120};
 }else{
  const children=new Map();edges.forEach(e=>{if(!children.has(e.source))children.set(e.source,[]);children.get(e.source).push(e.target)});
  let cursor=40,maxDepth=0;const visit=(id,depth)=>{if(positions.has(id))return positions.get(id).y;maxDepth=Math.max(maxDepth,depth);const ch=children.get(id)||[];let y;if(ch.length){const ys=ch.map(c=>visit(c,depth+1));y=(ys[0]+ys.at(-1))/2}else{y=cursor;cursor+=92}positions.set(id,{x:20+depth*340,y});return y;};
  const targets=new Set(edges.map(e=>e.target));visible.filter(n=>!targets.has(n.id)).forEach(n=>{visit(n.id,0);cursor+=50});bounds={w:(maxDepth+1)*340,h:cursor+55};
 }return positions;
}
let positions=new Map();
function draw(){positions=layout();let html=edges.map(e=>{const a=positions.get(e.source),b=positions.get(e.target);if(!a||!b)return '';return `<path class="edge ${e.type==='主たる所管'?'iaa':e.type==='再就職'?'job':''}" d="M ${a.x+270} ${a.y+32} C ${a.x+305} ${a.y+32},${b.x-35} ${b.y+32},${b.x} ${b.y+32}"><title>${esc(e.type)}</title></path>`}).join('');
 html+=visible.map(n=>{const p=positions.get(n.id),colors=palette(n),chunks=[...n.name.matchAll(/.{1,17}/gu)].map(x=>x[0]);return `<g class="node ${selected===n.id?'selected':''}" data-id="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.name)}の詳細" transform="translate(${p.x} ${p.y})"><title>${esc(n.name)} / ${esc(n.kind)}</title><rect width="270" height="72" rx="7" fill="${colors[0]}" stroke="${colors[1]}"/><text x="14" y="21" fill="#183851">${chunks.slice(0,2).map((c,i)=>`<tspan x="14" dy="${i?18:0}">${esc(c)}${i===1&&chunks.length>2?'…':''}</tspan>`).join('')}</text><text class="node-kind" x="14" y="61">${esc(n.kind)}</text></g>`}).join('');$('scene').innerHTML=html;
 $('scene').querySelectorAll('.node').forEach(g=>{g.onclick=()=>{if(!dragged)select(g.dataset.id,false)};g.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();select(g.dataset.id,true)}}});
}
function select(id,center){selected=id;detail(id);document.querySelectorAll('[data-id]').forEach(el=>el.classList.toggle('selected',el.dataset.id===id));if(center&&positions.has(id)){const p=positions.get(id),r=$('canvas').getBoundingClientRect();camera.k=Math.min(1,r.width/310);camera.x=r.width/2-(p.x+135)*camera.k;camera.y=r.height/2-(p.y+36)*camera.k;apply()}}
function detail(id){const n=byId.get(id);if(!n)return;let html=`<p class="eyebrow">${job?'REEMPLOYMENT RECORD':'ORGANIZATION'}</p><h2>${esc(n.name)}</h2>`;
 if(job){const records=jobData.records.filter(r=>id==='person:'+r.person||id==='to:'+r.toOrg||id==='from:'+r.fromOrg);html+=`<p>公表記録 ${records.length}件。掲載時の役職であり、現在の在職を示すものではありません。</p>`;html+=records.map(r=>`<div class="related"><dl><dt>人物 / 退職時官職</dt><dd>${esc(r.person)} / ${esc(r.formerRole)}</dd><dt>退職日</dt><dd>${esc(r.retiredAt)}</dd><dt>再就職先 / 役職</dt><dd>${esc(r.toOrg)} / ${esc(r.role)}</dd><dt>再就職日</dt><dd>${esc(r.joinedAt)}</dd><dt>キャリア採用区分</dt><dd>${esc(r.careerStatus)}（公表表に記載なし）</dd></dl>${safeLink(r.source,'公式PDF・整理番号 '+r.sourceRow)}</div>`).join('');
 }else{html+=`<dl><dt>機関・法人の区分</dt><dd>${esc(n.kind)}${n.special?'（特定国立研究開発法人）':''}</dd><dt>資料の基準</dt><dd>${esc(n.asOf)}</dd>${n.number?`<dt>法人番号</dt><dd>${esc(n.number)}</dd>`:''}</dl>`;const relations=dataset.edges.filter(e=>e.source===id||e.target===id);html+=relations.map(e=>`<p class="related">${esc(byId.get(e.source)?.name)}<br>↓ ${esc(e.type)}<br>${esc(byId.get(e.target)?.name)}</p>`).join('');html+=safeLink(n.source,'関係の根拠資料')+safeLink(n.url,'機関の公式サイト');html+=`<button id="focusOrg">この機関を中心に表示</button>`;
 }$('detail').innerHTML=html;if($('focusOrg'))$('focusOrg').onclick=()=>{if(![...$('orgFilter').options].some(o=>o.value===id))$('orgFilter').add(new Option(n.name,id));$('orgFilter').value=id;$('query').value='';$('kind').value='';render()};
}
function apply(){$('scene').setAttribute('transform',`translate(${camera.x} ${camera.y}) scale(${camera.k})`)}
function fit(){const r=$('canvas').getBoundingClientRect();camera.k=Math.min(1.15,(r.width-32)/bounds.w,(r.height-32)/bounds.h);camera.x=(r.width-bounds.w*camera.k)/2;camera.y=(r.height-bounds.h*camera.k)/2;apply()}
function zoom(f){const r=$('canvas').getBoundingClientRect(),k=Math.max(.035,Math.min(3,camera.k*f)),ratio=k/camera.k;camera.x=r.width/2-(r.width/2-camera.x)*ratio;camera.y=r.height/2-(r.height/2-camera.y)*ratio;camera.k=k;apply()}
let pointer=null,dragged=false;
$('graph').onpointerdown=e=>{if(e.button!==0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y};dragged=false;$('graph').setPointerCapture(e.pointerId)};
$('graph').onpointermove=e=>{if(!pointer||pointer.id!==e.pointerId)return;let x=e.clientX-pointer.x,y=e.clientY-pointer.y;if(Math.abs(x)+Math.abs(y)>4)dragged=true;camera.x=pointer.cx+x;camera.y=pointer.cy+y;apply()};
$('graph').onpointerup=e=>{if(pointer&&!dragged){const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.node');if(el)select(el.dataset.id,false)}pointer=null};$('graph').onpointercancel=()=>{pointer=null};
$('graph').onwheel=e=>{e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12)};
$('plus').onclick=()=>zoom(1.35);$('minus').onclick=()=>zoom(1/1.35);$('fit').onclick=fit;
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.querySelector('.graph-panel').requestFullscreen)await document.querySelector('.graph-panel').requestFullscreen();else $('fullscreen').textContent='この端末は全画面非対応';}catch{$('fullscreen').textContent='全画面を利用できません'}};document.addEventListener('fullscreenchange',()=>setTimeout(fit,80));
['query','orgFilter','kind','career'].forEach(id=>$(id).addEventListener(id==='query'?'input':'change',render));
$('clear').onclick=()=>{$('query').value='';$('orgFilter').value='内閣府';$('kind').value='';$('career').value='';selected='';render()};
async function init(){try{
 const res=await fetch('/commons/government-network/'+(job?'reemployment':'organizations')+'.json');if(!res.ok)throw Error('data');const data=await res.json();
 $('orgTab').classList.toggle('active',!job);$('jobTab').classList.toggle('active',job);$(job?'jobTab':'orgTab').setAttribute('aria-current','page');
 if(job){jobData=data;$('title').textContent='官僚の再就職先ネットワーク';$('query').placeholder='例：山田滝雄、銀行、顧問';$('orgFilterLabel').hidden=true;$('kindLabel').hidden=true;$('careerLabel').hidden=false;$('scopeTitle').textContent='収録済み：外務省の特別職 20件 / 全国版は未完了';$('scope').textContent=data.coverage+' キャリア官僚限定の一覧としては未完成です。';$('sources').innerHTML=`<p>対象期間：${esc(data.period)} / 公表日：${esc(data.publishedAt)}。同一人物の複数就職を別記録で表示します。退職から2年を経過した後の再就職は元資料の対象外です。</p><p>内閣人事局の全府省公表ページは今回404で取得できず未収録。採用区分は全20件で未確認です。キャリア採用の根拠がある記録に絞ると現在は0件になります。</p>${safeLink(data.sourcePage,'外務省の公表ページ')}${safeLink(data.source,'公表表（全20件）')}`;$('legend').innerHTML='<span style="--color:#7297bb">退職時の府省</span><span style="--color:#a980bd">人物</span><span style="--color:#c79855">再就職先</span>';
 }else{dataset=data;$('orgFilter').innerHTML='<option value="all">収録機関すべて</option>'+data.nodes.filter(n=>!n.number&&n.kind==='府省等').map(n=>`<option value="${esc(n.id)}">${esc(n.name)}</option>`).join('');$('orgFilter').value='内閣府';$('scopeTitle').textContent='独立行政法人 86 / 86法人を収録（2025年4月1日現在）';$('scope').textContent='行政機関等59項目と、独立行政法人86法人の主たる所管を表示。最新の全行政組織・共管関係を網羅する図ではありません。';$('sources').innerHTML='<ul>'+data.notes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>'+safeLink(data.iaaSource,'総務省：独立行政法人一覧')+safeLink(data.agencySource,'e-Gov：国の行政機関');$('legend').innerHTML='<span style="--color:#7297bb">行政機関</span><span style="--color:#62a9a6">独立行政法人</span><span>実線：組織関係 / 破線：主たる所管</span>';
 }$('loading').hidden=true;$('app').hidden=false;render();new ResizeObserver(()=>fit()).observe($('canvas'));
 }catch(e){$('loading').innerHTML='データを読み込めませんでした。<button id="retry">再読み込み</button>';$('retry').onclick=()=>location.reload()}}
init();
