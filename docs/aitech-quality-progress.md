# AItech continuous quality work

## Scope and operating rules

Canonical entry: https://aitechd.com/ . Source: AItechjp/mini-games-10, main.
Review the latest source and deployment before each iteration. Preserve all existing
saved data, guest access, advertisements, published routes and work from other tasks.
The former Commons Site is a redirect; the active tools are under `/commons/`.
Use current page links and `commons-src/lib/site-catalog.ts` for the current inventory,
not an old conversation's app count. The current catalogs contain 17 Commons entries
and 16 games; the public build also retains older/alternate routes.

The user cancelled recurrence and requested 20 improvements per app in one batch. Make concrete, tested changes;
rotate through the inventory and prioritize broken flows before cosmetic changes.
This log is an engineering checkpoint, not a claim that every app is commercially ready.

## 2026-09-14 — Browser release and continuous publication

Baseline: `9a2250ef10190580d8dca8fbd6db455b8b6562d6`.

The user explicitly requested removal of the Unity editions, improvements to all
Games and Commons, publication, and improvement/publication every six hours, with
all necessary approvals granted. This supersedes the earlier release-approval wait.
The previous Unity-focused draft PR #7 is superseded; do not merge or revive it.
Publish verified changes to main without force pushing, preserve concurrent work,
and check the matching Pages deployment and public release fingerprint.

Completed in this release:

- Removed all Unity players, runtime binaries and Unity project sources. Four old
  URLs only redirect to their browser replacements; no Unity loader remains.
- Restored BLACK SITE, SKYBREAK RIVALS, STARTRAIL and Old Maid browser catalog links.
- Implemented browser Memory and Speed with responsive card tables, CPU play,
  pause/resume, restart confirmation, rules, local saves and cross-tab protection.
  CPU memory uses only revealed cards. Speed conserves all 52 cards and supports
  blocked-table redeals and A/K adjacency. Keyboard focus survives table updates.
- Seven board games stop CPU timers/workers behind dialogs and in hidden tabs.
- Commons search supports multiple terms, full-width input and hiragana/katakana.
  Recent rooms load on demand, handle cancellation and offer retry on failure.
  Favorite storage errors are visible and favorites synchronize between tabs.
- All public build pages retain browser zoom. Shared fullscreen placement supports
  toolbar slots, throttled HUD updates, keyboard focus and isolated control events.
- Deployment gates check browser replacements, local assets, zoom and the 33
  catalog/app route files, with new card-game interaction checks in browser CI.
- AETHER DUEL uses its separate existing Site. Its public CPU opening flow was
  inspected; duplicate fullscreen controls were identified for a companion release.

Validation before main publication:

- Commons typecheck and production build; commercial configuration, recovery,
  sauna, 18 opening-hour cases across four time zones and coverage gates passed.
- Public distribution: 769 files, no development source/maps, compiled board rules.
- 33 catalog/app route files, no Unity runtime, local references, zoom gates passed.
- Memory: 80 complete matches; Speed: 80 complete matches and 4,593 moves,
  with card conservation, hidden-card fairness and save round trips checked.
- Existing arcade, room security, SKYBREAK state/9 stages, graphics pacing,
  BLACK SITE, FPS, Gomoku, 72 Daifugo matches and 1,000 Old Maid matches passed.
- Commons domain and study source/storage/recovery gates passed. Published browser
  interaction checks are performed after deployment; do not claim untested flows.

The provided cloud browser cannot run WebGL and blocks local preview navigation.
Those limitations are not evidence of failure in players' browsers. Actual 3D play
is covered by the existing CI environment where supported; inspect its result.
This log records concrete improvements, not a blanket commercial-readiness claim.

The existing automation `6aa75946913c8191a03732fa590a4c37` was disabled at the user's request. Do not resume it or create another schedule. The user now requests 20
improvements per app, with a concrete list, implementation and publication.
Continue this one-off batch without repeating the already granted release approval.

## Verified publication before the 20-item batch

Portal release `306bcf337bd567815ebc041e3446840f303ea6f1` is live. GitHub Pages
run `34803839282` passed all steps, including public play checks and desktop/Android
HTTPS checks. Memory flip/pause/restart, Speed play/save restoration, Commons
search/clear/room list and old Trump URL redirect were also inspected publicly.
AETHER DUEL version 13 (`d0657472ff6577143c84d5d9d340809284fd2440`) is published.
The optional Cloudflare Pages mirror failed with an invalid Authorization header;
do not present that mirror as updated or expose/guess its credentials.

