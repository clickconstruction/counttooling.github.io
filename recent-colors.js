// recent-colors.js - the recent-color list core, split out of constants.js
// (2026-07-30: it is behavior, not a literal). Consumed by
// features/line-color.js (bare classic-script global) and app.js.

// Recent-color list update, shared by the Create Counter / Create Line Type
// pickers and the edit color picker (showLineColorModal/applyLineColor). Pure:
// depends only on its args, no state/DOM. Skips colors that are already in the
// preset palette (those are always visible, so they don't belong in "Recent"),
// dedupes case-insensitively, newest-first, capped at RECENT_COLORS_MAX. Returns
// a new array; never mutates `list`.
const RECENT_COLORS_MAX = 12;
function nextRecentColors(list, color, presets) {
  const base = (Array.isArray(list) ? list : []).slice(0, RECENT_COLORS_MAX);
  if (typeof color !== 'string' || !color) return base;
  const c = color.toLowerCase();
  const presetSet = (Array.isArray(presets) ? presets : []).map(p => String(p).toLowerCase());
  if (presetSet.includes(c)) return base;
  return [c].concat(base.filter(x => String(x).toLowerCase() !== c)).slice(0, RECENT_COLORS_MAX);
}


// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declarations above stay plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RECENT_COLORS_MAX, nextRecentColors };
}
