# Yu-Gi-Oh Commons catalog

Public read-only adapter for Konami's Japanese OCG card database. The independent
viewer lives at `/commons/yugioh-flavor/`. No database, accounts, private rooms,
service-role key or user data are used.

`kind=search` accepts q (50 characters), scope (name/text/pendulum/number), type
(normal/all/monster/effect/spell/trap), attribute, set, sort and page. Requests use
10-card official pages, with the release upper bound set to today's Japanese
calendar date. `kind=sets` returns registered sets up to that date.
`kind=detail&id=4007` returns published alternate images and printing metadata.
Product searches use the official complete-product page (bounded to 2 MB),
validate its total count, filter the full set locally and then paginate. This
avoids Konami's product mode ignoring the ordinary query filters. Card-number
search requires removing the set filter; ordinary name/body searches combine.

Only fixed official endpoints are fetched. Upstream HTML is converted to text;
source URLs and image origins are allowlisted. The client inserts text with
textContent. Search results are validated against the official range count;
empty results, absent text, and upstream failures remain distinct. Caches are
bounded (160 entries, search 15 minutes, sets/detail 1 hour), same-query fetches
are deduplicated, and at most four upstream reads run per isolate. Per-IP limits
are best-effort in-memory limits, not a distributed quota.

The public publishable key is validated by the handler; it is intentionally
public, not an account credential. Browser origins are restricted to aitechd.com
and www.aitechd.com. Deploy index.ts, core.mjs and public-key.mjs with
verify_jwt=false because this endpoint uses that custom key check.

Coverage: registered OCG cards, grouped by official card ID. Japanese database
pages sometimes contain English prize cards; their original text is preserved.
This is not a verified exhaustive archive of every worldwide printing or every
historical wording. Rush Duel is a different database and is excluded. Printed
sample watermarks are preserved; image alternatives do not imply every rarity
or edition is available. No full card corpus is bundled into the repository.

Verification: `node tests/yugioh-library.mjs`, plus actual upstream/deployed checks
for normal monsters, pendulum effects, spell/trap cards, final pages and images.
