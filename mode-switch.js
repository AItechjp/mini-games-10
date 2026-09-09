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
