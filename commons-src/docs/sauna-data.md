# SaunaNow nationwide inventory

`https://aitechd.com/commons/sauna/` uses `aitech/sauna-nationwide.tsx` and
`data/sauna-inventory.json`. This is the complete acquired scope of the listed
sources, **not a certified complete register of every bathing facility in Japan**.
The page shows coverage and missing opening hours explicitly. Unavailable hours
must not be fabricated, and facilities must not disappear just because hours are
missing. No top-N cap is applied during acquisition, assembly or search.

## Sources and provenance

- OpenStreetMap: the whole Japanese administrative area, including sauna,
  public bath, onsen/sento and bath-type tags, plus lifecycle-tagged features.
  The acquisition requires no Overpass remark and reconciles every object type
  with the final `out count`. Both OSM database time and area time are retained.
  All 47 prefectures are assigned by prefecture polygons; coastal exceptions
  use explicit addresses or a current OSM administrative-area lookup, never
  proximity to a guessed prefecture.
- Municipal open data: all rows from 12 specifically identified public license
  or bath inventories. The source table gives their actual geographic scope.
  Data dates and catalog metadata modification dates are separate. Registry
  presence does not establish continuing operation or public admission.
- Bath unions: the complete published lists for Hyogo, Kyoto, Hokkaido and the
  three Kanagawa regions, 342 entries before cross-source deduplication.
- Operators: the specified eight chain lists. Inaccessible or unverified
  entries are recorded as gaps in source coverage, never counted as collected.
- The original 124 individually reviewed schedules remain the highest-priority
  records, including their closures, bath-specific hours and admission notes.

