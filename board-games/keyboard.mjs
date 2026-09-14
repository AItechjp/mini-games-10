// A board is one Tab stop. Arrow keys move within it without changing the game.
export function nextCell(index,key,size,ctrl=false){
  const row=Math.floor(index/size),col=index%size;
  if(key==='Home')return ctrl?0:row*size;
  if(key==='End')return ctrl?size*size-1:row*size+size-1;
  if(key==='ArrowLeft')return row*size+Math.max(0,col-1);
  if(key==='ArrowRight')return row*size+Math.min(size-1,col+1);
  if(key==='ArrowUp')return Math.max(0,row-1)*size+col;
  if(key==='ArrowDown')return Math.min(size-1,row+1)*size+col;
  return index;
}
export function installBoardKeyboard(board){
  let cursor=0;
  board.tabIndex=0;
  board.setAttribute('aria-label','盤面');
  board.addEventListener('focusin',event=>{if(event.target.matches('button[data-index]')){cursor=Number(event.target.dataset.index);sync();}});
  board.addEventListener('keydown',event=>{
    const cells=[...board.querySelectorAll('button[data-index]')];
    if(!cells.length||event.altKey||event.metaKey||event.isComposing||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    cursor=nextCell(cursor,event.key,Math.sqrt(cells.length),event.ctrlKey);sync();
    if(!cells[cursor]?.disabled)cells[cursor]?.focus({preventScroll:true});
  });
  function sync(){const cells=[...board.querySelectorAll('button[data-index]')];cursor=Math.min(cursor,Math.max(0,cells.length-1));cells.forEach((cell,i)=>cell.tabIndex=i===cursor?0:-1);board.tabIndex=cells[cursor]&&!cells[cursor].disabled?-1:0;board.setAttribute('aria-label',cells.length?'盤面。矢印キーで移動、EnterかSpaceで選択。':'盤面。進行は操作ボタンで行います。');}
  return {before(){const active=document.activeElement;return board.contains(active)?{index:active.dataset.index??cursor}:null;},after(focus){sync();if(focus){cursor=Number(focus.index);sync();const target=board.querySelector(`[data-index="${cursor}"]`);(target&&!target.disabled?target:board).focus({preventScroll:true});}}};
}
