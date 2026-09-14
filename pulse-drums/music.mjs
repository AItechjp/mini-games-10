// Original music and independently authored charts for PULSE DRUMS.
// No recordings, melodies or official charts from commercial games are bundled.
export const LANES = [
  {name:'HI-HAT',ja:'ハイハット',short:'HH',key:'D',code:'KeyD',color:'#56e5c2'},
  {name:'SNARE',ja:'スネア',short:'SN',key:'F',code:'KeyF',color:'#ff668b'},
  {name:'KICK',ja:'バスドラム',short:'BD',key:'SPACE',code:'Space',color:'#b38cff'},
  {name:'HIGH TOM',ja:'ハイタム',short:'HT',key:'J',code:'KeyJ',color:'#5db8ff'},
  {name:'LOW TOM',ja:'ロータム',short:'LT',key:'K',code:'KeyK',color:'#ffa95a'},
  {name:'CYMBAL',ja:'シンバル',short:'CY',key:'L',code:'KeyL',color:'#f4e87b'},
];
export const DIFFICULTIES = ['BASIC','ADVANCED','EXTREME'];
export const TRACKS = [
  {id:'city-signal',title:'CITY SIGNAL',jp:'街が目を覚ます',genre:'CITY FUNK',bpm:104,bars:32,root:45,color:'#56e5c2',wave:'triangle',groove:'funk',chords:[0,5,3,7],melody:[12,null,15,19,null,17,15,null,12,10,null,12,15,null,7,10],levels:[1.6,3.8,6.1]},
  {id:'velvet-hour',title:'VELVET HOUR',jp:'夜に溶けるビート',genre:'LO-FI SOUL',bpm:92,bars:28,root:50,color:'#d5a4fa',wave:'sine',groove:'soul',chords:[0,3,8,5],melody:[19,null,null,17,15,null,12,null,10,null,12,15,null,14,10,null],levels:[1.2,3.1,5.5]},
  {id:'neon-current',title:'NEON CURRENT',jp:'電流のように',genre:'SYNTHWAVE',bpm:118,bars:36,root:40,color:'#ff668b',wave:'sawtooth',groove:'four',chords:[0,8,3,10],melody:[12,19,24,19,15,22,27,22,10,17,22,17,7,14,19,14],levels:[2.1,4.2,6.3]},
  {id:'afterglow',title:'AFTERGLOW',jp:'残光の向こうへ',genre:'MELODIC HOUSE',bpm:126,bars:36,root:48,color:'#ffa95a',wave:'triangle',groove:'four',chords:[0,7,9,5],major:true,melody:[12,null,16,19,24,null,23,19,21,null,19,16,14,16,19,null],levels:[2.2,4.5,6.5]},
  {id:'rust-revolt',title:'RUST REVOLT',jp:'錆びた街の反撃',genre:'INDUSTRIAL ROCK',bpm:138,bars:40,root:40,color:'#f18360',wave:'sawtooth',groove:'rock',chords:[0,0,3,5],melody:[0,0,12,null,0,3,5,null,7,7,5,3,0,null,10,7],levels:[2.7,5.2,7.4]},
  {id:'prism-runner',title:'PRISM RUNNER',jp:'光を追い越して',genre:'ELECTRO POP',bpm:146,bars:40,root:47,color:'#5db8ff',wave:'square',groove:'pop',chords:[0,5,8,3],melody:[12,15,null,19,22,19,null,15,17,14,null,10,12,null,7,10],levels:[3.1,5.6,7.7]},
  {id:'tidal-code',title:'TIDAL CODE',jp:'波形の深海',genre:'PROGRESSIVE',bpm:156,bars:44,root:42,color:'#5ed1e8',wave:'triangle',groove:'prog',chords:[0,1,8,6],melody:[12,14,15,19,18,15,14,10,7,10,12,15,14,12,7,6],levels:[3.4,6.0,8.2]},
  {id:'orbit-breaker',title:'ORBIT BREAKER',jp:'軌道を抜け出せ',genre:'DRUM & BASS',bpm:172,bars:48,root:43,color:'#c0e567',wave:'sawtooth',groove:'break',chords:[0,8,5,10],melody:[24,null,19,22,null,15,17,null,19,22,24,null,27,26,22,null],levels:[3.6,6.5,8.5]},
  {id:'black-comet',title:'BLACK COMET',jp:'夜空を裂く',genre:'SPEED ROCK',bpm:184,bars:48,root:38,color:'#c99bff',wave:'square',groove:'rock',chords:[0,3,8,7],melody:[12,12,7,10,12,15,14,10,7,7,10,12,15,17,19,17],levels:[4.0,6.9,8.9]},
  {id:'last-transmission',title:'LAST TRANSMISSION',jp:'最後の一打まで',genre:'HARD ELECTRO',bpm:194,bars:52,root:41,color:'#f4e87b',wave:'sawtooth',groove:'final',chords:[0,6,8,1],melody:[24,19,15,12,13,18,20,25,24,22,18,15,20,18,13,12],levels:[4.4,7.4,9.5]},
  {id:'chronos',title:'Chronos',jp:'TAG',genre:'LOCAL AUDIO',color:'#e3d4af',local:true,levels:[null,null,null]},
];
export const SECTIONS = ['INTRO','GROOVE','CHORUS','BREAK','FINALE'];
export const sectionAt = (bar,bars) => bar < 4 ? 0 : bar < bars*.35 ? 1 : bar < bars*.65 ? 2 : bar < bars*.8 ? 3 : 4;
export function random(seed=1) { let s=seed>>>0;return()=>{s+=0x6d2b79f5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}; }
export function drumPattern(track) {
  const events=[];const add=(beat,lane,level=0,velocity=1)=>events.push({beat,lane,level,velocity});
  for(let bar=0;bar<track.bars;bar++){
    const start=bar*4,section=sectionAt(bar,track.bars),fill=bar%8===7,half=section===3;
    const energetic=section===2||section===4;
    for(let step=0;step<8;step++){
      if(half&&step%2)continue;
      add(start+step*.5,0,step%2?1:0,step%2?.48:.8);
      if(energetic&&step%2&&['break','final','prog'].includes(track.groove))add(start+step*.5+.25,0,2,.45);
    }
    add(start,2);if(!half)add(start+2,2);
    if(half)add(start+2,1);else{add(start+1,1);add(start+3,1);}
    if(track.groove==='four'){add(start+1,2,1);add(start+3,2,1);}
    if(['funk','soul','pop'].includes(track.groove)){add(start+1.5,2,1,.8);if(bar%2)add(start+2.75,1,2,.4);}
    if(track.groove==='break'){add(start+2.5,2,1);add(start+2.75,1,2,.4);if(bar%2)add(start+3.5,1,2,.65);}
    if(['rock','final'].includes(track.groove)){add(start+.5,2,1);if(energetic){add(start+2.5,2,1);add(start+2.75,2,2,.75);}}
    if(track.groove==='prog'){add(start+.75,2,2);add(start+1.75,3,1);add(start+2.5,4,1);add(start+3.25,2,2);}
    if(bar%4===0)add(start,5,1,.9);
    if(fill){
      for(let step=0;step<8;step++)add(start+2+step*.25,step<2?1:step<4?3:step<6?4:1,step%2?2:1,.7+step*.035);
    } else if(energetic&&bar%4===2){add(start+3.5,3,1);add(start+3.75,4,2);}
  }
  const unique=new Map();for(const n of events){const key=n.beat+':'+n.lane;const old=unique.get(key);if(!old||n.level<old.level)unique.set(key,n);}
  return [...unique.values()].sort((a,b)=>a.beat-b.beat||a.lane-b.lane);
}
export function makeChart(track,difficulty=1) {
  const source=drumPattern(track).filter(n=>n.level<=difficulty);
  // At most two simultaneous strikes, including kick: fully playable on two thumbs.
  const out=[];let beat=-1,count=0;
  for(const n of source.sort((a,b)=>a.beat-b.beat||((a.lane===0)-(b.lane===0))||a.lane-b.lane)){
    if(n.beat!==beat){beat=n.beat;count=0;}
    if(count++<2)out.push({t:n.beat*60/track.bpm,lane:n.lane,velocity:n.velocity});
  }
  return out.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}
