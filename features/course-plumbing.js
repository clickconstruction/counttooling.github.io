/*
 * features/course-plumbing.js - the plumbing course: how a restaurant gets its plumbing,
 * taught on the engineered sample plan with the app's own tools. Nine chapters on the
 * tour engine (features/tutorial.js), each the length of a lesson, resumable, ticked on
 * the device, and ahead of them an uncounted opener, "Before you count" (id `before`,
 * reading cards only), for a reader who has never seen a construction drawing. Plan of
 * record: journeys/plans/PLUMBING-COURSE.md.
 *
 * The reader is anyone at all (COURSE-LANGUAGE-2026-09-27, option C): every trade and app
 * word is glossed the first time the course uses it, a doing card leads with its steps (the
 * previous card's answer sits above them under "Answer:", the longer reasoning after them),
 * and no card sentence runs past 25 words.
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
 * The runner is the lessonKit's, one for every course (R15): `registerCourse` registers the
 * chapters' tours, ticks progress per device in localStorage `clickcount-course-done`,
 * { 'plumbing:<id>': ISO } (the one map every course shares, App.courseDone), and wires the
 * doors: the Learn menu's course section (#learnCourseList-plumbing), the empty-canvas
 * "plumbing course" link, Project Settings → Help → "plumbing course", /app/?course=plumbing
 * (the menu, at the course) and /app/?chapter=plumbing:<id>. The copied helpers (markMissing,
 * dropAt, tickManual, openBidCheck, feetFor, pts / raw / planFeet, guide, rectsOf, memoProof)
 * are the kit's too.
 *
 * Registrations: startChapter(id), courseChapterIds(), courseReference() (the reference
 * quantities, for the spec).
 * Boundary rule: read shared deps from App.* at call time, never captured at load; the one
 * exception is the registerCourse call at the foot (lessons.js loads first).
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const COURSE = 'plumbing';
  const K = () => App.lessonKit;
  const T = () => App.tourKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
    cleanouts: [592, 210, 596, 436, 222, 544, 1060, 210, 900, 436, 440, 544],   // the upstream ends, then each line's first turn (IPC 708.1.4; PC-TRADE-6, 2026-09-27)
    vtrs: [700, 232, 700, 500],
    gasDrops: [724, 346, 774, 346, 812, 346, 838, 346],
    gas15: [840, 632, 840, 470],                                      // the 1-1/2" gas: the meter to the storage/kitchen wall (PC-TRADE-4)
    gas125: [840, 470, 840, 346, 700, 346],                           // the 1-1/4" gas: the wall, the corner, the range
    bar3cs: [197, 570], dish3cs: [605, 486], prepFs: [640, 346], dishFs: [668, 550],
    hb: [949, 490], rpz: [833, 591], hoodValve: [840, 390],
  };
  const R = {   // P-601, sheet points
    prove: [110, 268, 110, 520], stack: [520, 556, 520, 250], lavArm: [520, 493, 592, 493], co: [534, 540],
  };
  const pts = (flat) => K().pts(flat), raw = (flat) => K().raw(flat), planFeet = (flat) => K().planFeet(flat);   // the kit's flat-list readers
  const SCHEDULE_BOX = { x1: 110, y1: 130, x2: 930, y2: 330 };       // P-501 turned upright: the table, in the page's own points
  const WC1_ROW = { x1: 112, y1: 160, x2: 930, y2: 178 };

  // ----- readers ---------------------------------------------------------------------------
  const counter = (re) => K().counterNamed(re);
  const lineType = (re) => K().lineTypeNamed(re);
  const marks = (re) => K().marksOf(counter(re));
  const pageAnn = (i) => K().pageAnn(i == null ? K().P101 : i);
  const ann = () => pageAnn(K().P101);
  const typeIds = (re) => new Set(K().lineTypesMatching(re).map((l) => l.id));   // every type the word names (see the kit's lineTypesMatching)
  const polylinesOn = (re, pageIdx) => { const a = pageAnn(pageIdx); const ids = typeIds(re); return a ? (a.polylines || []).filter((pl) => ids.has(pl.lineTypeId)) : []; };
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
  const runsOn = (re, pageIdx) => { const pls = polylinesOn(re, pageIdx).map((pl) => pl.points || []); const d = S().drawingPolyline; return d && d.points && typeIds(re).has(d.lineTypeId) ? pls.concat([d.points]) : pls; };
  const traceZones = (re, spots, pageIdx) => T().pathZones(spots, 15, runsOn(re, pageIdx));
  const allDone = (zs) => T().allDone(zs);
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
    pvc4: /\b4\s*in.*pvc/i, pvc3: /\b3\s*in.*pvc/i,
    // the gas main is two sizes (PC-TRADE-4, 2026-09-27): `gas` is the 1-1/4" the cook line's corner,
    // drops and hanger row sit on, `gas15` the 1-1/2" from the meter to the kitchen wall
    gas: /1\.25\s*in.*\b(bi|black iron|steel)\b/i, gas15: /(^|[^.\d])1\.5\s*in.*\b(bi|black iron|steel)\b/i,
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
  // The chapter 3 line types the chain and the traces need, by the name the Quick tab gives them.
  const COPPER_SIZES = [
    { name: '1.5in Copper', re: /(^|[^.\d])1\.5\s*in.*copper/i },
    { name: '1.25in Copper', re: /1\.25\s*in.*copper/i },
    { name: '0.75in Copper', re: /(^|[^.\d])0?\.75\s*in.*copper(?!.*hwr)/i },
  ];
  const copperStillToMake = () => COPPER_SIZES.filter((c) => !(S().lineTypes || []).some((lt) => c.re.test(lt.name || ''))).map((c) => c.name);
  // Each Prove it step's proof (features/tutorial.js measureProof): the dimension drawn between its
  // circles, a circle that ticks as its click lands, a hint that names the miss, and the reading held
  // on the card. Built once, on first use, through the kit's memo.
  const proveP101 = () => K().memoProof('plumbing:P101', () => ({ page: K().P101, ends: pts(G.dim318), r: 13, ft: 31.67, tol: 0.4, stated: '31\'-8"' }));
  const proveP601 = () => K().memoProof('plumbing:P601', () => ({ page: K().P601, ends: raw(R.prove), r: 13, ft: 14, tol: 0.4, stated: '14\'-0"' }));
  const proveP401 = () => K().memoProof('plumbing:P401', () => ({ page: K().P401, ends: K().DETAIL.prove, r: 16, ft: 12, tol: 0.4, stated: '12\'-0"' }));
  // The lavatory's trap arm takes the same proof, so a 4'-0" read off another arm (the floor drain's,
  // dimensioned 4'-0" under the slab) does not pass. The circles reach the dimension 15 pt under
  // the pipe; the floor drain's nearest end is 43 pt away (DS-AGENT-NITS, 2026-09-27).
  const lavArmP601 = () => K().memoProof('plumbing:P601arm', () => ({ page: K().P601, ends: raw(R.lavArm), r: 18, ft: 4, tol: 0.3, stated: '4\'-0"' }));
  let armEntryMeasure = null;   // the 14'-0" read on Prove it is still the sheet's last measure
  const pick = (tag) => { const t = TAGS[tag]; const have = counter(t[0]); return have && !K().isStanding(have.id) ? have : K().makeCounter(t[1], t[2], t[3]); };   // never adopts the reader's standing counter
  const markMissing = (c, spots, pageIdx) => K().markMissing(c, spots, pageIdx);   // P-101 unless a page is named
  const SPOTS = () => { const k = K(); return {
    wc: k.WCS, lav: k.LAVS, ms: [k.MOP], hs: k.HAND_SINKS,
    fdRestrooms: [k.FD.men, k.FD.women, k.FD.mop], fdRest: [k.FD.bar1, k.FD.bar2, k.FD.kitchen1, k.FD.kitchen2, k.FD.kitchen3, k.FD.dish, k.FD.storage],
    tcs: pts(G.bar3cs.concat(G.dish3cs)), fs: pts(G.prepFs.concat(G.dishFs)),
    hb: pts(G.hb), rpz: pts(G.rpz), co: pts(G.cleanouts), vtr: pts(G.vtrs), gasDrop: pts(G.gasDrops),
  }; };
  const FD_LABELS = ['MEN', 'WOMEN', 'the mop room', 'the bar (west)', 'the bar (east)', 'the kitchen (west)', 'the kitchen (middle)', 'the kitchen (east)', 'the dish pit', 'storage'];
  const HS_LABELS = ['the bar', 'the cook line', 'the kitchen exit'];
  const CO_LABELS = ['under MEN, the sanitary line\'s start', 'the kitchen aisle\'s start by the door', 'the bar\'s start', 'the turn outside the east wall', 'the kitchen aisle\'s first turn, by the exit', 'the bar line\'s first turn, by the server station'];
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
  const gasZones = () => traceZones(RE.gas15, pts(G.gas15), K().P101).concat(traceZones(RE.gas, pts(G.gas125), K().P101));   // the main in its two sizes (PC-TRADE-4)
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
    { key: 'gas15', re: RE.gas15, name: '1.5in BI', color: '#b03a2e', flat: G.gas15, drop: 0, label: 'the 1-1/2 inch gas from the meter to the kitchen wall' },
    { key: 'gas', re: RE.gas, name: '1.25in BI', color: '#e85447', flat: G.gas125, drop: 0, label: 'the 1-1/4 inch gas from the kitchen wall to the range' },
  ];
  const runFlat = (r) => r.flat;
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
  // The reader's takeoff is the kit's feetFor, read off the same summary Copy to /Tooling copies.
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
      if (have <= wanted) { tracePlan(lt, runFlat(r), r.label); if (r.drop) K().dropAt(pts(runFlat(r))[0], r.drop); }
      if (/copper|pvc/i.test(lt.name)) addHangerRule(lt);
      enableBends(lt);
    });
    K().dirty();
  }
  function takeoffComplete() {
    const ref = referenceFeet();
    const runsOk = RUNS.every((r) => K().feetFor(r.re, r.key === 'hwr' ? null : RE.hwr) >= ref[r.name] * 0.95);
    const countsOk = COUNTS().every(([tag, spots]) => markCountNear(TAGS[tag][0], spots, 8) >= spots.length);
    return runsOk && countsOk;
  }
  function takeoffHint() {
    const ref = referenceFeet();
    const run = RUNS.find((r) => K().feetFor(r.re, r.key === 'hwr' ? null : RE.hwr) < ref[r.name] * 0.95);
    if (run) return 'Not yet traced: ' + run.label;
    const c = COUNTS().find(([tag, spots]) => markCountNear(TAGS[tag][0], spots, 8) < spots.length);
    return c ? 'Not all counted: ' + c[2] : '';
  }
  // The lay step skipped with nothing done: the sheet carries no mark (PP-WHOLE-SKIP). The same
  // test the pdfs step passes on, since Export PDFs hides on it too.
  const takeoffSkipped = () => !App.projectHasAnyCanvasMarkup();
  // The compare card, rendered live: run by run, the reference's feet beside the reader's.
  function compareBody() {
    const ref = referenceFeet();
    const seen = new Set();
    const lines = ['Reference on the left, the right answer from the sheet\'s geometry. Yours on the right, from your Summary.'];
    RUNS.forEach((r) => {
      if (seen.has(r.name)) return; seen.add(r.name);
      const mine = K().feetFor(r.re, r.key === 'hwr' ? null : RE.hwr);
      const ok = mine >= ref[r.name] * 0.95 && mine <= ref[r.name] * 1.05;
      lines.push(r.name + ': ' + fmtFt(ref[r.name]) + ' ft, yours ' + fmtFt(mine) + ' ft' + (ok ? ' ✓' : mine < ref[r.name] * 0.95 ? ', short: ' + r.label : ', over: check for a doubled run'));
    });
    const branches = K().feetFor(RE.copper75cw, RE.hwr);
    lines.push('0.75in Copper CW branches: 10.7 ft, yours ' + fmtFt(branches) + ' ft' + (branches >= 10 ? ' ✓' : ', short: the chained lavatories'));
    const bad = COUNTS().filter(([tag, spots]) => markCountNear(TAGS[tag][0], spots, 8) < spots.length).map((c) => c[2]);
    lines.push(bad.length ? 'Counts short: ' + bad.join(', ') + '.' : 'Every count matches: twelve fixture types, thirty-six marks.');
    lines.push('A takeoff within a few feet of the geometry is right: the last inch is the click. What matters is that nothing is missing, and the row above says so.');
    return lines.join('\n');
  }

  // ===== the chapters =========================================================================
  const CHAPTERS = [
    // 0 -------------------------------------------------------------------------------------
    // The uncounted opener (COURSE-LANGUAGE option C, 2026-09-27): for a reader who has never
    // seen a construction drawing. Reading steps only, no zones; it names the words the nine
    // chapters take for granted. Its title carries no "Chapter N:", so it stays outside the count.
    {
      id: 'before', title: 'Chapter 0: Before you count', short: 'the ground the course stands on', minutes: 4, page: 0, noun: 'chapter',
      intro: 'For anyone who has never seen a construction drawing. What the sheets are, what an estimator does with them, and how the app and its cards work.',
      opener: 'These cards are for reading: nothing here asks for a click on the sheet.\nThe four sheets that open are a sample, a small restaurant. Nothing here touches your own projects.',
      seed() { /* nothing: this chapter only reads */ },
      steps: [
        { id: 'set', title: 'A set of drawings', kind: 'read', cardAt: 'tl',
          body: 'A building is drawn before it is built. The drawings come as a set: one sheet per page, often dozens of them.\nEach trade gets its own sheets, and a letter in the sheet number says whose. P is plumbing: the P-sheets show the pipes, the fixtures and the drains. An engineer, the designer who drew the pipes and did their sums, drew them.\nA fixture is anything that uses water: a sink, a toilet, a floor drain.\nThis course opened four P-sheets for a small restaurant. The one on screen, P-101, is the floor plan: the building seen from above, every pipe drawn on it.\nThe box at the bottom right is the title block. It holds the sheet\'s name, its number and its scale.',
          target: ['#annCanvas'], check: () => true },
        { id: 'estimator', title: 'What an estimator does', kind: 'read',
          body: 'Before a building goes up, contractors bid for the work. Each one names a price, and one of them gets the job.\nThe estimator is the person who works out that price, the bid. It takes three moves.\nCount what is drawn: every toilet, sink and drain.\nMeasure what is run: the feet of each pipe, by size and material.\nPrice it: each count and each foot times its cost.\nThe count and the feet together are the takeoff. The price is built on it, so a miss in the takeoff is money lost.\nThis course teaches the takeoff.',
          target: [], check: () => true },
        { id: 'verbs', title: 'Count, trace, chain, check', kind: 'read',
          body: 'The app counts and measures as you click. Four verbs carry the course.\nCount: arm a counter, a named tally such as WC-1 Water Closet (a water closet is a toilet). Armed, every click on the sheet leaves one mark.\nTrace: click along a pipe, corner by corner, in a line type such as 1.5in Copper. A line type is one kind of pipe, by size and material; the app measures its feet.\nChain: one click places a fixture and draws the pipe back to the last one.\nCheck: BID CHECK, a list in the sidebar, asks what a bid must answer before it goes out.\nThe feet mean nothing until the sheet has a scale: how many feet of building one inch of paper stands for.',
          target: [], check: () => true },
        { id: 'screen', title: 'Where things are', kind: 'read', cardAt: 'tr',   // top right, over the sheet: the card is about the sidebar, the header and the footer
          // a tablet has no keys: the engine takes "(or press D)" out of a card, so the line that quotes it goes too
          body: () => 'The {{left sidebar|.sidebar}} holds your lists. PAGES is the sheets. COUNTERS and LINE TYPES are what you count and what you trace.\nSUMMARY is the running totals. BID CHECK and EXPORT OPTIONS sit below it.\nThe {{header|.header}} across the top holds the tools, such as [[Set Scale]] and [[Measure]]. The ones not shown sit behind [[⋯]].\nThe {{footer|.page-zoom-row}} under the sheet {{turns the pages|.page-nav}} and switches {{layers|#canvasLayersBtn}}: clear sheets laid over the plan, each with its own marks.' + ((window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 768px)').matches) ? '' : '\nMost tools have a one-key shortcut. The cards give it in brackets, such as (or press D).'),
          target: ['.sidebar', '.header', '.page-zoom-row'], lightAll: true, check: () => true },
        { id: 'cards', title: 'How a card works', kind: 'read',
          body: 'Each card asks for one thing. A doing card lists its steps, one action per numbered line.\nEvery doing card ends with a line beside [[Show me where]]. It reads Waiting for you…, then what is still missing, then ✓ Done.\n[[Next]] lights up once the step is done.\n[[Show me where]] points at the control, or at the circle on the sheet where your click counts.\nA question card hides its answer behind [[Show the engineer\'s answer]]. Try to answer first.\nStuck? [[Skip this step]] moves on. Nothing here touches your own projects.',
          target: [], check: () => true },
      ],
      done: 'What a set is, what a takeoff is, the four verbs, and how a card works.\nNext: Chapter 1, read the sheet.',
    },
    // 1 -------------------------------------------------------------------------------------
    {
      id: 'sheet', title: 'Chapter 1: Read the sheet', short: 'the sheet, read', minutes: 8, page: 0, noun: 'chapter',
      intro: 'Before a single count: what a plumbing plan says in its legend and its keynotes. Where the pipe sizes and the fixture units come from. And a scale you proved.',
      opener: 'The sheets open on P-101, the floor plan, with no scale set.\nSetting the scale, and proving it, is the first work here.',
      seed() { /* nothing: the scale is the chapter's */ },
      steps: [
        { id: 'what', title: 'What kind of sheet is this?', kind: 'read', cardAt: 'tl',   // top left: at the bottom right the card sat on the title block it asks the reader to look at
          body: 'Look at the title block at the bottom right, then the legend beside it: the key to the sheet\'s lines and symbols.\nThe P in P-101 says plumbing. Which other letters would a full set carry? And what do the legend\'s six line styles mean for the bid?',
          reveal: 'P is the discipline, the trade a sheet belongs to. A sheets are the architect\'s, S structural (the frame), M mechanical (heating and air), E electrical, P plumbing.\nThis sheet carries every plumbing system in the building. The legend names each one by its line.\nCold water is solid and hot water dashed. The hot water return, hot water on its way back to the heater, is dotted.\nGas is dash-dot. Sanitary, the waste from toilets and sinks, is a heavy dash. Grease waste, the kitchen\'s drains, is the same dash, lighter.\nAn estimator reads the legend first. Every line on the sheet is one of these, and each one is a different pipe, a different crew and a different price.',
          target: ['#annCanvas'], check: () => true },
        { id: 'scale', title: 'Set the scale', kind: 'do',
          body: 'The title block says 1/8" = 1\'-0": an eighth of an inch on paper is a foot of building. The scale bar at the bottom left, a printed ruler, agrees.\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/8" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => K().scaleIs(K().P101, 9),
          action: { label: 'Use 1/8" = 1\'-0"', run: async () => { K().goPage(K().P101); await T().applyScalePreset('1/8" = 1\'', 9); } } },
        { id: 'prove', title: 'Prove it', kind: 'do', cardAt: 'bl', page: 0, hold: true,
          body: () => (proveP101().check()
            ? proveP101().verdict() + ': the scale is right.\nDo this on every sheet, every time.'
            : 'A PDF, a drawing file, shrunk to letter size keeps its title block and its scale bar, and measures short. Only a dimension, a length the engineer wrote on the sheet, can prove the scale.\n1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at the left end of the 31\'-8" string: the dimension line above the kitchen half.\n3. Click inside circle 2, at its right end.'),
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => proveP101().check(), hint: () => proveP101().hint(), zones: () => proveP101().zones(),
          action: { label: 'Measure the 31\'-8" string', run: async () => { K().goPage(K().P101); if (!K().scaleIs(K().P101, 9)) await T().applyScalePreset('1/8" = 1\'', 9); const d = pts(G.dim318); K().measure(d[0], d[1]); } } },
        { id: 'keynotes', title: 'Find the fixture the eye skips', kind: 'do',   // no corner: the card sits beside the lit + Add, off the sidebar and off the keynote column
          body: 'Each hexagon on the plan is a keynote: a short tag, such as WC or FD, that the column at the right spells out. One tag marks a fixture with no room around it.\n1. Read the keynote column for HB.\n2. In the left sidebar, under COUNTERS, click {{+ Add|#addCounter}}, and on the {{Create|#counterModal .counter-tab[data-tab="create"]}} tab make a counter named HB Hose Bibb.\n3. Find the HB tag on the plan and click the fixture beside it.\nA hose bibb is an outdoor faucet for a hose.',
          // + Add is lit until the counter is made, then the sheet, where the click goes
          target: () => (counter(RE.hb) ? ['#annCanvas', '#counterCreate', '#addCounter'] : ['#counterCreate', '#addCounter', '#annCanvas']),
          check: () => markNear(RE.hb, SPOTS().hb[0], 12),
          hint: () => (marks(RE.hb) ? 'Not that one. The east wall, outside the kitchen exit door, off the 3/4" cold line' : (K().armedNamed(RE.hb) ? 'The counter is armed: click the hose bibb' : '')),
          action: { label: 'Find it and count it for me', run: () => { App.pushUndoSnapshotCurrentPage(); markMissing(pick('hb'), SPOTS().hb); K().dirty(); } } },
        { id: 'schedule', title: 'The schedule', kind: 'do',
          body: 'Answer: HB, a freezeproof wall hydrant, an outdoor faucet that cannot freeze. It is one symbol on a busy sheet, the kind a takeoff misses while the eye is on the restrooms.\nPipe sizes come from the fixture schedule, a table on P-501. It was scanned on its side.\n1. In the left sidebar, under PAGES, click P-501.\n2. In the footer, click [[Rotate 90° right]] (or press R).\nThe crew washes the dumpster pad, the concrete slab the dumpster stands on, with that hydrant. Read the keynote column once before you count.',
          target: () => (K().onPage(K().P501) ? ['#rotatePage'] : ['#pagesList', '#rotatePage']),   // the list first, the footer button once the sheet is up
          check: () => K().onPage(K().P501) && rotationOf(K().P501) === 90,
          hint: () => (K().onPage(K().P501) && rotationOf(K().P501) ? 'Keep turning until the title reads left to right' : ''),
          action: { label: 'Open P-501 and turn it', run: () => { K().goPage(K().P501); if (rotationOf(K().P501) !== 90) el('rotatePage').click(); } } },
        { id: 'row', title: 'Read a row', kind: 'do', cardAt: 'br',
          rules: ['plumb.wsfu.fixtures'],
          body: 'Which row drains the most? And why is its waste 4" when a hand sink\'s, a sink kept only for washing hands, is 1-1/2"?\n1. In the header, click [[⋯]], then [[Highlight]] (or press H).\n2. Drag a box over that row. A highlight is a see-through color box.\nEach row is one tag from the plan. Its columns give the cold and hot supply sizes, the water pipes in. W is the waste, the drain out. V is the vent, the pipe that lets air into the drain.\nThe last two numbers are what the engineer sized the pipe from. WSFU, water supply fixture units, is the code\'s number for how much water a fixture draws. DFU, drainage fixture units, is how much it drains.',
          target: ['#highlightBtn', '#highlightBtnSidebar', '#headerMoreBtn'],
          check: () => { const a = pageAnn(K().P501); return !!a && (a.highlights || []).some((h) => Math.min(h.x1, h.x2) <= 400 && Math.max(h.x1, h.x2) >= 400 && Math.min(h.y1, h.y2) <= 169 && Math.max(h.y1, h.y2) >= 169); },
          hint: () => { const a = pageAnn(K().P501); return a && (a.highlights || []).length ? 'Not that row. Read down the DFU column for the biggest number' : ''; },
          action: { label: 'Highlight WC-1 for me', run: () => { const k = K(); uprightSchedule(); k.goPage(k.P501); const a = App.ensureActiveCanvas(S().pages[k.P501]).annotations; if (!a.highlights) a.highlights = []; if (a.highlights.length) return; App.pushUndoSnapshotCurrentPage(); a.highlights.push(Object.assign({ color: '#e8c547', opacity: 0.25, id: App.uid() }, WC1_ROW)); S().tool = App.TOOL.NONE; k.dirty(); } } },
        { id: 'units', title: 'Fixture units', kind: 'read', cardAt: 'br',
          rules: ['plumb.wsfu.fixtures'],
          body: 'Answer: WC-1, the water closet, a toilet, at 4 DFU. A flush-valve water closet, flushed straight off the water line, dumps its water in seconds. A hand sink drains a trickle at 1.\nThe IPC, the International Plumbing Code, rates every fixture in drainage fixture units. It sizes the pipe under the fixtures from the total (IPC 709 and 710). The same idea, in WSFU, sizes the water supply (IPC 604).\nThe 4" waste is the engineer\'s choice. The code\'s least is 3" for the drain under the building once a water closet empties into it (IPC Table 710.1(1)). Solids, not the 4 DFU, set the size.\nNote 4 under the table adds them up: 51 DFU on P-101. Why is the building sewer, the pipe that takes all the waste out, 4" and not 3"?',
          reveal: 'A 3" sewer at 1/8" per foot carries 36 DFU (IPC Table 710.1(1)). 1/8" per foot is its slope: it falls an eighth of an inch every foot. 51 needs the 4", which carries 180. The engineer did that sum. The estimator prices the 4" pipe, and notices when the plan and the schedule disagree. That calls for an RFI, a request for information: a written question to the designer.',
          target: ['#annCanvas'], check: () => true },
      ],
      done: 'The title block, the legend, the keynotes, the schedule with its fixture units, and a scale you proved.\nNext: Chapter 2, the fixtures and where they sit.',
    },
    // 2 -------------------------------------------------------------------------------------
    {
      id: 'fixtures', title: 'Chapter 2: The fixtures, and where they sit', short: 'every fixture counted', minutes: 10, page: 0, noun: 'chapter',
      intro: 'Why the restrooms share a wall, which hand sink serves the cooks, and what a floor sink is for. Then every fixture on the sheet counted, under counters the schedule itself made.',
      opener: 'The sheets open with the scale of P-101 set and P-501 turned upright, as chapter 1 left them.\nThe counters are yours to make.',
      seed() { scaleP101(); uprightSchedule(); },
      steps: [
        { id: 'wetwall', title: 'Where the water goes', kind: 'do', cardAt: 'bl', page: 0, zones: () => K().guide(K().WCS, 14, K().measured(K().P101, 11.33, 0.7)),
          body: 'Look at MEN and WOMEN, the two restrooms. Both water closets sit on the top wall, where the water runs. One vent stack, the upright pipe that lets the drains breathe, rises in the wall between the rooms.\n1. In the header, click [[Measure]] (or press D).\n2. Click the water closet in MEN, then the water closet in WOMEN.\nHow far apart are the two water closets?',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => K().measured(K().P101, 11.33, 0.7),
          hint: () => { const lm = S().lastMeasure; return lm && lm.pageIdx === K().P101 && T().measuredFeet() != null ? 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + '. Try water closet to water closet' : ''; },
          action: { label: 'Measure it for me', run: () => { const k = K(); k.goPage(k.P101); k.measure(k.WCS[0], k.WCS[1]); } } },
        { id: 'counters', title: 'Counters from the schedule', kind: 'do',
          body: 'Answer: eleven feet, water closet to water closet. The rooms repeat, they do not mirror: each lavatory hangs on its own room\'s west wall.\nName counters the way the schedule tags them, and let the sheet do the typing.\n1. Under PAGES, click P-501.\n2. Under COUNTERS, click {{+ Add|#addCounter}}, then the {{Create|#counterModal .counter-tab[data-tab="create"]}} tab, then [[Read a schedule from the sheet…]].\n3. Drag a box over the whole schedule table.\n4. Click [[Create counters]].\nBoth rooms hang off one top-wall run and one stack. Its VTR, vent through roof, sits in the wall between them.\nA wet wall is one wall that carries both rooms\' pipes, with the fixtures set back to back in it. Back to back saves pipe: a foot the bid does not carry. Scattered fixtures mean long branches, the smaller pipes out to each one.',
          // PAGES is lit until P-501 is up, then + Add
          target: () => ['#schedulePaletteCreate', '#counterReadSchedule', '#counterModal .counter-tab[data-tab="create"]'].concat(K().onPage(K().P501) ? ['#addCounter', '#pagesList'] : ['#pagesList', '#addCounter']),
          check: () => !!(counter(RE.wc) && counter(RE.fd) && counter(RE.hs)),
          action: { label: 'Read the schedule for me', run: readSchedule } },
        { id: 'restrooms', title: 'Count the restrooms', kind: 'do', cardAt: 'bl', page: 0, zones: restroomZones,
          body: 'Eight counters, one per tag, from the text the engineer already typed. A scan is only a picture, with no words to read, so there the Create tab is the way.\nU-1, the urinal, has a row but no symbol on P-101. A schedule row with nothing drawn is a question for an RFI.\n1. Under PAGES, click P-101.\n2. In the sidebar, click WC-1 to arm it, and click the two water closets.\n3. Arm FD-1 and click the floor drain in MEN, in WOMEN and in MOP.\n4. Arm L-1 and click the two lavatories, the bathroom sinks.\n5. Arm MS-1 and click the mop sink, the low sink the mop bucket is filled and emptied at.',
          target: () => (K().onPage(K().P101) ? ['#annCanvas', '#countersList', '#pagesList'] : ['#pagesList', '#countersList']),   // PAGES is lit until P-101 is up
          check: () => allDone(restroomZones()),
          hint: () => { const s = SPOTS(); return hintFor([row('WC-1', RE.wc, s.wc, ['MEN', 'WOMEN']), row('FD-1', RE.fd, s.fdRestrooms, ['MEN', 'WOMEN', 'the mop room']), row('L-1', RE.lav, s.lav, ['MEN', 'WOMEN']), row('MS-1', RE.ms, s.ms, ['the mop room'])]); },
          action: { label: 'Count the restrooms for me', run: () => { const s = SPOTS(); K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('wc'), s.wc); markMissing(pick('fd'), s.fdRestrooms); markMissing(pick('lav'), s.lav); markMissing(pick('ms'), s.ms); K().dirty(); } } },
        { id: 'handsinks', title: 'Which hand sink serves the cook line?', kind: 'do', cardAt: 'bl',
          body: 'There are three HS tags on the plan: hand sinks, sinks kept only for washing hands. The cook line is the row of stoves and fryers, the range among them, against the hall wall. A range is a big stove.\n1. In the sidebar, click HS-1 to arm it.\n2. Click the one hand sink on the cook line\'s own wall.',
          target: ['#annCanvas', '#countersList'], check: () => markNear(RE.hs, K().HAND_SINKS[1], 10),
          hint: () => (marks(RE.hs) ? 'Not that one: it serves ' + (markNear(RE.hs, K().HAND_SINKS[0], 10) ? 'the bar' : 'the kitchen exit') + '. The cook line stands against the hall wall, under HOOD ABOVE: its hand sink is on that wall' : ''),
          action: { label: 'Click it for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('hs'), [K().HAND_SINKS[1]]); K().dirty(); } } },
        { id: 'kitchen', title: 'Count the rest of the kitchen and the bar', kind: 'do', cardAt: 'tl', page: 0, zones: kitchenZones,
          body: 'Answer: the one on the cook line\'s wall, past the prep sink. The health code puts it there, not the plumbing code.\n1. Click the other two hand sinks: at the kitchen exit, and at the bar.\n2. Arm 3CS-1 and click the two 3-compartment sinks: in the bar, and in the dish pit, the dishwashing room. Each has three bowls: wash, rinse, sanitize.\n3. Arm FD-1 and click the seven floor drains in the bar, the kitchen, the dish pit and storage.\nThe FDA Food Code (5-204.11), the model health code for restaurants, wants a handwashing sink within reach of each food preparation area.\nSo the cook line and prep side, the kitchen exit and the bar each get one. A prep area without one is an RFI now, or a health inspector\'s order later.',
          target: ['#annCanvas', '#countersList'], check: () => allDone(kitchenZones()),
          hint: () => { const s = SPOTS(); return hintFor([row('HS-1', RE.hs, s.hs, HS_LABELS), row('3CS-1', RE.tcs, s.tcs, ['the bar', 'the dish pit']), row('FD-1', RE.fd, s.fdRest, FD_LABELS.slice(3))]); },
          action: { label: 'Count them for me', run: () => { const s = SPOTS(); K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('hs'), s.hs); markMissing(pick('tcs'), s.tcs); markMissing(pick('fd'), s.fdRest); K().dirty(); } } },
        { id: 'floorsinks', title: 'Which fixtures do not drain to the waste line?', kind: 'do', cardAt: 'bl', page: 0, zones: () => circlesOn(K().P101, RE.fs, SPOTS().fs),
          body: 'Two pieces of equipment on this sheet drain to an FS, a floor sink: a square drain set in the floor. They drain into it instead of straight into the pipe.\n1. Arm FS-1.\n2. Click both floor sinks: they are the squares with a circle inside.',
          target: ['#annCanvas', '#countersList'], check: () => allDone(circlesOn(K().P101, RE.fs, SPOTS().fs)),
          hint: () => (marks(RE.fs) ? 'One more: ' + (markNear(RE.fs, SPOTS().fs[0], 8) ? 'by the dishwasher in the dish pit' : 'below the prep sink on the hall wall') : ''),
          action: { label: 'Click both for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('fs'), SPOTS().fs); K().dirty(); } } },
        { id: 'primers', title: 'What the FD keynote costs', kind: 'do',
          rules: ['plumb.waste.indirect', 'plumb.trap.seal'],
          body: 'Answer: the prep sink and the dishwasher. Each is an indirect waste: its pipe ends at the floor sink with open air between them (IPC 802). The prep sink needs an air gap, a clear space above the rim. The dishwasher may use an air gap or an air break, a pipe that ends below the rim but above the water.\nNow the FD keynote: FLOOR DRAIN W/ TRAP PRIMER, TYP. TYP., typical, means every one, and none of the ten primers is drawn.\n1. In the sidebar, click the pencil beside FD-1.\n2. Under [[Child counts]], add a row: Trap primer, 1 per count. A child count rides along with every mark.\n3. Click {{Done|#counterLineTypeDetailsClose}}.\nA trap is the U-bend under a drain that holds water, so sewer gas stays down. A drain that sees no water for months dries out. The primer drips water into it from a cold line (IPC 1002.4). One primer valve with a small manifold, a pipe that splits one feed into several, can serve several drains. Then the bid carries fewer valves and more small tubing.\nWhy the gap: if the sewer backs up, it rises into the floor sink and onto the floor. It never reaches a sink food touches or a machine that washes plates. The floor sink is a fixture on the bid, and the indirect drain down to it is pipe you run.',
          target: () => T().ladder('#childCountsGroup', T().pencilOf('counter', counter(RE.fd)), '#countersSection'),
          check: () => { const c = counter(RE.fd); return !!(c && (c.childCounts || []).some((ch) => /primer/i.test(ch.name || ''))); },
          action: { label: 'Add Trap primer · 1 per count', run: () => { const c = pick('fd'); if ((c.childCounts || []).some((ch) => /primer/i.test(ch.name || ''))) return; App.pushUndoSnapshot(); c.childCounts = (c.childCounts || []).concat([{ name: 'Trap primer', qty: 1, per: 'count' }]); K().dirty(); } } },
        { id: 'keys', title: 'Put the counters on the number row', kind: 'do',
          body: 'Ten primers now ride the ten marks, and go if a mark goes. Quick keys put a counter on a number key, so pressing 1 arms it.\n1. In the {{status bar|.status-bar}} at the bottom right, click [[quick keys]].\n2. Beside key 1, choose FD-1.\n3. Beside key 2, choose HS-1.\n4. Close the dialog.\nOn a real sheet the rhythm is 1, click, click, 2, click, click, and the hand never leaves the plan.',
          target: ['#quickKeysModal .modal-card', '#statusBarQuickKeys'],
          // both keys, and the dialog closed, as the card says: on key 1 alone the step advanced and the
          // engine closed the dialog under a reader who had not reached key 2 (by hand, 2026-09-25)
          check: () => { const bound = (re) => { const c = counter(re); return !!c && Object.values(S().numberKeyBindings || {}).some((b) => b && b.id === c.id); }; return bound(RE.fd) && bound(RE.hs) && !K().modalUp('quickKeysModal'); },
          hint: () => { const bound = (re) => { const c = counter(re); return !!c && Object.values(S().numberKeyBindings || {}).some((x) => x && x.id === c.id); }; if (!bound(RE.fd)) return ''; if (!bound(RE.hs)) return 'Key 1 is FD-1. Now key 2: HS-1'; return K().modalUp('quickKeysModal') ? 'Both keys are set. Close the dialog' : ''; },
          action: { label: 'Bind 1 and 2 for me', run: () => { if (!S().numberKeyBindings) S().numberKeyBindings = {}; S().numberKeyBindings[1] = { kind: 'counter', id: pick('fd').id }; S().numberKeyBindings[2] = { kind: 'counter', id: pick('hs').id }; K().dirty(); } } },
      ],
      done: 'Twenty-two fixtures under seven schedule tags, a hydrant the eye skips, and the reasons behind where they sit.\nNext: Chapter 3, the water.',
    },
    // 3 -------------------------------------------------------------------------------------
    {
      id: 'water', title: 'Chapter 3: Water, cold and hot', short: 'the water side, traced', minutes: 12, page: 0, noun: 'chapter',
      intro: 'From the water meter, through the backflow preventer, up the trunk and round the hot water loop. The sizes the engineer wrote, and the return line most bids miss. Then the pipe, hangers and fittings the app counts from your trace.',
      opener: 'The sheets open with the scale set, and the restrooms\' water closets and floor drains counted.\nThe water side starts from there.',
      seed() { scaleP101(); const s = SPOTS(); markMissing(pick('wc'), s.wc); markMissing(pick('fd'), s.fdRestrooms); pick('lav'); },   // L-1 for the chain step: chapter 2's is swept with the last set
      steps: [
        { id: 'service', title: 'Follow the cold water in', kind: 'do', cardAt: 'tl',
          body: 'Start at WM, the water meter on the city main (the city\'s pipe in the street) below the building. Follow the solid line, the service that brings the water in, into STORAGE.\n1. Under COUNTERS, click {{+ Add|#addCounter}} and make a counter named RPZ Backflow Preventer.\n2. Click the first thing the service meets inside the wall.',
          // + Add is lit until the counter is made, then the sheet (the heading rides the list so the card keeps off + Add)
          target: () => (counter(RE.rpz) ? ['#annCanvas', '#counterCreate', '#addCounter'] : ['#counterCreate', '#addCounter', '#countersSectionTitle', '#annCanvas']), check: () => markNear(RE.rpz, SPOTS().rpz[0], 14),
          hint: () => (marks(RE.rpz) ? 'Not that. Follow the 2" line up from WM through the south wall: the small box labelled RPZ' : (K().armedNamed(RE.rpz) ? 'The counter is armed: click the RPZ' : '')),
          action: { label: 'Find it for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('rpz'), SPOTS().rpz); K().dirty(); } } },
        { id: 'trunk', title: 'Why the trunk climbs the west walls', kind: 'read', cardAt: 'tl',
          rules: ['plumb.wsfu.fixtures', 'plumb.wsfu.demand'],
          body: 'Answer: the RPZ, a reduced-pressure backflow preventer (IPC 608). It stops water flowing back into the city\'s, as a hose left in a mop bucket could siphon (suck) it when the main loses pressure. It sits where the service enters, so everything behind it is covered. The water utility, the company that sells the water, usually asks for this one.\nOn the bid: the assembly, which comes with its two shutoff valves and its test ports. Then a drain for its relief valve: an air gap fitting over a drain big enough for a full dump. And the test it needs every year.\nFrom the RPZ the cold runs west along the south wall. One trunk, the main pipe the branches come off, climbs the dish pit\'s west wall to the top wall. Why that route, when the east wall is nearer the meter?',
          reveal: 'It feeds fixtures on the way: the dish 3-comp, the kitchen hand sink, the prep sink, both restrooms and the mop sink. The hot line rides beside it. One trunk with branches is less pipe, and fewer hangers (pipe supports), than two.\nThe label, 1-1/2" CW · 1-1/4" HW, gives the cold and hot water sizes, from the engineer\'s fixture-unit math (IPC 604 and Appendix E). It shrinks to 3/4" by the mop room. You do not size it: you name your line types by its sizes.',
          target: ['#annCanvas'], check: () => true },
        { id: 'linetypes', title: 'Line types by size and material', kind: 'do',
          rules: ['plumb.hanger.copper'],
          body: 'The general notes, the written rules for the whole job, say Type L copper, a medium-wall grade. The material belongs in the line type\'s name: the hanger rule reads it.\n1. In the left sidebar, under LINE TYPES, click {{+ Add|#addLineType}}.\n2. Click {{Quick|#lineTypeQuickLink}}, and pick 1.5in and Copper (if Copper is not in your list, {{+|#quickLineAddMaterial}} beside Material adds it).\n3. Click [[Add Line Type]].\n4. Again for 1.25in Copper (the hot supply) and 0.75in Copper (the branches).',
          target: ['#quickLineAdd', '#chooseLineTypeModal .line-type-tab[data-tab="quick"]', '#lineTypeQuickLink', '#addLineType'],
          check: () => !copperStillToMake().length,
          hint: () => { const left = copperStillToMake(); return left.length && left.length < 3 ? 'Still to make: ' + left.join(', ') : ''; },
          action: { label: 'Make the three copper types', run: () => { App.pushUndoSnapshot(); const k = K(); const cw = k.makeLineType('1.5in Copper CW', '#4a9eff'); k.makeLineType('1.25in Copper HW', '#e85447'); k.makeLineType('0.75in Copper CW', '#47c88e'); S().activeLineTypeId = cw.id; K().dirty(); } } },
        { id: 'trace', title: 'Trace the cold trunk', kind: 'do', cardAt: 'bl', page: 0, zones: () => traceZones(RE.copper15, pts(G.cwTrunk), K().P101),
          body: '1. In the left sidebar, click 1.5in Copper to make it the active line type.\n2. In the header, click [[Polyline]] (or press P), the tool that traces a pipe corner by corner.\n3. Click inside each circle in turn: the trunk\'s start at the south wall, the top-wall corner, the east-wall corner, its end.\n4. Press Enter.\nFour clicks, and the app has the plan length of the whole trunk. It ends at the exit hand sink.',
          // the list is lit until 1.5in Copper is the active type, then the tool
          target: () => (typeIds(RE.copper15).has(S().activeLineTypeId) ? ['#polylineBtn', '#polylineBtnSidebar', '#lineTypesList'] : ['#lineTypesList', '#polylineBtn', '#polylineBtnSidebar']),
          check: () => allDone(traceZones(RE.copper15, pts(G.cwTrunk), K().P101)),
          action: { label: 'Trace it for me', run: () => { const lt = lineType(RE.copper15) || K().makeLineType('1.5in Copper CW', '#4a9eff'); if (polylinesOn(RE.copper15).length) return; tracePlan(lt, G.cwTrunk, 'Cold trunk'); } } },
        { id: 'hot', title: 'Which line is the return?', kind: 'do', cardAt: 'tl', page: 0, zones: () => traceZones(RE.hwr, pts(G.hwReturn), K().P101),
          body: 'The hot water leaves the WH, the water heater in STORAGE, as a dashed line beside the cold. A second, dotted line comes back down the east wall, through the RECIRC PUMP (the recirculation pump) into the heater.\n1. Under LINE TYPES, click {{+ Add|#addLineType}}.\n2. In Name, type 0.75in Copper HWR and click [[Create Line Type]]. HWR is short for hot water return.\n3. With it active, click [[Polyline]] and trace the return: the top-right corner, down the east wall, and into the pump.\n4. Press Enter.',
          // + Add is lit until the return's type is made, then the tool
          target: () => (lineType(RE.hwr) ? ['#polylineBtn', '#polylineBtnSidebar', '#lineTypeCreate', '#addLineType'] : ['#lineTypeCreate', '#addLineType', '#polylineBtn', '#polylineBtnSidebar']), check: () => allDone(traceZones(RE.hwr, pts(G.hwReturn), K().P101)),
          hint: () => (!S().drawingPolyline && polylinesOn(RE.hwr, K().P101).length && !allDone(traceZones(RE.hwr, pts(G.hwReturn), K().P101)) ? 'Trace the DOTTED line, the legend\'s HWR, not the dashed supply' : ''),
          action: { label: 'Trace the return for me', run: () => { const lt = lineType(RE.hwr) || K().makeLineType('0.75in Copper HWR', '#e8c547'); if (polylinesOn(RE.hwr).length) return; tracePlan(lt, G.hwReturn, 'Hot water return'); } } },
        { id: 'chain', title: 'Chain the fixtures off the top-wall run', kind: 'do', cardAt: 'bl', page: 0, zones: () => circlesOn(K().P101, RE.lav, K().LAVS, 14),
          body: 'Answer: the dotted line, the hot water return. It carries unused hot water back to the heater, so every tap runs hot fast. Most bids miss it because it looks like the supply.\nBoth lavatories hang off the top-wall run on 3/4" branches.\n1. In the header, click [[Chain]] (or press T).\n2. In the Chain panel, choose L-1 and 0.75in Copper.\n3. Click the lavatory in MEN, then the one in WOMEN.\n4. Press Enter.\nEvery click places the fixture AND draws the branch back to the last one. (The mop sink has its own counter, so it is not on this chain.)\nThe return is forty feet of insulated 3/4" pipe, plus the pump, a check valve (one-way) and a balancing valve (it sets the flow). Why it is there: the mop sink is about eighty feet of pipe from the heater. The plumbing code wants a loop past fifty feet of hot pipe (IPC 607.2). Without one, the tap runs cold for a minute each time.\nThe health code wants warm water at every hand sink too: at least 85°F in the 2022 FDA Food Code, 100°F before it (5-202.12).',
          rulesExempt: 'no rulebook entry: IPC 607.2, the developed length of hot water piping to a fixture',
          target: ['#chainPanel', '#chainBtn'], check: () => { const a = ann(); return !!a && (a.quickLines || []).length >= 1 && allDone(circlesOn(K().P101, RE.lav, K().LAVS, 14)); },
          action: { label: 'Chain the two for me', run: () => { K().goPage(K().P101); seedCopperBranch(); } } },
        { id: 'drop', title: 'The riser the plan cannot show', kind: 'do', cardAt: 'bl', page: 0, zones: () => K().guide([P(564, 594)], 14, trunkDropped()),
          body: 'The water comes in under the slab, the concrete floor, and has to come up somewhere. A plan is drawn from above, so it never shows a pipe going straight up.\n1. In the header, click [[Drop]] (or press B), the tool that adds an upright length to a run.\n2. In the small panel that opens, choose or type 4 ft.\n3. Click the start of the trunk, at the south wall.\nThose 4 ft of riser, the upright pipe, join the trunk\'s footage, its total feet. A second click on the same end would clear it.\nThis sheet does not say where the water rises, or how far. Here the 4 ft is practice. On a real bid, that is an RFI.',
          target: ['#dropPanel', '#dropBtn'], check: trunkDropped,
          action: { label: 'Add a 4 ft riser for me', run: () => { K().goPage(K().P101); if (!polylinesOn(RE.copper15).length) tracePlan(lineType(RE.copper15) || K().makeLineType('1.5in Copper CW', '#4a9eff'), G.cwTrunk, 'Cold trunk'); K().dropAt(P(564, 594), 4); } } },
        { id: 'hangers', title: 'Hangers from the copper rule', kind: 'do',
          rules: ['plumb.hanger.copper'],
          body: 'Pipe hangs from hangers, and the code says how far apart they go.\n1. In the left sidebar, under LINE TYPES, click the pencil beside 1.5in Copper.\n2. Under [[Child counts]], the app offers Hanger · 1 per 10 ft, read off the type\'s name. That is IPC Table 308.5 for copper over 1-1/4".\n3. Click {{Add|#childCountsSuggest}}.\n4. Click {{Done|#counterLineTypeDetailsClose}}.\nEvery run of this type now counts its hangers. The § chip in the Summary, a small section mark, names the rule.',
          target: () => T().ladder('#childCountsSuggest', '#childCountsGroup', T().pencilOf('lineType', lineType(RE.copper15)), '#lineTypesSectionTitle'),
          check: () => K().someLineType(RE.copper15, (lt) => (lt.childCounts || []).length),
          action: { label: 'Add the hanger rule', run: () => addHangerRule(lineType(RE.copper15)) } },
        { id: 'bends', title: 'Elbows from the bends', kind: 'do',
          body: 'Every corner in a pipe is an elbow, a fitting (a joining piece) that turns it.\n1. Open the same line type\'s details again, with its pencil.\n2. Turn on [[Fittings from bends]].\n3. Click {{Done|#counterLineTypeDetailsClose}}.\nEach corner of the trunk now counts a 90, a right-angle elbow, and the riser counts one too. None of them are marks, so they can never drift from the pipe.',
          target: () => T().ladder('#bendFittingsBtn', '#counterLineTypeDetailsModal .modal-card', T().pencilOf('lineType', lineType(RE.copper15)), '#lineTypesSectionTitle'),
          check: () => K().someLineType(RE.copper15, (lt) => lt.bendFittings && lt.bendFittings.enabled),
          action: { label: 'Turn it on for me', run: () => enableBends(lineType(RE.copper15)) } },
        { id: 'read', title: 'What the drawing knows now', kind: 'read',
          rules: ['plumb.hanger.copper'],
          body: 'SUMMARY, in the left sidebar, lists the feet of 1.5in Copper, riser included. The hangers and their § chip sit under it. Then the elbows, the return, and the 0.75in branch from the chain.\nOn a real bid this is the water side of the sheet in a few dozen clicks.\nMore: [Doing a plumbing takeoff](/guides/plumbing-takeoff/).',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'The service, the trunk, the return, the branches, and the pipe counted from the trace with its hangers and elbows.\nNext: Chapter 4, the waste.',
    },
    // 4 -------------------------------------------------------------------------------------
    {
      id: 'waste', title: 'Chapter 4: Waste and vent', short: 'the waste side, traced', minutes: 12, page: 0, noun: 'chapter',
      intro: 'Gravity, slope, traps and vents, and cleanouts. Why the grease interceptor, a tank that catches kitchen grease, sits outside with the restrooms going around it. Then both waste lines traced on their own layer, and the marks counted.',
      opener: 'The sheets open with the scale set, and the floor drains, water closets and hand sinks counted.\nThe waste lines under them are yours to trace.',
      seed() { scaleP101(); const s = SPOTS(); markMissing(pick('fd'), s.fdRestrooms.concat(s.fdRest)); markMissing(pick('wc'), s.wc); markMissing(pick('hs'), s.hs); },
      steps: [
        { id: 'downhill', title: 'Downhill', kind: 'do', cardAt: 'tl', page: 0, zones: () => K().guide(pts(G.ssRun).slice(0, 2), 14, K().measured(K().P101, 29, 0.8)),
          body: 'Water arrives under pressure; waste has only gravity to move it. The heavy dashed line starts at a cleanout under MEN, a capped opening for clearing the drain, and leaves through the east wall.\n1. Click [[Measure]] (or press D).\n2. Click the cleanout under MEN, then the point where the line crosses the east wall.\nHow far does the waste run under the floor, and which end sits higher?',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => K().measured(K().P101, 29, 0.8),
          hint: () => { const lm = S().lastMeasure; return lm && lm.pageIdx === K().P101 && T().measuredFeet() != null ? 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + '. The CO under MEN to the east wall' : ''; },
          action: { label: 'Measure it for me', run: () => { K().goPage(K().P101); const d = pts(G.ssRun); K().measure(d[0], d[1]); } } },
        { id: 'two', title: 'Which fixture must never drain through the interceptor?', kind: 'do', cardAt: 'tl',
          rules: ['plumb.drain.slope'],
          body: 'Answer: twenty-nine feet at 1/8" per foot (IPC 704.1 for 3" and larger): the far end sits 3-5/8" higher than the wall.\nThere are two waste lines, and they leave the building separately: the 4" SS, sanitary sewer, and the 3" GW, grease waste.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click a fixture whose waste must never go through the GI, the grease interceptor.\n3. Type why, and click {{Done|#noteModalDone}}.\nEvery foot of horizontal waste pipe is a foot of trench, a ditch dug for it. A trench is priced by its length and its depth. So the engineer runs the drains the short way to the sewer, to keep them shallow.',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => { const k = K(); const spots = k.WCS.concat(k.LAVS, [k.MOP], SPOTS().fdRestrooms); return spots.some((pt) => notesNear(pt, 30).length); },
          hint: () => { const a = ann(); if (!a || !(a.notes || []).length) return ''; const k = K(); const grease = k.HAND_SINKS.concat(SPOTS().tcs, SPOTS().fs, SPOTS().fdRest); /* the restroom FDs go to the sewer: a right answer */ return grease.some((pt) => notesNear(pt, 30).length) ? 'Not that one: the red note sends ALL KITCHEN WASTE through the interceptor, so that fixture belongs there' : 'Put the note on the fixture itself'; },
          action: { label: 'Note the water closet for me', run: () => K().addNote(K().WCS[0], 'Sewage never enters the interceptor: the restrooms go straight to the sewer', '#e85447') } },
        { id: 'layer', title: 'Waste on its own layer', kind: 'do',
          rules: ['plumb.waste.grease-interceptor'],
          // a tablet has no arrow keys: that sentence is for a reader with a keyboard
          body: () => 'Answer: a water closet, a lavatory or the mop sink. The interceptor is for greasy waste, and the code keeps waste that needs no catching out of it (IPC 1003.2).\nA plumber reads water and waste as two drawings. Keep them apart, each on its own layer.\n1. In the footer, click [[Layers]].\n2. Click [[+ Add layer]].\n3. Click [[New empty layer]], and name it Waste.\n4. Click {{Create|#addCanvasModalCreate}}.\n' + ((window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 768px)').matches) ? '' : 'The up and down arrow keys switch layers. ') + 'Each layer keeps its own marks, and the sidebar totals count them all.\nEvery kitchen, dish and bar fixture drains through the 3" grease line to the GI outside. There the grease floats, cools and is pumped out. The restrooms join the sewer past it. A hand sink carries little grease, but the red note sends ALL KITCHEN WASTE to the GI. Many sewer offices, the city\'s, want every kitchen drain through it.',
          target: ['#addCanvasModalCreate', '#canvasMenuAdd', '#canvasLayersBtn'], check: onWasteLayer,
          action: { label: 'Add the Waste layer for me', run: addWasteLayer } },
        { id: 'linetypes', title: 'Line types for the waste', kind: 'do',
          body: 'The general notes say PVC DWV: plastic pipe (polyvinyl chloride) made for drain, waste and vent.\n1. Under LINE TYPES, click {{+ Add|#addLineType}}.\n2. Click {{Quick|#lineTypeQuickLink}}, and pick 4in and PVC.\n3. Click [[Add Line Type]].\n4. Again for 3in PVC.',
          target: ['#quickLineAdd', '#chooseLineTypeModal .line-type-tab[data-tab="quick"]', '#lineTypeQuickLink', '#addLineType'],
          check: () => !!(lineType(RE.pvc4) && lineType(RE.pvc3)),
          action: { label: 'Make 4in PVC and 3in PVC', run: () => { App.pushUndoSnapshot(); const k = K(); const ss = k.makeLineType('4in PVC', '#8a4bb0'); k.makeLineType('3in PVC', '#c8963a'); S().activeLineTypeId = ss.id; K().dirty(); } } },
        { id: 'ss', title: 'Trace the sanitary line', kind: 'do', cardAt: 'bl', page: 0, zones: () => traceZones(RE.pvc4, pts(G.ssRun), K().P101),
          body: 'The sanitary line carries the restrooms\' waste to the sewer.\n1. Click 4in PVC in the sidebar to make it active.\n2. In the header, click [[Polyline]] (or press P).\n3. Click the cleanout under MEN, the east wall where it leaves, the cleanout at the turn outside, and the interceptor\'s outlet line.\n4. Press Enter.',
          // the list is lit until 4in PVC is the active type, then the tool
          target: () => (typeIds(RE.pvc4).has(S().activeLineTypeId) ? ['#polylineBtn', '#polylineBtnSidebar', '#lineTypesList'] : ['#lineTypesList', '#polylineBtn', '#polylineBtnSidebar']),
          check: () => allDone(traceZones(RE.pvc4, pts(G.ssRun), K().P101)),
          action: { label: 'Trace it for me', run: async () => { if (!onWasteLayer()) await addWasteLayer(); const lt = lineType(RE.pvc4) || K().makeLineType('4in PVC', '#8a4bb0'); if (polylinesOn(RE.pvc4).length) return; tracePlan(lt, G.ssRun, 'Sanitary'); } } },
        { id: 'gw', title: 'Trace the grease line', kind: 'do', cardAt: 'tl', page: 0, zones: greaseZones,
          rules: ['plumb.drain.slope'],
          body: 'The grease line carries the kitchen\'s and the bar\'s waste to the interceptor. Two runs, both 3in PVC.\nAhead of the interceptor the code wants 1/4" per foot, not 1/8" (IPC 704.1). Over the back rooms\' 59 feet that is about 15" of fall: a deeper trench.\n1. Click 3in PVC in the sidebar.\n2. Click [[Polyline]].\n3. The work aisle: the cleanout by the kitchen door, the corner at the east end, down to the wall, and out to the interceptor.\n4. Press Enter.\n5. The back rooms: the cleanout in the bar, the two corners of the jog, a short dogleg, and where it joins the first run.\n6. Press Enter.',
          // the list is lit until 3in PVC is the active type, then the tool
          target: () => (typeIds(RE.pvc3).has(S().activeLineTypeId) ? ['#polylineBtn', '#polylineBtnSidebar', '#lineTypesList'] : ['#lineTypesList', '#polylineBtn', '#polylineBtnSidebar']),
          check: () => allDone(greaseZones()),
          hint: () => (polylinesOn(RE.pvc3).length === 1 ? 'One more: the bar and back-room run' : ''),
          action: { label: 'Trace both for me', run: async () => { if (!onWasteLayer()) await addWasteLayer(); const lt = lineType(RE.pvc3) || K().makeLineType('3in PVC', '#c8963a'); const have = polylinesOn(RE.pvc3).length; if (have < 1) tracePlan(lt, G.gwAisle, 'Grease, work aisle'); if (have < 2) tracePlan(lt, G.gwBack, 'Grease, back rooms'); } } },
        { id: 'cleanouts', title: 'Where must a cleanout be?', kind: 'do', cardAt: 'bl',
          body: 'A snake, the plumber\'s cable for clearing a clog, has to get into every drain line somewhere.\n1. Under COUNTERS, click {{+ Add|#addCounter}} and make a counter named CO Cleanout.\n2. Click every spot on the plan where the code wants one.',
          // + Add is lit until the counter is made, then the sheet
          target: () => (counter(RE.co) ? ['#annCanvas', '#addCounter'] : ['#counterCreate', '#addCounter', '#countersSectionTitle', '#annCanvas']), check: () => markCountNear(RE.co, SPOTS().co, 8) >= 6,
          hint: () => (marks(RE.co) ? missing(RE.co, SPOTS().co, CO_LABELS, 8) : ''),   // quiet until the first mark: before it the list is the answer
          action: { label: 'Count them for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('co'), SPOTS().co); K().dirty(); } } },
        { id: 'vents', title: 'Which walls carry a vent stack?', kind: 'do', cardAt: 'bl',
          rules: ['plumb.drain.cleanouts', 'plumb.vent.trap-protection'],
          body: 'Answer: six. One at the upstream end, the start, of each drain line: the engineer\'s choice. And one at each line\'s first turn, where the code wants it (IPC 708.1.4). A turn soon after shares it.\nThe vent pipes live in the walls. The plan shows where a stack goes through the roof.\n1. Under COUNTERS, click {{+ Add|#addCounter}} and make a counter named VTR Vent Through Roof.\n2. Click both VTR tags.\nEvery trap needs a vent behind it, or its water seal siphons out when the fixture upstream drains (IPC 901).\nOn the bid a cleanout is a fitting, a plug and an access cover.',
          // + Add is lit until the counter is made, then the sheet
          target: () => (counter(RE.vtr) ? ['#annCanvas', '#addCounter'] : ['#counterCreate', '#addCounter', '#countersSectionTitle', '#annCanvas']), check: () => markCountNear(RE.vtr, SPOTS().vtr, 8) >= 2,
          hint: () => (marks(RE.vtr) ? missing(RE.vtr, SPOTS().vtr, VTR_LABELS, 8) : ''),   // quiet until the first mark: before it the list is the answer
          action: { label: 'Count both for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('vtr'), SPOTS().vtr); K().dirty(); } } },
        { id: 'open', title: 'Open Bid Check', kind: 'do',
          rules: ['plumb.hanger.pvc'],
          onEnter: () => T().foldBidCheck(), hold: true, body: 'Answer: two, the wall between MEN and WOMEN and the wall between DISH and STORAGE.\n1. In the left sidebar, click BID CHECK to expand it.\nThe row Hangers on every supported run is open: 4in PVC and 3in PVC count no hangers.\nEach VTR is a hole through the roof: a flashing and a boot to seal it, and a roofer to coordinate. IPC 903 puts the terminal, the vent\'s open top, above the roof and away from air intakes.',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false,
          action: { label: 'Open it', run: () => K().openBidCheck() } },
        { id: 'underslab', title: 'Hangers under the slab?', kind: 'read',
          rules: ['plumb.hanger.pvc'],
          body: 'Should the two PVC types count hangers, as the open row asks?',
          reveal: 'Not this time. The general notes put the waste below the slab. Pipe in a trench lies on bedding, packed sand or gravel, not on hangers.\nThe rule is written for pipe that hangs (IPC 308.5). The app reads the material in the name, not where the pipe runs.\nLeave the row open and tick nothing. When you export, the app asks once and remembers your answer.\nWhere a waste line does run above a ceiling, add the PVC rule, one hanger every 4 ft, to that type.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => true },
      ],
      done: 'Two waste systems on their own layer, the cleanouts and vents counted, and a Bid Check row you can explain.\nNext: Chapter 5, the riser.',
    },
    // 5 -------------------------------------------------------------------------------------
    {
      id: 'riser', title: 'Chapter 5: The riser', short: 'the vertical, drawn', minutes: 8, page: 3, noun: 'chapter',
      intro: 'The plan shows a stack, an upright drain or vent pipe, as one circle. P-601 draws it standing up: the trap arms, the stack, the vent through the roof, and the vertical feet the bid carries.',
      seed() { scaleP101(); K().makeLineType('4in PVC', '#8a4bb0'); },
      steps: [
        { id: 'scale', title: 'A riser drawn to scale', kind: 'do',
          body: 'P-601 is a riser diagram: the pipes drawn standing up, as if the wall were cut open. Most are not to scale; this one is, at 1/4", so the upright pipes can be measured.\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/4" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => K().scaleIs(K().P601, 18),
          action: { label: 'Use 1/4" = 1\'-0"', run: async () => { K().goPage(K().P601); await T().applyScalePreset('1/4" = 1\'', 18); } } },
        { id: 'prove', title: 'Prove it', kind: 'do', cardAt: 'br', page: 3, hold: true,
          body: () => (proveP601().check()
            ? proveP601().verdict() + ': this sheet\'s scale is right too.\n1. Click [[Next]].'
            : '1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at one end of the 14\'-0" string at the left, floor to roof.\n3. Click inside circle 2, at the other end.'),
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => proveP601().check(), hint: () => proveP601().hint(), zones: () => proveP601().zones(),
          action: { label: 'Measure the 14\'-0" string', run: async () => { const k = K(); k.goPage(k.P601); if (!k.scaleIs(k.P601, 18)) await T().applyScalePreset('1/4" = 1\'', 18); const d = raw(R.prove); k.measure(d[0], d[1]); } } },
        { id: 'traparm', title: 'How long is the lavatory\'s trap arm?', kind: 'do', cardAt: 'br', page: 3, zones: () => lavArmP601().zones(),
          body: 'The trap arm is the pipe from a fixture\'s trap to its vent. The lavatory\'s has its length written on the sheet, in the wall at 18" above the floor.\n1. Click [[Measure]] again.\n2. Click both ends of the lavatory\'s trap arm, from the stack to the trap.',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => lavArmP601().check(),
          onEnter: () => { armEntryMeasure = S().lastMeasure; },
          hint: () => { const lm = S().lastMeasure; if (!lm || lm === armEntryMeasure || lm.pageIdx !== K().P601) return ''; const h = lavArmP601().hint(); return h && h.code === 'outside-zone' ? 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') + ', but not at the lavatory. Stack to trap, inside circle 1, then inside circle 2' : h; },
          action: { label: 'Measure it for me', run: () => { const k = K(); k.goPage(k.P601); const d = raw(R.lavArm); k.measure(d[0], d[1]); } } },
        { id: 'stack', title: 'Trace the stack', kind: 'do', cardAt: 'br', page: 3, zones: () => traceZones(RE.pvc4, raw(R.stack), K().P601),
          rules: ['plumb.trap.arm-length'],
          body: 'Answer: four feet. IPC Table 909.1 allows six feet for a 1-1/2" arm. Any longer and the trap would siphon, sucked dry, when the water closet flushes.\nThe stack itself is pipe the plan cannot show.\n1. Click 4in PVC in the sidebar to make it active.\n2. Click [[Polyline]] (or press P).\n3. Click the base of the stack, at the building drain: the main drain under the floor.\n4. Click the vent terminal above the roof.\n5. Press Enter.\nRiser note 2 lists the limits. Bid Check\'s trap-arm row is where you sign that you read them.',
          target: ['#polylineBtn', '#polylineBtnSidebar', '#lineTypesList'], check: () => allDone(traceZones(RE.pvc4, raw(R.stack), K().P601)),
          action: { label: 'Trace it for me', run: () => { const lt = lineType(RE.pvc4) || K().makeLineType('4in PVC', '#8a4bb0'); if (polylinesOn(RE.pvc4, K().P601).length) return; traceSheet(lt, R.stack, 'Stack', K().P601); } } },
        { id: 'why', title: 'Why the stack keeps going', kind: 'read', cardAt: 'br',
          rules: ['plumb.vent.terminal'],
          body: 'Seventeen feet of 4" pipe for one circle on the plan. The waste stack runs below the lavatory\'s connection, the vent stack above it, and a foot above the roof.\nWhy does a waste stack continue past the last fixture and out through the roof?',
          reveal: 'Air. Water falling down a stack pushes air ahead of it and pulls air behind it. Without an open top, the pressure swings would blow or siphon every trap on the stack.\nThe stack vents through the roof, clear of air intakes (IPC 903). A foot above the roof is this job\'s number, from riser note 3. The code leaves the height to each local code. That terminal is a flashing and a roofer on the bid.\nOn a real set the riser is where the verticals, the upright pipes, come from. So do the vent header sizes (the pipe that joins the vents) and the cleanout at each stack\'s base. The plan only hints at them.',
          target: [], check: () => true },
        { id: 'co', title: 'The cleanout at the base', kind: 'do', cardAt: 'br', page: 3, zones: () => circlesOn(K().P601, RE.co, raw(R.co), 14),
          body: 'Riser note 4: a cleanout at the base of each stack, where the upright pipe turns level and a blockage settles.\n1. If CO Cleanout is in the sidebar, click it to arm it: every click on the sheet then places one.\nIf it is not, under COUNTERS click [[+ Add]]. On the [[Create]] tab, type CO Cleanout in Name and click [[Create Counter]]: it comes armed.\n2. Click the cleanout beside the base of the stack.',
          target: ['#annCanvas', '#countersList', '#addCounter'], check: () => allDone(circlesOn(K().P601, RE.co, raw(R.co), 14)),
          action: { label: 'Count it for me', run: () => { const k = K(); k.goPage(k.P601); App.pushUndoSnapshotCurrentPage(); markMissing(pick('co'), raw(R.co), k.P601); k.dirty(); } } },
      ],
      done: 'A riser you can measure, a trap arm checked against the table, and seventeen feet of stack the plan never showed.\nNext: [[Learn]] → Chapter 6, the gas.',
    },
    // 6 -------------------------------------------------------------------------------------
    {
      id: 'gas', title: 'Chapter 6: Gas', short: 'the gas, traced', minutes: 8, page: 0, noun: 'chapter',
      intro: 'From the gas meter to the cook line: sizes that shrink with the load, and a shutoff valve at every appliance. The valve the hood trips, and where it goes. And a hanger row the app\'s rulebook, its list of the trade rules it applies, does not have yet.',
      seed() { scaleP101(); },
      steps: [
        { id: 'meter', title: 'From the meter', kind: 'read', cardAt: 'tl',
          rules: ['plumb.gas.pipe-sizing'],
          body: 'GM is the gas meter on the 4" city main. Follow the dash-dot line into the building.\nWhat sizes does it pass through, and where does each change?',
          reveal: '1-1/2" from the meter into STORAGE, where 3/4" splits off to the water heater.\nThen 1-1/4" on up the east side of the kitchen and west along the cook line. Each of the four appliances gets a drop, a pipe down to it, and a shutoff valve.\nGas is sized by the load downstream and the length of the run (IFGC 402, the International Fuel Gas Code). The load is in BTU per hour: British thermal units, how fast the appliances burn gas.\nSo like water, the gas pipe shrinks as it goes.\nThe pipe is black steel, threaded (screwed together), per the general notes: BI in the trade, black iron.',
          target: [], check: () => true },
        { id: 'linetype', title: 'A black iron line type', kind: 'do',
          body: 'BI, black iron, is the gas pipe. The main is two sizes, so it takes two line types.\n1. In the left sidebar, under LINE TYPES, click [[+ Add]].\n2. Click [[Quick]], and pick 1.5in and BI.\n3. Click [[Add Line Type]].\n4. Again for 1.25in BI.',
          target: ['#quickLineAdd', '#chooseLineTypeModal .line-type-tab[data-tab="quick"]', '#lineTypeQuickLink', '#addLineType'],
          check: () => !!(lineType(RE.gas15) && lineType(RE.gas)),
          hint: () => (lineType(RE.gas15) && !lineType(RE.gas) ? 'Still to make: 1.25in BI' : (!lineType(RE.gas15) && lineType(RE.gas) ? 'Still to make: 1.5in BI' : '')),
          action: { label: 'Make 1.5in BI and 1.25in BI', run: () => { App.pushUndoSnapshot(); const k = K(); const lt = k.makeLineType('1.5in BI', '#b03a2e'); k.makeLineType('1.25in BI', '#e85447'); S().activeLineTypeId = lt.id; k.dirty(); } } },
        { id: 'trace', title: 'Trace the cook line', kind: 'do', cardAt: 'bl', page: 0, zones: () => gasZones(),
          body: 'The gas main runs from the meter to the range, and steps down on the way. The labels read 1-1/2" in STORAGE and 1-1/4" in the kitchen. No reducer, the fitting that joins two sizes, is drawn, so read the change at the wall between them.\n1. Click 1.5in BI in the sidebar to make it the active line type.\n2. Click [[Polyline]] (or press P).\n3. Click the meter, then the kitchen wall where the run crosses it.\n4. Press Enter.\n5. Click 1.25in BI in the sidebar.\n6. Click the kitchen wall again, the corner where the run turns west in front of the cook line, and its end at the range.\n7. Press Enter.\nThe reducer at the wall is one more fitting on the bid.',
          target: ['#polylineBtn', '#polylineBtnSidebar', '#lineTypesList'], check: () => allDone(gasZones()),
          hint: () => (polylinesOn(RE.gas15).length && !polylinesOn(RE.gas).length && !S().drawingPolyline ? 'One more: the 1-1/4" run in 1.25in BI, from the kitchen wall to the range' : ''),
          action: { label: 'Trace it for me', run: () => { const k = K(); const big = lineType(RE.gas15) || k.makeLineType('1.5in BI', '#b03a2e'); const lt = lineType(RE.gas) || k.makeLineType('1.25in BI', '#e85447'); if (!polylinesOn(RE.gas15).length) tracePlan(big, G.gas15, 'Gas main, 1-1/2"'); if (!polylinesOn(RE.gas).length) tracePlan(lt, G.gas125, 'Gas main, 1-1/4"'); } } },
        { id: 'bends', title: 'Elbows from the bends', kind: 'do',
          body: '1. Click the pencil beside 1.25in BI.\n2. Turn on [[Fittings from bends]].\n3. Click [[Done]].\nThe corner counts a 90, a right-angle elbow. Threaded steel elbows are priced each, so this row matters more on gas than on anything else.',
          target: () => T().ladder('#bendFittingsBtn', '#counterLineTypeDetailsModal .modal-card', T().pencilOf('lineType', lineType(RE.gas)), '#lineTypesSectionTitle'),
          check: () => K().someLineType(RE.gas, (lt) => lt.bendFittings && lt.bendFittings.enabled),
          action: { label: 'Turn it on for me', run: () => enableBends(lineType(RE.gas)) } },
        { id: 'drops', title: 'Count the drops', kind: 'do', cardAt: 'bl', page: 0, zones: () => circlesOn(K().P101, RE.gasDrop, SPOTS().gasDrop, 12),
          rules: ['plumb.gas.appliance-shutoff'],
          body: 'Each dot on the run in front of the cook line is a drop with a shutoff to one appliance. IFGC 409.5 wants a valve at every one. Most sheets run the gas behind the equipment, at the wall; this one draws it on the aisle side.\n1. Make a Gas Drop w/ Shutoff counter.\n2. Click the four dots under the range, the flat top (a griddle) and the two fryers.',
          target: ['#annCanvas', '#addCounter'], check: () => allDone(circlesOn(K().P101, RE.gasDrop, SPOTS().gasDrop, 12)),
          hint: () => missing(RE.gasDrop, SPOTS().gasDrop, ['the range', 'the flat top', 'the first fryer', 'the second fryer'], 8),
          action: { label: 'Count the four for me', run: () => { K().goPage(K().P101); App.pushUndoSnapshotCurrentPage(); markMissing(pick('gasDrop'), SPOTS().gasDrop); K().dirty(); } } },
        { id: 'hood', title: 'Where does the hood\'s valve go?', kind: 'do', cardAt: 'bl',
          rules: ['plumb.gas.hood-shutoff'],
          body: 'The dashed box over the cook line says HOOD ABOVE: the canopy that pulls smoke off the stoves. Its fire suppression system, a built-in extinguisher, must shut the gas to everything under it when it fires. That takes a valve on the gas line.\n1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click the spot on the gas line where that valve has to sit.\n3. Type RFI: and the question: who furnishes and sets the gas shutoff valve the hood suppression system trips?\n4. Click [[Done]].\nThe sheet does not draw that valve, or say who furnishes (supplies) it. The rule is NFPA 96, the hood standard of the NFPA, the National Fire Protection Association.',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          check: () => anyRfi() && notesNear(pts(G.hoodValve)[0], 60).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))),
          hint: () => { const a = ann(); return a && (a.notes || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))) ? 'Move it: the valve sits on the 1-1/4" line AHEAD of the first drop, so one valve cuts every appliance' : (a && (a.notes || []).length ? 'Start the note with RFI:' : ''); },
          action: { label: 'Flag it for me', run: () => K().addNote(pts(G.hoodValve)[0], 'RFI: Who furnishes and sets the gas shutoff valve the hood suppression system trips?', '#e85447') } },
        { id: 'hangers', title: 'A hanger row of your own', kind: 'do',
          rules: ['plumb.hanger.gas-steel'],
          body: 'Answer: ahead of the first drop, so one valve cuts the whole line.\nThe rulebook, the app\'s list of trade rules, has a gas hanger row. Bid Check does not read it yet, so it is quiet about the gas line. Gas pipe follows the fuel gas code, not the plumbing code. IFGC Table 415.1 hangs 1-1/4" steel gas pipe every 10 ft.\n1. Click the pencil beside 1.25in BI.\n2. Under [[Child counts]], type Hanger in the name box, and leave the quantity at 1.\n3. Set the rule to per N ft, and the interval to 10 ft.\n4. Click [[+ Add]].\n5. Click [[Done]].\nA note that starts with RFI: is a flag. [[Copy RFI Flags]], under EXPORT OPTIONS, collects every one for the GC, the general contractor who runs the job. The Notes ledger in the header lists them.',
          target: () => T().ladder('#childCountsGroup', T().pencilOf('lineType', lineType(RE.gas)), '#lineTypesSectionTitle'),
          check: () => K().someLineType(RE.gas, (lt) => (lt.childCounts || []).some((ch) => ch.per === 'ft')),
          action: { label: 'Add Hanger · 1 per 10 ft', run: () => { const lt = lineType(RE.gas); if (!lt || (lt.childCounts || []).length) return; App.pushUndoSnapshot(); lt.childCounts = [{ name: 'Hanger', qty: 1, per: 'ft', ftInterval: 10 }]; K().dirty(); } } },
      ],
      done: 'The gas from the meter to the range, with its elbows and drops. The valve nobody drew, flagged where it belongs, and hangers from a row you wrote.\nNext: [[Learn]] → Chapter 7, the enlarged plan (part of the plan drawn bigger) and the typical.',
    },
    // 7 -------------------------------------------------------------------------------------
    {
      id: 'details', title: 'Chapter 7: The enlarged plan and the typical', short: 'a second sheet, a second scale', minutes: 8, page: 1, noun: 'chapter',
      intro: 'Why the restrooms are drawn twice, and a scale per sheet. A detail, a small drawing of one spot, at another scale inside it. And TYP. OF 4 made into a number.',
      seed() {
        scaleP101();
        const k = K();
        k.mark(k.P401, k.makeCounter('HS-1 Hand Sink', 'Mounted Sink', '#47c88e'), [k.DETAIL.hs]);
        k.mark(k.P401, k.makeCounter('FD-1 Floor Drain', 'Floor Drain', '#e85447'), [k.DETAIL.fd]);
      },
      steps: [
        { id: 'why', title: 'Why draw the restrooms twice?', kind: 'read', cardAt: 'br',
          body: 'P-401 draws MEN and WOMEN again, at 1/4": an enlarged plan, part of the plan drawn bigger. P-101 already shows them.\nWhat is the enlarged plan for?',
          reveal: 'Clearances, the free space around the fixtures. At 1/8" a restroom is an inch wide.\nNobody can check there that the room has its 60" circle to turn a wheelchair, or that a lavatory rim sits at 34".\nThe enlarged plan is where the accessibility dimensions live (ICC A117.1, the accessibility standard, through the building code). It is where the engineer proves the fixtures fit.\nFor the takeoff it is a second scale on the same set. It is also the easiest place to count a fixture twice: count the restrooms on one sheet, never both.\nLook closer, though: this P-401 does not match P-101. The rooms swap sides, and it draws five water closets and a urinal where P-101 draws one water closet a room.\nWhen two sheets disagree, count neither until an RFI says which one governs.',
          target: [], check: () => true },
        { id: 'scale', title: 'A scale per sheet', kind: 'do',
          body: 'P-101 is at 1/8". This sheet is drawn at 1/4" and has no scale yet: its badge under PAGES is not outlined.\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/4" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => K().scaleIs(K().P401, 18),
          action: { label: 'Use 1/4" = 1\'-0"', run: async () => { K().goPage(K().P401); await T().applyScalePreset('1/4" = 1\'', 18); } } },
        { id: 'prove', title: 'Prove it', kind: 'do', cardAt: 'bl', page: 1, hold: true,
          body: () => (proveP401().check()
            ? proveP401().verdict() + ': this sheet\'s scale is right too.\n1. Click [[Next]].'
            : '1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at the left end of the 12\'-0" string over WOMEN.\n3. Click inside circle 2, at its right end.'),
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => proveP401().check(), hint: () => proveP401().hint(), zones: () => proveP401().zones(),
          action: { label: 'Measure the 12\'-0" string', run: async () => { const k = K(); k.goPage(k.P401); if (!k.scaleIs(k.P401, 18)) await T().applyScalePreset('1/4" = 1\'', 18); k.measure(k.DETAIL.prove[0], k.DETAIL.prove[1]); } } },
        { id: 'zone', title: 'A detail at another scale', kind: 'do', cardAt: 'bl', page: 1, zones: () => [T().boxZone(K().rectsOf(K().P401, 'scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 36) < 0.1), DETAIL_INNER(), DETAIL_OUTER(), 'Drag your box around detail 2, anywhere in here')],
          hint: () => T().boxMiss(K().rectsOf(K().P401, 'scaleZones'), DETAIL_INNER(), DETAIL_OUTER()),
          body: 'Detail 2, the hand sink station, is drawn at 1/2". Measured at the sheet\'s 1/4" it would read double. A scale zone is a box with its own scale.\n1. In the header, click [[⋯]], then [[Scale Zone]].\n2. Drag a box around detail 2, the dashed frame.\n3. In the dialog, choose [[1/2" = 1\']].',
          target: ['#scaleZoneBtn', '#scaleZoneBtnSidebar', '#headerMoreBtn'],
          check: () => { const a = pageAnn(K().P401); return !!a && (a.scaleZones || []).some((z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 36) < 0.1); },
          action: { label: 'Box detail 2 at 1/2"', run: () => { const k = K(); k.goPage(k.P401); const a = App.ensureActiveCanvas(S().pages[k.P401]).annotations; if (!a.scaleZones) a.scaleZones = []; if (a.scaleZones.length) return; App.pushUndoSnapshotCurrentPage(); a.scaleZones.push(Object.assign({ id: App.uid(), scale: { pixelsPerUnit: 36, unit: 'ft', label: '1/2" = 1\'' } }, k.DETAIL.box)); k.dirty(); } } },
        { id: 'multiply', title: 'How many hand sink stations does the bid carry?', kind: 'do', cardAt: 'bl', page: 1, zones: () => [T().boxZone(K().rectsOf(K().P401, 'multiplyZones', (z) => (z.multiplier || 1) === 4), DETAIL_INNER(), DETAIL_OUTER(), 'Drag your box around detail 2, anywhere in here')],
          body: 'Detail 2 is titled HAND SINK STATION · TYP. OF 4, and the chapter counted it once: one hand sink, one floor drain. A multiply zone is a box whose counts are multiplied.\n1. In the header, click [[⋯]], then [[Multiply Zone]] (or press X).\n2. Drag a box around detail 2.\n3. Type the number the bid carries.\n4. Click [[Apply]].',
          target: ['#multiplyZoneBtn', '#multiplyZoneBtnSidebar', '#headerMoreBtn'],
          check: () => { const a = pageAnn(K().P401); return !!a && (a.multiplyZones || []).some((z) => (z.multiplier || 1) === 4); },
          hint: () => { const a = pageAnn(K().P401); const z = a && (a.multiplyZones || []).find((x) => (x.multiplier || 1) > 1); return z && (z.multiplier || 1) !== 4 ? 'The sheet says how many: right-click the zone\'s label to change the number' : T().boxMiss(K().rectsOf(K().P401, 'multiplyZones'), DETAIL_INNER(), DETAIL_OUTER()); },
          action: { label: 'Wrap detail 2 in a ×4 zone', run: () => { const k = K(); k.goPage(k.P401); const a = App.ensureActiveCanvas(S().pages[k.P401]).annotations; if (!a.multiplyZones) a.multiplyZones = []; if (a.multiplyZones.length) return; App.pushUndoSnapshotCurrentPage(); a.multiplyZones.push(Object.assign({ id: App.uid(), multiplier: 4 }, k.DETAIL.box)); k.dirty(); } } },
        { id: 'read', title: 'Count one, bid four', kind: 'read',
          body: 'Answer: four of everything in it. Four hand sinks, four floor drains, four sets of supplies, traps and primers, though the sheet draws one.\nTYP. is the engineer saving ink: drawn once, built four times. It is the estimator\'s most common miss.\nNote 2 asks for four cook line and bar stations, but P-101 draws three hand sinks. Bid the four, and ask in an RFI where the fourth one goes.\n1. In the left sidebar, look at SUMMARY. HS-1 and FD-1 read 4, while the sheet still shows one mark of each.',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'A second sheet with its own scale, a detail with its own, and a typical counted once.\nNext: [[Learn]] → Chapter 8, the whole sheet.',
    },
    // 8 -------------------------------------------------------------------------------------
    {
      id: 'whole', title: 'Chapter 8: The whole sheet', short: 'the sheet, finished', minutes: 10, page: 0, noun: 'chapter',
      intro: 'Everything the course traced and counted, done in one pass. Then set beside the reference takeoff, the right answer from the sheet\'s own geometry, run by run. Then the marked-up sheet on paper.',
      seed() { scaleP101(); },
      steps: [
        { id: 'lay', title: 'Finish the takeoff', kind: 'do', cardAt: 'bl',
          body: 'Chapters 2 to 7 taught each piece. This is all of them on one sheet, by hand.\n1. Count and trace until the line beside [[Show me where]] on this card stops naming what is missing.\nIt names one thing at a time, and reads ✓ Done when nothing is.\nThe whole list: every fixture under its tag, and every run by size and material. The service, the trunk, the hot supply and its return, the branches, the sanitary and grease lines, the gas.\n[[Skip this step]] moves on with the sheet as it is. The next card compares it against the reference.\n[[Finish the takeoff for me]] lays the reference takeoff on the sheet instead, if you would rather see it done.',
          target: ['#annCanvas'], check: takeoffComplete, hint: takeoffHint,
          action: { label: 'Finish the takeoff for me', run: layEverything },
          // PP-WHOLE-SKIP (2026-09-27): the action is the engine's spec seam and draws no button on a
          // step that is not handsOff, so the card the reader is sent Back to shows it as its alt.
          alt: { label: 'Finish the takeoff for me', run: layEverything } },
        { id: 'compare', title: 'Against the reference', kind: 'read', cardAt: 'tl',
          // PP-WHOLE-SKIP (2026-09-27): Skip on the lay step leaves the sheet as it is, and nothing
          // fills it in. With no mark on it there is nothing to compare, so the card says so and
          // points back at the button beside Skip, instead of listing every run as short.
          body: () => (takeoffSkipped() ? 'You skipped the takeoff, so the sheet has no marks, and there is nothing to compare yet.\nTo see the answer, click [[Back]] and press [[Finish the takeoff for me]]. It lays the reference takeoff on the sheet, and this card then checks it run by run.\nOr read on: [[Next]] moves on with the sheet as it is.' : compareBody()),
          target: [], check: () => true },
        { id: 'legend', title: 'The legend on the sheet', kind: 'do', hold: true,
          body: '1. In the left sidebar, click the gear beside the SUMMARY heading.\nSummary Legend sets how the legend on the sheet draws. A tally for plumbing, or a compact ruled block, the way an engineer draws one.\nIt lists every counter and every line type with its feet, so the marked-up sheet reads without the app.',
          target: ['#legendSettingsModal .modal-card', '#summarySettingsBtn'], check: () => K().modalUp('legendSettingsModal'),
          action: { label: 'Open Summary Legend', run: () => { if (App.openLegendSettingsModal) App.openLegendSettingsModal(); } } },
        { id: 'pdfs', title: 'The marked-up set', kind: 'do', hold: true,
          body: '1. Under EXPORT OPTIONS, click [[Export PDFs]]. It shows once the sheet carries a mark: with the takeoff skipped there is nothing to export, and Next moves on.\nChoose the sheets, and set marker and line sizes for print. Let the report and the noted sheets ride along.\nThis is the set the GC reads and the foreman, the crew\'s lead on site, builds from.',
          // Export PDFs shows only once the sheet carries a mark; after the takeoff step's Skip there is
          // nothing to export, the button is hidden, and the step would hold a reader for good (by
          // hand, 2026-09-25). Then it passes and says why.
          target: ['#specificPagesModal .modal-card', '#specificPages', '#exportOptionsSectionTitle'], check: () => K().modalUp('specificPagesModal') || takeoffSkipped(),
          action: { label: 'Open Export PDFs', run: () => { if (App.openSpecificPagesModal) App.openSpecificPagesModal(); else el('specificPages').click(); } } },
      ],
      done: 'The whole sheet, counted and traced, checked against the reference, and on paper.\nNext: [[Learn]] → Chapter 9, the bid.',
    },
    // 9 -------------------------------------------------------------------------------------
    {
      id: 'bid', title: 'Chapter 9: Check it, prove it, hand it off', short: 'a bid you can defend', minutes: 8, page: 0, noun: 'chapter',
      intro: 'What each Bid Check row means in the trade, and which ones the sheet already answers. Where a number came from when someone asks, and the ways out of the app.',
      seed() {
        const b = seedCopperBranch();
        b.cu.childCounts = [K().hangerRuleFor(b.cu)];
        const k = K();
        markMissing(pick('fd'), [k.FD.kitchen1, k.FD.kitchen2, k.FD.kitchen3]);
        // chapter 6's flag, so the Notes ledger has something to list (it hides with no notes)
        k.addNote(pts(G.hoodValve)[0], 'RFI: Who furnishes and sets the gas shutoff valve the hood suppression system trips?', '#e85447');
        const ss = k.makeLineType('4in PVC', '#8a4bb0');
        if (!polylinesOn(RE.pvc4).length) tracePlan(ss, G.ssRun, 'Sanitary');
      },
      steps: [
        { id: 'open', title: 'Open Bid Check', kind: 'do',
          onEnter: () => T().foldBidCheck(), hold: true, body: '1. In the left sidebar, click BID CHECK to expand it.\nRows marked AUTO are judged by the app from your runs. The rest are questions only you can answer.',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false,
          action: { label: 'Open it', run: () => K().openBidCheck() } },
        { id: 'rows', title: 'What the rows mean', kind: 'read',
          rules: ['plumb.drain.dfu-capacity', 'plumb.trap.arm-length'],
          body: 'The manual rows are the ones you tick yourself. They read: fixture units against the building drain, trap arm lengths, slope on every waste run, backflow and water-heater venting.\nWhich of them did the engineer already answer on this set?',
          reveal: 'All four, on paper. P-501 adds the drainage load to 51 fixture units. The 4" sewer carries 180 DFU at 1/8" per foot (IPC 710).\nThe riser dimensions the trap arms against Table 909.1. The general notes give the slope. The RPZ is the backflow answer.\nThe WH keynote says 100 GAL GAS, so it has a flue, the pipe that carries its exhaust out.\nThe rows are there because the bid is yours, not the engineer\'s. You tick each one when you have READ the answer.\nThe sheet that missed one is the change order you eat. A change order is the extra the owner pays when the drawing was wrong; one you eat, you pay yourself.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => true },
        { id: 'tick', title: 'Sign what you have read', kind: 'do',
          body: '1. In the left sidebar, under BID CHECK, click the row that reads Scale verified on every counted sheet. One click signs it for the whole bid.\n2. Click Fixture units checked against the building drain size.\n3. Click Trap arm lengths within the table.\nYour ticks are saved with the bid. Hand off, send the takeoff on to pricing, with a row still open and the app asks once, then remembers.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => manual('scale-verified') && manual('fixture-units') && manual('trap-arms'),
          action: { label: 'Tick the three for me', run: () => { K().tickManual('scale-verified'); K().tickManual('fixture-units'); K().tickManual('trap-arms'); } } },
        { id: 'proof', title: 'Where did that number come from?', kind: 'do', hold: true,
          body: '1. In the left sidebar, under SUMMARY, click the FD-1 total.\nThe breakdown shows the count sheet by sheet with a thumbnail of where every mark sits, zones already applied. This is what you open when the GC questions the number.',
          target: () => T().ladder('#summaryCountDetailModal .modal-card', T().summaryRowOf('counter', counter(RE.fd)), '#summarySectionTitle'), check: () => K().detailOpenFor(counter(RE.fd)), hint: () => K().detailMiss(counter(RE.fd)),
          action: { label: 'Open the breakdown', run: () => { const c = counter(RE.fd); if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); } } },
        { id: 'ledger', title: 'Every question in one list', kind: 'do', hold: true,
          body: '1. In the header, click [[Notes ledger]], the page icon; its badge counts the open RFI flags.\nIt lists every note, sheet by sheet. The RFI chip at its top narrows it to the flags, and a click on a row takes you to the spot.\nRead it once before the bid goes out.',
          target: ['#notesLedgerDrawer', '#notesLedgerBtn'], check: () => { const b = el('notesLedgerBtn'); return !!b && b.getAttribute('aria-expanded') === 'true'; },
          action: { label: 'Open it for me', run: () => { if (App.openNotesLedger) App.openNotesLedger(); else if (el('notesLedgerBtn')) el('notesLedgerBtn').click(); } } },
        { id: 'handoff', title: 'Hand it off', kind: 'read',
          body: '1. [[Copy to /Tooling]] puts the whole takeoff on the clipboard, for the bid in PipeTooling, the pricing app.\nIt copies the fixtures and the feet, hangers and fittings under their pipe, primers under their drains. Its first line names exactly what was copied.\n2. [[Copy RFI Flags]] puts your questions beside it.\n3. [[Show Report]] is the full breakdown for the bid file.\nMore: [Reports and exports](/guides/reports-and-exports/).',
          target: ['#forPipeTooling', '#exportOptionsSectionTitle'], check: () => true },
      ],
      done: 'That is the course: a restaurant\'s plumbing read off the engineer\'s set, counted with the app, checked, and handed to the bid.\nWhen you are ready for a real set, click [[Upload PDF]]. The guides live under Project Settings → Help.',
    },
  ];

  // ----- the runner, the lessonKit's (R15) --------------------------------------------------
  // The chapters' tours, the Learn menu section, the doors and the routes, /app/?course=plumbing
  // and /app/?chapter=plumbing:<id>. The one lessonKit read at load: lessons.js loads first.
  const course = K().registerCourse({ id: COURSE, chapters: CHAPTERS, doors: { hint: 'canvasEmptyHintCourse', settings: 'settingsCourse' } });
  App.startChapter = course.start;
  App.courseChapterIds = () => CHAPTERS.map((c) => c.id);
  App.courseReference = () => ({ feet: referenceFeet(), counts: COUNTS().map(([tag, spots, label]) => [label, spots.length]) });
})();
