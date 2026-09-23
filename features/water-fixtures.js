(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/water-fixtures.js — fixture units on counters (WATER-PLAN.md rung 2,
   * 2026-09-23): the CFM field's twin for the water side. A counter may carry
   * `wsfu`, its water supply fixture units, and `wsfuFixture`, the table row the
   * value came from; a placed mark may carry its own `wsfuOverride`. The
   * rulebook fills the field from the counter's NAME (water-model's
   * wsfuPrefillFor, IPC Table E103.3(2)) in the column the project's occupancy
   * picks (Project Settings ▸ Codes ▸ Occupancy, state.codes.occupancy), and a
   * chip beside the field names the rule and the value it read; type over it
   * and the counter keeps yours. Nothing is sized from it yet (rung 4); the
   * Summary's foot line adds the project's fixture units up so an estimator can
   * already read the load per project.
   *
   * Surfaces:
   *   - the Counter modal's Create tab and its Quick Count twin: a
   *     "More ▸ water supply" disclosure (the D19 air & mounting idiom; open by
   *     itself on a plumbing project, state.counterWaterMoreOpen) holding the
   *     WSFU field and its chip; the field is prefilled while it is untouched or
   *     still equal to the last prefill, and never after the estimator typed;
   *   - the details modal (features/item-details.js): a Water supply section with
   *     the field, the rulebook's reading for the name and a one-tap "use it", and
   *     the "(override 4)" note for placed marks with their own;
   *   - "WSFU for this one…" on a placed mark's context menu (#ctxMarkerWsfu,
   *     shown by app.js's showContextMenu for marks of a WSFU-carrying counter)
   *     → #markerWsfuModal, the markerCfmModal pattern: Save writes a positive
   *     value and DELETES the key when cleared, so an un-overridden mark stays
   *     byte-identical;
   *   - App.waterSummaryLine(): the Summary foot line, multiply-zone adjusted,
   *     with the cold / hot split when every WSFU counter knows its fixture and
   *     the demand curve the set reads (any flush valve → the valve curve).
   *
   * Data rides existing objects: counters and marks serialize wholesale, so the
   * keys ride save/load, export/import, the backup and the Artboard for free.
   * Set-only-when-positive, like `cfm`: a counter that is not a water fixture
   * keeps its old shape. Boundary rule: read shared deps from App.* and
   * window.WaterModel at call time, never at load.
   */
  const WM = () => window.WaterModel || null;
  const occupancy = () => (App.getProjectCodes ? App.getProjectCodes().occupancy : null) || 'public';
  const esc = (s) => (App.escapeHtml ? App.escapeHtml(s) : String(s));
  const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString();

  // --- the disclosure ------------------------------------------------------------
  function waterMoreDefaultOpen() {
    const trade = App.getQuickTrade ? App.getQuickTrade() : 'plumbing';
    return trade === 'plumbing';
  }
  function setOpen(btn, fields, open) {
    fields.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    const caret = btn.querySelector('.counter-air-more-caret');
    if (caret) caret.textContent = open ? '▾' : '▸';
  }
  function applyCounterWaterMore(toggleId, fieldsId) {
    const btn = document.getElementById(toggleId);
    const fields = document.getElementById(fieldsId);
    if (!btn || !fields) return;
    const stored = App.state.counterWaterMoreOpen;
    setOpen(btn, fields, stored == null ? waterMoreDefaultOpen() : !!stored);
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = fields.hidden;
      App.state.counterWaterMoreOpen = next;
      setOpen(btn, fields, next);
    };
  }

  // --- the field and its chip -----------------------------------------------------
  // The chip's words. `stored` is the field's current number (null when empty).
  function chipHtml(prefill, stored) {
    if (!prefill) return '';
    const rule = App.ruleChipHtml ? ' ' + App.ruleChipHtml(prefill.ruleId) : '';
    const where = esc(prefill.occupancy + ' ' + prefill.match) + (prefill.fallback ? ' <span class="wsfu-chip-note">(the table lists it under ' + esc(prefill.occupancy) + ' only)</span>' : '');
    if (stored == null || Math.abs(stored - prefill.total) < 1e-9) {
      return '<span class="wsfu-chip-arrow" aria-hidden="true">→</span> <b>' + fmt(prefill.total) + ' WSFU</b> · ' + where + rule;
    }
    return '<span class="wsfu-chip-yours">yours</span> · the rulebook reads <b>' + fmt(prefill.total) + '</b> for a ' + where + rule;
  }
  // Bind a WSFU input to a name source. `nameOf()` returns the name to read;
  // the input's data-prefill / data-fixture remember what the rulebook last
  // wrote, so a value the estimator typed is never overwritten. Returns the
  // sync function, to call when the name changes.
  function bindWsfuField(inputId, chipId, nameOf) {
    const input = document.getElementById(inputId);
    const chip = document.getElementById(chipId);
    if (!input) return () => {};
    input.value = '';
    input.dataset.prefill = '';
    input.dataset.fixture = '';
    const sync = (fromName) => {
      const wm = WM();
      const p = wm ? wm.wsfuPrefillFor(nameOf(), occupancy()) : null;
      if (fromName) {
        const cur = input.value.trim();
        const untouched = cur === '' || cur === input.dataset.prefill;
        if (untouched) {
          input.value = p ? String(p.total) : '';
          input.dataset.prefill = p ? String(p.total) : '';
          input.dataset.fixture = p ? p.key : '';
        }
      }
      const v = parseFloat(input.value);
      const stored = Number.isFinite(v) && v > 0 ? v : null;
      if (chip) {
        chip.innerHTML = chipHtml(p, stored);
        chip.hidden = !p;
      }
    };
    input.oninput = () => sync(false);
    sync(true);
    return sync;
  }
  // Read a bound field onto a new counter: set-only-when-positive, and the
  // fixture key only while the value is the rulebook's own.
  function readWsfuField(inputId, counter) {
    const input = document.getElementById(inputId);
    if (!input || !counter) return;
    const v = parseFloat(input.value);
    if (!(Number.isFinite(v) && v > 0)) return;
    counter.wsfu = v;
    const wm = WM();
    const f = input.dataset.fixture || (wm ? (wm.wsfuFixtureFromName(counter.name, occupancy()) || {}).key : '');
    if (f) counter.wsfuFixture = f;
  }

  // The details modal: the stored value, the rulebook's reading for the name
  // with a one-tap "use it" when they differ, the overrides note.
  function bindWsfuDetails(item, kind) {
    const section = document.getElementById('counterLineTypeDetailsWaterSection');
    const input = document.getElementById('counterLineTypeDetailsWsfu');
    const chip = document.getElementById('counterLineTypeDetailsWsfuChip');
    const overridesEl = document.getElementById('counterLineTypeDetailsWsfuOverrides');
    if (!section || !input) return;
    const wm = WM();
    const isCounter = !!(item && wm && kind === 'counter');
    section.style.display = isCounter ? '' : 'none';
    if (!isCounter) return;
    const render = () => {
      const stored = wm.counterWsfu(item);
      input.value = stored != null ? stored : '';
      const p = wm.wsfuPrefillFor(item.name, occupancy());
      if (chip) {
        let html = chipHtml(p, stored);
        if (p && (stored == null || Math.abs(stored - p.total) > 1e-9)) html += ' <button type="button" class="wsfu-chip-use" id="counterLineTypeDetailsWsfuUse">use it</button>';
        chip.innerHTML = html;
        chip.hidden = !p;
        const use = document.getElementById('counterLineTypeDetailsWsfuUse');
        if (use) use.onclick = () => commit(p.total, p.key);
      }
      if (overridesEl) {
        const o = getCounterWsfuOverrideText(item);
        overridesEl.textContent = o ? 'Placed marks with their own WSFU: ' + o : '';
        overridesEl.style.display = o ? '' : 'none';
      }
    };
    const commit = (next, fixtureKey) => {
      const cur = wm.counterWsfu(item);
      // Unchanged: leave the chip alone. A re-render here would rebuild the
      // "use it" button under the very click that blurred the field.
      if ((next == null && cur == null) || next === cur) return;
      App.pushUndoSnapshotCurrentPage();
      if (next == null) { delete item.wsfu; delete item.wsfuFixture; }
      else {
        item.wsfu = next;
        const p = wm.wsfuPrefillFor(item.name, occupancy());
        const key = fixtureKey || (p ? p.key : null);
        if (key) item.wsfuFixture = key; else delete item.wsfuFixture;
      }
      App.markProjectDirty();
      App.updateUI();
      render();
    };
    input.onblur = () => {
      const v = parseFloat(input.value);
      commit(Number.isFinite(v) && v > 0 ? v : null, null);
    };
    render();
  }

  // "(override 4)" — placed marks of this counter whose own WSFU differs from
  // the type's; distinct values, ascending. The details modal reads it.
  function getCounterWsfuOverrideText(counter) {
    const wm = WM();
    if (!counter || !wm) return null;
    const vals = new Set();
    (App.state.pages || []).forEach((p, pi) => {
      const ann = App.getActiveAnnotations(p, pi);
      (ann?.counterMarkers?.[counter.id] || []).forEach((m) => {
        const o = m && Number(m.wsfuOverride);
        if (Number.isFinite(o) && o > 0 && o !== wm.counterWsfu(counter)) vals.add(o);
      });
    });
    if (!vals.size) return null;
    return [...vals].sort((a, b) => a - b).map((v) => '(override ' + fmt(v) + ')').join(' ');
  }

  // --- the per-mark override -----------------------------------------------------
  let editing = null;   // { marker, counter } while #markerWsfuModal is up
  function openMarkerWsfuModal(marker, counter) {
    if (!marker || !counter) return;
    const wm = WM();
    editing = { marker, counter };
    const base = wm ? wm.counterWsfu(counter) : null;
    const hint = document.getElementById('markerWsfuHint');
    if (hint) hint.textContent = base != null ? 'Leave empty to use the counter’s fixture units (' + fmt(base) + ')' : 'Leave empty for none on this one';
    const input = document.getElementById('markerWsfuInput');
    input.value = marker.wsfuOverride > 0 ? marker.wsfuOverride : '';
    input.placeholder = base != null ? String(base) : 'e.g. 2';
    App.showModal('markerWsfuModal');
    input.focus();
    input.select();
  }
  function commitMarkerWsfu() {
    if (!editing) return;
    const { marker } = editing;
    const v = parseFloat(document.getElementById('markerWsfuInput').value);
    const next = Number.isFinite(v) && v > 0 ? v : null;
    const cur = marker.wsfuOverride > 0 ? marker.wsfuOverride : null;
    editing = null;
    App.hideModal('markerWsfuModal');
    if (next === cur) return;
    App.pushUndoSnapshotCurrentPage();
    if (next == null) delete marker.wsfuOverride;
    else marker.wsfuOverride = next;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }
  function cancelMarkerWsfu() {
    editing = null;
    App.hideModal('markerWsfuModal');
  }
  const ctxBtn = document.getElementById('ctxMarkerWsfu');
  if (ctxBtn) ctxBtn.onclick = () => {
    const state = App.state;
    const t = state.ctxTarget;
    document.getElementById('contextMenu').classList.remove('visible');
    state.ctxTarget = null;
    if (!t || t.type !== 'marker') return;
    const page = state.pages[state.currentPage];
    const ann = page ? App.getActiveAnnotations(page) : null;
    const marker = ann?.counterMarkers?.[t.typeId]?.[t.index];
    const counter = (state.counters || []).find((c) => c.id === t.typeId);
    if (marker && counter) openMarkerWsfuModal(marker, counter);
  };
  document.getElementById('markerWsfuSave')?.addEventListener('click', commitMarkerWsfu);
  document.getElementById('markerWsfuCancel')?.addEventListener('click', cancelMarkerWsfu);
  document.getElementById('markerWsfuInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitMarkerWsfu(); }
  });

  // --- the Summary foot line ------------------------------------------------------
  // Fixture units across the project, multiply-zone adjusted, per-mark overrides
  // honoured; the cold / hot split only when every WSFU counter knows its
  // fixture. Null when no counter carries fixture units.
  function waterSummaryTotals() {
    const wm = WM();
    if (!wm) return null;
    const occ = occupancy();
    let total = 0, cold = 0, hot = 0, splitKnown = true, any = false;
    const items = [];
    (App.state.counters || []).forEach((c) => {
      const base = wm.counterWsfu(c);
      const split = wm.counterWsfuSplit(c, occ);
      let qty = 0;
      (App.state.pages || []).forEach((p, pi) => {
        const ann = App.getActiveAnnotations(p, pi);
        (ann?.counterMarkers?.[c.id] || []).forEach((m) => {
          const w = wm.markerWsfu(m, c);
          if (w == null) return;
          const n = App.getMultiplyZoneForPoint ? App.getMultiplyZoneForPoint(ann, m) : 1;
          any = true;
          total += w * n;
          qty += n;
          if (split && base != null) { cold += split.cold * (w / base) * n; hot += split.hot * (w / base) * n; }
          else splitKnown = false;
        });
      });
      if (qty > 0 && c.wsfuFixture) items.push({ key: c.wsfuFixture, qty });
    });
    if (!any) return null;
    const column = wm.demandColumnFor(items);
    return { total: Math.round(total * 100) / 100, cold: splitKnown ? Math.round(cold * 100) / 100 : null, hot: splitKnown ? Math.round(hot * 100) / 100 : null, column, occupancy: occ };
  }
  function waterSummaryLine() {
    const t = waterSummaryTotals();
    if (!t) return null;
    return 'Water supply · ' + fmt(t.total) + ' WSFU' + (t.cold != null ? ' (cold ' + fmt(t.cold) + ' · hot ' + fmt(t.hot) + ')' : '') + ' · ' + t.occupancy + ' · ' + (t.column === 'flushValve' ? 'flush-valve curve' : 'flush-tank curve');
  }

  // --- Rung 3: water runs, attachment, leaders, the rescue, the served readout -----
  // The placed marks that carry fixture units on a page's ACTIVE canvas, split
  // into the two sides through the counter's fixture (counterWsfuSplit); a
  // counter with a total but no fixture key puts its whole total on either
  // side it meets (`unsplit`), which the readout says. `links` is the rescue's
  // stored answer on the mark (marker.waterRuns).
  function collectWaterFixtures(pageIdx) {
    const page = App.state.pages[pageIdx];
    if (!page) return [];
    return collectWaterFixturesFrom(App.getActiveAnnotations(page, pageIdx));
  }
  // The same, from one canvas's annotations (the draw core paints a canvas at a
  // time, the active one or a peeked one).
  function collectWaterFixturesFrom(ann) {
    const wm = WM();
    const state = App.state;
    if (!wm || !ann) return [];
    const occ = occupancy();
    const out = [];
    (state.counters || []).forEach((c) => {
      const base = wm.counterWsfu(c);
      const split = wm.counterWsfuSplit(c, occ);
      (ann?.counterMarkers?.[c.id] || []).forEach((m, i) => {
        const total = wm.markerWsfu(m, c);
        if (total == null) return;
        const k = base != null ? total / base : 1;
        const f = split
          ? { cold: Math.round(split.cold * k * 100) / 100, hot: Math.round(split.hot * k * 100) / 100, unsplit: false }
          : { cold: total, hot: total, unsplit: true };
        out.push({ x: m.x, y: m.y, cold: f.cold, hot: f.hot, total, unsplit: f.unsplit, counterId: c.id, counterName: c.name, index: i, links: m.waterRuns || null, marker: m });
      });
    });
    return out;
  }
  function getWaterRuns(pageIdx) {
    const wm = WM();
    const page = App.state.pages[pageIdx];
    if (!wm || !page) return [];
    return wm.waterRunsOf(App.getActiveAnnotations(page, pageIdx), App.state.lineTypes || []);
  }
  // The leaders the draw core paints for a canvas's annotations (canvas-draw.js
  // reads it through its deps): [{ from, to, side, color }] in PDF space.
  function waterLeaders(ann, pageIdx) {
    const wm = WM();
    if (!wm || !ann) return [];
    const runs = wm.waterRunsOf(ann, App.state.lineTypes || []);
    if (!runs.length) return [];
    void pageIdx;
    const fixtures = collectWaterFixturesFrom(ann);
    if (!fixtures.length) return [];
    return wm.waterFixtureLeaders(fixtures, runs).map((l) => {
      const run = runs.find((r) => r.id === l.runId);
      return { from: l.from, to: l.to, side: l.side, color: run ? run.color : wm.WATER_SIDE_COLORS[l.side], explicit: l.explicit };
    });
  }
  // What each water run on a page serves: Map runId → the served row.
  function getWaterServed(pageIdx) {
    const wm = WM();
    if (!wm) return new Map();
    const runs = getWaterRuns(pageIdx);
    if (!runs.length) return new Map();
    return wm.waterServedByRun(collectWaterFixtures(pageIdx), runs);
  }
  // The Lines list's readouts for a page, one pass over the page: Map runId →
  // { side, served, count, text }, the text "6 WSFU cold · 3 fixtures (1 on
  // branches)"; a run whose fixtures include a total with no fixture key says
  // so, so the number is not over-read. Runs that are not water are absent.
  function waterRunReadouts(pageIdx) {
    const wm = WM();
    const out = new Map();
    if (!wm) return out;
    const runs = getWaterRuns(pageIdx);
    if (!runs.length) return out;
    const fixtures = collectWaterFixtures(pageIdx);
    const served = wm.waterServedByRun(fixtures, runs);
    const { attached } = wm.attachWaterFixtures(fixtures, runs);
    const unsplitRuns = new Set(attached.filter((a) => a.fixture.unsplit).map((a) => a.runId));
    served.forEach((row, id) => {
      const fx = row.servedCount === 1 ? '1 fixture' : row.servedCount + ' fixtures';
      const branch = row.servedCount > row.ownCount ? ' (' + (row.servedCount - row.ownCount) + ' on branches)' : '';
      out.set(id, { side: row.side, served: row.served, count: row.servedCount, text: fmt(row.served) + ' WSFU ' + row.side + ' · ' + fx + branch + (unsplitRuns.has(id) ? ' · a total with no fixture counted whole' : '') });
    });
    return out;
  }
  function waterRunReadout(item, pageIdx) {
    return item ? waterRunReadouts(pageIdx).get(item.id) || null : null;
  }

  // The rescue: the context-menu mark, for each side it carries that no run of
  // that side serves, with a run of that side within reach. Returns
  // { marker, counter, sides: [{ side, runId, dist, runName }] } or null.
  function waterStrayTarget() {
    const wm = WM();
    const state = App.state;
    const t = state.ctxTarget;
    if (!wm || state.isViewer || !t || t.type !== 'marker') return null;
    const counter = (state.counters || []).find((c) => c.id === t.typeId);
    if (!counter) return null;
    const fixtures = collectWaterFixtures(state.currentPage);
    const f = fixtures.find((x) => x.counterId === t.typeId && x.index === t.index);
    if (!f) return null;
    const runs = getWaterRuns(state.currentPage);
    if (!runs.length) return null;
    const { strays } = wm.attachWaterFixtures([f], runs);
    const sides = [];
    strays.forEach((st) => {
      const near = wm.waterNearestRunPoint(f, runs, st.side);
      if (!near) return;
      const lt = (state.lineTypes || []).find((l) => l.id === near.run.lineTypeId);
      sides.push({ side: st.side, runId: near.runId, dist: near.dist, runName: (lt && lt.name) || (near.run.isPoly ? 'polyline' : 'line') });
    });
    if (!sides.length) return null;
    return { marker: f.marker, counter, sides };
  }
  function waterStrayLabel(target) {
    if (!target) return '';
    const sides = target.sides.map((s) => s.side);
    return 'Attach to nearest ' + (sides.length === 2 ? 'cold and hot runs' : sides[0] + ' run');
  }
  const ctxAttachWaterBtn = document.getElementById('ctxAttachWater');
  if (ctxAttachWaterBtn) ctxAttachWaterBtn.onclick = () => {
    const state = App.state;
    const target = waterStrayTarget();
    document.getElementById('contextMenu').classList.remove('visible');
    state.ctxTarget = null;
    if (!target) return;
    App.pushUndoSnapshot();
    const links = { ...(target.marker.waterRuns || {}) };
    target.sides.forEach((s) => { links[s.side] = s.runId; });
    target.marker.waterRuns = links;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
    const sc = state.pages[state.currentPage]?.scale;
    const ftOf = (pt) => (sc && sc.pixelsPerUnit > 0 && sc.unit === 'ft' ? (Math.round(pt / sc.pixelsPerUnit * 10) / 10) + ' ft' : Math.round(pt) + ' pt');
    if (App.showToast) App.showToast(target.sides.map((s) => (s.side === 'cold' ? 'Cold' : 'Hot') + ' on ' + s.runName + ', ' + ftOf(s.dist) + ' away').join(' · '), 3200);
  };

  // --- the water side picker (Quick Line tab and the details modal) ---------------
  function sideSegmentHtml(idPrefix) {
    return '<div class="filter-scope-segment water-side-segment" id="' + idPrefix + 'Segment" role="group" aria-label="Water side">'
      + '<button type="button" data-side="none" aria-pressed="false">None</button>'
      + '<button type="button" data-side="cold" aria-pressed="false">Cold</button>'
      + '<button type="button" data-side="hot" aria-pressed="false">Hot</button></div>';
  }
  function syncSideSegment(seg, side) {
    if (!seg) return;
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === (side || 'none'))));
  }
  // Quick Line: the segment follows the composed name until the estimator picks;
  // a pick that differs from what the name says is what gets stored.
  let quickLinePick = null;   // 'cold' | 'hot' | 'none' | null (follow the name)
  function syncQuickLineWaterSide() {
    const wm = WM();
    const host = document.getElementById('quickLineWaterSide');
    if (!wm || !host) return;
    if (!host.querySelector('.water-side-segment')) {
      host.innerHTML = sideSegmentHtml('quickLineWaterSide') + '<div class="water-side-note" id="quickLineWaterSideNote"></div>';
      host.querySelector('.water-side-segment').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-side]');
        if (!b) return;
        quickLinePick = b.dataset.side;
        syncQuickLineWaterSide();
      });
    }
    const name = document.getElementById('quickLineName')?.value || '';
    const fromName = wm.waterSideFromName(name);
    const side = quickLinePick != null ? (quickLinePick === 'none' ? null : quickLinePick) : fromName;
    syncSideSegment(host.querySelector('.water-side-segment'), side);
    const note = document.getElementById('quickLineWaterSideNote');
    if (note) note.textContent = quickLinePick == null ? (fromName ? 'from the name (' + (fromName === 'cold' ? 'CW' : 'HW') + '); fixtures within reach attach to its runs' : 'none from the name; pick one for a water run') : (side ? 'fixtures within reach attach to its runs' : 'plain pipe: nothing attaches');
  }
  function resetQuickLineWaterSide() { quickLinePick = null; syncQuickLineWaterSide(); }
  // Written onto a new line type: only a pick that differs from the name is a key.
  function readQuickLineWaterSide(lt) {
    const wm = WM();
    if (!wm || !lt || quickLinePick == null) return;
    const fromName = wm.waterSideFromName(lt.name);
    const picked = quickLinePick === 'none' ? null : quickLinePick;
    if (picked !== fromName) lt.waterSide = quickLinePick;
  }
  // The details modal: shown for line types on a plumbing project, or when the
  // type carries or derives a side (the raceway section's own gate, mirrored).
  function renderWaterSideSection(kind, item) {
    const wm = WM();
    const group = document.getElementById('waterSideGroup');
    if (!wm || !group) return;
    const state = App.state;
    const show = kind === 'lineType' && !!item && (state.trade === 'plumbing' || !!wm.lineTypeWaterSide(item) || item.waterSide != null);
    group.style.display = show ? '' : 'none';
    if (!show) return;
    if (!group.querySelector('.water-side-segment')) {
      group.querySelector('.water-side-host').innerHTML = sideSegmentHtml('lineTypeWaterSide') + '<div class="water-side-note" id="lineTypeWaterSideNote"></div>';
    }
    const seg = group.querySelector('.water-side-segment');
    const note = document.getElementById('lineTypeWaterSideNote');
    const render = () => {
      const side = wm.lineTypeWaterSide(item);
      syncSideSegment(seg, side);
      const fromName = wm.waterSideFromName(item.name);
      if (note) note.textContent = item.waterSide == null
        ? (fromName ? 'from the name; fixtures within reach attach to its runs and the Lines list shows what each serves' : 'none from the name; pick one to make it a water run')
        : (side ? 'set here' + (fromName && fromName !== side ? ', over the name’s ' + (fromName === 'cold' ? 'CW' : 'HW') : '') + '; fixtures within reach attach to its runs' : 'plain pipe, set here' + (fromName ? ' over the name' : ''));
    };
    seg.onclick = (e) => {
      const b = e.target.closest('button[data-side]');
      if (!b) return;
      const pick = b.dataset.side;
      const fromName = wm.waterSideFromName(item.name);
      const next = (pick === 'none' ? null : pick) === fromName ? undefined : pick;   // the name's own answer needs no key
      if ((next === undefined && item.waterSide == null) || next === item.waterSide) { render(); return; }
      App.pushUndoSnapshotCurrentPage();
      if (next === undefined) delete item.waterSide; else item.waterSide = next;
      App.markProjectDirty();
      App.updateUI();
      App.renderAnnotations && App.renderAnnotations();
      render();
    };
    render();
  }
  // A short tag for a line type's side, for the sidebar rows: "cold" / "hot".
  function lineTypeWaterTag(lt) {
    const wm = WM();
    const side = wm ? wm.lineTypeWaterSide(lt) : null;
    return side ? '<span class="line-water-tag line-water-tag-' + side + '" title="Water side: fixtures within reach attach to this type’s runs">' + side + '</span>' : '';
  }

  App.collectWaterFixtures = collectWaterFixtures;
  App.collectWaterFixturesFrom = collectWaterFixturesFrom;
  App.waterRunReadouts = waterRunReadouts;
  App.getWaterRuns = getWaterRuns;
  App.waterLeaders = waterLeaders;
  App.getWaterServed = getWaterServed;
  App.waterRunReadout = waterRunReadout;
  App.waterStrayTarget = waterStrayTarget;
  App.waterStrayLabel = waterStrayLabel;
  App.syncQuickLineWaterSide = syncQuickLineWaterSide;
  App.resetQuickLineWaterSide = resetQuickLineWaterSide;
  App.readQuickLineWaterSide = readQuickLineWaterSide;
  App.renderWaterSideSection = renderWaterSideSection;
  App.lineTypeWaterTag = lineTypeWaterTag;
  App.applyCounterWaterMore = applyCounterWaterMore;
  App.bindWsfuField = bindWsfuField;
  App.readWsfuField = readWsfuField;
  App.bindWsfuDetails = bindWsfuDetails;
  App.getCounterWsfuOverrideText = getCounterWsfuOverrideText;
  App.openMarkerWsfuModal = openMarkerWsfuModal;
  App.cancelMarkerWsfu = cancelMarkerWsfu;
  App.waterSummaryTotals = waterSummaryTotals;
  App.waterSummaryLine = waterSummaryLine;
})();
