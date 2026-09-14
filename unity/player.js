import {attachTouchInput} from './touch-input.mjs';

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('unity-canvas'), mode = document.body.dataset.game;
  const originalTitle = $('overlay-title').textContent;
  const originalDescription = $('description').textContent;
  let unity, state, muted = false, pauseRequested = false;
  const send = (method, value = '') => unity?.SendMessage('Arcade', method, value);
  const active = () => !!(unity && state?.playing && !state.paused);
  const input = attachTouchInput({
    buttons: document.querySelectorAll('[data-input]'), look:$('look-pad'), send, isActive:active,
  });
  const focus = () => canvas.focus({preventScroll:true});

  window.aitechUnityStatus = snapshot => {
    if (String(snapshot.game) !== mode) return;
    state = snapshot;
    window.aitechUnitySnapshot = state;
    if (!state.playing || state.paused) { input.reset(); pauseRequested = false; }
    const chapters = $('chapter-select');
    if (chapters) {
      for (const option of chapters.options) {
        option.disabled = Number(option.value) >= state.unlocked;
        option.textContent = String(Number(option.value) + 1).padStart(2, '0') + (option.disabled ? ' · 未解放' : '');
      }
      chapters.value = String(state.chapter - 1);
    }
    $('status').textContent = state.status;
    $('message').textContent = state.message;
    $('progress').style.width = (state.progress * 100) + '%';
    $('pause').textContent = state.paused ? '再開' : '一時停止';
    $('pause').disabled = !state.playing;
    $('overlay').hidden = state.playing && !state.paused;
    $('touch').style.visibility = state.playing && !state.paused ? 'visible' : 'hidden';
    if (state.finished) {
      $('phase').textContent = state.won ? 'CLEAR' : 'TRY AGAIN';
      $('overlay-title').textContent = state.won ? 'クリア！' : 'もう一度、挑戦。';
      $('description').textContent = state.message;
      $('start').textContent = 'もう一度遊ぶ';
      $('next').hidden = !(state.game === 1 && state.won && state.chapter < 18);
    } else if (state.paused) {
      $('phase').textContent = 'PAUSED';
      $('overlay-title').textContent = '一時停止';
      $('description').textContent = '準備ができたら再開してください。';
      $('start').textContent = '続ける';
      $('next').hidden = true;
    } else {
      $('phase').textContent = 'UNITY EDITION';
      $('overlay-title').textContent = originalTitle;
      $('description').textContent = originalDescription;
      $('start').textContent = mode === '2' ? '対戦を始める' : '冒険を始める';
      $('next').hidden = true;
    }
  };

  $('start').addEventListener('click', () => { send(state?.paused ? 'PauseGame' : 'StartGame'); focus(); });
  $('pause').addEventListener('click', () => { input.reset(); send('PauseGame'); focus(); });
  $('retry').addEventListener('click', () => {
    input.reset();
    if (active() && !pauseRequested) { pauseRequested = true; send('PauseGame'); }
    if (confirm('現在のプレイを最初からやり直しますか？')) send('Restart');
  });
  $('next').addEventListener('click', () => { input.reset(); send('NextChapter'); focus(); });
  $('quality').addEventListener('change', () => send('Quality', $('quality').value));
  $('mute').addEventListener('click', () => {
    muted = !muted;
    send('Mute', muted ? '1' : '0');
    $('mute').textContent = muted ? '音なし' : '音あり';
    $('mute').setAttribute('aria-pressed', String(muted));
  });
  for (const select of document.querySelectorAll('[data-option]')) {
    select.addEventListener('change', () => send('Option', select.dataset.option + ':' + select.value));
  }
  function touch(enabled) {
    if (!enabled) input.reset();
    $('touch').classList.toggle('enabled', enabled);
    $('touch-toggle').setAttribute('aria-pressed', String(enabled));
  }
  touch(matchMedia('(pointer:coarse)').matches);
  $('touch-toggle').addEventListener('click', () => touch(!$('touch').classList.contains('enabled')));
  function suspend() {
    input.reset();
    if (active() && !pauseRequested) { pauseRequested = true; send('PauseGame'); }
  }
  window.addEventListener('blur', suspend);
  window.addEventListener('pagehide', suspend);
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });

  // A failed or stalled download must leave a usable route back into the game.
  const reload = document.createElement('button');
  reload.id = 'load-retry';
  reload.type = 'button';
  reload.textContent = '再読み込み';
  reload.hidden = true;
  reload.addEventListener('click', () => window.location.reload());
  $('loading').append(reload);
  $('load-progress').setAttribute('aria-label', 'ゲームの読み込み');
  $('load-label').setAttribute('role', 'status');
  $('load-label').setAttribute('aria-live', 'polite');
  let loading = true, stallTimer, lastPercent = -1, announcedPercent = -1;
  function watchDownload() {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      if (!loading) return;
      $('load-label').textContent = '読み込みに時間がかかっています。通信状態を確認し、このまま待つか再読み込みしてください。';
      reload.hidden = false;
    }, 45000);
  }
  function failed(error) {
    loading = false;
    clearTimeout(stallTimer);
    $('phase').textContent = '読み込みを再試行';
    $('status').textContent = 'ゲームを起動できませんでした';
    $('load-label').textContent = '通信状態とブラウザの3D表示設定を確認して、再読み込みしてください。';
    reload.hidden = false;
    $('start').hidden = true;
    if (error) console.error(error);
  }
  const script = document.createElement('script');
  script.src = 'Build/Web.loader.js';
  script.onerror = () => failed();
  script.onload = async () => {
    try {
      if (typeof window.createUnityInstance !== 'function') throw new Error('Unity loader did not initialize');
      const instance = await window.createUnityInstance(canvas, {
        dataUrl:'Build/Web.data', frameworkUrl:'Build/Web.framework.js', codeUrl:'Build/Web.wasm',
        streamingAssetsUrl:'StreamingAssets', companyName:'AITECH', productName:'AITECH Unity Remakes',
        productVersion:'1.0', devicePixelRatio:Math.min(window.devicePixelRatio || 1, 1.5),
      }, progress => {
        if (!loading || !Number.isFinite(progress)) return;
        const value = Math.max(0, Math.min(1, progress));
        const percent = Math.round(value * 100);
        const recovering = !reload.hidden;
        $('load-progress').value = value;
        if (percent !== lastPercent) { lastPercent = percent; watchDownload(); reload.hidden = true; }
        const announcement = Math.floor(percent / 10) * 10;
        if (announcement !== announcedPercent || recovering) {
          announcedPercent = announcement;
          $('load-label').textContent = '読み込み ' + announcement + '%';
        }
      });
      loading = false;
      clearTimeout(stallTimer);
      unity = instance;
      window.aitechUnity = instance;
      send('SelectGame', mode);
      // Choices made while downloading must also apply to the actual game.
      send('Quality', $('quality').value);
      send('Mute', muted ? '1' : '0');
      for (const select of document.querySelectorAll('[data-option]')) {
        send('Option', select.dataset.option + ':' + select.value);
      }
      $('loading').hidden = true;
      $('start').hidden = false;
      $('start').disabled = false;
      $('retry').disabled = false;
      if (document.hidden) suspend();
    } catch (error) { failed(error); }
  };
  watchDownload();
  document.body.appendChild(script);
})();
