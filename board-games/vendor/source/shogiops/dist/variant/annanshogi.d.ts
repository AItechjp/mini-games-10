import type { Result } from '@badrap/result';
import { Board } from '../board.js';
import { SquareSet } from '../square-set.js';
import type { Color, Piece, Setup, Square } from '../types.js';
import type { Context, PositionError } from './position.js';
import { Position } from './position.js';
export declare class Annanshogi extends Position {
    private constructor();
    static from(setup: Setup, strict: boolean): Result<Annanshogi, PositionError>;
    validation: {
        doublePawn: boolean;
        oppositeCheck: boolean;
        unpromotedForcedPromotion: boolean;
        maxNumberOfRoyalPieces: number;
    };
    squareAttackers(square: Square, attacker: Color, occupied: SquareSet): SquareSet;
    squareSnipers(square: number, attacker: Color): SquareSet;
    moveDests(square: Square, ctx?: Context): SquareSet;
    dropDests(piece: Piece, ctx?: Context): SquareSet;
}
export declare const directlyBehind: (color: Color, square: Square) => Square;
export declare const annanAttackBoard: (board: Board) => Board;
//# sourceMappingURL=annanshogi.d.ts.map