import type { Result } from '@badrap/result';
import type { Board } from '../board.js';
import { SquareSet } from '../square-set.js';
import type { Color, Piece, Setup, Square } from '../types.js';
import type { Context, PositionError } from './position.js';
import { Position } from './position.js';
export declare class Shogi extends Position {
    private constructor();
    static from(setup: Setup, strict: boolean): Result<Shogi, PositionError>;
    squareAttackers(square: Square, attacker: Color, occupied: SquareSet): SquareSet;
    squareSnipers(square: number, attacker: Color): SquareSet;
    dropDests(piece: Piece, ctx?: Context): SquareSet;
    moveDests(square: Square, ctx?: Context): SquareSet;
}
export declare const standardSquareAttacks: (square: Square, attacker: Color, board: Board, occupied: SquareSet) => SquareSet;
export declare const standardSquareSnipers: (square: number, attacker: Color, board: Board) => SquareSet;
export declare const standardMoveDests: (pos: Position, square: Square, ctx?: Context) => SquareSet;
export declare const standardDropDests: (pos: Position, piece: Piece, ctx?: Context) => SquareSet;
//# sourceMappingURL=shogi.d.ts.map