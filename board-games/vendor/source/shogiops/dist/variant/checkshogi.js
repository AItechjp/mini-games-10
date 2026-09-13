import { opposite } from '../util.js';
import { Position } from './position.js';
import { standardDropDests, standardMoveDests, standardSquareAttacks, standardSquareSnipers, } from './shogi.js';
export class Checkshogi extends Position {
    constructor() {
        super('checkshogi');
    }
    static from(setup, strict) {
        const pos = new Checkshogi();
        pos.fromSetup(setup);
        return pos.validate(strict).map((_) => pos);
    }
    squareAttackers(square, attacker, occupied) {
        return standardSquareAttacks(square, attacker, this.board, occupied);
    }
    squareSnipers(square, attacker) {
        return standardSquareSnipers(square, attacker, this.board);
    }
    moveDests(square, ctx) {
        return standardMoveDests(this, square, ctx);
    }
    dropDests(piece, ctx) {
        return standardDropDests(this, piece, ctx);
    }
    outcome(ctx) {
        ctx = ctx || this.ctx();
        if (ctx.checkers.nonEmpty()) {
            return {
                result: 'check',
                winner: opposite(ctx.color),
            };
        }
        else
            return super.outcome(ctx);
    }
}
//# sourceMappingURL=checkshogi.js.map