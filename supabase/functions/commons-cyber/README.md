# Commons Cyber News

Public route: https://aitechd.com/commons/cyber-news/
Runtime: existing Supabase project `dcvtubivtextycifngtk`, function `commons-cyber`.

The collector stores public RSS/Atom descriptions (up to 3,000 plain-text characters) and headlines, canonicalizes tracking URLs, deduplicates, and filters by the original publication time. Atom `updated` is used only when `published` is absent and is labelled. Undated and future-dated items are excluded. It does not retrieve publisher article pages or paywall content. Readers see source links and machine-translation provenance.

`cron` starts collection every minute independently of visitors. Publishers' RSS ttl and Retry-After, request timeouts, conditional HTTP, and exponential backoff control actual per-source intervals. A database lease prevents concurrent collectors. A completed scan time is separate from the browser's last refresh. Public reads never start collection and never accept an arbitrary feed URL.

All article rows and translated strings expire at publication + 72 hours. The API filters immediately and the cron tick deletes expired rows every minute, even if collection/translation fails. The browser does not persist articles and removes expired results. Only one latest source-health record is retained per source. Job run history for this specific cron is pruned to 72 hours. Normal platform backups are controlled by the platform separately.

## Current translation status

**Automatic translation is not connected.** As of initial deployment there are no translation API credentials in the runtime. The UI clearly states this, displays original Japanese stories, and counts collected overseas stories awaiting translation. Do not report the site as fully translated.

Keyless translation endpoints were not used in the delivered runtime after testing returned 429/404, access denial, and connection failures. The supported adapters use official services:

- DeepL: set `DEEPL_AUTH_KEY` as an Edge Function secret. Free API keys ending in `:fx` use `api-free.deepl.com`, other keys use `api.deepl.com`.
- Google Cloud Translation: set `GOOGLE_TRANSLATE_API_KEY` as an Edge Function secret.
- Self-hosted LibreTranslate: set `LIBRETRANSLATE_URL` to an authorized HTTPS server and optionally `LIBRETRANSLATE_API_KEY`.

Never put a translation key in browser files or Git. Secrets can be entered in the project's Edge Function Secrets settings. When configured, the existing minute worker processes up to 50 pending stories per run within its time budget; it saves headlines before bodies, caches completed translations, retries failures with backoff, and stops retaining pending items when their 72-hour window expires. No API key is required to read the public website.

## Schema and operations

The tool-applied remote migrations are named `commons_cyber_news_storage`, `commons_cyber_news_read_api`, and `commons_cyber_news_minute_schedule`; their SQL is preserved in `schema.sql`, `read.sql`, and `schedule.sql`. Registry: `sources.json`. Generate seed SQL with `node seed.mjs`; this contains only public source URLs and names. The production selection has 100 sources, chosen by live feed checks from 134 candidates.

All three tables have RLS enabled; `anon`/`authenticated` have no read or mutation grants. The Edge Function uses the service role internally. Collector POST requires a random 256-bit Vault token; only its digest is held in the control row. A public or missing API key cannot start collection. Cron reads the private token inside Postgres, without returning it to callers. `cyber_tick` is not callable by service_role/anonymous users. No new account gate is added to Commons.

After changing the function, redeploy `index.ts`, `core.mjs`, and `translation.ts` together with `verify_jwt=false` (custom authentication is in the POST handler; GET is intentionally public). Test parser/security boundaries with `node tests/cyber-news.mjs`. Test translation adapters with `node --experimental-strip-types tests/cyber-translation.mjs`. Adapter tests use mocked provider responses and do not substitute for a live translation test after adding credentials.

The Pages workflow now builds Commons from current source before producing the public distribution. This keeps the existing applications and their latest content, adds the catalog entry, and excludes this entire backend directory from public assets.

Selection references: https://github.com/thehappydinoa/awesome-threat-intel-rss and publisher-supplied feeds.
Schedule reference: https://supabase.com/docs/guides/functions/schedule-functions
Translation reference: https://developers.deepl.com/api-reference/translate/request-translation
