(() => {
  'use strict';
  document.documentElement.dataset.adsense = 'disabled';
  document.querySelectorAll('ins.adsbygoogle, [data-site-ad]').forEach(node => node.remove());
})();
