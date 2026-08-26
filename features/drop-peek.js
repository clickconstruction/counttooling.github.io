/*
 * features/drop-peek.js - drop-size disclosure on the canvas: the hover/tap
 * peek chip and the "Drop sizes" header toggle (wendi's view-mode request:
 * see drop distances without cluttering the sheet).
 *
 * Two tiers, both viewer-safe (TOOL.NONE is admitted through the viewer tool
 * gate in handleCanvasClick):
 *
 * - PEEK (always on): with the Move tool active, hovering a drop marker —
 *   or tapping it on touch, where the synthesized click flows through the
 *   same handleCanvasClick path — shows a floating DOM chip naming the line
 *   type and the drop size in its stored unit ("3 ft", "6 in"). A click PINS
 *   the chip (tap-friendly); any pointerdown, wheel, or keydown dismisses it,
 *   which also covers pan starts, zooms, page nav, and every keyboard action
 *   that could move the sheet under a stale chip. Hit-testing rides the
 *   node model (collectDropNodes) — coincident line ends are ONE node
 *   carrying ONE drop, so a chain joint peeks a single unambiguous value.
 *
 * - TOGGLE (#dropSizesBtn, beside #hideMarksBtn): paints a small value chip
 *   beside every drop glyph via env.showDropSizes in canvas-draw.js's
 *   drawAnnotationsCore (live overlay only — export/print envs never set it).
 *   Off by default; shown only when the project actually has drops (or the
 *   toggle is on, so it can always be turned off). Persisted per device:
 *   `view:dropSizes:<token>` for view-link sessions (restored by
 *   features/view-only.js next to view:hideMarks), plain
 *   `clickcount-show-drop-sizes` otherwise (restored here at load). A visual
 *   preference like hide-marks — deliberately NOT in project save/load, so
 *   one user's toggle never follows the project to someone else's screen.
 *
 * app.js integration points: handleCanvasMouseMove tail calls
 * App.onDropPeekHover(pdf) (after its cursor block, so the pointer cursor
 * promotion here wins); handleCanvasClick's TOOL.NONE branch calls
 * App.onDropPeekClick(pdf, e) (e null on the aim-loupe commit path); updateUI
 * calls App.updateDropSizesButton; renderAnnotations' live env carries
 * showDropSizes. features/burger-menu.js mirrors the toggle as a drawer row
 * on mobile (where .consolidated-mobile hides the header button).
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // CSS-px hit radius around a drop marker — deliberately wider than the glyph
  // (and than drop-mode's 14): peeking is a read gesture, generosity is free.
  const HIT_PX = 16;
  // A click that traveled farther than this since pointerdown is a pan/drag
  // release, not a tap — no chip.
  const CLICK_SLOP_PX = 8;
  const LOCAL_KEY = 'clickcount-show-drop-sizes';

  let chipEl = null;
  let pinnedNodeKey = null;   // "x:y" of the pinned node, null = hover-only
  let shownNodeKey = null;    // "x:y" of whichever node the chip currently shows
  let chipVisible = false;
  let cursorPromoted = false;
  let lastPointerDown = null; // { x, y } client coords of the latest pointerdown

  // --- annotations under the peek ------------------------------------------

  // Mirror of renderAnnotationsInner's source pick: what the user SEES is what
  // the peek hit-tests (active canvas, or the merged show-all-layers peek).
  function visibleAnnotations() {
    const state = App.state;
    const page = state.pages[state.currentPage];
    if (!page) return null;
    return state.showAllCanvases
      ? App.getMergedAnnotationsForPage(page, (state.peekCanvasIdsByPage || {})[state.currentPage] || null)
      : App.getActiveAnnotations(page);
  }

  function findDropNodeAt(pdf) {
    const state = App.state;
    const ann = visibleAnnotations();
    if (!ann || !pdf) return null;
    const r = HIT_PX / (state.zoom || 1);
    let best = null, bestD = Infinity;
    App.collectDropNodes(ann).forEach((n) => {
      if (!(n.value > 0)) return;
      const dx = n.x - pdf.x, dy = n.y - pdf.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r && d < bestD) { best = n; bestD = d; }
    });
    return best;
  }

  // The line end that carries the node's drop (the node model zeroes every
  // other coincident end), for the chip's line-type name + color.
  function carryingLine(ann, node) {
    for (const ref of node.refs || []) {
      const line = ref.kind === 'poly' ? (ann.polylines || [])[ref.index] : (ann.quickLines || [])[ref.index];
      if (!line) continue;
      const v = ref.end === 'start' ? line.startDrop : line.endDrop;
      if ((v || 0) > 0) return line;
    }
    return null;
  }

  // --- the chip -------------------------------------------------------------

  function ensureChip() {
    if (chipEl) return chipEl;
    chipEl = document.createElement('div');
    chipEl.id = 'dropPeekChip';
    chipEl.setAttribute('role', 'status');
    chipEl.style.display = 'none';
    document.body.appendChild(chipEl);
    return chipEl;
  }

  function nodeKey(node) { return node.x + ':' + node.y; }

  function showChipForNode(node, pin) {
    const state = App.state;
    const ann = visibleAnnotations();
    if (!ann) return;
    const line = carryingLine(ann, node);
    const lt = line ? (state.lineTypes || []).find((l) => l.id === line.lineTypeId) : null;
    const name = (lt && lt.name) || 'Line';
    const color = (lt && lt.color) || (line && line.color) || '#4a9eff';
    const label = App.formatDropLabel(node.value, node.unit || 'ft');
    if (!label) return;
    const el = ensureChip();
    el.innerHTML =
      '<div class="drop-peek-name"><span class="drop-peek-swatch" style="background:' + App.escapeHtml(color) + '"></span>' +
      App.escapeHtml(name) + '</div>' +
      '<div class="drop-peek-value">' + App.escapeHtml(label) + ' drop</div>';
    // Node PDF-space -> client px: toCanvas gives backing-buffer px; the
    // canvas's CSS rect carries both the DPR division and any CSS scaling.
    const annCanvas = document.getElementById('annCanvas');
    const rect = annCanvas.getBoundingClientRect();
    const bc = App.toCanvas({ x: node.x, y: node.y });
    const cx = rect.left + bc.x * (rect.width / (annCanvas.width || 1));
    const cy = rect.top + bc.y * (rect.height / (annCanvas.height || 1));
    el.style.display = '';
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = cx - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = cy - h - 14;
    el.classList.toggle('below', top < rect.top + 4);
    if (top < rect.top + 4) top = cy + 14;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    chipVisible = true;
    shownNodeKey = nodeKey(node);
    pinnedNodeKey = pin ? shownNodeKey : null;
  }

  function hideChip() {
    if (chipEl) chipEl.style.display = 'none';
    chipVisible = false;
    shownNodeKey = null;
    pinnedNodeKey = null;
  }
  // Exposed for page/project teardowns that swap the sheet under the chip.
  App.hideDropPeek = hideChip;

  // --- app.js hooks ---------------------------------------------------------

  function peekAllowed() {
    const state = App.state;
    return !!(state.pages.length && state.tool === App.TOOL.NONE && !state.hideMarks);
  }

  App.onDropPeekHover = function (pdf) {
    const state = App.state;
    const annCanvas = document.getElementById('annCanvas');
    if (!peekAllowed() || state.isPanning) {
      if (!pinnedNodeKey && chipVisible) hideChip();
      if (cursorPromoted && annCanvas) { annCanvas.style.cursor = ''; cursorPromoted = false; }
      return;
    }
    const node = findDropNodeAt(pdf);
    if (annCanvas) {
      // Promote only the cursor app.js left unset — never fight a busier one.
      if (node && !annCanvas.style.cursor) { annCanvas.style.cursor = 'pointer'; cursorPromoted = true; }
      else if (!node && cursorPromoted) { if (annCanvas.style.cursor === 'pointer') annCanvas.style.cursor = ''; cursorPromoted = false; }
    }
    if (pinnedNodeKey) return;   // a pinned chip holds until an explicit dismiss
    // Same node, chip already up: nothing to rebuild (the node is fixed in
    // PDF-space and the sheet can't have moved without a dismissal event).
    if (node && chipVisible && shownNodeKey === nodeKey(node)) return;
    if (node) showChipForNode(node, false);
    else if (chipVisible) hideChip();
  };

  App.onDropPeekClick = function (pdf, e) {
    if (!peekAllowed()) return;
    // Pan-release guard: a click whose pointer traveled is not a tap. The
    // aim-loupe commit path passes e = null — always a deliberate point.
    if (e && lastPointerDown) {
      const dx = e.clientX - lastPointerDown.x, dy = e.clientY - lastPointerDown.y;
      if (Math.sqrt(dx * dx + dy * dy) > CLICK_SLOP_PX) return;
    }
    const node = findDropNodeAt(pdf);
    if (!node) { hideChip(); return; }
    if (pinnedNodeKey === nodeKey(node)) { hideChip(); return; }   // same node: toggle off
    showChipForNode(node, true);
  };

  // --- the Drop sizes toggle ------------------------------------------------

  function annHasDrops(ann) {
    if (!ann) return false;
    const has = (l) => (l.startDrop || 0) > 0 || (l.endDrop || 0) > 0;
    return (ann.quickLines || []).some(has) || (ann.polylines || []).some(has);
  }
  function projectHasAnyDrops() {
    const state = App.state;
    return (state.pages || []).some((pg) =>
      (pg.canvases || []).some((c) => annHasDrops(c && c.annotations)) || annHasDrops(pg.annotations));
  }
  App.projectHasAnyDrops = projectHasAnyDrops;

  function persistShowDropSizes(on) {
    const state = App.state;
    try {
      if (state.viewToken) localStorage.setItem('view:dropSizes:' + state.viewToken, on ? '1' : '0');
      else localStorage.setItem(LOCAL_KEY, on ? '1' : '0');
    } catch (_) { /* storage may be unavailable */ }
  }

  function toggleDropSizes() {
    const state = App.state;
    state.showDropSizes = !state.showDropSizes;
    persistShowDropSizes(state.showDropSizes);
    App.renderAnnotations();
    updateDropSizesButton();
  }
  App.toggleDropSizes = toggleDropSizes;

  function updateDropSizesButton() {
    const state = App.state;
    const btn = document.getElementById('dropSizesBtn');
    if (!btn) return;
    // Shown only when there is something to label — or the toggle is on, so it
    // can always be turned back off after the last drop is deleted.
    const show = !!(state.pages.length && (state.showDropSizes || projectHasAnyDrops()));
    btn.style.display = show ? '' : 'none';
    const on = !!state.showDropSizes;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = on ? 'Hide drop sizes' : 'Drop sizes';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
  App.updateDropSizesButton = updateDropSizesButton;

  // --- wiring ---------------------------------------------------------------

  function wire() {
    const btn = document.getElementById('dropSizesBtn');
    if (btn) btn.onclick = () => toggleDropSizes();

    // One dismissal model: ANY pointerdown hides the chip (a canvas tap that
    // lands on a node re-pins it via the click that follows), a wheel over the
    // canvas hides it before the zoom moves the sheet, and any keydown hides
    // it before page nav / rotate / undo can strand it over stale geometry.
    document.addEventListener('pointerdown', (e) => {
      lastPointerDown = { x: e.clientX, y: e.clientY };
      if (chipVisible) hideChip();
    }, true);
    const wrapper = document.getElementById('canvasWrapper');
    if (wrapper) wrapper.addEventListener('wheel', () => { if (chipVisible) hideChip(); }, { passive: true });
    document.addEventListener('keydown', () => { if (chipVisible) hideChip(); }, true);

    // Non-view sessions restore the per-device toggle here; view-link sessions
    // are restored by features/view-only.js from view:dropSizes:<token> (the
    // view hydration runs later and knows the token).
    const state = App.state;
    if (state && state.showDropSizes === undefined) {
      try { state.showDropSizes = localStorage.getItem(LOCAL_KEY) === '1'; } catch (_) { state.showDropSizes = false; }
    }
  }
  wire();
})();
