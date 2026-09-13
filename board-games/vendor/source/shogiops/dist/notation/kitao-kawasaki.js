import { defined, isDrop } from '../util.js';
import { pieceCanPromote } from '../variant/util.js';
import { aimingAt, makeNumberSquare, roleKanjiDuplicates, roleToKanji } from './util.js';
// 歩-76
export function makeKitaoKawasakiMoveOrDrop(pos, md, lastDest) {
    var _a;
    if (isDrop(md)) {
        return `${roleToKanji(pos.rules)(md.role)}*${makeNumberSquare(md.to)}`;
    }
    else {
        const piece = pos.board.get(md.from);
        if (piece) {
            const roleStr = roleToKanji(pos.rules)(piece.role).replace('成', '+');
            const ambStr = aimingAt(pos, pos.board
                .roles(piece.role, ...roleKanjiDuplicates(pos.rules)(piece.role))
                .intersect(pos.board.color(piece.color)), md.to)
                .without(md.from)
                .isEmpty()
                ? ''
                : `(${makeNumberSquare(md.from)})`;
            const toCapture = pos.board.get(md.to);
            const actionStr = toCapture ? 'x' : '-';
            if (defined(md.midStep)) {
                const midCapture = pos.board.get(md.midStep);
                const igui = !!midCapture && md.to === md.from;
                if (igui)
                    return `${roleStr}${ambStr}x!${makeNumberSquare(md.midStep)}`;
                else if (md.to === md.from)
                    return `--`;
                else
                    return `${roleStr}${ambStr}${midCapture ? 'x' : '-'}${makeNumberSquare(md.midStep)}${actionStr}${makeNumberSquare(md.to)}`;
            }
            else {
                const destStr = (lastDest !== null && lastDest !== void 0 ? lastDest : (_a = pos.lastMoveOrDrop) === null || _a === void 0 ? void 0 : _a.to) === md.to ? '' : makeNumberSquare(md.to);
                const promStr = md.promotion
                    ? '+'
                    : pieceCanPromote(pos.rules)(piece, md.from, md.to, toCapture)
                        ? '='
                        : '';
                return `${roleStr}${ambStr}${actionStr}${destStr}${promStr}`;
            }
        }
        else
            return undefined;
    }
}
//# sourceMappingURL=kitao-kawasaki.js.map