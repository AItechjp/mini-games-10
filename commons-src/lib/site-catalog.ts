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
    href:'/commons/openings/ramen',label:'これから15日',color:'#b34618',keywords:'ラーメン らーめん 中華そば つけ麺 新店 オープン 開店予定 岐阜 愛知 全国',actionLabel:'開店予定を見る',
  },
  {
    id:'sauna-openings',name:'サウナ開業情報',description:'2か月前から2か月後までのサウナ開業・新設情報。',
    href:'/commons/openings/sauna',label:'前後2か月',color:'#107368',keywords:'サウナ 新設 開業 オープン予定 温浴 岐阜 愛知 全国',actionLabel:'開業情報を見る',
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
];

export const listedToolIds = new Set(sites.flatMap(site=>site.toolId?[site.toolId]:[]));
export const studyPages = [
  {name:'短答ノート',description:'過去問演習、自動採点、間違えた問題の復習。',href:'/yobi-quiz.html'},
  {name:'論文ノート',description:'科目別の学習、公式過去問、答案構成・起案。',href:'/yobi-ronbun.html'},
];
