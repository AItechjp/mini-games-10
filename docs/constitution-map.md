# Commons constitution curriculum

Public route: https://aitechd.com/commons/constitution/

The Commons study catalog and study landing page link to the standalone, public,
login-free curriculum. `commons/constitution/content.json` is the canonical
hierarchical source. It includes foundational concepts, rights, government,
case distinctions, examination techniques, and original recall prompts.

Each substantive leaf provides a rule explanation, short-answer distinctions,
essay application steps, pitfalls, sources, and a recall question with an answer.
Case holdings are original summaries. Primary references link to the courts,
the Constitution, and Ministry of Justice examination materials. The curriculum
distinguishes majority holdings, separate opinions, academic frameworks, and
historical law. It does not claim that memorization guarantees examination success.

The UI supports an expandable graph, hierarchical reading, full-text search,
short-answer/essay views, local recall progress, deep links, and full printing.
The static textbook works with JavaScript disabled. Recall progress stays on the
reader's device and uses a dedicated localStorage key; no account or server is used.

After editing the curriculum, run:

```sh
python3 scripts/build-constitution-textbook.py
npm run build
```

Update `reviewedAt` only after reviewing changed material. Recheck date-sensitive
law and judgments against the primary source. Keep node IDs stable so bookmarks
and device-local recall records continue to work.

Validation: `tests/constitution-map.mjs` checks the curriculum schema, unique IDs,
hierarchy, desktop/mobile interactions, search, recall persistence, filtering,
printing, non-JavaScript textbook, and both Commons entry links. Set
`CONSTITUTION_BASE_URL` to the served site. `PLAYWRIGHT_PACKAGE` and
`CHROMIUM_EXECUTABLE` optionally select an installed local browser runtime.

The existing Commons build preserves independent subdirectories. The existing
Pages publishing workflow remains responsible for the production deployment.
