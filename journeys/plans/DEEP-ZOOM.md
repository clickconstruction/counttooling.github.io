# DEEP-ZOOM: zoom past 1200%

Will, 2026-10-14: Wendi wants to zoom in past 1200%. The fear is the white or black canvas
from "too many pixels", which the app had before. Investigated and measured on main at
655a0231 the same day; the proposal below was approved and then handed to another builder.
Nothing is built. Mockups: none needed; the measurements and screenshots were taken on the
real app on the restaurant sheet (`samples/sample-plan-advanced.pdf`, P-101, 1224×792 pt).

## What the measurements say

The browser pane on a Retina screen (DPR 2), the boot probe's canvas cap about 64 Mpx, the
safety knob at 0.5, two counters and a run seeded at the page centre, then
`state.zoom` set and `App.renderPdf()` run at each step:

| zoom | full-page buffer | CSS size | effDpr | tiles live | corner reads back |
|---|---|---|---|---|---|
| 1200% | 7018 × 4541 (31.9 Mpx) | 14,688 × 9,504 | 0.478 | 6 | yes |
| 3000% | same | 36,720 × 23,760 | 0.191 | 4 | yes |
| 6000% | same | 73,440 × 47,520 | 0.096 | 9 | yes |
| 12000% | same | 146,880 × 95,040 | 0.048 | 6 | yes |
| 30000% | same | 367,200 × 237,600 | 0.019 | 6 | yes |

No `canvas_render_blank` event at any step, the JS heap flat, a drag pan at 3000%
recomposited the tiles and read back fine.

1. **Zoom does not add pixels.** `effectiveDpr` (app.js, over geometry.js
   `clampEffectiveDpr`) clamps the page canvas's density so its buffer never exceeds
   `caps.maxArea × renderAreaSafety`. On this sheet that cap binds from about 290%; from
   there to 30000% the buffer never changed. Zooming only lowers the density of that one
   canvas.
2. **The window is kept sharp by the tile compositor** (pdf-tile-cache.js
   `ensureTileCoverage`, 512 CSS px tiles at full density, budget-capped by device memory,
   recomposited on pan). The plan's line work was crisp at every depth.
3. **What degrades is the annotation overlay.** `#annCanvas` is page-sized at the same
   clamped density as the base (`renderAnnotationsInner` sizes it to `#pdfCanvas`). At 1200%
   the marks draw at 0.48 density and pass; at 3000% they draw at 0.19 and read as blur
   against crisp line work: counter icons, index numbers, length labels, lines.
4. **The 1200% ceiling protects nothing that 300% does not.** It was set before the tile
   compositor and the read-back ratchet landed (CHANGELOG: "Counts vanishing at extreme zoom
   (canvas-blank guard)", "fix(zoom): continuous zoom values + the intermittent black screen",
   "perf(endgame): tile grid"). The white and black screens were three bugs, each fixed and
   pinned: the overlay silently allocating blank under memory pressure (the ratchet), a
   dropped tile chain (chain ownership), and a cap that ignored three coexisting canvases.
5. **The one real wall** is layout, not memory: Firefox caps an element at about 17.9
   million CSS px per side. A 36-inch sheet (2592 pt) at 5000% is 130k px, fine; at 30000% it
   is 778k px, not. Chromium showed no wall at 367k px. Safari was not tested.

## The build

Three parts, in this order. The first is the part Wendi sees.

### 1. The overlay window

Everything `renderAnnotationsInner` draws (the marks through `canvasDraw.drawAnnotationsCore`,
the ghosts, the legend, the grid, the scale line and bar, every live preview, the duct and
water overlays) goes through two module-level values in app.js: `toCanvas(p)`, which is
`p × currentRenderZoom × currentEffDpr`, and `currentEffDpr` for line widths and fonts. So one
painter can draw either target.

- Split the body into `paintOverlay(ctx, width, height)`; `renderAnnotationsInner` sizes
  `#annCanvas` to `#pdfCanvas` as today and calls it, then calls `renderAnnotationWindow()`.
- Add `#annWindowCanvas` in `#canvasContainer` after `#annCanvas`
  (`.canvas-container .ann-window-canvas { z-index: 2; pointer-events: none; }`, `display:
  none` unless deep). Deep means `dpr / currentEffDpr >= 1.15`, the same deficit the crop tile
  uses (`CROP_TILE_MIN_DEFICIT`), so the window appears exactly when the tiles do.