All records have source URLs. OSM-derived data is available as a database under
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) with
[OpenStreetMap attribution](https://www.openstreetmap.org/copyright). Municipal
licenses and direct data URLs are retained per source. Official-site facts do
not include copyrighted venue descriptions, reviews or photographs.

`checkedAt` means a schedule evidence/check date; an OSM download timestamp is
never substituted for `check_date:opening_hours`. `sourceDate` is the date of the
source data, and `acquiredAt` is the acquisition date. Old registry schedules
remain dated as old. Weekday-only OSM rules are kept as calendar notes and never
reported as explicit opening times or assumed to mean 24-hour bathing.

## Scope, merge and status rules

Foot/hand/finger baths, toilets, explicitly closed/demolished facilities and
non-bathing license categories are excluded with reasons. Classification gaps
in municipal permit records stay in the source snapshot but are excluded from
public results. Temporary closures are retained and visibly marked. A closed
sauna inside an otherwise operating bath is handled separately. Access limits,
reservation requirements and known welfare-only limits are preserved.

Equal names alone are insufficient to merge records. A match requires the same
source ID or the same normalized name/prefecture with additional address, phone,
website or close-coordinate evidence and no conflicting city. Generic unnamed
points are not merged by proximity. Additional evidence from later sources gets
a second reconciliation pass. Reviewed schedules have priority; other sources
and source IDs are retained. `sauna-inventory-audit.json` accounts for every
merged/excluded row. Source totals must equal displayed records plus duplicates
and exclusions, including rows rejected during registry preprocessing.

The UI searches every record, then paginates the matching results at 50 or 100
per page. Filters include all 47 prefectures, municipality, venue type, presence
of hours and access conditions. Conditional, undated, stale or unparseable
schedules never produce an unqualified currently-open badge. Explicit closure
periods and reception cutoffs retain the original tested behavior. A prose
schedule remains visible without guessing a machine-readable weekly rule.

Only the existing live collector's small configured subset is periodically
rechecked. A one-minute UI refresh is not a nationwide source refresh. Failed
requests never remove saved facilities. Matching fresh evidence updates both
schedule provenance and its date; conflicting evidence is displayed for review.

## Rebuild and validation

Normalized acquired snapshots are in `data/sauna-sources/` and retain their
source counts, dates, licensing and gaps. To rebuild the inventory from the
committed snapshots:

```sh
python3 scripts/assemble-sauna-inventory.py
python3 scripts/test-sauna-inventory.py
node scripts/test-sauna-nationwide.mjs
pnpm typecheck
pnpm build:aitech
```

`stage-sauna-sources.py --help` describes the explicit raw collector inputs.
The OSM collector and prefecture reconciliation helper are under
`scripts/sauna-sources/`; their CLI supports an output directory, original
acquisition timestamp when reprocessing, boundary file and baseline snapshot.
A fresh OSM import must download current prefecture boundaries, re-resolve any
unassigned coastal points, and retain the original acquisition metadata.
Never publish partial/failed network responses as complete.

`data/sauna-inventory.json` and `public/sauna-inventory.json` must match exactly.
The build copies the latter to `/commons/sauna-inventory.json`. Validation covers
source-count reconciliation, missing-hour preservation, all prefectures,
non-ambiguous merging, unchanged reviewed schedules, restricted/stale status,
closure exceptions and overnight entry cutoffs.

## Legacy dataset

The earlier 901-record sauna-only snapshot and its original endpoint remain
available to legacy consumers. They are not the current nationwide inventory.

### Legacy import and coverage

Public Overpass instance: `https://overpass.private.coffee/api/interpreter`.

Completed queries (no output count cap):

```
[out:json][timeout:30];nwr[leisure=sauna](20,122,46,154);out center tags;
[out:json][timeout:25];nwr[sauna=yes](20,122,35,154);out center tags;
[out:json][timeout:25];nwr[sauna=yes](35,122,40,154);out center tags;
[out:json][timeout:25];nwr[sauna=yes](40,122,46,154);out center tags;
```

The importer takes all four complete responses, refuses a response containing an Overpass error/remark, unions OSM IDs, classifies coordinates using the prefectural polygons in [dataofjapan/land](https://github.com/dataofjapan/land/blob/master/japan.geojson), and removes non-Japanese records and explicitly inactive sauna tags. Different OSM IDs are retained to avoid accidentally merging separate facilities. Unknown opening hours and missing names remain in the directory. The arithmetic of displayed records plus geographic/inactive exclusions must equal the full imported union. No request from a site visitor contacts Overpass.

To update, acquire the four responses and boundary data, run `scripts/import-saunas.py` as documented in that script, review the source date and coverage counts, run the sauna verification, and publish the new version. Do not replace a complete dataset with an empty/partial response or set acquisition time as the source update time.

`data/sauna-snapshot.json` is the server dataset. `public/sauna-data.json` is the identical downloadable database, offered under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) with [OpenStreetMap attribution](https://www.openstreetmap.org/copyright).

### Legacy opening status

`opening_hours` 3.14.0 evaluates the published OSM expressions in the UTC Worker, shifted to Japanese wall-clock time. Simple Japanese holiday rules are expanded to the Cabinet Office's 2026/2027 calendar before parsing, including substitute and citizens' holidays missing from the package's Japanese calendar. Unsupported holiday intersections/offsets and unverified years remain unknown. Facility hours are distinguished from sauna-specific hours. Unparseable, by-appointment, solar, school-holiday, or non-public entries return `unknown` instead of inventing hours. The status API returns every ID and no-store server time; the client checks the complete set of IDs and the dataset revision. A status refresh runs once per minute while visible and on reconnection. After two minutes without a successful response, all displayed status badges become `unknown`.

Rendering has no pagination, top-N limit, or load-more cutoff. CSS `content-visibility` lets browsers defer offscreen layout without deleting list entries; browser find and assistive navigation can still reach the complete list.

Validation: `node scripts/test-sauna.mjs` and the existing project build. A request to `/api/sauna/status` provides calculated status, not a fresh facility-data import.

The opening-hours parser is used server-side under LGPL-3.0-only. Its published source and license are available at [opening-hours/opening_hours.js](https://github.com/opening-hours/opening_hours.js).
