#!/usr/bin/env node
/**
 * Generates the bundled ELECTRICAL symbol set — my-counters/electrical/*.svg —
 * from geometry, in the drafting convention estimators read on E-sheets
 * (Electrical, First-Class, move 1). Rerun after editing a symbol here, then
 * `npm run build:icons` (which folds the folder into icons-custom.js as the
 * `electrical` set) and `npm run build:sw`.
 *
 * Every shape is emitted as ONE filled path (no strokes): the icon pipeline
 * joins all path data into a single `<path fill>` and the canvas fills it with
 * the counter color, so outlines are drawn as rings (outer loop + reversed
 * inner loop under the nonzero rule) and strokes as thin polygons.
 *
 * Usage: node scripts/build-electrical-symbols.js [--out dir]
 */
const fs = require('fs');
const path = require('path');

let outDir = path.join(__dirname, '..', 'my-counters', 'electrical');
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) if (args[i] === '--out' && args[i + 1]) { outDir = args[++i]; }

const VB = 1200;                 // viewBox 0 0 1200 1200, like the plumbing set
const C = VB / 2;                // center
const R = 380;                   // the standard device ring radius
const T = 70;                    // the standard stroke weight
const f = (n) => Math.round(n * 10) / 10;

// --- polygon primitives (all return path data for ONE closed subpath) ---
const poly = (pts) => 'M' + pts.map(([x, y]) => f(x) + ' ' + f(y)).join(' L') + ' Z';
// Circle as a 72-gon; `ccw` reverses the winding (an inner loop → a hole).
function circlePts(cx, cy, r, ccw, n = 72) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return ccw ? pts.reverse() : pts;
}
const disk = (cx, cy, r) => poly(circlePts(cx, cy, r, false));
const ring = (cx, cy, ro, ri) => disk(cx, cy, ro) + ' ' + poly(circlePts(cx, cy, ri, true));
// Annular sector from angle a0 to a1 (degrees, screen sense: 0 = 3 o'clock,
// 90 = 6 o'clock, clockwise positive) — the letter-drawing workhorse.
function arcBand(cx, cy, ro, ri, a0, a1, n = 36) {
  const outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + (a1 - a0) * (i / n)) * Math.PI) / 180;
    outer.push([cx + ro * Math.cos(a), cy + ro * Math.sin(a)]);
    inner.push([cx + ri * Math.cos(a), cy + ri * Math.sin(a)]);
  }
  return poly(outer.concat(inner.reverse()));
}
const rect = (x, y, w, h) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
const rectRing = (x, y, w, h, t) => rect(x, y, w, h) + ' ' + poly([[x + t, y + t], [x + t, y + h - t], [x + w - t, y + h - t], [x + w - t, y + t]]);
// A thick stroke from (x1,y1) to (x2,y2) with square caps.
function bar(x1, y1, x2, y2, w = T) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
  return poly([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]);
}
const tri = (pts) => poly(pts);
function triRing(pts, t) {
  // inset each vertex toward the centroid by t / sin(half-angle)-ish; equilateral-friendly
  const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
  const inner = pts.map(([x, y]) => { const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy); const k = (t * 2) / d; return [x + dx * k, y + dy * k]; });
  return poly(pts) + ' ' + poly(inner.slice().reverse());
}

