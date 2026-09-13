import { Result } from '@badrap/result';
import { Board } from '../board.js';
import { findHandicap, isHandicap } from '../handicaps.js';
import { Hand, Hands } from '../hands.js';
import { initialSfen, makeSfen, parseSfen } from '../sfen.js';
import { boolToColor, defined, isDrop, isMove, parseCoordinates } from '../util.js';
import { allRoles, dimensions, handRoles, promote } from '../variant/util.js';
import { initializePosition } from '../variant/variant.js';
import { filesByRules, kanjiToNumber, kanjiToRole, makeJapaneseSquare, makeJapaneseSquareHalf, makeNumberSquare, numberToKanji, parseJapaneseSquare, parseNumberSquare, pieceToBoardKanji, roleToFullKanji, roleToKanji, } from './util.js';
//
// KIF HEADER
//
export const InvalidKif = {
    Kif: 'ERR_KIF',
    Board: 'ERR_BOARD',
    Hands: 'ERR_HANDS',
};
export class KifError extends Error {
}
// Export
export function makeKifHeader(pos) {
    const sfen = makeSfen(pos);
    const handicap = pos.rules === 'standard' ? findHandicap({ sfen, rules: pos.rules }) : undefined;
    if (sfen === initialSfen(pos.rules))
        return `手合割：${defaultHandicap(pos.rules)}`;
    else if (handicap)
        return `手合割：${handicap.japaneseName}`;
    return makeKifPositionHeader(pos);
}
export function makeKifPositionHeader(pos) {
    const handicap = isHandicap({ sfen: makeSfen(pos) });
    return [
        ['standard', 'chushogi'].includes(pos.rules) ? '' : `手合割：${defaultHandicap(pos.rules)}`, // not sure about this, but we need something to indicate the variant
        pos.rules !== 'chushogi'
            ? `${colorName('gote', handicap)}の持駒：${makeKifHand(pos.rules, pos.hands.color('gote'))}`
            : '',
        makeKifBoard(pos.rules, pos.board),
        pos.rules !== 'chushogi'
            ? `${colorName('sente', handicap)}の持駒：${makeKifHand(pos.rules, pos.hands.color('sente'))}`
            : '',
        ...(pos.turn === 'gote' ? [`${colorName('gote', handicap)}番`] : []),
    ]
        .filter((l) => l.length > 0)
        .join('\n');
}
export function makeKifBoard(rules, board) {
    const dims = dimensions(rules);
    const kifFiles = filesByRules(rules);
    const space = rules === 'chushogi' ? 3 : 2;
    const separator = `+${'-'.repeat(dims.files * (space + 1))}+`;
    const offset = dims.files - 1;
    const emptySquare = rules === 'chushogi' ? '  ・' : ' ・';
    let kifBoard = `${kifFiles}\n${separator}\n`;
    for (let rank = 0; rank < dims.ranks; rank++) {
        for (let file = offset; file >= 0; file--) {
            const square = parseCoordinates(file, rank);
            const piece = board.get(square);
            if (file === offset) {
                kifBoard += '|';
            }
            if (!piece)
                kifBoard += emptySquare;
            else
                kifBoard += pieceToBoardKanji(rules)(piece).padStart(space);
            if (file === 0)
                kifBoard += `|${numberToKanji(rank + 1)}\n`;
        }
    }
    kifBoard += separator;
    return kifBoard;
}
export function makeKifHand(rules, hand) {
    if (hand.isEmpty())
        return 'なし';
    return handRoles(rules)
        .map((role) => {
        const r = roleToKanji(rules)(role);
        const n = hand.get(role);
        return n > 1 ? r + numberToKanji(n) : n === 1 ? r : '';
    })
        .filter((p) => p.length > 0)
        .join(' ');
}
function colorName(color, handicap) {
    if (handicap)
        return color === 'gote' ? '上手' : '下手';
    else
        return color === 'gote' ? '後手' : '先手';
}
function defaultHandicap(rules) {
    switch (rules) {
        case 'minishogi':
            return '5五将棋';
        case 'chushogi':
            return '';
        case 'annanshogi':
            return '安南将棋';
        case 'kyotoshogi':
            return '京都将棋';
        case 'checkshogi':
            return '王手将棋';
        default:
            return '平手';
    }
}
// Import
export function parseKifHeader(kif) {
    const lines = normalizedKifLines(kif);
    return parseKifPositionHeader(kif).unwrap((pos) => Result.ok(pos), () => {
        const handicapTag = lines.find((l) => l.startsWith('手合割：'));
        const handicap = defined(handicapTag)
            ? findHandicap({ japaneseName: handicapTag.split('：')[1] })
            : undefined;
        const hSfen = handicap === null || handicap === void 0 ? void 0 : handicap.sfen;
        const rules = detectVariant(hSfen === null || hSfen === void 0 ? void 0 : hSfen.split('/').length, handicapTag);
        return parseSfen(rules, hSfen !== null && hSfen !== void 0 ? hSfen : initialSfen(rules));
    });
}
function parseKifPositionHeader(kif, rulesOpt) {
    const lines = normalizedKifLines(kif);
    const handicapTag = lines.find((l) => l.startsWith('手合割：'));
    const rules = rulesOpt || detectVariant(lines.filter((l) => l.startsWith('|')).length, handicapTag);
    const goteHandStr = lines.find((l) => l.startsWith('後手の持駒：') || l.startsWith('上手の持駒：'));
    const senteHandStr = lines.find((l) => l.startsWith('先手の持駒：') || l.startsWith('下手の持駒：'));
    const turn = lines.some((l) => l.startsWith('後手番') || l.startsWith('上手番'))
        ? 'gote'
        : 'sente';
    const board = parseKifBoard(rules, kif);
    const goteHand = defined(goteHandStr)
        ? parseKifHand(rules, goteHandStr.split('：')[1])
        : Result.ok(Hand.empty());
    const senteHand = defined(senteHandStr)
        ? parseKifHand(rules, senteHandStr.split('：')[1])
        : Result.ok(Hand.empty());
    return board.chain((board) => goteHand.chain((gHand) => senteHand.chain((sHand) => initializePosition(rules, {
        board,
        hands: Hands.from(sHand, gHand),
        turn,
        moveNumber: 1,
    }, false))));
}
function detectVariant(lines, tag) {
    if (lines === 12)
        return 'chushogi';
    else if ((!defined(lines) || lines === 0 || lines === 5) &&
        defined(tag) &&
        tag.startsWith('手合割：京都'))
        return 'kyotoshogi';
    else if ((defined(tag) && tag.startsWith('手合割：5五')) || lines === 5)
        return 'minishogi';
    else if (defined(tag) && tag.startsWith('手合割：安南'))
        return 'annanshogi';
    else if (defined(tag) && tag.startsWith('手合割：王手'))
        return 'checkshogi';
    else
        return 'standard';
}
export function parseKifBoard(rules, kifBoard) {
    const lines = normalizedKifLines(kifBoard).filter((l) => l.startsWith('|'));
    if (lines.length === 0)
        return Result.err(new KifError(InvalidKif.Board));
    const board = Board.empty();
    const offset = lines.length - 1;
    let file = offset;
    let rank = 0;
    for (const l of lines) {
        file = offset;
        let gote = false;
        let prom = false;
        for (const c of l) {
            switch (c) {
                case '・':
                    file--;
                    break;
                case 'v':
                    gote = true;
                    break;
                case '成':
                    prom = true;
                    break;
                default: {
                    const cSoFar = rules === 'chushogi' && prom ? `成${c}` : c;
                    const roles = kanjiToRole(cSoFar);
                    const role = roles.find((r) => allRoles(rules).includes(r));
                    if (defined(role) && allRoles(rules).includes(role)) {
                        const square = parseCoordinates(file, rank);
                        if (!defined(square))
                            return Result.err(new KifError(InvalidKif.Board));
                        const piece = {
                            role: (prom && promote(rules)(role)) || role,
                            color: boolToColor(!gote),
                        };
                        board.set(square, piece);
                        prom = false;
                        gote = false;
                        file--;
                    }
                }
            }
        }
        rank++;
    }
    return Result.ok(board);
}
export function parseKifHand(rules, handPart) {
    const hand = Hand.empty();
    const pieces = handPart.replace(/　/g, ' ').trim().split(' ');
    if (handPart.includes('なし'))
        return Result.ok(hand);
    for (const piece of pieces) {
        for (let i = 0; i < piece.length; i++) {
            const roles = kanjiToRole(piece[i++]);
            const role = roles.find((r) => allRoles(rules).includes(r));
            if (!role || !handRoles(rules).includes(role))
                return Result.err(new KifError(InvalidKif.Hands));
            let countStr = '';
            while (i < piece.length &&
                ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'].includes(piece[i]))
                countStr += piece[i++];
            const count = Math.max(kanjiToNumber(countStr), 1) + hand.get(role);
            hand.set(role, count);
        }
    }
    return Result.ok(hand);
}
export function parseTags(kif) {
    return normalizedKifLines(kif)
        .filter((l) => !l.startsWith('#') && !l.startsWith('*'))
        .map((l) => l.replace('：', ':').split(/:(.*)/, 2));
}
export function normalizedKifLines(kif) {
    return kif
        .replace(/:/g, '：')
        .replace(/　/g, ' ') // full-width space to normal space
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l);
}
//
// KIF MOVES
//
export const chushogiKifMoveRegex = /((?:(?:[１２３４５６７８９]{1,2}|\d\d?)(?:十?[一二三四五六七八九十]))|仝|同)(\S{1,2})((?:（居食い）)|不成|成)?\s?[（|(|←]*((?:[１２３４５６７８９]{1,2}|\d\d?)(?:十?[一二三四五六七八九十]))[）|)]/;
function parseChushogiMove(kifMd, lastDest = undefined) {
    var _a;
    const match = kifMd.match(chushogiKifMoveRegex);
    if (match) {
        const dest = (_a = parseJapaneseSquare(match[1])) !== null && _a !== void 0 ? _a : lastDest;
        if (!defined(dest))
            return;
        return {
            from: parseJapaneseSquare(match[4]),
            to: dest,
            promotion: match[3] === '成',
        };
    }
    return;
}
export const kifMoveRegex = /((?:[１２３４５６７８９][一二三四五六七八九]|同\s?))(玉|飛|龍|角|馬|金|銀|成銀|桂|成桂|香|成香|歩|と)(不成|成)?\(([1-9][1-9])\)/;
export const kifDropRegex = /((?:[１２３４５６７８９][一二三四五六七八九]|同\s?))(飛|角|金|銀|桂|香|歩)打/;
// Parsing kif moves/drops
export function parseKifMoveOrDrop(kifMd, lastDest = undefined) {
    var _a;
    // Move
    const match = kifMd.match(kifMoveRegex);
    if (match) {
        const dest = (_a = parseJapaneseSquare(match[1])) !== null && _a !== void 0 ? _a : lastDest;
        if (!defined(dest))
            return;
        return {
            from: parseNumberSquare(match[4]),
            to: dest,
            promotion: match[3] === '成',
        };
    }
    else {
        // Drop
        const match = kifMd.match(kifDropRegex);
        if (!match || !match[1])
            return parseChushogiMove(kifMd, lastDest);
        return {
            role: kanjiToRole(match[2])[0],
            to: parseJapaneseSquare(match[1]),
        };
    }
}
function isLionDouble(kifMd) {
    const m = defined(kifMd) ? (kifMd || '').split('*')[0].trim() : '';
    return m.includes('一歩目') || m.includes('二歩目');
}
export function parseKifMovesOrDrops(kifMds, lastDest = undefined) {
    const mds = [];
    for (let i = 0; i < kifMds.length; i++) {
        const m = kifMds[i];
        let md;
        if (isLionDouble(m) && isLionDouble(kifMds[i + 1])) {
            const firstMove = parseChushogiMove(m);
            const secondMove = parseChushogiMove(kifMds[++i]);
            if (firstMove && secondMove && isMove(firstMove) && isMove(secondMove)) {
                md = { from: firstMove.from, to: secondMove.to, midStep: firstMove.to, promotion: false };
            }
        }
        else
            md = parseKifMoveOrDrop(m, lastDest);
        if (!md)
            return mds;
        lastDest = md.to;
        mds.push(md);
    }
    return mds;
}
// Making kif formatted moves/drops
export function makeKifMoveOrDrop(pos, md, lastDest) {
    var _a;
    const ms = pos.rules === 'chushogi' ? makeJapaneseSquareHalf : makeJapaneseSquare;
    if (isDrop(md)) {
        return `${ms(md.to) + roleToKanji(pos.rules)(md.role)}打`;
    }
    else {
        const sameSquareSymbol = pos.rules === 'chushogi' ? '仝' : '同　';
        const sameDest = (lastDest !== null && lastDest !== void 0 ? lastDest : (_a = pos.lastMoveOrDrop) === null || _a === void 0 ? void 0 : _a.to) === md.to;
        const moveDestStr = sameDest ? sameSquareSymbol : ms(md.to);
        const promStr = md.promotion ? '成' : '';
        const role = pos.board.getRole(md.from);
        if (!role)
            return undefined;
        if (pos.rules === 'chushogi') {
            if (defined(md.midStep)) {
                const isIgui = md.to === md.from && pos.board.has(md.midStep);
                const isJitto = md.to === md.from && !isIgui;
                const midDestStr = sameDest ? sameSquareSymbol : ms(md.midStep);
                const move1 = `一歩目 ${midDestStr}${roleToFullKanji(pos.rules)(role)} （←${ms(md.from)}）`;
                const move2 = '二歩目 ' +
                    moveDestStr +
                    roleToFullKanji(pos.rules)(role) +
                    (isIgui ? '（居食い）' : isJitto ? '(じっと)' : '') +
                    ' （←' +
                    ms(md.midStep) +
                    '）';
                return `${move1}\n${move2}`;
            }
            return `${moveDestStr + roleToFullKanji(pos.rules)(role) + promStr} （←${ms(md.from)}）`;
        }
        else
            return `${moveDestStr + roleToKanji(pos.rules)(role) + promStr}(${makeNumberSquare(md.from)})`;
    }
}
//# sourceMappingURL=kif.js.map