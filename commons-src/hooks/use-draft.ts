'use client';
import {useEffect, useMemo, useReducer, useRef} from 'react';
import {DraftSession} from '@/lib/drafts';
import {useUnsavedWarning} from './use-unsaved-warning';

export function useDraft<T>(scope: string, initial: T, validate: (value: unknown) => value is T, base = '') {
  // Initial values are an editing snapshot, not a live server-controlled form.
  const session = useMemo(() => new DraftSession(scope, initial, validate, base), [scope]);
  const [, refresh] = useReducer(n => n + 1, 0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try { session.load(window.sessionStorage); } catch { session.load(); }
    refresh();
    return () => { mounted.current = false; };
  }, [session]);
  useUnsavedWarning(session.dirty);
  return {
    value: session.value, base: session.base, ready: session.ready, dirty: session.dirty,
    recovered: session.recovered, stored: session.stored, issue: session.issue, sending: session.sending,
    setValue(next: T | ((previous: T) => T)) { session.change(typeof next === 'function' ? (next as (previous: T) => T)(session.value) : next); refresh(); },
    discard() { session.discard(); refresh(); },
    async submit(send: (value: T, operationId: (body: unknown) => string) => Promise<boolean>, reset: T | ((sent: T) => T), initial?: T) {
      if (!session.ready || session.sending) return false;
      session.sending = true; refresh();
      const sent = session.value;
      try {
        const ok = await send(sent, body => session.operationId(body));
        if (ok) session.acknowledge(sent, typeof reset === 'function' ? (reset as (sent: T) => T)(sent) : reset, initial);
        return ok;
      } finally { session.sending = false; if (mounted.current) refresh(); }
    }
  };
}
