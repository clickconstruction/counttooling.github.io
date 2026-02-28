# ClickCount — Code Map for AI Navigation

Use this file to locate code when `index.html` exceeds context window limits. Update line ranges when making large structural changes.

## File Overview

| File | Lines | Purpose |
|------|-------|---------|
| index.html | 1–127 | HTML structure |
| index.html | 12–127 | CSS (design tokens, layout, modals, sidebar-item.active) |
| index.html | 428–1918 | JavaScript (IIFE) |
| report.js | 1–115 | Print report; uses globals from index.html |

## index.html Section Map

| Section | Lines | Contents |
|---------|-------|----------|
| Constants | 428–468 | TOOL, SCALE_MODES, uid, COLORS (9, no white), icon paths, SCALE_CROSSHAIR_PATH, ICONS array |
| State & makeAnnotations | 472–489 | state object (counterSettings, lineTypeSettings, exportSettings, recentLineColors, pagesListCollapsed), makeAnnotations() |
| Math & Format Helpers | 490–524 | ptDist, polylineDistance, polygonArea, distToSegment, getPageScale, formatDist, formatArea |
| Coordinate Helpers | 605–615 | getClientCoords, canvasRect, toCanvas, pdfPos, canvasToPdf, hitTest, renderIconHtml |
| PDF Rendering | 617–730 | renderPdf, renderAnnotations (scale crosshair, quick line preview, line selection highlight), getPageSize, fitZoom |
| UI Render Functions | 891–1095 | updateUI (scale-set button), renderPagesList (collapse, badge-scale-set), renderCountersList, renderLineTypesList, renderLinesList, renderSummary |
| Utilities | 1097–1150 | onDoubleTapOrDblClick, startRename (Escape cancels), enterEditMode, exitEditMode, showModal, hideModal, toast helpers |
| Modals & Handlers | 1232–1610 | PDF upload, scale, move, quick line, polyline, counter, line type, counterSettingsModal, lineTypeSettingsModal, lineColorModal, exportPdfModal, setScaleFirst toasts, selectLineTypeModal, clearPageConfirmModal |
| Export/Import/Clear | 1491–1585 | Export JSON, Export PDF (with size settings), import, clear page (with confirmation), context menu |
| Canvas Event Handlers | 1615–1755 | handleCanvasClick, handleCanvasDblClick, handleContextMenu |
| Event Binding | 1756–1905 | updateContainerTransform, wheel zoom (debounced), touch, keyboard (Escape, arrows, Enter) |
| Init & Persistence | 1906–1918 | localStorage restore (counterSettings, lineTypeSettings, exportSettings, recentLineColors, pageScales), save interval, window globals |

## Search Hints (grep patterns)

| To find | Pattern |
|---------|---------|
| Section markers | `SECTION:` or `SECTION: PDF Rendering` |
| PDF render logic | `function renderPdf` |
| Annotation drawing | `function renderAnnotations` |
| Export PDF | `exportPdfModal` or `exportPdfDo` or `renderAnnotationsToContext` |
| Scale modal | `scaleModal` or `scaleSet` |
| Scale crosshair | `SCALE_CROSSHAIR_PATH` |
| Per-page scale | `getPageScale` or `page.scale` |
| Counter creation | `counterBtn` or `addCounter`; `counterCreate` |
| Counter settings | `counterSettingsModal` or `counterSettings` |
| Line type settings | `lineTypeSettingsModal` or `lineTypeSettings` |
| Line color modal | `lineColorModal` or `showLineColorModal` |
| Line type creation | `addLineType` or `lineTypeCreate` |
| Polyline drawing | `drawingPolyline` or `finishPolyline` |
| Line selection | `selectedLineId` or `selectedLinePageIdx` |
| Canvas click handling | `handleCanvasClick` |
| Zoom/pan | `state.zoom` or `updateContainerTransform` or `lastRenderedZoom` |
| hitTest | `function hitTest` |
| Coordinate conversion | `canvasToPdf` or `toCanvas` |
| Rename | `startRename` |
| Pages collapse | `pagesListCollapsed` or `pagesSection` |

## Key Globals (used by report.js)

These must remain on `window`: `state`, `makeAnnotations`, `ptDist`, `polylineDistance`, `formatDist`, `renderIconHtml`.

## Data Flow

```
Events → handlers → state updates → renderPdf() / renderAnnotations() / updateUI() → DOM
```

- Annotations stored in PDF-space (zoom-independent)
- Scale is per-page: `page.scale`; use `getPageScale(pageIdx)` to read
- `canvasToPdf(x,y)` converts wrapper coords to PDF; `toCanvas(p)` converts PDF to canvas pixels (includes dpr)

## Features Beyond Spec (RECONSTITUTE.md)

- **Move button** — Header button toggles active when `state.tool === TOOL.NONE`; left of Quick Line
- **Set Scale button** — Dynamic: "Set Scale" when no scale; "Scale" + "1 ft = X" when set; opens scale modal for current page
- **Per-page scale** — Each page has `page.scale`; Set Scale only affects current page; `getPageScale(pi)` helper
- **Scale crosshair** — Plus icon at scale point A/B when setting scale
- **Scale toasts** — "Set Scale first to use Quick Line" / "Set Scale first to use Polyline" (3s auto-dismiss, Escape to close)
- **Select Line Type modal** — When Quick Line clicked with no active line type; pick from list
- **Add line type first toast** — "Add a line type first" when no line types exist
- **Clear Page confirmation** — Modal "Are you sure?" with Cancel and Clear Page (danger)
- **Export PDF** — Button below Print Report; modal with marker size and line width sliders (25–150%); uses jsPDF; JPEG compression; settings persisted
- **Counter Settings** — Click "Counters" heading: icon size (12–96px), opacity, number size, outline (black SVG stroke), show ring (size, opacity, solid), all persisted
- **Line Type Settings** — Click "Line Types" heading: opacity, line size
- **Line Color modal** — Shared for Counters, Line Types, Lines: native color picker + recent colors (max 12); `showLineColorModal(currentColor, onApply)`
- **Quick line color** — Lines sidebar: click swatch to change color; quick lines and polylines support per-line color
- **Quick line preview** — Line renders from first click to second while placing
- **Quick Line Escape** — First Escape removes first point; second Escape exits to Move mode
- **Line selection highlight** — Click line in Lines sidebar: `selectedLineId`, `selectedLinePageIdx`; selected line drawn thicker with glow on canvas
- **Rename** — Edit buttons on pages, counters, line types, lines; Escape cancels (reverts); arrow keys move cursor in input
- **Line type layout** — Two-row: name on top, swatch + runs/length + edit on bottom
- **Lines layout** — Name on top, length below, swatch + edit on bottom; click to select/highlight on canvas
- **Selection highlight** — `.sidebar-item.active` for selected counter, line type, line
- **Scale badge** — Page number in Pages uses `.badge-scale-set` (yellow background, black text) when page has scale
- **Pages collapse** — Click "Pages" heading toggles `pagesListCollapsed`; `#pagesSection.collapsed` hides list
- **Counter modal** — Selected icon outlined with accent; color palette 9 colors (no white)
- **Zoom** — Range 0.2–800%; CSS scale during wheel; debounced PDF re-render; translate3d for pan
