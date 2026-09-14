# Commons Manga Links

Public UI: https://aitechd.com/commons/manga/

The directory ingests title, author, episode URL, feed update time and optional free-period metadata from 12 manually reviewed official Atom feeds. It does not fetch episode pages, manga images or manga text. A successful feed response does not establish that every linked episode is currently readable or free. Free-start metadata alone is labelled as such in the UI.

`sources.json` is also copied to `commons/manga/sources.json`; the regression check verifies that these catalogs match. New source domains require manual review. Network fetching is restricted to the configured feed URL and rejects redirects. Browser links require the configured HTTPS origin and numeric `/episode/` path.

Deploy `index.ts`, `core.mjs` and `sources.json` as `commons-manga`. GET is a public, bounded snapshot read. POST requires a 256-bit private Vault token and cannot be invoked by a public API key. Disable gateway JWT verification to permit public reads; POST implements its own authentication. The service role stays in the function environment. RLS is enabled and table/RPC grants exclude public browser roles.

Apply `schema.sql` through the migration API, deploy the function, and apply `schedule.sql`. The five-minute cron invokes the private collector, independent of whether the page is open. To start or inspect one run, invoke `select public.commons_manga_tick();` from the administrative SQL interface and inspect that request in `net._http_response`. Never print the Vault secret.

The collector uses a 75-second lease with an owner UUID; concurrent runs cannot overwrite a newer result. It requests at most four feeds concurrently with ten-second timeouts, a 1.1 MB limit per feed, conditional request headers and publisher cache intervals. Failures back off and preserve original success/content times. Each source retains only the latest 120 feed entries from the past 30 days; the snapshot has a database size constraint. Cron execution logs older than seven days are pruned for this job only.

The page polls the snapshot once per minute while visible and marks delayed collections and failed sources. It never substitutes the browser clock for a collection timestamp. Source publication time, collection time, and free-period metadata have separate labels. The collector stores a fresh snapshot even if only some feeds succeed, so individual source status must always be consulted.

Verify with `node tests/manga-links.mjs`, a live collector run, and desktop/mobile UI checks. The existing Commons build preserves the independent `commons/manga/` directory. Only the source catalog integration requires rebuilding the Commons hub; the existing GitHub Pages release workflow performs that build.
