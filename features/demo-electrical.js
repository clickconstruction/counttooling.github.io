/*
 * features/demo-electrical.js - the electrical demo track (DEMO-TRACK, journeys/plans/DEMO-TRACK.md):
 * five moments on the electrical set, behind the test drive's "Try it". Not the course: a stranger
 * with two minutes gets one action per card and what it was worth, in money, time or a caught
 * mistake. The engine is features/demo-track.js (the orientation card, the quiet UI, "Do it for me",
 * the doors /app/?demo=electrical and /app/?demo=electrical:<moment>).
 *
 *   gfci      It catches the outlet that needs a GFCI   the kitchen outlet drawn plain: counted as a GFCI, then flagged
 *   wire      Draw the conduit, get the wire            Chain the dining room's west wall; conduit feet and wire feet
 *   circuit   A circuit that checks itself              the homerun to LP-1; voltage drop warns at 12 A, clears at 6 A
 *   fill      How full may a conduit be?                the feeder from the main to LP-1; its fill against the 40% limit
 *   handoff   Check it, prove it, hand it off           Bid Check, a signed row, Show Report
 *
 * The plain kitchen outlet is the sample set's STAGED miss (scripts/sample-electrical.js draws it
 * plain on purpose, as the course's chapter 2 teaches), and the card says so, as the HVAC demo's
 * addendum does. Every seed, point and reader is the electrical course's (App.courseElectricalKit,
 * features/course-electrical.js) or the lessons' (App.lessonKit); this file copies none of them.
 * Every number a card quotes is read live off the takeoff (`answer: () => ...`), so it cannot drift.
 *
 * Registrations: none of its own (App.registerDemo does them). Boundary rule: read shared deps from
 * App.* at call time, never captured at load; the one exception is the registerDemo call at the foot
 * (features/demo-track.js loads first).
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const E = () => App.courseElectricalKit;
  const K = () => App.lessonKit;
  const T = () => App.tourKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const E101 = 0;
  const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
  const ft1 = (n) => String(Math.round((n || 0) * 10) / 10);
  // The sidebar is a drawer behind ☰ on a narrow layout (styles.css max-width: 768px, the engine's own
  // isNarrow): a card that sends the guest to the sidebar says to open it first there.
  const narrow = () => { try { if (window.matchMedia('(max-width: 768px)').matches) return true; } catch (_) { /* older engines */ } const h = el('hamburger'); return !!h && h.getClientRects().length > 0 && getComputedStyle(h).display !== 'none'; };
  const openBidCheckWords = () => (narrow() ? 'Tap ☰, then tap BID CHECK to open it.' : 'Click BID CHECK in the sidebar to open it.');
  // A demo circle is a finger wide on a tablet: 30 sheet points, as the HVAC demo's (the engine's own
  // floor is 26 px on screen). Every on-sheet card here uses it.
  const R = 30;
  const circle = (pt, done) => ({ kind: 'circle', x: pt.x, y: pt.y, r: R, done: !!done });
  const bidOpen = () => S().bidCheckCollapsed === false;
  // A line type's conductors as a guest would say them: "two #12 wires and a #12 ground".
  const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const say = (n) => WORDS[n] || String(n);
  const gauge = (g) => { const t = String(g || '').trim(); return t.charAt(0) === '#' ? t : '#' + t; };
  function spec(lt) {
    const cs = (lt && lt.conductors) || [];
    const hot = cs.filter((c) => c.role !== 'ground'), gr = cs.filter((c) => c.role === 'ground');
    const n = hot.reduce((a, c) => a + (c.n || 0), 0), g = gr.reduce((a, c) => a + (c.n || 0), 0);
    if (!n) return 'its wires';
    const wires = say(n) + ' ' + gauge(hot[0].gauge) + ' wire' + (n === 1 ? '' : 's');
    return g ? wires + ' and ' + (g === 1 ? 'a' : say(g)) + ' ' + gauge(gr[0].gauge) + ' ground' + (g === 1 ? '' : 's') : wires;
  }

  // ----- traces: armed on the card, finished for the guest -------------------------------------------
  // A polyline of `lt` armed the way Polyline arms it with a line type active (no dialog), in the circuit
  // when one is named, so the run the guest draws joins it.
  function armTrace(lt, groupId) {
    const s = S();
    if (!lt || s.drawingPolyline) return;
    K().goPage(E101);
    s.activeLineTypeId = lt.id;
    s.activeGroupId = groupId || null;
    if (el('polylineBtn')) el('polylineBtn').click();
  }
  const runsOf = (re) => { const out = E().polylinesOn(re, E101).map((pl) => pl.points || []); const d = S().drawingPolyline; if (d && d.points && E().typeIds(re).has(d.lineTypeId)) out.push(d.points); return out; };
  const traceZones = (re, path) => T().pathZones(E().pts(path), R, runsOf(re));
  // A visibly right trace counts even when a corner missed its circle (the HVAC demo's rule): its feet
  // within 10% of the path's and its two ends within a circle of the path's two ends, either way round.
  function visiblyRight(points, path) {
    const v = points || [];
    if (v.length < 2) return false;
    const ppu = (App.getPageScale(E101) || {}).pixelsPerUnit;
    if (!(ppu > 0)) return false;
    let len = 0; for (let i = 1; i < v.length; i++) len += Math.hypot(v[i].x - v[i - 1].x, v[i].y - v[i - 1].y);
    const want = E().planFeet(path);
    if (Math.abs(len / ppu - want) > want * 0.1) return false;
    const p = E().pts(path), a = p[0], b = p[p.length - 1], near = (q, r) => Math.hypot(q.x - r.x, q.y - r.y) <= R;
    const first = v[0], last = v[v.length - 1];
    return (near(first, a) && near(last, b)) || (near(first, b) && near(last, a));
  }
  const traced = (re, path) => E().polylinesOn(re, E101).some((pl) => T().allDone(T().pathZones(E().pts(path), R, [pl.points || []])) || visiblyRight(pl.points, path));
  // The last circle (or a visibly right path) ends the run: the demo presses Finish (decision 2).
  let finishing = false;
  function finishWhenTraced(re, path) {
    const d = S().drawingPolyline;
    if (finishing || !d || !E().typeIds(re).has(d.lineTypeId) || (d.points || []).length < 2) return;
    if (!T().allDone(T().pathZones(E().pts(path), R, [d.points])) && !visiblyRight(d.points, path)) return;
    finishing = true;
    setTimeout(() => { finishing = false; if (S().drawingPolyline && el('finishPolyline')) el('finishPolyline').click(); }, 250);
  }
  const zonesFor = (re, path) => { const zs = traceZones(re, path); if (traced(re, path)) zs.forEach((z) => { z.done = true; }); return zs; };
  function traceForMe(lt, path, name) {
    const s = S();
    if (s.drawingPolyline) { s.drawingPolyline = null; }
    App.pushUndoSnapshotCurrentPage();
    E().tracePlan(lt, path, name, E101);
    s.tool = App.TOOL.NONE;
    K().dirty();
  }

  // ----- gfci: the kitchen outlet the sample set draws plain ---------------------------------------------
  const MISSED = () => E().pts(E().G.missed)[0];
  const gfci = () => E().counter(E().RE.gfci);
  const gfciCount = () => E().marksOf(gfci(), E101).length;
  const caughtAsGfci = () => !!gfci() && E().markNear(gfci(), MISSED(), R, E101);
  function seedGfci() {
    const k = E();
    k.scaleE101();
    k.markMissing(k.pick('duplex'), k.plainDuplex().slice(4), E101);   // not the west wall's four: the wire moment chains them
    k.markMissing(k.pick('gfci'), k.pts(k.G.gfci), E101);              // the ten the engineer drew
  }
  function armGfci() { const c = E().pick('gfci'); K().goPage(E101); S().activeCounterType = c.id; S().tool = App.TOOL.COUNTER; App.updateUI(); }
  const RFI = 'RFI: Drawn as a plain outlet in the kitchen. Bid it as a GFCI?';
  const flagged = () => E().notesNear(MISSED(), R + 10, E101).length > 0;
  function armNote() { if (flagged()) return; K().goPage(E101); S().tool = App.TOOL.NOTE; App.updateUI(); }
  // The Add Note dialog a click opens: the demo writes the question and presses Done (decision 2), once
  // the dialog has stood long enough to be seen. A guest who changed the words presses Done themselves.
  let noteSeenAt = 0;
  function doneNoteWhenOpen() {
    if (!K().modalUp('noteModal')) { noteSeenAt = 0; return; }
    const t = el('noteModalText');
    if (t && !t.value.trim()) t.value = RFI;
    if (!noteSeenAt) { noteSeenAt = Date.now(); return; }
    if (Date.now() - noteSeenAt < 900 || !t || t.value !== RFI) return;
    noteSeenAt = 0;
    if (el('noteModalDone')) el('noteModalDone').click();
    S().tool = App.TOOL.NONE;
  }

  // ----- wire: the dining room's west wall, chained ------------------------------------------------------
  const WEST = () => E().pts(E().G.diningW);
  const emt = () => E().lineType(E().RE.emt75);
  function seedWire() {
    const k = E();
    k.scaleE101();
    k.setCeiling();
    k.markMissing(k.pick('duplex'), k.plainDuplex().slice(4), E101);
    k.markMissing(k.pick('gfci'), k.gfciAll(), E101);
    k.makeEmt();
  }
  const chainLines = () => ((E().pageAnn(E101) || {}).quickLines || []).filter((l) => emt() && l.lineTypeId === emt().id);
  const westZones = () => { const d = E().counter(E().RE.duplex); return T().markZones(E101, (d || {}).id || '__none__', WEST(), R); };
  const chained = () => chainLines().length >= 3 && T().allDone(westZones());
  function selectChain() { const s = S(), d = E().pick('duplex'), lt = E().makeEmt(); s.activeCounterType = d.id; s.activeLineTypeId = lt.id; }
  function armChain() {
    if (chained()) return;
    K().goPage(E101);
    selectChain();
    if (S().tool !== App.TOOL.CHAIN) { S().tool = App.TOOL.CHAIN; S().chainStart = null; }
    // the panel would sit over the circles: the tool stays armed with it closed (features/chain.js)
    if (App.closeChainPanel) App.closeChainPanel();
    App.updateUI();
  }
  // the fourth circle ends the chain, as Enter then Esc would
  function endChainWhenDone() {
    if (!chained() || S().tool !== App.TOOL.CHAIN) return;
    S().chainStart = null; S().tool = App.TOOL.NONE;
    if (App.closeChainPanel) App.closeChainPanel();
    App.updateUI();
  }
  function wirePayoff() {
    const conduit = K().feetFor(E().RE.emt75, E().RE.hr);
    const byGroup = (App.getConductorTotals ? App.getConductorTotals() : {}).byGroup || {};
    let wire = 0; Object.values(byGroup).forEach((g) => (g.wire || []).forEach((r) => { if (String(r.gauge || '').replace(/^#/, '') === '12') wire += r.feet || 0; }));
    return 'That is ' + ft1(conduit) + ' feet of conduit, the drops down to each box included. It holds ' + fmt(wire) + ' feet of #12 wire, and nobody typed a foot.';
  }

  // ----- circuit: the homerun, then the voltage-drop row -------------------------------------------------
  const HR_PATH = () => E().G.homerun1;
  function seedCircuit() {
    const k = E();
    k.scaleE101();
    k.setCeiling();
    k.markMissing(k.pick('duplex'), k.plainDuplex().slice(4), E101);
    k.markMissing(k.pick('gfci'), k.gfciAll(), E101);
    k.chainWestWall();
    k.markMissing(k.pick('panel'), k.pts(k.G.panel), E101);
    k.makeHomerun();
    const g = k.circuitOne();
    delete g.loadAmps;   // the app's own 12 A until the schedule's load is given
  }
  const homerunDone = () => traced(E().RE.hr, HR_PATH()) && !S().drawingPolyline;
  function armHomerun() { if (homerunDone()) return; const g = E().circuit1(); armTrace(E().makeHomerun(), g && g.id); }
  const vdRow = () => E().bidRow('voltage-drop');
  // the row's own words: "LP-1-1 · 95 ft · 12 A · #12 3.4% ⚠ → #10 2.1% ✓ (at 120 V)"
  function vd() {
    const r = vdRow();
    const m = r && /·\s*(\d+)\s*ft\s*·\s*([\d.]+)\s*A\s*·\s*(#\S+)\s+([\d.]+)%\s*(?:✓|⚠)(?:\s*→\s*(#\S+)\s+([\d.]+)%)?/.exec(r.detail || '');
    return m ? { verdict: r.verdict, far: Number(m[1]), amps: Number(m[2]), gauge: m[3], pct: m[4], up: m[5] || '' } : { verdict: r ? r.verdict : 'na', far: 0, amps: 0, gauge: '', pct: '0', up: '' };
  }
  function useScheduledLoad() {
    const g = E().circuitOne();
    if (g.loadAmps === 6) return;
    App.pushUndoSnapshot();
    g.loadAmps = 6;
    K().dirty();
    if (App.renderBidCheck) App.renderBidCheck();
  }

  // ----- fill: the feeder from the main disconnect to LP-1 -----------------------------------------------
  const FEEDER = () => E().G.feeder;
  function seedFill() {
    const k = E();
    k.scaleE101();
    k.markMissing(k.pick('panel'), k.pts(k.G.panel), E101);
    k.markMissing(k.pick('meter'), k.pts(k.G.meter), E101);
    k.markMissing(k.pick('disc'), k.pts(k.G.mdp), E101);
    k.makeFeeder();
  }
  const feederDone = () => traced(E().RE.emt2, FEEDER()) && !S().drawingPolyline;
  function armFeeder() { if (feederDone()) return; armTrace(E().makeFeeder(), null); }
  // the feeder's fill, the same arithmetic the conduit-fill row runs (bid-check-model.js conduitFill)
  const feederFill = () => { const lt = E().lineType(E().RE.emt2); return lt && window.BidCheckModel ? window.BidCheckModel.conduitFill(lt.raceway, lt.conductors) : null; };
  const pct = (p) => String(Math.round((p || 0) * 1000) / 10);

  // ----- handoff: the course's finished takeoff ----------------------------------------------------------
  const autoRows = () => ((App.getBidCheck ? App.getBidCheck().auto : []) || []);
  const reportAsked = { on: false };
  document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#printReport, .show-report-option')) reportAsked.on = true; }, true);

  App.registerDemo({
    trade: 'electrical',
    get set() { return E().ESET; },   // the course's electrical set, read when a moment opens it
    // decision 3: the one card before the first moment of the session
    orientation: {
      id: 'welcome', title: 'A restaurant\'s wiring, in a few clicks',
      body: (clicks, layout) => 'This is a plan of a small restaurant\'s wiring, and ' + (layout && layout.narrow ? 'the ☰ menu keeps' : 'the lists on the left keep') + ' its totals.\nAbout ' + clicks + ' clicks are coming, one per card, and nothing here touches your own work.',
    },
    moments: [
      {
        id: 'gfci', title: 'It catches the outlet that needs a GFCI', page: E101,
        seed: seedGfci,
        steps: [
          { id: 'count', title: 'It catches the outlet that needs a GFCI', kind: 'do', page: E101,
            rules: ['elec.gfci.non-dwelling'],
            body: 'Click the circled outlet in the kitchen. It was drawn as a plain one.',
            answer: () => 'That makes ' + gfciCount() + ' GFCI outlets, not ' + (gfciCount() - 1) + '. This sample plan leaves one plain on purpose, and the code wants every kitchen outlet protected.',
            onEnter: armGfci,
            zones: () => [circle(MISSED(), caughtAsGfci())],
            target: ['#annCanvas'],
            check: caughtAsGfci,
            action: { label: 'Count it', run: () => { K().goPage(E101); App.pushUndoSnapshotCurrentPage(); E().markMissing(E().pick('gfci'), [MISSED()], E101); S().tool = App.TOOL.NONE; K().dirty(); } } },
          { id: 'flag', title: 'Ask before you bid', kind: 'do', page: E101,
            body: 'Click the same outlet again to pin a question on it.',
            answer: 'The question is on the plan for the engineer. Caught before you bid, the people who drew it pay for it.',
            onEnter: () => { noteSeenAt = 0; armNote(); },
            zones: () => [circle(MISSED(), flagged())],
            target: ['#noteModalDone', '#annCanvas'],
            check: () => { doneNoteWhenOpen(); return flagged() && !K().modalUp('noteModal'); },
            action: { label: 'Flag it', run: () => { if (K().modalUp('noteModal') && el('noteModalCancel')) el('noteModalCancel').click(); K().addNote(MISSED(), RFI, '#e85447'); } } },
        ],
      },
      {
        id: 'wire', title: 'Draw the conduit, get the wire', page: E101,
        seed: seedWire,
        steps: [
          { id: 'chain', title: 'Draw the conduit, get the wire', kind: 'do',
            body: () => (narrow() ? 'Tap [[Chain]] in the bar across the top.' : 'Click [[Chain]] in the header.'),
            answer: () => 'Chain counts an outlet and draws the conduit to it in one click. This conduit knows its wires: ' + spec(emt()) + '.',
            onEnter: selectChain,
            target: ['#chainBtn'],
            check: () => S().tool === App.TOOL.CHAIN || chained(),
            action: { label: 'Open Chain', run: () => { if (S().tool === App.TOOL.CHAIN || chained()) return; K().goPage(E101); selectChain(); if (el('chainBtn')) el('chainBtn').click(); } } },
          { id: 'wall', title: 'Four outlets, one click each', kind: 'do', clicks: 4, page: E101,
            body: 'Click the four circles on the dining room\'s west wall, top to bottom.',
            answer: wirePayoff,
            onEnter: armChain,
            zones: () => { const zs = westZones(); if (chained()) zs.forEach((z) => { z.done = true; }); return zs; },
            target: ['#annCanvas'],
            check: () => { endChainWhenDone(); return chained(); },
            action: { label: 'Chain them', run: () => { if (chained()) return; S().chainStart = null; E().chainWestWall(); K().dirty(); } } },
        ],
      },
      {
        id: 'circuit', title: 'A circuit that checks itself', page: E101,
        seed: seedCircuit,
        steps: [
          { id: 'homerun', title: 'A circuit that checks itself', kind: 'do', clicks: 4, page: E101,
            body: 'Click the four circles, from the top outlet up, across, and down to the panel.',
            answer: () => 'That homerun is ' + ft1(K().feetFor(E().RE.hr)) + ' feet. Circuit 1 now reaches from panel LP-1 to its farthest outlet, ' + fmt(vd().far) + ' feet away.',
            onEnter: armHomerun,
            zones: () => zonesFor(E().RE.hr, HR_PATH()),
            target: ['#annCanvas'],
            check: () => { finishWhenTraced(E().RE.hr, HR_PATH()); return homerunDone(); },
            action: { label: 'Trace it', run: () => { if (homerunDone()) return; traceForMe(E().makeHomerun(), HR_PATH(), 'Homerun, circuit 1'); E().circuitOne(); } } },
          { id: 'drop', title: 'Is the wire big enough?', kind: 'do',
            rules: ['elec.voltage-drop.branch-limit'],
            body: openBidCheckWords,
            answer: () => { const v = vd(); return v.verdict === 'warn' ? '⚠ At ' + v.amps + ' amps the far outlet loses ' + v.pct + '% of its voltage, over the 3% the code advises. The app names the fix, ' + v.up + ' wire.' : 'At ' + v.amps + ' amps the far outlet loses ' + v.pct + '% of its voltage, within the 3% the code advises.'; },
            onEnter: () => T().foldBidCheck(),
            target: () => T().bidCheckRows('demo:electrical:circuit', ['voltage-drop']), lightAll: true,
            check: () => bidOpen() && !!vdRow() && vdRow().verdict !== 'na',
            action: { label: 'Open it', run: () => K().openBidCheck() } },
          { id: 'load', title: 'The load on the schedule', kind: 'do', handsOff: true,
            rules: ['elec.voltage-drop.branch-limit'],
            body: 'The app guessed 12 amps. The panel schedule says circuit 1 draws 6, so click Use 6 amps.',
            answer: () => { const v = vd(); return '✓ At ' + v.amps + ' amps the drop is ' + v.pct + '%, under 3%. The engineer\'s ' + v.gauge + ' wire holds, checked while you counted.'; },
            target: () => T().bidCheckRows('demo:electrical:circuit', ['voltage-drop']), lightAll: true,
            check: () => { const g = E().circuit1(); return !!(g && g.loadAmps === 6 && vdRow() && vdRow().verdict === 'ok'); },
            action: { label: 'Use 6 amps', run: () => { if (!bidOpen()) K().openBidCheck(); useScheduledLoad(); } } },
        ],
      },
      {
        id: 'fill', title: 'How full may a conduit be?', page: E101,
        seed: seedFill,
        steps: [
          { id: 'feeder', title: 'How full may a conduit be?', kind: 'do', clicks: 2, page: E101,
            body: 'Click the two circles, from the main switch outside up to panel LP-1.',
            answer: () => 'That is ' + ft1(K().feetFor(E().RE.emt2)) + ' feet of 2 inch conduit. It carries ' + spec(E().lineType(E().RE.emt2)) + ', the feeder for the whole panel.',
            onEnter: armFeeder,
            zones: () => zonesFor(E().RE.emt2, FEEDER()),
            target: ['#annCanvas'],
            check: () => { finishWhenTraced(E().RE.emt2, FEEDER()); return feederDone(); },
            action: { label: 'Trace it', run: () => { if (feederDone()) return; traceForMe(E().makeFeeder(), FEEDER(), 'Feeder'); } } },
          { id: 'limit', title: 'The code\'s limit', kind: 'do',
            rules: ['elec.conduit.fill-limit'],
            body: openBidCheckWords,
            answer: () => { const f = feederFill() || {}; return '✓ Those wires fill ' + pct(f.pct) + '% of the conduit, and the code allows ' + pct(f.limit) + '%. The § beside the row names the table, so the number holds up.'; },
            onEnter: () => T().foldBidCheck(),
            target: () => T().bidCheckRows('demo:electrical:fill', ['conduit-fill']), lightAll: true,
            check: () => bidOpen() && !!E().bidRow('conduit-fill') && E().bidRow('conduit-fill').verdict === 'ok',
            action: { label: 'Open it', run: () => K().openBidCheck() } },
        ],
      },
      {
        id: 'handoff', title: 'Check it, prove it, hand it off', page: E101,
        seed: () => { E().layEverything(); S().activeGroupId = null; },
        steps: [
          { id: 'check', title: 'Check it, prove it, hand it off', kind: 'do',
            body: openBidCheckWords,
            answer: () => { const ok = autoRows().filter((r) => r.verdict === 'ok').length, warn = autoRows().filter((r) => r.verdict === 'warn').length; return ok + ' rows checked themselves' + (warn ? ', and ' + warn + ' say what is not drawn yet' : '') + '. The rest wait for you to sign.'; },
            onEnter: () => T().foldBidCheck(),
            target: () => T().bidCheckRows('demo:electrical:handoff'), lightAll: true,
            check: bidOpen,
            action: { label: 'Open it', run: () => K().openBidCheck() } },
          { id: 'sign', title: 'Sign what you checked', kind: 'do',
            body: () => (narrow() ? 'Tap ☰ if the sidebar is shut, then tap the row Scale verified on every counted sheet.' : 'Click the row that reads Scale verified on every counted sheet.'),
            answer: 'Signed. That tick goes out with the bid.',
            target: ['#bidCheckList [data-row-id="scale-verified"]', '#bidCheckSectionTitle'],
            check: () => E().manual('scale-verified'),
            action: { label: 'Sign it', run: () => K().tickManual('scale-verified') } },
          { id: 'report', title: 'Hand it off', kind: 'do',
            body: () => (narrow() ? 'Tap ☰, then near the bottom tap [[Show Report]].' : 'Under EXPORT OPTIONS in the sidebar, click [[Show Report]].'),
            answer: 'Pick This sheet or Every sheet, and the report your customer reads opens. The whole electrical course is in [[Learn]].',
            onEnter: () => { reportAsked.on = false; },
            target: ['#showReportMenu', '#printReport', '#exportOptionsSectionTitle'],
            check: () => reportAsked.on,
            action: { label: 'Show it', run: () => { if (el('printReport')) el('printReport').click(); } } },
        ],
      },
    ],
  });
})();
