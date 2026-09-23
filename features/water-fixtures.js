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
