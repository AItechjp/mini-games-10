export const games = {
  onepiece: {title:'ワンピースカード図鑑',short:'ワンピース',path:'onepiece-cards',eyebrow:'ONE PIECE CARD GAME',color:'#f0b768',source:'https://www.onepiece-cardgame.com/cardlist/',description:'カード画像と効果を読む。収録商品・カード名から探せます。',coverage:'ONE PIECEカードゲーム公式検索の掲載カードが対象です。パラレル・再録は別の収録版として表示します。独立したフレーバー欄の代わりに、カードの効果テキストを表示します。',rights:'©尾田栄一郎／集英社 ©尾田栄一郎／集英社・フジテレビ・東映アニメーション'},
  pokemon: {title:'ポケモンカード図鑑',short:'ポケモン',path:'pokemon-cards',eyebrow:'POKÉMON CARD GAME',color:'#f4d954',source:'https://www.pokemon-card.com/card-search/',description:'カード画像と説明を読む。ポケモンの名前・収録商品から探せます。',coverage:'ポケモンカードゲーム公式検索に掲載された日本語版が対象です。公式検索未収録の旧裏面などは含みません。説明文のないカードは、ワザ・特性・効果を表示します。',rights:'©Pokémon. ©Nintendo/Creatures Inc./GAME FREAK inc.'},
  zx: {title:'Z/X カード図鑑',short:'Z/X',path:'zx-cards',eyebrow:'ZILLIONS OF ENEMY X',color:'#c2a4ff',source:'https://www.zxtcg.com/card/',description:'カード画像とフレーバーを読む。カード名・収録商品から探せます。',coverage:'Z/X公式検索に掲載されたカードが対象です。フレーバーテキストと能力は区別して表示します。再録・別イラストは公式検索の収録版に従います。',rights:'©BROCCOLI / Nippon Ichi Software, Inc.'},
};
export function safeTCGURL(value) {
  try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&['www.onepiece-cardgame.com','www.pokemon-card.com','www.zxtcg.com'].includes(u.hostname)?u.href:'';}catch{return '';}
}
export function validPage(value) {const n=Number(value);return Number.isInteger(n)&&n>0?Math.min(n,10000):1;}
