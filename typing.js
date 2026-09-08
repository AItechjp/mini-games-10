(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const jpEl = $('#typing-japanese');
  const targetEl = $('#typing-target');
  const input = $('#typing-input');
  const hintEl = $('#typing-input-hint');
  const wpmEl = $('#typing-wpm');
  const accuracyEl = $('#typing-accuracy');
  const missEl = $('#typing-miss');
  const wordsEl = $('#typing-words');
  const keysEl = $('#typing-keys');
  const keyboardBtn = $('#typing-keyboard-btn');
  const startButton = $('#arcade-start');

  const entries = [
    ['さくら','sakura'],['ふじさん','fujisan'],['しんかんせん','shinkansen'],['とうきょう','toukyou'],['なごや','nagoya'],
    ['ぎふ','gifu'],['にほん','nihon'],['すし','sushi'],['らーめん','ramen'],['てんぷら','tenpura'],
    ['ねこ','neko'],['いぬ','inu'],['ぺんぎん','pengin'],['とら','tora'],['うみ','umi'],
    ['そら','sora'],['ほし','hoshi'],['つき','tsuki'],['たいよう','taiyou'],['ひかり','hikari'],
    ['みらい','mirai'],['げーむ','game'],['ぱそこん','pasokon'],['きーぼーど','keyboard'],['すまほ','sumaho'],
    ['おんがく','ongaku'],['えいが','eiga'],['まんが','manga'],['あにめ','anime'],['すぽーつ','sports'],
    ['てにす','tennis'],['さっかー','soccer'],['やきゅう','yakyuu'],['じてんしゃ','jitensha'],['でんしゃ','densha'],
    ['ひこうき','hikouki'],['りょこう','ryokou'],['おんせん','onsen'],['さうな','sauna'],['はなび','hanabi'],
    ['まつり','matsuri'],['こうえん','kouen'],['やま','yama'],['かわ','kawa'],['もり','mori'],
    ['あさ','asa'],['ひる','hiru'],['よる','yoru'],['おはよう','ohayou'],['ありがとう','arigatou'],
    ['たのしい','tanoshii'],['はやい','hayai'],['つよい','tsuyoi'],['すごい','sugoi'],['ちから','chikara'],
    ['しょうぶ','shoubu'],['すぴーど','speed'],['ちゃれんじ','challenge'],['たいぴんぐ','typing'],['げきはや','gekihaya']
  ].map(([jp, roman]) => ({ jp, roman }));

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
    title: 'TYPE ATTACK',
    instructions: '日本語のお題の下に表示されるローマ字を1文字ずつ入力。ミスした文字は自動で戻ります。20秒でスコアを伸ばそう。',
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
      let wordsDone = 0;
      let correctKeys = 0;
      let misses = 0;

      const currentScore = () => completedScore + acceptedLength * 10;

      function metrics(now = performance.now()) {
        const attempts = correctKeys + misses;
        const accuracy = attempts ? Math.round((correctKeys / attempts) * 100) : 100;
        const elapsedMinutes = Math.max((now - startedAt) / 60000, 1 / 60000);
        const wpm = startedAt && correctKeys ? Math.round((correctKeys / 5) / elapsedMinutes) : 0;
        return { accuracy, wpm };
      }

      function renderMetrics(now = performance.now()) {
        const m = metrics(now);
        wpmEl.textContent = String(m.wpm);
        accuracyEl.textContent = `${m.accuracy}%`;
        missEl.textContent = String(misses);
        wordsEl.textContent = String(wordsDone);
        keysEl.textContent = String(correctKeys);
      }

      function renderTarget() {
        targetEl.textContent = '';
        Array.from(current.roman).forEach((char, i) => {
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
        jpEl.textContent = current.jp;
        renderTarget();
      }

      function flashMiss() {
        input.classList.remove('shake');
        void input.offsetWidth;
        input.classList.add('shake');
      }

      function handleInput() {
        if (!running) return;
        const cleaned = input.value.toLowerCase().replace(/[^a-z]/g, '');
        if (cleaned !== input.value) input.value = cleaned;

        if (!current.roman.startsWith(cleaned)) {
          misses += 1;
          input.value = current.roman.slice(0, acceptedLength);
          flashMiss();
          onToast?.('MISS');
          renderMetrics();
          return;
        }

        if (cleaned.length > acceptedLength) correctKeys += cleaned.length - acceptedLength;
        acceptedLength = cleaned.length;
        renderTarget();

        if (acceptedLength === current.roman.length) {
          completedScore += current.roman.length * 10 + 50;
          wordsDone += 1;
          onScore(completedScore);
          nextEntry();
        } else {
          onScore(currentScore());
        }
        renderMetrics();
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
      input.addEventListener('paste', handlePaste);
      input.addEventListener('drop', handleDrop);
      input.addEventListener('blur', handleBlur);

      jpEl.textContent = 'たいぴんぐ';
      current = { jp: 'たいぴんぐ', roman: 'typing' };
      acceptedLength = 0;
      renderTarget();
      input.disabled = true;
      input.readOnly = true;
      input.value = '';
      hintEl.textContent = 'スタート後に入力できます';
      renderMetrics();

      return {
        start(seed) {
          rand = rng32((seed || 1) ^ 0x54A1C9);
          running = true;
          startedAt = performance.now();
          lastIndex = -1;
          acceptedLength = 0;
          completedScore = 0;
          wordsDone = 0;
          correctKeys = 0;
          misses = 0;
          input.disabled = false;
          input.readOnly = false;
          input.value = '';
          hintEl.textContent = 'ミスした文字は自動で戻ります';
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
          return { words: wordsDone, wpm: m.wpm, accuracy: m.accuracy, misses, keys: correctKeys };
        },

        destroy() {
          running = false;
          cancelAnimationFrame(metricRaf);
          input.removeEventListener('input', handleInput);
          input.removeEventListener('paste', handlePaste);
          input.removeEventListener('drop', handleDrop);
          input.removeEventListener('blur', handleBlur);
        }
      };
    }
  };
})();
