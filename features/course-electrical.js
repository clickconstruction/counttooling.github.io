/*
 * features/course-electrical.js - the electrical course: how a restaurant gets its power,
 * taught on the engineered electrical set with the app's own tools. An opener, Before you
 * count (id `before`: six read cards for a reader who has never seen a drawing, ahead of and
 * not counted among the nine), then nine chapters on the tour engine (features/tutorial.js),
 * the plumbing course's sibling (features/course-plumbing.js), same rules, same doors. Plan of
 * record: journeys/plans/ELECTRICAL-COURSE.md. The cards are written for anyone at all
 * (COURSE-LANGUAGE option C, 2026-09-27): every trade and app word glossed where it first
 * appears, a doing card leads with its steps (the last question's answer above them under
 * "Answer:"), no sentence over 25 words. The course speaks ONE edition, NEC 2023 (and IECC 2021
 * for the lighting controls, IBC 2021 for egress), settled 2026-09-27 from the tester dossier
 * (journeys/plans/TESTER-DOSSIER-ELECTRICAL-2026-09-27.md "Settled 2026-09-27").
 *
 * The set (samples/sample-electrical.pdf, scripts/sample-electrical.js): the same Main St
 * Restaurant as P-101 on the same shell, so a device sits at a P-101 coordinate. E-101 the
 * power plan (receptacles by circuit, a J-box at each piece of equipment, panel LP-1 with
 * its working clearance drawn, the meter and main, homeruns with circuit tags), E-201 the
 * lighting plan (every fixture with its TYPE letter beside it, the text the tag reader
 * reads), E-501 the schedules (the fixture schedule the schedule reader turns into
 * counters, and LP-1's panel schedule), E-601 the one-line.
 *
 * The teaching mode is the plumbing course's: a question about the sheet is a doing step
 * whose check passes only on the right click and whose hint says why the wrong one was
 * wrong (which receptacles must be GFCI; which equipment is three phase; which fixtures
 * stay lit when the power fails), the explanation and its section on the next card, work
 * on the sheet inside the engine's on-sheet targets, a QUESTION step drawing none. Where
 * nothing can be clicked, `reveal`. The app's own checks are the teacher where they can be:
 * the voltage-drop row warns at the default 12 A and clears at the load the engineer
 * scheduled; the conduit-fill row judges the feeder the reader traces.
 *
 * Everything a lesson has comes from App.lessonKit (features/lessons.js) at call time; a
 * chapter names its set (`set`) and stands alone (its first step opens the set fresh and
 * seeds what earlier chapters produced). Point lists are FLAT (teaching-labels.test.js).
 * The runner is the lessonKit's `registerCourse` (R15): progress in localStorage
 * `clickcount-course-done`, { 'electrical:<id>': ISO }, the one map every course shares
 * (App.courseDone), and the doors: the Learn menu's section (#learnCourseList-electrical),
 * the empty-canvas "power" link, Project Settings → Help → "electrical course",
 * /app/?course=electrical, /app/?chapter=electrical:<id>.
 *
 * Registrations: startChapterElectrical(id), courseElectricalIds(), courseElectricalReference().
 * Boundary rule: read shared deps from App.* at call time, never captured at load; the one
 * exception is the registerCourse call at the foot (lessons.js loads first).
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const COURSE = 'electrical';
  const ESET = { url: '/samples/sample-electrical.pdf', name: 'sample-electrical', pages: 4, trade: 'electrical', word: 'four' };
  const E101 = 0, E201 = 1, E501 = 2, E601 = 3;
  const K = () => App.lessonKit;
  const T = () => App.tourKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ----- the sheets, in PDF points ------------------------------------------------------------
  // E-101 and E-201 sit on P-101's shell: a plan point is (60 + 0.75·x, 70 + 0.75·y), K().P.
  // These lists mirror POWER / LIGHTING in scripts/sample-electrical.js, FLAT (x, y, x, y…).
  const P = (x, y) => K().P(x, y);
  const G = {
    dim318: [560, 84, 940, 84],
    duplex: [136, 160, 136, 250, 136, 340, 136, 430, 200, 106, 300, 106, 400, 106, 500, 596, 760, 476, 930, 590, 600, 460],  // 11 drawn as duplex, at 18"; the last is the engineer's miss
    missed: [600, 460],                                                                                                    // a plain duplex in the kitchen: 210.8(B)(2) wants it GFCI; the reader finds it, and it is counted ONCE, as a GFCI (T2, 2026-09-27)
    gfci: [200, 594, 300, 594, 640, 106, 776, 106, 900, 106, 575, 302, 930, 360, 720, 358, 800, 358, 660, 476],          // 10, at 44": the bar, the restrooms, the kitchen, the dish pit
    diningW: [136, 160, 136, 250, 136, 340, 136, 430],                                                                    // circuit 1, chained
    jbox: [400, 585, 643, 592, 887, 552, 860, 380, 730, 590, 812, 548],                                                   // ice, DW, RP, EF-1, RTU-1, WH
    rtu: [730, 590], dw: [643, 592], hood: [760, 372],
    panel: [704, 506], meter: [690, 612], mdp: [713, 611], clearance: [710, 506, 746, 506],
    homerun1: [136, 160, 136, 110, 700, 110, 704, 506],                                                                   // the west wall's run above the ceiling to LP-1
    feeder: [705, 604, 705, 516],
    A: [200, 160, 345, 160, 490, 160, 200, 285, 345, 285, 490, 285, 200, 410, 345, 410, 490, 410, 265, 505, 330, 505, 390, 505, 490, 535],
    B: [640, 380, 760, 380, 880, 380, 640, 440, 760, 440, 880, 440, 600, 508, 660, 508, 760, 530, 860, 530],
    C: [665, 272, 775, 272, 885, 272, 596, 200, 660, 150, 732, 200, 796, 150, 885, 200],
    X: [495, 112, 926, 440], EM: [300, 470, 760, 364, 700, 278],
    S: [522, 108, 426, 486, 575, 424, 690, 478], OS: [668, 258, 802, 258, 806, 478],
  };
  const SCHEDULE_BOX = { x1: 110, y1: 130, x2: 870, y2: 262 };      // E-501: the lighting fixture schedule
  const DW_ROW = { x1: 112, y1: 540, x2: 860, y2: 558 };            // E-501: the dishwasher's row of the panel schedule
  const pts = (flat) => K().pts(flat), planFeet = (flat) => K().planFeet(flat);   // the kit's flat-list readers
  const CEILING_FT = 10, MAKE_UP_FT = 1;
  const MOUNT = { duplex: 18, gfci: 44, panel: 78, meter: 60, disconnect: 60 };
  // The feeder's vertical (T4, settled 2026-09-27): up from the main disconnect at 5 ft into the 10 ft
  // ceiling, across, and down into LP-1's top at 78 in: 5 + 3.5 = 8.5 ft. E-601 calls the feeder 16 ft.
  const FEEDER_RISE_FT = (CEILING_FT - MOUNT.disconnect / 12) + (CEILING_FT - MOUNT.panel / 12);
  // The branch circuits' wire (R1, settled 2026-09-27): one 120 V circuit is two #12 and a ground, as
  // E-101's keynote now says (it said 3 #12, a third wire no single circuit carries).
  const BRANCH_SPEC = '2 #12 THHN + 1 #12 G';

  // ----- readers ---------------------------------------------------------------------------------
  const counter = (re) => K().counterNamed(re);
  const byTag = (tag) => (S().counters || []).find((c) => String(c.tag || '').toUpperCase() === tag) || (S().counters || []).find((c) => new RegExp('^(type )?' + tag + '( ·|$)', 'i').test(c.name || ''));
  // The homerun is the type with Homerun on, whatever the reader named it (the Quick tab cannot add
  // "HR", so a reader who used it had a homerun the course never found, 2026-09-24); by name otherwise.
  const lineType = (re) => (re === RE.hr ? ((S().lineTypes || []).filter((l) => l.homerun).pop() || K().lineTypeNamed(re)) : K().lineTypeNamed(re));
  const pageAnn = (i) => K().pageAnn(i);
  const marksOf = (c, pageIdx) => { const a = pageAnn(pageIdx); return c && a ? (a.counterMarkers[c.id] || []) : []; };
  const markNear = (c, spot, d, pageIdx) => marksOf(c, pageIdx).some((m) => K().near(m, spot, d));
  // every type the word names, and for the homerun every type flagged homerun (see the kit's lineTypesMatching)
  const typeIds = (re) => new Set(K().lineTypesMatching(re).concat(re === RE.hr ? (S().lineTypes || []).filter((l) => l.homerun) : []).map((l) => l.id));
  const polylinesOn = (re, pageIdx) => { const a = pageAnn(pageIdx); const ids = typeIds(re); return a ? (a.polylines || []).filter((pl) => ids.has(pl.lineTypeId)) : []; };
  const notesNear = (spot, d, pageIdx) => { const a = pageAnn(pageIdx); return a ? (a.notes || []).filter((n) => K().near(n, spot, d)) : []; };
  const bidRow = (id) => { const bc = App.getBidCheck ? App.getBidCheck() : null; return bc ? (bc.auto || []).find((r) => r.id === id) : null; };
  const manual = (id) => !!(S().bidCheck && S().bidCheck.manual && S().bidCheck.manual[id]);
  const RE = {
    duplex: /duplex/i, gfci: /gfci/i, jbox: /j-?box|junction/i, panel: /panelboard|\blp-/i,   // not /panel/: the Quick tab names the meter "Meter Panel"
    meter: /\bmeter\b/i, disc: /disconnect/i, os: /occupancy|\bos\b/i,
    emt75: /0?\.75\s*in.*emt(?!.*hr)|3\/4.*emt(?!.*hr)/i, hr: /\bhr\b|homerun/i, emt2: /\b2\s*in.*emt/i, emtAny: /emt/i,
  };

  // ----- on-sheet targets (the engine's) ------------------------------------------------------------
  const ZR = 14;
  const circlesOn = (pageIdx, c, spots, r) => T().markZones(pageIdx, (c || {}).id || '__none__', spots, r || ZR);
  const runsOn = (re, pageIdx) => { const pls = polylinesOn(re, pageIdx).map((pl) => pl.points || []); const d = S().drawingPolyline; return d && d.points && typeIds(re).has(d.lineTypeId) ? pls.concat([d.points]) : pls; };
  const traceZones = (re, spots, pageIdx) => T().pathZones(spots, 15, runsOn(re, pageIdx));
  const allDone = (zs) => T().allDone(zs);
  const missing = (c, spots, labels, d, pageIdx) => { const ms = marksOf(c, pageIdx); const out = []; spots.forEach((pt, i) => { if (!ms.some((m) => K().near(m, pt, d || 8))) out.push(labels[i]); }); return out.length ? out.length + ' more: ' + out.join(', ') : ''; };
  // PP-OS-STRAY: an OS mark outside the three door circles (a plain S switch clicked as a sensor)
  // still counts in the tally, so the sensor step holds until it is undone, and the hint says where.
  const OS_DOORS = ['the MEN door', 'the WOMEN door', 'the STORAGE door'];
  const PLAIN_S = ['the front exit', 'the server station', 'the kitchen (west)', 'the DISH door'];   // G.S, in order
  const osZones = (c) => circlesOn(E201, c, pts(G.OS), 12);
  const osStray = (c) => { const zs = osZones(c); return c ? marksOf(c, E201).find((m) => !zs.some((z) => T().inCircle(m, z))) : null; };
  function osStrayHint(c) {
    const m = osStray(c);
    if (!m) return '';
    const i = pts(G.S).findIndex((pt) => K().near(m, pt, 16));
    const where = i >= 0 ? 'The OS mark at ' + PLAIN_S[i] + ' is a plain S switch' : 'An OS mark away from the three doors';
    return { code: 'outside-zone', text: where + ', and it still counts in the tally. Press Ctrl+Z to undo it, or right-click it and click Delete' };
  }
  const DUPLEX_LABELS = ['the dining west wall (top)', 'the dining west wall', 'the dining west wall', 'the dining west wall (bottom)', 'the dining north wall (west)', 'the dining north wall (middle)', 'the dining north wall (east)', 'the server station', 'storage (north wall)', 'storage (south wall)'];
  // T2 (settled 2026-09-27): the engineer's missed kitchen receptacle is counted once, as a GFCI, since
  // the inspector fails a plain duplex in a kitchen. So the plain duplex are ten and the GFCIs eleven.
  const plainDuplex = () => pts(G.duplex).filter((pt) => !K().near(pt, pts(G.missed)[0], 2));
  const gfciAll = () => pts(G.gfci).concat(pts(G.missed));
  const GFCI_LABELS = ['the bar (west)', 'the bar (east)', 'MEN', 'WOMEN', 'the mop room', 'the kitchen hand sink', 'the kitchen exit hand sink', 'the cook line (west)', 'the cook line (east)', 'the dish pit'];
  const JBOX_LABELS = ['the ice machine', 'the dishwasher', 'the recirc pump', 'EF-1 by the exit door', 'RTU-1 in storage', 'the water heater'];

  // ----- the counters, the way the Quick tab makes them ------------------------------------------------
  const icon = (variant) => (App.tradeIconForType && App.tradeIconForType('electrical', variant)) || T().customIcon(variant) || T().firstIcon();
  const TAGS = {
    duplex: [RE.duplex, 'Duplex Receptacle 20A', 'Duplex', '#e85447', { mountHeightIn: MOUNT.duplex }],
    gfci: [RE.gfci, 'GFCI Receptacle 20A', 'GFCI', '#e8c547', { mountHeightIn: MOUNT.gfci }],
    jbox: [RE.jbox, 'J-Box', 'J-Box', '#2e86de', {}],
    panel: [RE.panel, 'Panelboard LP-1', 'Panelboard', '#8a4bb0', { mountHeightIn: MOUNT.panel, panelName: 'LP-1', poles: 42 }],
    meter: [RE.meter, 'Meter', 'Meter', '#c8963a', { mountHeightIn: MOUNT.meter }],
    disc: [RE.disc, 'Disconnect 200A', 'Disconnect', '#47c88e', { mountHeightIn: MOUNT.disconnect }],
    os: [RE.os, 'Switch Occupancy', 'Occupancy', '#47c88e', { mountHeightIn: 48 }],
  };
  // Each Prove it step's proof (features/tutorial.js measureProof): the dimension drawn between its
  // circles, a circle that ticks as its click lands, a hint that names the miss, and the reading held
  // on the card. Built once, on first use, through the kit's memo.
  const proveE101 = () => K().memoProof('electrical:E101', () => ({ page: E101, ends: pts(G.dim318), r: 13, ft: 31.67, tol: 0.4, stated: '31\'-8"' }));
  function pick(tag) {
    const t = TAGS[tag];
    const have = counter(t[0]);
    if (have && !K().isStanding(have.id)) return have;   // never adopts the reader's standing counter
    const c = Object.assign({ id: App.uid(), name: t[1], icon: icon(t[2]), color: t[3], lesson: true }, t[4]);
    S().counters.push(c);
    return c;
  }
  const LIGHT_TYPES = { A: ['Pendant', '#e8c547'], B: ['2x4 Troffer', '#4a9eff'], C: ['Downlight', '#47c88e'], X: ['Exit', '#e85447'], EM: ['Emergency', '#c8963a'] };
  function pickLight(tag) {
    const have = byTag(tag);
    if (have) return have;
    const c = { id: App.uid(), name: 'Type ' + tag, icon: icon(LIGHT_TYPES[tag][0]), color: LIGHT_TYPES[tag][1], tag, lesson: true };
    S().counters.push(c);
    return c;
  }
  const markMissing = (c, spots, pageIdx) => K().markMissing(c, spots, pageIdx);
  const scaleE101 = () => K().setScale(E101, 9, '1/8" = 1\'');
  // Chapter 7's RFI on the hood's shunt trip, and chapter 9 lays it again so Copy RFI Flags has it.
  function flagShuntTrip() { K().goPage(E101); const page = S().pages[E101]; const a = App.ensureActiveCanvas(page).annotations; if (!a.notes) a.notes = []; const spot = pts(G.hood)[0]; if (a.notes.some((n) => /^\s*RFI/i.test(n.text) && K().near(n, spot, 60))) return; App.pushUndoSnapshotCurrentPage(); a.notes.push({ x: spot.x, y: spot.y, text: 'RFI: Who furnishes the shunt-trip breaker on circuit 12 and wires it to the hood suppression?', id: App.uid(), width: 150, fontSize: 14, placementRotation: page.rotation ?? 0, color: '#e85447' }); S().tool = App.TOOL.NONE; K().dirty(); }
  const setCeiling = () => { const s = S(); if (!(s.ceilingHeightFt > 0)) { s.ceilingHeightFt = CEILING_FT; s.makeUpFt = MAKE_UP_FT; } };
  // The schedule reader over E-501's fixture schedule: five counters named by their letter.
  async function readFixtureSchedule() {
    K().goPage(E501);
    if (!App.proposeCountersFromBox) return;
    const before = new Set((S().counters || []).map((c) => c.id));
    App.proposeCountersFromBox(SCHEDULE_BOX);
    for (let i = 0; i < 40 && !K().modalUp('schedulePaletteModal'); i++) await wait(100);
    if (K().modalUp('schedulePaletteModal') && el('schedulePaletteCreate')) { el('schedulePaletteCreate').click(); await wait(100); }
    (S().counters || []).forEach((c) => { if (!before.has(c.id)) c.lesson = true; });
    if (!byTag('A')) { App.pushUndoSnapshot(); Object.keys(LIGHT_TYPES).forEach(pickLight); }
    K().dirty();
  }
  function makeEmt() {
    const k = K();
    let lt = lineType(RE.emt75);
    if (!lt) {
      const conductors = window.ConductorModel ? window.ConductorModel.parseConductorSpec(BRANCH_SPEC).conductors : [];
      lt = k.makeLineType('0.75in EMT', '#8a4bb0', { raceway: { kind: 'EMT', size: '3/4"' }, conductors });
    }
    return lt;
  }
  function makeHomerun() {
    const k = K();
    let lt = lineType(RE.hr);
    if (!lt) {
      const conductors = window.ConductorModel ? window.ConductorModel.parseConductorSpec(BRANCH_SPEC).conductors : [];
      lt = k.makeLineType('0.75in EMT HR', '#e85447', { raceway: { kind: 'EMT', size: '3/4"' }, conductors, homerun: true });
    }
    return lt;
  }
  function makeFeeder() {
    const k = K();
    let lt = lineType(RE.emt2);
    if (!lt) {
      const conductors = window.ConductorModel ? window.ConductorModel.parseConductorSpec('4 #3/0 THHN + 1 #6 G').conductors : [];
      lt = k.makeLineType('2in EMT', '#2e86de', { raceway: { kind: 'EMT', size: '2"' }, conductors });
    }
    return lt;
  }
  function chainWestWall() {
    setCeiling();
    const a = pageAnn(E101);
    if (a && (a.quickLines || []).length >= 3) return;
    K().goPage(E101);
    T().chainPoints(pick('duplex').id, makeEmt().id, pts(G.diningW));
  }
  function tracePlan(lt, flat, name, pageIdx) { K().goPage(pageIdx); S().drawingPolyline = { id: App.uid(), name, color: lt.color, points: pts(flat), closed: false, lineTypeId: lt.id, group: null }; App.settlePolylineDraft(); }
  function circuitOne() {
    const s = S();
    let g = (s.groups || []).find((x) => x.panel === 'LP-1' && String(x.circuit) === '1');
    if (!g) {
      App.pushUndoSnapshot();
      if (!s.groupsEnabled) { if (App.turnOnGroups) App.turnOnGroups(); else s.groupsEnabled = true; }
      g = { id: App.uid(), name: 'Dining receptacles, west wall', color: '#c8963a', panel: 'LP-1', circuit: '1' };
      s.groups = s.groups || []; s.groups.push(g);
    }
    const a = pageAnn(E101);
    if (a) {
      const d = pick('duplex');
      (a.counterMarkers[d.id] || []).forEach((m) => { if (pts(G.diningW).some((pt) => K().near(m, pt, 8))) m.group = g.id; });
      (a.quickLines || []).forEach((l) => { if (!l.group) l.group = g.id; });
      (a.polylines || []).forEach((pl) => { const hr = lineType(RE.hr); if (hr && pl.lineTypeId === hr.id) pl.group = g.id; });
    }
    K().dirty();
    return g;
  }
  // the feeder's vertical as drawn: the drop on either end of the reader's 2in EMT
  const feederDrop = () => { const l = polylinesOn(RE.emt2, E101).find((x) => (x.startDrop || 0) > 0 || (x.endDrop || 0) > 0); return l ? (l.startDrop || 0) + (l.endDrop || 0) : 0; };
  const feederRiseOk = () => Math.abs(feederDrop() - FEEDER_RISE_FT) < 0.3;
  const circuit1 = () => (S().groups || []).find((x) => x.panel === 'LP-1' && String(x.circuit) === '1');

  // ----- the reference takeoff -------------------------------------------------------------------------
  const COUNTS = () => [
    ['duplex', plainDuplex(), E101, 'Duplex'], ['gfci', gfciAll(), E101, 'GFCI'], ['jbox', pts(G.jbox), E101, 'J-Box'], ['panel', pts(G.panel), E101, 'Panelboard'],
    ['meter', pts(G.meter), E101, 'Meter'], ['disc', pts(G.mdp), E101, 'Disconnect'], ['os', pts(G.OS), E201, 'Occupancy'],
    ['A', pts(G.A), E201, 'Type A'], ['B', pts(G.B), E201, 'Type B'], ['C', pts(G.C), E201, 'Type C'], ['X', pts(G.X), E201, 'Type X'], ['EM', pts(G.EM), E201, 'Type EM'],
  ];
  const counterFor = (tag) => (TAGS[tag] ? counter(TAGS[tag][0]) : byTag(tag));
  const RUNS = [
    { name: '0.75in EMT', re: RE.emt75, exclude: RE.hr, feet: () => planFeet(G.diningW) + 4 * (CEILING_FT - MOUNT.duplex / 12 + MAKE_UP_FT), label: 'the west wall chain with its four verticals' },
    { name: '0.75in EMT HR', re: RE.hr, exclude: null, feet: () => planFeet(G.homerun1), label: 'the homerun from the west wall to LP-1' },
    { name: '2in EMT', re: RE.emt2, exclude: null, feet: () => planFeet(G.feeder) + FEEDER_RISE_FT, label: 'the feeder from the main to LP-1, with its 8.5 ft of vertical' },
  ];
  // The reader's feet are the kit's feetFor, read off the summary Copy to /Tooling copies.
  const fmtFt = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const countOk = ([tag, spots, pageIdx]) => { const c = counterFor(tag); return !!c && spots.every((pt) => markNear(c, pt, 8, pageIdx)); };
  function layEverything() {
    scaleE101();
    K().setScale(E201, 9, '1/8" = 1\'');
    App.pushUndoSnapshotCurrentPage();
    chainWestWall();
    markMissing(pick('duplex'), plainDuplex(), E101); markMissing(pick('gfci'), gfciAll(), E101); markMissing(pick('jbox'), pts(G.jbox), E101);
    markMissing(pick('panel'), pts(G.panel), E101); markMissing(pick('meter'), pts(G.meter), E101); markMissing(pick('disc'), pts(G.mdp), E101);
    Object.keys(LIGHT_TYPES).forEach((t) => markMissing(pickLight(t), pts(G[t]), E201));
    markMissing(pick('os'), pts(G.OS), E201);
    if (!polylinesOn(RE.hr, E101).length) tracePlan(makeHomerun(), G.homerun1, 'Homerun, circuit 1', E101);
    if (!polylinesOn(RE.emt2, E101).length) { tracePlan(makeFeeder(), G.feeder, 'Feeder', E101); K().dropAt(pts(G.feeder)[0], FEEDER_RISE_FT, E101); }
    const g = circuitOne(); g.loadAmps = 6;
    K().goPage(E101);
    K().dirty();
  }
  const takeoffComplete = () => RUNS.every((r) => K().feetFor(r.re, r.exclude) >= r.feet() * 0.95) && COUNTS().every(countOk);
  function takeoffHint() {
    const run = RUNS.find((r) => K().feetFor(r.re, r.exclude) < r.feet() * 0.95);
    if (run) return 'Not yet traced: ' + run.label;
    const c = COUNTS().find((x) => !countOk(x));
    return c ? 'Not all counted: ' + c[3] + (c[2] === E201 ? ' (E-201)' : '') : '';
  }
  // The lay step skipped with nothing done: the sheets carry no mark (PP-WHOLE-SKIP).
  const takeoffSkipped = () => !App.projectHasAnyCanvasMarkup();
  function compareBody() {
    const lines = ['The reference is the course\'s own finished takeoff, worked from the sheets\' geometry. Reference on the left. Yours on the right, from your Summary.'];
    RUNS.forEach((r) => { const ref = r.feet(), mine = K().feetFor(r.re, r.exclude); const ok = mine >= ref * 0.95 && mine <= ref * 1.05; lines.push(r.name + ': ' + fmtFt(ref) + ' ft, yours ' + fmtFt(mine) + ' ft' + (ok ? ' ✓' : mine < ref * 0.95 ? ', short: ' + r.label : ', over: check for a doubled run')); });
    const bad = COUNTS().filter((x) => !countOk(x)).map((x) => x[3]);
    lines.push(bad.length ? 'Counts short: ' + bad.join(', ') + '.' : 'Every count matches: twelve device types, sixty-nine marks across the two plans.');
    lines.push('The wire under the conduit rows is derived from the runs, never marked, so it cannot drift. The report\'s circuit schedule lists circuit 1 with its four devices, its feet and its farthest device.');
    return lines.join('\n');
  }

  // ===== the chapters ==============================================================================
  const CHAPTERS = [
    // 0 ----------------------------------------------------------------------------------------
    // Before you count (COURSE-LANGUAGE option C, 2026-09-27): the opener for a reader who has never
    // seen a construction drawing. Read cards only, no zones, no rules; it stands ahead of the nine
    // chapters and is not counted among them.
    {
      id: 'before', title: 'Chapter 0: Before you count', short: 'the words, first', minutes: 4, page: E101, noun: 'chapter', set: ESET, readOnly: true,
      intro: 'Read this first if you have never seen a construction drawing. A few short cards, ahead of the nine chapters: what the sheets are, what an estimator does with them, and where the app keeps its tools.',
      opener: 'These cards are for reading. You click nothing on the sheets yet.\nThe sheets are sample drawings of a small restaurant. Nothing here touches your projects.',
      seed() { /* nothing: the cards only read */ },
      steps: [
        { id: 'set', title: 'A set of drawings', kind: 'read',
          body: 'A building is drawn before it is built. The drawings for one job are a set, and each page of the set is a sheet.\nEach trade gets its own sheets. An E-sheet is an electrical sheet: its number starts with E, and an electrical engineer drew it. Together they are the E-set.\nThis E-set has four, listed under PAGES in the left sidebar:\n{{E-101|#pagesList [data-page-idx="0"]}}, the power plan: the floor plan with everything that plugs in or is wired in.\n{{E-201|#pagesList [data-page-idx="1"]}}, the lighting plan: the same floor with every light and the switch for it.\n{{E-501|#pagesList [data-page-idx="2"]}}, the schedules: tables of what the plans show, one row per kind of thing.\n{{E-601|#pagesList [data-page-idx="3"]}}, the one-line: a diagram of how the power gets from the street into the building.',
          target: ['#pagesList'], check: () => true },
        { id: 'estimator', title: 'What an estimator does', kind: 'read',
          body: 'An estimator works out what a job will cost, so the contractor can bid on it. The bid is the price they offer to do the work.\nThe work has three parts. Count what is drawn: every outlet, light and box. Measure what runs between them: the feet of pipe and wire. Then price it.\nThe count and the feet together are the takeoff: the numbers the price is built on. The app makes the takeoff, and this course teaches you to read the sheets it comes from.',
          target: [], check: () => true },
        { id: 'verbs', title: 'Count, trace, chain, check', kind: 'read',
          body: 'Four words for what you do on a sheet.\nCount: pick a counter, a named kind of mark, and click each thing it counts. One click, one mark. Your counters sit under COUNTERS.\nTrace: click along a run, the path a pipe or a wire takes, and the app adds up its feet. A line type is a named kind of run, like one size of pipe, kept under LINE TYPES.\nChain: [[Chain]] counts a device and traces the run to it in the same click.\nCheck: BID CHECK, a list in the left sidebar, says what the takeoff is missing and what does not add up.',
          target: ['#countersSectionTitle', '#lineTypesSectionTitle', '#bidCheckSectionTitle'], lightAll: true, check: () => true },
        // The screen, one card per area, as Start here walks it (the card review, fix 3): the old
        // "Where things are" was three areas on one card, and "How the cards teach" described the
        // cards where Start here has the reader use one.
        { id: 'header', title: 'The header, the bar across the top', kind: 'read',
          body: 'It holds the tools: [[Set Scale]], [[Measure]], [[Chain]] and the rest. A few sit behind [[⋯]].\n[[Set Scale]] sets the scale: how many feet an inch of paper stands for.',
          target: ['.header'], check: () => true },
        { id: 'sidebar', title: 'The sidebar, the lists down the left', kind: 'read',
          body: 'PAGES lists the sheets. COUNTERS and LINE TYPES hold what you count and what you trace.\nSUMMARY keeps the running totals, and BID CHECK sits below it.',
          target: ['.sidebar'], check: () => true },
        { id: 'bottom', title: 'Under the sheet: the footer and the status bar', kind: 'read',
          body: 'The {{footer|.page-zoom-row}} comes first. It {{turns the pages|.page-nav}} and {{zooms in and out|.zoom-bar}}.\nThe {{status bar|.status-bar}} is the strip below it, along the very bottom. It says {{where your work is saved|#statusMode}}, and holds [[quick keys]].\nA quick key is a number key a counter can sit on.',
          target: ['.page-zoom-row', '.status-bar'], lightAll: true, check: () => true },
      ],
      done: 'The sheets, the takeoff, the four verbs, and where the tools are.\nNext: [[Learn]] → Chapter 1, the E-sheets.',
    },
    // 1 ----------------------------------------------------------------------------------------
    {
      id: 'sheet', title: 'Chapter 1: Read the E-sheets', short: 'the set, read', minutes: 8, page: E101, noun: 'chapter', set: ESET,
      intro: 'Power on one sheet, lighting on another, the panel schedule as the answer key. Where the panel sits, the space it needs, and a scale you proved.',
      opener: 'The four sheets open with nothing on them: no scale and no counts. Nothing you do on them touches your projects.',
      seed() { /* the scale is the chapter's */ },
      steps: [
        { id: 'what', title: 'What is on an E-set?', kind: 'read', cardAt: 'br',
          body: 'This sheet is {{E-101|#pagesList [data-page-idx="0"]}}, the power plan. Under PAGES there are three more, and {{E-201|#pagesList [data-page-idx="1"]}} is the same floor again.\nWhy does the electrical engineer draw the same building twice, once for power and once for lighting, when the plumber drew it once?',
          reveal: 'Density: too much for one sheet. A restaurant\'s receptacles (wall outlets), equipment, light fixtures, switches and wire runs on one plan would be unreadable.\nSo the power plan ({{E-101|#pagesList [data-page-idx="0"]}}) carries everything that plugs in or is hard-wired, wired straight in with no plug. The lighting plan ({{E-201|#pagesList [data-page-idx="1"]}}) carries every light fixture and the switch that controls it.\n{{E-501|#pagesList [data-page-idx="2"]}} is the schedules: the fixture types by letter, and panel LP-1 circuit by circuit. A panel is the metal cabinet of breakers that feeds the building, and LP-1 is its name.\nA breaker is a switch in the panel that shuts a circuit off when it draws too much. A circuit is one breaker and the wires and devices it feeds: receptacles, lights, switches.\n{{E-601|#pagesList [data-page-idx="3"]}} is the one-line: the service, the power\'s path from the street to the panel, drawn as a single line.\nAn electrical estimator reads the panel schedule first. It is the engineer\'s own count of circuits, loads (the power each one draws), breakers and wire sizes. Everything on the two plans has to add up to it.',
          target: ['#pagesList'], check: () => true },
        { id: 'scale', title: 'Set the scale', kind: 'do',
          body: 'The title block is the box in the corner of the sheet, with its name and number. It says 1/8" = 1\'-0": an eighth of an inch on the paper is one foot in the building.\nThe app needs the scale to turn your clicks into feet.\n1. In the header, click [[Set Scale]] (or press S).\n2. Click [[1/8" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => K().scaleIs(E101, 9),
          action: { label: 'Use 1/8" = 1\'-0"', run: async () => { K().goPage(E101); await T().applyScalePreset('1/8" = 1\'', 9); } } },
        { id: 'prove', title: 'Prove it', kind: 'do', cardAt: 'bl', page: E101, hold: true,
          body: () => (proveE101().check()
            ? proveE101().verdict() + ': the scale is right.\nA PDF printed smaller keeps its scale label and measures short. Only a dimension catches that.'
            : 'A dimension is a length the engineer wrote on the drawing. Only a dimension proves the scale.\n1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at the left end of the 31\'-8" dimension over the kitchen half.\n3. Click inside circle 2, at its right end.'),
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => proveE101().check(), hint: () => proveE101().hint(), zones: () => proveE101().zones(),
          action: { label: 'Measure the 31\'-8" string', run: async () => { K().goPage(E101); if (!K().scaleIs(E101, 9)) await T().applyScalePreset('1/8" = 1\'', 9); const d = pts(G.dim318); K().measure(d[0], d[1]); } } },
        { id: 'panel', title: 'Where is the panel?', kind: 'do', cardAt: 'tl',
          rules: ['elec.mount-height.defaults'],
          answer: 'Answer: LP-1, on the west wall of STORAGE. Its counter already carries a mount height, how high it hangs: 78 in to the top, the rule the app applies.',
          body: 'A homerun is the conduit, the metal pipe wire runs in, that carries a circuit\'s wires back to the panel. The plan shows each one as a short arrow with a tag, a label, and every tag names the same panel.\n1. In the left sidebar, under COUNTERS, click [[+ Add]], then the [[Quick]] tab.\n2. Set Category to Panel and Variant to Panelboard, the panel\'s full name.\n3. Click [[Add Counter]].\n4. Find the panel on the plan and click it.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#counterModal .counter-tab[data-tab="quickcount"]', '#addCounter'],
          check: () => markNear(counter(RE.panel), pts(G.panel)[0], 14, E101),
          hint: () => (counter(RE.panel) && marksOf(counter(RE.panel), E101).length ? 'Not there. Every arrow\'s tag starts LP-1, and LP-1 is on the west wall of STORAGE' : (K().armedNamed(RE.panel) ? 'The counter is ready: click LP-1' : '')),
          action: { label: 'Find it for me', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('panel'), pts(G.panel), E101); K().dirty(); } } },
        { id: 'clearance', title: 'The space in front of the panel', kind: 'do', cardAt: 'tl', page: E101, zones: () => K().guide(pts(G.clearance), 12, K().measured(E101, 3, 0.3)),
          rules: ['elec.panel.working-space'],
          answer: 'Answer: three feet. That is working space: an electrician has to stand in front of a live panel, one with the power on, and work on it.\nSo the code keeps 36 in clear in front, 30 in wide, to 6 ft 6 in high (NEC 110.26). The NEC is the National Electrical Code, the code book electrical work is built to.\nThis course reads its 2023 edition. Your city may use an older one, with some numbers moved.\nA panel behind the ice machine breaks that rule. The estimator flags it before the bid, because moving it later is a change order: a priced change after the contract is signed.',
          body: 'The engineer drew a dashed box there. How deep is it?\n1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at the panel\'s face.\n3. Click inside circle 2, at the box\'s outer edge.',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => K().measured(E101, 3, 0.3),
          hint: () => { const lm = S().lastMeasure; return lm && lm.pageIdx === E101 && T().measuredFeet() != null && Math.abs(T().measuredFeet() - 31.67) > 0.4 ? 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + '. The panel\'s face to the box\'s outer edge' : ''; },
          action: { label: 'Measure it for me', run: () => { K().goPage(E101); const d = pts(G.clearance); K().measure(d[0], d[1]); } } },
        { id: 'schedule', title: 'The panel schedule', kind: 'do', cardAt: 'br',
          answer: 'Answer: circuits 2 and 4, the dishwasher: 4800 VA at 208 V, two poles, a 30 A breaker, #10 wire.\nVA is volt-amperes, the load a circuit is sized for. V is volts and A is amps, the current. #10 and #12 are wire sizes: the smaller the number, the thicker the wire.',
          body: 'Now the answer key, the panel schedule: one row per circuit. A pole is one breaker position, and a two-pole breaker takes two.\n1. Under PAGES, click {{E-501|#pagesList [data-page-idx="2"]}}.\n2. Find the one two-pole circuit on LP-1 with a 30 A breaker.\n3. In the header, click [[⋯]], then [[Highlight]] (or press H).\n4. Drag a box over that row.',
          target: () => (K().onPage(E501) ? ['#highlightBtn', '#highlightBtnSidebar', '#headerMoreBtn'] : ['#pagesList']),
          check: () => { const a = pageAnn(E501); return !!a && (a.highlights || []).some((h) => Math.min(h.x1, h.x2) <= 400 && Math.max(h.x1, h.x2) >= 400 && Math.min(h.y1, h.y2) <= 549 && Math.max(h.y1, h.y2) >= 549); },
          hint: () => { if (!K().onPage(E501)) return T().pagesFoldedHint('E-501'); const a = pageAnn(E501); return a && (a.highlights || []).length ? 'Not that row. Read down the P column for a 2, and the BKR column for 30' : ''; },
          action: { label: 'Highlight the dishwasher for me', run: () => { K().goPage(E501); const a = App.ensureActiveCanvas(S().pages[E501]).annotations; if (!a.highlights) a.highlights = []; if (a.highlights.length) return; App.pushUndoSnapshotCurrentPage(); a.highlights.push(Object.assign({ color: '#e8c547', opacity: 0.25, id: App.uid() }, DW_ROW)); S().tool = App.TOOL.NONE; K().dirty(); } } },
        { id: 'row', title: 'Read a row', kind: 'read', cardAt: 'br',
          rules: ['elec.conductor.small-protection', 'elec.conductor.ampacity', 'elec.gfci.non-dwelling'],
          body: 'Every column is a decision the estimator prices.\nWhy #10 for the dishwasher when every 20 A circuit is #12?',
          reveal: '4800 VA at 208 V is 23 A. A conductor is a wire, and a #12 copper conductor may be protected at no more than 20 A (NEC 240.4(D)).\nSo the breaker must be bigger than 20 A. The engineer chose 30 A, the size the maker\'s label names. A 30 A breaker wants #10 (240.4(D) again, 310.16 for the ampacity). Ampacity is the current a wire can carry without overheating.\nSince the 2020 code, a dishwasher\'s breaker also cuts the power when current leaks through a person (NEC 422.5(A)(7)). That breaker costs several times a plain one.\nTwo poles because 208 V is taken across two phases of the 208Y/120 V panel; no neutral.\n208Y/120 V means the power arrives on three live wires, the phases, and a neutral, the wire the current returns on. From one phase to another is 208 V; from any phase to the neutral is 120 V.\nThe schedule is the engineer\'s arithmetic. The estimator\'s job is to price what it says: the breaker, the wire, the conduit. And to notice when the plan disagrees with it.',
          target: ['#annCanvas'], check: () => true },
      ],
      done: 'The two plans, the schedules, the one-line, the panel and the space it needs, and a scale you proved.\nNext: [[Learn]] → Chapter 2, the devices.',
    },
    // 2 ----------------------------------------------------------------------------------------
    {
      id: 'devices', title: 'Chapter 2: Receptacles, and which must be GFCI', short: 'every device counted', minutes: 10, page: E101, noun: 'chapter', set: ESET,
      intro: 'Which receptacles (wall outlets) the code wants ground-fault protected and why, the heights the app already knows, and every device on E-101 counted.',
      opener: 'E-101 opens with its scale set, the way Chapter 1 left it. Nothing you do on it touches your projects.',
      seed() { scaleE101(); },
      steps: [
        { id: 'gfci', title: 'Which receptacles must be GFCI?', kind: 'do', cardAt: 'tl',
          answer: 'Answer: the ten with GFI beside them, the drawing\'s short word for GFCI. Every receptacle in a kitchen is covered (NEC 210.8(B)(2)), the dish pit too, where the dishes are washed.\nThe bar\'s two sit within 6 ft of its hand sink (210.8(B)(7)). The restrooms are covered too (210.8(B)(1)). So is the mop room\'s, within 6 ft of the mop sink.',
          rules: ['elec.mount-height.defaults'],
          body: 'The plan shows twenty-one receptacles, wall outlets. A plain one is a duplex: the ordinary receptacle, two sockets in one.\nThe code wants some to be GFCIs: ground-fault circuit interrupters, which cut the power when current leaks through a person.\n1. Under COUNTERS, click [[+ Add]], then the [[Quick]] tab.\n2. Set Category to Receptacle, Variant to GFCI and Rating to 20A.\n3. Click [[Add Counter]].\n4. Click every receptacle that must be a GFCI, and none that need not.\nThe new counter arrives at 44 in, the counter height: a kitchen counter, not the app\'s kind.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#counterModal .counter-tab[data-tab="quickcount"]', '#addCounter'],
          check: () => { const c = counter(RE.gfci); return !!c && pts(G.gfci).every((pt) => markNear(c, pt, 10, E101)) && !plainDuplex().some((pt) => markNear(c, pt, 10, E101)); },
          hint: () => { const c = counter(RE.gfci); if (!c) return ''; const wrong = plainDuplex().find((pt) => markNear(c, pt, 10, E101)); if (wrong) return 'That one is in the dining room or storage, with no sink within 6 ft: a plain duplex. Undo it with the Undo button under the sheet'; return missing(c, pts(G.gfci), GFCI_LABELS, 10, E101); },
          action: { label: 'Click the ten for me', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('gfci'), pts(G.gfci), E101); K().dirty(); } } },
        { id: 'missed', title: 'The one the engineer missed', kind: 'do', cardAt: 'tl',
          answer: 'Answer: the kitchen\'s south wall, by the dish door. It is a plain duplex in a commercial kitchen, where 210.8(B)(2) wants every receptacle protected.\nThe engineer\'s miss is now the GC\'s question. The GC, the general contractor, runs the job and passes your RFI to the designer.',
          rules: ['elec.gfci.non-dwelling'],
          body: 'The engineer drew one more receptacle in a room the code wants protected, and left the GFI off it. Flag it with an RFI, a written question to the designer.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click that receptacle.\n3. Type RFI: and two questions. Should it be a GFCI? Which circuit is it on?\n4. Click {{Done|#noteModalDone}}.',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => notesNear(pts(G.missed)[0], 26, E101).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))),
          hint: () => { const a = pageAnn(E101); if (!a || !(a.notes || []).length) return ''; const rfi = (a.notes || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))); if (!rfi) return 'Start the note with RFI:'; return pts(G.gfci).some((pt) => notesNear(pt, 26, E101).length) ? 'That one already says GFI. Look for a plain duplex in a room where every receptacle must be protected' : 'Not that room. Where does the code protect every receptacle?'; },
          action: { label: 'Flag it for me', run: () => { K().goPage(E101); const page = S().pages[E101]; const a = App.ensureActiveCanvas(page).annotations; if (!a.notes) a.notes = []; const spot = pts(G.missed)[0]; if (a.notes.some((n) => K().near(n, spot, 26))) return; App.pushUndoSnapshotCurrentPage(); a.notes.push({ x: spot.x, y: spot.y, text: 'RFI: Kitchen receptacle drawn as a plain duplex, on no circuit of LP-1; every receptacle in a commercial kitchen is GFCI (NEC 210.8(B)(2)). Bid it as GFCI, and on which circuit?', id: App.uid(), width: 160, fontSize: 14, placementRotation: page.rotation ?? 0, color: '#e85447' }); S().tool = App.TOOL.NONE; K().dirty(); } } },
        { id: 'duplex', title: 'Count the rest', kind: 'do', cardAt: 'tl', page: E101,
          // T2 (settled 2026-09-27): the flagged receptacle is counted ONCE, as a GFCI (its circle is the
          // GFCI counter's), and the Duplex circles are the ten plain ones; a Duplex mark on it is refused.
          zones: () => circlesOn(E101, counter(RE.gfci), pts(G.missed)).concat(circlesOn(E101, counter(RE.duplex), plainDuplex())),
          rules: ['elec.mount-height.defaults'],
          body: 'Until the answer comes back, the bid carries it as a GFCI, the one the inspector will pass. Count it once, as a GFCI.\n1. Under COUNTERS, click GFCI, then click the flagged receptacle, unless you clicked it in the first step.\n2. Click [[+ Add]] and make a Duplex 20A counter the same way: Category Receptacle, Variant Duplex.\n3. Click the ten circled receptacles.\nThe dining room and storage have no sink and are not a kitchen: plain duplex receptacles at 18 in.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#addCounter'],
          check: () => { const d = counter(RE.duplex), g = counter(RE.gfci); return !!d && !!g && markNear(g, pts(G.missed)[0], 10, E101) && allDone(circlesOn(E101, d, plainDuplex())) && !markNear(d, pts(G.missed)[0], 10, E101); },
          hint: () => { const d = counter(RE.duplex), g = counter(RE.gfci); if (d && markNear(d, pts(G.missed)[0], 10, E101)) return { code: 'wrong-item', text: 'The flagged one is counted as a GFCI, not a duplex. Undo it with the Undo button under the sheet' }; const miss = d ? missing(d, plainDuplex(), DUPLEX_LABELS, 10, E101) : ''; if (miss) return miss; return g && !markNear(g, pts(G.missed)[0], 10, E101) ? 'Now click GFCI under COUNTERS, then the flagged receptacle' : ''; },
          action: { label: 'Count them for me', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('gfci'), pts(G.missed), E101); markMissing(pick('duplex'), plainDuplex(), E101); K().dirty(); } } },
        { id: 'heights', title: 'Heights you never typed', kind: 'read', cardAt: 'tl',
          rules: ['elec.mount-height.defaults', 'elec.vertical.make-up'],
          body: 'The Duplex counter arrived with 18 in, the GFCI with 44 in, the panel with 78 in.\nWhere do those numbers come from, and what does the app do with them?',
          reveal: 'Trade practice inside the code\'s limits.\nThe code: a switch or a breaker no higher than 6 ft 7 in (NEC 404.8(A), 240.24(A)).\nThe ADA, the Americans with Disabilities Act: the reach range of 15 to 48 in.\nThe practice: receptacles at 18 in to center, a GFCI at a counter above the backsplash at 44 in.\nThey are the rulebook\'s Default mount heights row. The rulebook is the app\'s list of the trade rules it applies, and every counter\'s details let you change them.\nThe app uses the height for the vertical, the conduit that runs up or down the wall. The plan view never shows it.\nWhen you chain devices in Chapter 4, every run gets ceiling minus mount height plus a foot of make-up written on it. Make-up is the extra conduit for the bend and the box.',
          target: [], check: () => true },
        { id: 'jbox', title: 'The equipment', kind: 'do', cardAt: 'tl', page: E101, zones: () => circlesOn(E101, counter(RE.jbox), pts(G.jbox)),
          body: 'Six pieces of equipment are hard-wired, each from a J-box with its circuit number beside it. A J-box, a junction box, is a metal box where wires are joined.\n1. Under COUNTERS, click [[+ Add]] and make a J-Box counter: Category Junction Box, Variant J-Box.\n2. Click the six circled boxes.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#addCounter'], check: () => allDone(circlesOn(E101, counter(RE.jbox), pts(G.jbox))),
          hint: () => (counter(RE.jbox) ? missing(counter(RE.jbox), pts(G.jbox), JBOX_LABELS, 10, E101) : ''),
          action: { label: 'Count them for me', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('jbox'), pts(G.jbox), E101); K().dirty(); } } },
        { id: 'keys', title: 'Put the counters on the number row', kind: 'do', keys: true,
          body: '1. In the {{status bar|.status-bar}}, at the bottom right, click [[quick keys]].\n2. Beside key 1, choose Duplex.\n3. Beside key 2, choose GFCI.\n4. Close the dialog.\nA quick key picks a counter from the number row: press 1 and the next click on the sheet places a Duplex.\nOn a real E-sheet the rhythm is 1, click, click, 2, click, and the hand never leaves the plan: no trips back to the sidebar.',
          target: ['#quickKeysModal .modal-card', '#statusBarQuickKeys'],
          // both keys, and the dialog closed, as the card says: on key 1 alone the step advanced and the
          // engine closed the dialog under a reader who had not reached key 2 (by hand, 2026-09-25)
          check: () => { const bound = (re) => { const c = counter(re); return !!c && Object.values(S().numberKeyBindings || {}).some((b) => b && b.id === c.id); }; return bound(RE.duplex) && bound(RE.gfci) && !K().modalUp('quickKeysModal'); },
          hint: () => { const bound = (re) => { const c = counter(re); return !!c && Object.values(S().numberKeyBindings || {}).some((x) => x && x.id === c.id); }; if (!bound(RE.duplex)) return ''; if (!bound(RE.gfci)) return 'Key 1 is Duplex. Now key 2: GFCI'; return K().modalUp('quickKeysModal') ? 'Both keys are set. Close the dialog' : ''; },
          action: { label: 'Bind 1 and 2 for me', run: () => { if (!S().numberKeyBindings) S().numberKeyBindings = {}; S().numberKeyBindings[1] = { kind: 'counter', id: pick('duplex').id }; S().numberKeyBindings[2] = { kind: 'counter', id: pick('gfci').id }; K().dirty(); } } },
      ],
      done: 'Twenty-one receptacles sorted by what the code wants, the engineer\'s miss flagged and counted as a GFCI. Six equipment connections, and heights the app already knew.\nNext: [[Learn]] → Chapter 3, the lighting.',
    },
    // 3 ----------------------------------------------------------------------------------------
    {
      id: 'lighting', title: 'Chapter 3: Lighting, by the letter', short: 'the fixtures, by type', minutes: 10, page: E201, noun: 'chapter', set: ESET,
      intro: 'The fixture schedule becomes your counters in one drag, and the plan says which type each light is. Then the lights that stay on when the power fails.',
      opener: 'Both plans open with their scale set, and you start on E-201, the lighting plan. Nothing you do here touches your projects.',
      seed() { scaleE101(); K().setScale(E201, 9, '1/8" = 1\''); },
      steps: [
        { id: 'schedule', title: 'Counters from the schedule', kind: 'do',
          body: 'Every light fixture on E-201 carries a type letter, and the fixture schedule on E-501 says what each letter is. Let the sheet do the typing.\n1. Under PAGES, click {{E-501|#pagesList [data-page-idx="2"]}}.\n2. Under COUNTERS, click [[+ Add]], then the [[Create]] tab.\n3. Click [[Read a schedule from the sheet…]].\n4. Drag a box over the LIGHTING FIXTURE SCHEDULE.\n5. Click [[Create counters]].',
          // the sheet first: on E-201 the light is on PAGES, where line 1 sends the reader, not on + Add
          target: () => (K().onPage(E501) ? ['#schedulePaletteCreate', '#counterReadSchedule', '#counterModal .counter-tab[data-tab="create"]', '#addCounter'] : ['#pagesList']),
          check: () => !!(byTag('A') && byTag('B') && byTag('EM')),
          action: { label: 'Read the schedule for me', run: readFixtureSchedule } },
        { id: 'plan', title: 'The plan says which', kind: 'do', cardAt: 'bl', page: E201, zones: () => Object.keys(LIGHT_TYPES).reduce((zs, t) => zs.concat(circlesOn(E201, byTag(t), pts(G[t]), 12)), []),
          body: 'Five counters, one per letter, each carrying its tag: the letter it answers to on the plan.\n1. Under PAGES, click {{E-201|#pagesList [data-page-idx="1"]}}.\n2. Under COUNTERS, click A to arm it, so each click on the sheet places one.\n3. Click every circled fixture, whatever its letter.\nAs the cursor nears a letter, the {{status bar|.status-bar}} reads Plan says B, and the click lands on B. One armed counter covers every type.\nThirty-six fixtures.',
          target: () => (K().onPage(E201) ? ['#annCanvas', '#countersList'] : ['#pagesList']), check: () => Object.keys(LIGHT_TYPES).every((t) => allDone(circlesOn(E201, byTag(t), pts(G[t]), 12))),
          hint: () => Object.keys(LIGHT_TYPES).map((t) => { const c = byTag(t); const m = c ? missing(c, pts(G[t]), pts(G[t]).map(() => 'type ' + t), 10, E201) : ''; return m ? m.replace(/:.*$/, ' of type ' + t) : ''; }).filter(Boolean).join(' · '),
          action: { label: 'Count them for me', run: () => { K().goPage(E201); App.pushUndoSnapshotCurrentPage(); Object.keys(LIGHT_TYPES).forEach((t) => markMissing(pickLight(t), pts(G[t]), E201)); K().dirty(); } } },
        { id: 'power', title: 'Which fixtures stay lit when the power fails?', kind: 'do', cardAt: 'bl',
          rules: ['elec.emergency.battery-duration', 'elec.egress.illumination'],
          answer: 'Answer: the exit signs and the emergency lights, Type X and Type EM. They are on circuit 21 with a battery in each: ninety minutes of light with the power out (NEC 700.12, IBC 1008). The IBC is the International Building Code. They cost more than a fixture: a battery and a test switch in each.\nCircuit 21 feeds nothing else. The code allows that when its breaker has a lock-on, a clip that stops anyone switching it off (NEC 700.12). The lock-on is on the bid too.',
          body: 'Thirty-six fixtures on four circuits. When the building loses power, most go dark.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click a fixture that stays lit.\n3. Type why it stays lit.\n4. Click {{Done|#noteModalDone}}.',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => pts(G.X).concat(pts(G.EM)).some((pt) => notesNear(pt, 24, E201).length),
          hint: () => { const a = pageAnn(E201); if (!a || !(a.notes || []).length) return ''; return pts(G.A).concat(pts(G.B), pts(G.C)).some((pt) => notesNear(pt, 24, E201).length) ? 'That one goes dark: it is on a normal lighting circuit. Look for the fixtures with a battery' : 'Put the note on the fixture itself'; },
          action: { label: 'Note an exit sign for me', run: () => { K().goPage(E201); const page = S().pages[E201]; const a = App.ensureActiveCanvas(page).annotations; if (!a.notes) a.notes = []; const spot = pts(G.X)[0]; if (a.notes.some((n) => K().near(n, spot, 24))) return; App.pushUndoSnapshotCurrentPage(); a.notes.push({ x: spot.x, y: spot.y, text: 'Exit sign: battery backed, stays lit 90 minutes', id: App.uid(), width: 150, fontSize: 14, placementRotation: page.rotation ?? 0, color: '#e85447' }); S().tool = App.TOOL.NONE; K().dirty(); } } },
        { id: 'os', title: 'Which rooms switch themselves off?', kind: 'do', cardAt: 'bl',
          body: 'Three switches on this plan are not switches. They are OS, occupancy sensors: they turn the lights off when nobody is in the room.\n1. Under COUNTERS, click [[+ Add]] and make an OS counter: Category Switch, Variant Occupancy.\n2. Click the three OS marks on the plan.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#addCounter'], check: () => { const c = counter(RE.os); return !!c && pts(G.OS).every((pt) => markNear(c, pt, 12, E201)) && !T().strayMarks(E201, c.id, osZones(c)); },
          hint: () => { const c = counter(RE.os); return c ? osStrayHint(c) || missing(c, pts(G.OS), OS_DOORS, 12, E201) : ''; },
          action: { label: 'Count the three for me', run: () => { K().goPage(E201); App.pushUndoSnapshotCurrentPage(); markMissing(pick('os'), pts(G.OS), E201); K().dirty(); } } },
        { id: 'why', title: 'Why those three rooms', kind: 'read', cardAt: 'bl',
          rules: ['elec.lighting.occupancy-sensors'],
          body: 'The sensors are at the two restroom doors and the storage door.\nWhy there, and not in the dining room?',
          reveal: 'The energy code, not the electrical code. The IECC, the International Energy Conservation Code, sets how a building saves power.\nIECC C405.2.1 wants the lights in rooms people leave to shut themselves off: restrooms, storage, break rooms. This course reads the 2021 edition.\nThat edition adds halls and small closed rooms. So the hall and the mop room want sensors too, and the engineer drew neither.\nThat is another RFI. Until it is answered, the bid carries two more sensors.\nThe dining room is busy whenever the restaurant is open. So it gets a time switch, a clock that turns the lights off after hours (C405.2.2). The dimmer at the entry is extra.\nOn the bid an occupancy sensor is a device, a box and a plate like a switch, at a different price.\nThe row Lighting controls meet the energy code, under BID CHECK, is where you sign that you looked.',
          target: ['#annCanvas'], check: () => true },
      ],
      done: 'Your counters from the schedule, thirty-six fixtures by the letter, the ones with a battery, and the rooms that switch themselves off.\nNext: [[Learn]] → Chapter 4, the conduit.',
    },
    // 4 ----------------------------------------------------------------------------------------
    {
      id: 'conduit', title: 'Chapter 4: Conduit, wire and the vertical', short: 'a circuit, traced', minutes: 12, page: E101, noun: 'chapter', set: ESET,
      intro: 'A line type that knows its conduit and its wires, and why #12 goes with a 20 A breaker. Then the ceiling that turns a chain into verticals, and how full a conduit may be.',
      opener: 'E-101 opens with its receptacles counted, all but the four on the dining room\'s west wall. Your chain places those.\nNothing you do here touches your projects.',
      seed() { scaleE101(); markMissing(pick('duplex'), plainDuplex().slice(4), E101); markMissing(pick('gfci'), gfciAll(), E101); },   // not the west wall's four: the reader's chain places them (seeded, the chain doubled them to 15)
      steps: [
        { id: 'linetype', title: 'A line type that knows what is in it', kind: 'do',
          body: 'The keynotes, the numbered notes on the sheet, say 2 #12 CU THHN + 1 #12 G in 3/4" EMT. Make a line type that knows it.\n1. Under LINE TYPES, click {{+ Add|#addLineType}}, then {{Quick|#lineTypeQuickLink}}.\n2. Pick 0.75in. Beside Material, pick EMT, or add it with the + button if it is not there.\n3. Click [[Add Line Type]].\n4. Click the pencil beside the new line type.\n5. Set the raceway, what the wire runs in, to EMT, 3/4".\n6. In Conductors, type 2 #12 THHN + 1 #12 G.\n7. Click {{Done|#counterLineTypeDetailsClose}}.\nIn words: two #12 copper (CU) wires, the live one and the neutral, and one #12 ground (G), the green safety wire. THHN is the common building wire\'s insulation. EMT, electrical metallic tubing, is thin-wall steel conduit.',
          // once the reader's own 0.75in EMT exists, its pencil (line 2) outranks + Add (line 1); never the standing "3/4in EMT old"
          target: () => { const lt = lineType(RE.emt75); return T().ladder('#conductorsSpec', '#racewayKind', '#counterLineTypeDetailsModal .modal-card', '#quickLineAdd', '#chooseLineTypeModal .line-type-tab[data-tab="quick"]', '#lineTypeQuickLink', lt && !K().isStanding(lt.id) ? T().pencilOf('lineType', lt) : null, '#addLineType'); },
          check: () => K().someLineType(RE.emt75, (lt) => lt.raceway && lt.raceway.kind === 'EMT' && (lt.conductors || []).length >= 2),
          action: { label: 'Make 0.75in EMT · 2 #12 + G', run: () => { App.pushUndoSnapshot(); const lt = makeEmt(); S().activeLineTypeId = lt.id; K().dirty(); } } },
        { id: 'why12', title: 'Why #12', kind: 'read', cardAt: 'tl',
          rules: ['elec.conductor.small-protection'],
          body: 'Every 20 A circuit on the schedule is #12 copper.\nWhy that gauge, that wire size, and what would #14 or #10 mean?',
          reveal: 'The breaker protects the wire: it trips before the wire can overheat.\nA #12 copper conductor may be protected at no more than 20 A and a #14 at no more than 15 A (NEC 240.4(D)). A #10 carries 30 A.\nA restaurant\'s receptacle circuits are 20 A by convention, so they are #12. Go up a size when a run is long (Chapter 5), never down.\nOn the bid the conductor count is what matters: two #12 plus a ground in every foot of that conduit. The app counts the wire from the runs, so it can never be missed.',
          target: [], check: () => true },
        { id: 'ceiling', title: 'The ceiling, and the foot nobody draws', kind: 'do',
          rules: ['elec.vertical.make-up', 'elec.mount-height.defaults'],
          body: '1. In the header, click [[Project Settings]], the gear.\n2. In {{Ceiling height|#settingsCeilingHeight}}, type 10\'-0".\n3. Leave {{make-up|#settingsMakeUp}} at 1 ft.\n4. Close the dialog.\nA receptacle at 18 in under a 10 ft ceiling is 8 ft 6 in of conduit coming down the wall. Add the bend at the top and the box entry: the foot of make-up, the rulebook\'s own convention.\nNo drawing shows that foot, so the takeoff has to add it.',
          target: ['#settingsCeilingHeight', '#settingsGearBtn', '#sidebarLogoGear'], check: () => S().ceilingHeightFt > 0,
          action: { label: 'Set 10\'-0"', run: () => { setCeiling(); K().dirty(); } } },
        { id: 'chain', title: 'Chain the west wall', kind: 'do', cardAt: 'br', page: E101, zones: () => circlesOn(E101, counter(RE.duplex), pts(G.diningW), 12),
          rules: ['elec.vertical.make-up', 'elec.mount-height.defaults'],
          body: 'Circuit 1 is the four receptacles on the dining room\'s west wall.\n1. In the header, click [[Chain]] (or press T).\n2. In the Chain panel, choose Duplex and 0.75in EMT.\n3. Click the four circled receptacles, top to bottom.\n4. Press Enter.\nEvery click draws the run back to the last one and writes the vertical on it: 9.5 ft per receptacle. The {{status bar|.status-bar}} shows that drop, the vertical, before you click.',
          target: ['#chainPanel', '#chainBtn'], check: () => { const a = pageAnn(E101); return !!a && (a.quickLines || []).filter((l) => (l.endDrop || 0) > 0 || (l.startDrop || 0) > 0).length >= 3; },
          // a chain with no ceiling, or a counter with no mount height, writes no verticals and the card just waited
          hint: () => { const a = pageAnn(E101); if (!a || !(a.quickLines || []).length || (a.quickLines || []).some((l) => (l.endDrop || 0) > 0 || (l.startDrop || 0) > 0)) return ''; if (!(S().ceilingHeightFt > 0)) return 'No verticals: the project has no ceiling. Set it in Project Settings (the step before), then chain again'; const c = counter(RE.duplex); return c && !(c.mountHeightIn > 0) ? 'No verticals: the Duplex counter has no mount height. Give it 18 in its details, then chain again' : ''; },
          action: { label: 'Chain the four for me', run: chainWestWall } },
        { id: 'fill', title: 'Conduit fill', kind: 'do',
          rules: ['elec.conduit.fill-limit'],
          onEnter: () => T().foldBidCheck(), hold: true, body: '1. In the left sidebar, click BID CHECK to open it.\nThe first row is judged already: Conduit fill within the table limit. Fill is how much of the conduit\'s inside the wires take up.\nHere 2 #12 and a ground in 3/4" EMT take less than a tenth of the conduit. The § chip beside the row, the small section mark, names the rule.\nThree or more conductors may fill 40% of a raceway (NEC Chapter 9, Table 1); the app does the areas.',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false && !!(bidRow('conduit-fill') && bidRow('conduit-fill').verdict === 'ok'),
          action: { label: 'Open it', run: () => K().openBidCheck() } },
        { id: 'straps', title: 'A support row of your own', kind: 'do',
          rules: ['elec.emt.support'],
          body: 'EMT is fastened within 3 ft of every box and every 10 ft along the run (NEC 358.30). A strap is the clamp that holds it, and the rulebook has no strap row for conduit yet, so write one.\n1. Under LINE TYPES, click the pencil beside 0.75in EMT.\n2. Under {{Child counts|#childCountsGroup}}, add a row: Strap, 1 per 10 ft.\n3. Click {{Done|#counterLineTypeDetailsClose}}.\nA child count is an item the app counts off a run by its length, so the straps follow the feet.',
          target: () => T().ladder('#childCountsGroup', T().pencilOf('lineType', lineType(RE.emt75)), '#lineTypesSectionTitle'),
          check: () => K().someLineType(RE.emt75, (lt) => (lt.childCounts || []).some((ch) => ch.per === 'ft')),
          action: { label: 'Add Strap · 1 per 10 ft', run: () => { const lt = makeEmt(); if ((lt.childCounts || []).length) return; App.pushUndoSnapshot(); lt.childCounts = [{ name: 'Strap', qty: 1, per: 'ft', ftInterval: 10 }]; K().dirty(); } } },
        { id: 'read', title: 'What the drawing knows now', kind: 'read',
          body: 'SUMMARY, in the left sidebar, keeps the running totals.\nIt has the feet of 0.75in EMT with the four verticals inside, and the straps under it.\nThen the derived rows, worked out from the runs: #12 THHN by the foot, the green ground its own row.\nWire is never a mark. Delete a run and its wire goes with it.',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'A conduit that knows its wires, a chain that wrote its own verticals, fill judged, straps counted.\nNext: [[Learn]] → Chapter 5, the circuit.',
    },
    // 5 ----------------------------------------------------------------------------------------
    {
      id: 'circuits', title: 'Chapter 5: The circuit, the homerun and the drop', short: 'a circuit that checks itself', minutes: 12, page: E101, noun: 'chapter', set: ESET,
      intro: 'A group with a panel and a number is a circuit. The homerun reaches the panel, and the voltage-drop row says whether the engineer\'s #12 is enough for the farthest device.',
      opener: 'E-101 opens with the earlier chapters\' work on it: the scale, the ceiling height, the panel, the GFCIs and the west-wall chain.',
      seed() { scaleE101(); setCeiling(); markMissing(pick('gfci'), gfciAll(), E101); chainWestWall(); markMissing(pick('panel'), pts(G.panel), E101); },
      steps: [
        { id: 'group', title: 'Make it a circuit', kind: 'do',
          // a tablet has no right-click: the app opens the same menu on a touch held for half a second
          body: () => { let touch = false; try { touch = window.matchMedia('(pointer: coarse)').matches; } catch (_) { touch = false; } return 'The chain on the west wall is circuit 1 on LP-1. A group is a named set of marks and runs. Give it a panel and a circuit number, and the app reads it as a circuit.\n1. In the header, click [[Project Settings]] and turn on {{Use groups|#settingsUseGroupsBtn}} if it is off.\n2. In the left sidebar, under GROUPS, click {{+ Add|#addGroup}}. In Name, type Dining receptacles, west wall. In Panel, type LP-1. In Circuit, type 1. Click {{Done|#groupModalDone}}.\n3. ' + (touch ? 'Touch and hold a west-wall receptacle' : 'Right-click a west-wall receptacle') + ', click [[Assign to group]], pick the group and click {{Done|#groupAssignDone}}.\n4. Do the same for the runs between them.\nNext time, click the group first: everything placed after joins it.'; },
          // the card's order: the gear until groups are on, + Add until the circuit exists, then the sheet
          target: () => (circuit1() ? T().ladder('#groupAssignDone', '#annCanvas', '#addGroup', '#groupsSectionTitle') : T().ladder('#groupModalDone', '#groupModalPanel', '#settingsUseGroupsBtn', '#addGroup', '#groupsSectionTitle', '#settingsGearBtn', '#sidebarLogoGear')),
          check: () => { const g = circuit1(); const a = pageAnn(E101); return !!(g && a && (a.quickLines || []).some((l) => l.group === g.id)); },
          hint: () => (circuit1() ? 'The circuit exists: now put the west-wall receptacles and their runs in it' : ''),
          action: { label: 'Make LP-1 · 1 and assign the west wall', run: circuitOne } },
        { id: 'homerun', title: 'The homerun', kind: 'do', cardAt: 'br', page: E101, zones: () => traceZones(RE.hr, pts(G.homerun1), E101),
          body: 'The arrow beside the west wall\'s receptacles says LP-1-1: this string of receptacles goes home, back to the panel, on circuit 1 of LP-1. The arrow is shorthand and does not show the path, so you trace it.\n1. Under LINE TYPES, click {{+ Add|#addLineType}}. In Name, type 0.75in EMT HR and click [[Create Line Type]]. HR stands for homerun.\n2. Click the pencil beside it. Set the raceway to EMT, 3/4", and Conductors to 2 #12 THHN + 1 #12 G, the same as 0.75in EMT.\n3. Turn on {{Homerun|#lineTypeHomerunBtn}} and click {{Done|#counterLineTypeDetailsClose}}.\n4. Under GROUPS, click the circuit, so the run you draw joins it.\n5. Click [[Polyline]], the tool that draws a run through several clicks.\n6. Trace the conduit\'s path: up from the top receptacle into the ceiling, along the north wall to above STORAGE, and down to LP-1.\n7. Click [[Finish]] (or press Enter).',
          // the card's order: + Add until the type exists, its pencil until Homerun is on, Done, the
          // circuit under GROUPS until it is the active group, Polyline, and Finish once the path is in.
          // The controls the card names follow whatever is lit, so the card keeps off them all.
          target: () => {
            const lt = lineType(RE.hr), g = circuit1(), s = S(), path = allDone(traceZones(RE.hr, pts(G.homerun1), E101));
            const first = !lt ? ['#lineTypeCreate', '#addLineType']
              : !lt.homerun ? ['#lineTypeHomerunBtn', T().pencilOf('lineType', lt)]
                : K().modalUp('counterLineTypeDetailsModal') ? ['#counterLineTypeDetailsClose']
                  : s.drawingPolyline ? [path ? '#finishPolyline' : null, '#annCanvas']
                    : path ? ['#annCanvas']
                      : [g && s.activeGroupId !== g.id ? '#groupsList' : null, '#polylineBtn', '#polylineBtnSidebar'];
            return T().ladder(...first, '#addLineType', '#polylineBtn', '#polylineBtnSidebar', '#groupsSectionTitle');
          },
          // The run has to be FINISHED, not only drawn through the circles: the step passed on the last
          // circle with the run still a draft, moved on, and left the next card stuck until the reader
          // pressed Enter (the card review, 2026-09-27; Will's go, 2026-09-28). The circles still tick live.
          check: () => (S().lineTypes || []).some((l) => l.homerun) && allDone(traceZones(RE.hr, pts(G.homerun1), E101)) && !S().drawingPolyline,
          progress: () => (S().drawingPolyline && allDone(traceZones(RE.hr, pts(G.homerun1), E101)) ? 'The path is in. Click Finish under the sheet to end the run' : ''),
          hint: () => { const lt = lineType(RE.hr); return lt && !lt.homerun ? 'The type exists: open its details and turn on Homerun' : ''; },
          action: { label: 'Trace it for me', run: () => { const lt = makeHomerun(); if (!polylinesOn(RE.hr, E101).length) tracePlan(lt, G.homerun1, 'Homerun, circuit 1', E101); const g = circuitOne(); void g; } } },
        { id: 'panelpoles', title: 'The panel knows its schedule', kind: 'do',
          // the chapter's own Panelboard came with 42 poles (TAGS), which passed this step on arrival
          onEnter: () => { const c = counter(RE.panel); if (c && c.lesson && c.poles === 42) { delete c.poles; App.updateUI(); } },
          body: () => { const sel = T().pencilOf('counter', counter(RE.panel)); return 'Bid Check can compare the circuits you draw against the panel\'s schedule once the panel counter knows how many poles, breaker positions, it has.\n1. Under COUNTERS, click ' + (sel ? '{{the pencil|' + sel + '}}' : 'the pencil') + ' beside the panel counter.\n2. In Panel name, type LP-1 if it is blank. In Poles, type 42, the count on LP-1\'s schedule. Click {{Done|#counterLineTypeDetailsClose}}.'; },
          target: () => T().ladder('#panelPoles', '#panelName', '#counterLineTypeDetailsModal .modal-card', T().pencilOf('counter', counter(RE.panel)), '#countersSection'),
          check: () => { const c = counter(RE.panel); return !!(c && c.panelName && c.poles === 42); },
          action: { label: 'Set LP-1 · 42 poles', run: () => { const c = pick('panel'); App.pushUndoSnapshot(); c.panelName = 'LP-1'; c.poles = 42; K().dirty(); } } },
        { id: 'vd', title: 'What the voltage-drop row says', kind: 'do',
          rules: ['elec.voltage-drop.branch-limit', 'elec.voltage-drop.k-constant'],
          // the row's name is a pointer once the list is open: folded, there is no row to light
          onEnter: () => T().foldBidCheck(), hold: true, body: () => '1. In the left sidebar, click BID CHECK to expand it.\nRead the row ' + (S().bidCheckCollapsed === false ? '{{Voltage drop within 3% to the farthest device|.bid-check-row[data-row-id=voltage-drop]}}' : 'Voltage drop within 3% to the farthest device') + '. Voltage drop is the voltage a wire loses along its length, so the far end gets less.\nThe app walked the homerun and the chain to the receptacle farthest from LP-1. It assumed 12 A on the circuit, and it warns, naming the gauge that would pass.\nThe Code recommends no more than 3% on a branch circuit (NEC 210.19, informational note). A branch circuit runs from a panel out to its devices.\nThe rulebook chip carries the K constant it used, the number for copper\'s resistance in the formula.\nIs the engineer wrong?',
          reveal: 'Not yet. The app assumed 12 A because you did not say. The panel schedule on E-501 gives the real load, and the next card types it in.', revealLabel: 'Show the answer',
          target: ['.bid-check-row[data-row-id=voltage-drop]', '#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false && !!bidRow('voltage-drop') && bidRow('voltage-drop').verdict !== 'na',
          // the homerun step passes on its last circle, so its run can still be a draft here, and a draft is on no circuit
          hint: () => { const r = bidRow('voltage-drop'); let touch = false; try { touch = window.matchMedia('(pointer: coarse)').matches; } catch (_) { touch = false; } return S().bidCheckCollapsed === false && r && r.verdict === 'na' ? 'Not judged yet. ' + r.detail + (touch ? ' Touch and hold' : ' Right-click') + ' the homerun and a west-wall receptacle, Assign to group, and pick the circuit' : ''; },
          action: { label: 'Open it', run: () => K().openBidCheck() } },
        { id: 'load', title: 'The load the engineer scheduled', kind: 'do',
          rules: ['elec.voltage-drop.branch-limit'],
          body: 'E-501 schedules circuit 1 at 720 VA, which is 6 A at 120 V.\n1. Under GROUPS, click the pencil beside the circuit.\n2. In Load, type 6. Click {{Done|#groupModalDone}}.\n{{The row|.bid-check-row[data-row-id=voltage-drop]}} turns to a tick: at 6 A the drop is under 3% on #12.\nWhen the schedule gives a load, use it. When it does not, the default is the honest warning: the app says so rather than guess low.\nOne caution: 720 VA is the load calculation\'s figure, 180 VA for each receptacle. It is not a measured load. A long run that passes only at that figure is worth an RFI.',
          // the pencil until the load is in, then the row the card says has turned
          target: () => { const g = circuit1(); return g && g.loadAmps === 6 ? T().ladder('#groupModalDone', '.bid-check-row[data-row-id=voltage-drop]', '#bidCheckSectionTitle', '#groupsList .edit-btn') : T().ladder('#groupModalLoadAmps', '#groupModalDone', '#groupsList .edit-btn', '#groupsSectionTitle'); },
          check: () => { const g = circuit1(); return !!(g && g.loadAmps === 6 && bidRow('voltage-drop') && bidRow('voltage-drop').verdict === 'ok'); },
          hint: () => { const g = circuit1(); return g && g.loadAmps && g.loadAmps !== 6 ? 'Read circuit 1 on E-501: 720 VA at 120 V' : ''; },
          action: { label: 'Set 6 A', run: () => { const g = circuitOne(); App.pushUndoSnapshot(); g.loadAmps = 6; K().dirty(); } } },
        { id: 'cross', title: 'Circuits against the schedule', kind: 'read',
          body: 'Two more rows have something to judge now.\n{{Circuits on plan match the panel schedule|.bid-check-row[data-row-id=circuits-vs-panel]}} reads one circuit on plan against forty-two poles. It stays open until every circuit is drawn: it is the row that says you are not finished.\n{{Every device on a circuit and reached by a run|.bid-check-row[data-row-id=devices-on-circuits]}} names the receptacles you counted in Chapter 2 that no run has reached yet.\nNeither blocks the export. Both are the app saying what it knows.',
          // the lower row first: the sidebar scrolls to the first one, and the other sits just above it
          target: () => (S().bidCheckCollapsed === false ? ['.bid-check-row[data-row-id=devices-on-circuits]', '.bid-check-row[data-row-id=circuits-vs-panel]'] : ['#bidCheckSectionTitle']), lightAll: true, check: () => true },
      ],
      done: 'A circuit with its homerun, a panel that knows its schedule, and a voltage-drop warning you understood and answered.\nNext: [[Learn]] → Chapter 6, the equipment.',
    },
    // 6 ----------------------------------------------------------------------------------------
    {
      id: 'equipment', title: 'Chapter 6: The equipment', short: 'the hard-wired half', minutes: 8, page: E101, noun: 'chapter', set: ESET,
      intro: 'Dedicated circuits (one machine each), two poles and three. The breaker the kitchen hood trips, and the disconnect that must be in sight of the unit.',
      opener: 'E-101 opens with the six J-boxes of Chapter 2 already counted, one at each piece of equipment.',
      seed() { scaleE101(); markMissing(pick('jbox'), pts(G.jbox), E101); },
      steps: [
        { id: 'three', title: 'Which equipment is three phase?', kind: 'do', cardAt: 'tl',
          answer: 'Answer: RTU-1, the rooftop unit, the box on the roof that heats and cools the building. It is on 18, 20 and 22: three poles, 208 V three phase, a 40 A breaker and #8 wire.\nThe dishwasher takes two poles, 208 V single phase, and so does EF-1, the hood\'s exhaust fan. Everything else is one pole at 120 V.',
          body: 'Six J-boxes, six circuits on the schedule. One of them takes three poles: it is three phase, fed from all three phases.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click that J-box, write what it feeds, and click {{Done|#noteModalDone}}.',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => notesNear(pts(G.rtu)[0], 26, E101).length > 0,
          hint: () => { const a = pageAnn(E101); if (!a || !(a.notes || []).length) return ''; return pts(G.jbox).some((pt) => notesNear(pt, 26, E101).length) ? 'That one is single phase: one or two circuit numbers beside it. Look for three' : 'Put the note on the J-box itself'; },
          action: { label: 'Note RTU-1 for me', run: () => { K().goPage(E101); const page = S().pages[E101]; const a = App.ensureActiveCanvas(page).annotations; if (!a.notes) a.notes = []; const spot = pts(G.rtu)[0]; if (a.notes.some((n) => K().near(n, spot, 26))) return; App.pushUndoSnapshotCurrentPage(); a.notes.push({ x: spot.x, y: spot.y, text: 'RTU-1 on the roof: 208 V three phase, circuits 18, 20, 22', id: App.uid(), width: 150, fontSize: 14, placementRotation: page.rotation ?? 0, color: '#e8c547' }); S().tool = App.TOOL.NONE; K().dirty(); } } },
        { id: 'poles', title: 'Poles', kind: 'read', cardAt: 'tl',
          rules: ['elec.disconnect.within-sight'],
          body: 'Why give a building three phase at all?',
          reveal: 'Motors. A three-phase motor is smaller, cheaper and smoother than a single-phase one of the same power.\nSo rooftop units, walk-in cooler compressors and exhaust fans want it. And a 208Y/120 V service gives 120 V to the receptacles from any phase to neutral at the same time.\nThe one-line on E-601 says it: 208Y/120V, 3Φ, 4W. That reads three phase, four wires: three phases and a neutral.\nOn the bid a three-pole circuit is three conductors and a ground in the conduit, and a three-pole breaker.\nIt also wants a disconnect within sight of the unit (NEC 440.14), on the roof. A disconnect is a switch at the unit that cuts its power for service.\nThe roof also gets a GFCI receptacle within 25 ft of the unit, for the service tech (NEC 210.63, 210.8(B)(5)). The set has no roof plan, so add it to the bid by hand.',
          target: [], check: () => true },
        { id: 'hood', title: 'The breaker the hood trips', kind: 'do', cardAt: 'bl',
          rules: ['elec.hood.shunt-trip'],
          body: 'Circuit 12 feeds the receptacles under the hood, the canopy over the cook line, the row of ranges and fryers.\nThe schedule and the keynote put it on a shunt-trip breaker, one that can be tripped from outside the panel.\nIt is interlocked with the hood suppression, the fire system in the hood: one sets off the other. When that system fires, the breaker opens and the appliances lose power (NFPA 96).\nNFPA 96 is the National Fire Protection Association\'s standard for kitchen hoods; the plumbing course met the same rule on the gas.\nNothing says who wires the breaker to the hood, so ask with an RFI.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click beside the cook line receptacles, under HOOD ABOVE.\n3. Type RFI: and the question: who furnishes the shunt-trip breaker and wires it to the hood suppression? Click {{Done|#noteModalDone}}.',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => notesNear(pts(G.hood)[0], 60, E101).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))),
          hint: () => { const a = pageAnn(E101); return a && (a.notes || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))) ? 'Move it beside the cook line receptacles, under HOOD ABOVE' : ''; },
          action: { label: 'Flag it for me', run: () => flagShuntTrip() } },
        { id: 'dedicated', title: 'One circuit each', kind: 'read',
          rules: ['elec.circuit.fixed-equipment'],
          body: 'The dishwasher, the pump, the fan, the ice machine, the heater\'s controls and the rooftop unit each have a dedicated circuit, a circuit to themselves.\nWhy not share?',
          reveal: 'A fixed appliance on its own branch circuit cannot be tripped by anything else. NEC 210.23 limits what shares a circuit with fixed equipment.\nA kitchen that loses its dishwasher because someone plugged in a toaster is a kitchen that calls the electrician. That is a callback: a trip back to fix it.\nEach dedicated circuit is a breaker, a homerun the whole way back to the panel, and a disconnect or a cord-and-plug at the unit. Cord-and-plug means the unit plugs into a receptacle.\nOn the bid that homerun is the cost: six pieces of equipment, six runs to LP-1.\nThe app\'s homerun flag keeps them apart from the device-to-device conduit in the report.',
          target: [], check: () => true },
      ],
      done: 'Three poles, two poles, one; the breaker the hood trips flagged; six homeruns you know are there.\nNext: [[Learn]] → Chapter 7, the service.',
    },
    // 7 ----------------------------------------------------------------------------------------
    {
      id: 'service', title: 'Chapter 7: The service and the one-line', short: 'from the street to the panel', minutes: 8, page: E601, noun: 'chapter', set: ESET,
      intro: 'The one-line from the power company to LP-1: why 200 A, why 3/0 copper, why #6 for the ground. Then the feeder traced and judged for fill.',
      opener: 'The sheets open on E-601, the one-line. On E-101 the scale is set and panel LP-1 is counted.',
      seed() { scaleE101(); markMissing(pick('panel'), pts(G.panel), E101); },
      steps: [
        { id: 'read', title: 'Read the one-line', kind: 'read', cardAt: 'br',
          rules: ['elec.conductor.ampacity', 'elec.ground.equipment-conductor', 'elec.ground.electrode-conductor', 'elec.service.load-calculation'],
          body: 'E-601 is one line from the utility transformer, the power company\'s equipment at the street, to LP-1.\nThe service lateral is the buried wires from the utility. The meter counts what the building uses. The main disconnect shuts off the whole building.\nThe feeder is the heavy wires from the main disconnect to the panel. The ground ties the system to the earth.\nThe feeder is 4 #3/0 copper and a #6 ground in 2" conduit. #3/0, said three-aught, is thicker than any numbered size.\nWhy those sizes?',
          reveal: 'The main is 200 A, so the feeder must carry 200 A.\n#3/0 copper THHN is rated 200 A at the 75 °C column the terminals allow (NEC 310.16). The terminals are where the wire is fastened, and they limit how hot it may run.\nFour of them: three phases and a neutral.\nThe equipment ground rides with them and is sized from the breaker, #6 copper for 200 A (NEC 250.122).\nThe grounding electrode conductor to the water pipe and the rods is #4 (250.66). That wire ties the system to the earth, through metal rods driven into the ground.\nThe 200 A itself is the engineer\'s load calculation (NEC Article 220): 22 kVA connected, 62 A, and the kitchen\'s future. A kVA is a thousand VA.\nNobody sizes a restaurant service to today\'s load: kitchens add equipment, so the service is sized with room to grow.',
          target: ['#annCanvas'], check: () => true },
        { id: 'feeder', title: 'Trace the feeder', kind: 'do', cardAt: 'br', page: E101, zones: () => traceZones(RE.emt2, pts(G.feeder), E101),
          body: 'On E-101 the feeder is the heavy line from the main disconnect outside the south wall up to LP-1.\n1. Under PAGES, click E-101.\n2. Under LINE TYPES, click {{+ Add|#addLineType}}. In Name, type 2in EMT and click [[Create Line Type]].\n3. Click the pencil beside it. Set the raceway to EMT, 2", and Conductors to 4 #3/0 THHN + 1 #6 G. Click {{Done|#counterLineTypeDetailsClose}}.\n4. With it active, click [[Polyline]], then the two circled ends. Click [[Finish]] (or press Enter).',
          // the card's order: the sheet's row under PAGES, + Add until the type exists, its pencil until
          // it has its conductors, then Polyline, and Finish once both ends are in
          target: () => {
            if (!K().onPage(E101)) return ['#pagesList'];
            const lt = lineType(RE.emt2), path = allDone(traceZones(RE.emt2, pts(G.feeder), E101));
            const first = !lt ? ['#lineTypeCreate', '#addLineType']
              : !(lt.conductors || []).length ? ['#conductorsSpec', '#racewayKind', T().pencilOf('lineType', lt)]
                : K().modalUp('counterLineTypeDetailsModal') ? ['#counterLineTypeDetailsClose']
                  : S().drawingPolyline ? [path ? '#finishPolyline' : null, '#annCanvas']
                    : path ? ['#annCanvas']
                      : ['#polylineBtn', '#polylineBtnSidebar'];
            return T().ladder(...first, '#addLineType', '#polylineBtn', '#polylineBtnSidebar');
          },
          // finished, not only drawn (as the homerun step): the rise step after it takes no drop on a draft
          check: () => K().someLineType(RE.emt2, (lt) => (lt.conductors || []).length >= 2) && allDone(traceZones(RE.emt2, pts(G.feeder), E101)) && !S().drawingPolyline,
          progress: () => (S().drawingPolyline && allDone(traceZones(RE.emt2, pts(G.feeder), E101)) ? 'The path is in. Click Finish under the sheet to end the run' : ''),
          hint: () => { const lt = lineType(RE.emt2); return lt && !(lt.conductors || []).length ? 'The type exists: give it the conductors, 4 #3/0 THHN + 1 #6 G' : ''; },
          action: { label: 'Trace it for me', run: () => { const lt = makeFeeder(); if (!polylinesOn(RE.emt2, E101).length) tracePlan(lt, G.feeder, 'Feeder', E101); } } },
        { id: 'rise', title: 'The rise', kind: 'do', cardAt: 'br', page: E101, zones: () => K().guide([pts(G.feeder)[0]], 14, feederRiseOk()),
          rulesExempt: 'no rulebook entry: the feeder\'s 8.5 ft of vertical is this set\'s route (E-101 keynote), not a code figure',
          body: 'Seven feet on the plan, and the one-line calls the whole feeder 16 ft. The rest is vertical, so add it.\n1. Click [[Drop]] (or press B).\n2. In the Drop size palette, type 8.5 in its box and click {{Add|#dropCustomAdd}}.\n3. Click the circled end at the main disconnect.\nThe main disconnect sits 5 ft up the outside wall. The feeder goes through the wall and up 5 ft into the 10 ft ceiling.\nIt runs across, then comes down 3 ft 6 in into the top of the panel. The keynote on E-101 says so.\nThat is 8 ft 6 in of vertical. Drop adds a rise or a fall at the end of a run, feet the plan cannot show.',
          target: ['#dropPanel', '#dropBtn'], check: feederRiseOk,
          // T4 (2026-09-27): the card names 8.5 ft, so a 5 ft drop (the old card's) no longer passes
          // (the feeder step passes on its last circle, so the feeder can still be a draft here, and a draft takes no drop)
          hint: () => { const d = feederDrop(); return d > 0 && !feederRiseOk() ? { code: 'wrong-value', text: 'The drop reads ' + (Math.round(d * 100) / 100) + ' ft. Type 8.5 in the Drop size palette, click Add, and click the end again' } : ''; },
          action: { label: 'Add the 8.5 ft for me', run: () => { K().goPage(E101); if (!polylinesOn(RE.emt2, E101).length) tracePlan(makeFeeder(), G.feeder, 'Feeder', E101); K().dropAt(pts(G.feeder)[0], FEEDER_RISE_FT, E101); } } },
        { id: 'fill', title: 'Fill on the feeder', kind: 'do',
          rules: ['elec.conduit.fill-limit'],
          // the row's name is a pointer once the list is open: folded, there is no row to light
          onEnter: () => T().foldBidCheck(), hold: true, body: () => '1. In the left sidebar, click BID CHECK to expand it.\n' + (S().bidCheckCollapsed === false ? '{{Conduit fill within the table limit|.bid-check-row[data-row-id=conduit-fill]}}' : 'Conduit fill within the table limit') + ' now judges the feeder too: four 3/0 and a #6 in 2" EMT, about a third of the raceway.\nThat is under the 40% the table allows for three or more conductors (NEC Chapter 9, Table 1).\nHad the engineer written 1-1/2", the row would say so and name the size that fits.',
          target: ['.bid-check-row[data-row-id=conduit-fill]', '#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false && !!(bidRow('conduit-fill') && bidRow('conduit-fill').verdict === 'ok'),
          action: { label: 'Open it', run: () => K().openBidCheck() } },
        { id: 'gear', title: 'Count the gear', kind: 'do', cardAt: 'br', page: E101, zones: () => circlesOn(E101, counter(RE.meter), [pts(G.meter)[0]], 12).concat(circlesOn(E101, counter(RE.disc), [pts(G.mdp)[0]], 12)),
          body: 'The service is gear, the heavy electrical equipment, and the bid carries it at a price nothing else on the sheet approaches.\nA meter base is the socket the power company\'s meter plugs into. The power company brings the meter, and the bid carries the base.\n1. Make a Meter counter (Category Panel, Variant Meter) and click the meter base, the M outside the south wall.\n2. Make a Disconnect counter (Category Disconnect, Variant Disconnect) and click the MDP beside it, the main distribution panel.',
          // + Add while a counter is still to make (the Meter, then the Disconnect), the sheet while one is to place
          target: () => { const m = counter(RE.meter), d = counter(RE.disc); const make = !m || (!d && markNear(m, pts(G.meter)[0], 12, E101)); return make ? T().ladder('#counterQuickCountAdd', '#addCounter', '#annCanvas', '#countersSectionTitle') : T().ladder('#counterQuickCountAdd', '#annCanvas', '#addCounter', '#countersSectionTitle'); },
          check: () => markNear(counter(RE.meter), pts(G.meter)[0], 12, E101) && markNear(counter(RE.disc), pts(G.mdp)[0], 12, E101),
          // the two circles are 17 pt apart, so a click with the other counter armed is easy
          // (the reader's own undo: Cmd+Z on a Mac, the footer's Undo on a tablet, as lessons.js undoKey / onTouch)
          hint: () => { const m = counter(RE.meter), d = counter(RE.disc); let undo = 'Press Ctrl+Z'; try { undo = window.matchMedia('(pointer: coarse)').matches ? 'Tap Undo in the footer' : /Mac|iPhone|iPad/.test(navigator.platform || '') ? 'Press Cmd+Z' : 'Press Ctrl+Z'; } catch (_) { undo = 'Press Ctrl+Z'; } if (m && markNear(m, pts(G.mdp)[0], 12, E101)) return 'The Meter counter landed on the MDP. ' + undo + ', arm the Disconnect, and click the MDP'; if (d && markNear(d, pts(G.meter)[0], 12, E101)) return 'The Disconnect landed on the meter. ' + undo + ', arm the Meter, and click the M'; return ''; },
          action: { label: 'Count them for me', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('meter'), pts(G.meter), E101); markMissing(pick('disc'), pts(G.mdp), E101); K().dirty(); } } },
      ],
      done: 'The service from the street to the panel, a feeder traced with its rise and judged for fill, the gear counted.\nNext: [[Learn]] → Chapter 8, the whole set.',
    },
    // 8 ----------------------------------------------------------------------------------------
    {
      id: 'whole', title: 'Chapter 8: The whole set', short: 'the set, finished', minutes: 10, page: E101, noun: 'chapter', set: ESET,
      intro: 'Every device on both plans, the west-wall circuit with its homerun, the feeder: all of it in one pass. Then set beside the reference, and the report\'s circuit schedule.',
      opener: 'The sheets open with the scale and the ceiling height set, and no marks. The takeoff is yours to make.',
      seed() { scaleE101(); K().setScale(E201, 9, '1/8" = 1\''); setCeiling(); },
      steps: [
        { id: 'lay', title: 'Finish the takeoff', kind: 'do', cardAt: 'bl',
          body: 'Now all of it, by hand: every device on both plans, the gear, the west-wall chain and its homerun, the feeder with its rise. Earlier chapters taught each one.\n1. Count and trace until the line beside [[Show me where]] reads ✓ Done. Until then it names what is missing.\n[[Skip this step]] moves on with the sheets as they are. The next card compares them against the reference, the course\'s own finished takeoff.\n[[Finish the takeoff for me]] lays that takeoff on the sheets instead, if you would rather see it done.',
          target: ['#annCanvas'], check: takeoffComplete, hint: takeoffHint,
          action: { label: 'Finish the takeoff for me', run: layEverything },
          // PP-WHOLE-SKIP (2026-09-27): the action is the engine's spec seam and draws no button on a
          // step that is not handsOff, so the card the reader is sent Back to shows it as its alt.
          alt: { label: 'Finish the takeoff for me', run: layEverything } },
        { id: 'compare', title: 'Against the reference', kind: 'read', cardAt: 'tl',
          // PP-WHOLE-SKIP (2026-09-27): Skip on the lay step leaves the sheets as they are, and
          // nothing fills them in. With no mark there is nothing to compare and no report, so the
          // card says so and points back at the button beside Skip.
          body: () => (takeoffSkipped() ? 'You skipped the takeoff, so the sheets have no marks, and there is nothing to compare yet.\nTo see the answer, click [[Back]], then [[Finish the takeoff for me]]. It lays the course\'s finished takeoff on both plans, and this card then checks it.\nOr read on: [[Next]] moves on with the sheets as they are.' : compareBody()),
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
        { id: 'report', title: 'The circuit schedule', kind: 'read',
          // [[Show Report]] shows only once the sheets carry a mark (output.js syncOutputMenus): after
          // a Skip the card says there is no report yet, and still says what the report holds.
          body: () => (takeoffSkipped()
            ? 'You skipped the takeoff, so the sheets have no marks and there is no report yet. [[Show Report]] shows under EXPORT OPTIONS once they do.\nTo see it, click [[Back]] twice, then [[Finish the takeoff for me]].\nOr read on. Besides the counts and the feet by type, an electrical project\'s report carries a Circuit schedule.\nIt lists each circuit with its devices, its conduit and homerun feet, its wire by gauge, and the farthest device from the panel.\nIt is the estimator\'s copy of E-501, built from what was drawn.'
            : '1. Under EXPORT OPTIONS, click [[Show Report]].\nBesides the counts and the feet by type, an electrical project\'s report carries a Circuit schedule.\nIt lists each circuit with its devices, its conduit and homerun feet, its wire by gauge, and the farthest device from the panel.\nIt is the estimator\'s copy of E-501, built from what was drawn.'),
          target: ['#printReport', '#exportOptionsSectionTitle'], check: () => true },
        { id: 'legend', title: 'The legend on the sheet', kind: 'do', hold: true,
          body: '1. In the left sidebar, click {{the gear|#summarySettingsBtn}} beside SUMMARY.\nA legend is the key on a sheet that says what each symbol means. On an electrical project the app draws it as a compact ruled block, the way an E-sheet draws its own.\nIt has a mount-height column and the panel in its footer.',
          target: ['#legendSettingsModal .modal-card', '#summarySettingsBtn'], check: () => K().modalUp('legendSettingsModal'),
          action: { label: 'Open Summary Legend', run: () => { if (App.openLegendSettingsModal) App.openLegendSettingsModal(); } } },
      ],
      done: 'The whole set, counted and traced, checked against the reference, and a circuit schedule the app wrote.\nNext: [[Learn]] → Chapter 9, the bid.',
    },
    // 9 ----------------------------------------------------------------------------------------
    {
      id: 'bid', title: 'Chapter 9: Check it, prove it, hand it off', short: 'a bid you can defend', minutes: 8, page: E101, noun: 'chapter', set: ESET,
      intro: 'What the electrical rows of Bid Check mean, and which the set already answers. Then where a number came from, and the hand-off to the electrical bid.',
      opener: 'E-101 opens with circuit 1 finished: its chain, its homerun and its 6 A load. The shunt-trip RFI from Chapter 6 is on it too.',
      seed() { scaleE101(); setCeiling(); markMissing(pick('gfci'), gfciAll(), E101); chainWestWall(); markMissing(pick('panel'), pts(G.panel), E101); const g = circuitOne(); g.loadAmps = 6; if (!polylinesOn(RE.hr, E101).length) tracePlan(makeHomerun(), G.homerun1, 'Homerun, circuit 1', E101); circuitOne(); flagShuntTrip(); },
      steps: [
        { id: 'open', title: 'Open Bid Check', kind: 'do',
          onEnter: () => T().foldBidCheck(), hold: true, body: '1. In the left sidebar, click BID CHECK to expand it.\nFour rows marked AUTO the app judges from your runs: conduit fill, voltage drop, circuits against the panel schedule, every device on a circuit.\nThe rest are yours, the manual rows: you tick each one when you have checked it.',
          target: () => (S().bidCheckCollapsed === false ? ['#bidCheckSection'] : ['#bidCheckSectionTitle']), check: () => S().bidCheckCollapsed === false, action: { label: 'Open it', run: () => K().openBidCheck() } },
        { id: 'rows', title: 'What the manual rows mean', kind: 'read',
          rules: ['elec.emt.bends'],
          body: 'The manual rows read: Fire alarm devices at rated corridors (fire-resistant halls) and doors. Lighting controls meet the energy code. Equipment connections coordinated with HVAC (heating and air) and plumbing. Temporary power and lighting included. Pull points within 360° of bends on every run.\nWhich of them did this set already answer?',
          reveal: 'Two on paper. The occupancy sensors on E-201 are the energy code row. The J-boxes at the dishwasher, the pump, the fan, the heater and RTU-1 are the coordination row: equipment the plumbing and mechanical (HVAC) sets own.\nFire alarm is not on this set at all, which is itself an answer: an RFI, or an exclusion in the bid. An exclusion says the price leaves it out.\nTemporary power, what the builders run on during construction, is never on a drawing. Pull points are yours: a pull point is a box the wire is pulled through. A run with more than 360° of bends between boxes needs one (NEC 358.26), and the plan cannot show the bends the electrician will make.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => true },
        { id: 'tick', title: 'Sign what you have read', kind: 'do',
          body: '1. In the left sidebar, under BID CHECK, click {{Scale verified on every counted sheet|.bid-check-row[data-row-id=scale-verified]}}. One click signs it for the whole bid.\n2. Click {{Lighting controls meet the energy code|.bid-check-row[data-row-id=lighting-controls]}}.\n3. Click {{Equipment connections|.bid-check-row[data-row-id=equipment-connections]}} coordinated with HVAC and plumbing.',
          // the lowest row first: the sidebar scrolls to the first one, and the others sit just above it
          target: () => (S().bidCheckCollapsed === false ? ['.bid-check-row[data-row-id=equipment-connections]', '.bid-check-row[data-row-id=lighting-controls]', '.bid-check-row[data-row-id=scale-verified]'] : ['#bidCheckSectionTitle']), lightAll: true, check: () => manual('scale-verified') && manual('lighting-controls') && manual('equipment-connections'),
          action: { label: 'Tick the three for me', run: () => { K().tickManual('scale-verified'); K().tickManual('lighting-controls'); K().tickManual('equipment-connections'); } } },
        { id: 'proof', title: 'Where did that number come from?', kind: 'do', hold: true,
          body: () => { const sel = T().summaryRowOf('counter', counter(RE.gfci)); return '1. In the left sidebar, under SUMMARY, click ' + (sel ? '{{the GFCI total|' + sel + '}}' : 'the GFCI total') + '.\nThe breakdown shows the count sheet by sheet with a thumbnail of where every mark sits.\nThis is what you open when the GC questions the number and asks where it came from.'; },
          target: () => T().ladder('#summaryCountDetailModal .modal-card', T().summaryRowOf('counter', counter(RE.gfci)), '#summarySectionTitle'), check: () => K().detailOpenFor(counter(RE.gfci)), hint: () => K().detailMiss(counter(RE.gfci)),
          action: { label: 'Open the breakdown', run: () => { const c = counter(RE.gfci); if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); } } },
        { id: 'handoff', title: 'Hand it off', kind: 'read',
          body: '[[Open in TakeoffTooling]] hands the devices, runs, verticals, wire and cable to the electrical pricing app.\n[[Copy RFI Flags]] puts the shunt-trip question beside it.\n[[Export PDFs]] makes the marked-up set.\nIn the pricing app each device explodes into its parts: box, ring, plate and connectors. Every row picks up labor from your book, your company\'s hours for each item.\nMore: [Doing an electrical takeoff](/guides/electrical-takeoff/).',
          // the lowest button first: the sidebar scrolls to the first one, and the others sit above it
          target: ['#copyRfiFlags', '#forTakeoffTooling', '#specificPages', '#exportOptionsSectionTitle'], lightAll: true, check: () => true },
      ],
      done: 'That is the course: a restaurant\'s power read off the engineer\'s set, counted with the app, checked against the tables, and handed to the bid.\nWhen you are ready for a real set, click [[Upload PDF]].',
    },
  ];

  // ----- the runner, the lessonKit's (R15) ------------------------------------------------------
  // The chapters' tours, the Learn menu section, the doors and the routes, /app/?course=electrical
  // and /app/?chapter=electrical:<id>. The one lessonKit read at load: lessons.js loads first.
  const course = K().registerCourse({ id: COURSE, chapters: CHAPTERS, doors: { hint: 'canvasEmptyHintCourseElectrical', settings: 'settingsCourseElectrical' } });
  App.startChapterElectrical = course.start;
  App.courseElectricalIds = () => CHAPTERS.map((c) => c.id);
  App.courseElectricalReference = () => ({ feet: RUNS.reduce((o, r) => { o[r.name] = r.feet(); return o; }, {}), counts: COUNTS().map((c) => [c[3], c[1].length]) });
})();
