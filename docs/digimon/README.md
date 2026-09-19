# DIGIMON CARD LAB

Unofficial Japanese Digimon Card Game practice table at `/digimon-card/`.

Modes: deterministic CPU, pass-and-play with handoff privacy, host-authoritative online rooms using the existing site's room adapter. No new database or elevated keys are used. The guest receives its own hand, public zones, and legal actions; decks, security identities and the opponent's hand are redacted. Friendly online games trust the host; this is not a tournament anti-cheat service.

## Coverage

- All 78 category choices exposed by the Japanese official catalogue on 2026-09-19 were acquired: 4,468 numbered card records and 6 tokens, 7,472 distinct illustration URLs.
- All 7,472 original images were downloaded, decoded and hashed. The full image collection is kept in the user's separate private deliverable; this website embeds 32 optimized starter illustrations and references the official URLs for the complete gallery.
- `catalog.bin` is a gzip-compressed UTF-8 JSON array (DecompressionStream in the browser), preserving Japanese card text and artwork variants. `starter.json` is the eager-loaded verified starter pool.
- Automated game effects cover exactly ST1-01..16 and ST2-01..16. Other cards cannot be put into an automated deck. ACE, DNA digivolution, DigiXros, link, and other modern mechanics are not implemented. Complete catalogue/image acquisition must not be described as complete rules implementation.

## Sources and correction

- https://digimoncard.com/rule/ — comprehensive rules 4.3 dated 2026-09-18
- https://digimoncard.com/cards/ — Japanese official catalogue
- https://digimoncard.com/cards/?search=true&category=503101
- https://digimoncard.com/cards/?search=true&category=503102
- ST1-10 official Japanese HTML erroneously says evolve from Lv6. Corrected to red Lv5, cost2 after inspecting its official image. See corrections.json.

## Verification

`node --test tests/digimon-engine.mjs` checks deck rules, first-player mulligans, breeding, evolution, summoning sickness, memory and attack timing, blockers, security effects, all distinct starter effect handlers, hidden snapshots and full AI games.

`tests/digimon-browser.mjs` checks desktop, mobile, landscape, image loading, card details, catalogue correctness and hotseat privacy. The Digimon-specific workflow runs these checks on pull requests and main changes.
