/*
 * features/water-fixtures.js — fixture units on counters (WATER-PLAN.md rung 2,
 * 2026-09-23). A counter may carry `wsfu`, its water supply fixture units
 * (IPC Table E103.3(2), the project's occupancy column), the way an air device
 * carries `cfm`. This file owns the three places the number is typed and the
 * two places it is read back:
 *
 * - The Fixture units field on the Counter modal's Create tab (#counterWsfu),
 *   its Quick Count twin (#counterQuickCountWsfu) and the counter's details
 *   modal (#counterLineTypeDetailsWsfu). Each is a "form" registered here:
 *   the name the form is showing is read through a callback, and while the
 *   estimator has not typed in the field it is PREFILLED from the name for the
 *   occupancy (water-model's wsfuPrefillFor: "Lavatory" → 2 WSFU public). A
 *   chip beside the field names what was read ("→ 2 WSFU · public lavatory,
 *   faucet" plus the § chip of plumb.wsfu.fixtures); type over it and the
 *   counter keeps yours, the chip still showing the table's number. The
 *   occupancy word in the chip is a button: it flips THIS counter to the other
 *   column (`wsfuOccupancy` on the counter, absent = the project's) and
 *   re-reads the table, WATER-PLAN Q3's per-counter flip. The field shows on a
 *   plumbing-shaped project (App.getQuickTrade() === 'plumbing') or when the
 *   counter already carries a number, and always opens empty on Create / Quick
 *   Count (the CFM field's stale-value rule).
 * - The per-mark override: "WSFU for this one…" on a placed marker's context
 *   menu (#ctxMarkerWsfu, shown by app.js's showContextMenu for markers of a
 *   WSFU-carrying type) opens #markerWsfuModal — one number, Save / Cancel,
 *   Enter commits; Save writes a positive value as marker.wsfuOverride and
 *   DELETES the key when cleared, so an un-overridden marker stays byte-identical
 *   (the D15 CFM override, twinned). Markers and counters serialize wholesale,
 *   so wsfu / wsfuOccupancy / wsfuOverride ride save/load + export/import.
 * - Read-back: App.getCounterWsfuText / App.getCounterWsfuOverrideText for the
 *   sidebar row's hover title and the details modal, and App.getWsfuTotals +
 *   App.appendWsfuSummaryRow for the Summary's "Fixture units" line (every
 *   placed mark's number, multiply zones honoured, per sheet in the hover).
 *
 * Rung 3 attaches fixtures to water runs and reads these numbers per run; the
 * sides (cold / hot) come from the same table row at that point. Boundary rule:
 * shared deps from App.* at call time; the arithmetic in water-model.js.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const RULE_ID = 'plumb.wsfu.fixtures';
  const WM = () => window.WaterModel;
  const esc = (s) => (App.escapeHtml ? App.escapeHtml(s) : String(s));
  const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

  function projectOccupancy() {
    const codes = App.getProjectCodes ? App.getProjectCodes() : null;
    return codes && codes.occupancy === 'private' ? 'private' : 'public';
  }
  function plumbingShaped() {
    return (App.getQuickTrade ? App.getQuickTrade() : 'plumbing') === 'plumbing';
  }
  function otherOccupancy(o) { return o === 'private' ? 'public' : 'private'; }

  // --- the forms -------------------------------------------------------------------
  // key → { inputId, chipId, groupId, name(), item?, typed, occupancy }. `typed`
  // is set on the first keystroke and cleared by a flip (a flip asks for the
  // table's number); `occupancy` is the counter's own column, null = project.
  const forms = {};
  function registerForm(key, cfg) {
    forms[key] = { ...cfg, typed: false, occupancy: null };
    const input = document.getElementById(cfg.inputId);
    if (input && !input.dataset.wsfuBound) {
      input.dataset.wsfuBound = '1';
      input.addEventListener('input', () => { forms[key].typed = true; syncForm(key); });
    }
    return forms[key];
  }
  function chipHtml(read) {
    return '<span class="wsfu-chip-arrow" aria-hidden="true">→</span>'
      + '<b class="wsfu-chip-val">' + fmt(read.total) + ' WSFU</b>'
      + '<span class="wsfu-chip-sep" aria-hidden="true">·</span>'
      + '<button type="button" class="wsfu-occ-flip" title="Read the other column of the table for this counter">' + esc(read.occupancy) + '</button>'
      + '<span class="wsfu-chip-name">' + esc(read.label.toLowerCase()) + ', ' + esc(read.controlLabel) + '</span>'
      + (App.ruleChipHtml ? App.ruleChipHtml(RULE_ID, { cls: 'wsfu-rule-chip' }) : '');
  }
  // Show / hide the group, prefill while untyped, render the chip.
  function syncForm(key) {
    const f = forms[key];
    if (!f) return;
    const input = document.getElementById(f.inputId);
    const chip = document.getElementById(f.chipId);
    const group = document.getElementById(f.groupId);
    if (!input) return;
    const has = Number.isFinite(f.item && f.item.wsfu) && f.item.wsfu > 0;
    const show = plumbingShaped() || has;
    if (group) group.style.display = show ? '' : 'none';
    const read = show && WM() ? WM().wsfuPrefillFor(f.name(), f.occupancy || projectOccupancy()) : null;
    if (read && !f.typed) input.value = fmt(read.total);
    else if (!read && !f.typed && !f.item) input.value = '';
    if (chip) {
      chip.hidden = !read;
      chip.innerHTML = read ? chipHtml(read) : '';
      const flip = chip.querySelector('.wsfu-occ-flip');
      if (flip) flip.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        f.occupancy = otherOccupancy(read.occupancy);
        if (f.occupancy === projectOccupancy()) f.occupancy = null;
        f.typed = false;
        syncForm(key);
        if (f.onFlip) f.onFlip(f.occupancy, fieldValue(key).wsfu);
      };
    }
    if (App.syncRuleChips) App.syncRuleChips();
  }
  // A fresh Create / Quick Count panel: empty field, project column, untyped.
  function resetForm(key) {
    const f = forms[key];
    if (!f) return;
    f.typed = false; f.occupancy = null; f.item = null;
    const input = document.getElementById(f.inputId);
    if (input) input.value = '';
    syncForm(key);
  }
  // The details modal: the counter's own number and column; "typed" when the
  // stored number is not what the table would read, so it is never overwritten.
  function loadForm(key, item) {
    const f = forms[key];
    if (!f) return;
    f.item = item;
    f.occupancy = item && (item.wsfuOccupancy === 'public' || item.wsfuOccupancy === 'private') ? item.wsfuOccupancy : null;
    const input = document.getElementById(f.inputId);
    const has = item && Number.isFinite(item.wsfu) && item.wsfu > 0;
    if (input) input.value = has ? fmt(item.wsfu) : '';
    const read = WM() && item ? WM().wsfuPrefillFor(f.name(), f.occupancy || projectOccupancy()) : null;
    f.typed = !!item && (has ? !read || read.total !== item.wsfu : !!read);
    syncForm(key);
  }
  // What the form holds: { wsfu (number | null), occupancy (the counter's own, or null) }.
  function fieldValue(key) {
    const f = forms[key];
    const input = f ? document.getElementById(f.inputId) : null;
    const v = input ? parseFloat(input.value) : NaN;
    return { wsfu: Number.isFinite(v) && v > 0 ? v : null, occupancy: f ? f.occupancy : null };
  }
  // Create / Quick Count: write the field onto a new counter (set-only, the CFM rule).
  function applyFieldToCounter(key, counter) {
    const v = fieldValue(key);
    if (v.wsfu != null) counter.wsfu = v.wsfu;
    if (v.wsfu != null && v.occupancy) counter.wsfuOccupancy = v.occupancy;
  }

  // --- read-back --------------------------------------------------------------------
  function getCounterWsfuText(counter) {
    if (!counter || !(counter.wsfu > 0)) return null;
    return fmt(counter.wsfu) + ' WSFU' + (counter.wsfuOccupancy ? ' (' + counter.wsfuOccupancy + ')' : '');
  }
  // "(override 3, 4.5)" — placed marks of this counter whose own number differs.
  function getCounterWsfuOverrideText(counter) {
    if (!counter) return null;
    const values = new Set();
    (App.state.pages || []).forEach((p) => {
      App.getPageCanvases(p).forEach((cv) => {
        (cv.annotations?.counterMarkers?.[counter.id] || []).forEach((m) => {
          const o = m && m.wsfuOverride;
          if (Number.isFinite(o) && o > 0 && o !== counter.wsfu) values.add(o);
        });
      });
    });
    if (!values.size) return null;
    return '(WSFU override ' + [...values].sort((a, b) => a - b).map(fmt).join(', ') + ')';
  }
  // Every placed mark's fixture units, multiply zones honoured: the project
  // total and a per-sheet breakdown (active layer per page, the Summary's rule).
  function getWsfuTotals() {
    const out = { total: 0, byPage: [] };
    const wm = WM();
    if (!wm) return out;
    const counters = App.state.counters || [];
    (App.state.pages || []).forEach((p, pi) => {
      const ann = App.getActiveAnnotations(p, pi);
      let pageTotal = 0;
      counters.forEach((c) => {
        if (!(c.wsfu > 0)) return;
        (ann?.counterMarkers?.[c.id] || []).forEach((m) => {
          pageTotal += wm.markerWsfu(m, c) * (App.getMultiplyZoneForPoint ? App.getMultiplyZoneForPoint(ann, m) : 1);
        });
      });
      if (pageTotal > 0) out.byPage.push({ pageIdx: pi, label: p.label || ('Sheet ' + (pi + 1)), total: Math.round(pageTotal * 100) / 100 });
      out.total += pageTotal;
    });
    out.total = Math.round(out.total * 100) / 100;
    return out;
  }
  function appendWsfuSummaryRow(el) {
    const t = getWsfuTotals();
    if (!(t.total > 0)) return;
    const div = document.createElement('div');
    div.className = 'summary-derived-item summary-wsfu-row';
    div.id = 'summaryWsfuRow';
    div.innerHTML = '<span class="name">Fixture units</span><span class="derived-tag">' + esc(projectOccupancy()) + '</span><span class="derived-total">' + fmt(t.total) + ' WSFU</span>';
    div.title = t.byPage.map((r) => r.label + ': ' + fmt(r.total) + ' WSFU').join(' · ') + '. Water supply fixture units placed; the sides and the sizes come with the water runs.';
    el.appendChild(div);
  }

  // --- the per-mark override ---------------------------------------------------------
  let editing = null;
  function openMarkerWsfuModal(marker, counter) {
    if (!marker || !counter) return;
    editing = { marker, counter };
    const hint = document.getElementById('markerWsfuHint');
    if (hint) hint.textContent = counter.wsfu > 0 ? 'Leave empty to use the counter’s fixture units (' + fmt(counter.wsfu) + ')' : 'Leave empty for none on this one';
    const input = document.getElementById('markerWsfuInput');
    input.value = marker.wsfuOverride > 0 ? marker.wsfuOverride : '';
    input.placeholder = counter.wsfu > 0 ? fmt(counter.wsfu) : 'e.g. 2';
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
  function cancelMarkerWsfu() { editing = null; App.hideModal('markerWsfuModal'); }
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

  App.registerWsfuForm = registerForm;
  App.syncWsfuForm = syncForm;
  App.resetWsfuForm = resetForm;
  App.loadWsfuForm = loadForm;
  App.wsfuFieldValue = fieldValue;
  App.applyWsfuFieldToCounter = applyFieldToCounter;
  App.getCounterWsfuText = getCounterWsfuText;
  App.getCounterWsfuOverrideText = getCounterWsfuOverrideText;
  App.getWsfuTotals = getWsfuTotals;
  App.appendWsfuSummaryRow = appendWsfuSummaryRow;
  App.openMarkerWsfuModal = openMarkerWsfuModal;
  App.cancelMarkerWsfu = cancelMarkerWsfu;
  App.getProjectOccupancy = projectOccupancy;
})();
