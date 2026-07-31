// zoom-ladder.js - the zoom rung ladder, split out of constants.js
// (2026-07-30: real algorithms, not literals). Consumed by app.js and
// pdf-tile-cache.js (bare classic-script globals); natural sibling of the
// render seam modules. Loads right after constants.js in app/index.html.

// The ladder (min 0.2 x 1.15^n) is RASTER CURRENCY, not displayed values:
// state.zoom stays fully continuous. renderPdf serves a commit from the
// nearest rung's cached bitmap (CSS carries the <=7% residual, an idle
// exact-refine settles crisp), and the idle prefetcher warms the rungs
// around the current zoom — so repeat zooming becomes a synchronous blit
// instead of a multi-second re-raster on dense sheets.
// Pure: callers pass minZoom/maxZoom (state.maxZoom is user-configurable).
const ZOOM_LADDER_STEP = 1.15;
const ZOOM_LADDER_MIN = 0.2;
function snapZoomToRung(z, minZoom, maxZoom, step) {
  const s = step || ZOOM_LADDER_STEP;
  const lo = minZoom ?? ZOOM_LADDER_MIN;
  const hi = maxZoom ?? 4;
  if (!(z > 0)) return lo;
  const zc = Math.max(lo, Math.min(hi, z));
  const n = Math.round(Math.log(zc / lo) / Math.log(s));
  let rung = Math.max(lo, Math.min(hi, lo * Math.pow(s, n)));
  // The clamp ends are rungs too: a gesture that lands at/near maxZoom (rail
  // dragged to the top, wheel against the ceiling) must commit to maxZoom
  // itself, not get pulled down to the nearest interior rung. Pick whichever
  // of {rung, hi} is nearer in log space (lo is covered by the clamp above).
  if (Math.abs(Math.log(zc / hi)) < Math.abs(Math.log(zc / rung))) rung = hi;
  return rung;
}
// Smallest rung strictly above z (clamped to maxZoom). The 0.1% epsilon makes
// a value sitting ON a rung (within float noise) step to the NEXT rung.
function nextRungUp(z, minZoom, maxZoom, step) {
  const s = step || ZOOM_LADDER_STEP;
  const lo = minZoom ?? ZOOM_LADDER_MIN;
  const hi = maxZoom ?? 4;
  const zc = Math.max(lo, Math.min(hi, z > 0 ? z : lo));
  const n = Math.floor(Math.log(zc * 1.001 / lo) / Math.log(s)) + 1;
  return Math.max(lo, Math.min(hi, lo * Math.pow(s, n)));
}
// Largest rung strictly below z (clamped to minZoom); same epsilon reasoning.
function nextRungDown(z, minZoom, maxZoom, step) {
  const s = step || ZOOM_LADDER_STEP;
  const lo = minZoom ?? ZOOM_LADDER_MIN;
  const hi = maxZoom ?? 4;
  const zc = Math.max(lo, Math.min(hi, z > 0 ? z : lo));
  const n = Math.ceil(Math.log(zc * 0.999 / lo) / Math.log(s)) - 1;
  return Math.max(lo, Math.min(hi, lo * Math.pow(s, n)));
}


// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declarations above stay plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZOOM_LADDER_STEP, ZOOM_LADDER_MIN, snapZoomToRung, nextRungUp, nextRungDown };
}
