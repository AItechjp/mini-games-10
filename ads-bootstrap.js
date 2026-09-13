(() => {
  'use strict';
  const config = window.SITE_ADSENSE || {};
  const status = document.documentElement.dataset;
  if (!config.enabled || !config.autoAds) {
    status.adsense = 'disabled';
    return;
  }
  if (!['aitechd.com', 'www.aitechd.com'].includes(location.hostname) ||
      !Array.isArray(config.paths) || !config.paths.includes(location.pathname)) {
    status.adsense = 'excluded';
    return;
  }
  if (!/^ca-pub-\d{16}$/.test(config.client)) {
    status.adsense = 'unconfigured';
    return;
  }
  // Loading the official script once is sufficient for modern Auto ads.
  // Do not fabricate ad-unit IDs or refresh/click advertisements from site code.
  if (document.querySelector('script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) return;
  const script = document.createElement('script');
  script.id = 'site-google-adsense';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(config.client);
  status.adsense = 'loading';
  script.addEventListener('load', () => { status.adsense = 'loaded'; });
  script.addEventListener('error', () => { status.adsense = 'unavailable'; });
  document.head.appendChild(script);
})();
