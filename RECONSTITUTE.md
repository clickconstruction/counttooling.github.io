# ClickCount — Base Spec

This is the **core specification** for ClickCount: the stable behaviors and data
structures that define what the app *is*. It is intentionally small. The long tail
of features built on top of this core lives in [ARCHITECTURE.md](ARCHITECTURE.md)
("Features Beyond Spec"); historical/implementation detail lives in
[CHANGELOG.md](CHANGELOG.md).

Everything below was reverse-engineered from and verified against the current code
in [app.js](app.js), [annotation-model.js](annotation-model.js) and
[report.js](report.js) (last checked 2026-09-28).

## What ClickCount is

A browser-based PDF takeoff tool for plumbing, electrical and HVAC estimating. The
user loads a PDF plan, sets a drawing scale, then places **counters** (point
symbols) and draws **lines** (runs) on top of the PDF. The app tallies counts and
real-world line lengths and produces reports/exports. A project names its
**trade** (`state.trade`, null = never chosen = plumbing behavior), which picks the
Quick creator's vocabulary and the trade-specific derived layers (wire and cable,
fixture units, duct air) that ARCHITECTURE.md catalogs; the core below is the
same for all three.

## Tech model

- Vanilla HTML, CSS, and JavaScript. No build step; static deployment.
- Static assets, no bundler. The app shell is [app/index.html](app/index.html)
  (served at `/app/`; the repo-root [index.html](index.html) is the static
  marketing landing) — it holds the HTML structure and every modal, and loads
  the shared root-level assets via root-absolute `<link>` / `<script src>`:
  [styles.css](styles.css) holds all CSS; [icons.js](icons.js) is a classic
  script loaded before the main script that defines the bundled icon data
  (`*_PATH` consts, `VB_384_512_PATHS`, `FA_PATHS`, `RING_PATH`,
  `CUSTOM_ICONS`, `ICONS`) in the shared global lexical scope;
  [geometry.js](geometry.js) is a classic script loaded before the main script
  that defines pure math/geometry/parse primitives (`ptDist`,
  `polylineDistance`, `pointInRect`, zone locators, `parseFraction`, etc.) with
  no `state` dependency; a family of further pure modules loads in the same
  slot (the `*-model.js` trade models, the draw and raster seams,
  [constants.js](constants.js), [annotation-model.js](annotation-model.js),
  [save-engine.js](save-engine.js): the load order is in AGENTS.md); then
  [app.js](app.js) is the main IIFE (the bulk of the app
  logic), followed by the `features/*.js` splits, then [report.js](report.js),
  which reads globals exposed on `window`. (Full file map:
  [ARCHITECTURE.md](ARCHITECTURE.md).)
- Third-party libs are **vendored locally** in `/vendor/` (version-pinned filenames),
  not loaded from a CDN: pdf.js + its worker (render), pdf-lib (PDF manipulation),
  html2canvas + jsPDF (report/PDF export), supabase-js (optional cloud), tus-js-client
  (resumable upload). Fonts are self-hosted in `/vendor/fonts/`. This keeps the app
  same-origin so the service worker ([sw.js](sw.js)) can cache it for full offline use.
- Cloud (Supabase) is **optional**: gated by `SUPABASE_ENABLED`
  (`SUPABASE_URL` + `SUPABASE_ANON_KEY` present in `config.js`). With cloud off,
  the app is a fully functional local tool.

## Core data model

The single source of truth is the module-level `state` object (see
`// SECTION: State` in [app.js](app.js)). The takeoff data is a tree:

```
state.pages[]            // one entry per PDF page
  page = {
    pdfPage,             // pdf.js page handle
    label,               // page title
    scale,               // null until set; { pixelsPerUnit, unit } when set
    rotation,            // 0 | 90 | 180 | 270
    bakeFrame,           // { w, h, intrinsic }: the viewport the marks were baked
                         // against, so a later load can detect an orientation change
    canvases: [          // one or more overlay "layers" per page
      { id, name, annotations }
    ]
  }
```

### Annotations

`makeAnnotations()` ([annotation-model.js](annotation-model.js)) defines the shape
of every canvas's `annotations`:

```js
{ counterMarkers: {}, polylines: [], quickLines: [], highlights: [],
  notes: [], multiplyZones: [], scaleZones: [], roomBoxes: [], ghosts: [],
  ductRuns: [], ductFittings: [], legend: null }
```

- **counterMarkers** — map of `typeId -> [{ x, y, id, group }]`. Keyed by the
  counter type's id.
- **quickLines** — `[{ x1, y1, x2, y2, color, id, lineTypeId, group, startDrop?, endDrop? }]`.
- **polylines** — `[{ points: [{x,y}...], closed, color, id, lineTypeId, group, startDrop?, endDrop? }]`.
- **highlights**, **notes**, **multiplyZones**, **scaleZones**, **roomBoxes**
  (Room Sizer boxes, each referencing a `state.rooms[]` id), **ghosts** (a typical
  copied as a reference overlay), **ductRuns** / **ductFittings** (the duct
  takeoff), **legend** — see ARCHITECTURE.md (features beyond the base spec).
  The one list of which kinds count as "a mark" is annotation-model.js's
  mark-presence predicate; a new kind is added there, to `makeAnnotations()`,
  and to save/load + export/import, and annotation-model.test.js fails by name
  on a kind no list classifies.

