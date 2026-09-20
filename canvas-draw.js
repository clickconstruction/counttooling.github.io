// canvas-draw.js — the annotation draw core shared by the live overlay
// (app.js renderAnnotations) and the export path (renderAnnotationsToContext,
// consumed by the export/output/pdf-bundle/summary-detail features).
//
// Classic <script src> loaded after geometry.js + icons.js (whose pure helpers
// and path-data globals it reads by bare name at call time) and before app.js.
// Everything state/closure-coupled arrives via the `deps` ctx passed to
// createCanvasDraw(deps) — the same seam recipe as save-engine.js /
// annotation-model.js: app.js instantiates the factory once with live-value
// accessor arrows and keeps same-named thin wrappers so call sites, the App
// registry, and the feature-file contracts stay frozen.
//
// deps contract (all resolved live at call time):
//   getState()                  -> the app `state` object
//   getEffectiveScaleForLine(ann, line, isPoly, pageIdx) -> scale | null
//   getLineRealWorldLength(line, pageIdx, isPoly, ann)   -> number | null
//   formatDistFeetInchesFromReal(realLen, scale)         -> label string
//   getGroupColor(groupId)      -> css color
//   wrapNoteText(text, maxWidth, font, lineHeight)       -> { lines }
//   getNoteRotationRad(note, page)                       -> radians
//   iconRenderVb(iconPath) / iconRenderCenter(iconPath)  -> vb num / {x,y}
//   formatDropLabel(value, unit)                         -> "3 ft" | "" (the
//                     recent-drops.js formatter; drives the drop-size labels)
//
// drawAnnotationsCore(ctx, ann, env) walks the persisted mark kinds in the
// frozen paint order (quickLines -> polylines -> highlights -> multiplyZones
// -> scaleZones -> roomBoxes -> notes -> counterMarkers). The two callers
// differ ONLY through `env` — the divergence register:
//   tc(p)             pdf->canvas transform (live: zoom*effDpr; export: *scale)
//   page, pageIdx     the page object + clamped index for scale lookups
//   lineWidth         resolved stroke width (live: raw lineSize — constant
//                     screen weight; export: lineSize*scale*lineScale)
//   lineOpacity       lts.opacity
//   dropSize, dropStyle  drop-marker size (live raw / export *scale) + glyph
//   fontScale         multiplier for label/note/zone font px + note wrap
//   labelPad          length-label background padding (live 4 / export 4*scale)
//   dotRadius         group-dot radius (live 4 / export 4*scale)
//   counterSize       resolved marker size (live cs.size ?? 22; export
//                     (cs.size||22)*scale*markerScale — historical ??/|| split)
//   counterOutline    resolved outline width (raw / *scale*markerScale)
//   counterNumberSize resolved index-number font px (raw / *scale*markerScale)
//   fontFamily        'DM Sans' (live) / 'sans-serif' (export); the counter
//                     index numbers are 'DM Sans' in BOTH (historical quirk,
//                     preserved)
//   selection         { id, isPoly } | null — live-only glow (2x width +
//                     shadowBlur) on the selected quick line / polyline
//   selectedDuctRunId live-only (D4 sidebar): duct-run id | null — glow
//                     (1.5x stroke + shadowBlur) on the selected duct run
//   drawNoteHandles   live-only note resize/rotate handle squares
//   notePin           live-only (features/notes-ledger.js): (note) -> pin
//                     info { num, color, resolved, r } | null. Non-null draws
//                     the note as a numbered ledger pin instead of its text
//                     block. The export env never sets it — PDFs/prints keep
//                     full note text.
//   showDropSizes     live-only (the "Drop sizes" toggle): paint a small
//                     white value chip ("3 ft") beside every drop glyph,
//                     offset along the run's outward direction. The export
//                     env never sets it — PDFs/prints are unchanged.
//   (no env flag)     D13 true-width duct ghost: painted in BOTH paths from
//                     state.legendSettings.showDuctGhost (default ON), sized
//                     from the run's effective scale × the px-per-pdf-pt the
//                     env's tc yields — so it is sheet-true at any zoom, on
//                     every export raster, and under rotation for free
//                     (vertices already live in the rotated pdf frame).
// Zone chrome (stroke 2, dash [6,4], label pad 4, inset 6, the 30x20 min-size
// threshold) is deliberately raw in BOTH paths (does not scale on export) —
// a preserved historical quirk, not an omission.
//
// The top-level functions below (drawDropMarker, hexToRgb, lineStyleToDash,
// ductGhostWidthPx) are pure — no state/deps — and are read by app.js and the
// duct feature files by bare name like the geometry primitives. Guarded CommonJS footer so canvas-draw.test.js can
// `require()` the module under `node --test`.

// Drop marker glyph at the start/end of a line with a drop length — style is
// lineTypeSettings.dropIconStyle ('circle' | 'plus' | 'diamond' | 'triangle' |
// default X), s the half-size in canvas px. Black outer stroke, colored inner.
// BEND-FITTINGS: a small chip at each vertex that counts a fitting ("45" / "90"),
// in the run's colour; a vertex overridden to no fitting draws a grey dashed
// "no" chip so the choice stays visible; a forced class draws like a read one.
// Pure read of fitting-model.js (window.FittingModel); nothing when the type has
// the option off. Shared by the annotation draw core and app.js's edit-mode paint.
function drawBendFittingChips(ctx, pts, closed, color, lt, tc, fontScale, fontFamily) {
  const fm = (typeof window !== 'undefined') ? window.FittingModel : null;
  if (!fm || !lt || !fm.bendFittingsEnabled(lt) || !pts || pts.length < 3) return;
  const fs = fontScale || 1;
  const w = 22 * fs, h = 12 * fs, off = 7 * fs;
  ctx.save();
  ctx.font = '600 ' + (8.5 * fs) + 'px ' + (fontFamily || 'DM Sans') + ', sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const k = fm.vertexBendClass(pts, i, !!closed);
    const isNone = p && p.fitting === 'none' && (closed || (i > 0 && i < pts.length - 1));
    if (!k && !isNone) continue;
    const c = tc(p);
    const x = c.x + off, y = c.y - off - h;
    ctx.setLineDash(isNone ? [3 * fs, 2 * fs] : []);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = isNone ? '#9e9b96' : (color || '#4a9eff'); ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = isNone ? '#9e9b96' : '#17171a';
    ctx.fillText(isNone ? 'no' : (k === 'bend90' ? '90' : '45'), x + w / 2, y + h / 2 + 0.5);
  }
  ctx.restore();
}

function drawDropMarker(ctx, p, s, color, style) {
  const lwOut = Math.max(2, Math.round(s * 0.4));
  const lwIn = Math.max(1, Math.round(s * 0.2));
  ctx.save();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = lwOut;
  ctx.fillStyle = color || '#4a9eff';
  ctx.beginPath();
  switch (style || 'circle') {
    case 'circle':
      ctx.arc(p.x, p.y, s * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = color || '#4a9eff';
      ctx.lineWidth = lwIn;
      ctx.stroke();
      break;
    case 'plus':
      ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
      ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
      ctx.stroke();
      ctx.strokeStyle = color || '#4a9eff';
      ctx.lineWidth = lwIn;
      ctx.stroke();
      break;
    case 'diamond':
      ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y);
      ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s, p.y); ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = color || '#4a9eff';
      ctx.lineWidth = lwIn;
      ctx.stroke();
      break;
    case 'triangle':
      ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y + s);
      ctx.lineTo(p.x - s, p.y + s); ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = color || '#4a9eff';
      ctx.lineWidth = lwIn;
      ctx.stroke();
      break;
    default:
      ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y + s);
      ctx.moveTo(p.x - s, p.y + s); ctx.lineTo(p.x + s, p.y - s);
      ctx.stroke();
      ctx.strokeStyle = color || '#4a9eff';
      ctx.lineWidth = lwIn;
      ctx.stroke();
  }
  ctx.restore();
}

function hexToRgb(hex) {
  const m = (hex || '#ffffff').match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
}

function lineStyleToDash(style) {
  if (style === 'dashed') return [4, 4];
  if (style === 'dotted') return [2, 2];
  return [];
}

// Duct run colors by airside (DUCT-PLAN §1 trade colors, the D4 pass):
// supply keeps D2's blue; return is the --red family (#e85447) and exhaust
// the --green family (#47c88e) — the styles.css tokens, restated as literals
// because canvas ink can't read CSS vars. THE one place the airside→color
// mapping lives: the persisted-run painter below, the live trace preview in
// features/duct-tool.js, and the D4 sidebar swatches (features/duct-sidebar.js)
// all read this map by bare name.
const DUCT_AIRSIDE_COLORS = { supply: '#2e86de', return: '#e85447', exhaust: '#47c88e' };

// Duct fitting marker colors by type (DUCT-PLAN unit D3, the mockup
// vocabulary): elbows amber (styles.css --yellow #e8b84a), transitions green
// (--green #47c88e), taps purple (--purple #a47fff). The reclassify-only
// types borrow their family's color: boot rides the tap/branch purple,
// offset the elbow amber. Literal hexes because canvas contexts can't read
// CSS custom properties; keep in sync with the styles.css tokens.
const DUCT_FITTING_COLORS = {
  elbow90: '#e8b84a', elbow45: '#e8b84a', offset: '#e8b84a',
  transition: '#47c88e',
  tap: '#a47fff', boot: '#a47fff',
};
// D18: rise/drop (verticalFt) markers — the fitting family's fourth color, a
// steel blue no fitting type uses (the marker is a filled up-triangle with a
// "12'" tag; the model carries no sign — a rise and a drop weigh the same).
const DUCT_VERTICAL_COLOR = '#4a7fb5';

// The legend's duct-row swatch (DUCT unit D5): a neutral sheet-metal gray —
// legend duct rows are PER SIZE, and one size can span supply/return/exhaust,
// so no single airside color would be honest.
const DUCT_LEGEND_SWATCH = '#8a919c';

// The true-width ghost (DUCT unit D13, DUCT-PLAN "design-build": the ghost
// over the floor plan makes the markup itself the submittable layout). A
// translucent band in the run's airside color, NO outline, under each run's
// symbolic stroke — its width is the segment's REAL plan-view width
// (duct-model ductPlanWidthIn: rect w flat / the smaller side on edge / round
// d, inches) converted through the sheet scale. Alpha is quiet on purpose:
// the ghost shows footprint, the stroke stays the mark.
const DUCT_GHOST_ALPHA = 0.14;
// Below this on-canvas width (deep zoom-out) the band would be sub-stroke
// noise; skip it so tiny cases paint byte-identically to a ghost-free run.
const DUCT_GHOST_MIN_PX = 1.5;

// The flex leader (D19, J19 Friction #3): a thin dashed tie from an ATTACHED
// CFM device to the point on the run that taps it. Attachment was invisible —
// a branch ending 1.5' short of a diffuser attached nothing, silently — so the
// leader makes it visible instead of announced. A stray device draws no
// leader; its bare glyph IS the tell. Quiet by construction: it is evidence,
// not a mark the estimator placed.
const DUCT_LEADER_ALPHA = 0.55;
const DUCT_LEADER_DASH = [4, 3];

// px-per-pdf-pt of a pdf->canvas mapper — measured, not assumed, so the same
// code serves the live overlay (zoom·DPR), every export raster (its scale),
// and any future transform.
function ductPxPerPdfPt(tc) {
  const o = tc({ x: 0, y: 0 }), u = tc({ x: 1, y: 0 });
  return Math.sqrt((u.x - o.x) * (u.x - o.x) + (u.y - o.y) * (u.y - o.y));
}

// The ghost's on-canvas width for one segment: inches → the scale's unit
// (geometry.js convertUnitValue) → pdf pts (× pixelsPerUnit) → canvas px
// (× pxPerPt). null when there is nothing honest to draw: no usable scale on
// the page/zone (nothing to convert — the run keeps its symbolic stroke only),
// a malformed size, or a band under DUCT_GHOST_MIN_PX.
function ductGhostWidthPx(size, orientation, scale, pxPerPt) {
  if (!scale || !(scale.pixelsPerUnit > 0) || !(pxPerPt > 0)) return null;
  if (typeof ductPlanWidthIn !== 'function') return null;
  const widthIn = ductPlanWidthIn(size, orientation);
  if (!(widthIn > 0)) return null;
  const pts = convertUnitValue(widthIn, 'in', scale.unit || 'ft') * scale.pixelsPerUnit;
  const px = pts * pxPerPt;
  return px >= DUCT_GHOST_MIN_PX ? px : null;
}

