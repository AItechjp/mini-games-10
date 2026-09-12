import {SEARCH_ENDPOINT,SEARCH_KEY} from './live-config.mjs';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=value=>'¥'+Number(value).toLocaleString('ja-JP');
const allowedHosts=new Set(['suumo.jp','hotel.travel.rakuten.co.jp','search.travel.rakuten.co.jp']);
function safeUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&allowedHosts.has(url.hostname)?url.href:'#';}catch{return '#';}}
export function sortListings(items,order){return order==='source'?[...items]:[...items].sort((a,b)=>(a.price-b.price)*(order==='price_desc'?-1:1)||a.name.localeCompare(b.name,'ja'));}
export function createLiveResults(kind,onStatus){
  const $=s=>document.querySelector(s),hotel=kind==='hotel';
  let query=null,items=[],nextPage=null,controller=null,generation=0,source=null,busy=false,lastPage=1;
  function render(){
    const sorted=sortListings(items,$('#display-sort').value);
    $('#live-list').innerHTML=sorted.map(item=>`<article class="listing"><div class="listing-main"><span class="listing-source">${hotel?'楽天トラベル':'SUUMO'}</span><h3>${escape(item.name)}</h3>${hotel?`<p class="listing-location">${escape(item.access)}</p><p class="listing-plan">${escape(item.plan)}</p>`:`<p class="listing-location">${escape(item.address)}</p><div class="listing-tags"><span>${escape(item.layout)}</span><span>${escape(item.area)}</span>${item.walk!=null?`<span>選んだ駅から徒歩${escape(item.walk)}分</span>`:''}</div><p class="listing-plan">${escape(item.transport)}</p>`}</div><div class="listing-price"><span class="price-label">${hotel?escape(item.priceLabel):'月額家賃'}</span><strong>${yen(item.price)}</strong>${hotel?'<small>表示プランの料金</small>':`<small>管理費 ${item.management==null?'掲載元で確認':yen(item.management)+'/月'}</small>`}<a href="${escape(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${hotel?'プラン・空室を確認':'募集詳細を見る'} <span aria-hidden="true">↗</span><span class="sr-only">（新しいタブ）</span></a></div></article>`).join('');
    $('#live-toolbar').hidden=!items.length;
    $('#load-more').hidden=!nextPage;
    $('#load-more').disabled=busy;
    $('#live-count').textContent=`取得済み ${items.length}${hotel?'施設':'件'}`;
    if(source){
      const date=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(source.fetchedAt));
      $('#live-meta').textContent=`${source.source} · ${date}取得（日本時間）${source.omitted?' · 条件・料金を確認できない情報は除外':''}`;
      $('#live-source').href=safeUrl(source.sourceUrl);$('#live-source').hidden=false;
    }
  }
  function message(title,text){$('#live-message').innerHTML=`<h3>${escape(title)}</h3><p>${escape(text)}</p>`;$('#live-message').hidden=false;}
  async function request(page,version){
    if(!query||busy)return;
    busy=true;lastPage=page;controller=new AbortController();
    const active=controller;let timedOut=false;
    const timeout=setTimeout(()=>{timedOut=true;active.abort();},26000);
    $('#live-retry').hidden=true;$('#live-message').hidden=true;
    $('#live-loading').hidden=false;$('#live-loading').textContent=page===1?'掲載元の情報を取得しています…':'次のページを取得しています…';
    $('#live-list').setAttribute('aria-busy','true');$('#load-more').disabled=true;onStatus('取得中');
    const params=new URLSearchParams({kind,page:String(page)});
    for(const [key,value] of Object.entries(query)){if(Array.isArray(value)){for(const v of value)params.append(key,v);}else if(value!==''&&value!=null)params.set(key,String(value));}
    try{
      const response=await fetch(SEARCH_ENDPOINT+'?'+params,{headers:{apikey:SEARCH_KEY},signal:active.signal});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'掲載情報を取得できませんでした。');
      if(!Array.isArray(data.items)||data.kind!==kind||data.page!==page)throw new Error('検索結果の形式を確認できませんでした。');
      if(version!==generation)return;
      const valid=data.items.filter(item=>item.id&&typeof item.name==='string'&&Number.isFinite(item.price)&&item.price>0&&safeUrl(item.url)!=='#');
      items=[...new Map([...items,...valid].map(item=>[item.id,item])).values()];
      nextPage=data.nextPage===page+1?data.nextPage:null;source=data;
      const areas=Array.isArray(data.areas)?data.areas:[];
      if(areas.length){
        $('#live-areas').innerHTML='<p>宿泊する地域を選んでください。</p>'+areas.map((area,index)=>`<button type="button" data-area="${index}">${escape(area.name)} <span aria-hidden="true">→</span></button>`).join('');
        $('#live-areas').hidden=false;
        $('#live-areas').querySelectorAll('[data-area]').forEach(button=>button.addEventListener('click',()=>{
          const area=areas[Number(button.dataset.area)];
          const values={...query,area:area.area,subarea:area.subarea,region:area.name};
          clear();query=values;showRegion();request(1,generation);
          const params=new URLSearchParams(location.search);for(const key of ['area','subarea','region'])params.set(key,values[key]);
          try{history.replaceState(null,'',location.pathname+'?'+params);}catch{}
        }));
        onStatus('地域を選択');
      }else{
        if(!items.length)message('このページでは表示できる結果がありません',nextPage?'次のページを読み込むか、条件を変えてください。':'条件を変えるか、掲載元で最新の情報を確認してください。');
        onStatus(`取得済み ${items.length}${hotel?'施設':'件'}`);
      }
    }catch(e){
      if(version!==generation)return;
      message('取得できませんでした',timedOut?'接続に時間がかかっています。再試行するか、掲載元で検索を続けてください。':e.message);
      $('#live-retry').hidden=false;onStatus(items.length?`取得済み ${items.length}${hotel?'施設':'件'}`:'再試行できます');
    }finally{
      clearTimeout(timeout);
      if(version===generation){busy=false;$('#live-loading').hidden=true;$('#live-list').setAttribute('aria-busy','false');render();}
    }
  }
  function clear(){
    generation++;controller?.abort();busy=false;query=null;items=[];source=null;nextPage=null;
    $('#live-list').innerHTML='';$('#live-list').setAttribute('aria-busy','false');$('#live-loading').hidden=true;$('#live-message').hidden=true;$('#live-toolbar').hidden=true;$('#load-more').hidden=true;$('#live-retry').hidden=true;$('#live-meta').textContent='';$('#live-source').hidden=true;
    $('#live-areas').hidden=true;$('#live-areas').innerHTML='';$('#live-region').hidden=true;
  }
  function showRegion(){$('#live-region').hidden=!query?.area;$('#region-label').textContent=query?.region||'選択した地域';}
  $('#change-area').addEventListener('click',()=>{const values={...query,area:'',subarea:'',region:''};clear();query=values;request(1,generation);const params=new URLSearchParams(location.search);for(const key of ['area','subarea','region'])params.delete(key);try{history.replaceState(null,'',location.pathname+'?'+params);}catch{}});
  $('#display-sort').addEventListener('change',render);
  $('#load-more').addEventListener('click',()=>request(nextPage,generation));
  $('#live-retry').addEventListener('click',()=>request(lastPage,generation));
  return {clear,getArea(prefecture){return query?.prefecture===prefecture?{area:query.area||'',subarea:query.subarea||'',region:query.region||''}:{};},search(values,sourceUrl){clear();query=values;showRegion();$('#live-source').href=safeUrl(sourceUrl);$('#live-source').hidden=false;$('#display-sort').value=hotel&&values.sort==='recommended'?'source':'price';request(1,generation);}};
}
