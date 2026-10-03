/*
 * features/lessons.js - Learn: Start here, a four-minute uncounted opener (LEARN-START), and
 * thirteen short lessons, one per part of the app, on the
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
 * over a teaching set (the last lesson's sheets, a tour's sample plan) it just resets
 * (the tourKit's `leaveForTeachingSet`, shared with the tours). Palette items a lesson makes carry
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
 * Registrations: openLearnMenu(), startLesson(id), lessonIds(), lessonsDone(), courseDone(), syncStartHere()
 * (the empty canvas's Start here card, for a device that has finished nothing)
 * (every course's progress, one map; R16), and lessonKit (what a course runs on: its runner,
 * registerCourse, and the helpers the three courses used to copy; R15).
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // The sample SETS the teaching runs on. The lessons and the plumbing course run on the
  // lesson set; a course may name another (`lesson.set`, features/course-electrical.js runs
  // on the electrical set). A set the teaching opened is reset, never asked about, when the
  // next lesson opens; the reader's own plan always goes through Close project. Which projects
  // are teaching sets is ONE list, the tourKit's TEACHING_SETS (features/tutorial.js,
  // MAP-TOUR-SHEET), and so is the reset-or-close (`leaveForTeachingSet`).
  const LESSON_SET = { url: '/samples/sample-lessons.pdf', name: 'sample-lessons', pages: 4, trade: 'plumbing', word: 'four' };
  const setOf = (lesson) => (lesson && lesson.set) || LESSON_SET;
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
  const lineTypeUsed = (l) => (S().pages || []).some((p) => { const a = App.getActiveAnnotations(p); return !!a && (a.polylines || []).concat(a.quickLines || []).some((ln) => ln.lineTypeId === l.id); });
  const lineTypeNamed = (re) => named(S().lineTypes, re, S().activeLineTypeId, lineTypeUsed);
  // Every line type a step's word names: a reader whose own palette already has "4in PVC" sees two
  // after the chapter seeds its own, and a run or a setting on either is the step done (by hand,
  // 2026-09-25: the stack traced with the reader's own 4in PVC read "0 of 2 done").
  const lineTypesMatching = (re) => (S().lineTypes || []).filter((l) => re.test(l.name || ''));
  const someLineType = (re, pred) => lineTypesMatching(re).some((l) => { try { return !!pred(l); } catch (_) { return false; } });
  // A counter the reader MADE in this lesson: a "make a counter" step never passes on the standing
  // palette's "Floor Drain 4in" before the reader has typed a letter (by hand, 2026-09-25).
  const madeCounterNamed = (re) => (S().counters || []).find((c) => !standing.has(c.id) && re.test(c.name || ''));
  // The line type a step's word names that carries the reader's runs: a reader whose palette already
  // had "1/2in PEX" chained with their own, and the hanger rule on the lesson's unused twin counted
  // nothing (by hand, 2026-09-25). The lesson's own when both carry runs or neither does.
  const usedLineType = (re) => { const used = lineTypesMatching(re).filter(lineTypeUsed); return used.find((l) => l.lesson) || used[used.length - 1] || lineTypeNamed(re); };
  // Every counter a step's word names, for circles that take a mark from either twin.
  const countersMatching = (re) => (S().counters || []).filter((c) => re.test(c.name || '')).map((c) => c.id);
  const marksOf = (c) => (c ? K().markCount(c.id) : 0);
  const scaleIs = (i, ppu) => { const sc = App.getPageScale && App.getPageScale(i); return !!sc && Math.abs(sc.pixelsPerUnit - ppu) < 0.05; };
  const inRect = (pt, r) => pt.x >= r.x1 && pt.x <= r.x2 && pt.y >= r.y1 && pt.y <= r.y2;
  const near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) <= d;
  const modalUp = (id) => { const m = el(id); return !!m && m.classList.contains('visible'); };
  // The SUMMARY breakdown open on THIS counter: the proof steps passed on any row's, the first
  // (Lavatory) included, though every card names one total (PERSONA-PASS prober).
  const detailTitle = () => String((el('summaryCountDetailTitle') || {}).textContent || '').trim();
  const detailOpenFor = (c) => modalUp('summaryCountDetailModal') && !!c && detailTitle() === (c.name || 'Counter') + ' by page';
  const detailMiss = (c) => (modalUp('summaryCountDetailModal') && c && !detailOpenFor(c) ? { code: 'wrong-item', text: 'That is ' + detailTitle() + '. Close it and click the ' + c.name + ' total' } : '');
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
  // Lesson 0's one click: P-101's title block, in sheet points (scripts/sample-plan-candidates.js
  // titleBlock: the 812-1204 x 640-772 box), the circle on its SHEET cell, where P-101 is printed.
  const TB = { x: 1140, y: 748 };
  const TB_NAME = 'Title block';
  const tbCounter = () => (S().counters || []).find((c) => c.lesson && c.name === TB_NAME);
  // a plain dot, not the palette's default water closet: the title block is no fixture
  const tbIcon = () => { const i = (App.getOrderedIcons() || []).find((x) => x.name === 'Circle'); return i ? { icon: i.value } : {}; };
  const makeTbCounter = () => makeCounter(TB_NAME, null, '#f97316', tbIcon());
  // Lesson 0's undo card: what the sheet holds now, and what the card has seen since it opened.
  const TB_MISS = { x: 1020, y: 700 };   // a spot on the title block, well outside the circle (the seam's mistake)
  let tryLatch = { stray: false, undone: false };
  // the reader's own key: Cmd+Z on a Mac, Ctrl+Z elsewhere (a card that prints both makes the reader choose)
  // a tablet or phone has no keys: the card sends its reader to the footer's Undo alone (the engine
  // drops a step that starts "Press" on touch, which would leave this card with no way to undo)
  const onTouch = () => { try { return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 768px)').matches; } catch (_) { return false; } };
  const undoKey = () => { try { return /Mac|iPhone|iPad/.test(navigator.platform || '') ? 'Cmd+Z' : 'Ctrl+Z'; } catch (_) { return 'Ctrl+Z'; } };
  function tryState() {
    const c = tbCounter();
    const zs = c ? circlesFor(P101, c, [TB], 26) : [];
    const strayNow = c ? K().strayMarks(P101, c.id, zs) > 0 : false;
    if (strayNow) tryLatch.stray = true;
    else if (tryLatch.stray) tryLatch.undone = true;   // the mistake was there, and is gone
    return { inside: K().allDone(zs), strayNow };
  }
  function tryProgress() {
    const t = tryState();
    if (t.strayNow) return 'That is the mistake. Now ' + (onTouch() ? 'tap Undo in the footer' : 'press ' + undoKey()) + ' to undo it';
    if (!tryLatch.stray) return t.inside ? 'That one counts. Now the mistake: click outside the circle' : 'Click outside the circle first';
    const left = App.getUndoDepth ? App.getUndoDepth() : null;
    return t.inside ? '' : 'Undone' + (left == null ? '' : ', ' + left + (left === 1 ? ' undo left' : ' undos left')) + '. Now click inside the circle';
  }
  // The line beside Show me where, red for the one miss left on this card: a click with the counter
  // put down (M, or another tool), which places nothing. A mark outside the circle is the card's step 1.
  function tbHint() {
    const c = tbCounter();
    if (!c) return '';
    const k = K().lastSheetClick && K().lastSheetClick();
    const armed = S().tool === App.TOOL.COUNTER && S().activeCounterType === c.id;
    if (k && k.page === P101 && !armed && K().inCircle(k, { x: TB.x, y: TB.y, r: 26 })) return { code: 'not-armed', text: 'The counter is put down, so that click placed nothing. Under COUNTERS, click Title block, then click again' };
    return '';
  }
  const BAR_FIXTURES = { x1: 60 + 0.75 * 160, y1: 70 + 0.75 * 530, x2: 60 + 0.75 * 360, y2: 70 + 0.75 * 592 };
  const GI_TANK = { x1: 60 + 0.75 * 965, y1: 70 + 0.75 * 520, x2: 60 + 0.75 * 1021, y2: 70 + 0.75 * 554 };   // the interceptor's own rectangle
  const GI_OUTER = { x1: GI.x1 - 40, y1: GI.y1 - 40, x2: GI.x2 + 60, y2: GI.y2 + 40 };
  // the committed runs, plus the corners of the trace in progress so the circles tick as the reader goes
  const gasPaths = (live) => { const a = pageAnn(P101); const d = S().drawingPolyline; return ((a && a.polylines) || []).map((pl) => pl.points || []).concat(live && d && d.points ? [d.points] : []); };
  const meterDrop = () => { const a = pageAnn(P101); const z = { x: GAS_MAIN[0].x, y: GAS_MAIN[0].y, r: 15 }; return !!a && (a.polylines || []).some((l) => { const p = l.points || []; if (!p.length) return false; return ((l.startDrop || 0) > 0 && K().inCircle(p[0], z)) || ((l.endDrop || 0) > 0 && K().inCircle(p[p.length - 1], z)); }); };
  const kitchenGroup = () => (S().groups || []).find((x) => /kitchen/i.test(x.name || ''));
  const kitchenKept = () => { const a = pageAnn(P101); const all = a ? Object.values(a.counterMarkers || {}).reduce((l, ms) => l.concat(ms || []), []) : []; return KITCHEN_FDS.every((k) => all.some((m) => near(m, k, 6))); };
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

  // ----- what the courses share (R15): lessonKit's helpers for features/course-*.js ----------------
  // Every course set sits on P-101's shell (the electrical and HVAC plans too), and a course's point
  // lists are FLAT (x, y, x, y…) so teaching-labels.test.js reads no nested pairs: `pts` turns a flat
  // list of plan points into sheet points, `raw` a flat list already in sheet points, and `planFeet`
  // measures a flat plan list at the figures' 12 px/ft.
  const pts = (flat) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push(P(flat[i], flat[i + 1])); return out; };
  const raw = (flat) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] }); return out; };
  const planFeet = (flat) => { let px = 0; for (let i = 2; i + 1 < flat.length; i += 2) px += Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]); return px / 12; };
  // Marks a counter at the spots it does not yet cover, so a seam run twice adds nothing. P-101 (the
  // first sheet of every set) unless a page is named.
  function markMissing(c, spots, pageIdx) {
    const i = pageIdx == null ? P101 : pageIdx;
    const a = App.ensureActiveCanvas(S().pages[i]).annotations;
    const have = (a.counterMarkers[c.id] || []);
    const todo = spots.filter((pt) => !have.some((m) => near(m, pt, 4)));
    if (todo.length) mark(i, c, todo);
    return todo.length;
  }
  // A rise or fall of `ft` on the line end nearest `spot`, through the Drop tool's own commit.
  function dropAt(spot, ft, pageIdx) {
    const a = pageAnn(pageIdx == null ? P101 : pageIdx); if (!a) return;
    const nodes = App.collectDropNodes(a, 1) || [];
    let best = null, d = Infinity;
    nodes.forEach((n) => { const dd = Math.hypot(n.x - spot.x, n.y - spot.y); if (dd < d) { d = dd; best = n; } });
    if (!best || !App.applyDropToNode(a, best, ft, 'ft', true)) return;
    App.pushUndoSnapshotCurrentPage();
    App.applyDropToNode(a, best, ft, 'ft');
    App.pushRecentDrop(ft, 'ft');
    dirty();
  }
  // Bid Check expanded, and a manual row ticked. features/bid-check.js publishes no writer for the
  // tick (the row's own click toggles it inline), so the kit writes the same field; a row already
  // ticked stays ticked, where the row's click would clear it.
  function openBidCheck() { S().bidCheckCollapsed = false; if (App.renderBidCheck) App.renderBidCheck(); App.updateUI(); }
  function tickManual(id) {
    const s = S();
    s.bidCheck = s.bidCheck || { manual: {} };
    s.bidCheck.manual = s.bidCheck.manual || {};
    if (s.bidCheck.manual[id]) return;
    App.pushUndoSnapshot();
    s.bidCheck.manual[id] = true;
    s.bidCheckCollapsed = false;
    dirty();
  }
  // The reader's feet by line type, read off the same summary Copy to /Tooling copies (a run inside
  // a group is prefixed with the group in brackets), and the sum over every type a word names.
  function readerFeet() {
    const out = {};
    String(window.getPipeToolingSummary ? window.getPipeToolingSummary() : '').split('\n').forEach((line) => {
      const m = /^(?:\[.*?\]\s*)?ft of (.+?)\t([\d.]+)/.exec(line);
      if (m) out[m[1]] = Number(m[2]);
    });
    return out;
  }
  const feetFor = (re, exclude) => { const f = readerFeet(); let n = 0; Object.keys(f).forEach((name) => { if (re.test(name) && !(exclude && exclude.test(name))) n += f[name]; }); return n; };
  // A Prove it step's proof (the tourKit's measureProof: the span, a circle that ticks as its click
  // lands, the hint that names the miss), built once per key on first use, since the kit is read at
  // call time. Keys are namespaced by their owner: 'lesson:…', '<course>:…'.
  const proofs = {};
  const memoProof = (key, make) => proofs[key] || (proofs[key] = K().measureProof(make()));

  // The Scale lesson's proof: the 12'-0" string over WOMEN.
  const proveP401 = () => memoProof('lesson:P401', () => ({ page: P401, ends: DETAIL.prove, r: 16, ft: 12, tol: 0.4, stated: '12\'-0"' }));
  // Prove the zone takes the same proof, so its circles tick as each click lands and a 4'-0" read
  // off somewhere else on the sheet does not pass (by hand, 2026-09-25).
  let zoneEntryMeasure = null;   // the measure standing when Prove the zone opened
  const proveZoneP401 = () => memoProof('lesson:P401zone', () => ({ page: P401, ends: DETAIL.proveZone, r: 12, ft: 4, tol: 0.25, stated: '4\'-0"' }));
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
  // Remove palette items (counters and line types) by test, and the Quick Keys bound to them.
  function dropFromPalette(test) {
    const s = S();
    const gone = new Set();
    s.counters = (s.counters || []).filter((c) => { if (test(c)) { gone.add(c.id); return false; } return true; });
    s.lineTypes = (s.lineTypes || []).filter((l) => { if (test(l)) { gone.add(l.id); return false; } return true; });
    Object.keys(s.numberKeyBindings || {}).forEach((slot) => { if (gone.has(s.numberKeyBindings[slot].id)) delete s.numberKeyBindings[slot]; });
    return gone.size;
  }
  const paletteIds = () => (S().counters || []).map((c) => c.id).concat((S().lineTypes || []).map((l) => l.id));
  function sweepLessonPalette() {
    dropFromPalette((x) => x.lesson);   // the last lesson's own items
    beginTeachingPalette();
  }
  // A lesson, course or tour opening its sheets: whatever was made on the last teaching sheets goes,
  // and the palette standing now is the one the sweep will leave alone (the FIRST one, when a lesson
  // follows a lesson: the reader's own, not the last lesson's).
  function beginTeachingPalette() {
    const made = new Set(track ? track.made : []);
    if (made.size) dropFromPalette((x) => made.has(x.id));
    standing = track ? new Set(track.standing) : new Set(paletteIds());
    track = { standing: [...standing], made: [] };
    opening = true;
    settle = { page: null, at: 0 };
    saveTrack();
  }

  // LEARN-LEAK (the owner's call, 2026-09-25: sweep all of it). Every counter and line type added
  // to the palette while a lesson's sheets are open, by the lesson or by the reader's own + Add,
  // Quick or Create tab, leaves with the sheets: when the open plan stops being a lesson set (the
  // reader uploads or loads their own, or closes the project), the ones MADE meanwhile are removed.
  // Only those ids, recorded as they appear: loading a cloud project replaces the palette with its
  // own, which is never touched, and neither is the palette that stood when the sheets opened. The
  // record rides localStorage so a reload mid-lesson still sweeps on the way out. Before this, a
  // reader's "HB Hose Bibb" and "1.5in Copper" rode into their next real bid (by hand, 2026-09-25),
  // and the lesson's own items did too until another lesson opened.
  const TRACK_KEY = 'clickcount-lesson-palette';
  let track = (() => { try { return JSON.parse(localStorage.getItem(TRACK_KEY) || 'null'); } catch (_) { return null; } })();
  // A set on its way in is not a set being left: the reset before it has no name, and Trim your set
  // rebuilds the pages under "Untitled" once the set's name is already up (seen, 2026-09-25). The set
  // is IN once it has settled, the moment seedIfReady lays the lesson's seed (seededFor).
  let opening = false;
  let settle = { page: null, at: 0 };
  // The sheets the palette is watched on: the lesson and course sets, the blank tour's sheet, and the
  // five-minute tours' sample plan; every teaching set but the engineered sample plan (the tourKit's
  // TEACHING_SETS, `palette`). Read at call time: the kit registers before this file, never captured.
  const isTrackedSet = (name) => K().TEACHING_SETS.some((t) => t.palette && t.name === name);
  // After a reload mid-lesson the boot shows no plan at all while it offers to restore one; only a
  // plan that is not a set, or a set left again, counts as leaving.
  let fromStorage = !!track;
  function saveTrack() { try { if (track) localStorage.setItem(TRACK_KEY, JSON.stringify(track)); else localStorage.removeItem(TRACK_KEY); } catch (_) { /* private mode: this session still sweeps */ } }
  function syncLessonPalette() {
    if (!track) return;
    const name = S().currentProjectName || '';
    if (name) fromStorage = false;
    if (isTrackedSet(name)) {
      // IN once settled: the lesson laid its seed, or (a tour has none) the first sheet is drawn, no
      // Trim your set is up, and it has stayed so for half a second, the lessons' own settle test
      const first = S().pages && S().pages[0];
      if (seededFor && seededFor === openingFor) opening = false;
      else if (opening && first && first.pdfPage && !modalUp('preparePdfModal')) {
        if (settle.page !== first) settle = { page: first, at: Date.now() };
        else if (Date.now() - settle.at >= 500) opening = false;
      } else settle = { page: null, at: 0 };
      const had = new Set(track.standing.concat(track.made));
      const fresh = paletteIds().filter((id) => !had.has(id));
      if (fresh.length) { track.made = track.made.concat(fresh); saveTrack(); }
      return;
    }
    if (opening || fromStorage || !App.bootSettled) return;
    const made = new Set(track.made);
    track = null;
    saveTrack();
    const n = dropFromPalette((x) => x.lesson || made.has(x.id));
    if (n && App.showToast) App.showToast('Removed ' + n + (n === 1 ? ' counter or line type' : ' counters and line types') + ' made in the lesson or tour. Your own palette is as it was.', 5000);
  }
  // A PDF with several sheets goes through Trim your set (Prepare PDF) like any upload.
  // The Sheets lesson leaves that dialog to the reader, because it IS the lesson; every
  // other lesson presses its Open for them.
  async function openSheetsFor(lesson) {
    if (modalUp('preparePdfModal')) { el('preparePdfDone').click(); return; }
    // a teaching set is reset; their own plan goes through the app's one Close project, which asks first
    if (!(await K().leaveForTeachingSet('lesson'))) return;
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
  // The open card is there to say one thing: this runs on sample sheets, and nothing done on them
  // touches the reader's own work. By default it opens on the lesson's `intro` and closes on that
  // promise. The intro is also the row's subtitle in Learn, so a reader who came from the menu has
  // just read it: a lesson that gives an `opener` gets a card that is the opener and the one action,
  // nothing repeated (Start here does; Will, 2026-09-27).
  const trimUp = () => { const m = el('preparePdfModal'); return !!m && m.classList.contains('visible'); };
  const openStep = (lesson) => ({
    id: 'sheets', title: lesson.openerTitle || lesson.title, kind: 'do', titleAlign: lesson.openerTitle ? 'center' : undefined,
    // an opener card has one button and nothing else to do, so it does not say "click it" (Will, 2026-09-27)
    // A lesson that goes through Trim your set by hand (Sheets) is a card in two states: the opener and
    // its button, then, with the dialog up, what the dialog is and the one click it wants. Until the card
    // pass the second state was written ahead of time, as a lone numbered paragraph about a dialog not
    // yet on screen, and the card's own button stayed up over it. Save & open exists only signed in.
    body: () => (lesson.trimByHand && trimUp()
      ? 'This is Trim your set. It opens for any PDF, a drawing file, with three sheets or more.\nIt is where a 120-sheet set, the whole stack of drawings, becomes the 9 you are bidding.\n1. Keep all ' + (setOf(lesson).word || 'four') + ', and click [[Open]].' + (S().supabaseSession ? '\nClick Open, not Save & open, so the sample stays out of your saved projects.' : '')
      : (lesson.opener || lesson.intro) + (lesson.opener ? '' : '\n1. Click [[Open the lesson sheets]] below.') + (lesson.opener ? '' : '\nThe ' + (lesson.noun || 'lesson') + ' brings its own ' + (setOf(lesson).word || 'four') + ' sample sheets and whatever it takes for granted, already on them. Nothing here touches your projects.')),
    // Trim your set's Open when it is up, else nothing: lighting the header's Upload PDF sent a reader to
    // a file picker with no lesson PDF in it, the card's own button being the door (PERSONA-PASS)
    target: ['#preparePdfDone'],
    check: () => { seedIfReady(lesson); return isSetOpen(lesson) && seededFor === lesson.id; },
    handsOff: true,   // fetching the sample sheets is the app's job: this step's button does it
    action: { label: 'Open the lesson sheets', run: () => openSheetsFor(lesson), show: () => !trimUp() },   // pressed, it goes: the dialog is the next click
  });
  const doneStep = (lesson, body) => ({ id: 'done', title: 'That is ' + lesson.short, kind: 'read', body, target: [], check: () => true });

  // ===== the lessons =======================================================================
  // The card text is written for anyone at all (COURSE-LANGUAGE-2026-09-27, option C): every trade and
  // app word glossed at its first use in each lesson, a doing step led by its steps, no sentence over 25 words.
  let sawMarksHidden = false, sawFilterOn = false, extraSeen = false, p501Label = null;
  // A right-click on the sheet is a long press on a tablet (app.js sends the same contextmenu event after 500 ms).
  const RC = () => (onTouch() ? 'Touch and hold' : 'Right-click');

  const LESSONS = [
    // 0 ---------------------------------------------------------------------------------
    // Start here (LEARN-START, 2026-09-27): the Learn guide as a four-minute opener, for a reader
    // who has never opened the app. Uncounted like a course's Chapter 0 (row 0, out of "N of 13
    // done"); the empty canvas of a device that has finished nothing offers only this.
    // Where things are is one card per part of the screen, so Next moves the light.
    {
      id: 'start', title: 'Start here', short: 'the lay of the land', minutes: 4, page: P101,
      intro: 'Four minutes for anyone new. What this app is, where things sit on the screen, and one real click on a sample sheet. Then pick your path.',
      // The open card and the old What this is card are one (Will, 2026-09-27): the text, then the button.
      openerTitle: 'CountTooling is a takeoff tool.',
      opener: 'A "takeoff" is the step where you go through a job\'s plans and list every material and quantity you\'ll need. This is the count and measurement of every fixture (like sinks and drains) and the measurements of every pipe connecting them.\nPlans come in the form of PDF sheets. This app makes it easy to generate a takeoff by clicking around, we will show you with P-101, the plumbing plan of a small restaurant.',
      seed() { makeTbCounter(); },
      steps: [
        { id: 'header', title: 'The header, the bar across the top', kind: 'read',
          // the last line is the one place the cards say their names can be clicked: every card after relies on it
          body: () => 'It holds the tools, such as [[Set Scale]], [[Counter]] and [[Measure]].\nThe tools that do not fit sit behind [[⋯]].' + (onTouch() ? '' : '\nMost tools have a one-key shortcut. Click [[shortcuts]], at the bottom right of the screen, to see every key.') + '\nClick a name on any card, and the app lights up the real one.',
          target: ['.header'], check: () => true },
        { id: 'sidebar', title: 'The sidebar, the lists down the left', kind: 'read',
          // in the order the sidebar has them; the last three sit under the fold of a laptop screen
          body: 'PAGES lists the sheets. COUNTERS are the things you count, one named tally each. LINE TYPES are the kinds of pipe you measure, by size and material.\nFurther down: a bid is your price for a job, and BID CHECK lists what a bid must answer before it goes out.\nSUMMARY keeps the running totals, and EXPORT OPTIONS makes the files you send out.',
          target: ['.sidebar'], check: () => true },
        { id: 'bottom', title: 'Under the sheet: the footer and the status bar', kind: 'read',
          body: 'The {{footer|.page-zoom-row}} comes first. It {{turns the pages|.page-nav}} and {{zooms in and out|.zoom-bar}}.\nThe {{status bar|.status-bar}} is the strip below it, along the very bottom. It says {{where your work is saved|#statusMode}}, and when.',
          target: ['.page-zoom-row', '.status-bar'], lightAll: true, check: () => true },
        // Undo, taught by making the mistake (Will, 2026-09-27): a mark outside the circle, Ctrl+Z, then the
        // mark that counts. The card wants all three, in any order the reader finds them: `tryLatch` holds
        // what it has seen since the card opened.
        { id: 'try', title: 'Make a mistake, then undo it', kind: 'do', hold: true,   // the ✓ waits for Next
          body: () => 'Every click on the sheet now places a mark.\n1. Click outside the orange circle. That mark is your mistake.\n2. ' + (onTouch() ? 'Tap [[Undo]] in the footer to undo it.' : 'Press ' + undoKey() + ' to undo it, or click [[Undo]] in the footer.') + '\n3. Click inside the circle.\nThe app keeps your last 50 moves, and each undo says how many are left.',
          // the Title block row is named too, so the card keeps off it: the not-armed line sends the reader there.
          // And the footer's Undo, which step 2 asks for: the card sat on it at 1280 x 720 (the card pass)
          target: () => ['#annCanvas', '#countersList [data-counter-id="' + idOf(tbCounter()) + '"]', '#undoBtn'], page: P101,
          onEnter: () => { tryLatch = { stray: false, undone: false }; const c = tbCounter(); if (c) arm(c); },
          zones: () => circlesFor(P101, tbCounter(), [TB], 26),
          check: () => { const t = tryState(); return t.inside && !t.strayNow && tryLatch.stray && tryLatch.undone; },
          progress: () => tryProgress(),
          hint: () => tbHint(),
          action: { label: 'Do it for me', run: async () => {
            const c = tbCounter() || makeTbCounter();
            goPage(P101); arm(c);
            if (!tryLatch.undone) {
              App.pushUndoSnapshotCurrentPage(); mark(P101, c, [TB_MISS]); dirty(); tryState();
              await wait(60);
              el('undoBtn').click(); tryState();
              await wait(60);
            }
            if (!tryState().inside) { App.pushUndoSnapshotCurrentPage(); mark(P101, c, [TB]); arm(c); dirty(); }
          } } },
        { id: 'paths', title: 'Pick your path', kind: 'read',
          body: 'Three ways on from here, all under [[Learn]].\nA tour: five minutes, one small takeoff in your trade, start to finish.\nThe thirteen lessons: two or three minutes each, one part of the app at a time.\nA course: about ninety minutes that teach the trade itself, off an engineer\'s drawings.\nLearn is on the empty screen, and under Project Settings, the gear in the header: open Help, then lessons.\nWhen this lesson ends, Learn opens with the tours at the top.',
          target: ['#settingsGearBtn', '#sidebarLogoGear'], check: () => true },
        { id: 'words', title: 'The words', kind: 'read',
          body: 'A card says what a word means the first time it uses it.\nOn a later card the word wears a dotted underline. Click it, and its meaning opens under the card\'s text.\nForgot one? Type it in the box at the top of [[Learn]], and its meaning comes up.\nThe whole list is Words the cards use, in the guide [Learn CountTooling by doing](/guides/learning-the-app/).',
          target: [], check: () => true },
      ],
      done: 'What this is, where things are, and how to undo a mistake.\nNext: [[Learn]] → a tour, a lesson or a course.',
    },
    // 1 ---------------------------------------------------------------------------------
    {
      id: 'plans', title: 'Sheets: find, turn and name them', short: 'a plan set under control', minutes: 2, page: P101, trimByHand: true,
      intro: 'A bid set, the drawings a job is priced from, runs to many sheets: some scanned sideways, most badly named. Two minutes on getting around one.',
      // the open card's own numbered step (openStep, trimByHand) says to keep all four and click Open
      opener: 'These are four sample sheets of a small restaurant. Nothing you do on them touches your projects.',
      seed() { setScale(P101, 9, '1/8" = 1\''); mark(P101, makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'), [FD.kitchen1, FD.kitchen2]); p501Label = S().pages[P501].label; },
      steps: [
        { id: 'jump', title: 'Go to a sheet', kind: 'do',
          body: '1. In the left sidebar, the column of lists on the left, under PAGES, click the third sheet, P-501.\nThe {{arrows under the sheet|.page-nav}} step through the set, one sheet at a time (or press the left and right arrow keys).',
          target: ['#pagesList', '#pagesSectionTitle'], check: () => onPage(P501),
          action: { label: 'Go to P-501', run: () => goPage(P501) } },
        { id: 'rotate', title: 'Turn a sideways sheet', kind: 'do',
          body: 'P-501 is the fixture schedule, a table of the fixtures on the job: the sinks, toilets and drains. It was scanned on its side.\n1. In the footer, the bar under the sheet, click [[Rotate 90° right]] (or press R).\nThe turn is saved with the project. Every export, a file the app makes to send out, keeps it. Marks already on a sheet turn with it.',
          target: ['#rotatePage'], check: () => ((S().pages[P501] || {}).rotation || 0) === 90,
          hint: () => (((S().pages[P501] || {}).rotation || 0) ? 'Keep turning until the title reads left to right' : ''),
          action: { label: 'Turn it for me', run: () => { goPage(P501); if (((S().pages[P501] || {}).rotation || 0) !== 90) el('rotatePage').click(); } } },
        { id: 'rename', title: 'Name a sheet', kind: 'do',
          // a tablet has no Enter key off the screen, and the engine drops a step that starts "Press" there
          body: () => 'A sheet names itself from its title block, the box in the corner with its name, number and scale. That is how this one became "P-501 · Schedules".\n1. Under PAGES, click the number badge beside P-501.\n2. Type a name you would search for, such as P-501 Fixture Schedule.\n3. ' + (onTouch() ? 'Tap Enter on the keyboard.' : 'Press Enter.') + '\nWhen a scan has no title block the app can read, name the sheet yourself. Reports and exports use this name.',
          target: ['#pagesList .sidebar-item.active .page-num-badge-wrap', '#pagesList'], check: () => { const p = S().pages[P501]; return !!p && !!p.label && p.label !== p501Label; },
          action: { label: 'Name it for me', run: () => { const p = S().pages[P501]; App.pushUndoSnapshot(); p.label = 'P-501 Fixture Schedule'; dirty(); } } },
        { id: 'marked', title: 'Jump to the sheets that matter', kind: 'do',
          // the badge is read here, where one wears the outline to look at (it was explained on the first card, two cards
          // before it mattered, and the wrong way round: styles.css, a yellow number for a scale, a yellow outline for marks)
          body: 'On a sixty-sheet set only a few carry your marks, the clicks you counted. This lesson put two floor drains, drains set in the floor, on P-101.\nUnder PAGES, the {{number badge|#pagesList .page-num-badge-wrap}} of a sheet with marks wears a yellow outline. Only P-101\'s does.\n1. In the footer, click [[Previous marked page]] (or press Shift and the left arrow).\nIt skips every sheet with nothing on it.',
          target: ['#prevMarkedPage', '#pagesList'], check: () => onPage(P101),
          action: { label: 'Jump for me', run: () => el('prevMarkedPage').click() } },
        { id: 'prepare', title: 'Before a real set opens', kind: 'read',
          // Upload PDF leaves the screen once a set is open, so the card lights the door that is there: Project Settings
          body: 'On the empty screen, [[Upload PDF]] brings in a set, and takes several files at once.\nThree sheets or more open in Trim your set, the dialog you saw at the start. There, click the sheets you do not need. Or click Keep none, then the ones you do.\nWith a set open, [[Project Settings]] has Add pages. The new sheets join the end of the set.\nThe whole walk: [Preparing a plan set](/guides/preparing-a-plan-set/).',
          target: ['#uploadPdf', '#uploadPdfSidebar', '#settingsGearBtn', '#sidebarLogoGear'], check: () => true },
      ],
      done: 'Find a sheet, turn it, name it, jump between the ones with marks.\nNext: [[Learn]] → Scale, because nothing measured is right until the scale is.',
    },
    // 2 ---------------------------------------------------------------------------------
    {
      id: 'scale', title: 'Scale: set it, prove it, and zones', short: 'a scale you can trust', minutes: 3, page: P401,
      intro: 'The scale is how many feet of building one inch of paper stands for. This sheet has two: the plan at 1/4", and a detail, one corner drawn again larger, at 1/2".',
      opener: 'This lesson uses P-401, the enlarged plans of the sample restaurant. Nothing you do on it touches your projects.',
      seed() { setScale(P101, 9, '1/8" = 1\''); },
      steps: [
        { id: 'set', title: 'Each sheet has its own scale', kind: 'do',
          body: 'This sheet, P-401, is drawn at 1/4" = 1\'-0": a quarter inch on paper is a foot of building. It has no scale in the app yet, so its number under PAGES is not yellow.\n1. In the header, the bar of tools across the top, click [[Set Scale]] (or press S).\n2. Click [[1/4" = 1\']].\nP-101 is already set at 1/8". Every length the app reports on a sheet hangs off that sheet\'s scale.',
          // in the dialog: the 1/4" preset once the list is up, the tab until then
          target: () => { const i = Array.from(document.querySelectorAll('#scalePresetsList button')).findIndex((b) => b.textContent.trim() === '1/4" = 1\''); return (i < 0 ? [] : ['#scalePresetsList button:nth-of-type(' + (i + 1) + ')']).concat(['#scaleModalTabs .counter-tab[data-tab="presets"]', '#setScale', '#setScaleSidebar']); },
          check: () => scaleIs(P401, 18),
          action: { label: 'Use 1/4" = 1\'-0"', run: async () => { goPage(P401); await K().applyScalePreset('1/4" = 1\'', 18); } } },
        { id: 'prove', cardAt: 'bl', title: 'Prove it', kind: 'do',
          hold: true,   // the reading is the lesson: the card shows it and waits for Next
          body: () => (proveP401().check()
            ? proveP401().verdict() + ': this sheet\'s scale is right.\nDo this on every sheet you measure on. A PDF printed down, shrunk onto smaller paper, looks right and measures short. The title block will not tell you.'
            : 'A dimension is a length the designer wrote on the sheet. Only a dimension can prove the scale.\n1. In the header, click [[Measure]] (or press D).\n2. Click inside circle 1, at the left end of the 12\'-0" dimension over WOMEN, the women\'s restroom.\n3. Click inside circle 2, at its right end.'),
          target: ['#measureBtn', '#measureBtnSidebar'], page: P401, zones: () => proveP401().zones(), check: () => proveP401().check(), hint: () => proveP401().hint(),
          action: { label: 'Measure the 12\'-0" string', run: async () => { goPage(P401); if (!scaleIs(P401, 18)) await K().applyScalePreset('1/4" = 1\'', 18); measure(DETAIL.prove[0], DETAIL.prove[1]); } } },
        { id: 'zone', cardAt: 'bl', title: 'A detail at another scale', kind: 'do',
          body: 'Detail 2, a corner of the plan drawn again larger, is drawn at 1/2". Measured at the sheet\'s 1/4", it would read double.\n1. In the header, click [[⋯]], then [[Scale Zone]].\n2. Drag a box around detail 2: start and end in the shaded band, outside the dashed line.\n3. In the dialog, choose [[1/2" = 1\']].\nA scale zone is a box with its own scale. Everything inside it measures at 1/2", and the rest of the sheet stays at 1/4".',
          target: ['#scaleZoneBtn', '#scaleZoneBtnSidebar', '#headerMoreBtn'],
          page: P401,
          zones: () => [K().boxZone(rectsOf(P401, 'scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 36) < 0.1), DETAIL_INNER, DETAIL_OUTER, 'Drag your box around detail 2, anywhere in here')],
          hint: () => K().boxMiss(rectsOf(P401, 'scaleZones'), DETAIL_INNER, DETAIL_OUTER) || (rectsOf(P401, 'scaleZones').length && !rectsOf(P401, 'scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 36) < 0.1).length ? 'The box is right, the scale is not. Right-click its label, Edit scale, and choose 1/2" = 1\'' : ''),
          check: () => K().boxZone(rectsOf(P401, 'scaleZones', (z) => z.scale && Math.abs(z.scale.pixelsPerUnit - 36) < 0.1), DETAIL_INNER, DETAIL_OUTER).done,
          action: { label: 'Box detail 2 at 1/2"', run: () => { goPage(P401); const a = App.ensureActiveCanvas(S().pages[P401]).annotations; if (!a.scaleZones) a.scaleZones = []; if (a.scaleZones.length) return; App.pushUndoSnapshotCurrentPage(); a.scaleZones.push(Object.assign({ id: App.uid(), scale: { pixelsPerUnit: 36, unit: 'ft', label: '1/2" = 1\'' } }, DETAIL.box)); dirty(); } } },
        { id: 'provezone', cardAt: 'bl', title: 'Prove the zone', kind: 'do',
          body: '1. Click [[Measure]] again (or press D).\n2. Click the tick marks in the two circles: the short slashes at each end of the 4\'-0" dimension inside detail 2.',
          // the result, once there is one to read (it was printed under the steps, before the measure)
          answer: 'It reads 4\'-0", not 8\'-0": the zone\'s scale won.',
          target: ['#measureBtn', '#measureBtnSidebar'], page: P401, zones: () => proveZoneP401().zones(), check: () => proveZoneP401().check(),
          // the 12'-0" read on the last step is still the sheet's last measure: no verdict on it (by hand, 2026-09-25)
          onEnter: () => { zoneEntryMeasure = S().lastMeasure; },
          // read at the sheet's 1/4" it doubles: say which scale won, not just that it is off
          hint: () => { if (S().lastMeasure && S().lastMeasure === zoneEntryMeasure) return ''; const h = proveZoneP401().hint(); const v = K().measuredFeet(); return h && h.code === 'wrong-scale' && v != null && Math.abs(v - 8) < 0.5 ? 'That read ' + String(S().lastMeasure.text || '').replace(/^Distance:\s*/, '') + ', the sheet\'s 1/4", so the zone missed it. Click Back and box detail 2 at 1/2"' : h; },
          action: { label: 'Measure the 4\'-0" string', run: () => { goPage(P401); measure(DETAIL.proveZone[0], DETAIL.proveZone[1]); } } },
        { id: 'more', title: 'When the title block gives no scale', kind: 'read',
          body: 'In [[Set Scale]], click the two ends of a dimension and type its length. The app works the scale out.\nThe dialog also warns when a sheet\'s size says the PDF was printed down, shrunk onto smaller paper.\nBoth walks: [Setting the scale](/guides/setting-the-scale/) and [Is your scale lying to you?](/guides/verifying-your-scale/).',
          target: ['#setScale', '#setScaleSidebar'], check: () => true },
      ],
      done: 'A scale per sheet, a proof on every one, and a zone where the drawing changes scale.\nNext: [[Learn]] → Counting.',
    },
    // 3 ---------------------------------------------------------------------------------
    {
      id: 'counting', title: 'Counting: counters and the number row', short: 'counting at speed', minutes: 3, page: P101,
      intro: 'A takeoff is the count and the feet a price is built on, and counting is most of it. Make a counter, click the fixtures (the sinks, toilets and drains), then put it on a number key.',
      opener: 'This lesson uses P-101, the plumbing plan of the sample restaurant. Its scale is already set, and nothing you do on it touches your projects.',
      seed() { setScale(P101, 9, '1/8" = 1\''); },
      steps: [
        { id: 'counter', title: 'Make a Floor Drain counter', kind: 'do',
          // + Add, Create and Quick are names several controls share: each is pointed at by its own selector
          body: 'A counter is a named tally: each click on the sheet adds one mark to it. A floor drain is a drain set in the floor.\n1. In the left sidebar, under COUNTERS, click {{+ Add|#addCounter}}.\n2. Click the {{Create|#counterModal .counter-tab[data-tab="create"]}} tab.\n3. In Name, type Floor Drain.\n4. Pick a symbol and a colour.\n5. Click [[Create Counter]].\nA new counter is armed, ready to count, as soon as it is made.',
          target: () => K().counterFormTargets(FD_RE), check: () => !!madeCounterNamed(/floor\s*drain|^fd\b/i),
          action: { label: 'Create it for me', run: () => { const c = makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'); App.pushUndoSnapshot(); arm(c); dirty(); } } },
        { id: 'place', title: 'Count the kitchen', kind: 'do',
          body: () => 'The kitchen has three floor drains along the work aisle, and the lesson has circled them.\n1. Click inside each circle. Anywhere in a circle counts.\nThe {{number beside the counter|#countersList [data-counter-id="' + idOf(counterNamed(FD_RE)) + '"] .badge}} in the sidebar moves as you go. It is the total for the whole set of sheets, not just this one.',
          target: ['#annCanvas'], page: P101, zones: () => circlesFor(P101, counterNamed(FD_RE), KITCHEN_FDS, 16),
          check: () => K().allDone(circlesFor(P101, counterNamed(FD_RE), KITCHEN_FDS, 16)),
          hint: () => strayHint(P101, counterNamed(FD_RE), KITCHEN_FDS.concat([FD.dish]), 16),
          action: { label: 'Count three for me', run: () => { const c = counterNamed(/floor\s*drain|^fd\b/i) || makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'); App.pushUndoSnapshotCurrentPage(); mark(P101, c, KITCHEN_FDS.slice(Math.min(3, marksOf(c)))); arm(c); dirty(); } } },
        { id: 'bind', title: 'Put it on the number row', kind: 'do', keys: true,
          // the name the reader's own counter took: a palette that already had a "Floor Drain" made this one "Floor Drain 2" (by hand, 2026-09-25)
          body: () => 'The number row is the keys 1 to 0 above the letters. Each one can hold a counter.\n1. In the status bar, the strip along the bottom, click [[quick keys]] at the right.\n2. Click key 1 at the top, then click ' + ((counterNamed(FD_RE) || {}).name || 'Floor Drain') + ' in the list.\n3. Click {{Done|#quickKeysDone}}.\nQuick keys are saved with the project.' + (S().supabaseSession ? ' They also ride your Artboard, so they come to the next bid. The Artboard is the counters and line types (kinds of pipe) you keep for every job.' : ''),
          target: ['#quickKeysModal .modal-card', '#statusBarQuickKeys'],
          check: () => { const c = counterNamed(/floor\s*drain|^fd\b/i); return !!c && Object.values(S().numberKeyBindings || {}).some((b) => b && b.id === c.id); },
          hint: () => { const c = counterNamed(FD_RE); if (!c) return ''; const other = Object.values(S().numberKeyBindings || {}).map((b) => b && b.kind === 'counter' && b.id !== c.id && (S().counters || []).find((x) => x.id === b.id)).find((x) => x && FD_RE.test(x.name || '')); return other ? 'That key holds ' + other.name + '. Click ' + c.name + ', the counter you just made' : ''; },
          action: { label: 'Bind 1 to Floor Drain', run: () => { const c = counterNamed(/floor\s*drain|^fd\b/i); if (!c) return; if (!S().numberKeyBindings) S().numberKeyBindings = {}; S().numberKeyBindings[1] = { kind: 'counter', id: c.id }; dirty(); } } },
        { id: 'usekey', title: 'Count from the keyboard', kind: 'do', keys: true,
          // the key and the name are the reader's own: the last card passes on any key, and a palette with a "Floor Drain" made this one "Floor Drain 2"
          body: () => { const c = counterNamed(FD_RE), b = S().numberKeyBindings || {}; const key = Object.keys(b).find((k) => b[k] && c && b[k].id === c.id) || '1'; return '1. Press M for [[Move]]. Move places nothing, so clicks stop placing floor drains.\n2. Press ' + key + ': ' + ((c || {}).name || 'Floor Drain') + ' is armed again.\n3. Click inside the circle on the floor drain in the dish room, below the kitchen.\nOn a real sheet that is the whole rhythm: 1, click, click, 2, click, click.'; },
          target: ['#annCanvas'], page: P101, zones: () => circlesFor(P101, counterNamed(FD_RE), [FD.dish], 16),
          check: () => K().allDone(circlesFor(P101, counterNamed(FD_RE), [FD.dish], 16)),
          action: { label: 'Press 1 and count it', run: () => { const c = counterNamed(/floor\s*drain|^fd\b/i); if (!c) return; if (App.triggerQuickKey) App.triggerQuickKey(1); App.pushUndoSnapshotCurrentPage(); mark(P101, c, [FD.dish]); dirty(); } } },
        { id: 'settings', title: 'How the marks look', kind: 'read',
          // one door, the reader's own: a tablet has no right-click
          body: () => (onTouch() ? 'Tap the {{gear|#countersSettingsBtn}} beside COUNTERS in the sidebar for Counter Settings.' : 'Right-click [[Counter]] in the header, the bar across the top, for Counter Settings.') + '\nIt sets the size of the marks, the ring around them, and the running number beside each one.\nMake them small on a crowded sheet and large on a tablet.\nMore: [Counting with counters](/guides/counting-with-counters/), [Custom icons](/guides/custom-icons/) and [Quick creators](/guides/quick-creators/).',
          target: () => (onTouch() ? ['#countersSettingsBtn'] : ['#counterBtn', '#counterBtnSidebar']), check: () => true },
      ],
      // a tablet walked no number-key cards
      done: () => (onTouch() ? 'A counter and a count.' : 'A counter, a count, and a number key.') + '\nNext: [[Learn]] → Measuring.',
    },
    // 4 ---------------------------------------------------------------------------------
    {
      id: 'measuring', title: 'Measuring: runs, bends and drops', short: 'a measured run', minutes: 3, page: P101,
      intro: 'Trace the gas main, the pipe that brings gas to the kitchen, and let it count its own elbow, the fitting where a pipe turns. Then add the riser, the upright pipe a plan never shows.',
      opener: 'This lesson uses P-101, the plumbing plan of the sample restaurant. Its scale is already set, and nothing you do on it touches your projects.',
      seed() { setScale(P101, 9, '1/8" = 1\''); const lt = makeLineType('Gas Pipe', '#e85447'); S().activeLineTypeId = lt.id; },
      steps: [
        { id: 'snap', title: 'Keep runs square', kind: 'do',
          // the header shows Snap only while a line tool is on: the card arms one first, and the light follows
          body: 'Snap locks each piece you trace, clicking along the pipe, to straight across, straight up and down, or 45°. Those are the angles pipe really takes.\n1. In the header, the bar across the top, click [[Polyline]] (or press P). A polyline is a line with corners.\n2. Snap shows in the header while a line tool is on. Click [[Snap to 45° angles]] so it is lit (or press J).\nTurn Snap off for the rare run, a stretch of pipe, that does not.',
          target: ['#lineTypeSnapToHVHeaderBtn', '#polylineBtn', '#polylineBtnSidebar'], check: () => !!(S().lineTypeSettings && S().lineTypeSettings.snapToHorizontalVertical),
          action: { label: 'Turn it on', run: () => { if (!(S().lineTypeSettings && S().lineTypeSettings.snapToHorizontalVertical)) el('lineTypeSnapToHVHeaderBtn').click(); } } },
        { id: 'trace', cardAt: 'bl', title: 'Trace the gas main', kind: 'do',
          body: () => 'The lesson made you a line type, {{Gas Pipe|#lineTypesList [data-line-type-id="' + idOf(lineTypeNamed(/gas/i)) + '"]}}: one kind of pipe that the app measures. The gas main, the pipe the others branch from, is the dash-dot line from the meter (GM), where the gas comes in.\n1. In the header, click [[Polyline]] (or press P).\n2. Click inside circle 1, at the meter.\n3. Click inside circle 2, the corner where the run turns.\n4. Click inside circle 3, the end of the run at the range, the stove.\n5. Click [[Finish]] under the sheet (or press Enter).',
          // what the run is, once it is drawn (it stood under the steps, and the card was 603 px of a 720 px window)
          answer: 'The main runs up the east side of the kitchen and turns west along the cook line, the row of stoves.\nThe plan prints two sizes along it. A real bid traces each size as its own line type, named for its size and material.\nA [[Quick Line]] does the same for one straight piece.',
          // Finish is named so the card keeps off it (it sat on it, and told a tablet reader to drag the card aside)
          target: ['#polylineBtn', '#polylineBtnSidebar', '#finishPolyline'],
          page: P101,
          zones: () => K().pathZones(GAS_MAIN, 15, gasPaths(true)),
          check: () => K().allDone(K().pathZones(GAS_MAIN, 15, gasPaths(false))),
          action: { label: 'Trace it for me', run: () => { const lt = lineTypeNamed(/gas/i); const a = pageAnn(P101); if (!lt || (a && (a.polylines || []).length)) return; goPage(P101); S().drawingPolyline = { id: App.uid(), name: 'Gas main', color: lt.color, points: GAS_MAIN.map((pt) => ({ x: pt.x, y: pt.y })), closed: false, lineTypeId: lt.id, group: null }; App.settlePolylineDraft(); } } },
        { id: 'bends', title: 'Let the run count its elbows', kind: 'do',
          body: 'A fitting is a part that joins pipe, such as the elbow at a turn.\n1. In the left sidebar, under LINE TYPES, click the pencil beside Gas Pipe.\n2. Turn on {{Fittings from bends|#bendFittingsBtn}}.\n3. Click {{Done|#counterLineTypeDetailsClose}}.',
          answerWaits: true,
          answer: () => 'Each bend now counts the elbow nearer its angle, a 45 or a 90. A small chip at the corner shows what the count will say.\nSometimes a line only jogs around text on the sheet. ' + RC() + ' that corner while editing the run and choose No fitting here.',
          target: () => K().ladder('#bendFittingsBtn', '#counterLineTypeDetailsModal .modal-card', K().pencilOf('lineType', lineTypeNamed(/gas/i)), '#lineTypesSectionTitle'),
          check: () => someLineType(/gas/i, (lt) => lt.bendFittings && lt.bendFittings.enabled),
          action: { label: 'Turn it on for me', run: () => { const lt = lineTypeNamed(/gas/i); if (!lt) return; App.pushUndoSnapshot(); const fm = window.FittingModel; lt.bendFittings = Object.assign(fm && fm.normalizeBendFittings ? fm.normalizeBendFittings(lt) : { bend45: { name: lt.name + ' 45° elbow', qty: 1 }, bend90: { name: lt.name + ' 90° elbow', qty: 1 }, drop: { name: lt.name + ' 90° elbow', qty: 1 } }, { enabled: true }); dirty(); } } },
        { id: 'drop', cardAt: 'bl', title: 'Add the riser, the upright pipe', kind: 'do',
          body: 'The main comes up 4 ft out of the ground at the meter. A drop adds a rise like that, or a fall, at the end of a run.\n1. In the header, click [[Drop]] (or press B).\n2. In the palette, the small panel that opens, choose or type 4 ft.\n3. Click the end of the run inside the circle, at the meter.',
          answer: 'Those 4 ft join the run\'s feet. With Fittings from bends on, the drop counts a 90 too.\nClicking the same end again would clear it.',
          target: ['#dropPanel', '#dropBtn'],
          page: P101,
          zones: () => guide([GAS_MAIN[0]], 15, meterDrop()),
          check: () => meterDrop(),
          action: { label: 'Add a 4 ft riser for me', run: () => { goPage(P101); dropAt(GAS_MAIN[0], 4); } } },
        { id: 'read', title: 'Read the run', kind: 'read',
          body: '1. In the left sidebar, look at SUMMARY, the running totals.\nThe run reads its length on the plan plus the 4 ft riser. Under it are the elbows it counted for itself.\nNone of those are marks, so they can never drift from the pipe. Move a corner and they follow.\nMore: [Measuring runs](/guides/measuring-runs-lines-and-polylines/).',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'A traced run with its riser and its own elbows.\nNext: [[Learn]] → Chain and child counts: fixtures and their pipe in one pass, and parts that count themselves.',
    },
    // 5 ---------------------------------------------------------------------------------
    {
      id: 'chain', title: 'Chain, and parts that count themselves', short: 'fixtures and pipe in one pass', minutes: 3, page: P101,
      intro: 'Chain counts the fixtures on a branch, a small pipe feeding a row of sinks, and draws the pipe in the same clicks. The hangers, the straps that hold a pipe up, then count themselves by rule.',
      opener: 'This lesson uses P-101, the plumbing plan of the sample restaurant. Its scale is already set, and nothing you do on it touches your projects.',
      seed() { setScale(P101, 9, '1/8" = 1\''); makeCounter('Lavatory', 'Mounted Sink', '#e8c547'); makeLineType('1/2in PEX', '#47c88e'); },
      steps: [
        { id: 'chain', title: 'Chain the top wall', kind: 'do',
          body: 'Chain places a fixture and draws its branch, the small pipe that feeds it, in the same click.\nThe lesson made a Lavatory counter (a lavatory is a bathroom sink) and a 1/2in PEX line type (PEX is plastic water pipe).\n1. In the header, the bar across the top, click [[Chain]] (or press T).\n2. In the Chain panel, choose Lavatory and 1/2in PEX.\n3. Click inside circle 1, the lavatory in MEN, the men\'s restroom.\n4. Click inside circle 2, the one in WOMEN.\n5. Click inside circle 3, the mop sink, a low sink for a mop bucket.',
          // the step passes on the third circle, so ending the run is told after it; a tablet has no Enter,
          // and there any other tool ends the run (app.js clearToolStarts)
          answer: () => 'Each branch is drawn back to the fixture before it.\nChain stays on, and the next click would join this run. ' + (onTouch() ? 'Tap [[Move]] in the header to end it.' : 'Press Enter to end it.'),
          target: ['#chainPanel', '#chainBtn'], page: P101, zones: () => K().markZones(P101, countersMatching(/lavatory/i), [LAVS[0], LAVS[1], MOP], 14),
          check: () => { const a = pageAnn(P101); return !!a && (a.quickLines || []).length >= 2 && K().allDone(K().markZones(P101, countersMatching(/lavatory/i), [LAVS[0], LAVS[1], MOP], 14)); },
          action: { label: 'Chain the three for me', run: () => { goPage(P101); const a = pageAnn(P101); if (a && (a.quickLines || []).length >= 2) return; K().chainPoints(makeCounter('Lavatory', 'Mounted Sink', '#e8c547').id, makeLineType('1/2in PEX', '#47c88e').id, [LAVS[0], LAVS[1], MOP]); } } },
        { id: 'hangers', title: 'Hangers from the rule', kind: 'do',
          rules: ['plumb.hanger.pex'],
          body: 'A child count is a part that counts itself off something else, such as a hanger, a strap that holds pipe up, every few feet.\n1. In the left sidebar, under LINE TYPES, click the pencil beside 1/2in PEX.\n2. Find {{Child counts|#childCountsGroup}}. The app offers the hanger spacing for that pipe, read off its name.\n3. Click {{Add|#childCountsSuggest button}}.\n4. Click {{Done|#counterLineTypeDetailsClose}}.',
          answerWaits: true,
          answer: 'Every run of this type now counts its hangers into SUMMARY, the running totals, and every file you export.\nDelete a run and its hangers go with it.',
          target: () => K().ladder('#childCountsSuggest', '#childCountsGroup', K().pencilOf('lineType', usedLineType(/pex/i)), '#lineTypesSectionTitle'),
          check: () => ((usedLineType(/pex/i) || {}).childCounts || []).length > 0,
          action: { label: 'Add the hanger rule', run: () => { const lt = usedLineType(/pex/i); if (!lt || (lt.childCounts || []).length) return; App.pushUndoSnapshot(); lt.childCounts = [hangerRuleFor(lt)]; dirty(); } } },
        { id: 'rule', title: 'Where the number came from', kind: 'read',
          rules: ['plumb.hanger.pex'],
          body: '1. In the left sidebar, look at SUMMARY. Under 1/2in PEX, the Hanger row carries a {{§ chip|#summaryList .rule-chip}}.\nThe chip names the rule the spacing came from. Click it in the sidebar to open the rule in the public [rulebook](/rules/), the trade rules the app applies.\nThe rules come from the plumbing code, the law for how pipe goes in. [[Project Settings]] picks the code edition your jurisdiction, your town or county, is on.',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
        // its own card: it was the last paragraph of the rule card, a second subject (the card pass)
        { id: 'own', title: 'Child counts of your own', kind: 'read',
          body: () => 'Any part that rides on another can be a child count. The {{pencil|' + K().pencilOf('lineType', usedLineType(/pex/i)) + '}} beside a line type or a counter opens its list.\nOn a line type, a row counts once per run, or once every so many feet.\nOn a counter, a row counts once per mark: a carrier, the frame a wall-hung toilet hangs on, under every water closet (toilet).',
          target: () => K().ladder(K().pencilOf('lineType', usedLineType(/pex/i)), '#lineTypesSectionTitle'), check: () => true },
      ],
      done: 'Three clicks for three fixtures and their pipe, and hangers nobody counted.\nNext: [[Learn]] → Repeats.',
    },
    // 6 ---------------------------------------------------------------------------------
    {
      id: 'repeats', title: 'Repeats: count one, bid four', short: 'a typical, multiplied', minutes: 2, page: P401,
      intro: 'Detail 2 on this sheet says TYP. OF 4: typical of four, the same room built four times. Count it once and let a zone, a box on the sheet, do the multiplying.',
      opener: 'This lesson uses P-401, the enlarged plans of the sample restaurant. Nothing you do on it touches your projects.',
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
          // the card says why the number is 4: the open card no longer carries the intro that did
          body: 'A multiply zone is a box whose marks count that many times over.\nDetail 2, one corner of the plan drawn again larger, says TYP. OF 4: typical of four, the same room built four times. The lesson counted it once: one hand sink, for washing hands only, and one floor drain.\n1. In the header, the bar across the top, click [[⋯]], then [[Multiply Zone]] (or press X).\n2. Drag a box around detail 2: start and end in the shaded band, outside the dashed line.\n3. In Enter multiplier, type 4.\n4. Click {{Apply|#multiplyZoneApply}}.',
          target: ['#multiplyZoneMultiplier', '#multiplyZoneBtn', '#multiplyZoneBtnSidebar', '#headerMoreBtn'],
          page: P401,
          // TYP. OF 4 is four: a zone left at the dialog's default 2 passed, and the next card's "reads 4" read 2 (by hand, 2026-09-25)
          zones: () => [K().boxZone(rectsOf(P401, 'multiplyZones', (z) => z.multiplier === 4), DETAIL_INNER, DETAIL_OUTER, 'Drag your box around detail 2, anywhere in here')],
          hint: () => K().boxMiss(rectsOf(P401, 'multiplyZones'), DETAIL_INNER, DETAIL_OUTER) || (() => { const z = rectsOf(P401, 'multiplyZones').find((q) => q.multiplier !== 4); return z && !rectsOf(P401, 'multiplyZones', (q) => q.multiplier === 4).length ? 'The box is right, the number is ×' + (z.multiplier || 1) + '. Right-click the zone\'s label, Edit multiplier, and type 4' : ''; })(),
          check: () => K().boxZone(rectsOf(P401, 'multiplyZones', (z) => z.multiplier === 4), DETAIL_INNER, DETAIL_OUTER).done,
          action: { label: 'Wrap detail 2 in a ×4 zone', run: () => { goPage(P401); const a = App.ensureActiveCanvas(S().pages[P401]).annotations; if (!a.multiplyZones) a.multiplyZones = []; if (a.multiplyZones.length) return; App.pushUndoSnapshotCurrentPage(); a.multiplyZones.push(Object.assign({ id: App.uid(), multiplier: 4 }, DETAIL.box)); dirty(); } } },
        { id: 'read', title: 'One mark, four in the bid', kind: 'read',
          body: () => '1. In the left sidebar, look at SUMMARY, the running totals.\nHand Sink reads 4 and Floor Drain reads 4. The sheet still shows one mark of each.\nEvery count and every foot inside the box multiplies: in the totals, the report and every export.\nIt is the same tool for a tower with ten floors that are all alike.\n' + RC() + ' the zone\'s label to change the number or remove it.\nMore: [Scale zones and multiply zones](/guides/scale-zones-and-multiply-zones/).',
          target: ['#summaryList', '#summarySectionTitle'], check: () => true },
      ],
      done: 'Count one, bid four.\nNext: [[Learn]] → Organizing.',
    },
    // 7 ---------------------------------------------------------------------------------
    {
      id: 'organize', title: 'Organizing a busy sheet', short: 'a sheet you can still read', minutes: 3, page: P101,
      intro: 'Ten drains, three sinks and two water closets (toilets), and this is a small job. Groups, the sidebar filter, layers and Hide marks keep a big one readable.',
      opener: 'This lesson uses P-101, the plumbing plan of the sample restaurant, already counted. Nothing you do on it touches your projects.',
      seed() {
        setScale(P101, 9, '1/8" = 1\'');
        mark(P101, makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'), Object.keys(FD).map((k) => FD[k]));
        mark(P101, makeCounter('Hand Sink', 'Mounted Sink', '#e8c547'), HAND_SINKS);
        mark(P101, makeCounter('Water Closet', 'Toilet', '#47c88e'), WCS);
        makeCounter('Urinal', 'Urinal', '#c8963a');   // unused: the filter step's point (the card said P-401 used it; nothing did)
      },
      steps: [
        { id: 'groupson', title: 'Turn on Groups', kind: 'do',
          body: 'A group is a named bundle of marks, such as everything in the kitchen, with its own subtotal.\n1. In the header, the bar across the top, click [[Project Settings]], the gear.\n2. Turn on {{Use groups|#settingsUseGroupsBtn}}. The dialog closes by itself.\nA Groups section joins the sidebar. Projects that never use groups never see it.',
          target: ['#settingsUseGroupsBtn', '#settingsGearBtn', '#sidebarLogoGear'], check: () => !!S().groupsEnabled || (S().groups || []).length > 0,   // the app's own gate: a project with groups has them on, and the switch is locked
          action: { label: 'Turn Groups on', run: () => { if (App.turnOnGroups) App.turnOnGroups(); else S().groupsEnabled = true; App.updateUI(); } } },
        { id: 'group', title: 'Make a Kitchen group', kind: 'do',
          body: '1. In the left sidebar, under GROUPS, click {{+ Add|#addGroup}}.\n2. In Name, type Kitchen.\n3. Click {{Done|#groupModalDone}}.',
          target: ['#groupModalDone', '#addGroup', '#groupsSectionTitle'], check: () => (S().groups || []).some((g) => /kitchen/i.test(g.name || '')),
          action: { label: 'Make it for me', run: async () => { if ((S().groups || []).some((g) => /kitchen/i.test(g.name || ''))) return; if (!S().groupsEnabled && App.turnOnGroups) App.turnOnGroups(); App.openGroupModal(null); await wait(60); el('groupModalName').value = 'Kitchen'; el('groupModalDone').click(); await wait(80); } } },
        { id: 'assign', title: 'Put the kitchen drains in it', kind: 'do',
          // a tablet opens a mark's menu by a long press ("Touch": the engine drops a step that starts "Press" there)
          body: () => 'The three floor drains along the kitchen\'s work aisle are circled.\n1. ' + (onTouch() ? 'Touch and hold' : 'Right-click') + ' the mark inside a circle.\n2. Click [[Assign to group]].\n3. Click Kitchen, then {{Done|#groupAssignDone}}.\n4. Do the same in the other two circles.',
          answerWaits: true,
          answer: 'The group\'s row in the sidebar adds up what it holds.\nClick a group first, and everything you place after that joins it.',
          target: ['#groupAssignDone', '#annCanvas'], page: P101,
          zones: () => { const g = kitchenGroup(); return K().markZones(P101, null, KITCHEN_FDS, 16, (m) => !!g && m.group === g.id); },
          check: () => { const g = kitchenGroup(); return !!g && K().allDone(K().markZones(P101, null, KITCHEN_FDS, 16, (m) => m.group === g.id)); },
          action: { label: 'Assign the three for me', run: () => { const g = (S().groups || []).find((x) => /kitchen/i.test(x.name || '')); const c = counterNamed(/floor\s*drain/i); const a = pageAnn(P101); if (!g || !c || !a) return; App.pushUndoSnapshotCurrentPage(); (a.counterMarkers[c.id] || []).forEach((m) => { if (KITCHEN_FDS.some((k) => near(m, k, 4))) m.group = g.id; }); dirty(); } } },
        { id: 'filter', title: 'Show only what this sheet uses', kind: 'do',
          body: 'The lesson added a Urinal counter that nothing on this sheet uses. On a real bid, a job you are pricing, the COUNTERS list holds sixty.\n1. In the left sidebar, beside the COUNTERS search box, click {{the funnel|#counterShowOnlyOnPageInlineBtn}} once.',
          // the other two stops are told once the first is seen, and trying them does not undo the step
          answer: 'The list dropped to the counters with marks on this sheet.\nClick {{the funnel|#counterShowOnlyOnPageInlineBtn}} again for the ones used anywhere in the project, and once more for every counter.\nWhen you leave, the lesson puts it back the way you had it.',
          target: ['#counterShowOnlyOnPageInlineBtn', '#countersSection'], check: () => { if (App.getCounterListFilterScope && App.getCounterListFilterScope() === 'page') sawFilterOn = true; return sawFilterOn; },
          action: { label: 'Filter to this page', run: () => { App.setCounterListFilterScope('page'); App.updateUI(); } } },
        { id: 'layer', title: 'An alternate on its own layer', kind: 'do',
          body: 'A layer is a clear sheet laid over the plan, with its own marks. The sidebar totals count every layer. Use one for an alternate (a priced option), an addendum (a later change), or drains kept apart from water.\n1. In the footer, the bar under the sheet, click [[Layers]] beside the layer name.\n2. Click [[+ Add layer]].\n3. Click [[New empty layer]].\n4. In Name, type a name, such as Alternate 1.\n5. Click {{Create|#addCanvasModalCreate}}.',
          answer: 'You are on the new layer now, and it is empty.\nPick a layer under [[Layers]] to switch to it (or press the up and down arrow keys). The {{button beside it|#showAllCanvasesBtn}} shows every layer at once.',
          target: ['#addCanvasModalCreate', '#canvasMenuAdd', '#canvasLayersBtn', '#showAllCanvasesBtn'], check: () => ((S().pages[P101] || {}).canvases || []).length >= 2,
          action: { label: 'Add the layer for me', run: async () => { if (((S().pages[P101] || {}).canvases || []).length >= 2) return; goPage(P101); el('addCanvasBtn').click(); await wait(80); if (el('addCanvasModalNew')) el('addCanvasModalNew').click(); if (el('addCanvasModalName')) el('addCanvasModalName').value = 'Alternate 1'; if (el('addCanvasModalCreate')) el('addCanvasModalCreate').click(); await wait(80); } } },
        { id: 'hide', title: 'Read the bare drawing', kind: 'do',
          body: '1. In the header, click the eye, [[Hide marks]].\n2. Read the drawing under your marks.\n3. Click it again to bring them back.\nNothing is deleted. It is the fastest way to check whether a fixture is already counted.',
          target: ['#hideMarksBtn'], check: () => { if (S().hideMarks) sawMarksHidden = true; return sawMarksHidden && !S().hideMarks; },
          hint: () => (S().hideMarks ? 'Marks hidden. Click the eye again' : ''),
          action: { label: 'Hide and show for me', run: async () => { if (!S().hideMarks) el('hideMarksBtn').click(); await wait(900); if (S().hideMarks) el('hideMarksBtn').click(); } } },
      ],
      done: 'Groups, the filter, a layer, and the bare drawing: a busy takeoff, the counts and feet a price is built on, kept readable.\nMore: [Keeping a dense takeoff organized](/guides/organizing-a-busy-sheet/) and [Canvas layers](/guides/canvas-layers/).\nNext: [[Learn]] → Fixing mistakes.',
    },
    // 8 ---------------------------------------------------------------------------------
    {
      id: 'fixing', title: 'Fixing mistakes', short: 'nothing you cannot take back', minutes: 3, page: P101,
      intro: 'A takeoff, the count and the feet a price is built on, is mostly corrections. Undo, the right-click menu, the pencil beside a counter and Delete area cover all of them.',
      opener: 'The sheets open with six floor drains already counted. One mark is a mistake, and two sit in a room you are not pricing.\nNothing here touches your own work.',
      seed() { setScale(P101, 9, '1/8" = 1\''); const c = makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'); mark(P101, c, KITCHEN_FDS.concat([FD.bar1, FD.bar2, STRAY])); S().activeCounterType = c.id; },
      steps: [
        { id: 'undo', title: 'Undo', kind: 'do',
          body: () => '1. In the header, the bar across the top, click [[Counter]] (or press C).\n2. Choose Floor Drain, a drain set in the floor.\n3. Click anywhere on the sheet to place a mark you do not want.\n4. In the footer, the bar under the sheet, click [[Undo]] (or press ' + undoKey() + ').',
          answer: 'Undo goes fifty steps back, and [[Redo]] beside it goes forward again.\nUndo covers everything: marks, renames, zones, a page you turned.',
          // the light is on Counter until the unwanted mark is down, then on Undo: the card talks about both
          target: () => (extraSeen ? ['#undoBtn'] : ['#counterBtn', '#counterBtnSidebar', '#undoBtn']), check: () => { const n = countersMatching(/floor\s*drain/i).reduce((t, id) => t + K().markCount(id), 0); if (n >= 7) extraSeen = true; return extraSeen && n <= 6; },   // any floor drain counter the reader chose: their own twin of the name counts too (by hand, 2026-09-25)
          hint: () => (extraSeen ? 'Now click Undo' : ''),
          action: { label: 'Place one and undo it', run: async () => { const c = counterNamed(/floor\s*drain/i); if (!c) return; goPage(P101); App.pushUndoSnapshotCurrentPage(); mark(P101, c, [P(450, 380)]); dirty(); extraSeen = true; await wait(700); el('undoBtn').click(); } } },
        { id: 'context', title: 'Delete one mark', kind: 'do',
          // a tablet has no M and no right button: Move is a header button, and the menu opens on a long press
          // ("Touch and hold": the engine drops a numbered step that starts "Press" on touch)
          body: () => 'A floor drain mark sits in the middle of the dining room, circled. The plan has no drain there.\n1. In the header, the bar across the top, click [[Move]] (or press M). Now no tool is armed, ready to place marks.\n2. ' + (onTouch() ? 'Touch and hold' : 'Right-click') + ' the mark inside the circle.\n3. Click [[Delete]].\nAt its foot, the menu names the counter the mark belongs to.',
          target: ['#annCanvas'], page: P101, zones: () => guide([STRAY], 16, false).filter(() => K().markersOf(P101, null).some((m) => near(m, STRAY, 6))),
          check: () => { const c = counterNamed(/floor\s*drain/i); const a = pageAnn(P101); return !!c && !!a && !(a.counterMarkers[c.id] || []).some((m) => near(m, STRAY, 6)); },
          action: { label: 'Delete it for me', run: () => { const c = counterNamed(/floor\s*drain/i); const a = pageAnn(P101); if (!c || !a) return; App.pushUndoSnapshotCurrentPage(); a.counterMarkers[c.id] = (a.counterMarkers[c.id] || []).filter((m) => !near(m, STRAY, 6)); dirty(); } } },
        { id: 'details', title: 'Change a whole type at once', kind: 'do',
          body: 'The fixture schedule, the table of fixtures on P-501, calls these FD-1.\n1. In the left sidebar, under COUNTERS, click the pencil beside Floor Drain.\n2. Change the name to FD-1 Floor Drain.\n3. Click [[Done]].',
          answerWaits: true,
          answer: 'Every mark follows, and so do SUMMARY, the legend (the key the app draws on the sheet) and the report.\nThe same dialog changes the symbol and the colour.',
          target: () => K().ladder('#counterLineTypeDetailsModal .modal-card', K().pencilOf('counter', counterNamed(FD_RE)), '#countersSection'), check: () => !!madeCounterNamed(/fd-?1/i),
          action: { label: 'Rename it for me', run: () => { const c = counterNamed(/floor\s*drain/i); if (!c) return; App.pushUndoSnapshot(); c.name = 'FD-1 Floor Drain'; dirty(); } } },
        { id: 'area', cardAt: 'tr', title: 'Clear an area', kind: 'do',
          body: 'The bar is out of your scope, the work you are pricing.\n1. In the header, click [[⋯]], then [[Delete area]].\n2. Drag a box around the two drains in the BAR: start and end inside the shaded boundary, clear of the kitchen.\n3. Read what the dialog says is inside, then click its button, Delete 2 marks.',
          answer: 'Both marks are gone, in one move. One undo would bring them back.',
          target: ['#deleteZoneBtn', '#deleteZoneBtnSidebar', '#headerMoreBtn'],
          page: P101,
          zones: () => (barCleared() ? [] : [{ kind: 'box', inner: K().norm(BAR_FIXTURES), outer: K().grow(BAR, 14), done: false, label: 'Drag your box around the bar\'s two drains, inside here' }]),
          // the bar gone AND the kitchen kept: a Delete area box over the whole plan passed (PERSONA-PASS prober)
          check: () => barCleared() && kitchenKept(),
          hint: () => (barCleared() && !kitchenKept() ? { code: 'wrong-value', text: 'That took the kitchen drains too. ' + (onTouch() ? 'Tap Undo in the footer' : 'Press ' + undoKey()) + ', then box only the bar' } : ''),
          action: { label: 'Clear the bar for me', run: async () => { goPage(P101); const a = pageAnn(P101); if (!a) return; App.openDeleteZoneForRect(a, P101, BAR.x1, BAR.y1, BAR.x2, BAR.y2); await wait(250); if (modalUp('confirmModal') && el('confirmOk')) el('confirmOk').click(); await wait(150); } } },
      ],
      done: 'Undo, delete one, change a type, clear an area.\nMore: [Fixing mistakes](/guides/fixing-mistakes/).\nNext: [[Learn]] → Notes and questions.',
    },
    // 9 ---------------------------------------------------------------------------------
    {
      id: 'notes', title: 'Notes, questions and highlights', short: 'a drawing that remembers why', minutes: 2, page: P101,
      intro: 'What you notice while counting is worth as much as the count. Notes, RFI flags (questions for the builder) and highlights keep it on the sheet.',
      opener: 'The sheets open with a scale set and nothing marked. You will leave two notes and one highlight on them.\nNothing here touches your own work.',
      seed() { setScale(P101, 9, '1/8" = 1\''); },
      steps: [
        { id: 'note', title: 'Leave a note', kind: 'do',
          body: '1. In the header, the bar across the top, click [[⋯]], then [[Note]] (or press N).\n2. Click inside the circle in the kitchen.\n3. Type what you want to remember, such as Verify hood gas connection size, and click [[Done]].',
          // a finger's way to the note's Edit is its menu (a long press): double-click is the mouse's
          answer: () => 'The note is on the sheet.\n' + (onTouch() ? 'Drag a note to move it, and drag its corner to resize it. Touch and hold it, then tap Edit, to change its words.' : 'Drag a note to move it, drag its corner to resize it, double-click to edit it.'),
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'], page: P101, zones: () => guide([NOTE_SPOT], 40, noteAt(NOTE_SPOT, 40)),
          check: () => noteAt(NOTE_SPOT, 40),
          hint: () => { const a = pageAnn(P101); return a && (a.notes || []).length && !noteAt(NOTE_SPOT, 40) ? 'That note is outside the circle. Drag it into the circle' : ''; },
          action: { label: 'Leave one for me', run: () => addNote(NOTE_SPOT, 'Verify hood gas connection size', '#e8c547') } },
        { id: 'rfi', title: 'Flag a question for the builder', kind: 'do',
          body: 'The grease interceptor (GI), a tank that catches kitchen grease before the sewer, is drawn outside the building. Nothing says who digs the hole for it.\nAsk in writing. That is an RFI, a request for information, sent to the GC, the general contractor who runs the job.\n1. Click [[⋯]], then [[Note]] again (or press N).\n2. Click inside the circle beside the GI.\n3. Type RFI: and then the question, and click [[Done]].',
          answer: 'A note that starts with RFI: is a flag. Under EXPORT OPTIONS, [[Copy RFI Flags]] collects every flag in the set into one list.',
          target: ['#noteModalDone', '#noteBtn', '#noteBtnSidebar', '#headerMoreBtn'],
          page: P101, zones: () => guide([RFI_SPOT], 40, noteAt(RFI_SPOT, 40, /^\s*RFI\s*:/i)),
          check: () => noteAt(RFI_SPOT, 40, /^\s*RFI\s*:/i),
          hint: () => { const a = pageAnn(P101); return a && (a.notes || []).some((n) => /^\s*RFI\s*:/i.test(String(n.text || ''))) && !noteAt(RFI_SPOT, 40, /^\s*RFI\s*:/i) ? 'That flag is outside the circle. Drag it into the circle' : ''; },
          action: { label: 'Flag it for me', run: () => addNote(RFI_SPOT, 'RFI: Who excavates and sets the grease interceptor?', '#e85447') } },
        { id: 'highlight', title: 'Highlight an area', kind: 'do',
          body: 'A highlight is a see-through colour box.\n1. In the header, click [[⋯]], then [[Highlight]] (or press H).\n2. Drag a box over the grease interceptor (GI): start and end in the shaded band, outside the dashed line.',
          answer: 'Highlights take names and have a bookmark list.\nExport PDFs can bundle just the highlighted sheets for whoever needs to look.',
          target: ['#highlightBtn', '#highlightBtnSidebar', '#headerMoreBtn'], page: P101,
          zones: () => [K().boxZone(rectsOf(P101, 'highlights'), GI_TANK, GI_OUTER, 'Drag your highlight over the GI, inside here')],
          hint: () => K().boxMiss(rectsOf(P101, 'highlights'), GI_TANK, GI_OUTER),
          check: () => K().boxZone(rectsOf(P101, 'highlights'), GI_TANK, GI_OUTER).done,
          action: { label: 'Highlight it for me', run: () => { goPage(P101); const a = App.ensureActiveCanvas(S().pages[P101]).annotations; if (!a.highlights) a.highlights = []; if (a.highlights.length) return; App.pushUndoSnapshotCurrentPage(); a.highlights.push(Object.assign({ color: '#e8c547', opacity: 0.25, id: App.uid() }, GI)); S().tool = App.TOOL.NONE; dirty(); } } },
        { id: 'ledger', title: 'Every note in one list', kind: 'read',
          body: '1. In the header, the bar across the top, click [[Notes ledger]]. Its badge counts the open RFI flags.\nThe ledger lists every note, sheet by sheet. [[RFI]] at its top narrows it to the flags. Click a row to go to that spot.\nMore: [Highlights, notes, and reading the bare drawing](/guides/annotating-and-reviewing/).',
          target: ['#notesLedgerDrawer', '#notesLedgerBtn'], check: () => true },
      ],
      done: 'A note, a question for the GC, a highlight.\nNext: [[Learn]] → Check and prove.',
    },
    // 10 --------------------------------------------------------------------------------
    {
      id: 'check', title: 'Check the bid, prove the number', short: 'a number you can defend', minutes: 3, page: P101,
      intro: 'Before a bid, your price for the job, goes out: what the app can check for you, and what only you can sign. And where a number came from when someone asks.',
      opener: 'The sheets open with a small takeoff already on them: three sinks on one water pipe, and three floor drains.\nNothing here touches your own work.',
      seed() { seedBranch(); mark(P101, makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'), KITCHEN_FDS); },
      steps: [
        { id: 'open', title: 'Open Bid Check', kind: 'do',
          onEnter: () => K().foldBidCheck(), hold: true, body: 'Bid Check lists what a bid must answer before it goes out.\n1. In the left sidebar, click BID CHECK to expand it.',
          answer: 'The badge beside BID CHECK counts what is still open.\nRows marked AUTO are judged by the app. The rest are yours to tick.',
          // opened, the list is brought up the sidebar and lit: it opened under the fold of a laptop screen
          target: () => K().bidCheckRows('lesson:check:open'), lightAll: true, check: () => S().bidCheckCollapsed === false,
          action: { label: 'Open it', run: () => openBidCheck() } },
        { id: 'fix', title: 'Close an open row', kind: 'do',
          rules: ['plumb.hanger.pex'],
          body: 'The row {{Hangers on every supported run|#bidCheckList [data-row-id="hangers"]}} is open. The 1/2in PEX, a plastic water pipe, has no hanger rule. A hanger is a strap that holds a pipe up.\n1. In the left sidebar, under LINE TYPES, click the pencil beside 1/2in PEX.\n2. Under [[Child counts]], the parts a pipe counts for itself, click [[Add]] on the suggested hanger.\n3. Click [[Done]].',
          answerWaits: true,
          answer: 'The row {{Hangers on every supported run|#bidCheckList [data-row-id="hangers"]}} has turned to a tick, by itself.',
          target: () => K().ladder('#childCountsSuggest', '#childCountsGroup', K().pencilOf('lineType', usedLineType(/pex/i)), '#lineTypesSectionTitle'),
          check: () => ((usedLineType(/pex/i) || {}).childCounts || []).length > 0,
          action: { label: 'Add the hanger rule', run: () => { const lt = usedLineType(/pex/i); if (!lt || (lt.childCounts || []).length) return; App.pushUndoSnapshot(); lt.childCounts = [hangerRuleFor(lt)]; dirty(); } } },
        { id: 'tick', title: 'Sign what only you can', kind: 'do',
          body: 'Some rows only you can judge, such as whether you proved each sheet\'s scale.\n1. In the left sidebar, under BID CHECK, click the row {{Scale verified on every counted sheet|#bidCheckList [data-row-id="scale-verified"]}}.',
          answer: 'One click signs it for the whole bid. Your ticks are saved with the bid.\nTo hand off a takeoff is to send it on to be priced. Hand one off with a row still open, and the app asks once. It remembers your answer until something changes. It never blocks you.',
          target: ['#bidCheckList [data-row-id="scale-verified"]', '#bidCheckSection', '#bidCheckSectionTitle'], check: () => !!(S().bidCheck && S().bidCheck.manual && S().bidCheck.manual['scale-verified']),
          action: { label: 'Tick it for me', run: () => tickManual('scale-verified') } },
        { id: 'proof', title: 'Where did that number come from?', kind: 'do', hold: true,
          body: '1. In the left sidebar, under SUMMARY, click the Floor Drain total.',
          answer: 'The breakdown shows the count sheet by sheet. A thumbnail, a small picture of the sheet, shows where every mark sits, with any zones already counted in. A zone is a box that changes the scale or multiplies.',
          target: () => K().ladder('#summaryCountDetailModal .modal-card', K().summaryRowOf('counter', counterNamed(FD_RE)), '#summarySectionTitle'), check: () => detailOpenFor(counterNamed(FD_RE)), hint: () => detailMiss(counterNamed(FD_RE)),
          action: { label: 'Open the breakdown', run: () => { const c = counterNamed(/floor\s*drain/i); if (c && App.openSummaryCountDetailModal) App.openSummaryCountDetailModal('counter', c.id); } } },
        { id: 'legend', title: 'The legend, the key drawn on the sheet', kind: 'do', hold: true,
          body: 'It lists each counter and line type with its total.\n1. In the left sidebar, click {{the gear|#summarySettingsBtn}} beside SUMMARY.',
          answer: 'Summary Legend sets how that legend draws. Plumbing gets a tally. The compact block is a small ruled table, the way an E (electrical) or M (heating and air) sheet draws its own. The full block shows every column.\nIt follows the project\'s trade (plumbing, electrical, or heating and air) until you choose.',
          target: ['#legendSettingsModal .modal-card', '#summarySettingsBtn'], check: () => modalUp('legendSettingsModal'),
          action: { label: 'Open Summary Legend', run: () => { if (App.openLegendSettingsModal) App.openLegendSettingsModal(); } } },
      ],
      done: 'Checked by the app, signed by you, provable on demand.\nNext: [[Learn]] → Deliverables.',
    },
    // 11 --------------------------------------------------------------------------------
    {
      id: 'deliver', title: 'Deliverables: report, PDFs, hand-off', short: 'the takeoff, handed over', minutes: 2, page: P101,
      intro: 'Four ways to send the takeoff, your counts and feet, out of the app. All four sit under EXPORT OPTIONS in the left sidebar, once there is something to send.',
      opener: 'The sheets open with a small takeoff already on them, so there is something to send: three sinks, their pipe and three floor drains.\nNothing here touches your own work.',
      seed() { const b = seedBranch(); b.pex.childCounts = [hangerRuleFor(b.pex)]; mark(P101, makeCounter('Floor Drain', 'Floor Drain', '#4a9eff'), KITCHEN_FDS); },
      steps: [
        { id: 'report', title: 'The report', kind: 'read',
          body: 'Under EXPORT OPTIONS, [[Show Report]] opens the full breakdown in a new browser tab.\nIt lists counts and lengths by type and by sheet, and room volumes, the air each room holds. The hangers, the straps that hold pipe up, sit under their pipe.\nIts menu picks how much: This sheet, or Everything. Print it or save it as a PDF from there.',
          target: ['#printReport', '#exportOptionsSectionTitle'], check: () => true },
        { id: 'pdfs', title: 'Marked-up plans', kind: 'do', hold: true,
          body: '1. Under EXPORT OPTIONS, click [[Export PDFs]].',
          answer: 'It makes marked-up plans: the sheets with your marks drawn on them. Choose the sheets, and set the marker and line sizes for print. Decide whether the report and the highlighted or noted sheets come along.\n[[Download current page]], in the header, the bar across the top, does it in one click for the sheet you are on.',
          target: ['#specificPagesModal .modal-card', '#specificPages', '#exportOptionsSectionTitle'], check: () => modalUp('specificPagesModal'),
          action: { label: 'Open Export PDFs', run: () => { if (App.openSpecificPagesModal) App.openSpecificPagesModal(); else el('specificPages').click(); } } },
        { id: 'tooling', title: 'Hand it to the bid', kind: 'read',
          body: '[[Copy to /Tooling]] copies the takeoff, ready to paste into a bid in PipeTooling, the plumbing pricing app.\nIt carries the fixtures and the feet, with the risers (upright pipe) inside. The hangers and fittings (the joints) sit under their pipe. Its first line names exactly what was copied.\n[[Open in TakeoffTooling]] opens it in TakeoffTooling, the electrical pricing app, for an electrical bid.\n[[Copy RFI Flags]] copies your questions for the builder to go with it.',
          // three buttons, one light around them. The lowest is named first: the sidebar scrolls to the
          // first target, and with the lowest at its foot the other two are on screen above it
          target: ['#copyRfiFlags', '#forTakeoffTooling', '#forPipeTooling'], lightAll: true, check: () => true },
        { id: 'email', title: 'Or just the numbers', kind: 'read',
          body: '[[Copy Summary (Email/Text)]] is the same takeoff as plain text, for an email.\nTotals are always in decimal feet, feet and tenths rather than feet and inches, whatever unit each sheet was scaled in.\nMore: [Reports and exports](/guides/reports-and-exports/).',
          target: ['#copySummaryText', '#exportOptionsSectionTitle'], check: () => true },
      ],
      done: 'A report, a marked-up set, a paste into the bid, an email.\nNext: [[Learn]] → Working faster.',
    },
    // 12 --------------------------------------------------------------------------------
    {
      id: 'speed', title: 'Working faster', short: 'the fast way round', minutes: 2, page: P101,
      intro: 'Every tool has a key, and the app will show you which. Two minutes that save time on every sheet.',
      opener: 'The sheets open with their scale already set, so every tool in this lesson is ready to try.\nNothing here touches your own work.',
      seed() { setScale(P101, 9, '1/8" = 1\''); },
      steps: [
        { id: 'map', title: 'The keyboard map', kind: 'do', hold: true,
          // a tablet has no keys: its reader gets the map and how to read it, not a list of keys to press
          body: '1. In the status bar, the strip along the bottom, click [[shortcuts]] at the right.',
          // the map is the list: the card names the few keys worth learning first, once the map is up
          answer: () => (onTouch()
            ? 'It shows every key on one picture, for when a keyboard is joined to your tablet.\nTap a lit key to see what it does.'
            : 'It shows every key on one picture. Click a lit key to see what it does.\nFive to learn first: M Move, C Counter, P Polyline, T Chain, D Measure.\nThe arrow keys move between sheets and layers. The spacebar hides and shows the sidebar.'),
          // the status bar's shortcuts opens Keyboard Shortcuts (#macrosModal, the map inline); the step waited
          // for the standalone Keyboard Map only its seam opened, and never passed by hand (2026-09-25)
          target: ['#macrosModal .modal-card', '#keyboardMapModal .modal-card', '#statusBarMacros'], check: () => modalUp('macrosModal') || modalUp('keyboardMapModal'),
          action: { label: 'Open it for me', run: () => el('statusBarMacros').click() } },
        { id: 'rail', title: 'The zoom rail, a column of fixed zoom stops', kind: 'do', hold: true,
          body: '1. In the footer, the bar under the sheet, click {{the zoom percentage|#zoomPct}}.',
          answer: () => 'Click a stop. The sheet always lands on a size the app has already drawn, so the jump is instant.\n[[Fit]] brings the whole sheet back. ' + (onTouch() ? 'A two-finger pinch zooms in where your fingers are.' : 'The mouse wheel and a two-finger pinch zoom in where the pointer is.'),
          target: ['#zoomRail', '#zoomPct'], check: () => { const r = el('zoomRail'); return !!r && !r.hidden; },
          action: { label: 'Open the rail', run: () => { if (App.openZoomRail) App.openZoomRail(); else el('zoomPct').click(); } } },
        { id: 'rightclick', title: 'A tool\'s own settings', kind: 'read',
          // a tablet's long press opens no menu on a header button in every browser: there the door is the gear
          // beside the list's heading, the one the Counting lesson names
          body: () => (onTouch()
            ? 'Tap the gear beside a heading in the sidebar. The one beside COUNTERS opens Counter Settings, LINE TYPES the line type settings, SUMMARY the legend\'s.'
            : 'Right-click a tool button in the header, the bar across the top, to open them. [[Counter]] opens Counter Settings, the line tools open line type settings, [[Summary legend]] the legend\'s.') + '\nMore: [Working faster with the keyboard](/guides/working-faster-with-the-keyboard/) and [Takeoffs on a tablet](/guides/takeoff-on-a-tablet/).',
          target: () => (onTouch() ? ['#countersSettingsBtn', '#lineTypesSettingsBtn', '#summarySettingsBtn'] : ['.header-tools-tight', '#counterBtn', '#counterBtnSidebar']), get lightAll() { return onTouch(); }, check: () => true },
      ],
      done: () => (onTouch() ? 'The key map, the rail, the gear beside a list.' : 'Keys, the rail, right-click.') + '\nNext: [[Learn]] → Saving and sharing.',
    },
    // 13 --------------------------------------------------------------------------------
    {
      id: 'cloud', title: 'Saving, sharing and your bids', short: 'the cloud half', minutes: 2, page: P101, readOnly: true,
      intro: 'Everything so far works signed out, saved on this device. Signing in adds the cloud, your work saved online, which a lesson cannot use, so this one is only reading.',
      opener: 'Three cards to read, and nothing to click. The sample sheets open behind them, so the screen is not bare.\nNothing here touches your own work.',
      seed() { setScale(P101, 9, '1/8" = 1\''); },
      steps: [
        { id: 'saved', title: 'How your work is saved', kind: 'read',
          // Sign In is named only while it is on screen: signed in, or with no cloud set up, the status bar has none
          body: () => 'The status bar, the strip along the bottom, always says {{where your work is saved|#statusMode}}: on this device or in the cloud, and when.\nSigned out, the app saves a backup on this device every few seconds. It offers it back the next time you open the app.\nSigned in, the same takeoff also saves to your account, and opens on any device.' + ((() => { const a = el('statusBarAuth'); return !!a && a.getClientRects().length > 0 && /sign in/i.test(a.textContent || ''); })() ? ' [[Sign In]] is at the right of the status bar.' : '') + '\nThe whole story: [How your work is saved](/guides/how-your-work-is-saved/) and [Working offline and installing](/guides/working-offline-and-installing/).',
          target: ['#statusBar', '.status-bar'], check: () => true },
        { id: 'share', title: 'One editor at a time', kind: 'read',
          body: 'A shared project is checked out by one person at a time, like a library book. Two estimators, the people who price the work, never overwrite each other.\nYou check it out to edit, and turn it in when you are done. After thirty quiet minutes it turns itself in.\nA view link lets someone outside your company open the marked-up plan and measure on it. They can do nothing else.\nMore: [Sharing and view links](/guides/sharing-and-view-links/).',
          target: [], check: () => true },
        { id: 'bids', title: 'Your bids, and your standards', kind: 'read',
          body: 'A bid is one job you are pricing. All Bids shows every project you can reach, with its status. {{The bid chip|#headerBidChip}} in the header, the bar across the top, switches between recent ones.\nYour Artboard is your standard palette: the counters, line types, Quick Keys and icons you carry into every new bid. Palette Insights shows which ones you actually use.\nMore: [Reviewing all bids](/guides/reviewing-all-bids/) and [Your palette, every bid](/guides/artboard-and-palette-insights/). Admins: [the admin handbook](/guides/admin-handbook/).',
          target: ['#headerBidChip'], check: () => true },
      ],
      done: 'That is every part of the app.\nTo start on a real sheet, click {{the bid chip|#headerBidChip}} in the header, then Upload a new plan. The guides are always under Project Settings → Help.',
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
  function markDone(id) { try { const d = lessonsDone(); d[id] = new Date().toISOString(); localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (_) { /* private mode: the tick is a convenience */ } syncStartHere(); }
  // Every course's progress (features/course-*.js) is ONE map, { '<course>:<chapter>': ISO }: it
  // lives here, beside the lessons', so App.courseDone answers for all three courses whichever
  // of them loaded (R16, D23: it used to be registered by the plumbing course alone).
  const COURSE_DONE_KEY = 'clickcount-course-done';
  function courseDone() { try { return JSON.parse(localStorage.getItem(COURSE_DONE_KEY) || '{}') || {}; } catch (_) { return {}; } }
  function markCourseDone(key) { try { const d = courseDone(); d[key] = new Date().toISOString(); localStorage.setItem(COURSE_DONE_KEY, JSON.stringify(d)); } catch (_) { /* private mode: the tick is a convenience */ } syncStartHere(); }

  // LEARN-START: the empty canvas of a device that has finished nothing (no lesson, no chapter, no
  // tour) shows one card, Start here, in place of the line of tour, lesson and course links; the
  // first thing finished brings the line back. The class hides the line (styles.css), and the card
  // is `hidden` until a device is fresh, so a stylesheet a deploy behind still shows the links.
  // Also run by the tour engine's syncEntryPoints, the moment a tour is finished.
  const isFreshDevice = () => !Object.keys(lessonsDone()).length && !Object.keys(courseDone()).length && !(App.anyTourDone && App.anyTourDone());
  function syncStartHere() {
    const fresh = isFreshDevice();
    const hint = el('canvasEmptyHint');
    if (hint) hint.classList.toggle('is-fresh', fresh);
    const card = el('canvasEmptyHintStartWrap');
    if (card) card.hidden = !fresh;
  }

  LESSONS.forEach((lesson, idx) => {
    const next = LESSONS[idx + 1];
    App.registerTour(tourId(lesson.id), {
      steps: [openStep(lesson)].concat(lesson.steps, [doneStep(lesson, lesson.done)]),
      doneKey: null,
      onStart: beginTeaching,
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
  // The snapshot rides localStorage too: a reader who reloads or closes the tab mid-lesson never
  // reaches onStop, and the lesson's filter, snap and emptied search boxes stayed on their device
  // for good (by hand, 2026-09-25). The next load puts them back; a lesson started while another
  // is still mid-way keeps the FIRST snapshot, the reader's own.
  // The blank tour (features/tour-blank.js) takes the same snapshot through lessonKit with
  // { searches: false }: a tour's search words already ride the engine's own key
  // (features/tutorial.js), so its snapshot leaves them out and restoreDevice leaves them be
  // (MAP-SETTINGS, 2026-09-26: Snap persists per device now, so it has to come back too; so does
  // Auto-pick, 2026-10-01, which the electrical course's chapter 3 turns on).
  const BEFORE_KEY = 'clickcount-lesson-device-before';
  let deviceBefore = (() => { try { return JSON.parse(localStorage.getItem(BEFORE_KEY) || 'null'); } catch (_) { return null; } })();
  function rememberDevice(opts) {
    if (deviceBefore) return;
    deviceBefore = { scope: App.getCounterListFilterScope ? App.getCounterListFilterScope() : 'off', snap: !!(S().lineTypeSettings && S().lineTypeSettings.snapToHorizontalVertical), autoPick: !!(S().counterSettings && S().counterSettings.autoPick) };
    if (!opts || opts.searches !== false) deviceBefore.searches = getSearches();
    try { localStorage.setItem(BEFORE_KEY, JSON.stringify(deviceBefore)); } catch (_) { /* private mode: this session's stop still restores */ }
  }
  function restoreDevice() {
    try { localStorage.removeItem(BEFORE_KEY); } catch (_) { /* noop */ }
    if (!deviceBefore) return;
    if (App.getCounterListFilterScope && App.getCounterListFilterScope() !== deviceBefore.scope) App.setCounterListFilterScope(deviceBefore.scope);
    if (!!(S().lineTypeSettings && S().lineTypeSettings.snapToHorizontalVertical) !== deviceBefore.snap && el('lineTypeSnapToHVHeaderBtn')) el('lineTypeSnapToHVHeaderBtn').click();
    // AUTO-PICK (2026-10-01): the electrical course turns it on; the reader's own setting comes back.
    if (typeof deviceBefore.autoPick === 'boolean' && !!(S().counterSettings && S().counterSettings.autoPick) !== deviceBefore.autoPick && App.setAutoPick) App.setAutoPick(deviceBefore.autoPick, { toast: false });
    if (deviceBefore.searches) setSearches(deviceBefore.searches);
    deviceBefore = null;
    App.updateUI();
  }
  // A lesson or a chapter starting: the per-run flags cleared and the reader's device remembered.
  // It is the tour's onStart, so it runs INSIDE startTutorial, after the engine has stopped any
  // tour still running (TOUR-RESTART): that stop's restoreDevice puts the reader's settings back
  // and drops its snapshot first, so this one is the reader's again, never the last lesson's.
  function beginTeaching() { sawMarksHidden = false; sawFilterOn = false; extraSeen = false; seededFor = null; openingFor = null; rememberDevice(); }
  function startLesson(id) {
    const lesson = LESSONS.find((l) => l.id === id);
    if (!lesson) return false;
    if (App.hideModal) App.hideModal('learnModal');
    return App.startTutorial(tourId(id));
  }
  // One Learn list, the lessons' or a course's: a row per item, ticked when done, the suggested one
  // lit, its minutes (a read-only lesson says so), a click that starts it, and the "n of m done" line.
  // `attr` names the row's data attribute (data-lesson, data-chapter: the specs find rows by it), and
  // only the lessons' list scrolls its lit row into view (a course's section is scrolled to by
  // openLearnMenu instead).
  // A row's number is the one its title carries ("Chapter 0: Before you count" shows a 0, the
  // uncounted opener the plain-language pass gave each course, 2026-09-27); a title with no
  // number takes its position. Row 0 stays out of the "N of M done" count: it is read, not done.
  function renderRows({ list, prog, items, isDone, lit, title, number, attr, noun, start, scroll }) {
    if (!list) return;
    const rowNumber = (it, i) => { const n = number ? number(it) : null; return n === null || n === undefined ? i + 1 : n; };
    const counted = items.filter((it, i) => rowNumber(it, i) !== 0);
    const count = counted.filter(isDone).length;
    const esc = App.escapeHtml || ((t) => String(t));
    list.innerHTML = items.map((it, i) => '<button type="button" class="learn-row' + (isDone(it) ? ' learn-row-done' : '') + (it.id === lit ? ' learn-row-next' : '') + '" data-' + attr + '="' + it.id + '">'
      + '<span class="learn-row-no">' + (isDone(it) ? '✓' : rowNumber(it, i)) + '</span>'
      + '<span class="learn-row-text"><span class="learn-row-title">' + esc(title(it)) + '</span><span class="learn-row-sub">' + esc(it.intro) + '</span></span>'
      + '<span class="learn-row-min">' + it.minutes + ' min' + (it.readOnly ? ' · read' : '') + '</span></button>').join('');
    if (prog) prog.textContent = count === counted.length ? 'All ' + counted.length + ' ' + noun + ' done' : count + ' of ' + counted.length + ' done';
    list.querySelectorAll('.learn-row').forEach((row) => { row.onclick = () => start(row.getAttribute('data-' + attr)); });
    const on = scroll && list.querySelector('.learn-row-next');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  function renderLearnList(nextId) {
    const done = lessonsDone();
    // row 0 is Start here, the uncounted opener: numbered by position, so the thirteen read 1 to 13
    renderRows({ list: el('learnList'), prog: el('learnProgress'), items: LESSONS, isDone: (l) => !!done[l.id], lit: nextId, title: (l) => l.title, number: (l) => LESSONS.indexOf(l), attr: 'lesson', noun: 'lessons', start: startLesson, scroll: true });
  }
  // courseNext: a course handing back to the menu names itself and the chapter to light,
  // { course, chapter }; the menu renders every registered course section
  // (App.courseSections, each { id, render(nextChapterId) }) and scrolls to that one. Undefined
  // leaves each course's own suggestion (its first unfinished chapter).
  function openLearnMenu(nextId, courseNext) {
    const done = lessonsDone();
    // the first lesson not done; Start here only for a reader who has done none of the thirteen
    const counted = LESSONS.slice(1);
    const suggested = nextId === undefined ? (((counted.some((l) => done[l.id]) ? counted : LESSONS).find((l) => !done[l.id]) || {}).id || null) : nextId;
    renderLearnList(suggested);
    (App.courseSections || []).forEach((sec) => sec.render(courseNext && courseNext.course === sec.id ? courseNext.chapter : undefined));
    App.showModal('learnModal');
    App.onLearnMenuOpened && App.onLearnMenuOpened();   // the Words search opens empty (features/learn-words.js)
    if (courseNext) { const rule = el('learnCourseRule-' + courseNext.course); if (rule && rule.scrollIntoView) rule.scrollIntoView({ block: 'start' }); }
    return true;
  }

  // ----- the course runner (R15): one for every course ------------------------------------------
  // A course file (features/course-*.js) holds its chapters and calls this once, at load:
  //   registerCourse({ id, chapters, doors: { hint, settings } })
  // It registers a 'course:<id>:<chapter>' tour per chapter (the lesson's open step, the chapter's
  // steps, the done step; its finish ticks '<id>:<chapter>' in the one course map and hands back to
  // the menu at the course, the next chapter lit), adds the course's section to the Learn menu
  // (App.courseSections: #learnCourseList-<id>, #learnCourseProgress-<id>), wires its two doors (the
  // empty-canvas link `hint` and Project Settings → Help's `settings`, element ids) and its routes,
  // /app/?course=<id> (the menu, at the course) and /app/?chapter=<id>:<chapter>. It returns
  // { start(chapterId) }, which the course publishes under the name its spec reads.
  function registerCourse({ id, chapters, doors }) {
    const key = (ch) => id + ':' + ch;
    const tourOf = (ch) => 'course:' + id + ':' + ch;
    const suggested = () => { const d = courseDone(); return (chapters.find((c) => !d[key(c.id)]) || {}).id || null; };
    chapters.forEach((chapter, idx) => {
      const next = chapters[idx + 1];
      App.registerTour(tourOf(chapter.id), {
        steps: [openStep(chapter)].concat(chapter.steps, [doneStep(chapter, chapter.done)]),
        doneKey: null,
        onStart: beginTeaching,
        onStop(finished) {
          restoreDevice();
          if (!finished) return;
          markCourseDone(key(chapter.id));
          openLearnMenu(undefined, { course: id, chapter: next ? next.id : null });   // back to the menu, at the course, the next chapter lit
        },
      });
    });
    function start(ch) {
      if (!chapters.some((c) => c.id === ch)) return false;
      if (App.hideModal) App.hideModal('learnModal');
      return App.startTutorial(tourOf(ch));   // the chapter's onStart remembers the device, after any running tour stops
    }
    function render(nextId) {
      const done = courseDone();
      renderRows({ list: el('learnCourseList-' + id), prog: el('learnCourseProgress-' + id), items: chapters, isDone: (c) => !!done[key(c.id)], lit: nextId === undefined ? suggested() : nextId, title: (c) => c.title.replace(/^Chapter \d+: /, ''), number: (c) => { const m = /^Chapter (\d+):/.exec(c.title); return m ? Number(m[1]) : null; }, attr: 'chapter', noun: 'chapters', start, scroll: false });
    }
    const openAtCourse = () => openLearnMenu(undefined, { course: id, chapter: suggested() });
    // FIELD-TAKEOFF (2026-10-02): /app/?field=<course> opens the course's sheets with its finished
    // takeoff on them and no card: the test drive's field door (/test/), a plan set someone can ask
    // questions of. The finished takeoff is chapter 8's: its seed, then the lay step's "Finish the
    // takeoff for me". No tour runs, so nothing is snapshotted or restored; the palette it makes is
    // tracked like any teaching set's and leaves with the sheets.
    const whole = chapters.find((c) => c.id === 'whole');
    const layStep = whole && whole.steps.find((s) => s.id === 'lay');
    const layAll = layStep && layStep.action && layStep.action.run;
    async function openFinished() {
      if (!layAll) return false;
      await openSheetsFor(whole);
      for (let i = 0; i < 300 && seededFor !== whole.id; i++) {
        // Trim your set can come up after openSheetsFor's own Open (its pages still building), and
        // the course's reader would press Open again; nobody is here to, so press it once a second
        if (i % 10 === 9 && modalUp('preparePdfModal')) el('preparePdfDone').click();
        seedIfReady(whole);
        await wait(100);
      }
      if (seededFor !== whole.id) return false;
      // A second visit reopens the set with the last visit's marks on it, and the lay places only what
      // it cannot find at the plan's own spots: diffusers it slid onto their runs last time are not
      // there, so they were laid again (21 SD-1 for 11, by hand). The answer key starts on clean sheets.
      S().pages.forEach((p) => (p.canvases || []).forEach((cv) => { cv.annotations = App.makeAnnotations(); }));
      S().rooms = [];   // the HVAC lay boxes a room only when no room of that name stands (seedRooms)
      await layAll();
      S().tool = App.TOOL.NONE;
      S().currentPage = whole.page || 0;
      // Counts big enough to read on a phone, ringed in their colour (the marker is a fixed size on
      // screen: 22 is a speck beside the plan's own symbols). In memory only, never saveDisplaySettings:
      // this device's own Counter Settings are as they were on the next load.
      const cs = S().counterSettings || {};
      S().counterSettings = Object.assign({}, cs, { size: Math.max(cs.size || 0, 48), showRings: true });
      App.clearUndoStacks();
      dirty();
      App.fitZoom();
      if (App.showToast) App.showToast('A finished takeoff on the sample sheets. Tap any mark to read it.', 5000);
      App.finishedTakeoffReady = id;   // the test drive's phone frame lifts its cover on this
      return true;
    }
    App.openFinishedTakeoff = App.openFinishedTakeoff || {};
    App.openFinishedTakeoff[id] = openFinished;
    const d = doors || {};
    el(d.hint) && (el(d.hint).onclick = (e) => { e.preventDefault(); openAtCourse(); });
    el(d.settings) && (el(d.settings).onclick = () => { App.hideModal('settingsModal'); openAtCourse(); });
    try {
      const params = new URLSearchParams(location.search);
      const chapter = String(params.get('chapter') || '');
      const want = chapter.startsWith(id + ':') ? chapter.slice(id.length + 1) : null;
      if (want && chapters.some((c) => c.id === want)) {
        App.setTutorialPending(true);   // the boot's restore offer waits, as it does for ?tour= and ?lesson=
        setTimeout(() => { App.setTutorialPending(false); start(want); }, 600);
      } else if (params.get('field') === id && layAll) {
        App.setTutorialPending(true);
        setTimeout(() => { openFinished().finally(() => App.setTutorialPending(false)); }, 600);   // held until laid: the restore offer waits for a plan
      } else if (params.get('course') === id) {
        App.setTutorialPending(true);
        setTimeout(() => { App.setTutorialPending(false); openAtCourse(); }, 600);
      }
    } catch (_) { App.setTutorialPending && App.setTutorialPending(false); }
    (App.courseSections = App.courseSections || []).push({ id, render });
    return { start };
  }

  // wiring (static DOM)
  el('canvasEmptyHintLearn') && (el('canvasEmptyHintLearn').onclick = (e) => { e.preventDefault(); openLearnMenu(); });
  el('canvasEmptyHintStart') && (el('canvasEmptyHintStart').onclick = (e) => { e.preventDefault(); startLesson('start'); });
  el('canvasEmptyHintStartAll') && (el('canvasEmptyHintStartAll').onclick = (e) => { e.preventDefault(); openLearnMenu(); });
  // after every feature script has run, so the blank tour's done key (it registers after this file) counts
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncStartHere); else syncStartHere();
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

  // LESSON-UPLOAD (2026-09-25). The reader's own PDF uploaded onto the sample sheets used to become
  // another page of the sample project: their drawing lived in "sample-lessons", the next lesson
  // cleared it without asking, and LEARN-LEAK swept what they made for it. features/pdf-intake.js
  // now asks here first, and the upload opens as their own new plan. A running lesson or tour asks
  // before it stops (the owner's call); finished, the sample just closes.
  // Which projects are teaching sets, and how many pages each came with, is the tourKit's list.
  const teachingSetOpen = () => K().isTeachingSet(S().currentProjectName) && !!(S().pages && S().pages.length);
  async function leaveTeachingSheetsForUpload() {
    if (App.isTutorialActive && App.isTutorialActive()) {
      const id = (App.tutorialId && App.tutorialId()) || '';
      const what = /^lesson:/.test(id) ? 'lesson' : /^course:/.test(id) ? 'chapter' : 'tour';
      const ok = await App.confirmDialog({ title: 'Leave the ' + what + '?', body: 'Your PDF opens as your own plan, and the ' + what + ' stops here. What the ' + what + ' made stays with its sample sheets.', confirmLabel: 'Open my plan' });
      if (!ok) return false;
      App.stopTutorial(false);
    }
    App.resetLocalSessionState({ keepArtboard: true });
    App.updateUI();   // the sheets are left: LEARN-LEAK sweeps here
    App.renderPdf();
    return true;
  }
  App.isTeachingSetOpen = teachingSetOpen;
  App.leaveTeachingSheetsForUpload = leaveTeachingSheetsForUpload;
  App.onLessonPaletteSync = syncLessonPalette;   // app.js updateUI, before the sidebar draws
  App.beginTeachingPalette = beginTeachingPalette;   // a tour opening its sheet (features/tutorial.js, tour-blank.js)
  App.openLearnMenu = openLearnMenu;
  App.startLesson = startLesson;
  App.syncStartHere = syncStartHere;   // the tour engine's syncEntryPoints, once a tour is finished
  // A lesson left by a reload or a closed tab: once the app has booted, put the reader's device
  // back (a ?lesson= link that starts a lesson on this load keeps the snapshot for its own stop).
  if (deviceBefore) {
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > 600) { clearInterval(t); return; }
      if (!App.bootSettled) return;
      clearInterval(t);
      setTimeout(() => { if ((App.isTutorialActive && App.isTutorialActive()) || (App.isTutorialPending && App.isTutorialPending())) return; restoreDevice(); }, 1500);
    }, 100);
  }
  App.lessonIds = () => LESSONS.map((l) => l.id);
  App.lessonsDone = lessonsDone;
  App.courseDone = courseDone;
  // What a COURSE needs (features/course-*.js): the runner that registers it, the sheets'
  // geometry, the readers, the seeding and marking helpers, the Bid Check and proof helpers
  // every course shared a copy of (R15), and the device bookkeeping a lesson does around a
  // run. A course calls registerCourse at load (this file loads first); everything else is
  // read at call time, never captured.
  App.lessonKit = {
    registerCourse,
    P101, P401, P501, P601, P, FD, LAVS, MOP, WCS, HAND_SINKS, GAS_MAIN, DETAIL,
    pts, raw, planFeet,   // flat point lists on the P-101 shell
    pageAnn, onPage, detailOpenFor, detailMiss, counterNamed, lineTypeNamed, lineTypesMatching, someLineType, isStanding: (id) => standing.has(id), armedNamed: (re) => { const st = S(); const c = (st.counters || []).find((x) => x.id === st.activeCounterType); return c && st.tool === App.TOOL.COUNTER && re.test(c.name || '') ? c : null; }, marksOf, scaleIs, near, modalUp, measured, readerFeet, feetFor, rectsOf,
    dirty, goPage, setScale, makeCounter, makeLineType, mark, markMissing, dropAt, measure, hangerRuleFor, addNote, openStep, doneStep, guide, memoProof,
    openBidCheck, tickManual,
    courseDone, markCourseDone,   // a course's progress, read and ticked through here
    onTouch, undoKey,   // a card that differs for a reader with no keys, or by machine (the card review)
    rememberDevice,   // the blank tour's door: rememberDevice({ searches: false })
    restoreDevice,
    // The demo track (features/demo-track.js, DEMO-TRACK): a moment opens its set and lays its seed
    // through the same doors a lesson does, so the palette watch, Trim your set and the settle test
    // are the lessons' own. `isSeeded` is the open card's check: the set open and THIS run's seed laid.
    openSheetsFor, seedIfReady,
    isSeeded: (lesson) => isSetOpen(lesson) && seededFor === lesson.id,
  };
})();
