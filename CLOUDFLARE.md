# Cloudflare Pages + Supabase deployment

The existing GitHub Pages deployment remains active. Cloudflare Pages is added as a second static frontend, while both frontends share the existing Supabase backend.

## Architecture

- Existing frontend: GitHub Pages (`.github/workflows/deploy-pages.yml`)
- Additional frontend: Cloudflare Pages (`.github/workflows/deploy-cloudflare-pages.yml`)
- Shared database: Supabase Postgres
- Shared realtime multiplayer: Supabase Realtime Broadcast + Presence
- Shared guest chat and score persistence: Supabase RPC + Postgres

The Cloudflare workflow creates a clean `dist/` bundle from the repository root. Infrastructure files, migrations, Markdown documentation, and the example Supabase config are excluded from the public bundle. The browser-safe `supabase-config.js` is included intentionally because it contains only the Supabase publishable key.

## Cloudflare authentication

Configure these GitHub Actions repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token needs Cloudflare Pages write permission for the target account. Never store the Cloudflare token in frontend code or commit it to this repository.

Optional repository variable:

- `CLOUDFLARE_PAGES_PROJECT` — defaults to `aitechjp-mini-games-10`

On every push to `main`, the workflow checks whether the Pages project exists, creates it when needed, then deploys the static bundle with Wrangler.

## Supabase

Both GitHub Pages and Cloudflare Pages use the same `window.SUPABASE_CONFIG` in `supabase-config.js`. Only a Supabase publishable key is shipped to the browser. No service-role or secret key belongs in the frontend.

Existing SQL migrations remain under `supabase/migrations/` and are not deployed as static files to Cloudflare Pages.

## Failure isolation

The GitHub Pages and Cloudflare Pages workflows are independent. A Cloudflare authentication or deployment failure does not remove or replace the existing GitHub Pages site.
