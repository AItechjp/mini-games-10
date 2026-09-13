import type { Result } from '@badrap/result';
import type { SquareSet } from '../square-set.js';
import type { Color, Outcome, Piece, Setup, Square } from '../types.js';
import type { Context, PositionError } from './position.js';
import { Position } from './position.js';
export declare class Checkshogi extends Position {
    private constructor();
    static from(setup: Setup, strict: boolean): Result<Checkshogi, PositionError>;
    squareAttackers(square: Square, attacker: Color, occupied: SquareSet): SquareSet;
    squareSnipers(square: number, attacker: Color): SquareSet;
    moveDests(square: Square, ctx?: Context): SquareSet;
    dropDests(piece: Piece, ctx?: Context): SquareSet;
    outcome(ctx?: Context): Outcome | undefined;
}
//# sourceMappingURL=checkshogi.d.ts.map