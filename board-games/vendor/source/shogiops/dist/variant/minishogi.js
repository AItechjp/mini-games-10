import { bishopAttacks, goldAttacks, kingAttacks, pawnAttacks, rookAttacks, silverAttacks, } from '../attacks.js';
import { SquareSet } from '../square-set.js';
import { opposite } from '../util.js';
import { Position } from './position.js';
import { standardDropDests, standardMoveDests } from './shogi.js';
export class Minishogi extends Position {
    constructor() {
        super('minishogi');
    }
    static from(setup, strict) {
        const pos = new Minishogi();
        pos.fromSetup(setup);
        return pos.validate(strict).map((_) => pos);
    }
    squareAttackers(square, attacker, occupied) {
        const defender = opposite(attacker);
        const board = this.board;
        return board.color(attacker).intersect(rookAttacks(square, occupied)
            .intersect(board.roles('rook', 'dragon'))
            .union(bishopAttacks(square, occupied).intersect(board.roles('bishop', 'horse')))
            .union(goldAttacks(square, defender).intersect(board.roles('gold', 'tokin', 'promotedsilver')))
            .union(silverAttacks(square, defender).intersect(board.role('silver')))
            .union(pawnAttacks(square, defender).intersect(board.role('pawn')))
            .union(kingAttacks(square).intersect(board.roles('king', 'dragon', 'horse'))));
    }
    squareSnipers(square, attacker) {
        const empty = SquareSet.empty();
        return rookAttacks(square, empty)
            .intersect(this.board.roles('rook', 'dragon'))
            .union(bishopAttacks(square, empty).intersect(this.board.roles('bishop', 'horse')))
            .intersect(this.board.color(attacker));
    }
    moveDests(square, ctx) {
        return standardMoveDests(this, square, ctx);
    }
    dropDests(piece, ctx) {
        return standardDropDests(this, piece, ctx);
    }
}
//# sourceMappingURL=minishogi.js.map