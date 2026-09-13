import { Result } from '@badrap/result';
import { Board } from './board.js';
import type { Hand } from './hands.js';
import { Hands } from './hands.js';
import type { Piece, Role, Rules } from './types.js';
import type { Position, PositionError } from './variant/position.js';
import type { RulesTypeMap } from './variant/variant.js';
export declare const InvalidSfen: {
    readonly Sfen: "ERR_SFEN";
    readonly BoardDims: "ERR_BOARD_DIMS";
    readonly BoardPiece: "ERR_BOARD_PIECE";
    readonly Hands: "ERR_HANDS";
    readonly Turn: "ERR_TURN";
    readonly MoveNumber: "ERR_MOVENUMBER";
};
export declare class SfenError extends Error {
}
export declare function initialSfen(rules: Rules): string;
export declare function roleToForsyth(rules: Rules): (role: Role) => string | undefined;
export declare function forsythToRole(rules: Rules): (str: string) => Role | undefined;
export declare function pieceToForsyth(rules: Rules): (piece: Piece) => string | undefined;
export declare function forsythToPiece(rules: Rules): (s: string) => Piece | undefined;
export declare function parseBoardSfen(rules: Rules, boardPart: string): Result<Board, SfenError>;
export declare function parseHands(rules: Rules, handsPart: string): Result<Hands, SfenError>;
export declare function parseSfen<R extends keyof RulesTypeMap>(rules: R, sfen: string, strict?: boolean): Result<RulesTypeMap[R], SfenError | PositionError>;
export declare function makeBoardSfen(rules: Rules, board: Board): string;
export declare function makeHandSfen(rules: Rules, hand: Hand): string;
export declare function makeHandsSfen(rules: Rules, hands: Hands): string;
export declare function makeSfen(pos: Position): string;
//# sourceMappingURL=sfen.d.ts.map