(() => {
  'use strict';

  const YEARS = {
    2026: {
      label: '令和8年',
      preliminary: {
        problem: 'https://www.moj.go.jp/jinji/shihoushiken/jinji07_00317.html',
        answer: 'https://www.moj.go.jp/jinji/shihoushiken/jinji07_00319.html'
      },
      bar: {
        problem: 'https://www.moj.go.jp/jinji/shihoushiken/jinji08_00295.html',
        answer: 'https://www.moj.go.jp/jinji/shihoushiken/jinji08_00296.html'
      }
    },
    2025: {
      label: '令和7年',
      preliminary: {
        problem: 'https://www.moj.go.jp/jinji/shihoushiken/jinji07_00287.html',
        answer: 'https://www.moj.go.jp/jinji/shihoushiken/jinji07_00289.html'
      },
      bar: {
        problem: 'https://www.moj.go.jp/jinji/shihoushiken/jinji08_00267.html',
        answer: 'https://www.moj.go.jp/jinji/shihoushiken/jinji08_00270.html'
      }
    },
    2024: {
      label: '令和6年',
      preliminary: {
        problem: 'https://www.moj.go.jp/jinji/shihoushiken/jinji07_00228.html',
        answer: 'https://www.moj.go.jp/jinji/shihoushiken/jinji07_00258.html'
      },
      bar: {
        problem: 'https://www.moj.go.jp/jinji/shihoushiken/jinji08_00241.html',
        answer: 'https://www.moj.go.jp/jinji/shihoushiken/jinji08_00245.html'
      }
    }
  };

  const BLOCKS = {
    preliminary: [
      { key: 'civil', title: '民法・商法・民事訴訟法', minutes: 90, detail: '同一問題冊子で3科目を解く本番ブロック', badge: '予備試験' },
      { key: 'public', title: '憲法・行政法', minutes: 60, detail: '同一問題冊子で2科目を解く本番ブロック', badge: '予備試験' },
      { key: 'criminal', title: '刑法・刑事訴訟法', minutes: 60, detail: '同一問題冊子で2科目を解く本番ブロック', badge: '予備試験' },
      { key: 'general', title: '一般教養科目', minutes: 90, detail: '公式問題冊子から本番どおり選択して解答', badge: '予備試験' }
    ],
    bar: [
      { key: 'constitutional', title: '憲法', minutes: 50, detail: '司法試験の公式短答式・憲法', badge: '司法試験' },
      { key: 'civil', title: '民法', minutes: 75, detail: '司法試験の公式短答式・民法', badge: '司法試験' },
      { key: 'criminal', title: '刑法', minutes: 50, detail: '司法試験の公式短答式・刑法', badge: '司法試験' }
    ]
  };

  const STORAGE_KEY = 'yobiPastOnlyProgressV1';
  const state = {
    exam: 'preliminary',
    year: 2026,
    current: null,
    timerRemaining: 0,
    timerId: null,
    running: false,
    progress: loadProgress()
  };

  const $ = id => document.getElementById(id);

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }
  function keyFor(exam, year, block) { return `${exam}:${year}:${block}`; }
  function getProgress(exam, year, block) {
    return state.progress[keyFor(exam, year, block)] || { completed: false, memo: '', updatedAt: null };
  }

  function renderYears() {
    const host = $('yearGroup');
    host.innerHTML = '';
    Object.keys(YEARS).sort((a,b)=>Number(b)-Number(a)).forEach(year => {
      const btn = document.createElement('button');
      btn.className = `year-btn${Number(year)===state.year?' active':''}`;
      btn.type = 'button';
      btn.textContent = `${YEARS[year].label} / ${year}`;
      btn.addEventListener('click', () => { state.year = Number(year); render(); });
      host.appendChild(btn);
    });
  }

  function renderExamToggle() {
    document.querySelectorAll('[data-exam]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.exam === state.exam);
      btn.onclick = () => {
        state.exam = btn.dataset.exam;
        render();
      };
    });
  }

  function renderPapers() {
    const host = $('paperGrid');
    const yearData = YEARS[state.year];
    const blocks = BLOCKS[state.exam];
    host.innerHTML = '';
    blocks.forEach(block => {
      const progress = getProgress(state.exam, state.year, block.key);
      const card = document.createElement('article');
      card.className = 'paper-card past-panel';
      card.innerHTML = `
        <div class="eyebrow">${block.badge} / ${yearData.label}</div>
        <h3>${block.title}</h3>
        <p>${block.detail}</p>
        <div class="paper-meta"><span class="chip">本番 ${block.minutes}分</span><span class="chip">法務省公式問題のみ</span><span class="chip">${progress.completed ? '完了済み' : '未完了'}</span></div>
        <div class="paper-actions"><button class="btn primary" type="button" data-start="${block.key}">${progress.completed ? 'もう一度解く' : '演習を開始'}</button><a class="btn ghost" href="${yearData[state.exam].problem}" target="_blank" rel="noopener noreferrer">公式問題ページ</a></div>`;
      host.appendChild(card);
    });
    host.querySelectorAll('[data-start]').forEach(btn => btn.addEventListener('click', () => startRunner(btn.dataset.start)));
  }

  function updateStats() {
    const keys = [];
    Object.keys(YEARS).forEach(year => {
      Object.entries(BLOCKS).forEach(([exam, blocks]) => blocks.forEach(block => keys.push(keyFor(exam, year, block.key))));
    });
    const completed = keys.filter(k => state.progress[k]?.completed).length;
    $('completedSets').textContent = completed;
    $('totalSets').textContent = keys.length;
    const updates = keys.map(k => state.progress[k]?.updatedAt).filter(Boolean).sort().reverse();
    $('lastStudy').textContent = updates.length ? new Date(updates[0]).toLocaleDateString('ja-JP') : '未開始';
  }

  function render() {
    renderYears();
    renderExamToggle();
    renderPapers();
    updateStats();
    $('currentScope').textContent = `${YEARS[state.year].label} ${state.exam === 'preliminary' ? '予備試験' : '司法試験'}`;
  }

  function startRunner(blockKey) {
    stopTimer();
    const block = BLOCKS[state.exam].find(x => x.key === blockKey);
    const yearData = YEARS[state.year];
    const p = getProgress(state.exam, state.year, blockKey);
    state.current = { exam: state.exam, year: state.year, blockKey, block, yearData };
    state.timerRemaining = block.minutes * 60;
    $('runnerLabel').textContent = `${yearData.label} / ${block.badge}`;
    $('runnerTitle').textContent = block.title;
    $('runnerDetail').textContent = `${block.minutes}分。法務省公式問題ページから該当する短答式PDFを開いて解いてください。`;
    $('officialProblem').href = yearData[state.exam].problem;
    $('officialAnswer').href = yearData[state.exam].answer;
    $('answerMemo').value = p.memo || '';
    $('markComplete').textContent = p.completed ? '完了済み（更新する）' : 'このセットを完了にする';
    $('runner').classList.add('active');
    $('runner').scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateTimerText();
  }

  function updateTimerText() {
    const min = Math.floor(state.timerRemaining / 60);
    const sec = state.timerRemaining % 60;
    $('timerText').textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }
  function startTimer() {
    if (!state.current || state.running) return;
    state.running = true;
    $('timerStart').textContent = '計測中';
    state.timerId = setInterval(() => {
      if (state.timerRemaining > 0) {
        state.timerRemaining -= 1;
        updateTimerText();
      } else {
        stopTimer();
        $('timerText').textContent = '終了';
      }
    }, 1000);
  }
  function pauseTimer() {
    if (!state.running) return;
    clearInterval(state.timerId);
    state.timerId = null;
    state.running = false;
    $('timerStart').textContent = '再開';
  }
  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
    state.running = false;
    if ($('timerStart')) $('timerStart').textContent = '開始';
  }
  function resetTimer() {
    if (!state.current) return;
    stopTimer();
    state.timerRemaining = state.current.block.minutes * 60;
    updateTimerText();
  }

  function persistCurrent(completed) {
    if (!state.current) return;
    const k = keyFor(state.current.exam, state.current.year, state.current.blockKey);
    state.progress[k] = {
      completed: Boolean(completed || state.progress[k]?.completed),
      memo: $('answerMemo').value,
      updatedAt: new Date().toISOString()
    };
    saveProgress();
    updateStats();
    renderPapers();
  }

  function closeRunner() {
    if (state.current) persistCurrent(false);
    stopTimer();
    $('runner').classList.remove('active');
    state.current = null;
  }

  function wire() {
    $('timerStart').addEventListener('click', startTimer);
    $('timerPause').addEventListener('click', pauseTimer);
    $('timerReset').addEventListener('click', resetTimer);
    $('closeRunner').addEventListener('click', closeRunner);
    $('answerMemo').addEventListener('input', () => {
      if (!state.current) return;
      const k = keyFor(state.current.exam, state.current.year, state.current.blockKey);
      state.progress[k] = { completed: state.progress[k]?.completed || false, memo: $('answerMemo').value, updatedAt: new Date().toISOString() };
      saveProgress();
    });
    $('markComplete').addEventListener('click', () => {
      persistCurrent(true);
      $('markComplete').textContent = '完了済み ✓';
    });
    $('resetPastProgress').addEventListener('click', () => {
      if (!confirm('過去問の進捗・メモをすべて削除しますか？')) return;
      closeRunner();
      localStorage.removeItem(STORAGE_KEY);
      state.progress = {};
      state.current = null;
      $('runner').classList.remove('active');
      render();
    });
  }

  window.YOBI_PAST_ONLY = { YEARS, BLOCKS };
  wire();
  render();
})();