export function arrangement(track) {
  const beat=60/track.bpm,events=[];
  for(const note of drumPattern(track))events.push({t:note.beat*beat,kind:'drum',lane:note.lane,gain:note.velocity*.21});
  for(let bar=0;bar<track.bars;bar++){
    const section=sectionAt(bar,track.bars),root=track.root+track.chords[Math.floor(bar/2)%4],start=bar*4*beat;
    const energetic=section===2||section===4;
    for(const interval of [0,track.major?4:3,7])events.push({t:start,kind:'pad',midi:root+12+interval,duration:beat*3.85,gain:.053});
    const bassSteps=track.groove==='soul'?[0,3,5]:track.groove==='four'?[0,2,4,6]:[0,1,3,4,6,7];
    for(const s of bassSteps)events.push({t:start+s*.5*beat,kind:'bass',midi:root+(s===7?7:0),duration:beat*.36,gain:.24});
    if(section===0&&bar<2)continue;
    for(let s=0;s<16;s++){
      const ix=(s+(bar%4===3?4:0))%16,m=track.melody[ix];
      if(m===null||(!energetic&&s%2===1)||section===3&&s%4!==0)continue;
      events.push({t:start+s*.25*beat,kind:'lead',midi:root+m+(energetic?12:0),duration:beat*(track.groove==='soul'?.65:.34),gain:track.wave==='square'?.07:.11,wave:track.wave});
    }
    if(energetic&&bar%2===1)for(let s=0;s<4;s++)events.push({t:start+(s+.5)*beat,kind:'bell',midi:root+31+(s%2?5:0),duration:beat*.5,gain:.09});
  }
  return events.sort((a,b)=>a.t-b.t);
}
export const trackDuration=t=>t.local?0:t.bars*4*60/t.bpm+1.4;
export function timingGrade(delta){const ms=Math.abs(delta)*1000;return ms<=45?'perfect':ms<=90?'great':ms<=140?'good':null;}
export const WEIGHTS={perfect:1,great:.7,good:.35,miss:0};
export const rankFor=accuracy=>accuracy>=98?'SS':accuracy>=93?'S':accuracy>=85?'A':accuracy>=72?'B':accuracy>=58?'C':'D';

