# AITECH Commons

The canonical site is https://aitechd.com/commons/ in AItechjp/mini-games-10.
Maintain the application here and publish through this repository's Pages workflow.
All Commons navigation stays on aitechd.com; do not link a tool to the former
commons-100.chatgpt.site application or restore that application as a second hub.

`aitech/main.tsx` provides the client routes; `lib/site-catalog.ts` is the catalog.
Room links use `/commons/r/?id=ROOM_ID` so direct links work on static hosting.
Hotel and rental pages live in `../commons/hotels`, `../commons/rentals`, and
`../commons/search`. The Commons build preserves those separately maintained files.

Run `npm run build:aitech` here after frontend changes, then run
`node tests/commons-domain.mjs` from the repository root and commit the generated
`commons/` files together with the source. API-only changes require the existing
backend release process as well. Keep saved room data intact. Every tool is public and works without login; anonymous browser keys retain per-guest posts and recent rooms.

The former Sites project is retained only for public old-link redirects. Its default build must remain the migration Worker.
# Official information collection

The current live directories use the public `commons-realtime` Supabase Edge
Function. `edge/realtime.ts` serves the independently cached `/directory` and
`/openings` endpoints. The guest room API and stored rooms are unchanged.

The allowlisted corpus contains 565 facilities, 360 URLs and 37 independent site
domains. Successful downloads and successful venue/hour validation are counted
separately. A source failure invalidates that page's records immediately. Records
expire after two hours; opening announcements expire after one hour. Ordinary
published hours are never labelled as direct confirmation of on-site operations.

`.github/workflows/commons-realtime-update.yml` requests a collection every five
minutes. A database lock and refresh interval bound upstream work. Each pass
visits the oldest pages across independent domains (64 pages, eight requests at a
time). It uses `commons.opening_cache` in the private schema; no public table is
added. Opening announcements are revalidated every 15 minutes.

From `commons-src`, build the frontend with `node aitech/build.mjs`, then build the
independent function with `node aitech/build-realtime.mjs`. Deploy the resulting
`edge-output/realtime.js` as `commons-realtime`, preserving public access. Do not
deploy it over `commons-api`. Tests: `node scripts/test-realtime.mjs` and
`node scripts/test-local-hours.mjs`. The Pages release also runs the six-directory
desktop/mobile browser check against real collected data.

To reproduce the initial collection audit, run `node scripts/prepare-realtime-targets.mjs`,
`python scripts/capture-realtime.py`, then `node scripts/audit-realtime.mjs`.
Temporary HTML captures remain outside the repository. Reviewed schedules in
`data/realtime-reviews.json` must match the current official body before use;
changed source text invalidates the review. HTML comments, mixed venue pages and
conflicting structured/text hours cannot silently become current opening status.
