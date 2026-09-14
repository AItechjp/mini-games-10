export const THEMES = [
 {name:'月影の王城',short:'古城',color:'#a3bdff',names:['月を待つ城','亡国の星環','王城の水晶雨','夜を渡る破片','月光の聖印','群星の城壁','静寂の双環','蒼き王冠','逆さの天球','最後の灯火']},
 {name:'紫晶の聖堂',short:'水晶',color:'#d4a0ff',names:['祈りの結晶','聖堂の星環','紫晶の雨','砕けた祈祷','封じられた聖印','聖者の星座','紫紺の双環','水晶の王冠','忘却の天球','残響の灯火']},
 {name:'灰燼の竜',short:'竜',color:'#ffab63',names:['竜の目覚め','火竜の星環','灰燼の水晶雨','竜鱗の残片','灼熱の聖印','竜座の誓い','業火の双環','灰の王冠','終焉の天球','不滅の灯火']},
 {name:'黒月の騎士',short:'騎士',color:'#c3d9ed',names:['誓いの騎士','黒月の星環','銀の水晶雨','剣誓の破片','騎士の聖印','無名の星座','銀月の双環','誓約の王冠','黒鉄の天球','旅路の灯火']},
 {name:'幽光の森',short:'森',color:'#77ffe0',names:['森のささやき','精霊の星環','翡翠の水晶雨','木霊の破片','森守の聖印','蛍火の星座','樹海の双環','精霊の王冠','古樹の天球','還り路の灯火']},
 {name:'星骸の門',short:'星界',color:'#a6a0ff',names:['星の門','星骸の星環','虚空の水晶雨','漂う星骸','次元の聖印','記憶の星座','境界の双環','虚無の王冠','異界の天球','遠き星の灯火']},
 {name:'深淵の幽霊船',short:'深海',color:'#79e7c5',names:['還らぬ航海','深淵の星環','海底の水晶雨','沈没の破片','幽船の聖印','航海者の星座','深海の双環','沈黙の王冠','忘れ潮の天球','船影の灯火']},
 {name:'氷蝕の宮殿',short:'氷',color:'#9feaff',names:['凍れる月','氷蝕の星環','氷宮の水晶雨','氷鏡の破片','霜夜の聖印','白夜の星座','氷河の双環','氷姫の王冠','零下の天球','冬の灯火']},
 {name:'紅蝕の玉座',short:'紅月',color:'#ff7c9b',names:['紅き玉座','紅蝕の星環','薔薇の水晶雨','血月の破片','薔薇の聖印','紅月の星座','深紅の双環','失楽の王冠','緋色の天球','王の灯火']},
 {name:'落日の天使',short:'天使',color:'#ffd699',names:['翼の記憶','天使の星環','金の水晶雨','翼の破片','落日の聖印','天上の星座','黄昏の双環','天使の王冠','赦しの天球','永遠の灯火']},
];
export const VARIANTS = [
 {name:'浮遊水晶',description:'画面の手前に漂う、光を受けた水晶。'},
 {name:'星環',description:'遠近の異なる軌道を描く、細い光の環。'},
 {name:'水晶雨',description:'奥から手前へ舞い降りる、水晶の雨。'},
 {name:'浮遊破片',description:'空間に静止する、大小の黒曜石の欠片。'},
 {name:'聖印',description:'重なる環と光の印がつくる、幻想的な奥行き。'},
 {name:'星座',description:'微細な光と結晶が広がる、立体の星図。'},
 {name:'双環',description:'交差する二つの光輪と、軌道を巡る結晶。'},
 {name:'王冠',description:'弧を描いて浮かぶ水晶が、光の冠をつくる。'},
 {name:'天球',description:'立体に組み合わされた光輪が、ゆっくり回る。'},
 {name:'灯火',description:'遠くに瞬く星と、手前を漂う光の粒子。'},
];
export const DESIGNS = THEMES.flatMap((theme,ti)=>VARIANTS.map((variant,vi)=>({
 id:ti*10+vi+1, theme:ti, variant:vi, name:theme.names[vi], world:theme.name,
 effect:variant.name, description:variant.description, color:theme.color, seed:1709+ti*239+vi*53,
 image:`/pixel-wallpapers/art/theme-${String(ti+1).padStart(2,'0')}.webp`,
 thumb:`/pixel-wallpapers/art/thumb-${String(ti+1).padStart(2,'0')}.webp`,
})));
