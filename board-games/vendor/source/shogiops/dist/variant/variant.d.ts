import type { Result } from '@badrap/result';
import type { Setup } from '../types.js';
import { Annanshogi } from './annanshogi.js';
import { Checkshogi } from './checkshogi.js';
import { Chushogi } from './chushogi.js';
import { Dobutsu } from './dobutsu.js';
import { Kyotoshogi } from './kyotoshogi.js';
import { Minishogi } from './minishogi.js';
import type { PositionError } from './position.js';
import { Shogi } from './shogi.js';
export interface RulesTypeMap {
    standard: Shogi;
    minishogi: Minishogi;
    chushogi: Chushogi;
    annanshogi: Annanshogi;
    kyotoshogi: Kyotoshogi;
    checkshogi: Checkshogi;
    dobutsu: Dobutsu;
}
export declare function initializePosition<R extends keyof RulesTypeMap>(rules: R, setup: Setup, strict: boolean): Result<RulesTypeMap[R], PositionError>;
//# sourceMappingURL=variant.d.ts.map