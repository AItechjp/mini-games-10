import {SCENARIOS,DIFFICULTIES,GOALS,TECHNIQUES} from './data.mjs';
export const NODES={recon:'公開網',access:'入口',sideentry:'保守路',discovery:'分岐点',deadend:'行き止まり',pivot:'中継点',credential:'認証庫',privilege:'権限境界',vault:'データ庫',inspect:'照合室',encrypt:'暗号化',exfil:'出口',recovery:'退避点',end:'任務完了'};
export function createMission(id,run=globalThis.crypto?.randomUUID?.()||String(Date.now())){
 const mission=SCENARIOS.find(s=>s.id===id);if(!mission)throw new Error('シナリオがありません。');
 const d=DIFFICULTIES[mission.difficulty];return {version:1,mission:id,run,revision:0,node:'recon',phase:'play',turns:d.turns,trace:d.trace,integrity:100,intel:0,assist:d.assist,shield:false,flags:{},votes:[null,null],log:[],visited:['recon'],feedback:null,ending:null};
}
export const scenario=s=>SCENARIOS[s.mission-1];
const act=(id,label,desc,next,tech,effect={},cost=1)=>({id,label,desc,next,tech,effect,cost});
export function actions(s){
 const m=scenario(s),deep=m.difficulty>=2,route=m.route==='archive'?'資料庫':'サービス網',afterPivot=deep?'credential':m.goal==='access'?'privilege':'vault';
 const targetNext=m.goal==='collect'?'end':m.goal==='exfil'?'exfil':'encrypt';
 let a=[];
 switch(s.node){
 case 'recon':a=[act('public','公開目録を照合する',`${m.org}の公開記録から、接点の根拠を集める。`,'access','T1593',{intel:2,trace:1}),act('scan','応答パネルを調べる','近道の候補を得る。監視にも記録が残る。','access','T1595',{intel:1,trace:10,shortcut:true}),act('blind','記録なしで入口へ進む','調査を省き、入口の表示だけを頼りに進む。','access','T1593',{trace:19},1)];break;
 case 'access':a=[act('matched',m.entry==='T1078'?'通行証の経路を選ぶ':m.entry==='T1190'?'公開アプリの経路を選ぶ':'外部保守の経路を選ぶ','収集した根拠に対応する演習用の入口を利用する。','discovery',m.entry,{trace:s.intel>=2?4:17,access:true}),act('side','予備の保守路へ回る','時間をかけて別の入口を確認する。','sideentry','T1133',{trace:2}),act('force','表示中の管理ゲートに直行','入口と管理区画を同じものとして扱う。','recovery',m.entry,{trace:24,integrity:-12})];break;
 case 'sideentry':a=[act('maintenance','保守記録の区画IDを照合','予備経路の入口を確定してから進む。','discovery','T1133',{access:true,intel:1,trace:3},2),act('retry','公開記録まで戻る','調査をやり直して正規の経路を探す。','recon','T1593',{trace:-3}),act('old','古い保守証で接続を試す','通れるが、余分な照合により警戒が高まる。','discovery','T1133',{access:true,trace:17})];break;
 case 'discovery':a=[act('archive','資料庫の索引をたどる','ファイルとフォルダのつながりを調べる。',m.route==='archive'?'pivot':'deadend','T1083',{trace:m.route==='archive'?3:13,route:'archive'}),act('service','サービス網をたどる','サービスのつながりから中継点を探す。',m.route==='service'?'pivot':'deadend','T1046',{trace:m.route==='service'?3:13,route:'service'}),act('shortcut','見つけた近道を使う','応答調査の手掛かりと情報量3以上が必要。',s.flags.shortcut&&s.intel>=3?afterPivot:'deadend','T1046',{trace:s.flags.shortcut&&s.intel>=3?9:19})];break;
 case 'deadend':a=[act('return','分岐点に戻って選び直す','解析担当の経路メモをもう一度確認する。','discovery','T1083',{trace:2}),act('cross','区画を横断して中継点へ','遠回りをせず進む代わりに、データ保全度を失う。','pivot','T1021',{trace:18,integrity:-10}),act('deeper','同じ道をさらに探る','行き止まりの先に別の出口があると賭ける。','recovery','T1046',{trace:25,integrity:-10})];break;
 case 'pivot':a=[act('linked',`${route}の中継点へ移る`,'確認した区画間の接続を使う。',afterPivot,'T1021',{trace:8}),act('verify','通路を再照合してから移る','手数を一つ多く使い、警戒の上昇を抑える。',afterPivot,'T1021',{trace:2,intel:1},2),act('unknown','名前の似た別区画へ移る','区画IDを確認せず、表示名だけで移動する。','recovery','T1021',{trace:26,integrity:-14})];break;
 case 'credential':a=[act('evidence','鍵カードと区画IDを照合','ファイル内の演習用認証情報から有効範囲を確かめる。','privilege','T1552.001',{key:true,trace:9}),act('reuse','入口の通行証を再利用','入口用の権限が奥でも通用すると仮定する。','privilege','T1078',{trace:12}),act('audit','古い鍵と現行の鍵を比較','追加の手数を使って権限の証跡を確保する。','privilege','T1552.001',{key:true,trace:3,intel:1},2)];break;
 case 'privilege':a=[act('scoped','証跡に合う権限ゲートを選ぶ','演習用の弱点を、対象区画の範囲に絞って確認する。',s.flags.key||!deep?(m.goal==='access'?'end':'vault'):'recovery','T1068',{trace:s.flags.key||!deep?9:24,admin:!!(s.flags.key||!deep)}),act('wide','広い権限ゲートを一気に越える','警戒と保全度への負担を受け入れ、対象区画へ到達する。',m.goal==='access'?'end':'vault','T1068',{trace:29,integrity:-18,admin:true}),act('back','認証庫へ戻って根拠を集める','不足する鍵カードの照合をやり直す。','credential','T1552.001',{trace:1})];break;
 case 'vault':a=[act('exact',m.goal==='encrypt'?'対象ファイルを確定する':'識別情報が一致する原本を回収',`${m.fingerprint} と解析メモを照合する。`,m.goal==='encrypt'?'encrypt':targetNext,m.collection,{trace:5,verified:true,collected:m.goal!=='encrypt'}),act('bulk','同じ名前のデータをまとめて選ぶ','対象を含むが、無関係なコピーの混入で保全度が落ちる。',m.goal==='encrypt'?'encrypt':targetNext,m.collection,{trace:21,integrity:-28,verified:true,collected:m.goal!=='encrypt'}),act('inspect','照合室で細部を調べる','もう一手かけて原本と囮を区別する。','inspect','T1083',{intel:1,trace:1})];break;
 case 'inspect':a=[act('compare','原本の識別子を記録する',m.twist,'vault','T1083',{trace:0,intel:2,inspected:true}),act('latest','更新時刻だけで原本を決める','一番新しく見えるコピーに進む。','recovery','T1083',{trace:13,integrity:-16}),act('leave','資料庫へ戻る','照合を保留して対象の選択に戻る。','vault','T1083',{trace:1})];break;
 case 'encrypt':a=[act('bounded','指定ブロックを暗号化する','ゲーム内の指定データを暗号化状態にして目標を完了。','end','T1486',{trace:13,encrypted:true}),act('all','周辺のコピーも一括で暗号化','対象範囲が広がり、警戒と保全度への負担が大きい。','end','T1486',{trace:32,integrity:-30,encrypted:true}),act('prepare','対象境界を再確認する','一度だけ準備できる。警戒を下げ、保全度を整える。','encrypt','T1486',{trace:-7,integrity:10,prepared:true},1)];if(s.flags.prepared)a[2].disabled=true;break;
 case 'exfil':a=[act('transfer','照合済みデータを出口へ転送','演習用の既存通信経路を通して持ち出しを完了する。','end','T1041',{trace:15,exfiltrated:true}),act('burst','未整理のまま一括転送','手早く運ぶが、出口側の監視が強く反応する。','end','T1041',{trace:31,integrity:-20,exfiltrated:true}),act('pack','転送対象を再整理する','一度だけ準備できる。警戒を下げ、混入データを整理する。','exfil',m.collection,{trace:-8,integrity:10,prepared:true})];if(s.flags.prepared)a[2].disabled=true;break;
 case 'recovery':a=[act('recover','退避点から経路を立て直す','二手使って警戒を下げ、分岐点へ戻る。','discovery','T1021',{trace:-13,integrity:5},2),act('rush','中継点へ強行する','警戒を引き受けて先へ進む。','pivot','T1021',{trace:14}),act('abort','演習から撤退する','今回は終了し、攻略記録を見て再挑戦する。','end',null,{abort:true})];break;
 }
 // The position of the best route is not fixed across scenarios or phases.
 const offset=(m.id+Object.keys(NODES).indexOf(s.node))%3;
 return a.slice(offset).concat(a.slice(0,offset));
}
export function supports(s){return [
 {id:'intel',label:'手掛かりを照合',desc:'情報量＋1 ／ 警戒−2。手数・支援回数の追加消費なし。',effect:{intel:1,trace:-2},cost:0},
 {id:'watch',label:'監視の動きを解析',desc:'警戒−12 ／ 追加1手・支援1回。',effect:{trace:-12},cost:1,uses:1,disabled:s.assist<1},
 {id:'protect',label:'データの保全を支援',desc:'保全度＋8、今回の保全度低下を軽減 ／ 追加1手・支援1回。',effect:{integrity:8,shield:true},cost:1,uses:1,disabled:s.assist<1}
];}
export function story(s){const m=scenario(s),map={
 recon:['最初の痕跡',`${m.brief} 手元には公開目録と応答パネル。二人の記録を合わせ、最初の接点を選ぼう。`],
 access:['入口を選べ','見つかった入口は複数ある。入口の通行証と、奥の管理権限は別のものだ。先ほどの調査は何を示していた？'],
 sideentry:['保守路の向こう','予備経路にたどり着いた。少し遠回りになるが、古い保守記録に区画の手掛かりが残る。'],
 discovery:['二本に分かれた線',`経路は資料庫とサービス網に分かれている。${m.asset}につながる中継点はどちらか。解析担当の記録を共有しよう。`],
 deadend:['反応のない区画','選んだ経路は展示用のコピーにつながっていた。先へ急ぐか、分岐点へ戻るか。警戒はまだ収まっていない。'],
 pivot:['境界を越える','目的の中継点を見つけた。別の区画へ移動するには、名前だけでなく接続の根拠が必要になる。'],
 credential:['鍵は誰のものか','入口の権限では次の区画に届かない。認証庫の架空ファイルに残る鍵カードと、権限範囲の対応を調べよう。'],
 privilege:['管理ゲート',`${m.org}の管理境界に到達した。${m.goal==='access'?'ここで対象区画の管理権限を得れば任務は完了する。':'この先にある保管庫へ進むには、対象区画の権限が必要だ。'}`],
 vault:['原本とよく似たもの',`${m.asset}を発見。ところが同じ名前のコピーが複数ある。侵入担当が持つ識別子と、解析担当が持つ原本の特徴を突き合わせよう。`],
 inspect:['細部が語る真実',`${m.twist} 名前だけでは決められない。識別情報を残して資料庫へ戻ろう。`],
 encrypt:['暗号化、最終判断',`${m.asset}の対象ブロックが見えている。指定範囲を暗号化状態にすれば演習は終了する。${m.goal==='double'?'回収済みデータの保全度も最後まで守ろう。':''}`],
 exfil:['最後の通信窓','データは確保した。あとは演習用の出口への転送を完了するだけ。警戒度が100になる前に、対象を届けよう。'],
 recovery:['まだ戻れる','ゲートが閉じ、退避点へ押し戻された。ここから経路を立て直せる。残り手数と警戒を見て、二人で次の判断を決めよう。']
 };return map[s.node]||['任務終了',''];}
