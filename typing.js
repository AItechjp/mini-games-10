(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const timeEl = $('#typing-time');
  const scoreEl = $('#typing-score');
  const wpmEl = $('#typing-wpm');
  const accuracyEl = $('#typing-accuracy');
  const missEl = $('#typing-miss');
  const bestEl = $('#typing-best');
  const wordsEl = $('#typing-words');
  const keysEl = $('#typing-keys');
  const jpEl = $('#typing-japanese');
  const targetEl = $('#typing-target');
  const input = $('#typing-input');
  const inputHint = $('#typing-input-hint');
  const overlay = $('#typing-overlay');
  const overlayTitle = $('#typing-overlay-title');
  const overlayMessage = $('#typing-overlay-message');
  const startBtn = $('#typing-start');

  const ROUND_MS = 20000;
  const BEST_KEY = 'mini20-best-type-attack';
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

  let running = false;
  let raf = 0;
  let startAt = 0;
  let endAt = 0;
  let current = entries[0];
  let previousRoman = '';
  let acceptedLength = 0;
  let completedScore = 0;
  let wordsDone = 0;
  let correctKeys = 0;
  let misses = 0;

  const getBest = () => {
    try { return Number(localStorage.getItem(BEST_KEY) || 0); }
    catch (_) { return 0; }
  };

  const setBest = score => {
    if (score <= getBest()) return;
    try { localStorage.setItem(BEST_KEY, String(score)); }
    catch (_) {}
  };

  const currentScore = () => completedScore + acceptedLength * 10;

  function nextEntry() {
    let next = current;
    while (entries.length > 1 && next.roman === previousRoman) {
      next = entries[Math.floor(Math.random() * entries.length)];
    }
    current = next;
    previousRoman = current.roman;
    acceptedLength = 0;
    input.value = '';
    jpEl.textContent = current.jp;
    renderTarget();
  }

  function renderTarget() {
    const word = current.roman;
    targetEl.textContent = '';
    Array.from(word).forEach((char, i) => {
      const span = document.createElement('span');
      span.textContent = char;
      span.className = i < acceptedLength ? 'done' : i === acceptedLength ? 'current' : 'pending';
      targetEl.appendChild(span);
    });
  }

  function elapsedMs(now = performance.now()) {
    if (!startAt) return 0;
    return Math.max(0, Math.min(ROUND_MS, now - startAt));
  }

  function metrics(now = performance.now()) {
    const attempts = correctKeys + misses;
    const accuracy = attempts ? Math.round((correctKeys / attempts) * 100) : 100;
    const minutes = Math.max(elapsedMs(now) / 60000, 1 / 60000);
    const wpm = running || correctKeys ? Math.round((correctKeys / 5) / minutes) : 0;
    return { accuracy, wpm };
  }

  function renderStats(now = performance.now()) {
    const m = metrics(now);
    scoreEl.textContent = String(currentScore());
    wpmEl.textContent = String(m.wpm);
    accuracyEl.textContent = `${m.accuracy}%`;
    missEl.textContent = String(misses);
    wordsEl.textContent = String(wordsDone);
    keysEl.textContent = String(correctKeys);
    bestEl.textContent = String(getBest());
  }

  function flashMiss() {
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
  }

  function handleInput() {
    if (!running) return;
    const raw = input.value.toLowerCase().replace(/[^a-z]/g, '');
    if (raw !== input.value) input.value = raw;

    if (!current.roman.startsWith(raw)) {
      misses += 1;
      input.value = current.roman.slice(0, acceptedLength);
      flashMiss();
      renderStats();
      return;
    }

    if (raw.length > acceptedLength) correctKeys += raw.length - acceptedLength;
    acceptedLength = raw.length;
    renderTarget();

    if (acceptedLength === current.roman.length) {
      completedScore += current.roman.length * 10 + 50;
      wordsDone += 1;
      nextEntry();
    }
    renderStats();
  }

  function timerLoop(now) {
    if (!running) return;
    const left = Math.max(0, endAt - now);
    timeEl.textContent = (left / 1000).toFixed(1);
    renderStats(now);
    if (left <= 0) {
      finish();
      return;
    }
    raf = requestAnimationFrame(timerLoop);
  }

  function showOverlay(title, html, buttonText) {
    overlayTitle.classList.remove('typing-countdown');
    overlayTitle.textContent = title;
    overlayMessage.innerHTML = html;
    startBtn.textContent = buttonText;
    startBtn.disabled = false;
    overlay.classList.remove('hidden');
  }

  function finish() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    timeEl.textContent = '0.0';
    input.readOnly = true;
    input.blur();
    const score = currentScore();
    setBest(score);
    renderStats(endAt);
    const m = metrics(endAt);
    overlayTitle.classList.remove('typing-countdown');
    overlayTitle.textContent = 'FINISH!';
    overlayMessage.innerHTML = `<div class="typing-result-grid">
      <div><span>SCORE</span><strong>${score}</strong></div>
      <div><span>BEST</span><strong>${getBest()}</strong></div>
      <div><span>WPM</span><strong>${m.wpm}</strong></div>
      <div><span>ACCURACY</span><strong>${m.accuracy}%</strong></div>
      <div><span>WORDS</span><strong>${wordsDone}</strong></div>
      <div><span>MISS</span><strong>${misses}</strong></div>
    </div>`;
    startBtn.textContent = 'もう一回';
    startBtn.disabled = false;
    overlay.classList.remove('hidden');
  }

  function resetRound() {
    cancelAnimationFrame(raf);
    running = false;
    startAt = 0;
    endAt = 0;
    acceptedLength = 0;
    completedScore = 0;
    wordsDone = 0;
    correctKeys = 0;
    misses = 0;
    timeEl.textContent = '20.0';
    input.disabled = false;
    input.readOnly = true;
    input.value = '';
    inputHint.textContent = 'カウントダウン後に入力開始';
    nextEntry();
    renderStats();
  }

  async function countdownAndStart() {
    resetRound();
    startBtn.disabled = true;
    input.focus({ preventScroll: true });
    overlayMessage.textContent = 'キーボードを構えて…';
    overlayTitle.classList.add('typing-countdown');

    for (const n of ['3', '2', '1']) {
      overlayTitle.textContent = n;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    overlayTitle.textContent = 'GO!';
    await new Promise(resolve => setTimeout(resolve, 250));
    overlay.classList.add('hidden');
    overlayTitle.classList.remove('typing-countdown');
    input.readOnly = false;
    inputHint.textContent = 'ミスした文字は自動で戻ります';
    input.focus({ preventScroll: true });
    running = true;
    startAt = performance.now();
    endAt = startAt + ROUND_MS;
    raf = requestAnimationFrame(timerLoop);
  }

  input.addEventListener('input', handleInput);
  input.addEventListener('paste', e => e.preventDefault());
  input.addEventListener('drop', e => e.preventDefault());
  input.addEventListener('blur', () => {
    if (running) setTimeout(() => input.focus({ preventScroll: true }), 0);
  });
  startBtn.addEventListener('click', countdownAndStart);

  bestEl.textContent = String(getBest());
  nextEntry();
  renderStats();
})();
