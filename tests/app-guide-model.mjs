import assert from 'node:assert/strict';
import {APPS,FEATURES,BY_ID,appFromURL,canonical,searchApps,matches,noteKey,PROFILE_KEY,readProfile,updateProfile,readNote,saveNote,exportNote,importNote,guideText,featureDetails,MAX_NOTE} from '../app-guide/model.mjs';
const values=new Map(),touches=[];
const storage={getItem(key){touches.push(key);return values.get(key)??null},setItem(key,value){touches.push(key);values.set(key,value)}};
assert.equal(APPS.length,19);assert.equal(APPS.filter(a=>a.group==='ゲーム').length,2);assert.equal(FEATURES.length,20);assert.equal(new Set(APPS.map(a=>a.id)).size,19);
for(const app of APPS){
 assert.equal(featureDetails(app).length,20);assert.equal(new Set(featureDetails(app).map(f=>f.id)).size,20);
 assert.equal(app.steps.length,3);assert(app.controls.length>=2&&app.faq.length>=3);assert(app.related.every(id=>BY_ID[id]&&id!==app.id));
 const url=canonical(app.id);assert.equal(appFromURL(url).id,app.id);assert(!/[?&](?:room|key|token|id)=/.test(url));assert(guideText(app).includes(app.controls[0]));
 const raw=exportNote(app.id,'計画\n<script>alert(1)</script>\n☆', '2026-09-14');assert.equal(importNote(raw,app.id),'計画\n<script>alert(1)</script>\n☆');
 const first=saveNote(storage,app.id,'元のメモ',null,1,'first-'+app.id);const second=saveNote(storage,app.id,'新しいメモ',first.revision,2,'second-'+app.id);
 assert.equal(second.previous,'元のメモ');assert.equal(readNote(storage,app.id).text,'新しいメモ');
 assert.throws(()=>saveNote(storage,app.id,'古いタブのメモ',first.revision,3,'stale'),{name:'NoteConflict'});assert.equal(readNote(storage,app.id).text,'新しいメモ');
 const undone=saveNote(storage,app.id,second.previous,second.revision,4,'undo-'+app.id);assert.equal(undone.text,'元のメモ');assert.equal(undone.previous,'新しいメモ');
 assert.throws(()=>importNote(raw,APPS.find(a=>a.id!==app.id).id));
}
assert(matches('岐阜 サウナで検索','岐阜　ｻｳﾅ'));assert(matches('カメラの再起動','かめら 再起動'));assert(!matches('カメラの再起動','カメラ 取引'));assert(searchApps('さうな').length>=3);
for(const path of ['/board-games/?game=constructor','/trump/?game=__proto__','/classic.html','/babanuki.html','/game23.html','/smash.html','https://aether-card-duel.douga071132.chatgpt.site'])assert.equal(appFromURL(new URL(path,'https://aitechd.com').href),null);
assert.equal(searchApps('BLACK SITE').length,0);assert.equal(searchApps('トランプ').length,0);assert.equal(searchApps('将棋').length,0);
assert.equal(appFromURL('https://aitechd.com/commons/r/?id=abc','whiteboard').id,'whiteboard');assert.equal(appFromURL('https://aitechd.com/yobi-ronbun.html').id,'yobi');
assert.equal(appFromURL('https://aitechd.com/not-an-app'),null);assert.throws(()=>noteKey('__proto__'));
assert.equal(readProfile(storage).favorites.length,0);updateProfile(storage,p=>({...p,favorites:['quick-hop','quick-hop','memory','__proto__'],recent:['startrail','chess','constructor']}));assert.deepEqual(readProfile(storage).favorites,['quick-hop']);assert.deepEqual(readProfile(storage).recent,['startrail']);
updateProfile(storage,p=>({...p,font:'large'}));assert.deepEqual(readProfile(storage).favorites,['quick-hop']);
assert.throws(()=>importNote('{"format":"aitech-personal-note/1","appId":"quick-hop","text":12}','quick-hop'));assert.throws(()=>importNote('{bad','quick-hop'));assert.throws(()=>importNote('x'.repeat(150001),'quick-hop'));assert.throws(()=>saveNote(storage,'quick-hop','x'.repeat(MAX_NOTE+1),'undo-quick-hop',5,'large'));
const before=values.get(noteKey('quick-hop'));const quota={getItem:storage.getItem,setItem(){throw new Error('Quota exceeded')}};assert.throws(()=>saveNote(quota,'quick-hop','保存失敗','undo-quick-hop',6,'quota'));assert.equal(values.get(noteKey('quick-hop')),before);
values.set(noteKey('quick-hop'),'{damaged');assert.throws(()=>saveNote(storage,'quick-hop','破損を上書きしない',null,7,'broken'));assert.equal(values.get(noteKey('quick-hop')),'{damaged');
values.set('commons_key','private-key');values.set('aether.session.v1','private-session');assert(touches.every(key=>key===PROFILE_KEY||key.startsWith('aitech.app-guide.note.v1.')));assert.equal(values.get('commons_key'),'private-key');
console.log(JSON.stringify({passed:true,apps:APPS.length,improvementItems:APPS.length*FEATURES.length,scopedNotes:true,staleWritesRejected:true,malformedImportsRejected:true,quotaAndCorruptionPreserved:true,privateKeysUntouched:true}));