export function clue(s,role){const m=scenario(s);if(role===0)return `侵入担当の記録：対象識別子は ${m.fingerprint}。入口の手掛かりは「${TECHNIQUES[m.entry][0]}」。表示名より区画IDを優先。`;
 const direct=m.difficulty<2?`有効な経路は「${m.route==='archive'?'資料庫の索引':'サービス網'}」。`:`対象の記録は${m.route==='archive'?'フォルダの階層と索引番号':'稼働中サービスの接続記録'}に結び付いている。`;
 return `解析担当の記録：${direct} ${m.twist}`;
}
export function vote(s,role,id){if(s.phase!=='play'||![0,1].includes(role))return s;const candidates=role===0?actions(s):supports(s);if(!candidates.some(x=>x.id===id&&!x.disabled))return s;return {...s,revision:s.revision+1,votes:s.votes.map((v,i)=>i===role?id:v)};}
export function canExecute(s){return s.phase==='play'&&s.votes.every(Boolean);}
function addEffect(s,e){const n={...s,flags:{...s.flags}};for(const [key,v] of Object.entries(e)){if(['trace','integrity','intel'].includes(key))n[key]+=v;else if(key==='shield')n.shield=v;else n.flags[key]=v;}return n;}
export function objectiveMet(s){const goal=scenario(s).goal;return goal==='collect'?s.flags.collected:goal==='exfil'?s.flags.collected&&s.flags.exfiltrated:goal==='encrypt'?s.flags.encrypted:goal==='access'?s.flags.admin:s.flags.collected&&s.flags.encrypted;}
export function execute(s){if(!canExecute(s))return s;const action=actions(s).find(x=>x.id===s.votes[0]),support=supports(s).find(x=>x.id===s.votes[1]);if(!action||action.disabled||!support||support.disabled)return s;
 let n=addEffect({...s,flags:{...s.flags},votes:[null,null]},support.effect);n.assist-=support.uses||0;let effect={...action.effect};if(n.shield&&effect.integrity<0)effect.integrity=Math.ceil(effect.integrity/3);n=addEffect(n,effect);n.shield=false;n.turns-=action.cost+support.cost;n.trace=Math.max(0,Math.min(100,n.trace));n.integrity=Math.max(0,Math.min(100,n.integrity));n.revision=s.revision+1;n.node=action.next;n.visited=[...new Set([...s.visited,action.next])];
 const record={step:s.log.length+1,node:s.node,action:action.label,support:support.label,tech:action.tech,trace:n.trace-s.trace,integrity:n.integrity-s.integrity,cost:action.cost+support.cost};n.log=[...s.log,record];
 const failure=n.flags.abort?'撤退を選択した。':n.trace>=100?'警戒度が100に達し、演習区画が封鎖された。':n.integrity<=0?'データの保全度を失い、任務を継続できなくなった。':action.next==='end'&&objectiveMet(n)&&n.integrity<60?'目標操作は終えたが、保全度が60未満のため完了を確認できなかった。':n.turns<0||n.turns===0&&!objectiveMet(n)?'残り手数を使い切った。':action.next==='end'&&!objectiveMet(n)?'必要な目標がそろっていない。':null;
 const success=!failure&&action.next==='end'&&objectiveMet(n);
 n.feedback={...record,text:failure||(success?scenario(s).epilogue:action.next==='deadend'?'予想と違う区画だった。経路の手掛かりを再確認しよう。':action.next==='recovery'?'境界に阻まれ退避した。警戒を下げて立て直せる。':`${action.label}を完了。${support.label}の支援を反映して、${NODES[action.next]}へ進める。`)};
 n.phase=success||failure?'ended':'feedback';n.ending=success?{success:true,grade:n.trace<=35&&n.integrity>=95?'S':n.trace<=60&&n.integrity>=80?'A':'B',text:scenario(s).epilogue}:failure?{success:false,grade:'RETRY',text:failure}:null;
 return n;
}
export function advance(s){return s.phase==='feedback'?{...s,phase:'play',revision:s.revision+1}:s;}
export function validState(s){return !!s&&s.version===1&&Number.isInteger(s.mission)&&s.mission>=1&&s.mission<=100&&typeof s.run==='string'&&s.run.length<=80&&Number.isSafeInteger(s.revision)&&s.revision>=0&&Object.hasOwn(NODES,s.node)&&['play','feedback','ended'].includes(s.phase)&&['turns','trace','integrity','intel','assist'].every(k=>Number.isFinite(s[k])&&s[k]>=-5&&s[k]<=1000)&&Array.isArray(s.votes)&&s.votes.length===2&&s.votes.every(x=>x===null||typeof x==='string'&&x.length<40)&&s.flags&&typeof s.flags==='object'&&Array.isArray(s.log)&&s.log.length<=80&&Array.isArray(s.visited)&&s.visited.every(x=>Object.hasOwn(NODES,x))&&JSON.stringify(s).length<50000;}
