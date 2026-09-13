import { attacks, between, bishopAttacks, goldAttacks, kingAttacks, knightAttacks, lanceAttacks, pawnAttacks, ray, rookAttacks, silverAttacks, } from '../attacks.js';
import { SquareSet } from '../square-set.js';
import { defined, opposite, squareFile } from '../util.js';
import { Position } from './position.js';
import { dimensions, fullSquareSet } from './util.js';
export class Shogi extends Position {
    constructor() {
        super('standard');
    }
    static from(setup, strict) {
        const pos = new Shogi();
        pos.fromSetup(setup);
        return pos.validate(strict).map((_) => pos);
    }
    squareAttackers(square, attacker, occupied) {
        return standardSquareAttacks(square, attacker, this.board, occupied);
    }
    squareSnipers(square, attacker) {
        return standardSquareSnipers(square, attacker, this.board);
    }
    dropDests(piece, ctx) {
        return standardDropDests(this, piece, ctx);
    }
    moveDests(square, ctx) {
        return standardMoveDests(this, square, ctx);
    }
}
export const standardSquareAttacks = (square, attacker, board, occupied) => {
    const defender = opposite(attacker);
    return board.color(attacker).intersect(rookAttacks(square, occupied)
        .intersect(board.roles('rook', 'dragon'))
        .union(bishopAttacks(square, occupied).intersect(board.roles('bishop', 'horse')))
        .union(lanceAttacks(square, defender, occupied).intersect(board.role('lance')))
        .union(knightAttacks(square, defender).intersect(board.role('knight')))
        .union(silverAttacks(square, defender).intersect(board.role('silver')))
        .union(goldAttacks(square, defender).intersect(board.roles('gold', 'tokin', 'promotedlance', 'promotedknight', 'promotedsilver')))
        .union(pawnAttacks(square, defender).intersect(board.role('pawn')))
        .union(kingAttacks(square).intersect(board.roles('king', 'dragon', 'horse'))));
};
export const standardSquareSnipers = (square, attacker, board) => {
    const empty = SquareSet.empty();
    return rookAttacks(square, empty)
        .intersect(board.roles('rook', 'dragon'))
        .union(bishopAttacks(square, empty).intersect(board.roles('bishop', 'horse')))
        .union(lanceAttacks(square, opposite(attacker), empty).intersect(board.role('lance')))
        .intersect(board.color(attacker));
};
export const standardMoveDests = (pos, square, ctx) => {
    ctx = ctx || pos.ctx();
    const piece = pos.board.get(square);
    if (!piece || piece.color !== ctx.color)
        return SquareSet.empty();
    let pseudo = attacks(piece, square, pos.board.occupied).intersect(fullSquareSet(pos.rules));
    pseudo = pseudo.diff(pos.board.color(ctx.color));
    if (defined(ctx.king)) {
        if (piece.role === 'king') {
            const occ = pos.board.occupied.without(square);
            for (const to of pseudo) {
                if (pos.squareAttackers(to, opposite(ctx.color), occ).nonEmpty())
                    pseudo = pseudo.without(to);
            }
        }
        else {
            if (ctx.checkers.nonEmpty()) {
                const checker = ctx.checkers.singleSquare();
                if (!defined(checker))
                    return SquareSet.empty();
                pseudo = pseudo.intersect(between(checker, ctx.king).with(checker));
            }
            if (ctx.blockers.has(square))
                pseudo = pseudo.intersect(ray(square, ctx.king));
        }
    }
    return pseudo;
};
export const standardDropDests = (pos, piece, ctx) => {
    var _a;
    ctx = ctx || pos.ctx();
    if (piece.color !== ctx.color)
        return SquareSet.empty();
    const role = piece.role;
    let mask = pos.board.occupied.complement();
    // Removing backranks, where no legal drop would be possible
    const dims = dimensions(pos.rules);
    if (role === 'pawn' || role === 'lance')
        mask = mask.diff(SquareSet.fromRank(ctx.color === 'sente' ? 0 : dims.ranks - 1));
    else if (role === 'knight')
        mask = mask.diff(ctx.color === 'sente' ? SquareSet.ranksAbove(2) : SquareSet.ranksBelow(dims.ranks - 3));
    if (defined(ctx.king) && ctx.checkers.nonEmpty()) {
        const checker = ctx.checkers.singleSquare();
        if (!defined(checker))
            return SquareSet.empty();
        mask = mask.intersect(between(checker, ctx.king));
    }
    if (role === 'pawn') {
        // Checking for double pawns
        const pawns = pos.board.role('pawn').intersect(pos.board.color(ctx.color));
        for (const pawn of pawns) {
            const file = SquareSet.fromFile(squareFile(pawn));
            mask = mask.diff(file);
        }
        // Checking for a pawn checkmate
        const kingSquare = pos.kingsOf(opposite(ctx.color)).singleSquare();
        const kingFront = defined(kingSquare)
            ? ctx.color === 'sente'
                ? kingSquare + 16
                : kingSquare - 16
            : undefined;
        if (defined(kingFront) && mask.has(kingFront)) {
            const child = pos.clone();
            child.play({ role: 'pawn', to: kingFront });
            if (((_a = child.outcome()) === null || _a === void 0 ? void 0 : _a.result) === 'checkmate')
                mask = mask.without(kingFront);
        }
    }
    return mask.intersect(fullSquareSet(pos.rules));
};
//# sourceMappingURL=shogi.js.map