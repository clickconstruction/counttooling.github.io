// status-hint-model.js - the status bar's tool hint, as a pure model (MAP-HINTS, 2026-09-26).
//
// The footer's mode line tells the estimator what the armed tool wants next ("Click start
// point", "Tap second corner") and, while a draw is in progress, the live number it is
// producing: the Tier-2 #21 feet-inches length on Line and Polyline, the duct trace's
// "24×12 · 38'-6" · 267 lb · run 1,196 lb" beside "S = size", the Chain tool's next drop,
// the tag the plan's text layer reads beside the Counter cursor. That ladder lived inside
// features/status-bar.js `updateStatus`, in the signed-out branch only, so a signed-in
// estimator never saw any of it (the map's D01). It lives here now, for both modes.
//
// Pure: no state, no DOM, no App. Everything arrives as arguments:
//   s        the state-ish fields the ladder reads (tool, aiming, scaleMode, the rect tools'
//            first corners, quickLineStart, chainStart + currentPage)
//   press    'Click' (mouse) or 'Tap' (finger), picked live by the caller (B9)
//   readouts { draw, duct, tag, chain }: each a string or a function returning one, '' for
//            none. A function is only called for the tool that shows it, so the caller can
//            hand in its live readers without paying for the other three per mousemove.
//   enums    { TOOL, SCALE_MODES } from constants.js (which loads after this file)
//
// Returns { text, keyed }. `text` is the hint as shown ('' for a tool with none). `keyed`
// is what the one-line fit cache measures: the same text, except that a live readout is
// replaced by a fixed worst-case placeholder, so the verdict is stable while the number
// grows and the forced layout read never runs per mousemove (field feedback 2026-08-14).

// Worst case for the Line / Polyline length readout.
const HINT_READOUT_PLACEHOLDER = '88888\'-88"';
// Duct readout worst case (size · length · segment lb · run lb), DUCT unit D2.
const DUCT_READOUT_PLACEHOLDER = '88×88 · 8888\'-88" · 8,888 lb · run 88,888 lb';
// Chain readout worst case: the drop number varies, the counter name does not change per
// mousemove, so only the number rides the placeholder.
const CHAIN_READOUT_PLACEHOLDER = '+88.88 ft drop at counter';
// The Counter tool's tag hint ("Plan says B → Type B").
const TAG_READOUT_PLACEHOLDER = 'Plan says WW → counter name placeholder';

function statusHintReadoutOf(readouts, key) {
  const v = readouts ? readouts[key] : '';
  const out = typeof v === 'function' ? v() : v;
  return out ? String(out) : '';
}

function toolHintFor(s, press, readouts, enums) {
  const TOOL = enums.TOOL, SCALE_MODES = enums.SCALE_MODES;
  const p = press || 'Click';
  const st = s || {};
  const corner = (start) => (start ? p + ' second corner' : p + ' first corner');
  let text = '';
  let live = '', placeholder = '';
  switch (st.tool) {
    case TOOL.MEASURE:
      text = st.aiming ? 'Hold + drag to aim; release to place'
        : (st.scaleMode === SCALE_MODES.POINT_A ? p + ' first point (or hold to aim)' : p + ' second point (or hold to aim)');
      break;
    case TOOL.SCALE:
      text = st.scaleMode === SCALE_MODES.POINT_A ? p + ' first point' : p + ' second point';
      break;
    case TOOL.LINE:
      text = st.quickLineStart ? p + ' end point' : p + ' start point';
      live = statusHintReadoutOf(readouts, 'draw'); placeholder = HINT_READOUT_PLACEHOLDER;
      break;
    case TOOL.POLYLINE:
      text = p + ' to add points';
      live = statusHintReadoutOf(readouts, 'draw'); placeholder = HINT_READOUT_PLACEHOLDER;
      break;
    case TOOL.DUCT:
      // Duct trace (features/duct-tool.js): the live length + pounds readout.
      text = p + ' to trace duct · S = size';
      live = statusHintReadoutOf(readouts, 'duct'); placeholder = DUCT_READOUT_PLACEHOLDER;
      break;
    case TOOL.HIGHLIGHT: text = corner(st.highlightStart); break;
    case TOOL.MULTIPLY_ZONE: text = corner(st.multiplyZoneStart); break;
    case TOOL.SCALE_ZONE: text = corner(st.scaleZoneStart); break;
    case TOOL.ROOM: text = corner(st.roomBoxStart); break;
    case TOOL.DELETE_ZONE: text = corner(st.deleteZoneStart); break;
    case TOOL.NOTE: text = p + ' to add note'; break;
    case TOOL.COUNTER:
      // S6: the tag the text layer reads beside the cursor ("Plan says B → Type B").
      text = p + ' to place marker';
      live = statusHintReadoutOf(readouts, 'tag'); placeholder = TAG_READOUT_PLACEHOLDER;
      break;
    case TOOL.SCHEDULE:
      text = st.scheduleBoxStart ? p + ' the schedule\'s far corner' : p + ' one corner of the fixture schedule';
      break;
    case TOOL.CHAIN:
      // S2: the default vertical the next tap writes ("+9.5 ft drop at Duplex receptacle").
      text = st.chainStart && st.chainStart.page === st.currentPage ? p + ' next device (Enter ends)' : p + ' first device';
      live = statusHintReadoutOf(readouts, 'chain'); placeholder = CHAIN_READOUT_PLACEHOLDER;
      break;
    case TOOL.EDIT_POLY:
      text = 'Edit polyline · drag a vertex · right-click a vertex';
      break;
    default:
      text = '';   // NONE (Move), GHOST, DROP: no hint
  }
  if (!text) return { text: '', keyed: '' };
  if (live) return { text: text + ': ' + live, keyed: text + ': ' + placeholder };
  return { text, keyed: text };
}

// The mode line's parts are joined with ' | ', and an empty part is left out, so a
// signed-in bar (whose own mode text is usually empty: the sync state rides the dot,
// square and labels beside it) shows "Click start point", never " | Click start point".
function joinStatusMode(base, hint) {
  if (!hint) return base || '';
  return base ? base + ' | ' + hint : hint;
}

const STATUS_HINT_MODEL_API = {
  HINT_READOUT_PLACEHOLDER, DUCT_READOUT_PLACEHOLDER, CHAIN_READOUT_PLACEHOLDER, TAG_READOUT_PLACEHOLDER,
  toolHintFor, joinStatusMode,
};
if (typeof window !== 'undefined') window.StatusHintModel = STATUS_HINT_MODEL_API;
// Node test harness only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = STATUS_HINT_MODEL_API;
