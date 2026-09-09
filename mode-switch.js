(() => {
  'use strict';

  const loadSiteAds = () => {
    if (document.querySelector('script[data-site-ads-config],script[src="ads-config.js"]')) return;
    const config = document.createElement('script');
    config.src = 'ads-config.js';
    config.dataset.siteAdsConfig = 'true';
    config.onload = () => {
      if (document.querySelector('script[data-site-ads-bootstrap],script[src="ads-bootstrap.js"]')) return;
      const bootstrap = document.createElement('script');
      bootstrap.src = 'ads-bootstrap.js';
      bootstrap.dataset.siteAdsBootstrap = 'true';
      document.head.appendChild(bootstrap);
    };
    document.head.appendChild(config);
  };
  loadSiteAds();

  const loadNinjaAdMax = () => {
    if (window.__SITE_NINJA_DIRECT_REQUESTED__) return;
    window.__SITE_NINJA_DIRECT_REQUESTED__ = true;
    if (document.readyState === 'loading') {
      document.write('<script src="ninja-admax-direct.js" data-site-ninja-direct></script>');
      return;
    }
    const script = document.createElement('script');
    script.src = 'ninja-admax-direct.js';
    script.dataset.siteNinjaDirect = 'true';
    document.head.appendChild(script);
  };
  loadNinjaAdMax();

  const loadNinjaAutoAds = () => {
    const autoId = '3d14f0b981955243bf1b454d41f64146';
    if (document.querySelector(`script[src="https://adm.shinobi.jp/st/auto.js"][data-admax-id="${autoId}"]`)) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://adm.shinobi.jp/st/auto.js';
    script.dataset.admaxId = autoId;
    script.dataset.siteNinjaAuto = 'true';
    document.head.appendChild(script);
  };
  loadNinjaAutoAds();

  document.querySelectorAll('.mode-switch-bar').forEach(bar => {
    if (!bar.querySelector('[data-mode-href="apps.html"]')) {
      const button = document.createElement('button');
      button.className = 'mode-switch-btn';
      button.dataset.modeHref = 'apps.html';
      button.textContent = 'アプリ100';
      bar.appendChild(button);
    }
  });
  document.querySelectorAll('[data-mode-href]').forEach(button => {
    button.addEventListener('click', () => {
      const href = button.dataset.modeHref;
      if (href) window.location.href = href;
    });
  });

  const footer = document.querySelector('footer');
  if (footer && !footer.querySelector('.site-legal-links')) {
    const target = footer.querySelector('.wrap') || footer;
    const nav = document.createElement('nav');
    nav.className = 'site-legal-links';
    nav.setAttribute('aria-label', '利用規約・プライバシー');
    nav.innerHTML = [
      '<a href="legal.html#terms">利用規約</a>',
      '<a href="legal.html#privacy">プライバシー</a>',
      '<a href="legal.html#transmission">外部送信</a>',
      '<a href="legal.html#commerce">法的情報</a>'
    ].join('<span aria-hidden="true">・</span>');
    target.appendChild(nav);

    if (!document.getElementById('site-legal-links-style')) {
      const style = document.createElement('style');
      style.id = 'site-legal-links-style';
      style.textContent = '.site-legal-links{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:10px;font-size:12px}.site-legal-links a{color:inherit;text-decoration:underline;text-underline-offset:3px;opacity:.9}.site-legal-links a:hover{opacity:1}.site-legal-links span{opacity:.45}';
      document.head.appendChild(style);
    }
  }
})();
