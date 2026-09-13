import type { Result } from '@badrap/result';
import { SquareSet } from '../square-set.js';
import type { Color, Outcome, Piece, Setup, Square } from '../types.js';
import type { Context, PositionError } from './position.js';
import { Position } from './position.js';
export declare class Dobutsu extends Position {
    private constructor();
    static from(setup: Setup, strict: boolean): Result<Dobutsu, PositionError>;
    validation: {
        doublePawn: boolean;
        oppositeCheck: boolean;
        unpromotedForcedPromotion: boolean;
        maxNumberOfRoyalPieces: number;
    };
    squareAttackers(square: Square, attacker: Color, _occupied: SquareSet): SquareSet;
    squareSnipers(_square: number, _attacker: Color): SquareSet;
    moveDests(square: Square, ctx?: Context): SquareSet;
    dropDests(piece: Piece, ctx?: Context): SquareSet;
    outcome(ctx?: Context): Outcome | undefined;
}
//# sourceMappingURL=dobutsu.d.ts.map