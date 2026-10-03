/*
 * features/demo-hvac.js - the HVAC demo track (DEMO-TRACK, journeys/plans/DEMO-TRACK.md): five
 * moments on the mechanical set, behind the test drive's "Try it". Not the course: a stranger with
 * two minutes gets one action per card and what it was worth, in money, time or a caught mistake.
 * The engine is features/demo-track.js (the orientation card, the quiet UI, "Do it for me", the
 * doors /app/?demo=hvac and /app/?demo=hvac:<moment>).
 *
 *   size      The plan tells you the duct size      Duct reads 24x12 off M-101; trace the main's first leg
 *   pounds    Pounds of sheet metal, in one number  the Duct Schedule's Bid weight, then Copy Schedule
 *   rooms     Every room knows its air              box DINING 100, then fill it with its eight diffusers
 *   mistake   It catches the mistake in the plans   Bid Check's Systems within capacity turns ✓ to ⚠
 *   handoff   Check it, sign it, hand it off        Bid Check, a signed row, Show Report
 *
 * Every seed, point and reader is the HVAC course's (App.courseHvacKit, features/course-hvac.js) or
 * the lessons' (App.lessonKit); this file copies none of them. Every number a card quotes is read
 * live off the takeoff (`answer: () => ...`), so it cannot drift from the sheet.
 *
 * Registrations: none of its own (App.registerDemo does them). Boundary rule: read shared deps from
 * App.* at call time, never captured at load; the one exception is the registerDemo call at the foot
 * (features/demo-track.js loads first).
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const H = () => App.courseHvacKit;
  const K = () => App.lessonKit;
  const T = () => App.tourKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const M101 = 0;
  const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');

  // ----- size: the main's first leg, 24x12 from the unit to the dining room wall -------------------------
  const LEG = () => H().G.main.slice(0, 6);   // the drop, the hall corner, the dining wall
  const CALLOUT = () => K().P(916, 318);       // beside the printed 24x12 at the drop: where a hand would point
  const committedRuns = () => H().ductRuns(M101).map((r) => r.vertices || []);
  const legDone = () => H().mainDone() || T().allDone(T().pathZones(H().pts(LEG()), 15, committedRuns()));
  let sizeRead = null;   // { size, fromPlan } as the Duct dialog showed it
  function readDuctDialog() {
    if (!K().modalUp('ductCreateModal')) return;
    const note = el('ductCreateCalloutNote');
    // the pointer never visited the sheet (it went straight to the header): point where a hand would
    if ((!note || note.style.display === 'none') && App.syncDuctCalloutPrefill && !sizeRead) { S().mousePos = CALLOUT(); App.syncDuctCalloutPrefill(); }
    const w = (el('ductCreateW') || {}).value, h = (el('ductCreateH') || {}).value;
    const n = el('ductCreateCalloutNote');
    sizeRead = { size: w + 'x' + h, fromPlan: !!(n && n.style.display !== 'none' && /from the plan/i.test(n.textContent || '')) };
  }
  // Tracing armed at the plan's size with its wrap, the way the Duct dialog's Start Tracing arms it.
  async function armDuct() {
    if (S().drawingDuct || legDone()) return;
    K().goPage(M101);
    if (!K().modalUp('ductCreateModal')) { S().mousePos = CALLOUT(); if (el('ductBtn')) el('ductBtn').click(); await wait(80); }
    if (App.setDuctCreateSize) App.setDuctCreateSize(H().RS(24, 12));
    if (el('ductCreateLiner')) el('ductCreateLiner').value = 'wrap';
    if (el('ductCreateStart')) el('ductCreateStart').click();
    await wait(30);
    if (S().drawingDuct) { S().drawingDuct.linerType = 'wrap'; S().drawingDuct.linerThicknessIn = 2; }
  }
  // The third circle ends the leg: the demo presses Finish Duct Run for the guest (decision 2).
  let finishing = false;
  function finishLegWhenTraced() {
    const d = S().drawingDuct;
    if (finishing || !d || !(d.vertices || []).length) return;
    if (!T().allDone(T().pathZones(H().pts(LEG()), 15, [d.vertices]))) return;
    finishing = true;
    setTimeout(() => { finishing = false; if (S().drawingDuct && el('finishDuctRunBtn')) el('finishDuctRunBtn').click(); }, 250);
  }
  function traceLegForMe() {
    if (legDone()) return;
    if (S().drawingDuct && App.clearDuctDraft) App.clearDuctDraft();
    K().goPage(M101);
    App.pushUndoSnapshotCurrentPage();
    H().layRun(LEG(), H().RS(24, 12), null, { wrap: true, name: 'Supply main' });
    S().tool = App.TOOL.NONE;
    K().dirty();
  }
  // A fitting as a guest would say it (duct-model's labels are the schedule's: "90° elbow", "Volume damper").
  const FIT_WORD = { elbow90: 'elbow', elbow45: 'elbow', transition: 'transition', tap: 'tap', boot: 'boot', offset: 'offset', vd: 'damper' };
  // What the trace counted: its feet by size and the fittings the app found, from the Duct Schedule.
  function tracePayoff() {
    const s = App.computeDuctSchedule ? App.computeDuctSchedule() : null;
    if (!s) return 'You traced the main. The app counted its fittings for you.';
    const ft = (s.straightRows || []).reduce((n, r) => n + (r.lengthFt || 0), 0);
    const sizes = [...new Set((s.straightRows || []).map((r) => String(r.sizeKey || '').replace(/×/g, 'x')))];
    const n = {};
    (s.fittingRows || []).forEach((r) => { const w = FIT_WORD[r.type] || 'fitting'; n[w] = (n[w] || 0) + (r.count || 0); });
    const fits = Object.keys(n).map((w) => n[w] + ' ' + w + (n[w] === 1 ? '' : 's'));
    return 'That is ' + fmt(ft) + ' feet of ' + sizes.join(', ') + ' duct. The app counted ' + (fits.length ? fits.join(' and ') : 'its fittings') + ' by itself.';
  }

  // ----- pounds: the set's duct, no system yet ---------------------------------------------------------
  // The size moment's leg goes first, or the main is laid twice over it.
  function dropLeg() {
    const a = K().pageAnn(M101);
    if (!a || !a.ductRuns || H().mainDone()) return;
    a.ductRuns = a.ductRuns.filter((r) => !(H().runSizes(r).join(' ') === '24x12' && (r.vertices || []).length <= 3));
    if (App.reinferDuctFittings) App.reinferDuctFittings(M101);
  }
  function seedDuct() {
    const h = H(), G = h.G, RS = h.RS, RD = h.RD;
    h.scaleM101();
    dropLeg();
    if (!h.mainDone()) h.traceMain();
    if (!h.runWith(['16x10'])) h.layRun(G.kitchen, RS(16, 10), null, { name: 'Kitchen branch' });
    if (!h.runWith(['12x8'])) h.layRun(G.back, RS(12, 8), null, { name: 'Back rooms' });
    if (!h.runWith(['10x8'])) h.layRun(G.bar, RS(10, 8), null, { name: 'Bar' });
    if (!h.runWith(['20x16'])) h.layRun(G.makeup, RS(20, 16), null, { name: 'Make-up air', noSystem: true });
    if (!h.runWith(['8"ø'])) h.layRun(G.exhaust, RD(8), null, { airside: 'exhaust', name: 'Restroom exhaust', noSystem: true });
    if (!h.runWith(['18"ø'])) h.layRun(G.grease, RD(18), null, { airside: 'exhaust', material: 'black-steel', name: 'Hood exhaust', noSystem: true });
  }
  const schedule = () => (App.computeDuctSchedule ? App.computeDuctSchedule() : null) || {};
  let copied = false;   // Copy Schedule was pressed while the card was up
  document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#ductScheduleCopy')) copied = true; }, true);

  // ----- rooms: DINING 100, boxed, then served --------------------------------------------------------
  const DINING = () => H().ROOMS.dining;
  const SD1_DINING = () => H().pts(H().G.SD1).slice(0, 8);
  const sd1 = () => H().byTag('SD-1');
  function seedRoomsMoment() {
    H().scaleM101();
    if (App.setDuctDeckHeight) App.setDuctDeckHeight(12);
    H().pickTag('SD-1');   // the counter the schedule gives, with its 150 CFM: the guest only clicks
  }
  const diningBalance = () => (App.getRoomAirBalance ? App.getRoomAirBalance() : []).find((r) => /dining/i.test(r.name || ''));
  const diningTotals = () => { const r = H().roomNamed(/dining/i); return r && App.getRoomVolumeTotals ? App.getRoomVolumeTotals().find((t) => t.id === r.id) : null; };
  // The Room Size dialog a drag opens: the demo fills what the plan says (the name, the 9'-0" ceiling,
  // the 12'-0" deck) and presses Apply, then gives the room the schedule's 1,200 CFM (decision 2).
  let boxSeenAt = 0;
  function applyBoxWhenDragged() {
    if (!K().modalUp('roomBoxModal')) { boxSeenAt = 0; return; }
    const name = el('roomBoxNewRoomName'), h = el('roomBoxHeight'), deck = el('roomBoxDeck');
    if (name && !name.value.trim()) name.value = DINING().name;
    if (h && !h.value.trim()) h.value = '9';
    if (deck && !deck.value.trim()) deck.value = '12';
    if (!boxSeenAt) { boxSeenAt = Date.now(); return; }
    if (Date.now() - boxSeenAt < 700) return;   // long enough to see the dialog read the plan
    boxSeenAt = 0;
    if (el('roomBoxApply')) el('roomBoxApply').click();
    giveDiningItsAir();
  }
  function giveDiningItsAir() {
    const r = H().roomNamed(/dining/i);
    if (!r || r.targetCfmOverride === DINING().cfm) return;
    r.roomType = 'custom'; r.targetCfmOverride = DINING().cfm;
    S().tool = App.TOOL.NONE;
    K().dirty();
  }
  const diningBoxed = () => { const r = H().roomNamed(/dining/i); return !!(r && r.targetCfmOverride > 0 && H().roomBoxZone(DINING()).done); };
  function armRoomSizer() { if (diningBoxed() || S().tool === App.TOOL.ROOM) return; K().goPage(M101); if (el('roomBtn')) el('roomBtn').click(); }
  function armSd1() { const c = sd1(); if (!c) return; K().goPage(M101); S().activeCounterType = c.id; S().tool = App.TOOL.COUNTER; App.updateUI(); }

  // ----- mistake and handoff: the whole set, RTU-1 carrying its supply ----------------------------------
  const SUPPLY = /^(supply main|kitchen branch|back rooms|bar)$/i;
  function seedWholeSet() {
    H().layEverything();
    // a run laid before RTU-1 existed (the pounds moment, in the all-moments run) joins it now
    const g = H().system();
    (K().pageAnn(M101).ductRuns || []).forEach((r) => { if (g && !r.systemGroupId && SUPPLY.test(r.name || '')) r.systemGroupId = g.id; });
    H().attachAll();
    const sd3 = H().byTag('SD-3'); if (sd3) sd3.cfm = H().TAGS['SD-3'][2];   // the plan as drawn, before any addendum
    S().activeGroupId = null;
    K().dirty();
  }
  const capacityRow = () => H().ductRow('duct-systems-capacity');
  const designed = () => { const g = H().system(); return g && App.getDuctSystemDesignedCfm ? App.getDuctSystemDesignedCfm(g.id) : 0; };
  const capacity = () => (H().system() || {}).capacityCfm || 0;
  const ADDENDUM_CFM = 300;
  function applyAddendum() {
    const c = H().byTag('SD-3');
    if (!c || c.cfm === ADDENDUM_CFM) return;
    App.pushUndoSnapshot();
    c.cfm = ADDENDUM_CFM;
    K().dirty();
    if (App.renderBidCheck) App.renderBidCheck();
  }
  const bidOpen = () => S().bidCheckCollapsed === false;
  const okRows = () => ((App.getBidCheck ? App.getBidCheck().auto : []) || []).filter((r) => r.verdict === 'ok').length;
  const reportAsked = { on: false };
  document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#printReport, .show-report-option')) reportAsked.on = true; }, true);

  App.registerDemo({
    trade: 'hvac',
    get set() { return H().MSET; },   // the course's mechanical set, read when a moment opens it
    // decision 3: the one card before the first moment of the session
    orientation: {
      id: 'welcome', title: 'A restaurant\'s air, in a few clicks',
      body: (clicks) => 'This is a plan of a small restaurant\'s air, and the lists on the left keep its totals.\nAbout ' + clicks + ' clicks are coming, one per card, and nothing here touches your own work.',
    },
    moments: [
      {
        id: 'size', title: 'The plan tells you the duct size', page: M101,
        seed() { H().scaleM101(); sizeRead = null; },
        steps: [
          { id: 'duct', title: 'The plan tells you the duct size', kind: 'do',
            body: 'Click [[Duct]] in the header.',
            answer: () => (sizeRead && sizeRead.fromPlan ? 'It read ' + sizeRead.size + ' off the plan. Nobody typed a size.' : 'The size box is filled in from the sizes printed on the plan.'),
            onEnter: () => { sizeRead = null; if (!S().mousePos) S().mousePos = CALLOUT(); },
            target: ['#ductBtn', '#headerMoreBtn'],
            check: () => { readDuctDialog(); return K().modalUp('ductCreateModal') || !!S().drawingDuct || legDone(); },
            action: { label: 'Open Duct', run: async () => { if (K().modalUp('ductCreateModal') || S().drawingDuct || legDone()) return; S().mousePos = CALLOUT(); if (el('ductBtn')) el('ductBtn').click(); await wait(80); readDuctDialog(); } } },
          { id: 'trace', title: 'Trace the main', kind: 'do', clicks: 3, page: M101,
            body: 'Click the three circles, starting at the unit on the right.',
            answer: tracePayoff,
            onEnter: () => { armDuct(); },
            zones: () => H().traceZones(H().pts(LEG()), M101),
            target: ['#annCanvas'],
            check: () => { finishLegWhenTraced(); return legDone(); },
            action: { label: 'Trace it', run: traceLegForMe } },
        ],
      },
      {
        id: 'pounds', title: 'Pounds of sheet metal, in one number', page: M101,
        seed: seedDuct,
        steps: [
          { id: 'schedule', title: 'Pounds of sheet metal, in one number', kind: 'do',
            body: 'Under DUCT in the sidebar, click [[Schedule]].',
            answer: () => 'That is ' + fmt(schedule().bidWeightLb) + ' pounds of sheet metal. Shops price duct by the pound.',
            target: ['#ductScheduleBtn', '#ductSectionTitle'],
            check: () => K().modalUp('ductScheduleModal'),
            action: { label: 'Open the schedule', run: () => { if (App.openDuctScheduleModal) App.openDuctScheduleModal(); } } },
          { id: 'copy', title: 'Into the bid', kind: 'do',
            body: 'Click [[Copy Schedule]].',
            answer: 'Every size, gauge, fitting and pound is copied. Paste it into your bid.',
            onEnter: () => { copied = false; },
            target: ['#ductScheduleCopy', '#ductScheduleBtn'],
            check: () => copied,
            action: { label: 'Copy it', run: () => { if (!K().modalUp('ductScheduleModal') && App.openDuctScheduleModal) App.openDuctScheduleModal(); if (el('ductScheduleCopy')) el('ductScheduleCopy').click(); } } },
        ],
      },
      {
        id: 'rooms', title: 'Every room knows its air', page: M101,
        seed: seedRoomsMoment,
        steps: [
          { id: 'box', title: 'Every room knows its air', kind: 'do', page: M101,
            body: 'Drag a box around DINING 100, inside the shaded band.',
            answer: () => { const t = diningTotals() || {}, b = diningBalance() || {}; return 'DINING is ' + fmt(t.areaSqFt) + ' square feet and ' + fmt(t.volumeCuFt) + ' cubic feet. It needs ' + fmt(b.targetCfm) + ' CFM and has none yet.'; },
            onEnter: armRoomSizer, quiet: ['#roomsSection'],   // the room's row answers the card
            zones: () => [H().roomBoxZone(DINING())],
            target: ['#roomBoxApply', '#annCanvas'],
            check: () => { applyBoxWhenDragged(); return diningBoxed(); },
            action: { label: 'Box it', run: async () => { if (diningBoxed()) return; await H().boxRoom(DINING()); giveDiningItsAir(); } } },
          { id: 'serve', title: 'Fill it with air', kind: 'do', clicks: 8, page: M101,
            body: 'Click the eight circles in the dining room.',
            answer: () => { const b = diningBalance() || {}; return 'DINING gets ' + fmt(b.servedCfm) + ' of its ' + fmt(b.targetCfm) + ' CFM now. The warning went out by itself.'; },
            onEnter: armSd1, quiet: ['#roomsSection'],
            zones: () => H().circlesOn(M101, sd1(), SD1_DINING()),
            target: ['#annCanvas'],
            check: () => T().allDone(H().circlesOn(M101, sd1(), SD1_DINING())),
            action: { label: 'Count them', run: () => { K().goPage(M101); App.pushUndoSnapshotCurrentPage(); K().markMissing(H().pickTag('SD-1'), SD1_DINING(), M101); K().dirty(); } } },
        ],
      },
      {
        id: 'mistake', title: 'It catches the mistake in the plans', page: M101,
        seed: seedWholeSet,
        steps: [
          { id: 'open', title: 'It catches the mistake in the plans', kind: 'do',
            body: 'Click BID CHECK in the sidebar to open it.',
            answer: () => 'RTU-1 sends ' + fmt(designed()) + ' CFM and can give ' + fmt(capacity()) + '. The ✓ says the unit is big enough.',
            onEnter: () => T().foldBidCheck(),
            target: () => T().bidCheckRows('demo:hvac:mistake', ['duct-systems-capacity']), lightAll: true,
            check: bidOpen,
            action: { label: 'Open it', run: () => K().openBidCheck() } },
          { id: 'addendum', title: 'An addendum arrives', kind: 'do', handsOff: true,
            body: 'Addendum 3 makes the four kitchen diffusers 300 CFM each. Click Apply addendum 3.',
            answer: () => '⚠ Now RTU-1 must send ' + fmt(designed()) + ' CFM, more than its ' + fmt(capacity()) + '. Caught before the bid, the designer pays to fix it.',
            target: () => T().bidCheckRows('demo:hvac:mistake', ['duct-systems-capacity']), lightAll: true,
            check: () => { const c = H().byTag('SD-3'), r = capacityRow(); return !!(c && c.cfm === ADDENDUM_CFM && r && r.verdict === 'warn'); },
            action: { label: 'Apply addendum 3', run: () => { if (!bidOpen()) K().openBidCheck(); applyAddendum(); } } },
        ],
      },
      {
        id: 'handoff', title: 'Check it, sign it, hand it off', page: M101,
        seed: seedWholeSet,
        steps: [
          { id: 'check', title: 'Check it, sign it, hand it off', kind: 'do',
            body: 'Click BID CHECK in the sidebar to open it.',
            answer: () => okRows() + ' rows checked themselves. The rest wait for you to sign.',
            onEnter: () => T().foldBidCheck(),
            target: () => T().bidCheckRows('demo:hvac:handoff'), lightAll: true,
            check: bidOpen,
            action: { label: 'Open it', run: () => K().openBidCheck() } },
          { id: 'sign', title: 'Sign what you checked', kind: 'do',
            body: 'Click the row that reads Scale verified on every counted sheet.',
            answer: 'Signed. That tick goes out with the bid.',
            target: ['#bidCheckList [data-row-id="scale-verified"]', '#bidCheckSectionTitle'],
            check: () => H().manual('scale-verified'),
            action: { label: 'Sign it', run: () => K().tickManual('scale-verified') } },
          { id: 'report', title: 'Hand it off', kind: 'do',
            body: 'Click [[Show Report]].',
            answer: 'Pick This sheet or Every sheet, and the report your customer reads opens. The whole HVAC course is in [[Learn]].',
            onEnter: () => { reportAsked.on = false; },
            target: ['#showReportMenu', '#printReport', '#exportOptionsSectionTitle'],
            check: () => reportAsked.on,
            action: { label: 'Show it', run: () => { if (el('printReport')) el('printReport').click(); } } },
        ],
      },
    ],
  });
})();