// --- letters (chunky, single-weight, sized by `s` = cap height) ---
function letterS(cx, cy, s) {
  // Two bowls: the top one runs from just below 3 o'clock back over the top to
  // 6 o'clock (counter-clockwise on screen), the bottom one from 12 o'clock
  // clockwise round to 8 o'clock — angles in screen sense (see arcBand).
  const r = s / 4, ri = r - T * 0.9;
  return arcBand(cx, cy - r + T * 0.05, r, ri, -30, -270) + ' ' + arcBand(cx, cy + r - T * 0.05, r, ri, -90, 150);
}
function letter3(cx, cy, s) {
  const r = s / 4, ri = r - T * 0.9;
  return arcBand(cx - r * 0.3, cy - r, r, ri, -140, 100) + ' ' + arcBand(cx - r * 0.3, cy + r, r, ri, -100, 140);
}
function letter4(cx, cy, s) {
  const h = s / 2;
  return bar(cx + h * 0.35, cy - h, cx + h * 0.35, cy + h) + ' ' + bar(cx + h * 0.35, cy - h, cx - h * 0.7, cy + h * 0.3) + ' ' + bar(cx - h * 0.8, cy + h * 0.3, cx + h * 0.8, cy + h * 0.3);
}
function letterD(cx, cy, s) {
  // Stem on the left, a half ring bowl on the right spanning the full height.
  const h = s / 2, x = cx - h * 0.55;
  return bar(x, cy - h, x, cy + h) + ' ' + arcBand(x, cy, h, h - T * 0.9, -90, 90);
}
function letterM(cx, cy, s) {
  const h = s / 2, w = s * 0.42;
  return bar(cx - w, cy + h, cx - w, cy - h) + ' ' + bar(cx - w, cy - h, cx, cy + h * 0.2) + ' ' + bar(cx, cy + h * 0.2, cx + w, cy - h) + ' ' + bar(cx + w, cy - h, cx + w, cy + h);
}
function letterT(cx, cy, s) { const h = s / 2; return bar(cx - h * 0.8, cy - h, cx + h * 0.8, cy - h) + ' ' + bar(cx, cy - h, cx, cy + h); }
function letterH(cx, cy, s) { const h = s / 2, w = s * 0.35; return bar(cx - w, cy - h, cx - w, cy + h) + ' ' + bar(cx + w, cy - h, cx + w, cy + h) + ' ' + bar(cx - w, cy, cx + w, cy); }
function letterF(cx, cy, s) { const h = s / 2, w = s * 0.35; return bar(cx - w, cy - h, cx - w, cy + h) + ' ' + bar(cx - w, cy - h, cx + w, cy - h) + ' ' + bar(cx - w, cy - h * 0.05, cx + w * 0.7, cy - h * 0.05); }
function letterJ(cx, cy, s) { const h = s / 2, r = h * 0.55; return bar(cx + r, cy - h, cx + r, cy + h - r) + ' ' + arcBand(cx, cy + h - r, r, r - T * 0.9, 0, 180) + ' ' + bar(cx - r * 0.2, cy - h, cx + r + T * 0.5, cy - h); }
function letterC(cx, cy, s) { const r = s / 2; return arcBand(cx, cy, r, r - T * 0.9, 45, 315); }
function letterG(cx, cy, s) { const r = s / 2; return arcBand(cx, cy, r, r - T * 0.9, 20, 340) + ' ' + bar(cx, cy, cx + r, cy) + ' ' + bar(cx + r - T / 2, cy - T * 0.2, cx + r - T / 2, cy + r * 0.45); }

