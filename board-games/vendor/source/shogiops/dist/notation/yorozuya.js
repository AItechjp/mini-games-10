import { defined } from '../util.js';
import { makeJapaneseMoveOrDrop } from './japanese.js';
const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export function makeYorozuyaMoveOrDrop(pos, md, lastDest) {
    const jpMove = makeJapaneseMoveOrDrop(pos, md, lastDest);
    return defined(jpMove) ? convertJapaneseToYorozuya(jpMove) : jpMove;
}
export function convertJapaneseToYorozuya(jp) {
    return (jp
        .replace('不成', '')
        .replace(/成$/, 'ナル')
        // matches full width numbers
        .replace(/[\d\uFF10-\uFF19]+/g, (match) => {
        const normalized = match.replace(/[\uFF10-\uFF19]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xff10 + 48));
        const index = Number.parseInt(normalized, 10) - 1;
        return DIZHI[index] || match;
    }));
}
//# sourceMappingURL=yorozuya.js.map