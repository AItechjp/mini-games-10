// SPDX-License-Identifier: GPL-3.0-or-later
import * as E from './engines.mjs';
import * as R from './royal.mjs';
import {parseSfen} from './vendor/rules.mjs';
import '../gomoku-engine.js';
self.onmessage=({data})=>{try{let s=data.state,m;switch(data.kind){case 'gomoku':m=globalThis.GomokuRules.chooseMove(s);break;case 'othello':m=E.othelloAI(s);break;case 'go':m=E.goAI(s);break;case 'chess':s=R.createChess();s.pos.load(data.fen);m=R.chessAI(s);break;case 'shogi':s=R.createShogi();s.pos=parseSfen('standard',data.fen).unwrap();s.turn=2;m=R.shogiAI(s);break;}self.postMessage({id:data.id,move:m});}catch(e){self.postMessage({id:data.id,error:String(e)});}};
