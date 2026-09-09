(() => {
  'use strict';

  const start = () => {
    const cfg = window.SITE_NINJA_ADMAX || {};
    if (cfg.enabled === false) return;

    const frameSrc = String(cfg.frameSrc || '').trim();
    if (!frameSrc) {
      document.documentElement.dataset.ninjaAdmax = 'unconfigured';
      return;
    }

    if (document.querySelector('[data-site-ninja-admax]')) return;

    const wrap = document.createElement('aside');
    wrap.className = 'site-ninja-admax';
    wrap.dataset.siteNinjaAdmax = 'true';
    wrap.setAttribute('aria-label', '広告');

    const label = document.createElement('div');
    label.className = 'site-ninja-admax-label';
    label.textContent = 'ADVERTISEMENT';

    const frame = document.createElement('iframe');
    frame.className = 'site-ninja-admax-frame';
    frame.src = frameSrc;
    frame.title = '広告';
    frame.loading = 'lazy';
    frame.scrolling = 'no';
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');
    frame.addEventListener('load', () => {
      document.documentElement.dataset.ninjaAdmax = 'active';
    }, { once: true });

    wrap.append(label, frame);

    if (!document.getElementById('site-ninja-admax-style')) {
      const style = document.createElement('style');
      style.id = 'site-ninja-admax-style';
      style.textContent = [
        '.site-ninja-admax{width:min(100%,1100px);margin:28px auto;padding:10px 12px;text-align:center;min-height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}',
        '.site-ninja-admax-label{font:700 9px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.16em;opacity:.46;margin-bottom:6px}',
        '.site-ninja-admax-frame{display:block;width:min(100%,728px);height:100px;border:0;background:transparent;overflow:hidden}',
        'html:fullscreen .site-ninja-admax,.play-section:not(.hidden)~.site-ninja-admax,.play-screen:not(.hidden)~.site-ninja-admax{display:none!important}',
        '@media(max-width:700px){.site-ninja-admax{margin:18px auto;padding:8px 4px;min-height:70px}.site-ninja-admax-frame{width:100%;height:80px}}'
      ].join('');
      document.head.appendChild(style);
    }

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
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
