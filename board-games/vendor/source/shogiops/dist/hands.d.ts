import type { Color, Role } from './types.js';
export declare class Hand {
    private handMap;
    private constructor();
    static empty(): Hand;
    static from(iter: Iterable<[Role, number]>): Hand;
    clone(): Hand;
    combine(other: Hand): Hand;
    get(role: Role): number;
    set(role: Role, cnt: number): void;
    drop(role: Role): void;
    capture(role: Role): void;
    equals(other: Hand): boolean;
    nonEmpty(): boolean;
    isEmpty(): boolean;
    count(): number;
    [Symbol.iterator](): Iterator<[Role, number]>;
}
export declare class Hands {
    private sente;
    private gote;
    private constructor();
    static empty(): Hands;
    static from(sente: Hand, gote: Hand): Hands;
    clone(): Hands;
    combine(other: Hands): Hands;
    color(color: Color): Hand;
    equals(other: Hands): boolean;
    count(): number;
    isEmpty(): boolean;
    nonEmpty(): boolean;
}
//# sourceMappingURL=hands.d.ts.map