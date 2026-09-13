import { Result } from '@badrap/result';
import { Board } from '../board.js';
import { Hand } from '../hands.js';
import type { MoveOrDrop, Rules, Square } from '../types.js';
import type { Position } from '../variant/position.js';
export declare const InvalidKif: {
    readonly Kif: "ERR_KIF";
    readonly Board: "ERR_BOARD";
    readonly Hands: "ERR_HANDS";
};
export declare class KifError extends Error {
}
export declare function makeKifHeader(pos: Position): string;
export declare function makeKifPositionHeader(pos: Position): string;
export declare function makeKifBoard(rules: Rules, board: Board): string;
export declare function makeKifHand(rules: Rules, hand: Hand): string;
export declare function parseKifHeader(kif: string): Result<Position, KifError>;
export declare function parseKifBoard(rules: Rules, kifBoard: string): Result<Board, KifError>;
export declare function parseKifHand(rules: Rules, handPart: string): Result<Hand, KifError>;
export declare function parseTags(kif: string): [string, string][];
export declare function normalizedKifLines(kif: string): string[];
export declare const chushogiKifMoveRegex: RegExp;
export declare const kifMoveRegex: RegExp;
export declare const kifDropRegex: RegExp;
export declare function parseKifMoveOrDrop(kifMd: string, lastDest?: Square | undefined): MoveOrDrop | undefined;
export declare function parseKifMovesOrDrops(kifMds: string[], lastDest?: Square | undefined): MoveOrDrop[];
export declare function makeKifMoveOrDrop(pos: Position, md: MoveOrDrop, lastDest?: Square): string | undefined;
//# sourceMappingURL=kif.d.ts.map