/*
 * features/demo-plumbing.js - the plumbing demo track (DEMO-TRACK, journeys/plans/DEMO-TRACK.md):
 * five moments on the lesson set (samples/sample-lessons.pdf: P-101 the restaurant plan, P-501 the
 * fixture schedule, P-601 the waste and vent riser), behind the test drive's "Try it". Not the course:
 * a stranger with two minutes gets one action per card and what it was worth, in money, time or a
 * caught mistake. The engine is features/demo-track.js (the orientation card, the quiet UI, "Do it for
 * me", the doors /app/?demo=plumbing and /app/?demo=plumbing:<moment>).
 *
 *   schedule  The schedule makes your counters         a box over P-501's table, then the two toilets
 *   pipe      Trace the pipe, get the parts it needs   the 1-1/2" cold trunk in four circles (hangers and
 *                                                      elbows counted), then the hot water return
 *   riser     The vertical feet the plan cannot show   P-601's stack in two circles, then its cleanout
 *   scale     Prove the scale before you count         Set Scale at 1/8", then Measure the 31'-8" string
 *   bid       It checks the bid against the code       Bid Check on the course's whole takeoff catches the
 *                                                      lavatory branch counting no hangers; Fix it; a signed row
 *
 * Every seed, point and reader is the plumbing course's (App.coursePlumbingKit, features/course-
 * plumbing.js) or the lessons' (App.lessonKit); this file copies none of them. Every number a card
 * quotes is read live off the takeoff (`answer: () => ...`), so it cannot drift from the sheet.
 *
 * Registrations: none of its own (App.registerDemo does them). Boundary rule: read shared deps from
 * App.* at call time, never captured at load; the one exception is the registerDemo call at the foot
 * (features/demo-track.js loads first).
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const C = () => App.coursePlumbingKit;
  const K = () => App.lessonKit;
  const T = () => App.tourKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
  const P101 = () => K().P101, P501 = () => K().P501, P601 = () => K().P601;
  // The sidebar is a drawer behind ☰ on a narrow layout (styles.css max-width: 768px, the engine's own
  // isNarrow): a card that sends the guest to the sidebar says to open it first there.
  const narrow = () => { try { if (window.matchMedia('(max-width: 768px)').matches) return true; } catch (_) { /* older engines */ } const h = el('hamburger'); return !!h && h.getClientRects().length > 0 && getComputedStyle(h).display !== 'none'; };
  // A demo circle is a finger wide on a tablet: 30 sheet points, twice the course's 13 to 16 (the
  // engine's own floor is 26 px on screen). Every on-sheet card here uses it.
  const R = 30;

  // ----- tracing a run, the guest's clicks or the demo's ---------------------------------------------
  // A run is its page, the circles it passes through (sheet points, in order), its line type, and the
  // course's own lay for "Do it for me". The demo arms Polyline on the type, and presses Finish for the
  // guest once the last circle is in (decision 2).
  const runLength = (ps) => { let n = 0; for (let i = 1; i < ps.length; i++) n += Math.hypot(ps[i].x - ps[i - 1].x, ps[i].y - ps[i - 1].y); return n; };
  function makeRun({ page, spots, lt, lay }) {
    const committed = () => { const t = lt(), a = K().pageAnn(page()); return t && a ? (a.polylines || []).filter((pl) => pl.lineTypeId === t.id).map((pl) => pl.points || []) : []; };
    const draft = () => { const d = S().drawingPolyline, t = lt(); return d && t && d.lineTypeId === t.id && S().currentPage === page() ? d.points || [] : null; };
    // A visibly right trace counts even when a corner missed its circle: its length within 10% of the
    // run's and its two ends within a circle of the run's two ends (either way round). A guest must
    // never look at a drawn pipe beside "2 of 4 done".
    function visiblyRight(v) {
      const want = spots();
      if (!v || v.length < 2 || want.length < 2) return false;
      const len = runLength(want);
      if (Math.abs(runLength(v) - len) > len * 0.1) return false;
      const a = want[0], b = want[want.length - 1], near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) <= R;
      const first = v[0], last = v[v.length - 1];
      return (near(first, a) && near(last, b)) || (near(first, b) && near(last, a));
    }
    const hits = (v) => T().allDone(T().pathZones(spots(), R, [v])) || visiblyRight(v);
    const done = () => committed().some(hits);
    const zones = () => { const d = draft(), zs = T().pathZones(spots(), R, committed().concat(d ? [d] : [])); if (done()) zs.forEach((z) => { z.done = true; }); return zs; };
    function arm() {
      const t = lt();
      if (!t || done()) return;
      K().goPage(page());
      if (draft()) { if (S().tool !== App.TOOL.POLYLINE) { S().tool = App.TOOL.POLYLINE; App.updateUI(); } return; }
      if (S().drawingPolyline) S().drawingPolyline = null;   // a stray draft of another type
      S().activeLineTypeId = t.id;
      if (el('polylineBtn')) el('polylineBtn').click();
    }
    let finishing = false;
    function finishWhenTraced() {
      const d = draft();
      if (finishing || !d || d.length < 2 || !hits(d)) return;
      finishing = true;
      setTimeout(() => { finishing = false; if (draft() && el('finishPolyline')) el('finishPolyline').click(); }, 250);
    }
    function forMe() {
      if (done()) return;
      if (S().drawingPolyline) S().drawingPolyline = null;
      lay();
      S().tool = App.TOOL.NONE;
      K().dirty();
    }
    return { done, zones, arm, finishWhenTraced, forMe };
  }
  // What a line type's runs earned in the Summary: its hangers (the typed rows) and its elbows (the
  // rows Fittings from bends derives), from the same tally the Summary draws.
  function partsOf(lt) {
    const out = { hangers: 0, elbows: 0 };
    if (!lt || !App.getChildCountTotals) return out;
    const g = App.getChildCountTotals().byGroup || {};
    Object.keys(g).forEach((gid) => ((g[gid].lineType || {})[lt.id] || []).forEach((r) => {
      if (/elbow|bend|fitting/i.test(r.name || '')) out.elbows += r.total || 0; else out.hangers += r.total || 0;
    }));
    return out;
  }
  const plural = (n, one, many) => fmt(n) + ' ' + (Math.round(n) === 1 ? one : many);

  // ----- schedule: P-501's table becomes the counters, then the two toilets -----------------------------
  let scheduleBefore = new Set();
  // the counters made since the card opened: the schedule reader's carry their tag, the hand-made ones a tag's name
  const tagged = (c) => !!c.tag || Object.keys(C().TAGS).some((k) => C().TAGS[k][0].test(c.name || ''));
  const made = () => (S().counters || []).filter((c) => !scheduleBefore.has(c.id) && tagged(c));
  const tagOf = (c) => c.tag || String(c.name || '').split(/\s/)[0];
  function seedSchedule() { C().uprightSchedule(); scheduleBefore = new Set((S().counters || []).map((c) => c.id)); }
  function armScheduleBox() {
    if (made().length) return;
    K().goPage(P501());
    S().scheduleBoxStart = null;
    S().tool = App.TOOL.SCHEDULE;
    App.updateUI();
  }
  // The proposal the drag opens: long enough on screen to see it read the tags, then its Create is
  // pressed for the guest (decision 2), the counters stamped as the demo's like the course stamps them.
  let paletteSeenAt = 0;
  function createWhenRead() {
    if (!K().modalUp('schedulePaletteModal')) { paletteSeenAt = 0; return; }
    if (!paletteSeenAt) { paletteSeenAt = Date.now(); return; }
    if (Date.now() - paletteSeenAt < 900) return;
    paletteSeenAt = 0;
    if (el('schedulePaletteCreate')) el('schedulePaletteCreate').click();
    made().forEach((c) => { c.lesson = true; });
    disarm();
  }
  // Create arms the last counter it made (FS-1): a stray tap on the schedule would place one, so the
  // tool is put down until the next card arms WC-1.
  function disarm() { S().tool = App.TOOL.NONE; App.updateUI(); }
  const SCHEDULE_INNER = () => { const b = C().SCHEDULE_BOX; return { x1: b.x1 + 12, y1: b.y1 + 12, x2: b.x2 - 12, y2: b.y2 - 12 }; };
  const scheduleZone = () => { const z = T().boxZone([], SCHEDULE_INNER(), T().grow(C().SCHEDULE_BOX, 60), 'Drag your box around the table, anywhere in here'); z.done = made().length > 0; return [z]; };
  const wc = () => made().find((c) => C().RE.wc.test(c.name || '')) || K().counterNamed(C().RE.wc);
  const wcZones = () => T().markZones(P101(), (wc() || {}).id || '__none__', K().WCS, R);
  function armWc() { const c = wc() || C().pick('wc'); K().goPage(P101()); S().activeCounterType = c.id; S().tool = App.TOOL.COUNTER; App.updateUI(); }

  // ----- pipe: the 1-1/2" cold trunk, its hangers and elbows, then the return ---------------------------
  const copper15 = () => K().lineTypeNamed(C().RE.copper15);
  const hwr = () => K().lineTypeNamed(C().RE.hwr);
  function seedPipe() {
    C().scaleP101();
    const k = K();
    // the hanger rule and Fittings from bends are on before the trace: the moment is what they count
    const cw = copper15() || k.makeLineType('1.5in Copper CW', '#4a9eff');
    const rt = hwr() || k.makeLineType('0.75in Copper HWR', '#e8c547');
    [cw, rt].forEach((lt) => { C().addHangerRule(lt); C().enableBends(lt); });
  }
  const TRUNK = makeRun({
    page: P101, lt: copper15, spots: () => C().pts(C().G.cwTrunk),
    lay: () => C().tracePlan(copper15() || K().makeLineType('1.5in Copper CW', '#4a9eff'), C().G.cwTrunk, 'Cold trunk'),
  });
  // The return's last jog is 13 points long, inside one circle: its two circles are the top and the pump.
  const hwReturnEnds = () => { const p = C().pts(C().G.hwReturn); return [p[0], p[p.length - 1]]; };
  const RETURN = makeRun({
    page: P101, lt: hwr, spots: hwReturnEnds,
    lay: () => C().tracePlan(hwr() || K().makeLineType('0.75in Copper HWR', '#e8c547'), C().G.hwReturn, 'Hot water return'),
  });
  const sizeWord = (lt) => { const m = /([\d.]+)\s*in/i.exec((lt && lt.name) || ''); return m ? m[1] + ' inch' : ''; };
  function trunkPayoff() {
    const lt = copper15(), p = partsOf(lt);
    return 'That is ' + fmt(K().feetFor(C().RE.copper15)) + ' feet of ' + sizeWord(lt) + ' copper. The app counted ' + plural(p.hangers, 'hanger', 'hangers') + ' and ' + plural(p.elbows, 'elbow', 'elbows') + ' by itself.';
  }
  function returnPayoff() {
    const p = partsOf(hwr());
    return 'That is ' + fmt(K().feetFor(C().RE.hwr)) + ' more feet of pipe and ' + plural(p.hangers, 'hanger', 'hangers') + '. Most bids miss this line, because it looks like the hot supply.';
  }

  // ----- riser: P-601's stack, then the cleanout at its base -------------------------------------------
  const pvc4 = () => K().lineTypeNamed(C().RE.pvc4);
  const co = () => K().counterNamed(C().RE.co);
  function seedRiser() {
    K().setScale(P601(), 18, '1/4" = 1\'');
    if (!pvc4()) K().makeLineType('4in PVC', '#8a4bb0');
  }
  const STACK = makeRun({
    page: P601, lt: pvc4, spots: () => C().raw(C().R.stack),
    lay: () => C().traceSheet(pvc4() || K().makeLineType('4in PVC', '#8a4bb0'), C().R.stack, 'Stack', P601()),
  });
  const stackFeet = () => {
    const lt = pvc4(), a = K().pageAnn(P601()), ppu = (App.getPageScale(P601()) || {}).pixelsPerUnit;
    if (!lt || !a || !(ppu > 0)) return 0;
    return (a.polylines || []).filter((pl) => pl.lineTypeId === lt.id).reduce((n, pl) => n + runLength(pl.points || []) / ppu, 0);
  };
  const coSpots = () => C().raw(C().R.co);
  const coZones = () => T().markZones(P601(), (co() || {}).id || '__none__', coSpots(), R);
  function armCo() { const c = co() || C().pick('co'); K().goPage(P601()); S().activeCounterType = c.id; S().tool = App.TOOL.COUNTER; App.updateUI(); }

  // ----- scale: P-101 at 1/8", proved on the 31'-8" string --------------------------------------------
  // A click a finger wide lands within a circle's 30 points of the tick, about 3 feet at 1/8": the proof
  // allows two of those, and still refuses a wrong scale (1/4" reads the string near 16 feet).
  const proof = () => K().memoProof('demo-plumbing:P101', () => ({ page: P101(), ends: C().pts(C().G.dim318), r: R, ft: 31.67, tol: 6, stated: '31\'-8"' }));
  function seedScale() { const p = S().pages[P101()]; if (p) p.scale = null; }   // the moment is setting it
  function armMeasure() {
    if (proof().check()) return;
    K().goPage(P101());
    if (S().tool !== App.TOOL.MEASURE && el('measureBtn')) el('measureBtn').click();
  }

  // ----- bid: the whole takeoff, the pipe it caught, a signed row ------------------------------------
  // The course's whole takeoff ("Finish the takeoff for me") chains the restroom lavatories on 0.75in
  // Copper CW and gives that branch no hanger rule and no fittings from bends: Bid Check's two auto rows
  // catch it as laid. Nothing here stages the miss; the demo only offers to fix it.
  function seedBid() { C().layEverything(); S().activeGroupId = null; K().dirty(); }
  const bidOpen = () => S().bidCheckCollapsed === false;
  const autoRows = () => (App.getBidCheck ? App.getBidCheck().auto : []) || [];
  const okRows = () => autoRows().filter((r) => r.verdict === 'ok').length;
  const warnRows = () => autoRows().filter((r) => r.verdict === 'warn').length;
  // the pipe the rows name: a type whose name gives a material the hanger rule reads, counting no hangers
  const shortPipes = () => { const sm = window.SupportModel; return sm ? (S().lineTypes || []).filter((lt) => sm.supportMaterialFromName(lt.name) && !sm.lineTypeCountsHangers(lt)) : []; };
  function caughtPayoff() {
    const short = shortPipes();
    if (!warnRows() || !short.length) return plural(okRows(), 'row', 'rows') + ' checked themselves against your takeoff. The code rows wait for you to sign.';
    return 'Bid Check caught a pipe the bid left short: ' + short.map((lt) => lt.name).join(', ') + ' counts no hangers and no elbows. Caught now, it costs you nothing.';
  }
  function fixShortPipes() {
    const sm = window.SupportModel;
    (S().lineTypes || []).filter((lt) => sm && sm.supportMaterialFromName(lt.name)).forEach((lt) => { C().addHangerRule(lt); C().enableBends(lt); });
    if (App.renderBidCheck) App.renderBidCheck();
    App.updateUI();
  }
  const fixed = () => autoRows().length > 0 && !warnRows();

  App.registerDemo({
    trade: 'plumbing',
    get set() { return C().SET; },   // the course's lesson set, read when a moment opens it
    // decision 3: the one card before the first moment of the session
    orientation: {
      id: 'welcome', title: 'A restaurant\'s plumbing, in a few clicks',
      body: (clicks, layout) => 'This is a plan of a small restaurant\'s plumbing, and ' + (layout && layout.narrow ? 'the ☰ menu keeps' : 'the lists on the left keep') + ' its totals.\nAbout ' + clicks + ' clicks are coming, one per card, and nothing here touches your own work.',
    },
    moments: [
      {
        id: 'schedule', title: 'The schedule makes your counters', page: 2,
        seed: seedSchedule,
        steps: [
          { id: 'box', title: 'The schedule makes your counters', kind: 'do', page: 2,
            body: 'Drag a box around the whole fixture schedule, inside the shaded band.',
            answer: () => { const m = made(); return 'That made ' + plural(m.length, 'counter', 'counters') + ', ' + m.map(tagOf).join(', ') + '. Each is named the way the plan tags it, and nobody typed a name.'; },
            onEnter: armScheduleBox,
            zones: scheduleZone,
            target: ['#schedulePaletteCreate', '#annCanvas'],
            check: () => { createWhenRead(); return made().length > 0 && !K().modalUp('schedulePaletteModal'); },
            action: { label: 'Read it', run: async () => { if (made().length) return; await C().readSchedule(); disarm(); } } },
          { id: 'count', title: 'Count with them', kind: 'do', clicks: 2, page: 0,
            body: 'Click the two circles: the toilets in MEN and WOMEN.',
            answer: () => { const c = wc(), n = (K().marksOf(c) || 0); return plural(n, 'toilet', 'toilets') + ' counted under ' + (c ? tagOf(c) : 'WC-1') + '. Every click is a fixture on the bid, under the plan\'s own name.'; },
            onEnter: armWc,
            zones: wcZones,
            target: ['#annCanvas'],
            check: () => T().allDone(wcZones()),
            action: { label: 'Count them', run: () => { const c = wc() || C().pick('wc'); K().goPage(P101()); App.pushUndoSnapshotCurrentPage(); C().markMissing(c, K().WCS); K().dirty(); } } },
        ],
      },
      {
        id: 'pipe', title: 'Trace the pipe, get the parts it needs', page: 0,
        seed: seedPipe,
        steps: [
          { id: 'trace', title: 'Trace the pipe, get the parts it needs', kind: 'do', clicks: 4, page: 0,
            body: 'Click the four circles in order, starting at the bottom.',
            answer: trunkPayoff,
            onEnter: () => { TRUNK.arm(); },
            zones: TRUNK.zones,
            target: ['#annCanvas'],
            check: () => { TRUNK.finishWhenTraced(); return TRUNK.done(); },
            action: { label: 'Trace it', run: TRUNK.forMe } },
          { id: 'return', title: 'The line most bids miss', kind: 'do', clicks: 2, page: 0,
            body: 'Click the two circles on the dotted line, top first.',
            answer: returnPayoff,
            onEnter: () => { RETURN.arm(); },
            zones: RETURN.zones,
            target: ['#annCanvas'],
            check: () => { RETURN.finishWhenTraced(); return RETURN.done(); },
            action: { label: 'Trace it', run: RETURN.forMe } },
        ],
      },
      {
        id: 'riser', title: 'The vertical feet the plan cannot show', page: 3,
        seed: seedRiser,
        steps: [
          { id: 'stack', title: 'The vertical feet the plan cannot show', kind: 'do', clicks: 2, page: 3,
            body: 'Click the two circles: the bottom of the stack, then its top above the roof.',
            answer: () => 'That is ' + fmt(stackFeet()) + ' feet of 4 inch pipe, standing up. The floor plan shows it as one small circle.',
            onEnter: () => { STACK.arm(); },
            zones: STACK.zones,
            target: ['#annCanvas'],
            check: () => { STACK.finishWhenTraced(); return STACK.done(); },
            action: { label: 'Trace it', run: STACK.forMe } },
          { id: 'cleanout', title: 'And what sits at its base', kind: 'do', page: 3,
            body: 'Click the circle at the base of the stack: its cleanout.',
            answer: () => 'The bid now carries the ' + fmt(stackFeet()) + ' feet of stack and the cleanout under it. Most bids miss both.',
            onEnter: armCo,
            zones: coZones,
            target: ['#annCanvas'],
            check: () => T().allDone(coZones()),
            action: { label: 'Count it', run: () => { const c = co() || C().pick('co'); K().goPage(P601()); App.pushUndoSnapshotCurrentPage(); C().markMissing(c, coSpots(), P601()); K().dirty(); } } },
        ],
      },
      {
        id: 'scale', title: 'Prove the scale before you count', page: 0,
        seed: seedScale,
        steps: [
          { id: 'set', title: 'Prove the scale before you count', kind: 'do', clicks: 2,
            // Set Scale stays in the header on a phone too (the first tools the narrow header keeps)
            body: 'The title block says 1/8" = 1\'-0". Click [[Set Scale]] in the header, then [[1/8" = 1\']].',
            answer: 'Set, in two clicks. But a plan shrunk to print still says 1/8", and then every foot on it reads short.',
            target: ['#setScale', '#setScaleSidebar', '#scalePresetsList'],
            check: () => K().scaleIs(P101(), 9),
            action: { label: 'Set it', run: async () => { K().goPage(P101()); await T().applyScalePreset('1/8" = 1\'', 9); } } },
          { id: 'measure', title: 'Measure what the plan wrote', kind: 'do', clicks: 2, page: 0,
            body: 'Click the two circles, the ends of the 31\'-8" dimension over the kitchen.',
            answer: () => proof().verdict() + '. The scale is right, so every foot on this sheet is too.',
            onEnter: armMeasure,
            zones: () => proof().zones(),
            hint: () => proof().hint(),
            target: ['#annCanvas'],
            check: () => proof().check(),
            action: { label: 'Measure it', run: async () => { K().goPage(P101()); if (!K().scaleIs(P101(), 9)) await T().applyScalePreset('1/8" = 1\'', 9); const d = C().pts(C().G.dim318); K().measure(d[0], d[1]); } } },
        ],
      },
      {
        id: 'bid', title: 'It checks the bid against the code', page: 0,
        seed: seedBid,
        steps: [
          { id: 'open', title: 'It checks the bid against the code', kind: 'do',
            rules: ['plumb.hanger.copper'],
            body: () => (narrow() ? 'Tap ☰, then tap BID CHECK to open it.' : 'Click BID CHECK in the sidebar to open it.'),
            answer: caughtPayoff,
            onEnter: () => T().foldBidCheck(),
            target: () => T().bidCheckRows('demo:plumbing:bid', ['hangers', 'bend-fittings']), lightAll: true,
            check: bidOpen,
            action: { label: 'Open it', run: () => K().openBidCheck() } },
          { id: 'fix', title: 'Fix it before it costs you', kind: 'do', handsOff: true,
            body: 'Click Fix it, and that branch counts its hangers and elbows like the rest.',
            answer: () => plural(okRows(), 'row', 'rows') + ' now check themselves. Every pipe on the bid counts its hangers and its elbows.',
            target: () => T().bidCheckRows('demo:plumbing:bid', ['hangers', 'bend-fittings']), lightAll: true,
            check: fixed,
            action: { label: 'Fix it', run: () => { if (!bidOpen()) K().openBidCheck(); fixShortPipes(); } } },
          { id: 'sign', title: 'Sign what you checked', kind: 'do',
            body: () => (narrow() ? 'Tap ☰ if the sidebar is shut, then tap the row Fixture units checked against the building drain size.' : 'Click the row that reads Fixture units checked against the building drain size.'),
            answer: 'Signed. That tick goes out with the bid. The whole plumbing course is in [[Learn]].',
            target: ['#bidCheckList [data-row-id="fixture-units"]', '#bidCheckSectionTitle'],
            check: () => C().manual('fixture-units'),
            action: { label: 'Sign it', run: () => K().tickManual('fixture-units') } },
        ],
      },
    ],
  });
})();
