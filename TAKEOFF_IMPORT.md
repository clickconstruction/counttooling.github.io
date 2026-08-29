# takeoff.json v1 — the headless takeoff import contract

The agent door for takeoffs (Wave 3.2/3.3 of PipeTooling's estimator-twin pipeline; the
extractor's operating manual is PT `docs/twins/EXTRACTOR.md`). An agent computes placements
and POSTs them; the marks land as a normal, reviewable, twin-owned project.

## Endpoint

`POST /functions/v1/import-takeoff` · Auth: the TWIN's own session JWT
(`Authorization: Bearer <access_token>` from a twin-login mint) — **twin accounts only**
(`profiles.is_digital_twin`), always the caller's own project. Idempotent by
`(owner, name)`: re-import replaces, never duplicates. Canvas-only (no PDF): a human
attaches or copies the plan set when reviewing.

## Payload

```json
{
  "name": "ZZ Twin LIVSTE takeoff",
  "note": "counters-first pass from substrate v0.4",
  "takeoff": {
    "version": 1,
    "counters":  [{ "id": "c-wc12", "name": "WC-12", "icon": "<svg path, optional>", "color": "#e8c547" }],
    "lineTypes": [{ "id": "lt-cw", "name": "Cold Water", "color": "#4a9eff" }],
    "pages": [{
      "index": 0,
      "label": "P200",
      "scale": { "pixelsPerUnit": 12.34, "unit": "ft" },
      "counterMarkers": { "c-wc12": [{ "x": 120.5, "y": 340.0 }] },
      "quickLines":  [{ "x1": 0, "y1": 0, "x2": 240, "y2": 0, "lineTypeId": "lt-cw" }],
      "polylines":   [{ "points": [{ "x": 0, "y": 0 }, { "x": 10, "y": 20 }], "lineTypeId": "lt-cw" }],
      "notes":       [{ "x": 200, "y": 200, "text": "RFI: fixture missing from schedule" }]
    }]
  }
}
```

## Coordinate contract

Coordinates are **canvas pixels in the page's base frame** (PDF viewport at scale 1 →
1 unit = 1 PDF point), rotation 0. `scale.pixelsPerUnit` is px per FOOT in that same frame —
derive it by dimension-string calibration (stated scales lie on reduced prints; see
EXTRACTOR.md). `RFI:`-prefixed notes ride the existing RFI-flags convention.

## Validation & scoring

Rejections are 400s that NAME the field (`takeoff.pages[3].quickLines: unknown lineTypeId`)
— an agent can fix what it's told. Score any import against a reference with the
`takeoff-eval.js` kernel (`diffTakeoffs(candidate, reference)` — counts per counter name,
decimal feet per line-type name, px reported separately when unscaled).

Provenance: `data.agentImport {imported_at, source, note}`; the project is owned by the
twin account, which every surface already badges 🤖.
