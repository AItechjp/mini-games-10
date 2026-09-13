import { between, bishopAttacks, goldAttacks, kingAttacks, knightAttacks, lanceAttacks, pawnAttacks, rookAttacks, silverAttacks, } from '../attacks.js';
import { SquareSet } from '../square-set.js';
import { defined, isDrop, opposite } from '../util.js';
import { Position } from './position.js';
import { standardMoveDests } from './shogi.js';
import { fullSquareSet, handRoles, unpromote } from './util.js';
export class Kyotoshogi extends Position {
    constructor() {
        super('kyotoshogi');
        this.validation = {
            doublePawn: false,
            oppositeCheck: true,
            unpromotedForcedPromotion: false,
            maxNumberOfRoyalPieces: 1,
        };
    }
    static from(setup, strict) {
        const pos = new Kyotoshogi();
        pos.fromSetup(setup);
        return pos.validate(strict).map((_) => pos);
    }
    squareAttackers(square, attacker, occupied) {
        const defender = opposite(attacker);
        const board = this.board;
        return board.color(attacker).intersect(rookAttacks(square, occupied)
            .intersect(board.role('rook'))
            .union(bishopAttacks(square, occupied).intersect(board.role('bishop')))
            .union(lanceAttacks(square, defender, occupied).intersect(board.role('lance')))
            .union(knightAttacks(square, defender).intersect(board.role('knight')))
            .union(goldAttacks(square, defender).intersect(board.roles('gold', 'tokin')))
            .union(silverAttacks(square, defender).intersect(board.role('silver')))
            .union(pawnAttacks(square, defender).intersect(board.role('pawn')))
            .union(kingAttacks(square).intersect(board.role('king'))));
    }
    squareSnipers(square, attacker) {
        const empty = SquareSet.empty();
        return rookAttacks(square, empty)
            .intersect(this.board.role('rook'))
            .union(bishopAttacks(square, empty).intersect(this.board.role('bishop')))
            .union(lanceAttacks(square, opposite(attacker), empty).intersect(this.board.role('lance')))
            .intersect(this.board.color(attacker));
    }
    moveDests(square, ctx) {
        return standardMoveDests(this, square, ctx);
    }
    dropDests(piece, ctx) {
        ctx = ctx || this.ctx();
        if (piece.color !== ctx.color)
            return SquareSet.empty();
        let mask = this.board.occupied.complement();
        if (defined(ctx.king) && ctx.checkers.nonEmpty()) {
            const checker = ctx.checkers.singleSquare();
            if (!defined(checker))
                return SquareSet.empty();
            mask = mask.intersect(between(checker, ctx.king));
        }
        return mask.intersect(fullSquareSet(this.rules));
    }
    isLegal(md, ctx) {
        const turn = (ctx === null || ctx === void 0 ? void 0 : ctx.color) || this.turn;
        if (isDrop(md)) {
            const roleInHand = !handRoles(this.rules).includes(md.role)
                ? unpromote(this.rules)(md.role)
                : md.role;
            if (!roleInHand ||
                !handRoles(this.rules).includes(roleInHand) ||
                this.hands[turn].get(roleInHand) <= 0)
                return false;
            return this.dropDests({ color: turn, role: md.role }, ctx).has(md.to);
        }
        else {
            return super.isLegal(md, ctx);
        }
    }
}
//# sourceMappingURL=kyotoshogi.js.map