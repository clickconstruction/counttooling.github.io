/*
 * features/course-plumbing.js - the plumbing course: how a restaurant gets its plumbing,
 * taught on the engineered sample plan with the app's own tools. Nine chapters on the
 * tour engine (features/tutorial.js), each the length of a lesson, resumable, ticked on
 * the device. Plan of record: journeys/plans/PLUMBING-COURSE.md.
 *
 * The teaching mode: the engineer's drawing is the answer key, and the reader answers
 * with a click. Work on the sheet is asked for inside the engine's on-sheet TARGETS
 * (circles, a boundary; `zones` + `page` on a step, the check counting only inside them)
 * exactly as the lessons do, with one deliberate exception: a QUESTION step draws no
 * target, because a circle on the answer would be the answer. Those steps say what to
 * find, refuse the wrong click and say why, and "Show me where" has only the sheet. A question about the sheet is a doing step whose check only passes on
 * the right thing ("put a note on a fixture whose waste must never enter the interceptor":
 * the check wants the note beside a water closet, a lavatory or the mop sink, and the hint
 * says why a hand sink was the wrong one). The explanation then opens the next card. Where
 * nothing on the sheet can be clicked for an answer (what a P-sheet is, why a loop), the
 * step is a reading step with `reveal`, the answer behind "Show the engineer's answer".
 *
 * The course runs on the lesson set (samples/sample-lessons.pdf: P-101 the restaurant
 * plumbing plan with its water, hot water return, gas, waste and grease lines, P-401 the
 * restrooms enlarged with a TYP. OF 4 detail, P-501 the fixture schedule with its fixture
 * units, scanned sideways, and P-601 the restrooms' waste and vent riser at 1/4"). It reads
 * everything a lesson has, geometry, readers, seeding and marking, from App.lessonKit
 * (features/lessons.js) at call time. A chapter STANDS ALONE like a lesson: its first step
 * opens the sheets fresh and seeds what earlier chapters produced. Palette items carry
 * `lesson: true` and are swept before the next chapter or lesson; counters the schedule
 * reader makes are stamped the same way.
 *
 * The coaching keeps the rulebook's line: as the app applies it, cited by section, never
 * the code reprinted, never company practice. A reason the sheet does not show and no
 * section covers is written as practice, not as a rule. Bodies are lines, one action per
 * "1. …" line, controls in double square brackets (teaching-labels.test.js proves each
 * exists; that test reads every double bracket in this file, so point lists here are FLAT),
 * no em dashes. A count step's hint names what is still missing, by room.
 *
 * The last two chapters finish the sheet: "Finish the takeoff for me" lays the whole
 * reference takeoff (every fixture, every run), and a compare step (a body that is a
 * FUNCTION, rendered live) sets the reader's quantities beside the reference's, run by run.
 *
 * Progress is per device: localStorage `clickcount-course-done`, { 'plumbing:<id>': ISO }.
 * Doors: the Learn menu's course section (#learnCourseList), the empty-canvas
 * "plumbing course" link, Project Settings → Help → "plumbing course", /app/?course=plumbing
 * (the menu, at the course) and /app/?chapter=plumbing:<id>.
 *
 * Registrations: renderCourseList(nextId), startChapter(id), courseChapterIds(), courseDone(),
 * courseReference() (the reference quantities, for the spec).
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const COURSE = 'plumbing';
  const DONE_KEY = 'clickcount-course-done';
  const K = () => App.lessonKit;
  const T = () => App.tourKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tourId = (id) => 'course:' + COURSE + ':' + id;
  const key = (id) => COURSE + ':' + id;

  // ----- the sheets, in PDF points -----------------------------------------------------------
  // P-101's drawing sits at (60 + 0.75·x, 70 + 0.75·y) of its SVG figure at 12 px/ft; K().P
  // converts a plan point. P-601 is drawn straight in sheet points at 18 pt/ft. Point lists
  // are FLAT (x, y, x, y…), see the header.
  const P = (x, y) => K().P(x, y);
  const G = {   // P-101, plan px
    dim318: [560, 84, 940, 84],                                       // the 31'-8" string over the kitchen half
    cwService: [883, 614, 883, 594, 192, 594],                        // the 2" service: up through the slab, west along the south wall to the bar
    cwTrunk: [564, 594, 564, 110, 930, 110, 930, 402],                // the 1-1/2" cold trunk: up the west walls, along the top, down the east
    hwSupply: [786, 590, 570, 590, 570, 105, 936, 105],               // the 1-1/4" hot supply beside it, from the heater
    hwReturn: [936, 105, 936, 572, 918, 572],                         // the 3/4" hot water RETURN, down the east wall to the pump
    ssRun: [592, 210, 940, 210, 1060, 210, 1060, 537],                // the 4" sanitary line: under the restrooms, out the east wall, down to the sewer
    gwAisle: [596, 436, 900, 436, 900, 537, 940, 537],                // the 3" grease line: the kitchen work aisle to the interceptor
    gwBack: [222, 544, 440, 544, 440, 512, 900, 512],                 // the 3" grease line: the bar and the back rooms
    cleanouts: [592, 210, 596, 436, 222, 544, 1060, 210],
    vtrs: [700, 232, 700, 500],
    gasDrops: [724, 346, 774, 346, 812, 346, 838, 346],
    bar3cs: [197, 570], dish3cs: [605, 486], prepFs: [640, 346], dishFs: [668, 550],
    hb: [949, 490], rpz: [833, 591], hoodValve: [840, 390],
  };
  const R = {   // P-601, sheet points
    prove: [110, 268, 110, 520], stack: [520, 556, 520, 250], lavArm: [520, 493, 592, 493], co: [534, 540],
  };
  const pts = (flat) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push(P(flat[i], flat[i + 1])); return out; };
  const raw = (flat) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] }); return out; };
  const planFeet = (flat) => { let px = 0; for (let i = 2; i + 1 < flat.length; i += 2) px += Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]); return px / 12; };
  const SCHEDULE_BOX = { x1: 110, y1: 130, x2: 930, y2: 330 };       // P-501 turned upright: the table, in the page's own points
  const WC1_ROW = { x1: 112, y1: 160, x2: 930, y2: 178 };

  // ----- readers ---------------------------------------------------------------------------
  const counter = (re) => K().counterNamed(re);
  const lineType = (re) => K().lineTypeNamed(re);
  const marks = (re) => K().marksOf(counter(re));
  const pageAnn = (i) => K().pageAnn(i == null ? K().P101 : i);
  const ann = () => pageAnn(K().P101);
  const polylinesOn = (re, pageIdx) => { const a = pageAnn(pageIdx); const lt = lineType(re); return a && lt ? (a.polylines || []).filter((pl) => pl.lineTypeId === lt.id) : []; };
  const notesNear = (spot, d) => { const a = ann(); return a ? (a.notes || []).filter((n) => K().near(n, spot, d)) : []; };
  const anyRfi = () => (S().pages || []).some((p) => (p.canvases || []).some((cv) => ((cv.annotations && cv.annotations.notes) || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || '')))));
  const rotationOf = (i) => ((S().pages[i] || {}).rotation || 0);
  const markNear = (re, spot, d) => { const c = counter(re); const a = ann(); return !!(c && a && (a.counterMarkers[c.id] || []).some((m) => K().near(m, spot, d))); };
  const markCountNear = (re, spots, d) => { const c = counter(re); const a = ann(); if (!c || !a) return 0; const ms = a.counterMarkers[c.id] || []; return spots.filter((pt) => ms.some((m) => K().near(m, pt, d))).length; };
  // "2 more: the mop room, the bar": the spots a count step still wants, by name.
  const missing = (re, spots, labels, d) => { const c = counter(re); const a = ann(); const ms = (c && a && a.counterMarkers[c.id]) || []; const out = []; spots.forEach((pt, i) => { if (!ms.some((m) => K().near(m, pt, d || 6))) out.push(labels[i]); }); return out.length ? out.length + ' more: ' + out.join(', ') : ''; };
  // ----- on-sheet targets (the engine's, features/tutorial.js) ---------------------------------
  const ZR = 16;   // a circle on a fixture, in sheet points (a couple of feet of plan)
  const circlesOn = (pageIdx, re, spots, r) => T().markZones(pageIdx, (counter(re) || {}).id || '__none__', spots, r || ZR);
  const guide = (spots, r, done) => spots.map((p) => ({ kind: 'circle', x: p.x, y: p.y, r, done: !!done }));
  const runsOn = (re, pageIdx) => { const lt = lineType(re); const pls = polylinesOn(re, pageIdx).map((pl) => pl.points || []); const d = S().drawingPolyline; return d && d.points && lt && d.lineTypeId === lt.id ? pls.concat([d.points]) : pls; };
  const traceZones = (re, spots, pageIdx) => T().pathZones(spots, 15, runsOn(re, pageIdx));
  const allDone = (zs) => T().allDone(zs);
  const rectsOf = (pageIdx, key, test) => { const a = pageAnn(pageIdx); return ((a && a[key]) || []).filter((z) => !test || test(z)); };
  const DETAIL_INNER = () => K().DETAIL.box, DETAIL_OUTER = () => T().grow(K().DETAIL.box, 40);
  // Several counters on one step: "FD-1 2 more: MEN, the mop room · L-1 1 more: WOMEN".
  const row = (tag, re, spots, labels) => ({ tag, re, spots, labels });
  const hintFor = (rows) => rows.map((r) => { const m = missing(r.re, r.spots, r.labels, 8); return m ? r.tag + ' ' + m : ''; }).filter(Boolean).join(' · ');

  // ----- the schedule's counters -------------------------------------------------------------
  const RE = {
    wc: /^wc-?1\b|water closet|toilet/i, lav: /^l-?1\b|lavator/i, hs: /^hs-?1\b|hand sink/i, tcs: /^3cs-?1\b|3-comp|compartment/i,
    ms: /^ms-?1\b|mop sink/i, fd: /^fd-?1\b|floor drain/i, fs: /^fs-?1\b|floor sink/i, hb: /^hb\b|hose bibb/i, rpz: /rpz|backflow/i,
    co: /^co\b|cleanout/i, vtr: /^vtr\b|vent through/i, gasDrop: /gas drop/i,
    copper2: /\b2\s*in.*copper/i, copper15: /1\.5\s*in.*copper|1-1\/2.*copper/i, copper125: /1\.25\s*in.*copper|1-1\/4.*copper/i,
    copper75cw: /0?\.75\s*in.*copper(?!.*hwr)|3\/4.*copper(?!.*hwr)/i, hwr: /hwr|return/i, copperAny: /copper/i,
    pvc4: /\b4\s*in.*pvc/i, pvc3: /\b3\s*in.*pvc/i, gas: /\bbi\b|black iron|steel/i,
  };
  // A counter the reader made by hand (or the schedule reader made) under the same tag is
  // reused, never duplicated; the rest are made for them, marked as the chapter's.
  const TAGS = {
    wc: [RE.wc, 'WC-1 Water Closet', 'Toilet', '#4a9eff'], lav: [RE.lav, 'L-1 Lavatory', 'Mounted Sink', '#e8c547'],
    hs: [RE.hs, 'HS-1 Hand Sink', 'Mounted Sink', '#47c88e'], tcs: [RE.tcs, '3CS-1 3-Compartment Sink', 'Mounted Sink', '#c8963a'],
    ms: [RE.ms, 'MS-1 Mop Sink', 'Mounted Sink', '#8a4bb0'], fd: [RE.fd, 'FD-1 Floor Drain', 'Floor Drain', '#e85447'],
    fs: [RE.fs, 'FS-1 Floor Sink', 'Floor Drain', '#2e86de'], hb: [RE.hb, 'HB Hose Bibb', 'Floor Drain', '#47c88e'],
    rpz: [RE.rpz, 'RPZ Backflow Preventer', 'Floor Drain', '#e85447'], co: [RE.co, 'CO Cleanout', 'Floor Drain', '#2e86de'],
    vtr: [RE.vtr, 'VTR Vent Through Roof', 'Floor Drain', '#e8c547'], gasDrop: [RE.gasDrop, 'Gas Drop w/ Shutoff', 'Floor Drain', '#c8963a'],
  };
  const pick = (tag) => { const t = TAGS[tag]; return counter(t[0]) || K().makeCounter(t[1], t[2], t[3]); };
  // Marks a counter at the spots it does not yet cover (the seam run twice adds nothing).
  function markMissing(c, spots, pageIdx) {
    const i = pageIdx == null ? K().P101 : pageIdx;
    const a = App.ensureActiveCanvas(S().pages[i]).annotations;
    const have = (a.counterMarkers[c.id] || []);
    const todo = spots.filter((pt) => !have.some((m) => K().near(m, pt, 4)));
    if (todo.length) K().mark(i, c, todo);
    return todo.length;
  }
  const SPOTS = () => { const k = K(); return {
    wc: k.WCS, lav: k.LAVS, ms: [k.MOP], hs: k.HAND_SINKS,
    fdRestrooms: [k.FD.men, k.FD.women, k.FD.mop], fdRest: [k.FD.bar1, k.FD.bar2, k.FD.kitchen1, k.FD.kitchen2, k.FD.kitchen3, k.FD.dish, k.FD.storage],
    tcs: pts(G.bar3cs.concat(G.dish3cs)), fs: pts(G.prepFs.concat(G.dishFs)),
    hb: pts(G.hb), rpz: pts(G.rpz), co: pts(G.cleanouts), vtr: pts(G.vtrs), gasDrop: pts(G.gasDrops),
  }; };
  const FD_LABELS = ['MEN', 'WOMEN', 'the mop room', 'the bar (west)', 'the bar (east)', 'the kitchen (west)', 'the kitchen (middle)', 'the kitchen (east)', 'the dish pit', 'storage'];
  const HS_LABELS = ['the bar', 'the cook line', 'the kitchen exit'];
  const CO_LABELS = ['under MEN, the sanitary line\'s start', 'the kitchen aisle\'s start by the door', 'the bar\'s start', 'the turn outside the east wall'];
  const VTR_LABELS = ['the wall between MEN and WOMEN', 'the wall between DISH and STORAGE'];

  // ----- doing things for the reader ---------------------------------------------------------
  function tracePlan(lt, flat, name) { K().goPage(K().P101); S().drawingPolyline = { id: App.uid(), name, color: lt.color, points: pts(flat), closed: false, lineTypeId: lt.id, group: null }; App.settlePolylineDraft(); }
  function traceSheet(lt, flat, name, pageIdx) { K().goPage(pageIdx); S().drawingPolyline = { id: App.uid(), name, color: lt.color, points: raw(flat), closed: false, lineTypeId: lt.id, group: null }; App.settlePolylineDraft(); }
  function enableBends(lt) {
    if (!lt || (lt.bendFittings && lt.bendFittings.enabled)) return;
    App.pushUndoSnapshot();
    const fm = window.FittingModel;
    lt.bendFittings = Object.assign(fm && fm.normalizeBendFittings ? fm.normalizeBendFittings(lt) : { bend45: { name: lt.name + ' 45° elbow', qty: 1 }, bend90: { name: lt.name + ' 90° elbow', qty: 1 }, drop: { name: lt.name + ' 90° elbow', qty: 1 } }, { enabled: true });
    K().dirty();
  }
  function addHangerRule(lt) { if (!lt || (lt.childCounts || []).length) return; App.pushUndoSnapshot(); lt.childCounts = [K().hangerRuleFor(lt)]; K().dirty(); }
  function dropAt(spot, ft) {
    const a = ann(); if (!a) return;
    const nodes = App.collectDropNodes(a, 1) || [];
    let best = null, d = Infinity;
    nodes.forEach((n) => { const dd = Math.hypot(n.x - spot.x, n.y - spot.y); if (dd < d) { d = dd; best = n; } });
    if (!best || !App.applyDropToNode(a, best, ft, 'ft', true)) return;
    App.pushUndoSnapshotCurrentPage();
    App.applyDropToNode(a, best, ft, 'ft');
    App.pushRecentDrop(ft, 'ft');
    K().dirty();
  }
  function tick(id) {
    const s = S();
    s.bidCheck = s.bidCheck || { manual: {} };
    s.bidCheck.manual = s.bidCheck.manual || {};
    if (s.bidCheck.manual[id]) return;
    App.pushUndoSnapshot();
    s.bidCheck.manual[id] = true;
    s.bidCheckCollapsed = false;
    K().dirty();
  }
  const manual = (id) => !!(S().bidCheck && S().bidCheck.manual && S().bidCheck.manual[id]);
  const scaleP101 = () => K().setScale(K().P101, 9, '1/8" = 1\'');
  const uprightSchedule = () => { const p = S().pages[K().P501]; if (p && (p.rotation || 0) !== 90) p.rotation = 90; };
  // The schedule reader, through its own door: the rows inside a box over P-501's table
  // become counters named by tag (features/tag-reader.js), stamped as the chapter's.
  async function readSchedule() {
    const k = K();
    uprightSchedule();
    k.goPage(k.P501);
    if (!App.proposeCountersFromBox) return;
    const before = new Set((S().counters || []).map((c) => c.id));
    App.proposeCountersFromBox(SCHEDULE_BOX);
    for (let i = 0; i < 40 && !k.modalUp('schedulePaletteModal'); i++) await wait(100);
    if (k.modalUp('schedulePaletteModal') && el('schedulePaletteCreate')) { el('schedulePaletteCreate').click(); await wait(100); }
    (S().counters || []).forEach((c) => { if (!before.has(c.id)) c.lesson = true; });
    if (!counter(RE.wc)) { App.pushUndoSnapshot(); ['wc', 'lav', 'hs', 'tcs', 'ms', 'fd', 'fs'].forEach(pick); }   // a scan with no text layer: by hand
    K().dirty();
  }
  async function addWasteLayer() {
    const k = K();
    k.goPage(k.P101);
    const page = S().pages[k.P101];
    if (page.canvases && page.canvases.some((c) => /waste/i.test(c.name || ''))) { const c = page.canvases.find((x) => /waste/i.test(x.name || '')); S().activeCanvasIdByPage[k.P101] = c.id; App.updateUI(); App.renderAnnotations(); return; }
    el('addCanvasBtn').click(); await wait(80);
    if (el('addCanvasModalNew')) el('addCanvasModalNew').click();
    if (el('addCanvasModalName')) el('addCanvasModalName').value = 'Waste';
    if (el('addCanvasModalCreate')) el('addCanvasModalCreate').click();
    await wait(80);
  }
  const onWasteLayer = () => { const k = K(); const page = S().pages[k.P101]; if (!page || !page.canvases || page.canvases.length < 2) return false; const active = S().activeCanvasIdByPage[k.P101]; const c = page.canvases.find((x) => x.id === active); return !!(c && c !== page.canvases[0]); };
  const restroomZones = () => { const s = SPOTS(), p = K().P101; return circlesOn(p, RE.wc, s.wc).concat(circlesOn(p, RE.fd, s.fdRestrooms), circlesOn(p, RE.lav, s.lav), circlesOn(p, RE.ms, s.ms)); };
  const kitchenZones = () => { const s = SPOTS(), p = K().P101; return circlesOn(p, RE.hs, s.hs).concat(circlesOn(p, RE.tcs, s.tcs), circlesOn(p, RE.fd, s.fdRest)); };
  const greaseZones = () => traceZones(RE.pvc3, pts(G.gwAisle), K().P101).concat(traceZones(RE.pvc3, pts(G.gwBack), K().P101));
  const trunkDropped = () => polylinesOn(RE.copper15).some((l) => (l.startDrop || 0) > 0 || (l.endDrop || 0) > 0);
  // The water side several chapters take for granted: the two restroom lavatories chained
  // on 3/4 in copper, lav to lav, through the Chain tool's own commit. (Not the mop sink: a
  // chain places its counter at every click, and a mop sink counted as a lavatory is a
  // miscount the reference must not carry.)
  function seedCopperBranch() {
    const k = K();
    scaleP101();
    const lav = pick('lav');
    const cu = k.makeLineType('0.75in Copper CW', '#47c88e');
    if (!(ann() && (ann().quickLines || []).length)) T().chainPoints(lav.id, cu.id, [k.LAVS[0], k.LAVS[1]]);
    return { lav, cu };
  }

  // ----- the reference takeoff: what the whole sheet comes to -------------------------------
  // Every run on P-101 with its size and material, and every count, laid by "Finish the
  // takeoff for me" and set beside the reader's in the compare step. Feet are the plan
  // geometry the sheet was drawn from, so the reference can never drift from the drawing.
  const RUNS = [
    { key: 'cw2', re: RE.copper2, name: '2in Copper CW', color: '#2e86de', flat: G.cwService, drop: 0, label: 'the 2 inch service, up through the slab and west to the bar' },
    { key: 'cw15', re: RE.copper15, name: '1.5in Copper CW', color: '#4a9eff', flat: G.cwTrunk, drop: 4, label: 'the cold trunk, with its 4 ft riser' },
    { key: 'hw', re: RE.copper125, name: '1.25in Copper HW', color: '#e85447', flat: G.hwSupply, drop: 0, label: 'the hot supply from the heater round to the east wall' },
    { key: 'hwr', re: RE.hwr, name: '0.75in Copper HWR', color: '#e8c547', flat: G.hwReturn, drop: 0, label: 'the hot water return down the east wall to the pump' },
    { key: 'ss', re: RE.pvc4, name: '4in PVC', color: '#8a4bb0', flat: G.ssRun, drop: 0, label: 'the sanitary line to the sewer' },
    { key: 'gw1', re: RE.pvc3, name: '3in PVC', color: '#c8963a', flat: G.gwAisle, drop: 0, label: 'the grease line, work aisle' },
    { key: 'gw2', re: RE.pvc3, name: '3in PVC', color: '#c8963a', flat: G.gwBack, drop: 0, label: 'the grease line, bar and back rooms' },
    { key: 'gas', re: RE.gas, name: '1.25in BI', color: '#e85447', flat: null, drop: 0, label: 'the gas from the meter to the range' },
  ];
  const gasFlat = () => K().GAS_MAIN.flatMap((p) => [(p.x - 60) / 0.75, (p.y - 70) / 0.75]);
  const runFlat = (r) => r.flat || gasFlat();
  function referenceFeet() {
    const out = {};
    RUNS.forEach((r) => { out[r.name] = (out[r.name] || 0) + planFeet(runFlat(r)) + r.drop; });
    return out;   // the chained 3/4" branches ride on top: RE.copper75cw is compared loosely below
  }
  const COUNTS = () => { const s = SPOTS(); return [
    ['wc', s.wc, 'WC-1'], ['lav', s.lav, 'L-1'], ['hs', s.hs, 'HS-1'], ['tcs', s.tcs, '3CS-1'], ['ms', s.ms, 'MS-1'],
    ['fd', s.fdRestrooms.concat(s.fdRest), 'FD-1'], ['fs', s.fs, 'FS-1'], ['hb', s.hb, 'HB'], ['rpz', s.rpz, 'RPZ'],
    ['co', s.co, 'CO'], ['vtr', s.vtr, 'VTR'], ['gasDrop', s.gasDrop, 'Gas Drop'],
  ]; };
  // The reader's takeoff, read off the same summary Copy to /Tooling copies.
  function readerFeet() {
    const out = {};
    String(window.getPipeToolingSummary ? window.getPipeToolingSummary() : '').split('\n').forEach((line) => {
      const m = /^ft of (.+?)\t([\d.]+)/.exec(line);
      if (m) out[m[1]] = Number(m[2]);
    });
    return out;
  }
  const feetFor = (re, exclude) => { const f = readerFeet(); let n = 0; Object.keys(f).forEach((name) => { if (re.test(name) && !(exclude && exclude.test(name))) n += f[name]; }); return n; };
  const fmtFt = (n) => (Math.round(n * 10) / 10).toFixed(1);
  function layEverything() {
    const k = K();
    scaleP101();
    App.pushUndoSnapshotCurrentPage();
    seedCopperBranch();   // first: the chain places its own lavatory marks, and markMissing then skips them
    const s = SPOTS();
    markMissing(pick('wc'), s.wc); markMissing(pick('lav'), s.lav); markMissing(pick('ms'), s.ms); markMissing(pick('hs'), s.hs);
    markMissing(pick('fd'), s.fdRestrooms.concat(s.fdRest)); markMissing(pick('tcs'), s.tcs); markMissing(pick('fs'), s.fs);
    markMissing(pick('hb'), s.hb); markMissing(pick('rpz'), s.rpz); markMissing(pick('co'), s.co); markMissing(pick('vtr'), s.vtr); markMissing(pick('gasDrop'), s.gasDrop);
    RUNS.forEach((r) => {
      const lt = lineType(r.re) || k.makeLineType(r.name, r.color);
      const have = polylinesOn(r.re).length;
      const wanted = RUNS.filter((x) => x.re === r.re).indexOf(r);
      if (have <= wanted) { tracePlan(lt, runFlat(r), r.label); if (r.drop) dropAt(pts(runFlat(r))[0], r.drop); }
      if (/copper|pvc/i.test(lt.name)) addHangerRule(lt);
      enableBends(lt);
    });
    K().dirty();
  }
  function takeoffComplete() {
    const ref = referenceFeet();
    const runsOk = RUNS.every((r) => feetFor(r.re, r.key === 'hwr' ? null : RE.hwr) >= ref[r.name] * 0.95);
    const countsOk = COUNTS().every(([tag, spots]) => markCountNear(TAGS[tag][0], spots, 8) >= spots.length);
    return runsOk && countsOk;
  }
  function takeoffHint() {
    const ref = referenceFeet();
    const run = RUNS.find((r) => feetFor(r.re, r.key === 'hwr' ? null : RE.hwr) < ref[r.name] * 0.95);
    if (run) return 'Not yet traced: ' + run.label;
    const c = COUNTS().find(([tag, spots]) => markCountNear(TAGS[tag][0], spots, 8) < spots.length);
    return c ? 'Not all counted: ' + c[2] : '';
  }
  // The compare card, rendered live: run by run, the reference's feet beside the reader's.
  function compareBody() {
    const ref = referenceFeet();
    const seen = new Set();
    const lines = ['Reference on the left, from the sheet\'s own geometry. Yours on the right, from your Summary.'];
    RUNS.forEach((r) => {
      if (seen.has(r.name)) return; seen.add(r.name);
      const mine = feetFor(r.re, r.key === 'hwr' ? null : RE.hwr);
      const ok = mine >= ref[r.name] * 0.95 && mine <= ref[r.name] * 1.05;
      lines.push(r.name + ': ' + fmtFt(ref[r.name]) + ' ft, yours ' + fmtFt(mine) + ' ft' + (ok ? ' ✓' : mine < ref[r.name] * 0.95 ? ', short: ' + r.label : ', over: check for a doubled run'));
    });
    const branches = feetFor(RE.copper75cw, RE.hwr);
    lines.push('0.75in Copper CW branches: 10.7 ft, yours ' + fmtFt(branches) + ' ft' + (branches >= 10 ? ' ✓' : ', short: the chained lavatories'));
    const bad = COUNTS().filter(([tag, spots]) => markCountNear(TAGS[tag][0], spots, 8) < spots.length).map((c) => c[2]);
    lines.push(bad.length ? 'Counts short: ' + bad.join(', ') + '.' : 'Every count matches: twelve fixture types, thirty-four marks.');
    lines.push('A takeoff that lands within a few feet of the geometry is right; the last inch is the click. What matters is that nothing is missing, and the row above says so.');
    return lines.join('\n');
  }

  // ===== the chapters =========================================================================
  const CHAPTERS = [
    // 1 -------------------------------------------------------------------------------------
    {
      id: 'sheet', title: 'Chapter 1: Read the sheet', short: 'the sheet, read', minutes: 8, page: 0, noun: 'chapter',
      intro: 'Before a single count: what a plumbing plan is, what its legend and keynotes say, where the sizes and the fixture units come from, and a scale you proved.',
      seed() { /* nothing: the scale is the chapter's */ },
      steps: [
        { id: 'what', title: 'What kind of sheet is this?', kind: 'read', cardAt: 'br',
          body: 'Look at the title block at the bottom right, then the legend beside it.\nWhat does the P in P-101 tell you, and what do the legend\'s six line styles mean for the bid?',
          reveal: 'P is the discipline: A sheets are the architect\'s, S structural, M mechanical, E electrical, P plumbing. This one carries every plumbing system in the building, and the legend names each by its line: cold water solid, hot water dashed, the hot water return dotted, gas dash-dot, sanitary a heavy dash, grease waste the same dash lighter.\nAn estimator reads the legend first. Every line on the sheet is one of these, and each one is a different pipe, a different crew, and a different price.',
          target: [], check: () => true },
        { id: 'scale', title: 'Set the scale', kind: 'do',
          body: 'The title block says 1/8" = 1\'-0", and the graphic scale bar at the bottom left says the same.\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/8" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => K().scaleIs(K().P101, 9),
          action: { label: 'Use 1/8" = 1\'-0"', run: async () => { K().goPage(K().P101); await T().applyScalePreset('1/8" = 1\'', 9); } } },
        { id: 'prove', title: 'Prove it', kind: 'do', cardAt: 'bl', page: 0, zones: () => guide(pts(G.dim318), 13, K().measured(K().P101, 31.67, 0.4)),
          body: 'A PDF printed down to letter size keeps its title block and its scale bar and measures short. Only a dimension the engineer wrote can prove the scale.\n1. In the header, click [[Measure]] (or press D).\n2. Click the tick mark at one end of the 31\'-8" string above the kitchen half of the building: it is circled.\n3. Click the tick mark in the other circle.\nThe footer should read 31\'-8". Do this on every sheet, every time.',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => K().measured(K().P101, 31.67, 0.4),
          hint: () => { const lm = S().lastMeasure; return lm && lm.pageIdx === K().P101 && T().measuredFeet() != null ? 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + '. Try the two tick marks again' : ''; },
          action: { label: 'Measure the 31\'-8" string', run: async () => { K().goPage(K().P101); if (!K().scaleIs(K().P101, 9)) await T().applyScalePreset('1/8" = 1\'', 9); const d = pts(G.dim318); K().measure(d[0], d[1]); } } },
        { id: 'keynotes', title: 'Find the fixture the eye skips', kind: 'do', cardAt: 'bl',
          body: 'Every hexagon on the plan, WC, HS, FD, CO, VTR, is a keynote, and the column at the right spells each one out. One of them is a fixture with no room around it.\n1. Read the keynote column for HB.\n2. In the left sidebar, under COUNTERS, click [[+ Add]], and on the [[Create]] tab make a counter named HB Hose Bibb.\n3. Find the HB tag on the plan and click the fixture beside it.',
          target: ['#annCanvas', '#counterCreate', '#addCounter'],
          check: () => markNear(RE.hb, SPOTS().hb[0], 12),
          hint: () => (marks(RE.hb) ? 'Not that one. The east wall, outside the kitchen exit door, off the 3/4" cold line' : (counter(RE.hb) ? 'The counter is armed: click the hose bibb' : '')),
          action: { label: 'Find it and count it for me', run: () => { App.pushUndoSnapshotCurrentPage(); markMissing(pick('hb'), SPOTS().hb); K().dirty(); } } },
        { id: 'schedule', title: 'The schedule', kind: 'do',
          body: 'A freezeproof wall hydrant the crew washes the dumpster pad with: one symbol on a busy sheet, the kind a takeoff misses when the eye is on the restrooms. Read the keynote column once before you count.\nSizes come from the fixture schedule, not the plan. It is P-501, and it was scanned on its side.\n1. In the left sidebar, under PAGES, click P-501.\n2. In the footer, click [[Rotate 90° right]] (or press R).',
          target: ['#rotatePage', '#pagesList'], check: () => K().onPage(K().P501) && rotationOf(K().P501) === 90,
          hint: () => (K().onPage(K().P501) && rotationOf(K().P501) ? 'Keep turning until the title reads left to right' : ''),
          action: { label: 'Open P-501 and turn it', run: () => { K().goPage(K().P501); if (rotationOf(K().P501) !== 90) el('rotatePage').click(); } } },
        { id: 'row', title: 'Read a row', kind: 'do', cardAt: 'br',
          body: 'Each row is a tag on the plan with its cold and hot supply sizes, its waste W, its vent V, and two numbers the engineer sized the pipe from: WSFU, water supply fixture units, and DFU, drainage fixture units.\nWhich row drains the most, and why is its waste 4" when a hand sink\'s is 1-1/2"?\n1. In the header, click [[⋯]], then [[Highlight]] (or press H).\n2. Drag a box over that row.',
          target: ['#highlightBtn', '#highlightBtnSidebar', '#headerMoreBtn'],
          check: () => { const a = pageAnn(K().P501); return !!a && (a.highlights || []).some((h) => Math.min(h.x1, h.x2) <= 400 && Math.max(h.x1, h.x2) >= 400 && Math.min(h.y1, h.y2) <= 169 && Math.max(h.y1, h.y2) >= 169); },
          hint: () => { const a = pageAnn(K().P501); return a && (a.highlights || []).length ? 'Not that row. Read down the DFU column for the biggest number' : ''; },
          action: { label: 'Highlight WC-1 for me', run: () => { const k = K(); uprightSchedule(); k.goPage(k.P501); const a = App.ensureActiveCanvas(S().pages[k.P501]).annotations; if (!a.highlights) a.highlights = []; if (a.highlights.length) return; App.pushUndoSnapshotCurrentPage(); a.highlights.push(Object.assign({ color: '#e8c547', opacity: 0.25, id: App.uid() }, WC1_ROW)); S().tool = App.TOOL.NONE; k.dirty(); } } },
        { id: 'units', title: 'Fixture units', kind: 'read', cardAt: 'br',
          body: 'WC-1, at 4 DFU: a flush-valve water closet dumps a tank in seconds, a hand sink drains a trickle at 1. The code rates every fixture in drainage fixture units and sizes the pipe under it from the total (IPC 709 and 710); the same idea, in WSFU, sizes the water supply (IPC 604).\nNote 4 under the table adds them up: 47 DFU on P-101. Why is the building sewer 4" and not 3"?',
          reveal: 'A 3" sewer at 1/8" per foot carries 36 DFU (IPC Table 710.1(1)); 47 needs the 4", which carries 180. The engineer did that sum. The estimator prices the 4", and notices when the plan and the schedule disagree, which is an RFI.',
          target: [], check: () => true },
      ],
      done: 'The title block, the legend, the keynotes, the schedule with its fixture units, and a scale you proved.\nNext: [[Learn]] → Chapter 2, the fixtures and where they sit.',
    },
    // 2 -------------------------------------------------------------------------------------
    {
      id: 'fixtures', title: 'Chapter 2: The fixtures, and where they sit', short: 'every fixture counted', minutes: 10, page: 0, noun: 'chapter',
      intro: 'Why the restrooms share a wall, which hand sink serves the cook line, what a floor sink is for, and every fixture on the sheet counted under a counter the schedule itself made.',
      seed() { scaleP101(); uprightSchedule(); },
      steps: [
        { id: 'wetwall', title: 'Where the water goes', kind: 'do', cardAt: 'bl', page: 0, zones: () => guide(K().WCS, 14, K().measured(K().P101, 11.33, 0.7)),
          body: 'Look at MEN and WOMEN. They share a wall, and every fixture in both rooms sits against that wall or the top wall.\n1. In the header, click [[Measure]] (or press D).\n2. Click the water closet in MEN, then the water closet in WOMEN.\nHow much wall carries both rooms\' plumbing?',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => K().measured(K().P101, 11.33, 0.7),
          hint: () => { const lm = S().lastMeasure; return lm && lm.pageIdx === K().P101 && T().measuredFeet() != null ? 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + '. Try water closet to water closet' : ''; },
          action: { label: 'Measure it for me', run: () => { const k = K(); k.goPage(k.P101); k.measure(k.WCS[0], k.WCS[1]); } } },
        { id: 'counters', title: 'Counters from the schedule', kind: 'do',
          body: 'Eleven feet. A wet wall: both rooms\' supply and waste run in one cavity, one vent stack serves both (its VTR sits on that wall), and every foot the architect saves by putting fixtures back to back is a foot the bid does not carry. Fixtures scattered across a room mean long branches.\nName counters the way the schedule tags them, and let the sheet do the typing.\n1. Under PAGES, click P-501.\n2. Under COUNTERS, click [[+ Add]], then the [[Create]] tab, then [[Read a schedule from the sheet…]].\n3. Drag a box over the whole schedule table.\n4. Click [[Create counters]].',
          target: ['#schedulePaletteCreate', '#counterReadSchedule', '#counterModal .counter-tab[data-tab="create"]', '#addCounter', '#pagesList'],
          check: () => !!(counter(RE.wc) && counter(RE.fd) && counter(RE.hs)),
          action: { label: 'Read the schedule for me', run: readSchedule } },
        { id: 'restrooms', title: 'Count the restrooms', kind: 'do', cardAt: 'bl', page: 0, zones: restroomZones,
          body: 'Eight counters, one per tag, from the text the engineer already typed. On a scanned sheet with no text layer, the Create tab is the way.\n1. Under PAGES, click P-101.\n2. In the sidebar, click WC-1 to arm it, and click the two water closets.\n3. Arm FD-1 and click the floor drain in MEN, in WOMEN and in MOP.\n4. Arm L-1 and click the two lavatories. Arm MS-1 and click the mop sink.',
          target: ['#annCanvas', '#pagesList'], check: () => allDone(restroomZones()),
          hint: () => { const s = SPOTS(); return hintFor([row('WC-1', RE.wc, s.wc, ['MEN', 'WOMEN']), row('FD-1', RE.fd, s.fdRestrooms, ['MEN', 'WOMEN', 'the mop room']), row('L-1', RE.lav, s.lav, ['MEN', 'WOMEN']), row('MS-1', RE.ms, s.ms, ['the mop room'])]); },
          action: { label: 'Count the restrooms for me', run: () => { const s = SPOTS(); K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('wc'), s.wc); markMissing(pick('fd'), s.fdRestrooms); markMissing(pick('lav'), s.lav); markMissing(pick('ms'), s.ms); K().dirty(); } } },
        { id: 'handsinks', title: 'Which hand sink serves the cook line?', kind: 'do', cardAt: 'bl',
          body: 'There are three HS tags on the plan.\n1. In the sidebar, click HS-1 to arm it.\n2. Click the one hand sink that serves the cooks at the range.',
          target: ['#annCanvas'], check: () => markNear(RE.hs, K().HAND_SINKS[1], 10),
          hint: () => (marks(RE.hs) ? 'Not that one: it serves ' + (markNear(RE.hs, K().HAND_SINKS[0], 10) ? 'the bar' : 'the kitchen exit') + '. The cook line is the row of equipment under HOOD ABOVE' : ''),
          action: { label: 'Click it for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('hs'), [K().HAND_SINKS[1]]); K().dirty(); } } },
        { id: 'kitchen', title: 'Count the rest of the kitchen and the bar', kind: 'do', cardAt: 'tl', page: 0, zones: kitchenZones,
          body: 'The one beside the range. The health code, not the plumbing code, puts it there: the FDA Food Code (5-204.11) wants a handwashing sink in each food preparation area, within reach, so the cook line, the dish and prep side and the bar each get one. A prep area without one is an RFI now or a health inspector\'s order later.\n1. Click the other two hand sinks: at the kitchen exit, and at the bar.\n2. Arm 3CS-1 and click the two 3-compartment sinks: in the bar, and in the dish pit.\n3. Arm FD-1 and click the seven floor drains in the bar, the kitchen, the dish pit and storage.',
          target: ['#annCanvas'], check: () => allDone(kitchenZones()),
          hint: () => { const s = SPOTS(); return hintFor([row('HS-1', RE.hs, s.hs, HS_LABELS), row('3CS-1', RE.tcs, s.tcs, ['the bar', 'the dish pit']), row('FD-1', RE.fd, s.fdRest, FD_LABELS.slice(3))]); },
          action: { label: 'Count them for me', run: () => { const s = SPOTS(); K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('hs'), s.hs); markMissing(pick('tcs'), s.tcs); markMissing(pick('fd'), s.fdRest); K().dirty(); } } },
        { id: 'floorsinks', title: 'Which fixtures do not drain to the waste line?', kind: 'do', cardAt: 'bl', page: 0, zones: () => circlesOn(K().P101, RE.fs, SPOTS().fs),
          body: 'Two pieces of equipment on this sheet drain to an FS, a floor sink, instead of straight into the pipe.\n1. Arm FS-1.\n2. Click both floor sinks: they are the squares with a circle inside.',
          target: ['#annCanvas'], check: () => allDone(circlesOn(K().P101, RE.fs, SPOTS().fs)),
          hint: () => (marks(RE.fs) ? 'One more: ' + (markNear(RE.fs, SPOTS().fs[0], 8) ? 'by the dishwasher in the dish pit' : 'below the prep sink on the hall wall') : ''),
          action: { label: 'Click both for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('fs'), SPOTS().fs); K().dirty(); } } },
        { id: 'primers', title: 'What the FD keynote costs', kind: 'do',
          body: 'The prep sink and the dishwasher: an indirect waste with an air gap (IPC 802). If the sewer backs up it rises into the floor sink and onto the floor, never into a sink that food touches or a machine that washes plates. The floor sink is a fixture on the bid, and the indirect drain down to it is pipe you run.\nNow the FD keynote: FLOOR DRAIN W/ TRAP PRIMER, TYP. A trap holds water so sewer gas stays down; a drain that sees no water for months dries out, and the primer drips into it from a cold line (IPC 1002.4). TYP. means every one, and none of the ten primers is drawn.\n1. In the sidebar, click the pencil beside FD-1.\n2. Under [[Child counts]], add a row: Trap primer, 1 per count.\n3. Click [[Done]].',
          target: ['#childCountsGroup', '#countersList .edit-btn', '#countersSection'],
          check: () => { const c = counter(RE.fd); return !!(c && (c.childCounts || []).some((ch) => /primer/i.test(ch.name || ''))); },
          action: { label: 'Add Trap primer · 1 per count', run: () => { const c = pick('fd'); if ((c.childCounts || []).some((ch) => /primer/i.test(ch.name || ''))) return; App.pushUndoSnapshot(); c.childCounts = (c.childCounts || []).concat([{ name: 'Trap primer', qty: 1, per: 'count' }]); K().dirty(); } } },
        { id: 'keys', title: 'Put the counters on the number row', kind: 'do',
          body: 'Ten primers and ten little 1/2" lines now ride the ten marks, and go if a mark goes.\n1. In the status bar at the bottom right, click [[quick keys]].\n2. Beside key 1, choose FD-1. Beside key 2, HS-1.\n3. Close the dialog.\nOn a real sheet the rhythm is 1, click, click, 2, click, click, and the hand never leaves the plan.',
          target: ['#quickKeysModal .modal-card', '#statusBarQuickKeys'],
          check: () => { const c = counter(RE.fd); return !!c && Object.values(S().numberKeyBindings || {}).some((b) => b && b.id === c.id); },
          action: { label: 'Bind 1 and 2 for me', run: () => { if (!S().numberKeyBindings) S().numberKeyBindings = {}; S().numberKeyBindings[1] = { kind: 'counter', id: pick('fd').id }; S().numberKeyBindings[2] = { kind: 'counter', id: pick('hs').id }; K().dirty(); } } },
      ],
      done: 'Twenty-two fixtures under eight schedule tags, a hydrant the eye skips, and the reasons behind where they sit.\nNext: [[Learn]] → Chapter 3, the water.',
    },
    // 3 -------------------------------------------------------------------------------------
    {
      id: 'water', title: 'Chapter 3: Water, cold and hot', short: 'the water side, traced', minutes: 12, page: 0, noun: 'chapter',
      intro: 'From the meter through the backflow preventer, up the trunk and round the hot loop: the sizes the engineer wrote, the return line most bids miss, and the pipe, hangers and fittings the app counts from your trace.',
      seed() { scaleP101(); const s = SPOTS(); markMissing(pick('wc'), s.wc); markMissing(pick('fd'), s.fdRestrooms); },
      steps: [
        { id: 'service', title: 'Follow the cold water in', kind: 'do', cardAt: 'tl',
          body: 'Start at WM, the meter on the city main below the building, and follow the solid line into STORAGE.\n1. Under COUNTERS, click [[+ Add]] and make a counter named RPZ Backflow Preventer.\n2. Click the first thing the service meets inside the wall.',
          target: ['#annCanvas', '#counterCreate', '#addCounter'], check: () => markNear(RE.rpz, SPOTS().rpz[0], 14),
          hint: () => (marks(RE.rpz) ? 'Not that. Follow the 2" line up from WM through the south wall: the small box labelled RPZ' : (counter(RE.rpz) ? 'The counter is armed: click the RPZ' : '')),
          action: { label: 'Find it for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('rpz'), SPOTS().rpz); K().dirty(); } } },
        { id: 'trunk', title: 'Why the trunk climbs the west walls', kind: 'read', cardAt: 'tl',
          body: 'A reduced-pressure backflow preventer (IPC 608). If the city main ever loses pressure, a hose left in a mop bucket could siphon the building\'s water back into the street; the RPZ makes that impossible, and it sits where the service enters so everything behind it is covered. On the bid: one assembly, two shutoff valves, a test port and a drain for its relief valve.\nFrom the RPZ the cold runs west along the south wall, and one trunk turns north up the dish pit\'s west wall, through the kitchen and the men\'s room, to the top wall. Why that route, when the east wall is nearer the meter?',
          reveal: 'It feeds on the way: the dish 3-comp, the kitchen hand sink and prep sink, then both restrooms and the mop sink off the top-wall run, with the hot line beside it the whole way. One trunk with branches is less pipe and fewer hangers than two.\nThe label on it, 1-1/2" CW · 1-1/4" HW, is the engineer\'s fixture-unit math (IPC 604 and Appendix E), and it shrinks downstream: 3/4" by the mop room. You do not size it. You read the sizes and name your line types by them.',
          target: [], check: () => true },
        { id: 'linetypes', title: 'Line types by size and material', kind: 'do',
          body: 'The general notes say Type L copper. The material belongs in the name: the hanger rule reads it.\n1. In the left sidebar, under LINE TYPES, click [[+ Add]].\n2. On the [[Quick]] tab, pick 1.5in and Copper (if Copper is not in your list, [[+]] beside Material adds it).\n3. Click [[Add Line Type]].\n4. Again for 1.25in Copper (the hot supply) and 0.75in Copper (the branches).',
          target: ['#quickLineAdd', '#chooseLineTypeModal .line-type-tab[data-tab="quick"]', '#addLineType'],
          check: () => (S().lineTypes || []).filter((lt) => RE.copperAny.test(lt.name || '')).length >= 2,
          action: { label: 'Make the three copper types', run: () => { App.pushUndoSnapshot(); const k = K(); const cw = k.makeLineType('1.5in Copper CW', '#4a9eff'); k.makeLineType('1.25in Copper HW', '#e85447'); k.makeLineType('0.75in Copper CW', '#47c88e'); S().activeLineTypeId = cw.id; K().dirty(); } } },
        { id: 'trace', title: 'Trace the cold trunk', kind: 'do', cardAt: 'bl', page: 0, zones: () => traceZones(RE.copper15, pts(G.cwTrunk), K().P101),
          body: '1. In the left sidebar, click 1.5in Copper to make it the active line type.\n2. In the header, click [[Polyline]] (or press P).\n3. Click inside each circle in turn: where the trunk leaves the south-wall run, the corner at the top wall, the corner at the east wall, its end at the exit hand sink.\n4. Press Enter.\nFour clicks, and the app has the plan length of the whole trunk.',
          target: ['#polylineBtn', '#polylineBtnSidebar'], check: () => allDone(traceZones(RE.copper15, pts(G.cwTrunk), K().P101)),
          action: { label: 'Trace it for me', run: () => { const lt = lineType(RE.copper15) || K().makeLineType('1.5in Copper CW', '#4a9eff'); if (polylinesOn(RE.copper15).length) return; tracePlan(lt, G.cwTrunk, 'Cold trunk'); } } },
        { id: 'hot', title: 'Which line is the return?', kind: 'do', cardAt: 'tl', page: 0, zones: () => traceZones(RE.hwr, pts(G.hwReturn), K().P101),
          body: 'The hot water leaves the WH in STORAGE as a dashed line and rides beside the cold all the way round. A second line, dotted, comes back down the east wall through the RECIRC PUMP into the heater.\n1. Under LINE TYPES, make 0.75in Copper HWR (on the [[Create]] tab, or the Quick tab with HWR added to the name).\n2. With it active, click [[Polyline]] and trace the return: the top-right corner, down the east wall, and into the pump.\n3. Press Enter.',
          target: ['#polylineBtn', '#polylineBtnSidebar', '#addLineType'], check: () => allDone(traceZones(RE.hwr, pts(G.hwReturn), K().P101)),
          hint: () => (lineType(RE.hwr) ? 'Trace the DOTTED line, the legend\'s HWR, not the dashed supply' : ''),
          action: { label: 'Trace the return for me', run: () => { const lt = lineType(RE.hwr) || K().makeLineType('0.75in Copper HWR', '#e8c547'); if (polylinesOn(RE.hwr).length) return; tracePlan(lt, G.hwReturn, 'Hot water return'); } } },
        { id: 'chain', title: 'Chain the fixtures off the top-wall run', kind: 'do', cardAt: 'bl', page: 0, zones: () => circlesOn(K().P101, RE.lav, K().LAVS, 14),
          body: 'Forty feet of 3/4" pipe, insulated, plus the pump, a check valve and a balancing valve, that most bids miss because it looks like the supply. Without the loop the mop sink, forty feet from the heater, runs cold for a minute every time it is opened, and the health code wants hot water at every hand sink now (FDA Food Code 5-202.12, at least 100°F).\nBoth lavatories hang off the top-wall run on 3/4" branches, lav to lav.\n1. In the header, click [[Chain]] (or press T).\n2. In the Chain panel, choose L-1 and 0.75in Copper.\n3. Click the lavatory in MEN, then the one in WOMEN.\n4. Press Enter.\nEvery click places the fixture AND draws the branch back to the last one. (The mop sink has its own counter, so it is not on this chain.)',
          target: ['#chainPanel', '#chainBtn'], check: () => { const a = ann(); return !!a && (a.quickLines || []).length >= 1 && allDone(circlesOn(K().P101, RE.lav, K().LAVS, 14)); },
          action: { label: 'Chain the two for me', run: () => { K().goPage(K().P101); seedCopperBranch(); } } },
        { id: 'drop', title: 'The riser the plan cannot show', kind: 'do', cardAt: 'bl', page: 0, zones: () => guide([P(564, 594)], 14, trunkDropped()),
          body: 'The trunk comes up out of the slab at the south wall, and plan view never shows a vertical.\n1. In the header, click [[Drop]] (or press B).\n2. In the palette, choose or type 4 ft.\n3. Click the start of the trunk, at the south wall.\nThose 4 ft join the trunk\'s footage. Click the same end again to clear it.',
          target: ['#dropPanel', '#dropBtn'], check: trunkDropped,
          action: { label: 'Add a 4 ft riser for me', run: () => { K().goPage(K().P101); if (!polylinesOn(RE.copper15).length) tracePlan(lineType(RE.copper15) || K().makeLineType('1.5in Copper CW', '#4a9eff'), G.cwTrunk, 'Cold trunk'); dropAt(P(564, 594), 4); } } },
        { id: 'hangers', title: 'Hangers from the copper rule', kind: 'do',
          body: '1. In the left sidebar, under LINE TYPES, click the pencil beside 1.5in Copper.\n2. Under [[Child counts]], the app offers Hanger · 1 per 10 ft: IPC Table 308.5 for copper over 1-1/4", read off the type\'s name. Click [[Add]].\n3. Click [[Done]].\nEvery run of this type now counts its hangers, and the § chip in the Summary names the rule.',
          target: ['#childCountsSuggest', '#childCountsGroup', '#lineTypesList .edit-btn', '#lineTypesSectionTitle'],
          check: () => { const lt = lineType(RE.copper15); return !!(lt && (lt.childCounts || []).length); },
          action: { label: 'Add the hanger rule', run: () => addHangerRule(lineType(RE.copper15)) } },
        { id: 'bends', title: 'Elbows from the bends', kind: 'do',
          body: '1. Open the same line type\'s details again.\n2. Turn on [[Fittings from bends]] and click [[Done]].\nEach corner of the trunk now counts a 90, and the riser counts one too. None of them are marks, so they can never drift from the pipe.',
          target: ['#counterLineTypeDetailsModal .modal-card', '#lineTypesList .edit-btn', '#lineTypesSectionTitle'],
          check: () => { const lt = lineType(RE.copper15); return !!(lt && lt.bendFittings && lt.bendFittings.enabled); },
          action: { label: 'Turn it on for me', run: () => enableBends(lineType(RE.copper15)) } },
        { id: 'read', title: 'What the drawing knows now', kind: 'read',
          body: '1. In the left sidebar, look at SUMMARY.\nFeet of 1.5in Copper with the riser inside, the hangers under it with their § chip, the elbows, the return, and the 0.75in branch from the chain. On a real bid this is the water side of the sheet in a few dozen clicks.\nMore: [Doing a plumbing takeoff](/guides/plumbing-takeoff/).',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'The service, the trunk, the return, the branches, and the pipe counted from the trace with its hangers and elbows.\nNext: [[Learn]] → Chapter 4, the waste.',
    },
    // 4 -------------------------------------------------------------------------------------
    {
      id: 'waste', title: 'Chapter 4: Waste and vent', short: 'the waste side, traced', minutes: 12, page: 0, noun: 'chapter',
      intro: 'Gravity, slope, traps and vents, cleanouts, and why the grease interceptor sits outside with the restrooms going around it. Then both waste lines traced on their own layer and the marks counted.',
      seed() { scaleP101(); const s = SPOTS(); markMissing(pick('fd'), s.fdRestrooms.concat(s.fdRest)); markMissing(pick('wc'), s.wc); markMissing(pick('hs'), s.hs); },
      steps: [
        { id: 'downhill', title: 'Downhill', kind: 'do', cardAt: 'tl', page: 0, zones: () => guide(pts(G.ssRun).slice(0, 2), 14, K().measured(K().P101, 29, 0.8)),
          body: 'Water arrives under pressure and goes wherever the pipe goes. Waste has only gravity. The heavy dashed line under the restrooms starts at a cleanout under MEN and leaves through the east wall.\n1. Click [[Measure]] (or press D).\n2. Click the cleanout under MEN, then the point where the line crosses the east wall.',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => K().measured(K().P101, 29, 0.8),
          hint: () => { const lm = S().lastMeasure; return lm && lm.pageIdx === K().P101 && T().measuredFeet() != null ? 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + '. The CO under MEN to the east wall' : ''; },
          action: { label: 'Measure it for me', run: () => { K().goPage(K().P101); const d = pts(G.ssRun); K().measure(d[0], d[1]); } } },
        { id: 'two', title: 'Which fixture must never drain through the interceptor?', kind: 'do', cardAt: 'tl',
          body: 'Twenty-nine feet at 1/8" per foot (IPC 704.1 for 3" and larger): the far end sits 3-5/8" higher than the wall. Every foot of horizontal waste is a foot of trench, priced by the foot and the depth, and the engineer runs the drains the short way to the sewer to keep it shallow.\nThere are two waste lines, 4" SS and 3" GW, and they leave the building separately.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click a fixture whose waste must never go through the GI, and type why.',
          target: ['#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => { const k = K(); const spots = k.WCS.concat(k.LAVS, [k.MOP]); return spots.some((pt) => notesNear(pt, 30).length); },
          hint: () => { const a = ann(); if (!a || !(a.notes || []).length) return ''; const k = K(); const grease = k.HAND_SINKS.concat(SPOTS().tcs, SPOTS().fs, Object.keys(k.FD).map((n) => k.FD[n])); return grease.some((pt) => notesNear(pt, 30).length) ? 'That fixture carries grease: the interceptor is exactly where it should go' : 'Put the note on the fixture itself'; },
          action: { label: 'Note the water closet for me', run: () => K().addNote(K().WCS[0], 'Sewage never enters the interceptor: the restrooms go straight to the sewer', '#e85447') } },
        { id: 'layer', title: 'Waste on its own layer', kind: 'do',
          body: 'A water closet, a lavatory or the mop sink. Every kitchen, dish and bar fixture drains through the 3" grease line to the GI outside, where grease floats, cools and is pumped out; the restrooms join the sewer downstream of it, because the interceptor is for grease-laden waste and the code keeps everything else out (IPC 1003.3). The red note says it in nine words.\nA plumber reads water and waste as two drawings. Keep them apart.\n1. In the footer, beside the layer name, click [[Add canvas]], the + button.\n2. Click [[New empty layer]], name it Waste, and click [[Create]].\nThe up and down arrow keys switch layers; each layer has its own totals.',
          target: ['#addCanvasModalCreate', '#addCanvasBtn'], check: onWasteLayer,
          action: { label: 'Add the Waste layer for me', run: addWasteLayer } },
        { id: 'linetypes', title: 'Line types for the waste', kind: 'do',
          body: 'The general notes say PVC DWV.\n1. Under LINE TYPES, click [[+ Add]].\n2. On the [[Quick]] tab, pick 4in and PVC, and click [[Add Line Type]].\n3. Again for 3in PVC.',
          target: ['#quickLineAdd', '#chooseLineTypeModal .line-type-tab[data-tab="quick"]', '#addLineType'],
          check: () => !!(lineType(RE.pvc4) && lineType(RE.pvc3)),
          action: { label: 'Make 4in PVC and 3in PVC', run: () => { App.pushUndoSnapshot(); const k = K(); const ss = k.makeLineType('4in PVC', '#8a4bb0'); k.makeLineType('3in PVC', '#c8963a'); S().activeLineTypeId = ss.id; K().dirty(); } } },
        { id: 'ss', title: 'Trace the sanitary line', kind: 'do', cardAt: 'bl', page: 0, zones: () => traceZones(RE.pvc4, pts(G.ssRun), K().P101),
          body: '1. Click 4in PVC in the sidebar to make it active.\n2. In the header, click [[Polyline]] (or press P).\n3. Click the cleanout under MEN, the east wall where the line leaves, the cleanout at the turn outside, and where it meets the interceptor\'s outlet line.\n4. Press Enter.',
          target: ['#polylineBtn', '#polylineBtnSidebar'], check: () => allDone(traceZones(RE.pvc4, pts(G.ssRun), K().P101)),
          action: { label: 'Trace it for me', run: async () => { if (!onWasteLayer()) await addWasteLayer(); const lt = lineType(RE.pvc4) || K().makeLineType('4in PVC', '#8a4bb0'); if (polylinesOn(RE.pvc4).length) return; tracePlan(lt, G.ssRun, 'Sanitary'); } } },
        { id: 'gw', title: 'Trace the grease line', kind: 'do', cardAt: 'tl', page: 0, zones: greaseZones,
          body: 'Two runs, both 3in PVC.\n1. Click 3in PVC in the sidebar, then [[Polyline]].\n2. The work aisle: the cleanout by the kitchen door, the corner at the east end, down to the wall, and out to the interceptor. Press Enter.\n3. The back rooms: the cleanout in the bar, the two corners of the jog, and its end where it joins the first run. Press Enter.',
          target: ['#polylineBtn', '#polylineBtnSidebar'], check: () => allDone(greaseZones()),
          hint: () => (polylinesOn(RE.pvc3).length === 1 ? 'One more: the bar and back-room run' : ''),
          action: { label: 'Trace both for me', run: async () => { if (!onWasteLayer()) await addWasteLayer(); const lt = lineType(RE.pvc3) || K().makeLineType('3in PVC', '#c8963a'); const have = polylinesOn(RE.pvc3).length; if (have < 1) tracePlan(lt, G.gwAisle, 'Grease, work aisle'); if (have < 2) tracePlan(lt, G.gwBack, 'Grease, back rooms'); } } },
        { id: 'cleanouts', title: 'Where must a cleanout be?', kind: 'do', cardAt: 'bl',
          body: 'A snake has to get into every drain line somewhere.\n1. Make a counter named CO Cleanout.\n2. Click every spot on the plan where the code wants one.',
          target: ['#annCanvas', '#addCounter'], check: () => markCountNear(RE.co, SPOTS().co, 8) >= 4,
          hint: () => missing(RE.co, SPOTS().co, CO_LABELS, 8),
          action: { label: 'Count them for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('co'), SPOTS().co); K().dirty(); } } },
        { id: 'vents', title: 'Which walls carry a vent stack?', kind: 'do', cardAt: 'bl',
          body: 'Four: at the upstream end of each drain line and at the turn outside, wherever the snake goes in (IPC 708). On the bid a cleanout is a fitting, a plug and an access cover.\nEvery trap needs a vent behind it, or the water seal siphons out when the fixture upstream drains (IPC 901). The vent piping lives in the walls; what the plan shows is where a stack goes through the roof.\n1. Make a counter named VTR Vent Through Roof.\n2. Click both VTR tags.',
          target: ['#annCanvas', '#addCounter'], check: () => markCountNear(RE.vtr, SPOTS().vtr, 8) >= 2,
          hint: () => missing(RE.vtr, SPOTS().vtr, VTR_LABELS, 8),
          action: { label: 'Count both for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('vtr'), SPOTS().vtr); K().dirty(); } } },
        { id: 'open', title: 'Open Bid Check', kind: 'do',
          body: 'Two VTRs, each a roof penetration: a flashing, a boot, and a roofer to coordinate (IPC 903 puts the terminal above the roof and away from air intakes).\n1. In the left sidebar, click BID CHECK to expand it.\nThe row Hangers on every supported run is open: 4in PVC and 3in PVC count no hangers.',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false,
          action: { label: 'Open it', run: () => { S().bidCheckCollapsed = false; if (App.renderBidCheck) App.renderBidCheck(); App.updateUI(); } } },
        { id: 'underslab', title: 'Hangers under the slab?', kind: 'read',
          body: 'Bid Check says the two PVC types count no hangers.\nIs it right?',
          reveal: 'Not this time. The general notes put the waste below the slab, and pipe in a trench lies on bedding, not on hangers. The rule is written for pipe that hangs (IPC 308.5), and the app reads the material in the name, not where the pipe runs.\nLeave the row open and tick nothing. When you export, the gate asks once and remembers your answer. Where a waste line does run above a ceiling, add the PVC rule, one hanger every 4 ft, to that type.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => true },
      ],
      done: 'Two waste systems on their own layer, the cleanouts and vents counted, and a Bid Check row you can explain.\nNext: [[Learn]] → Chapter 5, the riser.',
    },
    // 5 -------------------------------------------------------------------------------------
    {
      id: 'riser', title: 'Chapter 5: The riser', short: 'the vertical, drawn', minutes: 8, page: 3, noun: 'chapter',
      intro: 'The plan shows a stack as one circle. P-601 draws it standing up: the trap arms, the stack, the vent through the roof, and the vertical feet the bid carries.',
      seed() { scaleP101(); K().makeLineType('4in PVC', '#8a4bb0'); },
      steps: [
        { id: 'scale', title: 'A riser drawn to scale', kind: 'do',
          body: 'Most risers are not to scale. This one is, at 1/4", so the verticals can be measured.\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/4" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => K().scaleIs(K().P601, 18),
          action: { label: 'Use 1/4" = 1\'-0"', run: async () => { K().goPage(K().P601); await T().applyScalePreset('1/4" = 1\'', 18); } } },
        { id: 'prove', title: 'Prove it', kind: 'do', cardAt: 'br', page: 3, zones: () => guide(raw(R.prove), 13, K().measured(K().P601, 14, 0.4)),
          body: '1. Click [[Measure]] (or press D).\n2. Click both ends of the 14\'-0" string at the left, floor to roof.',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => K().measured(K().P601, 14, 0.4),
          action: { label: 'Measure the 14\'-0" string', run: async () => { const k = K(); k.goPage(k.P601); if (!k.scaleIs(k.P601, 18)) await T().applyScalePreset('1/4" = 1\'', 18); const d = raw(R.prove); k.measure(d[0], d[1]); } } },
        { id: 'traparm', title: 'How long is the lavatory\'s trap arm?', kind: 'do', cardAt: 'br', page: 3, zones: () => guide(raw(R.lavArm), 12, K().measured(K().P601, 4, 0.3)),
          body: 'The trap arm is the run from a fixture\'s trap to its vent. The lavatory\'s is dimensioned, in the wall at 18" above the floor.\n1. Click [[Measure]] again.\n2. Click both ends of the lavatory\'s trap arm, from the stack to the trap.',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => K().measured(K().P601, 4, 0.3),
          hint: () => { const lm = S().lastMeasure; return lm && lm.pageIdx === K().P601 && T().measuredFeet() != null && Math.abs(T().measuredFeet() - 14) > 0.4 ? 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + '. Stack to trap, at the lavatory' : ''; },
          action: { label: 'Measure it for me', run: () => { const k = K(); k.goPage(k.P601); const d = raw(R.lavArm); k.measure(d[0], d[1]); } } },
        { id: 'stack', title: 'Trace the stack', kind: 'do', cardAt: 'br', page: 3, zones: () => traceZones(RE.pvc4, raw(R.stack), K().P601),
          body: 'Four feet. IPC Table 1002.2 allows six for a 1-1/2" arm; any longer and the trap would siphon when the water closet flushes. Riser note 2 lists the limits, and Bid Check\'s trap-arm row is where you sign that you read them.\nThe stack itself is pipe the plan cannot show.\n1. Click 4in PVC in the sidebar to make it active.\n2. Click [[Polyline]] (or press P), click the base of the stack at the building drain, then the vent terminal above the roof, and press Enter.',
          target: ['#polylineBtn', '#polylineBtnSidebar'], check: () => allDone(traceZones(RE.pvc4, raw(R.stack), K().P601)),
          action: { label: 'Trace it for me', run: () => { const lt = lineType(RE.pvc4) || K().makeLineType('4in PVC', '#8a4bb0'); if (polylinesOn(RE.pvc4, K().P601).length) return; traceSheet(lt, R.stack, 'Stack', K().P601); } } },
        { id: 'why', title: 'Why the stack keeps going', kind: 'read', cardAt: 'br',
          body: 'Seventeen feet of 4" pipe for one circle on the plan: the waste stack below the lavatory\'s connection, the vent stack above it, and a foot above the roof.\nWhy does a waste stack continue past the last fixture and out through the roof?',
          reveal: 'Air. Water falling down a stack pushes air ahead of it and pulls air behind it; without an open top the pressure swings would blow or siphon every trap on the stack. The stack vents through the roof, a foot above it and clear of air intakes (IPC 903), and that terminal is a flashing and a roofer on the bid.\nOn a real set the riser is where the verticals, the vent header sizes and the cleanout at the base of each stack come from; the plan only hints at them.',
          target: [], check: () => true },
        { id: 'co', title: 'The cleanout at the base', kind: 'do', cardAt: 'br', page: 3, zones: () => circlesOn(K().P601, RE.co, raw(R.co), 14),
          body: 'Riser note 4: a cleanout at the base of each stack, where the vertical turns horizontal and a blockage settles.\n1. In the sidebar, click CO Cleanout to arm it (make it if this chapter is your first).\n2. Click the cleanout beside the base of the stack.',
          target: ['#annCanvas', '#addCounter'], check: () => allDone(circlesOn(K().P601, RE.co, raw(R.co), 14)),
          action: { label: 'Count it for me', run: () => { const k = K(); k.goPage(k.P601); App.pushUndoSnapshotCurrentPage(); markMissing(pick('co'), raw(R.co), k.P601); k.dirty(); } } },
      ],
      done: 'A riser you can measure, a trap arm checked against the table, and seventeen feet of stack the plan never showed.\nNext: [[Learn]] → Chapter 6, the gas.',
    },
    // 6 -------------------------------------------------------------------------------------
    {
      id: 'gas', title: 'Chapter 6: Gas', short: 'the gas, traced', minutes: 8, page: 0, noun: 'chapter',
      intro: 'From the meter to the cook line: sizes that shrink with the load, a shutoff at every appliance, the valve the hood trips and where it goes, and a hanger row the rulebook does not have yet.',
      seed() { scaleP101(); },
      steps: [
        { id: 'meter', title: 'From the meter', kind: 'read', cardAt: 'tl',
          body: 'GM is the gas meter on the 4" city main. Follow the dash-dot line into the building.\nWhat sizes does it pass through, and where does each change?',
          reveal: '1-1/2" from the meter into STORAGE, where 3/4" splits off to the water heater; 1-1/4" on up the east side of the kitchen and west along the cook line, with a drop and a shutoff at each of the four appliances. Gas is sized by the load downstream in BTU per hour and the length of the run (IFGC 402), so like water it shrinks as it goes.\nBlack steel, threaded, per the general notes: BI in the trade, black iron.',
          target: [], check: () => true },
        { id: 'linetype', title: 'A black iron line type', kind: 'do',
          body: '1. In the left sidebar, under LINE TYPES, click [[+ Add]].\n2. On the [[Quick]] tab, pick 1.25in and BI.\n3. Click [[Add Line Type]].',
          target: ['#quickLineAdd', '#chooseLineTypeModal .line-type-tab[data-tab="quick"]', '#addLineType'],
          check: () => !!lineType(RE.gas),
          action: { label: 'Make 1.25in BI', run: () => { App.pushUndoSnapshot(); const lt = K().makeLineType('1.25in BI', '#e85447'); S().activeLineTypeId = lt.id; K().dirty(); } } },
        { id: 'trace', title: 'Trace the cook line', kind: 'do', cardAt: 'bl', page: 0, zones: () => traceZones(RE.gas, K().GAS_MAIN, K().P101),
          body: '1. Click 1.25in BI in the sidebar, then [[Polyline]] (or press P).\n2. Click the meter, the corner where the run turns west behind the cook line, and its end at the range.\n3. Press Enter.',
          target: ['#polylineBtn', '#polylineBtnSidebar'], check: () => allDone(traceZones(RE.gas, K().GAS_MAIN, K().P101)),
          action: { label: 'Trace it for me', run: () => { const lt = lineType(RE.gas) || K().makeLineType('1.25in BI', '#e85447'); if (polylinesOn(RE.gas).length) return; tracePlan(lt, gasFlat(), 'Gas main'); } } },
        { id: 'bends', title: 'Elbows from the bends', kind: 'do',
          body: '1. Click the pencil beside 1.25in BI.\n2. Turn on [[Fittings from bends]] and click [[Done]].\nThe corner counts a 90. Threaded steel elbows are priced each, so this row matters more on gas than on anything else.',
          target: ['#counterLineTypeDetailsModal .modal-card', '#lineTypesList .edit-btn', '#lineTypesSectionTitle'],
          check: () => { const lt = lineType(RE.gas); return !!(lt && lt.bendFittings && lt.bendFittings.enabled); },
          action: { label: 'Turn it on for me', run: () => enableBends(lineType(RE.gas)) } },
        { id: 'drops', title: 'Count the drops', kind: 'do', cardAt: 'bl', page: 0, zones: () => circlesOn(K().P101, RE.gasDrop, SPOTS().gasDrop, 12),
          body: 'Each dot on the run behind the cook line is a drop with a shutoff to one appliance (IFGC 409.5 wants a valve at every one).\n1. Make a Gas Drop w/ Shutoff counter.\n2. Click the four dots under the range, the flat top and the two fryers.',
          target: ['#annCanvas', '#addCounter'], check: () => allDone(circlesOn(K().P101, RE.gasDrop, SPOTS().gasDrop, 12)),
          hint: () => missing(RE.gasDrop, SPOTS().gasDrop, ['the range', 'the flat top', 'the first fryer', 'the second fryer'], 8),
          action: { label: 'Count the four for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('gasDrop'), SPOTS().gasDrop); K().dirty(); } } },
        { id: 'hood', title: 'Where does the hood\'s valve go?', kind: 'do', cardAt: 'bl',
          body: 'The dashed rectangle over the cook line says HOOD ABOVE. A hood carries a fire suppression system, and when it fires it has to shut the gas to everything under it (NFPA 96, the hood standard). That is a valve on the gas line, and the sheet does not draw it or say who furnishes it.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click the spot on the gas line where that valve has to sit.\n3. Type RFI: and the question: who furnishes and sets the gas shutoff valve the hood suppression system trips?',
          target: ['#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => anyRfi() && notesNear(pts(G.hoodValve)[0], 60).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))),
          hint: () => { const a = ann(); return a && (a.notes || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))) ? 'Move it: the valve sits on the 1-1/4" line AHEAD of the first drop, so one valve cuts every appliance' : (a && (a.notes || []).length ? 'Start the note with RFI:' : ''); },
          action: { label: 'Flag it for me', run: () => K().addNote(pts(G.hoodValve)[0], 'RFI: Who furnishes and sets the gas shutoff valve the hood suppression system trips?', '#e85447') } },
        { id: 'hangers', title: 'A hanger row of your own', kind: 'do',
          body: 'Ahead of the first drop, so one valve cuts the whole line. A note that starts with RFI: is a flag; [[Copy RFI Flags]] under EXPORT OPTIONS collects every one for the GC, and the ledger in the header lists them.\nThe rulebook has no steel row yet, so Bid Check is quiet about the gas line. IPC Table 308.5 hangs steel pipe every 12 ft.\n1. Click the pencil beside 1.25in BI.\n2. Under [[Child counts]], add a row: Hanger, 1 per 12 ft.\n3. Click [[Done]].',
          target: ['#childCountsGroup', '#lineTypesList .edit-btn', '#lineTypesSectionTitle'],
          check: () => { const lt = lineType(RE.gas); return !!(lt && (lt.childCounts || []).some((ch) => ch.per === 'ft')); },
          action: { label: 'Add Hanger · 1 per 12 ft', run: () => { const lt = lineType(RE.gas); if (!lt || (lt.childCounts || []).length) return; App.pushUndoSnapshot(); lt.childCounts = [{ name: 'Hanger', qty: 1, per: 'ft', ftInterval: 12 }]; K().dirty(); } } },
      ],
      done: 'The gas from the meter to the range, its elbows and drops, the valve nobody drew flagged where it belongs, and hangers from a row you wrote.\nNext: [[Learn]] → Chapter 7, the enlarged plan and the typical.',
    },
    // 7 -------------------------------------------------------------------------------------
    {
      id: 'details', title: 'Chapter 7: The enlarged plan and the typical', short: 'a second sheet, a second scale', minutes: 8, page: 1, noun: 'chapter',
      intro: 'Why the restrooms are drawn twice, a scale per sheet, a detail at another scale inside it, and TYP. OF 4 made into a number.',
      seed() {
        scaleP101();
        const k = K();
        k.mark(k.P401, k.makeCounter('HS-1 Hand Sink', 'Mounted Sink', '#47c88e'), [k.DETAIL.hs]);
        k.mark(k.P401, k.makeCounter('FD-1 Floor Drain', 'Floor Drain', '#e85447'), [k.DETAIL.fd]);
      },
      steps: [
        { id: 'why', title: 'Why draw the restrooms twice?', kind: 'read', cardAt: 'br',
          body: 'P-401 draws MEN and WOMEN again, at 1/4". P-101 already shows them.\nWhat is the enlarged plan for?',
          reveal: 'Clearances. At 1/8" a restroom is an inch wide and nobody can check that the room has its 60" circle to turn a wheelchair or that a lavatory rim sits at 34". The enlarged plan is where the accessibility dimensions live (ICC A117.1, through the building code) and where the engineer proves the fixtures fit.\nFor the takeoff it is a second scale on the same set, and the easiest place to count a fixture twice: count the restrooms on one sheet, never both.',
          target: [], check: () => true },
        { id: 'scale', title: 'A scale per sheet', kind: 'do',
          body: 'P-101 is at 1/8". This sheet is drawn at 1/4" and has no scale yet: its badge under PAGES is not outlined.\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/4" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => K().scaleIs(K().P401, 18),
          action: { label: 'Use 1/4" = 1\'-0"', run: async () => { K().goPage(K().P401); await T().applyScalePreset('1/4" = 1\'', 18); } } },
        { id: 'prove', title: 'Prove it', kind: 'do', cardAt: 'bl', page: 1, zones: () => guide(K().DETAIL.prove, 16, K().measured(K().P401, 12, 0.4)),
          body: '1. Click [[Measure]] (or press D).\n2. Click both ends of the 12\'-0" string over WOMEN: the tick marks are circled.\nIt should read 12\'-0".',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => K().measured(K().P401, 12, 0.4),
          action: { label: 'Measure the 12\'-0" string', run: async () => { const k = K(); k.goPage(k.P401); if (!k.scaleIs(k.P401, 18)) await T().applyScalePreset('1/4" = 1\'', 18); k.measure(k.DETAIL.prove[0], k.DETAIL.prove[1]); } } },
        { id: 'zone', title: 'A detail at another scale', kind: 'do', cardAt: 'bl', page: 1, zones: () => [T().boxZone(rectsOf(K().P401, 'scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 36) < 0.1), DETAIL_INNER(), DETAIL_OUTER(), 'Drag your box around detail 2, anywhere in here')],
          hint: () => T().boxMiss(rectsOf(K().P401, 'scaleZones'), DETAIL_INNER(), DETAIL_OUTER()),
          body: 'Detail 2, the hand sink station, is drawn at 1/2". Measured at the sheet\'s 1/4" it would read double.\n1. In the header, click [[⋯]], then [[Scale Zone]].\n2. Drag a box around detail 2, the dashed frame.\n3. In the dialog, choose [[1/2" = 1\']].',
          target: ['#scaleZoneBtn', '#scaleZoneBtnSidebar', '#headerMoreBtn'],
          check: () => { const a = pageAnn(K().P401); return !!a && (a.scaleZones || []).some((z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 36) < 0.1); },
          action: { label: 'Box detail 2 at 1/2"', run: () => { const k = K(); k.goPage(k.P401); const a = App.ensureActiveCanvas(S().pages[k.P401]).annotations; if (!a.scaleZones) a.scaleZones = []; if (a.scaleZones.length) return; App.pushUndoSnapshotCurrentPage(); a.scaleZones.push(Object.assign({ id: App.uid(), scale: { pixelsPerUnit: 36, unit: 'ft', label: '1/2" = 1\'' } }, k.DETAIL.box)); k.dirty(); } } },
        { id: 'multiply', title: 'How many hand sink stations does the bid carry?', kind: 'do', cardAt: 'bl', page: 1, zones: () => [T().boxZone(rectsOf(K().P401, 'multiplyZones', (z) => (z.multiplier || 1) === 4), DETAIL_INNER(), DETAIL_OUTER(), 'Drag your box around detail 2, anywhere in here')],
          body: 'Detail 2 is titled HAND SINK STATION · TYP. OF 4, and the chapter counted it once: one hand sink, one floor drain.\n1. In the header, click [[⋯]], then [[Multiply Zone]] (or press X).\n2. Drag a box around detail 2.\n3. Type the number the bid carries and click [[Apply]].',
          target: ['#multiplyZoneBtn', '#multiplyZoneBtnSidebar', '#headerMoreBtn'],
          check: () => { const a = pageAnn(K().P401); return !!a && (a.multiplyZones || []).some((z) => (z.multiplier || 1) === 4); },
          hint: () => { const a = pageAnn(K().P401); const z = a && (a.multiplyZones || []).find((x) => (x.multiplier || 1) > 1); return z && (z.multiplier || 1) !== 4 ? 'The sheet says how many: right-click the zone\'s label to change the number' : T().boxMiss(rectsOf(K().P401, 'multiplyZones'), DETAIL_INNER(), DETAIL_OUTER()); },
          action: { label: 'Wrap detail 2 in a ×4 zone', run: () => { const k = K(); k.goPage(k.P401); const a = App.ensureActiveCanvas(S().pages[k.P401]).annotations; if (!a.multiplyZones) a.multiplyZones = []; if (a.multiplyZones.length) return; App.pushUndoSnapshotCurrentPage(); a.multiplyZones.push(Object.assign({ id: App.uid(), multiplier: 4 }, k.DETAIL.box)); k.dirty(); } } },
        { id: 'read', title: 'Count one, bid four', kind: 'read',
          body: 'Four of everything in it: four hand sinks, four floor drains, four sets of supplies, traps and primers, though the sheet draws one. TYP. is the engineer saving ink, and the estimator\'s most common miss.\n1. In the left sidebar, look at SUMMARY: HS-1 and FD-1 read 4 while the sheet still shows one mark of each.',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'A second sheet with its own scale, a detail with its own, and a typical counted once.\nNext: [[Learn]] → Chapter 8, the whole sheet.',
    },
    // 8 -------------------------------------------------------------------------------------
    {
      id: 'whole', title: 'Chapter 8: The whole sheet', short: 'the sheet, finished', minutes: 10, page: 0, noun: 'chapter',
      intro: 'Everything the course traced and counted, done in one pass, then set beside the reference takeoff run by run. Then the marked-up sheet on paper.',
      seed() { scaleP101(); },
      steps: [
        { id: 'lay', title: 'Finish the takeoff', kind: 'do', cardAt: 'bl',
          body: 'Every fixture under its tag, every run by size and material: the service, the trunk, the hot supply and its return, the branches, the sanitary and grease lines, the gas. Do as much as you like by hand; the button lays whatever is left.\n1. Count and trace until the status line stops naming what is missing.',
          target: ['#annCanvas'], check: takeoffComplete, hint: takeoffHint,
          action: { label: 'Finish the takeoff for me', run: layEverything } },
        { id: 'compare', title: 'Against the reference', kind: 'read', cardAt: 'tl',
          body: compareBody,
          target: [], check: () => true },
        { id: 'legend', title: 'The legend on the sheet', kind: 'do', hold: true,
          body: '1. In the left sidebar, click the SUMMARY heading.\nSummary Legend sets how the on-sheet legend draws: a tally for plumbing, or a compact ruled block the way an engineer draws one. It lists every counter and every line type with its feet, so the marked-up sheet reads without the app.',
          target: ['#legendSettingsModal .modal-card', '#summarySectionTitle'], check: () => K().modalUp('legendSettingsModal'),
          action: { label: 'Open Summary Legend', run: () => { if (App.openLegendSettingsModal) App.openLegendSettingsModal(); } } },
        { id: 'pdfs', title: 'The marked-up set', kind: 'do', hold: true,
          body: '1. Under EXPORT OPTIONS, click [[Export PDFs]].\nChoose the sheets, set marker and line sizes for print, and let the report and the noted sheets ride along. This is the set the GC reads and the foreman builds from.',
          target: ['#specificPagesModal .modal-card', '#specificPages', '#exportOptionsSectionTitle'], check: () => K().modalUp('specificPagesModal'),
          action: { label: 'Open Export PDFs', run: () => { if (App.openSpecificPagesModal) App.openSpecificPagesModal(); else el('specificPages').click(); } } },
      ],
      done: 'The whole sheet, counted and traced, checked against the reference, and on paper.\nNext: [[Learn]] → Chapter 9, the bid.',
    },
    // 9 -------------------------------------------------------------------------------------
    {
      id: 'bid', title: 'Chapter 9: Check it, prove it, hand it off', short: 'a bid you can defend', minutes: 8, page: 0, noun: 'chapter',
      intro: 'What each Bid Check row means in the trade, which ones the sheet already answers, where a number came from when someone asks, and the ways out of the app.',
      seed() {
        const b = seedCopperBranch();
        b.cu.childCounts = [K().hangerRuleFor(b.cu)];
        const k = K();
        markMissing(pick('fd'), [k.FD.kitchen1, k.FD.kitchen2, k.FD.kitchen3]);
        const ss = k.makeLineType('4in PVC', '#8a4bb0');
        if (!polylinesOn(RE.pvc4).length) tracePlan(ss, G.ssRun, 'Sanitary');
      },
      steps: [
        { id: 'open', title: 'Open Bid Check', kind: 'do',
          body: '1. In the left sidebar, click BID CHECK to expand it.\nRows marked AUTO are judged by the app from your runs. The rest are questions only you can answer.',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false,
          action: { label: 'Open it', run: () => { S().bidCheckCollapsed = false; if (App.renderBidCheck) App.renderBidCheck(); App.updateUI(); } } },
        { id: 'rows', title: 'What the rows mean', kind: 'read',
          body: 'The manual rows read: fixture units against the building drain, trap arm lengths, slope on every waste run, backflow and water-heater venting.\nWhich of them did the engineer already answer on this set?',
          reveal: 'All four, on paper. P-501 adds the drainage load to 47 DFU and the 4" sewer carries 180 (IPC 710). The riser dimensions the trap arms against Table 1002.2. The general notes give the slope. The RPZ is the backflow answer, and the WH keynote says 100 GAL GAS, so it has a flue.\nThe rows are there because the bid is yours, not the engineer\'s. You tick each one when you have READ the answer, because the sheet that missed one is the change order you eat.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => true },
        { id: 'tick', title: 'Sign what you have read', kind: 'do',
          body: '1. In BID CHECK, click the words Scale verified on every counted sheet.\n2. Click Fixture units checked against the building drain size.\n3. Click Trap arm lengths within the table.\nYour ticks are saved with the bid. Hand off with a row still open and the app asks once, then remembers.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => manual('scale-verified') && manual('fixture-units') && manual('trap-arms'),
          action: { label: 'Tick the three for me', run: () => { tick('scale-verified'); tick('fixture-units'); tick('trap-arms'); } } },
        { id: 'proof', title: 'Where did that number come from?', kind: 'do', hold: true,
          body: '1. In the left sidebar, under SUMMARY, click the FD-1 total.\nThe breakdown shows the count sheet by sheet with a thumbnail of where every mark sits, zones already applied. This is what you open when the GC questions the number.',
          target: ['#summaryCountDetailModal .modal-card', '#summaryList .summary-item-clickable', '#summarySectionTitle'], check: () => K().modalUp('summaryCountDetailModal'),
          action: { label: 'Open the breakdown', run: () => { const c = counter(RE.fd); if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); } } },
        { id: 'ledger', title: 'Every question in one list', kind: 'do', hold: true,
          body: '1. In the header, click [[Notes ledger]], the page icon with the count on it.\nIt lists every note on every sheet, RFI flags first, and a click takes you to the spot. Read it once before the bid goes out.',
          target: ['#notesLedgerBtn'], check: () => { const b = el('notesLedgerBtn'); return !!b && b.getAttribute('aria-expanded') === 'true'; },
          action: { label: 'Open it for me', run: () => { if (App.openNotesLedger) App.openNotesLedger(); else if (el('notesLedgerBtn')) el('notesLedgerBtn').click(); } } },
        { id: 'handoff', title: 'Hand it off', kind: 'read',
          body: '1. [[Copy to /Tooling]] puts the whole takeoff on the clipboard for the bid in PipeTooling: fixtures, feet, hangers and fittings under their pipe, primers under their drains. Its first line names exactly what was copied.\n2. [[Copy RFI Flags]] puts your questions beside it.\n3. [[Show Report]] is the full breakdown for the bid file.\nMore: [Reports and exports](/guides/reports-and-exports/).',
          target: ['#forPipeTooling', '#exportOptionsSectionTitle'], check: () => true },
      ],
      done: 'That is the course: a restaurant\'s plumbing read off the engineer\'s set, counted with the app, checked, and handed to the bid.\nWhen you are ready for a real set, click [[Upload PDF]]. The guides live under Project Settings → Help.',
    },
  ];

  // ----- progress, the menu section, the doors ---------------------------------------------
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
        App.openLearnMenu(undefined, next ? next.id : null);   // back to the menu, at the course, the next chapter lit
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
    const list = el('learnCourseList');
    if (!list) return;
    const done = courseDone();
    const lit = nextId === undefined ? suggested() : nextId;
    const count = CHAPTERS.filter((c) => done[key(c.id)]).length;
    const esc = App.escapeHtml || ((t) => String(t));
    list.innerHTML = CHAPTERS.map((c, i) => '<button type="button" class="learn-row' + (done[key(c.id)] ? ' learn-row-done' : '') + (c.id === lit ? ' learn-row-next' : '') + '" data-chapter="' + c.id + '">'
      + '<span class="learn-row-no">' + (done[key(c.id)] ? '✓' : (i + 1)) + '</span>'
      + '<span class="learn-row-text"><span class="learn-row-title">' + esc(c.title.replace(/^Chapter \d+: /, '')) + '</span><span class="learn-row-sub">' + esc(c.intro) + '</span></span>'
      + '<span class="learn-row-min">' + c.minutes + ' min</span></button>').join('');
    const prog = el('learnCourseProgress');
    if (prog) prog.textContent = count === CHAPTERS.length ? 'All ' + CHAPTERS.length + ' chapters done' : count + ' of ' + CHAPTERS.length + ' done';
    list.querySelectorAll('.learn-row').forEach((row) => { row.onclick = () => startChapter(row.dataset.chapter); });
  }
  const openAtCourse = () => App.openLearnMenu(undefined, suggested());

  // wiring (static DOM)
  el('canvasEmptyHintCourse') && (el('canvasEmptyHintCourse').onclick = (e) => { e.preventDefault(); openAtCourse(); });
  el('settingsCourse') && (el('settingsCourse').onclick = () => { App.hideModal('settingsModal'); openAtCourse(); });
  // /app/?course=plumbing opens the menu at the course; /app/?chapter=plumbing:<id> starts that chapter.
  try {
    const params = new URLSearchParams(location.search);
    const chapter = String(params.get('chapter') || '');
    const want = chapter.startsWith(COURSE + ':') ? chapter.slice(COURSE.length + 1) : null;
    if (want && CHAPTERS.some((c) => c.id === want)) {
      App.setTutorialPending(true);   // the boot's restore offer waits, as it does for ?tour= and ?lesson=
      setTimeout(() => { App.setTutorialPending(false); startChapter(want); }, 600);
    } else if (params.get('course') === COURSE) {
      App.setTutorialPending(true);
      setTimeout(() => { App.setTutorialPending(false); openAtCourse(); }, 600);
    }
  } catch (_) { App.setTutorialPending && App.setTutorialPending(false); }

  App.renderCourseList = renderCourseList;
  App.startChapter = startChapter;
  App.courseChapterIds = () => CHAPTERS.map((c) => c.id);
  App.courseDone = courseDone;
  App.courseReference = () => ({ feet: referenceFeet(), counts: COUNTS().map(([tag, spots, label]) => [label, spots.length]) });
})();
