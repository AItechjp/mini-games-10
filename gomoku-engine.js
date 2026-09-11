/* Freestyle Gomoku: 15x15, black first, five or more wins, no forbidden moves. */
(() => {
  'use strict';
  const SIZE = 15;
  const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  function create() {
    return { kind: 'gomoku', board: Array(SIZE * SIZE).fill(0), turn: 0, winner: null, lastMove: -1, winningLine: [] };
  }
  function lineAt(board, index) {
    const color = board[index];
    if (!color) return [];
    const row = Math.floor(index / SIZE), col = index % SIZE;
    for (const [dr, dc] of DIRECTIONS) {
      const line = [index];
      for (const sign of [-1, 1]) {
        let r = row + dr * sign, c = col + dc * sign;
        while (inside(r, c) && board[r * SIZE + c] === color) {
          line.push(r * SIZE + c); r += dr * sign; c += dc * sign;
        }
      }
      if (line.length >= 5) return line;
    }
    return [];
  }
  function move(state, index, player) {
    if (!state || state.kind !== 'gomoku' || state.winner !== null ||
        ![0, 1].includes(player) || state.turn !== player || !Number.isInteger(index) ||
        index < 0 || index >= SIZE * SIZE || state.board[index] !== 0) return false;
    state.board[index] = player + 1;
    state.lastMove = index;
    state.winningLine = lineAt(state.board, index);
    if (state.winningLine.length) state.winner = player;
    else if (state.board.every(Boolean)) state.winner = 'draw';
    else state.turn = 1 - player;
    return true;
  }
  function candidates(board) {
    const result = new Set();
    for (let i = 0; i < board.length; i++) if (board[i]) {
      const row = Math.floor(i / SIZE), col = i % SIZE;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const r = row + dr, c = col + dc;
        if (inside(r, c) && !board[r * SIZE + c]) result.add(r * SIZE + c);
      }
    }
    return result.size ? [...result] : board.some(Boolean) ? [] : [112];
  }
  function potential(board, index, color) {
    const row = Math.floor(index / SIZE), col = index % SIZE;
    let score = 0;
    for (const [dr, dc] of DIRECTIONS) {
      let count = 1, open = 0;
      for (const sign of [-1, 1]) {
        let r = row + dr * sign, c = col + dc * sign;
        while (inside(r, c) && board[r * SIZE + c] === color) {
          count++; r += dr * sign; c += dc * sign;
        }
        if (inside(r, c) && board[r * SIZE + c] === 0) open++;
      }
      if (count >= 5) return 1000000;
      if (open) score += [0, 2, 20, 240, 5000][count] * (open === 2 ? 5 : 1);
    }
    return score;
  }
  function chooseMove(state, player = state.turn) {
    if (state.winner !== null || state.turn !== player) return -1;
    const board = state.board, options = candidates(board);
    for (const color of [player + 1, 2 - player]) {
      for (const index of options) {
        board[index] = color;
        const wins = lineAt(board, index).length > 0;
        board[index] = 0;
        if (wins) return index;
      }
    }
    let best = -1, bestScore = -Infinity;
    for (const index of options) {
      const center = 14 - Math.abs(Math.floor(index / SIZE) - 7) - Math.abs(index % SIZE - 7);
      const score = potential(board, index, player + 1) + potential(board, index, 2 - player) * 1.15 + center;
      if (score > bestScore) { best = index; bestScore = score; }
    }
    return best;
  }
  globalThis.GomokuRules = Object.freeze({ SIZE, create, move, lineAt, chooseMove });
})();
