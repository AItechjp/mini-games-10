# GAME 23 / Operations expansion

The original first-person cinematic world and six environments are retained. This is a browser-game content/system expansion, not a claim of AAA production scope or commercial certification.

## Playable content

- Six chapters, with three authored assignments and a boss/exit objective per chapter: 24 main objectives.
- Five assignment mechanics: activation, recovery, defense, escort, and purge. Defense/escort progress pauses when the area is contested.
- Eighteen authored intel records and twelve team supply caches placed beside the main route.
- Three weapons with different magazine sizes, rates of fire, reload times and heavy-target damage.
- Three difficulties, chapter unlocks, chapter-start saves, team upgrades between chapters, run statistics/rank and local collection records.
- Endless survival waves with a boss every fifth wave. Active infected are bounded to 84 and the instance pool to 112. Pickups are capped at 16; dead slots are reused.

## Combat contract

All normal classes, including armored infected, die from one valid shot. Brute/fat and bloater are the only durable non-bosses. At NORMAL they have 8 and 5 HP. Difficulty changes fat/boss endurance, not normal one-shot kills. Explosives obey the same normal-kill rule. Bosses retain their original per-area, per-difficulty health and their glowing weak core.

The host traces shots using its enemy positions and collision boxes, controls ammunition/reloading/powers, rejects duplicate shot sequences and does not accept the legacy client-supplied `hit`, `damage` or explosion requests. Acid/area attacks have an impact warning and only damage a player still inside the zone when it resolves.

## Co-op contract

- Two-player code/invitation lobby, role validation through presence, mutual readiness, and a reserved guest slot.
- Protocol version, client incarnation, run ID, area epoch and packet sequence isolate old clients, duplicate messages and old-area packets.
- Host-owned enemies, objectives, pickups, stats, powers, damage, revives and chapter transitions. Player position reports have finite-value, distance and collision checks.
- Full bounded snapshots repair missed events and support rejoining with the same tab/session identity. Power timers use the host simulation clock, not clocks from different devices.
- Shared pause, absence/heartbeat detection, frozen progress while reconnecting, explicit continuation as a separate solo run, room cleanup and invite copying.
- A downed player can be revived by a teammate holding the interaction for two seconds, or returns with three lives near a living teammate after ten seconds. A simultaneous team wipe restarts the current chapter with three lives each. Solo has one second wind, then a retry screen. Survival ends on a team wipe.
- Full host-page closure is not a dedicated-server migration: the other player waits, continues in a separate solo run, or returns to the lobby. Saves are local chapter checkpoints, not account-wide cloud saves.

The transport uses the existing public Supabase Realtime channels and frontend publishable key. Room codes are invitation identifiers, not authenticated private rooms. This casual host-authoritative mode is not an anti-cheat, competitive-server, load-test or availability guarantee. No new database grants or schema changes are introduced.

## Verification

`node tests/game23-systems.mjs` checks the complete concatenated loader syntax, every normal/fat damage rule, content counts, malformed and stale snapshots, two-client readiness, authoritative guest fire, cover, duplicated packets, shared pause, revival/continue, chapter transitions, reconnect, and team retry. It executes the production system runtime with renderer facades.

`node tests/game23-coop-live.mjs` uses two instances of that runtime over the configured real Supabase Realtime service in a fresh temporary room. It checks presence, readiness, start, guest fire, enemy-state convergence, disconnect/rejoin from a fresh client instance, shared pause/resume, and chapter transition. It does not represent physical two-phone or long-duration load testing.

The existing `tests/game23-smoke.mjs` publishing gate checks actual game startup/render dimensions and Operations initialization, including normal HP and mission count. The shared Pages workflow runs the new deterministic tests before publishing.

Supabase API references: [Broadcast](https://supabase.com/docs/guides/realtime/broadcast) and [Presence](https://supabase.com/docs/guides/realtime/presence). Existing pinned client version: 2.115.0.

No sound or music was added.
