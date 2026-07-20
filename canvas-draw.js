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
//   drawNoteHandles   live-only note resize/rotate handle squares
// Zone chrome (stroke 2, dash [6,4], label pad 4, inset 6, the 30x20 min-size
// threshold) is deliberately raw in BOTH paths (does not scale on export) —
// a preserved historical quirk, not an omission.
//
// The top-level functions below (drawDropMarker, hexToRgb, lineStyleToDash)
// are pure — no state/deps — and are read by app.js by bare name like the
// geometry primitives. Guarded CommonJS footer so canvas-draw.test.js can
// `require()` the module under `node --test`.

// Drop marker glyph at the start/end of a line with a drop length — style is
// lineTypeSettings.dropIconStyle ('circle' | 'plus' | 'diamond' | 'triangle' |
// default X), s the half-size in canvas px. Black outer stroke, colored inner.
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

function createCanvasDraw(deps) {
  // Room Sizer boxes, shared by the live overlay and the export path (the two
  // callers differ only in their PDF->canvas mapper and label scale factor).
  // Boxes render in their room's color with a name + W×L×H label; a box whose
  // page (or containing scale zone) has no scale gets an explicit "no scale"
  // label instead of silently wrong numbers.
  function drawRoomBoxesToContext(ctx, ann, pageIdx, tcFn, fontScale) {
    const state = deps.getState();
    (ann.roomBoxes || []).forEach(b => {
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
      const nameLabel = room?.name || 'Room';
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
      const drawDrop = (p) => drawDropMarker(ctx, p, env.dropSize, q.color || '#4a9eff', env.dropStyle);
      if ((q.startDrop || 0) > 0) drawDrop(a);
      if ((q.endDrop || 0) > 0) drawDrop(b);
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
      const drawDrop = (p) => drawDropMarker(ctx, p, env.dropSize, poly.color || '#4a9eff', env.dropStyle);
      if ((poly.startDrop || 0) > 0 && pts.length > 0) drawDrop(tc(pts[0]));
      if ((poly.endDrop || 0) > 0 && pts.length > 0) drawDrop(tc(pts[pts.length - 1]));
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
    (ann.highlights || []).forEach(h => {
      const minX = Math.min(h.x1, h.x2), maxX = Math.max(h.x1, h.x2);
      const minY = Math.min(h.y1, h.y2), maxY = Math.max(h.y1, h.y2);
      const tl = tc({ x: minX, y: minY }), br = tc({ x: maxX, y: maxY });
      ctx.fillStyle = h.color || '#e8c547'; ctx.globalAlpha = h.opacity != null ? h.opacity : 0.25;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1;
    });
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
        let textX, textY, rectX, rectY, textAlign, textBaseline;
        if (pos === 'center') {
          textX = center.x; textY = center.y; textAlign = 'center'; textBaseline = 'middle';
          rectX = center.x - tw / 2 - pad; rectY = center.y - fontSize / 2 - pad;
        } else if (pos === 'top-left') {
          textX = tl.x + inset; textY = tl.y + inset; textAlign = 'left'; textBaseline = 'top';
          rectX = textX; rectY = textY;
        } else if (pos === 'top-right') {
          textX = br.x - inset; textY = tl.y + inset; textAlign = 'right'; textBaseline = 'top';
          rectX = textX - tw - pad * 2; rectY = textY;
        } else if (pos === 'bottom-left') {
          textX = tl.x + inset; textY = br.y - inset; textAlign = 'left'; textBaseline = 'bottom';
          rectX = textX; rectY = textY - fontSize - pad;
        } else {
          textX = br.x - inset; textY = br.y - inset; textAlign = 'right'; textBaseline = 'bottom';
          rectX = textX - tw - pad * 2; rectY = textY - fontSize - pad;
        }
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
      if (zoneW >= 30 && zoneH >= 20 && label) {
        const center = tc({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
        const fontSize = (state.multiplyZoneSettings?.labelSize ?? 14) * env.fontScale;
        ctx.font = fontSize + 'px ' + env.fontFamily;
        const tw = ctx.measureText(label).width;
        const pad = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(center.x - tw / 2 - pad, center.y - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2);
        ctx.fillStyle = '#8a6d1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, center.x, center.y);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    });
    drawRoomBoxesToContext(ctx, ann, env.pageIdx, tc, env.fontScale);
    (ann.notes || []).forEach(n => {
      if (!n.text) return;
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
      markers.forEach((m, i) => {
        const p = tc(m);
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

  function drawLegend(ctx, page, pageIdx, ann, scale, tc) {
    const state = deps.getState();
    if (!state.showLegendOverlay || !ann.legend) return;
    const leg = ann.legend;
    const legendScale = state.legendSettings?.legendScale ?? 1;
    const effectiveScale = scale * legendScale;
    const pageScale = deps.getPageScale(pageIdx >= 0 ? pageIdx : 0);
    const counterRows = [];
    (state.counters || []).forEach(c => {
      const markers = ann.counterMarkers?.[c.id] || [];
      let effectiveCount = 0;
      markers.forEach(m => { effectiveCount += getMultiplyZoneForPoint(ann, m); });
      if (effectiveCount > 0) counterRows.push({ name: c.name || 'Counter', icon: c.icon || CIRCLE_PATH, color: c.color || '#e8c547', count: effectiveCount });
    });
    const lineRows = [];
    (state.lineTypes || []).forEach(lt => {
      let lenReal = 0;
      const pi = pageIdx >= 0 ? pageIdx : 0;
      (ann.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => {
        lenReal += deps.getLineLengthFeetForTotals(q, pi, false, ann);
      });
      (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
        lenReal += deps.getLineLengthFeetForTotals(poly, pi, true, ann);
      });
      if (lenReal > 0) lineRows.push({ name: lt.name || 'Line', color: lt.color || '#4a9eff', lengthStr: formatFeet(lenReal, pageScale) });
    });
    // Room Sizer rows: per-room volume for this page's boxes (always cubic feet).
    // Toggleable in Legend Settings; on by default — only projects that use the
    // Room Sizer have roomBoxes, so legacy legends are unchanged.
    const roomRows = [];
    if (state.legendSettings?.showRooms !== false) {
      const pi = pageIdx >= 0 ? pageIdx : 0;
      (state.rooms || []).forEach(rm => {
        let vol = 0, any = false;
        (ann.roomBoxes || []).filter(b => b.roomId === rm.id).forEach(b => {
          const dims = roomBoxDimsFeet(b, deps.getEffectiveScaleForLine(ann, b, false, pi));
          if (dims) { vol += dims.volumeCuFt; any = true; }
        });
        if (any) roomRows.push({ name: rm.name || 'Room', color: rm.color || '#47c88e', volStr: Math.round(vol) + ' ft³' });
      });
    }
    const hasRows = counterRows.length > 0 || lineRows.length > 0 || roomRows.length > 0;
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
    const ROW_H_PDF = 14;
    const PAD_PDF = 6;
    const totalRows = counterRows.length + lineRows.length + roomRows.length;
    const idealHeightPdf = legendScale * (hasRows ? (2 * PAD_PDF + totalRows * ROW_H_PDF) : 40);
    const idealWidthPdf = hasRows ? (legendScale * (24 + 6 + 6) + maxTextWidthCanvas / scale) : legendScale * 80;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    const pageW = vp.width, pageH = vp.height;
    const minW = 60 * legendScale, minH = 40 * legendScale;
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
    if (!hasRows) {
      ctx.fillStyle = '#666';
      ctx.fillText('No items', tl.x + PAD, rowY);
      ctx.restore();
      return;
    }
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
    drawLegend,
    drawGrid,
  };
}

// Dual-env export so canvas-draw.test.js can require() the module under
// `node --test`; inert in the browser (classic script).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createCanvasDraw, drawDropMarker, hexToRgb, lineStyleToDash };
}
