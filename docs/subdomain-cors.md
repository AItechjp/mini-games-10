# Commons subdomain CORS

Deployed 2026-10-04 to the existing `dcvtubivtextycifngtk` project. The versions and deployment bundle hashes are recorded in `subdomain-cors-deployments.json`.

| Function | Previous → current version | Added exact HTTPS hosts |
| --- | --- | --- |
| commons-search | 3 → 4 | tools, commons, hotels, rentals |
| commons-yugioh | 2 → 3 | tools, commons, yugioh |
| commons-cards | 2 → 3 | tools, commons, duel-masters |
| commons-tcg | 6 → 7 | tools, commons, onepiece-cards, pokemon-cards, zx-cards |
| commons-api | 6 → 7 | commons, tools, whiteboard, chat, hotels, rentals, supermarkets, local-sauna, fishmongers, ramen-openings, sauna-openings, silent-camera, bitcoin, saunanow |
| commons-realtime | 3 → 4 | Same additions as commons-api |

Every short host above is suffixed with `.aitechd.com`. Existing root/www origins and legacy origins are preserved. All lists are exact; no wildcard, suffix matching, user-supplied origin reflection or credentials allowance is introduced. Literal `null`, HTTP origins, unknown hosts and lookalike domains are rejected. The four reader endpoints omit CORS approval headers entirely for a rejected or absent Origin.

The four catalog/listing endpoints retain the existing publishable-key check, methods, rate limits and upstream guards. Main API guest identity derivation, private room controls, data access and response filtering remain unchanged. Existing `verify_jwt=false` settings were retained; they were not newly disabled. There are no schema, RLS, Auth URL or secret changes.

## Source parity and deployment

All source files for the four reader endpoints were compared to the live versions before editing. The live main/realtime endpoints were bundled files; `scripts/patch-commons-live-origins.mjs` performs one asserted replacement of the audited host list while preserving every other byte. They were not rebuilt from the repository's older application tree. Their source allowlist is also updated in `commons-src/edge/origins.ts` for future builds.

All six deployed functions were downloaded again and compared byte-for-byte to the submitted file sets. When deploying the four reader endpoints again, include `supabase/functions/_shared/commons-cors.mjs` as well as each function's own files, retaining the parent/child paths used by the relative imports.

## Verification

With Node 22.18+ or Node 24:

```sh
node tests/commons-cors.mjs
node tests/card-library.mjs
node tests/yugioh-library.mjs
node tests/rental-age.mjs
node tests/commons-cors-live-bundles.mjs /path/to/downloaded-live /path/to/patched-output
```

The reader test exercises the actual handler paths: 204 checks covering known old/new origins, preflights, unchanged API-key validation, method/parameter failures, origin/header injection and no-origin requests. The bundle test adds 148 health/preflight/rejection checks, with database and network access stubbed to fail. Existing catalog and rental regression tests also passed.

Live verification passed all 36 HTTPS requests across the six deployed functions: new/legacy preflights, authenticated invalid-input responses or health responses, and rejected null, HTTP and lookalike origins. The timestamp and exact responses are recorded in `subdomain-cors-verification.json`.

CORS deployment prepares the API for these hostnames. It does not configure DNS, TLS, static routing, frontend storage migration, or verify third-party content rights for commercial distribution. Those launch conditions must be tracked separately. Publishable API keys and CORS are not authorization for private data.

References checked on 2026-10-04: https://supabase.com/changelog.md and https://supabase.com/docs/guides/functions/cors . No current breaking change in the changelog required a CORS API migration for these functions.
