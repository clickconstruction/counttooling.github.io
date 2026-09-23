(function () {
  'use strict';
  const App = (window.App = window.App || {});
  // The Modal Gallery, a DEVELOPER view: every modal in the app on one page,
  // in the app's real CSS, so a styling pass can be judged across all of them
  // at once instead of one dialog at a time.
  //
  // Reached at /app/?gallery=1. This file is NOT one of the shell's script
  // tags and NOT in the service worker precache: app.js's boot injects it only
  // when the query param is present (the `?devAuth=1` pattern), so users never
  // download it and the shell stays exactly as shipped.
  //
  // How it works. app/index.html holds every `.modal-overlay` as a
  // `position: fixed` sheet that is `display: none` until showModal(id) adds
  // `.visible`. The gallery reparents each overlay into a grid tile and, with
  // `body.modal-gallery` on, overrides the overlay to `position: static` and
  // the card to full tile width. The markup, the event handlers and the
  // stylesheet are the app's own, untouched: edit styles.css, reload, and all
  // of them update together. Three sections: Modals (every `.modal-overlay`),
  // Toasts (the `#toastRegion` cards) and Popovers (the fixed panels and
  // menus, listed in POPOVER_IDS).
  //
  // Per tile: the id, where it lives (`app/index.html:<line>`, found by
  // fetching the shell) and which feature file owns it (the loaded
  // features/*.js that names the id most, found by fetching each one; app.js
  // otherwise), a Populate control where a registered opener exists (OPENERS
  // below; the opener runs in place, so the card fills with real content), and
  // Open live, which puts that one overlay back on its real fixed backdrop
  // with `.visible` set, so the app's own Esc ladder and Cancel buttons close
  // it and return to the grid (a class MutationObserver watches for that).
  //
  // Grid mode keeps `.visible` OFF every overlay (the observer strips it the
  // moment an opener sets it): the app treats a `.modal-overlay.visible` as an
  // open dialog (pdf-intake refuses drops, the restore prompt defers, the tour
  // spotlights inside it), and nothing here is open in that sense.
  //
  // Load sample fetches samples/sample-plan.pdf through the app's own intake
  // (like the tours) and lays the same small takeoff scripts/build-screenshots.js
  // uses (plus a room and a group), so the state-hungry openers (Line
  // Properties, Summary detail, Room edit, Group edit...) have something to show. Reload CSS re-links styles.css
  // with a cache-busting query, which also steps around the service worker's
  // cache-first precache (it registers on localhost too): the gallery does that
  // once on boot as well, so the working tree's CSS is what you see.
  //
  // Phone width: the media queries key off the viewport, so the Mobile toggle
  // embeds this same page (`&narrow=1`, one column, no bar) in a 375px iframe
  // beside the desktop grid.
  //
  // scripts/build-modal-gallery.js drives this page headlessly and writes one
  // PNG per tile at both widths plus a contact sheet (phase 2).

  const params = new URLSearchParams(window.location.search || '');
  if (params.get('gallery') !== '1') return;
  const NARROW = params.get('narrow') === '1';
  const NARROW_WIDTH = 375;

  const POPOVER_IDS = [
    'toolContextMenu', 'headerMoreMenu', 'exportDropdownMenu', 'downloadCurrentPageMenu', 'rightMenu',
    'chainPanel', 'dropPanel', 'highlightPanel', 'ductSizePopover', 'rulePopover', 'zoomRail',
    'notesLedgerDrawer', 'tourCard', 'globalReloadBanner', 'viewLinkDeadScreen',
  ];

  const CSS = `
    html.mg-root, body.modal-gallery { overflow: auto !important; height: auto !important; min-height: 100%; position: static !important; }
    body.modal-gallery > :not(#modalGallery):not(script):not(style):not(link) { display: none !important; }
    #modalGallery { color: var(--text); background: var(--bg); min-height: 100vh; font-family: inherit; }
    #modalGalleryBar { position: sticky; top: 0; z-index: 5; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 10px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
    #modalGalleryBar h1 { margin: 0; font-size: 1rem; }
    #modalGalleryBar .mg-count { color: var(--text2); font-size: 0.85rem; }
    #modalGalleryBar input[type="search"] { flex: 1 1 200px; max-width: 360px; padding: 6px 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 0.9rem; font-family: inherit; }
    #modalGalleryBar button, .mg-tile-head button { padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-size: 0.8rem; font-family: inherit; cursor: pointer; }
    #modalGalleryBar button:hover, .mg-tile-head button:hover { border-color: var(--accent); }
    #modalGalleryBar button.mg-on { background: var(--accent); color: #111; border-color: var(--accent); }
    #modalGalleryBar .mg-spacer { flex: 1; }
    #modalGalleryBar .mg-note { color: var(--text2); font-size: 0.75rem; }
    #modalGalleryBody { display: flex; align-items: flex-start; }
    #modalGalleryMain { flex: 1; min-width: 0; }
    .mg-section { padding: 18px 16px 6px; display: flex; align-items: baseline; gap: 10px; }
    .mg-section h2 { margin: 0; font-size: 0.95rem; }
    .mg-section span { color: var(--text2); font-size: 0.8rem; }
    .mg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 24px; padding: 8px 16px 24px; align-content: start; align-items: start; }
    .mg-tile { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .mg-tile.mg-wide { grid-column: span 2; }
    .mg-tile.mg-hidden { display: none; }
    .mg-tile-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--text2); }
    .mg-tile-head .mg-id { color: var(--text); font-weight: 600; }
    .mg-tile-head .mg-where { opacity: 0.85; }
    .mg-tile-head .mg-err { color: #e85447; }
    .mg-tile-head .mg-btns { margin-left: auto; display: flex; gap: 4px; flex-wrap: wrap; }
    .mg-tile-body { position: relative; min-height: 24px; }
    /* Grid mode: every overlay a static tile, every card full width. */
    body.modal-gallery:not(.mg-live) .mg-tile-body > .modal-overlay { display: flex !important; position: static !important; inset: auto !important; background: transparent !important; padding: 0 !important; overflow: visible !important; z-index: auto !important; justify-content: flex-start !important; align-items: stretch !important; }
    body.modal-gallery:not(.mg-live) .mg-tile-body > .modal-overlay > .modal-card { margin: 0 !important; width: 100% !important; max-width: none !important; max-height: none !important; height: auto !important; overflow: visible !important; }
    body.modal-gallery:not(.mg-live) .mg-tile-body > .modal-overlay > .modal-card.modal-card-fullscreen { height: auto !important; max-height: none !important; }
    body.modal-gallery .mg-tile-body > .toast-card { display: block !important; position: static !important; }
    body.modal-gallery .mg-tile-body > .mg-popover { display: block !important; position: static !important; inset: auto !important; left: auto !important; top: auto !important; right: auto !important; bottom: auto !important; transform: none !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; max-height: none !important; }
    /* Live mode: the one overlay back on its real backdrop; the grid waits underneath. */
    body.modal-gallery.mg-live #modalGalleryBody { visibility: hidden; }
    body.modal-gallery.mg-live .modal-overlay.mg-live-overlay { visibility: visible; }
    body.modal-gallery.mg-live .mg-popover { visibility: hidden !important; }
    #modalGalleryLivePill { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 400; background: var(--surface); color: var(--text); border: 1px solid var(--accent); border-radius: 999px; padding: 6px 12px; font-size: 0.8rem; box-shadow: 0 6px 24px rgba(0,0,0,0.4); display: none; align-items: center; gap: 10px; }
    body.modal-gallery.mg-live #modalGalleryLivePill { display: flex; }
    #modalGalleryLivePill button { padding: 3px 9px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-family: inherit; cursor: pointer; }
    #modalGalleryPhone { display: none; position: sticky; top: 52px; flex: 0 0 auto; margin: 16px 16px 16px 0; border: 1px solid var(--border); border-radius: 18px; overflow: hidden; background: var(--surface); }
    body.modal-gallery.mg-phone #modalGalleryPhone { display: block; }
    #modalGalleryPhone iframe { display: block; width: ${NARROW_WIDTH}px; height: calc(100vh - 100px); border: 0; background: var(--bg); }
    body.mg-narrow #modalGalleryBar, body.mg-narrow #modalGalleryPhone { display: none !important; }
    body.mg-narrow .mg-grid { grid-template-columns: 1fr; padding: 8px 12px 16px; gap: 18px; }
    body.mg-narrow .mg-tile.mg-wide { grid-column: auto; }
    @media (max-width: 940px) { .mg-tile.mg-wide { grid-column: auto; } }
  `;

  // ---- populate: the registered openers, keyed by overlay id ----------------
  // A value is a function, or [label, fn] pairs for a modal with variants. An
  // opener that throws or refuses (no pages, not signed in, not admin) reports
  // in the tile head rather than failing silently; nothing here is a test.
  const st = () => App.state;
  const firstCounter = () => (st().counters || [])[0];
  const firstLineType = () => (st().lineTypes || [])[0];
  const pageAnn = () => { const p = st().pages[st().currentPage || 0]; return p && p.canvases && p.canvases[0] && p.canvases[0].annotations; };
  const firstQuickLine = () => { const a = pageAnn(); return a && a.quickLines && a.quickLines[0]; };
  const firstMarker = () => { const a = pageAnn(); const c = firstCounter(); return c && a && a.counterMarkers && (a.counterMarkers[c.id] || [])[0]; };
  const needSample = (what) => { throw new Error('needs a plan: click Load sample' + (what ? ' (' + what + ')' : '')); };
  const OPENERS = {
    scaleModal: () => App.openScaleModal(),
    counterModal: [['Choose', () => App.showCounterTab('choose')], ['Create', () => App.showCounterTab('create')], ['Quick', () => App.showCounterTab('quickcount')]],
    chooseLineTypeModal: [['Choose', () => { App.showChooseLineTypeModal(); App.showLineTypeTab('choose'); }], ['Create', () => { App.showChooseLineTypeModal(); App.showLineTypeTab('create'); }]],
    ductScheduleModal: () => App.openDuctScheduleModal(),
    waterScheduleModal: () => App.openWaterScheduleModal(),
    counterSettingsModal: () => App.openCounterSettingsModal(),
    pageSettingsModal: () => App.openPageSettingsModal(),
    zoomModal: () => App.showZoomModal(),
    lineTypeSettingsModal: () => App.openLineTypeSettingsModal(),
    legendSettingsModal: () => App.openLegendSettingsModal(),
    multiplyZoneSettingsModal: () => App.openMultiplyZoneSettingsModal(),
    scaleZoneSettingsModal: () => App.openScaleZoneSettingsModal(),
    gridSettingsModal: () => App.openGridSettingsModal(),
    specificPagesModal: () => App.openSpecificPagesModal(),
    lineColorModal: () => App.showLineColorModal('#4a9eff', () => {}),
    quickKeysModal: () => App.openQuickKeysModal(),
    keyboardMapModal: () => App.openKeyboardMapModal(),
    macrosModal: () => App.showModal('macrosModal'),
    noteModal: [['Add', () => App.openNoteModal('create', '', { x: 100, y: 100 })], ['Edit', () => App.openNoteModal('edit', 'Confirm fixture spec, see addendum 2', { x: 100, y: 100, text: 'Confirm fixture spec, see addendum 2', color: '#e85447' })]],
    highlightNameModal: () => App.openHighlightNameModal({ label: '', x1: 0, y1: 0, x2: 10, y2: 10 }, 0),
    markerCfmModal: () => { const m = firstMarker(); if (!m) needSample(); App.openMarkerCfmModal(m, firstCounter()); },
    markerWsfuModal: () => { const m = firstMarker(); if (!m) needSample(); App.openMarkerWsfuModal(m, firstCounter()); },
    roomEditModal: () => { if (!(st().rooms || []).length) needSample('a room'); App.openRoomBoxModalForEdit(0); },
    confirmModal: [
      ['Confirm', () => App.confirmDialog({ title: 'Delete this page?', body: 'Its marks go with it. Undo does not bring a page back.', confirmLabel: 'Delete', danger: true })],
      ['Prompt', () => App.confirmDialog({ title: 'Name this layer', input: { placeholder: 'e.g. Alternate 2', value: '' }, confirmLabel: 'Save' })],
      ['Notice', () => App.confirmDialog({ title: 'Access log', body: 'todd@example.com opened this link 3 times, last on 2026-09-18.', confirmLabel: 'Close', infoOnly: true })],
    ],
    linePropertiesModal: () => { const q = firstQuickLine(); if (!q) needSample('a line'); App.openLinePropertiesModal({ type: 'quick', q, pageIdx: st().currentPage || 0 }); },
    counterLineTypeDetailsModal: [
      ['Counter', () => { const c = firstCounter(); if (!c) needSample(); App.openCounterLineTypeDetailsModal('counter', c); }],
      ['Line type', () => { const l = firstLineType(); if (!l) needSample(); App.openCounterLineTypeDetailsModal('lineType', l); }],
    ],
    groupModal: [['New', () => App.openGroupModal(null)], ['Edit', () => { const g = (st().groups || [])[0]; if (!g) throw new Error('no groups yet: make one with New'); App.openGroupModal(g); }]],
    groupAssignModal: () => { const m = firstMarker(); if (!m) needSample(); App.openGroupAssignModal(m); },
    settingsModal: () => App.showModal('settingsModal'),
    saveStatusModal: () => App.openSaveStatusModal(),
    canvasRepairModal: () => App.openCanvasRepairModal(),
    manageIconsModal: () => App.openManageIconsModal(),
    mySettingsModal: () => App.openMySettings(),
    paletteInsightsModal: () => App.openPaletteInsightsModal(),
    authModal: () => App.openAuthGate('save'),
    manageUserModal: () => App.openManageUserModal(),
    allUsersModal: () => App.openAllUsersModal(),
    userActivityModal: () => App.openUserActivityModal(null, null),
    userActivityOverviewModal: () => App.openUserActivityOverview(null, null),
    manageProjectsModal: () => App.openManageProjectsModal(),
    bidBoardModal: () => App.openBidBoard(),
    loadProjectModal: () => App.openLoadProjectModal(),
    summaryCountDetailModal: () => { const c = firstCounter(); if (!c) needSample(); return App.openSummaryCountDetailModal('counter', c.id); },
    shareProjectModal: () => App.openShareProjectModal(),
    checkoutExpiredRecoveryModal: () => App.openCheckoutExpiredRecoveryModal({}),
    canvasOnlyNeedsPdfModal: [['No PDF', () => App.openCanvasOnlyNeedsPdfModal({})], ['PDF missing', () => App.openCanvasOnlyNeedsPdfModal({ reason: 'pdf_missing' })]],
    forceTurnInNoticeModal: [['Saved', () => App.openForceTurnInNoticeModal({ hadDirty: false })], ['Unsaved', () => App.openForceTurnInNoticeModal({ hadDirty: true })]],
    turnInProgressModal: () => App.setTurnInProgress('Turning in…'),
    canvasDetailsModal: () => { const p = st().pages[st().currentPage || 0]; if (!p) needSample(); App.openCanvasDetailsModal(p.canvases[0]); },
    clearPageConfirmModal: () => App.showClearPageModal(),
  };
  const TOAST_OPENERS = {
    airboardToastModal: () => App.showToast('Saved to this device.', 60000),
    setScaleFirstModal: () => App.showSetScaleFirstToast(),
    outOfBoundsModal: () => App.showOutOfBoundsToast(),
    bidCheckAdvisoryModal: () => App.showBidCheckAdvisory(),
    turnedInToastModal: () => App.showTurnedInToast(),
  };
  const POPOVER_OPENERS = {
    chainPanel: () => App.openChainPanel(),
    dropPanel: () => App.openDropPanel(),
    highlightPanel: () => App.openHighlightPanel(),
    zoomRail: () => App.openZoomRail(),
    notesLedgerDrawer: () => App.openNotesLedger(),
  };

  // ---- build ----------------------------------------------------------------
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  let liveOverlay = null;
  const tilesById = new Map();

  function makeTile(node, kind, openers) {
    const tile = el('div', 'mg-tile');
    tile.dataset.id = node.id;
    const head = el('div', 'mg-tile-head');
    head.appendChild(el('span', 'mg-id', '#' + node.id));
    const where = el('span', 'mg-where', '');
    head.appendChild(where);
    const err = el('span', 'mg-err', '');
    head.appendChild(err);
    const btns = el('div', 'mg-btns');
    const run = (fn) => { err.textContent = ''; try { const r = fn(); if (r && typeof r.catch === 'function') r.catch((e) => { err.textContent = String(e && e.message || e); }); } catch (e) { err.textContent = String(e && e.message || e); } };
    const op = openers[node.id];
    if (Array.isArray(op)) op.forEach(([label, fn]) => { const b = el('button', null, label); b.onclick = () => run(fn); btns.appendChild(b); });
    else if (op) { const b = el('button', null, 'Populate'); b.onclick = () => run(op); btns.appendChild(b); }
    if (kind === 'modal') { const b = el('button', null, 'Open live'); b.onclick = () => openLive(node); btns.appendChild(b); }
    head.appendChild(btns);
    const body = el('div', 'mg-tile-body');
    if (kind === 'popover') node.classList.add('mg-popover');
    body.appendChild(node);
    tile.appendChild(head); tile.appendChild(body);
    tile._where = where;
    tilesById.set(node.id, tile);
    return tile;
  }

  function section(title, note, nodes, kind, openers) {
    const frag = document.createDocumentFragment();
    const h = el('div', 'mg-section'); h.appendChild(el('h2', null, title)); h.appendChild(el('span', null, nodes.length + ' · ' + note));
    frag.appendChild(h);
    const grid = el('div', 'mg-grid');
    nodes.forEach((n) => grid.appendChild(makeTile(n, kind, openers)));
    frag.appendChild(grid);
    return frag;
  }

  function markWide() {
    // A card whose own max-width is over the tile's natural width spans two
    // columns (modal-card-large is 700px, the Save Status card 820px...).
    tilesById.forEach((tile) => {
      const card = tile.querySelector('.mg-tile-body > .modal-overlay > .modal-card');
      if (!card) return;
      const inline = parseFloat(card.style.maxWidth) || 0;
      const wide = inline > 480 || ['modal-card-large', 'modal-card-fullscreen', 'duct-schedule-card', 'macros-modal-card', 'keyboard-map-card', 'quick-keys-card'].some((c) => card.classList.contains(c));
      tile.classList.toggle('mg-wide', wide);
    });
  }

  // ---- live mode --------------------------------------------------------------
  function openLive(overlay) {
    exitLive();
    liveOverlay = overlay;
    overlay.classList.add('mg-live-overlay');
    document.body.classList.add('mg-live');
    document.getElementById('modalGalleryLiveId').textContent = '#' + overlay.id;
    overlay.classList.add('visible');
  }
  function exitLive() {
    if (!liveOverlay) return;
    const o = liveOverlay; liveOverlay = null;
    o.classList.remove('mg-live-overlay', 'visible');
    document.body.classList.remove('mg-live');
  }
  // Esc in live mode: the app's own ladder (app.js keydown) closes the modals
  // it lists, and the observer follows; a modal with no rung (Zoom Settings
  // closes by its Done button) falls back to the gallery's exit, after the
  // ladder has had its turn.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !liveOverlay) return;
    setTimeout(() => { if (liveOverlay) exitLive(); }, 0);
  });
  // Grid mode keeps `.visible` off; live mode ends when the app closes the overlay.
  const classWatch = new MutationObserver((muts) => {
    muts.forEach((m) => {
      const t = m.target;
      if (!t.classList || !t.classList.contains('modal-overlay')) return;
      if (t === liveOverlay) { if (!t.classList.contains('visible')) exitLive(); return; }
      if (t.classList.contains('visible')) t.classList.remove('visible');
    });
  });

  // ---- where it lives, who owns it ----------------------------------------------
  async function annotate() {
    const lineOf = new Map();
    try {
      const html = await (await fetch('/app/index.html', { cache: 'no-store' })).text();
      html.split('\n').forEach((line, i) => { const m = line.match(/\bid="([^"]+)"/); if (m && tilesById.has(m[1]) && !lineOf.has(m[1])) lineOf.set(m[1], i + 1); });
    } catch (_) { /* the shell is always there; a fetch miss just leaves the line blank */ }
    const owners = new Map();
    const srcs = Array.from(document.scripts).map((s) => s.getAttribute('src') || '').filter((s) => /^\/features\/[^/]+\.js$/.test(s) && !/modal-gallery/.test(s));
    await Promise.all(srcs.map(async (src) => {
      try {
        const text = await (await fetch(src)).text();
        tilesById.forEach((_, id) => {
          const n = text.split("'" + id + "'").length - 1 + text.split('"' + id + '"').length - 1;
          if (!n) return;
          const cur = owners.get(id);
          if (!cur || n > cur.n) owners.set(id, { n, src: src.slice(1) });
        });
      } catch (_) { /* skip */ }
    }));
    tilesById.forEach((tile, id) => {
      const parts = [];
      if (lineOf.has(id)) parts.push('app/index.html:' + lineOf.get(id));
      parts.push(owners.has(id) ? owners.get(id).src : 'app.js');
      tile._where.textContent = parts.join(' · ');
      tile.dataset.owner = parts.join(' ');
    });
  }

  // ---- the sample takeoff --------------------------------------------------------
  // The tours' intake (a fetched File through #pdfInput) and the screenshot
  // generator's takeoff: two counters on the restroom fixtures, a waste line,
  // a 1/8" page scale, the legend. Fractions of the drawing's 830 × 660 pt
  // extent on the ANSI B sheet (see scripts/build-screenshots.js).
  async function loadSample() {
    const s = st();
    if (!s.pages.length) {
      const res = await fetch('/samples/sample-plan.pdf');
      if (!res.ok) throw new Error('samples/sample-plan.pdf is missing: npm run build:sample-plan');
      const blob = await res.blob();
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'sample-plan.pdf', { type: 'application/pdf' }));
      const inp = document.getElementById('pdfInput');
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve, reject) => {
        const t0 = Date.now();
        (function poll() { if (s.pages.length) return resolve(); if (Date.now() - t0 > 20000) return reject(new Error('the plan did not open')); setTimeout(poll, 100); })();
      });
    }
    const pw = 830, ph = 660, uid = () => App.uid();
    const DOT = 'M320 96C196 96 96 196 96 320s100 224 224 224 224-100 224-224S444 96 320 96z';
    if (!s.counters.length) {
      const wc = uid(), lav = uid(), lt = uid();
      s.counters.push({ id: wc, name: 'Water Closet', icon: DOT, color: '#e8c547', size: 16 });
      s.counters.push({ id: lav, name: 'Lavatory', icon: DOT, color: '#4a9eff', size: 16 });
      s.lineTypes.push({ id: lt, name: 'Waste line', color: '#47c88e', curveStyle: 'straight' });
      const ann = s.pages[0].canvases[0].annotations;
      ann.counterMarkers[wc] = [0.6136, 0.6479, 0.7771, 0.8133, 0.8494].map((fx) => ({ x: fx * pw, y: 0.7674 * ph, id: uid(), group: null }));
      ann.counterMarkers[lav] = [0.6660, 0.6931, 0.8295, 0.8639, 0.8982].map((fx) => ({ x: fx * pw, y: 0.5595 * ph, id: uid(), group: null }));
      ann.quickLines.push({ id: uid(), x1: 0.5964 * pw, y1: 0.7045 * ph, x2: 0.8675 * pw, y2: 0.7045 * ph, lineTypeId: lt, color: '#47c88e', group: null });
      ann.legend = { x: pw - 210, y: 16, w: 195, h: 60, userResized: false };
      s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
      s.activeCounterId = wc;
      // A room over the restrooms and one group, so Room edit, Group edit and
      // Assign to group have something to open on.
      const room = { id: uid(), name: 'Women 108', color: '#8e6ee6' };
      s.rooms = s.rooms || []; s.rooms.push(room);
      ann.roomBoxes.push({ x1: 0.59 * pw, y1: 0.52 * ph, x2: 0.91 * pw, y2: 0.80 * ph, heightFt: 9, roomId: room.id, id: uid() });
      s.groups = s.groups || []; s.groups.push({ id: uid(), name: 'Open office receptacles', color: '#c8963a', panel: 'LP-1', circuit: '7', loadAmps: 12 });
      s.groupsEnabled = true;
      App.renderPdf();
      App.updateUI();
    }
  }

  // ---- hot CSS ---------------------------------------------------------------------
  function reloadCss() {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter((l) => /\/styles\.css(\?|$)/.test(l.getAttribute('href') || ''));
    links.forEach((old) => {
      const fresh = old.cloneNode();
      fresh.href = '/styles.css?mg=' + Date.now();
      fresh.onload = () => { old.remove(); markWide(); };
      old.after(fresh);
    });
    const phone = document.querySelector('#modalGalleryPhone iframe');
    try { phone && phone.contentWindow && phone.contentWindow.App && phone.contentWindow.App.modalGalleryReloadCss && phone.contentWindow.App.modalGalleryReloadCss(); } catch (_) { /* cross-boot */ }
  }

  // ---- filter --------------------------------------------------------------------------
  function applyFilter(q) {
    q = (q || '').trim().toLowerCase();
    tilesById.forEach((tile, id) => {
      const hay = (id + ' ' + (tile.dataset.owner || '')).toLowerCase();
      tile.classList.toggle('mg-hidden', !!q && !hay.includes(q));
    });
  }

  function build() {
    const style = el('style'); style.id = 'modalGalleryStyle'; style.textContent = CSS; document.head.appendChild(style);
    const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
    const toasts = Array.from(document.querySelectorAll('#toastRegion .toast-card'));
    const popovers = POPOVER_IDS.map((id) => document.getElementById(id)).filter(Boolean);

    const root = el('div'); root.id = 'modalGallery';
    const bar = el('div'); bar.id = 'modalGalleryBar';
    bar.appendChild(el('h1', null, 'Modal Gallery'));
    bar.appendChild(el('span', 'mg-count', overlays.length + ' modals · ' + toasts.length + ' toasts · ' + popovers.length + ' popovers'));
    const search = el('input'); search.type = 'search'; search.placeholder = 'Filter by id or owner file…'; search.id = 'modalGalleryFilter';
    search.oninput = () => applyFilter(search.value);
    bar.appendChild(search);
    const sample = el('button', null, 'Load sample'); sample.id = 'modalGalleryLoadSample';
    sample.onclick = async () => { sample.disabled = true; sample.textContent = 'Loading…'; try { await loadSample(); sample.textContent = 'Sample loaded'; } catch (e) { sample.disabled = false; sample.textContent = 'Load sample'; App.showToast(String(e && e.message || e), 4000); } };
    bar.appendChild(sample);
    const css = el('button', null, 'Reload CSS'); css.id = 'modalGalleryReloadCss'; css.onclick = reloadCss; bar.appendChild(css);
    const phone = el('button', null, 'Mobile'); phone.id = 'modalGalleryPhoneToggle';
    phone.onclick = () => {
      const on = document.body.classList.toggle('mg-phone');
      phone.classList.toggle('mg-on', on);
      const frame = document.querySelector('#modalGalleryPhone iframe');
      if (on && !frame.src) { const u = new URL(window.location.href); u.searchParams.set('narrow', '1'); frame.src = u.toString(); }
    };
    bar.appendChild(phone);
    bar.appendChild(el('span', 'mg-spacer'));
    bar.appendChild(el('span', 'mg-note', 'The app’s own markup and CSS. Edit styles.css, Reload CSS. Populate runs the real opener; Open live shows the fixed overlay.'));
    root.appendChild(bar);

    const body = el('div'); body.id = 'modalGalleryBody';
    const main = el('div'); main.id = 'modalGalleryMain';
    main.appendChild(section('Modals', 'every .modal-overlay in app/index.html', overlays, 'modal', OPENERS));
    main.appendChild(section('Toasts', 'the #toastRegion corner cards', toasts, 'toast', TOAST_OPENERS));
    main.appendChild(section('Popovers', 'fixed panels and menus', popovers, 'popover', POPOVER_OPENERS));
    body.appendChild(main);
    const phoneWrap = el('div'); phoneWrap.id = 'modalGalleryPhone';
    const iframe = el('iframe'); iframe.title = 'Modal Gallery at phone width'; phoneWrap.appendChild(iframe);
    body.appendChild(phoneWrap);
    root.appendChild(body);

    const pill = el('div'); pill.id = 'modalGalleryLivePill';
    pill.appendChild(el('span', null, 'Live: '));
    pill.appendChild(el('strong', null, '')).id = 'modalGalleryLiveId';
    pill.appendChild(el('span', null, '· Esc or Cancel returns to the grid'));
    const back = el('button', null, 'Back to gallery'); back.onclick = exitLive; pill.appendChild(back);
    root.appendChild(pill);

    document.body.appendChild(root);
    document.documentElement.classList.add('mg-root');
    document.body.classList.add('modal-gallery');
    if (NARROW) document.body.classList.add('mg-narrow');
    document.title = 'Modal Gallery · CountTooling';
    classWatch.observe(root, { attributes: true, attributeFilter: ['class'], subtree: true });
    markWide();
    annotate();
    // The service worker serves styles.css cache-first on localhost too; a
    // cache-busted link on boot means the grid shows the working tree's CSS.
    reloadCss();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  App.modalGalleryReloadCss = reloadCss;
  App.modalGalleryLoadSample = loadSample;
  App.modalGalleryOpenLive = (id) => { const n = document.getElementById(id); if (n) openLive(n); };
  App.modalGalleryExitLive = exitLive;
  App.modalGalleryPopulate = (id, variant) => {
    // Headless seam for scripts/build-modal-gallery.js: run a tile's opener by
    // id (and variant label, for a modal with several) and report the outcome.
    const op = OPENERS[id] || TOAST_OPENERS[id] || POPOVER_OPENERS[id];
    if (!op) return { ran: false, reason: 'no opener' };
    let fn = op;
    if (Array.isArray(op)) { const pick = variant ? op.find(([l]) => l === variant) : op[0]; if (!pick) return { ran: false, reason: 'no variant ' + variant }; fn = pick[1]; }
    try { const r = fn(); return { ran: true, async: !!(r && typeof r.then === 'function') }; } catch (e) { return { ran: false, reason: String(e && e.message || e) }; }
  };
  App.modalGalleryOpenerVariants = (id) => { const op = OPENERS[id] || TOAST_OPENERS[id] || POPOVER_OPENERS[id]; return Array.isArray(op) ? op.map(([l]) => l) : op ? [null] : []; };
})();
