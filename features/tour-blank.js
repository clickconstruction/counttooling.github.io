/*
 * features/tour-blank.js - the fourth tour: every button, on a blank sheet.
 *
 * The three trade tours (features/tutorial.js) teach one trade's loop on the sample plan
 * and the lessons (features/lessons.js) go deep on one family of tools each. This tour is
 * the other axis: no plan, no trade, no numbers to get right, just a blank ANSI B sheet
 * and every control in the header, on the sheet, in the footer and in the sidebar,
 * pressed once. About fifteen minutes; any step can be skipped.
 *
 * The sheet is MADE HERE, in the browser, with the vendored pdf-lib (two 1224 × 792 pt
 * pages: a border, a title block that says 1/8" = 1'-0", and on SK-1 one 20'-0"
 * dimension to prove the scale on), then fed to #pdfInput like a dropped file, so it goes
 * through the normal intake and nothing about the app is faked. The project is named
 * `blank-sheet`; features/lessons.js knows the name so a lesson opened afterwards resets it
 * without asking, and this tour resets the teaching sets the same way. The reader's own
 * plan always goes through Close project, which asks.
 *
 * It is a tour on the engine (App.registerTour('blank', ...)), so a step is the engine's
 * { id, title, body, kind, target, check(), action?, hint?, hold?, zones?, page? }: check()
 * reads REAL state, sheet work is asked for inside on-sheet targets and only counts
 * there, a toggle step waits until the button has been pressed and pressed back, and
 * every doing step's action.run is the spec seam (App.tutorialDoStep) through the same
 * App.* doors a click uses. No trade is stamped; the tour speaks in trade-neutral words
 * ("Fixture", "Pipe") and reaches every tool through the ladder, so a plumbing device
 * finds Duct behind the ⋯ and an HVAC device finds Polyline there. Controls are written
 * as double-bracket chips (teaching-labels.test.js proves each exists), bodies are lines, no em
 * dashes. Snap to 45° is a device setting: remembered on start, put back on stop.
 *
 * Doors: the empty canvas (#canvasEmptyHintTourBlank, hidden once the tour is done on this
 * device: localStorage `clickcount-tour-done-blank`), Learn (#learnTour-blank), Project
 * Settings → Help (#settingsTourBlank), /app/?tour=blank.
 *
 * Pick up where you left off: thirty-six steps is more than one sitting, so the step the
 * reader is on is kept (`clickcount-tour-blank-step`, written by the engine's onStep hook,
 * cleared on Finish). The next start offers "Pick up at step 20" beside "Start over": the
 * sheet opens fresh and every earlier doing step's action runs through the same App.* doors,
 * so the work the later steps take for granted is on the sheet again, then the tour lands
 * on the saved step. Precision where it counts: the Quick Line step's circles are tight and
 * its check reads the footage, because a run's length is measured between the two clicks.
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const K = () => App.tourKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const TOUR_ID = 'blank';
  const DONE_KEY = 'clickcount-tour-done-blank';
  const SHEET_NAME = 'blank-sheet';
  const W = 1224, H = 792;   // ANSI B in PDF points
  const PPU = 9;             // 1/8" = 1'-0": 72 / 8 points per foot
  // Sets the teaching opened; reset without asking when this tour opens over one.
  const TEACHING_SETS = ['sample-plan', 'sample-plan-advanced', 'sample-lessons', 'sample-electrical', 'sample-hvac', SHEET_NAME];

  // ----- the sheet, in points (y down, like every annotation) --------------------------
  const DIM = [{ x: 120, y: 120 }, { x: 300, y: 120 }];                       // 180 pt = 20'-0"
  // The measure step's proof (features/tutorial.js measureProof), built on first use: the line drawn
  // between its circles, a circle that ticks as its click lands, a hint that names the miss.
  let proveDimMemo = null;
  const proveDim = () => proveDimMemo || (proveDimMemo = K().measureProof({ page: 0, ends: DIM, r: 14, ft: 20, tol: 0.6, stated: '20\'-0"' }));
  const FIX = [{ x: 200, y: 240 }, { x: 290, y: 240 }, { x: 380, y: 240 }];   // three marks, far enough apart to stay circles at fit zoom
  const KEY = { x: 490, y: 240 };                                              // the quick-key mark
  const LINE = [{ x: 200, y: 330 }, { x: 420, y: 330 }];                       // a Quick Line, 220 pt = 24.4 ft
  const LINE_FT = (LINE[1].x - LINE[0].x) / PPU;                               // the footage the step reads
  const LINE_R = 8;                                                            // tight: the engine zooms to keep it 26 px, so a click inside is within about a foot
  // How close is close: whatever the circle is on screen right now (the engine's own rule, 26 px
  // or the drawn radius), both ends, plus a little, so "anywhere inside the circle" stays true
  // however far the reader zoomed out; never under two feet.
  const lineTolFt = () => Math.max(2, (2 * Math.max(LINE_R, 26 / Math.max(0.05, S().zoom || 1))) / PPU + 0.5);
  const POLY = [{ x: 200, y: 430 }, { x: 420, y: 430 }, { x: 420, y: 540 }];  // a polyline with a corner
  const CHAIN = [{ x: 560, y: 240 }, { x: 700, y: 240 }];                      // two chained marks
  const DUCT = [{ x: 560, y: 430 }, { x: 800, y: 430 }];                       // a duct run
  const HL_IN = { x1: 185, y1: 225, x2: 395, y2: 255 }, HL_OUT = { x1: 150, y1: 190, x2: 440, y2: 290 };    // over the three marks
  const MZ_IN = { x1: 545, y1: 225, x2: 715, y2: 255 }, MZ_OUT = { x1: 505, y1: 185, x2: 755, y2: 295 };    // around the chained pair
  const SZ_IN = { x1: 860, y1: 150, x2: 1020, y2: 230 }, SZ_OUT = { x1: 820, y1: 110, x2: 1060, y2: 270 };  // a detail at 1/4"
  const ROOM_IN = { x1: 860, y1: 330, x2: 1040, y2: 470 }, ROOM_OUT = { x1: 830, y1: 300, x2: 1070, y2: 500 };
  const GHOST_DROP = { x: 290, y: 620 };
  const DEL_IN = { x1: 475, y1: 225, x2: 505, y2: 255 }, DEL_OUT = { x1: 448, y1: 200, x2: 530, y2: 280 };  // just the quick-key mark
  const NOTE_SPOT = { x: 630, y: 600 };

  // The blank sheet: two pages, a border, a title block, and one dimension to prove the
  // scale on. pdf-lib's origin is the bottom-left, so Y flips.
  async function makeBlankSheet() {
    const L = window.PDFLib;
    if (!L) throw new Error('pdf-lib missing');
    const doc = await L.PDFDocument.create();
    doc.setTitle('Blank practice sheet');
    const font = await doc.embedFont(L.StandardFonts.Helvetica);
    const bold = await doc.embedFont(L.StandardFonts.HelveticaBold);
    const grey = L.rgb(0.5, 0.5, 0.5), ink = L.rgb(0.15, 0.15, 0.15);
    const Y = (y) => H - y;
    [1, 2].forEach((n) => {
      const p = doc.addPage([W, H]);
      p.drawRectangle({ x: 36, y: 36, width: W - 72, height: H - 72, borderColor: grey, borderWidth: 1 });
      p.drawRectangle({ x: 900, y: 36, width: 288, height: 56, borderColor: grey, borderWidth: 1 });
      // the title block sits bottom-right, the way a real sheet's does (pdf-lib y is from the bottom)
      // laid out the way sheet-title-model.js reads a real one: the number is its own text item,
      // the tallest in the block, with a SHEET caption above it, so the page names itself "SK-1"
      p.drawText('SHEET', { x: 1120, y: 78, size: 7, font, color: grey });
      p.drawText('SK-' + n, { x: 1120, y: 52, size: 18, font: bold, color: ink });
      p.drawText('PRACTICE SHEET', { x: 910, y: 72, size: 11, font: bold, color: ink });
      p.drawText('SCALE: 1/8" = 1\'-0"    ANSI B, 17 x 11', { x: 910, y: 57, size: 9, font, color: grey });
      p.drawText('CountTooling - a blank sheet for trying every button', { x: 910, y: 45, size: 8, font, color: grey });
      if (n === 1) {
        const [a, b] = DIM;
        p.drawLine({ start: { x: a.x, y: Y(a.y) }, end: { x: b.x, y: Y(b.y) }, thickness: 1, color: ink });
        [a, b].forEach((pt) => p.drawLine({ start: { x: pt.x, y: Y(pt.y - 7) }, end: { x: pt.x, y: Y(pt.y + 7) }, thickness: 1, color: ink }));
        const t = '20\'-0"';
        p.drawText(t, { x: (a.x + b.x) / 2 - font.widthOfTextAtSize(t, 11) / 2, y: Y(a.y - 9), size: 11, font, color: ink });
        p.drawText('measure this line to prove the scale', { x: a.x, y: Y(a.y + 22), size: 8, font, color: grey });
      }
    });
    return doc.save();
  }

  // ----- reading the app ----------------------------------------------------------------
  const page0 = () => S().pages && S().pages[0];
  const ann = () => (page0() ? App.getActiveAnnotations(page0()) : null);
  const modalUp = (id) => { const m = el(id); return !!m && m.classList.contains('visible'); };
  const sheetOpen = () => !!(S().pages && S().pages.length === 2 && S().currentProjectName === SHEET_NAME && S().pages[0].pdfPage);
  const scaleIs = (ppu) => { const sc = App.getPageScale && App.getPageScale(0); return !!sc && Math.abs(sc.pixelsPerUnit - ppu) < 0.05; };
  const near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) <= d;
  const inRect = (pt, r) => pt.x >= r.x1 && pt.x <= r.x2 && pt.y >= r.y1 && pt.y <= r.y2;
  // The palette rides the Artboard into every new project, so "made a counter" means one
  // that was not there when the sheet opened.
  let base = null;   // { counters, lineTypes, groups }: ids on the sheet when it opened
  const fresh = (list, key) => (list || []).find((x) => base && !base[key].has(x.id)) || null;
  const counter = () => fresh(S().counters, 'counters');
  const lineType = () => fresh(S().lineTypes, 'lineTypes');
  const group = () => fresh(S().groups, 'groups');
  const cid = () => (counter() ? counter().id : '-');
  const quickPaths = () => { const a = ann(); return ((a && a.quickLines) || []).map((l) => [{ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }]); };
  // the run between the two line circles, and its footage as the sidebar reads it
  const lineRun = () => { const a = ann(); return ((a && a.quickLines) || []).find((l) => (near({ x: l.x1, y: l.y1 }, LINE[0], 30) && near({ x: l.x2, y: l.y2 }, LINE[1], 30)) || (near({ x: l.x1, y: l.y1 }, LINE[1], 30) && near({ x: l.x2, y: l.y2 }, LINE[0], 30))); };
  const lineFeet = (l) => (l ? Math.hypot(l.x2 - l.x1, l.y2 - l.y1) / PPU : null);
  // once close, close: a zoom after the click must not take a done step back
  const lineClose = () => { const ft = lineFeet(lineRun()); return latch('lineClose', ft != null && Math.abs(ft - LINE_FT) <= lineTolFt()); };
  const feetText = (ft) => { const f = Math.floor(ft), i = Math.round((ft - f) * 12); return (i === 12 ? f + 1 : f) + '\'-' + (i === 12 ? 0 : i) + '"'; };
  const polyPaths = (live) => { const a = ann(); const d = S().drawingPolyline; return ((a && a.polylines) || []).map((p) => p.points || []).concat(live && d && d.points ? [d.points] : []); };
  const ductPaths = (live) => { const a = ann(); const d = S().drawingDuct; return ((a && a.ductRuns) || []).map((r) => r.vertices || []).concat(live && d && d.vertices ? [d.vertices] : []); };
  const rects = (key, test) => { const a = ann(); return ((a && a[key]) || []).filter((z) => !test || test(z)); };
  const dropAt = (spot, r) => { const a = ann(); if (!a) return false; const z = { x: spot.x, y: spot.y, r }; return (a.quickLines || []).some((l) => ((l.startDrop || 0) > 0 && K().inCircle({ x: l.x1, y: l.y1 }, z)) || ((l.endDrop || 0) > 0 && K().inCircle({ x: l.x2, y: l.y2 }, z))); };
  const anyDrop = () => { const a = ann(); return !!a && (a.quickLines || []).concat(a.polylines || []).some((l) => (l.startDrop || 0) > 0 || (l.endDrop || 0) > 0); };
  const chainedRun = () => { const a = ann(); return !!a && (a.quickLines || []).some((l) => (near({ x: l.x1, y: l.y1 }, CHAIN[0], 40) && near({ x: l.x2, y: l.y2 }, CHAIN[1], 40)) || (near({ x: l.x1, y: l.y1 }, CHAIN[1], 40) && near({ x: l.x2, y: l.y2 }, CHAIN[0], 40))); };
  const markNearKey = () => K().markersOf(0, null).some((m) => near(m, KEY, 30));
  const ghosts = () => rects('ghosts');
  const noteAt = (spot, r) => { const a = ann(); return !!a && (a.notes || []).some((n) => K().inCircle({ x: n.x, y: n.y }, { x: spot.x, y: spot.y, r })); };
  const ledgerOpen = () => { const b = el('notesLedgerBtn'); return !!b && b.getAttribute('aria-expanded') === 'true'; };
  const activeCanvasIsMain = () => { const p = page0(); return !!p && !!(p.canvases || []).length && App.getActiveCanvas(p) === p.canvases[0]; };
  const activeMarks = () => { const p = page0(); const c = p && App.getActiveCanvas(p); return c ? App.countCanvasMarks(c.annotations) : 0; };
  const box = (inner, outer, done, label) => ({ kind: 'box', inner: K().norm(inner), outer: K().norm(outer), done: !!done, label: label || '' });

  // Latches: a step that asks for something transient (a dialog opened, a toggle pressed
  // and pressed back) remembers that it happened. All reset when the tour starts.
  let seen = {};
  const latch = (key, cond) => { if (cond) seen[key] = true; return !!seen[key]; };
  let moveBase = null, zoomBase = null, snapBefore = null, settled = null, settledAt = 0;
  // Where the reader left off (see the header): the saved index, read on start, and whether
  // this run is picking up there (`resumeTo`) or starting over.
  const STEP_KEY = 'clickcount-tour-blank-step';
  const savedStep = () => { try { const n = parseInt(localStorage.getItem(STEP_KEY) || '', 10); return n > 1 ? n : null; } catch (_) { return null; } };
  const saveStep = (n) => { try { if (n > 1) localStorage.setItem(STEP_KEY, String(n)); else localStorage.removeItem(STEP_KEY); } catch (_) { /* private mode: no resume, nothing else lost */ } };
  let resumeTo = null, restoring = false;

  // ----- opening the sheet ------------------------------------------------------------------
  async function openBlankSheet() {
    const s = S();
    if (s.pages && s.pages.length) {
      if (TEACHING_SETS.includes(s.currentProjectName)) { App.resetLocalSessionState({ keepArtboard: true }); App.updateUI(); App.renderPdf(); }
      else if (!(await App.closeProject({ route: 'tour' }))) return;   // their own plan: the app's one Close project, which asks
    }
    let bytes;
    try { bytes = await makeBlankSheet(); } catch (e) { App.showToast('Could not make the blank sheet. Upload any PDF and the tour carries on from there.'); return; }
    const file = new File([bytes], SHEET_NAME + '.pdf', { type: 'application/pdf' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const inp = el('pdfInput');
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    // A signed-in device sees Trim your set on every fresh upload: keep both sheets.
    for (let i = 0; i < 150 && !modalUp('preparePdfModal') && !sheetOpen(); i++) await wait(100);
    if (modalUp('preparePdfModal')) el('preparePdfDone').click();
  }
  // Picking up: the earlier doing steps' actions, in order, through the same doors a click
  // uses (the spec seam), then the saved step. Reading steps have nothing to lay down.
  async function restoreUpTo(index) {
    restoring = true;
    try {
      for (let i = 1; i < index; i++) {
        const st = STEPS[i];
        if (!st || st.kind !== 'do' || !st.action) continue;
        try { await st.action.run(); } catch (_) { /* a step that cannot be laid down is one the reader can redo */ }
        await wait(60);
      }
      // the doors the earlier steps opened stay closed on the saved step
      ['settingsModal', 'saveStatusModal', 'summaryCountDetailModal'].forEach((id) => { if (modalUp(id)) App.hideModal(id); });
      const m = el('exportDropdownMenu'); if (m && m.classList.contains('visible')) el('exportDropdownBtn').click();
      S().tool = App.TOOL.NONE; App.updateUI(); App.renderAnnotations();
    } finally { restoring = false; }
    resumeTo = null;
    if (App.isTutorialActive() && STEPS[index]) App.tutorialGoTo(STEPS[index].id);
  }
  // "Open" means SETTLED (the lessons' rule): the same first page object, no Trim dialog,
  // for half a second. Then the palette the sheet opened with is the baseline.
  function sheetSettled() {
    if (!sheetOpen() || modalUp('preparePdfModal')) { settled = null; return false; }
    const first = S().pages[0];
    if (settled !== first) { settled = first; settledAt = Date.now(); return false; }
    if (Date.now() - settledAt < 500) return false;
    if (!base) base = { counters: new Set((S().counters || []).map((c) => c.id)), lineTypes: new Set((S().lineTypes || []).map((l) => l.id)), groups: new Set((S().groups || []).map((g) => g.id)), groupsEnabled: !!S().groupsEnabled };
    if (resumeTo != null && !restoring) { const n = resumeTo; restoreUpTo(n); return false; }   // lands on the saved step itself
    return !restoring;
  }

  // ----- doing things for the reader (the spec seam) ------------------------------------------
  const dirty = () => { App.markProjectDirty(); App.updateUI(); App.renderAnnotations(); };
  function makeCounter() {
    if (counter()) return counter();
    const c = { id: App.uid(), name: 'Fixture', icon: K().firstIcon(), color: '#4a9eff' };
    K().pushCounter(c);
    return c;
  }
  function makeLineType() {
    if (lineType()) return lineType();
    const lt = { id: App.uid(), name: 'Pipe', color: '#47c88e', curveStyle: 'straight' };
    K().pushLineType(lt);
    return lt;
  }
  function pushQuickLine(a, b) {
    const lt = makeLineType();
    const canvas = App.ensureActiveCanvas(page0());
    App.pushUndoSnapshotCurrentPage();
    if (!canvas.annotations.quickLines) canvas.annotations.quickLines = [];
    canvas.annotations.quickLines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: lt.color, id: App.uid(), lineTypeId: lt.id, group: S().activeGroupId || null });
    S().tool = App.TOOL.NONE;
    dirty();
  }
  function pushPolyline(points) {
    const lt = makeLineType();
    const canvas = App.ensureActiveCanvas(page0());
    App.pushUndoSnapshotCurrentPage();
    if (!canvas.annotations.polylines) canvas.annotations.polylines = [];
    canvas.annotations.polylines.push({ id: App.uid(), name: 'Run', color: lt.color, points: points.map((p) => ({ x: p.x, y: p.y })), closed: false, lineTypeId: lt.id, group: S().activeGroupId || null });
    S().tool = App.TOOL.NONE;
    dirty();
  }
  function pushRect(key, rect, extra) {
    const canvas = App.ensureActiveCanvas(page0());
    App.pushUndoSnapshotCurrentPage();
    if (!canvas.annotations[key]) canvas.annotations[key] = [];
    canvas.annotations[key].push(Object.assign({ x1: rect.x1, y1: rect.y1, x2: rect.x2, y2: rect.y2, id: App.uid() }, extra || {}));
    S().tool = App.TOOL.NONE;
    dirty();
  }
  // A latch is written by the step's check, which the engine runs on its 400 ms tick: an action
  // that passes through a state (zoomed in, folded, the ledger open) lets the check see it first.
  const tick = () => { if (App.onTutorialTick) App.onTutorialTick(); };
  async function pressTwice(id, gap) { const b = el(id); if (!b) return; b.click(); await wait(gap || 350); tick(); b.click(); await wait(80); tick(); }
  const ACT = {
    async scale() { await K().applyScalePreset('1/8" = 1\'', PPU); },
    async measure() {
      if (!scaleIs(PPU)) await ACT.scale();
      const s = S();
      s.tool = App.TOOL.MEASURE; s.scaleMode = App.SCALE_MODES.POINT_A; s.scalePointA = null; s.scalePointB = null;
      App.commitMeasurePoint(DIM[0], { fromAim: true }); App.commitMeasurePoint(DIM[1], { fromAim: true });
      s.tool = App.TOOL.NONE; App.updateUI(); App.renderAnnotations();
    },
    move() { const s = S(); s.tool = App.TOOL.NONE; s.pan = { x: (s.pan ? s.pan.x : 0) + 40, y: (s.pan ? s.pan.y : 0) + 24 }; App.renderPdf(); App.updateUI(); },
    counter() { makeCounter(); },
    count() { const c = makeCounter(); const have = K().markZones(0, c.id, FIX, 16).filter((z) => z.done).length; K().placeMarkers(c.id, FIX.slice(have)); },
    quickkeys() { const c = makeCounter(); if (!S().numberKeyBindings) S().numberKeyBindings = {}; S().numberKeyBindings[1] = { kind: 'counter', id: c.id }; if (!K().markZones(0, c.id, [KEY], 16)[0].done) K().placeMarkers(c.id, [KEY]); dirty(); },
    linetype() { if (!lineClose()) pushQuickLine(LINE[0], LINE[1]); },
    snap() { const s = S(); if (!(s.lineTypeSettings && s.lineTypeSettings.snapToHorizontalVertical)) el('lineTypeSnapToHVHeaderBtn').click(); },
    polyline() { if (!K().allDone(K().pathZones(POLY, 16, polyPaths(false)))) pushPolyline(POLY); },
    chain() { const c = makeCounter(), lt = makeLineType(); if (!chainedRun()) K().chainPoints(c.id, lt.id, CHAIN); },
    drop() {
      const a = ann(); if (!a) return;
      if (!chainedRun()) ACT.chain();
      if (!dropAt(CHAIN[0], 16)) {
        const nodes = App.collectDropNodes(ann(), 1) || [];
        let best = null, bd = Infinity;
        nodes.forEach((n) => { const d = Math.hypot(n.x - CHAIN[0].x, n.y - CHAIN[0].y); if (d < bd) { bd = d; best = n; } });
        if (best && App.applyDropToNode(ann(), best, 3, 'ft', true)) {
          App.pushUndoSnapshotCurrentPage();
          App.applyDropToNode(ann(), best, 3, 'ft');
          App.pushRecentDrop && App.pushRecentDrop(3, 'ft');
          dirty();
        }
      }
      if (!S().showDropSizes && App.toggleDropSizes) App.toggleDropSizes();
    },
    async duct() {
      if (K().allDone(K().pathZones(DUCT, 18, ductPaths(false)))) return;
      const s = S();
      if (s.drawingDuct && App.clearDuctDraft) App.clearDuctDraft();
      if (el('ductBtn')) el('ductBtn').click();
      await wait(120);
      if (el('ductCreateStart')) el('ductCreateStart').click();
      await wait(60);
      if (!s.drawingDuct) return;
      App.commitDuctClick(DUCT[0]); App.commitDuctClick(DUCT[1]); App.finishDuctRun();
      s.tool = App.TOOL.NONE; App.updateUI(); App.renderAnnotations();
    },
    highlight() { if (!K().boxZone(rects('highlights'), HL_IN, HL_OUT).done) pushRect('highlights', K().grow(HL_IN, 12), { color: '#e8c547', opacity: 0.25 }); },
    multiply() { if (!K().boxZone(rects('multiplyZones', (z) => (z.multiplier || 1) > 1), MZ_IN, MZ_OUT).done) pushRect('multiplyZones', K().grow(MZ_IN, 16), { multiplier: 2 }); },
    scalezone() { if (!K().boxZone(rects('scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 18) < 0.1), SZ_IN, SZ_OUT).done) pushRect('scaleZones', K().grow(SZ_IN, 12), { scale: { pixelsPerUnit: 18, unit: 'ft', label: '1/4" = 1\'' } }); },
    async room() {
      if (K().boxZone(rects('roomBoxes'), ROOM_IN, ROOM_OUT).done) return;
      if (!App.openRoomBoxModal) return;
      App.openRoomBoxModal(K().grow(ROOM_IN, 12));
      await wait(80);
      const grp = el('roomBoxNewRoomNameGroup');
      if (grp && grp.style.display === 'none' && el('roomBoxNewRoomBtn')) { el('roomBoxNewRoomBtn').click(); await wait(50); }
      if (el('roomBoxNewRoomName')) el('roomBoxNewRoomName').value = 'Office';
      if (el('roomBoxHeight')) el('roomBoxHeight').value = '9';
      await wait(30);
      if (el('roomBoxApply')) el('roomBoxApply').click();
      S().tool = App.TOOL.NONE; App.updateUI(); App.renderAnnotations();
    },
    ghost() {
      if (ghosts().length) return;
      const a = ann(); if (!a) return;
      if (!K().allDone(K().markZones(0, cid(), FIX, 16))) ACT.count();
      const r = K().grow(HL_IN, 12);
      const g = App.captureGhostFromRect(ann(), 0, r.x1, r.y1, r.x2, r.y2, 'Typical');
      if (!g) return;
      App.translateGhost(g, GHOST_DROP.x - (r.x1 + r.x2) / 2, GHOST_DROP.y - (r.y1 + r.y2) / 2);
      App.pushUndoSnapshot();
      const canvas = App.ensureActiveCanvas(page0());
      if (!Array.isArray(canvas.annotations.ghosts)) canvas.annotations.ghosts = [];
      canvas.annotations.ghosts.push(g);
      S().tool = App.TOOL.NONE;
      dirty();
    },
    deletearea() {
      const a = ann(); if (!a || !markNearKey()) return;
      App.pushUndoSnapshotCurrentPage();
      Object.keys(a.counterMarkers || {}).forEach((k) => { a.counterMarkers[k] = (a.counterMarkers[k] || []).filter((m) => !near(m, KEY, 30)); });
      S().tool = App.TOOL.NONE;
      dirty();
    },
    async note() {
      if (!noteAt(NOTE_SPOT, 45)) {
        const p = page0(); const canvas = App.ensureActiveCanvas(p);
        App.pushUndoSnapshotCurrentPage();
        if (!canvas.annotations.notes) canvas.annotations.notes = [];
        canvas.annotations.notes.push({ x: NOTE_SPOT.x, y: NOTE_SPOT.y, text: 'A note to myself', id: App.uid(), width: 150, fontSize: 14, placementRotation: p.rotation ?? 0, color: '#e85447' });
        S().tool = App.TOOL.NONE;
        dirty();
      }
      if (!seen.ledger && el('notesLedgerBtn')) { el('notesLedgerBtn').click(); await wait(700); tick(); }
      if (ledgerOpen() && el('notesLedgerBtn')) { el('notesLedgerBtn').click(); await wait(100); tick(); }
    },
    async toggles() {
      if (!(seen.legendOff && S().showLegendOverlay)) await pressTwice('legendBtn');
      if (!(seen.gridOn && !S().showGridOverlay)) { el('gridBtn').click(); await wait(150); if (el('gridSettingsApply')) el('gridSettingsApply').click(); await wait(350); tick(); el('gridBtn').click(); await wait(80); tick(); }
      if (!(seen.marksHidden && !S().hideMarks)) await pressTwice('hideMarksBtn');
    },
    async undo() { if (!(el('undoBtn') && !el('undoBtn').disabled)) return; el('undoBtn').click(); await wait(250); tick(); el('redoBtn').click(); await wait(80); tick(); },
    async layers() {
      const p = page0(); if (!p) return;
      if ((p.canvases || []).length < 2) {
        el('addCanvasBtn').click(); await wait(80);
        if (el('addCanvasModalNew')) el('addCanvasModalNew').click();
        if (el('addCanvasModalName')) el('addCanvasModalName').value = 'Alternate 1';
        if (el('addCanvasModalCreate')) el('addCanvasModalCreate').click();
        await wait(80);
      }
      if (!activeCanvasIsMain()) { S().activeCanvasIdByPage[0] = p.canvases[0].id; App.updateUI(); App.renderAnnotations(); }
    },
    async pages() {
      if (!seen.page2) { el('nextPage').click(); await wait(300); tick(); }
      if (!seen.rotated) { el('rotatePage').click(); await wait(300); tick(); }
      if (S().currentPage !== 0) { el('prevPage').click(); await wait(300); tick(); }
    },
    async zoom() { tick(); el('zoomIn').click(); await wait(250); tick(); el('zoomFit').click(); await wait(80); tick(); },
    async sidebar() {
      if (narrow()) { document.body.classList.add('sidebar-open'); await wait(300); tick(); document.body.classList.remove('sidebar-open'); tick(); }
      else await pressTwice('headerLogo', 400);
    },
    async groups() {
      if (group()) return;
      if (!S().groupsEnabled) { if (App.turnOnGroups) App.turnOnGroups(); else S().groupsEnabled = true; }
      if (App.openGroupModal) {
        App.openGroupModal(null); await wait(60);
        el('groupModalName').value = 'Area A'; el('groupModalDone').click(); await wait(80);
      }
      App.updateUI();
    },
    summary() { const c = counter() || (S().counters || [])[0]; if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); },
    bidcheck() { S().bidCheckCollapsed = false; App.renderBidCheck && App.renderBidCheck(); },
    settings() { el('settingsGearBtn').click(); },
    savestatus() { el('saveStatusBtnHeader').click(); },
    async exportmenu() { if (narrow()) { el('headerBurger').click(); await wait(250); tick(); el('headerBurger').click(); } else el('exportDropdownBtn').click(); await wait(250); },
    async clearpage() { if (!activeMarks()) return; if (App.showClearPageModal) App.showClearPageModal(); await wait(80); if (el('clearPageConfirm')) el('clearPageConfirm').click(); await wait(80); },
    async close() { App.closeProject({ route: 'tour' }); await wait(250); if (modalUp('confirmModal') && el('confirmOk')) el('confirmOk').click(); await wait(300); },
  };

  // ----- the steps ----------------------------------------------------------------------------
  const MORE = ' It may sit behind [[⋯]].';
  // …on a desk. A tablet has no ⋯: its header strip scrolls sideways instead.
  const more = () => (narrow() ? ' The header strip scrolls sideways if it is out of view.' : MORE);
  // A tablet (the app's breakpoint, 768 px inclusive) keeps several of these controls
  // elsewhere: the sidebar behind ☰, the status-bar links gone, a few header buttons under
  // the ☰ at the top right. A step whose door moves says so, live (the engine renders a body
  // that is a function every tick), and lights that door.
  const narrow = () => { try { return window.matchMedia('(max-width: 768px)').matches; } catch (_) { return window.innerWidth <= 768; } };
  const burgerOpen = () => document.body.classList.contains('right-menu-open');
  const drawerOpen = () => document.body.classList.contains('sidebar-open');
  const STEPS = [
    {
      id: 'welcome', title: 'Every button, on a blank sheet', kind: 'do',
      body: 'No plan, no trade, no numbers to get right: a blank sheet, and every button in the header, on the sheet, in the footer and in the sidebar, pressed once. About fifteen minutes. Skip any step you already know. Nothing here touches your projects.\n1. Click [[Open a blank sheet]] below.',
      target: ['#uploadPdf', '#uploadPdfSidebar'],
      check: () => sheetSettled(),
      handsOff: true,   // making the sheet is the app's job: this step's button does it
      action: { label: 'Open a blank sheet', run: openBlankSheet },
    },
    {
      id: 'scale', title: 'Header: Set Scale', kind: 'do',
      body: 'Every length the app reports hangs off this. The title block on this sheet says 1/8" = 1\'-0".\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/8" = 1\']].\nWhen a title block gives no scale, the other tab takes two clicks on a dimension you can read.',
      target: ['#setScale', '#setScaleSidebar'],
      check: () => scaleIs(PPU),
      action: { label: 'Use 1/8" = 1\'-0"', run: ACT.scale },
    },
    {
      id: 'measure', title: 'Header: Measure', kind: 'do',
      hold: true,   // the reading is the lesson: the card shows it and waits for Next
      body: () => (proveDim().check()
        ? proveDim().verdict() + ': the scale is right.\nDo this on every real sheet before you trust a number: a plan printed to the wrong paper size looks right and measures short.\n1. Click [[Next]].'
        : '1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at the left end of the 20\'-0" line.\n3. Click inside circle 2, at its right end.'),
      target: ['#measureBtn', '#measureBtnSidebar'], page: 0,
      zones: () => proveDim().zones(),
      check: () => proveDim().check(),
      hint: () => proveDim().hint(),
      action: { label: 'Measure the 20\'-0" line', run: ACT.measure },
    },
    {
      id: 'move', title: 'Header: Move', kind: 'do',
      body: 'Move is the tool you rest in. It drags the sheet, and it drags a mark you put in the wrong place.\n1. In the header, click [[Move]] (or press M).\n2. Drag the sheet a little.\nThe mouse wheel zooms where the pointer is, and Esc from any tool brings you back here.',
      target: ['#moveBtn', '#moveBtnSidebar'],
      check: () => { const s = S(); const p = s.pan || { x: 0, y: 0 }; if (!moveBase) { moveBase = { x: p.x, y: p.y, zoom: s.zoom }; return false; } const moved = Math.hypot(p.x - moveBase.x, p.y - moveBase.y) > 8 || Math.abs((s.zoom || 0) - (moveBase.zoom || 0)) > 0.01; return s.tool === App.TOOL.NONE && moved; },
      progress: () => (S().tool !== App.TOOL.NONE ? '' : 'Now drag the sheet'),
      action: { label: 'Nudge the sheet for me', run: ACT.move },
    },
    {
      id: 'counter', title: 'Header: Counter', kind: 'do',
      body: '1. In the left sidebar, under COUNTERS, click [[+ Add]].\n2. Click the [[Create]] tab.\n3. In Name, type Fixture.\n4. Pick a symbol and a colour.\n5. Click [[Create Counter]].\nThe [[Quick]] tab builds the name from your trade\'s pickers instead. Either way the Counter tool arms itself; [[Counter]] in the header (or C) is how you come back to it. The funnel beside the search box narrows a long palette to what this sheet uses.',
      target: ['#counterCreate', '#counterModal .counter-tab[data-tab="create"]', '#addCounter'],
      check: () => !!counter(),
      action: { label: 'Create it for me', run: ACT.counter },
    },
    {
      id: 'count', title: 'Count three', kind: 'do',
      body: 'The Counter tool is armed with your new counter. Three circles sit on the sheet.\n1. Click inside each circle.\nOne click, one tally; the count beside the counter in the sidebar moves as you go. A click outside a circle does not count here.',
      target: ['#annCanvas'], page: 0,
      zones: () => K().markZones(0, cid(), FIX, 16),
      check: () => K().allDone(K().markZones(0, cid(), FIX, 16)),
      hint: () => (counter() && K().strayMarks(0, cid(), K().markZones(0, cid(), FIX.concat([KEY], CHAIN), 16)) ? 'A mark outside the circles does not count. Press Ctrl+Z to undo it, then click inside a circle' : ''),
      action: { label: 'Count three for me', run: ACT.count },
    },
    {
      id: 'quickkeys', title: 'Footer: quick keys', kind: 'do',
      body: () => (narrow()
        ? '1. Tap ☰ at the top left, then the gear at the top of the sidebar ([[Project Settings]]).\n2. Beside Quick keys, tap [[Edit]]. Beside key 1, choose your counter. Close the dialog.\n3. With a keyboard attached, press 1 and the counter arms; without one, tap the counter in the sidebar.\n4. Tap inside the circle.\nOn a desk the number row is the rhythm: 1, click, click, 2, click, click.'
        : '1. In the status bar at the bottom right, click [[quick keys]].\n2. Beside key 1, choose your counter. Close the dialog.\n3. Press M, then 1: the counter arms again from the keyboard.\n4. Click inside the circle.\nOn a real sheet that is the rhythm: 1, click, click, 2, click, click.'),
      target: ['#quickKeysModal .modal-card', '#statusBarQuickKeys', '#settingsQuickKeys', '#settingsGearBtn', '#sidebarLogoGear'], page: 0,
      zones: () => K().markZones(0, cid(), [KEY], 16),
      check: () => { const c = counter(); return !!c && Object.values(S().numberKeyBindings || {}).some((b) => b && b.id === c.id) && K().allDone(K().markZones(0, c.id, [KEY], 16)); },
      hint: () => (counter() ? '' : 'Make a counter first (go Back one step)'),
      progress: () => { const c = counter(); if (!c) return ''; const bound = Object.values(S().numberKeyBindings || {}).some((b) => b && b.id === c.id); return bound ? 'Bound. Now press 1 and click inside the circle' : ''; },
      action: { label: 'Bind 1 and count it', run: ACT.quickkeys },
    },
    {
      id: 'linetype', title: 'Header: Quick Line', kind: 'do',
      body: 'A line type is to a run what a counter is to a mark.\n1. In the left sidebar, under LINE TYPES, click [[+ Add]].\n2. In Name, type Pipe. Pick a colour.\n3. Click [[Create Line Type]].\n4. The line tool arms itself ([[Quick Line]] in the header, or L). Click the centre of one circle, then the other.\nA run\'s footage is measured between your two clicks, so these circles are tight: the run should read ' + feetText(LINE_FT) + ' in the sidebar. Aim, or zoom in first.',
      target: ['#lineTypeCreate', '#addLineType'], page: 0,
      zones: () => LINE.map((p) => ({ kind: 'circle', x: p.x, y: p.y, r: LINE_R, done: lineClose() })),
      check: () => !!lineType() && lineClose(),
      hint: () => { const l = lineRun(); if (!l || lineClose()) return ''; return 'That run reads ' + feetText(lineFeet(l)) + ', not ' + feetText(LINE_FT) + '. Press Ctrl+Z and land closer to the centres'; },
      progress: () => (lineType() && !lineRun() ? 'Line type made. Now click the centre of the first circle, then the second' : ''),
      action: { label: 'Make Pipe and draw the line', run: ACT.linetype },
    },
    {
      id: 'snap', title: 'Header: Snap to 45°', kind: 'do',
      body: () => 'Runs on a plan are square. With snap on, a line you draw holds to horizontal, vertical or 45°, however your hand wobbles.\n' + (narrow()
        ? '1. Tap ☰ at the top left, then the LINE TYPES heading in the sidebar: Line Type Settings opens.\n2. Turn on [[Snap to 45° angles]] and close the dialog.\n'
        : '1. In the header, click [[Snap to 45° angles]] (or press J) so it lights.\n') + 'It is a device setting, not a project one; the tour puts it back the way it was when you leave.',
      target: ['#lineTypeSnapToHVBtn', '#lineTypeSnapToHVHeaderBtn', '#lineTypesSectionTitle'],
      check: () => !!(S().lineTypeSettings && S().lineTypeSettings.snapToHorizontalVertical),
      action: { label: 'Turn snap on', run: ACT.snap },
    },
    {
      id: 'polyline', title: 'Header: Polyline', kind: 'do',
      body: () => 'A run with corners.\n' + (narrow()
        ? '1. Tap ☰ at the top left, then [[Polyline]] in the sidebar\'s tool row.\n2. Tap inside the first circle, the second, then the third.\n3. Tap [[Finish]].\nEvery corner is a fitting the run can count for you; press and hold a corner to say what it is.'
        : '1. In the header, click [[Polyline]] (or press P).' + MORE + '\n2. Click inside the first circle, the second, then the third.\n3. Press Enter.\nEvery corner is a fitting the run can count for you; right-click a corner to say what it is.'),
      target: ['#polylineBtn', '#polylineBtnSidebar', '#headerMoreBtn'], page: 0,
      zones: () => K().pathZones(POLY, 16, polyPaths(true)),
      check: () => K().allDone(K().pathZones(POLY, 16, polyPaths(false))),
      progress: () => (S().drawingPolyline && K().allDone(K().pathZones(POLY, 16, polyPaths(true))) ? (narrow() ? 'Now tap Finish' : 'Now press Enter to finish the run') : ''),
      action: { label: 'Trace it for me', run: ACT.polyline },
    },
    {
      id: 'chain', title: 'Header: Chain', kind: 'do',
      body: 'Fixtures and the pipe between them in one pass.\n1. In the header, click [[Chain]] (or press T).\n2. In the Chain panel, pick your counter and your line type.\n3. Click inside the first circle, then the second.\nEach click places a mark and draws the run back to the one before.',
      target: ['#chainPanel', '#chainBtn'], page: 0,
      zones: () => K().markZones(0, cid(), CHAIN, 16),
      check: () => K().allDone(K().markZones(0, cid(), CHAIN, 16)) && chainedRun(),
      action: { label: 'Chain the two for me', run: ACT.chain },
    },
    {
      id: 'drop', title: 'Header: Drop, and Drop sizes', kind: 'do',
      body: () => 'Plan view never shows the vertical.\n1. In the header, click [[Drop]] (or press B).\n2. In the palette, choose 3 ft.\n3. Click the end of the chained run inside the circle.\n4. ' + (narrow() ? 'Tap the ☰ at the top right ([[More actions]]), then [[Drop sizes]],' : 'In the header, click [[Drop sizes]]') + ' so every drop wears its number on the sheet.\nThe 3 ft joins the run\'s footage in the sidebar.',
      target: ['#dropSizesBtn', '#dropPanel', '#dropBtn', '#headerBurger'], page: 0,
      zones: () => [{ kind: 'circle', x: CHAIN[0].x, y: CHAIN[0].y, r: 16, done: dropAt(CHAIN[0], 16) }],
      check: () => dropAt(CHAIN[0], 16) && !!S().showDropSizes,
      hint: () => (!dropAt(CHAIN[0], 16) && anyDrop() ? 'That drop is on another end. Click the same end again to clear it, then click the end inside the circle' : ''),
      progress: () => (dropAt(CHAIN[0], 16) && !S().showDropSizes ? (narrow() ? 'Drop set. Now Drop sizes, under the ☰ at the top right' : 'Drop set. Now click Drop sizes in the header') : ''),
      action: { label: 'Add 3 ft and show the sizes', run: ACT.drop },
    },
    {
      id: 'duct', title: 'Header: Duct', kind: 'do',
      body: () => 'The sheet-metal run: drawn at its size, weighed by the foot.\n1. In the header, click [[Duct]] (or press U).' + (narrow() ? '' : MORE) + '\n2. Leave the size and click [[Start Tracing]].\n3. Click inside the first circle, then the second.\n4. ' + (narrow() ? 'Tap [[Finish Duct Run]].' : 'Press Enter.') + '\nThe DUCT section in the sidebar gets a Schedule: pounds, gauge and fittings from the SMACNA tables.',
      target: ['#ductCreateStart', '#ductBtn', '#headerMoreBtn'], page: 0,
      zones: () => K().pathZones(DUCT, 18, ductPaths(true)),
      check: () => K().allDone(K().pathZones(DUCT, 18, ductPaths(false))),
      progress: () => (S().drawingDuct && K().allDone(K().pathZones(DUCT, 18, ductPaths(true))) ? (narrow() ? 'Now tap Finish Duct Run' : 'Now press Enter to finish the run') : ''),
      action: { label: 'Trace it for me', run: ACT.duct },
    },
    {
      id: 'highlight', title: 'Header: Highlight', kind: 'do',
      body: () => '1. In the header, click [[Highlight]] (or press H).' + more() + '\n2. Drag a box over the three marks, inside the shaded boundary.\nA highlight is a marker pen, never a count. The panel that opens picks its colour, and Highlight Pages (PDF) under EXPORT OPTIONS collects every highlighted sheet.',
      target: ['#highlightBtn', '#highlightBtnSidebar', '#headerMoreBtn'], page: 0,
      zones: () => [K().boxZone(rects('highlights'), HL_IN, HL_OUT, 'Drag your highlight over the three marks')],
      check: () => K().boxZone(rects('highlights'), HL_IN, HL_OUT).done,
      hint: () => K().boxMiss(rects('highlights'), HL_IN, HL_OUT),
      action: { label: 'Highlight them for me', run: ACT.highlight },
    },
    {
      id: 'multiply', title: 'Header: Multiply Zone', kind: 'do',
      body: () => 'Count a typical once and bid it many times.\n1. In the header, click [[Multiply Zone]] (or press X).' + more() + '\n2. Drag a box around the two chained marks, inside the shaded boundary.\n3. Type 2.\n4. Click [[Apply]].\nThe two marks and the run between them count double in every total while the sheet stays clean.',
      target: ['#multiplyZoneApply', '#multiplyZoneBtn', '#multiplyZoneBtnSidebar', '#headerMoreBtn'], page: 0,
      zones: () => [K().boxZone(rects('multiplyZones', (z) => (z.multiplier || 1) > 1), MZ_IN, MZ_OUT, 'Drag your box around the chained pair, anywhere in here')],
      check: () => K().boxZone(rects('multiplyZones', (z) => (z.multiplier || 1) > 1), MZ_IN, MZ_OUT).done,
      hint: () => K().boxMiss(rects('multiplyZones'), MZ_IN, MZ_OUT),
      action: { label: 'Wrap them in a ×2 zone', run: ACT.multiply },
    },
    {
      id: 'scalezone', title: 'Header: Scale Zone', kind: 'do',
      body: () => 'A detail drawn at another scale on the same sheet.\n1. In the header, click [[Scale Zone]].' + more() + '\n2. Drag a box inside the shaded boundary.\n3. In the dialog, click the [[Architectural & Engineering]] tab and choose [[1/4" = 1\']].\nInside the box every measurement is at 1/4"; the rest of the sheet stays at 1/8".',
      target: ['#scaleModalTabs .counter-tab[data-tab="presets"]', '#scaleZoneBtn', '#scaleZoneBtnSidebar', '#headerMoreBtn'], page: 0,
      zones: () => [K().boxZone(rects('scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 18) < 0.1), SZ_IN, SZ_OUT, 'Drag your scale zone anywhere in here')],
      check: () => K().boxZone(rects('scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 18) < 0.1), SZ_IN, SZ_OUT).done,
      hint: () => K().boxMiss(rects('scaleZones'), SZ_IN, SZ_OUT) || (rects('scaleZones').length && !rects('scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 18) < 0.1).length ? 'The box is right, the scale is not. Right-click its label, Edit scale, and choose 1/4" = 1\'' : ''),
      action: { label: 'Box it at 1/4"', run: ACT.scalezone },
    },
    {
      id: 'room', title: 'Header: Room Sizer', kind: 'do',
      body: () => '1. In the header, click [[Room Sizer]] (or press V).' + more() + '\n2. Drag a box inside the shaded boundary.\n3. In Name, type Office. In Ceiling, type 9.\n4. Click [[Apply]].\nThe room\'s area and volume land in the sidebar and the legend, and an HVAC bid reads its air from here.',
      target: ['#roomBoxApply', '#roomBtn', '#roomBtnSidebar', '#headerMoreBtn'], page: 0,
      zones: () => [K().boxZone(rects('roomBoxes'), ROOM_IN, ROOM_OUT, 'Drag your room anywhere in here')],
      check: () => K().boxZone(rects('roomBoxes'), ROOM_IN, ROOM_OUT).done && (S().rooms || []).length > 0,
      hint: () => K().boxMiss(rects('roomBoxes'), ROOM_IN, ROOM_OUT),
      action: { label: 'Box the room for me', run: ACT.room },
    },
    {
      id: 'ghost', title: 'Header: Ghost', kind: 'do',
      body: () => 'Copy a typical and lay it somewhere else as a see-through reference.\n1. In the header, click [[Ghost]] (or press G).' + more() + '\n2. Click one corner of a box around the three marks, then the opposite corner.\n3. The copy rides the pointer. Click inside the circle to drop it.\nA ghost is never counted. Right-click it to stamp it as real marks, or to hide part of it.',
      target: ['#ghostBtn', '#headerMoreBtn'], page: 0,
      zones: () => [box(HL_IN, HL_OUT, ghosts().length, 'Box the three marks, corner to corner'), { kind: 'circle', x: GHOST_DROP.x, y: GHOST_DROP.y, r: 50, done: ghosts().length > 0 }],
      check: () => ghosts().length > 0,
      progress: () => (S().placingGhost ? 'Copied. Click inside the circle to drop it' : ''),
      action: { label: 'Copy and drop it for me', run: ACT.ghost },
    },
    {
      id: 'deletearea', title: 'Header: Delete area', kind: 'do',
      body: () => '1. In the header, click [[Delete area]].' + more() + '\n2. Click one corner of a box around the single mark inside the shaded boundary, then the opposite corner.\n3. Confirm.\nEverything the box caught goes at once, and Undo brings it back. Right-click a single mark to delete just that one.',
      target: ['#confirmOk', '#deleteZoneBtn', '#deleteZoneBtnSidebar', '#headerMoreBtn'], page: 0,
      zones: () => [box(DEL_IN, DEL_OUT, !markNearKey(), 'Box just this mark')],
      check: () => !markNearKey(),
      action: { label: 'Delete it for me', run: ACT.deletearea },
    },
    {
      id: 'note', title: 'Header: Note, and Notes ledger', kind: 'do',
      body: () => '1. In the header, click [[Note]] (or press N).' + (narrow() ? ' The strip scrolls; it is near the end.' : MORE) + '\n2. Click inside the circle.\n3. Type anything and click [[Done]].\n4. ' + (narrow()
        ? 'Tap the ☰ at the top right ([[More actions]]), then [[Notes ledger]]: every note on every sheet in one list. Close it with its ×.'
        : 'In the header, click [[Notes ledger]] to see every note on every sheet in one list, then close it with its ×.') + '\nA note that starts with RFI: is a question for the GC, and Copy RFI Flags collects them.',
      target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'], page: 0,
      zones: () => [{ kind: 'circle', x: NOTE_SPOT.x, y: NOTE_SPOT.y, r: 45, done: noteAt(NOTE_SPOT, 45) }],
      check: () => noteAt(NOTE_SPOT, 45) && latch('ledger', ledgerOpen()) && !ledgerOpen(),
      progress: () => (noteAt(NOTE_SPOT, 45) ? (!seen.ledger ? (narrow() ? 'Note placed. Now Notes ledger, under the ☰ at the top right' : 'Note placed. Now click Notes ledger in the header') : (ledgerOpen() ? 'That is the ledger. Close it with its ×' : '')) : ''),
      action: { label: 'Write one and open the ledger', run: ACT.note },
    },
    {
      id: 'toggles', title: 'Header: three ways to see the sheet', kind: 'do',
      body: () => 'Three buttons that change what you see, never what you counted. ' + (narrow() ? 'The first two are at the end of the header strip; scroll it sideways.' : 'The first two may sit behind [[⋯]].') + '\n1. Click [[Summary legend]] to take the legend off the sheet, and again to bring it back.\n2. Click [[Grid overlay]]: its settings open, so click [[Apply]] for a 3 ft grid over the sheet. Click [[Grid overlay]] again to clear it.\n3. ' + (narrow() ? 'Tap the ☰ at the top right ([[More actions]]), then [[Hide marks]] to read the bare sheet, and again to show the marks.' : 'Click [[Hide marks]], the eye, to read the bare sheet, and again to show the marks.') + '\n' + (narrow() ? 'Press and hold' : 'Right-click') + ' any of the three for its settings.',
      target: ['#gridSettingsApply', '#legendBtn', '#gridBtn', '#hideMarksBtn', '#headerBurger', '#headerMoreBtn'],
      check: () => { const s = S(); const a = latch('legendOff', !s.showLegendOverlay) && !!s.showLegendOverlay; const b = latch('gridOn', !!s.showGridOverlay) && !s.showGridOverlay; const c = latch('marksHidden', !!s.hideMarks) && !s.hideMarks; return a && b && c; },
      progress: () => { const s = S(); const left = []; if (!(seen.legendOff && s.showLegendOverlay)) left.push(seen.legendOff ? 'legend back on' : 'legend'); if (!(seen.gridOn && !s.showGridOverlay)) left.push(seen.gridOn ? 'grid off again' : 'grid'); if (!(seen.marksHidden && !s.hideMarks)) left.push(seen.marksHidden ? 'marks back' : 'hide marks'); return left.length && left.length < 3 ? 'Still to do: ' + left.join(', ') : ''; },
      action: { label: 'Press all three for me', run: ACT.toggles },
    },
    {
      id: 'undo', title: 'Footer: Undo and Redo', kind: 'do',
      body: '1. In the footer, click [[Undo]] (or press Ctrl+Z). The last thing you did comes off the sheet.\n2. Click [[Redo]] to put it back.\nThe app keeps a long undo stack, per sheet, for everything from one mark to a cleared page.',
      target: ['#undoBtn', '#redoBtn'],
      check: () => { const r = el('redoBtn'); return !!r && latch('redoLit', !r.disabled) && r.disabled; },
      progress: () => (seen.redoLit ? 'Undone. Now click Redo' : ''),
      action: { label: 'Undo and redo for me', run: ACT.undo },
    },
    {
      id: 'layers', title: 'Footer: layers', kind: 'do',
      body: () => 'One sheet can carry several layers, an alternate or an addendum kept apart from the base bid, each with its own totals.\n1. ' + (narrow() ? 'In the footer, tap [[Layers]] beside the layer name, then [[+ Add layer]].' : 'In the footer, beside the layer name, click [[Layers]], then [[+ Add layer]].') + '\n2. Click [[New empty layer]].\n3. In Name, type Alternate 1.\n4. Click [[Create]].\n5. ' + (narrow() ? 'Tap [[Layers]] again and pick Main.' : 'Press the up or down arrow key until the footer reads Main again.') + '\n' + (narrow() ? '' : 'The layers button beside the name lists them, and the one beside it shows every layer at once.'),
      target: ['#addCanvasModalCreate', '#canvasMenuAdd', '#addCanvasBtn', '#canvasLayersBtn'],
      check: () => { const p = page0(); return !!p && (p.canvases || []).length >= 2 && activeCanvasIsMain(); },
      progress: () => { const p = page0(); return p && (p.canvases || []).length >= 2 && !activeCanvasIsMain() ? (narrow() ? 'Layer made. Now Layers, then Main' : 'Layer made. Now press the up or down arrow until the footer reads Main') : ''; },
      action: { label: 'Add the layer for me', run: ACT.layers },
    },
    {
      id: 'pages', title: 'Footer: sheets, and Rotate', kind: 'do',
      body: 'This set has two sheets.\n1. In the footer, click › to go to SK-2 (or press the right arrow key).\n2. Click [[Rotate 90° right]] (or press R): the sheet turns, and every mark on it would turn with it.\n3. Click ‹ to come back to SK-1.\n[[Previous marked page]] and [[Next marked page]], the double arrows, skip to the sheets that carry marks, and the PAGES list in the sidebar names every sheet.',
      target: ['#nextPage', '#rotatePage', '#prevPage'],
      check: () => { const s = S(); const a = latch('page2', s.currentPage === 1); const b = latch('rotated', (s.pages || []).some((p) => (p.rotation || 0) !== 0)); return a && b && s.currentPage === 0; },
      progress: () => { const s = S(); if (!seen.page2) return ''; if (!seen.rotated) return 'On SK-2. Now click Rotate 90° right'; return s.currentPage !== 0 ? 'Turned. Now click ‹ to come back to SK-1' : ''; },
      action: { label: 'Go, turn and come back', run: ACT.pages },
    },
    {
      id: 'zoom', title: 'Footer: zoom', kind: 'do',
      body: () => '1. ' + (narrow() ? 'Pinch the sheet to zoom in.' : 'In the footer, click + to zoom in (or roll the wheel). The − beside it zooms out.') + '\n2. ' + (narrow() ? 'Tap' : 'Click') + ' [[Fit]] to see the whole sheet again.\nThe zoom percentage opens a rail of fixed stops; each is a size the app has already drawn, so the jump is instant.',
      target: ['#zoomIn', '#zoomFit'],
      // the zoom the step started at is the app's own fit (the sheet step before it ends on ‹, which fits);
      // Fit from anywhere lands at or under it
      check: () => { const z = S().zoom || 0; if (zoomBase == null) { zoomBase = z; return false; } const inn = latch('zoomedIn', z > zoomBase + 0.05); return inn && z <= zoomBase + 0.02; },
      progress: () => (seen.zoomedIn ? 'Zoomed in. Now click Fit' : ''),
      action: { label: 'Zoom in and fit', run: ACT.zoom },
    },
    {
      id: 'sidebar', title: 'Header: the sidebar', kind: 'do',
      body: () => (narrow()
        ? 'On a tablet the sidebar is a drawer, so the sheet has the whole screen.\n1. Tap ☰ at the top left: the sidebar slides over the sheet.\n2. Tap the sheet to put it away.'
        : 'The whole screen for the sheet when you need it.\n1. Click the CountTooling logo at the top left (or press the spacebar): the sidebar folds away.\n2. Click it again to bring the sidebar back.'),
      target: ['#headerSidebarToggle', '#headerLogo', '#hamburger'],
      check: () => (narrow()
        ? latch('drawer', drawerOpen()) && !drawerOpen()
        : latch('collapsed', document.body.classList.contains('sidebar-collapsed')) && !document.body.classList.contains('sidebar-collapsed')),
      progress: () => (narrow() ? (seen.drawer && drawerOpen() ? 'Open. Now tap the sheet to put it away' : '') : (seen.collapsed && document.body.classList.contains('sidebar-collapsed') ? 'Folded. Click the logo again' : '')),
      action: { label: 'Fold and unfold it', run: ACT.sidebar },
    },
    {
      id: 'groups', title: 'Sidebar: Groups', kind: 'do',
      body: () => 'A group subtotals whatever you put in it: a room, a floor, a circuit, a system.\n1. ' + (narrow() ? 'Tap ☰ at the top left, then the gear at the top of the sidebar ([[Project Settings]]), and turn on [[Use groups]]. Close the dialog.' : 'In the header, click the gear ([[Project Settings]]) and turn on [[Use groups]]. Close the dialog.') + '\n2. In the left sidebar, under GROUPS, click [[+ Add]].\n3. In Name, type Area A. Click [[Done]].\nClick a group in the sidebar and everything you place after that joins it; ' + (narrow() ? 'press and hold' : 'right-click') + ' a mark to move it. [[Show group colors]] paints every mark in its group\'s colour.',
      target: ['#groupModalDone', '#settingsUseGroupsBtn', '#addGroup', '#groupsSectionTitle', '#settingsGearBtn', '#sidebarLogoGear'],
      check: () => !!group(),
      progress: () => (S().groupsEnabled ? 'Groups are on. Now + Add under GROUPS' : ''),
      action: { label: 'Turn Groups on and make one', run: ACT.groups },
    },
    {
      id: 'summary', title: 'Sidebar: Summary', kind: 'do', hold: true,
      body: 'The Summary is the takeoff so far: counts, feet by line type, rooms, duct.\n1. In the left sidebar, under SUMMARY, click your counter\'s total.\nThe breakdown says where every mark sits, sheet by sheet, with the multiply zone already applied. The SUMMARY heading itself opens the legend\'s settings.',
      target: ['#summaryList .summary-item-clickable', '#summarySectionTitle'],
      check: () => modalUp('summaryCountDetailModal'),
      action: { label: 'Open the breakdown', run: ACT.summary },
    },
    {
      id: 'bidcheck', title: 'Sidebar: Bid Check', kind: 'do',
      onEnter: () => K().foldBidCheck(), hold: true, body: '1. In the left sidebar, click BID CHECK to expand it.\nThe rows the app can judge (a scale on every sheet, marks reached by runs, fill, air) judge themselves; the rest are yours to tick. It never blocks an export; it says what is still open.',
      target: ['#bidCheckSectionTitle'],
      check: () => S().bidCheckCollapsed === false,
      action: { label: 'Open it', run: ACT.bidcheck },
    },
    {
      id: 'settings', title: 'Header: Project Settings', kind: 'do', hold: true,
      body: () => '1. ' + (narrow() ? 'Tap ☰ at the top left, then the gear at the top of the sidebar ([[Project Settings]]).' : 'In the header, click the gear ([[Project Settings]]).') + '\nEverything about this project lives here: its name and trade, the ceiling height, groups, the legend, and under Help the guides, the lessons and these tours.\n2. Close the dialog.',
      target: ['#settingsGearBtn', '#sidebarLogoGear'],
      check: () => latch('settings', modalUp('settingsModal')),
      action: { label: 'Open it for me', run: ACT.settings },
    },
    {
      id: 'savestatus', title: 'Header: Save status', kind: 'do', hold: true,
      body: () => '1. ' + (narrow() ? 'Open [[Project Settings]] again (☰, then the gear) and tap [[Save status]].' : 'In the header, click the bell ([[Save status]]).') + '\nIt says where your work is: the backup this device keeps every few seconds, and the cloud copy once you sign in and save. Green is safe.\n2. Close it.',
      target: ['#saveStatusBtn', '#saveStatusBtnHeader', '#settingsGearBtn', '#sidebarLogoGear'],
      check: () => latch('savestatus', modalUp('saveStatusModal')),
      action: { label: 'Open it for me', run: ACT.savestatus },
    },
    {
      id: 'exportmenu', title: 'Header: Export', kind: 'do',
      body: () => (narrow()
        ? '1. Tap the ☰ at the top right ([[More actions]]).\nUnder Export: Export Canvas is your marks as a file you can lay back on the same PDF later; Original PDF is the clean sheet; Export Both is the pair. Download saves the sheet you are on as a marked-up PDF, and Close project lives here too.\n2. Tap the sheet to close the menu.'
        : '1. In the header, click [[Export project]], the download arrow.\nExport Canvas is your marks as a file you can lay back on the same PDF later; Original PDF is the clean sheet; Export Both is the pair. Close project lives here too. On a phone this arrow saves the sheet you are on as a marked-up PDF.\n2. Click anywhere else to close the menu.'),
      target: ['#exportDropdownBtn', '#headerBurger'],
      check: () => { const m = el('exportDropdownMenu'); return latch('exportmenu', (!!m && m.classList.contains('visible')) || (narrow() && burgerOpen())); },
      action: { label: 'Open it for me', run: ACT.exportmenu },
    },
    {
      id: 'share', title: 'Header: Share, and Copy view link', kind: 'read',
      body: 'The two buttons this tour cannot press. They work on a project saved to the cloud, and this sheet stays on your device on purpose.\n1. [[Share]] puts a read-only link to the takeoff on the clipboard, making one the first time. A GC opens it in a browser and sees the marked-up sheets and the totals, and can change nothing.\n2. [[Copy view link]] copies that same link again later.\nTo press them for real: [[Sign In]], open any bid, [[Save Project to Cloud]] under the gear, and both appear in the header beside the bell. The walk with a real bid is [Sharing and view links](/guides/sharing-and-view-links/), and the Saving and sharing lesson under [[Learn]] reads the whole signed-in half.',
      target: ['#headerShareBtn', '#copyViewLinkBtn', '#authBtn', '#sidebarLogoUser'],
      check: () => true,
    },
    {
      id: 'exports', title: 'Sidebar: Export Options', kind: 'read',
      body: 'Under EXPORT OPTIONS in the left sidebar, the deliverables:\n1. [[Show Report]]: the full breakdown, ready to print.\n2. [[Export PDFs]]: the marked-up sheets, with the report and the legend if you want them.\n3. [[Copy to /Tooling]]: the whole takeoff on the clipboard for the bid.\n4. [[Copy Summary (Email/Text)]], [[Copy RFI Flags]], [[Highlight Pages (PDF)]] and [[Note Pages (PDF)]] for the smaller hand-offs.',
      target: ['#exportOptionsSectionTitle'],
      check: () => true,
    },
    {
      id: 'clearpage', title: 'Sidebar: Clear Page', kind: 'do',
      body: 'Time to wipe the sheet.\n1. At the bottom of the left sidebar, click [[Clear Page]].\n2. Confirm.\nOnly this sheet\'s active layer is cleared; other layers and sheets keep theirs, and Undo brings it all back.',
      target: ['#clearPageConfirm', '#clearPageSidebar'],
      check: () => latch('hadMarks', activeMarks() > 0) && activeMarks() === 0,
      action: { label: 'Clear it for me', run: ACT.clearpage },
    },
    {
      id: 'close', title: 'Header: Close this project', kind: 'do',
      body: () => '1. ' + (narrow() ? 'Tap the ☰ at the top right ([[More actions]]), then [[Close project]].' : 'In the header, click the × ([[Close this project]]).') + '\n2. Confirm.\nThe sheet closes and the empty canvas comes back. A real project would still be in its local backup, and in the cloud if you had saved it.',
      target: ['#confirmOk', '#headerCloseProjectBtn', '#headerBurger'],
      check: () => !(S().pages || []).length,
      action: { label: 'Close it for me', run: ACT.close },
    },
    {
      id: 'done', title: 'That is every button', kind: 'read',
      body: 'Header, sheet, footer, sidebar: you have pressed them all once. The three trade tours put them to work on a sample plan, and the lessons go deeper on each, all under [[Learn]]. When you are ready, click [[Upload PDF]] and start on your own sheet.',
      target: [],
      check: () => true,
    },
  ];

  // ----- registration, the doors, the device -----------------------------------------------------
  const snapNow = () => !!(S().lineTypeSettings && S().lineTypeSettings.snapToHorizontalVertical);
  // The welcome card is one of two: a fresh start, or the offer to pick up where the reader
  // left off, with the earlier steps laid down for them, beside a start-over.
  const WELCOME = STEPS[0];
  const FRESH = { body: WELCOME.body, action: WELCOME.action };
  function offerResume(n) {
    const at = STEPS[n];
    if (!at) { WELCOME.body = FRESH.body; WELCOME.action = FRESH.action; delete WELCOME.alt; return; }
    WELCOME.body = 'You left this tour at step ' + (n + 1) + ' of ' + STEPS.length + ', ' + at.title + '. A blank sheet opens either way; nothing here touches your projects.\n1. Click [[Pick up where you left off]] to open the sheet with the earlier steps already done and carry on from step ' + (n + 1) + '.\n2. Or click [[Start over]] for the whole walk.';
    WELCOME.action = { label: 'Pick up where you left off', run: async () => { resumeTo = n; await openBlankSheet(); } };
    WELCOME.alt = { label: 'Start over', run: async () => { resumeTo = null; saveStep(0); offerResume(null); await openBlankSheet(); } };
  }
  App.registerTour(TOUR_ID, {
    steps: STEPS,
    doneKey: DONE_KEY,
    onStart() { seen = {}; base = null; moveBase = null; zoomBase = null; settled = null; resumeTo = null; restoring = false; snapBefore = snapNow(); offerResume(savedStep()); },
    onStep(id, index) { if (!restoring) saveStep(index); },
    onStop(finished) {
      if (finished) saveStep(0);
      if (snapBefore != null && snapNow() !== snapBefore && el('lineTypeSnapToHVHeaderBtn')) el('lineTypeSnapToHVHeaderBtn').click();
      snapBefore = null;
      sweepPalette();
      syncDoor();
    },
  });
  // The palette outlives a closed project (an Artboard rides into the next bid), so the Fixture,
  // the Pipe, the group and the key binding the tour asked for would follow the reader onto a real
  // sheet. When the tour stops on its own sheet, or after Close project, everything made since the
  // sheet opened goes; the reader's own palette (the baseline) is untouched. On a plan of their own
  // (the tour never opens over one without asking) nothing is swept.
  function sweepPalette() {
    const s = S();
    if (!base || !(!(s.pages || []).length || s.currentProjectName === SHEET_NAME)) return;
    const gone = new Set();
    s.counters = (s.counters || []).filter((c) => base.counters.has(c.id) || (gone.add(c.id), false));
    s.lineTypes = (s.lineTypes || []).filter((l) => base.lineTypes.has(l.id) || (gone.add(l.id), false));
    s.groups = (s.groups || []).filter((g) => base.groups.has(g.id) || (gone.add(g.id), false));
    Object.keys(s.numberKeyBindings || {}).forEach((k) => { const b = s.numberKeyBindings[k]; if (b && gone.has(b.id)) delete s.numberKeyBindings[k]; });
    if (!base.groupsEnabled && s.groupsEnabled && !(s.groups || []).length) s.groupsEnabled = false;
    if (s.activeCounterType && gone.has(s.activeCounterType)) s.activeCounterType = null;
    if (s.activeLineTypeId && gone.has(s.activeLineTypeId)) s.activeLineTypeId = null;
    if (s.activeGroupId && gone.has(s.activeGroupId)) s.activeGroupId = null;
    base = null;
    App.updateUI();
  }
  const isDone = () => { try { return !!localStorage.getItem(DONE_KEY); } catch (_) { return false; } };
  // The empty-canvas offer goes once the tour is finished on this device.
  function syncDoor() { const w = el('canvasEmptyHintBlank'); if (w) w.style.display = isDone() ? 'none' : ''; }
  const start = () => App.startTutorial(TOUR_ID);
  el('canvasEmptyHintTourBlank') && (el('canvasEmptyHintTourBlank').onclick = (e) => { e.preventDefault(); start(); });
  el('settingsTourBlank') && (el('settingsTourBlank').onclick = () => { App.hideModal('settingsModal'); start(); });
  el('learnTour-blank') && (el('learnTour-blank').onclick = () => { App.hideModal('learnModal'); start(); });
  syncDoor();
  App.startBlankTour = start;
  App.blankTourSteps = () => STEPS.map((s) => s.id);   // spec seam
  App.blankTourLatches = () => ({ seen: Object.assign({}, seen), zoomBase, moveBase, base: !!base, resumeTo, restoring, saved: savedStep() });   // spec seam: what the checks remember
})();
