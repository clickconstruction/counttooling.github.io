/*
 * features/course-electrical.js - the electrical course: how a restaurant gets its power,
 * taught on the engineered electrical set with the app's own tools. Nine chapters on the
 * tour engine (features/tutorial.js), the plumbing course's sibling (features/
 * course-plumbing.js), same rules, same doors. Plan of record:
 * journeys/plans/ELECTRICAL-COURSE.md.
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
 * Progress: localStorage `clickcount-course-done`, { 'electrical:<id>': ISO }. Doors: the
 * Learn menu's section (#learnCourseList-electrical), the empty-canvas "power" link,
 * Project Settings → Help → "electrical course", /app/?course=electrical,
 * /app/?chapter=electrical:<id>.
 *
 * Registrations: startChapterElectrical(id), courseElectricalIds(), courseElectricalReference().
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const COURSE = 'electrical';
  const DONE_KEY = 'clickcount-course-done';
  const ESET = { url: '/samples/sample-electrical.pdf', name: 'sample-electrical', pages: 4, trade: 'electrical', word: 'four' };
  const E101 = 0, E201 = 1, E501 = 2, E601 = 3;
  const K = () => App.lessonKit;
  const T = () => App.tourKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tourId = (id) => 'course:' + COURSE + ':' + id;
  const key = (id) => COURSE + ':' + id;

  // ----- the sheets, in PDF points ------------------------------------------------------------
  // E-101 and E-201 sit on P-101's shell: a plan point is (60 + 0.75·x, 70 + 0.75·y), K().P.
  // These lists mirror POWER / LIGHTING in scripts/sample-electrical.js, FLAT (x, y, x, y…).
  const P = (x, y) => K().P(x, y);
  const G = {
    dim318: [560, 84, 940, 84],
    duplex: [136, 160, 136, 250, 136, 340, 136, 430, 200, 106, 300, 106, 400, 106, 500, 596, 760, 476, 930, 590, 600, 460],  // 11 drawn as duplex, at 18"; the last is the engineer's miss
    missed: [600, 460],                                                                                                    // a plain duplex in the kitchen: 210.8(B)(2) wants it GFCI; the reader finds it
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
  const pts = (flat) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push(P(flat[i], flat[i + 1])); return out; };
  const planFeet = (flat) => { let px = 0; for (let i = 2; i + 1 < flat.length; i += 2) px += Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]); return px / 12; };
  const CEILING_FT = 10, MAKE_UP_FT = 1;
  const MOUNT = { duplex: 18, gfci: 44, panel: 78, meter: 60, disconnect: 60 };

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
    duplex: /duplex/i, gfci: /gfci/i, jbox: /j-?box|junction/i, panel: /panel/i, meter: /\bmeter\b/i, disc: /disconnect/i, os: /occupancy|\bos\b/i,
    emt75: /0?\.75\s*in.*emt(?!.*hr)|3\/4.*emt(?!.*hr)/i, hr: /\bhr\b|homerun/i, emt2: /\b2\s*in.*emt/i, emtAny: /emt/i,
  };

  // ----- on-sheet targets (the engine's) ------------------------------------------------------------
  const ZR = 14;
  const circlesOn = (pageIdx, c, spots, r) => T().markZones(pageIdx, (c || {}).id || '__none__', spots, r || ZR);
  const guide = (spots, r, done) => spots.map((p) => ({ kind: 'circle', x: p.x, y: p.y, r, done: !!done }));
  const runsOn = (re, pageIdx) => { const pls = polylinesOn(re, pageIdx).map((pl) => pl.points || []); const d = S().drawingPolyline; return d && d.points && typeIds(re).has(d.lineTypeId) ? pls.concat([d.points]) : pls; };
  const traceZones = (re, spots, pageIdx) => T().pathZones(spots, 15, runsOn(re, pageIdx));
  const allDone = (zs) => T().allDone(zs);
  const missing = (c, spots, labels, d, pageIdx) => { const ms = marksOf(c, pageIdx); const out = []; spots.forEach((pt, i) => { if (!ms.some((m) => K().near(m, pt, d || 8))) out.push(labels[i]); }); return out.length ? out.length + ' more: ' + out.join(', ') : ''; };
  const DUPLEX_LABELS = ['the dining west wall (top)', 'the dining west wall', 'the dining west wall', 'the dining west wall (bottom)', 'the dining north wall (west)', 'the dining north wall (middle)', 'the dining north wall (east)', 'the server station', 'storage (north wall)', 'storage (south wall)', 'the kitchen south wall'];
  const plainDuplex = () => pts(G.duplex).filter((pt) => !K().near(pt, pts(G.missed)[0], 2));
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
  // on the card. Built on first use: the tour kit registers after this file loads.
  const proofs = {};
  const proof = (key, make) => proofs[key] || (proofs[key] = T().measureProof(make()));
  const proveE101 = () => proof('E101', () => ({ page: E101, ends: pts(G.dim318), r: 13, ft: 31.67, tol: 0.4, stated: '31\'-8"' }));
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
  function markMissing(c, spots, pageIdx) {
    const a = App.ensureActiveCanvas(S().pages[pageIdx]).annotations;
    const have = (a.counterMarkers[c.id] || []);
    const todo = spots.filter((pt) => !have.some((m) => K().near(m, pt, 4)));
    if (todo.length) K().mark(pageIdx, c, todo);
    return todo.length;
  }
  const scaleE101 = () => K().setScale(E101, 9, '1/8" = 1\'');
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
      const conductors = window.ConductorModel ? window.ConductorModel.parseConductorSpec('3 #12 THHN + 1 #12 G').conductors : [];
      lt = k.makeLineType('0.75in EMT', '#8a4bb0', { raceway: { kind: 'EMT', size: '3/4"' }, conductors });
    }
    return lt;
  }
  function makeHomerun() {
    const k = K();
    let lt = lineType(RE.hr);
    if (!lt) {
      const conductors = window.ConductorModel ? window.ConductorModel.parseConductorSpec('3 #12 THHN + 1 #12 G').conductors : [];
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
  const circuit1 = () => (S().groups || []).find((x) => x.panel === 'LP-1' && String(x.circuit) === '1');
  function dropAt(spot, ft, pageIdx) {
    const a = pageAnn(pageIdx); if (!a) return;
    const nodes = App.collectDropNodes(a, 1) || [];
    let best = null, d = Infinity;
    nodes.forEach((n) => { const dd = Math.hypot(n.x - spot.x, n.y - spot.y); if (dd < d) { d = dd; best = n; } });
    if (!best || !App.applyDropToNode(a, best, ft, 'ft', true)) return;
    App.pushUndoSnapshotCurrentPage();
    App.applyDropToNode(a, best, ft, 'ft');
    App.pushRecentDrop(ft, 'ft');
    K().dirty();
  }
  function tick(id) { const s = S(); s.bidCheck = s.bidCheck || { manual: {} }; s.bidCheck.manual = s.bidCheck.manual || {}; if (s.bidCheck.manual[id]) return; App.pushUndoSnapshot(); s.bidCheck.manual[id] = true; s.bidCheckCollapsed = false; K().dirty(); }
  const openBidCheck = () => { S().bidCheckCollapsed = false; if (App.renderBidCheck) App.renderBidCheck(); App.updateUI(); };

  // ----- the reference takeoff -------------------------------------------------------------------------
  const COUNTS = () => [
    ['duplex', pts(G.duplex), E101, 'Duplex'], ['gfci', pts(G.gfci), E101, 'GFCI'], ['jbox', pts(G.jbox), E101, 'J-Box'], ['panel', pts(G.panel), E101, 'Panelboard'],
    ['meter', pts(G.meter), E101, 'Meter'], ['disc', pts(G.mdp), E101, 'Disconnect'], ['os', pts(G.OS), E201, 'Occupancy'],
    ['A', pts(G.A), E201, 'Type A'], ['B', pts(G.B), E201, 'Type B'], ['C', pts(G.C), E201, 'Type C'], ['X', pts(G.X), E201, 'Type X'], ['EM', pts(G.EM), E201, 'Type EM'],
  ];
  const counterFor = (tag) => (TAGS[tag] ? counter(TAGS[tag][0]) : byTag(tag));
  const RUNS = [
    { name: '0.75in EMT', re: RE.emt75, exclude: RE.hr, feet: () => planFeet(G.diningW) + 4 * (CEILING_FT - MOUNT.duplex / 12 + MAKE_UP_FT), label: 'the west wall chain with its four verticals' },
    { name: '0.75in EMT HR', re: RE.hr, exclude: null, feet: () => planFeet(G.homerun1), label: 'the homerun from the west wall to LP-1' },
    { name: '2in EMT', re: RE.emt2, exclude: null, feet: () => planFeet(G.feeder) + 5, label: 'the feeder from the main to LP-1, with its 5 ft rise' },
  ];
  // A run inside a group is prefixed with the group in brackets in the summary.
  function readerFeet() { const out = {}; String(window.getPipeToolingSummary ? window.getPipeToolingSummary() : '').split('\n').forEach((line) => { const m = /^(?:\[.*?\]\s*)?ft of (.+?)\t([\d.]+)/.exec(line); if (m) out[m[1]] = Number(m[2]); }); return out; }
  const feetFor = (re, exclude) => { const f = readerFeet(); let n = 0; Object.keys(f).forEach((name) => { if (re.test(name) && !(exclude && exclude.test(name))) n += f[name]; }); return n; };
  const fmtFt = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const countOk = ([tag, spots, pageIdx]) => { const c = counterFor(tag); return !!c && spots.every((pt) => markNear(c, pt, 8, pageIdx)); };
  function layEverything() {
    scaleE101();
    K().setScale(E201, 9, '1/8" = 1\'');
    App.pushUndoSnapshotCurrentPage();
    chainWestWall();
    markMissing(pick('duplex'), pts(G.duplex), E101); markMissing(pick('gfci'), pts(G.gfci), E101); markMissing(pick('jbox'), pts(G.jbox), E101);
    markMissing(pick('panel'), pts(G.panel), E101); markMissing(pick('meter'), pts(G.meter), E101); markMissing(pick('disc'), pts(G.mdp), E101);
    Object.keys(LIGHT_TYPES).forEach((t) => markMissing(pickLight(t), pts(G[t]), E201));
    markMissing(pick('os'), pts(G.OS), E201);
    if (!polylinesOn(RE.hr, E101).length) tracePlan(makeHomerun(), G.homerun1, 'Homerun, circuit 1', E101);
    if (!polylinesOn(RE.emt2, E101).length) { tracePlan(makeFeeder(), G.feeder, 'Feeder', E101); dropAt(pts(G.feeder)[0], 5, E101); }
    const g = circuitOne(); g.loadAmps = 6;
    K().goPage(E101);
    K().dirty();
  }
  const takeoffComplete = () => RUNS.every((r) => feetFor(r.re, r.exclude) >= r.feet() * 0.95) && COUNTS().every(countOk);
  function takeoffHint() {
    const run = RUNS.find((r) => feetFor(r.re, r.exclude) < r.feet() * 0.95);
    if (run) return 'Not yet traced: ' + run.label;
    const c = COUNTS().find((x) => !countOk(x));
    return c ? 'Not all counted: ' + c[3] + (c[2] === E201 ? ' (E-201)' : '') : '';
  }
  function compareBody() {
    const lines = ['Reference on the left, from the sheets\' own geometry. Yours on the right, from your Summary.'];
    RUNS.forEach((r) => { const ref = r.feet(), mine = feetFor(r.re, r.exclude); const ok = mine >= ref * 0.95 && mine <= ref * 1.05; lines.push(r.name + ': ' + fmtFt(ref) + ' ft, yours ' + fmtFt(mine) + ' ft' + (ok ? ' ✓' : mine < ref * 0.95 ? ', short: ' + r.label : ', over: check for a doubled run')); });
    const bad = COUNTS().filter((x) => !countOk(x)).map((x) => x[3]);
    lines.push(bad.length ? 'Counts short: ' + bad.join(', ') + '.' : 'Every count matches: twelve device types, sixty-nine marks across the two plans.');
    lines.push('The wire under the conduit rows is derived from the runs, never marked, so it cannot drift; the report\'s circuit schedule lists circuit 1 with its four devices, its feet and its farthest device.');
    return lines.join('\n');
  }

  // ===== the chapters ==============================================================================
  const CHAPTERS = [
    // 1 ----------------------------------------------------------------------------------------
    {
      id: 'sheet', title: 'Chapter 1: Read the E-sheets', short: 'the set, read', minutes: 8, page: E101, noun: 'chapter', set: ESET,
      intro: 'Power on one sheet, lighting on another, the panel schedule as the answer key: what an E-set is, where the panel sits and why, and a scale you proved.',
      seed() { /* the scale is the chapter's */ },
      steps: [
        { id: 'what', title: 'What is on an E-set?', kind: 'read', cardAt: 'br',
          body: 'Look at the title block: E-101, POWER PLAN. Under PAGES there are three more sheets.\nWhy does the electrical engineer draw the same building twice, once for power and once for lighting, when the plumber drew it once?',
          reveal: 'Density. A restaurant\'s receptacles, equipment connections, fixtures, switches and homeruns on one plan would be unreadable, so the power plan (E-101) carries everything that plugs in or is hard-wired, and the lighting plan (E-201) carries every fixture and the switch that controls it. E-501 is the schedules: the fixture types by letter, and panel LP-1 circuit by circuit. E-601 is the one-line, the service from the street to the panel.\nAn electrical estimator reads the panel schedule first. It is the engineer\'s own count of circuits, loads, breakers and wire sizes, and everything on the two plans has to add up to it.',
          target: [], check: () => true },
        { id: 'scale', title: 'Set the scale', kind: 'do',
          body: 'The title block says 1/8" = 1\'-0".\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/8" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => K().scaleIs(E101, 9),
          action: { label: 'Use 1/8" = 1\'-0"', run: async () => { K().goPage(E101); await T().applyScalePreset('1/8" = 1\'', 9); } } },
        { id: 'prove', title: 'Prove it', kind: 'do', cardAt: 'bl', page: E101, hold: true,
          body: () => (proveE101().check()
            ? proveE101().verdict() + ': the scale is right.\n1. Click [[Next]].'
            : 'The engineer wrote 31\'-8" over the kitchen half of the building. A dimension like that is the only thing that proves the scale: a PDF printed down keeps its scale bar and measures short.\n1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at the left end of the 31\'-8" string over the kitchen half.\n3. Click inside circle 2, at its right end.'),
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => proveE101().check(), hint: () => proveE101().hint(), zones: () => proveE101().zones(),
          action: { label: 'Measure the 31\'-8" string', run: async () => { K().goPage(E101); if (!K().scaleIs(E101, 9)) await T().applyScalePreset('1/8" = 1\'', 9); const d = pts(G.dim318); K().measure(d[0], d[1]); } } },
        { id: 'panel', title: 'Where is the panel?', kind: 'do', cardAt: 'tl',
          body: 'Every homerun arrow on the plan points at one thing. Find it.\n1. In the left sidebar, under COUNTERS, click [[+ Add]]. The project is electrical, so the [[Quick]] tab offers Category, Variant and Rating.\n2. Set Category to Panel and Variant to Panelboard, and click [[Add Counter]].\n3. Click the panel on the plan.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#counterModal .counter-tab[data-tab="quickcount"]', '#addCounter'],
          check: () => markNear(counter(RE.panel), pts(G.panel)[0], 14, E101),
          hint: () => (counter(RE.panel) && marksOf(counter(RE.panel), E101).length ? 'Not there. Follow any homerun arrow: LP-1 is on the west wall of STORAGE' : (K().armedNamed(RE.panel) ? 'The counter is armed: click LP-1' : '')),
          action: { label: 'Find it for me', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('panel'), pts(G.panel), E101); K().dirty(); } } },
        { id: 'clearance', title: 'The space in front of it', kind: 'do', cardAt: 'tl', page: E101, zones: () => guide(pts(G.clearance), 12, K().measured(E101, 3, 0.3)),
          rules: ['elec.mount-height.defaults'],
          body: 'LP-1, on the west wall of STORAGE, with a mount height the counter already carries: 78 in to the top, the rule the app applies. The engineer drew a dashed box in front of it.\n1. Click [[Measure]] (or press D).\n2. Click the two circled ends of the box, wall to its outer edge.\nHow deep is it?',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => K().measured(E101, 3, 0.3),
          hint: () => { const lm = S().lastMeasure; return lm && lm.pageIdx === E101 && T().measuredFeet() != null && Math.abs(T().measuredFeet() - 31.67) > 0.4 ? 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + '. Wall to the box\'s outer edge' : ''; },
          action: { label: 'Measure it for me', run: () => { K().goPage(E101); const d = pts(G.clearance); K().measure(d[0], d[1]); } } },
        { id: 'schedule', title: 'The panel schedule', kind: 'do', cardAt: 'br',
          rulesExempt: 'no rulebook entry: NEC 110.26 working space',
          body: 'Three feet. Working space: someone has to stand in front of a live panel and work on it, so the code keeps 36 in clear in front, 30 in wide, to 6 ft 6 in high (NEC 110.26). A panel behind the ice machine is a violation the estimator flags before the bid, because moving it later is a change order.\nNow the answer key.\n1. Under PAGES, click E-501.\n2. Find the one circuit on LP-1 that is 208 V and two-pole. Click [[⋯]], then [[Highlight]] (or press H), and drag a box over that row.',
          target: () => (K().onPage(E501) ? ['#highlightBtn', '#highlightBtnSidebar', '#headerMoreBtn'] : ['#pagesList']),
          check: () => { const a = pageAnn(E501); return !!a && (a.highlights || []).some((h) => Math.min(h.x1, h.x2) <= 400 && Math.max(h.x1, h.x2) >= 400 && Math.min(h.y1, h.y2) <= 549 && Math.max(h.y1, h.y2) >= 549); },
          hint: () => { if (!K().onPage(E501)) return T().pagesFoldedHint('E-501'); const a = pageAnn(E501); return a && (a.highlights || []).length ? 'Not that row. Read down the P column for a 2, and the description for 208V' : ''; },
          action: { label: 'Highlight the dishwasher for me', run: () => { K().goPage(E501); const a = App.ensureActiveCanvas(S().pages[E501]).annotations; if (!a.highlights) a.highlights = []; if (a.highlights.length) return; App.pushUndoSnapshotCurrentPage(); a.highlights.push(Object.assign({ color: '#e8c547', opacity: 0.25, id: App.uid() }, DW_ROW)); S().tool = App.TOOL.NONE; K().dirty(); } } },
        { id: 'row', title: 'Read a row', kind: 'read', cardAt: 'br',
          rulesExempt: 'no rulebook entry: NEC 240.4(D), 310.16 conductor protection and ampacity',
          body: 'Circuits 2 and 4: the dishwasher, 4800 VA at 208 V, two poles, a 30 A breaker, #10 wire. Every column is a decision the estimator prices.\nWhy #10 for the dishwasher when every other circuit is #12?',
          reveal: '4800 VA at 208 V is 23 A. A #12 copper conductor may be protected at no more than 20 A (NEC 240.4(D)), so the circuit goes to a 30 A breaker, and a 30 A breaker wants #10 (240.4(D) again, 310.16 for the ampacity). Two poles because 208 V is taken across two phases of the 208Y/120 V panel; no neutral.\nThe schedule is the engineer\'s arithmetic. The estimator\'s job is to price what it says: the breaker, the wire, the conduit, and to notice when the plan disagrees with it.',
          target: [], check: () => true },
      ],
      done: 'The two plans, the schedules, the one-line, the panel and the space it needs, and a scale you proved.\nNext: [[Learn]] → Chapter 2, the devices.',
    },
    // 2 ----------------------------------------------------------------------------------------
    {
      id: 'devices', title: 'Chapter 2: Receptacles, and which must be GFCI', short: 'every device counted', minutes: 10, page: E101, noun: 'chapter', set: ESET,
      intro: 'Which receptacles the code wants ground-fault protected and why, mount heights the app already knows, and every device on E-101 counted under a Quick counter.',
      seed() { scaleE101(); },
      steps: [
        { id: 'gfci', title: 'Which receptacles must be GFCI?', kind: 'do', cardAt: 'tl',
          rules: ['elec.mount-height.defaults'],
          body: 'The plan shows twenty receptacles. Some of them the code wants ground-fault protected.\n1. Under COUNTERS, click [[+ Add]]. On the [[Quick]] tab set Category to Receptacle, Variant to GFCI, Rating to 20A, and click [[Add Counter]]. It arrives at 44 in, the counter height.\n2. Click every receptacle that must be a GFCI, and none that need not.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#counterModal .counter-tab[data-tab="quickcount"]', '#addCounter'],
          check: () => { const c = counter(RE.gfci); return !!c && pts(G.gfci).every((pt) => markNear(c, pt, 10, E101)) && !plainDuplex().some((pt) => markNear(c, pt, 10, E101)); },
          hint: () => { const c = counter(RE.gfci); if (!c) return ''; const wrong = plainDuplex().find((pt) => markNear(c, pt, 10, E101)); if (wrong) return 'That one is in the dining room or storage, with no sink within 6 ft: a plain duplex. Press Ctrl+Z'; return missing(c, pts(G.gfci), GFCI_LABELS, 10, E101); },
          action: { label: 'Click the ten for me', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('gfci'), pts(G.gfci), E101); K().dirty(); } } },
        { id: 'missed', title: 'The one the engineer missed', kind: 'do', cardAt: 'tl',
          rulesExempt: 'no rulebook entry: NEC 210.8(B) GFCI locations',
          body: 'Ten with GFI beside them: the bar and the kitchen (a sink and food preparation, NEC 210.8(B)(2)), the restrooms (210.8(B)(1)), the mop room, whose receptacle sits within 6 ft of the mop sink (210.8(B)(5)), the dish pit.\nThe engineer drew one more receptacle in a room the code wants protected, and left the GFI off it.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click that receptacle, type RFI: and why it should be a GFCI, and click [[Done]].',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => notesNear(pts(G.missed)[0], 26, E101).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))),
          hint: () => { const a = pageAnn(E101); if (!a || !(a.notes || []).length) return ''; const rfi = (a.notes || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))); if (!rfi) return 'Start the note with RFI:'; return pts(G.gfci).some((pt) => notesNear(pt, 26, E101).length) ? 'That one already says GFI. Look for a plain duplex in a room where every receptacle must be protected' : 'Not that room. Where does the code protect every receptacle?'; },
          action: { label: 'Flag it for me', run: () => { K().goPage(E101); const page = S().pages[E101]; const a = App.ensureActiveCanvas(page).annotations; if (!a.notes) a.notes = []; const spot = pts(G.missed)[0]; if (a.notes.some((n) => K().near(n, spot, 26))) return; App.pushUndoSnapshotCurrentPage(); a.notes.push({ x: spot.x, y: spot.y, text: 'RFI: Kitchen receptacle drawn as a plain duplex; every receptacle in a commercial kitchen is GFCI (NEC 210.8(B)(2)). Bid it as GFCI?', id: App.uid(), width: 160, fontSize: 14, placementRotation: page.rotation ?? 0, color: '#e85447' }); S().tool = App.TOOL.NONE; K().dirty(); } } },
        { id: 'duplex', title: 'Count the rest', kind: 'do', cardAt: 'tl', page: E101, zones: () => circlesOn(E101, counter(RE.duplex), pts(G.duplex)),
          rules: ['elec.mount-height.defaults'],
          body: 'The kitchen\'s south wall, by the dish door: a plain duplex in a commercial kitchen, where 210.8(B)(2) wants every receptacle protected. The engineer\'s miss is now the GC\'s question, and the bid carries it as a GFCI until the answer comes back. The dining room and storage have no sink and are not a kitchen: plain duplex receptacles at 18 in.\n1. Make a Duplex 20A counter the same way: Category Receptacle, Variant Duplex.\n2. Click the eleven circled receptacles, the flagged one among them: count what is drawn, and let the note carry the question.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#addCounter'], check: () => allDone(circlesOn(E101, counter(RE.duplex), pts(G.duplex))),
          hint: () => (counter(RE.duplex) ? missing(counter(RE.duplex), pts(G.duplex), DUPLEX_LABELS, 10, E101) : ''),
          action: { label: 'Count them for me', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('duplex'), pts(G.duplex), E101); K().dirty(); } } },
        { id: 'heights', title: 'Where the heights come from', kind: 'read', cardAt: 'tl',
          rules: ['elec.mount-height.defaults', 'elec.vertical.make-up'],
          body: 'The Duplex counter arrived with 18 in, the GFCI with 44 in, the panel with 78 in, without your typing them.\nWhere do those numbers come from, and what does the app do with them?',
          reveal: 'Trade practice inside the code\'s limits: a switch or a breaker no higher than 6 ft 7 in (NEC 404.8(A), 240.24(A)), the ADA reach range of 15 to 48 in, receptacles at 18 in to center, a GFCI at a counter above the backsplash at 44 in. They are the rulebook\'s Default mount heights row, and every counter\'s details let you change them.\nThe app uses the height for the vertical: when you chain devices in Chapter 4, every run gets ceiling minus mount height plus a foot of make-up written on it, the conduit plan view never shows.',
          target: [], check: () => true },
        { id: 'jbox', title: 'The equipment', kind: 'do', cardAt: 'tl', page: E101, zones: () => circlesOn(E101, counter(RE.jbox), pts(G.jbox)),
          body: 'Six pieces of equipment are hard-wired, each from a J-box with its circuit beside it.\n1. Make a J-Box counter: Category Junction Box, Variant J-Box.\n2. Click the six circled boxes.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#addCounter'], check: () => allDone(circlesOn(E101, counter(RE.jbox), pts(G.jbox))),
          hint: () => (counter(RE.jbox) ? missing(counter(RE.jbox), pts(G.jbox), JBOX_LABELS, 10, E101) : ''),
          action: { label: 'Count them for me', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('jbox'), pts(G.jbox), E101); K().dirty(); } } },
        { id: 'keys', title: 'Put the counters on the number row', kind: 'do',
          body: '1. In the status bar at the bottom right, click [[quick keys]].\n2. Beside key 1, choose Duplex. Beside key 2, GFCI.\n3. Close the dialog.\nOn a real E-sheet the rhythm is 1, click, click, 2, click, and the hand never leaves the plan.',
          target: ['#quickKeysModal .modal-card', '#statusBarQuickKeys'],
          // both keys, and the dialog closed, as the card says: on key 1 alone the step advanced and the
          // engine closed the dialog under a reader who had not reached key 2 (by hand, 2026-09-25)
          check: () => { const bound = (re) => { const c = counter(re); return !!c && Object.values(S().numberKeyBindings || {}).some((b) => b && b.id === c.id); }; return bound(RE.duplex) && bound(RE.gfci) && !K().modalUp('quickKeysModal'); },
          hint: () => { const bound = (re) => { const c = counter(re); return !!c && Object.values(S().numberKeyBindings || {}).some((x) => x && x.id === c.id); }; if (!bound(RE.duplex)) return ''; if (!bound(RE.gfci)) return 'Key 1 is Duplex. Now key 2: GFCI'; return K().modalUp('quickKeysModal') ? 'Both keys are set. Close the dialog' : ''; },
          action: { label: 'Bind 1 and 2 for me', run: () => { if (!S().numberKeyBindings) S().numberKeyBindings = {}; S().numberKeyBindings[1] = { kind: 'counter', id: pick('duplex').id }; S().numberKeyBindings[2] = { kind: 'counter', id: pick('gfci').id }; K().dirty(); } } },
      ],
      done: 'Twenty-one receptacles sorted by what the code wants, one of them the engineer\'s miss flagged, six equipment connections, and heights the app already knew.\nNext: [[Learn]] → Chapter 3, the lighting.',
    },
    // 3 ----------------------------------------------------------------------------------------
    {
      id: 'lighting', title: 'Chapter 3: Lighting, by the letter', short: 'the fixtures, by type', minutes: 10, page: E201, noun: 'chapter', set: ESET,
      intro: 'The fixture schedule becomes the palette in one drag, the plan says which type each fixture is, and the fixtures that must stay lit when the power fails.',
      seed() { scaleE101(); K().setScale(E201, 9, '1/8" = 1\''); },
      steps: [
        { id: 'schedule', title: 'The palette from the schedule', kind: 'do',
          body: 'Every fixture on E-201 carries a letter, and E-501 says what each letter is. Let the sheet do the typing.\n1. Under PAGES, click E-501.\n2. Under COUNTERS, click [[+ Add]], then the [[Create]] tab, then [[Read a schedule from the sheet…]].\n3. Drag a box over the LIGHTING FIXTURE SCHEDULE.\n4. Click [[Create counters]].',
          target: ['#schedulePaletteCreate', '#counterReadSchedule', '#counterModal .counter-tab[data-tab="create"]', '#addCounter', '#pagesList'],
          check: () => !!(byTag('A') && byTag('B') && byTag('EM')),
          action: { label: 'Read the schedule for me', run: readFixtureSchedule } },
        { id: 'plan', title: 'The plan says which', kind: 'do', cardAt: 'bl', page: E201, zones: () => Object.keys(LIGHT_TYPES).reduce((zs, t) => zs.concat(circlesOn(E201, byTag(t), pts(G[t]), 12)), []),
          body: 'Five counters, one per letter, each carrying its tag.\n1. Under PAGES, click E-201.\n2. In the sidebar, click A to arm it, and click every circled fixture, whatever its letter. As the cursor nears a letter the status bar reads Plan says B, and the click lands on B: one tool for every type.\nThirty-six fixtures.',
          target: ['#annCanvas', '#countersList', '#pagesList'], check: () => Object.keys(LIGHT_TYPES).every((t) => allDone(circlesOn(E201, byTag(t), pts(G[t]), 12))),
          hint: () => Object.keys(LIGHT_TYPES).map((t) => { const c = byTag(t); const m = c ? missing(c, pts(G[t]), pts(G[t]).map(() => 'type ' + t), 10, E201) : ''; return m ? m.replace(/:.*$/, ' of type ' + t) : ''; }).filter(Boolean).join(' · '),
          action: { label: 'Count them for me', run: () => { K().goPage(E201); App.pushUndoSnapshotCurrentPage(); Object.keys(LIGHT_TYPES).forEach((t) => markMissing(pickLight(t), pts(G[t]), E201)); K().dirty(); } } },
        { id: 'power', title: 'Which fixtures stay lit when the power fails?', kind: 'do', cardAt: 'bl',
          body: 'Thirty-six fixtures, four circuits. When the building loses power, most go dark.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click a fixture that stays lit, say why, and click [[Done]].',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => pts(G.X).concat(pts(G.EM)).some((pt) => notesNear(pt, 24, E201).length),
          hint: () => { const a = pageAnn(E201); if (!a || !(a.notes || []).length) return ''; return pts(G.A).concat(pts(G.B), pts(G.C)).some((pt) => notesNear(pt, 24, E201).length) ? 'That one goes dark: it is on a normal lighting circuit. Look for the fixtures with a battery' : 'Put the note on the fixture itself'; },
          action: { label: 'Note an exit sign for me', run: () => { K().goPage(E201); const page = S().pages[E201]; const a = App.ensureActiveCanvas(page).annotations; if (!a.notes) a.notes = []; const spot = pts(G.X)[0]; if (a.notes.some((n) => K().near(n, spot, 24))) return; App.pushUndoSnapshotCurrentPage(); a.notes.push({ x: spot.x, y: spot.y, text: 'Exit sign: battery backed, stays lit 90 minutes', id: App.uid(), width: 150, fontSize: 14, placementRotation: page.rotation ?? 0, color: '#e85447' }); S().tool = App.TOOL.NONE; K().dirty(); } } },
        { id: 'os', title: 'Which rooms switch themselves off?', kind: 'do', cardAt: 'bl',
          rulesExempt: 'no rulebook entry: NEC 700.12, IBC 1008 emergency lighting',
          body: 'The exit signs and the emergency lights: Type X and Type EM, on circuit 21 with a battery in each, ninety minutes of light with the power out (NEC 700.12, IBC 1008). They cost more than a fixture: a battery, a test switch, and a circuit that must not be switched.\nThree switches on this plan are not switches.\n1. Make an OS counter: Category Switch, Variant Occupancy.\n2. Click the three OS marks on the plan.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#addCounter'], check: () => { const c = counter(RE.os); return !!c && pts(G.OS).every((pt) => markNear(c, pt, 12, E201)); },
          hint: () => (counter(RE.os) ? missing(counter(RE.os), pts(G.OS), ['the MEN door', 'the WOMEN door', 'the STORAGE door'], 12, E201) : ''),
          action: { label: 'Count the three for me', run: () => { K().goPage(E201); App.pushUndoSnapshotCurrentPage(); markMissing(pick('os'), pts(G.OS), E201); K().dirty(); } } },
        { id: 'why', title: 'Why those three rooms', kind: 'read', cardAt: 'bl',
          rulesExempt: 'no rulebook entry: IECC C405.2.1 occupancy sensors',
          body: 'Occupancy sensors at the restroom doors and the storage door.\nWhy those rooms and not the dining room?',
          reveal: 'The energy code, not the electrical code: IECC C405.2.1 wants the lights in rooms people leave, restrooms, storage, break rooms, to shut themselves off. The dining room is occupied whenever the restaurant is, so it gets a dimmer at the entry instead.\nOn the bid an occupancy sensor is a device, a box and a plate like a switch, at a different price, and the Lighting controls meet the energy code row in Bid Check is where you sign that you looked.',
          target: [], check: () => true },
      ],
      done: 'The palette from the schedule, thirty-six fixtures by the letter, the ones with a battery, and the rooms that switch themselves off.\nNext: [[Learn]] → Chapter 4, the conduit.',
    },
    // 4 ----------------------------------------------------------------------------------------
    {
      id: 'conduit', title: 'Chapter 4: Conduit, wire and the vertical', short: 'a circuit, traced', minutes: 12, page: E101, noun: 'chapter', set: ESET,
      intro: 'A line type that knows its raceway and its conductors, why #12 goes with a 20 A breaker, the ceiling height that turns a chain into verticals, and the fill the app checks against the table.',
      seed() { scaleE101(); markMissing(pick('duplex'), pts(G.duplex).slice(4), E101); markMissing(pick('gfci'), pts(G.gfci), E101); },   // not the west wall's four: the reader's chain places them (seeded, the chain doubled them to 15)
      steps: [
        { id: 'linetype', title: 'A line type that knows what is in it', kind: 'do',
          body: 'The keynotes say 3 #12 CU THHN + 1 #12 G in 3/4" EMT.\n1. Under LINE TYPES, click [[+ Add]], then [[Quick]]. Pick 0.75in and, beside Material, add EMT with [[+]] if it is not there. Click [[Add Line Type]].\n2. Click the pencil beside it. Set the raceway to EMT, 3/4".\n3. In Conductors, type 3 #12 THHN + 1 #12 G, and click [[Done]].',
          // once the reader's own 0.75in EMT exists, its pencil (line 2) outranks + Add (line 1); never the standing "3/4in EMT old"
          target: () => { const lt = lineType(RE.emt75); return T().ladder('#conductorsSpec', '#racewayKind', '#counterLineTypeDetailsModal .modal-card', '#quickLineAdd', '#chooseLineTypeModal .line-type-tab[data-tab="quick"]', '#lineTypeQuickLink', lt && !K().isStanding(lt.id) ? T().pencilOf('lineType', lt) : null, '#addLineType'); },
          check: () => K().someLineType(RE.emt75, (lt) => lt.raceway && lt.raceway.kind === 'EMT' && (lt.conductors || []).length >= 2),
          action: { label: 'Make 0.75in EMT · 3 #12 + G', run: () => { App.pushUndoSnapshot(); const lt = makeEmt(); S().activeLineTypeId = lt.id; K().dirty(); } } },
        { id: 'why12', title: 'Why #12', kind: 'read', cardAt: 'tl',
          rulesExempt: 'no rulebook entry: NEC 240.4(D) small-conductor protection',
          body: 'Every 20 A circuit on the schedule is #12 copper.\nWhy that gauge, and what would #14 or #10 mean?',
          reveal: 'The breaker protects the wire. A #12 copper conductor may be protected at no more than 20 A and a #14 at no more than 15 A (NEC 240.4(D)); #10 carries 30 A. A restaurant\'s receptacle circuits are 20 A by convention, so they are #12. Go up a size when a run is long (Chapter 5), never down.\nOn the bid the conductor count is what matters: three #12 plus a ground in every foot of that conduit, and the app counts the wire from the runs so it can never be missed.',
          target: [], check: () => true },
        { id: 'ceiling', title: 'The ceiling, and the foot nobody draws', kind: 'do',
          rules: ['elec.vertical.make-up', 'elec.mount-height.defaults'],
          body: '1. In the header, click the gear ([[Project Settings]]).\n2. In Ceiling height, type 10\'-0". Leave Make-up at 1 ft.\n3. Close the dialog.\nA receptacle at 18 in under a 10 ft ceiling is 8 ft 6 in of conduit coming down the wall, plus the bend at the top and the box entry: the foot of make-up, the rulebook\'s own convention.',
          target: ['#settingsCeilingHeight', '#settingsGearBtn', '#sidebarLogoGear'], check: () => S().ceilingHeightFt > 0,
          action: { label: 'Set 10\'-0"', run: () => { setCeiling(); K().dirty(); } } },
        { id: 'chain', title: 'Chain the west wall', kind: 'do', cardAt: 'br', page: E101, zones: () => circlesOn(E101, counter(RE.duplex), pts(G.diningW), 12),
          rules: ['elec.vertical.make-up', 'elec.mount-height.defaults'],
          body: 'Circuit 1 is the four receptacles on the dining room\'s west wall.\n1. In the header, click [[Chain]] (or press T).\n2. In the Chain panel, choose Duplex and 0.75in EMT.\n3. Click the four circled receptacles, top to bottom.\n4. Press Enter.\nEvery click draws the run back to the last one and writes the vertical on it: 9.5 ft per receptacle. The footer shows the drop before you click.',
          target: ['#chainPanel', '#chainBtn'], check: () => { const a = pageAnn(E101); return !!a && (a.quickLines || []).filter((l) => (l.endDrop || 0) > 0 || (l.startDrop || 0) > 0).length >= 3; },
          action: { label: 'Chain the four for me', run: chainWestWall } },
        { id: 'fill', title: 'Conduit fill', kind: 'do',
          rules: ['elec.conduit.fill-limit'],
          onEnter: () => T().foldBidCheck(), hold: true, body: '1. In the left sidebar, click BID CHECK to expand it.\nThe first row is judged already: Conduit fill within the table limit, 3 #12 and a ground in 3/4" EMT, about a tenth of the conduit, with the § chip naming the rule. Three or more conductors may fill 40% of a raceway (NEC Chapter 9, Table 1); the app does the areas.',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false && !!(bidRow('conduit-fill') && bidRow('conduit-fill').verdict === 'ok'),
          action: { label: 'Open it', run: openBidCheck } },
        { id: 'straps', title: 'A support row of your own', kind: 'do',
          rulesExempt: 'no rulebook entry: NEC 358.30 EMT support (the card says the rulebook has no strap row yet)',
          body: 'EMT is fastened within 3 ft of every box and every 10 ft along the run (NEC 358.30). The rulebook has no strap row for conduit yet, so write one.\n1. Click the pencil beside 0.75in EMT.\n2. Under [[Child counts]], add a row: Strap, 1 per 10 ft.\n3. Click [[Done]].',
          target: () => T().ladder('#childCountsGroup', T().pencilOf('lineType', lineType(RE.emt75)), '#lineTypesSectionTitle'),
          check: () => K().someLineType(RE.emt75, (lt) => (lt.childCounts || []).some((ch) => ch.per === 'ft')),
          action: { label: 'Add Strap · 1 per 10 ft', run: () => { const lt = makeEmt(); if ((lt.childCounts || []).length) return; App.pushUndoSnapshot(); lt.childCounts = [{ name: 'Strap', qty: 1, per: 'ft', ftInterval: 10 }]; K().dirty(); } } },
        { id: 'read', title: 'What the drawing knows now', kind: 'read',
          body: '1. In the left sidebar, look at SUMMARY.\nFeet of 0.75in EMT with the four verticals inside, the straps under it, and the derived rows: #12 THHN by the foot, the green ground its own row. Wire is never a mark. Delete a run and its wire goes with it.',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'A raceway that knows its conductors, a chain that wrote its own verticals, fill judged, straps counted.\nNext: [[Learn]] → Chapter 5, the circuit.',
    },
    // 5 ----------------------------------------------------------------------------------------
    {
      id: 'circuits', title: 'Chapter 5: The circuit, the homerun and the drop', short: 'a circuit that checks itself', minutes: 12, page: E101, noun: 'chapter', set: ESET,
      intro: 'A group with a panel and a number is a circuit. The homerun reaches the panel, the app walks the runs to the farthest device, and the voltage-drop row says whether the engineer\'s #12 is enough.',
      seed() { scaleE101(); setCeiling(); markMissing(pick('gfci'), pts(G.gfci), E101); chainWestWall(); markMissing(pick('panel'), pts(G.panel), E101); },
      steps: [
        { id: 'group', title: 'Make it a circuit', kind: 'do',
          body: 'The chain on the west wall is circuit 1 on LP-1.\n1. In the header, click the gear ([[Project Settings]]) and turn on [[Use groups]] if it is off.\n2. In the left sidebar, under GROUPS, click [[+ Add]]. In Name, type Dining receptacles, west wall. In Panel, type LP-1. In Circuit, type 1. Click [[Done]].\n3. Right-click a west-wall receptacle, [[Assign to group]], pick it and click [[Done]]; do the same for the runs, or click the group first next time and everything placed after joins it.',
          target: ['#groupAssignDone', '#groupModalDone', '#groupModalPanel', '#addGroup', '#groupsSectionTitle', '#settingsUseGroupsBtn'],
          check: () => { const g = circuit1(); const a = pageAnn(E101); return !!(g && a && (a.quickLines || []).some((l) => l.group === g.id)); },
          hint: () => (circuit1() ? 'The circuit exists: now put the west-wall receptacles and their runs in it' : ''),
          action: { label: 'Make LP-1 · 1 and assign the west wall', run: circuitOne } },
        { id: 'homerun', title: 'The homerun', kind: 'do', cardAt: 'br', page: E101, zones: () => traceZones(RE.hr, pts(G.homerun1), E101),
          body: 'The arrow at the top receptacle says LP-1-1: from there the conduit goes up into the ceiling and across to the panel.\n1. Under LINE TYPES, click [[+ Add]]. In Name, type 0.75in EMT HR and click [[Create Line Type]].\n2. Click the pencil beside it: set the same raceway and conductors as 0.75in EMT, and turn on [[Homerun]].\n3. Under GROUPS, click the circuit, so the run you draw joins it. With the type active, click [[Polyline]] and trace: the top receptacle, straight up to the north wall, along it to above STORAGE, and down to LP-1. Press Enter.',
          target: () => T().ladder('#lineTypeHomerunBtn', '#polylineBtn', '#polylineBtnSidebar', '#lineTypeCreate', '#addLineType', T().pencilOf('lineType', lineType(RE.hr))),
          check: () => (S().lineTypes || []).some((l) => l.homerun) && allDone(traceZones(RE.hr, pts(G.homerun1), E101)),
          hint: () => { const lt = lineType(RE.hr); return lt && !lt.homerun ? 'The type exists: open its details and turn on Homerun' : ''; },
          action: { label: 'Trace it for me', run: () => { const lt = makeHomerun(); if (!polylinesOn(RE.hr, E101).length) tracePlan(lt, G.homerun1, 'Homerun, circuit 1', E101); const g = circuitOne(); void g; } } },
        { id: 'panelpoles', title: 'The panel knows its schedule', kind: 'do',
          // the chapter's own Panelboard came with 42 poles (TAGS), which passed this step on arrival
          onEnter: () => { const c = counter(RE.panel); if (c && c.lesson && c.poles === 42) { delete c.poles; App.updateUI(); } },
          body: 'Bid Check can compare the circuits you draw against the panel\'s schedule once the panel counter knows how many poles it has.\n1. In the sidebar, click the pencil beside the panel counter: Panelboard LP-1, or your own panel counter if the chapter used it.\n2. Panel name reads LP-1 off the plan\'s tag when the chapter made the counter; type LP-1 if it is blank. In Poles, type 42. Click [[Done]].',
          target: () => T().ladder('#panelPoles', '#panelName', '#counterLineTypeDetailsModal .modal-card', T().pencilOf('counter', counter(RE.panel)), '#countersSection'),
          check: () => { const c = counter(RE.panel); return !!(c && c.panelName && c.poles === 42); },
          action: { label: 'Set LP-1 · 42 poles', run: () => { const c = pick('panel'); App.pushUndoSnapshot(); c.panelName = 'LP-1'; c.poles = 42; K().dirty(); } } },
        { id: 'vd', title: 'What the voltage-drop row says', kind: 'do',
          rules: ['elec.voltage-drop.branch-limit', 'elec.voltage-drop.k-constant'],
          onEnter: () => T().foldBidCheck(), hold: true, body: '1. In the left sidebar, click BID CHECK to expand it.\nVoltage drop within 3% to the farthest device: the app walked the homerun and the chain to the receptacle farthest from LP-1, assumed 12 A on the circuit, and warns, naming the gauge that would pass. The Code recommends no more than 3% on a branch circuit (NEC 210.19, informational note), and the rulebook chip carries the K constant it used.\nIs the engineer wrong?',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false && !!bidRow('voltage-drop') && bidRow('voltage-drop').verdict !== 'na',
          hint: () => { const r = bidRow('voltage-drop'); return S().bidCheckCollapsed === false && r && r.verdict === 'na' ? 'Not judged yet. ' + r.detail + ' Right-click the homerun and a west-wall receptacle, Assign to group, and pick the circuit' : ''; },
          action: { label: 'Open it', run: openBidCheck } },
        { id: 'load', title: 'The load the engineer scheduled', kind: 'do',
          rules: ['elec.voltage-drop.branch-limit'],
          body: 'Not yet. The app assumed 12 A because you did not say. E-501 schedules circuit 1 at 720 VA, which is 6 A at 120 V.\n1. Under GROUPS, click the pencil beside the circuit.\n2. In Load, type 6. Click [[Done]].\nThe row turns to a tick: at 6 A the drop is under 3% on #12. When the schedule gives a load, use it; when it does not, the default is the honest warning.',
          target: ['#groupModalLoadAmps', '#groupModalDone', '#groupsSectionTitle', '#groupsList .edit-btn'],
          check: () => { const g = circuit1(); return !!(g && g.loadAmps === 6 && bidRow('voltage-drop') && bidRow('voltage-drop').verdict === 'ok'); },
          hint: () => { const g = circuit1(); return g && g.loadAmps && g.loadAmps !== 6 ? 'Read circuit 1 on E-501: 720 VA at 120 V' : ''; },
          action: { label: 'Set 6 A', run: () => { const g = circuitOne(); App.pushUndoSnapshot(); g.loadAmps = 6; K().dirty(); } } },
        { id: 'cross', title: 'Circuits against the schedule', kind: 'read',
          body: 'Two more rows woke up. Circuits on plan match the panel schedule reads one circuit on plan against forty-two poles, and stays open until every circuit is drawn: it is the row that says you are not finished. Every device on a circuit and reached by a run names the receptacles you counted in Chapter 2 that no run has reached yet.\nNeither blocks the export. Both are the app saying what it knows.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => true },
      ],
      done: 'A circuit with its homerun, a panel that knows its schedule, and a voltage-drop warning you understood and answered.\nNext: [[Learn]] → Chapter 6, the equipment.',
    },
    // 6 ----------------------------------------------------------------------------------------
    {
      id: 'equipment', title: 'Chapter 6: The equipment', short: 'the hard-wired half', minutes: 8, page: E101, noun: 'chapter', set: ESET,
      intro: 'Dedicated circuits, two poles and three, the breaker the hood trips, and the disconnect that must be in sight of the unit.',
      seed() { scaleE101(); markMissing(pick('jbox'), pts(G.jbox), E101); },
      steps: [
        { id: 'three', title: 'Which equipment is three phase?', kind: 'do', cardAt: 'tl',
          body: 'Six J-boxes, six circuits on the schedule. One of them takes three poles.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click that J-box, write what it feeds, and click [[Done]].',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => notesNear(pts(G.rtu)[0], 26, E101).length > 0,
          hint: () => { const a = pageAnn(E101); if (!a || !(a.notes || []).length) return ''; return pts(G.jbox).some((pt) => notesNear(pt, 26, E101).length) ? 'That one is single phase: one or two circuit numbers beside it. Look for three' : 'Put the note on the J-box itself'; },
          action: { label: 'Note RTU-1 for me', run: () => { K().goPage(E101); const page = S().pages[E101]; const a = App.ensureActiveCanvas(page).annotations; if (!a.notes) a.notes = []; const spot = pts(G.rtu)[0]; if (a.notes.some((n) => K().near(n, spot, 26))) return; App.pushUndoSnapshotCurrentPage(); a.notes.push({ x: spot.x, y: spot.y, text: 'RTU-1 on the roof: 208 V three phase, circuits 18, 20, 22', id: App.uid(), width: 150, fontSize: 14, placementRotation: page.rotation ?? 0, color: '#e8c547' }); S().tool = App.TOOL.NONE; K().dirty(); } } },
        { id: 'poles', title: 'Poles', kind: 'read', cardAt: 'tl',
          rulesExempt: 'no rulebook entry: NEC 440.14 disconnect within sight',
          body: 'RTU-1, the rooftop unit, on 18, 20 and 22: three poles, 208 V three phase, a 40 A breaker and #8 wire. The dishwasher takes two poles, 208 V single phase. Everything else is one pole at 120 V.\nWhy give a building three phase at all?',
          reveal: 'Motors. A three-phase motor is smaller, cheaper and smoother than a single-phase one of the same power, so rooftop units, walk-in compressors and exhaust fans want it, and a 208Y/120 V service gives 120 V to the receptacles from any phase to neutral at the same time. The one-line on E-601 says it: 208Y/120V, 3Φ, 4W.\nOn the bid a three-pole circuit is three conductors and a ground in the conduit, a three-pole breaker, and a disconnect within sight of the unit (NEC 440.14), on the roof.',
          target: [], check: () => true },
        { id: 'hood', title: 'The breaker the hood trips', kind: 'do', cardAt: 'bl',
          rulesExempt: 'no rulebook entry: NFPA 96 shunt trip on hood suppression',
          body: 'Circuit 12 feeds the receptacles under the hood, and the keynote says it is on a shunt-trip breaker interlocked with the hood suppression. When the hood\'s system fires, that breaker opens and the appliances lose power (NFPA 96). The plumbing course met the same rule on the gas.\nThe schedule says shunt trip; nothing says who wires the interlock.\n1. Press N and click beside the cook line receptacles.\n2. Type RFI: and the question: who furnishes the shunt-trip breaker and wires it to the hood suppression? Click [[Done]].',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => notesNear(pts(G.hood)[0], 60, E101).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))),
          hint: () => { const a = pageAnn(E101); return a && (a.notes || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))) ? 'Move it beside the cook line receptacles, under HOOD ABOVE' : ''; },
          action: { label: 'Flag it for me', run: () => { K().goPage(E101); const page = S().pages[E101]; const a = App.ensureActiveCanvas(page).annotations; if (!a.notes) a.notes = []; const spot = pts(G.hood)[0]; if (a.notes.some((n) => /^\s*RFI/i.test(n.text) && K().near(n, spot, 60))) return; App.pushUndoSnapshotCurrentPage(); a.notes.push({ x: spot.x, y: spot.y, text: 'RFI: Who furnishes the shunt-trip breaker on circuit 12 and wires it to the hood suppression?', id: App.uid(), width: 150, fontSize: 14, placementRotation: page.rotation ?? 0, color: '#e85447' }); S().tool = App.TOOL.NONE; K().dirty(); } } },
        { id: 'dedicated', title: 'One circuit each', kind: 'read',
          rulesExempt: 'no rulebook entry: NEC 210.23 circuits for fixed equipment',
          body: 'The dishwasher, the pump, the fan, the ice machine, the heater\'s controls and the rooftop unit each have a circuit to themselves.\nWhy not share?',
          reveal: 'A fixed appliance on its own branch circuit cannot be tripped by anything else (NEC 210.23 limits what shares a circuit with fixed equipment), and a kitchen that loses its dishwasher because someone plugged in a toaster is a kitchen that calls the electrician. Each dedicated circuit is a breaker, a homerun the whole way back to the panel, and a disconnect or a cord-and-plug at the unit.\nOn the bid that homerun is the cost: six pieces of equipment, six runs to LP-1, and the app\'s homerun flag keeps them apart from the device-to-device conduit in the report.',
          target: [], check: () => true },
      ],
      done: 'Three poles, two poles, one; the breaker the hood trips flagged; six homeruns you know are there.\nNext: [[Learn]] → Chapter 7, the service.',
    },
    // 7 ----------------------------------------------------------------------------------------
    {
      id: 'service', title: 'Chapter 7: The service and the one-line', short: 'from the street to the panel', minutes: 8, page: E601, noun: 'chapter', set: ESET,
      intro: 'The one-line from the utility to LP-1: why 200 A, why 3/0 copper, why #6 for the ground, and a feeder traced and judged for fill.',
      seed() { scaleE101(); markMissing(pick('panel'), pts(G.panel), E101); },
      steps: [
        { id: 'read', title: 'Read the one-line', kind: 'read', cardAt: 'br',
          rulesExempt: 'no rulebook entry: NEC 310.16, 250.122, 250.66, Article 220 feeder, grounding and service load',
          body: 'E-601 is one line from the utility transformer to LP-1: the service lateral, the meter, the main disconnect, the feeder, the panel, and the ground.\nThe feeder is 4 #3/0 copper and a #6 ground in 2" conduit. Why those sizes?',
          reveal: 'The main is 200 A, so the feeder must carry 200 A: #3/0 copper THHN is rated 200 A at the 75 °C column the terminals allow (NEC 310.16). Four of them: three phases and a neutral. The equipment ground rides with them and is sized from the breaker, #6 copper for 200 A (NEC 250.122). The grounding electrode conductor to the water pipe and the rods is #4 (250.66).\nThe 200 A itself is the engineer\'s load calculation (NEC Article 220): 22 kVA connected, 62 A, and the kitchen\'s future. Nobody sizes a restaurant service to today\'s load.',
          target: [], check: () => true },
        { id: 'feeder', title: 'Trace the feeder', kind: 'do', cardAt: 'br', page: E101, zones: () => traceZones(RE.emt2, pts(G.feeder), E101),
          body: 'On E-101 the feeder is the heavy line from the main disconnect outside the south wall up to LP-1.\n1. Under PAGES, click E-101.\n2. Under LINE TYPES, make 2in EMT, and in its details set the raceway to EMT 2" and the conductors to 4 #3/0 THHN + 1 #6 G.\n3. With it active, click [[Polyline]], click the two circled ends, and press Enter.',
          target: () => T().ladder('#polylineBtn', '#polylineBtnSidebar', '#addLineType', '#pagesList', T().pencilOf('lineType', lineType(RE.emt2))),
          check: () => K().someLineType(RE.emt2, (lt) => (lt.conductors || []).length >= 2) && allDone(traceZones(RE.emt2, pts(G.feeder), E101)),
          hint: () => { const lt = lineType(RE.emt2); return lt && !(lt.conductors || []).length ? 'The type exists: give it the conductors, 4 #3/0 THHN + 1 #6 G' : ''; },
          action: { label: 'Trace it for me', run: () => { const lt = makeFeeder(); if (!polylinesOn(RE.emt2, E101).length) tracePlan(lt, G.feeder, 'Feeder', E101); } } },
        { id: 'rise', title: 'The rise', kind: 'do', cardAt: 'br', page: E101, zones: () => guide([pts(G.feeder)[0]], 14, polylinesOn(RE.emt2, E101).some((l) => (l.startDrop || 0) > 0 || (l.endDrop || 0) > 0)),
          body: 'Seven feet on the plan. The main disconnect is at 5 ft on the outside wall and the panel top at 6 ft 6 in inside; the feeder comes through the wall and up. The one-line calls the whole feeder 12 ft.\n1. Click [[Drop]] (or press B), choose or type 5 ft, and click the circled end at the main disconnect.',
          target: ['#dropPanel', '#dropBtn'], check: () => polylinesOn(RE.emt2, E101).some((l) => (l.startDrop || 0) > 0 || (l.endDrop || 0) > 0),
          action: { label: 'Add the 5 ft rise for me', run: () => { K().goPage(E101); if (!polylinesOn(RE.emt2, E101).length) tracePlan(makeFeeder(), G.feeder, 'Feeder', E101); dropAt(pts(G.feeder)[0], 5, E101); } } },
        { id: 'fill', title: 'Fill on the feeder', kind: 'do',
          rules: ['elec.conduit.fill-limit'],
          onEnter: () => T().foldBidCheck(), hold: true, body: '1. In the left sidebar, click BID CHECK to expand it.\nConduit fill within the table limit now judges the feeder too: four 3/0 and a #6 in 2" EMT, about a third of the raceway, under the 40% the table allows for three or more conductors (NEC Chapter 9, Table 1). Had the engineer written 1-1/2", the row would say so and name the size that fits.',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false && !!(bidRow('conduit-fill') && bidRow('conduit-fill').verdict === 'ok'),
          action: { label: 'Open it', run: openBidCheck } },
        { id: 'gear', title: 'Count the gear', kind: 'do', cardAt: 'br', page: E101, zones: () => circlesOn(E101, counter(RE.meter), [pts(G.meter)[0]], 12).concat(circlesOn(E101, counter(RE.disc), [pts(G.mdp)[0]], 12)),
          body: 'The service is gear the bid carries at a price nothing else on the sheet approaches.\n1. Make a Meter counter (Category Panel, Variant Meter) and click the meter, the M outside the south wall.\n2. Make a Disconnect counter (Category Disconnect, Variant Disconnect) and click the MDP beside it.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#addCounter'], check: () => markNear(counter(RE.meter), pts(G.meter)[0], 12, E101) && markNear(counter(RE.disc), pts(G.mdp)[0], 12, E101),
          action: { label: 'Count them for me', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('meter'), pts(G.meter), E101); markMissing(pick('disc'), pts(G.mdp), E101); K().dirty(); } } },
      ],
      done: 'The service from the street to the panel, a feeder traced with its rise and judged for fill, the gear counted.\nNext: [[Learn]] → Chapter 8, the whole set.',
    },
    // 8 ----------------------------------------------------------------------------------------
    {
      id: 'whole', title: 'Chapter 8: The whole set', short: 'the set, finished', minutes: 10, page: E101, noun: 'chapter', set: ESET,
      intro: 'Every device on both plans, the west-wall circuit with its homerun, the feeder: done in one pass, then set beside the reference run by run, then the circuit schedule in the report.',
      seed() { scaleE101(); K().setScale(E201, 9, '1/8" = 1\''); setCeiling(); },
      steps: [
        { id: 'lay', title: 'Finish the takeoff', kind: 'do', cardAt: 'bl',
          body: 'Every receptacle, J-box, fixture and switch on the two plans, the panel, the meter and the main, the west-wall chain and its homerun, the feeder with its rise. Earlier chapters taught each of them; this is all of them on the sheets, by hand.\n1. Count and trace until the status line stops naming what is missing.\nTo have the app lay it all instead, click [[Show me where]] and then its button; Skip this step moves on with the sheets as they are, and the next card compares them against the reference.',
          target: ['#annCanvas'], check: takeoffComplete, hint: takeoffHint,
          action: { label: 'Finish the takeoff for me', run: layEverything } },
        { id: 'compare', title: 'Against the reference', kind: 'read', cardAt: 'tl',
          body: compareBody,
          target: [], check: () => true },
        { id: 'report', title: 'The circuit schedule', kind: 'read',
          body: '1. Under EXPORT OPTIONS, click [[Show Report]] (it appears once the sheets carry a mark).\nBesides the counts and the feet by type, an electrical project\'s report carries a Circuit schedule: each circuit with its devices, its conduit and homerun feet, its wire by gauge, and the farthest device from the panel. It is the estimator\'s copy of E-501, built from what was drawn.',
          target: ['#printReport', '#exportOptionsSectionTitle'], check: () => true },
        { id: 'legend', title: 'The legend on the sheet', kind: 'do', hold: true,
          body: '1. In the left sidebar, click the SUMMARY heading.\nOn an electrical project the on-sheet legend draws as a compact ruled block, the way an E-sheet draws its own, with a mount-height column and the panel in its footer.',
          target: ['#legendSettingsModal .modal-card', '#summarySectionTitle'], check: () => K().modalUp('legendSettingsModal'),
          action: { label: 'Open Summary Legend', run: () => { if (App.openLegendSettingsModal) App.openLegendSettingsModal(); } } },
      ],
      done: 'The whole set, counted and traced, checked against the reference, and a circuit schedule the app wrote.\nNext: [[Learn]] → Chapter 9, the bid.',
    },
    // 9 ----------------------------------------------------------------------------------------
    {
      id: 'bid', title: 'Chapter 9: Check it, prove it, hand it off', short: 'a bid you can defend', minutes: 8, page: E101, noun: 'chapter', set: ESET,
      intro: 'What the electrical rows of Bid Check mean in the trade, which the set already answers, where a number came from, and the hand-off to the electrical bid.',
      seed() { scaleE101(); setCeiling(); markMissing(pick('gfci'), pts(G.gfci), E101); chainWestWall(); markMissing(pick('panel'), pts(G.panel), E101); const g = circuitOne(); g.loadAmps = 6; if (!polylinesOn(RE.hr, E101).length) tracePlan(makeHomerun(), G.homerun1, 'Homerun, circuit 1', E101); circuitOne(); },
      steps: [
        { id: 'open', title: 'Open Bid Check', kind: 'do',
          onEnter: () => T().foldBidCheck(), hold: true, body: '1. In the left sidebar, click BID CHECK to expand it.\nFour rows marked AUTO the app judges from your runs: conduit fill, voltage drop, circuits against the panel schedule, every device on a circuit. The rest are yours.',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false, action: { label: 'Open it', run: openBidCheck } },
        { id: 'rows', title: 'What the manual rows mean', kind: 'read',
          rulesExempt: 'no rulebook entry: NEC 358.26 bends between pull points',
          body: 'The manual rows read: fire alarm devices at rated corridors and doors, lighting controls meet the energy code, equipment connections coordinated with HVAC and plumbing, temporary power and lighting included, pull points within 360° of bends on every run.\nWhich of them did this set already answer?',
          reveal: 'Two on paper: the occupancy sensors on E-201 are the energy code row, and the J-boxes at the dishwasher, the pump, the fan, the heater and RTU-1 are the coordination row, each of them a piece of equipment the plumbing and mechanical sets own. Fire alarm is not on this set at all, which is itself an answer: an RFI, or an exclusion in the bid. Temporary power is never on a drawing. Pull points are yours: a run with more than 360° of bends between boxes needs a pull point (NEC 358.26), and the plan cannot show the bends the electrician will make.\nYou tick each one when you have READ the answer.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => true },
        { id: 'tick', title: 'Sign what you have read', kind: 'do',
          body: '1. In BID CHECK, click the words Scale verified on every counted sheet.\n2. Click Lighting controls meet the energy code.\n3. Click Equipment connections coordinated with HVAC and plumbing.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => manual('scale-verified') && manual('lighting-controls') && manual('equipment-connections'),
          action: { label: 'Tick the three for me', run: () => { tick('scale-verified'); tick('lighting-controls'); tick('equipment-connections'); } } },
        { id: 'proof', title: 'Where did that number come from?', kind: 'do', hold: true,
          body: '1. In the left sidebar, under SUMMARY, click the GFCI total.\nThe breakdown shows the count sheet by sheet with a thumbnail of where every mark sits. This is what you open when the GC questions the number.',
          target: () => T().ladder('#summaryCountDetailModal .modal-card', T().summaryRowOf('counter', counter(RE.gfci)), '#summarySectionTitle'), check: () => K().modalUp('summaryCountDetailModal'),
          action: { label: 'Open the breakdown', run: () => { const c = counter(RE.gfci); if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); } } },
        { id: 'handoff', title: 'Hand it off', kind: 'read',
          body: '1. [[Open in TakeoffTooling]] hands the devices, runs, verticals, wire and cable to the electrical pricing app, where each device explodes into its box, ring, plate and connectors and every row picks up labor from your book.\n2. [[Copy RFI Flags]] puts the shunt-trip question beside it.\n3. [[Export PDFs]] makes the marked-up set.\nMore: [Doing an electrical takeoff](/guides/electrical-takeoff/).',
          target: ['#forTakeoffTooling', '#exportOptionsSectionTitle'], check: () => true },
      ],
      done: 'That is the course: a restaurant\'s power read off the engineer\'s set, counted with the app, checked against the tables, and handed to the bid.\nWhen you are ready for a real set, click [[Upload PDF]].',
    },
  ];

  // ----- progress, the menu section, the doors -----------------------------------------------------
  function courseDone() { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}') || {}; } catch (_) { return {}; } }
  function markDone(id) { try { const d = courseDone(); d[key(id)] = new Date().toISOString(); localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (_) { /* private mode: the tick is a convenience */ } }
  const suggested = () => { const d = courseDone(); return (CHAPTERS.find((c) => !d[key(c.id)]) || {}).id || null; };

  CHAPTERS.forEach((chapter, idx) => {
    const next = CHAPTERS[idx + 1];
    App.registerTour(tourId(chapter.id), {
      steps: [K().openStep(chapter)].concat(chapter.steps, [K().doneStep(chapter, chapter.done)]),
      doneKey: null,
      onStop(finished) {
        K().restoreDevice();
        if (!finished) return;
        markDone(chapter.id);
        App.openLearnMenu(undefined, { course: COURSE, chapter: next ? next.id : null });
      },
    });
  });

  function startChapter(id) {
    if (!CHAPTERS.some((c) => c.id === id)) return false;
    if (App.hideModal) App.hideModal('learnModal');
    K().beginTeaching();
    return App.startTutorial(tourId(id));
  }
  function renderCourseList(nextId) {
    const list = el('learnCourseList-' + COURSE);
    if (!list) return;
    const done = courseDone();
    const lit = nextId === undefined ? suggested() : nextId;
    const count = CHAPTERS.filter((c) => done[key(c.id)]).length;
    const esc = App.escapeHtml || ((t) => String(t));
    list.innerHTML = CHAPTERS.map((c, i) => '<button type="button" class="learn-row' + (done[key(c.id)] ? ' learn-row-done' : '') + (c.id === lit ? ' learn-row-next' : '') + '" data-chapter="' + c.id + '">'
      + '<span class="learn-row-no">' + (done[key(c.id)] ? '✓' : (i + 1)) + '</span>'
      + '<span class="learn-row-text"><span class="learn-row-title">' + esc(c.title.replace(/^Chapter \d+: /, '')) + '</span><span class="learn-row-sub">' + esc(c.intro) + '</span></span>'
      + '<span class="learn-row-min">' + c.minutes + ' min</span></button>').join('');
    const prog = el('learnCourseProgress-' + COURSE);
    if (prog) prog.textContent = count === CHAPTERS.length ? 'All ' + CHAPTERS.length + ' chapters done' : count + ' of ' + CHAPTERS.length + ' done';
    list.querySelectorAll('.learn-row').forEach((row) => { row.onclick = () => startChapter(row.dataset.chapter); });
  }
  const openAtCourse = () => App.openLearnMenu(undefined, { course: COURSE, chapter: suggested() });

  // wiring (static DOM)
  el('canvasEmptyHintCourseElectrical') && (el('canvasEmptyHintCourseElectrical').onclick = (e) => { e.preventDefault(); openAtCourse(); });
  el('settingsCourseElectrical') && (el('settingsCourseElectrical').onclick = () => { App.hideModal('settingsModal'); openAtCourse(); });
  try {
    const params = new URLSearchParams(location.search);
    const chapter = String(params.get('chapter') || '');
    const want = chapter.startsWith(COURSE + ':') ? chapter.slice(COURSE.length + 1) : null;
    if (want && CHAPTERS.some((c) => c.id === want)) {
      App.setTutorialPending(true);
      setTimeout(() => { App.setTutorialPending(false); startChapter(want); }, 600);
    } else if (params.get('course') === COURSE) {
      App.setTutorialPending(true);
      setTimeout(() => { App.setTutorialPending(false); openAtCourse(); }, 600);
    }
  } catch (_) { App.setTutorialPending && App.setTutorialPending(false); }

  (App.courseSections = App.courseSections || []).push({ id: COURSE, render: renderCourseList });
  App.startChapterElectrical = startChapter;
  App.courseElectricalIds = () => CHAPTERS.map((c) => c.id);
  App.courseElectricalReference = () => ({ feet: RUNS.reduce((o, r) => { o[r.name] = r.feet(); return o; }, {}), counts: COUNTS().map((c) => [c[3], c[1].length]) });
})();
