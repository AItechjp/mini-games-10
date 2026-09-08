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
    instructions: '表示されたお題をひらがなで入力。正しいひらがなを1文字入力するたびにその場で進み、最後の文字まで入ると自動で次のお題へ進みます。',
    roundMs: 20000,
    durationLabel: '20秒',

    create({ onScore, onToast }) {
      let running = false;
      let metricRaf = 0;
      let startedAt = 0;
      let rand = Math.random;
      let current = entries[0];
      let lastIndex = -1;
      let acceptedLength = 0;
      let completedScore = 0;
      let clears = 0;
      let correctChars = 0;
      let misses = 0;
      let composing = false;

      function metrics(now = performance.now()) {
        const total = correctChars + misses;
        const accuracy = total ? Math.round((correctChars / total) * 100) : 100;
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
        targetEl.textContent = '';
        Array.from(current).forEach((char, i) => {
          const span = document.createElement('span');
          span.textContent = char;
          span.className = i < acceptedLength ? 'done' : i === acceptedLength ? 'current' : 'pending';
          targetEl.appendChild(span);
        });
      }

      function nextEntry() {
        let idx = Math.floor(rand() * entries.length);
        if (entries.length > 1) {
          while (idx === lastIndex) idx = Math.floor(rand() * entries.length);
        }
        lastIndex = idx;
        current = entries[idx];
        acceptedLength = 0;
        input.value = '';
        renderTarget();
        hintEl.textContent = 'ひらがなを1文字ずつ入力';
      }

      function flashMiss() {
        input.classList.remove('shake');
        void input.offsetWidth;
        input.classList.add('shake');
      }

      function registerMiss() {
        misses += 1;
        flashMiss();
        onToast?.('MISS');
        const expected = Array.from(current)[acceptedLength] || '';
        hintEl.textContent = expected ? `次は「${expected}」` : 'ひらがなを入力';
      }

      function acceptCharacter(char) {
        const chars = Array.from(current);
        const expected = chars[acceptedLength];
        if (char !== expected) {
          registerMiss();
          return false;
        }

        acceptedLength += 1;
        correctChars += 1;
        completedScore += 20;
        onScore(completedScore);
        renderTarget();

        if (acceptedLength >= chars.length) {
          clears += 1;
          completedScore += 100;
          onScore(completedScore);
          onToast?.('GOOD!');
          nextEntry();
        } else {
          hintEl.textContent = 'そのまま次のひらがなを入力';
        }
        return true;
      }

      function consumeInput() {
        if (!running || composing) return;
        const value = normalize(input.value);
        if (!value) return;
        input.value = '';

        if (!isHiraganaOnly(value)) {
          registerMiss();
          hintEl.textContent = 'ひらがなだけ入力できます';
          renderMetrics();
          return;
        }

        for (const char of Array.from(value)) {
          if (!acceptCharacter(char)) break;
        }
        renderMetrics();
      }

      function handleInput(e) {
        if (!running || composing || e.isComposing) return;
        consumeInput();
      }

      function handleCompositionStart() {
        composing = true;
      }

      function handleCompositionEnd() {
        composing = false;
        if (!running) return;
        setTimeout(() => {
          if (running && input.value) consumeInput();
        }, 0);
      }

      function handleKeydown(e) {
        if (!running) return;
        if (e.key === 'Enter' && !e.isComposing && !composing) {
          e.preventDefault();
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

      input.addEventListener('input', handleInput);
      input.addEventListener('keydown', handleKeydown);
      input.addEventListener('compositionstart', handleCompositionStart);
      input.addEventListener('compositionend', handleCompositionEnd);
      input.addEventListener('paste', handlePaste);
      input.addEventListener('drop', handleDrop);
      input.addEventListener('blur', handleBlur);

      current = 'たいぴんぐ';
      acceptedLength = 0;
      renderTarget();
      input.disabled = true;
      input.readOnly = true;
      input.value = '';
      hintEl.textContent = 'スタート後、ひらがなを1文字ずつ入力';
      renderMetrics();

      return {
        start(seed) {
          rand = rng32((seed || 1) ^ 0x54A1C9);
          running = true;
          startedAt = performance.now();
          lastIndex = -1;
          acceptedLength = 0;
          completedScore = 0;
          clears = 0;
          correctChars = 0;
          misses = 0;
          composing = false;
          input.disabled = false;
          input.readOnly = false;
          input.value = '';
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
