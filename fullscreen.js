(() => {
  'use strict';
  // Games with a built-in fullscreen control keep their existing toolbar.
  if (document.getElementById('aitech-fullscreen') || document.getElementById('fullscreen-btn')) return;
  const root = document.documentElement;
  const host = document.createElement('div');
  host.id = 'aitech-fullscreen';
  // Isolate the controls from each app's button styles and keyboard handlers.
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host{position:fixed!important;top:max(8px,env(safe-area-inset-top))!important;right:max(8px,env(safe-area-inset-right))!important;z-index:2147483647!important;display:block!important}
    button{font:600 13px/1.3 system-ui,sans-serif;color:#fff;background:#172235;border:1px solid #8996ab;border-radius:9px;padding:10px 13px;min-height:44px;cursor:pointer;box-shadow:0 2px 8px #0004;touch-action:manipulation}
    button:focus-visible{outline:3px solid #60cfff;outline-offset:3px}button:disabled{cursor:wait;opacity:.7}
    p{max-width:230px;margin:4px 0;padding:6px;background:#172235;color:#fff;border-radius:6px;font:12px/1.4 system-ui}p:empty{display:none}
  </style><button type="button" aria-pressed="false">⛶ 全画面</button><p role="status" aria-live="polite"></p>`;
  const button = shadow.querySelector('button');
  const status = shadow.querySelector('p');
  let expanded = false;
  const nativeElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function sync() {
    const active = !!nativeElement() || expanded;
    button.textContent = active ? '↙ 元に戻す' : '⛶ 全画面';
    button.setAttribute('aria-pressed', String(active));
    button.title = active ? '全画面を終了（Escキーでも戻れます）' : '全画面で表示';
    // A game may enter fullscreen on its own container. Keep the exit reachable.
    const parent = nativeElement();
    if (parent && !/^(CANVAS|VIDEO|IFRAME)$/.test(parent.tagName)) parent.append(host);
    else if (host.parentNode !== document.body) document.body.append(host);
  }
  function fallback() {
    expanded = true;
    root.classList.add('aitech-expanded');
    status.textContent = 'このブラウザでは画面内を最大表示しています。';
    sync();
    window.dispatchEvent(new Event('resize'));
  }
  button.addEventListener('click', async event => {
    event.stopPropagation();
    button.disabled = true;
    status.textContent = '';
    try {
      if (nativeElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        await exit.call(document);
      } else if (expanded) {
        expanded = false;
        root.classList.remove('aitech-expanded');
        window.dispatchEvent(new Event('resize'));
      } else {
        const enter = root.requestFullscreen || root.webkitRequestFullscreen;
        if (enter) {
          try { await enter.call(root); } catch { fallback(); }
        } else fallback();
      }
    } catch { status.textContent = '全画面を終了できませんでした。Escキーを押してください。'; }
    finally { button.disabled = false; sync(); button.focus({ preventScroll: true }); }
  });
  host.addEventListener('keydown', event => event.stopPropagation());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nativeElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      Promise.resolve(exit.call(document)).catch(() => {});
    }
    if (event.key === 'Escape' && expanded) {
      expanded = false;
      root.classList.remove('aitech-expanded');
      status.textContent = '';
      sync();
      window.dispatchEvent(new Event('resize'));
    }
  }, true);
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  const style = document.createElement('style');
  style.textContent = 'html.aitech-expanded,html:fullscreen{min-height:100%;overflow:auto}html.aitech-expanded body{min-height:100dvh}html.aitech-expanded main{max-width:none!important;width:100%!important;box-sizing:border-box}';
  document.head.append(style);
  document.body.append(host);
  sync();
})();
