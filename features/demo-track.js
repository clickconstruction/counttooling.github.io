/*
 * features/demo-track.js - the demo track's shared engine (DEMO-TRACK, journeys/plans/DEMO-TRACK.md):
 * what a stranger sees behind the test drive's "Try it". A trade's demo is three to five MOMENTS, each
 * two to four cards on the tour engine (features/tutorial.js), each card one action and one sentence
 * of payoff. Not a lesson: the courses teach, a demo shows what the app is worth in two minutes.
 *
 * The five decisions (Todd, 2026-10-02), as this file keeps them:
 *   1. A separate script per trade (features/demo-<trade>.js) calls App.registerDemo here; the
 *      courses, tours and lessons are untouched.
 *   2. The demo does the work. A doing card carries "Do it for me" (the engine's `alt` button, the
 *      card's own action.run): the demo track is EXEMPT from the no-do-it-for-me rule, which is for
 *      lessons. A card whose step is the app's own (an addendum arriving) is `handsOff`, its button
 *      the step.
 *   3. ONE orientation card per trade per session (sessionStorage `clickcount-demo-oriented`,
 *      { <trade>: 1 }; a reload of the same tab does not repeat it): on whichever moment opens
 *      first. A later moment opens on a card that only waits for the sheets and moves on.
 *   4. The quiet UI: while a demo runs, a sidebar section the current card does not name shows its
 *      heading only, and a header tool it does not name is dimmed (never removed or disabled: a
 *      click on it still works). Classes on the live DOM, never the app's own fold state, so the
 *      stop puts everything back by removing them.
 *   5. Time to first payoff under a minute: demo-hvac.spec.js times it.
 *
 * A demo is registered as tours: 'demo:<trade>:<moment>' per moment and 'demo:<trade>' for all of
 * them in order. Its sheets open through the lessons' own doors (App.lessonKit openSheetsFor /
 * seedIfReady / isSeeded): the palette watch, Trim your set and the settle test are the lessons',
 * and the reader's device (sidebar filter, Snap, Auto-pick, search words) is remembered on start and
 * put back on stop the way a lesson does it. Each moment's `seed` lays everything the moment does not
 * teach, so a moment stands alone; in the all-moments run a moment's seed runs on its first card.
 *
 * Doors: /app/?demo=<trade> (every moment) and /app/?demo=<trade>:<moment>, the ?chapter= pattern
 * (the restore offer waits; the tour starts after 600 ms).
 *
 * Registrations: registerDemo({ trade, set, orientation, moments }), startDemo(trade, momentId?),
 * demoIds(trade). Boundary rule: read shared deps from App.* at call time, never captured at load.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const K = () => App.lessonKit;
  const S = () => App.state;
  const el = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const DO_IT = 'Do it for me';
  const ORIENTED_KEY = 'clickcount-demo-oriented';

  const DEMOS = {};
  const builtFor = {};      // tour id -> the steps the engine last read (the quiet UI looks a card up by index)
  let live = null;          // { tourId, steps, idx, timer } while a demo runs
  let opening = null;       // the open in flight, so a second press (or the spec seam) never opens twice

  // ----- decision 3: the one orientation card per trade per session --------------------------------
  const orientedMemo = new Set();   // the session's own record when sessionStorage is unavailable
  function oriented(trade) {
    if (orientedMemo.has(trade)) return true;
    try { return !!(JSON.parse(sessionStorage.getItem(ORIENTED_KEY) || '{}') || {})[trade]; } catch (_) { return false; }
  }
  function markOriented(trade) {
    orientedMemo.add(trade);
    try { const o = JSON.parse(sessionStorage.getItem(ORIENTED_KEY) || '{}') || {}; o[trade] = 1; sessionStorage.setItem(ORIENTED_KEY, JSON.stringify(o)); } catch (_) { /* the memo still holds it */ }
  }

  // ----- the sheets ----------------------------------------------------------------------------------
  // A run is what the lessons' doors take: an id, the set, the page to land on and the seed.
  const runOf = (demo, tourId, moment) => ({ id: tourId, set: demo.set, page: moment.page || 0, seed: moment.seed, title: moment.title });
  function openRun(run) {
    if (K().isSeeded(run)) return Promise.resolve();
    if (opening) return opening;
    // Trim your set means nothing to a guest: while the demo's own set comes in, the dialog is never
    // painted (styles.css body.demo-opening), and its Open is pressed for them.
    document.body.classList.add('demo-opening');
    opening = (async () => {
      try { await K().openSheetsFor(run); } catch (_) { /* the card's button stays for a second try */ }
      // Trim your set can come up after openSheetsFor's own Open (its pages still building), and a
      // guest has no reason to know it; press it, as the field door does (lessons.js openFinished).
      // After 3 s, only while the set is on its way in: a guest who kept their own plan at Close
      // project's question gets the card's button back at once, not after a 30 s wait.
      const coming = () => S().currentProjectName === run.set.name || K().modalUp('preparePdfModal');
      // Its Open commits asynchronously, so it is pressed again only once the dialog has stayed up a
      // full second since the last press (a press per tick ran the commit over itself); hidden by the
      // class above, it is never seen either way.
      let upSince = 0;
      for (let i = 0; i < 300 && live && !K().isSeeded(run) && (i < 30 || coming()); i++) {
        if (!K().modalUp('preparePdfModal')) upSince = 0;
        else if (!upSince) upSince = Date.now();
        else if (Date.now() - upSince >= 1000 && el('preparePdfDone')) { el('preparePdfDone').click(); upSince = Date.now(); }
        K().seedIfReady(run);
        await wait(100);
      }
    })().finally(() => { opening = null; document.body.classList.remove('demo-opening'); });
    return opening;
  }
  // The first card of a run: the orientation, or (already oriented this session) a card that only
  // waits for the sheets and moves on by itself. Both open the sheets on start, unasked: the guest
  // came for the demo. Over the guest's own plan the lessons' door asks first (Close project).
  // The sheet is PAINTED: the raster has landed on #pdfCanvas, not just the pages built. The orientation
  // says "this is a plan", so it waited over a black canvas for 8 s at the tablet width until this
  // (the coordinator's hand walk, 2026-10-02). A few pixels sampled; once true it stays true for the run.
  let paintedFor = null;
  function sheetPainted(run) {
    if (paintedFor === run.id) return true;
    const c = el('pdfCanvas');
    if (!c || !(c.width > 0) || !(c.height > 0)) return false;
    try {
      const probe = document.createElement('canvas'); probe.width = 8; probe.height = 8;
      const p = probe.getContext('2d'); p.drawImage(c, 0, 0, 8, 8);
      const d = p.getImageData(0, 0, 8, 8).data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] + d[i + 1] + d[i + 2] > 384) { paintedFor = run.id; return true; }
    } catch (_) { paintedFor = run.id; return true; }   // nothing to sample with: the pages being built is the best signal
    return false;
  }
  // Wide, the sidebar is on screen; narrow (the engine's own 768 px, the stylesheet's drawer), behind ☰.
  const narrow = () => { try { return window.matchMedia('(max-width: 768px)').matches; } catch (_) { return false; } };
  const OPENING = 'The sample plan is opening.';
  function openCard(demo, run, withOrientation, clicks) {
    const o = demo.orientation;
    const ready = () => K().isSeeded(run) && sheetPainted(run);
    return {
      id: withOrientation ? o.id : 'open',
      title: withOrientation ? o.title : run.title,
      kind: 'do', handsOff: true,
      hold: withOrientation,   // the orientation is read: it waits for Next once the sheet is painted
      // the orientation's words point at the plan, so they wait for it; the body is told the layout
      body: () => (withOrientation && ready() ? o.body(clicks, { narrow: narrow() }) : OPENING),
      target: ['#preparePdfDone'],
      check: () => { K().seedIfReady(run); return ready(); },
      progress: () => (opening || (K().isSeeded(run) && !sheetPainted(run)) ? 'Opening the sample plan…' : ''),
      action: { label: 'Open the sample plan', run: () => openRun(run), show: () => !opening },
    };
  }
  // A moment's seed on its first card, in the all-moments run (its sheets are already open).
  function seedMoment(moment) {
    try { if (moment.seed) moment.seed(); } catch (_) { /* a seed never breaks a move */ }
    S().tool = App.TOOL.NONE;
    S().currentPage = moment.page || 0;
    K().dirty();
    App.fitZoom();
  }
  // Decision 2: every doing card the guest could do by hand also offers to do it.
  function demoCard(card) {
    // `jump`: the sheet jumps onto a card's circles rather than gliding for 2.6 s, so a guest who taps
    // the moment they appear never taps a moving target (the coordinator's hand walk, 2026-10-02)
    const c = Object.assign({ jump: true }, card);
    if (c.kind === 'do' && c.action && !c.handsOff && !c.alt) c.alt = { label: DO_IT, run: c.action.run };
    return c;
  }
  const clicksIn = (cards) => cards.reduce((n, c) => n + (c.kind === 'do' ? (c.clicks || 1) : 0), 0);

  // ----- decision 4: the quiet UI --------------------------------------------------------------------
  // A sidebar section is named by its heading in capitals (the cards' own convention, which the engine
  // also lights), by a target or pointer that sits in it, or by a control chip naming a button in it; a header tool
  // (or one of the drawer's tool buttons) by a target that is it, or a control chip that is its name.
  const SECTIONS = { 'PAGES': 'pagesSection', 'COUNTERS': 'countersSection', 'LINE TYPES': 'lineTypesSection', 'GROUPS': 'groupsSection', 'DUCT': 'ductSection', 'BID CHECK': 'bidCheckSection', 'ROOMS': 'roomsSection', 'SUMMARY': 'summarySection', 'EXPORT OPTIONS': null };
  const sectionEl = (name) => (SECTIONS[name] ? el(SECTIONS[name]) : (el('exportOptionsSectionTitle') || {}).parentElement || null);
  const textOf = (v) => { try { return String((typeof v === 'function' ? v() : v) || ''); } catch (_) { return ''; } };
  const nameOf = (n) => [n.getAttribute('aria-label'), (n.getAttribute('title') || '').replace(/\s*\(.*$/, ''), n.textContent].map((t) => String(t || '').trim().toLowerCase()).filter(Boolean);
  function namesOf(step) {
    const text = [step.title, step.body, step.answer].map(textOf).join('\n');
    const chips = [...text.matchAll(/\[\[(.+?)\]\]/g)].map((m) => m[1].trim().toLowerCase());
    let targets = [];
    try { targets = [].concat(typeof step.target === 'function' ? step.target() : step.target || []); } catch (_) { targets = []; }
    const sels = targets.concat([...text.matchAll(/\{\{[^|{}]+\|([^{}]+)\}\}/g)].map((m) => m[1]), step.quiet || []).filter(Boolean);
    const els = [];
    sels.forEach((sel) => { try { document.querySelectorAll(sel).forEach((n) => els.push(n)); } catch (_) { /* a ladder rung that is not a selector */ } });
    return { text, chips, els };
  }
  function applyQuiet(step) {
    if (!step) return;
    document.body.classList.add('demo-quiet');
    const n = namesOf(step);
    Object.keys(SECTIONS).forEach((name) => {
      const sec = sectionEl(name);
      if (!sec) return;
      const said = new RegExp('(^|[^A-Za-z])' + name + '(?![A-Za-z])').test(n.text);
      const holds = n.els.some((e) => sec.contains(e)) || (n.chips.length && [...sec.querySelectorAll('button')].some((b) => nameOf(b).some((l) => n.chips.includes(l))));
      sec.classList.toggle('demo-quiet-fold', !(said || holds));
    });
    // the header's tools, and on a narrow layout the drawer's two button grids that lead the sidebar
    document.querySelectorAll('.header-tools-scroll .sidebar-triggers, .sidebar-header-buttons .sidebar-btn, .sidebar-tool-buttons .sidebar-btn').forEach((btn) => {
      if (btn.id === 'headerMoreBtn' || btn.id === 'doneEditing') return;   // the way to a tool behind ⋯, and a mode's own exit
      const named = n.els.some((e) => e === btn || btn.contains(e)) || nameOf(btn).some((l) => n.chips.includes(l));
      btn.classList.toggle('demo-quiet-dim', !named);
    });
  }
  function clearQuiet() {
    document.body.classList.remove('demo-quiet');
    document.querySelectorAll('.demo-quiet-fold').forEach((n) => n.classList.remove('demo-quiet-fold'));
    document.querySelectorAll('.demo-quiet-dim').forEach((n) => n.classList.remove('demo-quiet-dim'));
  }
  const quietNow = () => { if (live) applyQuiet(live.steps[live.idx]); };

  // ----- registering a demo --------------------------------------------------------------------------
  //   App.registerDemo({ trade, set, orientation: { id, title, body(clicks, { narrow }) }, moments: [{ id, title, page, seed, steps }] })
  function registerDemo(demo) {
    DEMOS[demo.trade] = demo;
    const all = 'demo:' + demo.trade;
    const register = (tourId, moments) => {
      App.registerTour(tourId, {
        doneKey: null,
        // read by the engine at start: the orientation leads only the first run of the session
        get steps() {
          const cards = [];
          moments.forEach((m, i) => m.steps.map(demoCard).forEach((c, j) => {
            // in the all-moments run a moment after the first lays its own seed on its first card
            if (i > 0 && j === 0) { const own = c.onEnter; c.onEnter = () => { seedMoment(m); if (own) own(); }; }
            cards.push(c);
          }));
          const steps = [openCard(demo, runOf(demo, tourId, moments[0]), !oriented(demo.trade), clicksIn(cards))].concat(cards);
          builtFor[tourId] = steps;
          return steps;
        },
        onStart() {
          const steps = builtFor[tourId] || [];
          if (steps[0] && steps[0].id !== 'open') markOriented(demo.trade);
          K().rememberDevice();
          live = { tourId, steps, idx: 0, timer: setInterval(quietNow, 400) };
          quietNow();
          openRun(runOf(demo, tourId, moments[0]));
        },
        onStep(id, idx) { if (live) { live.idx = idx; quietNow(); } },
        onStop() {
          if (live && live.timer) clearInterval(live.timer);
          document.body.classList.remove('demo-opening');
          live = null;
          clearQuiet();
          K().restoreDevice();
        },
      });
    };
    demo.moments.forEach((m) => register(all + ':' + m.id, [m]));
    register(all, demo.moments);
    // the doors: ?demo=<trade> and ?demo=<trade>:<moment>
    try {
      const want = String(new URLSearchParams(location.search).get('demo') || '');
      const [trade, moment] = want.split(':');
      if (trade === demo.trade && (!moment || demo.moments.some((m) => m.id === moment))) {
        App.setTutorialPending(true);   // the boot's restore offer waits, as it does for ?chapter=
        setTimeout(() => { App.setTutorialPending(false); startDemo(trade, moment); }, 600);
      }
    } catch (_) { App.setTutorialPending && App.setTutorialPending(false); }
  }
  function startDemo(trade, momentId) {
    const demo = DEMOS[trade];
    if (!demo || (momentId && !demo.moments.some((m) => m.id === momentId))) return false;
    if (App.hideModal) App.hideModal('learnModal');
    return App.startTutorial('demo:' + trade + (momentId ? ':' + momentId : ''));
  }

  App.registerDemo = registerDemo;
  App.startDemo = startDemo;
  App.demoIds = (trade) => ((DEMOS[trade] || {}).moments || []).map((m) => m.id);
})();
