import { SquareSet } from './square-set.js';
import type { Color, Piece, Role, Square } from './types.js';
export declare class Board implements Iterable<[Square, Piece]> {
    occupied: SquareSet;
    private colorMap;
    private roleMap;
    private constructor();
    static empty(): Board;
    static from(occupied: SquareSet, colorsIter: Iterable<[Color, SquareSet]>, rolesIter: Iterable<[Role, SquareSet]>): Board;
    clone(): Board;
    role(role: Role): SquareSet;
    roles(role: Role, ...roles: Role[]): SquareSet;
    color(color: Color): SquareSet;
    equals(other: Board): boolean;
    getColor(square: Square): Color | undefined;
    getRole(square: Square): Role | undefined;
    get(square: Square): Piece | undefined;
    take(square: Square): Piece | undefined;
    set(square: Square, piece: Piece): Piece | undefined;
    has(square: Square): boolean;
    [Symbol.iterator](): Iterator<[Square, Piece]>;
    presentRoles(): Role[];
    pieces(color: Color, role: Role): SquareSet;
}
//# sourceMappingURL=board.d.ts.map