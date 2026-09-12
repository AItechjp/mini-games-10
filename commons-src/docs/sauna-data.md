# Nationwide sauna directory

`/sauna` is part of the existing COMMONS Site. Its public hub entry and side navigation use `lib/site-catalog.ts`.

The dataset is an OpenStreetMap extract, **not an exhaustive register of Japan's saunas**. The first import contains 901 records across 42 prefectures; all 47 prefecture filters remain visible. 0 records means no data, not no facilities. Neither scheduled opening hours nor a fresh status response confirms actual operation or admission. The source snapshot date is June 1, 2026 in Japan; the later acquisition date is displayed separately. The page does not claim a live facility-data feed.

## Import and coverage

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

## Opening status

`opening_hours` 3.14.0 evaluates the published OSM expressions in the UTC Worker, shifted to Japanese wall-clock time. Simple Japanese holiday rules are expanded to the Cabinet Office's 2026/2027 calendar before parsing, including substitute and citizens' holidays missing from the package's Japanese calendar. Unsupported holiday intersections/offsets and unverified years remain unknown. Facility hours are distinguished from sauna-specific hours. Unparseable, by-appointment, solar, school-holiday, or non-public entries return `unknown` instead of inventing hours. The status API returns every ID and no-store server time; the client checks the complete set of IDs and the dataset revision. A status refresh runs once per minute while visible and on reconnection. After two minutes without a successful response, all displayed status badges become `unknown`.

Rendering has no pagination, top-N limit, or load-more cutoff. CSS `content-visibility` lets browsers defer offscreen layout without deleting list entries; browser find and assistive navigation can still reach the complete list.

Validation: `node scripts/test-sauna.mjs` and the existing project build. A request to `/api/sauna/status` provides calculated status, not a fresh facility-data import.

The opening-hours parser is used server-side under LGPL-3.0-only. Its published source and license are available at [opening-hours/opening_hours.js](https://github.com/opening-hours/opening_hours.js).
