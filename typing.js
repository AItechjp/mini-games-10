(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const jpEl = $('#typing-japanese');
  const targetEl = $('#typing-target');
  const input = $('#typing-input');
  const hintEl = $('#typing-input-hint');
  const cpmEl = $('#typing-wpm');
  const accuracyEl = $('#typing-accuracy');
  const missEl = $('#typing-miss');
  const clearsEl = $('#typing-words');
  const charsEl = $('#typing-keys');
  const keyboardBtn = $('#typing-keyboard-btn');
  const startButton = $('#arcade-start');

  const entries = [
    'さくら','富士山','新幹線','東京','名古屋','岐阜','日本','寿司','ラーメン','天ぷら',
    'ねこ','いぬ','ペンギン','とら','海','空','星','月','太陽','光',
    '未来','ゲーム','パソコン','キーボード','スマホ','音楽','映画','漫画','アニメ','スポーツ',
    'テニス','サッカー','野球','自転車','電車','飛行機','旅行','温泉','サウナ','花火',
    '祭り','公園','山','川','森','朝','昼','夜','おはよう','ありがとう',
    '楽しい','速い','強い','すごい','力','勝負','スピード','チャレンジ','タイピング','激速'
  ];

  const rng32 = seed => {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  const normalize = value => String(value || '').normalize('NFKC').trim();

  function primeKeyboard() {
    if (!input) return;
    input.disabled = false;
    input.readOnly = true;
    try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
    hintEl.textContent = '開始までそのまま待ってください';
  }

  keyboardBtn?.addEventListener('click', primeKeyboard);
  startButton?.addEventListener('pointerdown', primeKeyboard, { passive: true });

  window.ARCADE_GAME = {
    title: 'JAPANESE TYPE ATTACK',
    instructions: '表示された日本語を日本語IMEでそのまま入力。変換確定後、Enterで判定します。20秒で何問クリアできるか勝負。',
    roundMs: 20000,
    durationLabel: '20秒',

    create({ onScore, onToast }) {
      let running = false;
      let metricRaf = 0;
      let startedAt = 0;
      let rand = Math.random;
      let current = entries[0];
      let lastIndex = -1;
      let completedScore = 0;
      let clears = 0;
      let correctChars = 0;
      let misses = 0;
      let attempts = 0;
      let composing = false;

      function metrics(now = performance.now()) {
        const accuracy = attempts ? Math.round((clears / attempts) * 100) : 100;
        const elapsedMinutes = Math.max((now - startedAt) / 60000, 1 / 60000);
        const cpm = startedAt && correctChars ? Math.round(correctChars / elapsedMinutes) : 0;
        return { accuracy, cpm };
      }

      function renderMetrics(now = performance.now()) {
        const m = metrics(now);
        cpmEl.textContent = String(m.cpm);
        accuracyEl.textContent = `${m.accuracy}%`;
        missEl.textContent = String(misses);
        clearsEl.textContent = String(clears);
        charsEl.textContent = String(correctChars);
      }

      function renderTarget() {
        jpEl.textContent = current;
        targetEl.textContent = '日本語で入力 → Enter';
      }

      function nextEntry() {
        let idx = Math.floor(rand() * entries.length);
        if (entries.length > 1) {
          while (idx === lastIndex) idx = Math.floor(rand() * entries.length);
        }
        lastIndex = idx;
        current = entries[idx];
        input.value = '';
        renderTarget();
      }

      function flashMiss() {
        input.classList.remove('shake');
        void input.offsetWidth;
        input.classList.add('shake');
      }

      function submit() {
        if (!running || composing) return;
        const value = normalize(input.value);
        if (!value) return;
        attempts += 1;

        if (value === normalize(current)) {
          const len = Array.from(current).length;
          correctChars += len;
          clears += 1;
          completedScore += len * 20 + 100;
          onScore(completedScore);
          onToast?.('GOOD!');
          nextEntry();
        } else {
          misses += 1;
          flashMiss();
          onToast?.('MISS');
          input.value = '';
        }
        renderMetrics();
      }

      function handleKeydown(e) {
        if (!running) return;
        if (e.key !== 'Enter') return;
        if (e.isComposing || composing || e.keyCode === 229) return;
        e.preventDefault();
        submit();
      }

      function handleCompositionStart() {
        composing = true;
      }

      function handleCompositionEnd() {
        composing = false;
        if (!running) return;
        const value = normalize(input.value);
        if (value && value === normalize(current)) {
          submit();
        }
      }

      function handlePaste(e) { e.preventDefault(); }
      function handleDrop(e) { e.preventDefault(); }
      function handleBlur() {
        if (!running) return;
        setTimeout(() => {
          if (!running) return;
          try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
        }, 0);
      }

      function metricLoop(now) {
        if (!running) return;
        renderMetrics(now);
        metricRaf = requestAnimationFrame(metricLoop);
      }

      input.addEventListener('keydown', handleKeydown);
      input.addEventListener('compositionstart', handleCompositionStart);
      input.addEventListener('compositionend', handleCompositionEnd);
      input.addEventListener('paste', handlePaste);
      input.addEventListener('drop', handleDrop);
      input.addEventListener('blur', handleBlur);

      jpEl.textContent = 'タイピング';
      targetEl.textContent = '日本語で入力 → Enter';
      input.disabled = true;
      input.readOnly = true;
      input.value = '';
      hintEl.textContent = 'スタート後に日本語で入力できます';
      renderMetrics();

      return {
        start(seed) {
          rand = rng32((seed || 1) ^ 0x54A1C9);
          running = true;
          startedAt = performance.now();
          lastIndex = -1;
          completedScore = 0;
          clears = 0;
          correctChars = 0;
          misses = 0;
          attempts = 0;
          composing = false;
          input.disabled = false;
          input.readOnly = false;
          input.value = '';
          hintEl.textContent = '日本語IMEで入力して Enter';
          onScore(0);
          nextEntry();
          renderMetrics(startedAt);
          cancelAnimationFrame(metricRaf);
          metricRaf = requestAnimationFrame(metricLoop);
          try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
        },

        stop() {
          running = false;
          cancelAnimationFrame(metricRaf);
          input.readOnly = true;
          input.blur();
          const m = metrics(performance.now());
          renderMetrics();
          return { words: clears, cpm: m.cpm, accuracy: m.accuracy, misses, keys: correctChars };
        },

        destroy() {
          running = false;
          cancelAnimationFrame(metricRaf);
          input.removeEventListener('keydown', handleKeydown);
          input.removeEventListener('compositionstart', handleCompositionStart);
          input.removeEventListener('compositionend', handleCompositionEnd);
          input.removeEventListener('paste', handlePaste);
          input.removeEventListener('drop', handleDrop);
          input.removeEventListener('blur', handleBlur);
        }
      };
    }
  };
})();
