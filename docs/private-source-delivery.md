# Private AITECH source, public website

The prepared distribution contains compiled/minified browser code and public assets.
It does not contain development directories, database migrations, source maps, or
the removed shogiops dependency. Browser-delivered code remains inspectable;
minification does not encrypt it or make client-side secrets safe.

## Build and verify

Use Node 22, `npm ci`, `npm run build`, and `npm run check:distribution`.
The root `dist/` directory is the only deployment directory.
`npm run build:board` reproduces the pinned permissively licensed board libraries.
Current Shogi rules use tsshogi 2.3.4 (MIT) through AITECH's own adapter. Retain
all third-party notices. Previously distributed GPL releases keep their original
licenses; this migration does not revoke recipients' existing rights.

## Safe hosting cutover

1. Connect the existing repository to Cloudflare Pages with its Git integration.
   Use `main`, root `/`, build command `npm run build`, output `dist`, and Node 22.
   Git integration avoids dependence on the currently invalid Pages API token.
2. Verify the generated Pages address and representative games, Commons tools,
   the Unity WASM/data files, ads.txt and required third-party notices.
3. Add `aitechd.com` and any currently used www hostname to the Pages project,
   update only their web-serving DNS records, and wait for approved TLS and
   successful HTTPS delivery. Preserve mail and verification DNS records.
4. Only after traffic is confirmed on the new host, disable the GitHub Pages
   workflow and update the scheduled Commons refresh to use Pages Git integration
   or its deploy hook. Its current bot push explicitly dispatches deploy-pages.yml.
5. Change AItechjp/mini-games-10 to private in GitHub Settings. Verify anonymous
   access to the repository, raw files and history is denied while aitechd.com
   remains public and usable. Check related repositories for public copies.

Do not make the repository private while the domain still relies on GitHub Free
Pages: GitHub documents that this unpublishes its site. Do not treat a successful
build, a private deployment preview, or source minification as repository privacy.

## Current blockers (2026-09-13)

The repository is still public. GitHub's browser sign-in returned an unexpected
browser error, and fresh verification remained signed out. The Cloudflare
dashboard stopped at human verification; the existing Actions Cloudflare token
also failed validation. No DNS, repository visibility or audience changes have
been made. The compiled public distribution has been deployed through the existing
GitHub Pages host. Its root and Commons return HTTP 200, removed development-source
URLs return 404, the compiled zombie module matches the local verified artifact,
and a live Shogi player move plus CPU reply were confirmed. Finish authenticated
cutover before claiming repository privacy or this task complete.
