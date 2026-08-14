// hotkeys.js - the HOTKEYS table, split out of constants.js (2026-07-30:
// it is a BUILD INPUT carrying presentation payload, not a tuning literal).
// Single source of truth: app.js's keydown handler EXECUTES it and
// scripts/build-macros.js GENERATES the Macros table rows in app/index.html
// from it (the Keyboard Map derives from that table). Add/change a hotkey
// HERE, then run `npm run build:macros` AND `npm run build:sw`.

// The keydown handler in app.js EXECUTES this table (non-bespoke entries) and
// scripts/build-macros.js GENERATES the Macros shortcut-table rows in
// app/index.html from it (committed artifact; `npm run check` includes
// `build:macros -- --check`). The Keyboard Map then derives from that
// generated table — so handler, list, and board all chain off ONE source.
// This exists because the three drifted by hand: the V (Room Sizer) hotkey
// shipped live but its Macros row was missing for weeks.
//
// Fields: key (e.key, lowercase) + one of btnId (the element the handler
// clicks) or runner (name of an app.js closure action: moveReset / toggleSnap
// / rotatePage). viewerAllowed marks keys usable in view-link sessions.
// bespoke: true = documentation-only row; its handling (arrows, undo, Escape,
// modal-context keys) stays hand-written in app.js. Presentation fields:
// section, action, kbd (custom <kbd> cell HTML; null = derive from key), icon
// ({ btn: id } extracts that element's live SVG at generate time so the row
// always matches the app; { glyph } is a text glyph; null = no icon).
const HOTKEYS = [
  { bespoke: true, section: 'Navigation', action: 'Previous page', kbd: '<kbd title="Left arrow">←</kbd>', icon: { glyph: '◀' } },
  { bespoke: true, section: 'Navigation', action: 'Next page', kbd: '<kbd title="Right arrow">→</kbd>', icon: { glyph: '▶' } },
  { bespoke: true, section: 'Navigation', action: 'Switch canvas (when multiple canvases)', kbd: '<kbd title="Up arrow">↑</kbd> <kbd title="Down arrow">↓</kbd>', icon: { glyph: '↕' } },
  { bespoke: true, section: 'Navigation', action: 'Previous marked page', kbd: '<kbd>Shift</kbd>+<kbd>←</kbd>', icon: { glyph: '◀' } },
  { bespoke: true, section: 'Navigation', action: 'Next marked page', kbd: '<kbd>Shift</kbd>+<kbd>→</kbd>', icon: { glyph: '▶' } },
  { key: 'm', runner: 'moveReset', viewerAllowed: true, section: 'Tools', action: 'Move mode', kbd: null, icon: { btn: 'moveBtn' } },
  { key: 's', btnId: 'setScale', viewerAllowed: true, section: 'Tools', action: 'Set Scale', kbd: null, icon: { btn: 'setScale' } },
  { key: 'c', btnId: 'counterBtn', section: 'Tools', action: 'Counter mode', kbd: null, icon: { btn: 'counterBtn' } },
  { bespoke: true, section: 'Tools', action: 'Quick tab (when Counter or Line Type modal open)', kbd: '<kbd>Shift</kbd>+<kbd>Q</kbd>', icon: null },
  { key: 'l', btnId: 'quickLine', section: 'Tools', action: 'Quick Line mode', kbd: null, icon: { btn: 'quickLine' } },
  { key: 'j', runner: 'toggleSnap', viewerAllowed: true, section: 'Tools', action: 'Toggle snap to 45° angles', kbd: null, icon: { btn: 'lineTypeSnapToHVHeaderBtn' } },
  { key: 'p', btnId: 'polylineBtn', section: 'Tools', action: 'Polyline mode', kbd: null, icon: { btn: 'polylineBtn' } },
  { key: 't', btnId: 'chainBtn', section: 'Tools', action: 'Chain mode (counter + connecting line)', kbd: null, icon: { btn: 'chainBtn' } },
  { key: 'd', btnId: 'measureBtn', viewerAllowed: true, section: 'Tools', action: 'Measure Distance', kbd: null, icon: { btn: 'measureBtn' } },
  { key: 'r', runner: 'rotatePage', viewerAllowed: true, section: 'Tools', action: 'Rotate page', kbd: null, icon: { glyph: '↻' } },
  { key: 'h', btnId: 'highlightBtn', section: 'Tools', action: 'Highlight mode', kbd: null, icon: { btn: 'highlightBtn' } },
  { key: 'x', btnId: 'multiplyZoneBtn', section: 'Tools', action: 'Multiply Zone mode', kbd: null, icon: { btn: 'multiplyZoneBtn' } },
  { bespoke: true, section: 'Tools', action: 'Scale Zone (rotated Scale icon in header/sidebar)', kbd: '—', icon: { btn: 'scaleZoneBtn' } },
  { key: 'v', btnId: 'roomBtn', section: 'Tools', action: 'Room Sizer mode', kbd: null, icon: { btn: 'roomBtn' } },
  { key: 'n', btnId: 'noteBtn', section: 'Tools', action: 'Note mode', kbd: null, icon: { btn: 'noteBtn' } },
  { bespoke: true, section: 'Tools', action: 'Undo', kbd: '<kbd>Ctrl</kbd>+<kbd>Z</kbd>', icon: { btn: 'undoBtn' } },
  { bespoke: true, section: 'Tools', action: 'Redo', kbd: '<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>', icon: { btn: 'redoBtn' } },
  { bespoke: true, section: 'Tools', action: 'Refresh', kbd: '<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>R</kbd>', icon: null },
  { bespoke: true, section: 'Tools', action: 'Toggle sidebar (desktop)', kbd: '<kbd>Space</kbd>', icon: null },
  { bespoke: true, section: 'Tools', action: 'Close modal / Cancel', kbd: '<kbd>Esc</kbd>', icon: null },
  { bespoke: true, section: 'Tools', action: 'Finish polyline / End chain run / Exit edit mode', kbd: '<kbd>Enter</kbd>', icon: null },
];


// Node test harness only: in a classic browser <script> `module` is undefined,
// so this is a no-op there and the declarations above stay plain globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HOTKEYS };
}
