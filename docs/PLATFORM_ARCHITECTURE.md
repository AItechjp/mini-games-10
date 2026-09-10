# Game hub and online platform decision

Prepared 2026-09-10 (UTC). This is an implementation plan, not a claim that new multiplayer games are live.

## Current verified scope

- Keep BLACK SITE (`game23.html`), SKYBREAK RIVALS (`smash.html`) and AETHER DUEL (its existing Site).
- The home page now exposes these three games directly. `archive.html` retains the complete old home page and its links. Existing game files and URLs are retained.
- BLACK SITE has Supabase-based two-player cooperative code; this review did not run a live two-client match.
- The current SKYBREAK code supports CPU / same-device local multiplayer. No network implementation was present.
- AETHER DUEL is currently an owner-only Site. The local saved source describes a CPU game. Its separate production multiplayer changes were not verified. A public catalog link alone cannot make it accessible to other players.
- `roadmap/online-games-100.json` contains 100 **planned** games, 44 cooperative and 56 competitive. It is excluded from the public bundle.

## Selected target stack

| Responsibility | Decision | Reason |
|---|---|---|
| Source and CI | Existing GitHub repository / Actions | Preserve history and existing delivery |
| Home / catalog | Existing semantic HTML, CSS, small JS modules | No framework or database connection needed to choose a game |
| New game source | TypeScript with Vite when the first new engine is added | Shared types and per-game chunks; no mass rewrite of existing games |
| 2D rendering | Keep existing Canvas engines; Phaser for new 2D families that need scenes, input and collision | Avoid replacing working games just to standardize a library |
| 3D rendering | Existing Three.js | Reuse models and existing BLACK SITE work |
| Static delivery | Cloudflare Workers Static Assets target; existing Pages delivery during transition | Static asset requests are free/unlimited under the cited policy |
| Room API / transport | Workers + one SQLite-backed Durable Object per room, WebSocket | Serialize room actions and manage reconnects in one place |
| Accounts, decks and results | Existing Supabase Auth + Postgres | Avoid moving existing durable user data without a reason |
| Large assets | R2 only when measured asset size justifies it | Assets can initially stay in the normal static bundle |
| D1 | Not introduced now | Avoid a second source of truth alongside existing Postgres |

This repository change implements hub and static-artifact optimization. It does **not** provision Workers, Durable Objects, R2, authentication or a production WebSocket endpoint. The Workers Assets config is static-only and intentionally has no room bindings.

## Common online behavior for every future release

- Guest play with a server-issued player/session identity; optional account upgrade through existing Supabase.
- Create room, invite link/code, capacity checking, ready state, start, reconnect and rematch.
- Friend rooms first. Initially expose a few shared public queues so 103 separate queues do not split a small audience.
- Same session identity for reconnect; explicit disconnect timeout and forfeit/team-wipe policy.
- Versioned messages containing match id, sequence, game version, action id and input.
- Server validates the actor, turn, resources, legal actions and win/lose conditions. Never accept a client's declared score as an authoritative result.
- Cards and deduction games send per-player views. Opponent hands, shuffled decks and hidden roles remain server-side.
- Disconnect, timeout and capacity errors are shown as failures. Never silently replace an online opponent with a bot and still label it online.
- Lobby heartbeat, room lifecycle and user-facing controls are shared. Gameplay rules, rendering and serialization belong to each engine family.

## Different networking models

| Family | Simulation / synchronization |
|---|---|
| Board, cards, shared puzzles | Server-authoritative command/reducer; persist each accepted action and revision; project hidden state per player |
| Casual 2D action / sports / co-op | Fixed-step authoritative simulation; client prediction and interpolated snapshots; start around 10–20 updates/s and measure |
| Fighting game | Extract deterministic simulation; evaluate input delay / rollback; verify synchronization and recovery before adding ranked matches |
| Zombie 3D co-op | Preserve rendering locally; move authority incrementally from host to server; send relevant actors / events rather than whole worlds |
| Social / drawing | Server assignment of roles and turns; throttled drawing batches, per-player visibility, disconnect policy |

Cloudflare is a deployment option, not a guarantee of low latency. A room has one active location. For Japan-focused traffic use the supported northeast Asia-Pacific hint at first creation, then measure real mobile-to-mobile round-trip and jitter. If fighting-game latency or simulation CPU misses the agreed budget, retain the same protocol and use a regional authoritative game server for that family.

Use Hibernation for idle lobbies and event-driven rooms. Active 60 Hz timers prevent hibernation; active action matches are not assumed to be free. Do not write positions to Postgres on every tick. Persist outcomes once per match with an idempotency key, and keep turn-based snapshots sufficient to recover from a restart.

## Migration sequence and release gates

1. Review the three-game hub and archive. Both existing deployment workflows build the same clean `dist/` artifact.
2. Deploy and validate Workers Static Assets on a candidate origin; check assets and every retained game before any domain switch. Keep `aitechd.com` and its current DNS until that validation passes.
3. Build the room service and one simple authoritative game. Validate two independent players joining, playing, finishing, disconnecting, reconnecting and rematching.
4. Integrate AETHER DUEL with private per-player views and server-side rules. Separately configure the intended audience before making the existing owner-only Site generally accessible.
5. Extract SKYBREAK simulation and introduce online play with measured delay and synchronization checks. Keep local play available.
6. Upgrade BLACK SITE cooperation using the same room identity and lifecycle without rebuilding graphics.
7. Release the ten P1 games as a batch, observe completed matches / repeat plays / latency, then prioritize the next ten. All 100 retain multiplayer as a release requirement.

No public DNS, access policy, paid subscription, database or deployment target was changed in this review branch. Production activation requires the existing Cloudflare account to be connected with the necessary Workers/Durable Objects permissions. A Cloudflare Pages token alone may not include those permissions.

## Cost basis (official docs checked on 2026-09-10)

- Workers Static Assets: static requests free/unlimited; Worker-invoking requests are billed separately.
- Workers paid plan: minimum USD 5/month plus applicable usage. This is not the total cost of running 100 games.
- Durable Objects free tier: SQLite backend only; 100,000 billed requests/day and 13,000 GB-s/day, plus storage quotas. Exceeding a free limit causes failures.
- Hibernation removes eligible idle duration billing, not ongoing action simulation costs.
- Supabase Realtime free defaults include 200 concurrent connections and 100 messages/s. At 20 sends/s, five clients alone reach 100 inbound messages/s before deliveries and other traffic, so those quotas are unsuitable as a capacity promise for many action rooms.
- Cost follows concurrent active rooms, message frequency and duration, not the number of titles. Measure those before projecting a monthly total.

## Sources

- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/durable-objects/reference/data-location/
- https://supabase.com/docs/guides/realtime/limits

## Verification

`node scripts/validate-roadmap.mjs` validates the count, unique ideas, multiplayer requirements and first batch.

`node scripts/build-static.mjs` builds the shared public artifact and fails if the hub eagerly initializes an online connection or game engine. The existing gameplay smoke checks remain in CI; this change does not claim those existing checks have run locally.
