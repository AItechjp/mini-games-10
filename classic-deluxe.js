/* Offline tactical lessons. Each answer is evaluated by the same Gomoku rules. */
(() => {
  'use strict';
  const puzzles=[];
  const toIndex=(r,c)=>r*15+c;
  for(let type=0;type<3;type++)for(let pattern=0;pattern<4;pattern++)for(let rotation=0;rotation<3;rotation++){
    const board=Array(225).fill(0),anchor=[6+(pattern%2),6+Math.floor(pattern/2)];
    const point=(r,c)=>{for(let i=0;i<rotation;i++)[r,c]=[c,-r];return toIndex(anchor[0]+r,anchor[1]+c);};
    const put=(color,points)=>points.forEach(([r,c])=>board[point(r,c)]=color);
    let title,instruction;
    if(type===0){const gap=pattern+1;put(1,Array.from({length:5},(_,i)=>[0,i-2]).filter((_,i)=>i!==gap));put(2,[[-2,-2],[-2,0],[2,2],[3,1]]);title='五連を完成';instruction='黒番。1手で五連を完成させよう。';}
    else if(type===1){put(2,[[0,-2],[0,-1],[0,0],[0,1]]);put(1,[[0,-3],[-3,-2],[-2,2],[2,1]]);title='必勝手を防ぐ';instruction='黒番。白が次の1手で勝てる場所をふさごう。';}
    else{put(1,[[0,-3],[0,-2],[0,-1],[-3,0],[-2,0],[-1,0]]);put(2,[[-3,-3],[2,2],[2,-2],[-2,2],[3,3],[-3,2]]);title='二つの四を作る';instruction='黒番。次に五連を作れる場所を2か所以上に増やそう。';}
    puzzles.push(Object.freeze({id:`t${type}-${pattern}-${rotation}`,type,title,instruction,board:Object.freeze(board)}));
  }
  function winningMoves(board,color){const moves=[];for(let i=0;i<225;i++)if(!board[i]){board[i]=color;if(GomokuRules.lineAt(board,i).length)moves.push(i);board[i]=0;}return moves;}
  function solved(problem,state,index){
    if(problem.type===0)return state.winner===0;
    if(problem.type===1)return winningMoves([...problem.board],2).includes(index)&&winningMoves([...state.board],2).length===0;
    return state.winner!==0&&winningMoves([...state.board],1).length>=2;
  }
  function solution(problem){for(let i=0;i<225;i++)if(!problem.board[i]){const s=GomokuRules.create();s.board=[...problem.board];GomokuRules.move(s,i,0);if(solved(problem,s,i))return i;}return -1;}
  globalThis.ClassicDeluxe=Object.freeze({puzzles:Object.freeze(puzzles),solved,solution,winningMoves});
})();
