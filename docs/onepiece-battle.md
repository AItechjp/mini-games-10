# ONE PIECE Card Battle

Route: `/onepiece-battle/`, linked from `games-2d.html`.

## Scope

This unofficial fan simulator automates the 34 card numbers in ST01 and ST02.
Each provided deck has one leader, 50 main-deck cards and 10 DON. The card
catalog is a separate collection: catalog inclusion does not mean that a card's
effects are implemented. Unknown card numbers are rejected by the game engine.
No claim is made that every released card, alternative illustration or ruling
is supported. These block-1 starter decks are for Extra/casual practice, not a
claim of current Standard-format eligibility.

Modes: CPU practice; two players sharing one device with a hand-hiding handoff;
two devices using the existing login-free room service. Player zero hosts the
online rules engine. Guest commands are checked against the current legal
action list and revision. Only a redacted view is sent to the guest; this is
casual host-authoritative play and does not protect against a malicious host.

The online session survives temporary transport disconnections while both
pages remain open. Closing the host page ends the in-memory session. No new
database schema, privileged key or authentication flow is introduced.

## Rules and sources

- Comprehensive rules 1.2.1 (2026-08-28):
  https://www.onepiece-cardgame.com/pdf/rule_comprehensive.pdf?20260828=
- ST01 official card records:
  https://www.onepiece-cardgame.com/cardlist/?series=550001
- ST02 official card records:
  https://www.onepiece-cardgame.com/cardlist/?series=550002
- Format and restrictions:
  https://www.onepiece-cardgame.com/topics/085.php
  https://www.onepiece-cardgame.com/news/restriction.html

Implemented rules include first-player mulligan order, life ordering, automatic
refresh/draw/DON phases, first-personal-turn attack restrictions, active/rested
DON costs and attachments, summoning restrictions and Rush, five-character and
one-stage limits, attack effects, blockers, repeatable counter steps, attacker
winning equal-power comparisons, life damage and optional triggers, immediate
deck exhaustion, and all supported starter card effects through explicit
target/choice prompts. Attached DON's inherent power applies only on its
owner's turn; conditional printed card effects have their own timing.

Card artwork uses actual URLs discovered in the official Japanese card list.
Artwork rights remain with their respective owners. A collected image URL is
not a downloaded image file. Retrieval metadata and per-series totals in
`catalog.json` distinguish coverage, unique card numbers and local downloads.
Remote images may fail independently of gameplay; textual cards remain usable.

## Verification

`node tests/onepiece-engine.mjs` covers rules and complete CPU matches.
`node tests/onepiece-online.mjs` exercises independent live clients, redacted
state, legal moves, rejected stale/illegal commands and reconnection.

The browser UI presents only choices returned by the engine. JSON property
order is normalized when comparing online commands, because the transport may
reorder object keys.

## Catalog snapshot

The 2026-09-19 snapshot covers all 62 listed series: 4,987 printings / official
image URLs and 2,823 card numbers; no series failed. Zero image files were
downloaded. Some printings have unavailable numeric metadata, retained as null.
Catalog JSON is split into 100-record parts referenced by `catalog.json`.

To collect a future snapshot (Python 3.10+ and aiohttp):

```sh
python scripts/collect_onepiece_catalog.py --output /tmp/onepiece-data --starters onepiece-battle/cards.json
```

Use `--resume` only to complete an interrupted snapshot; its cache is not a
refresh mechanism. The tool reads existing public catalog endpoints and does
not download or redistribute image bytes.
