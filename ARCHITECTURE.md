# ClickCount — Code Map for AI Navigation

Use this file to locate code when `index.html` exceeds context window limits. Update line ranges when making large structural changes.

## File Overview

| File | Lines | Purpose |
|------|-------|---------|
| index.html | 1–170 | HTML structure |
| index.html | 12–170 | CSS (design tokens, layout, modals, sidebar-item.active, mobile, page-zoom-row) |
| index.html | 280–2165 | JavaScript (IIFE) |
| report.js | 1–115 | Print report; uses globals from index.html |

## index.html Section Map

| Section | Lines | Contents |
|---------|-------|----------|
| Constants | 509–556 | TOOL, SCALE_MODES, uid, COLORS (9, no white), icon paths, SCALE_CROSSHAIR_PATH, ICONS array |
| State & makeAnnotations | 556–688 | state object (counterSettings, lineTypeSettings, exportSettings, recentLineColors, pagesListCollapsed, touchPanStart, touchPanning), makeAnnotations() |
| Math & Format Helpers | 573–688 | ptDist, polylineDistance, polygonArea, distToSegment, getPageScale, formatDist, formatArea |
| Coordinate Helpers | 688–700 | getClientCoords, canvasRect, toCanvas, pdfPos, canvasToPdf, hitTest, renderIconHtml |
| PDF Rendering | 700–974 | renderPdf, renderAnnotations (scale crosshair, quick line preview, line selection highlight), getPageSize, fitZoom |
| UI Render Functions | 974–1362 | updateUI (scale-set, headerActiveCounter, headerActiveLineType), renderPagesList, renderCountersList, renderLineTypesList, renderLinesList, renderSummary |
| Modals & Handlers | 1362–1822 | PDF upload, scale, move, quick line, polyline, counter (Create/Choose tabs), line type, counterSettingsModal, lineTypeSettingsModal, lineColorModal, exportPdfModal, setScaleFirst toasts, selectLineTypeModal, clearPageConfirmModal |
| Canvas Event Handlers | 1822–1895 | handleCanvasClick, handleCanvasDblClick, handleContextMenu |
| Event Binding | 1895–2165 | updateContainerTransform, wheel zoom (debounced), touch (handleTouchAsCanvasTap for LINE, preventDefault on touchend), keyboard (Escape, arrows, Enter) |
| Init & Persistence | 2090–2165 | localStorage restore, save interval, window globals |

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
| Mobile sidebar tools | `sidebar-tool-buttons` or `moveBtnSidebar` |
| Mobile header tools | `sidebar-triggers` (Move, Counter, Line visible; Polyline hidden) |
| Header active type | `headerActiveCounter` or `headerActiveLineType` |
| Counter modal tabs | `counter-tab` or `counterChooseList` |
| Page/zoom row | `page-zoom-row` |

## Key Globals (used by report.js)

These must remain on `window`: `state`, `makeAnnotations`, `ptDist`, `polylineDistance`, `formatDist`, `renderIconHtml`.

## Data Flow

```
Events → handlers → state updates → renderPdf() / renderAnnotations() / updateUI() → DOM
```

- Annotations stored in PDF-space (zoom-independent)
- Scale is per-page: `page.scale`; use `getPageScale(pageIdx)` to read
- `canvasToPdf(x,y)` converts wrapper coords to PDF; `toCanvas(p)` converts PDF to canvas pixels (includes dpr)

## Mobile Layout (max-width: 768px)

- **Header**: Hamburger, Set Scale (when no scale), Move, Counter + active counter icon, Line + active line type color swatch (Polyline and Done Editing hidden); Set Scale hidden when scale set; "Line" not "Quick Line"; header z-index 250
- **Sidebar** (slide-in): ClickCount logo, scale display (1 ft = X when set), Upload PDF / Set Scale / Export / Import, Move / Counter / Quick Line / Polyline / Done Editing, Pages, Counters, Line Types, Lines, Summary, Print Report, Export PDF, Clear Page
- **Touch**: Single-finger pan, pinch-to-zoom, long-press (500ms) for context menu; `touch-action: none` on canvas; `handleTouchAsCanvasTap` for LINE mode (direct touch, no synthetic click); `preventDefault` on touchend to avoid ghost click double-placement; 25px movement threshold for LINE/POLYLINE taps
- **Scale taps**: 400ms debounce to avoid double-tap on mobile

## Features Beyond Spec (RECONSTITUTE.md)

- **Move button** — Header button toggles active when `state.tool === TOOL.NONE`; left of Line; visible in header on mobile
- **Set Scale button** — Dynamic: "Set Scale" when no scale; "Scale" + "1 ft = X" when set; opens scale modal for current page; clicking clears scale marks and closes modal (restart); hidden in header when scale is set (desktop and mobile); on mobile when no scale, shown before Move
- **Sidebar scale display** — On mobile only: "1 ft = X" in sidebar when scale set
- **Per-page scale** — Each page has `page.scale`; Set Scale only affects current page; `getPageScale(pi)` helper
- **Scale crosshair** — Plus icon at scale point A/B when setting scale
- **Scale toasts** — "Set Scale first to use Quick Line" / "Set Scale first to use Polyline" (3s auto-dismiss, Escape to close)
- **Select Line Type modal** — When Line/Quick Line clicked with no active line type; pick from list
- **Counter modal** — Tabs: Choose Counter (default), Create Counter; Choose Counter lists existing counters to select; Create Counter for new counter; selected icon outlined with accent; color palette 9 colors (no white)
- **Line button restart** — When drawing a line (quickLineStart set), tap Line again to clear start point and restart
- **Header active type** — On mobile: counter icon (SVG, colored) next to Counter when active; line type color swatch next to Line when active
- **Page/zoom row** — Page nav and zoom bar in same row; zoom bar to the right of page bar
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
- **Zoom** — Range 0.2–800%; CSS scale during wheel; debounced PDF re-render; translate3d for pan
