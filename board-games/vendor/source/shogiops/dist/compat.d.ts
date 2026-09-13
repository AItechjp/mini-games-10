import type { SquareSet } from './square-set.js';
import type { MoveOrDrop, PieceName, Rules, SquareName } from './types.js';
import type { Chushogi } from './variant/chushogi.js';
import type { Position } from './variant/position.js';
export declare function squareSetToSquareNames(sqs: SquareSet): SquareName[];
export declare function shogigroundMoveDests(pos: Position): Map<SquareName, SquareName[]>;
export declare function shogigroundDropDests(pos: Position): Map<PieceName, SquareName[]>;
export declare function shogigroundSecondLionStep(before: Chushogi, initialSq: SquareName, midSq: SquareName): Map<SquareName, SquareName[]>;
export declare function usiToSquareNames(usi: string | undefined): SquareName[];
export declare function moveToSquareNames(md: MoveOrDrop): SquareName[];
export declare function checksSquareNames(pos: Position): SquareName[];
export declare function scalashogiCharPair(md: MoveOrDrop, rules: Rules): string;
export declare function parseFairyUsi(usi: string, rules: Rules): MoveOrDrop | undefined;
//# sourceMappingURL=compat.d.ts.map