// Build an independent practice chart from the user's local recording.
// Time points are detected attacks in that file, not a bundled commercial chart.
export function analyzeAudio(buffer) {
  const step=Math.max(1,Math.round(buffer.sampleRate*.01));
  const channels=Array.from({length:Math.min(2,buffer.numberOfChannels)},(_,i)=>buffer.getChannelData(i));
  const energy=[],bright=[];
  for(let i=0;i<buffer.length;i+=step){let sum=0,hi=0,prev=0;
    for(let j=i;j<Math.min(buffer.length,i+step);j+=4){let v=0;for(const ch of channels)v+=ch[j]/channels.length;sum+=v*v;hi+=Math.abs(v-prev);prev=v;}
    energy.push(Math.sqrt(sum/(step/4)));bright.push(hi/(step/4));
  }
  const flux=energy.map((v,i)=>Math.max(0,v-(energy[i-1]||0)));
  const sorted=[...flux].sort((a,b)=>a-b);const base=sorted[Math.floor(sorted.length*.68)]||.0001;
  const peaks=[];let last=-100;
  for(let i=2;i<flux.length-2;i++){
    if(flux[i]>base*1.5&&flux[i]>=flux[i-1]&&flux[i]>=flux[i+1]&&energy[i]>.003&&i-last>=8){
      peaks.push({t:i*step/buffer.sampleRate,strength:flux[i],brightness:bright[i]/(energy[i]+.00001)});last=i;
    }
  }
  const bpmScores=[];for(let bpm=80;bpm<=200;bpm++){const lag=Math.round(6000/bpm);let score=0;for(let i=lag;i<flux.length;i++)score+=flux[i]*flux[i-lag];bpmScores.push({bpm,score});}
  bpmScores.sort((a,b)=>b.score-a.score);
  return{peaks,bpm:bpmScores[0]?.bpm||120,duration:buffer.duration};
}
export function localChart(analysis,difficulty=1,shift=0) {
  const minGap=[.32,.19,.105][difficulty],out=[];let last=-5;
  const strengths=analysis.peaks.map(p=>p.strength).sort((a,b)=>a-b);
  const strong=strengths[Math.floor(strengths.length*.75)]||0;
  const lanes=[2,0,1,0,2,3,1,4];
  for(const peak of analysis.peaks){
    if(peak.t-last<minGap||peak.t<.08)continue;
    let lane=lanes[out.length%lanes.length];
    if(peak.brightness>1.25)lane=out.length%7===0?5:0;
    if(difficulty===0&&lane>2)lane=out.length%2?1:0;
    const t=peak.t+shift;if(t<0||t>analysis.duration-.12)continue;
    out.push({t,lane,velocity:.8});
    if(difficulty>0&&peak.strength>strong&&out.length%5===0&&lane!==2)out.push({t,lane:2,velocity:.75});
    last=peak.t;
  }
  return out.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}

