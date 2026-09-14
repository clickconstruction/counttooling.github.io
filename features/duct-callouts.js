/*
 * features/duct-callouts.js — plan-and-spec callout reading (DUCT-PLAN.md
 * "Two modes, one machine", unit D10 — the secondary mode). An engineered
 * M-sheet already prints every duct size beside its run, and the PDF's text
 * layer carries those callouts with coordinates; this file lets the trace
 * READ them instead of the user re-typing them. Regex over pdf.js text, no
 * AI, offline-safe. The mode is IMPLICIT — no toggle: a sheet with no text
 * layer (a scan) simply never produces a callout and everything below is a
 * silent no-op, leaving the design-build behavior (D6) exactly as it was.
 *
 * Two surfaces, one primitive:
 *
 *   1. Starting-size prefill. Arming Duct (#ductCreateModal) with a plan open
 *      pre-fills the size fields from the nearest callout to the cursor's
 *      LAST CANVAS POSITION (state.mousePos — the point the user was working
 *      at when they reached for the button) when one sits within
 *      DUCT_CALLOUT_RADIUS_PT (60 pt, duct-model.js), and says so beside the
 *      fields ("from the plan: 24×12", #ductCreateCalloutNote). The user can
 *      change it; no callout = the fields are left exactly as they were.
 *      A text layer still loading at open time lands via onPageTextLoaded
 *      and prefills then — unless the user has already touched the fields.
 *
 *   2. Step-down offers while tracing. As the cursor moves along a trace,
 *      a callout within the radius whose size DIFFERS from the current
 *      segment's yields a quiet chip line under the cursor size chip —
 *      "Plan says 20×12 here — S accepts" (the D6 chip vocabulary) — plus
 *      the S popover's FIRST section ('plan-callout', order 3, before D6's
 *      suggestion at 5): the pre-highlighted size, one tap applies it
 *      through the normal applyDuctSizeStep path (the step is recorded; D3
 *      turns it into a transition). NEVER auto-applied.
 *
 * PRECEDENCE (one line, never two): when a plan callout and a ductulator
 * suggestion are both present, the plan callout wins the chip line — the
 * engineer's printed size outranks a rule-of-thumb computation — and the
 * popover shows BOTH sections, callout first (3 < 5). getDuctCursorLine()
 * is the single resolver duct-tool.js's overlay draws from.
 *
 * COST DISCIPLINE (the T2-09 readout rule — no per-mousemove pdf.js work):
 * the text layer is fetched ONCE per page, lazily, by tag-reader.js's
 * pageTextItems cache (first call fetches; pages the user never traces are
 * never fetched); every hover is a geometric lookup over that array through
 * App.queryPdfTextNear, and the lookup itself is memoized per 2-pt cursor
 * cell so a burst of mousemoves inside one cell costs one scan.
 *
 * Pure parts in duct-model.js: parseDuctCallout (the grammar),
 * nearestDuctCallout (the pick), DUCT_CALLOUT_RADIUS_PT. Boundary rule: read
 * shared deps from App.* at call time. See ARCHITECTURE.md "Feature files /
 * window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // --- the nearest callout, memoized per cursor cell -------------------------
  let textVersion = 0;   // bumped when a page's text layer lands (memo key)
  let memo = null;       // { key, hit }

  function calloutAt(pageIdx, pt) {
    if (!pt || !App.queryPdfTextNear || typeof nearestDuctCallout !== 'function') return null;
    const key = textVersion + ':' + pageIdx + ':' + Math.round(pt.x / 2) + ':' + Math.round(pt.y / 2);
    if (memo && memo.key === key) return memo.hit;
    const items = App.queryPdfTextNear(pageIdx, pt, DUCT_CALLOUT_RADIUS_PT);
    const hit = nearestDuctCallout(items, pt, DUCT_CALLOUT_RADIUS_PT);
    memo = { key: key, hit: hit };
    return hit;
  }

  // A page's text layer just landed (tag-reader.js): drop the memo (it may
  // hold a "nothing here" answer from before the fetch) and complete a
  // prefill that was waiting on it.
  function onPageTextLoaded(pageIdx) {
    textVersion++;
    memo = null;
    if (pageIdx === App.state.currentPage) syncDuctCalloutPrefill({ deferred: true });
  }

  // --- the step-down offer while tracing --------------------------------------

  /**
   * The offer for the in-progress trace, or null: the nearest callout within
   * radius of the cursor whose size differs from the current segment's.
   * { size, str, x, y, w, h, dist, chipText, popoverLabel }.
   */
  function getDuctCalloutOffer() {
    const state = App.state;
    const draft = state.drawingDuct;
    if (!draft || state.tool !== App.TOOL.DUCT || !state.mousePos) return null;
    const hit = calloutAt(state.currentPage, state.mousePos);
    if (!hit) return null;
    const cur = App.getCurrentDuctSize ? App.getCurrentDuctSize() : null;
    if (cur && formatDuctSize(cur) === formatDuctSize(hit.size)) return null;   // already this size — nothing to step to
    const label = formatDuctSize(hit.size);
    return {
      size: hit.size, str: hit.str, x: hit.x, y: hit.y, w: hit.w, h: hit.h, dist: hit.dist,
      chipText: 'Plan says ' + label + ' here. S accepts',
      popoverLabel: 'Plan says ' + label + ' here',
    };
  }

  /**
   * THE precedence resolver for the one quiet line under the cursor size
   * chip: { kind: 'callout', text, offer } when the plan prints a different
   * size here, else { kind: 'suggestion', text, suggestion } from D6, else
   * null. duct-tool.js's overlay draws exactly this.
   */
  function getDuctCursorLine() {
    const offer = getDuctCalloutOffer();
    if (offer) return { kind: 'callout', text: offer.chipText, offer: offer };
    const sug = App.getDuctDraftSuggestion && App.getDuctDraftSuggestion();
    if (sug) return { kind: 'suggestion', text: sug.chipText, suggestion: sug };
    return null;
  }

  // Ring the callout that was read (device px; env.fontScale = zoom × DPR) —
  // the tag-reader idiom, in the run's airside color.
  function drawDuctCalloutRing(ctx, env, offer, color) {
    if (!offer || !App.toCanvas) return;
    const fontScale = (env && env.fontScale) || 1;
    const a = App.toCanvas({ x: offer.x, y: offer.y });
    const b = App.toCanvas({ x: offer.x + offer.w, y: offer.y + offer.h });
    const pad = 3 * fontScale;
    ctx.save();
    ctx.strokeStyle = color || '#e8c547';
    ctx.lineWidth = Math.max(1, 1.2 * fontScale);
    ctx.setLineDash([3 * fontScale, 2 * fontScale]);
    ctx.strokeRect(Math.min(a.x, b.x) - pad, Math.min(a.y, b.y) - pad, Math.abs(b.x - a.x) + pad * 2, Math.abs(b.y - a.y) + pad * 2);
    ctx.restore();
  }

  // --- the S-popover section (order 3 — FIRST, ahead of D6's suggestion at 5:
  // the plan's printed size is the answer when it exists) ----------------------
  App.registerDuctPopoverSection && App.registerDuctPopoverSection({
    id: 'plan-callout',
    order: 3,
    render(container, ctx) {
      const offer = getDuctCalloutOffer();
      if (!offer) return false;
      const label = document.createElement('div');
      label.className = 'duct-popover-section-label';
      label.textContent = 'From the plan';
      container.appendChild(label);
      const row = document.createElement('div');
      row.className = 'duct-suggest-row';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'duct-suggest-chip duct-callout-chip';
      b.title = offer.popoverLabel;
      b.setAttribute('aria-label', offer.popoverLabel);
      b.textContent = formatDuctSize(offer.size);
      b.onclick = () => ctx.applySize(offer.size);
      row.appendChild(b);
      container.appendChild(row);
      const from = document.createElement('div');
      from.className = 'duct-suggest-from';
      from.textContent = 'reads "' + offer.str.trim() + '" on the sheet';
      container.appendChild(from);
    },
  });

  // --- the starting-size prefill on the create modal ----------------------------
  let prefillTouched = false;   // the user edited a size field since the modal opened
  let prefillWired = false;

  function wirePrefill() {
    if (prefillWired) return;
    prefillWired = true;
    ['ductCreateW', 'ductCreateH', 'ductCreateD'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { prefillTouched = true; });
    });
    const toggle = document.getElementById('ductCreateShapeToggle');
    if (toggle) toggle.addEventListener('click', () => { prefillTouched = true; });
  }

  /**
   * Called by duct-tool.js's openDuctCreateModal (and again by
   * onPageTextLoaded when the text layer lands after the open). Prefills the
   * size fields from the nearest callout to the cursor's last canvas
   * position and shows the "from the plan: 24×12" note; with no callout the
   * fields are left untouched and the note hidden.
   */
  function syncDuctCalloutPrefill(opts) {
    const state = App.state;
    const note = document.getElementById('ductCreateCalloutNote');
    const modal = document.getElementById('ductCreateModal');
    if (!note || !modal) return;
    wirePrefill();
    const deferred = !!(opts && opts.deferred);
    if (deferred) {
      if (!modal.classList.contains('visible') || prefillTouched) return;
    } else {
      prefillTouched = false;
      note.style.display = 'none';
      note.textContent = '';
    }
    const hit = state.pages.length && state.mousePos ? calloutAt(state.currentPage, state.mousePos) : null;
    if (!hit || !App.setDuctCreateSize) return;
    App.setDuctCreateSize(hit.size);
    note.textContent = 'from the plan: ' + formatDuctSize(hit.size);
    note.style.display = '';
  }

  App.getDuctCalloutOffer = getDuctCalloutOffer;
  App.getDuctCursorLine = getDuctCursorLine;
  App.drawDuctCalloutRing = drawDuctCalloutRing;
  App.syncDuctCalloutPrefill = syncDuctCalloutPrefill;
  App.onPageTextLoaded = onPageTextLoaded;
})();
