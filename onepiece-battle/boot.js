// A failed dependency must show a recovery action, not leave inert play buttons.
(() => {
  const status = document.getElementById('startup-status');
  const message = document.getElementById('startup-message');
  const retry = document.getElementById('startup-retry');
  retry.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('reload', String(Date.now()));
    location.replace(url.href);
  });
  const controls = [...document.querySelectorAll('button, input, select')]
    .filter(element => element !== retry && !element.disabled);
  controls.forEach(element => { element.disabled = true; });
  const fail = error => {
    status.hidden = false;
    status.setAttribute('role', 'alert');
    message.textContent = 'ゲームを読み込めませんでした。再読み込みして、もう一度お試しください。';
    retry.hidden = false;
    document.documentElement.dataset.gameReady = 'error';
    console.error('ONE PIECE startup failed:', error);
  };
  const slow = setTimeout(() => {
    message.textContent = 'ゲームの読み込みに時間がかかっています。通信を確認してください。';
    retry.hidden = false;
  }, 12000);
  // A fresh retry also refreshes the entry module; dependencies carry a release tag.
  const refresh = new URL(location.href).searchParams.get('reload');
  import('./app.mjs?v=20260919-art1' + (refresh ? '&reload=' + encodeURIComponent(refresh) : ''))
    .then(() => {
      clearTimeout(slow);
      controls.forEach(element => { element.disabled = false; });
      status.hidden = true;
      document.documentElement.dataset.gameReady = 'true';
    }).catch(error => { clearTimeout(slow); fail(error); });
})();
