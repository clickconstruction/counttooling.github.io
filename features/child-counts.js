/*
 * features/child-counts.js - Child counts: words-only quantities that ride a
 * parent counter or line type into every summary and export.
 *
 * A parent palette item may carry `childCounts: [{ name, qty, per, ftInterval }]`
 * where `per` is 'count' (counters: qty x each placed marker), 'run' (line
 * types: qty x each run), or 'ft' (line types: ceil(runFeet / ftInterval) x qty,
 * computed PER RUN then summed — each run carries its own supports). Children
 * are DERIVED at tally time — never marks on the sheet, no icons, no legend or
 * footer presence — so deleting a run deletes its children by construction.
 * The rule rides save/load, JSON export/import, and the Artboard for free
 * because palettes serialize wholesale.
 *
 * Multiply zones ride through: a marker's zone factor multiplies its per-count
 * children; a run's zone factor multiplies its per-run children and its per-ft
 * children (the zoned split.feet is divided back to raw feet before the ceil —
 * a x10 zone is 10 identical runs, each rounding up its own supports). Per-ft
 * children on unscaled (px) runs are EXCLUDED and flagged, never guessed —
 * the same T1-05 discipline as the length totals.
 *
 * Two registrations (the room-sizer recipe — report.js consumes via a guarded
 * window.App lookup at call time):
 *   - getChildCountTotals({ pageIndices?, getAnnotations? }) -> { byGroup }
 *     keyed like collectSummaries: gid -> { counter: {id: rows[]},
 *     lineType: {id: rows[]} }, row = { name, qty, per, ftInterval, total,
 *     excludedPxRuns }. Rows with total 0 and no exclusions are omitted.
 *   - renderChildCountsSection(kind, item) — the "Child counts" editor inside
 *     #counterLineTypeDetailsModal (features/item-details.js calls it on open).
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const SM = () => window.SupportModel;
  function ruleLabel(ch) {
    if (ch.per === 'count') return 'per count';
    if (ch.per === 'ft') return 'per ' + (SM() ? SM().childIntervalLabel(ch) : (ch.ftInterval || 10) + ' ft');
    return 'per run';
  }

  // --- tally engine ---------------------------------------------------------

  function getChildCountTotals(opts) {
    const state = App.state;
    if (!state || !state.pages || !state.pages.length) return { byGroup: {} };
    const o = opts || {};
    const pageIndices = o.pageIndices || state.pages.map((_, i) => i);
    const getAnn = o.getAnnotations || ((pi) => App.getActiveAnnotations(state.pages[pi], pi));

    const countersWithChildren = (state.counters || []).filter((c) => (c.childCounts || []).length);
    const lineTypesWithChildren = (state.lineTypes || []).filter((lt) => (lt.childCounts || []).length);
    if (!countersWithChildren.length && !lineTypesWithChildren.length) return { byGroup: {} };

    // Per (group, parent) raw units the rules consume: counter zone-units,
    // line run zone-units, per-run { rawFeet, zone } entries, px-run counts.
    const units = {};
    const forGroup = (gid) => (units[gid] = units[gid] || { counter: {}, lineType: {} });

    pageIndices.forEach((pi) => {
      const ann = getAnn(pi);
      if (!ann) return;
      countersWithChildren.forEach((c) => {
        (ann.counterMarkers?.[c.id] || []).forEach((m) => {
          const g = forGroup(m.group || null).counter;
          if (!g[c.id]) g[c.id] = { zoneUnits: 0 };
          g[c.id].zoneUnits += App.getMultiplyZoneForPoint(ann, m);
        });
      });
      lineTypesWithChildren.forEach((lt) => {
        const addRun = (item, isPoly) => {
          const g = forGroup(item.group || null).lineType;
          if (!g[lt.id]) g[lt.id] = { runUnits: 0, ftRuns: [], pxRuns: 0 };
          const r = g[lt.id];
          const zone = App.getMultiplyZoneForLine(ann, item, isPoly) || 1;
          r.runUnits += zone;
          const split = App.getLineLengthSplitForTotals(item, pi, isPoly, ann);
          if (split.px > 0) r.pxRuns++;
          else r.ftRuns.push({ rawFeet: split.feet / zone, zone });
        };
        (ann.quickLines || []).filter((q) => q.lineTypeId === lt.id).forEach((q) => addRun(q, false));
        (ann.polylines || []).filter((p) => p.lineTypeId === lt.id).forEach((p) => addRun(p, true));
      });
    });

    const byGroup = {};
    Object.entries(units).forEach(([gid, g]) => {
      const out = { counter: {}, lineType: {} };
      countersWithChildren.forEach((c) => {
        const u = g.counter[c.id];
        if (!u) return;
        const rows = c.childCounts
          .map((ch) => ({ name: ch.name, qty: ch.qty, per: 'count', ftInterval: null, total: u.zoneUnits * ch.qty, excludedPxRuns: 0 }))
          .filter((r) => r.total > 0);
        if (rows.length) out.counter[c.id] = rows;
      });
      lineTypesWithChildren.forEach((lt) => {
        const u = g.lineType[lt.id];
        if (!u) return;
        const rows = lt.childCounts.map((ch) => {
          const stamp = ch.ruleId ? { ruleId: ch.ruleId } : {};
          if (ch.per === 'ft') {
            // The interval in feet: an inch interval (the rulebook's unit for
            // hanger spacing) wins over the whole-foot ftInterval.
            const n = SM() ? SM().childIntervalFeet(ch) : (ch.ftInterval || 10);
            const total = u.ftRuns.reduce((s, run) => s + Math.ceil(run.rawFeet / n) * run.zone, 0) * ch.qty;
            return { name: ch.name, qty: ch.qty, per: 'ft', ftInterval: ch.intervalIn > 0 ? null : n, ...(ch.intervalIn > 0 ? { intervalIn: ch.intervalIn } : {}), ...stamp, total, excludedPxRuns: u.pxRuns };
          }
          return { name: ch.name, qty: ch.qty, per: 'run', ftInterval: null, ...stamp, total: u.runUnits * ch.qty, excludedPxRuns: 0 };
        }).filter((r) => r.total > 0 || r.excludedPxRuns > 0);
        if (rows.length) out.lineType[lt.id] = rows;
      });
      if (Object.keys(out.counter).length || Object.keys(out.lineType).length) byGroup[gid] = out;
    });
    return { byGroup };
  }

  // --- edit UI (inside #counterLineTypeDetailsModal) -------------------------

  function renderChildCountsSection(kind, item) {
    const listEl = document.getElementById('childCountsList');
    const perSel = document.getElementById('childCountPer');
    const ftWrap = document.getElementById('childCountFtNWrap');
    const suggestEl = document.getElementById('childCountsSuggest');
    if (!listEl || !perSel) return;

    if (!Array.isArray(item.childCounts)) item.childCounts = item.childCounts || [];

    // "From the rulebook" (slice 3): a line type whose name declares a
    // supported material and size earns its hanger count as a one-tap row,
    // stamped with the rule id so the Summary row wears the § chip. The match
    // is named so a mis-named type is fixed at the name, not the rule.
    const renderSuggestions = () => {
      if (!suggestEl) return;
      const sm = SM();
      const sugg = kind === 'lineType' && sm ? sm.hangerSuggestionsFor(item.name) : [];
      const pending = sugg.filter((sg) => !(item.childCounts || []).some((ch) => ch.ruleId === sg.ruleId));
      if (!pending.length) { suggestEl.innerHTML = ''; suggestEl.hidden = true; return; }
      const esc = App.escapeHtml;
      suggestEl.hidden = false;
      suggestEl.innerHTML = '<div class="child-count-suggest-head">From the rulebook</div>'
        + pending.map((sg, i) => '<div class="child-count-suggest-row" data-idx="' + i + '">'
          + '<div class="child-count-suggest-main"><div>' + esc(sg.name) + ' · ' + esc(sg.qty) + ' per ' + esc(sm.childIntervalLabel(sg)) + '</div>'
          + '<div class="child-count-suggest-match">matches ' + esc(sg.match) + (App.ruleChipHtml ? ' ' + App.ruleChipHtml(sg.ruleId) : '') + '</div></div>'
          + '<button type="button" class="child-count-suggest-add">Add</button></div>').join('')
        + '<div class="child-count-suggest-foot">Suggested from the line type\'s name. Wrong material or size? Fix the name, not the rule.</div>';
      suggestEl.querySelectorAll('.child-count-suggest-add').forEach((btn) => {
        btn.onclick = () => {
          const sg = pending[Number(btn.closest('.child-count-suggest-row').dataset.idx)];
          App.pushUndoSnapshotCurrentPage();
          item.childCounts.push({ name: sg.name, qty: sg.qty, per: sg.per, intervalIn: sg.intervalIn, ruleId: sg.ruleId });
          App.markProjectDirty();
          App.logUserEvent && App.logUserEvent('child_count_from_rule', App.state.currentProjectId || null, { rule: sg.ruleId, lineType: item.name });
          App.updateUI();
          renderRows();
          renderSuggestions();
        };
      });
    };

    // Rule choices depend on the parent kind.
    perSel.innerHTML = kind === 'counter'
      ? '<option value="count">per count</option>'
      : '<option value="run">per run</option><option value="ft">per N ft</option>';
    const syncFtVisibility = () => { if (ftWrap) ftWrap.style.display = perSel.value === 'ft' ? '' : 'none'; };
    perSel.onchange = syncFtVisibility;
    syncFtVisibility();

    const esc = App.escapeHtml;
    const renderRows = () => {
      const rows = item.childCounts || [];
      listEl.innerHTML = rows.length
        ? rows.map((ch, i) =>
          '<div class="child-count-row" data-idx="' + i + '">' +
          '<span class="child-count-qty">' + esc(ch.qty) + ' ×</span>' +
          '<span class="child-count-name">' + esc(ch.name) + '</span>' +
          '<span class="child-count-per">' + esc(ruleLabel(ch)) + (ch.ruleId && App.ruleChipHtml ? ' ' + App.ruleChipHtml(ch.ruleId) : '') + '</span>' +
          '<button type="button" class="child-count-remove" title="Remove" aria-label="Remove">×</button>' +
          '</div>').join('')
        : '<div class="child-count-empty">None yet — counted automatically with every ' + (kind === 'counter' ? 'placed count' : 'run') + '.</div>';
      listEl.querySelectorAll('.child-count-remove').forEach((btn) => {
        btn.onclick = () => {
          const idx = Number(btn.closest('.child-count-row').dataset.idx);
          App.pushUndoSnapshotCurrentPage();
          item.childCounts.splice(idx, 1);
          App.markProjectDirty();
          App.updateUI();
          renderRows();
          renderSuggestions();
        };
      });
    };
    renderRows();
    renderSuggestions();

    document.getElementById('childCountAdd').onclick = () => {
      const nameEl = document.getElementById('childCountName');
      const qtyEl = document.getElementById('childCountQty');
      const ftNEl = document.getElementById('childCountFtN');
      const name = (nameEl.value || '').trim();
      const qty = Math.max(1, Math.round(Number(qtyEl.value) || 1));
      if (!name) { App.showToast('Name the child count first'); return; }
      const ch = { name, qty, per: perSel.value };
      if (ch.per === 'ft') {
        const unitEl = document.getElementById('childCountIntervalUnit');
        const n = Math.max(1, Math.round(Number(ftNEl.value) || (unitEl && unitEl.value === 'in' ? 12 : 10)));
        if (unitEl && unitEl.value === 'in') ch.intervalIn = n; else ch.ftInterval = n;
      }
      App.pushUndoSnapshotCurrentPage();
      item.childCounts.push(ch);
      App.markProjectDirty();
      App.updateUI();
      nameEl.value = '';
      renderRows();
    };
  }

  App.getChildCountTotals = getChildCountTotals;
  App.renderChildCountsSection = renderChildCountsSection;
  App.childCountRuleLabel = ruleLabel;
})();