## Current app coverage and next passes

All local apps receive browser-zoom support and catalog/distribution checks.
The following remaining checks guide future cycles; keep claims specific to evidence.

| App | Current route | This iteration / next useful review |
| --- | --- | --- |
| BLACK SITE | `/game23.html` (solo/co-op) | Browser version restored; gameplay system gates passed; mobile aiming and save continuity remain |
| SKYBREAK RIVALS | `/smash.html` | Browser version restored; online state/9-stage gates passed; fighter interaction review remains |
| AETHER DUEL | `https://aether-card-duel.douga071132.chatgpt.site` | Published version 13; fullscreen and background CPU behavior improved; inspect deck building, 600-card load, campaign and online errors |
| QUICK HOP | `/quick-hop/` | Shared control; checkpoint restart and mobile play remain |
| STARTRAIL | `/startrail/` | Browser version restored; stage completion and mobile movement remain |
| 大富豪 | `/classic.html?game=daifugo` | Shared control; complete CPU match, reconnect and room isolation remain |
| ババ抜き | `/babanuki.html` | Browser version restored; 1,000 complete rule matches passed; browser play remains in CI |
| 神経衰弱 | `/trump/?game=memory` | New browser table; 80 complete rule matches passed; interaction checked in CI |
| スピード | `/trump/?game=speed` | New browser table; 80 complete rule matches passed; interaction checked in CI |
| 五目並べ | `/board-games/?game=gomoku` | Compiled rule gate and CPU background/dialog pause improved; interaction and online alternative remain |
| 将棋 | `/board-games/?game=shogi` | Compiled rule gate and CPU background/dialog pause improved; promotion, drops and mobile board remain |
| 囲碁 | `/board-games/?game=go` | Compiled rule gate and CPU background/dialog pause improved; passes/scoring and restart remain |
| オセロ | `/board-games/?game=othello` | Compiled rule gate and CPU background/dialog pause improved; legal-move feedback and forced pass remain |
| チェス | `/board-games/?game=chess` | Compiled rule gate and CPU background/dialog pause improved; promotion, check feedback and mobile board remain |
| モノポリー | `/board-games/?game=monopoly` | Compiled rule gate and CPU background/dialog pause improved; complete round/economy flow remains |
| 人生ゲーム | `/board-games/?game=life` | Compiled rule gate and CPU background/dialog pause improved; event readability and finish flow remain |
| ホワイトボード | `/commons/tools/whiteboard/` | Domain gate passed; drawing latency, undo/clear, reconnect and saved rooms remain |
| 予備試験対策集 | `/commons/study/` | Existing source/storage gates passed; mobile exercise/essay flow and official source accuracy remain |
| チャット | `/commons/tools/chat/` | Domain gate passed; guest isolation, draft recovery and reconnect remain |
| 全国ホテル検索 | `/commons/hotels/` | Domain gate passed; real API empty/error states and date/price sorting remain |
| 岐阜・愛知の賃貸検索 | `/commons/rentals/` | Domain gate passed; station/walk/layout filters and truthful coverage remain |
| 営業中スーパー | `/commons/local/supermarkets/` | Domain gate passed; unknown opening hours, locality filters and provenance remain |
| 岐阜・愛知サウナ | `/commons/local/saunas/` | Domain gate passed; opening status and filter handling remain |
| 営業中銭湯 | `/commons/local/sento/` | Domain gate passed; opening status and filter handling remain |
| 営業中魚屋 | `/commons/local/fishmongers/` | Domain gate passed; opening status and filter handling remain |
| 岐阜の営業中ラーメン | `/commons/ramen/` | Domain gate passed; current data and midnight/opening-hour cases remain |
| 全国の営業中サウナ | `/commons/sauna/` | Domain gate passed; existing closed-facility fixes preserved; current coverage/unknown-hours UX remain |
| ラーメン開店予定 | `/commons/openings/ramen/` | Domain gate passed; source verification and moving 15-day window remain |
| サウナ開業情報 | `/commons/openings/sauna/` | Domain gate passed; source verification and moving ±2-month window remain |
| カメラ | `/commons/camera/` | Domain gate passed; permission recovery, Android/iPhone save and camera switching remain |
| 岐阜の天気 | `/commons/weather/` | Domain gate passed; unavailable/stale forecast and location selection remain |
| ビットコイン送金マップ | `/commons/bitcoin/` | Domain gate passed; input errors, pagination and responsive graph remain |
| Onion URL確認 | `/commons/onion/` | Existing snapshot preserved; update freshness and honest response-status labels remain |

