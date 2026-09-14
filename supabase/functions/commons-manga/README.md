# Commons Free Manga Links

Public UI: https://aitechd.com/commons/manga/

The catalog includes 36 Japanese manga services: 13 publisher Atom feeds and 23 additional publisher, free-volume and creator-publication directories. Directory-only services are links to their own catalogs; their works are not individually indexed. Coverage is explicitly limited, not an Internet-wide or all-works index. Links were reviewed on 2026-09-14, including the migrations from Ura Sunday to Manga One, Polaris to kirapo.jp, and MeDu to Gコミ. Redirected MangaHack and sources whose current information could not be verified were excluded.

`commons/manga/sources.json` and the function's `sources.json` must match. Fixed, reviewed HTTPS source origins are the only network targets. Episode links must match the configured origin and a numeric `/episode/` path. Feeds and readers reject redirects. No arbitrary user URL is fetched.

## Free availability

The Atom feed discovers candidates, not free claims. `availability.mjs` reads the public `episode-json` metadata on each candidate reader without authentication or cookies. It checks the exact episode ID/permalink, `typeName=episode`, `isPublic=true`, `hasPurchased=false`, and a main-page reference. It retains only the availability outcome, title, verification time and next check time. It does not fetch or retain manga images or their URLs. A publicly available preview is only a free claim about the linked episode/part, never about all volumes of a series.

Feed dates constrain the result but cannot independently mark a link free. Evidence expires in six hours; due free checks are prioritized from three hours. Known free-period expiry is enforced even between collector runs. On feed metadata change the old evidence is invalidated. A failed reader recheck removes the free claim immediately. Paid, unknown, future, expired and stale items are omitted by both the public API and the browser. HTML format changes fail closed. The UI shows the time of each free check.

GET remains version 1 for compatibility, with `verificationVersion: 2`; its `items` are now free-only. Internal candidates and pending checks remain in the private snapshot. Public coverage counts distinguish indexed candidates, confirmed free, restricted and pending. The UI polls every minute while visible, expires stale evidence while offline, and remains usable through directory links if the snapshot cannot load.

## Deployment and operation

Deploy `index.ts`, `core.mjs`, `availability.mjs` and `sources.json` as `commons-manga`. GET is a bounded public snapshot. POST requires the existing 256-bit private Vault token. Keep gateway JWT verification disabled for public reads; the POST handler implements private authentication. The service role stays in the function environment. Existing RLS and grants deny browser roles direct table/RPC access. This update requires no schema, token or schedule changes.

The existing five-minute cron invokes `public.commons_manga_tick()`. To inspect a run, call that function through administrative SQL and read only the corresponding `net._http_response` row. Never print the Vault token. Collection is independent of whether a user has the site open.

Each run owns the existing 75-second lease. Feeds use four concurrent requests, ten-second timeouts, conditional headers, cache intervals, backoff, and a 1.1 MB response limit. Only the most recent 120 feed entries/source from the past 30 days are retained; this is a rolling feed snapshot, not a historical archive. Reader checks share a 48-second collection deadline, use four workers, ten-second timeouts, a 1.5 MB response limit and at most 40 checks/run, distributed across publishers. Queued checks may take several cycles. The existing 1.8 MB database snapshot limit remains in force. Completion updates only the current lease owner.

## Verification

Run `node tests/manga-links.mjs` and `node tests/manga-free.mjs`. The free tests cover anonymous public-reader evidence, numeric-string IDs, wrong origins/identity, paid and unknown readers, stale/expired/future evidence, changed feed metadata, failed rechecks, and request/time budgets. The GitHub Pages release runs both checks. Verify a real collector response and the public UI after publishing. The Commons build preserves `commons/manga/` and rebuilds the hub entry from `commons-src/lib/site-catalog.ts`.
