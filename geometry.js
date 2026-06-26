/*
 * geometry.js - Pure math/geometry/parse primitives for ClickCount, extracted
 * verbatim from index.html.
 *
 * Loaded as a classic <script src="geometry.js"> in <head>, BEFORE the main IIFE.
 * These top-level function declarations live in the shared global lexical scope,
 * so the main script in index.html resolves them by bare name, and report.js
 * (loaded after) resolves them as window.* properties.
 *
 * Everything here is context-free: no reference to `state` or any closure-scoped
 * helper. State-coupled length/format/zone logic stays in index.html and calls
 * these primitives by bare name. No build step.
 */

  // Distance & geometry primitives
  function ptDist(a, b) { return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2); }
  function snapToHorizontalOrVertical(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const deg = (angle * 180 / Math.PI + 360) % 360;
    const distToHorizontal = Math.min(deg, Math.abs(deg - 180));
    const distToVertical = Math.min(Math.abs(deg - 90), Math.abs(deg - 270));
    const toHorizontal = distToHorizontal < distToVertical;
    return toHorizontal ? { x: x2, y: y1 } : { x: x1, y: y2 };
  }
  function polylineDistance(pts, closed) {
    if (!pts || !Array.isArray(pts)) return 0;
    let d = 0;
    for (let i = 0; i < pts.length - 1; i++) d += ptDist(pts[i], pts[i + 1]);
    if (closed && pts.length >= 3) d += ptDist(pts[pts.length - 1], pts[0]);
    return d;
  }
  function polygonArea(pts) {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return Math.abs(sum) / 2;
  }
  function distToSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return ptDist(p, a);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len);
    t = Math.max(0, Math.min(1, t));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    return ptDist(p, q);
  }
  function getQuadraticBezierControlPoint(a, b, dir) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const offset = len * 0.15 * (dir || 1);
    const perpX = -dy / len, perpY = dx / len;
    return { x: mid.x + perpX * offset, y: mid.y + perpY * offset };
  }
  function quadraticBezierPoint(t, p0, p1, p2) {
    return { x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x, y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y };
  }
  function quadraticBezierLength(p0, p1, p2) {
    let len = 0, prev = p0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      const pt = quadraticBezierPoint(t, p0, p1, p2);
      len += ptDist(prev, pt);
      prev = pt;
    }
    return len;
  }
  function distToQuadraticBezier(pos, p0, p1, p2) {
    let minD = ptDist(pos, p0);
    let prev = p0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      const pt = quadraticBezierPoint(t, p0, p1, p2);
      minD = Math.min(minD, distToSegment(pos, prev, pt));
      prev = pt;
    }
    return Math.min(minD, ptDist(pos, p2));
  }
  function rotatePoint90CW(p, w, h) { return { x: h - p.y, y: p.x }; }

  // Rectangle hit-testing
  function pointInRect(p, x1, y1, x2, y2) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  }
  function rectsOverlap(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    const aMinX = Math.min(ax1, ax2), aMaxX = Math.max(ax1, ax2);
    const aMinY = Math.min(ay1, ay2), aMaxY = Math.max(ay1, ay2);
    const bMinX = Math.min(bx1, bx2), bMaxX = Math.max(bx1, bx2);
    const bMinY = Math.min(by1, by2), bMaxY = Math.max(by1, by2);
    return aMinX <= bMaxX && aMaxX >= bMinX && aMinY <= bMaxY && aMaxY >= bMinY;
  }

  // Zone locators (operate on a passed-in annotation object)
  function getMultiplyZoneForPoint(ann, p) {
    const zones = ann?.multiplyZones || [];
    for (const z of zones) {
      if (pointInRect(p, z.x1, z.y1, z.x2, z.y2)) return z.multiplier;
    }
    return 1;
  }
  function getMultiplyZoneForLine(ann, line, isPoly) {
    const zones = ann?.multiplyZones || [];
    const start = isPoly ? (line.points?.[0] || { x: 0, y: 0 }) : { x: line.x1, y: line.y1 };
    const end = isPoly ? (line.points?.[line.points?.length - 1] || { x: 0, y: 0 }) : { x: line.x2, y: line.y2 };
    for (const z of zones) {
      if (pointInRect(start, z.x1, z.y1, z.x2, z.y2) && pointInRect(end, z.x1, z.y1, z.x2, z.y2)) return z.multiplier;
    }
    return 1;
  }
  function getScaleZoneForLine(ann, line, isPoly) {
    const zones = ann?.scaleZones || [];
    const start = isPoly ? (line.points?.[0] || { x: 0, y: 0 }) : { x: line.x1, y: line.y1 };
    const end = isPoly ? (line.points?.[line.points?.length - 1] || { x: 0, y: 0 }) : { x: line.x2, y: line.y2 };
    for (const z of zones) {
      if (z.scale && pointInRect(start, z.x1, z.y1, z.x2, z.y2) && pointInRect(end, z.x1, z.y1, z.x2, z.y2)) return z;
    }
    return null;
  }

  // Parse & format primitives
  function formatLineLengthRealSum(realSum, scale) {
    if (scale && scale.pixelsPerUnit) return realSum.toFixed(2) + ' ' + (scale.unit || '');
    if (realSum === 0) return '0';
    return Math.round(realSum) + ' px';
  }
  // Format an already-in-feet length as decimal feet. Used by every takeoff tally so
  // line lengths read identically everywhere ("12.50 ft") regardless of the page's
  // scale unit. `val` must already be converted to feet (see lineLengthFeetForTotals);
  // when there is no scale we fall back to the pixel display the other formatters use.
  function formatFeet(val, scale) {
    if (!scale) return val > 0 ? Math.round(val) + ' px' : '0';
    return val.toFixed(2) + ' ft';
  }
  function parseRealWorldLength(str, unit) {
    const s = String(str || '').trim();
    if (!s) return null;
    if (unit === 'ft' || unit === 'in') {
      const m = s.match(/^(-?\d+(?:\.\d+)?)\s*[''-]?\s*(?:(\d+)\s*[""]?)?$/);
      if (m) {
        const ft = parseFloat(m[1]);
        const inPart = m[2] ? parseInt(m[2], 10) : 0;
        if (unit === 'ft') return ft + inPart / 12;
        return ft * 12 + inPart;
      }
    }
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  function parseFraction(str) {
    const s = String(str || '').trim();
    if (!s) return null;
    const frac = s.match(/^(\d+)\/(\d+)$/);
    if (frac) {
      const num = parseInt(frac[1], 10);
      const den = parseInt(frac[2], 10);
      if (den === 0) return null;
      const val = num / den;
      return val > 0 ? val : null;
    }
    const n = parseFloat(s);
    return (n > 0 && !isNaN(n)) ? n : null;
  }
  // Compact "time ago" label from a seconds delta.
  function formatAgo(agoSec) {
    if (agoSec >= 86400) return Math.floor(agoSec / 86400) + 'd ago';
    if (agoSec >= 3600) return Math.floor(agoSec / 3600) + 'hr ago';
    if (agoSec >= 60) return Math.floor(agoSec / 60) + 'min ago';
    return 'Just now';
  }
  // Format a real-world value into feet-inches (ft/in/yd) or a decimal fallback for other units.
  function formatFeetInchesFromVal(val, unit) {
    if (unit === 'ft') {
      let ft = Math.floor(val);
      let inches = Math.round((val - ft) * 12);
      if (inches >= 12) { inches = 0; ft++; }
      return ft + "'-" + inches + '"';
    }
    if (unit === 'in') {
      const totalIn = val;
      if (totalIn >= 12) {
        let ft = Math.floor(totalIn / 12);
        let inches = Math.round(totalIn - ft * 12);
        if (inches >= 12) { inches = 0; ft++; }
        return ft + "'-" + inches + '"';
      }
      return Math.round(totalIn) + '"';
    }
    if (unit === 'yd') {
      const valFt = val * 3;
      let ft = Math.floor(valFt);
      let inches = Math.round((valFt - ft) * 12);
      if (inches >= 12) { inches = 0; ft++; }
      return ft + "'-" + inches + '"';
    }
    return (val).toFixed(2) + ' ' + unit;
  }

  // Format a PDF-point distance into a decimal real-world length using a scale
  // object ({ pixelsPerUnit, unit }); falls back to pixels when scale is absent.
  // (The state-derived default scale is resolved by callers, not here.)
  function formatDist(pdfPts, scale) {
    if (!scale) return Math.round(pdfPts) + ' px';
    return (pdfPts / scale.pixelsPerUnit).toFixed(2) + ' ' + scale.unit;
  }
  // Format a PDF-point distance into feet-inches via formatFeetInchesFromVal.
  function formatDistFeetInches(pdfPts, scale) {
    if (!scale) return Math.round(pdfPts) + ' px';
    const val = pdfPts / scale.pixelsPerUnit;
    return formatFeetInchesFromVal(val, scale.unit);
  }
  // Format an already-real-world value into feet-inches.
  function formatDistFeetInchesFromReal(val, scale) {
    if (!scale) return Math.round(val) + ' px';
    return formatFeetInchesFromVal(val, scale.unit);
  }
  // Format a squared-PDF-point area into real-world area (unit squared).
  function formatArea(sqPdfPts, scale) {
    if (!scale) return Math.round(sqPdfPts) + ' px²';
    const ppu = scale.pixelsPerUnit;
    return (sqPdfPts / (ppu * ppu)).toFixed(1) + ' ' + scale.unit + '²';
  }

  // Largest device-pixel-ratio we can render the page bitmap at without the canvas
  // buffer (pageW*zoom*eff × pageH*zoom*eff device px) exceeding the browser's max
  // canvas dimension/area — past which the canvas silently renders blank/black.
  // Because dpr only affects bitmap sharpness (it cancels out of every on-screen
  // size), clamping it keeps layout/positions/fonts identical and only softens the
  // bitmap beyond the cap. Never returns more than the real dpr; floored above 0.
  function clampEffectiveDpr({ pageW, pageH, zoom, dpr, maxDim, maxArea }) {
    const w = pageW * zoom, h = pageH * zoom;   // CSS px — independent of the effDpr we pick
    if (!(w > 0) || !(h > 0)) return Math.max(0.01, dpr);
    const eff = Math.min(dpr, maxDim / w, maxDim / h, Math.sqrt(maxArea / (w * h)));
    return Math.max(0.01, Math.min(eff, dpr));
  }

  // Convert a length value between the units the app's Set Scale supports
  // (ft/in/m/cm/yd) via a metres base. Unknown or identical units are a no-op,
  // so a missing drop unit safely falls back to "same as the scale unit".
  const UNIT_TO_M = { ft: 0.3048, in: 0.0254, yd: 0.9144, m: 1, cm: 0.01 };
  function convertUnitValue(val, fromUnit, toUnit) {
    const f = UNIT_TO_M[fromUnit], t = UNIT_TO_M[toUnit];
    if (!f || !t || f === t) return val;
    return val * (f / t);
  }

  // Node test harness only: in a classic browser <script> `module` is undefined,
  // so this is a no-op there and the declarations above stay plain globals.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ptDist, snapToHorizontalOrVertical, polylineDistance, polygonArea, distToSegment,
      getQuadraticBezierControlPoint, quadraticBezierPoint, quadraticBezierLength, distToQuadraticBezier,
      rotatePoint90CW, pointInRect, rectsOverlap,
      getMultiplyZoneForPoint, getMultiplyZoneForLine, getScaleZoneForLine,
      formatLineLengthRealSum, formatFeet, parseRealWorldLength, parseFraction,
      formatAgo, formatFeetInchesFromVal,
      formatDist, formatDistFeetInches, formatDistFeetInchesFromReal, formatArea,
      clampEffectiveDpr, convertUnitValue
    };
  }
