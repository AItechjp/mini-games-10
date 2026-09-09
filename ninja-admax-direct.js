(() => {
  'use strict';

  if (window.__SITE_NINJA_ADMAX_DIRECT__) return;
  window.__SITE_NINJA_ADMAX_DIRECT__ = true;

  const TAG_URL = 'https://adm.shinobi.jp/s/a842cdae220795e07a7c694eac25dbe7';
  const SLOT_ID = 'site-ninja-admax-direct';

  const ensureStyle = () => {
    if (document.getElementById('site-ninja-admax-direct-style')) return;
    const style = document.createElement('style');
    style.id = 'site-ninja-admax-direct-style';
    style.textContent = [
      '#site-ninja-admax-direct{width:min(100%,1100px);margin:24px auto;padding:8px 4px;text-align:center;min-height:60px;overflow:visible}',
      '#site-ninja-admax-direct .site-ninja-admax-label{font:700 9px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.16em;opacity:.45;margin-bottom:6px}',
      'html:fullscreen #site-ninja-admax-direct{display:none!important}',
      '@media(max-width:700px){#site-ninja-admax-direct{margin:16px auto;min-height:54px}}'
    ].join('');
    document.head.appendChild(style);
  };

  const moveSlot = () => {
    ensureStyle();
    const slot = document.getElementById(SLOT_ID);
    if (!slot) return;
    const hero = document.querySelector('.hero, .mega-hero, .classic-hero, .outbreak-hero, .wb-hero');
    const catalog = document.querySelector('#catalog, #games, #modes');
    const main = document.querySelector('main');
    if (hero?.parentNode) {
      hero.insertAdjacentElement('afterend', slot);
    } else if (catalog?.parentNode) {
      catalog.parentNode.insertBefore(slot, catalog);
    } else if (main) {
      main.insertAdjacentElement('afterbegin', slot);
    }
  };

  if (document.readyState === 'loading') {
    document.write(
      '<aside id="' + SLOT_ID + '" aria-label="広告">' +
        '<div class="site-ninja-admax-label">ADVERTISEMENT</div>' +
        '<!-- admax -->' +
        '<script src="' + TAG_URL + '"></script>' +
        '<!-- admax -->' +
      '</aside>'
    );
    document.addEventListener('DOMContentLoaded', moveSlot, { once: true });
  } else {
    ensureStyle();
    const slot = document.createElement('aside');
    slot.id = SLOT_ID;
    slot.setAttribute('aria-label', '広告');
    slot.innerHTML = '<div class="site-ninja-admax-label">ADVERTISEMENT</div>';
    const frame = document.createElement('iframe');
    frame.src = 'ninja-admax-frame.html';
    frame.title = '広告';
    frame.scrolling = 'no';
    frame.style.cssText = 'display:block;width:min(100%,728px);height:100px;border:0;margin:0 auto;background:transparent';
    slot.appendChild(frame);
    (document.querySelector('main') || document.body).appendChild(slot);
    moveSlot();
  }
})();
