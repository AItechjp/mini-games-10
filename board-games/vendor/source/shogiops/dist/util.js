import { FILE_NAMES, RANK_NAMES } from './constants.js';
export { Result } from '@badrap/result';
export function defined(v) {
    return v !== undefined;
}
export function opposite(color) {
    return color === 'gote' ? 'sente' : 'gote';
}
export function squareRank(square) {
    return square >>> 4;
}
export function squareFile(square) {
    return square & 15;
}
export function squareDist(a, b) {
    const x1 = squareFile(a);
    const x2 = squareFile(b);
    const y1 = squareRank(a);
    const y2 = squareRank(b);
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}
export function makePieceName(piece) {
    return `${piece.color} ${piece.role}`;
}
export function parsePieceName(pieceName) {
    const splitted = pieceName.split(' ');
    const color = splitted[0];
    const role = splitted[1];
    return { color, role };
}
export function parseCoordinates(file, rank) {
    if (file >= 0 && file < 16 && rank >= 0 && rank < 16)
        return file + rank * 16;
    return;
}
export function parseSquareName(str) {
    if (str.length !== 2 && str.length !== 3)
        return;
    const file = Number.parseInt(str.slice(0, -1), 10) - 1;
    const rank = str.slice(-1).charCodeAt(0) - 'a'.charCodeAt(0);
    if (isNaN(file) || file < 0 || file >= 16 || rank < 0 || rank >= 16)
        return;
    return file + 16 * rank;
}
export function makeSquareName(square) {
    return (FILE_NAMES[squareFile(square)] + RANK_NAMES[squareRank(square)]);
}
export function isDrop(v) {
    return 'role' in v;
}
export function isMove(v) {
    return 'from' in v;
}
export const lionRoles = ['lion', 'lionpromoted'];
// other roles can't be dropped with any current variant
function parseUsiDropRole(ch) {
    switch (ch.toUpperCase()) {
        case 'P':
            return 'pawn';
        case 'L':
            return 'lance';
        case 'N':
            return 'knight';
        case 'S':
            return 'silver';
        case 'G':
            return 'gold';
        case 'B':
            return 'bishop';
        case 'R':
            return 'rook';
        case 'T':
            return 'tokin';
        default:
            return;
    }
}
export const usiDropRegex = /^([PLNSGBRT])\*(\d\d?[a-p])$/;
export const usiMoveRegex = /^(\d\d?[a-p])(\d\d?[a-p])?(\d\d?[a-p])(\+|=|\?)?$/;
export function parseUsi(str) {
    const dropMatch = str.match(usiDropRegex);
    if (dropMatch) {
        const role = parseUsiDropRole(dropMatch[1]);
        const to = parseSquareName(dropMatch[2]);
        if (defined(role) && defined(to))
            return { role, to };
    }
    const moveMatch = str.match(usiMoveRegex);
    if (moveMatch) {
        const from = parseSquareName(moveMatch[1]);
        const midStep = moveMatch[2] ? parseSquareName(moveMatch[2]) : undefined;
        const to = parseSquareName(moveMatch[3]);
        const promotion = moveMatch[4] === '+';
        if (defined(from) && defined(to))
            return { from, to, promotion, midStep };
    }
    return;
}
function makeUsiDropRole(role) {
    return role === 'knight' ? 'N' : role[0].toUpperCase();
}
export function makeUsi(md) {
    if (isDrop(md))
        return `${makeUsiDropRole(md.role).toUpperCase()}*${makeSquareName(md.to)}`;
    return (makeSquareName(md.from) +
        (defined(md.midStep) ? makeSquareName(md.midStep) : '') +
        makeSquareName(md.to) +
        (md.promotion ? '+' : ''));
}
export function toBW(color) {
    // white, w, gote, g
    if (color[0] === 'w' || color[0] === 'g')
        return 'w';
    return 'b';
}
export function toBlackWhite(color) {
    if (color[0] === 'w' || color[0] === 'g')
        return 'white';
    return 'black';
}
export function toColor(color) {
    if (color[0] === 'w' || color[0] === 'g')
        return 'gote';
    return 'sente';
}
export function boolToColor(b) {
    return b ? 'sente' : 'gote';
}
//# sourceMappingURL=util.js.map