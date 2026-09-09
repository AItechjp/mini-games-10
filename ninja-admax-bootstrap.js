(() => {
  'use strict';

  const start = () => {
    const cfg = window.SITE_NINJA_ADMAX || {};
    if (cfg.enabled === false) return;

    const admaxId = String(cfg.admaxId || '').trim();
    if (!/^[A-Za-z0-9_-]{8,}$/.test(admaxId)) {
      document.documentElement.dataset.ninjaAdmax = 'unconfigured';
      return;
    }

    if (document.querySelector(`[data-site-ninja-admax="${CSS.escape(admaxId)}"]`)) return;

    const wrap = document.createElement('aside');
    wrap.className = 'site-ninja-admax';
    wrap.dataset.siteNinjaAdmax = admaxId;
    wrap.setAttribute('aria-label', '広告');

    const label = document.createElement('div');
    label.className = 'site-ninja-admax-label';
    label.textContent = 'ADVERTISEMENT';

    const slot = document.createElement('div');
    slot.className = cfg.type === 'banner' ? 'admax-ads' : 'admax-switch';
    slot.dataset.admaxId = admaxId;

    wrap.append(label, slot);

    const style = document.createElement('style');
    style.id = 'site-ninja-admax-style';
    style.textContent = [
      '.site-ninja-admax{width:min(100%,1100px);margin:28px auto;padding:10px 12px;text-align:center;min-height:74px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}',
      '.site-ninja-admax-label{font:700 9px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.16em;opacity:.46;margin-bottom:6px}',
      '.site-ninja-admax .admax-switch,.site-ninja-admax .admax-ads{max-width:100%}',
      '.play-section:not(.hidden)~.site-ninja-admax,.play-screen:not(.hidden)~.site-ninja-admax{display:none!important}',
      '@media(max-width:700px){.site-ninja-admax{margin:18px auto;padding:8px 4px;min-height:58px}}',
      '@media(display-mode:fullscreen){.site-ninja-admax{display:none!important}}'
    ].join('');
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    const hero = document.querySelector('.hero, .mega-hero, .classic-hero, .outbreak-hero, .wb-hero');
    const catalog = document.querySelector('#catalog, #games, #modes');
    const main = document.querySelector('main');
    if (cfg.placement === 'before-catalog' && catalog?.parentNode) {
      catalog.parentNode.insertBefore(wrap, catalog);
    } else if (hero?.parentNode) {
      hero.insertAdjacentElement('afterend', wrap);
    } else if (main) {
      main.insertAdjacentElement('afterbegin', wrap);
    } else {
      document.body.appendChild(wrap);
    }

    window.admaxads = window.admaxads || [];
    window.admaxads.push({ admax_id: admaxId, type: cfg.type === 'banner' ? 'banner' : 'switch' });

    if (!document.querySelector('script[data-site-ninja-admax-sdk]')) {
      const script = document.createElement('script');
      script.async = true;
      script.charset = 'utf-8';
      script.src = 'https://adm.shinobi.jp/st/t.js';
      script.dataset.siteNinjaAdmaxSdk = 'true';
      script.onload = () => { document.documentElement.dataset.ninjaAdmax = 'active'; };
      script.onerror = () => { document.documentElement.dataset.ninjaAdmax = 'error'; };
      document.body.appendChild(script);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
