import { ROLES } from './constants.js';
// Hand alone can store any role
export class Hand {
    constructor(handMap) {
        this.handMap = handMap;
    }
    static empty() {
        return new Hand(new Map());
    }
    static from(iter) {
        return new Hand(new Map(iter));
    }
    clone() {
        return Hand.from(this.handMap);
    }
    combine(other) {
        const h = Hand.empty();
        for (const role of ROLES)
            h.set(role, this.get(role) + other.get(role));
        return h;
    }
    get(role) {
        var _a;
        return (_a = this.handMap.get(role)) !== null && _a !== void 0 ? _a : 0;
    }
    set(role, cnt) {
        this.handMap.set(role, cnt);
    }
    drop(role) {
        this.set(role, this.get(role) - 1);
    }
    capture(role) {
        this.set(role, this.get(role) + 1);
    }
    equals(other) {
        return ROLES.every((role) => this.get(role) === other.get(role));
    }
    nonEmpty() {
        return ROLES.some((role) => this.get(role) > 0);
    }
    isEmpty() {
        return !this.nonEmpty();
    }
    count() {
        return ROLES.reduce((acc, role) => acc + this.get(role), 0);
    }
    *[Symbol.iterator]() {
        for (const [role, num] of this.handMap) {
            if (num > 0)
                yield [role, num];
        }
    }
}
export class Hands {
    constructor(sente, gote) {
        this.sente = sente;
        this.gote = gote;
    }
    static empty() {
        return new Hands(Hand.empty(), Hand.empty());
    }
    static from(sente, gote) {
        return new Hands(sente, gote);
    }
    clone() {
        return new Hands(this.sente.clone(), this.gote.clone());
    }
    combine(other) {
        return new Hands(this.sente.combine(other.sente), this.gote.combine(other.gote));
    }
    color(color) {
        if (color === 'sente')
            return this.sente;
        else
            return this.gote;
    }
    equals(other) {
        return this.sente.equals(other.sente) && this.gote.equals(other.gote);
    }
    count() {
        return this.sente.count() + this.gote.count();
    }
    isEmpty() {
        return this.sente.isEmpty() && this.gote.isEmpty();
    }
    nonEmpty() {
        return !this.isEmpty();
    }
}
//# sourceMappingURL=hands.js.map