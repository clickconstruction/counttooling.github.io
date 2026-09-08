/*
 * features/tag-reader.js - "Read the tags" (Electrical, First-Class S6): the
 * PDF's text layer answers which fixture type a click is, and builds the
 * palette from the schedule.
 *
 * Lighting is counted by a letter beside the symbol, and that letter is in
 * the text layer with coordinates. Two uses of one primitive ("text items
 * near a point / inside a box", pdf.js getTextContent on the page's own
 * PDFPageProxy, converted into app PDF-space through the same viewport the
 * annotations use — see pageTextItems):
 *
 *   1. Tag-aware placement. With the Counter tool armed on an electrical
 *      project, the cursor reads the nearest tag ("Plan says B"); the click
 *      lands on the counter whose tag matches (tag-model.js tagOfCounter —
 *      an explicit `counter.tag`, else a name like "Type B" / "B — …"), and
 *      when no counter has that tag, Enter creates "Type B" and places it.
 *   2. Palette from the schedule. TOOL.SCHEDULE (the "Read a schedule from the
 *      sheet…" link on the Counter modal's Create tab) is a rect tool: drag a
 *      box over the fixture schedule and the rows inside it are proposed as
 *      counters — tag + description, one confirm (#schedulePaletteModal).
 *
 * Honest about scans: no text layer, no suggestion — the click behaves
 * exactly as before. Nothing is persisted but the counters the user creates
 * (and their `tag`); the text cache is per session, keyed by the page's proxy.
 *
 * Registrations: drawTagOverlay(ctx, env) (renderAnnotations, after the duct
 * overlay), tagHintText() (status bar), tagSwapCounterId(pdfPoint) (the
 * Counter tool's placement), tagCreateFromHint() (Enter), proposeCountersFromBox
 * (TOOL.SCHEDULE corner 2), renderTagField(kind, item) (details modal),
 * renderTagReaderUI() (updateUI: the Create-tab link), pageTextItems(pageIdx).
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const TM = () => window.TagModel;
  const HINT_RADIUS_PT = 18;   // ~1/4" on the sheet: the tag sits right beside its symbol

  // --- the text layer, in app PDF-space --------------------------------------
  const textCache = new Map();   // pageIdx -> { pdfPage, items: [] | null (loading), promise }

  function active() {
    const state = App.state;
    if (!state) return false;
    if (state.trade === 'electrical') return true;
    return (state.counters || []).some((c) => c.tag);
  }

  // Items for a page: [{ str, x, y, w, h }] with x,y the box's top-left in
  // app PDF-space (viewport at scale 1 and the page's rotation — the same
  // space canvasToPdf produces). Returns [] while loading and kicks the load.
  function pageTextItems(pageIdx) {
    const state = App.state;
    const page = state && state.pages && state.pages[pageIdx];
    if (!page || !page.pdfPage) return [];
    const cached = textCache.get(pageIdx);
    if (cached && cached.pdfPage === page.pdfPage) return cached.items || [];
    const entry = { pdfPage: page.pdfPage, items: null, promise: null };
    textCache.set(pageIdx, entry);
    entry.promise = page.pdfPage.getTextContent().then((tc) => {
      const rot = page.rotation ?? 0;
      const vp = page.pdfPage.getViewport({ scale: 1, rotation: rot });
      const items = [];
      (tc.items || []).forEach((it) => {
        if (!it || typeof it.str !== 'string' || !it.str.trim() || !Array.isArray(it.transform)) return;
        const [a, b, c, d, e, f] = it.transform;
        const lenX = Math.hypot(a, b) || 1, lenY = Math.hypot(c, d) || 1;
        const w = it.width || 0, h = it.height || lenY;
        const ux = a / lenX, uy = b / lenX, vx = c / lenY, vy = d / lenY;
        const corners = [[e, f], [e + ux * w, f + uy * w], [e + vx * h, f + vy * h], [e + ux * w + vx * h, f + uy * w + vy * h]]
          .map(([x, y]) => vp.convertToViewportPoint(x, y));
        const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
        const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
        items.push({ str: it.str, x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
      });
      entry.items = items;
      if (App.renderAnnotations && state.tool === App.TOOL.COUNTER) App.renderAnnotations();
      return items;
    }).catch(() => { entry.items = []; return []; });
    return [];
  }

  // --- tag-aware placement ------------------------------------------------------
  let currentHint = null;   // { tag, counterId | null, x, y } for the cursor position

  function counterForTag(tag) {
    const tm = TM();
    return (App.state.counters || []).find((c) => tm.tagOfCounter(c) === tag) || null;
  }
  function hintAt(pt) {
    const state = App.state;
    const tm = TM();
    if (!tm || !pt || !active()) return null;
    const items = pageTextItems(state.currentPage);
    if (!items.length) return null;
    const near = tm.nearestTag(items, pt, HINT_RADIUS_PT);
    if (!near) return null;
    const counter = counterForTag(near.str);
    return { tag: near.str, counterId: counter ? counter.id : null, counterName: counter ? counter.name : null, x: near.x, y: near.y, w: near.w, h: near.h };
  }
  // The counter id a click at `pt` should land on: the tag's counter when one
  // exists (and it is a different counter than the active one, or the same —
  // either way the tag wins); null = place as before.
  function tagSwapCounterId(pt) {
    const h = hintAt(pt);
    if (!h || !h.counterId) return null;
    if (h.counterId !== App.state.activeCounterType) {
      App.logUserEvent && App.logUserEvent('tag_suggestion_accepted', App.state.currentProjectId || null, { tag: h.tag, route: 'click' });
    }
    return h.counterId;
  }
  function tagHintText() {
    const state = App.state;
    if (!state || state.tool !== App.TOOL.COUNTER || !state.mousePos) return '';
    const h = hintAt(state.mousePos);
    currentHint = h;
    if (!h) return '';
    return 'Plan says ' + h.tag + (h.counterName ? ' → ' + h.counterName : ' · Enter creates Type ' + h.tag);
  }
  function iconForTag(tag) {
    const letter = String(tag || '').charAt(0);
    const icons = App.getOrderedIcons ? App.getOrderedIcons() : [];
    const byName = icons.find((ic) => String(ic.name || '').toUpperCase() === tag) || icons.find((ic) => String(ic.name || '').toUpperCase() === letter);
    if (byName) return byName.value;
    const troffer = (App.getEffectiveCustomIcons ? App.getEffectiveCustomIcons() : []).find((ic) => ic.name === '2x4 Troffer');
    return troffer ? troffer.value : (icons[0] ? icons[0].value : '');
  }
  // Enter with a hint that has no counter yet: create "Type B" (tagged) and
  // make it active. Returns true when it acted.
  function tagCreateFromHint() {
    const state = App.state;
    if (!state || state.tool !== App.TOOL.COUNTER) return false;
    const h = currentHint || (state.mousePos ? hintAt(state.mousePos) : null);
    if (!h || h.counterId) return false;
    App.pushUndoSnapshot();
    const counter = { id: App.uid(), name: 'Type ' + h.tag, icon: iconForTag(h.tag), color: App.COLORS[(state.counters || []).length % App.COLORS.length], tag: h.tag };
    state.counters.push(counter);
    state.activeCounterType = counter.id;
    App.markProjectDirty();
    App.logUserEvent && App.logUserEvent('tag_suggestion_accepted', state.currentProjectId || null, { tag: h.tag, route: 'enter-create' });
    App.showToast('Created ' + counter.name + ' — click to place it');
    App.updateUI();
    return true;
  }

  // The cursor chip, painted on the live overlay (device px; env.fontScale =
  // zoom × DPR) — the duct tool's chip idiom.
  function drawTagOverlay(ctx, env) {
    const state = App.state;
    if (!state || state.tool !== App.TOOL.COUNTER || !state.mousePos || !active()) return;
    const h = hintAt(state.mousePos);
    currentHint = h;
    if (!h) return;
    const fontScale = (env && env.fontScale) || 1;
    const p = App.toCanvas(state.mousePos);
    const label = 'Plan says ' + h.tag + (h.counterName ? ' → ' + h.counterName : ' · Enter creates Type ' + h.tag);
    const fontSize = 11 * fontScale;
    ctx.save();
    ctx.font = '600 ' + fontSize + 'px DM Sans, sans-serif';
    const tw = ctx.measureText(label).width;
    const pad = 5 * fontScale;
    const x = p.x + 18 * fontScale, y = p.y - 14 * fontScale - fontSize;
    ctx.fillStyle = 'rgba(20,20,20,0.88)';
    ctx.fillRect(x, y, tw + pad * 2, fontSize + pad * 2);
    ctx.fillStyle = h.counterName ? '#e8c547' : '#fff';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + pad, y + pad);
    // ring the tag it read
    const t = App.toCanvas({ x: h.x + h.w / 2, y: h.y + h.h / 2 });
    ctx.strokeStyle = '#e8c547'; ctx.lineWidth = Math.max(1, 1.2 * fontScale); ctx.setLineDash([3 * fontScale, 2 * fontScale]);
    ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(6, (h.h || 8) * 0.9 * fontScale), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // --- palette from the schedule -------------------------------------------------
  let pendingProposal = null;

  function proposeCountersFromBox(box) {
    const state = App.state;
    const tm = TM();
    if (!tm) return;
    const items = pageTextItems(state.currentPage);
    const finish = (list) => {
      const rows = tm.parseScheduleRows(tm.rowsInBox(list, box));
      if (!rows.length) { App.showToast(list.length ? 'No "tag + description" rows inside that box — draw it over the schedule table' : 'This sheet has no text layer to read (a scan) — build the counters by hand'); return; }
      openProposal(rows);
    };
    const entry = textCache.get(state.currentPage);
    if (entry && entry.items === null && entry.promise) entry.promise.then(finish);
    else finish(items);
  }
  function openProposal(rows) {
    const tm = TM();
    const esc = App.escapeHtml;
    pendingProposal = rows.map((r) => ({ ...r, exists: !!counterForTag(r.tag), checked: !counterForTag(r.tag) }));
    const list = document.getElementById('schedulePaletteList');
    const intro = document.getElementById('schedulePaletteIntro');
    if (!list || !intro) return;
    intro.textContent = pendingProposal.length + ' fixture type' + (pendingProposal.length === 1 ? '' : 's') + ' read from the schedule. Untick any you do not want; each becomes a counter named by its tag.';
    list.innerHTML = pendingProposal.map((r, i) => '<label class="schedule-palette-row' + (r.exists ? ' exists' : '') + '"><input type="checkbox" data-i="' + i + '"' + (r.checked ? ' checked' : '') + '><span class="tag">' + esc(r.tag) + '</span><span class="desc" title="' + esc(r.description) + '">' + esc(r.description) + '</span></label>').join('');
    list.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.onchange = () => { pendingProposal[Number(cb.dataset.i)].checked = cb.checked; }; });
    void tm;
    App.showModal('schedulePaletteModal');
  }
  function createProposedCounters() {
    const state = App.state;
    const picked = (pendingProposal || []).filter((r) => r.checked);
    if (!picked.length) { App.hideModal('schedulePaletteModal'); return; }
    App.pushUndoSnapshot();
    picked.forEach((r) => {
      const desc = r.description.length > 40 ? r.description.slice(0, 40).replace(/\s+\S*$/, '') + '…' : r.description;
      state.counters.push({ id: App.uid(), name: r.tag + ' — ' + desc, icon: iconForTag(r.tag), color: App.COLORS[(state.counters || []).length % App.COLORS.length], tag: r.tag });
    });
    App.markProjectDirty();
    App.logUserEvent && App.logUserEvent('tag_suggestion_accepted', state.currentProjectId || null, { route: 'schedule', count: picked.length });
    pendingProposal = null;
    App.hideModal('schedulePaletteModal');
    App.showToast('Created ' + picked.length + ' counter' + (picked.length === 1 ? '' : 's') + ' from the schedule');
    state.tool = App.TOOL.COUNTER;
    state.activeCounterType = state.counters[state.counters.length - 1].id;
    App.updateUI();
  }
  document.getElementById('schedulePaletteCreate')?.addEventListener('click', createProposedCounters);
  document.getElementById('schedulePaletteCancel')?.addEventListener('click', () => { pendingProposal = null; App.hideModal('schedulePaletteModal'); });
  document.getElementById('schedulePaletteClose')?.addEventListener('click', () => { pendingProposal = null; App.hideModal('schedulePaletteModal'); });
  // The Create-tab link arms the schedule tool and closes the modal.
  document.getElementById('counterReadSchedule')?.addEventListener('click', () => {
    const state = App.state;
    App.hideModal('counterModal');
    state.scheduleBoxStart = null;
    state.tool = App.TOOL.SCHEDULE;
    document.body.classList.remove('sidebar-open');
    App.showToast('Drag a box over the fixture schedule on the sheet');
    App.updateUI();
  });

  // --- the details-modal tag field + the Create-tab link visibility ----------------
  function renderTagField(kind, item) {
    const group = document.getElementById('counterLineTypeDetailsTagGroup');
    const el = document.getElementById('counterLineTypeDetailsTag');
    if (!group || !el) return;
    const show = kind === 'counter' && (active() || item.tag);
    group.style.display = show ? '' : 'none';
    if (!show) return;
    el.value = item.tag || '';
    el.placeholder = TM() && TM().tagOfCounter({ name: item.name }) ? 'reads as ' + TM().tagOfCounter({ name: item.name }) + ' from the name' : 'e.g. B or EM';
    el.onblur = () => {
      const next = el.value.trim().toUpperCase().slice(0, 5) || null;
      if ((next || null) === (item.tag || null)) { el.value = next || ''; return; }
      App.pushUndoSnapshotCurrentPage();
      if (next) item.tag = next; else delete item.tag;
      el.value = next || '';
      App.markProjectDirty();
      App.updateUI();
    };
    el.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } };
  }
  function renderTagReaderUI() {
    const link = document.getElementById('counterReadSchedule');
    if (link) link.style.display = active() && App.state.pages && App.state.pages.length ? '' : 'none';
  }

  App.pageTextItems = pageTextItems;
  App.drawTagOverlay = drawTagOverlay;
  App.tagHintText = tagHintText;
  App.tagSwapCounterId = tagSwapCounterId;
  App.tagCreateFromHint = tagCreateFromHint;
  App.proposeCountersFromBox = proposeCountersFromBox;
  App.renderTagField = renderTagField;
  App.renderTagReaderUI = renderTagReaderUI;
})();
