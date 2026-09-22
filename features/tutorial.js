/*
 * features/tutorial.js - the interactive walkthroughs: learn the app by doing a
 * small takeoff on the sample plan, one coach-marked step at a time. Two tours
 * share one engine — `electrical` (receptacles, conduit with conductors, chained
 * runs with the vertical, a circuit, Bid Check) and `plumbing` (prove the scale,
 * count the Men's room, a Quick Line, chain the lav battery, a riser drop,
 * hangers as child counts, a ×3 typical-floor zone, an RFI note, the proof
 * modal, the PipeTooling hand-off).
 *
 * A step is { id, title, body, kind, target (selector list), check(), action?, alt?, hint?, progress?, hold?, cardAt?, reveal? }
 * (alt: a second button beside a hands-off step's own, { label, run }: the blank-sheet tour's
 * welcome offers "Pick up at step 20" and "Start over" when the reader left mid-way)
 * (hold: a done step waits for Next instead of advancing by itself: the proof step, whose
 * whole point is a dialog the reader should get to read)
 * (body may be a FUNCTION: called at every render, for a step whose text reads the takeoff
 * as it stands, the course's compare-to-the-reference step)
 * (reveal: a reading step that asks before it tells. The body is the question about the
 * sheet; the answer waits behind the action button, "Show the engineer's answer" or the
 * step's own revealLabel, and Next is lit throughout. The plumbing course's teaching mode,
 * journeys/plans/PLUMBING-COURSE.md)
 * (hint() is the status line while a doing-step's check is failing for a reason
 * worth naming — the prove-the-scale step says what it read; it renders as a miss.
 * progress() is the same line for GUIDANCE on a step with several parts — "Bound.
 * Now press 1 and click inside the circle" — and renders neutral, like "1 of 3 done".)
 * The overlay spotlights the target (a box-shadow cutout that never intercepts
 * the pointer, so the real control stays clickable) and the card beside it says
 * what to do; `check()` reads the REAL app state and the step advances the
 * moment it is true — no fake widgets, no scripted clicks. The reader DOES every
 * step (2026-09-21, the owner: "instead of being able to click through it"): work
 * on the sheet is asked for inside TARGETS drawn on the plan (circles for clicks, a
 * shaded boundary for a drag; see "on-sheet targets" below) and only counts there;
 * "Show me where" pulses the target or the lit control; Next works only once the
 * step is done; a quiet "Skip this step" keeps anyone from being stuck. Each step's
 * `action.run` (the old "Do it for me") survives as a SPEC AND SCREENSHOT SEAM,
 * App.tutorialDoStep(), and as the button of a `handsOff` step (opening the sample
 * sheets, which nobody can do by hand). Reading steps advance on Next.
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
 * restrooms Men 107 / Women 108 carry drawn water closets and lavatories; a
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
  let pending = false;     // a ?tour= start is queued: the boot's restore offer must wait for it
  let tourId = 'electrical';
  let STEPS = [];
  let stepIdx = 0;
  let timer = null;
  let doneAt = 0;          // when the current step's check first passed (auto-advance after a beat)
  let heldByBack = false;  // the step was re-entered with Back: never auto-advance, Next lights up
  let revealed = false;    // a reveal step's answer is showing (reset on every step change)
  let tourCounterId = null;
  let tourLineTypeId = null;
  let tourSecondCounterId = null;
  let placedOnce = false;   // the HVAC diffusers were placed in their circles (the Attach step moves them afterwards)

  // First visible match of the ladder. While a dialog is open only a control
  // inside it qualifies — the header and sidebar sit under the backdrop.
  // A control in the phone's closed sidebar drawer is laid out but parked off the
  // side of the screen: that is not visible either (a dialog's scrolled-away row,
  // off the top or bottom, still is: the spotlight scrolls it into view).
  const onScreenX = (el) => { const r = el.getBoundingClientRect(); return r.right > 0 && r.left < window.innerWidth; };
  // On a tablet the header's tool strip scrolls sideways, so a tool can be shown yet past the
  // edge; it still counts (render scrolls it into view), where a tool that is display:none does not.
  const inStrip = (el) => !!el.closest('.header-tools-scroll');
  const q = (sels, within) => { for (const s of [].concat(sels)) { const el = document.querySelector(s); if (el && el.offsetParent !== null && (onScreenX(el) || inStrip(el)) && (!within || within.contains(el))) return el; } return null; };
  const state = () => App.state;
  const ann = () => (state().pages && state().pages.length ? App.getActiveAnnotations(state().pages[state().currentPage]) : null);
  const markCount = (cid) => { let n = 0; (state().pages || []).forEach((p) => { const a = App.getActiveAnnotations(p); n += ((a && a.counterMarkers && a.counterMarkers[cid]) || []).length; }); return n; };
  const findCounter = (id, re) => (state().counters || []).find((c) => c.id === id) || (state().counters || []).find((c) => re.test(c.name || ''));
  const customIcon = (name) => ((App.getEffectiveCustomIcons() || []).find((i) => i.name === name) || {}).value;
  const firstIcon = () => customIcon('Toilet') || App.getOrderedIcons()[0].value;

  // ===== on-sheet targets (2026-09-21) ====================================================
  // A step that works ON THE SHEET says where, in the sheet's own points: circles for
  // clicks, a boundary for a drag. They are drawn over the plan (#tourZones, never
  // intercepting the pointer), follow pan and zoom, turn green when satisfied, and the
  // step's check only counts work done INSIDE them. They are gracious on purpose: a
  // circle is a couple of feet of plan wide and never under TARGET_MIN_PX on screen.
  //   circle: { kind: 'circle', x, y, r, done }        box: { kind: 'box', outer, inner, done, label? }
  // A step declares `zones: () => [...]` (evaluated live) and `page` (the sheet they are on).
  const TARGET_MIN_PX = 26;
  const norm = (r) => ({ x1: Math.min(r.x1, r.x2), y1: Math.min(r.y1, r.y2), x2: Math.max(r.x1, r.x2), y2: Math.max(r.y1, r.y2) });
  const grow = (r, d) => { const n = norm(r); return { x1: n.x1 - d, y1: n.y1 - d, x2: n.x2 + d, y2: n.y2 + d }; };
  const holds = (outer, inner) => { const o = norm(outer), i = norm(inner); return o.x1 <= i.x1 && o.y1 <= i.y1 && o.x2 >= i.x2 && o.y2 >= i.y2; };
  const zoneR = (z) => Math.max(z.r, TARGET_MIN_PX / Math.max(0.05, state().zoom || 1));   // the radius that COUNTS, in sheet points
  const inCircle = (pt, z) => Math.hypot(pt.x - z.x, pt.y - z.y) <= zoneR(z);
  const pageAnnOf = (i) => { const p = state().pages && state().pages[i]; return p ? App.getActiveAnnotations(p) : null; };
  const markersOf = (pageIdx, counterId) => { const a = pageAnnOf(pageIdx); if (!a) return []; const m = a.counterMarkers || {}; return counterId ? (m[counterId] || []) : Object.keys(m).reduce((all, k) => all.concat(m[k] || []), []); };
  // One circle per spot, each done once a mark of `counterId` (any counter when null) sits
  // in it. Close spots share a mark to the NEAREST circle only, so two circles never both
  // light from one click.
  function markZones(pageIdx, counterId, spots, r, test) {
    const zs = spots.map((s) => ({ kind: 'circle', x: s.x, y: s.y, r, done: false }));
    markersOf(pageIdx, counterId).filter((m) => !test || test(m)).forEach((m) => {
      let best = null, bd = Infinity;
      zs.forEach((z) => { const d = Math.hypot(m.x - z.x, m.y - z.y); if (d < bd) { bd = d; best = z; } });
      if (best && inCircle(m, best)) best.done = true;
    });
    return zs;
  }
  const strayMarks = (pageIdx, counterId, zones) => markersOf(pageIdx, counterId).filter((m) => !zones.some((z) => inCircle(m, z))).length;
  // A drag: `rects` are the candidates the reader has made; one must hold `inner` and stay in `outer`.
  function boxZone(rects, inner, outer, label) {
    const ok = (rects || []).some((r) => holds(r, inner) && holds(outer, r));
    return { kind: 'box', inner: norm(inner), outer: norm(outer), done: ok, label: label || '' };
  }
  function boxMiss(rects, inner, outer) {
    const last = (rects || [])[(rects || []).length - 1];
    if (!last || (holds(last, inner) && holds(outer, last))) return '';
    return !holds(outer, last) ? 'Part of that box is outside the boundary. Undo it and drag inside the shaded area' : 'That box misses part of what it should wrap. Undo it and drag around all of it';
  }
  // A traced run: a corner inside each circle, in order (extra corners between are fine).
  function pathZones(spots, r, runs) {
    const zs = spots.map((s) => ({ kind: 'circle', x: s.x, y: s.y, r, done: false }));
    let bestHit = 0;
    (runs || []).forEach((pts) => {
      [pts, pts.slice().reverse()].forEach((seq) => { let k = 0; seq.forEach((pt) => { if (k < zs.length && inCircle(pt, zs[k])) k++; }); if (k > bestHit) bestHit = k; });
    });
    zs.forEach((z, i) => { z.done = i < bestHit; });
    return zs;
  }
  const allDone = (zs) => zs.length > 0 && zs.every((z) => z.done);
  const stepZones = (step) => { try { return (step && step.zones && step.zones()) || []; } catch (_) { return []; } };

  // ===== steps both tours share ==============================================================
  // Sample-plan geometry in PDF points: the drawing is candidate A's 12 px/ft SVG
  // placed at (60, 70) × 0.75 (scripts/sample-plan-candidates.js PLAN_AT), so a
  // drawing point lands at (60 + 0.75·px, 70 + 0.75·py). The 20'-0" dimension on
  // the left edge, grid A down to the corridor, is SVG (112,100)–(112,340).
  const DIM_20FT = [{ x: 144, y: 145 }, { x: 144, y: 325 }];
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
    body: '1. In the header, click [[Measure]] (or press D).\n2. Click the tick mark at one end of the 20\'-0" dimension on the left edge: it is circled.\n3. Click the tick mark in the other circle.\nThe footer should read 20\'-0". If it reads anything else, click [[Back]] and set the scale again. Do this on every real sheet: a PDF printed to a smaller sheet looks right and measures short.',
    target: ['#measureBtn', '#measureBtnSidebar'],
    page: 0,
    zones: () => { const ft = measuredFeet(); const ok = ft != null && Math.abs(ft - PROVE_FT) <= PROVE_TOL_FT; return DIM_20FT.map((p) => ({ kind: 'circle', x: p.x, y: p.y, r: 13, done: ok })); },
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
      handsOff: true,   // fetching the sample is the app's job: this step's button does it
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
      body: 'The counter tool is armed. Three circles sit on the north wall of Open Office 105.\n1. Click inside the first circle.\n2. Click inside the second.\n3. Click inside the third.\nAnywhere in a circle counts. Each click is one tally; the sidebar count moves as you go.',
      target: ['#annCanvas'], page: 0,
      zones: () => { const c = eCounter(); return markZones(0, c ? c.id : '-', RECEPTACLE_SPOTS, 15); },
      check: () => allDone(markZones(0, (eCounter() || {}).id || '-', RECEPTACLE_SPOTS, 15)),
      hint: () => { const c = eCounter(); const n = c ? strayMarks(0, c.id, markZones(0, c.id, RECEPTACLE_SPOTS.concat(CHAIN_SPOTS), 15)) : 0; return n ? 'A mark outside the circles does not count. Press Ctrl+Z to undo it, then click inside a circle' : ''; },
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
      body: '1. In the header, click [[Chain]] (or press T).\n2. In the Chain panel, choose the receptacle and 3/4" EMT.\n3. Click inside the first circle on the south wall.\n4. Click inside the second, then the third.\nEvery click places the device, draws the run back to the previous one and writes the vertical drop. The footer tells you the drop before you click.',
      target: ['#chainPanel', '#chainBtn'], page: 0,
      zones: () => { const c = eCounter(); return markZones(0, c ? c.id : '-', CHAIN_SPOTS, 15); },
      check: () => { const a = ann(); return !!a && allDone(markZones(0, (eCounter() || {}).id || '-', CHAIN_SPOTS, 15)) && (a.quickLines || []).filter((l) => (l.endDrop || 0) > 0 || (l.startDrop || 0) > 0).length >= 2; },
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
      body: '1. In the left sidebar, click BID CHECK to expand it.\nConduit fill is already judged: 3/4" EMT at 10%. It has also caught something: the receptacles you counted first were never wired, so they read as not reached by a run. Voltage drop to the farthest device and the panel cross-check wake up once a run is flagged as the homerun and the panel is on the plan. Below them are the calls only you can tick. It never blocks an export; it tells you what is open.',
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
  // Women 108 is SVG (760,384)–(940,600) → PDF (630, 358)–(765, 520): its three water
  // closets sit in stalls on the south wall (bowls at y ≈ 506), its three lavatories
  // on the north-wall counter (y ≈ 369). Men 107 has two of each plus urinals, so
  // the tour counts the women's room.
  const WC_SPOTS = [{ x: 645, y: 506 }, { x: 675, y: 506 }, { x: 705, y: 506 }];
  const LAV_SPOTS = [{ x: 688.5, y: 369 }, { x: 717, y: 369 }, { x: 745.5, y: 369 }];
  const WOMEN_ROOM = { x1: 628, y1: 356, x2: 767, y2: 522 };
  const WOMEN_INNER = { x1: 638, y1: 364, x2: 757, y2: 514 };   // the room's fixtures: what a typical-floor box must hold
  const typicalZones = () => { const a = ann(); return ((a && a.multiplyZones) || []).filter((z) => (z.multiplier || 1) > 1); };
  const RFI_SPOT = { x: 690, y: 425 };
  const RFI_TEXT = 'RFI: ADA clearance at the end stall in Women 108?';

  const pCounter = () => findCounter(tourCounterId, /water closet|toilet|\bwc\b/i);
  const pLav = () => findCounter(tourSecondCounterId, /lav|sink/i);
  const pLineType = () => (state().lineTypes || []).find((lt) => lt.id === tourLineTypeId) || (state().lineTypes || [])[0];
  const anyNoteRfi = () => (state().pages || []).some((p) => (p.canvases || []).some((cv) => ((cv.annotations && cv.annotations.notes) || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || '')))));
  // a rise or fall written on the run END that sits inside the circle at `spot`
  const dropAt = (spot, r) => { const a = ann(); if (!a) return false; const z = { x: spot.x, y: spot.y, r }; return (a.quickLines || []).some((l) => ((l.startDrop || 0) > 0 && inCircle({ x: l.x1, y: l.y1 }, z)) || ((l.endDrop || 0) > 0 && inCircle({ x: l.x2, y: l.y2 }, z))); };
  const rfiAt = (spot, r) => { const a = ann(); return !!a && (a.notes || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || '')) && inCircle({ x: n.x, y: n.y }, { x: spot.x, y: spot.y, r })); };
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
      handsOff: true,   // fetching the sample is the app's job: this step's button does it
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
      id: 'place', title: 'Count the water closets', kind: 'do',
      body: 'The counter tool is armed, and the three water closets in the stalls of Women 108 are circled.\n1. Click inside the first circle.\n2. Click inside the second.\n3. Click inside the third.\nAnywhere in a circle counts. One click is one tally; the sidebar count moves as you go, rolled up across every sheet in the set.',
      target: ['#annCanvas'], page: 0,
      zones: () => { const c = pCounter(); return markZones(0, c ? c.id : '-', WC_SPOTS, 13); },
      check: () => allDone(markZones(0, (pCounter() || {}).id || '-', WC_SPOTS, 13)),
      hint: () => { const c = pCounter(); const n = c ? strayMarks(0, c.id, markZones(0, c.id, WC_SPOTS, 13)) : 0; return n ? 'A mark outside the circles does not count. Press Ctrl+Z to undo it, then click inside a circle' : ''; },
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
      body: 'The three lavatories on the north wall of Women 108 sit on one 1in PEX branch that runs lav to lav, so count them the other way.\n1. In the header, click [[Chain]] (or press T).\n2. In the Chain panel, choose a Lavatory counter ([[+ New counter]] makes one right there) and 1in PEX.\n3. Click inside the circle on the first lavatory.\n4. Click inside the second, then the third.\nEvery click places the fixture AND draws the branch back to the last one: three clicks instead of nine.',
      target: ['#counterCreate', '#counterQuickCountAdd', '#chainPanel', '#chainBtn'], page: 0,
      zones: () => { const c = pLav(); return markZones(0, c ? c.id : '-', LAV_SPOTS, 12); },
      check: () => { const a = ann(); return !!a && allDone(markZones(0, (pLav() || {}).id || '-', LAV_SPOTS, 12)) && (a.quickLines || []).length >= 2; },
      action: { label: 'Chain the three lavs for me', run: chainThreeLavs },
    },
    {
      id: 'drop', title: 'Add the riser', kind: 'do',
      body: 'The branch comes up from below the slab.\n1. In the header, click [[Drop]] (or press B).\n2. In the palette, choose 3 ft.\n3. Click the end of the run inside the circle, at the first lavatory.\nThe riser\'s 3 ft joins the footage: plan view never shows it, the bid needs it. Clicking the same end again clears it.',
      target: ['#dropPanel', '#dropBtn'], page: 0,
      zones: () => [{ kind: 'circle', x: LAV_SPOTS[0].x, y: LAV_SPOTS[0].y, r: 14, done: dropAt(LAV_SPOTS[0], 14) }],
      check: () => dropAt(LAV_SPOTS[0], 14),
      hint: () => (anyDrop() && !dropAt(LAV_SPOTS[0], 14) ? 'That drop is on another end. Click the same end again to clear it, then click the end inside the circle' : ''),
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
      body: 'This restroom core repeats on three floors.\n1. In the header, click [[⋯]], then [[Multiply Zone]] (or press X).\n2. Drag a box around Women 108: start and end anywhere inside the shaded boundary.\n3. Type 3.\n4. Click [[Apply]].\nEvery count and every foot inside triples in the totals while the marks stay clean: count one floor, bid three.',
      target: ['#multiplyZoneBtn', '#multiplyZoneBtnSidebar', '#headerMoreBtn'], page: 0,
      zones: () => [boxZone(typicalZones(), WOMEN_INNER, grow(WOMEN_ROOM, 26), 'Drag your box around Women 108, anywhere in here')],
      check: () => boxZone(typicalZones(), WOMEN_INNER, grow(WOMEN_ROOM, 26)).done,
      hint: () => boxMiss(typicalZones(), WOMEN_INNER, grow(WOMEN_ROOM, 26)),
      action: { label: 'Wrap Women 108 in a ×3 zone', run: addTypicalFloorZone },
    },
    {
      id: 'rfi', title: 'Flag a question', kind: 'do',
      body: 'Something the drawing does not say: does the end stall in Women 108 clear ADA?\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click inside the circle in Women 108.\n3. Type RFI: and then the question.\nUnder EXPORT OPTIONS, [[Copy RFI Flags]] collects every such note across the set for the GC, and PipeTooling picks them up as questions on the bid.',
      target: ['#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'], page: 0,
      zones: () => [{ kind: 'circle', x: RFI_SPOT.x, y: RFI_SPOT.y, r: 42, done: rfiAt(RFI_SPOT, 42) }],
      check: () => rfiAt(RFI_SPOT, 42),
      hint: () => (anyNoteRfi() && !rfiAt(RFI_SPOT, 42) ? 'That flag is outside the circle. Drag the note into the circle' : ''),
      action: { label: 'Drop the RFI note for me', run: addRfiNote },
    },
    {
      id: 'proof', title: 'Prove the number', kind: 'do',
      body: '1. In the left sidebar, open SUMMARY.\n2. Click the Water Closet total.\nThe breakdown shows the count per sheet with a thumbnail of where every mark sits, the zone\'s ×3 already applied. This is the page you open when someone asks where the number came from.',
      target: ['#summaryList .summary-item-clickable', '#summarySectionTitle'],
      check: () => { const m = document.getElementById('summaryCountDetailModal'); return !!m && m.classList.contains('visible'); },
      hold: true,   // the step IS the dialog: the reader leaves it with Next, which closes it
      action: { label: 'Open the Water Closet breakdown', run: () => { const c = pCounter(); if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); } },
    },
    {
      id: 'handoff', title: 'Hand it off', kind: 'read',
      body: 'Under EXPORT OPTIONS in the left sidebar:\n1. [[Copy to /Tooling]] puts the whole takeoff on the clipboard (counts, feet with the riser inside, hangers under their pipe), ready to paste into the bid.\n2. [[Copy RFI Flags]] puts the questions beside it.\n3. [[Copy Summary]] for an email.\n4. [[Export PDFs]] for a marked-up plan the GC can read.',
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
  const OPEN_OFFICE = { x1: 158, y1: 358, x2: 412, y2: 520 };   // OPEN OFFICE 105's outline (SVG 130,384 340×216), PDF pts
  const DIFFUSER_SPOTS = [{ x: 215, y: 458 }, { x: 340, y: 458 }, { x: 215, y: 512 }, { x: 340, y: 512 }];   // two 6 pt from the main (attached), two 60 pt off (strays, within the 96 pt rescue)
  const MAIN_VERTICES = [{ x: 164, y: 452 }, { x: 285, y: 452 }, { x: 406, y: 452 }];   // below the room's printed name
  const OFFICE_INNER = { x1: 176, y1: 376, x2: 394, y2: 502 };   // a room box must reach at least this far toward every wall
  const officeBoxes = () => { const a = ann(); return (a && a.roomBoxes) || []; };
  const hCounter = () => findCounter(tourCounterId, /diffuser/i);
  const hRoom = () => (state().rooms || []).find((r) => /open office/i.test(r.name || ''));
  const ductRuns = () => { const a = ann(); return (a && a.ductRuns) || []; };
  // committed runs, plus the corners of the trace in progress, so the circles tick as the reader goes
  const mainPaths = () => { const d = state().drawingDuct; return ductRuns().map((r) => r.vertices || []).concat(d && d.vertices ? [d.vertices] : []); };
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
      handsOff: true,   // fetching the sample is the app's job: this step's button does it
      action: { label: 'Open the sample plan', run: openSamplePlan },
    },
    SCALE_STEP,
    PROVE_STEP,
    {
      id: 'room', title: 'Box a room the plan already names', kind: 'do',
      body: '1. In the header, click [[Room Sizer]] (or press V).\n2. Drag a box around OPEN OFFICE 105, wall to wall: start and end inside the shaded boundary.\n3. The name is already filled in, read off the plan\'s own text. Set Room type to Office.\n4. In Ceiling, type 9. In Deck height, type 12.\n5. Click [[Apply]].\nThe sheet gets one small totals tag placed off the printed name.',
      target: ['#roomBoxApply', '#roomBoxType', '#roomBtn', '#roomBtnSidebar', '#headerMoreBtn'],
      page: 0,
      zones: () => [boxZone(officeBoxes(), OFFICE_INNER, grow(OPEN_OFFICE, 20), 'Drag the room box here, wall to wall')],
      hint: () => boxMiss(officeBoxes(), OFFICE_INNER, grow(OPEN_OFFICE, 20)),
      check: () => { const r = hRoom(); const a = ann(); const ds = App.getDuctSettings ? App.getDuctSettings() : null; return !!(r && r.roomType && a && boxZone(officeBoxes(), OFFICE_INNER, grow(OPEN_OFFICE, 20)).done && ds && ds.deckHeightFt > 0); },
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
      body: 'The counter tool is armed. Four circles sit in OPEN OFFICE 105: two where the main will run, two deeper in the room.\n1. Click inside each of the four circles.\nEach mark carries its 150 CFM; the Rooms row now reads what the room needs against what is served.',
      target: ['#annCanvas'], page: 0,
      zones: () => { const c = hCounter(); return markZones(0, c ? c.id : '-', DIFFUSER_SPOTS, 14); },
      check: () => cfmDevices().length >= 4 && (placedOnce || (placedOnce = allDone(markZones(0, (hCounter() || {}).id || '-', DIFFUSER_SPOTS, 14)))),
      hint: () => { const c = hCounter(); const n = c ? strayMarks(0, c.id, markZones(0, c.id, DIFFUSER_SPOTS, 14)) : 0; return n && !placedOnce ? 'A mark outside the circles does not count. Press Ctrl+Z to undo it, then click inside a circle' : ''; },
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
      body: '1. In the header, click [[Duct]] (or press U).\n2. Leave the size at 24×12 and click [[Start Tracing]].\n3. Click inside the first circle, then the second, working across the office. The chip under the cursor reads the air still to serve (600 CFM downstream) and suggests a size for it at 0.08″ per 100′.\n4. Press S and tap the suggestion (spiral first, then the rectangular twin).\n5. Click inside the third circle.\n6. Press Enter.\nThe elbows and the transition count themselves.',
      target: ['#ductSizePopover', '#ductCreateStart', '#ductBtn', '#headerMoreBtn'], page: 0,
      zones: () => pathZones(MAIN_VERTICES, 16, mainPaths()),
      check: () => ductRuns().some((r) => (r.segments || []).length >= 2) && allDone(pathZones(MAIN_VERTICES, 16, ductRuns().map((r) => r.vertices || []))),
      action: { label: 'Trace and size it for me', run: traceMain },
    },
    {
      id: 'attach', title: 'Hang the strays', kind: 'do',
      body: 'Two diffusers sit within 8″ of the main and draw a dashed leader to it: attached, their air served. Two draw nothing: strays.\n1. Right-click a bare diffuser.\n2. Click [[Attach to nearest run]].\n3. Do the same for the other one.\nEach moves onto the main and its leader appears.',
      target: ['#ctxAttachToRun', '#annCanvas'], page: 0,
      zones: () => unattachedDevices().map((d) => ({ kind: 'circle', x: d.x, y: d.y, r: 14, done: false })),
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
      body: 'The main paints at its real width under the stroke, the size chips ride each segment, the room wears its totals tag, and the legend lists duct by size with the room\'s air line.\n1. Click the SUMMARY heading to open [[Summary Legend]].\nIt gained its duct rows the moment the first run existed; Show duct true width turns the band off when you want bare linework.',
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
  // Resolved when the link fires, not when this file loads, so a tour another file
  // registers (features/tour-blank.js) is reachable by ?tour=<id> too; a lesson's
  // 'lesson:<id>' has its own ?lesson= door.
  const tourFromParam = (v) => (v === '1' ? 'electrical' : (v && TOURS[v] && !String(v).includes(':') ? v : null));

  // --- "do it for me" actions (the same entry points a click uses) --------------------
  // The two sample plans go through the app's own intake, exactly like a dropped
  // file: the design-build sample plan (the office TI, the three tours' sheet) and
  // the engineered sample plan (a restaurant plumbing sheet, Main St Restaurant P-101).
  const ADVANCED_PLAN = '/samples/sample-plan-advanced.pdf';
  async function openPlanFile(url, name) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], name, { type: 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const inp = document.getElementById('pdfInput');
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { App.showToast('Could not load the sample plan. Upload PDF works the same way.'); }
  }
  async function openSamplePlan() { return openPlanFile(SAMPLE_PLAN, 'sample-plan.pdf'); }
  async function openAdvancedSamplePlan() { return openPlanFile(ADVANCED_PLAN, 'sample-plan-advanced.pdf'); }
  // Through the real dialog when it is there — the estimator sees the presets tab
  // and the 1/8" row get picked, the way they will do it on a real sheet — with a
  // direct write as the fallback (specs, a missing modal).
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function applyEighthScale() { return applyScalePreset('1/8" = 1\'', 72 / 8); }
  async function applyScalePreset(label, ppu) {
    const p = state().pages[state().currentPage]; if (!p) return;
    try {
      if (App.openScaleModal) {
        App.openScaleModal();
        const tab = document.querySelector('#scaleModalTabs .counter-tab[data-tab="presets"]');
        if (tab) tab.click();
        await wait(700);
        const row = [...document.querySelectorAll('#scalePresetsList button')].find((b) => b.textContent.trim() === label);
        if (row && document.querySelector('#scaleModal.visible')) { row.click(); await wait(200); }
      }
    } catch (_) { /* fall through to the direct write */ }
    if (App.getPageScale && App.getPageScale(state().currentPage)) return;
    if (App.hideModal) App.hideModal('scaleModal');
    p.scale = { pixelsPerUnit: ppu, unit: 'ft', label };
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
  // Open Office 105 is the box (158, 358)–(412, 520) in PDF points: three spots
  // along its north (corridor) wall east of the door, the chain along its south wall.
  const RECEPTACLE_SPOTS = [{ x: 250, y: 372 }, { x: 310, y: 372 }, { x: 370, y: 372 }];
  const CHAIN_SPOTS = [{ x: 250, y: 506 }, { x: 310, y: 506 }, { x: 370, y: 506 }];
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
    canvas.annotations.multiplyZones.push({ x1: WOMEN_ROOM.x1, y1: WOMEN_ROOM.y1, x2: WOMEN_ROOM.x2, y2: WOMEN_ROOM.y2, multiplier: 3, id: App.uid() });
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
    if (nameEl && !nameEl.value.trim()) nameEl.value = 'OPEN OFFICE 105';
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
  let dragPos = null;      // where the reader dragged the card to, this step
  let lastTarget = null;   // the element last spotlighted — a new one is scrolled into view
  let scrollSettled = false; // …until it has actually been on screen once (a dialog's scroll
                             // panel may not have laid out on the first tick); after that the
                             // reader may scroll away freely
  // Step bodies name controls the way they look on screen: [[+ Add]] renders as a
  // button-shaped chip (.tour-ui). Everything else is escaped text.
  const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // [Guide name](/guides/slug/) is a link that opens beside the app (site paths only).
  const chips = (t) => escapeText(t).replace(/\[\[(.+?)\]\]/g, '<span class="tour-ui">$1</span>').replace(/\[([^[\]]+)\]\((\/[^)\s]*)\)/g, '<a class="tour-link" href="$2" target="_blank" rel="noopener">$1</a>');
  // A body is lines: "1. …" lines are one action each and render as a numbered list;
  // any other line is a short paragraph around them.
  // A touch device has no keys and, under 768 px, no sidebar on screen: the
  // "(or press S)" asides go, and a step that sends the reader to the sidebar
  // says where a phone keeps it.
  // "Narrow" is the app's own breakpoint, 768 px INCLUSIVE (styles.css max-width: 768px): an iPad
  // in portrait is exactly 768, and there the sidebar is a drawer behind ☰, the status-bar links
  // are gone and the header strip scrolls. (< 768 left every tour telling an iPad "in the left sidebar".)
  const isTouch = () => { try { return window.matchMedia('(pointer: coarse)').matches || isNarrow(); } catch (_) { return false; } };
  const isNarrow = () => { try { return window.matchMedia('(max-width: 768px)').matches; } catch (_) { return window.innerWidth <= 768; } };
  const forTouch = (body) => {
    let b = String(body).replace(/\s*\((?:or )?press [^)]*\)/gi, '').replace(/^\d+\.\s+Press [^\n]*\n?/gim, '');
    if (isNarrow() && /left sidebar/i.test(b)) b = b.replace(/[Ii]n the left sidebar/, (m) => (m[0] === 'I' ? 'In the sidebar (tap ☰ at the top left to open it)' : 'in the sidebar (tap ☰ at the top left to open it)'));
    return b;
  };
  const bodyHtml = (rawBody) => {
    const body = isTouch() ? forTouch(rawBody) : rawBody;
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
    const text = (b) => (typeof b === 'function' ? b() : b);
    el('tourBody').innerHTML = bodyHtml(text(step.body)) + (step.reveal && revealed ? '<div class="tour-reveal">' + bodyHtml(text(step.reveal)) + '</div>' : '');
    // The card never does the step for the reader. "Show me where" pulses the circle,
    // the boundary or the lit control; Next works only once the step is really done
    // (a reading step is done by reading); a quiet Skip keeps anyone from being stuck.
    // The one exception is a step nobody CAN do by hand, which says so with `handsOff`:
    // fetching the sample sheets is the app's job, so that step's button does it.
    const ready = step.kind === 'read' || done;
    const zones = stepZones(step);
    const show = el('tourShow');
    if (step.handsOff && !done) { show.style.display = ''; show.textContent = step.action.label; }
    else if (step.kind === 'do' && !done) { show.style.display = ''; show.textContent = 'Show me where'; }
    else show.style.display = 'none';
    const alt = el('tourAlt');
    if (alt) { if (step.alt && !done) { alt.style.display = ''; alt.textContent = step.alt.label; } else alt.style.display = 'none'; }
    // A reveal step's answer waits behind its own button (the course's teaching mode).
    const revealBtn = el('tourReveal');
    if (revealBtn) { if (step.reveal && !revealed) { revealBtn.style.display = ''; revealBtn.textContent = step.revealLabel || 'Show the engineer\'s answer'; } else revealBtn.style.display = 'none'; }
    const next = el('tourNext');
    next.textContent = stepIdx === STEPS.length - 1 ? 'Finish' : 'Next';
    next.disabled = !ready;
    next.classList.toggle('tour-next-ready', ready);
    el('tourSkip').style.display = (!ready && stepIdx < STEPS.length - 1) ? '' : 'none';
    el('tourBack').style.visibility = stepIdx === 0 ? 'hidden' : '';
    const wrongPage = zones.length && step.page != null && state().currentPage !== step.page;
    const progress = zones.length > 1 ? zones.filter((z) => z.done).length + ' of ' + zones.length + ' done' : '';
    el('tourStatus').textContent = step.kind === 'do' ? (done ? '✓ Done' : ((step.hint && safeHint(step)) || (wrongPage ? 'The marks for this step are on sheet ' + (step.page + 1) : '') || (step.progress && safeProgress(step)) || progress || 'Waiting for you…')) : '';
    el('tourStatus').classList.toggle('tour-status-miss', step.kind === 'do' && !done && !!(step.hint && safeHint(step)));
    el('tourDots').innerHTML = STEPS.map((s, i) => '<span class="tour-dot' + (i < stepIdx ? ' past' : i === stepIdx ? ' now' : '') + '"></span>').join('');
    // spotlight + card placement: the ladder follows the reader into an open
    // dialog (only a control inside it qualifies there)
    const openModal = document.querySelector('.modal-overlay.visible');
    const modalOpen = !!openModal;
    let target = step.target.length ? q(step.target, openModal) : null;
    // On a phone the sidebar is a drawer: when the step's control sits in it and
    // nothing of the ladder is on screen, light the ☰ that opens it.
    if (!target && !modalOpen && isNarrow() && step.target.some((sel) => { const t = document.querySelector(sel); return !!t && !!t.closest('#sidebar, .sidebar'); })) target = q(['#hamburger']);
    const spot = el('tourSpot');
    const card = el('tourCard');
    if (target) {
      if (target !== lastTarget) scrollSettled = false;
      let r = target.getBoundingClientRect();
      const inView = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      if (!inView && (!scrollSettled || inStrip(target))) { try { target.scrollIntoView({ block: 'nearest', inline: inStrip(target) ? 'center' : 'nearest' }); r = target.getBoundingClientRect(); } catch (_) {} }
      else if (inView) scrollSettled = true;
      lastTarget = target;
      const pad = 6;
      spot.style.display = '';
      spot.classList.toggle('has-zones', !modalOpen && stepZones(step).length > 0 && (step.page == null || state().currentPage === step.page));
      spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px';
      spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
      // card: beside the target, never ON it. Right, below, left, above, in that order;
      // the first place that fits the viewport wins. When none does (a control in the
      // corner of a big dialog), the viewport corner farthest from the control, which
      // cannot cover it unless the control is most of the screen (found 2026-09-21: the
      // card sat on Trim your set's Open button, the one thing the step asked for).
      const cw = Math.min(360, window.innerWidth - 24), ch = card.offsetHeight || 220;
      const vw = window.innerWidth, vh = window.innerHeight, gap = 16, edge = 12;
      const clampX = (x) => Math.max(edge, Math.min(x, vw - cw - edge)), clampY = (y) => Math.max(edge, Math.min(y, vh - ch - edge));
      const spots = [
        { left: r.right + gap, top: clampY(r.top) },
        { left: clampX(r.left), top: r.bottom + gap },
        { left: r.left - gap - cw, top: clampY(r.top) },
        { left: clampX(r.left), top: r.top - gap - ch },
      ];
      const fits = (c) => c.left >= edge && c.top >= edge && c.left + cw <= vw - edge && c.top + ch <= vh - edge;
      let place = spots.find(fits);
      if (!place) place = { left: (r.left + r.width / 2 > vw / 2) ? edge : vw - cw - edge, top: (r.top + r.height / 2 > vh / 2) ? edge : vh - ch - edge };
      // The sheet itself is the target (count here, click there): nowhere is off it, so
      // the card takes the bottom-left corner, over the sidebar's tail, not the drawing.
      if (r.width * r.height > vw * vh * 0.4) place = { left: edge, top: vh - ch - 40 };
      // A step whose work is on the sheet says which corner keeps the card off it
      // (`cardAt`: 'tl' | 'tr' | 'bl' | 'br'); and the reader can always drag the card
      // by its head, which wins until the step changes.
      if (step.cardAt) place = { left: step.cardAt[1] === 'l' ? edge : vw - cw - edge, top: step.cardAt[0] === 't' ? 56 : vh - ch - 40 };
      // Targets on the sheet outrank everything: the card takes the first corner that
      // covers none of them (it sat on circle 1 of the prove-the-scale step, 2026-09-21).
      const zs = (!modalOpen && (step.page == null || state().currentPage === step.page)) ? zoneScreenBoxes(step) : [];
      if (zs.length) {
        const corners = [{ left: edge, top: vh - ch - 40 }, { left: vw - cw - edge, top: vh - ch - 40 }, { left: vw - cw - edge, top: 56 }, { left: edge, top: 56 }];
        const clear = (c) => !zs.some((b) => c.left < b.x2 + 12 && c.left + cw > b.x1 - 12 && c.top < b.y2 + 12 && c.top + ch > b.y1 - 12);
        place = corners.find(clear) || corners[0];
      }
      if (dragPos) place = { left: clampX(dragPos.left), top: clampY(dragPos.top) };
      const left = place.left, top = place.top;
      card.style.left = left + 'px'; card.style.top = top + 'px'; card.style.right = ''; card.style.bottom = ''; card.style.transform = '';
      // A phone docks the card to an edge (styles.css, max-width 767px): the far
      // one from the control, so the card never covers what it is pointing at.
      card.classList.toggle('tour-card-top', isNarrow() && (r.top + r.height / 2) > window.innerHeight / 2);
    } else {
      card.classList.remove('tour-card-top');
      spot.style.display = 'none';
      // No control to point at (a step about the sheet itself): the corner the step asks
      // for with cardAt, or where the reader dragged it, keeps the card off the drawing.
      const cw = Math.min(360, window.innerWidth - 24), ch = card.offsetHeight || 220, edge = 12;
      let corner = step.cardAt ? { left: step.cardAt[1] === 'l' ? edge : window.innerWidth - cw - edge, top: step.cardAt[0] === 't' ? 56 : window.innerHeight - ch - 40 } : null;
      // With nothing to point at but targets on the sheet, the card still keeps off them (it sat
      // on the quick-key circle on a tablet, where the status-bar link it would light is gone).
      const zs = (!modalOpen && (step.page == null || state().currentPage === step.page)) ? zoneScreenBoxes(step) : [];
      if (zs.length && !corner) {
        const vw = window.innerWidth, vh = window.innerHeight;
        const corners = [{ left: edge, top: vh - ch - 40 }, { left: vw - cw - edge, top: vh - ch - 40 }, { left: vw - cw - edge, top: 56 }, { left: edge, top: 56 }];
        const clear = (c) => !zs.some((b) => c.left < b.x2 + 12 && c.left + cw > b.x1 - 12 && c.top < b.y2 + 12 && c.top + ch > b.y1 - 12);
        corner = corners.find(clear) || corners[0];
      }
      const at = dragPos || corner;
      if (at) { card.style.left = at.left + 'px'; card.style.top = at.top + 'px'; card.style.right = ''; card.style.bottom = ''; card.style.transform = ''; }
      else if (modalOpen) { card.style.left = ''; card.style.top = ''; card.style.right = '16px'; card.style.bottom = '16px'; card.style.transform = ''; }
      else { card.style.left = '50%'; card.style.top = '50%'; card.style.right = ''; card.style.bottom = ''; card.style.transform = 'translate(-50%, -50%)'; }
    }
    // auto-advance a beat after a doing-step completes — never on a step the
    // reader came Back to (its work is already there; Next is lit instead)
    if (step.kind === 'do' && done && !heldByBack && !step.hold && stepIdx < STEPS.length - 1) {
      if (!doneAt) doneAt = Date.now();
      else if (Date.now() - doneAt > 900) goTo(stepIdx + 1);
    } else doneAt = 0;
  }
  // The targets are drawn every animation frame while a tour runs, from the sheet
  // canvas's own box, so they ride pan, zoom and a resize without any hook into those.
  const SVGNS = 'http://www.w3.org/2000/svg';
  let zoneFrame = 0;
  function sheetBox() {
    const page = state().pages && state().pages[state().currentPage];
    const c = el('annCanvas');
    if (!page || !page.pdfPage || !c || !c.width) return null;
    const r = c.getBoundingClientRect();
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    return r.width > 0 ? { left: r.left, top: r.top, k: r.width / vp.width } : null;
  }
  function drawZones() {
    const svg = el('tourZones');
    if (!svg) return;
    const step = active ? STEPS[stepIdx] : null;
    const zones = step && !document.querySelector('.modal-overlay.visible') && (step.page == null || state().currentPage === step.page) ? stepZones(step) : [];
    const box = zones.length ? sheetBox() : null;
    if (!box) { if (svg.childNodes.length) svg.textContent = ''; return; }
    const wrap = document.querySelector('.canvas-wrapper');
    const w = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const X = (x) => box.left + x * box.k, Y = (y) => box.top + y * box.k;
    let html = '<defs><clipPath id="tourZonesClip"><rect x="' + w.left + '" y="' + w.top + '" width="' + w.width + '" height="' + w.height + '"/></clipPath></defs><g clip-path="url(#tourZonesClip)">';
    let n = 0;
    zones.forEach((z) => {
      const d = z.done ? ' is-done' : '';
      if (z.kind === 'circle') {
        n++;
        const cx = X(z.x), cy = Y(z.y), r = zoneR(z) * box.k;
        html += '<circle class="tour-zone' + d + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
        if (zones.length > 1 || z.done) html += '<circle class="tour-zone-tag-bg' + d + '" cx="' + (cx + r * 0.72) + '" cy="' + (cy - r * 0.72) + '" r="9"/><text class="tour-zone-tag" text-anchor="middle" x="' + (cx + r * 0.72) + '" y="' + (cy - r * 0.72 + 4) + '">' + (z.done ? '✓' : n) + '</text>';
      } else {
        const o = z.outer, i = z.inner;
        html += '<rect class="tour-zone' + d + '" rx="10" x="' + X(o.x1) + '" y="' + Y(o.y1) + '" width="' + (o.x2 - o.x1) * box.k + '" height="' + (o.y2 - o.y1) * box.k + '"/>';
        if (!z.done) html += '<rect class="tour-zone-inner" x="' + X(i.x1) + '" y="' + Y(i.y1) + '" width="' + (i.x2 - i.x1) * box.k + '" height="' + (i.y2 - i.y1) * box.k + '"/>';
        if (z.label && !z.done) html += '<text class="tour-zone-label" x="' + (X(o.x1) + 8) + '" y="' + (Y(o.y1) - 7) + '">' + escapeText(z.label) + '</text>';
      }
    });
    html += '</g>';
    if (svg.__last !== html) { svg.innerHTML = html; svg.__last = html; }
  }
  function zoneScreenBoxes(step) {
    const b = sheetBox(); if (!b) return [];
    return stepZones(step).map((z) => { const o = z.kind === 'circle' ? { x1: z.x - zoneR(z), y1: z.y - zoneR(z), x2: z.x + zoneR(z), y2: z.y + zoneR(z) } : z.outer; return { x1: b.left + o.x1 * b.k, y1: b.top + o.y1 * b.k, x2: b.left + o.x2 * b.k, y2: b.top + o.y2 * b.k }; });
  }
  function zoneLoop() { zoneFrame = 0; if (!active) { drawZones(); return; } drawZones(); zoneFrame = requestAnimationFrame(zoneLoop); }
  // Bring the step's targets up to a size worth clicking: when they would draw small, or
  // off the screen, the sheet zooms to them (never past 3x, never under the fit), once,
  // on entering the step. The reader is free to zoom and pan away afterwards.
  function focusOnZones(step) {
    const zones = stepZones(step);
    if (!zones.length || step.focus === false) return;
    if (step.page != null && state().currentPage !== step.page) return;
    const page = state().pages[state().currentPage];
    const wrap = document.querySelector('.canvas-wrapper');
    if (!page || !page.pdfPage || !wrap) return;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, minR = Infinity;
    zones.forEach((z) => {
      const b = z.kind === 'circle' ? { x1: z.x - z.r, y1: z.y - z.r, x2: z.x + z.r, y2: z.y + z.r } : z.outer;
      x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1); x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2);
      if (z.kind === 'circle') minR = Math.min(minR, z.r);
    });
    const W = wrap.clientWidth, Hfull = wrap.clientHeight;
    // On a narrow screen the card docks over the bottom of the sheet (styles.css): the targets
    // are brought up into the part of the sheet the card leaves free.
    const card = el('tourCard');
    const docked = isNarrow() && card && !card.classList.contains('tour-card-top') ? Math.min(Hfull * 0.45, (card.offsetHeight || 0) + 16) : 0;
    const H = Hfull - docked;
    const vp = page.pdfPage.getViewport({ scale: 1, rotation: page.rotation ?? 0 });
    const fit = Math.min(W / vp.width, Hfull / vp.height);
    const z0 = state().zoom || fit;
    const onScreen = (x, y) => { const sx = (state().pan ? state().pan.x : 0) + x * z0, sy = (state().pan ? state().pan.y : 0) + y * z0; return sx > 20 && sy > 20 && sx < W - 20 && sy < H - 20; };
    const bigEnough = minR === Infinity ? true : minR * z0 >= TARGET_MIN_PX;
    if (bigEnough && onScreen(x1, y1) && onScreen(x2, y2)) return;
    const want = Math.min(W / ((x2 - x1) * 1.9 + 1), H / ((y2 - y1) * 1.9 + 1));
    const need = minR === Infinity ? 0 : (TARGET_MIN_PX + 6) / minR;
    const max = Math.min(App.getMaxZoom ? App.getMaxZoom() : 3, 3);
    const z = Math.max(fit, Math.min(max, Math.max(Math.min(want, max), Math.min(need, want))));
    state().zoom = z;
    state().pan = { x: W / 2 - ((x1 + x2) / 2) * z, y: H / 2 - ((y1 + y2) / 2) * z };
    App.renderPdf(); App.updateUI();
  }
  function showMeWhere() {
    const step = STEPS[stepIdx];
    if (step.handsOff && step.action) { Promise.resolve(step.action.run()).then(render); return; }
    if (stepZones(step).length && step.page != null && state().currentPage !== step.page && state().pages[step.page]) { state().currentPage = step.page; App.fitZoom(); }
    focusOnZones(Object.assign({}, step, { focus: true }));
    [el('tourZones'), el('tourSpot')].forEach((n) => { if (!n) return; n.classList.remove('is-pulsing'); void n.getBoundingClientRect(); n.classList.add('is-pulsing'); });
  }
  function safeCheck(step) { try { return !!step.check(); } catch (_) { return false; } }
  function safeHint(step) { try { return step.hint() || ''; } catch (_) { return ''; } }
  function safeProgress(step) { try { return step.progress() || ''; } catch (_) { return ''; } }
  // A dialog the last step opened (the proof breakdown, the Duct Schedule) must
  // not sit over the next step's control: the ladder only lights a target INSIDE
  // an open dialog, so a stray one leaves the step dark (seen 2026-09-21: the
  // plumbing Hand it off step under the proof dialog). On entering a step, any
  // open dialog that holds none of the step's targets is dismissed the way its
  // × would. A dialog the ladder follows into (Quick tab → Add Counter) stays,
  // and the app's own questions (the restore offer, a confirm) are never touched.
  const KEEP_OPEN = ['lastSessionRestoreModal', 'confirmModal'];
  function closeStrayDialogs(step) {
    document.querySelectorAll('.modal-overlay.visible').forEach((ov) => {
      if (KEEP_OPEN.includes(ov.id)) return;
      const holdsTarget = (step.target || []).some((sel) => { const t = document.querySelector(sel); return !!t && ov.contains(t); });
      if (holdsTarget) return;
      const x = ov.querySelector('[data-modal-close]');
      if (x) x.click();
      if (ov.classList.contains('visible') && App.hideModal) App.hideModal(ov.id);
    });
  }
  function goTo(i) {
    dragPos = null;
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    heldByBack = next < stepIdx;
    stepIdx = next;
    doneAt = 0;
    revealed = false;
    closeStrayDialogs(STEPS[stepIdx]);
    setTimeout(() => { if (active) focusOnZones(STEPS[stepIdx]); }, 60);
    App.logUserEvent && App.logUserEvent('tour_step', state().currentProjectId || null, { tour: tourId, step: STEPS[stepIdx].id, index: stepIdx });
    const def = TOURS[tourId];
    if (def && def.onStep) { try { def.onStep(STEPS[stepIdx].id, stepIdx); } catch (_) { /* a tour's own bookkeeping never breaks a move */ } }
    render();
  }
  function startTutorial(id) {
    const s = state();
    if (s.currentProjectId) { App.showToast('Close the cloud project first — the tour runs on the sample plan'); return false; }
    tourId = TOURS[id] ? id : 'electrical';
    STEPS = TOURS[tourId].steps;
    active = true;
    stepIdx = 0; doneAt = 0; heldByBack = false; revealed = false; dragPos = null; placedOnce = false; tourCounterId = null; tourLineTypeId = null; tourSecondCounterId = null;
    document.body.classList.add('tour-active');
    if (timer) clearInterval(timer);
    timer = setInterval(render, 400);
    if (!zoneFrame) zoneFrame = requestAnimationFrame(zoneLoop);
    const def = TOURS[tourId];
    if (def.onStart) { try { def.onStart(); } catch (_) { /* a tour's own bookkeeping never breaks the start */ } }
    App.logUserEvent && App.logUserEvent('tour_step', null, { tour: tourId, step: 'start', index: 0 });
    render();
    return true;
  }
  function stopTutorial(finished) {
    active = false;
    if (timer) { clearInterval(timer); timer = null; }
    document.body.classList.remove('tour-active');
    if (zoneFrame) { cancelAnimationFrame(zoneFrame); zoneFrame = 0; }
    drawZones();
    try { if (finished && TOURS[tourId].doneKey) localStorage.setItem(TOURS[tourId].doneKey, new Date().toISOString()); } catch (_) {}
    App.logUserEvent && App.logUserEvent('tour_step', state().currentProjectId || null, { tour: tourId, step: finished ? 'finished' : 'left', index: stepIdx });
    render();
    syncEntryPoints();
    // A "Project from Last Session" offer that arrived mid-tour waited for
    // this moment (features/restore-last-session.js; no-op otherwise).
    if (App.retryDeferredRestorePrompt) App.retryDeferredRestorePrompt();
    const def = TOURS[tourId];
    if (def && def.onStop) { try { def.onStop(!!finished); } catch (_) { /* a lesson's own bookkeeping never breaks the stop */ } }
  }
  // The empty-canvas hint offers each tour until THAT tour is finished on this
  // device; the whole offer goes when both are.
  function syncEntryPoints() {
    let allDone = true;
    Object.keys(TOURS).filter((id) => TOURS[id].linkId).forEach((id) => {
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
    // The advanced-plan offer stays; only its leading separator follows the tours.
    const advSep = el('canvasEmptyHintAdvancedSep');
    if (advSep) advSep.style.display = allDone ? 'none' : '';
  }

  // The card drags by its head (mouse, pen or finger), so it never has to sit on the
  // part of the sheet the reader is working on.
  (function wireCardDrag() {
    const card = el('tourCard'), head = card && card.querySelector('.tour-card-head');
    if (!head) return;
    let start = null;
    head.style.cursor = 'grab';
    head.style.touchAction = 'none';
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = card.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      try { head.setPointerCapture(e.pointerId); } catch (_) { /* older engines */ }
    });
    head.addEventListener('pointermove', (e) => { if (!start) return; dragPos = { left: start.left + e.clientX - start.x, top: start.top + e.clientY - start.y }; render(); });
    const end = () => { start = null; };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  })();

  // wiring (static DOM)
  const stepReady = () => { const st = STEPS[stepIdx]; return !!st && (st.kind === 'read' || safeCheck(st)); };
  el('tourNext') && (el('tourNext').onclick = () => { if (!stepReady()) return; if (stepIdx >= STEPS.length - 1) stopTutorial(true); else goTo(stepIdx + 1); });
  el('tourSkip') && (el('tourSkip').onclick = () => { if (stepIdx < STEPS.length - 1) { App.logUserEvent && App.logUserEvent('tour_step', state().currentProjectId || null, { tour: tourId, step: STEPS[stepIdx].id, index: stepIdx, skipped: true }); goTo(stepIdx + 1); } });
  el('tourShow') && (el('tourShow').onclick = showMeWhere);
  el('tourAlt') && (el('tourAlt').onclick = () => { const st = STEPS[stepIdx]; if (st && st.alt) Promise.resolve(st.alt.run()).then(render); });
  el('tourBack') && (el('tourBack').onclick = () => goTo(stepIdx - 1));
  el('tourLeave') && (el('tourLeave').onclick = () => stopTutorial(false));
  el('tourReveal') && (el('tourReveal').onclick = () => { revealed = true; render(); });
  Object.keys(TOURS).filter((id) => TOURS[id].linkId).forEach((id) => {
    const link = el(TOURS[id].linkId);
    if (link) link.onclick = (e) => { e.preventDefault(); startTutorial(id); };
  });
  el('settingsTour') && (el('settingsTour').onclick = () => { App.hideModal('settingsModal'); startTutorial('electrical'); });
  el('settingsTourPlumbing') && (el('settingsTourPlumbing').onclick = () => { App.hideModal('settingsModal'); startTutorial('plumbing'); });
  el('settingsTourHvac') && (el('settingsTourHvac').onclick = () => { App.hideModal('settingsModal'); startTutorial('hvac'); });
  el('canvasEmptyHintAdvancedPlan') && (el('canvasEmptyHintAdvancedPlan').onclick = (e) => { e.preventDefault(); openAdvancedSamplePlan(); });
  el('settingsAdvancedPlan') && (el('settingsAdvancedPlan').onclick = () => { App.hideModal('settingsModal'); openAdvancedSamplePlan(); });
  window.addEventListener('resize', () => { if (active) render(); });
  syncEntryPoints();
  // ?tour=plumbing / ?tour=electrical (or the original ?tour=1) opens that tour on
  // load (after the app has booted its state).
  // `pending` covers the 600 ms between load and start: the restore offer reads it
  // (features/restore-last-session.js) and waits, as it does for a running tour.
  try { const raw = new URLSearchParams(location.search).get('tour'); if (raw) { pending = true; setTimeout(() => { pending = false; const id = tourFromParam(raw); if (id) startTutorial(id); }, 600); } } catch (_) { pending = false; }

  // Lessons (features/lessons.js) are tours too: they register their steps here and
  // drive the same engine. A registered tour has no empty-canvas link and no done key
  // of its own; `onStop(finished)` is where it keeps its books.
  App.registerTour = (id, def) => { TOURS[id] = def; };
  App.setTutorialPending = (v) => { pending = !!v; };
  // What a step needs to read the app and to do a thing for the reader, shared with
  // features/lessons.js so a lesson's "Do it for me" goes through the same doors.
  App.tourKit = { q, el, wait, state, ann, markCount, measuredFeet, openPlanFile, applyScalePreset, pushCounter, placeMarkers, pushLineType, chainPoints, firstIcon, customIcon,
    markZones, strayMarks, boxZone, boxMiss, pathZones, allDone, grow, norm, inCircle, markersOf };
  // SPEC AND SCREENSHOT SEAM, never a control: performs the current step the way the old
  // "Do it for me" did, through the same App.* doors, so a spec can build a real takeoff
  // without scripting forty clicks and the guide shots can reach a finished tour.
  App.tutorialDoStep = async () => { const st = active ? STEPS[stepIdx] : null; if (st && st.action) { await st.action.run(); render(); } };
  App.tutorialZones = () => (active ? stepZones(STEPS[stepIdx]) : []);
  // the current targets in CLIENT pixels, where a spec (or a person) would click
  App.tutorialZoneScreen = () => { const b = sheetBox(); if (!active || !b) return []; const X = (x) => b.left + x * b.k, Y = (y) => b.top + y * b.k; const R = (r) => ({ x1: X(r.x1), y1: Y(r.y1), x2: X(r.x2), y2: Y(r.y2) }); return stepZones(STEPS[stepIdx]).map((z) => (z.kind === 'circle' ? { kind: 'circle', cx: X(z.x), cy: Y(z.y), r: zoneR(z) * b.k, done: z.done } : { kind: 'box', outer: R(z.outer), inner: R(z.inner), done: z.done })); };
  App.tutorialStepInfo = () => { const st = active ? STEPS[stepIdx] : null; return st ? { id: st.id, kind: st.kind, done: st.kind === 'read' || safeCheck(st), hasAction: !!st.action } : null; };
  App.startTutorial = startTutorial;
  App.openAdvancedSamplePlan = openAdvancedSamplePlan;   // the engineered sample plan (restaurant plumbing sheet) through the intake
  App.stopTutorial = stopTutorial;
  App.isTutorialActive = () => active;
  App.isTutorialPending = () => pending;
  App.onTutorialTick = () => { if (active) render(); };
  App.tutorialStepId = () => (active ? STEPS[stepIdx].id : null);
  App.tutorialId = () => (active ? tourId : null);
  App.tutorialGoTo = (id) => { const i = STEPS.findIndex((s) => s.id === id); if (i >= 0) goTo(i); };
})();
