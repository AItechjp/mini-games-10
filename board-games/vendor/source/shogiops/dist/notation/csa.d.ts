import { Result } from '@badrap/result';
import { Board } from '../board.js';
import type { Hand } from '../hands.js';
import type { MoveOrDrop } from '../types.js';
import { Shogi } from '../variant/shogi.js';
export declare const InvalidCsa: {
    readonly CSA: "ERR_CSA";
    readonly Board: "ERR_BOARD";
    readonly Handicap: "ERR_HANDICAP";
    readonly Hands: "ERR_HANDS";
    readonly AdditionalInfo: "ERR_ADDITIONAL";
};
export declare class CsaError extends Error {
}
export declare function makeCsaHeader(pos: Shogi): string;
export declare function makeCsaBoard(board: Board): string;
export declare function makeCsaHand(hand: Hand, prefix: string): string;
export declare function parseCsaHeader(csa: string): Result<Shogi, CsaError>;
export declare function parseCsaHandicap(handicap: string): Result<Board, CsaError>;
export declare function parseTags(csa: string): [string, string][];
export declare function normalizedCsaLines(csa: string): string[];
export declare function parseCsaMoveOrDrop(pos: Shogi, csaMd: string): MoveOrDrop | undefined;
export declare function parseCsaMovesOrDrops(pos: Shogi, csaMds: string[]): MoveOrDrop[];
export declare function makeCsaMoveOrDrop(pos: Shogi, md: MoveOrDrop): string | undefined;
//# sourceMappingURL=csa.d.ts.map