### Counters and line types

These are the reusable "palette" the user places onto pages:

- `state.counters[]` — `{ id, name, icon, color }`. `icon` is an SVG path string.
- `state.lineTypes[]` — `{ id, name, color, curveStyle }` where
  `curveStyle` is `'straight'` (default) or `'arc'`.
- Both carry optional trade fields on the same object, never a new one (a
  counter's `mountHeightIn` / `wsfu` / `tag`, a line type's `raceway` /
  `conductors` / `waterSide` / `bendFittings`, either's `childCounts[]`); the
  palette serializes wholesale, so they ride save/load, export/import and the
  Artboard for free. The list is in AGENTS.md "Conventions".

A counter type's placed instances are the markers under
`counterMarkers[counter.id]`. A line's `lineTypeId` references the line type it
was drawn with.

## Coordinate system

All annotations are stored in **PDF-space** (zoom- and pan-independent), so the
takeoff is stable across zoom levels and screen sizes. Three helpers own the
conversion (see `// SECTION: Coordinate Helpers`):

- `toCanvas(p)` — PDF-space -> canvas pixels. Multiplies by
  `state.zoom * devicePixelRatio`.
- `canvasToPdf(canvasX, canvasY)` — canvas/wrapper coords -> PDF-space. Divides by
  `state.zoom` after subtracting `state.pan`.
- Never store canvas pixels in annotations; always convert to PDF-space first.

## Scale (per page)

Scale is **per page**, not global.

- Each page has `page.scale`, `null` until the user sets it.
- A scale object is `{ pixelsPerUnit, unit }` (e.g. unit `'ft'`); plus optional
  `label`, `refLine` (two-point calibration), and `sheetSize`/`correctionFactor`
  (the compressed-PDF sheet-size correction — see ARCHITECTURE.md).
- Read scale via `getPageScale(pageIdx)` — never reference a global `state.scale`.
- Real-world line length = geometric PDF-point length / `pixelsPerUnit`
  (plus any drops). See `getLineRealWorldLength(line, pageIdx, isPoly, ann)`.

## Tools

The active tool is `state.tool`, an enum from `const TOOL`:

| Tool | Purpose (core) |
|------|----------------|
| `NONE` | Move/select (default) |
| `SCALE` | Set the page scale by clicking two points |
| `COUNTER` | Place the active counter type |
| `LINE` | Draw a two-click straight line ("quick line") |
| `POLYLINE` | Draw a multi-vertex run |
| `EDIT_POLY` | Edit polyline vertices |

(`MEASURE`, `HIGHLIGHT`, `NOTE`, `MULTIPLY_ZONE`, `DELETE_ZONE`, `SCALE_ZONE`,
`ROOM` (Room Sizer), `CHAIN` (counter + connecting line per click), `GHOST`,
`DROP`, `DUCT` and `SCHEDULE` (drag a box over a fixture schedule) are extensions
documented in ARCHITECTURE.md; the enum is `TOOL` in [constants.js](constants.js),
the keys that arm them are `HOTKEYS` in [hotkeys.js](hotkeys.js).)

## Rendering pipeline

```
events -> handlers -> mutate state -> render
```

- `renderPdf()` rasterizes the current page to an offscreen canvas at
  `state.zoom * devicePixelRatio`, copies it to the visible PDF canvas, then calls
  `renderAnnotations()`.
- `renderAnnotations()` draws the active canvas's annotations onto the annotation
  canvas (converting PDF-space -> canvas pixels via `toCanvas`).
- `updateUI()` reconciles the DOM (sidebar lists, buttons, status bar) with
  `state`.
- `renderAnnotationsToContext(ctx, page, scale, overrides, annotationsOverride)`
  is the shared draw routine reused for PDF/print export.

## Report / summary pipeline

[report.js](report.js) builds the takeoff report and the copy/export summaries. It
runs in the same page and depends on globals that [app.js](app.js) must
keep exposed on `window`:

`state`, `makeAnnotations`, `ptDist`, `polylineDistance`, `formatDist`,
`renderIconHtml`, `quickLineLength`, `getLineLengthPdfPts`,
`getLineLengthForTotals`, `getLineLengthFeetForTotals` (tally lengths in feet),
`getLineRealWorldLength`, `getMultiplyZoneForLine`,
`getMultiplyZoneForPoint`, `getEffectiveScaleForLine`, `getMergedAnnotationsForPage`.

It exposes back: `buildReportHtml(options)`, `printReport(mode)`,
`getPipeToolingSummary(options)`, `getPipeToolingHasData()` (cheap existence
check used by `updateUI`), `getEmailTextSummary(options)`. The two summary
functions accept `{ pageIndices?, getAnnotations? }`.

## Invariants (do not break)

1. Annotations are stored in PDF-space; convert with `canvasToPdf` / `toCanvas`.
2. Scale is per-page (`page.scale` / `getPageScale(pageIdx)`); there is no global
   scale.
3. Do not remove or rename the `window.*` globals that report.js consumes.
4. `makeAnnotations()` is the canonical annotation shape; new annotation kinds are
   added there and to save/load + export/import.
5. The app must remain functional with Supabase disabled.
