/*
 * features/course-hvac.js - the HVAC course: how a restaurant gets its air, taught on the
 * engineered mechanical set with the app's own tools. Nine chapters on the tour engine,
 * the third of the trade courses (features/course-plumbing.js, features/course-electrical.js),
 * same rules, same doors. Plan of record: journeys/plans/HVAC-COURSE.md.
 *
 * The set (samples/sample-hvac.pdf, scripts/sample-hvac.js): the same Main St Restaurant as
 * P-101 on the same shell, so a device sits at a P-101 coordinate. M-101 the mechanical
 * plan (RTU-1 on a roof key, its main sized down the hall and across the dining room with
 * every size printed beside it, diffusers with their CFM, return grilles to the plenum, the
 * hood's exhaust, the restroom exhaust, make-up air), M-501 the schedules (equipment, the
 * diffuser schedule the schedule reader turns into counters, the room air schedule), M-601
 * a ceiling section at 1/2" the plenum can be measured on.
 *
 * The teaching mode is the plumbing course's: a question about the sheet is a doing step
 * whose check passes only on the right click and whose hint says why the wrong one was
 * wrong, the explanation and its source on the next card, sheet work inside the engine's
 * on-sheet targets, a QUESTION step drawing none. The app's own arithmetic teaches where it
 * can: the Rooms row that reads "needs 1,200 · served 0" until the diffusers land, the
 * ductulator agreeing with the engineer's printed sizes, the Fits the roof and Static path
 * rows of Bid Check turning from a question into a verdict once the deck, the ceilings and
 * the unit's ESP are known, and the Duct Schedule's pounds.
 *
 * Everything a lesson has comes from App.lessonKit (features/lessons.js) at call time; a
 * chapter names its set (`set`) and stands alone. Point lists are FLAT (teaching-labels.test.js).
 * Progress: localStorage `clickcount-course-done`, { 'hvac:<id>': ISO }. Doors: the Learn
 * menu's section (#learnCourseList-hvac), the empty-canvas "air" link, Project Settings →
 * Help → "hvac course", /app/?course=hvac, /app/?chapter=hvac:<id>.
 *
 * Registrations: startChapterHvac(id), courseHvacIds(), courseHvacReference().
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const COURSE = 'hvac';
  const DONE_KEY = 'clickcount-course-done';
  const MSET = { url: '/samples/sample-hvac.pdf', name: 'sample-hvac', pages: 3, trade: 'hvac', word: 'three' };
  const M101 = 0, M501 = 1, M601 = 2;
  const K = () => App.lessonKit;
  const T = () => App.tourKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tourId = (id) => 'course:' + COURSE + ':' + id;
  const key = (id) => COURSE + ':' + id;

  // ----- the sheets, in PDF points ----------------------------------------------------------------
  // M-101 sits on P-101's shell: a plan point is (60 + 0.75·x, 70 + 0.75·y), K().P. These lists
  // mirror DEVICES / DUCT in scripts/sample-hvac.js, FLAT (x, y, x, y…).
  const P = (x, y) => K().P(x, y);
  const G = {
    dim318: [560, 84, 940, 84],
    SD1: [190, 210, 300, 210, 410, 210, 520, 210, 190, 350, 300, 350, 410, 350, 520, 350, 200, 540, 330, 540, 596, 506],   // 150 CFM: dining 8, bar 2, dish 1
    SD2: [800, 282, 820, 506],                                                                                                 // 100 CFM: hall, storage
    SD3: [600, 440, 700, 440, 800, 440, 900, 440],                                                                             // 200 CFM: the kitchen
    RG1: [350, 300, 450, 300, 620, 460], EG1: [630, 200, 766, 200, 885, 200], MA1: [640, 372], T: [554, 300, 566, 440],
    rtu: [998, 328], ef1: [998, 255], ef2: [994, 182], mau: [998, 383],                                                         // the roof keys' centres
    main: [904, 328, 904, 282, 560, 282, 420, 282, 300, 282, 180, 282],                                                       // 24x12 to the hall, then 20x12, 16x10, 12x10 down the dining room
    kitchen: [572, 282, 572, 440, 900, 440], back: [904, 328, 904, 506, 596, 506], bar: [260, 282, 260, 540], makeup: [904, 372, 640, 372],
    exhaust: [630, 206, 905, 206, 905, 150],
    grease: [836, 323, 836, 400, 880, 400],                                                                                 // the hood collar, the elbow with its cleanout, the curb up to EF-1
    fd: [572, 296, 904, 296], notRated: [904, 470, 260, 470],                                                                 // the two rated-wall penetrations; two walls that are not rated
    dining: [130, 100, 560, 470], kitchen_room: [560, 296, 940, 470], hall: [560, 252, 940, 296],
  };
  const SECTION = { prove: [140, 208, 140, 640], plenum: [180, 208, 180, 316], depth: [640, 238, 640, 286] };   // M-601, sheet points at 36 pt/ft
  const SCHEDULE_BOX = { x1: 110, y1: 290, x2: 760, y2: 430 };     // M-501: the diffuser and grille schedule
  const KITCHEN_ROW = { x1: 112, y1: 610, x2: 640, y2: 628 };       // M-501: KITCHEN 105 in the room air schedule
  const pts = (flat) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push(P(flat[i], flat[i + 1])); return out; };
  const raw = (flat) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] }); return out; };
  const rect = (flat) => ({ x1: P(flat[0], flat[1]).x, y1: P(flat[0], flat[1]).y, x2: P(flat[2], flat[3]).x, y2: P(flat[2], flat[3]).y });
  const planFeet = (flat) => { let px = 0; for (let i = 2; i + 1 < flat.length; i += 2) px += Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]); return px / 12; };
  const RS = (w, h) => (typeof makeRectSize === 'function' ? makeRectSize(w, h) : { kind: 'rect', w, h });
  const RD = (d) => (typeof makeRoundSize === 'function' ? makeRoundSize(d) : { kind: 'round', d });
  const sizeKey = (s) => (s && s.kind === 'round' ? s.d + '"ø' : s ? s.w + 'x' + s.h : '');
  const ROOMS = { dining: { name: 'DINING', cfm: 1200, inner: [140, 110, 550, 460], outer: [100, 80, 575, 490] }, kitchen: { name: 'KITCHEN', cfm: 800, inner: [570, 306, 930, 460], outer: [540, 285, 960, 480] }, hall: { name: 'HALL', cfm: 100, inner: [570, 258, 930, 290], outer: [540, 240, 960, 300] } };

  // ----- readers -------------------------------------------------------------------------------------
  const counter = (re) => K().counterNamed(re);
  const byTag = (tag) => (S().counters || []).find((c) => String(c.tag || '').toUpperCase() === tag) || (S().counters || []).find((c) => new RegExp('(^|\\s)' + tag + '( ·|$)', 'i').test(c.name || ''));   // "(^|\s)": the Quick tab names one 6" Fire Damper
  const pageAnn = (i) => K().pageAnn(i);
  const marksOf = (c, pageIdx) => { const a = pageAnn(pageIdx); return c && a ? (a.counterMarkers[c.id] || []) : []; };
  const markNear = (c, spot, d, pageIdx) => marksOf(c, pageIdx).some((m) => K().near(m, spot, d));
  const ductRuns = (pageIdx) => { const a = pageAnn(pageIdx == null ? M101 : pageIdx); return (a && a.ductRuns) || []; };
  const runSizes = (run) => (run.segments || []).map((s) => sizeKey(s.size));
  const runWith = (sizes, pageIdx) => ductRuns(pageIdx).find((r) => runSizes(r).join(' ') === sizes.join(' '));
  const roomNamed = (re) => (S().rooms || []).find((r) => re.test(r.name || ''));
  const notesNear = (spot, d, pageIdx) => { const a = pageAnn(pageIdx); return a ? (a.notes || []).filter((n) => K().near(n, spot, d)) : []; };
  const ductRow = (id) => { const bc = App.getDuctBidCheck ? App.getDuctBidCheck() : null; return bc ? (bc.rows || []).find((r) => r.id === id) : null; };
  const manual = (id) => !!(S().bidCheck && S().bidCheck.manual && S().bidCheck.manual[id]);
  const RE = { rtu: /\brtu\b/i, ef1: /\bef-?1\b/i, mau: /\bmau/i, ef2: /\bef-?2\b/i, stat: /thermostat/i, fd: /fire damper/i };

  // ----- on-sheet targets (the engine's) -----------------------------------------------------------------
  const ZR = 14;
  const circlesOn = (pageIdx, c, spots, r) => T().markZones(pageIdx, (c || {}).id || '__none__', spots, r || ZR);
  const guide = (spots, r, done) => spots.map((p) => ({ kind: 'circle', x: p.x, y: p.y, r, done: !!done }));
  const ductPaths = (pageIdx) => { const runs = ductRuns(pageIdx).map((r) => r.vertices || []); const d = S().drawingDuct; return d && d.vertices ? runs.concat([d.vertices]) : runs; };
  const traceZones = (spots, pageIdx) => T().pathZones(spots, 15, ductPaths(pageIdx));
  const allDone = (zs) => T().allDone(zs);
  const rectsOf = (pageIdx, keyName, test) => { const a = pageAnn(pageIdx); return ((a && a[keyName]) || []).filter((z) => !test || test(z)); };
  const roomBoxZone = (room) => { const r = roomNamed(new RegExp(room.name, 'i')); return T().boxZone(rectsOf(M101, 'roomBoxes', (b) => r && b.roomId === r.id), rect(room.inner), rect(room.outer), 'Drag your box around ' + room.name + ', anywhere in here'); };
  const missing = (c, spots, labels, d, pageIdx) => { const ms = marksOf(c, pageIdx); const out = []; spots.forEach((pt, i) => { if (!ms.some((m) => K().near(m, pt, d || 10))) out.push(labels[i]); }); return out.length ? out.length + ' more: ' + out.join(', ') : ''; };

  // ----- the counters, the way the Quick tab and the schedule reader make them -----------------------------
  const icon = (variant) => (App.tradeIconForType && App.tradeIconForType('hvac', variant)) || (App.cfmDefaultIcon && App.cfmDefaultIcon()) || T().firstIcon();
  const TAGS = {
    'SD-1': ['Supply Diffuser', '#e8c547', 150], 'SD-2': ['Supply Diffuser', '#4a9eff', 100], 'SD-3': ['Supply Diffuser', '#47c88e', 200],
    'RG-1': ['Return Grille', '#8a4bb0', 0], 'EG-1': ['Exhaust Grille', '#c8963a', 75], 'MA-1': ['Supply Diffuser', '#e85447', 2000],
  };
  // Each Prove it step's proof (features/tutorial.js measureProof): the dimension drawn between its
  // circles, a circle that ticks as its click lands, a hint that names the miss, and the reading held
  // on the card. Built on first use: the tour kit registers after this file loads.
  const proofs = {};
  const proof = (key, make) => proofs[key] || (proofs[key] = T().measureProof(make()));
  const proveM101 = () => proof('M101', () => ({ page: M101, ends: pts(G.dim318), r: 13, ft: 31.67, tol: 0.4, stated: '31\'-8"' }));
  const proveM601 = () => proof('M601', () => ({ page: M601, ends: raw(SECTION.prove), r: 13, ft: 12, tol: 0.4, stated: '12\'-0"' }));
  // the depth string beside the wrapped main, on the same proof: its circles tick as each click lands
  // and a 1'-4" read off anywhere else does not pass (by hand, 2026-09-25)
  const depthM601 = () => proof('M601depth', () => ({ page: M601, ends: raw(SECTION.depth), r: 12, ft: 1.33, tol: 0.15, stated: '1\'-4"' }));
  let depthEntryMeasure = null;   // the 12'-0" read on the step before is still the sheet's last measure
  const AIR_TAGS = ['SD-1', 'SD-2', 'SD-3', 'EG-1', 'MA-1'];   // the counters the schedule gives a CFM
  function pickTag(tag) {
    const have = byTag(tag);
    const t = TAGS[tag];
    if (have) { if (t[2] && !(have.cfm > 0)) have.cfm = t[2]; return have; }
    const c = Object.assign({ id: App.uid(), name: tag + ' · ' + t[0], icon: icon(t[0]), color: t[1], tag, lesson: true }, t[2] ? { cfm: t[2] } : {});
    S().counters.push(c);
    return c;
  }
  function pickUnit(re, name, variant, color) {
    const have = counter(re); if (have) return have;
    const c = { id: App.uid(), name, icon: icon(variant), color, lesson: true };
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
  const scaleM101 = () => K().setScale(M101, 9, '1/8" = 1\'');
  // The schedule reader over M-501's diffuser schedule: six counters named by their tag, each
  // then given the CFM its row prints (the reader reads names, not numbers).
  async function readDiffuserSchedule() {
    K().goPage(M501);
    if (!App.proposeCountersFromBox) return;
    const before = new Set((S().counters || []).map((c) => c.id));
    App.proposeCountersFromBox(SCHEDULE_BOX);
    for (let i = 0; i < 40 && !K().modalUp('schedulePaletteModal'); i++) await wait(100);
    if (K().modalUp('schedulePaletteModal') && el('schedulePaletteCreate')) { el('schedulePaletteCreate').click(); await wait(100); }
    (S().counters || []).forEach((c) => { if (!before.has(c.id)) c.lesson = true; });
    App.pushUndoSnapshot();
    Object.keys(TAGS).forEach(pickTag);
    K().dirty();
  }
  // A room box through the app's own dialog, then the engineer's CFM from the schedule on it.
  async function boxRoom(room) {
    if (roomBoxZone(room).done) return;
    K().goPage(M101);
    if (!App.openRoomBoxModal) return;
    App.openRoomBoxModal(rect(room.inner));
    const nameEl = el('roomBoxNewRoomName');
    for (let i = 0; i < 20 && nameEl && !nameEl.value.trim(); i++) await wait(100);
    if (nameEl) nameEl.value = room.name;
    const h = el('roomBoxHeight'); if (h) h.value = '9';
    const deck = el('roomBoxDeck'); if (deck) deck.value = '12';
    await wait(50);
    if (el('roomBoxApply')) el('roomBoxApply').click();
    await wait(80);
    const r = roomNamed(new RegExp(room.name, 'i'));
    if (r) { r.roomType = 'custom'; r.targetCfmOverride = room.cfm; }
    if (App.setDuctDeckHeight && !(App.getDuctSettings && App.getDuctSettings().deckHeightFt > 0)) App.setDuctDeckHeight(12);
    S().tool = App.TOOL.NONE; K().dirty();
  }
  // Where the ring goes on a Room Sizer step: the box tools until the room exists, then its row under
  // ROOMS and Edit Room's fields (the row, not a pencil: the ⋯ stayed lit after Apply while the
  // card said to open the room, by hand 2026-09-25). `todo` is the rooms the step still needs.
  // The Duct dialog's ring in the card's order: each setting until it reads what the card asks, then
  // Start Tracing (the ring sat on Start Tracing over an unset shape, size, airside and material; by hand,
  // 2026-09-25). `want`: { shape, d } or { w, h }, airside, material.
  function ductFormLadder(want) {
    const q = (sel) => document.querySelector(sel);
    const on = (sel) => { const b = q(sel); return !!b && b.classList.contains('active'); };
    const num = (sel) => Number((q(sel) || {}).value);
    const todo = [];
    if (want.shape && !on('#ductCreateShapeToggle [data-shape="' + want.shape + '"]')) todo.push('#ductCreateShapeToggle [data-shape="' + want.shape + '"]');
    if (want.d && num('#ductCreateD') !== want.d) todo.push('#ductCreateD');
    if (want.w && (num('#ductCreateW') !== want.w || num('#ductCreateH') !== want.h)) todo.push(num('#ductCreateW') !== want.w ? '#ductCreateW' : '#ductCreateH');
    if (want.airside && !on('#ductCreateAirside [data-airside="' + want.airside + '"]')) todo.push('#ductCreateAirside [data-airside="' + want.airside + '"]');
    if (want.material != null && (q('#ductCreateMaterial') || {}).value !== want.material) todo.push('#ductCreateMaterial');
    return todo.slice(0, 1).concat(['#ductCreateStart']);
  }
  const roomRowSel = (name) => { const rows = Array.from(document.querySelectorAll('#roomsList .room-row')); const i = rows.findIndex((r) => new RegExp(name, 'i').test((r.querySelector('.room-row-name') || {}).textContent || '')); return i < 0 ? null : '#roomsList .room-row-wrap:nth-child(' + (i + 1) + ') .room-row'; };
  const ROOM_BOX_LADDER = ['#roomEditSave', '#roomBoxApply', '#roomBtn', '#roomBtnSidebar', '#headerMoreBtn', '#roomsSectionTitle'];
  const roomLadder = (todo) => {
    const next = todo.find((room) => !roomReady(room));
    if (!next || !roomNamed(new RegExp(next.name, 'i'))) return ROOM_BOX_LADDER;
    // inside Edit Room, the field the card asks for next: Room type (Target CFM shows only for Custom), the CFM, Save
    const type = document.getElementById('roomEditType'), cfm = document.getElementById('roomEditTargetCfm');
    const field = type && type.value !== 'custom' ? '#roomEditType' : (cfm && !(Number(cfm.value) > 0) ? '#roomEditTargetCfm' : '#roomEditSave');
    return T().ladder(field, roomRowSel(next.name), '#roomsSectionTitle');
  };
  const roomReady = (room) => { const r = roomNamed(new RegExp(room.name, 'i')); return !!(r && r.targetCfmOverride === room.cfm && roomBoxZone(room).done); };
  function makeSystem() {
    const s = S();
    let g = (s.groups || []).find((x) => /rtu-?1/i.test(x.equipmentTag || x.name || ''));
    if (!g) {
      if (!s.groupsEnabled) { if (App.turnOnGroups) App.turnOnGroups(); else s.groupsEnabled = true; }
      App.pushUndoSnapshot();
      g = { id: App.uid(), name: 'RTU-1', color: '#2e86de', equipmentTag: 'RTU-1', capacityCfm: 3000, espInWg: 1.0 };
      s.groups = s.groups || []; s.groups.push(g);
    }
    if (!(g.capacityCfm > 0)) g.capacityCfm = 3000;
    if (!(g.espInWg > 0)) g.espInWg = 1.0;
    markMissing(pickUnit(RE.rtu, 'RTU-1', 'RTU', '#2e86de'), pts(G.rtu), M101);
    s.activeGroupId = g.id;
    K().dirty();
    return g;
  }
  const system = () => (S().groups || []).find((x) => /rtu-?1/i.test(x.equipmentTag || x.name || ''));
  // A duct run laid through the model the tool commits with (duct-model's makeDuctRun onto
  // the active canvas, then the fittings walk), synchronously, so a seed can lay it before
  // the chapter's page changes. `steps` maps a vertex index to the size that STARTS there,
  // the way S at that vertex would. The reader traces by hand with the tool.
  function layRun(flat, firstSize, steps, opts) {
    const o = opts || {};
    const v = pts(flat);
    const segments = [{ startVertexIdx: 0, size: firstSize }];
    Object.keys(steps || {}).map(Number).sort((a, b) => a - b).forEach((i) => segments.push({ startVertexIdx: i, size: steps[i] }));
    const g = system();
    const run = typeof makeDuctRun === 'function'
      ? makeDuctRun({ name: o.name || '', airside: o.airside || 'supply', pressureClass: '1', linerType: o.wrap ? 'wrap' : null, linerThicknessIn: o.wrap ? 2 : 0, material: o.material || null, systemGroupId: g ? g.id : null, vertices: v, segments })
      : { id: App.uid(), name: o.name || '', airside: o.airside || 'supply', pressureClass: '1', linerType: o.wrap ? 'wrap' : null, linerThicknessIn: o.wrap ? 2 : 0, material: o.material || null, systemGroupId: g ? g.id : null, vertices: v, segments };
    const a = App.ensureActiveCanvas(S().pages[M101]).annotations;
    if (!a.ductRuns) a.ductRuns = [];
    a.ductRuns.push(run);
    if (App.reinferDuctFittings) App.reinferDuctFittings(M101);
    return run;
  }
  const MAIN_SIZES = ['24x12', '20x12', '16x10', '12x10'];
  const traceMain = () => layRun(G.main, RS(24, 12), { 2: RS(20, 12), 3: RS(16, 10), 4: RS(12, 10) }, { wrap: true, name: 'Supply main' });
  const mainDone = () => !!runWith(MAIN_SIZES);
  // Every CFM device within reach of a run moves onto it, the way Attach to nearest run does
  // (the tour's seam): attached devices are what a system's designed air and its static path count.
  function attachAll() {
    const s = S();
    if (!App.strayDeviceAttachTarget) return;
    const a = pageAnn(M101); if (!a) return;
    let moved = 0;
    (s.counters || []).filter((c) => c.cfm > 0).forEach((c) => {
      (a.counterMarkers[c.id] || []).forEach((m, i) => {
        s.ctxTarget = { type: 'marker', typeId: c.id, index: i };
        const target = App.strayDeviceAttachTarget();
        if (!target) return;
        if (!moved) App.pushUndoSnapshot();
        target.marker.x = target.point.x; target.marker.y = target.point.y; moved++;
      });
    });
    s.ctxTarget = null;
    if (moved) K().dirty();
    return moved;
  }
  const strays = () => { const devs = (App.collectDuctDevices ? App.collectDuctDevices(M101) : []).map((d) => ({ x: d.x, y: d.y })); if (!devs.length || typeof attachDuctDevices !== 'function') return 0; return attachDuctDevices(devs, ductRuns(M101)).unattached.length; };
  // The grease run: 18" round in welded black steel, whatever else it carries.
  const greaseRun = () => ductRuns(M101).find((r) => runSizes(r).join(' ') === '18"ø' && r.material === 'black-steel');
  const fdCounter = () => counter(RE.fd);
  const fdStray = () => { const c = fdCounter(); if (!c) return null; const spots = pts(G.fd); return marksOf(c, M101).find((m) => !spots.some((p) => K().near(m, p, 14))) || null; };
  function seedMain() { if (!mainDone()) traceMain(); if (!runWith(['16x10'])) layRun(G.kitchen, RS(16, 10), null, { name: 'Kitchen branch' }); attachAll(); }
  function tick(id) { const s = S(); s.bidCheck = s.bidCheck || { manual: {} }; s.bidCheck.manual = s.bidCheck.manual || {}; if (s.bidCheck.manual[id]) return; App.pushUndoSnapshot(); s.bidCheck.manual[id] = true; s.bidCheckCollapsed = false; K().dirty(); }
  const openBidCheck = () => { S().bidCheckCollapsed = false; if (App.renderBidCheck) App.renderBidCheck(); App.updateUI(); };
  function seedRooms() { ['dining', 'kitchen', 'hall'].forEach((k) => { const room = ROOMS[k]; if (roomNamed(new RegExp(room.name, 'i'))) return; const r = { id: App.uid(), name: room.name, color: '#4a9eff', roomType: 'custom', targetCfmOverride: room.cfm }; S().rooms = S().rooms || []; S().rooms.push(r); const a = App.ensureActiveCanvas(S().pages[M101]).annotations; if (!a.roomBoxes) a.roomBoxes = []; a.roomBoxes.push(Object.assign({ id: App.uid(), heightFt: 9, roomId: r.id }, rect(room.inner))); }); if (App.setDuctDeckHeight) App.setDuctDeckHeight(12); }
  function seedDiffusers() { Object.keys(TAGS).forEach(pickTag); markMissing(byTag('SD-1'), pts(G.SD1), M101); markMissing(byTag('SD-2'), pts(G.SD2), M101); markMissing(byTag('SD-3'), pts(G.SD3), M101); }

  // ----- the reference takeoff ------------------------------------------------------------------------------
  // 24x12 from the roof to the dining wall (three vertices), then one span each: the size the
  // plan prints at a corner starts there.
  const REF_DUCT = [
    ['24x12', () => planFeet(G.main.slice(0, 6))], ['20x12', () => planFeet(G.main.slice(4, 8))], ['16x10', () => planFeet(G.main.slice(6, 10)) + planFeet(G.kitchen)],
    ['12x10', () => planFeet(G.main.slice(8, 12))], ['12x8', () => planFeet(G.back)], ['10x8', () => planFeet(G.bar)], ['20x16', () => planFeet(G.makeup)], ['8"ø', () => planFeet(G.exhaust)], ['18"ø', () => planFeet(G.grease)],
  ];
  const row = (tag, spots, labels) => [tag, spots, labels];   // no nested pairs in this source (the labels test)
  const COUNTS = () => [row('SD-1', pts(G.SD1)), row('SD-2', pts(G.SD2)), row('SD-3', pts(G.SD3)), row('RG-1', pts(G.RG1)), row('EG-1', pts(G.EG1)), row('MA-1', pts(G.MA1)), row('Fire Damper', pts(G.fd))];
  const scheduleFeet = () => { const out = {}; const sch = App.computeDuctSchedule ? App.computeDuctSchedule() : null; ((sch && sch.straightRows) || []).forEach((r) => { const k = String(r.sizeKey || '').replace(/×/g, 'x').replace(/Ø/g, 'ø').replace(/\s/g, ''); out[k] = (out[k] || 0) + (r.lengthFt || 0); }); return { rows: out, lb: sch ? sch.bidWeightLb : 0, grease: sch ? sch.grease : null }; };
  const fmtFt = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const countOk = ([tag, spots]) => { const c = byTag(tag); return !!c && marksOf(c, M101).length >= spots.length && spots.every((pt) => markNear(c, pt, 100, M101)); };   // attached, a diffuser sits on its run, up to the attach reach from the printed spot
  async function layEverything() {
    scaleM101();
    App.pushUndoSnapshotCurrentPage();
    seedRooms();
    seedDiffusers();
    markMissing(pickTag('RG-1'), pts(G.RG1), M101); markMissing(pickTag('EG-1'), pts(G.EG1), M101); markMissing(pickTag('MA-1'), pts(G.MA1), M101);
    markMissing(pickUnit(RE.stat, 'Thermostat', 'Thermostat', '#c8963a'), pts(G.T), M101);
    await makeSystem();
    seedMain();
    if (!runWith(['12x8'])) layRun(G.back, RS(12, 8), null, { name: 'Back rooms' });
    if (!runWith(['10x8'])) layRun(G.bar, RS(10, 8), null, { name: 'Bar' });
    if (!runWith(['20x16'])) layRun(G.makeup, RS(20, 16), null, { name: 'Make-up air' });
    if (!runWith(['8"ø'])) layRun(G.exhaust, RD(8), null, { airside: 'exhaust', name: 'Restroom exhaust' });
    if (!greaseRun()) layRun(G.grease, RD(18), null, { airside: 'exhaust', material: 'black-steel', name: 'Hood exhaust' });
    markMissing(pickUnit(RE.fd, 'Fire Damper', 'Fire Damper', '#e85447'), pts(G.fd), M101);
    attachAll();
    K().goPage(M101);
    K().dirty();
  }
  const takeoffComplete = () => { const f = scheduleFeet().rows; return REF_DUCT.every(([k, ft]) => (f[k] || 0) >= ft() * 0.95) && COUNTS().every(countOk) && !!system(); };
  function takeoffHint() {
    const f = scheduleFeet().rows;
    const run = REF_DUCT.find(([k, ft]) => (f[k] || 0) < ft() * 0.95);
    if (run) return 'Not yet traced: the ' + run[0] + ' duct';
    const c = COUNTS().find((x) => !countOk(x));
    return c ? 'Not all counted: ' + c[0] : (system() ? '' : 'RTU-1 is not a system yet');
  }
  function compareBody() {
    const f = scheduleFeet();
    const lines = ['Reference on the left, from the sheet\'s own geometry. Yours on the right, from the Duct Schedule.'];
    REF_DUCT.forEach(([k, ft]) => { const ref = ft(), mine = f.rows[k] || 0; const ok = mine >= ref * 0.95 && mine <= ref * 1.05; lines.push(k + ': ' + fmtFt(ref) + ' ft, yours ' + fmtFt(mine) + ' ft' + (ok ? ' ✓' : mine < ref * 0.95 ? ', short' : ', over: check for a doubled run')); });
    const bad = COUNTS().filter((x) => !countOk(x)).map((x) => x[0]);
    lines.push(bad.length ? 'Counts short: ' + bad.join(', ') + '.' : 'Every count matches: seven device types, twenty-six marks.');
    if (f.grease) lines.push('Grease duct: ' + f.grease.cleanouts.total + ' cleanout' + (f.grease.cleanouts.total === 1 ? '' : 's') + ', ' + Math.round(f.grease.wrapSqFt) + ' sq ft of listed wrap, on their own lines.');
    lines.push('Bid weight: ' + Math.round(f.lb).toLocaleString() + ' lb, the straight duct by gauge with its fittings and seam and waste. That number, not the feet, is what a sheet-metal shop prices.');
    return lines.join('\n');
  }

  // ===== the chapters ==================================================================================
  const CHAPTERS = [
    // 1 --------------------------------------------------------------------------------------------
    {
      id: 'sheet', title: 'Chapter 1: Read the M-sheets', short: 'the set, read', minutes: 8, page: M101, noun: 'chapter', set: MSET,
      intro: 'Supply, return and exhaust on one plan, the equipment on the roof, and a schedule that says how much air every room gets: what an M-set is, and a scale you proved.',
      seed() { /* the scale is the chapter's */ },
      steps: [
        { id: 'what', title: 'What is on an M-sheet?', kind: 'read', cardAt: 'br',
          body: 'Look at the legend and the keynotes. Three kinds of duct, four kinds of grille, and four pieces of equipment that are not on this floor at all.\nWhere is the equipment, and why does the plan show it as a dashed box off to the side?',
          reveal: 'On the roof. A restaurant this size is cooled and heated by a packaged rooftop unit, RTU-1, sitting on a curb over the kitchen; the hood exhaust fan, the make-up air unit and the restroom exhaust fan sit beside it. The plan can only show where each one\'s duct comes through the roof, so the engineer draws a roof key, a dashed box with the unit\'s name, its air and its power, and a leader to the penetration.\nAn HVAC estimator reads the equipment schedule and the room air schedule first: the unit\'s CFM is the whole job, and the rooms say where it goes.',
          target: [], check: () => true },
        { id: 'scale', title: 'Set the scale', kind: 'do',
          body: 'The title block says 1/8" = 1\'-0".\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/8" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => K().scaleIs(M101, 9),
          action: { label: 'Use 1/8" = 1\'-0"', run: async () => { K().goPage(M101); await T().applyScalePreset('1/8" = 1\'', 9); } } },
        { id: 'prove', title: 'Prove it', kind: 'do', cardAt: 'bl', page: M101, hold: true,
          body: () => (proveM101().check()
            ? proveM101().verdict() + ': the scale is right.\n1. Click [[Next]].'
            : 'The engineer wrote 31\'-8" over the kitchen half of the building. A dimension like that is the only thing that proves the scale: a PDF printed down keeps its scale bar and measures short.\n1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at the left end of the 31\'-8" string over the kitchen half.\n3. Click inside circle 2, at its right end.'),
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => proveM101().check(), hint: () => proveM101().hint(), zones: () => proveM101().zones(),
          action: { label: 'Measure the 31\'-8" string', run: async () => { K().goPage(M101); if (!K().scaleIs(M101, 9)) await T().applyScalePreset('1/8" = 1\'', 9); const d = pts(G.dim318); K().measure(d[0], d[1]); } } },
        { id: 'unit', title: 'Which unit moves the most air?', kind: 'do', cardAt: 'tl',
          body: 'Four roof keys, each with a CFM.\n1. Under COUNTERS, click [[+ Add]]. The project is HVAC, so the [[Quick]] tab offers Size, Type and Mounting.\n2. Set Type to RTU and click [[Add Counter]].\n3. Click the roof key of the unit that moves the most air.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#counterModal .counter-tab[data-tab="quickcount"]', '#addCounter'],
          check: () => markNear(counter(RE.rtu), pts(G.rtu)[0], 26, M101),
          hint: () => (counter(RE.rtu) && marksOf(counter(RE.rtu), M101).length ? (markNear(counter(RE.rtu), pts(G.ef1)[0], 26, M101) ? 'EF-1 pulls 2,400 CFM out of the hood, and that is a lot, but one key says 3,000' : 'Read the CFM in each dashed box') : (K().armedNamed(RE.rtu) ? 'The counter is armed: click the roof key' : '')),
          action: { label: 'Find it for me', run: () => { K().goPage(M101); App.pushUndoSnapshotCurrentPage(); markMissing(pickUnit(RE.rtu, 'RTU-1', 'RTU', '#2e86de'), pts(G.rtu), M101); K().dirty(); } } },
        { id: 'schedule', title: 'The room that breathes hardest', kind: 'do', cardAt: 'br',
          body: 'RTU-1: 3,000 CFM, 7.5 tons of cooling, 1.0 in of static pressure to push it through the duct. Every other number on the set hangs off it.\n1. Under PAGES, click M-501.\n2. In the ROOM AIR SCHEDULE, find the room that exhausts the most air, nearly as much as the whole unit supplies. Click [[⋯]], then [[Highlight]] (or press H), and drag a box over that row.',
          target: () => (K().onPage(M501) ? ['#highlightBtn', '#highlightBtnSidebar', '#headerMoreBtn'] : ['#pagesList']),
          check: () => { const a = pageAnn(M501); return !!a && (a.highlights || []).some((h) => Math.min(h.x1, h.x2) <= 300 && Math.max(h.x1, h.x2) >= 300 && Math.min(h.y1, h.y2) <= 619 && Math.max(h.y1, h.y2) >= 619); },
          hint: () => { if (!K().onPage(M501)) return T().pagesFoldedHint('M-501'); const a = pageAnn(M501); return a && (a.highlights || []).length ? 'Not that row. Read down the EXHAUST column for the biggest number' : ''; },
          action: { label: 'Highlight the kitchen for me', run: () => { K().goPage(M501); const a = App.ensureActiveCanvas(S().pages[M501]).annotations; if (!a.highlights) a.highlights = []; if (a.highlights.length) return; App.pushUndoSnapshotCurrentPage(); a.highlights.push(Object.assign({ color: '#e8c547', opacity: 0.25, id: App.uid() }, KITCHEN_ROW)); S().tool = App.TOOL.NONE; K().dirty(); } } },
        { id: 'balance', title: 'Why the kitchen', kind: 'read', cardAt: 'br',
          body: 'KITCHEN 105: 800 CFM of supply, 2,400 CFM of exhaust. The hood pulls out nearly as much air as RTU-1 makes.\nWhere does that air come from, and what happens if the engineer got it wrong?',
          reveal: 'From MAU-1, the make-up air unit: 2,000 CFM of tempered outside air delivered straight into the kitchen through MA-1, interlocked so it runs whenever the hood does. The keynote adds it up: 2,650 of supply and 2,000 of make-up against 2,400 and 225 of exhaust, so the building runs slightly positive and the front door does not fight a vacuum.\nGet it wrong and the doors slam, the hood spills smoke, and the gas appliances starve. Make-up air is required with a hood (IMC 508), and it is the line HVAC bids forget because it is a second unit for one room.',
          target: [], check: () => true },
      ],
      done: 'The plan, the roof keys, the schedules, and the balance of air in and air out.\nNext: [[Learn]] → Chapter 2, the rooms.',
    },
    // 2 --------------------------------------------------------------------------------------------
    {
      id: 'rooms', title: 'Chapter 2: The rooms and their air', short: 'rooms that know their air', minutes: 9, page: M101, noun: 'chapter', set: MSET,
      intro: 'Why a room has a CFM, where the engineer got it, and room boxes on the plan that carry the schedule\'s numbers so the app can say when a room is short of air.',
      seed() { scaleM101(); },
      steps: [
        { id: 'why', title: 'Where a room\'s CFM comes from', kind: 'read', cardAt: 'tl',
          body: 'The room air schedule gives DINING 100 1,200 CFM of supply, 1,104 sq ft: a little over one CFM per square foot. The bar gets 300 for 261.\nWhat sets those numbers, and why not a rule of thumb?',
          reveal: 'Two things, and the larger wins: the cooling load (people, lights, the sun through the glass, the kitchen next door) and the ventilation the code requires for the people in the room (IMC 403, from ASHRAE 62.1: a dining room at 7.5 CFM per person plus 0.18 per square foot). The engineer ran both; the schedule is the answer.\nThe app\'s own rule of thumb, one CFM per square foot for an office, is for design-build work with no engineer. On an engineered set, type the schedule\'s number in and let the app check the diffusers against it.',
          target: [], check: () => true },
        { id: 'dining', title: 'Box the dining room', kind: 'do', cardAt: 'bl', page: M101, zones: () => [roomBoxZone(ROOMS.dining)],
          body: '1. In the header, click [[Room Sizer]] (or press V).\n2. Drag a box around DINING 100, anywhere inside the shaded boundary. The name fills in from the plan.\n3. In Ceiling, type 9. In Deck height, type 12. Click [[Apply]].\n4. Under ROOMS in the left sidebar, click the pencil beside DINING, set Room type to Custom and Target CFM to 1200, the schedule\'s number, and save.',
          target: () => roomLadder([ROOMS.dining]),
          check: () => roomReady(ROOMS.dining),
          hint: () => { const r = roomNamed(/dining/i); if (!r) return T().boxMiss(rectsOf(M101, 'roomBoxes'), rect(ROOMS.dining.inner), rect(ROOMS.dining.outer)); return r.targetCfmOverride === 1200 ? '' : 'The box is there: now give the room its 1,200 CFM (the pencil beside it under ROOMS, Room type Custom)'; },
          action: { label: 'Box it for me', run: () => boxRoom(ROOMS.dining) } },
        { id: 'needs', title: 'What the room says now', kind: 'read',
          body: '1. In the left sidebar, look at ROOMS.\nDINING reads needs 1,200 · served 0, with a warning. The app knows what the room wants and has seen no diffuser yet. That badge is the whole chapter 3.',
          target: ['#roomsSection', '#roomsSectionTitle'], check: () => true },
        { id: 'kitchen', title: 'Box the kitchen and the hall', kind: 'do', cardAt: 'tl', page: M101, zones: () => [roomBoxZone(ROOMS.kitchen), roomBoxZone(ROOMS.hall)],
          body: 'The same for the rooms the main runs through, so the app knows the ceiling under every foot of it.\n1. Box KITCHEN 105: ceiling 9, deck 12, Custom, 800 CFM.\n2. Box HALL 107: ceiling 9, deck 12, Custom, 100 CFM.',
          target: () => roomLadder([ROOMS.kitchen, ROOMS.hall]),
          check: () => roomReady(ROOMS.kitchen) && roomReady(ROOMS.hall),
          hint: () => (roomReady(ROOMS.kitchen) ? (roomNamed(/hall/i) ? 'HALL needs its 100 CFM' : 'Now the hall') : (roomNamed(/kitchen/i) ? 'KITCHEN needs its 800 CFM' : '')),
          action: { label: 'Box both for me', run: async () => { await boxRoom(ROOMS.kitchen); await boxRoom(ROOMS.hall); } } },
        { id: 'deck', title: 'The deck', kind: 'read', cardAt: 'tl',
          body: 'Every box asked for a deck height as well as a ceiling. The keynote says ceilings at 9\'-0" and the roof deck at 12\'-0".\nWhy does an air takeoff care about the deck?',
          reveal: 'Because everything hangs in the three feet between. The duct, its insulation, the flex, the plumbing, the conduit and the return air the plenum carries all share that space, and a 24x12 main with two inches of wrap that does not fit under the deck is the most expensive discovery on a job. Chapter 6 measures it on the section and lets Bid Check judge it.\nOn the bid the plenum depth also sets the hanger lengths and whether the crew works from ladders or lifts.',
          target: [], check: () => true },
      ],
      done: 'Three rooms that know how much air they want and how high the deck is.\nNext: [[Learn]] → Chapter 3, the diffusers.',
    },
    // 3 --------------------------------------------------------------------------------------------
    {
      id: 'diffusers', title: 'Chapter 3: Diffusers, by the schedule', short: 'every grille counted', minutes: 10, page: M101, noun: 'chapter', set: MSET,
      intro: 'The diffuser schedule becomes the palette in one drag, each counter carries its CFM, and the rooms watch themselves fill up.',
      seed() { scaleM101(); seedRooms(); },
      steps: [
        { id: 'schedule', title: 'The palette from the schedule', kind: 'do',
          body: 'Every diffuser on M-101 carries a tag, and M-501 says what each one is.\n1. Under PAGES, click M-501.\n2. Under COUNTERS, click [[+ Add]], then the [[Create]] tab, then [[Read a schedule from the sheet…]].\n3. Drag a box over the DIFFUSER AND GRILLE SCHEDULE.\n4. Click [[Create counters]].\n5. Click each one\'s pencil and type its CFM from the schedule: SD-1 150, SD-2 100, SD-3 200, EG-1 75, MA-1 2000. RG-1 returns air and takes none.',
          // the ring follows the card (by hand, 2026-09-25): the sheet, then the Create tab's link, the
          // sheet itself while the box is drawn, then the pencil of the next counter still short of its CFM
          // the drag's boundary, once the Schedule tool is armed on M-501: it guides the box and keeps the
          // card off the table (at 1280 x 720 the card sat on the table's corner and swallowed the press)
          zones: () => (S().tool === App.TOOL.SCHEDULE && K().onPage(M501) && !AIR_TAGS.some((t) => byTag(t)) ? [{ kind: 'box', inner: { x1: 118, y1: 316, x2: 566, y2: 422 }, outer: { x1: 95, y1: 278, x2: 790, y2: 445 }, done: false, label: 'Drag your box over the schedule\'s rows, inside here' }] : []),
          target: () => {
            const tagged = AIR_TAGS.filter((t) => byTag(t));
            if (!tagged.length && !K().onPage(M501)) return ['#pagesList'];
            if (!tagged.length && S().tool === App.TOOL.SCHEDULE) return ['#schedulePaletteCreate', '#annCanvas'];
            const next = AIR_TAGS.find((t) => byTag(t) && byTag(t).cfm !== TAGS[t][2]);
            if (next) return T().ladder('#counterLineTypeDetailsCfm', T().pencilOf('counter', byTag(next)), '#countersSection');
            return ['#schedulePaletteCreate', '#counterReadSchedule', '#counterModal .counter-tab[data-tab="create"]', '#addCounter'];
          },
          check: () => AIR_TAGS.every((t) => { const c = byTag(t); return !!(c && c.cfm === TAGS[t][2]); }),
          hint: () => (byTag('SD-1') ? AIR_TAGS.filter((t) => !(byTag(t) && byTag(t).cfm === TAGS[t][2])).map((t) => t + ' wants ' + TAGS[t][2] + ' CFM').join(' · ') : ''),
          action: { label: 'Read the schedule for me', run: readDiffuserSchedule } },
        { id: 'dining', title: 'Fill the dining room', kind: 'do', cardAt: 'bl', page: M101, zones: () => circlesOn(M101, byTag('SD-1'), pts(G.SD1).slice(0, 8)),
          body: '1. Under PAGES, click M-101.\n2. In the sidebar, click SD-1 to arm it, and click the eight circled diffusers in the dining room.\nWatch ROOMS as you go: served climbs by 150 a click, and the warning goes at 1,200.',
          target: () => (K().onPage(M101) ? ['#annCanvas', '#countersList'] : ['#pagesList']), check: () => allDone(circlesOn(M101, byTag('SD-1'), pts(G.SD1).slice(0, 8))),
          // on M-501 still (the schedule step left the reader there): the way back, not eight rooms away
          hint: () => (!K().onPage(M101) ? T().pagesFoldedHint('M-101') : byTag('SD-1') ? missing(byTag('SD-1'), pts(G.SD1).slice(0, 8), ['north-west', 'north', 'north', 'north-east', 'south-west', 'south', 'south', 'south-east'].map((d) => 'the dining room, ' + d), 10, M101) : ''),
          action: { label: 'Count the eight for me', run: () => { K().goPage(M101); App.pushUndoSnapshotCurrentPage(); markMissing(pickTag('SD-1'), pts(G.SD1).slice(0, 8), M101); K().dirty(); } } },
        { id: 'rest', title: 'The rest of the supply', kind: 'do', cardAt: 'tl', page: M101, zones: () => circlesOn(M101, byTag('SD-1'), pts(G.SD1).slice(8)).concat(circlesOn(M101, byTag('SD-2'), pts(G.SD2), 10), circlesOn(M101, byTag('SD-3'), pts(G.SD3))),
          body: '1,200 served, and the row reads ✓. Now the rest.\n1. SD-1 is still armed from the dining room (clicking it in the sidebar would put it down): click the two in the bar and the one in the dish pit.\n2. Arm SD-2 and click the hall and storage diffusers.\n3. Arm SD-3 and click the four in the kitchen.',
          target: ['#annCanvas', '#countersList'], check: () => allDone(circlesOn(M101, byTag('SD-1'), pts(G.SD1).slice(8))) && allDone(circlesOn(M101, byTag('SD-2'), pts(G.SD2), 10)) && allDone(circlesOn(M101, byTag('SD-3'), pts(G.SD3))),
          hint: () => [row('SD-1', pts(G.SD1).slice(8), ['the bar (west)', 'the bar (east)', 'the dish pit']), row('SD-2', pts(G.SD2), ['the hall', 'storage']), row('SD-3', pts(G.SD3), ['the kitchen (west)', 'the kitchen', 'the kitchen', 'the kitchen (east)'])].map(([t, sp, lb]) => { const c = byTag(t); const m = c ? missing(c, sp, lb, 10, M101) : ''; return m ? t + ' ' + m : ''; }).filter(Boolean).join(' · '),
          action: { label: 'Count them for me', run: () => { K().goPage(M101); App.pushUndoSnapshotCurrentPage(); seedDiffusers(); K().dirty(); } } },
        { id: 'neck', title: 'Why the kitchen diffusers are bigger', kind: 'read', cardAt: 'tl',
          body: 'SD-1 and SD-3 are both 24x24 lay-in diffusers, but SD-3 carries 200 CFM on a 10" neck where SD-1 carries 150 on an 8".\nWhat sets the neck?',
          reveal: 'Velocity. Air through an 8" neck at 150 CFM moves about 430 feet a minute; push 200 through it and it whistles. The engineer steps the neck up to 10" to keep the noise down (the trade\'s rule of thumb runs 400 to 600 fpm at a neck). The app carries the same rule: a counter with a CFM suggests its neck size, and the flex that feeds it follows the neck.\nOn the bid the neck size is the flex size and the tap size, so the diffuser schedule prices the branch.',
          target: [], check: () => true },
        { id: 'grilles', title: 'Return and exhaust', kind: 'do', cardAt: 'tl', page: M101, zones: () => circlesOn(M101, byTag('RG-1'), pts(G.RG1)).concat(circlesOn(M101, byTag('EG-1'), pts(G.EG1), 10)),
          body: 'The plenum return: no duct, just a grille in the ceiling and the space above it.\n1. Arm RG-1 and click the three return grilles.\n2. Arm EG-1 and click the three exhaust grilles in the restrooms and the mop room.',
          target: ['#annCanvas', '#countersList'], check: () => allDone(circlesOn(M101, byTag('RG-1'), pts(G.RG1))) && allDone(circlesOn(M101, byTag('EG-1'), pts(G.EG1), 10)),
          hint: () => [row('RG-1', pts(G.RG1), ['the dining room (west)', 'the dining room (east)', 'the kitchen']), row('EG-1', pts(G.EG1), ['MEN', 'WOMEN', 'the mop room'])].map(([t, sp, lb]) => { const c = byTag(t); const m = c ? missing(c, sp, lb, 10, M101) : ''; return m ? t + ' ' + m : ''; }).filter(Boolean).join(' · '),
          action: { label: 'Count them for me', run: () => { K().goPage(M101); App.pushUndoSnapshotCurrentPage(); markMissing(pickTag('RG-1'), pts(G.RG1), M101); markMissing(pickTag('EG-1'), pts(G.EG1), M101); K().dirty(); } } },
      ],
      done: 'A palette from the schedule, every diffuser with its air, and rooms that read ✓.\nNext: [[Learn]] → Chapter 4, the system.',
    },
    // 4 --------------------------------------------------------------------------------------------
    {
      id: 'system', title: 'Chapter 4: The system', short: 'a unit that knows its load', minutes: 7, page: M101, noun: 'chapter', set: MSET,
      intro: 'A group with an equipment tag is a system. Give it the unit\'s capacity and static pressure from the schedule, and the app reads the designed air against them.',
      seed() { scaleM101(); seedRooms(); seedDiffusers(); },
      steps: [
        { id: 'group', title: 'Make RTU-1 a system', kind: 'do',
          body: 'The equipment schedule: RTU-1, 3,000 CFM, 1.0" ESP.\n1. In the header, click the gear ([[Project Settings]]) and turn on [[Use groups]] if it is off.\n2. Under GROUPS, click [[+ Add]]. In Name, type RTU-1. In Equipment tag, type RTU-1. In Capacity, type 3000. In ESP, type 1.0. Click [[Done]].\n3. Make an RTU counter (Quick: Type RTU) and click RTU-1\'s roof key, so the system knows where its unit is.',
          // inside Add Group, the field the card names next, then Done (the ring sat on Done over four empty boxes; by hand, 2026-09-25)
          target: () => { const empty = ['#groupModalName', '#groupModalEquipTag', '#groupModalCapacityCfm', '#groupModalEspInWg'].find((sel) => { const f = document.querySelector(sel); return f && !String(f.value || '').trim(); }); return T().ladder(empty, '#groupModalDone', '#addGroup', '#groupsSectionTitle', '#settingsUseGroupsBtn'); },
          check: () => { const g = system(); return !!(g && g.capacityCfm === 3000 && g.espInWg === 1 && markNear(counter(RE.rtu), pts(G.rtu)[0], 26, M101)); },
          hint: () => { const g = system(); if (!g) return ''; if (g.capacityCfm !== 3000) return 'Capacity: 3000, from the schedule'; if (g.espInWg !== 1) return 'ESP: 1.0, the static pressure the schedule gives the unit'; return 'The system exists: now count RTU-1 on its roof key'; },
          action: { label: 'Make RTU-1 for me', run: makeSystem } },
        { id: 'designed', title: 'How much of RTU-1 is spoken for?', kind: 'read',
          body: '1. In the left sidebar, click RTU-1 under GROUPS to select it, and look at the DUCT section\'s header.\nIt reads the system\'s designed air against its capacity. It reads 0 of 3,000 for now: a diffuser counts toward a system once a run of that system reaches it, and the main is chapter 5. The schedule already says where it ends: 2,650.\nWhy would an engineer buy a 3,000 CFM unit for 2,650 CFM of diffusers?',
          reveal: 'Note 2 on M-501 says it: the rest is future. Rooftop units come in sizes, a kitchen grows, and a unit run at its limit on the hottest day is a callback. The margin is the engineer\'s, and the estimator prices the unit the schedule names, not the one the arithmetic would allow.\nBid Check\'s Systems within capacity row does the same sum and warns when the diffusers outrun the unit, which happens on the third addendum.',
          target: ['#ductSectionTitle', '#groupsList', '#groupsSectionTitle'], check: () => true },
      ],
      done: 'A system with its unit, its capacity and its pressure, and the designed air read against them.\nNext: [[Learn]] → Chapter 5, the main.',
    },
    // 5 --------------------------------------------------------------------------------------------
    {
      id: 'main', title: 'Chapter 5: The main, sized down the hall', short: 'the main, traced', minutes: 12, page: M101, noun: 'chapter', set: MSET,
      intro: 'Trace the supply main from the roof to the far end of the dining room with the Duct tool reading the engineer\'s printed sizes, and learn why the duct shrinks as it goes.',
      seed() { scaleM101(); seedRooms(); seedDiffusers(); makeSystem(); },
      steps: [
        { id: 'arm', title: 'Arm the Duct tool', kind: 'do',
          body: 'Every size on this plan is printed beside its run, and the app reads them.\n1. Point at the 24x12 printed at the RTU-1 drop, at the kitchen\'s east wall, and press U (or click [[Duct]] in the header).\nPressed over a printed size, the dialog fills it from the plan and says so under the size; from the header it starts at 24x12 anyway.\n2. Set Insulation to Wrap.\n3. Click [[Start Tracing]].',
          target: ['#ductCreateStart', '#ductCreateLiner', '#ductBtn', '#headerMoreBtn'],
          check: () => { const d = S().drawingDuct; return !!(d && d.segments && d.segments[0] && sizeKey(d.segments[0].size) === '24x12') || mainDone(); },
          action: { label: 'Arm it at 24x12 for me', run: async () => { K().goPage(M101); if (mainDone() || S().drawingDuct) return; if (el('ductBtn')) el('ductBtn').click(); await wait(100); if (App.setDuctCreateSize) App.setDuctCreateSize(RS(24, 12)); if (el('ductCreateLiner')) el('ductCreateLiner').value = 'wrap'; if (el('ductCreateStart')) el('ductCreateStart').click(); await wait(50); if (S().drawingDuct) { S().drawingDuct.linerType = 'wrap'; S().drawingDuct.linerThicknessIn = 2; } } } },
        { id: 'trace', title: 'Trace the main, stepping down where the plan does', kind: 'do', cardAt: 'bl', page: M101, zones: () => traceZones(pts(G.main), M101),
          body: '1. Click the RTU-1 drop at the kitchen\'s east wall, then the corner in the hall.\n2. Follow the hall west. At the dining room wall the plan prints 20x12: the chip under the cursor reads Plan says 20x12 here, S accepts. Click the corner, press S, and tap the size.\n3. Do the same at 16x10 and at 12x10, then click the far end and press Enter.\nEach step is a transition the app counts as a fitting.',
          target: ['#ductSizePopover', '#annCanvas'], check: mainDone,
          hint: () => { const d = S().drawingDuct; if (!d || !d.segments) return ''; const have = d.segments.map((s) => sizeKey(s.size)).join(' '); return have && !MAIN_SIZES.join(' ').startsWith(have) ? 'The plan says ' + MAIN_SIZES.join(', ') + ' along this run: press S at each printed size' : ''; },
          action: { label: 'Trace it for me', run: () => { if (mainDone()) return; if (S().drawingDuct && App.clearDuctDraft) App.clearDuctDraft(); K().goPage(M101); traceMain(); K().dirty(); } } },
        { id: 'why', title: 'Why the main shrinks', kind: 'read', cardAt: 'bl',
          body: '24x12 out of the unit, 12x10 at the far end.\nThe engineer could have run 24x12 the whole way. Why step it down four times?',
          reveal: 'Air leaves the main at every tap, so the far end carries a fraction of the flow, and a duct sized for 3,000 CFM carrying 600 is sheet metal nobody needed. The engineer sizes each stretch for the air still in it, at a friction rate that keeps the fan\'s pressure within the unit (0.08" per 100 ft here) and a velocity that keeps it quiet. The app\'s ductulator does the same sum live while you trace: the chip\'s suggestion agreed with every printed size.\nOn the bid each step is a transition fitting, and the pounds fall with the size: the Duct Schedule weighs 24x12 at 24 gauge and 12x10 at 26.',
          target: [], check: () => true },
        { id: 'kitchen', title: 'The kitchen branch', kind: 'do', cardAt: 'br', page: M101, zones: () => traceZones(pts(G.kitchen), M101),
          body: 'A 16x10 branch taps the main at the kitchen wall and runs down the west wall and across to the four kitchen diffusers.\n1. Click [[Duct]] again. The size fills from the plan. [[Start Tracing]].\n2. Click the tap at the main, the corner at the kitchen\'s south wall, and the far end. Press Enter.\nThe tap counts itself, with a volume damper.',
          target: () => ductFormLadder({ shape: 'rect', w: 16, h: 10 }).concat(['#ductBtn', '#annCanvas']), check: () => !!runWith(['16x10']),   // the dialog fills the size nearest the last click (12x10 after the main): the ring asks for 16x10
          action: { label: 'Trace it for me', run: () => { if (runWith(['16x10'])) return; if (S().drawingDuct && App.clearDuctDraft) App.clearDuctDraft(); K().goPage(M101); layRun(G.kitchen, RS(16, 10), null, { name: 'Kitchen branch' }); K().dirty(); } } },
        { id: 'attach', title: 'Hang the diffusers on the runs', kind: 'do', cardAt: 'bl',
          body: 'The dining diffusers sit five or six feet off the main, on flex. To the app they are strays until they hang on a run, and a stray counts toward no system.\n1. Right-click a dining diffuser.\n2. Click [[Attach to nearest run]].\n3. Do the same for the rest: the dining, the hall, the kitchen, and the two easy to miss, the dish pit\'s and the storage room\'s.\nEach moves onto its run and draws its leader; the flex drop, five feet by default, joins the schedule.',
          target: ['#ctxAttachToRun', '#annCanvas'], check: () => mainDone() && strays() <= 2,
          hint: () => { const n = strays(); return n > 2 ? (n - 2) + ' diffuser' + (n === 3 ? '' : 's') + ' still hanging off nothing. Look in the dish pit and the storage room too' : ''; },
          action: { label: 'Hang them for me', run: () => { K().goPage(M101); attachAll(); } } },
        { id: 'fittings', title: 'What the run counted for itself', kind: 'read',
          body: 'Two strays left, the pair along the bar: their branch comes with the whole set in chapter 8. The DUCT header now reads the designed air the main and the kitchen branch reach, 2,350 of RTU-1\'s 3,000.\n1. In the left sidebar, under DUCT, click [[Schedule]].\nElbows, transitions, a tap and its volume damper, none of them clicked; the flex drops by system; straight duct by size with its gauge and lb/ft from the SMACNA table; seam and waste on its own line; and the number a sheet-metal bid is built on: Bid weight.',
          target: ['#ductScheduleBtn', '#ductSectionTitle'], check: () => true },
      ],
      done: 'The main traced at the engineer\'s sizes, the branch, the fittings the walk found, and pounds.\nNext: [[Learn]] → Chapter 6, the plenum.',
    },
    // 6 --------------------------------------------------------------------------------------------
    {
      id: 'plenum', title: 'Chapter 6: The plenum, and the pressure', short: 'the two physics rows', minutes: 9, page: M601, noun: 'chapter', set: MSET,
      intro: 'A section drawn to scale: measure the plenum and the wrapped main, then let Bid Check judge whether it fits and whether the unit can push air to the far diffuser.',
      seed() { scaleM101(); seedRooms(); seedDiffusers(); makeSystem(); seedMain(); },
      steps: [
        { id: 'scale', title: 'A section at 1/2"', kind: 'do',
          body: 'M-601 cuts through the dining ceiling at 1/2" = 1\'-0".\n1. Click [[Set Scale]] (or press S), the [[Architectural & Engineering]] tab, and [[1/2" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => K().scaleIs(M601, 36),
          action: { label: 'Use 1/2" = 1\'-0"', run: async () => { K().goPage(M601); await T().applyScalePreset('1/2" = 1\'', 36); } } },
        { id: 'prove', title: 'Prove it', kind: 'do', cardAt: 'br', page: M601, hold: true,
          body: () => (proveM601().check()
            ? proveM601().verdict() + ': this sheet\'s scale is right too.\n1. Click [[Next]].'
            : '1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at one end of the 12\'-0" string, floor to deck.\n3. Click inside circle 2, at the other end.'),
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => proveM601().check(), hint: () => proveM601().hint(), zones: () => proveM601().zones(),
          action: { label: 'Measure it for me', run: async () => { K().goPage(M601); if (!K().scaleIs(M601, 36)) await T().applyScalePreset('1/2" = 1\'', 36); const d = raw(SECTION.prove); K().measure(d[0], d[1]); } } },
        { id: 'depth', title: 'How deep is the main with its wrap?', kind: 'do', cardAt: 'br', page: M601, zones: () => depthM601().zones(),
          body: 'The plenum is the 3\'-0" between the ceiling and the deck. Inside it, the 24x12 main with its 2" wrap.\n1. Click [[Measure]] again and click both ends of the dimension on the duct\'s right side.',
          target: ['#measureBtn', '#measureBtnSidebar'], check: () => depthM601().check(),
          onEnter: () => { depthEntryMeasure = S().lastMeasure; },
          hint: () => (S().lastMeasure && S().lastMeasure === depthEntryMeasure ? '' : depthM601().hint()),
          action: { label: 'Measure it for me', run: () => { K().goPage(M601); const d = raw(SECTION.depth); K().measure(d[0], d[1]); } } },
        { id: 'fits', title: 'Let the app say it fits', kind: 'do',
          onEnter: () => T().foldBidCheck(), hold: true, body: '1\'-4": twelve inches of duct and two of wrap each side, under a 3\'-0" plenum. The section says it fits; the app can say it too, because chapter 2 gave every room a ceiling and a deck and chapter 5 gave the main its wrap.\n1. Under PAGES, click M-101.\n2. In the left sidebar, click BID CHECK to expand it, and find Fits the roof.',
          target: () => (K().onPage(M101) ? ['#bidCheckSectionTitle'] : ['#pagesList']),   // the card's first line is M-101 (by hand, 2026-09-25)
          check: () => { const r = ductRow('duct-fits-roof'); return S().bidCheckCollapsed === false && !!(r && (r.kind === 'auto' || r.verdict === 'ok')); },
          hint: () => { if (!K().onPage(M101)) return T().pagesFoldedHint('M-101'); const r = ductRow('duct-fits-roof'); return r && r.kind !== 'auto' ? 'The row is still a question: it needs the deck, a ceiling under the main, and the main itself' : ''; },
          action: { label: 'Open it for me', run: () => { K().goPage(M101); seedMain(); if (App.setDuctDeckHeight) App.setDuctDeckHeight(12); openBidCheck(); } } },
        { id: 'static', title: 'Will it blow?', kind: 'read',
          body: 'Beside it, Static path within unit ESP turned from a question into a number the moment RTU-1 had its 1.0" of static and a run to walk: the app found the longest path from the unit to a diffuser, in equivalent feet, straight duct and every elbow and transition on the way, and priced it in inches of water against the unit.\nWhat is the estimator supposed to do with that row?',
          reveal: 'Read it before the bid, not after the balancing report. A run that needs more pressure than the unit has is a duct that gets upsized on site, or a fan that never delivers, and both are the mechanical contractor\'s to fix. The row names the long leg and the size that would pass.\nHere it passes: the far dining diffuser is under an inch of water away, with the terminal allowance the rulebook gives it.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => true },
      ],
      done: 'A plenum measured, a duct that fits, and a fan that can reach the far diffuser, judged by the app.\nNext: [[Learn]] → Chapter 7, the exhaust.',
    },
    // 7 --------------------------------------------------------------------------------------------
    {
      id: 'exhaust', title: 'Chapter 7: Exhaust, grease and the rated wall', short: 'the air that leaves', minutes: 11, page: M101, noun: 'chapter', set: MSET,
      intro: 'The hood\'s grease duct traced as what it is, welded black steel the gauge table must not touch, the two fire dampers where duct crosses the rated wall, the restroom exhaust as an exhaust run, and the make-up air that keeps the doors from slamming.',
      seed() { scaleM101(); seedRooms(); seedDiffusers(); makeSystem(); seedMain(); markMissing(pickTag('EG-1'), pts(G.EG1), M101); },
      steps: [
        { id: 'grease', title: 'Which duct must not be galvanized?', kind: 'do', cardAt: 'tl', page: M101, zones: () => traceZones(pts(G.grease), M101),
          body: 'Every supply and return duct on this plan is galvanized sheet at the gauge the SMACNA table gives its size. One duct on the plan cannot be, and the legend draws it darker.\n1. Click [[Duct]] (or press U). Round, 18, the airside chip Exhaust, and Material: Welded black steel. [[Start Tracing]].\n2. Click the hood collar, the elbow, and the curb where it rises to EF-1. Press Enter.',
          target: () => ductFormLadder({ shape: 'round', d: 18, airside: 'exhaust', material: 'black-steel' }).concat(['#ductBtn', '#annCanvas']), check: () => !!greaseRun(),
          hint: () => { const r = runWith(['18"ø']); if (r) return r.material === 'black-steel' ? '' : 'The run is there, but galvanized: right-click it and set its Material to Black steel'; const bs = ductRuns(M101).find((x) => x.material === 'black-steel'); return bs ? 'Black steel, but the hood duct is 18 inch round: check the size' : ''; },
          action: { label: 'Trace it for me', run: () => { if (greaseRun()) return; if (S().drawingDuct && App.clearDuctDraft) App.clearDuctDraft(); K().goPage(M101); layRun(G.grease, RD(18), null, { airside: 'exhaust', material: 'black-steel', name: 'Hood exhaust' }); K().dirty(); } } },
        { id: 'why', title: 'Grease duct', kind: 'read', cardAt: 'bl',
          body: 'The hood exhaust: 18"ø, welded, 16 gauge black steel, sloped back to the hood, a cleanout at the elbow, 18 inches clear of anything that burns.\nWhy does the gauge table not apply, and what did the Schedule just do with it?',
          reveal: 'A grease duct is a chimney for a fire. IMC 506.3.1.1 and NFPA 96 want it liquid-tight, continuously welded, carbon steel of at least 16 gauge or stainless of at least 18, with cleanouts at every change of direction, and kept 18 inches from combustibles or wrapped in a listed enclosure. The SMACNA schedule the Duct tool carries is for galvanized duct at low pressure; it would call an 18" round at 1" 24 gauge and weigh it at half what the welded duct weighs.\nSo the run carries a material. Under DUCT the run reads welded black steel; in the Schedule it sits on its own row, 18"Ø at 16 gauge, 11.8 lb a foot, its elbow priced the same way, and the per-size gauge chip cannot touch it. Under it, a Grease duct block prices what is not metal by the pound, on its own lines outside the bid weight: the cleanouts, one at each change of direction and one per 12 feet of horizontal run (NFPA 96 7.4), so one here at the elbow, and the listed wrap by the square foot of duct surface, 47 for this run. The welding labor is still yours.',
          target: [], check: () => true },
        { id: 'dampers', title: 'Where does a duct cross the rated wall?', kind: 'do', cardAt: 'tl', page: M101, zones: () => circlesOn(M101, fdCounter(), pts(G.fd), 16),
          body: 'The keynote says the kitchen\'s hall wall is one-hour rated, and the plan dots it. IMC 607.5.1 wants a listed fire damper wherever a duct goes through it, and the plan tags each one FD.\n1. Under COUNTERS, click [[+ Add]]. On the [[Quick]] tab set Type to Fire Damper and click [[Add Counter]].\n2. Click each place a duct crosses the rated wall.',
          target: ['#annCanvas', '#counterQuickCountAdd', '#counterModal .counter-tab[data-tab="quickcount"]', '#addCounter'],
          check: () => { const c = fdCounter(); return !!c && pts(G.fd).every((p) => markNear(c, p, 14, M101)) && !fdStray(); },
          hint: () => { const c = fdCounter(); if (!c) return ''; const stray = fdStray(); if (!stray) return marksOf(c, M101).length ? 'One more: the main crosses the same wall above the kitchen door' : ''; return pts(G.notRated).some((p) => K().near(stray, p, 16)) ? 'That wall is not rated. The keynote names the one that is, and the plan dots it' : 'No duct crosses the rated wall there'; },
          action: { label: 'Count them for me', run: () => { K().goPage(M101); App.pushUndoSnapshotCurrentPage(); const c = pickUnit(RE.fd, 'Fire Damper', 'Fire Damper', '#e85447'); const a = pageAnn(M101); if (a && a.counterMarkers[c.id]) { const spots = pts(G.fd); a.counterMarkers[c.id] = a.counterMarkers[c.id].filter((m) => spots.some((p) => K().near(m, p, 14))); } markMissing(c, pts(G.fd), M101); K().dirty(); } } },
        { id: 'nodamper', title: 'Two dampers, not three', kind: 'read', cardAt: 'bl',
          body: 'The kitchen branch and the main cross the rated wall, and each gets a damper. The grease duct crosses no wall here, but suppose it did.\nWhy would it still get no damper?',
          reveal: 'Nothing goes inside a grease duct that could catch grease or close while the fire burns, so NFPA 96 forbids dampers in it of any kind. Where a grease duct passes a rated wall it gets a listed enclosure or wrap for the rating instead, and that is the wrap the keynote already calls for.\nA fire damper in the supply is a UL 555 frame with a curtain and a fusible link, an access door beside it so the link can be replaced, and a sleeve through the wall. Two of them on this plan, at the two penetrations, and the main\'s sits above the kitchen door because the header is part of the rated wall. Bid Check\'s Fire dampers row is now a count you can defend; chapter 9 ticks it.',
          target: [], check: () => true },
        { id: 'restroom', title: 'Trace the restroom exhaust', kind: 'do', cardAt: 'tl', page: M101, zones: () => traceZones(pts(G.exhaust), M101),
          body: 'The three EG-1 grilles run to EF-2 on 8" round.\n1. Click [[Duct]] (or press U). Set the shape to round, the size to 8, the airside chip to Exhaust, and [[Start Tracing]].\n2. Click the grille in MEN, the corner past the mop room, and the fan\'s drop. Press Enter.',
          target: () => ductFormLadder({ shape: 'round', d: 8, airside: 'exhaust' }).concat(['#ductBtn', '#annCanvas']), check: () => { const r = runWith(['8"ø']); return !!(r && r.airside === 'exhaust'); },
          hint: () => { const r = runWith(['8"ø']); return r && r.airside !== 'exhaust' ? 'The run is there but marked supply: right-click it and set its airside to Exhaust' : ''; },
          action: { label: 'Trace it for me', run: () => { if (runWith(['8"ø'])) return; if (S().drawingDuct && App.clearDuctDraft) App.clearDuctDraft(); K().goPage(M101); layRun(G.exhaust, RD(8), null, { airside: 'exhaust', name: 'Restroom exhaust' }); K().dirty(); } } },
        { id: 'makeup', title: 'The make-up air', kind: 'do', cardAt: 'tl', page: M101, zones: () => traceZones(pts(G.makeup), M101).concat(runWith(['20x16']) ? circlesOn(M101, byTag('MA-1'), pts(G.MA1), 12) : []),   // line 2 is on the sheet too: its circle (by hand, 2026-09-25)
          body: 'Spiral round in ten-foot sticks: the schedule counts the joints. Now the air that replaces what the hood takes.\n1. [[Duct]] again: 20x16, supply, [[Start Tracing]]. Click the MAU-1 drop at the east wall and the register MA-1. Press Enter.\n2. Arm MA-1 and click the register.',
          target: () => ductFormLadder({ shape: 'rect', w: 20, h: 16, airside: 'supply' }).concat(['#ductBtn', '#annCanvas', '#countersList']), check: () => !!runWith(['20x16']) && markNear(byTag('MA-1'), pts(G.MA1)[0], 12, M101),
          action: { label: 'Trace and count it for me', run: () => { K().goPage(M101); if (!runWith(['20x16'])) { if (S().drawingDuct && App.clearDuctDraft) App.clearDuctDraft(); layRun(G.makeup, RS(20, 16), null, { name: 'Make-up air' }); } App.pushUndoSnapshotCurrentPage(); markMissing(pickTag('MA-1'), pts(G.MA1), M101); K().dirty(); } } },
        { id: 'interlock', title: 'Why make-up air', kind: 'read',
          body: 'MAU-1: 2,000 CFM of tempered outside air, interlocked with EF-1.\nWhat goes wrong without it, and who owns the interlock?',
          reveal: 'The hood pulls 2,400 CFM out of a kitchen that RTU-1 feeds 800. Without make-up the room goes negative, the front door pulls hard, smoke rolls out of the hood, and the gas appliances starve for combustion air. The code requires make-up air with a commercial hood (IMC 508), tempered so the cooks are not standing in a January draft.\nThe interlock is controls: the make-up unit starts when the exhaust fan does. Bid Check\'s Controls row is where you say whose wiring that is, and the RFI is the same one the plumber and the electrician wrote about the hood.',
          target: [], check: () => true },
      ],
      done: 'A grease run priced as the metal it is, two fire dampers where the plan wants them, a round exhaust run with its joints, and the make-up air that balances the kitchen.\nNext: [[Learn]] → Chapter 8, the whole set.',
    },
    // 8 --------------------------------------------------------------------------------------------
    {
      id: 'whole', title: 'Chapter 8: The whole set', short: 'the set, finished', minutes: 10, page: M101, noun: 'chapter', set: MSET,
      intro: 'Every room, diffuser and run, the system with its unit: done in one pass, then set beside the reference by size, and the Duct Schedule copied for the bid.',
      seed() { scaleM101(); },
      steps: [
        { id: 'lay', title: 'Finish the takeoff', kind: 'do', cardAt: 'bl',
          body: 'The rooms with their air, every diffuser and grille, RTU-1 as a system, the main and its branches, the restroom exhaust, the make-up duct, the grease duct in black steel, the two fire dampers. Earlier chapters taught each of them; this is all of them on the sheets, by hand.\n1. Count and trace until the status line stops naming what is missing.\nTo have the app lay it all instead, click [[Show me where]] and then its button; Skip this step moves on with the sheets as they are, and the next card compares them against the reference.',
          target: ['#annCanvas'], check: takeoffComplete, hint: takeoffHint,
          action: { label: 'Finish the takeoff for me', run: layEverything } },
        { id: 'compare', title: 'Against the reference', kind: 'read', cardAt: 'tl',
          body: compareBody,
          target: [], check: () => true },
        { id: 'copy', title: 'The schedule, copied', kind: 'do', hold: true,
          body: '1. Under DUCT, click [[Schedule]].\n2. Click [[Copy Schedule]].\nStraight duct by size and gauge, the fittings, the flex drops by system, the wrap in square feet, seam and waste, and the bid weight, as text for the bid.',
          target: ['#ductScheduleCopy', '#ductScheduleBtn', '#ductSectionTitle'], check: () => K().modalUp('ductScheduleModal'),
          // skipped past Finish the takeoff with nothing traced: there is no DUCT section to click (by hand, 2026-09-25)
          hint: () => (ductRuns(M101).length ? '' : 'No duct is traced yet, so there is no DUCT section. Click Back and finish the takeoff, or Skip this step'),
          action: { label: 'Open the schedule', run: () => { if (App.openDuctScheduleModal) App.openDuctScheduleModal(); else if (el('ductScheduleBtn')) el('ductScheduleBtn').click(); } } },
      ],
      done: 'The whole set, counted and traced, checked against the reference, and a schedule in pounds.\nNext: [[Learn]] → Chapter 9, the bid.',
    },
    // 9 --------------------------------------------------------------------------------------------
    {
      id: 'bid', title: 'Chapter 9: Check it, sign it, hand it off', short: 'a bid you can defend', minutes: 8, page: M101, noun: 'chapter', set: MSET,
      intro: 'What each duct row of Bid Check means in the trade, which the set already answers, and the hand-off with the pounds in it.',
      seed() { scaleM101(); seedRooms(); seedDiffusers(); makeSystem(); seedMain(); },
      steps: [
        { id: 'open', title: 'Open Bid Check', kind: 'do',
          onEnter: () => T().foldBidCheck(), hold: true, body: '1. In the left sidebar, click BID CHECK to expand it.\nThe duct rows: Every room served, Systems within capacity, Flex drops within max and Scale set are judged from your takeoff; Fits the roof and Static path judge themselves once they know enough; the rest are yours.',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false, action: { label: 'Open it', run: openBidCheck } },
        { id: 'rows', title: 'What the manual rows mean', kind: 'read',
          body: 'Fire dampers at rated walls, OA meets code, Curb & power coordinated, Controls and stat locations set.\nWhich of them did this set already answer?',
          reveal: 'OA: the room air schedule\'s note says the supply CFM includes the ventilation (IMC 403), so read, and tick. Curb and power: the equipment schedule gives every unit\'s weight and electrical, but who sets the curb and who runs the power is the coordination with the GC and the electrician, and nothing on an M-sheet answers it. Fire dampers: the two you counted at the kitchen\'s rated wall in chapter 7, and none in the grease duct, so the row is a count you can defend. Controls: the thermostats are drawn, the interlock is named, the wiring is nobody\'s yet.\nTick what you have read. Write an RFI for the rest.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => true },
        { id: 'tick', title: 'Sign what you have read', kind: 'do',
          body: '1. In BID CHECK, click the words Scale verified on every counted sheet.\n2. Click OA meets code.\n3. Click Fire dampers at rated walls.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => manual('scale-verified') && manual('duct-oa-code') && manual('duct-fire-dampers'),
          action: { label: 'Tick them for me', run: () => { tick('scale-verified'); tick('duct-oa-code'); tick('duct-fire-dampers'); } } },
        { id: 'proof', title: 'Where did that number come from?', kind: 'do', hold: true,
          body: '1. In the left sidebar, under SUMMARY, click the SD-1 total.\nThe breakdown shows the count sheet by sheet with a thumbnail of where every mark sits. This is what you open when the GC questions the number.',
          target: () => T().ladder('#summaryCountDetailModal .modal-card', T().summaryRowOf('counter', byTag('SD-1')), '#summarySectionTitle'), check: () => K().modalUp('summaryCountDetailModal'),
          action: { label: 'Open the breakdown', run: () => { const c = byTag('SD-1'); if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); } } },
        { id: 'handoff', title: 'Hand it off', kind: 'read',
          body: '1. Under EXPORT OPTIONS, [[Copy to /Tooling]] puts the whole takeoff on the clipboard, and its Duct block at the end carries the pounds. With an open Bid Check row the gate asks first; [[Export anyway]] remembers your answer until something changes.\n2. [[Copy RFI Flags]] puts the hood question beside it.\n3. [[Export PDFs]] makes the marked-up set.\nMore: [Doing an HVAC takeoff](/guides/hvac-takeoff/) and [Duct takeoff by the pound](/guides/duct-takeoff-by-the-pound/).',
          target: ['#forPipeTooling', '#exportOptionsSectionTitle'], check: () => true },
      ],
      done: 'That is the course: a restaurant\'s air read off the engineer\'s set, counted and weighed with the app, checked, and handed to the bid.\nWhen you are ready for a real set, click [[Upload PDF]].',
    },
  ];

  // ----- progress, the menu section, the doors -----------------------------------------------------------
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
  el('canvasEmptyHintCourseHvac') && (el('canvasEmptyHintCourseHvac').onclick = (e) => { e.preventDefault(); openAtCourse(); });
  el('settingsCourseHvac') && (el('settingsCourseHvac').onclick = () => { App.hideModal('settingsModal'); openAtCourse(); });
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
  App.startChapterHvac = startChapter;
  App.courseHvacIds = () => CHAPTERS.map((c) => c.id);
  App.courseHvacReference = () => ({ feet: REF_DUCT.reduce((o, [k, ft]) => { o[k] = ft(); return o; }, {}), counts: COUNTS().map(([t, sp]) => [t, sp.length]) });
})();
