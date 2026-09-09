(() => {
  'use strict';

  const optionBox = document.querySelector('#options');
  const quizView = document.querySelector('#quizView');
  if (!optionBox || !quizView) return;

  const visualButtons = () => [...optionBox.querySelectorAll('.option')]
    .sort((a, b) => Number(a.style.order || 0) - Number(b.style.order || 0));

  function shuffledRanks() {
    const ranks = [0, 1, 2, 3];
    for (let i = ranks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
    }
    return ranks;
  }

  function randomizeCurrentOptions() {
    const buttons = [...optionBox.querySelectorAll('.option')];
    if (buttons.length !== 4 || buttons.every((button) => button.dataset.visualOrderReady === '1')) return;

    const ranks = shuffledRanks();
    buttons.forEach((button, originalIndex) => {
      button.dataset.originalIndex = String(originalIndex);
      button.dataset.visualOrderReady = '1';
      button.style.order = String(ranks[originalIndex]);
    });

    visualButtons().forEach((button, visualIndex) => {
      const marker = button.querySelector('.num');
      if (marker) marker.textContent = String.fromCharCode(65 + visualIndex);
    });
  }

  const observer = new MutationObserver(() => queueMicrotask(randomizeCurrentOptions));
  observer.observe(optionBox, { childList: true });

  // The base quiz supports 1-4 shortcuts. Translate those keys to the shuffled
  // visual order before the base handler sees them.
  document.addEventListener('keydown', (event) => {
    if (!quizView.classList.contains('active')) return;
    if (!['1', '2', '3', '4'].includes(event.key)) return;
    const buttons = visualButtons();
    if (buttons.length !== 4 || buttons.every((button) => button.disabled)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    buttons[Number(event.key) - 1]?.click();
  }, true);

  // The base feedback references the original data position. After shuffling,
  // replace only that letter with the marker actually visible to the learner.
  optionBox.addEventListener('click', (event) => {
    if (!event.target.closest('.option')) return;
    queueMicrotask(() => {
      const headline = document.querySelector('#feedbackHeadline');
      const correctMarker = optionBox.querySelector('.option.correct .num');
      if (!headline || !correctMarker || !headline.textContent.startsWith('不正解')) return;
      headline.textContent = `不正解。正答は ${correctMarker.textContent}。`;
    });
  });
})();
