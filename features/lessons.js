/*
 * features/lessons.js - Learn: thirteen short lessons, one per part of the app, on the
 * engine the five-minute tours use (features/tutorial.js). A tour is the front door, one
 * trade's whole loop in fourteen steps; a lesson is two or three minutes on ONE family of
 * tools, and together they cover every tool in the shell. Plan of record:
 * journeys/plans/LEARN-PLAN.md.
 *
 * Every lesson runs on samples/sample-lessons.pdf, four sheets drawn for the purpose
 * (scripts/build-sample-lessons.js): P-101 the restaurant plumbing plan at 1/8", P-401 the
 * restrooms enlarged at 1/4" with a hand sink station detail at 1/2" that is TYP. OF 4,
 * P-501 the fixture schedule scanned sideways, and P-601 the restrooms' waste and vent
 * riser at 1/4" (the plumbing course's; no lesson runs on it). Coordinates below are PDF points:
 * P-101's drawing sits at (60 + 0.75·x, 70 + 0.75·y) of its SVG figures
 * (scripts/sample-plan-candidates.js PLAN_AT); P-401 is drawn straight in points
 * (LESSON_DETAIL there is the same table as DETAIL here).
 *
 * A lesson STANDS ALONE: its first step opens the sheets fresh and `seed()` lays down
 * what the lesson takes for granted (a scale, a counter, a chained branch), so lesson 10
 * never depends on lesson 3 having been taken. Opening never costs the reader their
 * work: over their own plan the first step goes through App.closeProject, which asks;
 * over the last lesson's sheets it just resets. Palette items a lesson makes carry
 * `lesson: true` and are swept before the next lesson, so the reader's own palette (an
 * Artboard's counters ride every new project) is left as it was.
 *
 * The rules are the tours' (H1-HVAC-TOUR.md): a step is
 * { id, title, body, kind, target, check(), action?, hint?, hold? }; check() reads REAL
 * state; sheet work is asked for inside on-sheet targets (`zones`) and only counts there;
 * a step's `action.run` (a spec and screenshot seam, never a control, except on the
 * hands-off `sheets` step) goes through a shipped App.* door or the control's own click; bodies are lines, one action per "1. …" line, controls written in double square
 * brackets (teaching-labels.test.js proves each one exists), no em dashes. A lesson refuses to
 * start over a cloud project (the engine's rule) and never becomes the device's trade.
 *
 * Progress is per device: localStorage `clickcount-lessons-done`, { <lessonId>: ISO }.
 * Entry points: the Learn menu (#learnModal: the empty-canvas "lessons" link, Project
 * Settings → Help → "lessons", /app/?learn=1) and /app/?lesson=<id>, which the guides'
 * "Try it" links use.
 *
 * Registrations: openLearnMenu(), startLesson(id), lessonIds(), lessonsDone().
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // The sample SETS the teaching runs on. The lessons and the plumbing course run on the
  // lesson set; a course may name another (`lesson.set`, features/course-electrical.js runs
  // on the electrical set). A set the teaching opened is reset, never asked about, when the
  // next lesson opens; the reader's own plan always goes through Close project.
  const LESSON_SET = { url: '/samples/sample-lessons.pdf', name: 'sample-lessons', pages: 4, trade: 'plumbing', word: 'four' };
  const KNOWN_SETS = ['sample-lessons', 'sample-electrical', 'sample-hvac', 'blank-sheet'];   // blank-sheet: features/tour-blank.js
  const setOf = (lesson) => (lesson && lesson.set) || LESSON_SET;
  const SET_NAME = LESSON_SET.name;
  const DONE_KEY = 'clickcount-lessons-done';
  const K = () => App.tourKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ----- the sheets ---------------------------------------------------------------------
  const P101 = 0, P401 = 1, P501 = 2, P601 = 3;
  const P = (x, y) => ({ x: 60 + 0.75 * x, y: 70 + 0.75 * y });   // a P-101 drawing point, in PDF pts
  const FD = {   // P-101's ten floor drains, by where they sit
    men: P(630, 192), women: P(766, 196), mop: P(902, 206), bar1: P(238, 542), bar2: P(340, 545),
    kitchen1: P(610, 432), kitchen2: P(740, 430), kitchen3: P(860, 440), dish: P(648, 536), storage: P(740, 528),
  };
  const KITCHEN_FDS = [FD.kitchen1, FD.kitchen2, FD.kitchen3];
  const BAR = { x1: 60 + 0.75 * 133, y1: 70 + 0.75 * 472, x2: 60 + 0.75 * 418, y2: 70 + 0.75 * 598 };
  const STRAY = P(345, 330);                       // a mark that does not belong, mid dining room
  const LAVS = [P(584, 180), P(712, 180)];         // the two restroom lavatories
  const MOP = P(848, 126);
  const WCS = [P(596, 129), P(732, 129)];
  const HAND_SINKS = [P(330, 578), P(600, 308), P(928, 392)];
  const GAS_MAIN = [P(840, 632), P(840, 346), P(700, 346)];   // meter, up the east side, along the cook line
  const GI = { x1: 60 + 0.75 * 955, y1: 70 + 0.75 * 510, x2: 60 + 0.75 * 1031, y2: 70 + 0.75 * 576 };
  const NOTE_SPOT = P(760, 380), RFI_SPOT = P(990, 600);
  const DETAIL = {   // P-401, straight in points (LESSON_DETAIL in sample-plan-candidates.js)
    prove: [{ x: 100, y: 118 }, { x: 316, y: 118 }],                       // the 12'-0" string over WOMEN
    box: { x1: 630, y1: 122, x2: 1050, y2: 338 },                          // around detail 2
    hs: { x: 760, y: 196 }, fd: { x: 904, y: 262 },
    proveZone: [{ x: 760, y: 300 }, { x: 904, y: 300 }],                   // the 4'-0" string inside it
  };

  // ----- reading the app ----------------------------------------------------------------
  const pageAnn = (i) => { const p = S().pages && S().pages[i]; return p ? App.getActiveAnnotations(p) : null; };
  const onPage = (i) => S().currentPage === i;
  const isSetOpen = (lesson) => { const set = setOf(lesson); return !!(S().pages && S().pages.length === set.pages && S().currentProjectName === set.name); };
  // The counter (line type) a lesson names, among the palette items matching its word: the
  // lesson's own (lesson-flagged) first; else the one the reader has armed; else one that
  // carries marks; else the NEWEST match. Never the first match: the Artboard rides into the
  // set, so a standing palette counter with the word in its name and no marks ("Panel …"
  // ahead of the reader's fresh "Panelboard Panel", wendi, 2026-09-24) shadowed the counter
  // the reader made, and a right click read as an armed counter never used.
  // A match made in this lesson (not in the palette standing when the set opened) wins over the
  // reader's standing one: the plumbing chain step named L-1 while the setup had adopted the
  // standing "Lavatory" (by hand, 2026-09-25).
  const named = (list, re, armedId, used) => {
    const all = (list || []).filter((x) => re.test(x.name || ''));
    const fresh = all.filter((x) => !standing.has(x.id));
    const hits = fresh.length ? fresh : all;
    return hits.find((x) => x.lesson) || hits.find((x) => x.id === armedId) || hits.find(used) || hits[hits.length - 1];
  };
  const counterNamed = (re) => named(S().counters, re, S().activeCounterType, (c) => K().markCount(c.id) > 0);
  const lineTypeNamed = (re) => named(S().lineTypes, re, S().activeLineTypeId, (l) => (S().pages || []).some((p) => { const a = App.getActiveAnnotations(p); return !!a && (a.polylines || []).concat(a.quickLines || []).some((ln) => ln.lineTypeId === l.id); }));
  // Every line type a step's word names: a reader whose own palette already has "4in PVC" sees two
  // after the chapter seeds its own, and a run or a setting on either is the step done (by hand,
  // 2026-09-25: the stack traced with the reader's own 4in PVC read "0 of 2 done").
  const lineTypesMatching = (re) => (S().lineTypes || []).filter((l) => re.test(l.name || ''));
  const someLineType = (re, pred) => lineTypesMatching(re).some((l) => { try { return !!pred(l); } catch (_) { return false; } });
  const marksOf = (c) => (c ? K().markCount(c.id) : 0);
  const scaleIs = (i, ppu) => { const sc = App.getPageScale && App.getPageScale(i); return !!sc && Math.abs(sc.pixelsPerUnit - ppu) < 0.05; };
  const inRect = (pt, r) => pt.x >= r.x1 && pt.x <= r.x2 && pt.y >= r.y1 && pt.y <= r.y2;
  const near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) <= d;
  const modalUp = (id) => { const m = el(id); return !!m && m.classList.contains('visible'); };
  const measured = (i, ft, tol) => { const lm = S().lastMeasure; const v = K().measuredFeet(); return !!lm && lm.pageIdx === i && v != null && Math.abs(v - ft) <= tol; };

  // ----- on-sheet targets (the engine's kit: circles for clicks, a boundary for a drag) -----------
  const FD_RE = /floor\s*drain|^fd\b/i;
  const idOf = (c) => (c ? c.id : '-');
  const circlesFor = (pageIdx, counter, spots, r) => K().markZones(pageIdx, idOf(counter), spots, r);
  const strayHint = (pageIdx, counter, spots, r) => (counter && K().strayMarks(pageIdx, counter.id, K().markZones(pageIdx, counter.id, spots, r)) ? 'A mark outside the circles does not count. Press Ctrl+Z to undo it, then click inside a circle' : '');
  const guide = (spots, r, done) => spots.map((p) => ({ kind: 'circle', x: p.x, y: p.y, r, done: !!done }));
  const rectsOf = (pageIdx, key, test) => { const a = pageAnn(pageIdx); return ((a && a[key]) || []).filter((z) => !test || test(z)); };
  const DETAIL_INNER = { x1: 640, y1: 130, x2: 1040, y2: 330 };      // detail 2's dashed frame
  const DETAIL_OUTER = { x1: 604, y1: 96, x2: 1080, y2: 392 };       // generous, and clear of plan 1
  const BAR_FIXTURES = { x1: 60 + 0.75 * 160, y1: 70 + 0.75 * 530, x2: 60 + 0.75 * 360, y2: 70 + 0.75 * 592 };
  const GI_TANK = { x1: 60 + 0.75 * 965, y1: 70 + 0.75 * 520, x2: 60 + 0.75 * 1021, y2: 70 + 0.75 * 554 };   // the interceptor's own rectangle
  const GI_OUTER = { x1: GI.x1 - 40, y1: GI.y1 - 40, x2: GI.x2 + 60, y2: GI.y2 + 40 };
  // the committed runs, plus the corners of the trace in progress so the circles tick as the reader goes
  const gasPaths = (live) => { const a = pageAnn(P101); const d = S().drawingPolyline; return ((a && a.polylines) || []).map((pl) => pl.points || []).concat(live && d && d.points ? [d.points] : []); };
  const meterDrop = () => { const a = pageAnn(P101); const z = { x: GAS_MAIN[0].x, y: GAS_MAIN[0].y, r: 15 }; return !!a && (a.polylines || []).some((l) => { const p = l.points || []; if (!p.length) return false; return ((l.startDrop || 0) > 0 && K().inCircle(p[0], z)) || ((l.endDrop || 0) > 0 && K().inCircle(p[p.length - 1], z)); }); };
  const kitchenGroup = () => (S().groups || []).find((x) => /kitchen/i.test(x.name || ''));
  const barCleared = () => { const a = pageAnn(P101); return !!a && !Object.keys(a.counterMarkers || {}).some((cid) => (a.counterMarkers[cid] || []).some((m) => inRect(m, BAR))); };
  const noteAt = (spot, r, re) => { const a = pageAnn(P101); return !!a && (a.notes || []).some((n) => (!re || re.test(String(n.text || ''))) && K().inCircle({ x: n.x, y: n.y }, { x: spot.x, y: spot.y, r })); };

  // ----- doing things for the reader ------------------------------------------------------
  const dirty = () => { App.markProjectDirty(); App.updateUI(); App.renderAnnotations(); };
  function goPage(i) { if (S().pages[i] && S().currentPage !== i) { S().currentPage = i; App.fitZoom(); App.updateUI(); } }
  function setScale(i, ppu, label) { const p = S().pages[i]; if (p) p.scale = { pixelsPerUnit: ppu, unit: 'ft', label }; }
  function makeCounter(name, iconName, color, extra) {
    const have = (S().counters || []).find((c) => c.lesson && c.name === name);
    if (have) return have;
    const c = Object.assign({ id: App.uid(), name, icon: K().customIcon(iconName) || K().firstIcon(), color, lesson: true }, extra || {});
    S().counters.push(c);
    return c;
  }
  function makeLineType(name, color, extra) {
    const have = (S().lineTypes || []).find((l) => l.lesson && l.name === name);
    if (have) return have;
    const lt = Object.assign({ id: App.uid(), name, color, curveStyle: 'straight', lesson: true }, extra || {});
    S().lineTypes.push(lt);
    return lt;
  }
  function mark(pageIdx, counter, spots) {
    const canvas = App.ensureActiveCanvas(S().pages[pageIdx]);
    const m = canvas.annotations.counterMarkers;
    if (!m[counter.id]) m[counter.id] = [];
    spots.forEach((pt) => m[counter.id].push({ x: pt.x, y: pt.y, id: App.uid(), group: null }));
  }
  // The Scale lesson's proof, built once on first use (the kit registers after this file loads):
  // the span, the circle that ticks as its click lands, and the hint that names the miss.
  let proveP401Memo = null;
  const proveP401 = () => proveP401Memo || (proveP401Memo = K().measureProof({ page: P401, ends: DETAIL.prove, r: 16, ft: 12, tol: 0.4, stated: '12\'-0"' }));
  function measure(a, b) {
    const s = S();
    s.tool = App.TOOL.MEASURE;
    s.scaleMode = App.SCALE_MODES.POINT_A;
    s.scalePointA = null; s.scalePointB = null;
    App.commitMeasurePoint(a, { fromAim: true });
    App.commitMeasurePoint(b, { fromAim: true });
    s.tool = App.TOOL.NONE;
    App.updateUI(); App.renderAnnotations();
  }
  function arm(counter) { const s = S(); s.activeCounterType = counter.id; s.tool = App.TOOL.COUNTER; App.updateUI(); }
  function hangerRuleFor(lt) {
    const sm = window.SupportModel;
    const sg = (sm && sm.hangerSuggestionsFor(lt.name)[0]) || { name: 'Hanger', qty: 1, per: 'ft', intervalIn: 32, ruleId: 'plumb.hanger.pex' };
    return { name: sg.name, qty: sg.qty, per: sg.per, intervalIn: sg.intervalIn, ruleId: sg.ruleId };
  }
  // The branch several lessons take for granted: both restroom lavatories and the mop
  // sink chained on 1/2in PEX, through the Chain tool's own commit.
  function seedBranch() {
    setScale(P101, 9, '1/8" = 1\'');
    const lav = makeCounter('Lavatory', 'Mounted Sink', '#e8c547');
    const pex = makeLineType('1/2in PEX', '#47c88e');
    K().chainPoints(lav.id, pex.id, [LAVS[0], LAVS[1], MOP]);
    return { lav, pex };
  }

  // ----- opening the sheets, fresh, without costing anyone their work ----------------------
  let seededFor = null;   // the lesson whose seed is on the open sheets
  let openingFor = null;  // the lesson that asked for the sheets now opening
  // The palette standing when a set opens: the reader's own counters and line types, which a
  // lesson may use but never adopts as the one its card names (see `named`).
  let standing = new Set();
  function sweepLessonPalette() {
    const s = S();
    const gone = new Set();
    s.counters = (s.counters || []).filter((c) => { if (c.lesson) gone.add(c.id); return !c.lesson; });
    s.lineTypes = (s.lineTypes || []).filter((l) => { if (l.lesson) gone.add(l.id); return !l.lesson; });
    Object.keys(s.numberKeyBindings || {}).forEach((slot) => { if (gone.has(s.numberKeyBindings[slot].id)) delete s.numberKeyBindings[slot]; });
    standing = new Set((s.counters || []).map((c) => c.id).concat((s.lineTypes || []).map((l) => l.id)));
  }
  // A PDF with several sheets goes through Trim your set (Prepare PDF) like any upload.
  // The Sheets lesson leaves that dialog to the reader, because it IS the lesson; every
  // other lesson presses its Open for them.
  async function openSheetsFor(lesson) {
    if (modalUp('preparePdfModal')) { el('preparePdfDone').click(); return; }
    const s = S();
    if (s.pages && s.pages.length) {
      if (KNOWN_SETS.includes(s.currentProjectName)) { App.resetLocalSessionState({ keepArtboard: true }); App.updateUI(); App.renderPdf(); }
      else if (!(await App.closeProject({ route: 'lesson' }))) return;   // their own plan: the app's one Close project, which asks first
    }
    sweepLessonPalette();
    setSearches({ counter: '', lineType: '', lines: '' });   // a filter typed on the last bid hid the counter the reader just made (wendi, 2026-09-24)
    seededFor = null;
    openingFor = lesson.id;
    const set = setOf(lesson);
    await K().openPlanFile(set.url, set.name + '.pdf');
    if (lesson.trimByHand) return;
    for (let i = 0; i < 150 && !modalUp('preparePdfModal') && !isSetOpen(lesson); i++) await wait(100);
    if (modalUp('preparePdfModal')) el('preparePdfDone').click();
  }
  // The seed lands the moment the sheets are open, whoever pressed Open. Marked done
  // BEFORE it runs: seeding refreshes the UI, which re-enters the step's check.
  // "Open" means SETTLED: the intake builds three pages, hands them to Trim your set
  // (which empties them) and rebuilds them on its Open, so a seed laid the moment three
  // pages exist lands on pages about to be thrown away (seen: a lesson with no scale).
  // The same first page object, with no Trim dialog up, for half a second, is open.
  let settledPage = null, settledAt = 0;
  function seedIfReady(lesson) {
    if (!isSetOpen(lesson) || openingFor !== lesson.id || seededFor === lesson.id) return;
    const first = S().pages[0];
    if (modalUp('preparePdfModal') || !first.pdfPage) { settledPage = null; return; }
    if (settledPage !== first) { settledPage = first; settledAt = Date.now(); return; }
    if (Date.now() - settledAt < 500) return;
    seededFor = lesson.id;
    const trade = setOf(lesson).trade || 'plumbing';
    if (S().trade !== trade && App.setProjectTrade) App.setProjectTrade(trade, { remember: false, route: 'lesson' });
    if (lesson.seed) lesson.seed();
    S().tool = App.TOOL.NONE;
    App.clearUndoStacks();
    S().currentPage = lesson.page || 0;
    dirty();
    App.fitZoom();   // ONE raster for the page the lesson lands on: two back to back left the sheet blank
  }
  const openStep = (lesson) => ({
    id: 'sheets', title: lesson.title, kind: 'do',
    body: lesson.intro + '\n1. Click [[Open the lesson sheets]] below.' + (lesson.trimByHand ? '\n2. Trim your set opens, as it does for any PDF with more than one sheet: this is where a 120-sheet set becomes the 9 you are bidding. Keep all ' + (setOf(lesson).word || 'four') + ' and click [[Open]].' : '') + '\nThe ' + (lesson.noun || 'lesson') + ' brings its own ' + (setOf(lesson).word || 'four') + ' sample sheets and whatever it takes for granted, already on them. Nothing here touches your projects.',
    target: ['#preparePdfDone', '#uploadPdf', '#uploadPdfSidebar'],
    check: () => { seedIfReady(lesson); return isSetOpen(lesson) && seededFor === lesson.id; },
    handsOff: true,   // fetching the sample sheets is the app's job: this step's button does it
    action: { label: 'Open the lesson sheets', run: () => openSheetsFor(lesson) },
  });
  const doneStep = (lesson, body) => ({ id: 'done', title: 'That is ' + lesson.short, kind: 'read', body, target: [], check: () => true });

  // ===== the lessons =======================================================================
  let sawMarksHidden = false, extraSeen = false, p501Label = null;

  const LESSONS = [
    // 1 ---------------------------------------------------------------------------------
    {
      id: 'plans', title: 'Sheets: find, turn and name them', short: 'a plan set under control', minutes: 2, page: P101, trimByHand: true,
      intro: 'A bid set is many sheets, some scanned sideways, most badly named. Two minutes on getting around one.',
      seed() { setScale(P101, 9, '1/8" = 1\''); mark(P101, makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'), [FD.kitchen1, FD.kitchen2]); p501Label = S().pages[P501].label; },
      steps: [
        { id: 'jump', title: 'Go to a sheet', kind: 'do',
          body: '1. In the left sidebar, under PAGES, click the third sheet, P-501.\nThe number badge tells you about a sheet at a glance: outlined when its scale is set, filled when it carries marks. The arrow keys, left and right, step through the set.',
          target: ['#pagesList', '#pagesSectionTitle'], check: () => onPage(P501),
          action: { label: 'Go to P-501', run: () => goPage(P501) } },
        { id: 'rotate', title: 'Turn a sideways sheet', kind: 'do',
          body: 'The schedule was scanned on its side.\n1. In the footer, click [[Rotate 90° right]] (or press R).\nThe turn is saved with the project and every export honours it. Marks already on a sheet turn with it.',
          target: ['#rotatePage'], check: () => ((S().pages[P501] || {}).rotation || 0) === 90,
          hint: () => (((S().pages[P501] || {}).rotation || 0) ? 'Keep turning until the title reads left to right' : ''),
          action: { label: 'Turn it for me', run: () => { goPage(P501); if (((S().pages[P501] || {}).rotation || 0) !== 90) el('rotatePage').click(); } } },
        { id: 'rename', title: 'Name a sheet', kind: 'do',
          body: 'Sheets name themselves from their title block, which is how this one became "P-501". When a scan has no readable title block, name it yourself.\n1. Under PAGES, click the number badge beside P-501.\n2. Type a name you would search for, such as P-501 Fixture Schedule.\n3. Press Enter.\nReports and exports use this name.',
          target: ['#pagesList .sidebar-item.active .page-num-badge-wrap', '#pagesList'], check: () => { const p = S().pages[P501]; return !!p && !!p.label && p.label !== p501Label; },
          action: { label: 'Name it for me', run: () => { const p = S().pages[P501]; App.pushUndoSnapshot(); p.label = 'P-501 Fixture Schedule'; dirty(); } } },
        { id: 'marked', title: 'Jump to the sheets that matter', kind: 'do',
          body: 'On a sixty-sheet set only a few carry your marks. This lesson put two floor drains on P-101.\n1. In the footer, click [[Previous marked page]] (or press Shift and the left arrow).\nIt skips every sheet with nothing on it.',
          target: ['#prevMarkedPage'], check: () => onPage(P101),
          action: { label: 'Jump for me', run: () => el('prevMarkedPage').click() } },
        { id: 'prepare', title: 'Before a real set opens', kind: 'read',
          body: '[[Upload PDF]] takes several files at once, and every multi-sheet upload passes through the Trim your set dialog you saw at the start: tap the sheets you do not need (or [[Keep none]] and tap the ones you do), open a sheet to turn it, then [[Open]]. Upload again later and the new sheets join the end of the set.\nThe whole walk: [Preparing a plan set](/guides/preparing-a-plan-set/).',
          target: ['#uploadPdf', '#uploadPdfSidebar'], check: () => true },
      ],
      done: 'Find a sheet, turn it, name it, jump between the ones with marks.\nNext: [[Learn]] → Scale, because nothing measured is right until the scale is.',
    },
    // 2 ---------------------------------------------------------------------------------
    {
      id: 'scale', title: 'Scale: set it, prove it, and zones', short: 'a scale you can trust', minutes: 3, page: P401,
      intro: 'Every length the app reports hangs off the scale. This sheet has two: the plan at 1/4" and a detail at 1/2".',
      seed() { setScale(P101, 9, '1/8" = 1\''); },
      steps: [
        { id: 'set', title: 'Each sheet has its own scale', kind: 'do',
          body: 'P-101 is already at 1/8". This sheet, P-401, is drawn at 1/4" and has no scale yet: its badge under PAGES is not outlined.\n1. In the header, click [[Set Scale]] (or press S).\n2. Click the [[Architectural & Engineering]] tab.\n3. Click [[1/4" = 1\']].',
          target: ['#setScale', '#setScaleSidebar'], check: () => scaleIs(P401, 18),
          action: { label: 'Use 1/4" = 1\'-0"', run: async () => { goPage(P401); await K().applyScalePreset('1/4" = 1\'', 18); } } },
        { id: 'prove', cardAt: 'bl', title: 'Prove it', kind: 'do',
          hold: true,   // the reading is the lesson: the card shows it and waits for Next
          body: () => (proveP401().check()
            ? proveP401().verdict() + ': this sheet\'s scale is right.\nDo this on every sheet you measure on. A PDF printed down to a smaller sheet looks right and measures short, and the title block will not tell you.\n1. Click [[Next]].'
            : '1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at the left end of the 12\'-0" dimension over WOMEN.\n3. Click inside circle 2, at its right end.'),
          target: ['#measureBtn', '#measureBtnSidebar'], page: P401, zones: () => proveP401().zones(), check: () => proveP401().check(), hint: () => proveP401().hint(),
          action: { label: 'Measure the 12\'-0" string', run: async () => { goPage(P401); if (!scaleIs(P401, 18)) await K().applyScalePreset('1/4" = 1\'', 18); measure(DETAIL.prove[0], DETAIL.prove[1]); } } },
        { id: 'zone', cardAt: 'bl', title: 'A detail at another scale', kind: 'do',
          body: 'Detail 2 is drawn at 1/2". Measured at the sheet\'s 1/4" it would read double.\n1. In the header, click [[⋯]], then [[Scale Zone]].\n2. Drag a box around detail 2: start and end anywhere inside the shaded boundary.\n3. In the dialog, choose [[1/2" = 1\']].\nEverything inside the box now measures at its own scale, beside the rest of the sheet.',
          target: ['#scaleZoneBtn', '#scaleZoneBtnSidebar', '#headerMoreBtn'],
          page: P401,
          zones: () => [K().boxZone(rectsOf(P401, 'scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 36) < 0.1), DETAIL_INNER, DETAIL_OUTER, 'Drag your box around detail 2, anywhere in here')],
          hint: () => K().boxMiss(rectsOf(P401, 'scaleZones'), DETAIL_INNER, DETAIL_OUTER) || (rectsOf(P401, 'scaleZones').length && !rectsOf(P401, 'scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 36) < 0.1).length ? 'The box is right, the scale is not. Right-click its label, Edit scale, and choose 1/2" = 1\'' : ''),
          check: () => K().boxZone(rectsOf(P401, 'scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 36) < 0.1), DETAIL_INNER, DETAIL_OUTER).done,
          action: { label: 'Box detail 2 at 1/2"', run: () => { goPage(P401); const a = App.ensureActiveCanvas(S().pages[P401]).annotations; if (!a.scaleZones) a.scaleZones = []; if (a.scaleZones.length) return; App.pushUndoSnapshotCurrentPage(); a.scaleZones.push(Object.assign({ id: App.uid(), scale: { pixelsPerUnit: 36, unit: 'ft', label: '1/2" = 1\'' } }, DETAIL.box)); dirty(); } } },
        { id: 'provezone', cardAt: 'bl', title: 'Prove the zone', kind: 'do',
          body: '1. Click [[Measure]] again (or press D).\n2. Click the tick marks in the two circles, the ends of the 4\'-0" dimension inside detail 2.\nIt reads 4\'-0", not 8\'-0": the zone\'s scale won.',
          target: ['#measureBtn', '#measureBtnSidebar'], page: P401, zones: () => guide(DETAIL.proveZone, 12, measured(P401, 4, 0.25)), check: () => measured(P401, 4, 0.25),
          hint: () => { const lm = S().lastMeasure; const v = K().measuredFeet(); return lm && lm.pageIdx === P401 && v != null && Math.abs(v - 12) > 0.4 ? 'Read ' + String(lm.text || '').replace(/^Distance:\s*/, '') : ''; },
          action: { label: 'Measure the 4\'-0" string', run: () => { goPage(P401); measure(DETAIL.proveZone[0], DETAIL.proveZone[1]); } } },
        { id: 'more', title: 'When the title block gives no scale', kind: 'read',
          body: 'The Set Scale dialog can also take two clicks on a known dimension and the length you type, and it warns when a sheet\'s size says the PDF was printed down.\nBoth walks: [Setting the scale](/guides/setting-the-scale/) and [Is your scale lying to you?](/guides/verifying-your-scale/).',
          target: ['#setScale', '#setScaleSidebar'], check: () => true },
      ],
      done: 'A scale per sheet, a proof on every one, and a zone where the drawing changes scale.\nNext: [[Learn]] → Counting.',
    },
    // 3 ---------------------------------------------------------------------------------
    {
      id: 'counting', title: 'Counting: counters and the number row', short: 'counting at speed', minutes: 3, page: P101,
      intro: 'Counting is most of a takeoff. Make a counter, click the fixtures, then put it on a number key so your hand never leaves the plan.',
      seed() { setScale(P101, 9, '1/8" = 1\''); },
      steps: [
        { id: 'counter', title: 'Make a Floor Drain counter', kind: 'do',
          body: '1. In the left sidebar, under COUNTERS, click [[+ Add]].\n2. Click the [[Create]] tab.\n3. In Name, type Floor Drain.\n4. Pick a symbol and a colour.\n5. Click [[Create Counter]].\nThe counter tool arms itself. The [[Quick]] tab builds a name from Size, Type and Material when you want every bid to spell it the same way.',
          target: ['#counterCreate', '#counterModal .counter-tab[data-tab="create"]', '#addCounter'], check: () => !!counterNamed(/floor\s*drain|^fd\b/i),
          action: { label: 'Create it for me', run: () => { const c = makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'); App.pushUndoSnapshot(); arm(c); dirty(); } } },
        { id: 'place', title: 'Count the kitchen', kind: 'do',
          body: 'The kitchen has three floor drains along the work aisle, and the lesson has circled them.\n1. Click inside the first circle.\n2. Click inside the second.\n3. Click inside the third.\nAnywhere in a circle counts. One click is one tally. The count beside the counter moves as you go, and it is the total for the whole set, not this sheet.',
          target: ['#annCanvas'], page: P101, zones: () => circlesFor(P101, counterNamed(FD_RE), KITCHEN_FDS, 16),
          check: () => K().allDone(circlesFor(P101, counterNamed(FD_RE), KITCHEN_FDS, 16)),
          hint: () => strayHint(P101, counterNamed(FD_RE), KITCHEN_FDS.concat([FD.dish]), 16),
          action: { label: 'Count three for me', run: () => { const c = counterNamed(/floor\s*drain|^fd\b/i) || makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'); App.pushUndoSnapshotCurrentPage(); mark(P101, c, KITCHEN_FDS.slice(Math.min(3, marksOf(c)))); arm(c); dirty(); } } },
        { id: 'bind', title: 'Put it on the number row', kind: 'do',
          body: '1. In the status bar at the bottom right, click [[quick keys]].\n2. Beside key 1, choose Floor Drain.\n3. Close the dialog.\nQuick Keys are saved with the project, and with your Artboard, so a standard palette brings its keys to the next bid.',
          target: ['#quickKeysModal .modal-card', '#statusBarQuickKeys'],
          check: () => { const c = counterNamed(/floor\s*drain|^fd\b/i); return !!c && Object.values(S().numberKeyBindings || {}).some((b) => b && b.id === c.id); },
          action: { label: 'Bind 1 to Floor Drain', run: () => { const c = counterNamed(/floor\s*drain|^fd\b/i); if (!c) return; if (!S().numberKeyBindings) S().numberKeyBindings = {}; S().numberKeyBindings[1] = { kind: 'counter', id: c.id }; dirty(); } } },
        { id: 'usekey', title: 'Count from the keyboard', kind: 'do',
          body: '1. Press M to put the counter down (Move).\n2. Press 1. The Floor Drain counter arms again.\n3. Click inside the circle on the floor drain in the dish room, below the kitchen.\nOn a real sheet that is the whole rhythm: 1, click, click, 2, click, click.',
          target: ['#annCanvas'], page: P101, zones: () => circlesFor(P101, counterNamed(FD_RE), [FD.dish], 16),
          check: () => K().allDone(circlesFor(P101, counterNamed(FD_RE), [FD.dish], 16)),
          action: { label: 'Press 1 and count it', run: () => { const c = counterNamed(/floor\s*drain|^fd\b/i); if (!c) return; if (App.triggerQuickKey) App.triggerQuickKey(1); App.pushUndoSnapshotCurrentPage(); mark(P101, c, [FD.dish]); dirty(); } } },
        { id: 'settings', title: 'How the marks look', kind: 'read',
          body: 'Right-click the [[Counter]] button in the header for Counter Settings: marker size, the ring, the running number beside each mark. Make them small on a dense sheet and large on a tablet.\nMore: [Counting with counters](/guides/counting-with-counters/), [Custom icons](/guides/custom-icons/) and [Quick creators](/guides/quick-creators/).',
          target: ['#counterBtn', '#counterBtnSidebar'], check: () => true },
      ],
      done: 'A counter, a count, and a number key.\nNext: [[Learn]] → Measuring.',
    },
    // 4 ---------------------------------------------------------------------------------
    {
      id: 'measuring', title: 'Measuring: runs, bends and drops', short: 'a measured run', minutes: 3, page: P101,
      intro: 'Trace the gas main from the meter to the cook line, let the run count its own elbow, and add the riser plan view never shows.',
      seed() { setScale(P101, 9, '1/8" = 1\''); const lt = makeLineType('1-1/4in Gas', '#e85447'); S().activeLineTypeId = lt.id; },
      steps: [
        { id: 'snap', title: 'Keep runs square', kind: 'do',
          body: '1. In the header, click [[Snap to 45° angles]] (or press J) so it is lit.\nTraced segments lock to horizontal, vertical and 45°, the angles pipe actually takes. Turn it off for the rare run that does not.',
          target: ['#lineTypeSnapToHVHeaderBtn'], check: () => !!(S().lineTypeSettings && S().lineTypeSettings.snapToHorizontalVertical),
          action: { label: 'Turn it on', run: () => { if (!(S().lineTypeSettings && S().lineTypeSettings.snapToHorizontalVertical)) el('lineTypeSnapToHVHeaderBtn').click(); } } },
        { id: 'trace', cardAt: 'bl', title: 'Trace the gas main', kind: 'do',
          body: 'The lesson made a line type for you, 1-1/4in Gas. The gas main is the dash-dot line that leaves the meter (GM) below the building, runs up the east side of the kitchen and turns west along the cook line.\n1. In the header, click [[Polyline]] (or press P).\n2. Click inside circle 1, at the meter.\n3. Click inside circle 2, the corner where the run turns.\n4. Click inside circle 3, the end of the run at the range.\n5. Press Enter.\nA [[Quick Line]] is the same thing for a single straight piece.',
          target: ['#polylineBtn', '#polylineBtnSidebar'],
          page: P101,
          zones: () => K().pathZones(GAS_MAIN, 15, gasPaths(true)),
          check: () => K().allDone(K().pathZones(GAS_MAIN, 15, gasPaths(false))),
          action: { label: 'Trace it for me', run: () => { const lt = lineTypeNamed(/gas/i); const a = pageAnn(P101); if (!lt || (a && (a.polylines || []).length)) return; goPage(P101); S().drawingPolyline = { id: App.uid(), name: 'Gas main', color: lt.color, points: GAS_MAIN.map((pt) => ({ x: pt.x, y: pt.y })), closed: false, lineTypeId: lt.id, group: null }; App.settlePolylineDraft(); } } },
        { id: 'bends', title: 'Let the run count its elbows', kind: 'do',
          body: '1. In the left sidebar, under LINE TYPES, click the pencil beside 1-1/4in Gas.\n2. Turn on [[Fittings from bends]].\n3. Click [[Done]].\nEach bend now counts the fitting nearer its angle, a 45 or a 90, and a small chip at the corner shows what the tally will say. Where a jog only routes around text, right-click that corner while editing the run and choose No fitting here.',
          target: ['#counterLineTypeDetailsModal .modal-card', '#lineTypesList .edit-btn', '#lineTypesSectionTitle'],
          check: () => someLineType(/gas/i, (lt) => lt.bendFittings && lt.bendFittings.enabled),
          action: { label: 'Turn it on for me', run: () => { const lt = lineTypeNamed(/gas/i); if (!lt) return; App.pushUndoSnapshot(); const fm = window.FittingModel; lt.bendFittings = Object.assign(fm && fm.normalizeBendFittings ? fm.normalizeBendFittings(lt) : { bend45: { name: lt.name + ' 45° elbow', qty: 1 }, bend90: { name: lt.name + ' 90° elbow', qty: 1 }, drop: { name: lt.name + ' 90° elbow', qty: 1 } }, { enabled: true }); dirty(); } } },
        { id: 'drop', cardAt: 'bl', title: 'Add the riser', kind: 'do',
          body: 'The main comes up 4 ft out of the ground at the meter.\n1. In the header, click [[Drop]] (or press B).\n2. In the palette, choose or type 4 ft.\n3. Click the end of the run inside the circle, at the meter.\nThose 4 ft join the run\'s footage, and with Fittings from bends on, the drop counts a 90 too. Click the same end again to clear it.',
          target: ['#dropPanel', '#dropBtn'],
          page: P101,
          zones: () => guide([GAS_MAIN[0]], 15, meterDrop()),
          check: () => meterDrop(),
          action: { label: 'Add a 4 ft riser for me', run: () => { goPage(P101); const a = pageAnn(P101); if (!a) return; const nodes = App.collectDropNodes(a, 1) || []; let best = null, d = Infinity; nodes.forEach((n) => { const dd = Math.hypot(n.x - GAS_MAIN[0].x, n.y - GAS_MAIN[0].y); if (dd < d) { d = dd; best = n; } }); if (!best || !App.applyDropToNode(a, best, 4, 'ft', true)) return; App.pushUndoSnapshotCurrentPage(); App.applyDropToNode(a, best, 4, 'ft'); App.pushRecentDrop(4, 'ft'); dirty(); } } },
        { id: 'read', title: 'Read the run', kind: 'read',
          body: '1. In the left sidebar, look at SUMMARY.\nThe run reads its plan length plus the 4 ft riser, and under it the elbows it counted for itself. None of those are marks, so they can never drift from the pipe: move a corner and they follow.\nMore: [Measuring runs](/guides/measuring-runs-lines-and-polylines/).',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'A traced run with its riser and its own elbows.\nNext: [[Learn]] → Chain and child counts.',
    },
    // 5 ---------------------------------------------------------------------------------
    {
      id: 'chain', title: 'Chain, and parts that count themselves', short: 'fixtures and pipe in one pass', minutes: 3, page: P101,
      intro: 'Fixtures on one branch are counted and piped in the same clicks, and the hangers come off the pipe by rule.',
      seed() { setScale(P101, 9, '1/8" = 1\''); makeCounter('Lavatory', 'Mounted Sink', '#e8c547'); makeLineType('1/2in PEX', '#47c88e'); },
      steps: [
        { id: 'chain', title: 'Chain the top wall', kind: 'do',
          body: 'The lesson made a Lavatory counter and a 1/2in PEX line type. The two restroom lavatories and the mop sink all hang off the cold water run on the top wall.\n1. In the header, click [[Chain]] (or press T).\n2. In the Chain panel, choose Lavatory and 1/2in PEX.\n3. Click inside circle 1 (the lavatory in MEN), circle 2 (the one in WOMEN), then circle 3 (the mop sink).\n4. Press Enter to end the run.\nEvery click places the fixture and draws the branch back to the last one.',
          target: ['#chainPanel', '#chainBtn'], page: P101, zones: () => circlesFor(P101, counterNamed(/lavatory/i), [LAVS[0], LAVS[1], MOP], 14),
          check: () => { const a = pageAnn(P101); return !!a && (a.quickLines || []).length >= 2 && K().allDone(circlesFor(P101, counterNamed(/lavatory/i), [LAVS[0], LAVS[1], MOP], 14)); },
          action: { label: 'Chain the three for me', run: () => { goPage(P101); const a = pageAnn(P101); if (a && (a.quickLines || []).length >= 2) return; K().chainPoints(makeCounter('Lavatory', 'Mounted Sink', '#e8c547').id, makeLineType('1/2in PEX', '#47c88e').id, [LAVS[0], LAVS[1], MOP]); } } },
        { id: 'hangers', title: 'Hangers from the rule', kind: 'do',
          body: '1. In the left sidebar, under LINE TYPES, click the pencil beside 1/2in PEX.\n2. Under [[Child counts]], the app offers the hanger spacing for that pipe, read off its name.\n3. Click [[Add]].\n4. Click [[Done]].\nEvery run of this type now counts its hangers into the Summary and every export. Delete a run and its hangers go with it.',
          target: ['#childCountsSuggest', '#childCountsGroup', '#lineTypesList .edit-btn', '#lineTypesSectionTitle'],
          check: () => someLineType(/pex/i, (lt) => (lt.childCounts || []).length),
          action: { label: 'Add the hanger rule', run: () => { const lt = lineTypeNamed(/pex/i); if (!lt || (lt.childCounts || []).length) return; App.pushUndoSnapshot(); lt.childCounts = [hangerRuleFor(lt)]; dirty(); } } },
        { id: 'rule', title: 'Where the number came from', kind: 'read',
          body: '1. In the left sidebar, look at SUMMARY: under 1/2in PEX, the Hanger row carries a § chip.\nThe chip names the rule the spacing came from and opens it in the public [rulebook](/rules/). Project Settings picks the code edition your jurisdiction is on. Your own child counts work the same way: a row per run, or one every so many feet, on a line type; a row per count on a counter (a carrier under every water closet).',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'Three clicks for three fixtures and their pipe, and hangers nobody counted.\nNext: [[Learn]] → Repeats.',
    },
    // 6 ---------------------------------------------------------------------------------
    {
      id: 'repeats', title: 'Repeats: count one, bid four', short: 'a typical, multiplied', minutes: 2, page: P401,
      intro: 'Detail 2 on this sheet is TYP. OF 4. Count it once and let a zone do the multiplying.',
      seed() {
        setScale(P101, 9, '1/8" = 1\''); setScale(P401, 18, '1/4" = 1\'');
        const a = App.ensureActiveCanvas(S().pages[P401]).annotations;
        if (!a.scaleZones) a.scaleZones = [];
        a.scaleZones.push(Object.assign({ id: App.uid(), scale: { pixelsPerUnit: 36, unit: 'ft', label: '1/2" = 1\'' } }, DETAIL.box));
        mark(P401, makeCounter('Hand Sink', 'Mounted Sink', '#e8c547'), [DETAIL.hs]);
        mark(P401, makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'), [DETAIL.fd]);
      },
      steps: [
        { id: 'zone', cardAt: 'bl', title: 'Wrap the typical', kind: 'do',
          body: 'The lesson counted detail 2 once: one hand sink, one floor drain. The sheet says it is built four times.\n1. In the header, click [[⋯]], then [[Multiply Zone]] (or press X).\n2. Drag a box around detail 2: start and end anywhere inside the shaded boundary.\n3. Type 4.\n4. Click [[Apply]].',
          target: ['#multiplyZoneBtn', '#multiplyZoneBtnSidebar', '#headerMoreBtn'],
          page: P401,
          zones: () => [K().boxZone(rectsOf(P401, 'multiplyZones', (z) => (z.multiplier || 1) > 1), DETAIL_INNER, DETAIL_OUTER, 'Drag your box around detail 2, anywhere in here')],
          hint: () => K().boxMiss(rectsOf(P401, 'multiplyZones'), DETAIL_INNER, DETAIL_OUTER),
          check: () => K().boxZone(rectsOf(P401, 'multiplyZones', (z) => (z.multiplier || 1) > 1), DETAIL_INNER, DETAIL_OUTER).done,
          action: { label: 'Wrap detail 2 in a ×4 zone', run: () => { goPage(P401); const a = App.ensureActiveCanvas(S().pages[P401]).annotations; if (!a.multiplyZones) a.multiplyZones = []; if (a.multiplyZones.length) return; App.pushUndoSnapshotCurrentPage(); a.multiplyZones.push(Object.assign({ id: App.uid(), multiplier: 4 }, DETAIL.box)); dirty(); } } },
        { id: 'read', title: 'One mark, four in the bid', kind: 'read',
          body: '1. In the left sidebar, look at SUMMARY.\nHand Sink reads 4 and Floor Drain reads 4, while the sheet still shows one mark of each. Every count and every foot inside the box multiplies in the totals, the report and every export, and the marks stay clean enough to check. It is the same tool for ten identical floors of a tower.\nRight-click the zone\'s label to change the number or remove it. More: [Scale zones and multiply zones](/guides/scale-zones-and-multiply-zones/).',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'Count one, bid four.\nNext: [[Learn]] → Organizing.',
    },
    // 7 ---------------------------------------------------------------------------------
    {
      id: 'organize', title: 'Organizing a busy sheet', short: 'a sheet you can still read', minutes: 3, page: P101,
      intro: 'Ten drains, three sinks, two water closets, and it is a small job. Groups, the sidebar filter, layers and Hide marks keep a real one readable.',
      seed() {
        setScale(P101, 9, '1/8" = 1\'');
        mark(P101, makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'), Object.keys(FD).map((k) => FD[k]));
        mark(P101, makeCounter('Hand Sink', 'Mounted Sink', '#e8c547'), HAND_SINKS);
        mark(P101, makeCounter('Water Closet', 'Toilet', '#47c88e'), WCS);
        makeCounter('Urinal', 'Urinal', '#c8963a');   // on P-401 only: the filter step's point
      },
      steps: [
        { id: 'groupson', title: 'Turn on Groups', kind: 'do',
          body: '1. In the header, click the gear ([[Project Settings]]).\n2. Turn on [[Use groups]].\n3. Close the dialog.\nA GROUPS section joins the sidebar. Projects that never use groups never see it.',
          target: ['#settingsUseGroupsBtn', '#settingsGearBtn', '#sidebarLogoGear'], check: () => !!S().groupsEnabled,
          action: { label: 'Turn Groups on', run: () => { if (App.turnOnGroups) App.turnOnGroups(); else S().groupsEnabled = true; App.updateUI(); } } },
        { id: 'group', title: 'Make a Kitchen group', kind: 'do',
          body: '1. In the left sidebar, under GROUPS, click [[+ Add]].\n2. In Name, type Kitchen.\n3. Click [[Done]].',
          target: ['#groupModalDone', '#addGroup', '#groupsSectionTitle'], check: () => (S().groups || []).some((g) => /kitchen/i.test(g.name || '')),
          action: { label: 'Make it for me', run: async () => { if ((S().groups || []).some((g) => /kitchen/i.test(g.name || ''))) return; if (!S().groupsEnabled && App.turnOnGroups) App.turnOnGroups(); App.openGroupModal(null); await wait(60); el('groupModalName').value = 'Kitchen'; el('groupModalDone').click(); await wait(80); } } },
        { id: 'assign', title: 'Put the kitchen drains in it', kind: 'do',
          body: 'The three floor drains along the kitchen\'s work aisle are circled.\n1. Right-click the mark inside a circle.\n2. Click [[Assign to group]], then Kitchen.\n3. Do the same in the other two circles.\nThe group\'s row in the sidebar subtotals what it holds. Tip: click a group first and everything you place after that joins it.',
          target: ['#annCanvas'], page: P101,
          zones: () => { const g = kitchenGroup(); return K().markZones(P101, null, KITCHEN_FDS, 16, (m) => !!g && m.group === g.id); },
          check: () => { const g = kitchenGroup(); return !!g && K().allDone(K().markZones(P101, null, KITCHEN_FDS, 16, (m) => m.group === g.id)); },
          action: { label: 'Assign the three for me', run: () => { const g = (S().groups || []).find((x) => /kitchen/i.test(x.name || '')); const c = counterNamed(/floor\s*drain/i); const a = pageAnn(P101); if (!g || !c || !a) return; App.pushUndoSnapshotCurrentPage(); (a.counterMarkers[c.id] || []).forEach((m) => { if (KITCHEN_FDS.some((k) => near(m, k, 4))) m.group = g.id; }); dirty(); } } },
        { id: 'filter', title: 'Show only what this sheet uses', kind: 'do',
          body: 'The palette has a Urinal counter that only P-401 uses. On a real bid the palette has sixty.\n1. In the left sidebar, beside the COUNTERS search box, click the funnel once.\nThe list drops to the counters with marks on this sheet. Click it again for the ones used anywhere in the project, and again for the whole palette. The lesson puts it back the way you had it when you leave.',
          target: ['#counterShowOnlyOnPageInlineBtn', '#countersSection'], check: () => (App.getCounterListFilterScope ? App.getCounterListFilterScope() === 'page' : false),
          action: { label: 'Filter to this page', run: () => { App.setCounterListFilterScope('page'); App.updateUI(); } } },
        { id: 'layer', title: 'An alternate on its own layer', kind: 'do',
          body: 'An alternate, an addendum, or waste kept apart from water: same sheet, its own layer, its own totals.\n1. In the footer, beside the layer name, click [[Layers]], then [[+ Add layer]].\n2. Click [[New empty layer]].\n3. In Name, type Alternate 1.\n4. Click [[Create]].\nThe up and down arrow keys switch layers. The button beside Layers shows every layer at once.',
          target: ['#addCanvasModalCreate', '#canvasMenuAdd', '#canvasLayersBtn'], check: () => ((S().pages[P101] || {}).canvases || []).length >= 2,
          action: { label: 'Add the layer for me', run: async () => { if (((S().pages[P101] || {}).canvases || []).length >= 2) return; goPage(P101); el('addCanvasBtn').click(); await wait(80); if (el('addCanvasModalNew')) el('addCanvasModalNew').click(); if (el('addCanvasModalName')) el('addCanvasModalName').value = 'Alternate 1'; if (el('addCanvasModalCreate')) el('addCanvasModalCreate').click(); await wait(80); } } },
        { id: 'hide', title: 'Read the bare drawing', kind: 'do',
          body: '1. In the header, click the eye, [[Hide marks]].\n2. Read the drawing under your marks.\n3. Click it again to bring them back.\nNothing is deleted. It is the fastest way to check whether a fixture is already counted.',
          target: ['#hideMarksBtn'], check: () => { if (S().hideMarks) sawMarksHidden = true; return sawMarksHidden && !S().hideMarks; },
          hint: () => (S().hideMarks ? 'Marks hidden. Click the eye again' : ''),
          action: { label: 'Hide and show for me', run: async () => { if (!S().hideMarks) el('hideMarksBtn').click(); await wait(900); if (S().hideMarks) el('hideMarksBtn').click(); } } },
      ],
      done: 'Groups, the filter, a layer, and the bare drawing.\nMore: [Keeping a dense takeoff organized](/guides/organizing-a-busy-sheet/) and [Canvas layers](/guides/canvas-layers/).\nNext: [[Learn]] → Fixing mistakes.',
    },
    // 8 ---------------------------------------------------------------------------------
    {
      id: 'fixing', title: 'Fixing mistakes', short: 'nothing you cannot take back', minutes: 3, page: P101,
      intro: 'A takeoff is mostly corrections. Undo, the right-click menu, item details and Delete area cover all of them.',
      seed() { setScale(P101, 9, '1/8" = 1\''); const c = makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'); mark(P101, c, KITCHEN_FDS.concat([FD.bar1, FD.bar2, STRAY])); S().activeCounterType = c.id; },
      steps: [
        { id: 'undo', title: 'Undo', kind: 'do',
          body: '1. In the header, click [[Counter]] (or press C) and choose Floor Drain.\n2. Click anywhere on the sheet to place a mark you do not want.\n3. In the footer, click [[Undo]] (or press Ctrl+Z).\nFifty steps back, and [[Redo]] beside it. Undo covers everything: marks, renames, zones, a page you turned.',
          target: ['#undoBtn'], check: () => { const n = marksOf(counterNamed(/floor\s*drain/i)); if (n >= 7) extraSeen = true; return extraSeen && n <= 6; },
          hint: () => (extraSeen ? 'Now click Undo' : ''),
          action: { label: 'Place one and undo it', run: async () => { const c = counterNamed(/floor\s*drain/i); if (!c) return; goPage(P101); App.pushUndoSnapshotCurrentPage(); mark(P101, c, [P(450, 380)]); dirty(); extraSeen = true; await wait(700); el('undoBtn').click(); } } },
        { id: 'context', title: 'Delete one mark', kind: 'do',
          body: 'There is a floor drain in the middle of the dining room, circled. There is no drain there.\n1. Press M (Move) so no tool is armed.\n2. Right-click the mark inside the circle.\n3. Click [[Delete]].\nThe same menu moves a mark to another counter or into a group.',
          target: ['#annCanvas'], page: P101, zones: () => guide([STRAY], 16, false).filter(() => K().markersOf(P101, null).some((m) => near(m, STRAY, 6))),
          check: () => { const c = counterNamed(/floor\s*drain/i); const a = pageAnn(P101); return !!c && !!a && !(a.counterMarkers[c.id] || []).some((m) => near(m, STRAY, 6)); },
          action: { label: 'Delete it for me', run: () => { const c = counterNamed(/floor\s*drain/i); const a = pageAnn(P101); if (!c || !a) return; App.pushUndoSnapshotCurrentPage(); a.counterMarkers[c.id] = (a.counterMarkers[c.id] || []).filter((m) => !near(m, STRAY, 6)); dirty(); } } },
        { id: 'details', title: 'Change a whole type at once', kind: 'do',
          body: 'The schedule calls these FD-1.\n1. In the left sidebar, click the pencil beside Floor Drain.\n2. Change the name to FD-1 Floor Drain.\n3. Click [[Done]].\nEvery mark, the Summary, the legend and the report follow. The same dialog changes the symbol and the colour.',
          target: ['#counterLineTypeDetailsModal .modal-card', '#countersList .edit-btn', '#countersSection'], check: () => !!counterNamed(/fd-?1/i),
          action: { label: 'Rename it for me', run: () => { const c = counterNamed(/floor\s*drain/i); if (!c) return; App.pushUndoSnapshot(); c.name = 'FD-1 Floor Drain'; dirty(); } } },
        { id: 'area', cardAt: 'tr', title: 'Clear an area', kind: 'do',
          body: 'The bar is out of your scope.\n1. In the header, click [[⋯]], then [[Delete area]].\n2. Drag a box around the two drains in the BAR: start and end inside the shaded boundary.\n3. The dialog says exactly what is inside. Confirm it.\nOne undo brings it all back.',
          target: ['#deleteZoneBtn', '#deleteZoneBtnSidebar', '#headerMoreBtn'],
          page: P101,
          zones: () => (barCleared() ? [] : [{ kind: 'box', inner: K().norm(BAR_FIXTURES), outer: K().grow(BAR, 14), done: false, label: 'Drag your box around the bar\'s two drains, inside here' }]),
          check: () => barCleared(),
          action: { label: 'Clear the bar for me', run: async () => { goPage(P101); const a = pageAnn(P101); if (!a) return; App.openDeleteZoneForRect(a, P101, BAR.x1, BAR.y1, BAR.x2, BAR.y2); await wait(250); if (modalUp('confirmModal') && el('confirmOk')) el('confirmOk').click(); await wait(150); } } },
      ],
      done: 'Undo, delete one, change a type, clear an area.\nMore: [Fixing mistakes](/guides/fixing-mistakes/).\nNext: [[Learn]] → Notes and questions.',
    },
    // 9 ---------------------------------------------------------------------------------
    {
      id: 'notes', title: 'Notes, questions and highlights', short: 'a drawing that remembers why', minutes: 2, page: P101,
      intro: 'What you noticed while counting is worth as much as the count. Notes, RFI flags and highlights keep it on the sheet.',
      seed() { setScale(P101, 9, '1/8" = 1\''); },
      steps: [
        { id: 'note', title: 'Leave a note', kind: 'do',
          body: '1. In the header, click [[⋯]], then [[Note]] (or press N).\n2. Click inside the circle in the kitchen.\n3. Type what you want to remember, such as Verify hood gas connection size.\nDrag a note to move it, drag its corner to resize it, double-click to edit it.',
          target: ['#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'], page: P101, zones: () => guide([NOTE_SPOT], 40, noteAt(NOTE_SPOT, 40)),
          check: () => noteAt(NOTE_SPOT, 40),
          hint: () => { const a = pageAnn(P101); return a && (a.notes || []).length && !noteAt(NOTE_SPOT, 40) ? 'That note is outside the circle. Drag it into the circle' : ''; },
          action: { label: 'Leave one for me', run: () => addNote(NOTE_SPOT, 'Verify hood gas connection size', '#e8c547') } },
        { id: 'rfi', title: 'Flag a question for the GC', kind: 'do',
          body: 'The grease interceptor is drawn outside the building and nothing says who excavates.\n1. Press N again.\n2. Click inside the circle beside the GI.\n3. Type RFI: and then the question.\nA note that starts with RFI: is a flag. Under EXPORT OPTIONS, [[Copy RFI Flags]] collects every flag across the set as one list.',
          target: ['#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          page: P101, zones: () => guide([RFI_SPOT], 40, noteAt(RFI_SPOT, 40, /^\s*RFI\s*:/i)),
          check: () => noteAt(RFI_SPOT, 40, /^\s*RFI\s*:/i),
          hint: () => { const a = pageAnn(P101); return a && (a.notes || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))) && !noteAt(RFI_SPOT, 40, /^\s*RFI\s*:/i) ? 'That flag is outside the circle. Drag it into the circle' : ''; },
          action: { label: 'Flag it for me', run: () => addNote(RFI_SPOT, 'RFI: Who excavates and sets the grease interceptor?', '#e85447') } },
        { id: 'highlight', title: 'Highlight an area', kind: 'do',
          body: '1. In the header, click [[⋯]], then [[Highlight]] (or press H).\n2. Drag a box over the grease interceptor (GI): start and end inside the shaded boundary.\nHighlights get names and a bookmark list, and Export PDFs can bundle just the highlighted sheets for whoever needs to look.',
          target: ['#highlightBtn', '#highlightBtnSidebar', '#headerMoreBtn'], page: P101,
          zones: () => [K().boxZone(rectsOf(P101, 'highlights'), GI_TANK, GI_OUTER, 'Drag your highlight over the GI, inside here')],
          hint: () => K().boxMiss(rectsOf(P101, 'highlights'), GI_TANK, GI_OUTER),
          check: () => K().boxZone(rectsOf(P101, 'highlights'), GI_TANK, GI_OUTER).done,
          action: { label: 'Highlight it for me', run: () => { goPage(P101); const a = App.ensureActiveCanvas(S().pages[P101]).annotations; if (!a.highlights) a.highlights = []; if (a.highlights.length) return; App.pushUndoSnapshotCurrentPage(); a.highlights.push(Object.assign({ color: '#e8c547', opacity: 0.25, id: App.uid() }, GI)); S().tool = App.TOOL.NONE; dirty(); } } },
        { id: 'ledger', title: 'Every note in one list', kind: 'read',
          body: '1. In the header, click [[Notes ledger]], the page icon with the count on it.\nIt lists every note on every sheet, RFI flags first, and a click takes you to the spot.\nMore: [Highlights, notes, and reading the bare drawing](/guides/annotating-and-reviewing/).',
          target: ['#notesLedgerBtn'], check: () => true },
      ],
      done: 'A note, a question for the GC, a highlight.\nNext: [[Learn]] → Check and prove.',
    },
    // 10 --------------------------------------------------------------------------------
    {
      id: 'check', title: 'Check the bid, prove the number', short: 'a number you can defend', minutes: 3, page: P101,
      intro: 'Before it goes out: what the app can check for you, what only you can sign, and where a number came from when someone asks.',
      seed() { seedBranch(); mark(P101, makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'), KITCHEN_FDS); },
      steps: [
        { id: 'open', title: 'Open Bid Check', kind: 'do',
          onEnter: () => K().foldBidCheck(), hold: true, body: 'The lesson chained three fixtures on 1/2in PEX and counted the kitchen drains.\n1. In the left sidebar, click BID CHECK to expand it.\nThe badge beside it counts what is still open. Rows marked AUTO are judged by the app. The rest are yours to tick.',
          target: ['#bidCheckSectionTitle'], check: () => S().bidCheckCollapsed === false,
          action: { label: 'Open it', run: () => { S().bidCheckCollapsed = false; if (App.renderBidCheck) App.renderBidCheck(); App.updateUI(); } } },
        { id: 'fix', title: 'Close an open row', kind: 'do',
          body: 'The row Hangers on every supported run is open: the PEX has no hanger rule.\n1. Under LINE TYPES, click the pencil beside 1/2in PEX.\n2. Under [[Child counts]], click [[Add]] on the suggested hanger.\n3. Click [[Done]].\nThe row turns to a tick by itself.',
          target: ['#childCountsSuggest', '#childCountsGroup', '#lineTypesList .edit-btn', '#lineTypesSectionTitle'],
          check: () => someLineType(/pex/i, (lt) => (lt.childCounts || []).length),
          action: { label: 'Add the hanger rule', run: () => { const lt = lineTypeNamed(/pex/i); if (!lt || (lt.childCounts || []).length) return; App.pushUndoSnapshot(); lt.childCounts = [hangerRuleFor(lt)]; dirty(); } } },
        { id: 'tick', title: 'Sign what only you can', kind: 'do',
          body: '1. In BID CHECK, click the words Scale verified on every counted sheet.\nYour ticks are saved with the bid. Hand off with a row still open and the app asks once, then remembers your answer until something changes. It never blocks you.',
          target: ['#bidCheckSection', '#bidCheckSectionTitle'], check: () => !!(S().bidCheck && S().bidCheck.manual && S().bidCheck.manual['scale-verified']),
          action: { label: 'Tick it for me', run: () => { const s = S(); s.bidCheck = s.bidCheck || { manual: {} }; s.bidCheck.manual = s.bidCheck.manual || {}; if (s.bidCheck.manual['scale-verified']) return; App.pushUndoSnapshot(); s.bidCheck.manual['scale-verified'] = true; s.bidCheckCollapsed = false; dirty(); } } },
        { id: 'proof', title: 'Where did that number come from?', kind: 'do', hold: true,
          body: '1. In the left sidebar, under SUMMARY, click the Floor Drain total.\nThe breakdown shows the count sheet by sheet with a thumbnail of where every mark sits, zones already applied. This is what you open when the number is questioned.',
          target: ['#summaryCountDetailModal .modal-card', '#summaryList .summary-item-clickable', '#summarySectionTitle'], check: () => modalUp('summaryCountDetailModal'),
          action: { label: 'Open the breakdown', run: () => { const c = counterNamed(/floor\s*drain/i); if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); } } },
        { id: 'legend', title: 'The legend on the sheet', kind: 'do', hold: true,
          body: '1. In the left sidebar, click the SUMMARY heading.\nSummary Legend sets how the on-sheet legend draws: a tally for plumbing, a compact ruled block (the way an E or M sheet draws its own) or the full block with every column. It follows the trade until you choose.',
          target: ['#legendSettingsModal .modal-card', '#summarySectionTitle'], check: () => modalUp('legendSettingsModal'),
          action: { label: 'Open Summary Legend', run: () => { if (App.openLegendSettingsModal) App.openLegendSettingsModal(); } } },
      ],
      done: 'Checked by the app, signed by you, provable on demand.\nNext: [[Learn]] → Deliverables.',
    },
    // 11 --------------------------------------------------------------------------------
    {
      id: 'deliver', title: 'Deliverables: report, PDFs, hand-off', short: 'the takeoff, handed over', minutes: 2, page: P101,
      intro: 'Four ways out of the app, all under EXPORT OPTIONS in the left sidebar. They appear once there is something to send.',
      seed() { const b = seedBranch(); b.pex.childCounts = [hangerRuleFor(b.pex)]; mark(P101, makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'), KITCHEN_FDS); },
      steps: [
        { id: 'report', title: 'The report', kind: 'read',
          body: '1. Under EXPORT OPTIONS, [[Show Report]] opens the full breakdown in a new tab: counts and lengths by type and by sheet, room volumes, the hangers under their pipe.\nIts menu scopes it: This sheet, or [[Everything]]. Print it or save it as a PDF from there.',
          target: ['#printReport', '#exportOptionsSectionTitle'], check: () => true },
        { id: 'pdfs', title: 'Marked-up plans', kind: 'do', hold: true,
          body: '1. Click [[Export PDFs]].\nChoose the sheets, set marker and line sizes for print, and decide whether the report and the highlighted or noted sheets ride along. The yellow printer in the header is the one-click version for the sheet you are on.',
          target: ['#specificPagesModal .modal-card', '#specificPages', '#exportOptionsSectionTitle'], check: () => modalUp('specificPagesModal'),
          action: { label: 'Open Export PDFs', run: () => { if (App.openSpecificPagesModal) App.openSpecificPagesModal(); else el('specificPages').click(); } } },
        { id: 'tooling', title: 'Hand it to the bid', kind: 'read',
          body: '1. [[Copy to /Tooling]] puts the takeoff on the clipboard, ready to paste into a bid in PipeTooling: fixtures, feet with the risers inside, hangers and fittings under their pipe. Its first line names exactly what was copied.\n2. [[Open in TakeoffTooling]] does the same for an electrical bid.\n3. [[Copy RFI Flags]] puts your questions beside it.',
          target: ['#forPipeTooling', '#exportOptionsSectionTitle'], check: () => true },
        { id: 'email', title: 'Or just the numbers', kind: 'read',
          body: '1. [[Copy Summary (Email/Text)]] is the same takeoff as plain text for an email. Totals are always decimal feet, whatever unit each sheet was scaled in.\nMore: [Reports and exports](/guides/reports-and-exports/).',
          target: ['#copySummaryText', '#exportOptionsSectionTitle'], check: () => true },
      ],
      done: 'A report, a marked-up set, a paste into the bid, an email.\nNext: [[Learn]] → Working faster.',
    },
    // 12 --------------------------------------------------------------------------------
    {
      id: 'speed', title: 'Working faster', short: 'the fast way round', minutes: 2, page: P101,
      intro: 'Every tool has a key, and the app will show you which. Two minutes that pay back on every sheet.',
      seed() { setScale(P101, 9, '1/8" = 1\''); },
      steps: [
        { id: 'map', title: 'The keyboard map', kind: 'do', hold: true,
          body: '1. In the status bar at the bottom right, click [[shortcuts]].\nEvery key on one picture: M Move, C Counter, L Line, P Polyline, T Chain, B Drop, D Measure, S Set Scale, X Multiply Zone, N Note, H Highlight, R Rotate, J Snap. The arrows move between sheets and layers.',
          target: ['#keyboardMapModal .modal-card', '#statusBarMacros'], check: () => modalUp('keyboardMapModal'),
          action: { label: 'Open it for me', run: () => { if (App.openKeyboardMapModal) App.openKeyboardMapModal(); } } },
        { id: 'rail', title: 'The zoom rail', kind: 'do', hold: true,
          body: '1. In the footer, click the zoom percentage.\nThe rail jumps between fixed zoom stops, so the sheet always lands on a magnification the app has already drawn and the jump is instant. [[Fit]] brings the whole sheet back. The wheel and a pinch zoom where the pointer is.',
          target: ['#zoomRail', '#zoomPct'], check: () => { const r = el('zoomRail'); return !!r && !r.hidden; },
          action: { label: 'Open the rail', run: () => { if (App.openZoomRail) App.openZoomRail(); else el('zoomPct').click(); } } },
        { id: 'rightclick', title: 'Right-click a tool', kind: 'read',
          body: 'Every tool button in the header answers a right-click with its own settings: Counter Settings on [[Counter]], line type settings on the line tools, the legend\'s on [[Summary legend]]. No hunting through menus.\nThe spacebar hides and shows the sidebar when you want the whole screen for the sheet.\nMore: [Working faster with the keyboard](/guides/working-faster-with-the-keyboard/) and [Takeoffs on a tablet](/guides/takeoff-on-a-tablet/).',
          target: ['#counterBtn', '#counterBtnSidebar'], check: () => true },
      ],
      done: 'Keys, the rail, right-click.\nNext: [[Learn]] → Saving and sharing.',
    },
    // 13 --------------------------------------------------------------------------------
    {
      id: 'cloud', title: 'Saving, sharing and your bids', short: 'the cloud half', minutes: 2, page: P101, readOnly: true,
      intro: 'Everything so far works signed out, saved on this device. Signing in adds the cloud. A lesson cannot run on a cloud project, so this one is a guided read.',
      seed() { setScale(P101, 9, '1/8" = 1\''); },
      steps: [
        { id: 'saved', title: 'How your work is saved', kind: 'read',
          body: 'The status bar at the bottom always says where your work is: saved on this device, or saved to the cloud, and when. Signed out, the app keeps a backup on this device every few seconds and offers it back the next time you open the app. Signed in, the same takeoff also saves to your account and opens on any device.\nThe whole story: [How your work is saved](/guides/how-your-work-is-saved/) and [Working offline and installing](/guides/working-offline-and-installing/).',
          target: ['#statusBar', '.status-bar'], check: () => true },
        { id: 'share', title: 'One editor at a time', kind: 'read',
          body: 'A shared project is checked out by one person at a time, so two estimators never overwrite each other. You check it out to edit and turn it in when you are done, and it turns itself in after thirty quiet minutes.\nA view link lets someone outside your company open the marked-up plan, measure on it, and nothing else.\nMore: [Sharing and view links](/guides/sharing-and-view-links/).',
          target: [], check: () => true },
        { id: 'bids', title: 'Your bids, and your standards', kind: 'read',
          body: 'All Bids shows every project you can reach with its status, and the bid chip in the header switches between recent ones. Your Artboard carries your counters, line types, Quick Keys and icons into every new bid, and Palette Insights shows which ones you actually use.\nMore: [Reviewing all bids](/guides/reviewing-all-bids/) and [Your palette, every bid](/guides/artboard-and-palette-insights/). Admins: [the admin handbook](/guides/admin-handbook/).',
          target: [], check: () => true },
      ],
      done: 'That is every part of the app.\nClick [[Upload PDF]] and start on a real sheet. The guides are always under Project Settings → Help.',
    },
  ];

  function addNote(spot, text, color) {
    goPage(P101);
    const page = S().pages[P101];
    const a = App.ensureActiveCanvas(page).annotations;
    if (!a.notes) a.notes = [];
    if (a.notes.some((n) => n.text === text)) return;
    App.pushUndoSnapshotCurrentPage();
    a.notes.push({ x: spot.x, y: spot.y, text, id: App.uid(), width: 150, fontSize: 14, placementRotation: page.rotation ?? 0, color });
    S().tool = App.TOOL.NONE;
    dirty();
  }

  // ----- progress, the menu, the doors ----------------------------------------------------------
  const tourId = (id) => 'lesson:' + id;
  function lessonsDone() { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}') || {}; } catch (_) { return {}; } }
  function markDone(id) { try { const d = lessonsDone(); d[id] = new Date().toISOString(); localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (_) { /* private mode: the tick is a convenience */ } }

  LESSONS.forEach((lesson, idx) => {
    const next = LESSONS[idx + 1];
    App.registerTour(tourId(lesson.id), {
      steps: [openStep(lesson)].concat(lesson.steps, [doneStep(lesson, lesson.done)]),
      doneKey: null,
      onStop(finished) {
        restoreDevice();
        if (!finished) return;
        markDone(lesson.id);
        openLearnMenu(next ? next.id : null);   // back to the list, the next lesson lit
      },
    });
  });

  // A lesson teaches two settings that live on the DEVICE, not the project: the sidebar
  // filter and Snap to 45°. It puts both back the way it found them when it stops, so a
  // lesson never changes how the reader's own bids behave. The three sidebar search boxes
  // (Counters, Line types, Lines: state + localStorage, per device) ride the same way: a
  // word typed on the last bid is cleared when the set opens, so every counter the lesson
  // makes is in the list, and typed back when the lesson stops.
  const SEARCHES = { counter: ['counterSearch', 'counterSearchInput'], lineType: ['lineTypeSearch', 'lineTypeSearchInput'], lines: ['linesSearch', 'linesSearchInput'] };
  const getSearches = () => { const out = {}; Object.keys(SEARCHES).forEach((k) => { out[k] = S()[SEARCHES[k][0]] || ''; }); return out; };
  function setSearches(values) {
    Object.keys(SEARCHES).forEach((k) => {
      const [field, inputId] = SEARCHES[k];
      const v = values[k] || '';
      S()[field] = v;
      try { if (v) localStorage.setItem(field, v); else localStorage.removeItem(field); } catch (_) { /* storage may be unavailable */ }
      if (el(inputId)) el(inputId).value = v;
    });
  }
  let deviceBefore = null;
  function rememberDevice() { deviceBefore = { scope: App.getCounterListFilterScope ? App.getCounterListFilterScope() : 'off', snap: !!(S().lineTypeSettings && S().lineTypeSettings.snapToHorizontalVertical), searches: getSearches() }; }
  function restoreDevice() {
    if (!deviceBefore) return;
    if (App.getCounterListFilterScope && App.getCounterListFilterScope() !== deviceBefore.scope) App.setCounterListFilterScope(deviceBefore.scope);
    if (!!(S().lineTypeSettings && S().lineTypeSettings.snapToHorizontalVertical) !== deviceBefore.snap && el('lineTypeSnapToHVHeaderBtn')) el('lineTypeSnapToHVHeaderBtn').click();
    setSearches(deviceBefore.searches || {});
    deviceBefore = null;
    App.updateUI();
  }
  function startLesson(id) {
    const lesson = LESSONS.find((l) => l.id === id);
    if (!lesson) return false;
    if (App.hideModal) App.hideModal('learnModal');
    sawMarksHidden = false; extraSeen = false; seededFor = null; openingFor = null;
    rememberDevice();
    return App.startTutorial(tourId(id));
  }
  function renderLearnList(nextId) {
    const list = el('learnList');
    if (!list) return;
    const done = lessonsDone();
    const count = LESSONS.filter((l) => done[l.id]).length;
    const esc = App.escapeHtml || ((t) => String(t));
    list.innerHTML = LESSONS.map((l, i) => '<button type="button" class="learn-row' + (done[l.id] ? ' learn-row-done' : '') + (l.id === nextId ? ' learn-row-next' : '') + '" data-lesson="' + l.id + '">'
      + '<span class="learn-row-no">' + (done[l.id] ? '✓' : (i + 1)) + '</span>'
      + '<span class="learn-row-text"><span class="learn-row-title">' + esc(l.title) + '</span><span class="learn-row-sub">' + esc(l.intro) + '</span></span>'
      + '<span class="learn-row-min">' + l.minutes + ' min' + (l.readOnly ? ' · read' : '') + '</span></button>').join('');
    const prog = el('learnProgress');
    if (prog) prog.textContent = count === LESSONS.length ? 'All ' + LESSONS.length + ' lessons done' : count + ' of ' + LESSONS.length + ' done';
    list.querySelectorAll('.learn-row').forEach((row) => { row.onclick = () => startLesson(row.dataset.lesson); });
    const lit = list.querySelector('.learn-row-next');
    if (lit && lit.scrollIntoView) lit.scrollIntoView({ block: 'nearest' });
  }
  // courseNext: a course (features/course-plumbing.js) handing back to the menu names the
  // chapter to light; the menu then scrolls to the course. Undefined leaves the course's
  // own suggestion (its first unfinished chapter).
  // courseNext: a course handing back to the menu names itself and the chapter to light,
  // { course, chapter }; the menu renders every registered course section
  // (App.courseSections, each { id, render(nextChapterId) }) and scrolls to that one.
  function openLearnMenu(nextId, courseNext) {
    const done = lessonsDone();
    const suggested = nextId === undefined ? ((LESSONS.find((l) => !done[l.id]) || {}).id || null) : nextId;
    renderLearnList(suggested);
    (App.courseSections || []).forEach((sec) => sec.render(courseNext && courseNext.course === sec.id ? courseNext.chapter : undefined));
    App.showModal('learnModal');
    if (courseNext) { const rule = el('learnCourseRule-' + courseNext.course); if (rule && rule.scrollIntoView) rule.scrollIntoView({ block: 'start' }); }
    return true;
  }

  // wiring (static DOM)
  el('canvasEmptyHintLearn') && (el('canvasEmptyHintLearn').onclick = (e) => { e.preventDefault(); openLearnMenu(); });
  el('settingsLearn') && (el('settingsLearn').onclick = () => { App.hideModal('settingsModal'); openLearnMenu(); });
  ['plumbing', 'electrical', 'hvac'].forEach((t) => { const b = el('learnTour-' + t); if (b) b.onclick = () => { App.hideModal('learnModal'); App.startTutorial(t); }; });
  // /app/?learn=1 opens the menu; /app/?lesson=<id> starts that lesson (the guides' "Try it").
  try {
    const params = new URLSearchParams(location.search);
    const want = params.get('lesson');
    if (want && LESSONS.some((l) => l.id === want)) {
      App.setTutorialPending(true);   // the boot's restore offer waits, as it does for ?tour=
      setTimeout(() => { App.setTutorialPending(false); startLesson(want); }, 600);
    } else if (params.get('learn')) {
      App.setTutorialPending(true);
      setTimeout(() => { App.setTutorialPending(false); openLearnMenu(); }, 600);
    }
  } catch (_) { App.setTutorialPending && App.setTutorialPending(false); }

  App.openLearnMenu = openLearnMenu;
  App.startLesson = startLesson;
  App.lessonIds = () => LESSONS.map((l) => l.id);
  App.lessonsDone = lessonsDone;
  // What a COURSE needs to run on the lesson set (features/course-plumbing.js): the sheets'
  // geometry, the readers, the seeding and marking helpers, the open and done steps, and
  // the device bookkeeping a lesson does around a run. Read at call time, never captured.
  App.lessonKit = {
    SET_NAME, LESSON_SET, P101, P401, P501, P601, P, FD, KITCHEN_FDS, BAR, STRAY, LAVS, MOP, WCS, HAND_SINKS, GAS_MAIN, GI, NOTE_SPOT, RFI_SPOT, DETAIL,
    pageAnn, onPage, isSetOpen, counterNamed, lineTypeNamed, lineTypesMatching, someLineType, isStanding: (id) => standing.has(id), marksOf, scaleIs, inRect, near, modalUp, measured,
    dirty, goPage, setScale, makeCounter, makeLineType, mark, measure, arm, hangerRuleFor, addNote, openStep, doneStep,
    beginTeaching() { sawMarksHidden = false; extraSeen = false; seededFor = null; openingFor = null; rememberDevice(); },
    restoreDevice,
  };
})();