- Window math is `renderCropTile`'s (pdf-tile-cache.js): `k = state.zoom / lastRenderedZoom`;
  `x0 = max(0, -pan.x / k)`, `y0` likewise; `w = min(pageCssW, x0 + wrap.width / k) - x0`, `h`
  likewise, all in container units (`pageCssW` = `#pdfCanvas`'s CSS width). The canvas sits
  at `left: x0; top: y0`, CSS size `w × h`, buffer `ceil(w·k·dpr) × ceil(h·k·dpr)`.
- The transform: rebind `currentRenderZoom = state.zoom`, `currentEffDpr = dpr`, and subtract
  an offset `(x0·k·dpr, y0·k·dpr)` in `toCanvas` (a module-level `overlayOffset`, zero for the
  page pass so `#annCanvas` pixels stay byte-identical and render-pixels.spec.js holds), inside
  a try/finally that restores all three. The aim loupe reads `toCanvas` for the page overlay,
  so the rebinding must be synchronous and restored before anything else runs.
- Redraw: at the end of every overlay paint, and at the four pan-end sites that call
  `scheduleCropTile()` (the mouse-up paths, the middle-button release, the touch-pan end).
  During a pan the window rides the container transform; a newly exposed strip shows the soft
  page overlay until pan end, exactly as the PDF tiles behave. A zoom gesture scales the
  container until the commit's `renderPdf` repaints. Hide-marks: the painter returns after
  clearing, so the window clears too.
- Cost: on a preview mousemove, one more viewport-sized paint (about 5 Mpx) beside today's
  page-sized one (up to 32 Mpx). Exports (`renderAnnotationsToContext`) untouched.

### 2. The ceiling, with two guard rails

- `getMaxZoom()` (app.js) becomes `min(state.maxZoom ?? 4, deviceZoomCeiling())`.
  `deviceZoomCeiling()`: 12 when `getCanvasCaps().maxArea < 32e6` (iOS Safari probes about
  16.7 Mpx) or `navigator.deviceMemory < 4` (undefined on Safari and Firefox, so only Chromium
  low-memory devices), else 50; then `min` with `floor(16e6 / longest page side in pt)` for
  the Firefox wall. Every wheel, pinch, rail and ladder clamp already reads `getMaxZoom()`.
- Zoom Settings (features/zoom.js; `#zoomMax` in app/index.html, today `max="1200"`): set the
  slider's max to the ceiling × 100 at open, and a hint under it when the device holds it at
  1200%. `maxZoom` already rides the project payload (save-utils.js `projectPayloadFields`).
- The rail's ticks (features/zoom-rail.js `TICK_PCTS`, `MAJOR_PCTS`) gain 2000, 3000 and 5000;
  the rail is already log-scaled.

### 3. The backdrop budget

Past 4× the full-page canvas is only a backdrop under the tiles and the window. In
`effectiveDpr`, past `DEEP_ZOOM_BASE_FROM = 4`, cap the area at
`min(caps.maxArea × renderAreaSafety, DEEP_ZOOM_BASE_MAX_AREA = 24e6)`. Peak memory at depth
drops by about half, so 5000% is safer than today's 1200%. The bitmap cache keys include
effDpr, so cached rungs stay valid; pdf-tile-cache.js's own budgets are unchanged. The step at
4× only binds when the base is already clamped, which on any real sheet it is by 3×.

## Tests

- Existing, all must stay green: zoom-canvas-cap.spec.js (it computes expected sizes through
  `App.effectiveDpr`, so part 3 passes through it, and its area assertion still holds),
  tile-grid, crop-tile, commit-tile, zoom-ladder, zoom-rail, zoom,
  zoom-no-updateui-during-gesture, pyramid, pyramid-persist, rung-prefetch, doc-warmup,
  page-switch-cache, render-pixels (the `#annCanvas` baselines must not move), the two
  aim-loupe specs, measure-loupe, the legend specs, grid, ghost, drop-mode.
- New `deep-zoom.spec.js`: at 3000% the window canvas is visible with a buffer about the
  viewport × dpr; a pixel probe at a seeded mark's window position carries the mark's colour
  while the same mark on `#annCanvas` is soft; the base buffer is at or under 24 Mpx past 4×;
  twenty drag pans log no `canvas_render_blank` and the window still shows the mark; at 100%
  the window is hidden; `App.setCanvasCaps({ maxArea: 10e6 })` makes `getMaxZoom()` 12 at
  most; a 14,400 pt page gets `floor(16e6 / 14400)`.
- Then one run on Wendi's machine: the Save Status export already carries her probed cap,
  the safety knob and any blank events (the `display` block).

## Built (2026-10-14)

All three parts, in the order above, one PR, with deep-zoom.spec.js (the tests listed below as
written) and the zoom, rail, tile and render-pixels specs green. Three refinements over the
proposal, each found while building:

- The window's gate reads `effectiveDpr(page, state.zoom)`, the density the page overlay WILL
  have at the zoom asked for, not the one it last painted at, so the cold-commit cut (made
  before the raster lands) shows on the first deep zoom too.
- The window paints BEFORE the page pass, so the page pass is the last to run and every DOM
  anchor an overlay records while painting (the duct cursor chip, the water card) stays in
  page-buffer units; a second canvas painted last would have left them in window units.
- The device ceiling is read-time only: the save blob and the project payload carry
  `getProjectMaxZoom()` (the project's own, 400% unset), and the Zoom Settings dialog shows
  the project's own held to the device's range and writes it back only when the slider moved,
  so a phone that opens the dialog cannot lower a project's 3000% to 1200%.
- The window is transparent, and the first 3000% screenshot showed the page overlay's fat, soft
  marks haloing the crisp ones through it. The page pass now ends by clearing the window's box
  out of `#annCanvas`, so under the window only the window shows and the soft overlay stands
  only in the strips a pan reveals; a pan end and a cold commit repaint the whole overlay
  (`recutOverlayWindow`), not the window alone, so the hole moves with it. The aim loupe
  samples the crop canvas and the window where they stand, so a tablet keeps its marks under
  the loupe at depth.

Live check: see CHANGELOG.md's DEEP-ZOOM entry.

## Decisions

Assumed, Will to confirm: the ceiling is 5000%, and phones and small-cap devices hold 1200%.
