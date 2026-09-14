# Commons card libraries

- MTG: https://aitechd.com/commons/mtg-flavor/
- Duel Masters: https://aitechd.com/commons/duel-masters-flavor/
- Shared frontend: `commons/card-library/`.
- Hub entries: `commons-src/lib/site-catalog.ts`. GitHub Pages builds the current Commons source before publication. Do not replace the old Sites redirect.

MTG uses the documented public Scryfall API with `unique=prints`, multilingual/variation/extra results, paper-game selection, and a release-date cutoff in Asia/Tokyo. Japanese is the default; readers can select Japanese plus English or all languages. Images are whole cards, including illustrator and copyright lines. Missing API text is not presented as proof that the printed card has no flavor. Two-faced cards retain both faces. Requests are serialized with at least 140 ms between calls, cached in browser memory for 15 minutes, and paginated without dropping any of the 175 upstream records.

Duel Masters uses the official public card search and detail pages. The `commons-cards` Edge Function runs in the existing `dcvtubivtextycifngtk` project. It requires the existing publishable key, permits only the canonical public origins, and has no database access, secrets, uploads, user records or mutations. Deploy `index.ts`, `core.mjs` and `public-key.mjs` together with platform `verify_jwt=false`: the function validates the `apikey` header. This preserves the user's explicit login-free Commons requirement.

The reader covers the official catalog, including reprints, original DM-01 sets, and promos present in that source. It cannot claim a verified complete history of every issued card: missing official entries are unavailable, and official advance previews may be included. This limitation is visible in the UI. The official source does not provide usable dates for all printings, so sorting is explicitly the official ordering. There is no invented date, replacement flavor, machine translation, card artwork, or fixed sample masquerading as the complete catalog.

Search responses are cached in function memory for 15 minutes, set options for an hour and detail records for a day. A 160-item cap, four upstream requests per isolate, 100 public requests per minute per observed IP per isolate, fixed upstream origin/paths, strict card IDs, response size limit and timeouts bound resources. These in-memory limits are best effort across isolates, not a global quota. The browser hydrates two details at a time and reports failures per card. Ten UI records partition the fifty official search records exactly.

Run `node tests/card-library.mjs`. Live verification also checks source search, original DM-01, an actual flavored card, pagination and negative API cases; synthetic tests never stand in for source availability. No complete copyrighted text/image corpus is bundled or exported. Attribution and direct source links accompany the viewer.

Sources: https://scryfall.com/docs/api , https://scryfall.com/docs/api/cards/search , https://dm.takaratomy.co.jp/card/ , https://supabase.com/docs/guides/functions .
