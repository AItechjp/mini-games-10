(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const cfg=window.SUPABASE_CONFIG||{};
  const nameEl=$('#chat-name'),listEl=$('#chat-messages'),form=$('#chat-form'),input=$('#chat-input'),sendBtn=$('#chat-send'),statusEl=$('#chat-status'),dot=$('#chat-dot'),onlineEl=$('#chat-online'),feedback=$('#chat-feedback'),countEl=$('#chat-count');
  const ROOM='lobby';
  let token=localStorage.getItem('guest-chat-token');if(!token){token=crypto.randomUUID();localStorage.setItem('guest-chat-token',token);}
  const short=token.slice(0,4).toUpperCase();
  let nickname=localStorage.getItem('guest-chat-name')||`Guest-${short}`;nameEl.value=nickname;
  const seen=new Set();let channel=null,sending=false;
  if(!cfg.enabled||!cfg.url||!cfg.publishableKey||!window.supabase?.createClient){statusEl.textContent='接続できません';feedback.textContent='Supabase設定を確認してください';feedback.classList.add('chat-error');sendBtn.disabled=true;return;}
  const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});

  const formatTime=v=>{const d=new Date(v);return d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});};
  function nearBottom(){return listEl.scrollHeight-listEl.scrollTop-listEl.clientHeight<100;}
  function addMessage(msg,force=false){
    const id=String(msg.id||'');if(id&&seen.has(id))return;if(id)seen.add(id);
    const shouldScroll=force||nearBottom();
    const empty=listEl.querySelector('.chat-empty');if(empty)empty.remove();
    const item=document.createElement('article');item.className='chat-msg'+(msg.client_token===token||msg.clientToken===token?' me':'');
    const head=document.createElement('div');head.className='chat-msg-head';
    const name=document.createElement('span');name.className='chat-msg-name';name.textContent=msg.nickname||'Guest';
    const time=document.createElement('span');time.className='chat-msg-time';time.textContent=formatTime(msg.created_at||Date.now());
    const body=document.createElement('div');body.className='chat-msg-body';body.textContent=msg.body||'';
    head.append(name,time);item.append(head,body);listEl.appendChild(item);
    while(listEl.children.length>120)listEl.firstElementChild?.remove();
    if(shouldScroll)requestAnimationFrame(()=>listEl.scrollTop=listEl.scrollHeight);
  }
  function setStatus(text,online){statusEl.textContent=text;dot.classList.toggle('online',online);}
  async function loadRecent(){
    const {data,error}=await client.rpc('get_recent_chat_messages',{p_room:ROOM,p_limit:60});
    if(error){feedback.textContent='履歴を取得できませんでした';feedback.classList.add('chat-error');return;}
    listEl.innerHTML='';(data||[]).forEach(m=>addMessage(m,false));
    if(!(data||[]).length)listEl.innerHTML='<div class="chat-empty">まだメッセージがありません。最初の一言を送ってみよう。</div>';
    listEl.scrollTop=listEl.scrollHeight;
  }
  async function trackPresence(){if(!channel)return;try{await channel.track({clientToken:token,nickname,joinedAt:Date.now()});}catch(_){}}
  function updatePresence(){
    if(!channel)return;const state=channel.presenceState();let n=0;for(const arr of Object.values(state))n+=Array.isArray(arr)?arr.length:0;onlineEl.textContent=String(n);
  }
  function subscribe(){
    channel=client.channel(`chat:${ROOM}`,{config:{broadcast:{self:false},presence:{key:token}}});
    channel.on('broadcast',{event:'message'},({payload})=>{if(payload?.message)addMessage(payload.message,true);});
    channel.on('presence',{event:'sync'},updatePresence);
    channel.on('presence',{event:'join'},updatePresence);
    channel.on('presence',{event:'leave'},updatePresence);
    channel.subscribe(async(status)=>{
      if(status==='SUBSCRIBED'){setStatus('接続中',true);feedback.textContent='リアルタイム接続済み';feedback.classList.remove('chat-error');await trackPresence();updatePresence();}
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){setStatus('再接続中',false);feedback.textContent='通信を再接続しています';feedback.classList.add('chat-error');}
      else if(status==='CLOSED'){setStatus('切断',false);}
    });
  }
  async function sendMessage(){
    if(sending)return;
    nickname=nameEl.value.trim().slice(0,16);const body=input.value.trim();
    if(!nickname){feedback.textContent='ニックネームを入力してください';feedback.classList.add('chat-error');nameEl.focus();return;}
    if(!body)return;
    sending=true;sendBtn.disabled=true;feedback.textContent='送信中…';feedback.classList.remove('chat-error');
    const {data,error}=await client.rpc('post_chat_message',{p_room:ROOM,p_nickname:nickname,p_body:body,p_client_token:token});
    if(error){
      const msg=String(error.message||'');feedback.textContent=msg.includes('RATE_LIMITED')?'連投防止: 1秒あけて送信してください':'送信に失敗しました。もう一度試してください。';feedback.classList.add('chat-error');
    }else{
      localStorage.setItem('guest-chat-name',nickname);const row=Array.isArray(data)?data[0]:data;const message={...row,client_token:token};addMessage(message,true);input.value='';countEl.textContent='0';feedback.textContent='送信しました';
      try{await channel?.send({type:'broadcast',event:'message',payload:{message:{...row,clientToken:token}}});}catch(_){}
    }
    setTimeout(()=>{sending=false;sendBtn.disabled=false;if(!feedback.classList.contains('chat-error'))feedback.textContent='リアルタイム接続済み';},650);
  }
  form.addEventListener('submit',e=>{e.preventDefault();sendMessage();});
  input.addEventListener('input',()=>countEl.textContent=String(input.value.length));
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
  nameEl.addEventListener('change',async()=>{const v=nameEl.value.trim().slice(0,16);if(v){nickname=v;nameEl.value=v;localStorage.setItem('guest-chat-name',v);await trackPresence();}});
  window.addEventListener('beforeunload',()=>{try{channel?.untrack();}catch(_){}});
  loadRecent();subscribe();
})();
