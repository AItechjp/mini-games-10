import { ROLES } from './constants.js';
import { SquareSet } from './square-set.js';
export class Board {
    constructor(occupied, colorMap, roleMap) {
        this.occupied = occupied;
        this.colorMap = colorMap;
        this.roleMap = roleMap;
    }
    static empty() {
        return new Board(SquareSet.empty(), new Map(), new Map());
    }
    static from(occupied, colorsIter, rolesIter) {
        return new Board(occupied, new Map(colorsIter), new Map(rolesIter));
    }
    clone() {
        return Board.from(this.occupied, this.colorMap, this.roleMap);
    }
    role(role) {
        return this.roleMap.get(role) || SquareSet.empty();
    }
    roles(role, ...roles) {
        return roles.reduce((acc, r) => acc.union(this.role(r)), this.role(role));
    }
    color(color) {
        return this.colorMap.get(color) || SquareSet.empty();
    }
    equals(other) {
        if (!this.color('gote').equals(other.color('gote')))
            return false;
        return ROLES.every((role) => this.role(role).equals(other.role(role)));
    }
    getColor(square) {
        if (this.color('sente').has(square))
            return 'sente';
        if (this.color('gote').has(square))
            return 'gote';
        return;
    }
    getRole(square) {
        for (const [role, sqs] of this.roleMap)
            if (sqs.has(square))
                return role;
        return;
    }
    get(square) {
        const color = this.getColor(square);
        if (!color)
            return;
        const role = this.getRole(square);
        return { color, role };
    }
    take(square) {
        const piece = this.get(square);
        if (piece) {
            this.occupied = this.occupied.without(square);
            this.colorMap.set(piece.color, this.color(piece.color).without(square));
            this.roleMap.set(piece.role, this.role(piece.role).without(square));
        }
        return piece;
    }
    set(square, piece) {
        const old = this.take(square);
        this.occupied = this.occupied.with(square);
        this.colorMap.set(piece.color, this.color(piece.color).with(square));
        this.roleMap.set(piece.role, this.role(piece.role).with(square));
        return old;
    }
    has(square) {
        return this.occupied.has(square);
    }
    *[Symbol.iterator]() {
        for (const square of this.occupied) {
            yield [square, this.get(square)];
        }
    }
    presentRoles() {
        return Array.from(this.roleMap)
            .filter(([_, sqs]) => sqs.nonEmpty())
            .map(([r]) => r);
    }
    pieces(color, role) {
        return this.color(color).intersect(this.role(role));
    }
}
//# sourceMappingURL=board.js.map