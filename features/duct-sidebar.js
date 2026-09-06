/*
 * features/duct-sidebar.js — the Duct sidebar section (DUCT-PLAN.md unit D4).
 *
 * Sits between Groups and Rooms (#ductSection) and is INVISIBLE until the
 * first duct run exists (the Rooms-section rule: existing takeoffs see no new
 * UI). Renders, per the mockup's grouped-rows pattern (the Lines section's
 * lines-type-group idiom):
 *
 *   [airside header — only when MORE THAN ONE airside exists]   §1
 *   run header: airside swatch · name · "202' · 1,196 lb" badge (DM Mono)
 *     size-segment rows: "24×12 24 ga — 86' · 597"   (per size, via
 *       runStraightItems + tallyStraightBySize over the app's scale glue)
 *     fittings line: "2 elbows · 1 transition · 1 tap"  (duct-model
 *       tallyDuctFittingCounts over the fittings anchored to THIS run —
 *       f.runId; taps other runs make INTO this run count here, because a
 *       tap's runId is the parent. App.getDuctFittingCounts stays the
 *       page/project-scoped seam for D5's schedule.)
 *   All-duct total row: "All duct  202' · 1,196 lb" (accent).
 *
 * Row click selects the run — the lines-list behavior verbatim: jump to its
 * page + fitZoom, glow on the canvas (env.selectedDuctRunId → canvas-draw's
 * live-only shadow/width treatment), click again deselects. The section
 * collapses via its header chevron (state.ductListCollapsed, in-memory like
 * roomsListCollapsed). Runs are read from each page's ACTIVE canvas, exactly
 * like the Lines list.
 *
 * Sidebar usage-filter scopes (counterSidebarFilterScope /
 * lineTypeSidebarFilterScope) are deliberately NOT applicable here: those
 * filters hide unused TYPES from the palette lists, while this section — like
 * the Lines and Rooms lists — enumerates placed instances only, so there is
 * never an "unused" row to hide.
 *
 * Pure duct math (runStraightItems, tallyStraightBySize,
 * tallyDuctFittingCounts, formatDuctSize) comes from duct-model.js globals;
 * DUCT_AIRSIDE_COLORS from canvas-draw.js (the ONE airside→color map).
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const AIRSIDE_ORDER = ['supply', 'return', 'exhaust'];
  const AIRSIDE_LABELS = { supply: 'Supply', return: 'Return', exhaust: 'Exhaust' };
  // Singular/plural fitting labels for the per-run fittings line.
  const FITTING_WORDS = {
    elbow90: ['elbow', 'elbows'],
    elbow45: ['45° elbow', '45° elbows'],
    transition: ['transition', 'transitions'],
    tap: ['tap', 'taps'],
    boot: ['boot', 'boots'],
    offset: ['offset', 'offsets'],
  };

  const fmtFt = (ft) => Math.round(ft).toLocaleString() + "'";
  const fmtLb = (lb) => Math.round(lb).toLocaleString();

  // Every committed run on each page's ACTIVE canvas (the Lines-list rule),
  // with its page + annotations so length math can use the app's scale glue.
  function collectRunEntries() {
    const state = App.state;
    const out = [];
    (state.pages || []).forEach((p, pi) => {
      const ann = App.getActiveAnnotations(p, pi);
      (ann?.ductRuns || []).forEach((run) => out.push({ run, pageIdx: pi, ann }));
    });
    return out;
  }

  // Per-size rows + totals for one run: duct-model's straight-item walk with
  // feet coming from the same per-page effective-scale calls Measure uses.
  function runTally(entry) {
    const distFt = (a, b) => App.getLineRealWorldLengthFeet({ points: [a, b] }, entry.pageIdx, true, entry.ann) || 0;
    return tallyStraightBySize(runStraightItems(entry.run, distFt), entry.run.pressureClass);
  }

  // "2 elbows · 1 transition · 1 tap" over the fittings anchored to this run
  // ('' when it has none). Suppressed tombstones are skipped by the tally.
  function fittingsLineFor(entry) {
    const fittings = (entry.ann?.ductFittings || []).filter((f) => f.runId === entry.run.id);
    const byType = new Map();
    tallyDuctFittingCounts(fittings).forEach((row) => {
      byType.set(row.type, (byType.get(row.type) || 0) + row.count);
    });
    const parts = [];
    byType.forEach((count, type) => {
      const words = FITTING_WORDS[type] || [type, type + 's'];
      parts.push(count + ' ' + (count === 1 ? words[0] : words[1]));
    });
    return parts.join(' · ');
  }

  function renderDuctList() {
    const section = document.getElementById('ductSection');
    if (!section) return;
    const state = App.state;
    const esc = App.escapeHtml;
    const entries = collectRunEntries();
    // Invisible until the first run is committed (the Rooms-section rule).
    section.style.display = entries.length ? '' : 'none';
    if (!entries.length) return;
    const collapsed = !!state.ductListCollapsed;
    document.getElementById('ductCollapseIcon').textContent = collapsed ? '▶' : '▼';
    const list = document.getElementById('ductList');
    list.style.display = collapsed ? 'none' : '';
    if (collapsed) return;

    list.innerHTML = '';
    // Group by airside; headers only when the takeoff actually mixes them.
    const airsides = [...new Set(entries.map((e) => AIRSIDE_ORDER.includes(e.run.airside) ? e.run.airside : 'supply'))];
    const showAirsideHeaders = airsides.length > 1;
    let allFt = 0, allLb = 0;

    AIRSIDE_ORDER.forEach((airside) => {
      const subset = entries.filter((e) => (AIRSIDE_ORDER.includes(e.run.airside) ? e.run.airside : 'supply') === airside);
      if (!subset.length) return;
      const color = DUCT_AIRSIDE_COLORS[airside] || DUCT_AIRSIDE_COLORS.supply;
      if (showAirsideHeaders) {
        const h = document.createElement('div');
        h.className = 'duct-airside-header';
        h.innerHTML = '<span class="duct-airside-swatch" style="background:' + color + '"></span>' + AIRSIDE_LABELS[airside];
        list.appendChild(h);
      }
      subset.forEach((entry) => {
        const run = entry.run;
        const tally = runTally(entry);
        allFt += tally.totalLengthFt;
        allLb += tally.totalPounds;
        const wrap = document.createElement('div');
        wrap.className = 'duct-run-wrap';
        const isSelected = state.selectedDuctRunId === run.id && state.selectedDuctRunPageIdx === entry.pageIdx;
        const row = document.createElement('div');
        row.className = 'sidebar-item duct-run-row' + (isSelected ? ' active' : '');
        row.title = 'Click to view on the canvas';
        row.innerHTML = '<span class="duct-airside-swatch" style="background:' + color + '" title="' + AIRSIDE_LABELS[airside] + '"></span>'
          + '<span class="name duct-run-name">' + esc(run.name || 'Duct run') + '</span>'
          + '<span class="badge">' + fmtFt(tally.totalLengthFt) + ' · ' + fmtLb(tally.totalPounds) + ' lb</span>';
        row.onclick = () => {
          if (isSelected) {
            state.selectedDuctRunId = null;
            state.selectedDuctRunPageIdx = null;
            App.updateUI();
            App.renderAnnotations();
          } else {
            state.selectedDuctRunId = run.id;
            state.selectedDuctRunPageIdx = entry.pageIdx;
            state.currentPage = entry.pageIdx;
            App.fitZoom();
          }
        };
        wrap.appendChild(row);
        tally.rows.forEach((r) => {
          const seg = document.createElement('div');
          seg.className = 'duct-seg-row';
          seg.textContent = r.sizeKey + (r.gauge ? ' ' + r.gauge + ' ga' : '') + ' — ' + fmtFt(r.lengthFt) + ' · ' + fmtLb(r.pounds);
          wrap.appendChild(seg);
        });
        const fl = fittingsLineFor(entry);
        if (fl) {
          const f = document.createElement('div');
          f.className = 'duct-fittings-line';
          f.textContent = fl;
          wrap.appendChild(f);
        }
        list.appendChild(wrap);
      });
    });

    const total = document.createElement('div');
    total.className = 'duct-all-total';
    total.innerHTML = '<span>All duct</span><span class="duct-all-total-num">' + fmtFt(allFt) + ' · ' + fmtLb(allLb) + ' lb</span>';
    list.appendChild(total);
  }

  // Section collapse — the Rooms-header pattern (bound at load; the element
  // is static DOM).
  document.getElementById('ductSectionTitle').onclick = () => {
    App.state.ductListCollapsed = !App.state.ductListCollapsed;
    renderDuctList();
  };

  App.renderDuctList = renderDuctList;
})();
