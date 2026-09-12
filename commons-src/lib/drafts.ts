// Temporary, tab-local recovery only. Shared records remain authoritative in D1.
export const DRAFT_PREFIX = 'commons:draft:v1:';
export const DRAFT_TTL = 24 * 60 * 60 * 1000;
const MAX_ENTRY = 240000;
const MAX_DRAFTS = 12;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
type Attempt = {id: string; signature: string};
type Envelope<T> = {version: 1; scope: string; updated: number; value: T; base: string; attempt?: Attempt};
export const draftScope = (...parts: string[]) => JSON.stringify(parts);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export class DraftSession<T> {
  value: T;
  base: string;
  ready = false;
  recovered = false;
  stored = false;
  issue = '';
  sending = false;
  private storage?: StorageLike;
  private attempt?: Attempt;
  private lastWritten: string | null = null;
  readonly key: string;
  constructor(readonly scope: string, public initial: T, readonly validate: (value: unknown) => value is T, readonly initialBase = '') {
    this.value = initial;
    this.base = initialBase;
    this.key = DRAFT_PREFIX + scope;
  }
  get dirty() { return !equal(this.value, this.initial) || this.base !== this.initialBase || !!this.attempt; }
  load(storage?: StorageLike, now = Date.now()) {
    if (this.ready) return;
    this.storage = storage;
    this.ready = true;
    if (!storage) { this.issue = 'このブラウザーでは下書きを一時保存できません。移動前に入力をコピーしてください。'; return; }
    try {
      const raw = storage.getItem(this.key);
      this.lastWritten = raw;
      if (!raw) return;
      const d: Envelope<T> = raw.length <= MAX_ENTRY ? JSON.parse(raw) : null;
      if (!d || d.version !== 1 || d.scope !== this.scope || !Number.isFinite(d.updated) || d.updated > now + 60000 || now - d.updated > DRAFT_TTL || typeof d.base !== 'string' || d.base.length > 100 || !this.validate(d.value) || (d.attempt && (typeof d.attempt.signature !== 'string' || typeof d.attempt.id !== 'string' || !/^[a-f0-9-]{36}$/.test(d.attempt.id)))) {
        storage.removeItem(this.key);
        this.lastWritten = null;
        this.issue = '古い形式、期限切れ、または読み取れない下書きは復元しませんでした。共有済みの内容には影響しません。';
        return;
      }
      this.value = d.value; this.base = d.base; this.attempt = d.attempt;
      this.recovered = this.dirty; this.stored = true;
    } catch {
      this.issue = '下書きを読み込めませんでした。共有済みの内容には影響しません。';
    }
  }
  change(value: T) { if (!this.ready || equal(value, this.value)) return; this.value = value; this.persist(); }
  operationId(body: unknown) {
    const signature = JSON.stringify(body);
    if (this.attempt?.signature !== signature) this.attempt = {id: crypto.randomUUID(), signature};
    this.persist();
    return this.attempt!.id;
  }
  acknowledge(sent: T, reset: T, initial: T = reset) {
    this.attempt = undefined;
    // A slow acknowledgement must never erase text typed after submission.
    if (equal(this.value, sent)) { this.value = reset; this.initial = initial; this.base = this.initialBase; this.recovered = false; }
    this.persist();
  }
  discard() { this.value = this.initial; this.base = this.initialBase; this.attempt = undefined; this.recovered = false; this.persist(); }
  private persist(now = Date.now()) {
    this.stored = false;
    if (!this.ready || !this.storage) return;
    try {
      const current = this.storage.getItem(this.key);
      if (current !== this.lastWritten) {
        this.issue = '別の入力欄で更新された下書きを保護しています。この入力は一時保存できないため、移動前にコピーしてください。';
        return;
      }
      if (!this.dirty) { this.storage.removeItem(this.key); this.lastWritten = null; this.issue = ''; return; }
      // Expire only old drafts; never silently evict another unsent draft.
      if (current === null) {
      const keys: string[] = [];
      for (let i = 0; i < this.storage.length; i++) { const key = this.storage.key(i); if (key?.startsWith(DRAFT_PREFIX)) keys.push(key); }
      let live = 0;
      for (const key of keys) {
        try { const d = JSON.parse(this.storage.getItem(key) ?? 'null'); if (Number.isFinite(d?.updated) && now - d.updated > DRAFT_TTL) { this.storage.removeItem(key); continue; } } catch { /* Keep unrelated unreadable drafts. */ }
        live++;
      }
      if (live >= MAX_DRAFTS) throw new Error('draft limit');
      }
      const raw = JSON.stringify({version: 1, scope: this.scope, updated: now, value: this.value, base: this.base, attempt: this.attempt});
      if (raw.length > MAX_ENTRY) throw new Error('draft too large');
      this.storage.setItem(this.key, raw);
      this.lastWritten = raw;
      this.stored = true; this.issue = '';
    } catch { this.issue = '下書きを一時保存できませんでした。入力はこの画面に残っています。移動前にコピーしてください。'; }
  }
}

export type MessageDraft = {text: string; group: string; parent: string | null};
export function isMessageDraft(value: unknown): value is MessageDraft {
  const v = value as MessageDraft | null;
  return !!v && typeof v.text === 'string' && v.text.length <= 10000 && typeof v.group === 'string' && v.group.length <= 100 && (v.parent === null || (typeof v.parent === 'string' && v.parent.length <= 100));
}
export type EditorDraft = {text: string; group: string; assignee: string; due: string; detail: string; url: string; minutes: number; date: string; values: string[]};
export function isEditorDraft(value: unknown): value is EditorDraft {
  const v = value as EditorDraft | null;
  return !!v && ['text','group','assignee','due','detail','url','date'].every(k => typeof v[k as keyof EditorDraft] === 'string' && String(v[k as keyof EditorDraft]).length <= 10000) && Number.isFinite(v.minutes) && Array.isArray(v.values) && v.values.length <= 20 && v.values.every(x => typeof x === 'string' && x.length <= 10000);
}
