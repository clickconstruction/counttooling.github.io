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


// First palette color used by NO existing counter (case-insensitive compare
// against counter.color). When every palette entry is in use: the entry after
// `current` (wrapping; palette[0] when `current` is off-palette; `current`
// itself when the palette is empty). Pure — shared by the Quick Count create
// (features/quick-modals.js, T2 #16) and the Create-tab twin guard
// (features/counter.js resolveCounterTwin, T2 #17).
function nextUnusedCounterColor(counters, palette, current) {
  const norm = (s) => String(s || '').toLowerCase();
  const used = new Set((Array.isArray(counters) ? counters : []).map(c => norm(c && c.color)));
  const pal = Array.isArray(palette) ? palette : [];
  const free = pal.find(c => !used.has(norm(c)));
  if (free) return free;
  if (!pal.length) return current;
  const idx = pal.findIndex(c => norm(c) === norm(current));
  return pal[(idx + 1) % pal.length];
}


// X12 (D19 fold-in): the fallback name for a line type created with the name
// field left blank. T2-05 gave the COUNTER twin this treatment — a blank
// counter name falls back to the icon's name rather than the literal
// "Counter" — but the line-type twin kept minting types all called "Line",
// indistinguishable in the sidebar, the legend and every report the moment
// there are two. A line type has no icon to borrow a name from, so the
// fallback is numbered against the palette instead: "Line", then "Line 2",
// "Line 3" — the same shape resolveCounterTwin gives duplicate counter names.
// Pure: (lineTypes, base?) -> string.
function nextLineTypeName(lineTypes, base) {
  const stem = ((base || '').trim()) || 'Line';
  const taken = new Set((lineTypes || []).map((lt) => ((lt && lt.name) || '').trim().toLowerCase()));
  if (!taken.has(stem.toLowerCase())) return stem;
  for (let n = 2; n < 1000; n++) {
    const candidate = stem + ' ' + n;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return stem;
}

// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declarations above stay plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RECENT_COLORS_MAX, nextRecentColors, nextUnusedCounterColor, nextLineTypeName };
}
