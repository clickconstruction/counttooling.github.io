/*
 * features/tutorial.js - the interactive walkthrough: learn the app by doing a
 * small electrical takeoff on the sample plan, one coach-marked step at a time.
 *
 * A step is { id, title, body, target (selector list), check(), action? }. The
 * overlay spotlights the target (a box-shadow cutout that never intercepts the
 * pointer, so the real control stays clickable) and the card beside it says
 * what to do; `check()` reads the REAL app state and the step advances the
 * moment it is true — no fake widgets, no scripted clicks. Every doing-step
 * also offers "Do it for me", which performs the same change through the same
 * App.* entry points a click would, so a reader who only wants the tour of the
 * ideas still ends with a real takeoff on screen. Reading steps advance on Next.
 *
 * The tour runs on samples/sample-plan.pdf (fetched into #pdfInput like a
 * drop, so it goes through the normal intake) and nothing it does touches a
 * cloud project: it refuses to start while a cloud project is open. Progress
 * is per session; `clickcount-tour-done` remembers a finished tour per device
 * so the empty-canvas hint stops offering it. Entry points: the hint's "take
 * the tour" link, Project Settings → "tour", and ?tour=1.
 *
 * Registrations: startTutorial(), stopTutorial(), isTutorialActive(),
 * onTutorialTick() (updateUI + a 400 ms interval re-evaluate the step),
 * tutorialStepId() (specs).
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const DONE_KEY = 'clickcount-tour-done';
  const SAMPLE_PLAN = '/samples/sample-plan.pdf';
  const T = () => window.TagModel;

  let active = false;
  let stepIdx = 0;
  let timer = null;
  let doneAt = 0;          // when the current step's check first passed (auto-advance after a beat)
  let tourCounterId = null;
  let tourLineTypeId = null;

  const q = (sels) => { for (const s of [].concat(sels)) { const el = document.querySelector(s); if (el && el.offsetParent !== null) return el; } return null; };
  const state = () => App.state;
  const ann = () => (state().pages && state().pages.length ? App.getActiveAnnotations(state().pages[state().currentPage]) : null);
  const markCount = (cid) => { let n = 0; (state().pages || []).forEach((p) => { const a = App.getActiveAnnotations(p); n += ((a && a.counterMarkers && a.counterMarkers[cid]) || []).length; }); return n; };
  const tourCounter = () => (state().counters || []).find((c) => c.id === tourCounterId) || (state().counters || []).find((c) => /receptacle/i.test(c.name || ''));
  const tourLineType = () => (state().lineTypes || []).find((lt) => lt.id === tourLineTypeId) || (state().lineTypes || []).find((lt) => lt.raceway && lt.conductors && lt.conductors.length);

  // --- the steps ------------------------------------------------------------------
  const STEPS = [
    {
      id: 'welcome', title: 'A five-minute electrical takeoff', kind: 'do',
      body: 'This tour walks you through a small takeoff on the sample plan — set the scale, count devices, chain a run, read the wire and the checks. Nothing here touches your projects. Open the sample plan to begin.',
      target: ['#uploadPdf', '#uploadPdfSidebar'],
      check: () => !!(state().pages && state().pages.length),
      action: { label: 'Open the sample plan', run: openSamplePlan },
    },
    {
      id: 'scale', title: 'Set the scale', kind: 'do',
      body: 'Every length starts here. Pick Set Scale (S) and choose the 1/8" = 1\'-0" preset — the sample plan is drawn at 1/8". The title block says so, which is where you would look on a real sheet.',
      target: ['#setScale', '#setScaleSidebar', '[title="Set Scale"]'],
      check: () => !!(App.getPageScale && App.getPageScale(state().currentPage)),
      action: { label: 'Use 1/8" = 1\'-0"', run: () => { const p = state().pages[state().currentPage]; if (!p) return; p.scale = { pixelsPerUnit: 72 / 8, unit: 'ft', label: '1/8" = 1\'' }; App.markProjectDirty(); App.updateUI(); App.renderAnnotations(); } },
    },
    {
      id: 'trade', title: 'Tell the app this is electrical', kind: 'do',
      body: 'Open Counters → + Add → the Quick tab and switch Trade to Electrical. The pickers become Category / Variant / Rating, the symbols become the ones on an E-sheet, and every device gets its mount height. A plumbing bid never sees any of this.',
      target: ['#addCounter'],
      check: () => state().trade === 'electrical',
      action: { label: 'Switch to Electrical', run: () => App.setProjectTrade('electrical', { remember: false, route: 'tour' }) },
    },
    {
      id: 'counter', title: 'Add a duplex receptacle', kind: 'do',
      body: 'On the Quick tab pick Receptacle · Duplex and press Add Counter. It arrives with the receptacle symbol and a mount height of 18" — the number the Chain tool will turn into vertical conduit in a moment.',
      target: ['#counterQuickCountAdd', '#addCounter'],
      check: () => { const c = (state().counters || []).find((x) => /receptacle/i.test(x.name || '') && typeof x.mountHeightIn === 'number'); if (c) tourCounterId = c.id; return !!c; },
      action: { label: 'Add it for me', run: addTourCounter },
    },
    {
      id: 'place', title: 'Count three receptacles', kind: 'do',
      body: 'With the counter armed, click three spots along the walls of Open Office 104. Each click is one tally; the sidebar count moves as you go.',
      target: ['#annCanvas'],
      check: () => { const c = tourCounter(); return !!c && markCount(c.id) >= 3; },
      action: { label: 'Place three for me', run: placeThree },
    },
    {
      id: 'linetype', title: 'Make a conduit line type', kind: 'do',
      body: 'Line Types → + Add. Name it 3/4" EMT, then in its details give it the raceway (EMT, 3/4") and the conductors the way you already write them: 3 #12 THHN + 1 #12 G. From now on every run of this type tallies conduit AND wire by gauge.',
      target: ['#addLineType'],
      check: () => { const lt = tourLineType(); if (lt) tourLineTypeId = lt.id; return !!lt; },
      action: { label: 'Create 3/4" EMT · 3 #12 + G', run: addTourLineType },
    },
    {
      id: 'ceiling', title: 'Set the ceiling height', kind: 'do',
      body: 'Project Settings (the gear) → Ceiling height 10\'-0". With a mount height on the counter, the Chain tool adds ceiling − mount + make-up to every run it draws — 9.5 ft per receptacle nobody has to type.',
      target: ['#settingsGearBtn', '#sidebarLogoGear'],
      check: () => state().ceilingHeightFt > 0,
      action: { label: 'Set 10\'-0"', run: () => { state().ceilingHeightFt = 10; state().makeUpFt = 1; App.markProjectDirty(); App.updateUI(); } },
    },
    {
      id: 'chain', title: 'Chain a run', kind: 'do',
      body: 'Pick Chain (T), choose the receptacle and 3/4" EMT, then click three devices in a row. Every tap places the device, draws the run back to the previous one and writes the vertical drop. The footer tells you the drop before you click.',
      target: ['#chainBtn'],
      check: () => { const a = ann(); return !!a && (a.quickLines || []).filter((l) => (l.endDrop || 0) > 0 || (l.startDrop || 0) > 0).length >= 2; },
      action: { label: 'Chain three for me', run: chainThree },
    },
    {
      id: 'circuit', title: 'Make it a circuit', kind: 'do',
      body: 'Groups → + Add. Name it, and give it a panel and circuit number — LP-1 · 7. A group with a panel tag is a circuit: the report gets a circuit schedule, and the checks know which devices belong together.',
      target: ['#addGroup', '#groupsSectionTitle'],
      check: () => (state().groups || []).some((g) => g.panel),
      action: { label: 'Create LP-1 / 7 and assign the run', run: makeCircuit },
    },
    {
      id: 'summary', title: 'Read what the drawing knows', kind: 'read',
      body: 'The Summary now lists the receptacles, the 3/4" EMT feet with the verticals inside them, and the derived rows — #12 THHN by the foot, the green its own row. Wire is never a mark; it can never drift from the runs.',
      target: ['#summarySectionTitle'],
      check: () => true,
    },
    {
      id: 'bidcheck', title: 'Bid Check', kind: 'do',
      body: 'Expand Bid Check. The app computes conduit fill and voltage drop to the farthest device, compares circuits with the panel schedule, and lists the judgment calls only you can tick. It never blocks an export; it tells you what is open.',
      target: ['#bidCheckSectionTitle'],
      check: () => state().bidCheckCollapsed === false,
      action: { label: 'Open it', run: () => { state().bidCheckCollapsed = false; App.renderBidCheck && App.renderBidCheck(); } },
    },
    {
      id: 'handoff', title: 'Hand it off', kind: 'read',
      body: 'Export Options: Show Report for the full breakdown, Copy Summary for an email, Open in TakeoffTooling to price it — devices explode into boxes, rings and plates and every row picks up labor from your book. CountTooling stops at what the drawing knows.',
      target: ['#exportOptionsSectionTitle'],
      check: () => true,
    },
    {
      id: 'done', title: 'That is the whole loop', kind: 'read',
      body: 'Scale, count, measure, check, hand off. Your work here is saved on this device like any takeoff; Upload PDF when you are ready for a real plan. Guides for every tool live under Help → Guides.',
      target: [],
      check: () => true,
    },
  ];

  // --- "do it for me" actions (the same entry points a click uses) --------------------
  async function openSamplePlan() {
    try {
      const res = await fetch(SAMPLE_PLAN);
      const blob = await res.blob();
      const file = new File([blob], 'sample-plan.pdf', { type: 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const inp = document.getElementById('pdfInput');
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { App.showToast('Could not load the sample plan — Upload PDF works the same way'); }
  }
  function addTourCounter() {
    const s = state();
    if (tourCounter()) return;
    const icon = (App.tradeIconForType && App.tradeIconForType('electrical', 'Duplex')) || (App.getEffectiveCustomIcons().find((i) => i.name === 'Duplex Receptacle') || {}).value || App.getOrderedIcons()[0].value;
    App.pushUndoSnapshot();
    const c = { id: App.uid(), name: 'Duplex Receptacle', icon, color: '#e85447', mountHeightIn: 18 };
    s.counters.push(c);
    tourCounterId = c.id;
    s.activeCounterType = c.id;
    s.tool = App.TOOL.COUNTER;
    App.markProjectDirty(); App.updateUI();
  }
  // Three spots along the north wall of Open Office 104 on the sample plan
  // (PDF points; the sample is 792 × 612).
  const SPOTS = [{ x: 300, y: 330 }, { x: 360, y: 330 }, { x: 420, y: 330 }];
  function placeThree() {
    const c = tourCounter(); if (!c) addTourCounter();
    const cid = tourCounter().id;
    const page = state().pages[state().currentPage];
    const canvas = App.ensureActiveCanvas(page);
    App.pushUndoSnapshotCurrentPage();
    if (!canvas.annotations.counterMarkers[cid]) canvas.annotations.counterMarkers[cid] = [];
    SPOTS.forEach((p) => canvas.annotations.counterMarkers[cid].push({ x: p.x, y: p.y, id: App.uid(), group: state().activeGroupId || null }));
    App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
  }
  function addTourLineType() {
    const s = state();
    if (tourLineType()) return;
    const conductors = window.ConductorModel ? window.ConductorModel.parseConductorSpec('3 #12 THHN + 1 #12 G').conductors : [];
    App.pushUndoSnapshot();
    const lt = { id: App.uid(), name: '3/4" EMT', color: '#8a4bb0', curveStyle: 'straight', raceway: { kind: 'EMT', size: '3/4"' }, conductors };
    s.lineTypes.push(lt);
    tourLineTypeId = lt.id;
    s.activeLineTypeId = lt.id;
    App.markProjectDirty(); App.updateUI();
  }
  function chainThree() {
    const s = state();
    if (!tourCounter()) addTourCounter();
    if (!tourLineType()) addTourLineType();
    if (!(s.ceilingHeightFt > 0)) { s.ceilingHeightFt = 10; s.makeUpFt = 1; }
    s.activeCounterType = tourCounter().id;
    s.activeLineTypeId = tourLineType().id;
    s.tool = App.TOOL.CHAIN;
    s.chainStart = null;
    [{ x: 300, y: 420 }, { x: 380, y: 420 }, { x: 460, y: 420 }].forEach((p) => App.commitChainPoint(p));
    s.chainStart = null;
    App.updateUI(); App.renderAnnotations();
  }
  function makeCircuit() {
    const s = state();
    if ((s.groups || []).some((g) => g.panel)) return;
    App.pushUndoSnapshot();
    const g = { id: App.uid(), name: 'Open office receptacles', color: '#c8963a', panel: 'LP-1', circuit: '7', loadAmps: 12 };
    s.groups.push(g);
    s.groupsEnabled = true;
    const a = ann();
    if (a) {
      (a.quickLines || []).forEach((l) => { if (!l.group) l.group = g.id; });
      const c = tourCounter();
      if (c) (a.counterMarkers[c.id] || []).forEach((m) => { if (!m.group) m.group = g.id; });
    }
    App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
  }

  // --- the overlay ------------------------------------------------------------------
  function el(id) { return document.getElementById(id); }
  function render() {
    const overlay = el('tourOverlay');
    if (!overlay) return;
    overlay.style.display = active ? '' : 'none';
    if (!active) return;
    const step = STEPS[stepIdx];
    const done = safeCheck(step);
    el('tourStepNo').textContent = (stepIdx + 1) + ' / ' + STEPS.length;
    el('tourTitle').textContent = step.title;
    el('tourBody').textContent = step.body;
    const actionBtn = el('tourAction');
    if (step.action && !done) { actionBtn.style.display = ''; actionBtn.textContent = step.action.label; }
    else actionBtn.style.display = 'none';
    const next = el('tourNext');
    next.textContent = stepIdx === STEPS.length - 1 ? 'Finish' : (step.kind === 'read' || done ? 'Next' : 'Skip step');
    next.classList.toggle('tour-next-ready', step.kind === 'read' || done);
    el('tourBack').style.visibility = stepIdx === 0 ? 'hidden' : '';
    el('tourStatus').textContent = step.kind === 'do' ? (done ? '✓ Done' : 'Waiting for you…') : '';
    el('tourDots').innerHTML = STEPS.map((s, i) => '<span class="tour-dot' + (i < stepIdx ? ' past' : i === stepIdx ? ' now' : '') + '"></span>').join('');
    // spotlight + card placement
    const modalOpen = !!document.querySelector('.modal-overlay.visible');
    const target = !modalOpen && step.target.length ? q(step.target) : null;
    const spot = el('tourSpot');
    const card = el('tourCard');
    if (target) {
      const r = target.getBoundingClientRect();
      const pad = 6;
      spot.style.display = '';
      spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px';
      spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
      // card: right of the target when there is room, else below, clamped to the viewport
      const cw = Math.min(360, window.innerWidth - 24), ch = card.offsetHeight || 220;
      let left = r.right + 16, top = r.top;
      if (left + cw > window.innerWidth - 12) { left = Math.max(12, Math.min(r.left, window.innerWidth - cw - 12)); top = r.bottom + 14; }
      if (top + ch > window.innerHeight - 12) top = Math.max(12, window.innerHeight - ch - 12);
      card.style.left = left + 'px'; card.style.top = top + 'px'; card.style.right = ''; card.style.bottom = ''; card.style.transform = '';
    } else {
      spot.style.display = 'none';
      if (modalOpen) { card.style.left = ''; card.style.top = ''; card.style.right = '16px'; card.style.bottom = '16px'; card.style.transform = ''; }
      else { card.style.left = '50%'; card.style.top = '50%'; card.style.right = ''; card.style.bottom = ''; card.style.transform = 'translate(-50%, -50%)'; }
    }
    // auto-advance a beat after a doing-step completes
    if (step.kind === 'do' && done && stepIdx < STEPS.length - 1) {
      if (!doneAt) doneAt = Date.now();
      else if (Date.now() - doneAt > 900) goTo(stepIdx + 1);
    } else doneAt = 0;
  }
  function safeCheck(step) { try { return !!step.check(); } catch (_) { return false; } }
  function goTo(i) {
    stepIdx = Math.max(0, Math.min(STEPS.length - 1, i));
    doneAt = 0;
    App.logUserEvent && App.logUserEvent('tour_step', state().currentProjectId || null, { step: STEPS[stepIdx].id, index: stepIdx });
    render();
  }
  function startTutorial() {
    const s = state();
    if (s.currentProjectId) { App.showToast('Close the cloud project first — the tour runs on the sample plan'); return false; }
    active = true;
    stepIdx = 0; doneAt = 0; tourCounterId = null; tourLineTypeId = null;
    document.body.classList.add('tour-active');
    if (timer) clearInterval(timer);
    timer = setInterval(render, 400);
    App.logUserEvent && App.logUserEvent('tour_step', null, { step: 'start', index: 0 });
    render();
    return true;
  }
  function stopTutorial(finished) {
    active = false;
    if (timer) { clearInterval(timer); timer = null; }
    document.body.classList.remove('tour-active');
    try { if (finished) localStorage.setItem(DONE_KEY, new Date().toISOString()); } catch (_) {}
    App.logUserEvent && App.logUserEvent('tour_step', state().currentProjectId || null, { step: finished ? 'finished' : 'left', index: stepIdx });
    render();
    syncEntryPoints();
  }
  function syncEntryPoints() {
    let done = false;
    try { done = !!localStorage.getItem(DONE_KEY); } catch (_) {}
    const link = el('canvasEmptyHintTour');
    if (link) link.style.display = done ? 'none' : '';
  }

  // wiring (static DOM)
  el('tourNext') && (el('tourNext').onclick = () => { if (stepIdx >= STEPS.length - 1) stopTutorial(true); else goTo(stepIdx + 1); });
  el('tourBack') && (el('tourBack').onclick = () => goTo(stepIdx - 1));
  el('tourLeave') && (el('tourLeave').onclick = () => stopTutorial(false));
  el('tourAction') && (el('tourAction').onclick = async () => { const step = STEPS[stepIdx]; if (step.action) { await step.action.run(); render(); } });
  el('canvasEmptyHintTour') && (el('canvasEmptyHintTour').onclick = (e) => { e.preventDefault(); startTutorial(); });
  el('settingsTour') && (el('settingsTour').onclick = () => { App.hideModal('settingsModal'); startTutorial(); });
  window.addEventListener('resize', () => { if (active) render(); });
  syncEntryPoints();
  // ?tour=1 opens the tour on load (after the app has booted its state).
  try { if (new URLSearchParams(location.search).get('tour') === '1') setTimeout(() => startTutorial(), 600); } catch (_) {}

  App.startTutorial = startTutorial;
  App.stopTutorial = stopTutorial;
  App.isTutorialActive = () => active;
  App.onTutorialTick = () => { if (active) render(); };
  App.tutorialStepId = () => (active ? STEPS[stepIdx].id : null);
  App.tutorialGoTo = (id) => { const i = STEPS.findIndex((s) => s.id === id); if (i >= 0) goTo(i); };
  void T;
})();
