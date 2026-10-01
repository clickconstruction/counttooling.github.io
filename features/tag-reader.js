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
 *   1. Auto-pick (tag-aware placement, on a switch since 2026-10-01). With the
 *      Counter tool armed and AUTO-PICK on (the header pill, the A key, Counter
 *      Settings; per device, off by default), the click lands on the counter
 *      whose tag the plan prints beside it (tag-model.js tagPickAt — an explicit
 *      `counter.tag`, else a name like "Type B" / "FS-1"), unless the armed
 *      counter's own name says that tag; when no counter has it, Enter creates
 *      one. Off, the plan's text never moves a click. See the section below.
 *   2. Palette from the schedule. TOOL.SCHEDULE (the "Read a schedule from the
 *      sheet…" link on the Counter modal's Create tab) is a rect tool: drag a
 *      box over the fixture schedule and the rows inside it are proposed as
 *      counters — tag + description, one confirm (#schedulePaletteModal).
 *
 * Honest about scans: no text layer, no suggestion — the click behaves
 * exactly as before. Nothing is persisted but the counters the user creates
 * (and their `tag`); the text cache is per session, keyed by the page's proxy
 * + rotation (a rotate re-reads, since the items are stored in rotated space).
 *
 * The text-layer primitive is SHARED (DUCT unit D10 reads duct callouts
 * through it): pageTextItems(pageIdx) is the lazy per-page cache — the FIRST
 * call fetches getTextContent, later calls are a plain array read, pages the
 * user never works on are never fetched — and queryPdfTextNear(pageIdx, pt,
 * radiusPt) is the geometric lookup over it (items within radius of a point,
 * nearest first, distance to the text BOX). Consumers that need to know when
 * a lazy load lands register App.onPageTextLoaded(pageIdx) (duct-callouts.js).
 *
 * Registrations: drawTagOverlay(ctx, env) (renderAnnotations, after the duct
 * overlay), tagOverlayStale() (app.js's mousemove), tagHintText() (status bar),
 * tagSwapCounterId(pdfPoint) (the Counter tool's placement), tagCreateFromHint()
 * (Enter), setAutoPick / toggleAutoPick / syncAutoPickUI (the switch: the pill,
 * the A key, Counter Settings, updateUI), proposeCountersFromBox
 * (TOOL.SCHEDULE corner 2), renderTagField(kind, item) (details modal),
 * renderTagReaderUI() (updateUI: the Create-tab link), pageTextItems(pageIdx),
 * queryPdfTextNear(pageIdx, pdfPt, radiusPt), textItemsFromContent(tc, vp) (the
 * conversion alone: features/pdf-intake.js reads title blocks through it).
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const TM = () => window.TagModel;
  // A tag sits beside its symbol, and the widest common symbol decides the reach: a 2x4
  // troffer at 1/8" is 36 pt wide, its letter about 20 pt from the center the reader clicks.
  // At 18 the ten B troffers on E-201 read no tag and landed on the armed A (by hand,
  // 2026-09-24); the nearest tag still wins, so a neighbor's letter (a fixture pitch away,
  // 45 pt and more) never outranks the symbol's own.
  const HINT_RADIUS_PT = 24;

  // --- the text layer, in app PDF-space --------------------------------------
  const textCache = new Map();   // pageIdx -> { pdfPage, rotation, items: [] | null (loading), promise }

  // Where the tag tools are offered (the details modal's Tag field, the Create tab's schedule
  // link): electrical projects, and any project with a counter carrying an explicit tag.
  function tagsOffered() {
    const state = App.state;
    if (!state) return false;
    if (state.trade === 'electrical') return true;
    return (state.counters || []).some((c) => c.tag);
  }

  // Items for a page: [{ str, x, y, w, h }] with x,y the box's top-left in
  // app PDF-space (viewport at scale 1 and the page's rotation — the same
  // space canvasToPdf produces). Returns [] while loading and kicks the load.
  // D24: App.onPageTextLoaded is a single slot owned by duct-callouts; other
  // features subscribe through App.pageTextLoadedListeners instead. The list
  // lives on App (not in this closure) so a feature file that loads BEFORE
  // this one can push to it at its own load time — the registry idiom.
  // D24: the cached items WITHOUT triggering a fetch — for painters, which run
  // on every frame for every page and must never be the reason a page's text
  // layer is fetched (D10's laziness: the first fetch happens only when a
  // feature the estimator is using needs it). [] until something else fetched.
  // pdf.js text content → [{ str, x, y, w, h }] in the viewport's space (the box of each
  // item's four corners, so rotated text and rotated pages both come out axis-aligned).
  // Shared with the intake's sheet-title read, which has a pdfPage but no state.pages row yet.
  function textItemsFromContent(tc, vp) {
    const items = [];
    ((tc && tc.items) || []).forEach((it) => {
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
    return items;
  }
  function peekPageTextItems(pageIdx) {
    const state = App.state;
    const page = state && state.pages && state.pages[pageIdx];
    if (!page || !page.pdfPage) return [];
    const cached = textCache.get(pageIdx);
    return (cached && cached.pdfPage === page.pdfPage && cached.rotation === (page.rotation ?? 0)) ? (cached.items || []) : [];
  }
  function pageTextItems(pageIdx) {
    const state = App.state;
    const page = state && state.pages && state.pages[pageIdx];
    if (!page || !page.pdfPage) return [];
    const rot = page.rotation ?? 0;
    const cached = textCache.get(pageIdx);
    if (cached && cached.pdfPage === page.pdfPage && cached.rotation === rot) return cached.items || [];
    const entry = { pdfPage: page.pdfPage, rotation: rot, items: null, promise: null };
    textCache.set(pageIdx, entry);
    entry.promise = page.pdfPage.getTextContent().then((tc) => {
      const items = textItemsFromContent(tc, page.pdfPage.getViewport({ scale: 1, rotation: rot }));
      entry.items = items;
      // A stale entry (page replaced / rotated meanwhile) must not repaint or
      // notify — the live entry's own load will.
      if (textCache.get(pageIdx) !== entry) return items;
      if (App.renderAnnotations && (state.tool === App.TOOL.COUNTER || state.tool === App.TOOL.DUCT)) App.renderAnnotations();
      App.onPageTextLoaded && App.onPageTextLoaded(pageIdx);
      (App.pageTextLoadedListeners || []).forEach((fn) => { try { fn(pageIdx); } catch (_) { /* one listener must not break another */ } });
      return items;
    }).catch(() => { entry.items = []; return []; });
    return [];
  }

  // The shared geometric primitive: text items within `radiusPt` of a PDF-
  // space point, nearest first, each carrying `dist` (to the item's box — 0
  // inside it). Pure lookup over the cached items: no pdf.js call after the
  // page's first fetch, [] while that fetch is in flight or on a scan.
  function queryPdfTextNear(pageIdx, pdfPt, radiusPt) {
    if (!pdfPt || !Number.isFinite(pdfPt.x) || !Number.isFinite(pdfPt.y)) return [];
    const r = radiusPt > 0 ? radiusPt : HINT_RADIUS_PT;
    const out = [];
    pageTextItems(pageIdx).forEach((it) => {
      const dx = Math.max(it.x - pdfPt.x, 0, pdfPt.x - (it.x + it.w));
      const dy = Math.max(it.y - pdfPt.y, 0, pdfPt.y - (it.y + it.h));
      const d = Math.hypot(dx, dy);
      if (d <= r) out.push({ str: it.str, x: it.x, y: it.y, w: it.w, h: it.h, dist: d });
    });
    return out.sort((a, b) => a.dist - b.dist);
  }

  // --- tag-aware placement: AUTO-PICK, on a switch ------------------------------------
  // wendi, 2026-10-01: "it is choosing what counter I can use instead of letting me assign a
  // counter, the suggestions get in the way of me seeing things on the plans". The reader
  // moved a click to whatever counter carried the tag beside it, silently, on every
  // electrical project and every project with one tagged counter, and painted its
  // "Plan says" label at 11 px times the zoom over the sheet. Now:
  //   - the move is a SWITCH, counterSettings.autoPick (per device, off by default): the
  //     header's Auto-pick pill while the Counter tool is armed, the A key, Counter Settings;
  //   - off, the plan's text never changes a click; one status-bar line offers the switch
  //     when ANOTHER counter's tag is under the cursor;
  //   - on, a counter whose name says the tag keeps the click (3IN FD keeps FD,
  //     tag-model.js tagPickAt), and the sheet shows a cue ONLY when the click will land
  //     elsewhere: a ring in that counter's colour and its icon as a badge, a fixed size on
  //     screen at any zoom; a tag no counter carries gets a dashed ring and Enter makes it;
  //   - a click that moved flashes the receiving counter's sidebar row (a tablet has no hover).
  function autoPickOn() { const cs = App.state && App.state.counterSettings; return !!(cs && cs.autoPick); }
  // The cursor's tag is read when auto-pick is on, or when some counter carries a tag
  // (explicit or read from its name): the only case where the off line has an offer.
  function reading() {
    const state = App.state;
    if (!state) return false;
    if (autoPickOn()) return true;
    const tm = TM();
    return !!tm && (state.counters || []).some((c) => tm.tagOfCounter(c));
  }
  const counterById = (id) => (App.state.counters || []).find((c) => c.id === id) || null;
  const onTouch = () => !!(App.isCoarsePointer && App.isCoarsePointer());

  // { tag, x, y, w, h, kind: 'armed' | 'other' | 'none', counterId } for a point, or null.
  function pickAt(pt) {
    const state = App.state;
    const tm = TM();
    if (!tm || !pt || !state || state.tool !== App.TOOL.COUNTER || !reading()) return null;
    const items = pageTextItems(state.currentPage);
    if (!items.length) return null;
    return tm.tagPickAt(items, pt, state.counters, state.activeCounterType, HINT_RADIUS_PT);
  }

  // The counter id a click at `pt` should land on: with auto-pick on, the tag's counter when
  // it is another one; null = the armed counter, as always.
  function tagSwapCounterId(pt) {
    if (!autoPickOn()) return null;
    const h = pickAt(pt);
    if (!h || h.kind !== 'other') return null;
    App.logUserEvent && App.logUserEvent('tag_suggestion_accepted', App.state.currentProjectId || null, { tag: h.tag, route: 'auto-pick' });
    flashCounterRow(h.counterId);
    return h.counterId;
  }
  // The receiving counter's sidebar row flashes once: the cue a tap gets, with no hover.
  function flashCounterRow(id) {
    requestAnimationFrame(() => {
      const row = Array.from(document.querySelectorAll('#countersList [data-counter-id]')).find((r) => r.dataset.counterId === id);
      if (!row) return;
      row.classList.remove('tag-pick-flash');
      void row.offsetWidth;   // restart the animation on a second click in a row
      row.classList.add('tag-pick-flash');
      setTimeout(() => row.classList.remove('tag-pick-flash'), 1200);
    });
  }

  // The status bar's readout (status-hint-model.js, the Counter tool's line).
  function tagHintText() {
    const state = App.state;
    if (!state || state.tool !== App.TOOL.COUNTER || !state.mousePos) return '';
    const h = pickAt(state.mousePos);
    if (!h) return '';
    const c = h.counterId ? counterById(h.counterId) : null;
    if (!autoPickOn()) return h.kind === 'other' ? 'Plan says ' + h.tag + (onTouch() ? ' · Auto-pick is off' : ' · A turns on auto-pick') : '';
    if (h.kind === 'armed') return 'Plan says ' + h.tag + ' · stays on ' + (c ? c.name : '');
    if (h.kind === 'other') return 'Plan says ' + h.tag + ' · auto-pick → ' + (c ? c.name : '');
    return 'Plan says ' + h.tag + ' · Enter makes it a counter';
  }
  function iconForTag(tag) {
    const letter = String(tag || '').charAt(0);
    const icons = App.getOrderedIcons ? App.getOrderedIcons() : [];
    const byName = icons.find((ic) => String(ic.name || '').toUpperCase() === tag) || icons.find((ic) => String(ic.name || '').toUpperCase() === letter);
    if (byName) return byName.value;
    const troffer = (App.getEffectiveCustomIcons ? App.getEffectiveCustomIcons() : []).find((ic) => ic.name === '2x4 Troffer');
    return troffer ? troffer.value : (icons[0] ? icons[0].value : '');
  }
  // Enter, with auto-pick on, over a tag no counter carries: make the counter (tagged) and arm
  // it. An electrical letter reads "Type B"; any other trade's tag is its own name ("WH").
  // Returns true when it acted.
  function tagCreateFromHint() {
    const state = App.state;
    if (!state || state.tool !== App.TOOL.COUNTER || !autoPickOn() || !state.mousePos) return false;
    const h = pickAt(state.mousePos);
    if (!h || h.kind !== 'none') return false;
    App.pushUndoSnapshot();
    const counter = { id: App.uid(), name: state.trade === 'electrical' ? 'Type ' + h.tag : h.tag, icon: iconForTag(h.tag), color: App.COLORS[(state.counters || []).length % App.COLORS.length], tag: h.tag };
    state.counters.push(counter);
    state.activeCounterType = counter.id;
    App.markProjectDirty();
    App.logUserEvent && App.logUserEvent('tag_suggestion_accepted', state.currentProjectId || null, { tag: h.tag, route: 'enter-create' });
    App.showToast('Created ' + counter.name + '. Click to place it');
    App.updateUI();
    return true;
  }

  // The switch's one writer: the pill, the A key and Counter Settings all come here.
  // Per device (MAP-SETTINGS: App.saveDisplaySettings writes localStorage counterSettings).
  function setAutoPick(on, opts) {
    const state = App.state;
    if (!state || !state.counterSettings) return;
    state.counterSettings.autoPick = !!on;
    App.saveDisplaySettings && App.saveDisplaySettings();
    syncAutoPickUI();
    if (!opts || opts.toast !== false) {
      const key = onTouch() ? '' : ' · A turns it ' + (on ? 'off' : 'on');
      App.showToast(on ? 'Auto-pick on · a tag on the plan picks the counter' + key : 'Auto-pick off · the click places the counter you armed' + key, 2600);
    }
    App.updateUI && App.updateUI();
    App.renderAnnotations && App.renderAnnotations();
  }
  function toggleAutoPick() { setAutoPick(!autoPickOn()); }
  // The pill shows while the Counter tool is armed (Snap's pattern beside Quick Line), never
  // to a viewer; the Counter Settings toggle mirrors it. Called from app.js's updateUI.
  function syncAutoPickUI() {
    const state = App.state;
    if (!state) return;
    const on = autoPickOn();
    const pill = document.getElementById('counterAutoPickBtn');
    if (pill) {
      pill.classList.toggle('active', on);
      pill.setAttribute('aria-pressed', on ? 'true' : 'false');
      pill.style.display = (!state.isViewer && state.tool === App.TOOL.COUNTER) ? '' : 'none';
    }
    const cb = document.getElementById('counterAutoPick');
    if (cb) cb.checked = on;
    const btn = document.getElementById('counterAutoPickBtnSetting');
    if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  document.getElementById('counterAutoPickBtn')?.addEventListener('click', (e) => { e.stopPropagation(); toggleAutoPick(); });

  // The sheet's cue, on the live overlay: drawn only with auto-pick on and only when the click
  // will NOT land on the armed counter. Fixed screen size (env.dpr, never the zoom).
  let drawnKey = '';
  function overlayPick() {
    const state = App.state;
    if (!state || !autoPickOn() || state.tool !== App.TOOL.COUNTER || !state.mousePos) return null;
    const h = pickAt(state.mousePos);
    return h && h.kind !== 'armed' ? h : null;
  }
  const keyOf = (h) => (h ? h.kind + '|' + h.tag + '|' + h.counterId + '|' + h.x + ',' + h.y : '');
  // app.js's mousemove asks before repainting: true when the cue appears, moves or goes.
  function tagOverlayStale() { return keyOf(overlayPick()) !== drawnKey; }
  function drawTagOverlay(ctx, env) {
    const h = overlayPick();
    drawnKey = keyOf(h);
    if (!h) return;
    const dpr = (env && env.dpr) || 1;
    const c = h.counterId ? counterById(h.counterId) : null;
    const color = c ? (c.color || '#e8c547') : '#ffffff';
    const a = App.toCanvas({ x: h.x, y: h.y }), b = App.toCanvas({ x: h.x + h.w, y: h.y + h.h });
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const r = Math.hypot(b.x - a.x, b.y - a.y) / 2 + 5 * dpr;
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 4 * dpr; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.5 * dpr; ctx.strokeStyle = color;
    if (!c) ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // the badge: the counter the click will place (or a plus: Enter makes one)
    const bx = cx + r * 0.72, by = cy - r * 0.72;
    ctx.fillStyle = '#141414'; ctx.strokeStyle = color; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.arc(bx, by, 11 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (c && c.icon) {
      try {
        const vb = String(App.iconVbFor ? App.iconVbFor(c.icon) : '0 0 640 640').split(/[\s,]+/).map(Number);
        const w = vb[2] || 640, hh = vb[3] || 640, sc = (14 * dpr) / Math.max(w, hh);
        ctx.translate(bx - (w * sc) / 2, by - (hh * sc) / 2);
        ctx.scale(sc, sc);
        ctx.translate(-(vb[0] || 0), -(vb[1] || 0));
        ctx.fillStyle = color;
        ctx.fill(new Path2D(c.icon));
      } catch (_) { /* a malformed icon path: the ring and the badge still say it */ }
    } else if (!c) {
      ctx.fillStyle = '#ffffff'; ctx.font = '700 ' + (14 * dpr) + 'px DM Sans, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', bx, by + 0.5 * dpr);
    }
    ctx.restore();
  }

  // --- palette from the schedule -------------------------------------------------
  let pendingProposal = null;
  // A schedule row's tag already in the palette (an explicit tag or one read from a name).
  const counterForTag = (tag) => (App.state.counters || []).find((c) => TM().tagOfCounter(c) === tag) || null;

  function proposeCountersFromBox(box) {
    const state = App.state;
    const tm = TM();
    if (!tm) return;
    const items = pageTextItems(state.currentPage);
    const finish = (list) => {
      const rows = tm.parseScheduleRows(tm.rowsInBox(list, box));
      if (!rows.length) { App.showToast(list.length ? 'No "tag + description" rows inside that box. Draw it over the schedule table' : 'This sheet has no text layer to read (a scan) — build the counters by hand'); return; }
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
      state.counters.push({ id: App.uid(), name: r.tag + ' · ' + desc, icon: iconForTag(r.tag), color: App.COLORS[(state.counters || []).length % App.COLORS.length], tag: r.tag });
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
  // Closing the palette drops the proposal: its × (data-modal-close) and Esc both come
  // here through features/esc-ladder.js (MAP-ESC).
  function cancelSchedulePalette() { pendingProposal = null; App.hideModal('schedulePaletteModal'); }
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
    const show = kind === 'counter' && (tagsOffered() || item.tag);
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
    // Offered on electrical projects, on any project with a tagged counter, and on plumbing and
    // HVAC projects, whose fixture and diffuser schedules carry tags too (the plumbing course reads
    // P-501 with it; the HVAC course's chapter 3 asked for it on M-501 and it was hidden, by hand 2026-09-25).
    if (link) link.style.display = (tagsOffered() || App.state.trade === 'plumbing' || App.state.trade === 'hvac') && App.state.pages && App.state.pages.length ? '' : 'none';
  }

  App.pageTextItems = pageTextItems;
  App.textItemsFromContent = textItemsFromContent;             // SHEET-TITLE: the intake reads a title block before a page row exists
  App.peekPageTextItems = peekPageTextItems;                   // D24: canvas-draw's non-fetching read
  App.queryPdfTextNear = queryPdfTextNear;
  App.drawTagOverlay = drawTagOverlay;
  App.tagOverlayStale = tagOverlayStale;               // AUTO-PICK: app.js's mousemove repaints when the cue changes
  App.tagHintText = tagHintText;
  App.tagSwapCounterId = tagSwapCounterId;
  App.tagCreateFromHint = tagCreateFromHint;
  App.setAutoPick = setAutoPick;                       // AUTO-PICK: the switch's one writer
  App.toggleAutoPick = toggleAutoPick;                 // the A key (hotkeys.js runner) and the pill
  App.syncAutoPickUI = syncAutoPickUI;                 // app.js's updateUI
  App.cancelSchedulePalette = cancelSchedulePalette;   // MAP-ESC: the palette's Esc and ×
  App.proposeCountersFromBox = proposeCountersFromBox;
  App.renderTagField = renderTagField;
  App.renderTagReaderUI = renderTagReaderUI;
})();
