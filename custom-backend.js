(() => {
  'use strict';
  const cfg = window.SUPABASE_CONFIG || {};
  const ready = Boolean(cfg.enabled && cfg.url && cfg.publishableKey && window.supabase?.createClient);
  if (!ready) return;

  const client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const TOKEN_KEY = 'mg20-player-token';
  let armed = true;
  let saving = false;

  function uuid() {
    return crypto.randomUUID();
  }

  function playerToken() {
    let value = localStorage.getItem(TOKEN_KEY);
    if (!value) {
      value = uuid();
      localStorage.setItem(TOKEN_KEY, value);
    }
    return value;
  }

  function numberText(value) {
    const n = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }

  function clockMs(value) {
    const text = String(value || '').trim();
    const clock = text.match(/(\d+):([0-5]?\d(?:\.\d+)?)/);
    if (clock) return Math.max(0, Math.round((Number(clock[1]) * 60 + Number(clock[2])) * 1000));
    const seconds = Number(text.replace(/[^0-9.]/g, ''));
    return Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : 0;
  }

  function roomCode() {
    const shown = String(document.querySelector('#duel-room-code')?.textContent || '').trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(shown)) return shown;
    const entered = String(document.querySelector('#join-duel-code')?.value || '').trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(entered) ? entered : null;
  }

  function arcadeResult() {
    const overlay = document.querySelector('#arcade-overlay');
    if (!overlay || overlay.dataset.result !== '1') return null;
    const gameId = String(document.body.dataset.gameId || '').toLowerCase();
    if (!['fps', 'shooter', 'type-attack'].includes(gameId)) return null;
    const mode = new URLSearchParams(location.search).get('mode') === 'online' ? 'online' : 'solo';
    const title = String(overlay.querySelector('h2')?.textContent || '').trim();
    const displayScore = numberText(document.querySelector('#arcade-score')?.textContent);
    let durationMs = gameId === 'fps' ? clockMs(document.querySelector('#arcade-time')?.textContent) : 20000;
    if (gameId === 'fps' && durationMs <= 0) durationMs = 1;
    const score = gameId === 'fps' && mode === 'solo' ? Math.max(1, 3600000 - durationMs) : displayScore;
    return {
      gameId, mode, score, durationMs,
      roomCode: mode === 'online' ? roomCode() : null,
      extra: {
        outcome: title,
        displayScore,
        metric: gameId === 'fps' && mode === 'solo' ? 'faster-is-better' : 'score',
        resultText: String(document.querySelector('#overlay-message')?.textContent || '').trim().slice(0, 400)
      }
    };
  }

  function puzzleResult() {
    const title = String(document.querySelector('#p15-title')?.textContent || '').trim().toUpperCase();
    if (!title.startsWith('YOU WIN') && !title.startsWith('YOU LOSE')) return null;
    return {
      gameId: 'puzzle15', mode: 'solo',
      score: numberText(document.querySelector('#p15-score')?.textContent),
      durationMs: clockMs(document.querySelector('#p15-elapsed')?.textContent),
      roomCode: null,
      extra: { outcome: title, resultText: String(document.querySelector('#p15-message')?.textContent || '').trim().slice(0, 400) }
    };
  }

  function stealthResult() {
    const result = document.querySelector('#s16-result');
    if (!result || result.classList.contains('hidden')) return null;
    const outcome = String(document.querySelector('#s16-result-label')?.textContent || '').trim().toUpperCase();
    if (outcome !== 'WIN' && outcome !== 'LOSE') return null;
    const durationMs = clockMs(document.querySelector('#s16-result-time')?.textContent);
    const grade = String(document.querySelector('#s16-result-stealth')?.textContent || '').trim().toUpperCase();
    const bonus = { S: 300000, A: 200000, B: 100000, C: 50000 }[grade] || 0;
    const score = outcome === 'WIN' ? bonus + Math.max(0, 300000 - durationMs) : 0;
    return {
      gameId: 'stealth16', mode: 'solo', score, durationMs, roomCode: null,
      extra: {
        outcome,
        stealthGrade: grade,
        resultText: String(document.querySelector('#s16-overlay-message')?.textContent || '').trim().slice(0, 400)
      }
    };
  }

  function detectResult() {
    if (document.querySelector('#arcade-overlay')) return arcadeResult();
    if (document.querySelector('#p15-overlay')) return puzzleResult();
    if (document.querySelector('#s16-result')) return stealthResult();
    return null;
  }

  function badge(text, state) {
    let el = document.querySelector('#backend-save-badge');
    if (!el) {
      el = document.createElement('div');
      el.id = 'backend-save-badge';
      el.className = 'backend-save-badge';
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.dataset.state = state || 'idle';
    el.classList.add('show');
    clearTimeout(badge.timer);
    badge.timer = setTimeout(() => el.classList.remove('show'), state === 'error' ? 4500 : 2600);
  }

  async function submit(result) {
    if (!result || saving) return;
    if (result.mode === 'online' && !result.roomCode) {
      badge('部屋情報がないため結果保存を保留', 'error');
      return;
    }
    saving = true;
    badge('サーバーへ記録中…', 'idle');
    try {
      const { data, error } = await client.rpc('record_custom_game_score', {
        p_submission_id: uuid(),
        p_game_id: result.gameId,
        p_mode: result.mode,
        p_player_token: playerToken(),
        p_score: Math.max(0, Math.floor(Number(result.score) || 0)),
        p_duration_ms: Math.min(3600000, Math.max(0, Math.floor(Number(result.durationMs) || 0))),
        p_room_code: result.roomCode,
        p_extra: { ...result.extra, page: location.pathname }
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      badge(`サーバー保存済み / 世界 ${row?.global_rank || '-'} 位`, 'success');
    } catch (error) {
      const message = String(error?.message || '');
      badge(message.includes('RATE_LIMITED') ? 'サーバー保存済み' : 'サーバー保存に失敗', message.includes('RATE_LIMITED') ? 'success' : 'error');
      console.warn('[CustomBackend] result save failed', error);
    } finally {
      saving = false;
    }
  }

  function check() {
    const result = detectResult();
    if (!result) {
      armed = true;
      return;
    }
    if (!armed) return;
    armed = false;
    submit(result).catch(() => {});
  }

  function observe() {
    const target = document.querySelector('#arcade-overlay') || document.querySelector('#p15-overlay') || document.querySelector('#s16-result');
    if (!target) return;
    const observer = new MutationObserver(() => {
      clearTimeout(observer.timer);
      observer.timer = setTimeout(check, 80);
    });
    observer.observe(target, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-result'] });
    check();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
})();
