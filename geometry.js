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
  /*
   * The 8 snap rays at 45° increments, starting east and going clockwise in PDF
   * space (y grows downward). Deliberately INTEGER direction vectors rather than
   * unit vectors: projecting with `(d·v)/|v|²` over these exact small integers is
   * exact in floating point, so a vertical snap yields x1 unchanged and a 45° one
   * yields exactly (t, t). Unit vectors would route through cos/sin — cos(90°) is
   * 6.1e-17, not 0, and √½·√½ is 0.5000000000000001 — sprinkling 1e-15 offsets
   * into stored PDF-space annotations and leaving "vertical" lines a hair off.
   */
  const SNAP_DIRS = [
    { x: 1, y: 0 },     // 0°   E
    { x: 1, y: 1 },     // 45°
    { x: 0, y: 1 },     // 90°  S
    { x: -1, y: 1 },    // 135°
    { x: -1, y: 0 },    // 180° W
    { x: -1, y: -1 },   // 225°
    { x: 0, y: -1 },    // 270° N
    { x: 1, y: -1 },    // 315°
  ];
  /*
   * Constrain the segment (x1,y1)->(x2,y2) to the nearest snap ray and return the
   * new end point. `stepDeg` 45 (the default) gives 8-way snapping — horizontal,
   * vertical, and the four diagonals; pass 90 for the original horizontal/vertical
   * -only behavior.
   *
   * The end point is the ORTHOGONAL PROJECTION of the pointer onto the chosen ray,
   * which is what the H/V-only version did (it kept x2 for a horizontal snap and y2
   * for a vertical one) — so the point still tracks how far along the ray the
   * pointer has travelled, and the H/V results are bit-identical to before.
   */
  function snapLineToAngle(x1, y1, x2, y2, stepDeg) {
    const dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return { x: x2, y: y2 };
    const stride = stepDeg === 90 ? 2 : 1;   // table stride: 1 = every 45°, 2 = H/V only
    const deg = Math.atan2(dy, dx) * 180 / Math.PI;
    const idx = (((Math.round(deg / (45 * stride)) * stride) % 8) + 8) % 8;
    const v = SNAP_DIRS[idx];
    const t = (dx * v.x + dy * v.y) / (v.x * v.x + v.y * v.y);   // |v|² is 1 (axes) or 2 (diagonals)
    return { x: x1 + t * v.x, y: y1 + t * v.y };
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

  // Room Sizer: real-world dimensions of a PDF-space room box ({x1,y1,x2,y2},
  // corners in either order) under a scale object ({ pixelsPerUnit, unit }).
  // Everything is converted to FEET (the app's tally unit — see the "sum in feet"
  // invariant) regardless of the scale's unit. heightFt rides on the box itself
  // (user-entered, already feet). Returns null when there is no usable scale, so
  // callers can render an explicit "no scale" state instead of a wrong number.
  function roomBoxDimsFeet(box, scale) {
    if (!box || !scale || !scale.pixelsPerUnit) return null;
    const unit = scale.unit || 'ft';
    const widthFt = convertUnitValue(Math.abs(box.x2 - box.x1) / scale.pixelsPerUnit, unit, 'ft');
    const lengthFt = convertUnitValue(Math.abs(box.y2 - box.y1) / scale.pixelsPerUnit, unit, 'ft');
    const heightFt = box.heightFt > 0 ? box.heightFt : 0;
    const areaSqFt = widthFt * lengthFt;
    return { widthFt, lengthFt, heightFt, areaSqFt, volumeCuFt: areaSqFt * heightFt };
  }

  // Does a page's saved "bake frame" still match the frame the loaded PDF produces?
  // Annotations are stored baked into the page-rotation frame, so the saved {w,h,intrinsic}
  // (viewport dims at page.rotation + the PDF's intrinsic /Rotate) must match what the
  // loaded pdfPage produces now, or the marks sit over a differently-oriented page. A
  // missing frame on either side means "nothing to verify" -> treated as a match (no false
  // warning on pre-stamp projects). `tol` absorbs sub-pixel viewport rounding.
  function bakeFramesMatch(saved, current, tol) {
    if (!saved || !current) return true;
    const t = tol == null ? 1 : tol;
    return Math.abs((saved.w ?? 0) - (current.w ?? 0)) <= t
      && Math.abs((saved.h ?? 0) - (current.h ?? 0)) <= t
      && (saved.intrinsic ?? 0) === (current.intrinsic ?? 0);
  }

  // Standard drawing-sheet sizes, edges in PDF points (1 in = 72 pt; ISO mm * 72 / 25.4).
  // The architectural Set Scale presets assume the PDF page's point space equals the true
  // physical sheet size (72 pt = 1 real inch of paper). A "compressed" / re-boxed PDF breaks
  // that, so we detect the sheet and correct the preset. Stored long-edge first (landscape).
  const MM_TO_PT = 72 / 25.4;
  const STANDARD_SHEETS = [
    // ANSI (inches)
    { id: 'ANSI_A', label: 'ANSI A (8.5×11)', w: 11 * 72, h: 8.5 * 72 },
    { id: 'ANSI_B', label: 'ANSI B (11×17)', w: 17 * 72, h: 11 * 72 },
    { id: 'ANSI_C', label: 'ANSI C (17×22)', w: 22 * 72, h: 17 * 72 },
    { id: 'ANSI_D', label: 'ANSI D (22×34)', w: 34 * 72, h: 22 * 72 },
    { id: 'ANSI_E', label: 'ANSI E (34×44)', w: 44 * 72, h: 34 * 72 },
    // ARCH (inches)
    { id: 'ARCH_A', label: 'ARCH A (9×12)', w: 12 * 72, h: 9 * 72 },
    { id: 'ARCH_B', label: 'ARCH B (12×18)', w: 18 * 72, h: 12 * 72 },
    { id: 'ARCH_C', label: 'ARCH C (18×24)', w: 24 * 72, h: 18 * 72 },
    { id: 'ARCH_D', label: 'ARCH D (24×36)', w: 36 * 72, h: 24 * 72 },
    { id: 'ARCH_E', label: 'ARCH E (36×48)', w: 48 * 72, h: 36 * 72 },
    { id: 'ARCH_E1', label: 'ARCH E1 (30×42)', w: 42 * 72, h: 30 * 72 },
    // ISO A-series (millimetres)
    { id: 'ISO_A0', label: 'A0 (841×1189mm)', w: 1189 * MM_TO_PT, h: 841 * MM_TO_PT },
    { id: 'ISO_A1', label: 'A1 (594×841mm)', w: 841 * MM_TO_PT, h: 594 * MM_TO_PT },
    { id: 'ISO_A2', label: 'A2 (420×594mm)', w: 594 * MM_TO_PT, h: 420 * MM_TO_PT },
    { id: 'ISO_A3', label: 'A3 (297×420mm)', w: 420 * MM_TO_PT, h: 297 * MM_TO_PT },
    { id: 'ISO_A4', label: 'A4 (210×297mm)', w: 297 * MM_TO_PT, h: 210 * MM_TO_PT },
  ];

  // The orientation-normalized correction factor for treating `widthPt × heightPt` as a
  // (possibly rescaled) print of `sheet`: actual long edge / sheet long edge. 1 for a
  // true-size page; <1 for a shrunk/compressed one. Multiply a preset's pixelsPerUnit by it.
  function sheetCorrectionFactor(widthPt, heightPt, sheet) {
    if (!sheet) return 1;
    const pageLong = Math.max(widthPt, heightPt);
    const sheetLong = Math.max(sheet.w, sheet.h);
    if (!(pageLong > 0) || !(sheetLong > 0)) return 1;
    return pageLong / sheetLong;
  }

  // Classify a page's point dimensions against STANDARD_SHEETS. Orientation-independent
  // (compares long-vs-long, short-vs-short). Returns:
  //   isStandard/matchedSheet — page edges within `sizeTol` of a real sheet -> presets are
  //     trustworthy, no correction needed.
  //   bestGuessSheet/candidates — when NOT standard, the sheets whose aspect ratio is within
  //     `aspectTol` (the page is likely a rescaled print of one of these), closest aspect
  //     first; bestGuessSheet is null when the aspect matches nothing (genuinely odd page).
  function analyzeSheet(widthPt, heightPt, opts) {
    const sizeTol = opts && opts.sizeTol != null ? opts.sizeTol : 0.03;
    const aspectTol = opts && opts.aspectTol != null ? opts.aspectTol : 0.02;
    const longPt = Math.max(widthPt, heightPt);
    const shortPt = Math.min(widthPt, heightPt);
    const aspect = shortPt > 0 ? longPt / shortPt : 0;
    let matchedSheet = null;
    for (const s of STANDARD_SHEETS) {
      const sLong = Math.max(s.w, s.h), sShort = Math.min(s.w, s.h);
      if (Math.abs(longPt - sLong) / sLong <= sizeTol && Math.abs(shortPt - sShort) / sShort <= sizeTol) {
        matchedSheet = s;
        break;
      }
    }
    const candidates = [];
    if (!matchedSheet && aspect > 0) {
      for (const s of STANDARD_SHEETS) {
        const sAspect = Math.max(s.w, s.h) / Math.min(s.w, s.h);
        const aspectErr = Math.abs(aspect - sAspect) / sAspect;
        if (aspectErr <= aspectTol) candidates.push({ sheet: s, aspectErr, factor: sheetCorrectionFactor(widthPt, heightPt, s) });
      }
      // Closest aspect first; among equal-aspect sheets (e.g. ARCH B vs ARCH D, both 3:2 — a
      // ratio alone cannot distinguish them) prefer the LARGER sheet: construction plans are
      // usually D/E size, and the user can always override the guess in the picker.
      candidates.sort((a, b) => a.aspectErr - b.aspectErr || (b.sheet.w * b.sheet.h) - (a.sheet.w * a.sheet.h));
    }
    return {
      widthPt, heightPt, longPt, shortPt, aspect,
      isStandard: !!matchedSheet,
      matchedSheet,
      bestGuessSheet: candidates.length ? candidates[0].sheet : null,
      candidates,
    };
  }

  // Verify-scale check: how does a scale read a line the user knows the true length of?
  // Given the picked line's PDF-point distance and the current page `scale`, compute what that
  // scale says the line measures (converted to the unit the user typed the known length in) and
  // the percent error vs the known value. deltaPct 0 = perfect; +100 = scale reads 2x too long.
  function scaleCheckDelta(distPts, scale, knownVal, knownUnit) {
    if (!scale || !scale.pixelsPerUnit) return { reading: 0, deltaPct: 0 };
    const readingScaleUnit = distPts / scale.pixelsPerUnit;
    const reading = convertUnitValue(readingScaleUnit, scale.unit, knownUnit);
    const deltaPct = knownVal ? ((reading - knownVal) / knownVal) * 100 : 0;
    return { reading, deltaPct };
  }

  // Node test harness only: in a classic browser <script> `module` is undefined,
  // so this is a no-op there and the declarations above stay plain globals.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ptDist, snapLineToAngle, polylineDistance, polygonArea, distToSegment,
      getQuadraticBezierControlPoint, quadraticBezierPoint, quadraticBezierLength, distToQuadraticBezier,
      rotatePoint90CW, pointInRect, rectsOverlap,
      getMultiplyZoneForPoint, getMultiplyZoneForLine, getScaleZoneForLine,
      formatLineLengthRealSum, formatFeet, parseRealWorldLength, parseFraction,
      formatAgo, formatFeetInchesFromVal,
      formatDist, formatDistFeetInches, formatDistFeetInchesFromReal, formatArea,
      clampEffectiveDpr, convertUnitValue, roomBoxDimsFeet, bakeFramesMatch,
      STANDARD_SHEETS, sheetCorrectionFactor, analyzeSheet, scaleCheckDelta
    };
  }
