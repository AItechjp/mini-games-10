import { Result } from '@badrap/result';
import type { Board } from '../board.js';
import type { Hands } from '../hands.js';
import { SquareSet } from '../square-set.js';
import type { Color, MoveOrDrop, Outcome, Piece, PieceName, Rules, Setup, Square } from '../types.js';
export declare const IllegalSetup: {
    readonly Empty: "ERR_EMPTY";
    readonly OppositeCheck: "ERR_OPPOSITE_CHECK";
    readonly PiecesOutsideBoard: "ERR_PIECES_OUTSIDE_BOARD";
    readonly InvalidPieces: "ERR_INVALID_PIECE";
    readonly InvalidPiecesHand: "ERR_INVALID_PIECE_IN_HAND";
    readonly InvalidPiecesPromotionZone: "ERR_PIECES_MUST_PROMOTE";
    readonly InvalidPiecesDoublePawns: "ERR_PIECES_DOUBLE_PAWNS";
    readonly Kings: "ERR_KINGS";
};
export declare class PositionError extends Error {
}
export interface Context {
    color: Color;
    king: Square | undefined;
    blockers: SquareSet;
    checkers: SquareSet;
}
export declare abstract class Position {
    readonly rules: Rules;
    board: Board;
    hands: Hands;
    turn: Color;
    moveNumber: number;
    lastMoveOrDrop: MoveOrDrop | {
        to: Square;
    } | undefined;
    lastLionCapture: Square | undefined;
    protected constructor(rules: Rules);
    abstract moveDests(square: Square, ctx?: Context): SquareSet;
    abstract dropDests(piece: Piece, ctx?: Context): SquareSet;
    illegalMoveDests(square: Square): SquareSet;
    illegalDropDests(piece: Piece): SquareSet;
    abstract squareAttackers(square: Square, attacker: Color, occupied: SquareSet): SquareSet;
    protected abstract squareSnipers(square: Square, attacker: Color): SquareSet;
    protected fromSetup(setup: Setup): void;
    clone(): this;
    validation: {
        doublePawn: boolean;
        oppositeCheck: boolean;
        unpromotedForcedPromotion: boolean;
        maxNumberOfRoyalPieces: number;
    };
    validate(strict: boolean): Result<undefined, PositionError>;
    ctx(color?: Color): Context;
    kingsOf(color: Color): SquareSet;
    isCheck(color?: Color): boolean;
    checks(): SquareSet;
    isEnd(ctx?: Context): boolean;
    outcome(ctx?: Context): Outcome | undefined;
    allMoveDests(ctx?: Context): Map<Square, SquareSet>;
    allDropDests(ctx?: Context): Map<PieceName, SquareSet>;
    hasDests(ctx?: Context): boolean;
    isLegal(md: MoveOrDrop, ctx?: Context): boolean;
    private unpromoteForHand;
    private storeCapture;
    play(md: MoveOrDrop): void;
}
//# sourceMappingURL=position.d.ts.map