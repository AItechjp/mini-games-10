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
    'さくら','ふじさん','しんかんせん','とうきょう','なごや','ぎふ','にほん','すし','てんぷら','ねこ',
    'いぬ','ぺんぎん','とら','うみ','そら','ほし','つき','たいよう','ひかり','みらい',
    'おんがく','えいが','まんが','じてんしゃ','でんしゃ','ひこうき','りょこう','おんせん','はなび','まつり',
    'こうえん','やま','かわ','もり','あさ','ひる','よる','おはよう','ありがとう','たのしい',
    'はやい','つよい','すごい','ちから','しょうぶ','たいぴんぐ','げきはや','ともだち','がっこう','せんせい',
    'きょうしつ','としょかん','こうじょう','しごと','やすみ','ごはん','たまご','さかな','やさい','くだもの',
    'りんご','みかん','すいか','いちご','おちゃ','みず','あめ','ゆき','かぜ','くも',
    'はる','なつ','あき','ふゆ','きょう','あした','きのう','じかん','でんわ','しゃしん'
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
  const isHiraganaOnly = value => /^[ぁ-ゖ]+$/.test(value);

  function primeKeyboard() {
    if (!input) return;
    input.disabled = false;
    input.readOnly = true;
    try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
    hintEl.textContent = 'ひらがなキーボードを用意してください';
  }

  keyboardBtn?.addEventListener('click', primeKeyboard);
  startButton?.addEventListener('pointerdown', primeKeyboard, { passive: true });

  window.ARCADE_GAME = {
    title: 'HIRAGANA TYPE ATTACK',
    instructions: '表示されたお題を、ひらがなだけで入力してください。漢字・カタカナ・英字は不正解です。20秒で何問クリアできるか勝負。',
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
        targetEl.textContent = 'ひらがなで入力 → Enter';
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

      function registerMiss(message = 'ひらがなだけで入力') {
        misses += 1;
        attempts += 1;
        flashMiss();
        onToast?.('MISS');
        hintEl.textContent = message;
        input.value = '';
        renderMetrics();
      }

      function submit() {
        if (!running || composing) return;
        const value = normalize(input.value);
        if (!value) return;

        if (!isHiraganaOnly(value)) {
          registerMiss('漢字・カタカナ・英字は使えません');
          return;
        }

        attempts += 1;
        if (value === current) {
          const len = Array.from(current).length;
          correctChars += len;
          clears += 1;
          completedScore += len * 20 + 100;
          onScore(completedScore);
          onToast?.('GOOD!');
          hintEl.textContent = 'ひらがなだけで入力';
          nextEntry();
        } else {
          misses += 1;
          flashMiss();
          onToast?.('MISS');
          hintEl.textContent = 'お題と同じひらがなを入力';
          input.value = '';
        }
        renderMetrics();
      }

      function maybeAutoSubmit() {
        if (!running || composing) return;
        const value = normalize(input.value);
        if (value === current) submit();
      }

      function handleInput() {
        if (!running || composing) return;
        const value = normalize(input.value);
        if (!value) return;
        if (/[A-Za-zァ-ヶ一-龯々〆ヵヶ]/.test(value)) {
          hintEl.textContent = 'ひらがなのみ入力できます';
        } else {
          hintEl.textContent = 'ひらがなだけで入力';
        }
        maybeAutoSubmit();
      }

      function handleKeydown(e) {
        if (!running || e.key !== 'Enter') return;
        if (e.isComposing || composing || e.keyCode === 229) return;
        e.preventDefault();
        submit();
      }

      function handleCompositionStart() { composing = true; }
      function handleCompositionEnd() {
        composing = false;
        if (!running) return;
        maybeAutoSubmit();
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

      input.addEventListener('input', handleInput);
      input.addEventListener('keydown', handleKeydown);
      input.addEventListener('compositionstart', handleCompositionStart);
      input.addEventListener('compositionend', handleCompositionEnd);
      input.addEventListener('paste', handlePaste);
      input.addEventListener('drop', handleDrop);
      input.addEventListener('blur', handleBlur);

      jpEl.textContent = 'たいぴんぐ';
      targetEl.textContent = 'ひらがなで入力';
      input.disabled = true;
      input.readOnly = true;
      input.value = '';
      hintEl.textContent = 'スタート後にひらがなで入力できます';
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
          hintEl.textContent = 'ひらがなだけで入力';
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
          input.removeEventListener('input', handleInput);
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
