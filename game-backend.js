(() => {
  'use strict';

  const cfg = window.SUPABASE_CONFIG || {};
  const ready = Boolean(cfg.enabled && cfg.url && cfg.publishableKey && window.supabase?.createClient);
  const TOKEN_KEY = 'mg20-player-token';
  const GAME_ID_BY_NUMBER = {
    1: 'target', 2: 'tap', 3: 'numbers', 4: 'stroop', 5: 'memory',
    6: 'math', 7: 'catch', 8: 'reaction', 9: 'typing', 10: 'higher',
    11: 'fps', 12: 'shooter', 14: 'type14', 15: 'puzzle15', 16: 'stealth16'
  };

  function playerToken() {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  }

  function pageMode() {
    const path = location.pathname.toLowerCase();
    if (path.endsWith('/online.html') || path.endsWith('online.html')) return 'online';
    return 'solo';
  }

  function activeGameId() {
    const n = Number(String(document.querySelector('#play-number')?.textContent || '').match(/(\d+)/)?.[1] || 0);
    if (GAME_ID_BY_NUMBER[n]) return GAME_ID_BY_NUMBER[n];
    const path = location.pathname.toLowerCase();
    if (path.endsWith('fps.html')) return 'fps';
    if (path.endsWith('shooting.html')) return 'shooter';
    if (path.endsWith('game15.html')) return 'puzzle15';
    if (path.endsWith('game16.html')) return 'stealth16';
    return '';
  }

  function currentRoomCode() {
    const display = String(document.querySelector('#room-code-display')?.textContent || '').trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(display)) return display;
    const input = String(document.querySelector('#room-code-input')?.value || '').trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(input) ? input : null;
  }

  let client = null;
  if (ready) {
    client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }

  async function recordScore({ gameId, mode = 'solo', score, durationMs = 0, roomCode = null, extra = {} }) {
    if (!client) throw new Error('BACKEND_NOT_CONFIGURED');
    const payload = {
      p_submission_id: crypto.randomUUID(),
      p_game_id: String(gameId || '').toLowerCase(),
      p_mode: mode,
      p_player_token: playerToken(),
      p_score: Math.max(0, Math.floor(Number(score) || 0)),
      p_duration_ms: Math.max(0, Math.floor(Number(durationMs) || 0)),
      p_room_code: roomCode,
      p_extra: extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {}
    };
    const { data, error } = await client.rpc('record_game_score', payload);
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function leaderboard(gameId, mode = 'solo', limit = 10) {
    if (!client) return [];
    const { data, error } = await client.rpc('get_game_leaderboard', {
      p_game_id: String(gameId || '').toLowerCase(),
      p_mode: mode,
      p_limit: limit
    });
    if (error) throw error;
    return data || [];
  }

  async function personalBest(gameId, mode = 'solo') {
    if (!client) return 0;
    const { data, error } = await client.rpc('get_personal_best', {
      p_game_id: String(gameId || '').toLowerCase(),
      p_mode: mode,
      p_player_token: playerToken()
    });
    if (error) throw error;
    return Number(data) || 0;
  }

  async function overview() {
    if (!client) return null;
    const { data, error } = await client.rpc('get_game_backend_overview');
    if (error) throw error;
    return data;
  }

  function ensureLeaderboardPanel() {
    const play = document.querySelector('#play');
    if (!play) return null;
    let panel = document.querySelector('#backend-leaderboard-panel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'backend-leaderboard-panel';
    panel.className = 'backend-panel';
    panel.innerHTML = '<div class="backend-panel-head"><div><span>GLOBAL BACKEND</span><strong>オンラインランキング</strong></div><small id="backend-submit-status">Supabase接続中</small></div><div id="backend-leaderboard" class="backend-leaderboard"><p>ランキングを読み込み中…</p></div>';
    play.appendChild(panel);
    return panel;
  }

  async function renderLeaderboard(gameId = activeGameId(), mode = pageMode()) {
    const panel = ensureLeaderboardPanel();
    const box = panel?.querySelector('#backend-leaderboard');
    if (!panel || !box || !gameId) return;
    if (!client) {
      box.innerHTML = '<p>バックエンド設定が見つかりません。</p>';
      return;
    }
    box.innerHTML = '<p>ランキングを読み込み中…</p>';
    try {
      const [rows, mine] = await Promise.all([leaderboard(gameId, mode, 10), personalBest(gameId, mode)]);
      if (!rows.length) {
        box.innerHTML = `<p>まだ記録がありません。最初の記録を作れます。<br><small>あなたのBEST: ${mine}</small></p>`;
        return;
      }
      box.innerHTML = `<div class="backend-my-best">あなたのBEST <strong>${mine}</strong></div><ol>${rows.map(row => `<li><span>#${row.rank} ${row.player_label}</span><strong>${row.score}</strong></li>`).join('')}</ol>`;
    } catch (error) {
      console.warn('[GameBackend] leaderboard failed', error);
      box.innerHTML = '<p>ランキングを取得できませんでした。</p>';
    }
  }

  let lastSubmission = { key: '', at: 0 };

  async function submitDetectedResult() {
    const stage = document.querySelector('#game-stage');
    const end = stage?.querySelector('.end-screen');
    if (!stage || !end || end.dataset.backendChecked === '1') return;
    end.dataset.backendChecked = '1';

    const gameId = activeGameId();
    const mode = pageMode();
    const score = Math.max(0, Math.floor(Number(document.querySelector('#score-value')?.textContent || 0)));
    const roomCode = mode === 'online' ? currentRoomCode() : null;
    if (!gameId || (mode === 'online' && !roomCode)) return;

    const key = `${mode}:${gameId}:${score}:${roomCode || '-'}`;
    const now = Date.now();
    if (lastSubmission.key === key && now - lastSubmission.at < 15000) return;
    lastSubmission = { key, at: now };

    const status = document.querySelector('#backend-submit-status');
    if (status) status.textContent = '記録を保存中…';
    try {
      const result = await recordScore({
        gameId,
        mode,
        score,
        durationMs: 20000,
        roomCode,
        extra: { page: location.pathname, resultText: String(end.textContent || '').trim().slice(0, 300) }
      });
      if (status) status.textContent = `保存済み / 世界 ${result?.global_rank || '-'} 位`;
      await renderLeaderboard(gameId, mode);
    } catch (error) {
      const msg = String(error?.message || '保存失敗');
      if (status) status.textContent = msg.includes('RATE_LIMITED') ? '保存済み' : '保存に失敗';
      console.warn('[GameBackend] score submit failed', error);
    }
  }

  function installGameInstrumentation() {
    const play = document.querySelector('#play');
    const stage = document.querySelector('#game-stage');
    if (!play || !stage) return;
    ensureLeaderboardPanel();

    const update = () => {
      if (!play.classList.contains('hidden')) {
        renderLeaderboard().catch(() => {});
        submitDetectedResult().catch(() => {});
      }
    };

    const observer = new MutationObserver(() => {
      clearTimeout(observer._timer);
      observer._timer = setTimeout(update, 80);
    });
    observer.observe(play, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    update();
  }

  async function installIndexStatus() {
    if (!client || !/index\.html$|\/$/.test(location.pathname)) return;
    const main = document.querySelector('main.wrap');
    if (!main || document.querySelector('#backend-status-card')) return;
    const section = document.createElement('section');
    section.id = 'backend-status-card';
    section.className = 'section backend-status-card';
    section.innerHTML = '<p class="eyebrow">LIVE BACKEND</p><h2>Supabase バックエンド</h2><p id="backend-overview-text">接続確認中…</p>';
    const hero = main.querySelector('.hero');
    hero?.insertAdjacentElement('afterend', section);
    try {
      const data = await overview();
      section.querySelector('#backend-overview-text').textContent = `稼働中 / 24時間スコア ${data?.scores24h ?? 0}件 / アクティブ部屋 ${data?.activeRooms ?? 0} / チャット ${data?.chat24h ?? 0}件`;
      section.dataset.state = 'online';
    } catch (error) {
      section.querySelector('#backend-overview-text').textContent = 'バックエンドに接続できませんでした。';
      section.dataset.state = 'error';
    }
  }

  window.GameBackend = {
    ready,
    client,
    playerToken,
    recordScore,
    leaderboard,
    personalBest,
    overview,
    renderLeaderboard
  };

  document.addEventListener('DOMContentLoaded', () => {
    installGameInstrumentation();
    installIndexStatus();
  });
})();
