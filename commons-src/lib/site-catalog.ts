import {categories, engineNames, findTool} from './catalog';

export type SiteEntry = {
  id:string;
  name:string;
  description:string;
  href:string;
  label:string;
  color:string;
  keywords:string;
  toolId?:string;
  actionLabel?:string;
};

function roomSite(id:string):SiteEntry {
  const tool=findTool(id)!;
  return {
    id, toolId:id, name:tool.name, description:tool.description,
    href:`/commons/tools/${id}/`, label:engineNames[tool.engine],
    color:categories.find(category=>category.id===tool.category)!.color,
    keywords:[tool.hint,...tool.labels].join(' '),
  };
}

// Keep saved room definitions in catalog.ts; only these entries appear in the hub.
export const sites:SiteEntry[] = [
  roomSite('whiteboard'),
  {
    id:'yobi', name:'予備試験対策集', description:'短答の過去問演習と、論文の学習・起案。',
    href:'/commons/study/', label:'短答・論文', color:'#16826c',
    keywords:'学習 法律 司法試験 予備試験 過去問 短答 論文',
  },
  roomSite('chat'),
  {id:'hotel-search',name:'全国ホテル検索',description:'宿泊日・人数を指定し、取得した宿泊プランを料金順に比較。',href:'/commons/hotels/',label:'全国・宿泊日',color:'#926227',keywords:'ホテル 旅館 宿泊 旅行 全国 料金 安い 日付',actionLabel:'ホテルを探す'},
  {id:'rental-search',name:'岐阜・愛知の賃貸検索',description:'駅・徒歩分数・間取りを指定して、募集中の物件を検索。',href:'/commons/rentals/',label:'岐阜・愛知',color:'#146b60',keywords:'賃貸 不動産 マンション アパート 間取り 駅 徒歩 岐阜 愛知 新鵜沼',actionLabel:'賃貸を探す'},
  ...[
    {id:'supermarkets',name:'スーパー',color:'#287451'},
    {id:'saunas',name:'サウナ',color:'#b35729'},
    {id:'sento',name:'銭湯',color:'#217b91'},
    {id:'fishmongers',name:'魚屋',color:'#365b9c'},
  ].map(({id,name,color})=>({id:'local-'+id,name:`岐阜・愛知の営業中${name}`,description:`県・市町村・店名で絞り込み。営業時間と情報源を確認し、地図や電話へ。`,href:`/commons/local/${id}/`,label:'岐阜・愛知',color,keywords:`岐阜 愛知 ${name} 営業中 今 店舗 一覧 買い物 温浴`,actionLabel:'営業中の一覧を見る'})),
  {
    id:'ramen', name:'岐阜の営業中ラーメン', description:'閲覧時点の営業時間でお店を確認。市町村で絞り込み、地図や電話へ。',
    href:'/commons/ramen/', label:'岐阜・グルメ', color:'#b64026',
    keywords:'岐阜 ラーメン 営業中 深夜 今 食事 各務原 大垣 高山',
    actionLabel:'営業中の店を見る',
  },
  {
    id:'sauna-now', name:'全国の営業中サウナ', description:'いまの営業時間を確認。47都道府県で絞り込み、取得した施設を全件表示。',
    href:'/commons/sauna/', label:'全国・サウナ', color:'#087d73',
    keywords:'全国 都道府県 サウナ 営業中 深夜 今 温泉 銭湯 スパ 岐阜 愛知',
    actionLabel:'サウナ一覧を見る',
  },
  {
    id:'restaurant-openings',name:'ラーメン屋オープン予定',description:'今日から15日間にオープンするラーメン店を確認。',
    href:'/commons/openings/ramen/',label:'これから15日',color:'#b34618',keywords:'ラーメン らーめん 中華そば つけ麺 新店 オープン 開店予定 岐阜 愛知 全国',actionLabel:'開店予定を見る',
  },
  {
    id:'sauna-openings',name:'サウナ開業情報',description:'2か月前から2か月後までのサウナ開業・新設情報。',
    href:'/commons/openings/sauna/',label:'前後2か月',color:'#107368',keywords:'サウナ 新設 開業 オープン予定 温浴 岐阜 愛知 全国',actionLabel:'開業情報を見る',
  },
  {
    id:'camera', name:'カメラ', description:'iPhone・Androidで撮影。撮影音を付けず、写真を端末に保存。',
    href:'/commons/camera/', label:'撮影・写真保存', color:'#607b32',
    keywords:'SHIZUKA カメラ 写真 撮影 無音 保存 iPhone Safari Android',
    actionLabel:'カメラを開く',
  },
  {
    id:'weather', name:'岐阜の天気', description:'岐阜・各務原など9地点の天気。時間別予報と7日間の週間予報。',
    href:'/commons/weather/', label:'天気・降水確率', color:'#2762b8',
    keywords:'岐阜 天気 天気予報 気温 雨 降水確率 各務原 大垣 関 多治見 中津川 郡上 下呂 高山',
    actionLabel:'天気を見る',
  },
  {
    id:'bitcoin',name:'ビットコイン送金マップ',description:'アドレス・取引IDから送金先を図で確認。次の送金もたどれます。',
    href:'/commons/bitcoin/',label:'送金先の可視化',color:'#b76513',keywords:'Bitcoin BTC ビットコイン 送金 追跡 アドレス 取引 ブロックチェーン',actionLabel:'送金マップを開く',
  },
  {
    id:'onion', name:'Onion URL確認', description:'公開onion URLの応答状況・最終測定時刻を確認。毎日0時にデータ更新。',
    href:'/commons/onion/', label:'URL・接続状況', color:'#405c9d',
    keywords:'Tor オニオン onion ダークウェブ URL 稼働 接続 生存 確認',
    actionLabel:'URLを確認する',
  },
  {id:'cyber-news',name:'サイバー攻撃ニュース',description:'国内外の公開RSSを日本語で読む。直近72時間の攻撃・脆弱性・調査情報。',href:'/commons/cyber-news/',label:'日本語・1分更新',color:'#2563eb',keywords:'サイバー攻撃 セキュリティ ニュース RSS 翻訳 Dark Reading 脆弱性 ランサムウェア',actionLabel:'ニュースを読む'},
  {id:'government-network',name:'行政機関・独立行政法人の関係図',description:'府省・外局と独立行政法人の主たる所管を、公式資料付きの図で確認。',href:'/commons/government-network/',label:'組織・所管関係',color:'#126d85',keywords:'行政機関 独立行政法人 省庁 所管 親子 関係図 ネットワーク',actionLabel:'関係図を開く'},
  {id:'reemployment-network',name:'官僚の再就職先ネットワーク',description:'公表資料にある退職時の所属・人物・再就職先をたどる。収録範囲を明示。',href:'/commons/reemployment-network/',label:'公表資料・再就職',color:'#795b98',keywords:'天下り 官僚 キャリア 再就職 企業 団体 人事 関係図',actionLabel:'再就職先を見る'},
  {id:'law-watch',name:'法律・国会ウォッチ',description:'立法・法改正・国会会議録を公的情報から横断確認。',href:'/commons/law/',label:'法律・国会',color:'#225be4',keywords:'法律 法改正 立法 国会 議案 施行 公布 パブリックコメント',actionLabel:'法律の動きを見る'},
  {id:'government-documents',name:'行政資料ナビ',description:'白書・審議会・検討会資料と行政機関の公式リンクを横断検索。',href:'/commons/documents/',label:'行政・公開資料',color:'#285b78',keywords:'行政 省庁 白書 検討会 審議会 報告書 政府 独立行政法人 自治体',actionLabel:'資料を探す'},
  {id:'manga-links',name:'無料漫画リンク',description:'無料公開を確認した漫画の新着話を検索。出版社・無料巻・作者投稿の36サイトからも探せます。',href:'/commons/manga/',label:'無料公開・5分巡回',color:'#205ce3',keywords:'漫画 マンガ コミック 無料 日本語 読み放題 無料巻 作者投稿 公式 URL 収集 新着 ジャンプ サンデー',actionLabel:'無料の漫画を探す'},
  {id:'mtg-flavor',name:'MTG フレーバー書庫',description:'カード画像とフレーバーテキストを、言語・収録セット・再録版ごとに読む。',href:'/commons/mtg-flavor/',label:'MTG・カードの物語',color:'#9b6a24',keywords:'マジック MTG Magic フレーバーテキスト カード 画像 再録 日本語 英語',actionLabel:'フレーバーを読む'},
  {id:'duel-masters-flavor',name:'デュエマ フレーバー書庫',description:'公式掲載のカード画像とフレーバーを読む。文明・収録セット・本文で検索。',href:'/commons/duel-masters-flavor/',label:'デュエマ・公式掲載版',color:'#7955a7',keywords:'デュエル マスターズ デュエマ DM フレーバーテキスト カード 画像 文明 再録',actionLabel:'フレーバーを読む'},
  {id:'yugioh-flavor',name:'遊戯王 フレーバー書庫',description:'通常モンスターの物語とカード画像を読む。効果・別イラスト・収録セットも検索。',href:'/commons/yugioh-flavor/',label:'遊戯王OCG・カードの物語',color:'#9a742d',keywords:'遊戯王 Yu-Gi-Oh OCG フレーバーテキスト 通常モンスター カード 画像 効果 ペンデュラム',actionLabel:'フレーバーを読む'},
];

