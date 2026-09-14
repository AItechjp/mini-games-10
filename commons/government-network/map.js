const $=id=>document.getElementById(id);
const jobs=document.body.dataset.mode==='jobs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[\s　]+/g,'');
const sourceLink=(url,label='公表資料を開く ↗')=>{try{const u=new URL(url);return u.protocol==='https:'?`<a class="source" href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:''}catch{return ''}};
let data,nodes=[],edges=[],records=[],nodeMap=new Map(),filtered=[],page=0,view='graph',selection=null,graphNodes=[],graphEdges=[];
let transform={x:0,y:0,k:1},bounds={w:1000,h:600},pointers=new Map(),pinch=null,dragged=false;
let PAGE_SIZE=8;
const typeLabel={cabinet:'内閣',ministry:'府省',agency:'行政機関',iaa:'独立行政法人',committee:'委員会',secretariat:'内閣官房',role:'主務大臣（役職）',person:'公表対象者',destination:'再就職先'};
const getName=n=>n.name??n.label??n.id;
const descendants=(id)=>{const out=new Set([id]);let changed=true;while(changed){changed=false;for(const e of edges)if(out.has(e.source)&&!out.has(e.target)){out.add(e.target);changed=true}}return out};
const meta=()=>data.metadata??data.meta??{};
const opts=(items)=>items.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');
function normalizeData(raw){
 data=raw;
 if(jobs){records=(raw.records??raw.rows??[]).map((r,i)=>({...r,id:String(r.id??`record-${i+1}`),name:r.name??r.personName??r.person??'',ministry:r.ministry??r.formerMinistry??r.formerOrganization??'',formerTitle:r.formerTitle??r.formerPosition??'',destination:r.destination??r.destinationName??r.newOrganization??'',destinationTitle:r.destinationTitle??r.newPosition??'',retirementDate:r.retirementDate??'',reemploymentDate:r.reemploymentDate??r.startDate??'',sourceUrl:r.sourceUrl??meta().sourceUrl??'',sourcePage:r.sourcePage??r.page??''}));
 $('ministry').innerHTML='<option value="">すべての府省</option>'+opts([...new Set(records.map(r=>r.ministry))].sort((a,b)=>a.localeCompare(b,'ja')).map(v=>[v,v]));
 $('kind').innerHTML=opts([['all','公表対象者すべて'],['general','内閣人事局公表（1,733件）'],['special','外務省特別職（20件）'],['senior','幹部職経験（旧役職名）'],['vice','次官・長官級（旧役職名）'],['career','キャリア採用を確認できる記録']]);
 }else{
 nodes=raw.nodes.map(n=>({...n,name:getName(n),type:n.type??n.kind}));edges=raw.edges.map(e=>({...e,source:e.source??e.from,target:e.target??e.to}));nodeMap=new Map(nodes.map(n=>[n.id,n]));
 $('ministry').innerHTML='<option value="">すべての府省</option>'+opts(nodes.filter(n=>['ministry','cabinet','secretariat'].includes(n.type)||n.name==='内閣官房').map(n=>[n.id,n.name]));
 $('kind').innerHTML=opts([['overview','府省の全体像'],['all','行政機関・独立行政法人すべて'],['agency','行政機関'],['iaa','独立行政法人'],['国立研究開発法人','国立研究開発法人'],['行政執行法人','行政執行法人'],['中期目標管理法人','中期目標管理法人']]);
 }
 $('download').disabled=false;renderCoverage();update();
}
const senior=r=>r.senior===true;
function update(){
 const q=norm($('search').value),m=$('ministry').value,k=$('kind').value;
 if(jobs){filtered=records.filter(r=>(!m||r.ministry===m)&&(!q||norm([r.name,r.ministry,r.formerTitle,r.destination,r.destinationTitle].join(' ')).includes(q))&&(k==='all'||k==='general'&&!r.isSpecialService||k==='special'&&r.isSpecialService||k==='senior'&&senior(r)||k==='vice'&&/(?:事務次官|事務総長|長官|検事総長|幕僚長)(?=$|[\s　、，,。.;；:：・／/()（）\[\]［］])/u.test(r.formerTitle)||k==='career'&&['confirmed','career','verified'].includes(r.careerTrack)));}
 else{const allowed=m?descendants(m):null;filtered=nodes.filter(n=>(!allowed||allowed.has(n.id))&&(!q||norm([n.name,n.aliases?.join(' '),n.abbreviation,n.note].join(' ')).includes(q))&&((q&&k==='overview')||k==='all'||k==='iaa'&&n.type==='iaa'||k==='agency'&&n.type!=='iaa'||n.type==='iaa'&&n.category===k||k==='overview'&&(['cabinet','ministry','secretariat'].includes(n.type)||n.name==='内閣官房')));}
 page=Math.min(page,Math.max(0,Math.ceil(filtered.length/PAGE_SIZE)-1));
 $('result-count').innerHTML=jobs?`<strong>${filtered.length.toLocaleString()}</strong> 件 / 公表 ${records.length.toLocaleString()} 件`:`<strong>${filtered.length}</strong> 項目 / 収録 ${nodes.filter(n=>n.type!=='role').length} 機関＋主務大臣の役職`;
 if(selection&&!filtered.some(n=>n.id===selection.id))selection=null;
 renderGraph();renderTable();renderDetail();setView(view);
}
function renderGraph(){
 const m=$('ministry').value,k=$('kind').value;
 graphNodes=[];graphEdges=[];
 const pageItems=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 if(jobs){
 const left=[...new Set(pageItems.map(r=>r.ministry))];
 const destKey=r=>r.destinationId??('destination:'+r.destination);const right=[...new Map(pageItems.map(r=>[destKey(r),{id:destKey(r),name:r.destination}])).values()];
 const span=Math.max(pageItems.length,left.length,right.length)*96;
 left.forEach((name,i)=>graphNodes.push({id:'ministry:'+name,name,type:'ministry',x:30,y:50+(i+.5)*span/left.length-30,w:220,h:68}));
 right.forEach((d,i)=>graphNodes.push({id:d.id,name:d.name,destinationKey:d.id,type:'destination',x:800,y:50+(i+.5)*span/right.length-30,w:270,h:68}));
 pageItems.forEach((r,i)=>{graphNodes.push({...r,type:'person',x:400,y:68+i*96,w:230,h:68});graphEdges.push({source:'ministry:'+r.ministry,target:r.id,type:'reemployment'},{source:r.id,target:destKey(r),type:'reemployment'})});
 }else{
 // A page contains 16 matching institutions; required parents are retained as context.
 const visible=new Set(pageItems.map(n=>n.id));
 let added=true;while(added){added=false;for(const e of edges)if(visible.has(e.target)&&!visible.has(e.source)&&nodeMap.has(e.source)){visible.add(e.source);added=true}}
 const subset=nodes.filter(n=>visible.has(n.id));
 graphEdges=edges.filter(e=>visible.has(e.source)&&visible.has(e.target));
 const depth=new Map();const visiting=new Set();
 const calc=id=>{if(depth.has(id))return depth.get(id);if(visiting.has(id))return 0;visiting.add(id);const parents=graphEdges.filter(e=>e.target===id).map(e=>e.source);const d=parents.length?1+Math.max(...parents.map(calc)):0;visiting.delete(id);depth.set(id,d);return d};
 subset.forEach(n=>calc(n.id));
 const cols=new Map();for(const n of subset){const d=depth.get(n.id);if(!cols.has(d))cols.set(d,[]);cols.get(d).push(n)}
 const maxRows=Math.max(1,...[...cols.values()].map(v=>v.length));const totalH=Math.max(420,maxRows*90);
 for(const [d,col]of cols)col.forEach((n,i)=>graphNodes.push({...n,x:30+d*340,y:50+(i+.5)*totalH/col.length-34,w:n.type==='iaa'?265:230,h:68,context:!pageItems.some(p=>p.id===n.id)}));
 }
 const narrow=$('graph').getBoundingClientRect().width<600;
 if(narrow){const byId=new Map(graphNodes.map(n=>[n.id,n])),visited=new Set(),ordered=[];const visit=id=>{if(visited.has(id)||!byId.has(id))return;visited.add(id);ordered.push(byId.get(id));for(const edge of graphEdges)if(edge.source===id)visit(edge.target)};graphNodes.filter(n=>!graphEdges.some(e=>e.target===n.id)).forEach(n=>visit(n.id));graphNodes.forEach(n=>visit(n.id));graphNodes=ordered;graphNodes.forEach((n,i)=>{n.x=24+(jobs&&n.type==='person'?20:0);n.y=40+i*100;n.w=270;});}
 const maxPage=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 $('page-label').textContent=`${page+1} / ${maxPage}`;$('prev').disabled=page===0;$('next').disabled=page+1>=maxPage;
 $('pagination').hidden=filtered.length<=PAGE_SIZE||view==='list';
 $('graph-caption').textContent=filtered.length?`${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,filtered.length)} / ${filtered.length}${jobs?' 件':' 機関'}${!jobs&&graphNodes.length>pageItems.length?' ＋ 上位機関':''}`:'該当なし';
 $('graph-empty').style.display=filtered.length?'none':'grid';
 if(!filtered.length)$('graph-empty').innerHTML=`<div><h2>該当する${jobs?'記録':'機関'}がありません</h2><p>${jobs&&k==='career'?'収録した公表資料には採用区分がなく、キャリア採用を確認できる記録は収録していません。':'検索語や対象を変更してください。'}</p></div>`;
 bounds={w:Math.max(narrow?320:700,...graphNodes.map(n=>n.x+n.w+30)),h:Math.max(500,...graphNodes.map(n=>n.y+n.h+80))};
 const byId=new Map(graphNodes.map(n=>[n.id,n]));
 const paths=graphEdges.map(e=>{const a=byId.get(e.source),b=byId.get(e.target);if(!a||!b)return '';const x=a.x+a.w,y=a.y+a.h/2,endX=b.x,endY=b.y+b.h/2,mx=(x+endX)/2;const path=narrow?`M${a.x},${a.y+a.h/2} C6,${a.y+a.h/2} 6,${b.y+b.h/2} ${b.x-7},${b.y+b.h/2}`:`M${x},${y} C${mx},${y} ${mx},${endY} ${endX-7},${endY}`;return `<path class="edge ${esc(e.type)}" d="${path}" marker-end="url(#arrow)"><title>${esc(a.name)} → ${esc(b.name)}（${e.type==='supervision'?'所管':e.type==='reemployment'?'再就職の公表記録':'所属'}）</title></path>`}).join('');
 const ns=graphNodes.map(n=>{const color=n.type==='iaa'||n.type==='destination'?'#204b48':n.type==='person'?'#394137':n.type==='cabinet'?'#354957':'#1e3d51';const stroke=n.type==='iaa'||n.type==='destination'?'#538b77':n.type==='person'?'#938663':'#587585';const chars=n.type==='person'?14:Math.floor((n.w-30)/13);const pieces=wrap(n.name,chars);return `<g class="node${selection?.id===n.id?' selected':''}" tabindex="0" role="button" aria-label="${esc(n.name)}の詳細" data-id="${esc(n.id)}" transform="translate(${n.x},${n.y})"><rect width="${n.w}" height="${n.h}" rx="7" fill="${color}" stroke="${stroke}"/><text x="14" y="${pieces.length>1?23:28}">${pieces.map((t,i)=>`<tspan x="14" dy="${i?18:0}">${esc(t)}</tspan>`).join('')}</text>${pieces.length<2?`<text x="14" y="50" class="node-meta">${esc(n.type==='person'?short(n.formerTitle,15):typeLabel[n.type]??n.type)}${n.context?' · 上位機関':''}</text>`:''}<title>${esc(n.name)}${n.formerTitle?' / '+esc(n.formerTitle):''}</title></g>`}).join('');
 $('world').innerHTML=paths+ns;fit(PAGE_SIZE<10000);
 $('legend').innerHTML=jobs?'<span><i class="gold"></i> 公表された再就職のつながり</span><span>府省 → 人物 → 再就職先</span><span class="hint">クリックで詳細 · ドラッグで移動 · 2本指で拡大</span>':'<span><i></i> 組織上の関係（設置・所轄等）</span><span><i class="dashed"></i> 独立行政法人の所管</span><span class="hint">府省を選んで所管先を展開 · ドラッグで移動</span>';
}
function short(v,n){const a=Array.from(v??'');return a.length>n?a.slice(0,n-1).join('')+'…':a.join('')}
function wrap(v,n){const a=Array.from(v??'');if(a.length<=n)return[v];return[a.slice(0,n).join(''),short(a.slice(n).join(''),n)]}
function setView(v){view=v;$('graph-view').setAttribute('aria-pressed',v==='graph');$('list-view').setAttribute('aria-pressed',v==='list');document.querySelector('.graph-wrap').style.display=v==='graph'?'block':'none';$('detail').style.display=v==='graph'?'block':'none';$('table-view').style.display=v==='list'?'block':'none';$('pagination').hidden=v==='list'||filtered.length<=PAGE_SIZE;if(v==='graph')fit(PAGE_SIZE<10000)}
function renderTable(){
 const head=jobs?['氏名・出身府省','離職時の役職','再就職先・役職','再就職日','出典']:['機関名','種別','所属・所管府省','出典'];
 const rows=filtered.map(n=>{const cells=jobs?[`<button data-record="${esc(n.id)}">${esc(n.name)}</button><br>${esc(n.ministry)}`,esc(n.formerTitle),`${esc(n.destination)}<br>${esc(n.destinationTitle)}`,esc(n.reemploymentDate)||'原資料参照',sourceLink(recordSource(n),'公表資料 ↗')]:[`<button data-record="${esc(n.id)}">${esc(n.name)}</button>`,esc(typeLabel[n.type]??n.type),edges.filter(e=>e.target===n.id).map(e=>esc(nodeMap.get(e.source)?.name??e.source)+(e.type==='supervision'?'（所管）':'（所属）')).join('<br>')||'—',sourceLink(n.sourceUrl,'公式出典 ↗')];return '<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>'}).join('');
 $('table-view').innerHTML=`<table><thead><tr>${head.map(t=>'<th scope="col">'+t+'</th>').join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${head.length}">該当する記録がありません。</td></tr>`}</tbody></table>`;
}
function recordSource(r){return r.sourceUrl+(r.sourcePage&&!r.sourceUrl.includes('#')?'#page='+r.sourcePage:'')}
function showSelection(id){
 const n=jobs?(records.find(r=>r.id===id)??graphNodes.find(n=>n.id===id)):nodeMap.get(id);
 if(!n)return;selection=n;
 if(!jobs&&(['cabinet','ministry','secretariat'].includes(n.type)||n.name==='内閣官房')&&$('kind').value==='overview'){$('ministry').value=n.id;$('kind').value='all';page=0;update();selection=n}
 if(!graphNodes.some(g=>g.id===id)){let index=filtered.findIndex(r=>r.id===id);if(index<0){$('search').value='';$('ministry').value='';$('kind').value='all';update();index=filtered.findIndex(r=>r.id===id)}if(index>=0){page=Math.floor(index/PAGE_SIZE);renderGraph()}selection=n;}
 for(const el of $('world').querySelectorAll('.node'))el.classList.toggle('selected',el.dataset.id===id);
 renderDetail();
}
function renderDetail(){
 const n=selection;
 if(!n){const iaa=nodes.filter(n=>n.type==='iaa').length;const companies=new Set(records.map(r=>r.destination)).size;
 $('detail').innerHTML=`<div class="detail-kicker">${jobs?'公表記録をたどる':'関係性をたどる'}</div><h2>${jobs?'どこから、どこへ。':'国の機関を、一枚の図に。'}</h2><div class="summary-stats"><div><strong>${jobs?records.length.toLocaleString():nodes.filter(n=>n.type!=='role').length}</strong><span>${jobs?'公表記録':'収録機関'}</span></div><div><strong>${jobs?companies.toLocaleString():iaa}</strong><span>${jobs?'再就職先（名称で集計）':'独立行政法人'}</span></div></div><p>${jobs?'人物を選ぶと、出身府省・離職時の役職・再就職先の役職を確認できます。府省や役職名で絞り込んでください。':'府省を選ぶと、その機関と所管先を展開します。独立行政法人を選ぶと、複数府省による所管も確認できます。'}</p><h3>${jobs?'キャリア官僚を調べるには':'読み方'}</h3><p>${jobs?'採用区分は原資料にありません。「幹部職経験」は旧役職名に次官・長官・局長・審議官等がある記録の抽出であり、キャリア採用の証明ではありません。':'実線は設置・所轄・管理などの組織上の関係、破線は法人の所管です。独立性のある機関もあり、実線が必ずしも指揮命令関係を意味するわけではありません。ページを切り替えても上位機関を残し、つながりを表示します。'}</p><h3>全件を確認する</h3><p>「一覧」は絞り込み結果をすべて表示します。「CSV」は現在の結果と出典を保存します。</p>`;return}
 if(jobs){
 if(n.type==='ministry'||n.type==='destination'){const rr=records.filter(r=>n.type==='ministry'?r.ministry===n.name:(r.destinationId??('destination:'+r.destination))===n.destinationKey);$('detail').innerHTML=`<div class="detail-kicker">${typeLabel[n.type]}</div><h2>${esc(n.name)}</h2><p>公表記録 ${rr.length} 件</p><button class="related" data-refine="${esc(n.name)}" data-refine-type="${n.type}">この${n.type==='ministry'?'府省':'再就職先'}に絞り込む →</button><h3>公表対象者</h3>${rr.slice(0,20).map(r=>`<button class="related" data-record="${esc(r.id)}">${esc(r.name)} · ${esc(short(r.formerTitle,22))}</button>`).join('')}${rr.length>20?'<p>ほかの記録は絞り込んで確認できます。</p>':''}`;return}
 $('detail').innerHTML=`<div class="detail-kicker">公表された再就職の記録</div><h2>${esc(n.name)}</h2><dl><dt>出身府省</dt><dd>${esc(n.ministry)}</dd><dt>離職時の役職</dt><dd>${esc(n.formerTitle)}</dd><dt>離職日</dt><dd>${esc(n.retirementDate)||'原資料参照'}</dd><dt>再就職先</dt><dd>${esc(n.destination)}</dd><dt>再就職先の役職</dt><dd>${esc(n.destinationTitle)||'原資料参照'}</dd><dt>再就職日</dt><dd>${esc(n.reemploymentDate)||'原資料参照'}</dd><dt>採用区分</dt><dd>原資料に記載なし</dd></dl><h3>出典</h3>${sourceLink(recordSource(n),`${n.isSpecialService?'外務省':'内閣官房'} 公表資料${n.sourcePage?' · '+n.sourcePage+'ページ':''} ↗`)}<p>同じ氏名でも同一人物とは限りません。図は届出単位で表示しています。</p>`;
 }else{
 const parents=edges.filter(e=>e.target===n.id),children=edges.filter(e=>e.source===n.id);
 $('detail').innerHTML=`<div class="detail-kicker">${esc(n.category??typeLabel[n.type]??n.type)}</div><h2>${esc(n.name)}</h2>${n.note?'<p>'+esc(n.note)+'</p>':''}${n.aliases?.length?'<p>'+n.aliases.map(esc).join(' / ')+'</p>':''}${n.corporateNumber?'<dl><dt>法人番号</dt><dd>'+esc(n.corporateNumber)+'</dd></dl>':''}<h3>${n.type==='iaa'?'所管府省':'上位機関'}</h3>${parents.length?parents.map(e=>`<button class="related" data-record="${esc(e.source)}">${esc(nodeMap.get(e.source)?.name??e.source)} <span>· ${esc(e.label??(e.type==='supervision'?'所管':'組織上の関係'))}</span></button>${e.scope?'<p>'+esc(e.scope)+'</p>':''}`).join(''):'<p>上位機関はありません。</p>'}${children.length?'<h3>つながる機関 · '+children.length+'</h3>'+children.map(e=>`<button class="related" data-record="${esc(e.target)}">${esc(nodeMap.get(e.target)?.name??e.target)}</button>`).join(''):''}<h3>出典</h3>${sourceLink(n.sourceUrl)}${n.lawUrl?sourceLink(n.lawUrl,'設置法を確認する ↗'):''}${n.websiteUrl?sourceLink(n.websiteUrl.replace(/^http:/,'https:'),'機関の公式サイト ↗'):''}${n.asOf?'<p>基準日：'+esc(n.asOf)+'</p>':''}${parents.map(e=>e.sourceUrl&&e.sourceUrl!==n.sourceUrl?sourceLink(e.sourceUrl,'関係の出典 ↗'):'').join('')}`;
 }
}
function renderCoverage(){const m=meta();let parts=[];
 for(const key of ['title','period','asOf','iaaAsOf','publishedAt','retrievedAt','checkedAt','coverage','scope','notes','limitations','exclusions']){const v=m[key];if(v)parts.push(`<p>${esc(({asOf:'基準日：',iaaAsOf:'独立行政法人一覧の基準日：',checkedAt:'資料確認日：',publishedAt:'公表日：',retrievedAt:'資料確認日：',period:'対象期間：',exclusions:'対象外：'})[key]??'')}${esc(Array.isArray(v)?v.join(' / '):typeof v==='object'?(v.label??JSON.stringify(v)):v)}</p>`)}
 const sources=m.sources??data.sources??m.sourceUrls??[];
 parts.push(...sources.map(s=>typeof s==='string'?sourceLink(s,s):sourceLink(s.url??s.sourceUrl,s.title??s.name??s.url)));
 if(m.sourceUrl)parts.push(sourceLink(m.sourceUrl,m.sourceTitle??'元の公表資料 ↗'));
 parts.push(`<p>本サイトは公表資料を加工して作成した民間のサイトです。掲載件数は収録した基準日時点の範囲を表します。資料の改訂や訂正はリンク先の公式公表を確認してください。</p>`);
 $('coverage-text').innerHTML=parts.join('');
}
function applyTransform(){ $('world').setAttribute('transform',`translate(${transform.x} ${transform.y}) scale(${transform.k})`);$('zoom-label').textContent=`${Math.round(transform.k*100)}% · ドラッグで移動` }
function fit(readable=false){const box=$('graph').getBoundingClientRect();if(!box.width||!box.height)return;let k=Math.min(1.1,(box.width-38)/bounds.w,(box.height-100)/bounds.h);if(readable)k=Math.max(box.width<600?.92:.85,k);transform={k,x:bounds.w*k>box.width?16:(box.width-bounds.w*k)/2,y:bounds.h*k>box.height-100?42:50+(box.height-100-bounds.h*k)/2};applyTransform()}
function zoom(factor,cx,cy){const box=$('graph').getBoundingClientRect();cx??=box.width/2;cy??=box.height/2;const k=Math.max(.08,Math.min(3,transform.k*factor));transform.x=cx-(cx-transform.x)*k/transform.k;transform.y=cy-(cy-transform.y)*k/transform.k;transform.k=k;applyTransform()}
function csv(){const cols=jobs?['name','ministry','formerTitle','destination','destinationTitle','retirementDate','reemploymentDate','sourceUrl','sourcePage']:['name','type','parents','sourceUrl','asOf'];const labels=jobs?['氏名','出身府省','離職時の役職','再就職先','再就職先の役職','離職日','再就職日','出典URL','出典ページ']:['機関名','種別','所属・所管','出典URL','基準日'];const cell=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"';const rows=filtered.map(r=>cols.map(c=>cell(c==='parents'?edges.filter(e=>e.target===r.id).map(e=>(nodeMap.get(e.source)?.name??e.source)+'（'+(e.type==='supervision'?'所管':'所属')+'）').join(' / '):r[c])));const blob=new Blob(['\ufeff'+[labels.map(cell),...rows].map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=jobs?'commons-reemployment.csv':'commons-government.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
for(const id of ['search','ministry','kind'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;selection=null;if(id==='search'&&!jobs&&$('search').value&&$('kind').value==='overview')$('kind').value='all';if(id==='ministry'&&!jobs&&$('ministry').value)$('kind').value='all';update()});
$('reset').onclick=()=>{$('search').value='';$('ministry').value='';$('kind').value=jobs?'all':'overview';page=0;selection=null;update()};
$('prev').onclick=()=>{page--;renderGraph()};$('next').onclick=()=>{page++;renderGraph()};
$('graph-view').onclick=()=>setView('graph');$('list-view').onclick=()=>setView('list');$('download').onclick=csv;
$('page-size').onchange=()=>{PAGE_SIZE=Number($('page-size').value);page=0;renderGraph()};$('fit').onclick=()=>fit(false);$('zoom-in').onclick=()=>zoom(1.25);$('zoom-out').onclick=()=>zoom(.8);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.graph-wrap').requestFullscreen()}catch{$('zoom-label').textContent='このブラウザは全画面表示に対応していません。'}};
window.addEventListener('resize',()=>renderGraph());document.addEventListener('fullscreenchange',()=>renderGraph());
$('world').addEventListener('click',e=>{const n=e.target.closest('.node');if(n&&!dragged)showSelection(n.dataset.id)});
$('world').addEventListener('keydown',e=>{const n=e.target.closest('.node');if(n&&['Enter',' '].includes(e.key)){e.preventDefault();showSelection(n.dataset.id)}});
for(const id of ['detail','table-view'])$(id).addEventListener('click',e=>{const r=e.target.closest('[data-record]');if(r){setView('graph');showSelection(r.dataset.record);return}const f=e.target.closest('[data-refine]');if(f){if(f.dataset.refineType==='ministry')$('ministry').value=f.dataset.refine;else $('search').value=f.dataset.refine;page=0;selection=null;update()}});
$('graph').addEventListener('keydown',e=>{if(e.target!==$('graph'))return;const step=35;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-','=','0'].includes(e.key))e.preventDefault();if(e.key==='ArrowUp')transform.y+=step;if(e.key==='ArrowDown')transform.y-=step;if(e.key==='ArrowLeft')transform.x+=step;if(e.key==='ArrowRight')transform.x-=step;if(['+','='].includes(e.key))zoom(1.2);else if(e.key==='-')zoom(.8);else if(e.key==='0')fit();else applyTransform()});
$('graph').addEventListener('wheel',e=>{e.preventDefault();const rect=$('graph').getBoundingClientRect();zoom(e.deltaY<0?1.1:1/1.1,e.clientX-rect.left,e.clientY-rect.top)},{passive:false});
$('graph').addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY});dragged=false;try{$('graph').setPointerCapture(e.pointerId)}catch{}if(pointers.size===2){const a=[...pointers.values()];pinch={distance:Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y)}}});
$('graph').addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;const dx=e.clientX-old.x,dy=e.clientY-old.y;if(Math.hypot(e.clientX-old.sx,e.clientY-old.sy)>5)dragged=true;pointers.set(e.pointerId,{...old,x:e.clientX,y:e.clientY});if(pointers.size===2){dragged=true;const a=[...pointers.values()],distance=Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),rect=$('graph').getBoundingClientRect();if(pinch?.distance)zoom(distance/pinch.distance,(a[0].x+a[1].x)/2-rect.left,(a[0].y+a[1].y)/2-rect.top);pinch={distance}}else{transform.x+=dx;transform.y+=dy;applyTransform()}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('graph').addEventListener(event,e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(event==='pointerup'&&!dragged){const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.node');if(el)showSelection(el.dataset.id)}if(!pointers.size)setTimeout(()=>dragged=false,0)});
try{const response=await fetch(jobs?'/commons/reemployment-network/records.json':'/commons/government-network/agencies.json');if(!response.ok)throw new Error('HTTP '+response.status);normalizeData(await response.json())}catch(error){$('result-count').textContent='公表データを読み込めませんでした';$('detail').innerHTML='<div class="fatal"><h2>データを取得できませんでした</h2><p>通信を確認してページを再読み込みしてください。</p><button class="small-btn" id="retry-load">再読み込み</button></div>';$('retry-load').onclick=()=>location.reload();$('graph-empty').innerHTML='<div><h2>データの読み込みに失敗しました</h2><p>右の「再読み込み」からもう一度お試しください。</p></div>';$('coverage-text').textContent='出典を含むデータを読み込めませんでした。';console.error('Public data map loading error',error)}
