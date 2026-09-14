# Commons Phone Watch

Public read-only endpoint authenticated with the existing project publishable key; JWT verification is disabled because this app has no login. It returns only public warning records; it never accepts a phone query, user post, URL, or arbitrary proxy target.

Sources: Kanto Regional Finance Bureau's current warning index, up to 40 same-origin linked warnings, and INPIT's specifically verified 2025-11-27 notice. Extraction is confined to warning table telephone cells. Masked characters remain masked. Faxes, official contact footers, entity owner names/addresses and INPIT's current help number are excluded.

The frontend polls while visible every 60 seconds. A singleton RLS-protected cache uses a conditional atomic PATCH to lease collection for 300 seconds across isolates. Only service_role has access; no anon/authenticated policies or privileges. Collection is demand-driven, not a scheduled national feed. Failed sources retain their previous records with original success timestamps and explicit stale status; removed successful-source records disappear. No dangerous/safe scores are inferred.

Kanto material is processed/abridged with links under its public data terms: https://lfb.mof.go.jp/kantou/information/tyuui.htm . This is a partial historical official warning directory, not a live exhaustive blacklist. INPIT notice facts and number are paraphrased, not its article copied. Crowd reports are linked, not scraped.

Schema is recorded by the Supabase migration named `commons_phone_public_warning_cache`. Verify anonymous cache access is forbidden before release. Run `node tests/phone-watch.mjs` for extraction safety and phone normalization checks. Regenerate any collection only from official source responses; never fabricate sample live records.