export class AudioEngine {
  constructor(){this.ctx=null;this.events=[];this.index=0;this.timer=null;this.source=null;this.running=false;this.origin=0;this.active=new Set();this.volume=.7;this.session=0;}
  async unlock(){
    if(!this.ctx){
      const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!Audio)throw new Error('このブラウザは音声再生に対応していません。ChromeまたはSafariをお試しください。');
      this.ctx=new Audio({latencyHint:'interactive'});
      this.master=this.ctx.createGain();this.master.gain.value=this.volume;
      const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-12;compressor.ratio.value=5;
      this.master.connect(compressor);compressor.connect(this.ctx.destination);
      this.bus=this.ctx.createGain();this.bus.connect(this.master);
      this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*1.2,this.ctx.sampleRate);
      const data=this.noise.getChannelData(0),rng=random(97231);for(let i=0;i<data.length;i++)data[i]=rng()*2-1;
    }
    await this.ctx.resume();
    if(this.ctx.state!=='running')throw new Error('音声を開始できませんでした。もう一度「演奏する」を押してください。');
  }
  setVolume(v){this.volume=v;if(this.master)this.master.gain.setTargetAtTime(v,this.ctx.currentTime,.02);}
  track(node){this.active.add(node);node.onended=()=>{this.active.delete(node);try{node.disconnect();}catch{}};return node;}
  tone(midi,t,duration,gain,wave='triangle',kind='lead'){
    const ctx=this.ctx,o=this.track(ctx.createOscillator()),g=ctx.createGain(),f=ctx.createBiquadFilter();
    o.type=wave;o.frequency.value=440*2**((midi-69)/12);f.type='lowpass';f.frequency.value=kind==='bass'?750:kind==='pad'?1500:5000;
    const attack=kind==='pad'?.12:.006;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+duration+.15);
    o.connect(f);f.connect(g);g.connect(this.bus);o.start(t);o.stop(t+duration+.18);o.addEventListener('ended',()=>{g.disconnect();f.disconnect();},{once:true});
  }
  drum(lane,t=this.ctx.currentTime,gain=.75){
    const ctx=this.ctx,g=ctx.createGain();g.connect(this.bus);
    if(lane===2||lane===3||lane===4){
      const o=this.track(ctx.createOscillator());o.type='sine';const freq=lane===2?155:lane===3?330:205,d=lane===2?.32:.22;
      o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(lane===2?42:freq*.4,t+.15);
      g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);o.start(t);o.stop(t+d+.02);o.addEventListener('ended',()=>g.disconnect(),{once:true});
    }else{
      const n=this.track(ctx.createBufferSource()),f=ctx.createBiquadFilter();n.buffer=this.noise;n.playbackRate.value=lane===1?.8:1;
      f.type=lane===1?'bandpass':'highpass';f.frequency.value=lane===1?1900:lane===0?7800:5200;f.Q.value=lane===1?.8:.5;
      const d=lane===0?.065:lane===1?.17:.65;g.gain.setValueAtTime(gain*(lane===0?.48:.7),t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
      n.connect(f);f.connect(g);n.start(t);n.stop(t+d+.01);n.addEventListener('ended',()=>{g.disconnect();f.disconnect();},{once:true});
      if(lane===1)this.tone(48,t,.07,gain*.24,'triangle','bass');
    }
  }
  async play(track,{buffer=null,lead=2.4}={}){
    this.stop();const session=this.session;await this.unlock();if(session!==this.session)return false;this.bus=this.ctx.createGain();this.bus.connect(this.master);
    this.origin=this.ctx.currentTime+lead+.12;this.running=true;this.index=0;
    if(buffer){this.events=[];this.source=this.track(this.ctx.createBufferSource());this.source.buffer=buffer;this.source.connect(this.bus);this.source.start(this.origin);}
    else this.events=arrangement(track);
    for(let i=0;i<4;i++){const t=this.origin-(4-i)*Math.min(.5,lead/4);if(t>=this.ctx.currentTime)this.tone(i===3?84:76,t,.035,.11,'sine','bell');}
    this.schedule();this.timer=setInterval(()=>this.schedule(),25);return true;
  }
  schedule(){if(!this.running||this.ctx.state!=='running')return;
    const until=this.ctx.currentTime+.13;
    while(this.index<this.events.length&&this.origin+this.events[this.index].t<until){
      const event=this.events[this.index++],t=this.origin+event.t;
      if(t<this.ctx.currentTime-.04)continue;
      const at=Math.max(t,this.ctx.currentTime);
      if(event.kind==='drum')this.drum(event.lane,at,event.gain);
      else this.tone(event.midi,at,event.duration,event.gain,event.wave||'triangle',event.kind);
    }
  }
  position(){if(!this.ctx)return 0;const stamp=this.ctx.getOutputTimestamp?.();
    // The last output timestamp can be stale immediately after resuming.
    // Never let the projected speaker clock run ahead of the audio context.
    const now=stamp&&stamp.contextTime>0&&this.ctx.state==='running'?Math.min(this.ctx.currentTime,stamp.contextTime+(performance.now()-stamp.performanceTime)/1000):this.ctx.currentTime;
    return now-this.origin;
  }
  async pause(){if(this.ctx?.state==='running')await this.ctx.suspend();}
  async resume(){await this.ctx?.resume();}
  stop(){this.session++;clearInterval(this.timer);this.timer=null;this.running=false;for(const n of this.active){try{n.stop();}catch{}}this.active.clear();if(this.bus){try{this.bus.disconnect();}catch{}}this.source=null;this.events=[];}
}
