export const THEMES = [
 {name:'月影の王城',short:'古城',color:'#a3bdff',names:['月を待つ城']},
 {name:'紫晶の聖堂',short:'水晶',color:'#d4a0ff',names:['祈りの結晶']},
 {name:'灰燼の竜',short:'竜',color:'#ffab63',names:['竜の目覚め']},
 {name:'黒月の騎士',short:'騎士',color:'#c3d9ed',names:['誓いの騎士']},
 {name:'幽光の森',short:'森',color:'#77ffe0',names:['森のささやき']},
 {name:'星骸の門',short:'星界',color:'#a6a0ff',names:['星の門']},
 {name:'深淵の幽霊船',short:'深海',color:'#79e7c5',names:['還らぬ航海']},
 {name:'氷蝕の宮殿',short:'氷',color:'#9feaff',names:['凍れる月']},
 {name:'紅蝕の玉座',short:'紅月',color:'#ff7c9b',names:['紅き玉座']},
 {name:'落日の天使',short:'天使',color:'#ffd699',names:['翼の記憶']},
];
export const VARIANTS = [
 {name:'月光',description:'描かれた世界を、やわらかな月明かりがゆっくり照らします。'},
 {name:'流星',description:'夜空を横切る流星と、瞬く小さな星のアニメーション。'},
 {name:'霧',description:'幾重にも重なる霧が流れ、イラストが静かに揺れます。'},
 {name:'蛍火',description:'手描きの光の粒がふわりと舞い、明滅を繰り返します。'},
 {name:'雨',description:'細い雨が斜めに流れ、濡れた景色に光がにじみます。'},
 {name:'花びら',description:'淡い花びらが風に乗って、くるりと舞い落ちます。'},
 {name:'魔法陣',description:'描かれた魔法陣がゆっくり巡り、光の紋様が呼吸します。'},
 {name:'炎',description:'揺れる炎の明かりと、空に舞い上がる火の粉。'},
 {name:'雪',description:'大小の雪片がゆっくり降り、白い光が景色を包みます。'},
 {name:'オーロラ',description:'色の帯が空をゆらめき、幻想的な光が広がります。'},
];
export const DESIGNS = THEMES.flatMap((theme,ti)=>VARIANTS.map((variant,vi)=>({
 id:ti*10+vi+1, theme:ti, variant:vi, name:vi===0?theme.names[0]:`${theme.name}・${variant.name}`, world:theme.name,
 effect:variant.name, description:variant.description, color:theme.color, seed:1709+ti*239+vi*53,
 image:`/pixel-wallpapers/art/theme-${String(ti+1).padStart(2,'0')}.webp?v=2`,
 thumb:`/pixel-wallpapers/art/thumb-${String(ti+1).padStart(2,'0')}.webp?v=2`,
})));