// --- the symbols ---
const S = {};
// Receptacles: the ring with the wall line through it
S['duplex-receptacle'] = { title: 'Duplex Receptacle', terms: ['receptacle', 'outlet', 'duplex', 'plug'], d: ring(C, C, R, R - T) + ' ' + bar(60, C, VB - 60, C) };
S['quad-receptacle'] = { title: 'Quad Receptacle', terms: ['receptacle', 'outlet', 'quad', 'fourplex'], d: ring(C, C, R, R - T) + ' ' + bar(60, C, VB - 60, C) + ' ' + bar(C, C - R, C, C + R) };
S['gfci-receptacle'] = { title: 'GFCI Receptacle', terms: ['receptacle', 'gfci', 'gfi', 'ground fault'], d: ring(C, C, R, R - T) + ' ' + bar(60, C, VB - 60, C) + ' ' + letterG(C - 120, C - 170, 170) + ' ' + letterF(C + 100, C - 170, 170) };
S['dedicated-receptacle'] = { title: 'Dedicated Receptacle', terms: ['receptacle', 'dedicated', 'single'], d: ring(C, C, R, R - T) + ' ' + bar(60, C, VB - 60, C) + ' ' + disk(C, C + 170, 70) };
S['floor-receptacle'] = { title: 'Floor Receptacle', terms: ['receptacle', 'floor', 'box'], d: rectRing(120, 120, VB - 240, VB - 240, T) + ' ' + ring(C, C, R - 60, R - 60 - T) + ' ' + bar(C - R + 60, C, C + R - 60, C) };
S['special-receptacle'] = { title: 'Special Purpose Receptacle', terms: ['receptacle', 'special', 'range', 'dryer', 'welder'], d: ring(C, C, R, R - T) + ' ' + bar(60, C, VB - 60, C) + ' ' + tri([[C, C - 230], [C + 190, C + 110], [C - 190, C + 110]]) };
// Switches: the S family
S['single-pole-switch'] = { title: 'Single Pole Switch', terms: ['switch', 'single pole', 'light switch'], d: letterS(C, C, 760) };
S['three-way-switch'] = { title: 'Three-Way Switch', terms: ['switch', '3-way', 'three way'], d: letterS(C - 140, C, 700) + ' ' + letter3(C + 340, C + 210, 360) };
S['four-way-switch'] = { title: 'Four-Way Switch', terms: ['switch', '4-way', 'four way'], d: letterS(C - 140, C, 700) + ' ' + letter4(C + 340, C + 210, 380) };
S['dimmer-switch'] = { title: 'Dimmer Switch', terms: ['switch', 'dimmer'], d: letterS(C - 140, C, 700) + ' ' + letterD(C + 350, C + 210, 360) };
S['occupancy-sensor-switch'] = { title: 'Occupancy Sensor Switch', terms: ['switch', 'occupancy', 'sensor', 'vacancy'], d: letterS(C - 140, C, 700) + ' ' + ring(C + 340, C + 220, 150, 150 - T * 0.8) + ' ' + disk(C + 340, C + 220, 45) };
// Lighting
S['2x4-troffer'] = { title: '2x4 Troffer', terms: ['light', 'fixture', 'troffer', '2x4', 'lay-in'], d: rectRing(60, 300, VB - 120, 600, T) + ' ' + bar(60 + T, C, VB - 60 - T, C, T * 0.6) };
S['2x2-troffer'] = { title: '2x2 Troffer', terms: ['light', 'fixture', 'troffer', '2x2', 'lay-in'], d: rectRing(160, 160, VB - 320, VB - 320, T) + ' ' + bar(160 + T, C, VB - 160 - T, C, T * 0.6) };
S['downlight'] = { title: 'Downlight', terms: ['light', 'fixture', 'downlight', 'can', 'recessed'], d: ring(C, C, R, R - T) + ' ' + disk(C, C, 130) };
S['wall-pack'] = { title: 'Wall Pack', terms: ['light', 'fixture', 'wall pack', 'exterior'], d: bar(120, 340, VB - 120, 340, T * 1.2) + ' ' + arcBand(C, 340, 400, 400 - T, 0, 180) + ' ' + disk(C, 340 + 180, 110) };
S['exit-sign'] = { title: 'Exit Sign', terms: ['exit', 'sign', 'egress', 'light'], d: rectRing(120, 380, VB - 240, 440, T) + ' ' + disk(C, C, 120) };
S['emergency-light'] = { title: 'Emergency Light', terms: ['emergency', 'light', 'battery', 'bug eye'], d: rect(300, 520, 600, 260) + ' ' + disk(380, 420, 110) + ' ' + disk(820, 420, 110) + ' ' + bar(380, 470, 470, 560, T * 0.8) + ' ' + bar(820, 470, 730, 560, T * 0.8) };
S['pendant-light'] = { title: 'Pendant Light', terms: ['light', 'fixture', 'pendant', 'hanging'], d: ring(C, C + 160, 300, 300 - T) + ' ' + bar(C, 80, C, C - 140) + ' ' + bar(C - 160, 80, C + 160, 80) };
S['strip-light'] = { title: 'Strip Light', terms: ['light', 'fixture', 'strip', 'linear', 'wrap'], d: rectRing(60, 460, VB - 120, 280, T) + ' ' + disk(200, C, 50) + ' ' + disk(VB - 200, C, 50) };
S['high-bay'] = { title: 'High Bay', terms: ['light', 'fixture', 'high bay', 'warehouse'], d: ring(C, C, R, R - T) + ' ' + bar(C - 240, C - 240, C + 240, C + 240) + ' ' + bar(C - 240, C + 240, C + 240, C - 240) };
S['wall-sconce'] = { title: 'Wall Sconce', terms: ['light', 'fixture', 'sconce', 'wall'], d: bar(120, C + 260, VB - 120, C + 260, T * 1.2) + ' ' + arcBand(C, C + 260, 340, 340 - T, 180, 360) + ' ' + disk(C, C + 60, 90) };
// Power and gear
S['panelboard'] = { title: 'Panelboard', terms: ['panel', 'panelboard', 'load center', 'breaker'], d: rect(360, 60, 480, VB - 120) + ' ' + poly([[430, 130], [770, 130], [770, VB - 130], [430, VB - 130]].reverse()) + ' ' + rect(430, 130, 170, VB - 260) };
S['disconnect-switch'] = { title: 'Disconnect Switch', terms: ['disconnect', 'safety switch', 'switch'], d: rectRing(120, 120, VB - 240, VB - 240, T) + ' ' + bar(300, 860, 860, 320) + ' ' + disk(300, 860, 80) + ' ' + disk(900, 300, 80) };
S['motor'] = { title: 'Motor', terms: ['motor', 'equipment', 'connection'], d: ring(C, C, R, R - T) + ' ' + letterM(C, C, 340) };
S['transformer'] = { title: 'Transformer', terms: ['transformer', 'xfmr', 'gear'], d: ring(C - 150, C, 300, 300 - T) + ' ' + ring(C + 150, C, 300, 300 - T) };
S['junction-box'] = { title: 'Junction Box', terms: ['junction', 'j-box', 'box', 'jbox'], d: rectRing(160, 160, VB - 320, VB - 320, T) + ' ' + letterJ(C, C, 400) };
S['meter'] = { title: 'Meter', terms: ['meter', 'utility', 'service'], d: ring(C, C, R, R - T) + ' ' + ring(C, C, 200, 200 - T * 0.8) + ' ' + bar(C, C - 200, C, C - R + T) };
S['ground'] = { title: 'Ground', terms: ['ground', 'grounding', 'earth', 'rod'], d: bar(C, 160, C, 520) + ' ' + bar(C - 320, 520, C + 320, 520) + ' ' + bar(C - 210, 700, C + 210, 700) + ' ' + bar(C - 100, 880, C + 100, 880) };
// Low voltage
S['data-outlet'] = { title: 'Data Outlet', terms: ['data', 'outlet', 'jack', 'cat6', 'network'], d: triRing([[C, 140], [VB - 100, VB - 160], [100, VB - 160]], T) };
S['telephone-outlet'] = { title: 'Telephone Outlet', terms: ['telephone', 'phone', 'outlet', 'jack'], d: triRing([[C, 140], [VB - 100, VB - 160], [100, VB - 160]], T) + ' ' + bar(C - 200, 820, C + 200, 820) };
S['tv-outlet'] = { title: 'TV Outlet', terms: ['tv', 'television', 'cable', 'coax', 'outlet'], d: triRing([[C, 140], [VB - 100, VB - 160], [100, VB - 160]], T) + ' ' + letterT(C, 800, 240) };
S['wireless-access-point'] = { title: 'Wireless Access Point', terms: ['wap', 'wifi', 'wireless', 'access point'], d: disk(C, 880, 110) + ' ' + arcBand(C, 880, 380, 380 - T, 215, 325) + ' ' + arcBand(C, 880, 620, 620 - T, 222, 318) };
S['speaker'] = { title: 'Speaker', terms: ['speaker', 'audio', 'paging', 'sound'], d: rect(220, 440, 260, 320) + ' ' + poly([[480, 440], [860, 200], [860, 1000], [480, 760]]) };
S['camera'] = { title: 'Camera', terms: ['camera', 'cctv', 'security', 'surveillance'], d: rect(160, 400, 600, 400) + ' ' + poly([[760, 520], [1060, 380], [1060, 820], [760, 680]]) };
S['thermostat'] = { title: 'Thermostat', terms: ['thermostat', 'control', 'tstat'], d: ring(C, C, R, R - T) + ' ' + letterT(C, C, 380) };
S['card-reader'] = { title: 'Card Reader', terms: ['card reader', 'access control', 'badge'], d: rectRing(300, 160, 600, VB - 320, T) + ' ' + bar(400, 420, 800, 420, T * 0.8) + ' ' + disk(C, 820, 90) };
// Fire alarm
S['smoke-detector'] = { title: 'Smoke Detector', terms: ['smoke', 'detector', 'fire alarm', 'sd'], d: ring(C, C, R, R - T) + ' ' + letterS(C, C, 440) };
S['heat-detector'] = { title: 'Heat Detector', terms: ['heat', 'detector', 'fire alarm', 'hd'], d: ring(C, C, R, R - T) + ' ' + letterH(C, C, 400) };
S['pull-station'] = { title: 'Pull Station', terms: ['pull station', 'fire alarm', 'manual pull'], d: rectRing(160, 160, VB - 320, VB - 320, T) + ' ' + letterF(C, C, 420) };
S['horn-strobe'] = { title: 'Horn Strobe', terms: ['horn', 'strobe', 'fire alarm', 'notification'], d: bar(120, C + 300, VB - 120, C + 300, T * 1.2) + ' ' + ring(C, C - 40, 320, 320 - T) + ' ' + letterC(C, C - 40, 260) };
S['fire-alarm-panel'] = { title: 'Fire Alarm Control Panel', terms: ['facp', 'fire alarm', 'panel', 'control'], d: rectRing(160, 160, VB - 320, VB - 320, T) + ' ' + letterF(C - 130, C, 420) + ' ' + letterC(C + 170, C, 380) };

fs.mkdirSync(outDir, { recursive: true });
// Wipe stale symbols so a rename never leaves an orphan behind.
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.svg')) fs.unlinkSync(path.join(outDir, f));
let n = 0;
for (const [file, sym] of Object.entries(S)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}">\n  <title>${sym.title}</title>\n  <desc>terms: ${sym.terms.join(', ')}</desc>\n  <path d="${sym.d}"/>\n</svg>\n`;
  fs.writeFileSync(path.join(outDir, file + '.svg'), svg, 'utf8');
  n++;
}
console.log('Wrote', n, 'electrical symbols to', outDir);
