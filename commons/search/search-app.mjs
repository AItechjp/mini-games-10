import {prefectures,layouts,walks,todayJST,addDays,nightsBetween,validateHotel,validateRental,hotelSearches,rentalSearches} from './search-core.mjs';
import {createLiveResults} from './live-results.mjs';
const $=s=>document.querySelector(s);
const hotel=document.body.dataset.kind==='hotel';
const form=$('#search-form');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const out='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></svg>';
const params=new URLSearchParams(location.search);
let stations=[];
let initialArea=hotel?{area:params.get('area')||'',subarea:params.get('subarea')||'',region:(params.get('region')||'').slice(0,100)}:{};
const live=createLiveResults(hotel?'hotel':'rental',message=>{$('#result-count').textContent=message;$('#result-count').classList.remove('edited');});
function error(message){$('#form-error').textContent=message;$('#form-error').hidden=!message;}
function renderProviders(items){
  $('#providers').innerHTML=items.map(p=>`<article class="provider"><div class="monogram" aria-hidden="true">${escape(p.mark)}</div><div><div class="provider-title"><h3>${escape(p.name)}</h3><span class="type">${escape(p.type)}</span></div><p>${escape(p.note)}</p><div class="capabilities">${p.capabilities.map(c=>`<span>${escape(c)}</span>`).join('')}</div><a class="provider-action" href="${escape(p.url)}" target="_blank" rel="noopener noreferrer">${p.type.includes('キーワード')?'掲載ページを探す':p.type.includes('検索先で')?'サイトを開いて検索':'この条件で検索'}${out}<span class="sr-only">（新しいタブ）</span></a></div></article>`).join('');
}
function saveQuery(values){const q=new URLSearchParams();for(const [k,v] of Object.entries(values)){if(Array.isArray(v)){for(const x of v)q.append(k,x);}else if(v)q.set(k,v);}try{history.replaceState(null,'',location.pathname+'?'+q)}catch{}}
function hotelValues(){const area={...initialArea,...live.getArea($('#prefecture').value)};initialArea={};return {...area,prefecture:$('#prefecture').value,destination:'',checkin:$('#checkin').value,checkout:$('#checkout').value,adults:Number($('#adults').value),rooms:Number($('#rooms').value),sort:$('#sort').value};}
function rentalValues(){return {prefecture:$('#prefecture').value,station:$('#station').value,walk:$('#walk').value,layouts:[...form.querySelectorAll('[name=layouts]:checked')].map(x=>x.value)};}
function submit(move=false){
  const values=hotel?hotelValues():rentalValues();
  const message=hotel?validateHotel(values):validateRental(values,stations);
  error(message);if(message)return false;
  const providers=hotel?hotelSearches(values):rentalSearches(values,stations);
  renderProviders(providers);
  if(hotel){
    $('#summary-title').textContent=[values.prefecture,values.destination].filter(Boolean).join(' / ');
    $('#summary-text').textContent=`${values.checkin.replaceAll('-','/')} → ${values.checkout.replaceAll('-','/')} · ${nightsBetween(values.checkin,values.checkout)}泊 · 大人1室${values.adults}名 · ${values.rooms}室 · ${values.sort==='price'?'料金の安い順':'おすすめ順'}`;
  }else{
    const s=stations.find(x=>x.id===values.station);
    $('#summary-title').textContent=(values.prefecture==='gifu'?'岐阜県':'愛知県')+' / '+s.name+'駅';
    $('#summary-text').textContent=(values.walk?'徒歩'+values.walk+'分以内':'徒歩指定なし')+' · '+(values.layouts.length?values.layouts.join(' / '):'間取り指定なし');
  }
  $('#summary').hidden=false;saveQuery(values);
  live.search(values,providers[hotel?1:0].url);
  if(move && matchMedia('(max-width:700px)').matches){$('#results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});$('#results').focus({preventScroll:true});}
  return true;
}
form.addEventListener('submit',e=>{e.preventDefault();submit(true)});
form.addEventListener('input',()=>{error('');$('#result-count').textContent='条件を変更中';$('#result-count').classList.add('edited')});
function setValue(id,v){const el=$('#'+id);if(v!=null)el.value=v;}
if(hotel){
  $('#prefecture').innerHTML=prefectures.map(p=>`<option>${p}</option>`).join('');
  const today=todayJST();$('#checkin').min=today;$('#checkout').min=addDays(today,1);
  setValue('prefecture',prefectures.includes(params.get('prefecture'))?params.get('prefecture'):'愛知県');
  setValue('checkin',params.get('checkin')||today);setValue('checkout',params.get('checkout')||addDays(today,1));
  setValue('adults',params.get('adults')||'2');setValue('rooms',params.get('rooms')||'1');setValue('sort',params.get('sort')||'price');
  $('#checkin').addEventListener('change',()=>{if(!$('#checkin').value)return;const next=addDays($('#checkin').value,1);$('#checkout').min=next;if($('#checkout').value<next)$('#checkout').value=next;});
  document.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{const start=addDays(todayJST(),Number(b.dataset.date));setValue('checkin',start);setValue('checkout',addDays(start,1));$('#checkout').min=addDays(start,1);submit(false)}));
  $('#reset').addEventListener('click',()=>{live.clear();setValue('prefecture','愛知県');setValue('checkin',todayJST());setValue('checkout',addDays(todayJST(),1));$('#checkout').min=addDays(todayJST(),1);setValue('adults','2');setValue('rooms','1');setValue('sort','price');submit(false)});
  if(!submit()){$('#providers').innerHTML='<div class="empty"><h3>日程を確認してください</h3><p>宿泊日と地域を選ぶと、条件を引き継げる検索サイトを表示します。</p></div>';$('#result-count').textContent='検索条件の確認待ち';}
}else{
  $('#layout-options').innerHTML=layouts.map((s,i)=>`<label class="layout-choice"><input type="checkbox" name="layouts" value="${s}" ${params.getAll('layouts').includes(s)?'checked':''}><span>${s}</span></label>`).join('');
  setValue('prefecture',params.get('prefecture')==='aichi'?'aichi':'gifu');setValue('walk',walks.includes(params.get('walk'))?params.get('walk'):'');
  function fillStations(preferred){
    const q=$('#station-query').value.normalize('NFKC').trim().toLocaleLowerCase('ja').replace(/駅$/,'');
    const options=stations.filter(s=>s.prefecture===$('#prefecture').value && [s.name,...Object.keys(s.lines)].join(' ').normalize('NFKC').toLocaleLowerCase('ja').includes(q));
    const previous=preferred||$('#station').value;
    $('#station').innerHTML='<option value="">駅を選んでください</option>'+options.map(s=>`<option value="${escape(s.id)}">${escape(s.name)} — ${escape(Object.keys(s.lines).join(' / '))}</option>`).join('');
    if(options.some(s=>s.id===previous))setValue('station',previous);
    $('#station-state').textContent=options.length?'選べる駅 '+options.length+'駅':'一致する駅がありません。駅名の一部や路線名で検索できます。';
    $('#station').disabled=!options.length;
  }
  $('#prefecture').addEventListener('change',()=>{live.clear();setValue('station-query','');fillStations();$('#summary').hidden=true;$('#providers').innerHTML='<div class="empty"><h3>駅を選んでください</h3><p>選んだ県の駅に切り替えました。駅・徒歩・間取りを指定して検索できます。</p></div>';$('#result-count').textContent='駅の選択待ち'});
  $('#station-query').addEventListener('input',()=>fillStations());
  $('#reset').addEventListener('click',()=>{setValue('prefecture','gifu');setValue('station-query','');setValue('walk','');form.querySelectorAll('[name=layouts]').forEach(x=>x.checked=false);const s=stations.find(x=>x.prefecture==='gifu'&&x.name==='新鵜沼');fillStations(s?.id);submit(false)});
  async function loadStations(){
    $('#submit').disabled=true;$('#station').disabled=true;
    try{
      const r=await fetch('../search/stations.json');if(!r.ok)throw new Error('駅一覧を読み込めませんでした。通信状況を確認して再試行してください。');
      const data=await r.json();if(!Array.isArray(data.stations)||!data.stations.length)throw new Error('駅一覧の形式を確認できませんでした。');
      stations=data.stations;
      const preferred=params.get('station')||stations.find(x=>x.prefecture===$('#prefecture').value&&x.name===($('#prefecture').value==='gifu'?'新鵜沼':'名古屋'))?.id;
      fillStations(preferred);$('#submit').disabled=false;
      $('#station-source').textContent=`駅データ：SUUMOの${data.lineCount}路線ページから${stations.length}駅を収録（${data.updatedAt.slice(0,10).replaceAll('-','/')}取得）。駅の収録数であり、募集中の物件数ではありません。`;
      if(!submit(false)){$('#result-count').textContent='駅の選択待ち';}
      $('#retry').hidden=true;
    }catch(e){error(e.message);$('#station-state').textContent='駅一覧を読み込めませんでした';$('#retry').hidden=false;}
  }
  $('#retry').addEventListener('click',loadStations);loadStations();
}
