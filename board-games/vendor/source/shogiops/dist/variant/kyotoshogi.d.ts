import type { Result } from '@badrap/result';
import { SquareSet } from '../square-set.js';
import type { Color, MoveOrDrop, Piece, Setup, Square } from '../types.js';
import type { Context, PositionError } from './position.js';
import { Position } from './position.js';
export declare class Kyotoshogi extends Position {
    private constructor();
    static from(setup: Setup, strict: boolean): Result<Kyotoshogi, PositionError>;
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
    isLegal(md: MoveOrDrop, ctx?: Context): boolean;
}
//# sourceMappingURL=kyotoshogi.d.ts.map