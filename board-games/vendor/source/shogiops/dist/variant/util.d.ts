import { SquareSet } from '../square-set.js';
import type { Color, Dimensions, Piece, Role, Rules, Square } from '../types.js';
export declare function pieceCanPromote(rules: Rules): (piece: Piece, from: Square, to: Square, capture: Piece | undefined) => boolean;
export declare function pieceForcePromote(rules: Rules): (piece: Piece, sq: Square) => boolean;
export declare function promotableOnDrop(rules: Rules): (piece: Piece) => boolean;
export declare function allRoles(rules: Rules): Role[];
export declare function handRoles(rules: Rules): Role[];
export declare function promotableRoles(rules: Rules): Role[];
export declare function fullSquareSet(rules: Rules): SquareSet;
export declare function promote(rules: Rules): (role: Role) => Role | undefined;
export declare function unpromote(rules: Rules): (role: Role) => Role | undefined;
export declare function promotionZone(rules: Rules): (color: Color) => SquareSet;
export declare function dimensions(rules: Rules): Dimensions;
//# sourceMappingURL=util.d.ts.map