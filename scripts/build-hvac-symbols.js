#!/usr/bin/env node
/**
 * Generates the bundled HVAC symbol set — my-counters/hvac/*.svg — from
 * geometry, in the M-sheet drafting convention (DUCT-PLAN unit D16; glyphs
 * approved on the "Cleanup Follow-ups" canvas, row 1). Rerun after editing a
 * symbol here, then `npm run build:icons` (which folds the folder into
 * icons-custom.js as the `hvac` set — the "HVAC" heading on every custom icon
 * grid) and `npm run build:sw`.
 *
 * Same house rules as scripts/build-electrical-symbols.js: viewBox 0 0 1200
 * 1200, the 70-unit band weight, and every shape emitted as ONE filled path
 * (no strokes) — the icon pipeline joins all path data into a single
 * `<path fill>` and the canvas fills it with the counter color under the
 * nonzero rule, so outlines are rings (outer loop + reversed inner loop) and
 * strokes are thin polygons. Every solid subpath is normalized to the same
 * winding (`cw`) so overlapping bars/disks union instead of cancelling; only
 * the ring holes run the other way. One consequence: the fire/smoke damper
 * cannot carry a red tint — a bundled icon is a single fill that takes the
 * counter's color (the estimator picks red on the Create tab).
 *
 * Usage: node scripts/build-hvac-symbols.js [--out dir]
 */
const fs = require('fs');
const path = require('path');

let outDir = path.join(__dirname, '..', 'my-counters', 'hvac');
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) if (args[i] === '--out' && args[i + 1]) { outDir = args[++i]; }

const VB = 1200;                 // viewBox 0 0 1200 1200, like the other sets
const C = VB / 2;                // center
const T = 70;                    // the standard band weight
const f = (n) => Math.round(n * 10) / 10;

// --- polygon primitives (all return path data for ONE closed subpath) ---
// Signed area in screen space; positive = the winding every solid uses.
const area = (pts) => pts.reduce((s, [x, y], i) => { const [nx, ny] = pts[(i + 1) % pts.length]; return s + x * ny - nx * y; }, 0);
const cw = (pts) => (area(pts) < 0 ? pts.slice().reverse() : pts);
const poly = (pts) => 'M' + pts.map(([x, y]) => f(x) + ' ' + f(y)).join(' L') + ' Z';
const solid = (pts) => poly(cw(pts));
const hole = (pts) => poly(cw(pts).slice().reverse());
function circlePts(cx, cy, r, n = 72) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
const disk = (cx, cy, r) => solid(circlePts(cx, cy, r));
const ring = (cx, cy, ro, ri) => disk(cx, cy, ro) + ' ' + hole(circlePts(cx, cy, ri));
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const rect = (x, y, w, h) => solid(rectPts(x, y, w, h));
const rectRing = (x, y, w, h, t) => rect(x, y, w, h) + ' ' + hole(rectPts(x + t, y + t, w - 2 * t, h - 2 * t));
// Rounded rectangle outline: corner arcs sampled into the polygon.
function roundRectPts(x, y, w, h, r, n = 12) {
  const pts = [];
  const corners = [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= n; i++) { const a = ((a0 + 90 * (i / n)) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  }
  return pts;
}
const roundRectRing = (x, y, w, h, r, t) => solid(roundRectPts(x, y, w, h, r)) + ' ' + hole(roundRectPts(x + t, y + t, w - 2 * t, h - 2 * t, Math.max(1, r - t)));
// A thick stroke from (x1,y1) to (x2,y2) with square caps.
function bar(x1, y1, x2, y2, w = T) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
  return solid([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]);
}

// --- the symbols (file name → title / search terms / path data) ---
const S = {};
const BOX = { x: 160, y: 160, w: VB - 320, h: VB - 320 };   // the shared square
const box = () => rectRing(BOX.x, BOX.y, BOX.w, BOX.h, T);

