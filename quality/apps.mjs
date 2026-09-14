// This registry describes the apps actually linked by the public catalogs.
const game=(id,name,path,help,status)=>({id,name,path,kind:'record',help,status,
  trouble:'動かないときは操作説明と通信状態を確認してください。'+(['black-site','skybreak','aether','daifugo'].includes(id)?'オンライン対戦の制限時間は、このパネルを開いている間も進みます。':'')+'記録はこの画面に表示されている内容の控えです。'});
const directory=(id,name,path,selector,help)=>({id,name,path,kind:'compare',selector,help,
  trouble:'結果がないときは絞り込みを減らし、取得日時と情報源を確認してください。比較候補は選んだ時点の表示内容です。最新の料金・営業状況は掲載元で確認してください。'});
export const apps=[
  game('black-site','BLACK SITE','/game23.html','移動と照準を別々に操作し、射撃ボタンで攻撃します。協力プレイは同じルームに参加してください。','#hud-area,#hud-life,#hud-goal,#coop-status,#stage-title'),
  game('skybreak','SKYBREAK RIVALS','/smash.html','ファイターとステージを選び、攻撃・ジャンプ・シールドを使い分けます。対戦前に操作説明を確認できます。','#p1-name,#p1-damage,#p1-stocks,#p2-name,#p2-damage,#p2-stocks,#announcement,#result-title'),
  game('aether','AETHER DUEL','@aether','40枚のデッキを選び、手札交換後に対戦を始めます。カードの詳細を確認してから場や対象を選びます。','.round-info,.leader-name,.leader-hp,.action-note,.result-content,.history'),
  game('quick-hop','QUICK HOP','/quick-hop/','左右移動とジャンプでコインを集め、中間地点を経てゴールへ。Pキーで一時停止します。','#coins,#camp,#falls,#tag'),
  game('startrail','STARTRAIL','/startrail/','左右移動とジャンプで5つの区間を進みます。敵は上から踏めます。ダッシュ設定で移動速度を選べます。','#health,#score,#zone,#banner,#result'),
  game('daifugo','大富豪','/classic.html?game=daifugo','場より強い同じ枚数のカードを選んで出します。出せないときはパス。ルール設定を開始前に確認します。','#turn-label,#status-label,#game-message,#connection-status'),
  game('old-maid','ババ抜き','/babanuki.html','相手の伏せた札から1枚引き、同じ数字のペアを捨てます。最後にジョーカーが残った人の負けです。','#turn-label,#instruction,#own-count,#pair-count,#move-count'),
  game('memory','神経衰弱','/trump/?game=memory','2枚めくって同じ数字なら獲得。違う数字なら相手の番です。12組の獲得数で競います。','#turn-label,#instruction,#score-you,#score-cpu,#moves'),
  game('speed','スピード','/trump/?game=speed','場札の前後の数字を出します。両方の場に出せるときは場札も選択。双方出せないときは場札を入れ替えます。','#turn-label,#instruction,#score-you,#score-cpu,#moves'),
  ...[['gomoku','五目並べ','空いている交点を選び、縦・横・斜めに5つ以上並べます。'],['shogi','将棋','駒を選んで移動先を指定します。持ち駒からの打ち込みと成りの選択にも対応します。'],['go','囲碁','9路盤で石を囲みます。双方のパス後に死に石を確認し、得点を確定します。'],['othello','オセロ','相手の石をはさめるマスに置きます。置ける場所がないときは自動でパスします。'],['chess','チェス','白が先手です。駒を選んで移動先を指定し、ポーンの昇格時は駒を選びます。'],['monopoly','モノポリー','サイコロ・土地購入・競売・建設を使い分ける24マスの短時間版です。'],['life','人生ゲーム','仕事を選び、ルーレットとイベントで36マスを進むオリジナル短時間版です。']].map(([id,name,help])=>game(id,name,'/board-games/?game='+id,help,'#turn-badge,#status,#round,#score1,#score2')),
  {id:'whiteboard',name:'ホワイトボード',path:'/commons/tools/whiteboard/',kind:'canvas',help:'ルームを作成・参加して、ペン・付箋・文字を使います。Ctrl / ⌘ + Zで自分の描画を戻せます。',trouble:'未保存の描画があるときは再送するか控えを書き出してください。共有済みの描画はルームに残ります。画像出力はキャンバスのツールバーから行います。'},
  {...game('study','予備試験対策集','/commons/study/','短答は公式過去問の演習、論文は答案構成・起案を選びます。法改正と出題時の法令は公式資料で確認してください。','h1,#quiz-question,.question-text,.essay-title,#study-status'),aliases:['/yobi-quiz.html','/yobi-ronbun.html']},
  {...game('chat','チャット','/commons/tools/chat/','招待リンクで同じルームに参加します。Enterで改行、Ctrl / ⌘ + Enterで送信。返信・検索・未読へ移動を利用できます。','.chat-date,.message-meta,.message-text'),trouble:'送信が終わるまで画面を閉じず、失敗時は下書きから再試行してください。記録ボタンは画面に読み込まれた会話だけを、このタブ内に控えます。'},
  directory('hotels','全国ホテル検索','/commons/hotels/','#live-list article','宿泊日・人数・地域を指定して検索し、取得した宿泊プランを料金順に比較します。'),
  directory('rentals','岐阜・愛知の賃貸検索','/commons/rentals/','#live-list article','駅・徒歩・間取り・築年数を指定します。家賃に管理費や初期費用が含まれるか掲載元で確認します。'),
  ...[['supermarkets','スーパー'],['saunas','サウナ'],['sento','銭湯'],['fishmongers','魚屋']].map(([id,name])=>directory('local-'+id,'岐阜・愛知の営業中'+name,'/commons/local/'+id+'/','.local-store,.verified-list article','県・市町村・店名で絞り込み、公式本文の確認時刻と営業時間を確認します。最終受付や休館日も確認できます。')),
  directory('ramen','岐阜の営業中ラーメン','/commons/ramen/','[data-quality-result],.verified-list article','地域・店名で絞り込み、公式営業時間内・時間外・受付終了を確認します。出典の本文と最終受付も確認できます。'),
  directory('sauna','全国の営業中サウナ','/commons/sauna/','[data-facility-id],.verified-list article','都道府県と営業状況を選びます。施設全体の営業時間とサウナの利用時間が異なる場合があります。'),
  directory('ramen-openings','ラーメン屋オープン予定','/commons/openings/ramen/','.opening-row','今日から15日間の開店予定を地域別に確認します。日付の確度と発表元を確認してください。'),
  directory('sauna-openings','サウナ開業情報','/commons/openings/sauna/','.opening-row','2か月前から2か月後までの開業情報を確認します。予定変更の有無を発表元で確認してください。'),
  {id:'camera',name:'カメラ',path:'/commons/camera/',kind:'camera',help:'カメラを開始し、前面・背面を選んで撮影します。端末に応じてダウンロードまたは共有から写真を保存します。',trouble:'許可を拒否した場合はブラウザのサイト設定を確認し、再度開始してください。撮影画像はサーバーへ送信しません。'},
  directory('weather','岐阜の天気','/commons/weather/','.wx-hour','地域を選び、時間別の気温・雨・風と週間予報を確認します。防災情報は気象庁の案内へ進みます。'),
  directory('bitcoin','ビットコイン送金マップ','/commons/bitcoin/','.btc-output-node','アドレスまたは取引IDを入力し、出力を選んで詳細を見ます。出力にはお釣りも含まれ、持ち主を特定する情報ではありません。'),
  directory('onion','Onion URL確認','/commons/onion/','[data-quality-result]','公開URLの測定結果と測定日時を確認します。未測定・応答なし・応答ありを区別し、更新日も確認します。'),
];
export function appFor(url,aether=false){
  if(aether)return apps.find(a=>a.id==='aether');
  const u=new URL(url,'https://aitechd.com');
  if(u.pathname==='/commons/r/'||u.pathname.startsWith('/commons/r/'))return null;
  return apps.find(a=>{
    if(a.path==='@aether')return false;
    const p=new URL(a.path,'https://aitechd.com');
    return (p.pathname===u.pathname&&[...p.searchParams].every(([k,v])=>u.searchParams.get(k)===v||!u.searchParams.has(k)&&v==='gomoku'))||a.aliases?.includes(u.pathname);
  });
}
export const commonImprovements=[
  '作業画面を離れずに操作ガイドを確認',
  'アプリに合わせた復旧・注意点を表示',
  '説明文と操作ラベルの文字を3段階で拡大',
  '説明文の行間を広げて読みやすくする',
  '画面の文字・操作部を高コントラストに切替',
  '画面UIのアニメーションを抑制',
  '指で押す操作ボタンを大きくする設定',
  'キーボードで選択中の操作を輪郭で強調',
  '画面設定を端末内に保存して次回復元',
  '同じサイトの別タブにも画面設定を同期',
  '設定が保存できない場合に通知し利用を継続',
  'ゲーム・ルームのデータを消さず画面設定だけ初期化',
  'オフラインを画面内で通知',
  '接続復帰を通知し作業中の画面を保持',
  'Alt＋/で操作パネルを開き、閉じた後は元の操作へ戻る',
];
export function specificImprovements(app){
  if(app.kind==='compare')return ['表示中の結果から比較候補を最大8件選択','選択時刻付きの候補比較表を表示','候補を1件ずつ解除して比較を整理','候補の表示内容と情報源リンクをまとめてコピー','比較表をUTF-8テキストで保存'];
  if(app.kind==='canvas')return ['キャンバスをPNG画像として保存','PNGの背景を白・透明から選択','PNG出力を標準・2倍解像度から選択','PNG画像をクリップボードへコピー','画像生成中の多重操作を防ぎ失敗時に案内'];
  if(app.kind==='camera')return ['3秒・10秒のセルフタイマー撮影','撮影までの残秒数を表示','タイマーを取り消して撮影を中止','構図合わせ用の三分割グリッド','入力欄以外でSpaceキーから撮影'];
  return ['現在画面に表示された対局・学習・会話の状況を手動記録','このタブでの表示記録を最大50件保持','振り返り用メモを記録に添付','表示記録とメモをまとめてコピー','記録日時付きの振り返りをテキスト保存'];
}
