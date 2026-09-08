(() => {
  'use strict';
  document.querySelectorAll('[data-mode-href]').forEach(button => {
    button.addEventListener('click', () => {
      const href = button.dataset.modeHref;
      if (href) window.location.href = href;
    });
  });
})();
