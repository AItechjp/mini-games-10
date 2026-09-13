import { SquareSet } from './square-set.js';
import { opposite, squareFile, squareRank } from './util.js';
function computeRange(square, deltas) {
    const file = squareFile(square);
    const dests = deltas
        .map((delta) => square + delta)
        .filter((sq) => Math.abs(file - squareFile(sq)) <= 2);
    return SquareSet.fromSquares(...dests);
}
function tabulateSquares(f) {
    const table = [];
    for (let square = 0; square < 256; square++)
        table[square] = f(square);
    return table;
}
function tabulateRanks(f) {
    const table = [];
    for (let rank = 0; rank < 16; rank++)
        table[rank] = f(rank);
    return table;
}
const FORW_RANKS = tabulateRanks((rank) => SquareSet.ranksAbove(rank));
const BACK_RANKS = tabulateRanks((rank) => SquareSet.ranksBelow(rank));
const NEIGHBORS = tabulateSquares((sq) => computeRange(sq, [-17, -16, -15, -1, 1, 15, 16, 17]));
const FILE_RANGE = tabulateSquares((sq) => SquareSet.fromFile(squareFile(sq)).without(sq));
const RANK_RANGE = tabulateSquares((sq) => SquareSet.fromRank(squareRank(sq)).without(sq));
const DIAG_RANGE = tabulateSquares((sq) => {
    const diag = new SquareSet([
        0x20001, 0x80004, 0x200010, 0x800040, 0x2000100, 0x8000400, 0x20001000, 0x80004000,
    ]);
    const shift = 16 * (squareRank(sq) - squareFile(sq));
    return (shift >= 0 ? diag.shl256(shift) : diag.shr256(-shift)).without(sq);
});
const ANTI_DIAG_RANGE = tabulateSquares((sq) => {
    const diag = new SquareSet([
        0x40008000, 0x10002000, 0x4000800, 0x1000200, 0x400080, 0x100020, 0x40008, 0x10002,
    ]);
    const shift = 16 * (squareRank(sq) + squareFile(sq) - 15);
    return (shift >= 0 ? diag.shl256(shift) : diag.shr256(-shift)).without(sq);
});
function hyperbola(bit, range, occupied) {
    let forward = occupied.intersect(range);
    let reverse = forward.rowSwap256(); // Assumes no more than 1 bit per rank
    forward = forward.minus256(bit);
    reverse = reverse.minus256(bit.rowSwap256());
    return forward.xor(reverse.rowSwap256()).intersect(range);
}
function fileAttacks(square, occupied) {
    return hyperbola(SquareSet.fromSquare(square), FILE_RANGE[square], occupied);
}
function rankAttacks(square, occupied) {
    const range = RANK_RANGE[square];
    let forward = occupied.intersect(range);
    let reverse = forward.rbit256();
    forward = forward.minus256(SquareSet.fromSquare(square));
    reverse = reverse.minus256(SquareSet.fromSquare(255 - square));
    return forward.xor(reverse.rbit256()).intersect(range);
}
export function kingAttacks(square) {
    return NEIGHBORS[square];
}
export function knightAttacks(square, color) {
    if (color === 'sente')
        return computeRange(square, [-31, -33]);
    else
        return computeRange(square, [31, 33]);
}
export function silverAttacks(square, color) {
    if (color === 'sente')
        return NEIGHBORS[square].withoutMany(square + 16, square - 1, square + 1);
    else
        return NEIGHBORS[square].withoutMany(square - 16, square - 1, square + 1);
}
export function goldAttacks(square, color) {
    if (color === 'sente')
        return NEIGHBORS[square].withoutMany(square + 17, square + 15);
    else
        return NEIGHBORS[square].withoutMany(square - 17, square - 15);
}
export function pawnAttacks(square, color) {
    if (color === 'sente')
        return SquareSet.fromSquare(square - 16);
    else
        return SquareSet.fromSquare(square + 16);
}
export function bishopAttacks(square, occupied) {
    const bit = SquareSet.fromSquare(square);
    return hyperbola(bit, DIAG_RANGE[square], occupied).xor(hyperbola(bit, ANTI_DIAG_RANGE[square], occupied));
}
export function rookAttacks(square, occupied) {
    return fileAttacks(square, occupied).xor(rankAttacks(square, occupied));
}
export function lanceAttacks(square, color, occupied) {
    if (color === 'sente')
        return fileAttacks(square, occupied).intersect(FORW_RANKS[squareRank(square)]);
    else
        return fileAttacks(square, occupied).intersect(BACK_RANKS[squareRank(square)]);
}
export function horseAttacks(square, occupied) {
    return bishopAttacks(square, occupied).union(kingAttacks(square));
}
export function dragonAttacks(square, occupied) {
    return rookAttacks(square, occupied).union(kingAttacks(square));
}
// Chushogi pieces
export function goBetweenAttacks(square) {
    return SquareSet.fromSquares(square - 16, square + 16);
}
export function chariotAttacks(square, occupied) {
    return fileAttacks(square, occupied);
}
export function sideMoverAttacks(square, occupied) {
    return rankAttacks(square, occupied).union(SquareSet.fromSquares(square - 16, square + 16));
}
export function verticalMoverAttacks(square, occupied) {
    return fileAttacks(square, occupied).union(computeRange(square, [-1, 1]));
}
export function copperAttacks(square, color) {
    if (color === 'sente')
        return NEIGHBORS[square].withoutMany(square + 17, square + 15, square + 1, square - 1);
    else
        return NEIGHBORS[square].withoutMany(square - 17, square - 15, square - 1, square + 1);
}
export function leopardAttacks(square) {
    return NEIGHBORS[square].withoutMany(square + 1, square - 1);
}
export function tigerAttacks(square, color) {
    if (color === 'sente')
        return NEIGHBORS[square].without(square - 16);
    else
        return NEIGHBORS[square].without(square + 16);
}
export function elephantAttacks(square, color) {
    return tigerAttacks(square, opposite(color));
}
export function kirinAttacks(square) {
    return NEIGHBORS[square]
        .withoutMany(square + 1, square - 1, square + 16, square - 16)
        .union(computeRange(square, [32, -32, -2, 2]));
}
export function phoenixAttacks(square) {
    return NEIGHBORS[square]
        .withoutMany(square - 15, square - 17, square + 15, square + 17)
        .union(computeRange(square, [30, 34, -30, -34]));
}
export function queenAttacks(square, occupied) {
    return rookAttacks(square, occupied).union(bishopAttacks(square, occupied));
}
export function stagAttacks(square, occupied) {
    return fileAttacks(square, occupied).union(NEIGHBORS[square]);
}
export function oxAttacks(square, occupied) {
    return fileAttacks(square, occupied).union(bishopAttacks(square, occupied));
}
export function boarAttacks(square, occupied) {
    return rankAttacks(square, occupied).union(bishopAttacks(square, occupied));
}
export function whaleAttacks(square, color, occupied) {
    if (color === 'sente')
        return fileAttacks(square, occupied).union(bishopAttacks(square, occupied).intersect(BACK_RANKS[squareRank(square)]));
    else
        return fileAttacks(square, occupied).union(bishopAttacks(square, occupied).intersect(FORW_RANKS[squareRank(square)]));
}
export function whiteHorseAttacks(square, color, occupied) {
    return whaleAttacks(square, opposite(color), occupied);
}
export function falconLionAttacks(square, color) {
    if (color === 'sente')
        return SquareSet.fromSquares(square - 16, square - 32);
    else
        return SquareSet.fromSquares(square + 16, square + 32);
}
export function falconAttacks(square, color, occupied) {
    if (color === 'sente')
        return bishopAttacks(square, occupied)
            .union(rankAttacks(square, occupied))
            .union(fileAttacks(square, occupied).intersect(BACK_RANKS[squareRank(square)]))
            .union(falconLionAttacks(square, color));
    else
        return bishopAttacks(square, occupied)
            .union(rankAttacks(square, occupied))
            .union(fileAttacks(square, occupied).intersect(FORW_RANKS[squareRank(square)]))
            .union(falconLionAttacks(square, color));
}
export function eagleLionAttacks(square, color) {
    if (color === 'sente')
        return computeRange(square, [-15, -17, -30, -34]);
    else
        return computeRange(square, [15, 17, 30, 34]);
}
export function eagleAttacks(square, color, occupied) {
    if (color === 'sente')
        return rookAttacks(square, occupied)
            .union(bishopAttacks(square, occupied).intersect(BACK_RANKS[squareRank(square)]))
            .union(eagleLionAttacks(square, color));
    else
        return rookAttacks(square, occupied)
            .union(bishopAttacks(square, occupied).intersect(FORW_RANKS[squareRank(square)]))
            .union(eagleLionAttacks(square, color));
}
export function lionAttacks(square) {
    return NEIGHBORS[square].union(computeRange(square, [-34, -33, -32, -31, -30, -18, -14, -2, 2, 14, 18, 30, 31, 32, 33, 34]));
}
export function attacks(piece, square, occupied) {
    switch (piece.role) {
        case 'pawn':
            return pawnAttacks(square, piece.color);
        case 'lance':
            return lanceAttacks(square, piece.color, occupied);
        case 'knight':
            return knightAttacks(square, piece.color);
        case 'silver':
            return silverAttacks(square, piece.color);
        case 'promotedpawn':
        case 'tokin':
        case 'promotedlance':
        case 'promotedknight':
        case 'promotedsilver':
        case 'gold':
            return goldAttacks(square, piece.color);
        case 'bishop':
        case 'bishoppromoted':
            return bishopAttacks(square, occupied);
        case 'rook':
        case 'rookpromoted':
            return rookAttacks(square, occupied);
        case 'horse':
        case 'horsepromoted':
            return horseAttacks(square, occupied);
        case 'dragon':
        case 'dragonpromoted':
            return dragonAttacks(square, occupied);
        case 'tiger':
            return tigerAttacks(square, piece.color);
        case 'copper':
            return copperAttacks(square, piece.color);
        case 'elephant':
        case 'elephantpromoted':
            return elephantAttacks(square, piece.color);
        case 'leopard':
            return leopardAttacks(square);
        case 'ox':
            return oxAttacks(square, occupied);
        case 'stag':
            return stagAttacks(square, occupied);
        case 'boar':
            return boarAttacks(square, occupied);
        case 'gobetween':
            return goBetweenAttacks(square);
        case 'falcon':
            return falconAttacks(square, piece.color, occupied);
        case 'kirin':
            return kirinAttacks(square);
        case 'lion':
        case 'lionpromoted':
            return lionAttacks(square);
        case 'phoenix':
            return phoenixAttacks(square);
        case 'queen':
        case 'queenpromoted':
            return queenAttacks(square, occupied);
        case 'chariot':
            return chariotAttacks(square, occupied);
        case 'sidemover':
        case 'sidemoverpromoted':
            return sideMoverAttacks(square, occupied);
        case 'eagle':
            return eagleAttacks(square, piece.color, occupied);
        case 'verticalmover':
        case 'verticalmoverpromoted':
            return verticalMoverAttacks(square, occupied);
        case 'whale':
            return whaleAttacks(square, piece.color, occupied);
        case 'whitehorse':
            return whiteHorseAttacks(square, piece.color, occupied);
        case 'prince':
        case 'king':
            return kingAttacks(square);
    }
}
export function ray(a, b) {
    const other = SquareSet.fromSquare(b);
    if (RANK_RANGE[a].intersects(other))
        return RANK_RANGE[a].with(a);
    if (ANTI_DIAG_RANGE[a].intersects(other))
        return ANTI_DIAG_RANGE[a].with(a);
    if (DIAG_RANGE[a].intersects(other))
        return DIAG_RANGE[a].with(a);
    if (FILE_RANGE[a].intersects(other))
        return FILE_RANGE[a].with(a);
    return SquareSet.empty();
}
export function between(a, b) {
    return ray(a, b)
        .intersect(SquareSet.full().shl256(a).xor(SquareSet.full().shl256(b)))
        .withoutFirst();
}
//# sourceMappingURL=attacks.js.map