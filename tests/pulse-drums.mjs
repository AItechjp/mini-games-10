import assert from 'node:assert/strict';
import {TRACKS,makeChart,arrangement,trackDuration,timingGrade,analyzeAudio,localChart} from '../pulse-drums/music.mjs';

const originals=TRACKS.filter(t=>!t.local);
assert.equal(originals.length,10);assert.ok(TRACKS.some(t=>t.id==='chronos'&&t.local));
assert.equal(new Set(originals.map(t=>t.melody.join(','))).size,10,'Each original has a distinct melody');
let total=0;
for(const track of originals){
  const counts=[];assert.ok(trackDuration(track)>60&&trackDuration(track)<90);
  for(let difficulty=0;difficulty<3;difficulty++){
    const notes=makeChart(track,difficulty),times=new Map(),last=Array(6).fill(-10);counts.push(notes.length);total+=notes.length;
    for(const n of notes){assert.ok(n.lane>=0&&n.lane<6);assert.ok(n.t>=0&&n.t<trackDuration(track));assert.ok(n.t-last[n.lane]>.06,'No impossible same-lane doubles');last[n.lane]=n.t;times.set(n.t,(times.get(n.t)||0)+1);}
    assert.ok([...times.values()].every(n=>n<=2),'Two-thumb simultaneous limit');
    assert.deepEqual(notes,[...notes].sort((a,b)=>a.t-b.t||a.lane-b.lane));
  }
  assert.ok(counts[0]<counts[1]&&counts[1]<counts[2]);
  const sound=arrangement(track);assert.ok(['drum','bass','lead','pad'].every(kind=>sound.some(e=>e.kind===kind)));assert.ok(sound.every(e=>Number.isFinite(e.t)&&e.t>=0));
}
assert.equal(timingGrade(-.044),'perfect');assert.equal(timingGrade(.046),'great');assert.equal(timingGrade(-.091),'good');assert.equal(timingGrade(.141),null);
const rate=22050,data=new Float32Array(rate*12);
for(let beat=0;beat<23;beat++){const offset=Math.round((.25+beat*.5)*rate);for(let j=0;j<1000;j++)data[offset+j]=Math.sin(j*.15)*Math.exp(-j/140)*.8;}
const buffer={sampleRate:rate,length:data.length,duration:12,numberOfChannels:1,getChannelData:()=>data};
const analysis=analyzeAudio(buffer);assert.ok(analysis.peaks.length>=20);assert.ok(Math.abs(analysis.bpm-120)<5);
const chart=localChart(analysis,0);assert.ok(chart.length>=20);assert.ok(chart.every(n=>n.t>=0&&n.t<12));
assert.equal(analyzeAudio({...buffer,getChannelData:()=>new Float32Array(data.length)}).peaks.length,0);
console.log(JSON.stringify({originals:10,difficulties:30,totalNotes:total,localAttacks:analysis.peaks.length,detectedBpm:analysis.bpm,passed:true}));
