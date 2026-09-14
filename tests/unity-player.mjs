import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';

const base = new URL(process.env.UNITY_PLAYER_DIST === '1' ? '../dist/unity/' : '../unity/', import.meta.url);
const {attachTouchInput} = await import(new URL('touch-input.mjs', base));
class Element extends EventTarget {
  constructor(input) {
    super(); this.dataset = input ? {input} : {}; this.style = {}; this.attributes = {};
    this.children = []; this.hidden = false; this.disabled = false; this.value = '1'; this.options = [];
    const classes = new Set();
    this.classList = {contains:k => classes.has(k), toggle:(k, on) => { if (on) classes.add(k); else classes.delete(k); }};
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {}
  append(...elements) { this.children.push(...elements); }
  appendChild(element) { this.append(element); }
}
function emit(element, type, props = {}) {
  const event = new Event(type, {cancelable:true});
  Object.assign(event, props); element.dispatchEvent(event);
}
const left = new Element('x:-1'), right = new Element('x:1'), fire = new Element('fire:1'), look = new Element();
const messages = []; let enabled = true;
const input = attachTouchInput({buttons:[left,right,fire],look,send:(_,value) => messages.push(value),isActive:() => enabled});
emit(left, 'pointerdown', {pointerId:1,button:0});
emit(right, 'pointerdown', {pointerId:2,button:0});
emit(left, 'pointerup', {pointerId:1});
assert.equal(messages.at(-1), 'x:1', 'Releasing one direction must preserve another held direction');
emit(fire, 'pointerdown', {pointerId:3,button:0});
emit(fire, 'pointerdown', {pointerId:4,button:0});
const beforeRelease = messages.length;
emit(fire, 'pointerup', {pointerId:3});
assert.equal(messages.length, beforeRelease, 'A second finger must keep the action held');
emit(look, 'pointerdown', {pointerId:5,button:0,clientX:10,clientY:20});
emit(look, 'pointermove', {pointerId:99,clientX:200,clientY:200});
assert.equal(messages.length, beforeRelease, 'An unrelated finger must not move the camera');
emit(look, 'pointermove', {pointerId:5,clientX:15,clientY:18});
assert.deepEqual(messages.slice(-2), ['lookx:5','looky:2']);
emit(look, 'lostpointercapture', {pointerId:5});
const afterLook = messages.length;
emit(look, 'pointermove', {pointerId:5,clientX:20,clientY:25});
assert.equal(messages.length, afterLook, 'Lost capture must stop aiming');
input.reset();
assert.deepEqual(messages.slice(-2), ['x:0','fire:0'], 'Backgrounding must release every held input');
enabled = false;
const afterReset = messages.length;
emit(right, 'pointerdown', {pointerId:6,button:0});
assert.equal(messages.length, afterReset, 'Paused games must reject new touch presses');
enabled = true;
emit(right, 'pointerdown', {pointerId:7,button:2});
assert.equal(messages.length, afterReset, 'Secondary mouse buttons must not become touch input');
emit(right, 'pointerdown', {pointerId:7,button:0});
emit(right, 'pointercancel', {pointerId:7});
assert.equal(messages.at(-1), 'x:0');

// Exercise the actual player orchestration against download outcomes, without a WebGL engine.
const bundle = await build({entryPoints:[fileURLToPath(new URL('player.js',base))],bundle:true,write:false,format:'iife',logLevel:'silent'});
function fixture(createUnityInstance) {
  const ids = Object.fromEntries(['unity-canvas','overlay-title','description','status','message','progress','pause','overlay','touch','phase','start','next','retry','quality','mute','touch-toggle','loading','load-progress','load-label'].map(id => [id,new Element()]));
  ids.start.disabled = ids.retry.disabled = true;
  const option = new Element(); option.dataset.option = 'fighter'; option.value = '3';
  const document = new EventTarget();
  document.getElementById = id => ids[id] || null;
  document.createElement = () => new Element();
  document.querySelectorAll = selector => selector === '[data-option]' ? [option] : [];
  document.body = new Element(); document.body.dataset.game = '1';
  document.hidden = false;
  const window = new EventTarget(); window.devicePixelRatio = 2; window.createUnityInstance = createUnityInstance;
  let reloads = 0, nextTimer = 0;
  window.location = {reload:() => reloads++};
  const timers = new Map(), calls = [], errors = [];
  const instance = {SendMessage:(_,method,value) => calls.push([method,value])};
  runInNewContext(bundle.outputFiles[0].text, {
    window, document, matchMedia:() => ({matches:true}), confirm:() => false,
    setTimeout:fn => { timers.set(++nextTimer,fn); return nextTimer; }, clearTimeout:id => timers.delete(id),
    console:{error:error => errors.push(error)},
  });
  return {ids,window,document,instance,calls,timers,errors,reload:ids.loading.children[0],script:document.body.children[0],reloads:() => reloads};
}
let f = fixture();
f.script.onerror();
assert.equal(f.reload.hidden,false,'A script download error must offer recovery');
assert.equal(f.ids.start.hidden,true);
emit(f.reload,'click'); assert.equal(f.reloads(),1);
assert.equal(f.timers.size,0,'Failed loads must clean up the stall timer');

f = fixture(() => { throw new Error('engine unavailable'); });
await f.script.onload();
assert.equal(f.reload.hidden,false,'Synchronous startup errors must offer recovery');
assert.equal(f.ids.start.disabled,true);
f = fixture(() => Promise.reject(new Error('wasm download failed')));
await f.script.onload();
assert.equal(f.reload.hidden,false,'Rejected engine downloads must offer recovery');

f = fixture();
let resolveLoad, progress;
f.window.createUnityInstance = (_,config,callback) => {
  assert.equal(config.devicePixelRatio,1.5); progress = callback;
  return new Promise(resolve => { resolveLoad = resolve; });
};
f.ids.quality.value = '0'; emit(f.ids.mute,'click');
const boot = f.script.onload();
progress(.41);
[...f.timers.values()][0]();
assert.equal(f.reload.hidden,false,'Stalled downloads must offer recovery without aborting the download');
progress(.42);
assert.equal(f.reload.hidden,true);
assert.match(f.ids['load-label'].textContent,/40%/,'Progress after a stall must replace the stale warning');
resolveLoad(f.instance); await boot;
assert.equal(f.ids.start.disabled,false);
assert.equal(f.ids.loading.hidden,true);
assert.equal(f.timers.size,0);
assert.deepEqual(f.calls.slice(0,4),[['SelectGame','1'],['Quality','0'],['Mute','1'],['Option','fighter:3']]);
f.window.aitechUnityStatus({game:1,playing:true,paused:false,progress:0,status:'Playing',message:''});
f.window.aitechUnityStatus({game:2,playing:false});
assert.equal(f.window.aitechUnitySnapshot.game,1,'A status from another Unity game must not replace the active state');
emit(f.window,'blur'); f.document.hidden = true; emit(f.document,'visibilitychange'); emit(f.window,'pagehide');
assert.equal(f.calls.filter(([method]) => method === 'PauseGame').length,1,'Overlapping background events must not toggle pause off again');
console.log('Unity player checks passed: simultaneous touches, capture loss, reset, download failure/stall/recovery, settings and background pause.');
