# AITECH GAMES — online arcade

The home page retains BLACK SITE, SKYBREAK RIVALS, and AETHER DUEL. The new `/arcade100/` application contains 100 playable rule sets, with 56 PvP and 44 cooperative titles. The previous home page remains available at `/archive.html`.

## Runtime and delivery

- Static HTML, CSS and native ES modules. The hub does not initialize a game engine, authentication session, or realtime connection.
- Canvas 2D with three generated sprite atlases. The shipped WebP assets total 1,993,520 bytes, reduced from 7,394,364 PNG bytes. Images are decoded once and cropped at draw time; all 100 games share them.
- Eight engine families share physics, projections, state serialization, input validation, and results. Individual title rules live in `arcade100/engines/`. `catalog.mjs` is the production catalog; the older `roadmap/` file records the earlier proposal.
- One static artifact is produced by `scripts/build-static.mjs`. It excludes tests, backend code, scripts, plans, development dependencies and original PNG assets. Existing applications and legal pages remain in the artifact.
- GitHub Pages continues serving `https://aitechd.com/`. The existing Cloudflare Pages workflow is retained, but its configured API token failed verification during this work. No credentials were copied, changed, or added to browser code.

## Multiplayer

`arcade-rooms` is a Supabase Edge Function in project `dcvtubivtextycifngtk`. It implements guest authentication using a 256-bit random token, stores only its SHA-256 digest, validates P-256 public keys, bounds request sizes, rate-limits requests, enforces room capacity and readiness, and uses revision compare-and-swap for concurrent changes.

`arcade_rooms` and `arcade_rate_limits` have RLS enabled and no browser read/write grants. Only the service role inside the Edge Function can access them. No privileged key is shipped to clients. Rooms expire after six hours; expired records are removed during room creation.

Peers derive pairwise AES-GCM keys through ECDH. Both signaling and gameplay packets are encrypted, bound to the room and sender/recipient IDs, and checked for replay. The Realtime topic is a random 192-bit name. Its transport is public; confidentiality and sender authentication are supplied by the pairwise encryption, not by an assumption that public channels enforce RLS.

WebRTC DataChannels are preferred. If NAT/firewall rules prevent a direct connection, the same encrypted packets travel through Supabase Realtime. No camera or microphone permission is requested. Inputs, state updates and heartbeats are throttled. Direct snapshots use up to 15 Hz; relay snapshots use 2.5 Hz. Action commands are retried and deduplicated by the host.

The host simulates the casual game and sends each guest only their permitted view. Hidden hands, roles, answers and order queues are removed from guest projections. The host can inspect its own simulation; this is a friend-room architecture, not a cheat-resistant ranked backend. Scores are room-local and do not write to a global leaderboard.

The host saves checkpoints about every five seconds. Guest credentials and ECDH identity remain in sessionStorage so a reload in the same tab can resume. Guest input clears after a one-second silence. A host disconnect pauses practical play until that host returns; there is no automatic host migration. Closing the tab permanently loses that tab's guest identity. Supabase quotas and costs still apply, especially when many rooms require relay simultaneously; this release is not a claim of unbounded concurrency.

SKYBREAK uses the same room service and transport. The host runs its existing fighter simulation at a shared 1280×720 logical resolution. Guest controls use the same keyboard, touch and gamepad mapping as local Player 1. Snapshots preserve grabs and projectile-owner references. BLACK SITE retains its existing online co-op implementation. AETHER DUEL retains its separate server-authoritative 200-card online backend and public Site.

## Validation

- `node tests/arcade-games.mjs`: all 100 games initialize, replay deterministically, return permitted projections and finish on their deadlines; additional rule tests exercise bombs, reversi, connect four, hidden fleets, ordered cooperative cards, mines, laser mirrors, shared clues and sealed bidding.
- `node tests/arcade-online.mjs`: guest authorization, concurrent joins, capacity, readiness, private checkpoint recovery, encrypted packets, tamper rejection and teardown.
- `node tests/arcade-online-live.mjs`: two real clients use the deployed room API and encrypted Realtime relay to play legal moves and recover a checkpoint. Test rooms are closed in a finally block.
- All 100 canvas scenes were rendered with a native Canvas runtime and the actual atlases; a contact sheet was inspected for missing assets and render exceptions.
- Existing repository deployment gates continue checking the retained games, learning tools and HTTPS behavior.

The 100 games are compact first releases with their own mechanics, rather than 100 separately downloaded engines. They are intended for invited friends. The renderer, transport and engine API can be retained if room authority later moves to Cloudflare Durable Objects; that migration needs a working account credential and measurement of latency/cost under actual traffic.
