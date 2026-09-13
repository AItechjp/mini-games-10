import { Annanshogi } from './annanshogi.js';
import { Checkshogi } from './checkshogi.js';
import { Chushogi } from './chushogi.js';
import { Dobutsu } from './dobutsu.js';
import { Kyotoshogi } from './kyotoshogi.js';
import { Minishogi } from './minishogi.js';
import { Shogi } from './shogi.js';
export function initializePosition(rules, setup, strict) {
    switch (rules) {
        case 'chushogi':
            return Chushogi.from(setup, strict);
        case 'minishogi':
            return Minishogi.from(setup, strict);
        case 'annanshogi':
            return Annanshogi.from(setup, strict);
        case 'kyotoshogi':
            return Kyotoshogi.from(setup, strict);
        case 'checkshogi':
            return Checkshogi.from(setup, strict);
        case 'dobutsu':
            return Dobutsu.from(setup, strict);
        default:
            return Shogi.from(setup, strict);
    }
}
//# sourceMappingURL=variant.js.map