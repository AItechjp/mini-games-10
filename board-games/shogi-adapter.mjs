// AITECH's adapter for the MIT-licensed tsshogi library.
// Coordinates and plain move records stay serializable for the existing CPU worker.
import {Position, Square, Color, InitialPositionSFEN, PieceType} from 'tsshogi';

const roles = {promPawn:'tokin',promLance:'promotedlance',promKnight:'promotedknight',promSilver:'promotedsilver'};
const handRoles = ['pawn','lance','knight','silver','gold','bishop','rook'];
const dropLetters = {pawn:'P',lance:'L',knight:'N',silver:'S',gold:'G',bishop:'B',rook:'R'};
const colorName = c => c === Color.BLACK ? 'sente' : 'gote';
const nativeColor = c => c === 'sente' ? Color.BLACK : Color.WHITE;
const validSquare = i => Number.isInteger(i) && i >= 0 && i < 81;
export const parseSquareName = s => Square.newByUSI(s)?.index;
export const makeSquareName = i => validSquare(i) ? Square.newByIndex(i).usi : undefined;
export function makeUsi(move) {
  return (move.role ? `${dropLetters[move.role]}*` : makeSquareName(move.from)) + makeSquareName(move.to) + (move.promotion ? '+' : '');
}
export const initialSfen = variant => {
  if (variant !== 'standard') throw new Error('Unsupported shogi variant');
  return InitialPositionSFEN.STANDARD;
};
export const makeSfen = p => p.native.getSFEN(p.ply);
export function parseSfen(variant, sfen) {
  return {unwrap() {
    if (variant !== 'standard') throw new Error('Unsupported shogi variant');
    const p = Position.newBySFEN(sfen);
    if (!p) throw new Error('Invalid SFEN');
    return new ShogiPosition(p, Number(sfen.trim().split(/\s+/)[3]) || 1);
  }};
}

class ShogiPosition {
  constructor(position, ply = 1) { this.native = position; this.ply = ply; }
  get turn() { return colorName(this.native.color); }
  get board() {
    return new Map(this.native.board.listNonEmptySquares().map(sq => {
      const p = this.native.board.at(sq);
      return [sq.index, {role:roles[p.type] || p.type, color:colorName(p.color)}];
    }));
  }
  get hands() {
    return {color:color=>handRoles.map(role=>[role,this.native.hand(nativeColor(color)).count(role)])};
  }
  toNative(move) {
    if (!move || !validSquare(move.to) || (move.role ? !handRoles.includes(move.role) : !validSquare(move.from))) return null;
    if (move.role && move.promotion) return null;
    const m = this.native.createMove(move.role || Square.newByIndex(move.from), Square.newByIndex(move.to));
    return m && move.promotion ? m.withPromote() : m;
  }
  isLegal(move) {
    const m = this.toNative(move);
    // Kings are never captured; checkmate ends the game before a king capture.
    return !!m && m.capturedPieceType !== PieceType.KING && this.native.isValidMove(m);
  }
  play(move) {
    const m = this.toNative(move);
    if (!m || m.capturedPieceType === PieceType.KING || !this.native.doMove(m)) throw new Error('Illegal shogi move');
    this.ply++;
  }
  clone() { return new ShogiPosition(this.native.clone(), this.ply); }
  isCheck() { return this.native.checked; }
  *moveDests(from) {
    if (!validSquare(from)) return;
    const piece = this.native.board.at(Square.newByIndex(from));
    if (!piece || piece.color !== this.native.color) return;
    const forward = piece.color === Color.BLACK ? -1 : 1;
    const type = roles[piece.type] || piece.type;
    const row = Math.floor(from / 9), col = from % 9;
    let steps = [], rays = [];
    const diagonal = [[-1,-1],[-1,1],[1,-1],[1,1]];
    const straight = [[-1,0],[1,0],[0,-1],[0,1]];
    switch(type) {
      case 'pawn': steps = [[forward,0]]; break;
      case 'lance': rays = [[forward,0]]; break;
      case 'knight': steps = [[2*forward,-1],[2*forward,1]]; break;
      case 'silver': steps = [[forward,-1],[forward,0],[forward,1],[-forward,-1],[-forward,1]]; break;
      case 'gold': case 'tokin': case 'promotedlance': case 'promotedknight': case 'promotedsilver':
        steps = [[forward,-1],[forward,0],[forward,1],[0,-1],[0,1],[-forward,0]]; break;
      case 'king': steps = [...diagonal,...straight]; break;
      case 'bishop': rays = diagonal; break;
      case 'rook': rays = straight; break;
      case 'horse': rays = diagonal; steps = straight; break;
      case 'dragon': rays = straight; steps = diagonal; break;
    }
    for (const [dr,dc] of steps) {
      const r=row+dr,c=col+dc;
      if (r>=0&&r<9&&c>=0&&c<9) yield r*9+c;
    }
    for (const [dr,dc] of rays) {
      for (let r=row+dr,c=col+dc;r>=0&&r<9&&c>=0&&c<9;r+=dr,c+=dc) {
        const to=r*9+c;
        yield to;
        if (this.native.board.at(Square.newByIndex(to))) break;
      }
    }
  }
  *dropDests({role,color}) {
    if (color !== this.turn || !handRoles.includes(role) || !this.native.hand(this.native.color).count(role)) return;
    for (let to=0;to<81;to++) if (this.isLegal({role,to})) yield to;
  }
  isEnd() {
    for (const sq of this.native.board.listSquaresByColor(this.native.color)) {
      for (const to of this.moveDests(sq.index)) {
        if (this.isLegal({from:sq.index,to}) || this.isLegal({from:sq.index,to,promotion:true})) return false;
      }
    }
    for (const role of handRoles) {
      if (!this.native.hand(this.native.color).count(role)) continue;
      for (const to of this.dropDests({role,color:this.turn})) return false;
    }
    return true;
  }
  outcome() { return this.isEnd() ? {winner:this.turn === 'sente' ? 'gote' : 'sente'} : undefined; }
}
