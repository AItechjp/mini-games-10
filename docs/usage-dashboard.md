# Commons usage monitor

Route: https://aitechd.com/commons/usage/

The dashboard reuses the existing `public.resource_usage_public` singleton in project `dcvtubivtextycifngtk`. Its existing `resource-usage-public-refresh` cron updates once a minute. The browser requests only `database_bytes,storage_bytes,storage_objects,checked_at` using the existing public key. SELECT is already granted through RLS. No database mutations, credentials, new Edge Functions, or auth gate are added.

The database metric is `pg_database_size(current_database())`. Storage sums the current project's file metadata sizes. Its 1 GB remaining value is explicitly a project-only reference against the shared organization allowance, not a claimed organization billing balance. Do not use `auth_users_30d` as billable MAU. Missing monthly egress, function, realtime and MAU billing data remain null, never zero. No observed short-window traffic is extrapolated to a billing month.

`scripts/measure-public-usage.mjs` runs at the end of the distribution build and counts the exact published bytes/files including its own report. No repository-size conversion, source files, private credentials or filenames are exposed. The report's commit is the deployment workflow commit. It must be regenerated on every deployment. Database snapshots older than 3 minutes are marked stale; public build measurements remain attached to that published version. GitHub deployment status refreshes no more than every 5 minutes.

Manual entries are optional, explicitly marked, browser-local, validated, and attached to a specific billing period (date boundaries in Japan time). Expired entries never carry over as current usage. Values observed more than 24 hours ago are marked stale. Provider plan allowances were verified on 2026-09-14; changing plans is not detected automatically. Decimal MB/GB is stated in the UI.

Official references: https://supabase.com/pricing ; https://supabase.com/docs/guides/platform/database-size ; https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits ; https://docs.github.com/en/billing/concepts/product-billing/github-actions ; https://developers.cloudflare.com/pages/platform/limits/

Validation: `node tests/usage-dashboard.mjs`, `pnpm --dir commons-src typecheck`, `pnpm --dir commons-src build:aitech`, `npm run build`. Browser smoke: real data loading, partial network failures, zero values, over-limit/manual entries, expired billing periods, mobile width, keyboard dialog, and catalog navigation.
