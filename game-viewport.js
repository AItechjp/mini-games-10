(() => {
  'use strict';
  const root = document.documentElement, kind = root.dataset.aitechGame;
  if (!kind || document.getElementById('aitech-game-toolbar')) return;
  const $ = selector => document.querySelector(selector);
  const native = () => document.fullscreenElement || document.webkitFullscreenElement;
  const landscape = () => innerWidth > innerHeight;
  let focused = false, requested = false, dismissed = false, fallback = false;
  let wasNative = false, locked = false, pending = false, frame = 0, scrollYBefore = 0;
  const moved = [];
  const toolbar = document.createElement('div');
  toolbar.id = 'aitech-game-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'ゲームの表示と操作');
  toolbar.innerHTML = `<a href="/games-2d.html" aria-label="2Dゲーム一覧に戻る">← 2D</a><strong id="aitech-play-title"></strong><span id="aitech-rotate-tip">スマホを横向きにすると大きく遊べます</span><button id="aitech-play-view" type="button">通常表示</button><button id="aitech-play-settings" type="button" aria-haspopup="dialog">ゲーム設定</button><button id="aitech-play-fullscreen" type="button" aria-pressed="false">⛶ 横向き全画面</button><span data-aitech-guide-slot></span>`;
  const menu = document.createElement('dialog');
  menu.id = 'aitech-play-menu';
  menu.setAttribute('aria-labelledby', 'aitech-play-menu-title');
  menu.innerHTML = `<div class="aitech-menu-heading"><h2 id="aitech-play-menu-title">ゲーム設定</h2><button id="aitech-play-close" type="button">ゲームに戻る</button></div><div id="aitech-play-menu-content"></div>`;
  const notice = document.createElement('p');
  notice.id = 'aitech-play-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  document.body.prepend(toolbar);
  document.body.append(menu, notice);
  const full = $('#aitech-play-fullscreen'), view = $('#aitech-play-view');
  const content = $('#aitech-play-menu-content');
  const selectors = {
    'quick-hop': ['#sound'],
    startrail: ['#restart'],
    'lantern-duo': ['#soundButton', '#helpButton'],
    trump: ['.layout aside', '.heading nav'],
    babanuki: ['.sidebar', '#rules-button'],
    board: ['.settings', '#rules-open', '.quick-rules', '#history', '#motion'],
    classic: ['.classic-mode-bar', '.classic-deluxe-bar', '#lobby', '#rules-btn', '#new-game-btn'],
    'quiz-raid': ['#sound'],
    'cyber-quiz': ['#sound', '#help'],
  };
  function move(element, parent) {
    if (!element || moved.some(record => record.element === element)) return;
    const marker = document.createComment('game-viewport-position');
    element.before(marker);
    moved.push({element, marker});
    parent.append(element);
  }
  function moveControls() {
    for (const selector of selectors[kind] || []) move($(selector), content);
    // Keep the exact existing input nodes, handlers and live score updates.
    if (kind === 'board') {
      let players = $('#aitech-board-players');
      if (!players) {
        players = document.createElement('div'); players.id = 'aitech-board-players';
        $('.sidebar')?.prepend(players);
      }
      for (const label of document.querySelectorAll('.arena .player-label')) move(label, players);
    }
    if (kind === 'quick-hop') move($('.touch'), $('.game-shell'));
    // Restart is in a hidden keyboard legend in the original mobile layout.
    if (kind === 'startrail') move($('#restart'), content);
  }
  function restoreControls() {
    for (const {element, marker} of moved.splice(0).reverse()) {
      if (marker.isConnected) marker.replaceWith(element);
    }
    $('#aitech-board-players')?.remove();
  }
  function setFocus(value) {
    if (focused === value) { if (value) moveControls(); return; }
    focused = value;
    if (value) scrollYBefore = window.scrollY;
    root.classList.toggle('aitech-play-mode', value);
    if (value) { moveControls(); window.scrollTo(0, 0); }
    else { if (menu.open) menu.close(); restoreControls(); window.scrollTo(0, scrollYBefore); }
    // Canvas renderers and 3D decorations already listen for layout changes.
    window.dispatchEvent(new Event('resize'));
  }
  function label() {
    const titles = {'quick-hop':'QUICK HOP',startrail:'STARTRAIL','lantern-duo':'LANTERN DUO',babanuki:'ババ抜き','quiz-raid':'QUIZ RAID','cyber-quiz':'CYBER DUO'};
    $('#aitech-play-title').textContent = titles[kind] || $('#game-title')?.textContent || $('#title')?.textContent || '2Dゲーム';
  }
  function measure() {
    frame = 0;
    const viewport = window.visualViewport;
    // Pinch zoom must retain the user's chosen magnification.
    const height = viewport && viewport.scale === 1 ? viewport.height : innerHeight;
    root.style.setProperty('--aitech-play-height', `${Math.round(height)}px`);
    const wanted = landscape() && (requested || (!dismissed && innerHeight <= 720));
    setFocus(wanted);
    view.textContent = focused ? '通常表示' : '画面を広げる';
    view.setAttribute('aria-pressed', String(focused));
    const active = !!native() || fallback;
    full.textContent = active ? '↙ 全画面を終了' : '⛶ 横向き全画面';
    full.setAttribute('aria-pressed', String(active));
    $('#aitech-rotate-tip').hidden = landscape();
    $('#aitech-play-settings').hidden = !focused;
    label();
    if (focused && kind === 'board') {
      const panel = $('.board-panel'), board = $('#board');
      if (panel && board && !board.classList.contains('track')) {
        const css = getComputedStyle(panel);
        const used = [...panel.children].filter(el => el !== board).reduce((sum, el) => {
          const s = getComputedStyle(el);
          return sum + el.getBoundingClientRect().height + (parseFloat(s.marginTop)||0) + (parseFloat(s.marginBottom)||0);
        }, 0);
        const size = Math.max(60, Math.min(panel.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight), panel.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) - used));
        root.style.setProperty('--aitech-board-size', `${Math.floor(size)}px`);
      }
    }
    if (focused && kind === 'classic') {
      const hand = $('.you-area .hand');
      if (hand) {
        const count = hand.children.length;
        const rows = count <= 8 ? 1 : count <= 18 ? 2 : 3;
        hand.style.setProperty('--hand-columns', Math.max(1, Math.ceil(count / rows)));
        hand.style.setProperty('--hand-rows', rows);
      }
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(measure); }
  function unlock() {
    if (locked) { try { screen.orientation?.unlock?.(); } catch {} locked = false; }
  }
  function say(message) { notice.textContent = message; }
  async function enter() {
    if (pending || native()) return;
    pending = true; full.disabled = true;
    requested = true; dismissed = false; say(''); schedule();
    try {
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!request) throw new Error('fullscreen-unavailable');
      // This call stays in the initiating tap's user-activation task.
      await request.call(root, {navigationUI:'hide'});
      wasNative = !!native();
      if (screen.orientation?.lock) {
        try { await screen.orientation.lock('landscape'); locked = true; } catch {}
      }
      if (!landscape()) say('スマホを横向きに回してください。');
    } catch {
      fallback = true;
      say(landscape() ? 'ゲームを画面いっぱいに表示しています。' : 'スマホを横向きに回すと、画面いっぱいで遊べます。');
    } finally { pending = false; full.disabled = false; schedule(); }
  }
  async function leave() {
    requested = false; fallback = false; dismissed = true; unlock(); say('');
    try {
      if (native()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } catch { say('全画面を終了するには、端末の戻る操作かEscキーを使ってください。'); }
    schedule();
  }
  full.addEventListener('click', () => { if (native() || fallback) void leave(); else void enter(); });
  view.addEventListener('click', () => {
    if (focused) void leave();
    else { requested = true; dismissed = false; if (!landscape()) void enter(); schedule(); }
  });
  $('#aitech-play-settings').addEventListener('click', () => {
    if (!focused) return;
    document.dispatchEvent(new CustomEvent('aitech:guide-open'));
    root.setAttribute('data-aitech-guide-open', '');
    menu.showModal();
  });
  const closeMenu = () => { menu.close(); $('#aitech-play-settings').focus({preventScroll:true}); };
  $('#aitech-play-close').addEventListener('click', closeMenu);
  menu.addEventListener('close', () => {
    root.removeAttribute('data-aitech-guide-open');
    document.dispatchEvent(new CustomEvent('aitech:guide-close'));
  });
  // Existing game-specific full-screen controls also use the same fallback and
  // orientation handling; intercept before their older handlers can run.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('#fullscreen-btn,#fullscreenButton,#fullscreen,#fullscreen-button');
    if (button) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (native() || fallback) void leave(); else void enter();
    }
  }, true);
  document.addEventListener('fullscreenchange', () => {
    const active = !!native();
    if (wasNative && !active) { requested = false; fallback = false; dismissed = true; unlock(); say(''); }
    wasNative = active; schedule();
  });
  document.addEventListener('webkitfullscreenchange', schedule);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.open && (native() || fallback || focused)) void leave();
  });
  for (const type of ['keydown','keyup','pointerdown','pointerup']) {
    toolbar.addEventListener(type, event => event.stopPropagation());
  }
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => { dismissed = false; schedule(); });
  window.addEventListener('pagehide', unlock);
  document.addEventListener('change', schedule);
  // Bound observation to layouts that really change, not the per-frame HUD.
  for (const selector of ['.board-panel', '#game-stage', '.classic-shell', '#play']) {
    const target = $(selector);
    if (target) new MutationObserver(schedule).observe(target, {childList:true, subtree:true});
  }
  if (kind === 'board') new ResizeObserver(schedule).observe($('.play-area'));
  measure();
})();
