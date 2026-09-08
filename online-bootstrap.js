(() => {
  'use strict';

  const createBtn = document.getElementById('create-room-btn');
  const joinBtn = document.querySelector('#join-form button[type="submit"]');
  const transportEl = document.getElementById('transport-name');
  const statusEl = document.getElementById('connection-status');
  const detailEl = document.getElementById('connection-detail');

  const setEnabled = enabled => {
    if (createBtn) createBtn.disabled = !enabled;
    if (joinBtn) joinBtn.disabled = !enabled;
  };

  const setTransport = text => {
    if (transportEl) transportEl.textContent = text;
  };

  setEnabled(false);

  const cfg = window.SUPABASE_CONFIG || {};
  const canUseSupabase = Boolean(
    cfg.enabled && cfg.url && cfg.publishableKey && window.SUPABASE_MULTIPLAYER_READY && window.SupabasePeer
  );

  if (canUseSupabase) {
    window.Peer = window.SupabasePeer;
    window.MULTIPLAYER_TRANSPORT = 'supabase';
    setTransport('Supabase Realtime');
    setEnabled(true);
    return;
  }

  window.MULTIPLAYER_TRANSPORT = 'peerjs';
  setTransport('PeerJS fallback');
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
  script.onload = () => setEnabled(true);
  script.onerror = () => {
    if (statusEl) statusEl.textContent = '対戦通信を読み込めませんでした';
    if (detailEl) detailEl.textContent = '通信環境を確認してページを再読み込みしてください。';
  };
  document.head.appendChild(script);
})();
