# takeoff.json v1 — the headless takeoff import contract

The agent door for takeoffs (Wave 3.2/3.3 of PipeTooling's estimator-twin pipeline; the
extractor's operating manual is PT `docs/twins/EXTRACTOR.md`). An agent computes placements
and POSTs them; the marks land as a normal, reviewable, twin-owned project.

## Endpoint

`POST /functions/v1/import-takeoff` · Auth: the TWIN's own session JWT
(`Authorization: Bearer <access_token>` from a twin-login mint) — **twin accounts only**
(`profiles.is_digital_twin`), always the caller's own project. Idempotent by
`(owner, name)`: re-import replaces, never duplicates.

**Reviewer orientation**: pages may carry `rotation` (0 | 90 | 180 | 270) — set it on
sheets whose content is drawn rotated so the plan opens right-side up for reviewers.
Pure view transform: all coordinates stay in the rotation-0 base frame. Twin imports
should always set it from the orientation gate.

**Bid stamp**: pass `external_ref` (≤40 chars, e.g. the PipeTooling bid number `"b409"`)
and the project carries it as a chip in Load Project / Bid Board, matched by list search,
and appended to the status-bar project segment (`projects.external_ref`). Field present →
set on insert and replace; absent → left untouched on re-import. Twin imports should
always pass their bid number.

**PDF leg** (robot-pdf-intake): pass `pdf_url` (+ optional `pdf_headers`, ≤4, e.g.
`{"X-Twin-Token": "…"}` for PipeTooling's `plan-fetch?bid=b403` endpoint) and the function
fetches the plan set server-side, verifies it is a PDF (magic bytes, ≤50 MB — the app's
storage cap), counts pages with pdf-lib, stores it at the app's exact path
(`<uid>/<project>/document.pdf`, `pdfs` bucket, upsert) and stamps `projects.pdf_path` —
the project opens WITH plans under the marks. Page indexes beyond the PDF's page count are
rejected by name; the pages array is padded to cover every PDF page. A failed PDF leg
never unwinds the imported marks: the response's `pdf.ok`/`pdf.error` reports loudly.
Omit `pdf_url` for the original canvas-only behavior.

**Layered canvases** (2026-08-30): counters and lineTypes may carry a `canvas` name —
annotations group into per-page canvas layers by it (convention: `Fixtures`, one canvas
per pipe system named after it, `Fittings`). Reviewers toggle layers over the plan with
the app's existing canvas switcher / Show-all / Hide-marks — no new UI. Elements without
a `canvas` land on `Main` (back-compat).

## Payload

```json
{
  "name": "ZZ Twin LIVSTE takeoff",
  "note": "counters-first pass from substrate v0.4",
  "external_ref": "b409",
  "takeoff": {
    "version": 1,
    "counters":  [{ "id": "c-wc12", "name": "WC-12", "icon": "<svg path, optional>", "color": "#e8c547" }],
    "lineTypes": [{ "id": "lt-cw", "name": "Cold Water", "color": "#4a9eff" }],
    "pages": [{
      "index": 0,
      "label": "P200",
      "scale": { "pixelsPerUnit": 12.34, "unit": "ft" },
      "rotation": 90,
      "counterMarkers": { "c-wc12": [{ "x": 120.5, "y": 340.0 }] },
      "quickLines":  [{ "x1": 0, "y1": 0, "x2": 240, "y2": 0, "lineTypeId": "lt-cw" }],
      "polylines":   [{ "points": [{ "x": 0, "y": 0 }, { "x": 10, "y": 20 }], "lineTypeId": "lt-cw" }],
      "notes":       [{ "x": 200, "y": 200, "text": "RFI: fixture missing from schedule",
                        "detail": "optional long body — shows in the Notes ledger drawer, never on the sheet" }]
    }]
  }
}
```

## Coordinate contract

Coordinates are **canvas pixels in the page's base frame** (PDF viewport at scale 1 →
1 unit = 1 PDF point), rotation 0. `scale.pixelsPerUnit` is px per FOOT in that same frame —
derive it by dimension-string calibration (stated scales lie on reduced prints; see
EXTRACTOR.md). `RFI:`-prefixed notes ride the existing RFI-flags convention.

## Notes contract (Notes ledger, 2026-08-30)

Keep each note's on-sheet `text` **short — one line, ≤ ~100 chars**: a question for
RFIs, a label for everything else. Long provenance (how a run was traced, gate
numbers, workflow detail) goes in the optional `detail` field (≤ 4000 chars) — it
shows in the app's Notes ledger drawer and hover chip, never as plan-space text.
In the app, RFI and `detail`-bearing notes render as numbered pins; the reviewer
resolves or answers them in the drawer, and answers flow back to the twin via the
`twin_rfis` bridge verb (surfaced in PT `get_work_state`). An answered RFI comes
back `resolved: true` with the reviewer's `answer` — read it before re-asking.

## Validation & scoring

Rejections are 400s that NAME the field (`takeoff.pages[3].quickLines: unknown lineTypeId`)
— an agent can fix what it's told. Score any import against a reference with the
`takeoff-eval.js` kernel (`diffTakeoffs(candidate, reference)` — counts per counter name,
decimal feet per line-type name, px reported separately when unscaled).

Provenance: `data.agentImport {imported_at, source, note}`; the project is owned by the
twin account, which every surface already badges 🤖.

## takeoff.json v2 — groups, child counts, drops, zones, trade (2026-09-07)

`version: 2` accepts everything v1 does plus the fields an electrical takeoff needs and a
plumbing one uses (the Electrical Fleet plan, engineering item E3). v1 stays strict: a v1
payload carrying any v2 field is rejected by name — send `version: 2`.

```json
{
  "name": "ZZ Twin b409 electrical",
  "external_ref": "b409",
  "takeoff": {
    "version": 2,
    "trade": "electrical",
    "groups":    [{ "id": "g-lp1-7", "name": "LP-1 / 7", "color": "#4a9eff" }],
    "counters":  [{ "id": "c-dup", "name": "Duplex Receptacle",
                    "childCounts": [{ "name": "4\" Square Box", "qty": 1, "per": "count" }] }],
    "lineTypes": [{ "id": "lt-emt", "name": "1/2\" EMT",
                    "childCounts": [{ "name": "Coupling", "qty": 1, "per": "ft", "ftInterval": 10 },
                                    { "name": "Connector", "qty": 2, "per": "run" }] }],
    "pages": [{
      "index": 0, "scale": { "pixelsPerUnit": 12.34, "unit": "ft" },
      "counterMarkers": { "c-dup": [{ "x": 120.5, "y": 340.0, "group": "g-lp1-7" }] },
      "quickLines":  [{ "x1": 0, "y1": 0, "x2": 240, "y2": 0, "lineTypeId": "lt-emt",
                        "group": "g-lp1-7", "startDrop": 9.5, "endDrop": 0 }],
      "multiplyZones": [{ "x1": 0, "y1": 0, "x2": 600, "y2": 400, "multiplier": 3 }],
      "scaleZones":    [{ "x1": 700, "y1": 0, "x2": 900, "y2": 200, "scale": { "pixelsPerUnit": 24.68, "unit": "ft" } }]
    }]
  }
}
```

| Field | Meaning | Lands as |
|---|---|---|
| `trade` | `plumbing` \| `electrical` \| `hvac` | `data.trade` → `state.trade`; rides Open in TakeoffTooling as `project.trade` |
| `groups[]` | circuits, panels, areas — `{ id, name, color? }` (max 200; palette color assigned when omitted) | `data.groups`, `groupsEnabled: true` when any |
| mark / line `group` | one of `groups[].id` | `group` on the mark or line (the app's own field — Summary, report, Copy to /Tooling, the payload all group by it) |
| line `startDrop` / `endDrop` | feet of vertical at that end (a receptacle at 18" under a 10' ceiling: 9.5 with make-up) | `startDrop`/`endDrop` + `…Unit: 'ft'` — exactly what the Drop tool writes; counted in the totals |
| palette `childCounts[]` | `{ name, qty, per: 'count'\|'run'\|'ft', ftInterval? }` | `childCounts` on the counter / line type (features/child-counts.js: per count × marks, per run × runs, per ft × ceil(feet/interval) per scaled run) |
| page `multiplyZones[]` | `{ x1, y1, x2, y2, multiplier ≥ 1 }` base-frame rectangle | stamped on EVERY canvas of that page (the zone lookup is per canvas) |
| page `scaleZones[]` | `{ x1, y1, x2, y2, scale: { pixelsPerUnit, unit } }` | same |
| palette `mountHeightIn` (counters) | inches above finished floor, 0–480 (18 receptacle, 44 GFCI, 48 switch, 78 panel); omit for ceiling devices | `mountHeightIn` on the counter — the Quick creator's and details modal's field; the Chain tool reads it for the default vertical (S2) |
| `ceilingHeightFt`, `makeUpFt` | the project's ceiling (feet, > 0) and the make-up the app adds to every default vertical (feet, ≥ 0; the app assumes 1 when absent) | `state.ceilingHeightFt` / `state.makeUpFt` (Project Settings). Stored only — the door never derives drops from them; send `startDrop` / `endDrop` yourself |

Response adds `group_count`, `zone_count`, `child_rules`, `trade`. Scoring: `takeoff-eval.js`
`tally` now returns `groups` (per-group counts and feet) and `children` (rule totals), and
`diffTakeoffs` returns `children` and `groups` rows beside `counts` and `feet` — a takeoff
that counts right but puts a device on the wrong circuit is caught in `groups`, and a
forgotten drop shows in `feet`.
