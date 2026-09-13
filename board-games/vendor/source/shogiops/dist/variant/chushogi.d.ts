import type { Result } from '@badrap/result';
import { SquareSet } from '../square-set.js';
import type { Color, MoveOrDrop, Outcome, Piece, Setup, Square } from '../types.js';
import type { Context } from './position.js';
import { Position, type PositionError } from './position.js';
export declare class Chushogi extends Position {
    private constructor();
    static from(setup: Setup, strict: boolean): Result<Chushogi, PositionError>;
    validation: {
        doublePawn: boolean;
        oppositeCheck: boolean;
        unpromotedForcedPromotion: boolean;
        maxNumberOfRoyalPieces: number;
    };
    squareAttackers(square: Square, attacker: Color, occupied: SquareSet): SquareSet;
    squareSnipers(_square: number, _attacker: Color): SquareSet;
    kingsOf(color: Color): SquareSet;
    moveDests(square: Square, ctx?: Context): SquareSet;
    dropDests(_piece: Piece, _ctx?: Context): SquareSet;
    outcome(ctx?: Context): Outcome | undefined;
    isLegal(md: MoveOrDrop, ctx?: Context): boolean;
}
export declare function secondLionStepDests(before: Chushogi, initialSq: Square, midSq: Square): SquareSet;
//# sourceMappingURL=chushogi.d.ts.map