/*
 * features/tutorial.js - the interactive walkthroughs: learn the app by doing a
 * small takeoff on the sample plan, one coach-marked step at a time. Two tours
 * share one engine — `electrical` (receptacles, conduit with conductors, chained
 * runs with the vertical, a circuit, Bid Check) and `plumbing` (prove the scale,
 * count the Men's room, a Quick Line, chain the lav battery, a riser drop,
 * hangers as child counts, a ×3 typical-floor zone, an RFI note, the proof
 * modal, the PipeTooling hand-off).
 *
 * A step is { id, title, body, kind, target (selector list), check(), action?, hint? }
 * (hint() is the status line while a doing-step's check is failing for a reason
 * worth naming — the prove-the-scale step says what it read).
 * The overlay spotlights the target (a box-shadow cutout that never intercepts
 * the pointer, so the real control stays clickable) and the card beside it says
 * what to do; `check()` reads the REAL app state and the step advances the
 * moment it is true — no fake widgets, no scripted clicks. Every doing-step
 * also offers "Do it for me", which performs the same change through the same
 * App.* entry points a click would, so a reader who only wants the tour of the
 * ideas still ends with a real takeoff on screen. Reading steps advance on Next.
 *
 * Both tours run on samples/sample-plan.pdf (fetched into #pdfInput like a
 * drop, so it goes through the normal intake; 1224 × 792 PDF points, the
 * restrooms Men 105 / Women 106 carry drawn water closets and lavatories; a
 * true ANSI B sheet at a true 1/8", so the Set Scale dialog shows no sheet-size
 * warning) and
 * nothing they do touches a cloud project: a tour refuses to start while a
 * cloud project is open. Progress is per session; a finished tour is
 * remembered per device under its own key (`clickcount-tour-done` electrical,
 * `clickcount-tour-done-plumbing`) so the empty-canvas hint stops offering
 * THAT tour and keeps offering the other. Entry points: the hint's two links,
 * Project Settings → "plumbing tour" / "electrical tour", and ?tour=plumbing /
 * ?tour=electrical (?tour=1 still means electrical).
 *
 * Registrations: startTutorial(id), stopTutorial(), isTutorialActive(),
 * onTutorialTick() (updateUI + a 400 ms interval re-evaluate the step),
 * tutorialStepId() / tutorialId() / tutorialGoTo(id) (specs).
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const SAMPLE_PLAN = '/samples/sample-plan.pdf';

  let active = false;
  let tourId = 'electrical';
  let STEPS = [];
  let stepIdx = 0;
  let timer = null;
  let doneAt = 0;          // when the current step's check first passed (auto-advance after a beat)
  let tourCounterId = null;
  let tourLineTypeId = null;
  let tourSecondCounterId = null;

  const q = (sels) => { for (const s of [].concat(sels)) { const el = document.querySelector(s); if (el && el.offsetParent !== null) return el; } return null; };
  const state = () => App.state;
  const ann = () => (state().pages && state().pages.length ? App.getActiveAnnotations(state().pages[state().currentPage]) : null);
  const markCount = (cid) => { let n = 0; (state().pages || []).forEach((p) => { const a = App.getActiveAnnotations(p); n += ((a && a.counterMarkers && a.counterMarkers[cid]) || []).length; }); return n; };
  const findCounter = (id, re) => (state().counters || []).find((c) => c.id === id) || (state().counters || []).find((c) => re.test(c.name || ''));
  const customIcon = (name) => ((App.getEffectiveCustomIcons() || []).find((i) => i.name === name) || {}).value;
  const firstIcon = () => customIcon('Toilet') || App.getOrderedIcons()[0].value;

  // ===== steps both tours share ==============================================================
  // The 20'-0" dimension under Women 106, in PDF points.
  const DIM_20FT = [{ x: 517.5, y: 461.25 }, { x: 697.5, y: 461.25 }];
  const SCALE_STEP = {
    id: 'scale', title: 'Set the scale', kind: 'do',
    body: 'Every length starts here. Pick Set Scale (S). In the dialog, the Architectural & Engineering tab lists the presets — choose 1/8" = 1\'. The title block says the sample plan is drawn at 1/8", which is where you would look on a real sheet.',
    target: ['#setScale', '#setScaleSidebar', '[title="Set Scale"]'],
    check: () => !!(App.getPageScale && App.getPageScale(state().currentPage)),
    action: { label: 'Use 1/8" = 1\'-0"', run: applyEighthScale },
  };
  // The reading the tour expects, and how far off is still "20 ft".
  const PROVE_FT = 20, PROVE_TOL_FT = 0.6;
  const measuredFeet = () => {
    const lm = state().lastMeasure;
    if (!lm || lm.pageIdx !== state().currentPage || !(lm.pts > 0) || !lm.scale || !(lm.scale.pixelsPerUnit > 0)) return null;
    const v = lm.pts / lm.scale.pixelsPerUnit;
    return App.convertUnitValue ? App.convertUnitValue(v, lm.scale.unit || 'ft', 'ft') : v;
  };
  const PROVE_STEP = {
    id: 'measure', title: 'Prove the scale', kind: 'do',
    body: 'Pick Measure (D) and click both ends of the 20\'-0" dimension under Women 106. The footer reads 20\'-0" — the scale is telling the truth. If it reads anything else, go Back and set the scale again before you count. Do this on every real sheet: a PDF that was printed to a smaller sheet looks right and measures short.',
    target: ['#measureBtn', '#measureBtnSidebar'],
    check: () => { const ft = measuredFeet(); return ft != null && Math.abs(ft - PROVE_FT) <= PROVE_TOL_FT; },
    hint: () => { const ft = measuredFeet(); const lm = state().lastMeasure; return ft == null ? '' : 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + ' — go Back and set the scale again'; },
    action: { label: 'Measure the 20\'-0" wall', run: measureTwentyFeet },
  };

  // ===== the electrical tour ===============================================================
  const eCounter = () => findCounter(tourCounterId, /receptacle/i);
  const eLineType = () => (state().lineTypes || []).find((lt) => lt.id === tourLineTypeId) || (state().lineTypes || []).find((lt) => lt.raceway && lt.conductors && lt.conductors.length);

  const ELECTRICAL_STEPS = [
    {
      id: 'welcome', title: 'A five-minute electrical takeoff', kind: 'do',
      body: 'This tour walks you through a small takeoff on the sample plan — set the scale and prove it, count devices, chain a run, read the wire and the checks. Nothing here touches your projects. Open the sample plan to begin.',
      target: ['#uploadPdf', '#uploadPdfSidebar'],
      check: () => !!(state().pages && state().pages.length),
      action: { label: 'Open the sample plan', run: openSamplePlan },
    },
    SCALE_STEP,
    PROVE_STEP,
    {
      id: 'trade', title: 'Tell the app this is electrical', kind: 'do',
      body: 'Open Counters → + Add → the Quick tab and switch Trade to Electrical. The pickers become Category / Variant / Rating, the symbols become the ones on an E-sheet, and every device gets its mount height. A plumbing bid never sees any of this.',
      target: ['#addCounter'],
      check: () => state().trade === 'electrical',
      action: { label: 'Switch to Electrical', run: () => App.setProjectTrade('electrical', { remember: false, route: 'tour' }) },
    },
    {
      id: 'counter', title: 'Add a duplex receptacle', kind: 'do',
      body: 'On the Quick tab pick Receptacle · Duplex and press Add Counter. It arrives with the receptacle symbol and a mount height of 18" — the number the Chain tool will turn into vertical conduit in a moment.',
      target: ['#counterQuickCountAdd', '#addCounter'],
      check: () => { const c = (state().counters || []).find((x) => /receptacle/i.test(x.name || '') && typeof x.mountHeightIn === 'number'); if (c) tourCounterId = c.id; return !!c; },
      action: { label: 'Add it for me', run: addReceptacle },
    },
    {
      id: 'place', title: 'Count three receptacles', kind: 'do',
      body: 'With the counter armed, click three spots along the walls of Open Office 104. Each click is one tally; the sidebar count moves as you go.',
      target: ['#annCanvas'],
      check: () => { const c = eCounter(); return !!c && markCount(c.id) >= 3; },
      action: { label: 'Place three for me', run: placeThreeReceptacles },
    },
    {
      id: 'linetype', title: 'Make a conduit line type', kind: 'do',
      body: 'Line Types → + Add. Name it 3/4" EMT, then in its details give it the raceway (EMT, 3/4") and the conductors the way you already write them: 3 #12 THHN + 1 #12 G. From now on every run of this type tallies conduit AND wire by gauge.',
      target: ['#addLineType'],
      check: () => { const lt = eLineType(); if (lt) tourLineTypeId = lt.id; return !!lt; },
      action: { label: 'Create 3/4" EMT · 3 #12 + G', run: addEmtLineType },
    },
    {
      id: 'ceiling', title: 'Set the ceiling height', kind: 'do',
      body: 'Project Settings (the gear) → Ceiling height 10\'-0". With a mount height on the counter, the Chain tool adds ceiling − mount + make-up to every run it draws — 9.5 ft per receptacle nobody has to type.',
      target: ['#settingsGearBtn', '#sidebarLogoGear'],
      check: () => state().ceilingHeightFt > 0,
      action: { label: 'Set 10\'-0"', run: () => { state().ceilingHeightFt = 10; state().makeUpFt = 1; App.markProjectDirty(); App.updateUI(); } },
    },
    {
      id: 'chain', title: 'Chain a run', kind: 'do',
      body: 'Pick Chain (T), choose the receptacle and 3/4" EMT, then click three devices in a row. Every tap places the device, draws the run back to the previous one and writes the vertical drop. The footer tells you the drop before you click.',
      target: ['#chainBtn'],
      check: () => { const a = ann(); return !!a && (a.quickLines || []).filter((l) => (l.endDrop || 0) > 0 || (l.startDrop || 0) > 0).length >= 2; },
      action: { label: 'Chain three for me', run: chainThreeReceptacles },
    },
    {
      id: 'circuit', title: 'Make it a circuit', kind: 'do',
      body: 'Groups → + Add. Name it, and give it a panel and circuit number — LP-1 · 7. A group with a panel tag is a circuit: the report gets a circuit schedule, and the checks know which devices belong together.',
      target: ['#addGroup', '#groupsSectionTitle'],
      check: () => (state().groups || []).some((g) => g.panel),
      action: { label: 'Create LP-1 / 7 and assign the run', run: makeCircuit },
    },
    {
      id: 'summary', title: 'Read what the drawing knows', kind: 'read',
      body: 'The Summary now lists the receptacles, the 3/4" EMT feet with the verticals inside them, and the derived rows — #12 THHN by the foot, the green its own row. Wire is never a mark; it can never drift from the runs.',
      target: ['#summarySectionTitle'],
      check: () => true,
    },
    {
      id: 'bidcheck', title: 'Bid Check', kind: 'do',
      body: 'Expand Bid Check. The app computes conduit fill and voltage drop to the farthest device, compares circuits with the panel schedule, and lists the judgment calls only you can tick. It never blocks an export; it tells you what is open.',
      target: ['#bidCheckSectionTitle'],
      check: () => state().bidCheckCollapsed === false,
      action: { label: 'Open it', run: () => { state().bidCheckCollapsed = false; App.renderBidCheck && App.renderBidCheck(); } },
    },
    {
      id: 'handoff', title: 'Hand it off', kind: 'read',
      body: 'Export Options: Show Report for the full breakdown, Copy Summary for an email, Open in TakeoffTooling to price it — devices explode into boxes, rings and plates and every row picks up labor from your book. CountTooling stops at what the drawing knows.',
      target: ['#exportOptionsSectionTitle'],
      check: () => true,
    },
    {
      id: 'done', title: 'That is the whole loop', kind: 'read',
      body: 'Scale, prove it, count, chain, check, hand off. Your work here is saved on this device like any takeoff; Upload PDF when you are ready for a real plan. Guides for every tool live under Help → Guides.',
      target: [],
      check: () => true,
    },
  ];

  // ===== the plumbing tour =================================================================
  // Sample-plan geometry in PDF points (an ANSI B sheet, 1224 × 792 pt; the plan
  // group is the 1224 × 792 SVG source at 0.75, so a fixture's point = SVG px × 0.75):
  // Men 105 is the box (322, 266)–(465, 442); its three water closets sit on the
  // north wall at y ≈ 289, its three lavatories on the south wall at y ≈ 424;
  // the 20'-0" dimension under Women 106 runs (517, 461)–(697, 461).
  const WC_SPOTS = [{ x: 341, y: 289 }, { x: 367, y: 289 }, { x: 394, y: 289 }];
  const LAV_SPOTS = [{ x: 338, y: 424 }, { x: 364, y: 424 }, { x: 390, y: 424 }];
  const MEN_ROOM = { x1: 318, y1: 262, x2: 468, y2: 446 };
  const RFI_SPOT = { x: 395, y: 350 };
  const RFI_TEXT = 'RFI: floor drain in Men 105?';

  const pCounter = () => findCounter(tourCounterId, /water closet|toilet|\bwc\b/i);
  const pLav = () => findCounter(tourSecondCounterId, /lav|sink/i);
  const pLineType = () => (state().lineTypes || []).find((lt) => lt.id === tourLineTypeId) || (state().lineTypes || [])[0];
  const anyNoteRfi = () => (state().pages || []).some((p) => (p.canvases || []).some((cv) => ((cv.annotations && cv.annotations.notes) || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || '')))));
  const anyDrop = () => { const a = ann(); if (!a) return false; const has = (l) => (l.startDrop || 0) > 0 || (l.endDrop || 0) > 0; return (a.quickLines || []).some(has) || (a.polylines || []).some(has); };

  const PLUMBING_STEPS = [
    {
      id: 'welcome', title: 'A five-minute plumbing takeoff', kind: 'do',
      body: 'This tour walks you through a small takeoff on the sample plan — set the scale and prove it, count a restroom, chain a water branch with its riser, let the hangers count themselves, and hand it to the bid. Nothing here touches your projects. Open the sample plan to begin.',
      target: ['#uploadPdf', '#uploadPdfSidebar'],
      // A device whose last bid was electrical remembers that as its default
      // trade; the plumbing tour must speak plumbing, so the project is stamped
      // (never remembered) the moment the plan is open, whichever way it opened.
      check: () => { const ok = !!(state().pages && state().pages.length); if (ok && state().trade !== 'plumbing' && App.setProjectTrade) App.setProjectTrade('plumbing', { remember: false, route: 'tour' }); return ok; },
      action: { label: 'Open the sample plan', run: openSamplePlan },
    },
    SCALE_STEP,
    PROVE_STEP,
    {
      id: 'counter', title: 'Make a Water Closet counter', kind: 'do',
      body: 'Counters → + Add. On the Create tab name it Water Closet and pick the Toilet symbol from the plumbing set — the app ships the trade\'s icons, so the mark reads like the drawing. Choose a colour and press Create Counter; the counter tool arms itself.',
      target: ['#addCounter'],
      check: () => { const c = pCounter(); if (c) tourCounterId = c.id; return !!c; },
      action: { label: 'Create it for me', run: addWaterCloset },
    },
    {
      id: 'place', title: 'Count the Men\'s room', kind: 'do',
      body: 'With the counter armed, click the three water closets on the north wall of Men 105. One click is one tally; the sidebar count moves as you go, rolled up across every sheet in the set.',
      target: ['#annCanvas'],
      check: () => { const c = pCounter(); return !!c && markCount(c.id) >= 3; },
      action: { label: 'Count three for me', run: placeThreeWcs },
    },
    {
      id: 'linetype', title: 'A line type in two clicks', kind: 'do',
      body: 'Line Types → + Add, then the Quick tab: pick 1in and PEX and press Add Line Type. The name assembles itself — "1in PEX" — so every bid spells it the same way and the tallies never split across spellings. The line tool arms itself.',
      target: ['#addLineType'],
      check: () => { const lt = pLineType(); if (lt) tourLineTypeId = lt.id; return !!lt; },
      action: { label: 'Create 1in PEX', run: addPexLineType },
    },
    {
      id: 'chain', title: 'Chain the lav battery', kind: 'do',
      body: 'Pick Chain (T). In the panel choose a Lavatory counter (+ New counter makes one right there) and 1in PEX, then click the three lavatories on the south wall of Men 105. Every tap places the fixture and draws the branch back to the last one — a battery is three clicks, not nine.',
      target: ['#chainBtn'],
      check: () => { const a = ann(); return !!a && (a.quickLines || []).length >= 2; },
      action: { label: 'Chain the three lavs for me', run: chainThreeLavs },
    },
    {
      id: 'drop', title: 'Add the riser', kind: 'do',
      body: 'The branch comes up from below the slab. Pick Drop (B), choose 3 ft in the palette, and click the end of the run at the first lavatory. The riser\'s 3 ft joins the footage — plan view never shows it, the bid needs it. Click the same end again to clear it.',
      target: ['#dropBtn'],
      check: anyDrop,
      action: { label: 'Add a 3 ft riser for me', run: addRiserDrop },
    },
    {
      id: 'hangers', title: 'Hangers count themselves', kind: 'do',
      body: 'Open 1in PEX\'s details (the pencil). Under Child counts the rulebook offers Hanger · 1 per 32 in — the IPC spacing for PEX at 1 in, read off the type\'s name. Add it. From now on every run of this type counts its own hangers into the Summary and every export, with the rule it came from. Delete a run and its hangers go with it.',
      target: ['#lineTypesList .edit-btn', '#lineTypesSectionTitle'],
      check: () => (state().lineTypes || []).some((lt) => (lt.childCounts || []).length),
      action: { label: 'Add Hanger · 1 per 32 in', run: addHangerRule },
    },
    {
      id: 'zone', title: 'A typical floor', kind: 'do',
      body: 'This restroom core repeats on three floors. Pick Multiply Zone (X, under the ⋯ menu on desktop), drag a box around Men 105 and enter 3. Every count and every foot inside triples in the totals while the marks stay clean — count one floor, bid three.',
      target: ['#multiplyZoneBtn', '#multiplyZoneBtnSidebar', '#headerMoreBtn'],
      check: () => { const a = ann(); return !!a && (a.multiplyZones || []).some((z) => (z.multiplier || 1) > 1); },
      action: { label: 'Wrap Men 105 in a ×3 zone', run: addTypicalFloorZone },
    },
    {
      id: 'rfi', title: 'Flag a question', kind: 'do',
      body: 'Something the drawing does not say — is there a floor drain in Men 105? Pick Note (N, under the ⋯ menu on desktop), click the spot, and start the note with "RFI:". Copy RFI Flags under Export Options collects every such note across the set for the GC, and PipeTooling picks them up as questions on the bid.',
      target: ['#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
      check: anyNoteRfi,
      action: { label: 'Drop the RFI note for me', run: addRfiNote },
    },
    {
      id: 'proof', title: 'Prove the number', kind: 'do',
      body: 'In Summary click the Water Closet total. The breakdown shows the count per sheet with a thumbnail of where every mark sits, the zone\'s ×3 already applied. This is the page you open when someone asks where the number came from.',
      target: ['#summarySectionTitle'],
      check: () => { const m = document.getElementById('summaryCountDetailModal'); return !!m && m.classList.contains('visible'); },
      action: { label: 'Open the Water Closet breakdown', run: () => { const c = pCounter(); if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); } },
    },
    {
      id: 'handoff', title: 'Hand it off', kind: 'read',
      body: 'Export Options: Copy to PipeTooling puts the whole takeoff on the clipboard — counts, feet with the riser inside, hangers under their pipe — ready to paste into the bid, and Copy RFI Flags puts the questions beside it. Copy Summary for an email, Export PDFs for a marked-up plan the GC can read.',
      target: ['#forPipeTooling', '#exportOptionsSectionTitle'],
      check: () => true,
    },
    {
      id: 'done', title: 'That is the whole loop', kind: 'read',
      body: 'Scale, prove it, count, chain, riser, hangers, ×3, proof, hand off. Groups subtotal a restroom at a time when a set gets busy. Your work here is saved on this device like any takeoff; Upload PDF when you are ready for a real plan. Guides for every tool live under Help → Guides.',
      target: [],
      check: () => true,
    },
  ];

  const TOURS = {
    electrical: { steps: ELECTRICAL_STEPS, doneKey: 'clickcount-tour-done', linkId: 'canvasEmptyHintTour' },
    plumbing: { steps: PLUMBING_STEPS, doneKey: 'clickcount-tour-done-plumbing', linkId: 'canvasEmptyHintTourPlumbing' },
  };
  const tourFromParam = (v) => (v === 'plumbing' ? 'plumbing' : (v === '1' || v === 'electrical') ? 'electrical' : null);

  // --- "do it for me" actions (the same entry points a click uses) --------------------
  async function openSamplePlan() {
    try {
      const res = await fetch(SAMPLE_PLAN);
      const blob = await res.blob();
      const file = new File([blob], 'sample-plan.pdf', { type: 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const inp = document.getElementById('pdfInput');
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { App.showToast('Could not load the sample plan — Upload PDF works the same way'); }
  }
  // Through the real dialog when it is there — the estimator sees the presets tab
  // and the 1/8" row get picked, the way they will do it on a real sheet — with a
  // direct write as the fallback (specs, a missing modal).
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function applyEighthScale() {
    const p = state().pages[state().currentPage]; if (!p) return;
    try {
      if (App.openScaleModal) {
        App.openScaleModal();
        const tab = document.querySelector('#scaleModalTabs .counter-tab[data-tab="presets"]');
        if (tab) tab.click();
        await wait(700);
        const row = [...document.querySelectorAll('#scalePresetsList button')].find((b) => b.textContent.trim() === '1/8" = 1\'');
        if (row && document.querySelector('#scaleModal.visible')) { row.click(); await wait(200); }
      }
    } catch (_) { /* fall through to the direct write */ }
    if (App.getPageScale && App.getPageScale(state().currentPage)) return;
    if (App.hideModal) App.hideModal('scaleModal');
    p.scale = { pixelsPerUnit: 72 / 8, unit: 'ft', label: '1/8" = 1\'' };
    App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
  }
  function pushCounter(c) {
    const s = state();
    App.pushUndoSnapshot();
    s.counters.push(c);
    s.activeCounterType = c.id;
    s.tool = App.TOOL.COUNTER;
    App.markProjectDirty(); App.updateUI();
  }
  function placeMarkers(cid, spots) {
    const page = state().pages[state().currentPage];
    const canvas = App.ensureActiveCanvas(page);
    App.pushUndoSnapshotCurrentPage();
    if (!canvas.annotations.counterMarkers[cid]) canvas.annotations.counterMarkers[cid] = [];
    spots.forEach((p) => canvas.annotations.counterMarkers[cid].push({ x: p.x, y: p.y, id: App.uid(), group: state().activeGroupId || null }));
    App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
  }
  function pushLineType(lt) {
    const s = state();
    App.pushUndoSnapshot();
    s.lineTypes.push(lt);
    tourLineTypeId = lt.id;
    s.activeLineTypeId = lt.id;
    App.markProjectDirty(); App.updateUI();
  }
  function chainPoints(counterId, lineTypeId, spots) {
    const s = state();
    s.activeCounterType = counterId;
    s.activeLineTypeId = lineTypeId;
    s.tool = App.TOOL.CHAIN;
    s.chainStart = null;
    spots.forEach((p) => App.commitChainPoint(p));
    // End the run and leave the tool, as Enter then Esc would — the palette
    // panel closes so the next step's sidebar targets are not covered.
    s.chainStart = null;
    s.tool = App.TOOL.NONE;
    App.updateUI(); App.renderAnnotations();
  }

  // electrical
  function addReceptacle() {
    if (eCounter()) return;
    const icon = (App.tradeIconForType && App.tradeIconForType('electrical', 'Duplex')) || customIcon('Duplex Receptacle') || App.getOrderedIcons()[0].value;
    const c = { id: App.uid(), name: 'Duplex Receptacle', icon, color: '#e85447', mountHeightIn: 18 };
    tourCounterId = c.id;
    pushCounter(c);
  }
  // Open Office 104 is the box (112, 266)–(322, 442) in PDF points: three spots
  // along its north wall, and the chain along its south wall.
  const RECEPTACLE_SPOTS = [{ x: 150, y: 285 }, { x: 210, y: 285 }, { x: 270, y: 285 }];
  const CHAIN_SPOTS = [{ x: 150, y: 425 }, { x: 210, y: 425 }, { x: 270, y: 425 }];
  function placeThreeReceptacles() {
    if (!eCounter()) addReceptacle();
    placeMarkers(eCounter().id, RECEPTACLE_SPOTS);
  }
  function addEmtLineType() {
    if (eLineType()) return;
    const conductors = window.ConductorModel ? window.ConductorModel.parseConductorSpec('3 #12 THHN + 1 #12 G').conductors : [];
    pushLineType({ id: App.uid(), name: '3/4" EMT', color: '#8a4bb0', curveStyle: 'straight', raceway: { kind: 'EMT', size: '3/4"' }, conductors });
  }
  function chainThreeReceptacles() {
    const s = state();
    if (!eCounter()) addReceptacle();
    if (!eLineType()) addEmtLineType();
    if (!(s.ceilingHeightFt > 0)) { s.ceilingHeightFt = 10; s.makeUpFt = 1; }
    chainPoints(eCounter().id, eLineType().id, CHAIN_SPOTS);
  }
  function makeCircuit() {
    const s = state();
    if ((s.groups || []).some((g) => g.panel)) return;
    App.pushUndoSnapshot();
    const g = { id: App.uid(), name: 'Open office receptacles', color: '#c8963a', panel: 'LP-1', circuit: '7', loadAmps: 12 };
    s.groups.push(g);
    s.groupsEnabled = true;
    const a = ann();
    if (a) {
      (a.quickLines || []).forEach((l) => { if (!l.group) l.group = g.id; });
      const c = eCounter();
      if (c) (a.counterMarkers[c.id] || []).forEach((m) => { if (!m.group) m.group = g.id; });
    }
    App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
  }

  // plumbing
  async function measureTwentyFeet() {
    const s = state();
    if (!App.getPageScale(s.currentPage)) await applyEighthScale();
    if (!App.commitMeasurePoint) return;
    s.tool = App.TOOL.MEASURE;
    s.scaleMode = App.SCALE_MODES.POINT_A;
    s.scalePointA = null; s.scalePointB = null;
    App.commitMeasurePoint(DIM_20FT[0], { fromAim: true });
    App.commitMeasurePoint(DIM_20FT[1], { fromAim: true });
    App.updateUI(); App.renderAnnotations();
  }
  function addWaterCloset() {
    if (pCounter()) return;
    const c = { id: App.uid(), name: 'Water Closet', icon: firstIcon(), color: '#4a9eff' };
    tourCounterId = c.id;
    pushCounter(c);
  }
  function placeThreeWcs() {
    if (!pCounter()) addWaterCloset();
    placeMarkers(pCounter().id, WC_SPOTS);
  }
  function addPexLineType() {
    if (pLineType()) { tourLineTypeId = pLineType().id; return; }
    pushLineType({ id: App.uid(), name: '1in PEX', color: '#47c88e', curveStyle: 'straight' });
  }
  function addLavatory() {
    if (pLav()) { tourSecondCounterId = pLav().id; return; }
    const c = { id: App.uid(), name: 'Lavatory', icon: customIcon('Mounted Sink') || firstIcon(), color: '#e8c547' };
    tourSecondCounterId = c.id;
    pushCounter(c);
  }
  function chainThreeLavs() {
    if (!pLineType()) addPexLineType();
    addLavatory();
    chainPoints(pLav().id, pLineType().id, LAV_SPOTS);
  }
  function addRiserDrop() {
    const a = ann(); if (!a) return;
    if (!(a.quickLines || []).length) chainThreeLavs();
    const nodes = App.collectDropNodes(a, 1) || [];
    if (!nodes.length) return;
    // the run end at the first lavatory (the branch's start)
    const first = LAV_SPOTS[0];
    let best = null, bestD = Infinity;
    nodes.forEach((n) => { const d = App.ptDist(n, first); if (d < bestD) { bestD = d; best = n; } });
    if (!best || !App.applyDropToNode(a, best, 3, 'ft', true)) return;
    App.pushUndoSnapshotCurrentPage();
    App.applyDropToNode(a, best, 3, 'ft');
    App.pushRecentDrop(3, 'ft');
    App.logDropSetEvent && App.logDropSetEvent(3, 'ft', 'tour');
    App.markProjectDirty(); App.renderAnnotations(); App.updateUI();
  }
  function addHangerRule() {
    if (!pLineType()) addPexLineType();
    const lt = pLineType();
    if ((lt.childCounts || []).length) return;
    // the same row the Child counts editor offers from the rulebook
    const sm = window.SupportModel;
    const sg = (sm && sm.hangerSuggestionsFor(lt.name)[0]) || { name: 'Hanger', qty: 1, per: 'ft', intervalIn: 32, ruleId: 'plumb.hanger.pex' };
    App.pushUndoSnapshotCurrentPage();
    lt.childCounts = [{ name: sg.name, qty: sg.qty, per: sg.per, intervalIn: sg.intervalIn, ruleId: sg.ruleId }];
    App.markProjectDirty(); App.updateUI();
  }
  function addTypicalFloorZone() {
    const page = state().pages[state().currentPage]; if (!page) return;
    const canvas = App.ensureActiveCanvas(page);
    if ((canvas.annotations.multiplyZones || []).some((z) => (z.multiplier || 1) > 1)) return;
    App.pushUndoSnapshotCurrentPage();
    if (!canvas.annotations.multiplyZones) canvas.annotations.multiplyZones = [];
    canvas.annotations.multiplyZones.push({ x1: MEN_ROOM.x1, y1: MEN_ROOM.y1, x2: MEN_ROOM.x2, y2: MEN_ROOM.y2, multiplier: 3, id: App.uid() });
    App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
  }
  function addRfiNote() {
    if (anyNoteRfi()) return;
    const page = state().pages[state().currentPage]; if (!page) return;
    const canvas = App.ensureActiveCanvas(page);
    App.pushUndoSnapshotCurrentPage();
    if (!canvas.annotations.notes) canvas.annotations.notes = [];
    canvas.annotations.notes.push({ x: RFI_SPOT.x, y: RFI_SPOT.y, text: RFI_TEXT, id: App.uid(), width: 150, fontSize: 14, placementRotation: page.rotation ?? 0, color: '#e85447' });
    App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
  }

  // --- the overlay ------------------------------------------------------------------
  function el(id) { return document.getElementById(id); }
  let lastTarget = null;   // the element last spotlighted — a new one is scrolled into view once
  function render() {
    const overlay = el('tourOverlay');
    if (!overlay) return;
    overlay.style.display = active ? '' : 'none';
    if (!active) return;
    const step = STEPS[stepIdx];
    const done = safeCheck(step);
    el('tourStepNo').textContent = (stepIdx + 1) + ' / ' + STEPS.length;
    el('tourTitle').textContent = step.title;
    el('tourBody').textContent = step.body;
    const actionBtn = el('tourAction');
    if (step.action && !done) { actionBtn.style.display = ''; actionBtn.textContent = step.action.label; }
    else actionBtn.style.display = 'none';
    const next = el('tourNext');
    next.textContent = stepIdx === STEPS.length - 1 ? 'Finish' : (step.kind === 'read' || done ? 'Next' : 'Skip step');
    next.classList.toggle('tour-next-ready', step.kind === 'read' || done);
    el('tourBack').style.visibility = stepIdx === 0 ? 'hidden' : '';
    el('tourStatus').textContent = step.kind === 'do' ? (done ? '✓ Done' : ((step.hint && safeHint(step)) || 'Waiting for you…')) : '';
    el('tourDots').innerHTML = STEPS.map((s, i) => '<span class="tour-dot' + (i < stepIdx ? ' past' : i === stepIdx ? ' now' : '') + '"></span>').join('');
    // spotlight + card placement
    const modalOpen = !!document.querySelector('.modal-overlay.visible');
    const target = !modalOpen && step.target.length ? q(step.target) : null;
    const spot = el('tourSpot');
    const card = el('tourCard');
    if (target) {
      if (target !== lastTarget) { try { target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {} }
      lastTarget = target;
      const r = target.getBoundingClientRect();
      const pad = 6;
      spot.style.display = '';
      spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px';
      spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
      // card: right of the target when there is room, else below, clamped to the viewport
      const cw = Math.min(360, window.innerWidth - 24), ch = card.offsetHeight || 220;
      let left = r.right + 16, top = r.top;
      if (left + cw > window.innerWidth - 12) { left = Math.max(12, Math.min(r.left, window.innerWidth - cw - 12)); top = r.bottom + 14; }
      if (top + ch > window.innerHeight - 12) top = Math.max(12, window.innerHeight - ch - 12);
      card.style.left = left + 'px'; card.style.top = top + 'px'; card.style.right = ''; card.style.bottom = ''; card.style.transform = '';
    } else {
      spot.style.display = 'none';
      if (modalOpen) { card.style.left = ''; card.style.top = ''; card.style.right = '16px'; card.style.bottom = '16px'; card.style.transform = ''; }
      else { card.style.left = '50%'; card.style.top = '50%'; card.style.right = ''; card.style.bottom = ''; card.style.transform = 'translate(-50%, -50%)'; }
    }
    // auto-advance a beat after a doing-step completes
    if (step.kind === 'do' && done && stepIdx < STEPS.length - 1) {
      if (!doneAt) doneAt = Date.now();
      else if (Date.now() - doneAt > 900) goTo(stepIdx + 1);
    } else doneAt = 0;
  }
  function safeCheck(step) { try { return !!step.check(); } catch (_) { return false; } }
  function safeHint(step) { try { return step.hint() || ''; } catch (_) { return ''; } }
  function goTo(i) {
    stepIdx = Math.max(0, Math.min(STEPS.length - 1, i));
    doneAt = 0;
    App.logUserEvent && App.logUserEvent('tour_step', state().currentProjectId || null, { tour: tourId, step: STEPS[stepIdx].id, index: stepIdx });
    render();
  }
  function startTutorial(id) {
    const s = state();
    if (s.currentProjectId) { App.showToast('Close the cloud project first — the tour runs on the sample plan'); return false; }
    tourId = TOURS[id] ? id : 'electrical';
    STEPS = TOURS[tourId].steps;
    active = true;
    stepIdx = 0; doneAt = 0; tourCounterId = null; tourLineTypeId = null; tourSecondCounterId = null;
    document.body.classList.add('tour-active');
    if (timer) clearInterval(timer);
    timer = setInterval(render, 400);
    App.logUserEvent && App.logUserEvent('tour_step', null, { tour: tourId, step: 'start', index: 0 });
    render();
    return true;
  }
  function stopTutorial(finished) {
    active = false;
    if (timer) { clearInterval(timer); timer = null; }
    document.body.classList.remove('tour-active');
    try { if (finished) localStorage.setItem(TOURS[tourId].doneKey, new Date().toISOString()); } catch (_) {}
    App.logUserEvent && App.logUserEvent('tour_step', state().currentProjectId || null, { tour: tourId, step: finished ? 'finished' : 'left', index: stepIdx });
    render();
    syncEntryPoints();
  }
  // The empty-canvas hint offers each tour until THAT tour is finished on this
  // device; the whole offer goes when both are.
  function syncEntryPoints() {
    let allDone = true;
    Object.keys(TOURS).forEach((id) => {
      let done = false;
      try { done = !!localStorage.getItem(TOURS[id].doneKey); } catch (_) {}
      const link = el(TOURS[id].linkId);
      if (link) link.style.display = done ? 'none' : '';
      if (!done) allDone = false;
    });
    const sep = el('canvasEmptyHintTourSep');
    if (sep) sep.style.display = allDone ? 'none' : (Object.keys(TOURS).every((id) => { const l = el(TOURS[id].linkId); return l && l.style.display !== 'none'; }) ? '' : 'none');
    const wrap = document.querySelector('.canvas-empty-hint-tour');
    if (wrap) wrap.style.display = allDone ? 'none' : '';
  }

  // wiring (static DOM)
  el('tourNext') && (el('tourNext').onclick = () => { if (stepIdx >= STEPS.length - 1) stopTutorial(true); else goTo(stepIdx + 1); });
  el('tourBack') && (el('tourBack').onclick = () => goTo(stepIdx - 1));
  el('tourLeave') && (el('tourLeave').onclick = () => stopTutorial(false));
  el('tourAction') && (el('tourAction').onclick = async () => { const step = STEPS[stepIdx]; if (step.action) { await step.action.run(); render(); } });
  Object.keys(TOURS).forEach((id) => {
    const link = el(TOURS[id].linkId);
    if (link) link.onclick = (e) => { e.preventDefault(); startTutorial(id); };
  });
  el('settingsTour') && (el('settingsTour').onclick = () => { App.hideModal('settingsModal'); startTutorial('electrical'); });
  el('settingsTourPlumbing') && (el('settingsTourPlumbing').onclick = () => { App.hideModal('settingsModal'); startTutorial('plumbing'); });
  window.addEventListener('resize', () => { if (active) render(); });
  syncEntryPoints();
  // ?tour=plumbing / ?tour=electrical (or the original ?tour=1) opens that tour on
  // load (after the app has booted its state).
  try { const id = tourFromParam(new URLSearchParams(location.search).get('tour')); if (id) setTimeout(() => startTutorial(id), 600); } catch (_) {}

  App.startTutorial = startTutorial;
  App.stopTutorial = stopTutorial;
  App.isTutorialActive = () => active;
  App.onTutorialTick = () => { if (active) render(); };
  App.tutorialStepId = () => (active ? STEPS[stepIdx].id : null);
  App.tutorialId = () => (active ? tourId : null);
  App.tutorialGoTo = (id) => { const i = STEPS.findIndex((s) => s.id === id); if (i >= 0) goTo(i); };
})();
