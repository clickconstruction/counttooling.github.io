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
 * `target` is a LADDER, deepest control first: the spotlight follows the reader
 * INTO a dialog (the Quick tab, the Trade segment, Create Counter, the Child
 * counts row) instead of going dark the moment one opens — with a dialog up,
 * only a target inside it qualifies, so a control under the backdrop is never
 * lit. Back HOLDS: a step re-entered with Back never auto-advances, however
 * complete its work already is — Next lights up instead (Wendi, 2026-09-10:
 * "it won't let me stay back").
 *
 * Both tours run on samples/sample-plan.pdf (fetched into #pdfInput like a
 * drop, so it goes through the normal intake; 1224 × 792 PDF points, the
 * restrooms Men 105 / Women 106 carry drawn water closets and lavatories; a
 * true ANSI B sheet at a true 1/8", so the Set Scale dialog shows no sheet-size
 * warning) and
 * nothing they do touches a cloud project: a tour refuses to start while a
 * cloud project is open. Progress is per session; a finished tour is
 * remembered per device under its own key (`clickcount-tour-done` electrical,
 * `clickcount-tour-done-plumbing`, `clickcount-tour-done-hvac` — H1, 2026-09-14) so the empty-canvas hint stops offering
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
  let heldByBack = false;  // the step was re-entered with Back: never auto-advance, Next lights up
  let tourCounterId = null;
  let tourLineTypeId = null;
  let tourSecondCounterId = null;

  // First visible match of the ladder. While a dialog is open only a control
  // inside it qualifies — the header and sidebar sit under the backdrop.
  const q = (sels, within) => { for (const s of [].concat(sels)) { const el = document.querySelector(s); if (el && el.offsetParent !== null && (!within || within.contains(el))) return el; } return null; };
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
    body: 'Every length starts here.\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/8" = 1\']].\nThe title block says the sample plan is drawn at 1/8". On a real sheet, that is where you look.',
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
    body: '1. In the header, click [[Measure]] (or press D).\n2. Click one end of the 20\'-0" dimension under Women 106.\n3. Click the other end.\nThe footer should read 20\'-0". If it reads anything else, click [[Back]] and set the scale again. Do this on every real sheet: a PDF printed to a smaller sheet looks right and measures short.',
    target: ['#measureBtn', '#measureBtnSidebar'],
    check: () => { const ft = measuredFeet(); return ft != null && Math.abs(ft - PROVE_FT) <= PROVE_TOL_FT; },
    hint: () => { const ft = measuredFeet(); const lm = state().lastMeasure; return ft == null ? '' : 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + '. Go Back and set the scale again'; },
    action: { label: 'Measure the 20\'-0" wall', run: measureTwentyFeet },
  };

  // ===== the electrical tour ===============================================================
  const eCounter = () => findCounter(tourCounterId, /receptacle/i);
  const eLineType = () => (state().lineTypes || []).find((lt) => lt.id === tourLineTypeId) || (state().lineTypes || []).find((lt) => lt.raceway && lt.conductors && lt.conductors.length);

  const ELECTRICAL_STEPS = [
    {
      id: 'welcome', title: 'A five-minute electrical takeoff', kind: 'do',
      body: 'A small takeoff on the sample plan: set the scale and prove it, count devices, chain a run, read the wire and the checks. Nothing here touches your projects.\n1. Click [[Open the sample plan]] below.',
      target: ['#uploadPdf', '#uploadPdfSidebar'],
      check: () => !!(state().pages && state().pages.length),
      action: { label: 'Open the sample plan', run: openSamplePlan },
    },
    SCALE_STEP,
    PROVE_STEP,
    {
      id: 'trade', title: 'Tell the app this is electrical', kind: 'do',
      body: '1. In the left sidebar, under COUNTERS, click [[+ Add]].\n2. Click the [[Quick]] tab.\n3. Set Trade to [[Electrical]].\nThe pickers become Category / Variant / Rating, the symbols become the ones on an E-sheet, and every device gets a mount height. A plumbing bid never sees any of this.',
      target: ['#counterQuickCountTradeSegment [data-trade="electrical"]', '#counterModal .counter-tab[data-tab="quickcount"]', '#addCounter'],
      check: () => state().trade === 'electrical',
      action: { label: 'Switch to Electrical', run: () => App.setProjectTrade('electrical', { remember: false, route: 'tour' }) },
    },
    {
      id: 'counter', title: 'Add a duplex receptacle', kind: 'do',
      body: '1. On the [[Quick]] tab, set Category to Receptacle.\n2. Set Variant to Duplex.\n3. Click [[Add Counter]].\nIt arrives with the receptacle symbol and a mount height of 18", the number the Chain tool turns into vertical conduit in a moment.',
      target: ['#counterQuickCountAdd', '#counterModal .counter-tab[data-tab="quickcount"]', '#addCounter'],
      check: () => { const c = (state().counters || []).find((x) => /receptacle/i.test(x.name || '') && typeof x.mountHeightIn === 'number'); if (c) tourCounterId = c.id; return !!c; },
      action: { label: 'Add it for me', run: addReceptacle },
    },
    {
      id: 'place', title: 'Count three receptacles', kind: 'do',
      body: 'The counter tool is armed.\n1. Click a spot on a wall of Open Office 104.\n2. Click a second spot.\n3. Click a third spot.\nEach click is one tally; the sidebar count moves as you go.',
      target: ['#annCanvas'],
      check: () => { const c = eCounter(); return !!c && markCount(c.id) >= 3; },
      action: { label: 'Place three for me', run: placeThreeReceptacles },
    },
    {
      id: 'linetype', title: 'Make a conduit line type', kind: 'do',
      body: '1. In the left sidebar, under LINE TYPES, click [[+ Add]].\n2. In Name, type 3/4" EMT, and add it.\n3. Click the pencil beside it to open its details.\n4. Set the raceway: EMT, 3/4".\n5. In Conductors, type 3 #12 THHN + 1 #12 G.\nFrom now on every run of this type tallies conduit AND wire by gauge.',
      target: ['#childCountsGroup', '#createLineTypeName', '#chooseLineTypeModal .line-type-tab[data-tab="create"]', '#addLineType'],
      check: () => { const lt = eLineType(); if (lt) tourLineTypeId = lt.id; return !!lt; },
      action: { label: 'Create 3/4" EMT · 3 #12 + G', run: addEmtLineType },
    },
    {
      id: 'ceiling', title: 'Set the ceiling height', kind: 'do',
      body: '1. In the header, click the gear ([[Project Settings]]).\n2. In Ceiling height, type 10\'-0".\n3. Close the dialog.\nWith a mount height on the counter, the Chain tool adds ceiling − mount + make-up to every run it draws: 9.5 ft per receptacle nobody has to type.',
      target: ['#settingsCeilingHeight', '#settingsGearBtn', '#sidebarLogoGear'],
      check: () => state().ceilingHeightFt > 0,
      action: { label: 'Set 10\'-0"', run: () => { state().ceilingHeightFt = 10; state().makeUpFt = 1; App.markProjectDirty(); App.updateUI(); } },
    },
    {
      id: 'chain', title: 'Chain a run', kind: 'do',
      body: '1. In the header, click [[Chain]] (or press T).\n2. In the Chain panel, choose the receptacle and 3/4" EMT.\n3. Click a device spot.\n4. Click a second spot, then a third.\nEvery click places the device, draws the run back to the previous one and writes the vertical drop. The footer tells you the drop before you click.',
      target: ['#chainPanel', '#chainBtn'],
      check: () => { const a = ann(); return !!a && (a.quickLines || []).filter((l) => (l.endDrop || 0) > 0 || (l.startDrop || 0) > 0).length >= 2; },
      action: { label: 'Chain three for me', run: chainThreeReceptacles },
    },
    {
      id: 'circuit', title: 'Make it a circuit', kind: 'do',
      body: '1. In the left sidebar, under GROUPS, click [[+ Add]].\n2. In Name, type a name.\n3. In Panel, type LP-1. In Circuit, type 7.\n4. Click [[Done]].\nA group with a panel tag is a circuit: the report gets a circuit schedule, and the checks know which devices belong together.',
      target: ['#groupModal .modal-card', '#addGroup', '#groupsSectionTitle'],
      check: () => (state().groups || []).some((g) => g.panel),
      action: { label: 'Create LP-1 / 7 and assign the run', run: makeCircuit },
    },
    {
      id: 'summary', title: 'Read what the drawing knows', kind: 'read',
      body: '1. In the left sidebar, open SUMMARY.\nIt lists the receptacles, the 3/4" EMT feet with the verticals inside them, and the derived rows: #12 THHN by the foot, the green its own row. Wire is never a mark; it can never drift from the runs.',
      target: ['#summarySectionTitle'],
      check: () => true,
    },
    {
      id: 'bidcheck', title: 'Bid Check', kind: 'do',
      body: '1. In the left sidebar, click BID CHECK to expand it.\nThe app computes conduit fill and voltage drop to the farthest device, compares circuits with the panel schedule, and lists the judgment calls only you can tick. It never blocks an export; it tells you what is open.',
      target: ['#bidCheckSectionTitle'],
      check: () => state().bidCheckCollapsed === false,
      action: { label: 'Open it', run: () => { state().bidCheckCollapsed = false; App.renderBidCheck && App.renderBidCheck(); } },
    },
    {
      id: 'handoff', title: 'Hand it off', kind: 'read',
      body: 'Under EXPORT OPTIONS in the left sidebar:\n1. [[Show Report]] for the full breakdown.\n2. [[Copy Summary]] for an email.\n3. [[Open in TakeoffTooling]] to price it. There, devices explode into boxes, rings and plates, and every row picks up labor from your book.\nCountTooling stops at what the drawing knows.',
      target: ['#exportOptionsSectionTitle'],
      check: () => true,
    },
    {
      id: 'done', title: 'That is the whole loop', kind: 'read',
      body: 'Scale, prove it, count, chain, check, hand off.\nYour work here is saved on this device like any takeoff. When you are ready for a real plan, click [[Upload PDF]] in the header. Guides for every tool live under Help → Guides.',
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
      body: 'A small takeoff on the sample plan: set the scale and prove it, count a restroom, chain a water branch with its riser, let the hangers count themselves, and hand it to the bid. Nothing here touches your projects.\n1. Click [[Open the sample plan]] below.',
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
      body: '1. In the left sidebar, under COUNTERS, click [[+ Add]].\n2. Click the [[Create]] tab.\n3. In Name, type Water Closet.\n4. Pick the Toilet symbol from the plumbing set.\n5. Pick a colour.\n6. Click [[Create Counter]].\nThe app ships the trade\'s icons, so the mark reads like the drawing. The counter tool arms itself.',
      target: ['#counterCreate', '#counterModal .counter-tab[data-tab="create"]', '#addCounter'],
      check: () => { const c = pCounter(); if (c) tourCounterId = c.id; return !!c; },
      action: { label: 'Create it for me', run: addWaterCloset },
    },
    {
      id: 'place', title: 'Count the Men\'s room', kind: 'do',
      body: 'The counter tool is armed.\n1. Click the first water closet on the north wall of Men 105.\n2. Click the second.\n3. Click the third.\nOne click is one tally; the sidebar count moves as you go, rolled up across every sheet in the set.',
      target: ['#annCanvas'],
      check: () => { const c = pCounter(); return !!c && markCount(c.id) >= 3; },
      action: { label: 'Count three for me', run: placeThreeWcs },
    },
    {
      id: 'linetype', title: 'A line type in two clicks', kind: 'do',
      body: 'The cold-water branch that feeds the lav battery needs a line type.\n1. In the left sidebar, under LINE TYPES, click [[+ Add]].\n2. Click the [[Quick]] tab.\n3. Pick 1in, then PEX.\n4. Click [[Add Line Type]].\nThe name assembles itself, "1in PEX", so every bid spells it the same way. The line tool arms itself.',
      target: ['#quickLineAdd', '#chooseLineTypeModal .line-type-tab[data-tab="quick"]', '#addLineType'],
      check: () => { const lt = pLineType(); if (lt) tourLineTypeId = lt.id; return !!lt; },
      action: { label: 'Create 1in PEX', run: addPexLineType },
    },
    {
      id: 'chain', title: 'Chain the lav battery', kind: 'do',
      body: 'The three lavatories on the south wall of Men 105 sit on one 1in PEX branch that runs lav to lav, so count them the other way.\n1. In the header, click [[Chain]] (or press T).\n2. In the Chain panel, choose a Lavatory counter ([[+ New counter]] makes one right there) and 1in PEX.\n3. Click the first lavatory.\n4. Click the second, then the third.\nEvery click places the fixture AND draws the branch back to the last one: three clicks instead of nine.',
      target: ['#counterCreate', '#counterQuickCountAdd', '#chainPanel', '#chainBtn'],
      check: () => { const a = ann(); return !!a && (a.quickLines || []).length >= 2; },
      action: { label: 'Chain the three lavs for me', run: chainThreeLavs },
    },
    {
      id: 'drop', title: 'Add the riser', kind: 'do',
      body: 'The branch comes up from below the slab.\n1. In the header, click [[Drop]] (or press B).\n2. In the palette, choose 3 ft.\n3. Click the end of the run at the first lavatory.\nThe riser\'s 3 ft joins the footage: plan view never shows it, the bid needs it. Clicking the same end again clears it.',
      target: ['#dropPanel', '#dropBtn'],
      check: anyDrop,
      action: { label: 'Add a 3 ft riser for me', run: addRiserDrop },
    },
    {
      id: 'hangers', title: 'Hangers count themselves', kind: 'do',
      body: 'Every foot of that branch hangs from a support, and the bid has to count the hangers. The app can do it from the pipe.\n1. In the left sidebar, under LINE TYPES, click the pencil beside 1in PEX.\n2. Under [[Child counts]], find Hanger · 1 per 32 in (the IPC spacing for PEX at 1 in, read off the type\'s name).\n3. Click [[Add]].\nFrom now on every run of this type counts its own hangers into the Summary and every export, with the rule it came from. Delete a run and its hangers go with it.',
      target: ['#childCountsSuggest', '#childCountsGroup', '#lineTypesList .edit-btn', '#lineTypesSectionTitle'],
      check: () => (state().lineTypes || []).some((lt) => (lt.childCounts || []).length),
      action: { label: 'Add Hanger · 1 per 32 in', run: addHangerRule },
    },
    {
      id: 'zone', title: 'A typical floor', kind: 'do',
      body: 'This restroom core repeats on three floors.\n1. In the header, click [[⋯]], then [[Multiply Zone]] (or press X).\n2. Drag a box around Men 105.\n3. Type 3.\n4. Click [[Apply]].\nEvery count and every foot inside triples in the totals while the marks stay clean: count one floor, bid three.',
      target: ['#multiplyZoneBtn', '#multiplyZoneBtnSidebar', '#headerMoreBtn'],
      check: () => { const a = ann(); return !!a && (a.multiplyZones || []).some((z) => (z.multiplier || 1) > 1); },
      action: { label: 'Wrap Men 105 in a ×3 zone', run: addTypicalFloorZone },
    },
    {
      id: 'rfi', title: 'Flag a question', kind: 'do',
      body: 'Something the drawing does not say: is there a floor drain in Men 105?\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click the spot.\n3. Type RFI: and then the question.\nUnder EXPORT OPTIONS, [[Copy RFI Flags]] collects every such note across the set for the GC, and PipeTooling picks them up as questions on the bid.',
      target: ['#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
      check: anyNoteRfi,
      action: { label: 'Drop the RFI note for me', run: addRfiNote },
    },
    {
      id: 'proof', title: 'Prove the number', kind: 'do',
      body: '1. In the left sidebar, open SUMMARY.\n2. Click the Water Closet total.\nThe breakdown shows the count per sheet with a thumbnail of where every mark sits, the zone\'s ×3 already applied. This is the page you open when someone asks where the number came from.',
      target: ['#summaryList .summary-item-clickable', '#summarySectionTitle'],
      check: () => { const m = document.getElementById('summaryCountDetailModal'); return !!m && m.classList.contains('visible'); },
      action: { label: 'Open the Water Closet breakdown', run: () => { const c = pCounter(); if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); } },
    },
    {
      id: 'handoff', title: 'Hand it off', kind: 'read',
      body: 'Under EXPORT OPTIONS in the left sidebar:\n1. [[Copy to PipeTooling]] puts the whole takeoff on the clipboard (counts, feet with the riser inside, hangers under their pipe), ready to paste into the bid.\n2. [[Copy RFI Flags]] puts the questions beside it.\n3. [[Copy Summary]] for an email.\n4. [[Export PDFs]] for a marked-up plan the GC can read.',
      target: ['#forPipeTooling', '#exportOptionsSectionTitle'],
      check: () => true,
    },
    {
      id: 'done', title: 'That is the whole loop', kind: 'read',
      body: 'Scale, prove it, count, chain, riser, hangers, ×3, proof, hand off.\nGroups subtotal a restroom at a time when a set gets busy. Your work here is saved on this device like any takeoff. When you are ready for a real plan, click [[Upload PDF]] in the header. Guides for every tool live under Help → Guides.',
      target: [],
      check: () => true,
    },
  ];

  // ===== the HVAC tour (H1, 2026-09-14) =====================================================
  // The design-build duct loop on the sample plan: box a room the plan already
  // names, air devices with a CFM, the system, the main sized by the
  // ductulator at S, strays hung from the menu, pounds, sign-off, hand-off.
  // Every step is shipped behavior with a seam; the tour adds no product code.
  // The sample plan's drawing sits at 0.75× its SVG units on the 1224-pt sheet
  // (the SVG is 1224 CSS px at 96 dpi) — the same factor DIM_20FT carries.
  const OPEN_OFFICE = { x1: 114, y1: 268, x2: 321, y2: 441 };   // OPEN OFFICE 104's outline (SVG 150,355 280×235), PDF pts
  const DIFFUSER_SPOTS = [{ x: 165, y: 358.5 }, { x: 270, y: 358.5 }, { x: 165, y: 420 }, { x: 270, y: 420 }];   // two 6 pt from the main (attached), two 67 pt off (strays, within the 96 pt rescue)
  const MAIN_VERTICES = [{ x: 120, y: 352.5 }, { x: 225, y: 352.5 }, { x: 315, y: 352.5 }];
  const hCounter = () => findCounter(tourCounterId, /diffuser/i);
  const hRoom = () => (state().rooms || []).find((r) => /open office/i.test(r.name || ''));
  const ductRuns = () => { const a = ann(); return (a && a.ductRuns) || []; };
  const cfmDevices = () => { const a = ann(); const c = hCounter(); return (a && c && a.counterMarkers && a.counterMarkers[c.id]) || []; };
  const unattachedDevices = () => {
    const devs = cfmDevices().map((m) => ({ x: m.x, y: m.y }));
    if (!devs.length || typeof attachDuctDevices !== 'function') return [];
    return attachDuctDevices(devs, ductRuns()).unattached;
  };
  const HVAC_STEPS = [
    {
      id: 'welcome', title: 'A five-minute HVAC takeoff', kind: 'do',
      body: 'A design-build duct takeoff on the sample plan: set the scale and prove it, box a room the plan already names, give diffusers a CFM, let the app size the main, count the fittings and the pounds, sign off, hand it to the bid. Nothing here touches your projects.\n1. Click [[Open the sample plan]] below.',
      target: ['#uploadPdf', '#uploadPdfSidebar'],
      // Stamped HVAC (never remembered as the device default) the moment the plan is open — the trade unfolds the air fields and seeds the toolbar.
      check: () => { const ok = !!(state().pages && state().pages.length); if (ok && state().trade !== 'hvac' && App.setProjectTrade) App.setProjectTrade('hvac', { remember: false, route: 'tour' }); return ok; },
      action: { label: 'Open the sample plan', run: openSamplePlan },
    },
    SCALE_STEP,
    PROVE_STEP,
    {
      id: 'room', title: 'Box a room the plan already names', kind: 'do',
      body: '1. In the header, click [[Room Sizer]] (or press V).\n2. Drag a box around OPEN OFFICE 104.\n3. The name is already filled in, read off the plan\'s own text. Set Room type to Office.\n4. In Ceiling, type 9. In Deck height, type 12.\n5. Click [[Apply]].\nThe sheet gets one small totals tag placed off the printed name.',
      target: ['#roomBoxApply', '#roomBoxType', '#roomBtn', '#roomBtnSidebar', '#headerMoreBtn'],
      check: () => { const r = hRoom(); const a = ann(); const ds = App.getDuctSettings ? App.getDuctSettings() : null; return !!(r && r.roomType && a && (a.roomBoxes || []).some((b) => b.roomId === r.id) && ds && ds.deckHeightFt > 0); },
      action: { label: 'Box the open office for me', run: boxOpenOffice },
    },
    {
      id: 'counter', title: 'A diffuser with a CFM', kind: 'do',
      body: '1. In the left sidebar, under COUNTERS, click [[+ Add]].\n2. Click the [[Create]] tab. On an HVAC project its air & mounting fields are already unfolded.\n3. In Name, type Supply Diffuser.\n4. In CFM, type 150. The chip beside the field shows the symbol it will take.\n5. Click [[Create Counter]].\nThe counter tool arms itself.',
      target: ['#counterCreate', '#counterCfm', '#counterModal .counter-tab[data-tab="create"]', '#addCounter'],
      check: () => { const c = hCounter(); if (c) tourCounterId = c.id; return !!(c && c.cfm > 0); },
      action: { label: 'Create it for me', run: addDiffuser },
    },
    {
      id: 'place', title: 'Place four diffusers', kind: 'do',
      body: 'The counter tool is armed.\n1. Click two spots in OPEN OFFICE 104, near where the main will run.\n2. Click two more, deeper in the room.\nEach mark carries its 150 CFM; the Rooms row now reads what the room needs against what is served.',
      target: ['#annCanvas'],
      check: () => cfmDevices().length >= 4,
      action: { label: 'Place four for me', run: placeFourDiffusers },
    },
    {
      id: 'system', title: 'Name the system', kind: 'do',
      body: 'A group with an equipment tag is a system.\n1. In the left sidebar, under GROUPS, click [[+ Add]].\n2. In Name, type RTU-1.\n3. In Equipment tag, type RTU-1.\n4. In Capacity, type 2000.\n5. Click [[Done]].\n6. Click RTU-1 in the sidebar to select it, so the main you trace next belongs to it.\nThe header will read the system\'s designed air against its capacity.',
      target: ['#groupModalDone', '#groupModalCapacityCfm', '#addGroup', '#groupsSectionTitle'],
      check: () => (state().groups || []).some((g) => g.capacityCfm > 0),
      action: { label: 'Make RTU-1 for me', run: makeSystem },
    },
    {
      id: 'duct', title: 'Trace the main', kind: 'do',
      body: '1. In the header, click [[Duct]] (or press U).\n2. Leave the size at 24×12 and click [[Start Tracing]].\n3. Click along the office from the corridor side. The chip under the cursor reads the air still to serve (600 CFM downstream) and suggests a size for it at 0.08″ per 100′.\n4. Press S and tap the suggestion (spiral first, then the rectangular twin).\n5. Click one more point.\n6. Press Enter.\nThe elbows and the transition count themselves.',
      target: ['#ductSizePopover', '#ductCreateStart', '#ductBtn', '#headerMoreBtn'],
      check: () => ductRuns().some((r) => (r.segments || []).length >= 2),
      action: { label: 'Trace and size it for me', run: traceMain },
    },
    {
      id: 'attach', title: 'Hang the strays', kind: 'do',
      body: 'Two diffusers sit within 8″ of the main and draw a dashed leader to it: attached, their air served. Two draw nothing: strays.\n1. Right-click a bare diffuser.\n2. Click [[Attach to nearest run]].\n3. Do the same for the other one.\nEach moves onto the main and its leader appears.',
      target: ['#ctxAttachToRun', '#annCanvas'],
      check: () => cfmDevices().length >= 4 && unattachedDevices().length === 0,
      hint: () => { const n = unattachedDevices().length; return n ? n + ' diffuser' + (n === 1 ? '' : 's') + ' still hanging off nothing' : ''; },
      action: { label: 'Hang the strays for me', run: rescueStrays },
    },
    {
      id: 'schedule', title: 'Pounds, not feet', kind: 'read',
      body: '1. In the left sidebar, under DUCT, click [[Schedule]].\nStraight duct by size with its gauge and lb/ft from the SMACNA table, the fittings you did not have to count, seam & waste on its own line, and the number a sheet-metal bid is built on: Bid weight.\n2. Click [[Copy Schedule]] to put it on the clipboard.',
      target: ['#ductScheduleBtn', '#ductSectionTitle'],
      check: () => true,
    },
    {
      id: 'bidcheck', title: 'Sign off', kind: 'do',
      body: 'Bid Check judged the rooms, the flex and the scale for you: four 150-CFM diffusers serve the office\'s 442 CFM, so that row reads ✓. The manual rows are yours.\n1. In the left sidebar, click BID CHECK to expand it.\n2. Click the words Fits the roof to tick it.',
      target: ['#bidCheckSection label', '#bidCheckSectionTitle'],
      check: () => !!(state().bidCheck && state().bidCheck.manual && state().bidCheck.manual['duct-fits-roof']),
      action: { label: 'Tick it for me', run: tickFitsTheRoof },
    },
    {
      id: 'handoff', title: 'Hand it off', kind: 'read',
      body: '1. Under EXPORT OPTIONS, click [[Copy to /Tooling]].\n2. Click [[Everything]].\nThe first line names exactly what was copied (the project, the scope, the layers) and the Duct block at the end carries the pounds. With an open Bid Check row the gate asks first; [[Export anyway]] remembers your answer until something changes.',
      target: ['#forPipeTooling', '#exportOptionsSectionTitle'],
      check: () => true,
    },
    {
      id: 'legend', title: 'What the sheet says now', kind: 'read',
      body: 'The main paints at its real width under the stroke, the size chips ride each segment, the room wears its totals tag, and the legend lists duct by size with the room\'s air line.\n1. Click the SUMMARY heading to open [[Legend Settings]].\nIt gained its duct rows the moment the first run existed; Show duct true width turns the band off when you want bare linework.',
      target: ['#legendSettingsBtn', '#legendBtn', '#summarySectionTitle'],
      check: () => true,
    },
    {
      id: 'done', title: 'That is the whole loop', kind: 'read',
      body: 'Scale, prove it, room, diffusers, system, main sized at S, strays hung, pounds, sign-off, hand-off.\nYour work here is saved on this device like any takeoff. When you are ready for a real M-sheet, click [[Upload PDF]] in the header. The two guides, HVAC takeoff and Duct takeoff by the pound, live under Help → Guides.',
      target: [],
      check: () => true,
    },
  ];

  const TOURS = {
    electrical: { steps: ELECTRICAL_STEPS, doneKey: 'clickcount-tour-done', linkId: 'canvasEmptyHintTour' },
    plumbing: { steps: PLUMBING_STEPS, doneKey: 'clickcount-tour-done-plumbing', linkId: 'canvasEmptyHintTourPlumbing' },
    hvac: { steps: HVAC_STEPS, doneKey: 'clickcount-tour-done-hvac', linkId: 'canvasEmptyHintTourHvac' },
  };
  const tourFromParam = (v) => (v === 'plumbing' ? 'plumbing' : v === 'hvac' ? 'hvac' : (v === '1' || v === 'electrical') ? 'electrical' : null);

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
    } catch (e) { App.showToast('Could not load the sample plan. Upload PDF works the same way.'); }
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
  // ===== HVAC "do it for me" =========================================================
  const cfmIcon = () => (App.cfmDefaultIcon && App.cfmDefaultIcon()) || customIcon('Supply diffuser') || App.getOrderedIcons()[0].value;
  async function boxOpenOffice() {
    if (hRoom() && ann() && (ann().roomBoxes || []).some((b) => b.roomId === hRoom().id)) return;
    if (!App.openRoomBoxModal) return;
    App.openRoomBoxModal(OPEN_OFFICE);
    // D24 reads the name off the plan; the text layer may land a beat later.
    const nameEl = el('roomBoxNewRoomName');
    for (let i = 0; i < 20 && nameEl && !nameEl.value.trim(); i++) await wait(100);
    if (nameEl && !nameEl.value.trim()) nameEl.value = 'OPEN OFFICE 104';
    const h = el('roomBoxHeight'); if (h) h.value = '9';
    const deck = el('roomBoxDeck'); if (deck) deck.value = '12';
    const type = el('roomBoxType'); if (type) { type.value = 'office'; type.dispatchEvent(new Event('change')); }
    await wait(50);
    if (el('roomBoxApply')) el('roomBoxApply').click();
    // The dialog's deck row shows only on an HVAC-shaped project; the trade
    // stamp made it one, but keep the promise either way.
    if (App.setDuctDeckHeight && !(App.getDuctSettings && App.getDuctSettings().deckHeightFt > 0)) App.setDuctDeckHeight(12);
    state().tool = App.TOOL.NONE; App.updateUI(); App.renderAnnotations();
  }
  function addDiffuser() {
    if (hCounter()) return;
    const c = { id: App.uid(), name: 'Supply Diffuser', icon: cfmIcon(), color: '#e8c547', cfm: 150 };
    tourCounterId = c.id;
    pushCounter(c);
  }
  function placeFourDiffusers() {
    if (!hCounter()) addDiffuser();
    const have = cfmDevices().length;
    if (have >= 4) return;
    placeMarkers(hCounter().id, DIFFUSER_SPOTS.slice(have));
  }
  async function makeSystem() {
    const s = state();
    let g = (s.groups || []).find((x) => x.capacityCfm > 0);
    if (!g) {
      if (!s.groupsEnabled) { if (App.turnOnGroups) App.turnOnGroups(); else s.groupsEnabled = true; }
      if (App.openGroupModal) {
        App.openGroupModal(null);
        await wait(50);
        el('groupModalName').value = 'RTU-1';
        el('groupModalEquipTag').value = 'RTU-1';
        el('groupModalCapacityCfm').value = '2000';
        el('groupModalDone').click();
        await wait(100);
        g = (s.groups || []).find((x) => x.equipmentTag === 'RTU-1');
      }
      if (!g) { App.pushUndoSnapshot(); g = { id: App.uid(), name: 'RTU-1', color: '#2e86de', equipmentTag: 'RTU-1', capacityCfm: 2000 }; s.groups = s.groups || []; s.groups.push(g); App.markProjectDirty(); }
    }
    s.activeGroupId = g.id;   // the main traced next inherits the system (the T2-12 convention)
    App.updateUI();
  }
  async function traceMain() {
    if (ductRuns().length) return;
    const s = state();
    if (!(s.groups || []).some((x) => x.capacityCfm > 0)) await makeSystem();
    if (s.drawingDuct) { App.clearDuctDraft && App.clearDuctDraft(); }
    // The real create dialog, sized 24×12, then the same clicks a trace makes.
    if (el('ductBtn')) el('ductBtn').click();
    await wait(100);
    if (typeof makeRectSize === 'function' && App.setDuctCreateSize) App.setDuctCreateSize(makeRectSize(24, 12));
    if (el('ductCreateStart')) el('ductCreateStart').click();
    await wait(50);
    if (!s.drawingDuct) return;
    App.commitDuctClick(MAIN_VERTICES[0]);
    App.commitDuctClick(MAIN_VERTICES[1]);
    // The ductulator's answer at vertex 2, taken exactly as S would take it.
    const sug = App.getDuctDraftSuggestion && App.getDuctDraftSuggestion();
    const next = (sug && (sug.rectSize || sug.size)) || (typeof makeRectSize === 'function' ? makeRectSize(16, 10) : null);
    if (next) App.applyDuctSizeStep(next);
    App.commitDuctClick(MAIN_VERTICES[2]);
    App.finishDuctRun();
    s.tool = App.TOOL.NONE; App.updateUI(); App.renderAnnotations();
  }
  function rescueStrays() {
    const s = state();
    const c = hCounter(); if (!c) return;
    const a = ann(); if (!a) return;
    const markers = a.counterMarkers[c.id] || [];
    let moved = 0;
    markers.forEach((m, i) => {
      s.ctxTarget = { type: 'marker', typeId: c.id, index: i };
      const target = App.strayDeviceAttachTarget && App.strayDeviceAttachTarget();
      if (!target) return;
      if (!moved) App.pushUndoSnapshot();
      target.marker.x = target.point.x; target.marker.y = target.point.y; moved++;
    });
    s.ctxTarget = null;
    if (moved) { App.markProjectDirty(); App.renderAnnotations(); App.updateUI(); }
  }
  function tickFitsTheRoof() {
    const s = state();
    s.bidCheck = s.bidCheck || { manual: {} };
    s.bidCheck.manual = s.bidCheck.manual || {};
    if (s.bidCheck.manual['duct-fits-roof']) return;
    App.pushUndoSnapshot();
    s.bidCheck.manual['duct-fits-roof'] = true;
    App.markProjectDirty(); App.updateUI();
    App.logUserEvent && App.logUserEvent('bid_check_row_state', s.currentProjectId || null, { row: 'duct-fits-roof', kind: 'manual', state: true, surface: 'tour' });
  }

  function el(id) { return document.getElementById(id); }
  let lastTarget = null;   // the element last spotlighted — a new one is scrolled into view
  let scrollSettled = false; // …until it has actually been on screen once (a dialog's scroll
                             // panel may not have laid out on the first tick); after that the
                             // reader may scroll away freely
  // Step bodies name controls the way they look on screen: [[+ Add]] renders as a
  // button-shaped chip (.tour-ui). Everything else is escaped text.
  const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const chips = (t) => escapeText(t).replace(/\[\[(.+?)\]\]/g, '<span class="tour-ui">$1</span>');
  // A body is lines: "1. …" lines are one action each and render as a numbered list;
  // any other line is a short paragraph around them.
  const bodyHtml = (body) => {
    const out = []; let items = [];
    const flush = () => { if (items.length) { out.push('<ol class="tour-steps">' + items.map((t) => '<li>' + chips(t) + '</li>').join('') + '</ol>'); items = []; } };
    String(body).split('\n').forEach((line) => {
      const m = line.match(/^\s*\d+\.\s+(.*)$/);
      if (m) items.push(m[1]); else { flush(); if (line.trim()) out.push('<p>' + chips(line) + '</p>'); }
    });
    flush(); return out.join('');
  };
  function render() {
    const overlay = el('tourOverlay');
    if (!overlay) return;
    overlay.style.display = active ? '' : 'none';
    if (!active) return;
    const step = STEPS[stepIdx];
    const done = safeCheck(step);
    el('tourStepNo').textContent = (stepIdx + 1) + ' / ' + STEPS.length;
    el('tourTitle').textContent = step.title;
    el('tourBody').innerHTML = bodyHtml(step.body);
    const actionBtn = el('tourAction');
    if (step.action && !done) { actionBtn.style.display = ''; actionBtn.textContent = step.action.label; }
    else actionBtn.style.display = 'none';
    const next = el('tourNext');
    next.textContent = stepIdx === STEPS.length - 1 ? 'Finish' : (step.kind === 'read' || done ? 'Next' : 'Skip step');
    next.classList.toggle('tour-next-ready', step.kind === 'read' || done);
    el('tourBack').style.visibility = stepIdx === 0 ? 'hidden' : '';
    el('tourStatus').textContent = step.kind === 'do' ? (done ? '✓ Done' : ((step.hint && safeHint(step)) || 'Waiting for you…')) : '';
    el('tourDots').innerHTML = STEPS.map((s, i) => '<span class="tour-dot' + (i < stepIdx ? ' past' : i === stepIdx ? ' now' : '') + '"></span>').join('');
    // spotlight + card placement: the ladder follows the reader into an open
    // dialog (only a control inside it qualifies there)
    const openModal = document.querySelector('.modal-overlay.visible');
    const modalOpen = !!openModal;
    const target = step.target.length ? q(step.target, openModal) : null;
    const spot = el('tourSpot');
    const card = el('tourCard');
    if (target) {
      if (target !== lastTarget) scrollSettled = false;
      let r = target.getBoundingClientRect();
      const inView = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      if (!inView && !scrollSettled) { try { target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); r = target.getBoundingClientRect(); } catch (_) {} }
      else if (inView) scrollSettled = true;
      lastTarget = target;
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
    // auto-advance a beat after a doing-step completes — never on a step the
    // reader came Back to (its work is already there; Next is lit instead)
    if (step.kind === 'do' && done && !heldByBack && stepIdx < STEPS.length - 1) {
      if (!doneAt) doneAt = Date.now();
      else if (Date.now() - doneAt > 900) goTo(stepIdx + 1);
    } else doneAt = 0;
  }
  function safeCheck(step) { try { return !!step.check(); } catch (_) { return false; } }
  function safeHint(step) { try { return step.hint() || ''; } catch (_) { return ''; } }
  function goTo(i) {
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    heldByBack = next < stepIdx;
    stepIdx = next;
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
    stepIdx = 0; doneAt = 0; heldByBack = false; tourCounterId = null; tourLineTypeId = null; tourSecondCounterId = null;
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
    // A "Project from Last Session" offer that arrived mid-tour waited for
    // this moment (features/restore-last-session.js; no-op otherwise).
    if (App.retryDeferredRestorePrompt) App.retryDeferredRestorePrompt();
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
    // A separator shows only when the links on BOTH sides of it do (three tours,
    // two separators: "plumbing · electrical · hvac").
    document.querySelectorAll('.canvas-empty-hint-tour-sep').forEach((sep) => {
      const vis = (n) => !!n && n.tagName === 'A' && n.style.display !== 'none';
      sep.style.display = (!allDone && vis(sep.previousElementSibling) && vis(sep.nextElementSibling)) ? '' : 'none';
    });
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
  el('settingsTourHvac') && (el('settingsTourHvac').onclick = () => { App.hideModal('settingsModal'); startTutorial('hvac'); });
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
