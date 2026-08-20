// recent-drops.js - the recent line-DROP list core, the sibling of
// recent-colors.js. Consumed by features/item-details.js (the Line Properties
// chips), features/drop-mode.js (the Drop tool palette), and app.js.
//
// A "drop" is the vertical rise/fall recorded at a line end (risers, stacks,
// stubs down to a fixture). The values a bid uses are a SMALL vocabulary —
// 3 ft to a fixture, 10 ft floor-to-floor, 6 in for a stub — repeated over and
// over, which is why the last few are worth keeping: they turn the ±1/±10
// arithmetic into one click, in both surfaces that set a drop.
//
// Entries are { value, unit } (unit is the drop's own unit, exactly as
// line.startDropUnit / line.endDropUnit store it — the length math converts
// per-drop, so a 6 in recent and a 3 ft recent coexist happily).

const RECENT_DROPS_MAX = 5;

// Recent-drop list update. Pure: depends only on its args, no state/DOM.
// Newest-first, deduped on value+unit together (3 ft and 3 in are different
// drops), capped at RECENT_DROPS_MAX. Non-positive or unparseable values are
// ignored — clearing a drop is not a value worth remembering. Returns a new
// array; never mutates `list`.
function nextRecentDrops(list, value, unit) {
  const base = (Array.isArray(list) ? list : [])
    .filter(d => d && typeof d.value === 'number' && d.value > 0)
    .slice(0, RECENT_DROPS_MAX);
  const v = typeof value === 'number' ? value : parseFloat(value);
  if (!(v > 0) || isNaN(v)) return base;
  const u = String(unit || 'ft');
  const entry = { value: v, unit: u };
  return [entry].concat(base.filter(d => !(d.value === v && d.unit === u))).slice(0, RECENT_DROPS_MAX);
}

// Display label for a recent entry / palette size: "3 ft", "6 in", "2.5 ft".
// Whole numbers lose the trailing zeros; everything else keeps two decimals.
function formatDropLabel(value, unit) {
  const v = typeof value === 'number' ? value : parseFloat(value);
  if (!(v > 0) || isNaN(v)) return '';
  const num = Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(2)));
  return num + ' ' + String(unit || 'ft');
}


// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declarations above stay plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RECENT_DROPS_MAX, nextRecentDrops, formatDropLabel };
}