Keep the prior/alternate URLs (including `game23.html`, `smash.html`, `fps.html`,
`classic.html` online, `bayline/`, `touge/`, and the archive) functional. Review their
actual public links and `https-release.json` rather than removing them to pass an audit.

Next priority: verify this release on the public URLs, then rotate through camera
permission recovery, whiteboard/chat reconnect, complete board matches and mobile
action gameplay. Check freshness/source claims separately before changing directory data.
Use successful current app reads before extending a future task to another connector.

## 2026-09-14 — 20 improvements per current app

33 catalog apps: 15 shared display/help/connectivity changes plus five actions per
app type, documented individually in `quality/release.json`. This is 660
applications of improvements, using shared implementations, not 660 distinct
new game features. No graphics or dataset-completeness claim is implied.

Added manual visible-state records with notes/copy/text export, comparison
shortlists with selection timestamps and source links, whiteboard PNG export
(background, 1x/2x, clipboard, failure handling), and camera timers/grid/keyboard.
Board/card CPU timers honor the help dialog. Action games ignore settings typing.
Commons builds retain the previous generation of hashed assets so already-open
tabs can still load their lazy modules during a deployment.

Local typecheck, commercial/recovery, board/Memory/Speed rule gates, all route
and distribution audits passed. The Pages workflow additionally verifies the
new real UI flows before publication; inspect its matching run before claiming
public completion. AETHER DUEL is published separately through its existing Site.

## Integrated app guide and personal notes

Preserved concurrent portal changes through `d05092e14e99503f3e74a3ac6b055fc9dfde1a34`
and AETHER source through `5196060`. Combined both interfaces under one app-menu
entry; existing record/comparison, camera timer/grid and whiteboard PNG tools remain.
The detailed 33-by-20 list is in `docs/AItech-app-improvements-20.md`. Shared guides
add protected per-app notes, search/favorites/recent apps, canonical links, guide
export and display options. Existing saved games and guest keys remain separate.

Commons typecheck/build and 660-item model/storage checks passed locally.
Compiled distribution, browser integration and publication gates are checked
against the integrated source before declaring the release complete.
Recurrence remains disabled.

## Verified completion of the one-off 20-item request

- Public portal code: `8883bd353cc1da516be8bc41a07bccf3272693bd`.
- Pages run `34807343725`, job `103863336924`: every step succeeded.
- Browser UI gates passed: 32 local app entries, all 20 shared guide features,
  mobile layout, notes round trip, protected game input and board CPU pause/resume.
  Existing quality controls, records/export, comparison, preference synchronization
  and camera countdown/cancel/grid/capture also passed.
- Public HTTPS audit passed: 64 HTML documents, 130 desktop/Android checks,
  6 redirects and no failures. Public Memory help search, unified record-menu access,
  and the Commons whiteboard guide were also inspected in the browser.
- AETHER DUEL version 18, source `74af9d4e62cc04b03dcfac94d47af434ea2908b0`,
  deployment `appgdep_6aa7828229808191b29c7b83aced08f9`: succeeded, public audience unchanged.
  Final HTML refreshes both the quality-control and game-handler cache URLs.
- Cloudflare mirror run `34807343616`, job `103861692400` failed at token validation:
  codes 6003/6111, invalid Authorization header. No credential was exposed or guessed.
  GitHub Pages and the AETHER Site are the confirmed updated public destinations.
- Recurring AItech task `6aa75946913c8191a03732fa590a4c37` was rechecked and remains disabled.
- Final per-app list and verification record: `docs/AItech-app-improvements-20.md`.

The final receipt commit changes documentation only; the live code fingerprint
remains the tested portal release above. Do not recreate the cancelled schedule.
