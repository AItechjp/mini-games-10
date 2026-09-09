(() => {
  'use strict';

  const cfg = window.SITE_ADSENSE || {};
  if (cfg.enabled === false) return;

  const client = String(cfg.client || '').trim();
  if (!/^ca-pub-\d{10,}$/.test(client)) {
    document.documentElement.dataset.adsense = 'unconfigured';
    return;
  }

  if (document.querySelector('script[data-site-adsense]')) return;

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.siteAdsense = 'true';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  script.onload = () => {
    document.documentElement.dataset.adsense = 'active';
  };
  script.onerror = () => {
    document.documentElement.dataset.adsense = 'error';
  };
  document.head.appendChild(script);
})();
