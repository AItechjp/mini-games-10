# Board Table

Seven games: freestyle Gomoku, standard Shogi, 9x9 Go (Chinese area, 7.5 komi,
positional superko, manual dead-group removal and score agreement), Othello,
Chess, and original compact Monopoly / Life variants. Local two-player or CPU.
The previous Gomoku online/puzzle edition stays linked in games-board.html.

The new application code is GPL-3.0-or-later. License texts and the original
Shogi rules source are in vendor/. Chess.js 1.4.0 (BSD-2-Clause),
shogiops 0.21.0 (GPL-3.0-or-later), Three.js 0.180.0 (MIT),
and @badrap/result (MIT) are used without modifications.

`scripts/build-board-vendor.mjs` and its two entrypoints reproduce the browser
bundles; the pinned installation command is at the top of that script.
Serve the repository over HTTP and open board-games/index.html. No network
service, account, or runtime CDN is needed. CPU searches run in a Web Worker.

Run `node tests/board-games.mjs` for legal-move counts, special moves, captures,
scoring, economy transitions and end-of-game invariants.
