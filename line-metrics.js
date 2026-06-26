/*
 * line-metrics.js - Pure line-length / scale math for ClickCount, extracted from
 * the main app.js IIFE.
 *
 * Loaded as a classic <script src="line-metrics.js"> in <head>, AFTER geometry.js
 * (whose ptDist / polylineDistance / getQuadraticBezierControlPoint /
 * quadraticBezierLength / getScaleZoneForLine / getMultiplyZoneForLine globals it
 * reads by bare name) and BEFORE app.js. These top-level declarations live in the
 * shared global lexical scope.
 *
 * Boundary rule: this module depends ONLY on geometry.js globals + its arguments.
 * Everything state-coupled (the per-page scale, the line's resolved line-type,
 * the project's pages array) is injected by the caller. The live state reads and
 * the published window.* API (quickLineLength / getLineLengthPdfPts /
 * getEffectiveScaleForLine / getLineRealWorldLength / getLineLengthForTotals /
 * pickScaleForLineType, consumed by report.js) stay in app.js as same-named thin
 * wrappers that resolve scale / lineType / pages from `state` and delegate to the
 * distinctly-named pure primitives exported here (same pure-primitives +
 * thin-wrappers split as idb.js / icon-render.js). No build step.
 */

  // Arc-aware length of a single quick-line segment in PDF points. `lineType` is
  // the resolved line-type object (or null); only its `curveStyle` is read.
  function lineSegmentLength(q, lineType) {
    if (lineType && lineType.curveStyle === 'arc') {
      const a = { x: q.x1, y: q.y1 }, b = { x: q.x2, y: q.y2 };
      const ctrl = getQuadraticBezierControlPoint(a, b, 1);
      return quadraticBezierLength(a, ctrl, b);
    }
    return ptDist({ x: q.x1, y: q.y1 }, { x: q.x2, y: q.y2 });
  }

  // Raw geometric length in PDF points (no drops), poly- or single-segment.
  function lineGeomPdfPts(line, isPoly, lineType) {
    return isPoly ? polylineDistance(line.points || [], line.closed) : lineSegmentLength(line, lineType);
  }

  // Geometric length plus the start/end drop contribution (drops are in
  // real-world units, converted to PDF points via the page scale's pixelsPerUnit).
  function lineLengthPdfPts(line, isPoly, scale, lineType) {
    const base = isPoly
      ? polylineDistance(line.points || [], line.closed)
      : lineSegmentLength(line, lineType);
    if (!scale || ((line.startDrop || 0) === 0 && (line.endDrop || 0) === 0))
      return base;
    const ppu = scale.pixelsPerUnit;
    // Each drop is entered in its own unit (line.startDropUnit/endDropUnit); convert
    // to the effective scale's unit before adding. A missing unit defaults to the
    // scale unit (= legacy behaviour, no conversion).
    const su = scale.unit;
    const sd = convertUnitValue(line.startDrop || 0, line.startDropUnit || su, su);
    const ed = convertUnitValue(line.endDrop || 0, line.endDropUnit || su, su);
    const dropPts = (sd + ed) * ppu;
    return base + dropPts;
  }

  // The scale a line should use: a scale-zone override if the line falls inside
  // one, else the injected page scale.
  function effectiveScaleForLine(ann, line, isPoly, pageScale) {
    const sz = getScaleZoneForLine(ann, line, isPoly);
    if (sz && sz.scale) return sz.scale;
    return pageScale;
  }

  // Real-world length: geometric PDF-points divided by the effective scale, plus
  // the raw drop length. Falls back to PDF points when there is no usable scale.
  function lineRealWorldLength(line, isPoly, ann, pageScale, lineType) {
    const base = lineGeomPdfPts(line, isPoly, lineType);
    const eff = effectiveScaleForLine(ann, line, isPoly, pageScale);
    if (!eff || !eff.pixelsPerUnit) return base;
    // Each drop is entered in its own unit; convert to the effective scale's unit
    // before adding. A missing unit defaults to the scale unit (legacy behaviour).
    const su = eff.unit;
    const sd = convertUnitValue(line.startDrop || 0, line.startDropUnit || su, su);
    const ed = convertUnitValue(line.endDrop || 0, line.endDropUnit || su, su);
    return base / eff.pixelsPerUnit + sd + ed;
  }

  // Real-world length scaled by the line's multiply-zone factor (1 when none).
  function lineLengthForTotals(line, isPoly, ann, pageScale, lineType) {
    const mult = typeof getMultiplyZoneForLine === 'function' ? getMultiplyZoneForLine(ann, line, isPoly) : 1;
    return lineRealWorldLength(line, isPoly, ann, pageScale, lineType) * mult;
  }

  // Same total length, but converted to FEET so tallies can sum lines across pages of
  // differing scale units correctly and display one consistent unit. Converts via the
  // line's effective scale unit; returns the raw value (PDF-pts) when there is no scale.
  function lineLengthFeetForTotals(line, isPoly, ann, pageScale, lineType) {
    const len = lineLengthForTotals(line, isPoly, ann, pageScale, lineType);
    const eff = effectiveScaleForLine(ann, line, isPoly, pageScale);
    return (eff && eff.unit) ? convertUnitValue(len, eff.unit, 'ft') : len;
  }

  // Pick a representative scale across the given page indices: first a preferred
  // unit in priority order, else any scaled page, else page 0's scale.
  function scaleForLineType(pageIndices, pages) {
    const preferredUnits = ['ft', 'in', 'm', 'cm', 'yd'];
    for (const u of preferredUnits) {
      for (const pi of pageIndices) {
        const scale = pages[pi]?.scale;
        if (scale && scale.unit === u) return scale;
      }
    }
    for (const pi of pageIndices) {
      const scale = pages[pi]?.scale;
      if (scale) return scale;
    }
    return pages[0]?.scale ?? null;
  }

  // Node test harness only: in a classic browser <script> `module` is undefined,
  // so this is a no-op there and the declarations above stay plain globals.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      lineSegmentLength,
      lineGeomPdfPts,
      lineLengthPdfPts,
      effectiveScaleForLine,
      lineRealWorldLength,
      lineLengthForTotals,
      lineLengthFeetForTotals,
      scaleForLineType,
    };
  }
