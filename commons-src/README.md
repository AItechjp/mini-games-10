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
backend release process as well. Keep authentication and saved room data intact.

The former Sites project is retained only for authenticated account handover and
old-link redirects. Its default build must remain the migration Worker.
