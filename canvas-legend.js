// canvas-legend.js — the sheet furniture the annotation draw core paints over
// the marks: the on-plan legend (the tally list and the E-/M-sheet block) and
// the grid overlay. Split out of canvas-draw.js (R24, 2026-09-26); nothing in
// it touches drawAnnotationsCore's closure.
//
// Classic <script src> loaded after geometry.js, icons.js and duct-model.js
// (whose pure helpers it reads by bare name at call time) and BEFORE
// canvas-draw.js, whose createCanvasDraw(deps) composes createCanvasLegend(deps)
// over the same deps and re-exports its keys, so app.js's canvasDraw.* reads
// (drawLegend, legendHasRows, resolveLegendStyle, legendSheetFactor,
// computeLegendRows, drawGrid) never changed.
//
// deps contract (all resolved live at call time; the subset of canvas-draw's):
//   getState()                  -> the app `state` object
//   getPageScale(pageIdx)       -> the page scale (the grid's spacing)
//   getEffectiveScaleForLine(ann, line, isPoly, pageIdx) -> scale | null (room volumes)
//   getLineLengthSplitForTotals(line, pageIdx, isPoly, ann) -> { feet, px }
//   getLineRealWorldLengthFeet(line, pageIdx, isPoly, ann)  -> feet (duct rows)
//   getRoomBalanceForPage(pageIdx) -> [{ name, color, targetCfm, servedCfm, under }]
//   lineTypeSpecText(lt)        -> the sheet block's spec line (optional)
//   suggestNeckSize(cfm)        -> { neckDIn, overCapacity } (optional)
//   getTrade()                  -> 'plumbing' | 'electrical' | 'hvac' | null (optional)
//   iconRenderVb(iconPath) / iconRenderCenter(iconPath) -> vb num / {x,y}
//
// hexToRgb and lineStyleToDash are pure top-level helpers (the legend
// background and the grid are their only readers). Guarded CommonJS footer so
// canvas-legend.test.js can require() the module under `node --test`.

function hexToRgb(hex) {
  const m = (hex || '#ffffff').match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
}

function lineStyleToDash(style) {
  if (style === 'dashed') return [4, 4];
  if (style === 'dotted') return [2, 2];
  return [];
}

// The legend's duct-row swatch (DUCT unit D5): a neutral sheet-metal gray —
// legend duct rows are PER SIZE, and one size can span supply/return/exhaust,
// so no single airside color would be honest.
const DUCT_LEGEND_SWATCH = '#8a919c';

function createCanvasLegend(deps) {
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
    const wantW = Math.max(minW, idealWidthPdf);
    const wantH = Math.max(minH, idealHeightPdf);
    leg.x = Math.max(0, Math.min(leg.x, pageW - wantW - 10));
    leg.y = Math.max(0, Math.min(leg.y, pageH - wantH - 10));
    leg.w = Math.max(minW, Math.min(wantW, pageW - leg.x - 10));
    leg.h = Math.max(minH, Math.min(wantH, pageH - leg.y - 10));
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
    // The box hugs its rows at the legend's scale (2026-09-21): the corner
    // grip and the Summary Legend size slider both set
    // legendSettings.legendScale, so the block shrinks as readily as it
    // grows and its content follows. A `userResized` box from an older save
    // (the grip used to grow a bare white patch past the rows) is ignored
    // and snaps back to its content.
    const wantW = Math.max(minW, idealWidthPdf);
    const wantH = Math.max(minH, idealHeightPdf);
    leg.x = Math.max(0, Math.min(leg.x, pageW - wantW - 10));
    leg.y = Math.max(0, Math.min(leg.y, pageH - wantH - 10));
    leg.w = Math.max(minW, Math.min(wantW, pageW - leg.x - 10));
    leg.h = Math.max(minH, Math.min(wantH, pageH - leg.y - 10));
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
    computeLegendRows,
    legendHasRows,
    resolveLegendStyle,
    legendSheetFactor,
    drawSheetLegend,
    drawLegend,
    drawGrid,
  };
}

// Dual-env export so canvas-legend.test.js (and canvas-draw.js under node) can
// require() the module; inert in the browser (classic script).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createCanvasLegend, hexToRgb, lineStyleToDash, DUCT_LEGEND_SWATCH };
}