export const siteGroups = [
  {id:'web',name:'ウェブアプリ',numbers:[1,3,14]},
  {id:'study',name:'勉強',numbers:[2]},
  {id:'realtime',name:'リアルタイム検索',numbers:[4,5,6,7,8,9,10,11,12,13,15]},
  {id:'security',name:'セキュリティ',numbers:[16,17,18]},
  {id:'government',name:'行政・公共情報',numbers:[19,20]},
].map(group=>({...group,sites:group.numbers.map(number=>sites[number-1])}));
const officialInfoSites=sites.filter(site=>['law-watch','government-documents'].includes(site.id));
const governmentGroup=siteGroups.find(group=>group.id==='government');
if(governmentGroup)governmentGroup.sites.push(...officialInfoSites);
else siteGroups.push({id:'public-information',name:'法律・行政情報',numbers:[],sites:officialInfoSites});

siteGroups.find(group=>group.id==='security')?.sites.push(...sites.filter(site=>site.id==='manga-links'));

siteGroups.push({id:'cards',name:'カードの物語',numbers:[],sites:sites.filter(site=>['mtg-flavor','duel-masters-flavor','yugioh-flavor'].includes(site.id))});
const usageSite:SiteEntry={id:'usage-dashboard',name:'使用量と無料枠',description:'Supabase・GitHubの使用量と残り容量。実測値・更新日時・未取得項目を確認。',href:'/commons/usage/',label:'運用・無料枠',color:'#3455ee',keywords:'技術スタック ダッシュボード 使用量 残量 無料枠 容量 Supabase GitHub Cloudflare',actionLabel:'ダッシュボードを開く'};
sites.push(usageSite);
siteGroups.push({id:'operations',name:'サイト運用',numbers:[sites.length],sites:[usageSite]});

export const listedToolIds = new Set(sites.flatMap(site=>site.toolId?[site.toolId]:[]));
export const studyPages = [
  {name:'短答ノート',description:'過去問演習、自動採点、間違えた問題の復習。',href:'/yobi-quiz.html'},
  {name:'論文ノート',description:'科目別の学習、公式過去問、答案構成・起案。',href:'/yobi-ronbun.html'},
];
