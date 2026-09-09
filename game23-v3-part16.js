/* GAME 23 — vivid full-body class colors */
const P16_CLASS_COLORS={
  zombie:0xff3030,      // 赤
  runner:0x2f7bff,      // 青
  crawler:0xffdc2f,     // 黄
  dog:0x39d353,         // 緑
  licker:0xa855f7,      // 紫
  fat:0x22d3ee,         // 水色
  spitter:0x84e01f,     // 黄緑
  screamer:0xff4fb8,    // ピンク
  stalker:0xff8a24,     // オレンジ
  charger:0xf4f4f4      // 白
};
for(const [key,color] of Object.entries(P16_CLASS_COLORS)){
  if(P14_TYPES[key])P14_TYPES[key].color=color;
  const eye=key==='charger'?0xff3333:key==='crawler'?0x111111:0xffffee;
  const mouth=key==='charger'?0x202020:0x4b1018;
  P13_TINT[key]={body:color,head:color,arm:color,leg:color,bone:color,eyes:eye,mouth};
}
/* Force a refresh for any enemy instances already allocated during reconnect/sync. */
try{
  for(const e of state.enemies.values()){if(!e.boss)e._p13Tint='';}
  p13TintAll?.();
}catch{}
