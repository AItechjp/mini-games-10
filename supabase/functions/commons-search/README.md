# Commons public search

Read-only Edge Function for the AITECH hotel and rental search pages. It fetches public Rakuten Travel and SUUMO search results; it does not access the project database or existing Commons tool data.

- `index.ts`: validated requests, same-origin redirect handling, bounded upstream reads, CORS, rate limiting, short-lived cache.
- `parsers.mjs`: listing facts and required hotel region choices. Upstream errors must not become invented listings or a claim that no listings exist.
- `search-core.mjs`: synchronized copy of `commons/search/search-core.mjs`.
- `stations.mjs`: station records from `commons/search/stations.json`. Regenerate after running `scripts/import-rental-stations.py`.
- `public-key.mjs`: the existing project publishable key; intentionally public, never a service-role credential. The endpoint validates the `apikey` header. Deploy with platform JWT validation disabled because the function implements this API-key check.

Frontend: `commons/search/live-results.mjs` and `live-config.mjs`. Prices are numeric, source-attributed and timestamped; sorting covers loaded records only. Hotel room/occupancy basis is retained from the source's price label. Rental rent sorting excludes management and initial fees.

The sources can change their HTML or stop serving results. Display the retrieval error and preserve a direct source search route in that case. This integration does not guarantee complete inventory coverage or final booking prices. No search-user data is saved.
