(() => {
  'use strict';
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
})();
