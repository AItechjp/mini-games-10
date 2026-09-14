import {TRACKS} from './catalog.mjs';
import {GENRES, makeQueue} from './recommend.mjs';
const $=id=>document.getElementById(id);
const known=new Set(TRACKS.map(t=>t.id));
const STORAGE='aitech-flow-preferences-v1';
let prefs={likes:[],volume:70};
try {const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved&&typeof saved==='object'){prefs.likes=Array.isArray(saved.likes)?[...new Set(saved.likes.filter(id=>known.has(id)))]:[];if(Number.isFinite(saved.volume))prefs.volume=Math.max(0,Math.min(100,saved.volume));}} catch {}
let station='mix', favorites=false, recent=[], history=[], failed=new Set(), queue=[], current=null;
let player=null, apiPromise=null, ready=false, wantsPlay=false, playing=false, visible=true, loading=false, consecutiveErrors=0, errorTimer=null, readyTimer=null;
const thumbnail=t=>`https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`;
const genreName=id=>GENRES.find(g=>g.id===id)?.label||'MIX';
const say=text=>{$('status').textContent=text;};
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(prefs));}catch{say('このブラウザでは好みを保存できません。開いている間は反映されます。');}}
function buildQueue(){queue=makeQueue(TRACKS,{station,favorites,likes:prefs.likes,recent,current:current?.id,failed:[...failed]});renderQueue();}
function renderQueue(){
  $('queue').replaceChildren();
  queue.slice(0,8).forEach((track,i)=>{
    const li=document.createElement('li'),button=document.createElement('button');button.className='queue-track';button.type='button';button.setAttribute('aria-label',`${track.title} / ${track.artist} を再生`);
    const number=document.createElement('span');number.className='queue-index';number.textContent=String(i+1).padStart(2,'0');
    const img=document.createElement('img');img.src=thumbnail(track);img.alt='';img.loading='lazy';img.width=120;img.height=70;
    const meta=document.createElement('span');meta.className='queue-meta';const title=document.createElement('b');title.textContent=track.title;const subtitle=document.createElement('small');subtitle.textContent=`${track.artist} · ${genreName(track.genre)}`;meta.append(title,subtitle);
    const icon=document.createElement('span');icon.className='queue-play';icon.textContent='▶';icon.setAttribute('aria-hidden','true');button.append(number,img,meta,icon);button.addEventListener('click',()=>select(track));li.append(button);$('queue').append(li);
  });
  $('queue-count').textContent=queue.length;
  $('empty').hidden=queue.length>0;
  $('empty').textContent=favorites&&!prefs.likes.length?'まだ「好きな曲」がありません。再生中の♡を押すと、ここから続けて聴けます。':'再生できる候補がありません。別の気分や「おすすめ」を選んでください。';
  $('queue-heading').textContent=favorites?'好きな曲から再生':'次に流れる曲';
  $('queue-description').textContent=favorites?'この端末で「好き」にした曲から。':station==='mix'?(prefs.likes.length?'あなたの「好き」の傾向を反映したミックス。':'6つのジャンルから選ぶミックス。好きな曲に♡を。'):`${genreName(station)}を続けて。聴いたばかりの曲は後ろに。`;
  $('liked-count').textContent=prefs.likes.length;
  $('favorites').setAttribute('aria-pressed',String(favorites));$('discover').setAttribute('aria-pressed',String(!favorites));$('favorites').classList.toggle('active',favorites);$('discover').classList.toggle('active',!favorites);
  $('station-name').textContent=favorites?'好きな曲のミックス':station==='mix'?'あなたへのミックス':`${genreName(station)} RADIO`;
  document.querySelectorAll('.station').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.station===station)));
}
function renderTrack(){
  if(!current)return;
  $('track-title').textContent=current.title;$('track-artist').textContent=current.artist;$('track-genre').textContent=genreName(current.genre);
  $('youtube-link').href=current.sourceUrl;$('like').disabled=false;
  const liked=prefs.likes.includes(current.id);$('like').textContent=liked?'♥':'♡';$('like').setAttribute('aria-pressed',String(liked));$('like').setAttribute('aria-label',liked?'この曲を好きから外す':'この曲を好きに追加');$('previous').disabled=history.length===0;
  document.title=`${current.title} — FLOW | AITECH`;
}
function setPlaying(value){playing=value;$('play').textContent=value?'Ⅱ':'▶';$('play').setAttribute('aria-label',value?'一時停止':'再生');$('play-state').textContent=value?'NOW PLAYING':current?'PAUSED':'READY TO PLAY';}
function loadAPI(){
  if(window.YT?.Player)return Promise.resolve();
  if(apiPromise)return apiPromise;
  apiPromise=new Promise((resolve,reject)=>{
    const old=document.getElementById('youtube-api');if(old)old.remove();
    const script=document.createElement('script');script.id='youtube-api';script.src='https://www.youtube.com/iframe_api';
    const timer=setTimeout(()=>{apiPromise=null;reject(new Error('timeout'));},15000);
    window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);resolve();};
    script.onerror=()=>{clearTimeout(timer);apiPromise=null;reject(new Error('network'));};document.head.append(script);
  });return apiPromise;
}
function playVisible(){
  if(!ready||!wantsPlay)return;
  if(document.hidden||!visible){wantsPlay=false;player.pauseVideo();setPlaying(false);say('プレーヤーを表示して、再生ボタンを押してください。');return;}
  player.playVideo();
}
async function ensurePlayer(){
  if(ready){player.loadVideoById(current.id);playVisible();return;}
  if(loading)return;
  loading=true;say('YouTubeプレーヤーを準備しています…');$('play-state').textContent='CONNECTING';
  try{
    await loadAPI();
    $('start-screen').hidden=true;
    readyTimer=setTimeout(()=>{if(ready)return;loading=false;wantsPlay=false;setPlaying(false);if(player){player.destroy();player=null;}if(!$('player')){const host=document.createElement('div');host.id='player';$('video-shell').prepend(host);}$('start-screen').hidden=false;say('プレーヤーの接続がタイムアウトしました。もう一度再生を押すか、YouTubeで開いてください。');},20000);
    player=new window.YT.Player('player',{width:'100%',height:'100%',videoId:current.id,
      playerVars:{playsinline:1,controls:1,autoplay:0,origin:location.origin,rel:0},
      events:{onReady:e=>{clearTimeout(readyTimer);ready=true;loading=false;e.target.getIframe().title='YouTube 音楽プレーヤー';e.target.getIframe().setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');e.target.setVolume(prefs.volume);if(e.target.getVideoData().video_id!==current.id)e.target.cueVideoById(current.id);playVisible();},
      onStateChange:e=>{
        if(e.data===1){if(document.hidden||!visible){wantsPlay=false;player.pauseVideo();return;}clearTimeout(errorTimer);consecutiveErrors=0;wantsPlay=true;setPlaying(true);say('再生中。「好き」を押すと、次のおすすめに反映されます。');}
        else if(e.data===2){setPlaying(false);}
        else if(e.data===3){$('play-state').textContent='BUFFERING';}
        else if(e.data===0){setPlaying(false);if($('autoplay').checked&&wantsPlay&&!document.hidden&&visible){advance(false);}else{wantsPlay=false;say('曲が終わりました。再生または次の曲を選んでください。');}}
      },
      onAutoplayBlocked:()=>{wantsPlay=false;setPlaying(false);say('ブラウザが自動再生を止めました。▶を押すと再開します。');},
      onError:handleError}
    });
  }catch{clearTimeout(readyTimer);loading=false;wantsPlay=false;setPlaying(false);$('start-screen').hidden=false;say('YouTubeに接続できませんでした。通信環境を確認して再生を押すか、YouTubeで開いてください。');}
}
function handleError(event){
  clearTimeout(errorTimer);loading=false;setPlaying(false);
  const code=event.data;
  if(code===153){wantsPlay=false;say('YouTubeがこのページからの再生を許可しませんでした。通常のブラウザでページを開き直すか、YouTubeで開いてください。');return;}
  if(current)failed.add(current.id);consecutiveErrors++;buildQueue();
  const reason=[100,101,150].includes(code)?'この動画は削除・地域制限・埋め込み制限などで再生できません。':'この動画を読み込めませんでした。';
  if($('autoplay').checked&&wantsPlay&&consecutiveErrors<3&&queue.length&&!document.hidden&&visible){say(`${reason} 次の候補に移ります。`);errorTimer=setTimeout(()=>{if($('autoplay').checked&&wantsPlay&&!document.hidden&&visible)advance(false);},1800);}
  else{wantsPlay=false;say(`${reason} 別の曲を選ぶか、YouTubeで開いてください。`);}
}
async function select(track,{back=false,automatic=false}={}){
  clearTimeout(errorTimer);
  if(!track)return;
  if(!automatic){consecutiveErrors=0;failed.delete(track.id);$('video-shell').scrollIntoView({block:'center',behavior:'instant'});visible=true;}
  if(current&&!back&&current.id!==track.id){history.push(current);history=history.slice(-50);}
  current=track;recent=[...recent.filter(id=>id!==track.id),track.id].slice(-40);wantsPlay=true;setPlaying(false);renderTrack();buildQueue();await ensurePlayer();
}
function advance(user=true){
  if(!queue.length)buildQueue();
  if(!queue.length){wantsPlay=false;say('候補がありません。「おすすめ」か別の気分を選んでください。');return;}
  select(queue[0],{automatic:!user});
}
for(const genre of GENRES){
  const track=TRACKS.find(t=>t.genre===genre.id),button=document.createElement('button');button.type='button';button.className='station';button.dataset.station=genre.id;button.setAttribute('aria-pressed','false');
  const img=document.createElement('img');img.src=thumbnail(track);img.alt='';img.width=160;img.height=90;
  const content=document.createElement('span');content.className='station-content';const label=document.createElement('b');label.textContent=genre.label;const small=document.createElement('small');small.textContent=genre.mood;content.append(label,small);button.append(img,content);
  button.addEventListener('click',()=>{station=genre.id;favorites=false;buildQueue();say(`${genre.label}の曲を選びました。再生または次の曲を押してください。`);if(!current)$('start-art').style.backgroundImage=`url("${thumbnail(track)}")`;});$('stations').append(button);
}
$('start-art').style.backgroundImage=`url("${thumbnail(TRACKS.find(t=>t.genre==='chill'))}")`;
$('catalog-count').textContent=`公式動画 ${TRACKS.length}曲`;
$('discover').addEventListener('click',()=>{station='mix';favorites=false;buildQueue();say('すべてのジャンルから次のおすすめを選びます。');});
$('favorites').addEventListener('click',()=>{favorites=true;station='mix';buildQueue();});
$('like').addEventListener('click',()=>{if(!current)return;const liked=prefs.likes.includes(current.id);prefs.likes=liked?prefs.likes.filter(id=>id!==current.id):[...prefs.likes,current.id];say(liked?'好きな曲から外しました。':'好きな曲に追加しました。この系統をおすすめに反映します。');save();renderTrack();buildQueue();});
$('start').addEventListener('click',()=>advance());
$('play').addEventListener('click',()=>{
  clearTimeout(errorTimer);
  if(playing){wantsPlay=false;player.pauseVideo();setPlaying(false);say('一時停止しました。');}
  else if(current){wantsPlay=true;consecutiveErrors=0;$('video-shell').scrollIntoView({block:'center',behavior:'instant'});visible=true;if(ready){if(player.getPlayerState()===0||failed.has(current.id)){failed.delete(current.id);player.loadVideoById(current.id);}playVisible();}else ensurePlayer();}
  else advance();
});
$('next').addEventListener('click',()=>advance());
$('previous').addEventListener('click',()=>{const previous=history.pop();if(previous)select(previous,{back:true});});
$('volume').value=prefs.volume;
$('volume').addEventListener('input',e=>{prefs.volume=Number(e.target.value);if(ready)player.setVolume(prefs.volume);});$('volume').addEventListener('change',save);
$('autoplay').addEventListener('change',()=>{if(!$('autoplay').checked)clearTimeout(errorTimer);say($('autoplay').checked?'曲が終わると、次のおすすめを再生します。':'今の曲が終わったら停止します。');});
function pauseForVisibility(){if(ready&&(playing||wantsPlay)){wantsPlay=false;clearTimeout(errorTimer);player.pauseVideo();setPlaying(false);say('画面外では一時停止します。▶を押すと再開できます。');}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForVisibility();});
if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].intersectionRatio>.5;if(!visible)pauseForVisibility();},{threshold:[0,.5,.51,1]}).observe($('video-shell'));
window.addEventListener('pagehide',()=>{wantsPlay=false;clearTimeout(errorTimer);if(ready)player.pauseVideo();});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!/^(INPUT|BUTTON|A|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)&&!document.activeElement?.isContentEditable){e.preventDefault();$('play').click();}});
buildQueue();