// Supply diffuser: the square with the X and the inner square (the four
// faces of a ceiling diffuser). The X runs corner to inner corner.
{
  const inner = { x: 400, y: 400, w: VB - 800, h: VB - 800 };
  const cross = [
    bar(BOX.x + T / 2, BOX.y + T / 2, inner.x + T / 2, inner.y + T / 2),
    bar(BOX.x + BOX.w - T / 2, BOX.y + T / 2, inner.x + inner.w - T / 2, inner.y + T / 2),
    bar(BOX.x + BOX.w - T / 2, BOX.y + BOX.h - T / 2, inner.x + inner.w - T / 2, inner.y + inner.h - T / 2),
    bar(BOX.x + T / 2, BOX.y + BOX.h - T / 2, inner.x + T / 2, inner.y + inner.h - T / 2),
  ];
  S['supply-diffuser'] = { title: 'Supply Diffuser', terms: ['diffuser', 'supply', 'ceiling diffuser', 'sd', 'air', 'cfm', 'hvac'], d: [box(), rectRing(inner.x, inner.y, inner.w, inner.h, T)].concat(cross).join(' ') };
}
// Return grille: the square with three horizontal louvers.
{
  const louvers = [-220, 0, 220].map((dy) => bar(BOX.x + T + 60, C + dy, BOX.x + BOX.w - T - 60, C + dy, T * 0.9));
  S['return-grille'] = { title: 'Return Grille', terms: ['grille', 'return', 'exhaust', 'louver', 'rg', 'eg', 'air', 'hvac'], d: [box()].concat(louvers).join(' ') };
}
// RTU: the rounded cabinet with the fan circle on the left and the coil
// lines on the right.
{
  const cab = { x: 80, y: 240, w: VB - 160, h: VB - 480, r: 120 };
  const fanX = 390, fanR = 210;
  const coil = [660, 800, 940].map((x) => bar(x, cab.y + T + 90, x, cab.y + cab.h - T - 90, T * 0.9));
  S['rtu'] = { title: 'RTU', terms: ['rtu', 'rooftop unit', 'rooftop', 'unit', 'ahu', 'air handler', 'equipment', 'hvac'], d: [roundRectRing(cab.x, cab.y, cab.w, cab.h, cab.r, T), ring(fanX, C, fanR, fanR - T), disk(fanX, C, 60)].concat(coil).join(' ') };
}
// VAV box: the rectangle with the center divider and the damper pivot dot.
{
  const b = { x: 100, y: 330, w: VB - 200, h: VB - 660 };
  S['vav-box'] = { title: 'VAV Box', terms: ['vav', 'vav box', 'terminal unit', 'variable air volume', 'box', 'hvac'], d: [rectRing(b.x, b.y, b.w, b.h, T), bar(C, b.y + T / 2, C, b.y + b.h - T / 2), disk(C, C, 120)].join(' ') };
}
// Fire/smoke damper: the square with the diagonal blade and the center pivot.
{
  const inset = 230;
  S['fire-smoke-damper'] = { title: 'Fire/Smoke Damper', terms: ['damper', 'fire damper', 'smoke damper', 'fsd', 'fd', 'sd', 'combination damper', 'hvac'], d: [box(), bar(BOX.x + inset, BOX.y + BOX.h - inset, BOX.x + BOX.w - inset, BOX.y + inset, T * 1.1), disk(C, C, 110)].join(' ') };
}

fs.mkdirSync(outDir, { recursive: true });
// Wipe stale symbols so a rename never leaves an orphan behind.
for (const fname of fs.readdirSync(outDir)) if (fname.endsWith('.svg')) fs.unlinkSync(path.join(outDir, fname));
let n = 0;
for (const [file, sym] of Object.entries(S)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}">\n  <title>${sym.title}</title>\n  <desc>terms: ${sym.terms.join(', ')}</desc>\n  <path d="${sym.d}"/>\n</svg>\n`;
  fs.writeFileSync(path.join(outDir, file + '.svg'), svg, 'utf8');
  n++;
}
console.log('Wrote', n, 'HVAC symbols to', outDir);