function createCanvasDraw(deps) {
  // Room Sizer boxes, shared by the live overlay and the export path (the two
  // callers differ only in their PDF->canvas mapper and label scale factor).
  // Boxes render in their room's color with a name + W×L×H label; a box whose
  // page (or containing scale zone) has no scale gets an explicit "no scale"
  // label instead of silently wrong numbers.
  // D24 (X4 option D): which label each room box gets on this sheet.
  //   'full'     — today's Name + L×W×H block (rooms the estimator named)
  //   'nameOnly' — the name alone (option B: a plan-named room whose text layer
  //                is not available at paint time, e.g. an export of a page
  //                whose text was never fetched — nothing to collide against)
  //   'none'     — a plan-named room's non-largest box (the union is labelled once)
  // and, per plan-named room, ONE totals tag on its largest box: text
  // "5,670 ft³ · 450 CFM · ✓", placed at the first anchor (corners first, then
  // edge midpoints) whose estimated rect clears every printed text item in
  // the box. Pure over (ann, pageIdx) through deps — the spec seam.
  const ROOM_TAG_ANCHORS = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
  function planRoomLabels(ann, pageIdx) {
    const state = deps.getState();
    const boxes = ann.roomBoxes || [];
    // X4 option A (2026-09-14): a room the estimator NAMED, drawn as 2+ boxes on
    // this sheet, is labelled once — its largest box carries the name + the
    // room's totals ("700 ft² · 6,300 ft³ · 3 boxes", mode 'roomFull'), the
    // others the name with their place ("Corridor · 2/3", mode 'namePart') —
    // so three full L×W×H blocks never bury the plan's own room name (J7).
    // A single-box room keeps today's full label; plan-named rooms keep D24's.
    const multi = new Map();
    boxes.forEach((b, i) => {
      const room = (state.rooms || []).find(r => r.id === b.roomId);
      if (!room || room.nameFromPlan) return;
      const dims = roomBoxDimsFeet(b, deps.getEffectiveScaleForLine(ann, b, false, pageIdx));
      const area = Math.abs(b.x2 - b.x1) * Math.abs(b.y2 - b.y1);
      const e = multi.get(room.id) || { idx: [], largest: -1, largestArea: -1, volume: 0, sqft: 0 };
      e.idx.push(i);
      if (area > e.largestArea) { e.largest = i; e.largestArea = area; }
      if (dims) { e.volume += dims.volumeCuFt; e.sqft += dims.areaSqFt; }
      multi.set(room.id, e);
    });
    const onceMode = (i) => {
      const b = boxes[i];
      const e = b.roomId ? multi.get(b.roomId) : null;
      if (!e || e.idx.length < 2) return { index: i, mode: 'full' };
      const n = e.idx.length;
      if (i === e.largest) return { index: i, mode: 'roomFull', part: n + ' boxes', roomSqft: e.sqft, roomVolume: e.volume };
      return { index: i, mode: 'namePart', part: (e.idx.indexOf(i) + 1) + '/' + n };
    };
    // Nothing more to plan unless some box belongs to a plan-named room — the
    // common case exits here without touching the text layer or the balance rows.
    const anyFromPlan = boxes.some(b => (state.rooms || []).some(r => r.id === b.roomId && r.nameFromPlan));
    if (!anyFromPlan) return { boxes: boxes.map((b, i) => onceMode(i)), tags: [] };
    const items = deps.getPageTextItems ? (deps.getPageTextItems(pageIdx) || []) : [];
    const balance = deps.getRoomBalanceForPage ? (deps.getRoomBalanceForPage(pageIdx) || []) : [];
    const byRoom = new Map();
    const plan = boxes.map((b, i) => {
      const room = (state.rooms || []).find(r => r.id === b.roomId);
      if (!room || !room.nameFromPlan) return onceMode(i);
      if (!items.length) return { index: i, mode: 'nameOnly' };
      const dims = roomBoxDimsFeet(b, deps.getEffectiveScaleForLine(ann, b, false, pageIdx));
      const area = Math.abs(b.x2 - b.x1) * Math.abs(b.y2 - b.y1);
      const e = byRoom.get(room.id) || { room, largest: -1, largestArea: -1, volume: 0, sqft: 0 };
      if (area > e.largestArea) { e.largest = i; e.largestArea = area; }
      if (dims) { e.volume += dims.volumeCuFt; e.sqft += dims.areaSqFt; }
      byRoom.set(room.id, e);
      return { index: i, mode: 'none' };
    });
    const tags = [];
    byRoom.forEach((e) => {
      const b = boxes[e.largest];
      const minX = Math.min(b.x1, b.x2), maxX = Math.max(b.x1, b.x2), minY = Math.min(b.y1, b.y2), maxY = Math.max(b.y1, b.y2);
      const parts = [Math.round(e.volume).toLocaleString() + ' ft³'];
      const target = typeof roomTargetCfm === 'function' ? roomTargetCfm(e.room, e.sqft) : 0;
      if (target > 0) {
        parts.push(Math.round(target).toLocaleString() + ' CFM');
        const row = balance.find(r => r.id === e.room.id);
        if (row) parts.push(row.under ? '⚠' : '✓');
      }
      const text = parts.join(' · ');
      // Estimated tag rect in PDF pts (9 pt DM Sans ≈ 0.55 em per char, 12 pt tall, 3 pt pad).
      const w = Math.min(maxX - minX, text.length * 4.95 + 6), hgt = 13, pad = 3;
      const inBox = items.filter(it => it.x + it.w > minX && it.x < maxX && it.y + it.h > minY && it.y < maxY);
      const rectFor = (a) => {
        const x = a.endsWith('w') ? minX + pad : a.endsWith('e') ? maxX - pad - w : (minX + maxX) / 2 - w / 2;
        const y = a.startsWith('n') ? minY + pad : a.startsWith('s') ? maxY - pad - hgt : (minY + maxY) / 2 - hgt / 2;
        return { x, y, w, h: hgt };
      };
      const clear = (r) => !inBox.some(it => it.x < r.x + r.w && it.x + it.w > r.x && it.y < r.y + r.h && it.y + it.h > r.y);
      let anchor = ROOM_TAG_ANCHORS.find(a => clear(rectFor(a))) || 'nw';
      tags.push({ roomId: e.room.id, boxIndex: e.largest, text, anchor, rect: rectFor(anchor), collided: !clear(rectFor(anchor)) });
    });
    return { boxes: plan, tags };
  }
  function drawRoomBoxesToContext(ctx, ann, pageIdx, tcFn, fontScale) {
    const state = deps.getState();
    const labelPlan = planRoomLabels(ann, pageIdx);
    (ann.roomBoxes || []).forEach((b, bi) => {
      const entry = labelPlan.boxes[bi] || { mode: 'full' };
      const mode = entry.mode || 'full';
      const room = (state.rooms || []).find(r => r.id === b.roomId);
      const color = room?.color || '#47c88e';
      const minX = Math.min(b.x1, b.x2), maxX = Math.max(b.x1, b.x2);
      const minY = Math.min(b.y1, b.y2), maxY = Math.max(b.y1, b.y2);
      const tl = tcFn({ x: minX, y: minY }), br = tcFn({ x: maxX, y: maxY });
      ctx.globalAlpha = 0.12; ctx.fillStyle = color;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      const boxW = br.x - tl.x, boxH = br.y - tl.y;
      if (boxW < 40 || boxH < 24) return;
      const effScale = deps.getEffectiveScaleForLine(ann, b, false, pageIdx);
      const dims = roomBoxDimsFeet(b, effScale);
      const roomName = room?.name || 'Room';
      const nameLabel = mode === 'namePart' ? roomName + ' · ' + entry.part : roomName;
      if (mode === 'none') return;   // D24: the union is labelled once, on the largest box
      if (mode === 'roomFull') {     // X4 option A: the room's largest box — name + room totals
        const nameSize = 13 * fontScale, lineSize = 11 * fontScale, pad = 4 * fontScale, gap = 2 * fontScale;
        const totals = (dims ? Math.round(entry.roomSqft).toLocaleString() + ' ft² · ' + Math.round(entry.roomVolume).toLocaleString() + ' ft³ · ' : 'no scale · ') + entry.part;
        const center = tcFn({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
        ctx.font = '600 ' + nameSize + 'px DM Sans';
        const nw = ctx.measureText(roomName).width;
        ctx.font = lineSize + 'px DM Sans';
        const tw = ctx.measureText(totals).width;
        const w = Math.max(nw, tw), h = nameSize + gap + lineSize;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(center.x - w / 2 - pad, center.y - h / 2 - pad, w + pad * 2, h + pad * 2);
        ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.font = '600 ' + nameSize + 'px DM Sans';
        ctx.fillText(roomName, center.x, center.y - h / 2);
        ctx.font = lineSize + 'px DM Sans';
        ctx.fillText(totals, center.x, center.y - h / 2 + nameSize + gap);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        return;
      }
      if (mode === 'nameOnly' || mode === 'namePart') {     // D24 option B / X4 option A: the name alone, centered
        const nameSize = 13 * fontScale, pad = 4 * fontScale;
        const center = tcFn({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
        ctx.font = '600 ' + nameSize + 'px DM Sans';
        const nw = ctx.measureText(nameLabel).width;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(center.x - nw / 2 - pad, center.y - nameSize / 2 - pad, nw + pad * 2, nameSize + pad * 2);
        ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(nameLabel, center.x, center.y - nameSize / 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        return;
      }
      // Dims read L × W (× H): longer side first, matching the modal's table,
      // with small (L)/(W)/(H) tags centered under their segments.
      let segs = null;
      let dimsLabel = 'no scale';
      if (dims) {
        segs = [
          { text: formatFeetInchesFromVal(Math.max(dims.widthFt, dims.lengthFt), 'ft'), tag: '(L)' },
          { text: formatFeetInchesFromVal(Math.min(dims.widthFt, dims.lengthFt), 'ft'), tag: '(W)' }
        ];
        if (dims.heightFt > 0) segs.push({ text: formatFeetInchesFromVal(dims.heightFt, 'ft'), tag: '(H)' });
        dimsLabel = segs.map(s => s.text).join(' × ');
      }
      const nameSize = 13 * fontScale, dimsSize = 11 * fontScale, tagSize = 8.5 * fontScale;
      const center = tcFn({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
      ctx.textAlign = 'center';
      ctx.font = '600 ' + nameSize + 'px DM Sans';
      const nameW = ctx.measureText(nameLabel).width;
      ctx.font = dimsSize + 'px DM Sans';
      const dimsW = ctx.measureText(dimsLabel).width;
      const sepW = ctx.measureText(' × ').width;
      const pad = 4 * fontScale;
      const blockW = Math.max(nameW, dimsW) + pad * 2;
      const blockH = nameSize + dimsSize + (segs ? tagSize + pad : 0) + pad * 3;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(center.x - blockW / 2, center.y - blockH / 2, blockW, blockH);
      ctx.fillStyle = '#222';
      ctx.textBaseline = 'top';
      ctx.font = '600 ' + nameSize + 'px DM Sans';
      ctx.fillText(nameLabel, center.x, center.y - blockH / 2 + pad);
      const dimsY = center.y - blockH / 2 + pad * 2 + nameSize;
      ctx.font = dimsSize + 'px DM Sans';
      ctx.fillText(dimsLabel, center.x, dimsY);
      if (segs) {
        const tagY = dimsY + dimsSize + pad / 2;
        ctx.fillStyle = '#8a8a8a';
        ctx.font = tagSize + 'px DM Sans';
        let segX = center.x - dimsW / 2;
        segs.forEach(seg => {
          ctx.font = dimsSize + 'px DM Sans';
          const segW = ctx.measureText(seg.text).width;
          ctx.font = tagSize + 'px DM Sans';
          ctx.fillText(seg.tag, segX + segW / 2, tagY);
          segX += segW + sepW;
        });
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    });
    // D24: the totals tags — one per plan-named room, off the printed text.
    labelPlan.tags.forEach(t => {
      const room = (state.rooms || []).find(r => r.id === t.roomId);
      const color = room?.color || '#47c88e';
      const size = 9 * fontScale, pad = 3 * fontScale;
      const p = tcFn({ x: t.rect.x, y: t.rect.y });
      ctx.font = '600 ' + size + 'px DM Sans';
      const tw = ctx.measureText(t.text).width;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(p.x, p.y, tw + pad * 2, size + pad * 2);
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, tw + pad * 2, size + pad * 2);
      ctx.fillStyle = '#222'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(t.text, p.x + pad, p.y + pad);
      ctx.textBaseline = 'alphabetic';
    });
  }

  // The unified persisted-marks painter. See the env divergence register in
  // the file header; anything not in env reads state via deps at call time.
  function drawAnnotationsCore(ctx, ann, env) {
    const state = deps.getState();
    const tc = env.tc;
    const lts = state.lineTypeSettings || { opacity: 1, lineSize: 2, dropXSize: 10, dropIconStyle: 'circle', parallelEndsSize: 10, lengthLabelSize: 12, snapToHorizontalVertical: false, showOnlyLineTypesOnCurrentPage: false };
    const lw = env.lineWidth;
    const lo = env.lineOpacity;

    // Shared length-label painter (identical in both original paths save for
    // pad/font sizing, which arrive via env).
    const drawLengthLabel = (label, mid, angle) => {
      const fontSize = (lts.lengthLabelSize ?? 12) * env.fontScale;
      ctx.font = fontSize + 'px ' + env.fontFamily;
      const tw = ctx.measureText(label).width;
      const pad = env.labelPad;
      const orient = lts.orientLengthWithLine !== false;
      if (orient && (angle > Math.PI / 2 || angle < -Math.PI / 2)) angle += Math.PI;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (orient) {
        ctx.save();
        ctx.translate(mid.x, mid.y);
        ctx.rotate(angle);
        ctx.fillRect(-tw / 2 - pad, -fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#000';
        ctx.fillText(label, 0, 0);
        ctx.restore();
      } else {
        ctx.fillRect(mid.x - tw / 2 - pad, mid.y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#000';
        ctx.fillText(label, mid.x, mid.y);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    };

    // Drop-size label ("3 ft" white chip) beside a drop glyph — env.showDropSizes
    // only (the live "Drop sizes" toggle; export envs never set it). Placement is
    // deterministic: centered past the marker along the run's OUTWARD direction
    // (through the end, away from the adjacent point), pushed out by the chip's
    // own projected extent so it clears the glyph at any text length or angle.
    // The node model (collectDropNodes) guarantees coincident line ends carry a
    // drop on exactly ONE end, so a shared joint paints exactly one chip.
    const drawDropSizeLabel = (endPdf, innerPdf, value, unit) => {
      const label = deps.formatDropLabel ? deps.formatDropLabel(value, unit) : '';
      if (!label) return;
      const p = tc(endPdf), q2 = tc(innerPdf);
      let dx = p.x - q2.x, dy = p.y - q2.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) { dx /= len; dy /= len; } else { dx = 0.707; dy = -0.707; }
      const fontSize = 10 * env.fontScale;
      ctx.font = fontSize + 'px ' + env.fontFamily;
      const tw = ctx.measureText(label).width;
      const pad = env.labelPad;
      const ext = Math.abs(dx) * (tw / 2 + pad) + Math.abs(dy) * (fontSize / 2 + pad);
      const d = env.dropSize * 1.3 + 3 * env.fontScale + ext;
      const cx = p.x + dx * d, cy = p.y + dy * d;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(cx - tw / 2 - pad, cy - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    };

    const drawGroupDot = (midPdf, groupId) => {
      const mid = tc(midPdf);
      const groupColor = deps.getGroupColor(groupId);
      ctx.fillStyle = groupColor;
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, env.dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    // S3 tick marks: one hash per conductor across the run at `midPdf`,
    // slanted 60° off the tangent in the drafting convention — hots plain,
    // the neutral half again as long, the ground dashed. Drawn here once, so
    // the live overlay and every export carry them; per line type (`tickMarks`
    // defaults on when conductors are set), never an env flag.
    const drawConductorTicks = (line, lt, midPdf, tangentPdf, color) => {
      if (typeof tickLayout !== 'function' || typeof conductorsForLine !== 'function') return;
      if (!lt || lt.tickMarks === false) return;
      const conductors = conductorsForLine(line, lt);
      if (!conductors) return;
      const ticks = tickLayout(conductors);
      if (!ticks.length) return;
      const len = Math.hypot(tangentPdf.x, tangentPdf.y) || 1;
      const ux = tangentPdf.x / len, uy = tangentPdf.y / len;
      // 60° slant: rotate the perpendicular 30° toward the run direction
      const cos30 = Math.cos(Math.PI / 6), sin30 = Math.sin(Math.PI / 6);
      const px = -uy * cos30 + ux * sin30, py = ux * cos30 + uy * sin30;
      const base = (lts.parallelEndsSize ?? 10) * 1.1;
      const gap = base * 0.5;
      const start = -((ticks.length - 1) * gap) / 2;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, lw * 0.75); ctx.globalAlpha = lo;
      ticks.forEach((t, i) => {
        const cx = midPdf.x + ux * (start + i * gap), cy = midPdf.y + uy * (start + i * gap);
        const half = (base * t.len) / 2;
        const p1 = tc({ x: cx - px * half, y: cy - py * half });
        const p2 = tc({ x: cx + px * half, y: cy + py * half });
        ctx.setLineDash(t.dashed ? [3, 2] : []);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();
    };
    // S4 homerun: the arrowhead-to-panel at the run's END (the drafting
    // convention), with the circuit tag ("LP-1/7") beside it when the run's
    // group is a circuit. Per line type or per run (`homerun: true`).
    const drawHomerunArrow = (line, lt, endPdf, tangentPdf, color) => {
      if (!(line && line.homerun) && !(lt && lt.homerun)) return;
      const len = Math.hypot(tangentPdf.x, tangentPdf.y) || 1;
      const ux = tangentPdf.x / len, uy = tangentPdf.y / len;
      const size = (lts.parallelEndsSize ?? 10) * 1.4;
      const tip = endPdf;
      const base = { x: tip.x - ux * size, y: tip.y - uy * size };
      const w = size * 0.45;
      const l = tc({ x: base.x - uy * w, y: base.y + ux * w });
      const r = tc({ x: base.x + uy * w, y: base.y - ux * w });
      const t = tc(tip);
      ctx.save();
      ctx.fillStyle = color; ctx.globalAlpha = lo;
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.closePath(); ctx.fill();
      const g = (state.groups || []).find(gr => gr.id === line.group);
      const label = typeof circuitTag === 'function' && g ? circuitTag(g) : '';
      if (label) {
        const fs = (lts.lengthLabelSize ?? 12);
        const zoomK = tc({ x: 1, y: 0 }).x - tc({ x: 0, y: 0 }).x;   // device px per PDF pt
        ctx.font = 'bold ' + Math.max(9, fs * zoomK) + 'px ' + (env.fontFamily || 'sans-serif');
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        const at = tc({ x: tip.x + ux * size * 0.6 - uy * size * 0.8, y: tip.y + uy * size * 0.6 + ux * size * 0.8 });
        ctx.fillText(label, at.x, at.y);
      }
      ctx.restore();
    };
    (ann.quickLines || []).forEach(q => {
      const aPdf = { x: q.x1, y: q.y1 }, bPdf = { x: q.x2, y: q.y2 };
      const a = tc(aPdf), b = tc(bPdf);
      const lt = (state.lineTypes || []).find(l => l.id === q.lineTypeId);
      const isCurved = lt && lt.curveStyle === 'arc';
      const ctrlPdf = isCurved ? getQuadraticBezierControlPoint(aPdf, bPdf, 1) : null;
      const ctrl = ctrlPdf ? tc(ctrlPdf) : null;
      const isSelected = !!(env.selection && !env.selection.isPoly && env.selection.id === q.id);
      ctx.strokeStyle = q.color || '#4a9eff'; ctx.lineWidth = isSelected ? lw * 2 : lw; ctx.globalAlpha = lo;
      if (isSelected) { ctx.shadowBlur = 8; ctx.shadowColor = q.color || '#4a9eff'; }
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      if (isCurved && ctrl) ctx.quadraticCurveTo(ctrl.x, ctrl.y, b.x, b.y);
      else ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (isSelected) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
      ctx.globalAlpha = 1;
      if (state.showGroupColors && (q.group || null)) {
        const midPdf = isCurved && ctrlPdf ? quadraticBezierPoint(0.5, aPdf, ctrlPdf, bPdf) : { x: (aPdf.x + bPdf.x) / 2, y: (aPdf.y + bPdf.y) / 2 };
        drawGroupDot(midPdf, q.group);
      }
      drawConductorTicks(q, lt, { x: (aPdf.x + bPdf.x) / 2, y: (aPdf.y + bPdf.y) / 2 }, { x: bPdf.x - aPdf.x, y: bPdf.y - aPdf.y }, q.color || '#4a9eff');
      drawHomerunArrow(q, lt, bPdf, { x: bPdf.x - aPdf.x, y: bPdf.y - aPdf.y }, q.color || '#4a9eff');
      const drawDrop = (p) => drawDropMarker(ctx, p, env.dropSize, q.color || '#4a9eff', env.dropStyle);
      if ((q.startDrop || 0) > 0) drawDrop(a);
      if ((q.endDrop || 0) > 0) drawDrop(b);
      if (env.showDropSizes) {
        if ((q.startDrop || 0) > 0) drawDropSizeLabel(aPdf, bPdf, q.startDrop, q.startDropUnit);
        if ((q.endDrop || 0) > 0) drawDropSizeLabel(bPdf, aPdf, q.endDrop, q.endDropUnit);
      }
      if (q.showLength) {
        const tickLen = lts.parallelEndsSize ?? 10;
        const drawPerpTick = (endPdf, tangentPdf) => {
          const dx = tangentPdf.x, dy = tangentPdf.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = -dy / len, perpY = dx / len;
          const half = tickLen / 2;
          const p1 = tc({ x: endPdf.x - perpX * half, y: endPdf.y - perpY * half });
          const p2 = tc({ x: endPdf.x + perpX * half, y: endPdf.y + perpY * half });
          ctx.strokeStyle = q.color || '#4a9eff';
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        };
        if (isCurved && ctrlPdf) {
          drawPerpTick(aPdf, { x: ctrlPdf.x - aPdf.x, y: ctrlPdf.y - aPdf.y });
          drawPerpTick(bPdf, { x: bPdf.x - ctrlPdf.x, y: bPdf.y - ctrlPdf.y });
        } else {
          drawPerpTick(aPdf, { x: bPdf.x - aPdf.x, y: bPdf.y - aPdf.y });
          drawPerpTick(bPdf, { x: bPdf.x - aPdf.x, y: bPdf.y - aPdf.y });
        }
        const midPdf = isCurved && ctrlPdf ? quadraticBezierPoint(0.5, aPdf, ctrlPdf, bPdf) : { x: (aPdf.x + bPdf.x) / 2, y: (aPdf.y + bPdf.y) / 2 };
        const mid = tc(midPdf);
        const effScale = deps.getEffectiveScaleForLine(ann, q, false, env.pageIdx);
        const realLen = deps.getLineRealWorldLength(q, env.pageIdx, false, ann);
        const label = deps.formatDistFeetInchesFromReal(realLen, effScale);
        drawLengthLabel(label, mid, Math.atan2(bPdf.y - aPdf.y, bPdf.x - aPdf.x));
      }
    });
    (ann.polylines || []).forEach(poly => {
      const pts = poly.points || [];
      if (pts.length < 2) return;
      const isSelected = !!(env.selection && env.selection.isPoly && env.selection.id === poly.id);
      ctx.strokeStyle = poly.color || '#4a9eff'; ctx.lineWidth = isSelected ? lw * 2 : lw; ctx.globalAlpha = lo;
      if (isSelected) { ctx.shadowBlur = 8; ctx.shadowColor = poly.color || '#4a9eff'; }
      ctx.beginPath();
      const p0 = tc(pts[0]); ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) { const p = tc(pts[i]); ctx.lineTo(p.x, p.y); }
      if (poly.closed) ctx.closePath();
      ctx.stroke();
      if (isSelected) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
      ctx.globalAlpha = 1;
      if (state.showGroupColors && (poly.group || null)) {
        const idx = Math.floor(pts.length / 2);
        drawGroupDot(pts[idx] || pts[0], poly.group);
      }
      {
        // ticks on the longest segment — the one with room for them
        let best = 0, bestLen = -1;
        for (let i = 0; i < pts.length - 1; i++) { const l = ptDist(pts[i], pts[i + 1]); if (l > bestLen) { bestLen = l; best = i; } }
        const pa = pts[best], pb = pts[best + 1];
        const plt = (state.lineTypes || []).find(l => l.id === poly.lineTypeId);
        drawConductorTicks(poly, plt, { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, { x: pb.x - pa.x, y: pb.y - pa.y }, poly.color || '#4a9eff');
        const last = pts[pts.length - 1], prev = pts[pts.length - 2];
        drawHomerunArrow(poly, plt, last, { x: last.x - prev.x, y: last.y - prev.y }, poly.color || '#4a9eff');
      }
      const drawDrop = (p) => drawDropMarker(ctx, p, env.dropSize, poly.color || '#4a9eff', env.dropStyle);
      if ((poly.startDrop || 0) > 0 && pts.length > 0) drawDrop(tc(pts[0]));
      if ((poly.endDrop || 0) > 0 && pts.length > 0) drawDrop(tc(pts[pts.length - 1]));
      if (env.showDropSizes && pts.length > 1) {
        if ((poly.startDrop || 0) > 0) drawDropSizeLabel(pts[0], pts[1], poly.startDrop, poly.startDropUnit);
        if ((poly.endDrop || 0) > 0) drawDropSizeLabel(pts[pts.length - 1], pts[pts.length - 2], poly.endDrop, poly.endDropUnit);
      }
      // BEND-FITTINGS: the chip at each bend that counts a fitting (and the grey
      // "no" chip at an overridden vertex); the shared helper above.
      drawBendFittingChips(ctx, pts, !!poly.closed, poly.color || '#4a9eff', (state.lineTypes || []).find(l => l.id === poly.lineTypeId), tc, env.fontScale || 1, env.fontFamily);
      if (poly.showLength && pts.length >= 2) {
        const tickLen = lts.parallelEndsSize ?? 10;
        const drawPerpTick = (endPdf, tangentPdf) => {
          const dx = tangentPdf.x, dy = tangentPdf.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const perpX = -dy / len, perpY = dx / len;
          const half = tickLen / 2;
          const p1 = tc({ x: endPdf.x - perpX * half, y: endPdf.y - perpY * half });
          const p2 = tc({ x: endPdf.x + perpX * half, y: endPdf.y + perpY * half });
          ctx.strokeStyle = poly.color || '#4a9eff';
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        };
        drawPerpTick(pts[0], { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y });
        if (pts.length > 2) drawPerpTick(pts[pts.length - 1], { x: pts[pts.length - 1].x - pts[pts.length - 2].x, y: pts[pts.length - 1].y - pts[pts.length - 2].y });
        const totalLen = polylineDistance(pts, poly.closed);
        let acc = 0;
        let midPdf = pts[0];
        let segAngle = 0;
        const halfLen = totalLen / 2;
        for (let i = 0; i < pts.length - 1; i++) {
          const segLen = ptDist(pts[i], pts[i + 1]);
          if (acc + segLen >= halfLen) {
            const t = (halfLen - acc) / segLen;
            midPdf = { x: pts[i].x + t * (pts[i + 1].x - pts[i].x), y: pts[i].y + t * (pts[i + 1].y - pts[i].y) };
            segAngle = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
            break;
          }
          acc += segLen;
        }
        if (poly.closed && pts.length >= 3) {
          const segLen = ptDist(pts[pts.length - 1], pts[0]);
          if (acc + segLen >= halfLen) {
            const t = (halfLen - acc) / segLen;
            midPdf = { x: pts[pts.length - 1].x + t * (pts[0].x - pts[pts.length - 1].x), y: pts[pts.length - 1].y + t * (pts[0].y - pts[pts.length - 1].y) };
            segAngle = Math.atan2(pts[0].y - pts[pts.length - 1].y, pts[0].x - pts[pts.length - 1].x);
          }
        }
        const mid = tc(midPdf);
        const effScale = deps.getEffectiveScaleForLine(ann, poly, true, env.pageIdx);
        const realLen = deps.getLineRealWorldLength(poly, env.pageIdx, true, ann);
        const label = deps.formatDistFeetInchesFromReal(realLen, effScale);
        drawLengthLabel(label, mid, segAngle);
      }
    });
    // D13 true-width ghost: one pass over EVERY run before ANY run's stroke,
    // so no ghost ever sits over another run's ink. Per segment, a round-
    // capped/round-joined polyline stroke at the real plan-view width (the
    // cheap correct way — corners and size steps never gap), in the airside
    // color at DUCT_GHOST_ALPHA, no outline. The run's effective scale is the
    // same one the tallies use (page scale, or the scale zone the run sits
    // in); unscaled pages and sub-DUCT_GHOST_MIN_PX bands paint nothing, so
    // those cases stay byte-identical to a ghost-free render. Toggle:
    // legendSettings.showDuctGhost (default ON, beside D5's showDuct).
    if ((ann.ductRuns || []).length && state.legendSettings?.showDuctGhost !== false && typeof ductGhostWidthPx === 'function') {
      const pxPerPt = ductPxPerPdfPt(tc);
      ann.ductRuns.forEach(run => {
        const verts = run.vertices || [];
        if (verts.length < 2) return;
        const eff = deps.getEffectiveScaleForLine(ann, { points: verts }, true, env.pageIdx);
        if (!eff) return;
        const color = DUCT_AIRSIDE_COLORS[run.airside] || DUCT_AIRSIDE_COLORS.supply;
        runSegmentSpans(run).forEach(span => {
          const widthPx = ductGhostWidthPx(span.size, run.orientation, eff, pxPerPt);
          if (widthPx == null) return;
          ctx.strokeStyle = color;
          ctx.lineWidth = widthPx;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.globalAlpha = DUCT_GHOST_ALPHA;
          ctx.beginPath();
          const g0 = tc(verts[span.fromIdx]);
          ctx.moveTo(g0.x, g0.y);
          for (let i = span.fromIdx + 1; i <= span.toIdx; i++) { const p = tc(verts[i]); ctx.lineTo(p.x, p.y); }
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
      });
    }
    // D19 (J19 Friction #3): flex leaders. Painted under the run strokes and
    // the counter glyphs, so the tie never competes with either. Devices are
    // the placed markers whose counter (or per-marker override) carries a CFM
    // — ductMarkerCfm is the one rule, and attachment comes from
    // ductDeviceLeaders, which wraps the SAME attachDuctDevices the tallies
    // use. A project with no duct runs and no CFM devices paints nothing, so
    // duct-free renders stay byte-identical.
    if ((ann.ductRuns || []).length && typeof ductDeviceLeaders === 'function' && typeof ductMarkerCfm === 'function') {
      const devices = [];
      (deps.getState().counters || []).forEach(c => {
        (ann.counterMarkers?.[c.id] || []).forEach(m => {
          if (ductMarkerCfm(m, c) > 0) devices.push({ x: m.x, y: m.y });
        });
      });
      if (devices.length) {
        const leaders = ductDeviceLeaders(devices, ann.ductRuns);
        if (leaders.length) {
          const lScale = env.ductStrokeScale != null ? env.ductStrokeScale : 1;
          ctx.save();
          ctx.globalAlpha = DUCT_LEADER_ALPHA;
          ctx.lineWidth = 1 * lScale;
          ctx.setLineDash(DUCT_LEADER_DASH.map(d => d * lScale));
          leaders.forEach(l => {
            // The leader wears its RUN's airside color, so a return grille's
            // tie reads red like the run it taps, not supply blue.
            const run = ann.ductRuns.find(r => r && r.id === l.runId);
            ctx.strokeStyle = DUCT_AIRSIDE_COLORS[run?.airside] || DUCT_AIRSIDE_COLORS.supply;
            const a = tc(l.from), b = tc(l.to);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          });
          ctx.restore();
        }
      }
    }
    // Duct runs (DUCT-PLAN unit D2). One continuous trace whose stroke width
    // STEPS with each size segment (ductStrokePx band table in duct-model.js,
    // scaled by env.ductStrokeScale — 1 on the live overlay, raster scale on
    // export), with a size tag chip at each segment's midpoint (the length-
    // label idiom: white backing, chip text in the run color). Colors key off
    // airside so D4's trade-color pass is a value edit here, not a rewrite.
    // duct-model.js globals (runSegmentSpans/formatDuctSize/ductStrokePx) are
    // read by bare name — it loads before this file.
    (ann.ductRuns || []).forEach(run => {
      const verts = run.vertices || [];
      if (verts.length < 2) return;
      const color = DUCT_AIRSIDE_COLORS[run.airside] || DUCT_AIRSIDE_COLORS.supply;
      const strokeScale = env.ductStrokeScale != null ? env.ductStrokeScale : 1;
      // D4 sidebar selection: live-only glow, the quick-line/polyline idiom
      // (shadowBlur + widened stroke). The export env never sets the id.
      const isSelected = !!(env.selectedDuctRunId && env.selectedDuctRunId === run.id);
      const chips = [];
      runSegmentSpans(run).forEach(span => {
        ctx.strokeStyle = color;
        ctx.lineWidth = ductStrokePx(span.size) * strokeScale * (isSelected ? 1.5 : 1);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.globalAlpha = lo;
        if (isSelected) { ctx.shadowBlur = 8; ctx.shadowColor = color; }
        ctx.beginPath();
        const s0 = tc(verts[span.fromIdx]);
        ctx.moveTo(s0.x, s0.y);
        for (let i = span.fromIdx + 1; i <= span.toIdx; i++) { const p = tc(verts[i]); ctx.lineTo(p.x, p.y); }
        ctx.stroke();
        if (isSelected) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
        ctx.globalAlpha = 1;
        // Segment midpoint (by vertex path length) for the size tag chip.
        let total = 0;
        for (let i = span.fromIdx; i < span.toIdx; i++) total += ptDist(verts[i], verts[i + 1]);
        let acc = 0, midPdf = verts[span.fromIdx], angle = 0;
        for (let i = span.fromIdx; i < span.toIdx; i++) {
          const segLen = ptDist(verts[i], verts[i + 1]);
          if (acc + segLen >= total / 2) {
            const t = segLen > 0 ? (total / 2 - acc) / segLen : 0;
            midPdf = { x: verts[i].x + t * (verts[i + 1].x - verts[i].x), y: verts[i].y + t * (verts[i + 1].y - verts[i].y) };
            angle = Math.atan2(verts[i + 1].y - verts[i].y, verts[i + 1].x - verts[i].x);
            break;
          }
          acc += segLen;
        }
        chips.push({ label: formatDuctSize(span.size), midPdf, angle });
      });
      // Chips paint after every stroke of the run so a wide next segment can
      // never cover the previous segment's tag.
      chips.forEach(chip => {
        const fontSize = 10 * env.fontScale;
        ctx.font = '600 ' + fontSize + 'px ' + env.fontFamily;
        const tw = ctx.measureText(chip.label).width;
        const pad = env.labelPad;
        const mid = tc(chip.midPdf);
        let angle = chip.angle;
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
        ctx.save();
        ctx.translate(mid.x, mid.y);
        ctx.rotate(angle);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(-tw / 2 - pad, -fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(chip.label, 0, 0);
        ctx.restore();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      });
    });
    // Duct fitting markers (DUCT-PLAN unit D3): the self-counted fittings at
    // their anchors, in the mockup vocabulary — elbow = diamond outline
    // (amber, elbow45 drawn smaller), transition = double chevrons pointing
    // downstream (green), tap = ring + dot (purple); the reclassify-only
    // types get boot = square + dot, offset = double slash. Sized off the
    // duct stroke band (modest against the run), over a soft white backing
    // disc so a marker reads on a heavy stroke. Suppressed delete-tombstones
    // paint nothing. Lives in the core so live overlay and exports agree; the
    // live overlay's hideMarks early-return hides fittings with everything
    // else (T2-03), and hitTest skips them the same way.
    if (ann.ductFittings && ann.ductFittings.length) {
      const strokeScale = env.ductStrokeScale != null ? env.ductStrokeScale : 1;
      const runs = ann.ductRuns || [];
      ann.ductFittings.forEach(f => {
        if (f.suppressed) return;
        const anchor = ductFittingAnchor(f, runs);
        if (!anchor) return;
        const p = tc(anchor);
        const s = (4 + ductStrokePx(f.size) * 0.6) * strokeScale;   // ~5.8–11.2px
        const lw = 1.6 * strokeScale;
        const color = DUCT_FITTING_COLORS[f.type] || DUCT_FITTING_COLORS.elbow90;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(p.x, p.y, s + 2 * strokeScale, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (f.type === 'elbow90' || f.type === 'elbow45') {
          const r = f.type === 'elbow45' ? s * 0.8 : s;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y);
          ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y);
          ctx.closePath(); ctx.stroke();
        } else if (f.type === 'transition') {
          const dir = ductFittingOutDirection(f, runs);
          ctx.translate(p.x, p.y);
          if (dir) ctx.rotate(Math.atan2(dir.y, dir.x));
          [-0.55, 0.15].forEach(off => {
            ctx.beginPath();
            ctx.moveTo((off - 0.25) * s, -0.7 * s);
            ctx.lineTo((off + 0.45) * s, 0);
            ctx.lineTo((off - 0.25) * s, 0.7 * s);
            ctx.stroke();
          });
        } else if (f.type === 'tap') {
          ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.85, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.3, 0, Math.PI * 2); ctx.fill();
        } else if (f.type === 'boot') {
          ctx.strokeRect(p.x - s * 0.7, p.y - s * 0.7, s * 1.4, s * 1.4);
          ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.28, 0, Math.PI * 2); ctx.fill();
        } else {   // offset: two parallel slashes
          [-0.4, 0.4].forEach(off => {
            ctx.beginPath();
            ctx.moveTo(p.x + off * s - s * 0.45, p.y + s * 0.6);
            ctx.lineTo(p.x + off * s + s * 0.45, p.y - s * 0.6);
            ctx.stroke();
          });
        }
        ctx.restore();
      });
    }
    // D18 (J19 #14): rise/drop markers — every run's verticalFt entry paints
    // in the fitting-marker pass: a filled up-triangle over the same white
    // backing disc, in DUCT_VERTICAL_COLOR, at duct-model's
    // ductVerticalMarkerAnchor (the vertex lifted 10 pt so a corner elbow at
    // the same vertex still reads), with a "12'" tag to its right (the size
    // tag idiom: white backing, chip text in the marker color). hitTest
    // (app.js) resolves the same anchor, so paint and menu never disagree;
    // the export env paints it too. Same hideMarks gate as the fittings.
    (ann.ductRuns || []).forEach(run => {
      if (!Array.isArray(run.verticalFt) || !run.verticalFt.length) return;
      const strokeScale = env.ductStrokeScale != null ? env.ductStrokeScale : 1;
      const sizeOf = (e) => (typeof ductSizeAtVertex === 'function' ? ductSizeAtVertex(run, e.vertexIdx) : null);
      run.verticalFt.forEach(e => {
        if (!e || !(e.ft > 0)) return;
        const anchor = ductVerticalMarkerAnchor(run, e);
        if (!anchor) return;
        const p = tc(anchor);
        const size = sizeOf(e);
        const s = (4 + (size ? ductStrokePx(size) : 6) * 0.6) * strokeScale;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(p.x, p.y, s + 2 * strokeScale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = DUCT_VERTICAL_COLOR;
        ctx.strokeStyle = DUCT_VERTICAL_COLOR;
        ctx.lineWidth = 1.6 * strokeScale;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s * 0.9);
        ctx.lineTo(p.x + s * 0.8, p.y + s * 0.6);
        ctx.lineTo(p.x - s * 0.8, p.y + s * 0.6);
        ctx.closePath();
        ctx.fill();
        // The feet tag — "12'" (one decimal when not whole), right of the glyph.
        const label = (Number.isInteger(e.ft) ? String(e.ft) : String(Math.round(e.ft * 10) / 10)) + "'";
        const fontSize = 9 * env.fontScale;
        ctx.font = '600 ' + fontSize + 'px ' + env.fontFamily;
        const tw = ctx.measureText(label).width;
        const pad = env.labelPad;
        const tx = p.x + s + 3 * strokeScale;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(tx - pad, p.y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = DUCT_VERTICAL_COLOR;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, tx, p.y);
        ctx.restore();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      });
    });
    (ann.highlights || []).forEach(h => {
      const minX = Math.min(h.x1, h.x2), maxX = Math.max(h.x1, h.x2);
      const minY = Math.min(h.y1, h.y2), maxY = Math.max(h.y1, h.y2);
      const tl = tc({ x: minX, y: minY }), br = tc({ x: maxX, y: maxY });
      ctx.fillStyle = h.color || '#e8c547'; ctx.globalAlpha = h.opacity != null ? h.opacity : 0.25;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1;
      if (h.label) {
        // Named-highlight tag: solid swatch of the highlight color with dark
        // text, hung ABOVE the top-left corner so it never covers the
        // highlighted content; when the rect touches the page top there is no
        // room above, so it drops just inside the corner instead.
        const fontSize = 12 * env.fontScale;
        ctx.font = '600 ' + fontSize + 'px ' + env.fontFamily;
        const tw = ctx.measureText(h.label).width;
        const pad = 4;
        const tagH = fontSize + pad * 2;
        const pageTopY = tc({ x: minX, y: 0 }).y;
        const rectX = tl.x;
        const rectY = (tl.y - tagH - 2 < pageTopY) ? tl.y + 2 : tl.y - tagH - 2;
        ctx.fillStyle = h.color || '#e8c547';
        ctx.fillRect(rectX, rectY, tw + pad * 2, tagH);
        ctx.fillStyle = '#1a1a1a';
        ctx.textBaseline = 'top';
        ctx.fillText(h.label, rectX + pad, rectY + pad);
        ctx.textBaseline = 'alphabetic';
      }
    });
    // Shared zone-label placement (multiply + scale zones): center or a corner
    // inset inside the zone rect. Returns the text anchor and the backing
    // rect's top-left for the given position keyword.
    function zoneLabelLayout(pos, center, tl, br, tw, fontSize, pad, inset) {
      if (pos === 'top-left') {
        return { textX: tl.x + inset, textY: tl.y + inset, textAlign: 'left', textBaseline: 'top', rectX: tl.x + inset, rectY: tl.y + inset };
      }
      if (pos === 'top-right') {
        return { textX: br.x - inset, textY: tl.y + inset, textAlign: 'right', textBaseline: 'top', rectX: br.x - inset - tw - pad * 2, rectY: tl.y + inset };
      }
      if (pos === 'bottom-left') {
        return { textX: tl.x + inset, textY: br.y - inset, textAlign: 'left', textBaseline: 'bottom', rectX: tl.x + inset, rectY: br.y - inset - fontSize - pad };
      }
      if (pos === 'bottom-right') {
        return { textX: br.x - inset, textY: br.y - inset, textAlign: 'right', textBaseline: 'bottom', rectX: br.x - inset - tw - pad * 2, rectY: br.y - inset - fontSize - pad };
      }
      return { textX: center.x, textY: center.y, textAlign: 'center', textBaseline: 'middle', rectX: center.x - tw / 2 - pad, rectY: center.y - fontSize / 2 - pad };
    }
    (ann.multiplyZones || []).forEach(zone => {
      const minX = Math.min(zone.x1, zone.x2), maxX = Math.max(zone.x1, zone.x2);
      const minY = Math.min(zone.y1, zone.y2), maxY = Math.max(zone.y1, zone.y2);
      const tl = tc({ x: minX, y: minY }), br = tc({ x: maxX, y: maxY });
      ctx.strokeStyle = '#47c88e'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.15; ctx.fillStyle = '#47c88e'; ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1; ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
      const zoneW = br.x - tl.x, zoneH = br.y - tl.y;
      if (zoneW >= 30 && zoneH >= 20 && state.multiplyZoneSettings?.showLabelOnZone !== false) {
        const label = '×' + (zone.multiplier ?? 1);
        const center = tc({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
        const fontSize = (state.multiplyZoneSettings?.labelSize ?? 14) * env.fontScale;
        ctx.font = fontSize + 'px ' + env.fontFamily;
        const tw = ctx.measureText(label).width;
        const pad = 4;
        const inset = 6;
        const pos = state.multiplyZoneSettings?.labelPosition ?? 'center';
        const { textX, textY, rectX, rectY, textAlign, textBaseline } =
          zoneLabelLayout(pos, center, tl, br, tw, fontSize, pad, inset);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(rectX, rectY, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#2d7a4a';
        ctx.textAlign = textAlign;
        ctx.textBaseline = textBaseline;
        ctx.fillText(label, textX, textY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    (ann.scaleZones || []).forEach((zone) => {
      const minX = Math.min(zone.x1, zone.x2), maxX = Math.max(zone.x1, zone.x2);
      const minY = Math.min(zone.y1, zone.y2), maxY = Math.max(zone.y1, zone.y2);
      const tl = tc({ x: minX, y: minY }), br = tc({ x: maxX, y: maxY });
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#c9a227'; ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1; ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
      const zoneW = br.x - tl.x, zoneH = br.y - tl.y;
      const sc = zone.scale;
      const label = (sc && sc.label) ? sc.label : ((sc && sc.unit) ? ((sc.pixelsPerUnit ? (1 / sc.pixelsPerUnit).toFixed(2) : '?') + ' ' + sc.unit + '/pt') : 'Scale');
      if (zoneW >= 30 && zoneH >= 20 && label && state.scaleZoneSettings?.showLabelOnZone !== false) {
        const center = tc({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
        const fontSize = (state.scaleZoneSettings?.labelSize ?? 14) * env.fontScale;
        ctx.font = fontSize + 'px ' + env.fontFamily;
        const tw = ctx.measureText(label).width;
        const pad = 4;
        const inset = 6;
        // Default top-left (not center): the zone exists to sit over a detail
        // drawing, so the resting label must not cover what's being counted.
        const pos = state.scaleZoneSettings?.labelPosition ?? 'top-left';
        const { textX, textY, rectX, rectY, textAlign, textBaseline } =
          zoneLabelLayout(pos, center, tl, br, tw, fontSize, pad, inset);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(rectX, rectY, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#8a6d1a';
        ctx.textAlign = textAlign;
        ctx.textBaseline = textBaseline;
        ctx.fillText(label, textX, textY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    drawRoomBoxesToContext(ctx, ann, env.pageIdx, tc, env.fontScale);
    (ann.notes || []).forEach(n => {
      if (!n.text) return;
      const pin = env.notePin ? env.notePin(n) : null;
      if (pin) {
        const p = tc({ x: n.x, y: n.y });
        const r = pin.r || 9;
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        if (pin.resolved) {
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = Math.max(1.5, r / 4.5);
          ctx.strokeStyle = pin.color;
          ctx.stroke();
          ctx.fillStyle = pin.color;
        } else {
          ctx.fillStyle = pin.color;
          ctx.fill();
          ctx.lineWidth = Math.max(1, r / 6);
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
        }
        ctx.font = '500 ' + Math.round(r * (pin.num >= 100 ? 0.9 : 1.1)) + 'px DM Sans';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(pin.num), p.x, p.y + 0.5);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
        return;
      }
      const w = n.width || 150;
      const fontSize = n.fontSize || 14;
      const noteScale = env.fontScale;
      const font = (fontSize * noteScale) + 'px ' + env.fontFamily;
      const lineHeight = fontSize * noteScale;
      const { lines } = deps.wrapNoteText(n.text, w * noteScale, font, lineHeight);
      const p = tc({ x: n.x, y: n.y });
      const rot = deps.getNoteRotationRad(n, env.page);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(rot);
      ctx.font = font;
      ctx.fillStyle = n.color || '#e85447';
      ctx.textBaseline = 'top';
      lines.forEach((line, i) => { ctx.fillText(line, 0, i * lineHeight); });
      if (env.drawNoteHandles) {
        ctx.fillStyle = '#666';
        ctx.fillRect(-8 * noteScale - 3, 8 * noteScale - 3, 6, 6);
        ctx.fillRect(w * noteScale - 3, 8 * noteScale - 3, 6, 6);
      }
      ctx.restore();
    });
    const cs = state.counterSettings || { size: 22, opacity: 1, showRings: false, numberSize: 10, ringSize: 1, ringOpacity: 1, ringSolid: true, outlineSize: 0, showOnlyCountersOnCurrentPage: false };
    const s = env.counterSize;
    const opacity = cs.opacity;
    Object.entries(ann.counterMarkers || {}).forEach(([typeId, markers]) => {
      const def = state.counters.find(c => c.id === typeId);
      const iconPath = def ? def.icon : CIRCLE_PATH;
      const color = def ? def.color : '#e8c547';
      const vb = deps.iconRenderVb(iconPath);
      const center = deps.iconRenderCenter(iconPath);
      // "Find this counter" emphasis (features/drop-peek.js): a dark-cased
      // accent halo around EVERY marker of the emphasized type, so one type
      // can be picked out across a busy sheet. Live overlay only (export envs
      // never set the flag). The double stroke reads on both the white plan
      // and dark linework, and is distinct from the type-colored counter
      // rings (cs.showRings) and the line-selection treatment.
      const emphasized = env.emphasizedCounterId != null && env.emphasizedCounterId === typeId;
      markers.forEach((m, i) => {
        const p = tc(m);
        if (emphasized) {
          const haloR = s * 0.75 + 6;
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0,0,0,0.85)';
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
          ctx.strokeStyle = '#e8c547';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.restore();
        }
        if (cs.showRings) {
          const ringScale = (cs.ringSize || 100) / 100;
          const ringSizePx = s * ringScale;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(ringSizePx / 640, ringSizePx / 640);
          ctx.translate(-320, -320);
          ctx.globalAlpha = cs.ringOpacity != null ? cs.ringOpacity : 1;
          if (cs.ringSolid) {
            ctx.fillStyle = color;
            ctx.fill(new Path2D(RING_PATH));
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke(new Path2D(RING_PATH));
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s / vb, s / vb);
        ctx.translate(-center.x, -center.y);
        const path = new Path2D(iconPath);
        const outlineSize = env.counterOutline;
        if (outlineSize > 0) {
          ctx.strokeStyle = '#000';
          ctx.lineWidth = outlineSize * vb / s;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke(path);
        }
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        ctx.fill(path);
        ctx.globalAlpha = 1;
        ctx.restore();
        if (state.showGroupColors && (m.group || null)) {
          const groupColor = deps.getGroupColor(m.group);
          const dotRadius = env.dotRadius;
          const topLeft = { x: p.x - s / 2 + dotRadius, y: p.y - s / 2 + dotRadius };
          ctx.fillStyle = groupColor;
          ctx.beginPath();
          ctx.arc(topLeft.x, topLeft.y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (markers.length > 1) {
          const ns = env.counterNumberSize;
          // 'DM Sans' in both paths — a preserved historical quirk (the other
          // labels use env.fontFamily).
          ctx.fillStyle = '#000'; ctx.font = ns + 'px DM Sans'; ctx.fillText(String(i + 1), p.x + ns * 0.6, p.y - ns * 0.6);
        }
      });
    });
  }

  // --- Ghosts (reference copies) --------------------------------------------
  // A ghost is a translucent copy of a batch of marks, used as a stencil for
  // repeating a "typical" layout. It is drawn ONLY on the live overlay: the
  // export path (renderAnnotationsToContext) never calls this, so ghosts stay
  // off deliverable PDFs the same way the grid overlay does.
  //
  // Every ghost is painted OPAQUE into a scratch buffer and the buffer is
  // blitted once at ghostAlpha. That detour is load-bearing: drawAnnotationsCore
  // resets ctx.globalAlpha to 1 as it paints each kind, so a pre-set alpha on
  // the live context is wiped. Compositing also fades the batch AS A WHOLE —
  // where a ghost line crosses a ghost counter the fade stays even instead of
  // compounding into a dark spot.
  let ghostBuf = null;
  function getGhostBuffer(w, h) {
    if (typeof document === 'undefined') return null;
    if (!ghostBuf) ghostBuf = document.createElement('canvas');
    if (ghostBuf.width !== w || ghostBuf.height !== h) { ghostBuf.width = w; ghostBuf.height = h; }
    else ghostBuf.getContext('2d').clearRect(0, 0, w, h);
    return ghostBuf;
  }
  function drawGhosts(ctx, ann, env) {
    const ghosts = ann?.ghosts || [];
    if (!ghosts.length) return;
    const alpha = env.ghostAlpha != null ? env.ghostAlpha : 0.35;
    const buf = getGhostBuffer(ctx.canvas?.width || 0, ctx.canvas?.height || 0);
    if (!buf || !buf.width) return;
    const bctx = buf.getContext('2d');
    ghosts.forEach(g => {
      // The per-ghost show/hide toggles are applied HERE, by building the
      // payload the core draws — so "hidden" means genuinely not painted, and
      // the same predicate drives ghostBounds and the stamp.
      const payload = {
        counterMarkers: g.showCounters === false ? {} : (g.src?.counterMarkers || {}),
        quickLines: g.showLines === false ? [] : (g.src?.quickLines || []),
        polylines: g.showLines === false ? [] : (g.src?.polylines || []),
        highlights: [], notes: [], multiplyZones: [], scaleZones: [], roomBoxes: [], ghosts: [], legend: null
      };
      drawAnnotationsCore(bctx, payload, { ...env, selection: null, drawNoteHandles: false });
    });
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
    // Outlines are painted on the LIVE context at full strength: the batch is
    // faded, but its handle must not be — you have to see what you are about
    // to grab.
    ghosts.forEach(g => {
      const b = env.ghostBounds ? env.ghostBounds(g) : null;
      if (!b) return;
      const tl = env.tc({ x: b.x1, y: b.y1 }), br = env.tc({ x: b.x2, y: b.y2 });
      const pad = 6 * (env.fontScale || 1);
      const x = Math.min(tl.x, br.x) - pad, y = Math.min(tl.y, br.y) - pad;
      const w = Math.abs(br.x - tl.x) + pad * 2, h = Math.abs(br.y - tl.y) + pad * 2;
      const active = env.ghostActiveId && g.id === env.ghostActiveId;
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeStyle = active ? '#e8c547' : 'rgba(232,197,71,0.55)';
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      const label = g.label || 'Typical';
      const fontSize = 11 * (env.fontScale || 1);
      ctx.font = fontSize + 'px ' + (env.fontFamily || 'DM Sans') + ', sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = active ? 'rgba(232,197,71,0.92)' : 'rgba(20,20,20,0.78)';
      ctx.fillRect(x, y - fontSize - 6, tw + 10, fontSize + 6);
      ctx.fillStyle = active ? '#17171a' : '#e8c547';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 5, y - fontSize / 2 - 3);
      ctx.restore();
    });
  }

  // The legend's row model, shared by drawLegend and the hitTest gate below.
  // Pure over (state, ann, pageIdx) — no ctx, no mutation.
  function computeLegendRows(ann, pageIdx) {
    const state = deps.getState();
    const counterRows = [];
    (state.counters || []).forEach(c => {
      const markers = ann.counterMarkers?.[c.id] || [];
      let effectiveCount = 0;
      markers.forEach(m => { effectiveCount += getMultiplyZoneForPoint(ann, m); });
      if (effectiveCount > 0) counterRows.push({ name: c.name || 'Counter', icon: c.icon || CIRCLE_PATH, color: c.color || '#e8c547', count: effectiveCount, mountHeightIn: c.mountHeightIn, cfm: c.cfm });
    });
    const lineRows = [];
    (state.lineTypes || []).forEach(lt => {
      // T1-05 ft/px split: feet and raw-px lengths accumulate in separate
      // buckets and are never summed under one label (formatFeetPx output is
      // byte-identical to the old formatFeet path when one bucket is zero).
      let lenFt = 0, lenPx = 0;
      const pi = pageIdx >= 0 ? pageIdx : 0;
      (ann.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => {
        const s = deps.getLineLengthSplitForTotals(q, pi, false, ann);
        lenFt += s.feet; lenPx += s.px;
      });
      (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
        const s = deps.getLineLengthSplitForTotals(poly, pi, true, ann);
        lenFt += s.feet; lenPx += s.px;
      });
      if (lenFt > 0 || lenPx > 0) lineRows.push({ name: lt.name || 'Line', color: lt.color || '#4a9eff', lengthStr: formatFeetPx(lenFt, lenPx), feet: lenFt, spec: typeof deps.lineTypeSpecText === 'function' ? (deps.lineTypeSpecText(lt) || '') : '' });
    });
    // Room Sizer rows: per-room volume for this page's boxes (always cubic feet).
    // Toggleable in Legend Settings; on by default — only projects that use the
    // Room Sizer have roomBoxes, so legacy legends are unchanged.
    const roomRows = [];
    if (state.legendSettings?.showRooms !== false) {
      const pi = pageIdx >= 0 ? pageIdx : 0;
      (state.rooms || []).forEach(rm => {
        let vol = 0, area = 0, any = false;
        (ann.roomBoxes || []).filter(b => b.roomId === rm.id).forEach(b => {
          const dims = roomBoxDimsFeet(b, deps.getEffectiveScaleForLine(ann, b, false, pi));
          if (dims) { vol += dims.volumeCuFt; area += dims.areaSqFt || 0; any = true; }
        });
        if (any) roomRows.push({ name: rm.name || 'Room', color: rm.color || '#47c88e', volStr: Math.round(vol) + ' ft³', areaStr: Math.round(area) + ' ft²' });
      });
    }
    // Room air lines (DUCT unit D15 — closing D7's deferral) behind the SAME
    // legendSettings.showDuct gate as the duct rows (no new toggle): one
    // "⚠ Office 101 needs 450 · served 300" line per UNDER-served room on
    // this sheet (D7's ~10% tolerance). The number is cross-page (a room's
    // target is its project-wide area × rate), so it is computed app-side
    // (features/room-sizer.js getRoomBalanceForPage: project target, this
    // page's point-in-rect served sum) and handed in through the deps seam —
    // the core stays pure. Gated on the page having room boxes AND the dep,
    // so duct-free payloads, the node tests and the render-pixels fixture
    // (a room box with no room target → no rows) stay byte-identical.
    const airRows = [];
    if (state.legendSettings?.showDuct !== false && (ann.roomBoxes || []).length
      && typeof deps.getRoomBalanceForPage === 'function') {
      const pi = pageIdx >= 0 ? pageIdx : 0;
      (deps.getRoomBalanceForPage(pi) || []).forEach(b => {
        if (!b || !b.under) return;
        airRows.push({
          name: b.name || 'Room', color: b.color || '#47c88e',
          text: '⚠ ' + (b.name || 'Room') + ' needs ' + Math.round(b.targetCfm).toLocaleString() + ' · served ' + Math.round(b.servedCfm).toLocaleString(),
        });
      });
    }
    // Duct rows (DUCT unit D5, legendSettings.showDuct default ON — the
    // showRooms recipe: only projects that trace duct have ductRuns, so
    // legacy legends are unchanged): per-size "24×12  86' · 597 lb" lines
    // over this page's runs (duct-model tallyStraightBySize, feet via
    // deps.getLineRealWorldLengthFeet — the duct-sidebar glue) plus the
    // all-duct total. Sizes may span airsides, so rows carry one neutral
    // sheet-metal swatch instead of a trade color. Guarded on the duct-model
    // globals + the dep so the node canvas-draw tests (which stub neither)
    // and any duct-free annotation payload stay untouched.
    const ductRows = [];
    if (state.legendSettings?.showDuct !== false && (ann.ductRuns || []).length
      && typeof runStraightItems === 'function' && typeof deps.getLineRealWorldLengthFeet === 'function') {
      const pi = pageIdx >= 0 ? pageIdx : 0;
      const distFt = (a, b) => deps.getLineRealWorldLengthFeet({ points: [a, b] }, pi, true, ann) || 0;
      // One class per row's gauge pick: tally per pressure class, then merge
      // (the duct-schedule composition rule, kept tiny here). D17 (J6-G): a
      // run inside a multiply zone counts × (the line rule, duct-model 3b —
      // guarded so a pre-D17 duct-model still draws).
      const zones = ann.multiplyZones || [];
      const byClass = new Map();
      (ann.ductRuns || []).forEach(run => {
        let items = runStraightItems(run, distFt);
        if (typeof ductRepeatFactorForRun === 'function') items = ductRepeatStraightItems(items, ductRepeatFactorForRun(run, zones));
        const pc = run.pressureClass != null ? String(run.pressureClass) : '1';
        if (!byClass.has(pc)) byClass.set(pc, []);
        byClass.get(pc).push(...items);
      });
      let allFt = 0, allLb = 0;
      byClass.forEach((classItems, pc) => {
        tallyStraightBySize(classItems, pc).rows.forEach(r => {
          ductRows.push({ name: r.sizeKey, color: DUCT_LEGEND_SWATCH, lenStr: Math.round(r.lengthFt).toLocaleString() + "' · " + Math.round(r.pounds).toLocaleString() + ' lb' });
          allFt += r.lengthFt;
          allLb += r.pounds;
        });
      });
      if (ductRows.length) {
        ductRows.sort((a, b) => a.name.localeCompare(b.name));
        ductRows.push({ name: 'All duct', color: DUCT_LEGEND_SWATCH, lenStr: Math.round(allFt).toLocaleString() + "' · " + Math.round(allLb).toLocaleString() + ' lb' });
      }
    }
    return { counterRows, lineRows, roomRows, airRows, ductRows, hasRows: counterRows.length > 0 || lineRows.length > 0 || roomRows.length > 0 || airRows.length > 0 || ductRows.length > 0 };
  }

  // hitTest mirror of the empty-legend gate (B10 / J8): an empty legend is not
  // painted (drawLegend returns before any ink), so the invisible box must not
  // catch the mouse either.
  function legendHasRows(ann, pageIdx) {
    return computeLegendRows(ann, pageIdx).hasRows;
  }

  // The drawn legend header ("This sheet") — the legend tallies CURRENT-PAGE
  // numbers beside project-total surfaces (Summary, footer), so its scope is
  // printed on the legend itself (B10 / J18). Height is in PDF units, scaled
  // like the rows; the text also participates in the auto-width fit.
  const LEGEND_HEADER_TEXT = 'This sheet';
  const LEGEND_HEADER_H_PDF = 12;

  // The sheet legend (2026-09-19): the on-plan legend drawn the way an E-sheet
  // or M-sheet draws its own — a ruled block with a title, the symbol in its
  // own column, the description in caps, and the column the trade reads (mount
  // height for devices, neck · CFM for air). `compact`, the standard for
  // electrical and HVAC projects: one title line, no column header, a spec line
  // only where no column carries the fact (a conduit's conductors, a unit's
  // capacity, a room's area), a footer only when it names a panel or a unit.
  // `full`: the column header, every spec line, the totals footer. `tally`: the
  // original icon · name · [count] list, still the default for plumbing, whose
  // icons are pictures rather than symbols. legendSettings.style is explicit
  // (per project in save/load like the other legend knobs); null = by trade.
  function resolveLegendStyle(state) {
    const s = state.legendSettings && state.legendSettings.style;
    if (s === 'tally' || s === 'compact' || s === 'full') return s;
    return (state.trade === 'electrical' || state.trade === 'hvac') ? 'compact' : 'tally';
  }
  // The legend follows the sheet: an ANSI B sheet (1224 pt on the long side)
  // draws at 1×, a D sheet at about 2×, so a plot reduced to B still reads.
  // Letter-size test pages and the sample sheets stay at 1×.
  const LEGEND_REFERENCE_SHEET_PT = 1224;
  function legendSheetFactor(pageW, pageH) {
    return Math.max(1, Math.min(3, Math.max(pageW || 0, pageH || 0) / LEGEND_REFERENCE_SHEET_PT));
  }
  function legendMountText(inches) {
    return inches > 0 ? Math.round(inches) + '" AFF' : '';
  }
  // The column a row reads: neck · CFM for an air device, the mount height
  // for a mounted one, nothing otherwise.
  function legendMidText(r) {
    if (r.cfm > 0) {
      const neck = typeof deps.suggestNeckSize === 'function' ? deps.suggestNeckSize(r.cfm) : null;
      const cfm = Math.round(r.cfm).toLocaleString();
      return neck && !neck.overCapacity ? neck.neckDIn + '"Ø · ' + cfm : cfm + ' CFM';
    }
    return legendMountText(r.mountHeightIn);
  }
  const LEGEND_INK = '#1a1a1a';
  const LEGEND_HAIRLINE = '#d6d3cb';

  function drawSheetLegend(ctx, page, pageIdx, ann, scale, tc, style, ink, rows) {
    const state = deps.getState();
    const leg = ann.legend;
    const { counterRows, lineRows, roomRows, airRows, ductRows } = rows;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    const pageW = vp.width, pageH = vp.height;
    const legendScale = (state.legendSettings?.legendScale ?? 1) * legendSheetFactor(pageW, pageH);
    const es = scale * legendScale;   // canvas px per legend unit
    const full = style === 'full';
    const F = {
      title: '700 ' + (7 * es) + 'px "DM Sans", sans-serif',
      head: '600 ' + (5.5 * es) + 'px "DM Sans", sans-serif',
      desc: '500 ' + (7 * es) + 'px "DM Sans", sans-serif',
      spec: '400 ' + (5.5 * es) + 'px "DM Sans", sans-serif',
      mid: '400 ' + (6.5 * es) + 'px "DM Sans", sans-serif',
      qty: '700 ' + (7.5 * es) + 'px "DM Sans", sans-serif',
      foot: '500 ' + (5.5 * es) + 'px "DM Sans", sans-serif',
    };
    const trade = typeof deps.getTrade === 'function' ? deps.getTrade() : (state.trade || null);
    const tradeWord = trade === 'electrical' ? 'ELECTRICAL' : trade === 'hvac' ? 'MECHANICAL' : trade === 'plumbing' ? 'PLUMBING' : 'SYMBOL';
    // The scope on the block (B10 / J18): the sheet's own name when it has one, else THIS SHEET.
    const sheetName = page.label && !/\.pdf$/i.test(page.label) ? String(page.label).toUpperCase() : 'THIS SHEET';   // a custom sheet name, never the file name
    const title = tradeWord + ' LEGEND · ' + sheetName;
    // One row per entry: symbol kind, description, optional spec line (compact keeps only the
    // ones no column carries), the mid column, the right-hand figure.
    const entries = [];
    counterRows.forEach(r => entries.push({ kind: 'icon', icon: r.icon, color: r.color, desc: (r.name || '').toUpperCase(), spec: '', mid: legendMidText(r), qty: String(r.count), count: r.count }));
    // Feet read as linear feet on a sheet (34 LF); a mixed ft + px row keeps the tally's split.
    lineRows.forEach(r => entries.push({ kind: 'line', color: r.color, desc: (r.name || '').toUpperCase(), spec: r.spec || '', mid: '', qty: (r.feet > 0 && !/px/.test(r.lengthStr)) ? Math.round(r.feet).toLocaleString() + ' LF' : r.lengthStr, feet: r.feet || 0 }));
    roomRows.forEach(r => entries.push({ kind: 'swatch', color: r.color, desc: (r.name || '').toUpperCase(), spec: '', mid: r.areaStr || '', qty: r.volStr }));   // area in the column, volume on the right: one line per room
    airRows.forEach(r => entries.push({ kind: 'swatch', color: r.color, desc: r.text, spec: '', mid: '', qty: '' }));
    ductRows.forEach(r => entries.push({ kind: 'line', color: r.color, desc: (r.name || '').toUpperCase(), spec: '', mid: '', qty: r.lenStr }));
    const anyMid = entries.some(e => e.mid);
    const anyCfm = counterRows.some(r => r.cfm > 0), anyMount = counterRows.some(r => r.mountHeightIn > 0);
    const midHead = anyCfm && anyMount ? 'MOUNT / CFM' : anyCfm ? 'NECK · CFM' : 'MOUNT';
    // The footer: totals, and the panel or unit the marks belong to.
    const devices = counterRows.reduce((n, r) => n + r.count, 0);
    const feet = lineRows.reduce((n, r) => n + (r.feet || 0), 0);
    const tags = (state.groups || []).filter(g => g.panel || g.equipmentTag).slice(0, 2).map(g => g.panel
      ? 'PANEL ' + g.panel + (g.circuit ? ' · CKT ' + g.circuit : '')
      : String(g.equipmentTag).toUpperCase() + (g.capacityCfm > 0 ? ' · ' + Math.round(g.capacityCfm).toLocaleString() + ' CFM' : ''));
    const footLeft = devices ? devices + (devices === 1 ? ' DEVICE' : ' DEVICES') + (feet > 0 ? ' · ' + Math.round(feet).toLocaleString() + ' LF' : '') : (feet > 0 ? Math.round(feet).toLocaleString() + ' LF' : '');
    const footRight = tags.join(' · ');
    const showFoot = full ? !!(footLeft || footRight) : !!footRight;
    const showHead = full;
    // Layout in legend units (PDF pt at 1×).
    const PAD = 4, SYM_W = 15, GAP = 5, TITLE_H = 11, HEAD_H = 8, ROW_H = 10, SPEC_H = 5, FOOT_H = 9;
    const m = (font, text) => { ctx.font = font; return ctx.measureText(text).width / es; };
    let descW = 0, midW = 0, qtyW = 14;
    entries.forEach(e => {
      descW = Math.max(descW, m(F.desc, e.desc));
      if (e.spec && (full || e.kind !== 'icon')) descW = Math.max(descW, m(F.spec, e.spec));
      if (e.mid) midW = Math.max(midW, m(F.mid, e.mid));
      if (e.qty) qtyW = Math.max(qtyW, m(F.qty, e.qty));
    });
    if (showHead && anyMid) midW = Math.max(midW, m(F.head, midHead));
    const rowH = (e) => ROW_H + ((e.spec && (full || e.kind !== 'icon')) ? SPEC_H : 0);
    const bodyH = entries.reduce((h, e) => h + rowH(e), 0);
    const idealW = Math.max(2 * PAD + m(F.title, title), 2 * PAD + SYM_W + GAP + descW + (anyMid ? GAP + midW : 0) + GAP + qtyW);
    const idealH = PAD + TITLE_H + (showHead ? HEAD_H : 0) + bodyH + (showFoot ? FOOT_H : 0) + PAD;
    // The same anchor walk and clamps as the tally (B10 / J18), in PDF units.
    const idealWidthPdf = idealW * legendScale, idealHeightPdf = idealH * legendScale;
    const minW = 60 * legendScale, minH = 30 * legendScale;
    const wantW = Math.max(minW, idealWidthPdf, leg.userResized ? leg.w : 0);
    const wantH = Math.max(minH, idealHeightPdf, leg.userResized ? leg.h : 0);
    leg.x = Math.max(0, Math.min(leg.x, pageW - wantW - 10));
    leg.y = Math.max(0, Math.min(leg.y, pageH - wantH - 10));
    if (!leg.userResized) {
      leg.w = Math.max(minW, Math.min(idealWidthPdf, pageW - leg.x - 10));
      leg.h = Math.max(minH, Math.min(idealHeightPdf, pageH - leg.y - 10));
    } else {
      leg.w = Math.max(leg.w, Math.min(idealWidthPdf, pageW - leg.x - 10));
      leg.h = Math.max(leg.h, Math.min(idealHeightPdf, pageH - leg.y - 10));
    }
    leg.w = Math.max(minW, Math.min(leg.w, pageW - leg.x - 10));
    leg.h = Math.max(minH, Math.min(leg.h, pageH - leg.y - 10));
    const tl = tc({ x: leg.x, y: leg.y });
    const width = leg.w * scale, height = leg.h * scale;
    const [rr, gg, bb] = hexToRgb(state.legendSettings?.bgColor || '#ffffff');
    ctx.fillStyle = 'rgba(' + rr + ',' + gg + ',' + bb + ',' + (state.legendSettings?.bgOpacity ?? 1) + ')';
    ctx.fillRect(tl.x, tl.y, width, height);
    ctx.save();
    ctx.globalAlpha = state.legendSettings?.textOpacity ?? 1;
    if (state.legendSettings?.showBorder !== false) {
      ctx.strokeStyle = LEGEND_INK;
      ctx.lineWidth = Math.max(1, 1.2 * es);
      ctx.strokeRect(tl.x, tl.y, width, height);
    }
    // The resize grip, as the tally draws it.
    const GRIP_SIZE = 16;
    const brX = tl.x + width - GRIP_SIZE - 4, brY = tl.y + height - GRIP_SIZE - 4;
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const o = 2 + i * 3; ctx.beginPath(); ctx.moveTo(brX + o, brY + GRIP_SIZE); ctx.lineTo(brX + GRIP_SIZE, brY + o); ctx.stroke(); }
    if (state.legendSettings?.showResizeHighlight) {
      const hit = 16 * scale;
      ctx.fillStyle = 'rgba(255, 200, 0, 0.4)'; ctx.fillRect(tl.x + width - hit, tl.y + height - hit, hit, hit);
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)'; ctx.lineWidth = 1; ctx.strokeRect(tl.x + width - hit, tl.y + height - hit, hit, hit);
    }
    const X = (u) => tl.x + u * es, Y = (u) => tl.y + u * es;
    const rule = (yU, color, w) => { ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.5, w * es); ctx.beginPath(); ctx.moveTo(X(PAD), Y(yU)); ctx.lineTo(tl.x + width - PAD * es, Y(yU)); ctx.stroke(); };
    ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = LEGEND_INK;
    let y = PAD;
    // Title
    ctx.font = F.title; ctx.fillText(title, X(PAD), Y(y + 1.5));
    y += TITLE_H; rule(y, LEGEND_INK, 1);
    const descX = PAD + SYM_W + GAP;
    const qtyRight = leg.w / legendScale - PAD;
    const midRight = qtyRight - qtyW - GAP;
    if (showHead) {
      ctx.font = F.head; ctx.fillStyle = '#555';
      ctx.fillText('SYM', X(PAD), Y(y + 1.5)); ctx.fillText('DESCRIPTION', X(descX), Y(y + 1.5));
      ctx.textAlign = 'right';
      if (anyMid) ctx.fillText(midHead, X(midRight), Y(y + 1.5));
      ctx.fillText('QTY', X(qtyRight), Y(y + 1.5));
      ctx.textAlign = 'left';
      y += HEAD_H; rule(y, LEGEND_INK, 0.6);
    }
    entries.forEach((e, i) => {
      const h = rowH(e);
      // symbol column: the icon in its colour on the plan, ink with a colour tab in print
      if (ink) { ctx.fillStyle = e.color; ctx.fillRect(X(PAD), Y(y + 1.5), 1.5 * es, (h - 3) * es); }
      if (e.kind === 'icon') {
        const size = 8.5 * es, vb = deps.iconRenderVb(e.icon), center = deps.iconRenderCenter(e.icon);
        ctx.save();
        ctx.translate(X(PAD + (ink ? 3 : 0) + (SYM_W - (ink ? 3 : 0)) / 2), Y(y + ROW_H / 2));
        ctx.scale(size / vb, size / vb);
        ctx.translate(-center.x, -center.y);
        ctx.fillStyle = ink ? LEGEND_INK : e.color;
        ctx.fill(new Path2D(e.icon));
        ctx.restore();
      } else if (e.kind === 'line') {
        ctx.fillStyle = ink ? LEGEND_INK : e.color;
        ctx.fillRect(X(PAD + (ink ? 3 : 1)), Y(y + ROW_H / 2 - 0.75), (SYM_W - (ink ? 5 : 2)) * es, 1.5 * es);
      } else {
        ctx.fillStyle = ink ? '#ffffff' : e.color;
        ctx.fillRect(X(PAD + (ink ? 4 : 2)), Y(y + 2), (SYM_W - (ink ? 8 : 4)) * es, (ROW_H - 4) * es);
        ctx.strokeStyle = LEGEND_INK; ctx.lineWidth = Math.max(0.5, 0.6 * es);
        ctx.strokeRect(X(PAD + (ink ? 4 : 2)), Y(y + 2), (SYM_W - (ink ? 8 : 4)) * es, (ROW_H - 4) * es);
      }
      ctx.fillStyle = LEGEND_INK; ctx.font = F.desc; ctx.textAlign = 'left';
      ctx.fillText(e.desc, X(descX), Y(y + 1.75));
      if (e.spec && (full || e.kind !== 'icon')) { ctx.font = F.spec; ctx.fillStyle = '#555'; ctx.fillText(e.spec, X(descX), Y(y + ROW_H - 0.5)); ctx.fillStyle = LEGEND_INK; }
      ctx.textAlign = 'right';
      if (e.mid) { ctx.font = F.mid; ctx.fillStyle = '#333'; ctx.fillText(e.mid, X(midRight), Y(y + 2)); ctx.fillStyle = LEGEND_INK; }
      if (e.qty) { ctx.font = F.qty; ctx.fillText(e.qty, X(qtyRight), Y(y + 1.5)); }
      ctx.textAlign = 'left';
      y += h;
      if (i < entries.length - 1) rule(y, LEGEND_HAIRLINE, 0.5);
    });
    if (showFoot) {
      rule(y, LEGEND_INK, 1);
      ctx.font = F.foot; ctx.fillStyle = '#444';
      if (footLeft) ctx.fillText(footLeft, X(PAD), Y(y + 2));
      if (footRight) { ctx.textAlign = 'right'; ctx.fillText(footRight, X(qtyRight), Y(y + 2)); ctx.textAlign = 'left'; }
    }
    ctx.restore();
  }

  // `opts.ink` (the PDF export path): symbols and line samples in ink with a
  // thin colour tab, so the block survives a monochrome plot.
  function drawLegend(ctx, page, pageIdx, ann, scale, tc, opts) {
    const state = deps.getState();
    if (!state.showLegendOverlay || !ann.legend) return;
    const leg = ann.legend;
    const rows = computeLegendRows(ann, pageIdx);
    const { counterRows, lineRows, roomRows, airRows, ductRows, hasRows } = rows;
    // B10 (J8): a zero-mark sheet used to grow a mystery white "No items" box
    // top-right (the overlay defaults on). An empty legend paints nothing at
    // all now; hitTest mirrors the gate via legendHasRows.
    if (!hasRows) return;
    const style = resolveLegendStyle(state);
    if (style !== 'tally') { drawSheetLegend(ctx, page, pageIdx, ann, scale, tc, style, !!(opts && opts.ink), rows); return; }
    const vp0 = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    const legendScale = (state.legendSettings?.legendScale ?? 1) * legendSheetFactor(vp0.width, vp0.height);
    const effectiveScale = scale * legendScale;
    ctx.font = (10 * effectiveScale) + 'px sans-serif';
    let maxTextWidthCanvas = 0;
    counterRows.forEach(r => {
      const w = ctx.measureText((r.name || '') + ' [' + r.count + ']').width;
      if (w > maxTextWidthCanvas) maxTextWidthCanvas = w;
    });
    lineRows.forEach(r => {
      const w = ctx.measureText((r.name || '') + ' ' + r.lengthStr).width;
      if (w > maxTextWidthCanvas) maxTextWidthCanvas = w;
    });
    roomRows.forEach(r => {
      const w = ctx.measureText((r.name || '') + ' ' + r.volStr).width;
      if (w > maxTextWidthCanvas) maxTextWidthCanvas = w;
    });
    airRows.forEach(r => {
      const w = ctx.measureText(r.text).width;
      if (w > maxTextWidthCanvas) maxTextWidthCanvas = w;
    });
    ductRows.forEach(r => {
      const w = ctx.measureText((r.name || '') + ' ' + r.lenStr).width;
      if (w > maxTextWidthCanvas) maxTextWidthCanvas = w;
    });
    // The header participates in the auto-width fit at its own (smaller) font.
    ctx.font = (8 * effectiveScale) + 'px sans-serif';
    const headerWidthCanvas = ctx.measureText(LEGEND_HEADER_TEXT).width;
    const ROW_H_PDF = 14;
    const PAD_PDF = 6;
    const totalRows = counterRows.length + lineRows.length + roomRows.length + airRows.length + ductRows.length;
    const idealHeightPdf = legendScale * (2 * PAD_PDF + LEGEND_HEADER_H_PDF + totalRows * ROW_H_PDF);
    const idealWidthPdf = Math.max(
      legendScale * (24 + 6 + 6) + maxTextWidthCanvas / scale,
      legendScale * (6 + 6) + headerWidthCanvas / scale
    );
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    const pageW = vp.width, pageH = vp.height;
    const minW = 60 * legendScale, minH = 40 * legendScale;
    // B10 (J18): the anchor lives in page coords, so an R rotation (which
    // swaps the sheet's width/height) can leave it past the new edge, and an
    // anchor parked near the right edge starves the box until rows run off
    // the sheet. Walk the anchor left/up until the wanted size fits inside
    // the same 10pt margin the clamps below use — BEFORE sizing, so the box
    // keeps its ideal width whenever the sheet has room for it.
    const wantW = Math.max(minW, idealWidthPdf, leg.userResized ? leg.w : 0);
    const wantH = Math.max(minH, idealHeightPdf, leg.userResized ? leg.h : 0);
    leg.x = Math.max(0, Math.min(leg.x, pageW - wantW - 10));
    leg.y = Math.max(0, Math.min(leg.y, pageH - wantH - 10));
    if (!leg.userResized) {
      leg.w = Math.max(minW, Math.min(idealWidthPdf, pageW - leg.x - 10));
      leg.h = Math.max(minH, Math.min(idealHeightPdf, pageH - leg.y - 10));
    } else {
      leg.w = Math.max(leg.w, Math.min(idealWidthPdf, pageW - leg.x - 10));
      leg.h = Math.max(leg.h, Math.min(idealHeightPdf, pageH - leg.y - 10));
    }
    leg.w = Math.max(minW, Math.min(leg.w, pageW - leg.x - 10));
    leg.h = Math.max(minH, Math.min(leg.h, pageH - leg.y - 10));
    const tl = tc({ x: leg.x, y: leg.y });
    const width = leg.w * scale;
    const height = leg.h * scale;
    const [r, g, b] = hexToRgb(state.legendSettings?.bgColor || '#ffffff');
    const bgOpacity = state.legendSettings?.bgOpacity ?? 1;
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + bgOpacity + ')';
    ctx.fillRect(tl.x, tl.y, width, height);
    ctx.save();
    ctx.globalAlpha = state.legendSettings?.textOpacity ?? 1;
    if (state.legendSettings?.showBorder !== false) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.strokeRect(tl.x, tl.y, width, height);
    }
    const GRIP_SIZE = 16;
    const brX = tl.x + width - GRIP_SIZE - 4;
    const brY = tl.y + height - GRIP_SIZE - 4;
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const o = 2 + i * 3;
      ctx.beginPath();
      ctx.moveTo(brX + o, brY + GRIP_SIZE);
      ctx.lineTo(brX + GRIP_SIZE, brY + o);
      ctx.stroke();
    }
    if (state.legendSettings?.showResizeHighlight) {
      const LEGEND_RESIZE_HIT = 16;
      const hitW = LEGEND_RESIZE_HIT * scale;
      const hitH = LEGEND_RESIZE_HIT * scale;
      const hitX = tl.x + width - hitW;
      const hitY = tl.y + height - hitH;
      ctx.fillStyle = 'rgba(255, 200, 0, 0.4)';
      ctx.fillRect(hitX, hitY, hitW, hitH);
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hitX, hitY, hitW, hitH);
    }
    const ROW_H = 14 * effectiveScale;
    const PAD = 6 * effectiveScale;
    const ICON_SIZE = 14 * effectiveScale;
    const LEFT_COL = 24 * effectiveScale;
    const NAME_START = tl.x + PAD + LEFT_COL;
    ctx.fillStyle = '#333';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    let rowY = tl.y + PAD;
    // Scope header (B10 / J18): small grey "This sheet" above the rows.
    ctx.fillStyle = '#666';
    ctx.font = (8 * effectiveScale) + 'px sans-serif';
    ctx.fillText(LEGEND_HEADER_TEXT, tl.x + PAD, rowY);
    rowY += LEGEND_HEADER_H_PDF * effectiveScale;
    ctx.font = (10 * effectiveScale) + 'px sans-serif';
    counterRows.forEach(r => {
      const center = deps.iconRenderCenter(r.icon);
      const vb = deps.iconRenderVb(r.icon);
      ctx.save();
      const ICON_OFFSET_X = 6.5 * effectiveScale;
      const ICON_OFFSET_Y = 4.5 * effectiveScale;
      ctx.translate(tl.x + PAD + (LEFT_COL - ICON_SIZE) / 2 + ICON_OFFSET_X, rowY + (ROW_H - ICON_SIZE) / 2 + ICON_OFFSET_Y);
      ctx.scale(ICON_SIZE / vb, ICON_SIZE / vb);
      ctx.translate(-center.x, -center.y);
      const path = new Path2D(r.icon);
      ctx.fillStyle = r.color;
      ctx.fill(path);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = vb / ICON_SIZE;
      ctx.stroke(path);
      ctx.restore();
      ctx.fillStyle = '#000';
      ctx.fillText((r.name || '') + ' [' + r.count + ']', NAME_START, rowY);
      rowY += ROW_H;
    });
    lineRows.forEach(r => {
      ctx.fillStyle = r.color;
      const SWATCH_H = 3 * effectiveScale;
      const swatchY = rowY + 1 + (ROW_H - SWATCH_H) / 4;
      ctx.fillRect(tl.x + PAD + (LEFT_COL - 20 * effectiveScale) / 2, swatchY, 20 * effectiveScale, SWATCH_H);
      ctx.fillStyle = '#000';
      ctx.fillText((r.name || '') + ' ' + r.lengthStr, NAME_START, rowY);
      rowY += ROW_H;
    });
    roomRows.forEach(r => {
      ctx.fillStyle = r.color;
      const SWATCH = 8 * effectiveScale;
      ctx.fillRect(tl.x + PAD + (LEFT_COL - SWATCH) / 2, rowY + (ROW_H - SWATCH) / 2, SWATCH, SWATCH);
      ctx.fillStyle = '#000';
      ctx.fillText((r.name || '') + ' ' + r.volStr, NAME_START, rowY);
      rowY += ROW_H;
    });
    // Room air lines (D15): the room-row look (the room's swatch) with the
    // "⚠ Office 101 needs 450 · served 300" text — under-served rooms only.
    airRows.forEach(r => {
      ctx.fillStyle = r.color;
      const SWATCH = 8 * effectiveScale;
      ctx.fillRect(tl.x + PAD + (LEFT_COL - SWATCH) / 2, rowY + (ROW_H - SWATCH) / 2, SWATCH, SWATCH);
      ctx.fillStyle = '#000';
      ctx.fillText(r.text, NAME_START, rowY);
      rowY += ROW_H;
    });
    // Duct rows (D5): the line-row look with the neutral sheet-metal swatch —
    // per-size "24×12 86' · 597 lb" lines, then the "All duct" total.
    ductRows.forEach(r => {
      ctx.fillStyle = r.color;
      const SWATCH_H = 3 * effectiveScale;
      const swatchY = rowY + 1 + (ROW_H - SWATCH_H) / 4;
      ctx.fillRect(tl.x + PAD + (LEFT_COL - 20 * effectiveScale) / 2, swatchY, 20 * effectiveScale, SWATCH_H);
      ctx.fillStyle = '#000';
      ctx.fillText((r.name || '') + ' ' + r.lenStr, NAME_START, rowY);
      rowY += ROW_H;
    });
    ctx.restore();
  }

  function drawGrid(ctx, page, pageIdx, scale, toCanvas) {
    const state = deps.getState();
    if (!state.showGridOverlay || !state.gridSettings?.spacing) return;
    const pageScale = deps.getPageScale(pageIdx >= 0 ? pageIdx : 0);
    if (!pageScale) return;
    const gs = state.gridSettings;
    const spacingX = gs.spacing * pageScale.pixelsPerUnit;
    const spacingY = gs.spacing * pageScale.pixelsPerUnit;
    const offsetXPdf = (gs.offsetX ?? 0) * pageScale.pixelsPerUnit;
    const offsetYPdf = (gs.offsetY ?? 0) * pageScale.pixelsPerUnit;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    const pageW = vp.width, pageH = vp.height;
    const opacity = gs.opacity ?? 0.35;
    const [r, g, b] = hexToRgb(gs.color || '#e8c547');
    const lineWidth = gs.lineWidth ?? 1;
    const lineStyle = gs.lineStyle || 'solid';
    const majorInterval = (gs.majorInterval != null && gs.majorInterval > 0) ? gs.majorInterval : null;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    const drawLine = (x1, y1, x2, y2, isMajor) => {
      ctx.beginPath();
      ctx.lineWidth = isMajor ? lineWidth * 2 : lineWidth;
      ctx.setLineDash(isMajor ? [] : lineStyleToDash(lineStyle));
      const a = toCanvas({ x: x1, y: y1 });
      const b = toCanvas({ x: x2, y: y2 });
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    let vIdx = 0;
    for (let x = offsetXPdf - spacingX, vi = -1; x >= 0; x -= spacingX, vi--) {
      drawLine(x, 0, x, pageH, majorInterval && Math.abs(vi) % majorInterval === 0);
    }
    for (let x = offsetXPdf; x <= pageW; x += spacingX, vIdx++) {
      drawLine(x, 0, x, pageH, majorInterval && vIdx % majorInterval === 0);
    }
    let hIdx = 0;
    for (let y = offsetYPdf - spacingY, hi = -1; y >= 0; y -= spacingY, hi--) {
      drawLine(0, y, pageW, y, majorInterval && Math.abs(hi) % majorInterval === 0);
    }
    for (let y = offsetYPdf; y <= pageH; y += spacingY, hIdx++) {
      drawLine(0, y, pageW, y, majorInterval && hIdx % majorInterval === 0);
    }
    ctx.restore();
  }

  return {
    drawRoomBoxesToContext,
    drawAnnotationsCore,
    drawGhosts,
    drawLegend,
    legendHasRows, planRoomLabels,
    resolveLegendStyle, legendSheetFactor,
    computeLegendRows,   // D17 spec seam (App.legendRowsFor) — the rows the legend paints
    drawGrid,
  };
}

// Dual-env export so canvas-draw.test.js can require() the module under
// `node --test`; inert in the browser (classic script).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createCanvasDraw, drawDropMarker, drawBendFittingChips, hexToRgb, lineStyleToDash, DUCT_AIRSIDE_COLORS, DUCT_VERTICAL_COLOR, DUCT_GHOST_ALPHA, DUCT_GHOST_MIN_PX, ductPxPerPdfPt, ductGhostWidthPx };
}
