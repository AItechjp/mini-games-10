(() => {
  'use strict';

  const game = window.ARCADE_GAME;
  if (!game || typeof game.create !== 'function') return;

  game.roundMs = 180000;
  game.durationLabel = '3分';
  game.instructions = 'PCはW/Sで前後、A/Dで旋回、Space/クリックで射撃。スマホは左半分ドラッグで移動＋旋回、右半分ドラッグで視点旋回、短くタップで射撃。制限時間は3分です。';

  const baseCreate = game.create.bind(game);

  function addFullscreenButton() {
    const button = document.getElementById('fps-fullscreen');
    const shell = document.querySelector('.arcade-shell');
    if (!button || !shell || button.dataset.bound === '1') return;
    button.dataset.bound = '1';

    const supported = Boolean(shell.requestFullscreen || shell.webkitRequestFullscreen);
    if (!supported) {
      button.disabled = true;
      button.textContent = '全画面非対応';
      return;
    }

    const isFullscreen = () => document.fullscreenElement === shell || document.webkitFullscreenElement === shell;
    const update = () => { button.textContent = isFullscreen() ? '全画面を終了' : '全画面で遊ぶ'; };

    button.addEventListener('click', async () => {
      try {
        if (isFullscreen()) {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        } else {
          if (shell.requestFullscreen) await shell.requestFullscreen({ navigationUI: 'hide' });
          else if (shell.webkitRequestFullscreen) shell.webkitRequestFullscreen();
          try { await screen.orientation?.lock?.('landscape'); } catch (_) {}
        }
      } catch (_) {
        button.textContent = '全画面にできません';
        setTimeout(update, 1300);
      }
    });
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    update();
  }

  function injectFullscreenCss() {
    if (document.getElementById('fps-fullscreen-css')) return;
    const style = document.createElement('style');
    style.id = 'fps-fullscreen-css';
    style.textContent = `
      .fps-touch-hint{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:3;pointer-events:none;background:rgba(0,0,0,.45);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:800;white-space:nowrap}
      .arcade-shell:fullscreen,.arcade-shell:-webkit-full-screen{width:100vw;height:100vh;border:0;border-radius:0;display:flex;flex-direction:column;background:#030711}
      .arcade-shell:fullscreen .arcade-canvas-wrap,.arcade-shell:-webkit-full-screen .arcade-canvas-wrap{flex:1;min-height:0;aspect-ratio:auto}
      .arcade-shell:fullscreen .arcade-canvas,.arcade-shell:-webkit-full-screen .arcade-canvas{width:100%;height:100%}
      @media(max-width:760px){.arcade-shell:fullscreen .arcade-help,.arcade-shell:-webkit-full-screen .arcade-help{display:none}.fps-touch-hint{font-size:10px;bottom:6px}}
    `;
    document.head.appendChild(style);
  }

  game.create = function createWithTouch(args) {
    const engine = baseCreate(args);
    const canvas = args.canvas;
    const controlsRoot = args.controlsRoot;
    if (!canvas) return engine;

    injectFullscreenCss();
    addFullscreenButton();

    const wrap = canvas.closest('.arcade-canvas-wrap');
    if (wrap && !wrap.querySelector('.fps-touch-hint')) {
      const hint = document.createElement('div');
      hint.className = 'fps-touch-hint';
      hint.textContent = '左ドラッグ: 移動 / 右ドラッグ: 視点 / タップ: 射撃';
      wrap.appendChild(hint);
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#06101d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '900 46px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('FPS ARENA', canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = '#aeb9d4';
      ctx.font = '700 18px system-ui';
      ctx.fillText('MOVE • AIM • SHOOT • 3 MINUTES', canvas.width / 2, canvas.height / 2 + 34);
      ctx.textAlign = 'start';
    }

    const buttons = {};
    controlsRoot?.querySelectorAll('[data-fps]').forEach(btn => { buttons[btn.dataset.fps] = btn; });
    const held = new Set();
    const dispatch = (action, down) => {
      const btn = buttons[action];
      if (!btn) return;
      if (down && held.has(action)) return;
      if (!down && !held.has(action)) return;
      if (down) held.add(action); else held.delete(action);
      btn.dispatchEvent(new Event(down ? 'pointerdown' : 'pointerup', { bubbles: true, cancelable: true }));
    };
    const releaseAll = () => ['left','right','forward','back'].forEach(a => dispatch(a, false));
    const fire = () => {
      const btn = buttons.shoot;
      if (btn) btn.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    };

    let touch = null;
    const touchLike = e => e.pointerType === 'touch' || e.pointerType === 'pen';

    const onDown = e => {
      if (!touchLike(e)) return;
      if (touch && touch.id !== e.pointerId) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const rect = canvas.getBoundingClientRect();
      touch = {
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        x: e.clientX,
        y: e.clientY,
        at: performance.now(),
        zone: e.clientX - rect.left < rect.width * 0.48 ? 'move' : 'aim'
      };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    };

    const onMove = e => {
      if (!touchLike(e) || !touch || touch.id !== e.pointerId) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const dx = e.clientX - touch.sx;
      const dy = e.clientY - touch.sy;
      touch.x = e.clientX; touch.y = e.clientY;

      if (Math.abs(dx) > 15) {
        dispatch(dx > 0 ? 'right' : 'left', true);
        dispatch(dx > 0 ? 'left' : 'right', false);
      } else {
        dispatch('left', false); dispatch('right', false);
      }

      if (touch.zone === 'move') {
        if (Math.abs(dy) > 20) {
          dispatch(dy < 0 ? 'forward' : 'back', true);
          dispatch(dy < 0 ? 'back' : 'forward', false);
        } else {
          dispatch('forward', false); dispatch('back', false);
        }
      }
    };

    const onUp = e => {
      if (!touchLike(e) || !touch || touch.id !== e.pointerId) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const dx = e.clientX - touch.sx;
      const dy = e.clientY - touch.sy;
      const distance = Math.hypot(dx, dy);
      const elapsed = performance.now() - touch.at;
      releaseAll();
      if (distance < 14 && elapsed < 330) fire();
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      touch = null;
    };

    canvas.addEventListener('pointerdown', onDown, { capture: true, passive: false });
    canvas.addEventListener('pointermove', onMove, { capture: true, passive: false });
    canvas.addEventListener('pointerup', onUp, { capture: true, passive: false });
    canvas.addEventListener('pointercancel', onUp, { capture: true, passive: false });

    const baseDestroy = engine.destroy?.bind(engine);
    engine.destroy = () => {
      releaseAll();
      canvas.removeEventListener('pointerdown', onDown, true);
      canvas.removeEventListener('pointermove', onMove, true);
      canvas.removeEventListener('pointerup', onUp, true);
      canvas.removeEventListener('pointercancel', onUp, true);
      baseDestroy?.();
    };
    return engine;
  };

  document.addEventListener('DOMContentLoaded', () => {
    injectFullscreenCss();
    addFullscreenButton();
  }, { once: true });
})();
