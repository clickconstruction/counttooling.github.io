/*
 * features/water-size.js — the S moment for water (WATER-PLAN.md rung 4,
 * 2026-09-23). LIVE information, never automation, the ductulator's twin:
 * while a POLYLINE of a water-sided line type is being traced, a card above the
 * footer (#waterHintCard, the duct hint card's twin) reads the fixture units
 * still to serve beyond the tip and the smallest size of the type's material
 * that keeps the velocity under the side's cap:
 *
 *   "3/4″ suggested · 6 WSFU downstream · 5.1 fps · S accepts"   (a size that passes)
 *   "1/2″ holds · 6 WSFU downstream · 6.8 fps ✓"                (the run's own size passes)
 *   "6 WSFU downstream · 8.7 gpm"                               (no material in the name)
 *
 * The number: water-model's waterDraftRemainingLoad over the page's committed
 * water runs, the draft's PLACED vertices (the rubber band attaches nothing, so
 * the number changes on clicks, not on hover) and the fixtures features/
 * water-runs.js collects: fixtures of the draft's side attached to the draft at
 * or past its tip, on committed runs that branch off it, or attached to no run
 * of the side at all. A flush valve among them picks the demand column. The
 * flow is IPC Table E103.3(3) (demandGpm), the size the smallest of the
 * material (read off the type's name, water-model waterMaterialFromName) under
 * the cap (WATER_VELOCITY_CAP_FPS, or the project's own knob once rung 5 adds
 * state.waterSettings.capFps[side]).
 *
 * S (or a tap on the card) opens #waterSizePopover (the duct size popover's
 * markup and classes): the suggested size as a chip, the material's whole
 * ladder with each size's velocity (✓ / ⚠), the flow and the column, and the
 * note that a size change starts a new run. Taking a size is WATER-PLAN Q1's
 * "a size change is a new run from here": the draft so far is committed as it
 * stands (App.settlePolylineDraft), a line type of the new size is found or
 * made (the name with its size swapped, water-model replaceSizeInName; the
 * side, curve and child counts carried over, hanger rows re-read from the
 * rulebook for the new size, a palette color no other type uses), and a new
 * draft starts at the last point in that type, so the two runs share the point
 * and drops and hangers count once. A size the draft already has just closes.
 *
 * Seams: App.getWaterDraftSuggestion() (the spec seam and the card's text),
 * App.isWaterDrawing(), App.toggleWaterSizePopover / open / close /
 * isWaterPopoverOpen (app.js's keydown routes S and Escape here while a water
 * trace is live), App.applyWaterSize(sizeIn), App.drawWaterOverlay (called by
 * renderAnnotations after the duct overlay; it paints nothing, it syncs the
 * card). Boundary rule: shared deps from App.* at call time.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const WM = () => window.WaterModel;
  const SM = () => window.SupportModel;
  const esc = (s) => (App.escapeHtml ? App.escapeHtml(s) : String(s));
  const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
  const inch = (sizeIn) => (WM() ? WM().sizeFraction(sizeIn) : String(sizeIn)) + '″';

  function draftLineType() {
    const state = App.state;
    const d = state.drawingPolyline;
    if (!d || state.tool !== App.TOOL.POLYLINE) return null;
    const lt = (state.lineTypes || []).find((l) => l.id === d.lineTypeId);
    return lt && (lt.waterSide === 'cold' || lt.waterSide === 'hot') ? lt : null;
  }
  function isWaterDrawing() { return !!draftLineType(); }
  function capFor(side) {
    const ws = App.state.waterSettings;
    const v = ws && ws.capFps && Number(ws.capFps[side]);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  // The suggestion for the live draft, or null (no water draft, no fixtures in scope).
  function getWaterDraftSuggestion() {
    const wm = WM();
    const state = App.state;
    const lt = draftLineType();
    if (!wm || !lt) return null;
    const draft = state.drawingPolyline;
    const pageIdx = state.currentPage;
    const page = state.pages[pageIdx];
    if (!page) return null;
    const ann = App.getActiveAnnotations(page, pageIdx);
    const fixtures = App.collectWaterFixtures ? App.collectWaterFixtures(pageIdx, ann) : [];
    if (!fixtures.length) return null;
    const runs = App.getWaterRuns ? App.getWaterRuns(pageIdx, ann) : [];
    const remaining = wm.waterDraftRemainingLoad({ runs, draft: { side: lt.waterSide, vertices: draft.points || [] }, fixtures });
    if (!remaining || !(remaining.wsfu > 0)) return null;
    const material = wm.waterMaterialFromName(lt.name);
    const currentSizeIn = SM() && SM().supportSizeInFromName ? SM().supportSizeInFromName(lt.name) : null;
    const s = wm.waterDraftSuggestion({ wsfu: remaining.wsfu, flushValve: remaining.flushValve, material, side: lt.waterSide, cap: capFor(lt.waterSide), currentSizeIn });
    if (!s) return null;
    const load = fmt(s.wsfu) + ' WSFU downstream';
    let chipText, kind;
    if (s.sizeIn != null && s.holds && s.currentSizeIn === s.sizeIn) {
      kind = 'holds';
      chipText = inch(s.currentSizeIn) + ' holds · ' + load + ' · ' + fmt1(s.currentVelocityFps) + ' fps ✓';
    } else if (s.sizeIn != null && s.holds && s.currentSizeIn > s.sizeIn) {
      kind = 'holds';
      chipText = inch(s.currentSizeIn) + ' holds · ' + load + ' · ' + fmt1(s.currentVelocityFps) + ' fps ✓ · ' + inch(s.sizeIn) + ' would do';
    } else if (s.sizeIn != null) {
      kind = 'suggests';
      chipText = inch(s.sizeIn) + ' suggested · ' + load + ' · ' + fmt1(s.velocityFps) + ' fps' + (s.over ? ' · ' + inch(s.currentSizeIn) + ' runs ' + fmt1(s.currentVelocityFps) + ' ⚠' : '') + '. S accepts';
    } else if (material) {
      kind = 'none';
      chipText = load + ' · ' + fmt1(s.gpm) + ' gpm · no size of ' + material + ' passes under ' + fmt(s.capFps) + ' fps';
    } else {
      kind = 'flow';
      chipText = load + ' · ' + fmt1(s.gpm) + ' gpm';
    }
    return { ...s, ...remaining, lineType: lt, kind, chipText, columnLabel: s.column === 'flush-valve' ? 'flush valves' : 'flush tanks' };
  }

  // --- the card ------------------------------------------------------------------
  function syncWaterHintCard(sug) {
    const el = document.getElementById('waterHintCard');
    if (!el) return;
    if (!sug) { if (!el.hidden) { el.hidden = true; el.innerHTML = ''; } return; }
    let text = sug.chipText, tail = '';
    const m = text.match(/\s*[.—-]\s*S accepts\.?\s*$/);
    if (m) { text = text.slice(0, m.index); tail = ' · <kbd>S</kbd> accepts'; }
    const parts = text.split(' · ');
    const html = (parts.length > 1 ? '<b>' + esc(parts[0]) + '</b> · ' + esc(parts.slice(1).join(' · ')) : esc(text)) + tail;
    if (el.innerHTML !== html) el.innerHTML = html;
    if (el.hidden) el.hidden = false;
  }
  // Called by renderAnnotations after the duct overlay: paints nothing, syncs the card.
  function drawWaterOverlay() {
    const sug = isWaterDrawing() ? getWaterDraftSuggestion() : null;
    syncWaterHintCard(sug);
    if (!sug && open) closeWaterSizePopover();
  }

  // --- the popover ------------------------------------------------------------------
  let open = false, wired = false;
  function renderPopover(sug) {
    const wm = WM();
    const host = document.getElementById('waterSizeSections');
    const cur = document.getElementById('waterSizeCurrent');
    if (!host || !wm) return;
    const lt = sug.lineType;
    if (cur) cur.textContent = lt.name + ' · ' + wm.WATER_SIDE_LABELS[lt.waterSide];
    host.innerHTML = '';
    const section = (cls) => { const d = document.createElement('div'); d.className = 'duct-popover-section' + (cls ? ' ' + cls : ''); host.appendChild(d); return d; };
    const label = (parent, text) => { const l = document.createElement('div'); l.className = 'duct-popover-section-label'; l.textContent = text; parent.appendChild(l); };
    const from = (parent, text) => { const f = document.createElement('div'); f.className = 'duct-suggest-from'; f.textContent = text; parent.appendChild(f); };
    if (sug.sizeIn != null) {
      const s1 = section('water-suggest');
      label(s1, sug.kind === 'holds' ? 'This size holds' : 'Suggested');
      const row = document.createElement('div');
      row.className = 'duct-suggest-row';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'duct-suggest-chip water-suggest-chip';
      b.dataset.sizeIn = String(sug.kind === 'holds' ? sug.currentSizeIn : sug.sizeIn);
      b.textContent = inch(sug.kind === 'holds' ? sug.currentSizeIn : sug.sizeIn) + ' ' + (sug.material || '');
      b.title = sug.chipText;
      b.onclick = () => applyWaterSize(Number(b.dataset.sizeIn));
      row.appendChild(b);
      s1.appendChild(row);
      from(s1, 'from ' + fmt(sug.wsfu) + ' WSFU · ' + fmt1(sug.gpm) + ' gpm at ' + sug.columnLabel + ' · under ' + fmt(sug.capFps) + ' fps ' + lt.waterSide);
    } else {
      const s1 = section('water-suggest');
      label(s1, 'Load');
      from(s1, fmt(sug.wsfu) + ' WSFU · ' + fmt1(sug.gpm) + ' gpm at ' + sug.columnLabel + (sug.material ? ' · no size of ' + sug.material + ' passes under ' + fmt(sug.capFps) + ' fps' : ' · name the material in the line type (PEX, copper, CPVC, galvanized) for a size'));
    }
    if (sug.material) {
      const s2 = section('water-ladder');
      label(s2, 'Sizes · ' + sug.material);
      const grid = document.createElement('div');
      grid.className = 'water-size-ladder';
      wm.waterSizeLadder(sug.gpm, sug.material, sug.capFps).forEach((r) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'water-size-step' + (r.ok ? ' ok' : ' over') + (r.sizeIn === sug.currentSizeIn ? ' current' : '');
        b.dataset.sizeIn = String(r.sizeIn);
        b.innerHTML = '<span class="water-size-step-size">' + esc(r.label) + '″</span><span class="water-size-step-v">' + fmt1(r.velocityFps) + ' fps ' + (r.ok ? '✓' : '⚠') + '</span>';
        b.title = (r.sizeIn === sug.currentSizeIn ? 'The run’s size now · ' : '') + fmt1(r.velocityFps) + ' fps at ' + fmt1(sug.gpm) + ' gpm' + (r.ok ? '' : ', over the ' + fmt(sug.capFps) + ' fps cap');
        b.onclick = () => applyWaterSize(r.sizeIn);
        grid.appendChild(b);
      });
      s2.appendChild(grid);
    }
    const s3 = section('water-note');
    from(s3, 'A size change ends this run here and starts the next one from the last point. Sized at ' + fmt(sug.capFps) + ' fps, practice not code; the pressure check is Bid Check’s.');
  }
  function openWaterSizePopover() {
    const sug = isWaterDrawing() ? getWaterDraftSuggestion() : null;
    if (!sug) { if (isWaterDrawing()) App.showToast('No fixtures in reach yet: place the fixtures, or give them fixture units, and the size follows.', 3200); return; }
    wire();
    const el = document.getElementById('waterSizePopover');
    if (!el) return;
    renderPopover(sug);
    el.style.display = '';
    open = true;
    // Anchor under the hint card when it shows, else near the last placed point.
    const card = document.getElementById('waterHintCard');
    let x, y;
    if (card && !card.hidden) { const r = card.getBoundingClientRect(); x = r.left; y = r.top - 8 - 260; }
    else {
      const pts = App.state.drawingPolyline.points || [];
      const last = pts[pts.length - 1];
      const c = document.getElementById('annCanvas');
      const rect = c ? c.getBoundingClientRect() : { left: 100, top: 100, width: 400, height: 300 };
      if (last && App.toCanvas && c) { const bc = App.toCanvas(last); x = rect.left + bc.x * (rect.width / c.width) + 12; y = rect.top + bc.y * (rect.height / c.height) + 12; }
      else { x = rect.left + rect.width / 2 - 118; y = rect.top + rect.height / 3; }
    }
    if (App.placeFixedMenu) App.placeFixedMenu(el, x, y);
  }
  function closeWaterSizePopover() {
    const el = document.getElementById('waterSizePopover');
    if (el) el.style.display = 'none';
    open = false;
  }
  function toggleWaterSizePopover() { if (open) closeWaterSizePopover(); else openWaterSizePopover(); }
  function isWaterPopoverOpen() { return open; }
  function wire() {
    if (wired) return;
    wired = true;
    const close = document.getElementById('waterSizePopoverClose');
    if (close) close.onclick = closeWaterSizePopover;
    const card = document.getElementById('waterHintCard');
    if (card) card.onclick = () => toggleWaterSizePopover();
  }

  // --- taking a size: a new run from here -------------------------------------------
  function unusedLineColor(exclude) {
    const used = new Set((App.state.lineTypes || []).map((l) => String(l.color || '').toLowerCase()));
    const palette = App.COLORS || [];
    return palette.find((c) => !used.has(String(c).toLowerCase())) || exclude || palette[0] || '#4a9eff';
  }
  // The line type of `sizeIn` beside `lt`: an existing one (same material and
  // side, that size in the name), else a new one carried over from `lt`.
  function lineTypeForSize(lt, sizeIn) {
    const wm = WM(), sm = SM();
    const state = App.state;
    const material = wm.waterMaterialFromName(lt.name);
    const found = (state.lineTypes || []).find((l) => l.id !== lt.id && l.waterSide === lt.waterSide && wm.waterMaterialFromName(l.name) === material && sm && sm.supportSizeInFromName(l.name) === sizeIn);
    if (found) return { lt: found, created: false };
    const name = wm.replaceSizeInName(lt.name, sizeIn);
    const next = { id: App.uid(), name, color: unusedLineColor(lt.color), curveStyle: lt.curveStyle || 'straight', waterSide: lt.waterSide };
    if (lt.bendFittings) next.bendFittings = JSON.parse(JSON.stringify(lt.bendFittings));
    if (Array.isArray(lt.childCounts) && lt.childCounts.length) {
      // hanger rows come from the rulebook for the NEW size; every other child row rides as it is
      const kept = lt.childCounts.filter((ch) => !(ch.ruleId && /^plumb\.hanger\./.test(ch.ruleId))).map((ch) => ({ ...ch }));
      const hadHangers = lt.childCounts.length !== kept.length;
      const hangers = hadHangers && sm && sm.hangerSuggestionsFor ? sm.hangerSuggestionsFor(name).map((h) => ({ name: h.name, qty: h.qty, per: h.per, intervalIn: h.intervalIn, ruleId: h.ruleId })) : [];
      next.childCounts = kept.concat(hangers);
    }
    state.lineTypes.push(next);
    return { lt: next, created: true };
  }
  function applyWaterSize(sizeIn) {
    const state = App.state;
    const lt = draftLineType();
    const draft = state.drawingPolyline;
    closeWaterSizePopover();
    if (!lt || !draft || !(sizeIn > 0)) return;
    const sm = SM();
    const currentSizeIn = sm && sm.supportSizeInFromName ? sm.supportSizeInFromName(lt.name) : null;
    if (currentSizeIn === sizeIn) return;
    App.pushUndoSnapshot();
    const { lt: next, created } = lineTypeForSize(lt, sizeIn);
    const pts = draft.points || [];
    const last = pts[pts.length - 1];
    const group = draft.group || null;
    if (pts.length >= 2) {
      // commit the run so far as it stands, then continue from its last point in the sized type
      App.settlePolylineDraft();
      state.drawingPolyline = { id: App.uid(), name: App.nextPolylineName ? App.nextPolylineName() : (draft.name || 'Polyline') + ' 2', color: next.color, points: [{ x: last.x, y: last.y }], closed: false, lineTypeId: next.id, group };
    } else {
      // nothing drawn yet: the draft simply changes type
      draft.lineTypeId = next.id;
      draft.color = next.color;
    }
    state.activeLineTypeId = next.id;
    state.tool = App.TOOL.POLYLINE;
    App.markProjectDirty();
    App.updateUI();
    App.renderAnnotations();
    App.showToast(next.name + (created ? ' (new line type)' : '') + ' from here.', 2600);
  }

  App.getWaterDraftSuggestion = getWaterDraftSuggestion;
  App.isWaterDrawing = isWaterDrawing;
  App.drawWaterOverlay = drawWaterOverlay;
  App.openWaterSizePopover = openWaterSizePopover;
  App.closeWaterSizePopover = closeWaterSizePopover;
  App.toggleWaterSizePopover = toggleWaterSizePopover;
  App.isWaterPopoverOpen = isWaterPopoverOpen;
  App.applyWaterSize = applyWaterSize;
  App.lineTypeForWaterSize = lineTypeForSize;   // spec seam
})();
