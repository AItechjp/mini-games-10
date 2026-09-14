# AItech continuous quality work

## Scope and operating rules

Canonical entry: https://aitechd.com/ . Source: AItechjp/mini-games-10, main.
Review the latest source and deployment before each iteration. Preserve all existing
saved data, guest access, advertisements, published routes and work from other tasks.
The former Commons Site is a redirect; the active tools are under `/commons/`.
Use current page links and `commons-src/lib/site-catalog.ts` for the current inventory,
not an old conversation's app count. The current catalogs contain 17 Commons entries
and 16 games; the public build also retains older/alternate routes.

An improvement cycle is requested every six hours. Make concrete, tested changes;
rotate through the inventory and prioritize broken flows before cosmetic changes.
This log is an engineering checkpoint, not a claim that every app is commercially ready.

## 2026-09-14 — Shared controls and Unity recovery

Baseline: `9a2250e` (latest main fetched at the start of this iteration).

Completed changes:

- The common fullscreen control supports a reserved toolbar slot. The three Unity
  action games use it, so the button no longer covers the game or its header links.
- Floating placement work is throttled during HUD mutations, recalculated on scroll,
  and avoids moving the button while it has keyboard focus. Pointer and keyboard
  events from the fullscreen control no longer bubble into game controls.
- Unity touch input tracks each pointer independently. Releasing one direction does
  not cancel another held direction, unrelated fingers do not move the camera, and
  loss of pointer capture ends aiming. Pause, backgrounding, hidden controls and
  retries release all held inputs. Overlapping background events request pause once.
- Failed or stalled Unity downloads offer an explicit reload action. A stalled
  download can finish normally without a second engine instance being started.
  Progress after a stall clears the stale message. Startup applies the quality,
  audio and game options selected during loading.
- Shared Unity text/controls are more legible, selects have a 44 px minimum height,
  the setup overlay can scroll on short screens, and reduced motion is respected.
- Added player regression checks to the existing Pages deployment gate, after the
  production artifact is compiled; no existing gates were removed.

Validation completed before publication:

- `node tests/unity-player.mjs` and `UNITY_PLAYER_DIST=1 node tests/unity-player.mjs`:
  simultaneous touches, opposing directions, capture loss, cancelled pointers,
  inactive controls, background reset, script failure, synchronous/rejected engine
  startup, stalled downloads, recovery, option replay and duplicate pause prevention.
- `npm run build` and `npm run check:distribution`: 778 public files checked, no
  development source/maps in the distribution, and compiled board-game rules passed.
- `node tests/commons-domain.mjs`: 20 local Commons routes and 4 portal/study links.
- `node tests/yobi-past-source.mjs`: existing question banks and study-storage gates.
- The current public Unity page was inspected in the provided cloud browser. That
  browser reports no WebGL support; actual Unity play and mobile rendering are not
  claimed as tested here. Its failure view demonstrated the missing recovery action.
  Local browser navigation is blocked by this environment. These restrictions must
  not be reported as proof that players' browsers cannot run the game.

Publication status: implementation/build complete, not yet released. Automatic
approval review rejected a direct push to main because explicit authorization for
the production release was required. Changes are being preserved on the review
branch `codex/aitech-quality-20260914`; do not try another path to main to bypass
that rejection. User approval for this release and subsequent automatic releases
is pending. Continue improving the existing draft while approval is pending.
After authorization, confirm the matching Pages workflow and deployed assets.
Do not mistake a skipped optional Cloudflare deployment for a Pages failure.

## Current app coverage and next passes

“Shared control” means only the common fullscreen change applies in this iteration.
Every row still needs its own end-to-end review; the external card Site is separate.

| App | Current route | This iteration / next useful review |
| --- | --- | --- |
| BLACK SITE | `/unity/black-site.html` | Player/input/recovery improved; real WebGL gameplay, mobile aiming and save continuity remain |
| SKYBREAK RIVALS | `/unity/skybreak-rivals.html` | Same player improvements; fighter/arena controls and full match flow remain |
| AETHER DUEL | `https://aether-card-duel.douga071132.chatgpt.site` | Existing public Site resolved, version 12; inspect deck building, 600-card load, campaign and online errors |
| QUICK HOP | `/quick-hop/` | Shared control; checkpoint restart and mobile play remain |
| STARTRAIL | `/unity/startrail.html` | Player/input/recovery improved; stage completion and mobile movement remain |
| 大富豪 | `/classic.html?game=daifugo` | Shared control; complete CPU match, reconnect and room isolation remain |
| ババ抜き | `/trump-unity/?game=babanuki` | Shared control; separate Unity loader/recovery, full match and restart remain |
| 神経衰弱 | `/trump-unity/?game=memory` | Shared control; card accessibility and match completion remain |
| スピード | `/trump-unity/?game=speed` | Shared control; touch targets, timers and completion remain |
| 五目並べ | `/board-games/?game=gomoku` | Compiled rule gate passed; interaction and online alternative remain |
| 将棋 | `/board-games/?game=shogi` | Compiled rule gate passed; promotion, drops and mobile board remain |
| 囲碁 | `/board-games/?game=go` | Compiled rule gate passed; passes/scoring and restart remain |
| オセロ | `/board-games/?game=othello` | Compiled rule gate passed; legal-move feedback and forced pass remain |
| チェス | `/board-games/?game=chess` | Compiled rule gate passed; promotion, check feedback and mobile board remain |
| モノポリー | `/board-games/?game=monopoly` | Compiled rule gate passed; complete round/economy flow remains |
| 人生ゲーム | `/board-games/?game=life` | Compiled rule gate passed; event readability and finish flow remain |
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

Next priority: complete the mobile/keyboard review of shared Commons search, camera
recovery and whiteboard/chat reconnect, then the card game and board-game flows.
Use successful current app reads before extending a future task to another connector.
