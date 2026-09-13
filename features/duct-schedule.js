/*
 * features/duct-schedule.js — the Duct Schedule modal + Copy Schedule + the
 * report seam (DUCT-PLAN.md unit D5, "The schedule prices like a bid").
 *
 * The schedule is the bid-pounds rollup over the committed duct takeoff:
 *
 *   Straight duct   per-size rows (size | gauge | LF | lb/ft | lb; round rows
 *                   also show "LF · N joints @ 10'" — spiral lands in 10'
 *                   sticks, joints = ceil(LF/10)) + a total row. D8: rise/drop
 *                   verticalFt entries ride these rows automatically
 *                   (runStraightItems adds them at the segment's size).
 *   Fittings        Counted | Factor % segment. Counted: type+size rows from
 *                   the committed fittings (D3's walk, suppressed tombstones
 *                   skipped) at duct-model's lb-eq each, PLUS — D8 §6, when
 *                   ductSettings.countVdPerTap (default ON) — one derived
 *                   "Volume damper" row per tap size (duct-model
 *                   ductVolumeDamperFittings; taps flagged noVd via the
 *                   right-click menu are skipped). Factor: one row applying
 *                   the % to straight pounds (default 40, editable).
 *   Flex duct       D8 — per-system "N drops · X LF" rows over the CFM
 *                   devices ATTACHED to duct (D6's nearest-run rule; drop
 *                   length = the counter's flexDropFt, default 8'), with the
 *                   "N drops over X' max" warning past ductSettings.maxFlexFt.
 *                   LF ONLY — flex is priced by the drop, never weighed, so
 *                   these rows deliberately do NOT touch the bid weight.
 *   Insulation      liner / wrap sq ft (duct-model insulationSqFt over the
 *                   same straight items — LF × perimeter/12).
 *   Seam & waste    its own labeled % line over the subtotal (default +15,
 *                   editable).
 *   Bid weight      the one number.
 *
 * Scope follows the house dialect — a This sheet / Every sheet segment in the
 * modal header (default Every sheet: a schedule prices the whole bid). At one
 * page every scope is the same set, so the segment hides — the same
 * skip-the-chooser rule the copy buttons use (features/output.js, B3/J13).
 * Runs and fittings are read from each page's ACTIVE canvas (the Lines-list /
 * duct-sidebar rule) unless a getAnnotations override is passed (report path).
 *
 * The editable percentages + the Counted|Factor mode persist per project as
 * `state.ductSettings` { seamWastePct, fittingFactorPct, fittingMode } —
 * defaulted in app.js state init and riding every save/load/export/import
 * path like legendSettings (AGENTS.md "persisted per-project field" rule).
 *
 * Mixed pressure classes are handled by rolling up per class and merging the
 * rows (duct-model's documented composition rule) — gauges stay honest when
 * a 1" w.g. system and a 2" w.g. system share a takeoff.
 *
 * Copy Schedule writes a tab-separated plain-text table (the Copy-to-/Tooling
 * column convention, PipeTooling-paste friendly) through the SAME pre-copy
 * scale gate as the other copy surfaces (App.runGatedCopy — T1-05), with a
 * duct-specific collector: pages where a duct run has no effective scale.
 *
 * Report/export integration: `App.getDuctScheduleForReport(opts)` is resolved
 * at call time by report.js (the getRoomVolumeTotals precedent), so the
 * schedule lands as a Summary-section table in Show Report, the Export PDFs
 * report pages, and the pdf-bundle path — no frozen window.* contract change.
 *
 * Pure duct math (runStraightItems, tallyStraightBySize, rollupDuct,
 * formatDuctSize, ductGoverningDimIn, DUCT_FITTING_TYPES) comes from
 * duct-model.js globals. Boundary rule: read shared deps from App.* at call
 * time, never captured at load. See ARCHITECTURE.md "Feature files /
 * window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const FITTING_LABELS = {
    elbow90: '90° elbow', elbow45: '45° elbow', transition: 'Transition',
    tap: 'Tap', boot: 'Boot', offset: 'Offset', vd: 'Volume damper',
  };
  // Row order for the fittings table: the D3 types in their canonical order,
  // then the derived VD rows (not a DUCT_FITTING_TYPES member).
  const fittingTypeOrder = (t) => {
    const i = DUCT_FITTING_TYPES.indexOf(t);
    return i < 0 ? DUCT_FITTING_TYPES.length : i;
  };
  /** Spiral/round duct lands in 10' sticks — one joint per stick landed. */
  const ROUND_JOINT_STICK_FT = 10;

  const fmtFt = (ft) => Math.round(ft).toLocaleString() + "'";
  const fmtLb = (lb) => Math.round(lb).toLocaleString();
  const fmtSqFt = (sf) => Math.round(sf).toLocaleString();
  const esc = (s) => App.escapeHtml(s);

  // 'page' | 'project' — in-memory like the modal itself; reset to the
  // default (Every sheet) on every open so a stale narrow scope never
  // silently under-reports a bid.
  let scheduleScope = 'project';

  // --- settings (per project — defaults live in app.js state init) ----------

  function getDuctSettings() {
    const state = App.state;
    if (!state.ductSettings || typeof state.ductSettings !== 'object') {
      state.ductSettings = { seamWastePct: 15, fittingFactorPct: 40, fittingMode: 'counted' };
    }
    const ds = state.ductSettings;
    if (!Number.isFinite(ds.seamWastePct) || ds.seamWastePct < 0) ds.seamWastePct = 15;
    if (!Number.isFinite(ds.fittingFactorPct) || ds.fittingFactorPct < 0) ds.fittingFactorPct = 40;
    if (ds.fittingMode !== 'factor') ds.fittingMode = 'counted';
    // D6 design-build knobs — the ductulator suggestion's friction rate and
    // velocity cap (DUCT-PLAN §5). Pre-D6 saves get the defaults here.
    if (!Number.isFinite(ds.frictionInPer100ft) || ds.frictionInPer100ft <= 0) ds.frictionInPer100ft = 0.08;
    if (!Number.isFinite(ds.maxVelocityFpm) || ds.maxVelocityFpm <= 0) ds.maxVelocityFpm = 1200;
    // D8 polish knobs. deckHeightFt is deliberately null-until-set (the
    // auto-riser only arms once the project has a real deck height);
    // countVdPerTap defaults ON for pre-D8 saves (absent ⇒ true).
    if (!(ds.deckHeightFt > 0)) ds.deckHeightFt = null;
    if (!Number.isFinite(ds.maxFlexFt) || ds.maxFlexFt <= 0) ds.maxFlexFt = 6;
    ds.countVdPerTap = ds.countVdPerTap !== false;
    return ds;
  }

  // --- the rollup ------------------------------------------------------------

  // Every run + committed fitting in scope, from each page's ACTIVE canvas
  // (or the caller's getAnnotations override — the report path).
  function collectDuctUniverse(pageIndices, getAnnotations) {
    const state = App.state;
    const indices = pageIndices != null ? pageIndices : (state.pages || []).map((_, i) => i);
    const out = [];
    indices.forEach((pi) => {
      const page = state.pages[pi];
      if (!page) return;
      const ann = getAnnotations ? getAnnotations(pi) : App.getActiveAnnotations(page, pi);
      if (!ann) return;
      out.push({ pageIdx: pi, ann, runs: ann.ductRuns || [], fittings: ann.ductFittings || [] });
    });
    return out;
  }

  /**
   * The schedule numbers. opts { pageIndices?, getAnnotations? } — the
   * report.js summary contract. Returns null when the scope holds no runs.
   * Both fitting numbers are always computed (the Counted|Factor toggle
   * flips without recomputing); percentages/mode come from state.ductSettings.
   */
  function computeDuctSchedule(opts) {
    const o = opts || {};
    const ds = getDuctSettings();
    const universe = collectDuctUniverse(o.pageIndices, o.getAnnotations);
    // Group straight items + fittings by pressure class (a fitting follows its
    // run's class — a tap's runId is the PARENT run) and roll up per class:
    // duct-model's documented composition rule for mixed-class takeoffs.
    const byClass = new Map();
    const bucket = (pc) => {
      const key = pc != null ? String(pc) : '1';
      if (!byClass.has(key)) byClass.set(key, { straightItems: [], fittings: [] });
      return byClass.get(key);
    };
    let anyRun = false;
    universe.forEach(({ pageIdx, ann, runs, fittings }) => {
      const distFt = (a, b) => App.getLineRealWorldLengthFeet({ points: [a, b] }, pageIdx, true, ann) || 0;
      runs.forEach((run) => {
        anyRun = true;
        bucket(run.pressureClass).straightItems.push(...runStraightItems(run, distFt));
      });
      fittings.forEach((f) => {
        if (!f || f.suppressed || !isDuctSize(f.size)) return;
        const parent = runs.find((r) => r && r.id === f.runId);
        const b = bucket(parent ? parent.pressureClass : '1');
        b.fittings.push(f);
        // D8 §6: one derived Volume damper per live tap (noVd skipped), at
        // the tap's size — same pressure-class bucket as its parent run.
        if (ds.countVdPerTap) b.fittings.push(...ductVolumeDamperFittings([f]));
      });
    });
    if (!anyRun) return null;

    // D8 flex drops: CFM devices attached to the scope's runs, per system
    // (duct-model tallyFlexDrops — LF only, priced by count, no pounds).
    // Devices are the live placed markers (App.collectDuctDevices — the same
    // collection the suggestion/balance layers read).
    const flexBySys = new Map();
    universe.forEach(({ pageIdx, runs }) => {
      if (!runs.length || !App.collectDuctDevices) return;
      const devices = App.collectDuctDevices(pageIdx);
      if (!devices.length) return;
      tallyFlexDrops(devices, runs, { maxFlexFt: ds.maxFlexFt }).forEach((row) => {
        const key = row.systemGroupId || '';
        const agg = flexBySys.get(key) || { systemGroupId: row.systemGroupId, count: 0, totalFt: 0, overCount: 0 };
        agg.count += row.count;
        agg.totalFt += row.totalFt;
        agg.overCount += row.overCount;
        flexBySys.set(key, agg);
      });
    });
    const groupName = (gid) => {
      const g = gid ? (App.state.groups || []).find((x) => x.id === gid) : null;
      return g ? (g.name || 'System') : 'No system';
    };
    const flexRows = [...flexBySys.values()]
      .map((r) => ({ ...r, systemName: groupName(r.systemGroupId) }))
      .sort((a, b) => a.systemName.localeCompare(b.systemName));

    const straightRows = [];
    const fittingRows = [];
    let straightTotalFt = 0, straightTotalLb = 0, fittingsCountedLb = 0, linerSqFt = 0, wrapSqFt = 0;
    byClass.forEach((b, pc) => {
      const r = rollupDuct({ straightItems: b.straightItems, fittings: b.fittings, pressureClass: pc });
      r.straight.rows.forEach((row) => straightRows.push(row));
      r.fittings.rows.forEach((row) => fittingRows.push(row));
      straightTotalFt += r.straight.totalLengthFt;
      straightTotalLb += r.straight.totalPounds;
      fittingsCountedLb += r.fittings.totalPounds;
      linerSqFt += r.linerSqFt;
      wrapSqFt += r.wrapSqFt;
    });
    // Big-to-small reads like a shop schedule; fittings in type order.
    straightRows.sort((a, b) => (ductGoverningDimIn(b.size) - ductGoverningDimIn(a.size)) || a.sizeKey.localeCompare(b.sizeKey));
    straightRows.forEach((row) => {
      row.joints = row.size.kind === 'round' ? Math.ceil(row.lengthFt / ROUND_JOINT_STICK_FT) : null;
    });
    fittingRows.sort((a, b) =>
      (fittingTypeOrder(a.type) - fittingTypeOrder(b.type))
      || a.sizeKey.localeCompare(b.sizeKey));

    const fittingFactorLb = straightTotalLb * (ds.fittingFactorPct / 100);
    const fittingsAppliedLb = ds.fittingMode === 'factor' ? fittingFactorLb : fittingsCountedLb;
    const subtotalLb = straightTotalLb + fittingsAppliedLb;
    const seamWasteLb = subtotalLb * (ds.seamWastePct / 100);
    return {
      straightRows, straightTotalFt, straightTotalLb,
      fittingRows, fittingsCountedLb,
      fittingMode: ds.fittingMode, fittingFactorPct: ds.fittingFactorPct, fittingFactorLb,
      fittingsAppliedLb, subtotalLb,
      seamWastePct: ds.seamWastePct, seamWasteLb,
      bidWeightLb: subtotalLb + seamWasteLb,
      linerSqFt, wrapSqFt,
      // D8: per-system flex-drop rows (LF only — never in the pounds above)
      // and the warning cap they were checked against.
      flexRows, maxFlexFt: ds.maxFlexFt,
    };
  }

  // The LF cell — round rows carry the joint count ("40' · 4 joints @ 10'").
  function lfLabel(row) {
    if (row.joints == null) return fmtFt(row.lengthFt);
    return fmtFt(row.lengthFt) + ' · ' + row.joints + (row.joints === 1 ? ' joint' : ' joints') + " @ " + ROUND_JOINT_STICK_FT + "'";
  }

  // D8: the max-flex warning label — "3 drops over 6' max" ('' when clean).
  function flexOverLabel(row, maxFlexFt) {
    if (!(row.overCount > 0)) return '';
    return row.overCount + (row.overCount === 1 ? ' drop' : ' drops') + " over " + maxFlexFt + "' max";
  }

  // --- the modal -------------------------------------------------------------

  function scopePageIndices() {
    const state = App.state;
    if (scheduleScope === 'page' && state.pages.length > 1) return [state.currentPage];
    return null;   // null = every sheet (computeDuctSchedule's default walk)
  }

  function renderScheduleBody() {
    const body = document.getElementById('ductScheduleBody');
    if (!body) return;
    const ds = getDuctSettings();
    const s = computeDuctSchedule({ pageIndices: scopePageIndices() });
    if (!s) {
      body.innerHTML = '<p class="duct-schedule-empty">No duct runs ' + (scheduleScope === 'page' ? 'on this sheet' : 'yet') + '. Trace a run with the Duct tool first.</p>';
      const copyBtn0 = document.getElementById('ductScheduleCopy');
      if (copyBtn0) copyBtn0.disabled = true;
      return;
    }
    const copyBtn = document.getElementById('ductScheduleCopy');
    if (copyBtn) copyBtn.disabled = false;

    let html = '';
    // Straight duct
    html += '<div class="duct-schedule-section-label">Straight duct</div>';
    html += '<table class="duct-schedule-table"><tr><th>Size</th><th>Gauge</th><th>LF</th><th>lb/ft</th><th>lb</th></tr>';
    s.straightRows.forEach((r) => {
      html += '<tr><td class="mono">' + esc(r.sizeKey) + '</td><td>' + (r.gauge ? r.gauge + ' ga' : '—') + '</td><td class="mono">' + esc(lfLabel(r)) + '</td><td class="mono">' + r.lbPerFt.toFixed(2) + '</td><td class="mono num">' + fmtLb(r.pounds) + '</td></tr>';
    });
    html += '<tr class="duct-schedule-total-row"><td>Straight total</td><td></td><td class="mono">' + fmtFt(s.straightTotalFt) + '</td><td></td><td class="mono num">' + fmtLb(s.straightTotalLb) + '</td></tr>';
    html += '</table>';

    // Fittings + the Counted | Factor % segment
    html += '<div class="duct-schedule-section-label duct-schedule-fittings-head"><span>Fittings</span>'
      + '<div class="duct-shape-toggle" id="ductFitModeSegment">'
      + '<button type="button" data-fitmode="counted"' + (s.fittingMode === 'counted' ? ' class="active"' : '') + '>Counted</button>'
      + '<button type="button" data-fitmode="factor"' + (s.fittingMode === 'factor' ? ' class="active"' : '') + '>Factor %</button>'
      + '</div></div>';
    if (s.fittingMode === 'counted') {
      html += '<table class="duct-schedule-table"><tr><th>Type</th><th>Size</th><th>Count</th><th>lb ea</th><th>lb</th></tr>';
      if (!s.fittingRows.length) {
        html += '<tr><td colspan="5" class="duct-schedule-empty-cell">No fittings counted — corners, size steps, and taps count themselves as you trace.</td></tr>';
      }
      s.fittingRows.forEach((r) => {
        html += '<tr><td>' + esc(FITTING_LABELS[r.type] || r.type) + '</td><td class="mono">' + esc(r.sizeKey) + '</td><td class="mono">' + r.count + '</td><td class="mono">' + r.lbEach.toFixed(1) + '</td><td class="mono num">' + fmtLb(r.pounds) + '</td></tr>';
      });
      html += '<tr class="duct-schedule-total-row"><td>Fittings total</td><td></td><td></td><td></td><td class="mono num">' + fmtLb(s.fittingsCountedLb) + '</td></tr>';
      html += '</table>';
    } else {
      html += '<table class="duct-schedule-table"><tr class="duct-schedule-total-row"><td>Factor <input type="number" id="ductFitFactorPct" class="duct-schedule-pct" min="0" max="200" step="1" value="' + s.fittingFactorPct + '" aria-label="Fitting factor percent">% of straight</td><td class="mono num">' + fmtLb(s.fittingFactorLb) + '</td></tr></table>';
    }

    // Flex drops (D8 — only when CFM devices hang off the scope's duct).
    // LF only, priced by the drop: deliberately outside the pounds rollup.
    if (s.flexRows.length) {
      html += '<div class="duct-schedule-section-label">Flex duct <span class="duct-schedule-sublabel">(by the drop — not in bid weight)</span></div>';
      html += '<table class="duct-schedule-table"><tr><th>System</th><th>Drops</th><th>LF</th><th></th></tr>';
      s.flexRows.forEach((r) => {
        const warn = flexOverLabel(r, s.maxFlexFt);
        html += '<tr><td>' + esc(r.systemName) + '</td><td class="mono">' + r.count + '</td><td class="mono">' + fmtFt(r.totalFt)
          + '</td><td>' + (warn ? '<span class="duct-flex-warn">⚠ ' + esc(warn) + '</span>' : '') + '</td></tr>';
      });
      html += '</table>';
    }

    // Insulation (only when the takeoff carries liner/wrap)
    if (s.linerSqFt > 0 || s.wrapSqFt > 0) {
      html += '<table class="duct-schedule-table duct-schedule-rollup">';
      if (s.linerSqFt > 0) html += '<tr><td>Liner</td><td class="mono num">' + fmtSqFt(s.linerSqFt) + ' sq ft</td></tr>';
      if (s.wrapSqFt > 0) html += '<tr><td>Wrap</td><td class="mono num">' + fmtSqFt(s.wrapSqFt) + ' sq ft</td></tr>';
      html += '</table>';
    }

    // Subtotal → seam & waste → Bid weight
    html += '<table class="duct-schedule-table duct-schedule-rollup">';
    html += '<tr><td>Straight + fittings</td><td class="mono num">' + fmtLb(s.subtotalLb) + ' lb</td></tr>';
    html += '<tr><td>Seam &amp; waste +<input type="number" id="ductSeamWastePct" class="duct-schedule-pct" min="0" max="100" step="1" value="' + s.seamWastePct + '" aria-label="Seam and waste percent">%</td><td class="mono num">' + fmtLb(s.seamWasteLb) + ' lb</td></tr>';
    html += '<tr class="duct-schedule-bid-row"><td>Bid weight</td><td class="mono num">' + fmtLb(s.bidWeightLb) + ' lb</td></tr>';
    html += '</table>';

    body.innerHTML = html;

    // Wire the freshly rendered controls. `change` (not `input`) so typing a
    // % doesn't re-render mid-keystroke and steal focus.
    const seg = document.getElementById('ductFitModeSegment');
    if (seg) seg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-fitmode]');
      if (!b) return;
      getDuctSettings().fittingMode = b.dataset.fitmode === 'factor' ? 'factor' : 'counted';
      App.markProjectDirty();
      renderScheduleBody();
    });
    const factorInput = document.getElementById('ductFitFactorPct');
    if (factorInput) factorInput.addEventListener('change', () => {
      const v = parseFloat(factorInput.value);
      getDuctSettings().fittingFactorPct = Number.isFinite(v) && v >= 0 ? v : 40;
      App.markProjectDirty();
      renderScheduleBody();
    });
    const seamInput = document.getElementById('ductSeamWastePct');
    if (seamInput) seamInput.addEventListener('change', () => {
      const v = parseFloat(seamInput.value);
      getDuctSettings().seamWastePct = Number.isFinite(v) && v >= 0 ? v : 15;
      App.markProjectDirty();
      renderScheduleBody();
    });
  }

  function syncScopeSegment() {
    const seg = document.getElementById('ductScheduleScope');
    if (!seg) return;
    // One page = every scope is the same set: hide the chooser (the
    // features/output.js single-scope rule).
    seg.style.display = App.state.pages.length > 1 ? '' : 'none';
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.scope === scheduleScope));
  }

  // D6: the design-build ductulator knobs (friction rate + velocity cap) live
  // on THIS modal — it is already the home of every editable duct percentage
  // and opens without arming a tool, where the create modal sits inside the
  // arm-a-trace flow and should stay minimal (the documented "least chrome"
  // call). Values sync on open; `change` commits (the % inputs' idiom).
  function syncDesignRow() {
    const ds = getDuctSettings();
    const friction = document.getElementById('ductFrictionRate');
    const velocity = document.getElementById('ductMaxVelocity');
    if (friction) friction.value = ds.frictionInPer100ft;
    if (velocity) velocity.value = ds.maxVelocityFpm;
    // D8 knobs, same row: deck height (empty = unset — no auto-riser), the
    // max-flex warning cap, and the VD-per-tap toggle.
    const deck = document.getElementById('ductDeckHeight');
    if (deck) deck.value = ds.deckHeightFt > 0 ? ds.deckHeightFt : '';
    const maxFlex = document.getElementById('ductMaxFlex');
    if (maxFlex) maxFlex.value = ds.maxFlexFt;
    const vdBtn = document.getElementById('ductVdPerTapBtn');
    if (vdBtn) vdBtn.setAttribute('aria-pressed', String(!!ds.countVdPerTap));
  }

  function openDuctScheduleModal() {
    scheduleScope = 'project';   // a schedule prices the whole bid by default
    syncScopeSegment();
    syncDesignRow();
    renderScheduleBody();
    App.showModal('ductScheduleModal');
  }

  // --- Copy Schedule ---------------------------------------------------------

  // Tab-separated plain text — the Copy-to-/Tooling column convention, so a
  // paste lands in columns in PipeTooling/sheets and stays readable in email.
  function buildDuctScheduleText(s) {
    if (!s) return '';
    const lines = [];
    lines.push('Duct Schedule');
    lines.push('-------------');
    lines.push('');
    lines.push('Straight duct');
    s.straightRows.forEach((r) => {
      lines.push([r.sizeKey, (r.gauge ? r.gauge + ' ga' : '—'), lfLabel(r), r.lbPerFt.toFixed(2) + ' lb/ft', fmtLb(r.pounds) + ' lb'].join('\t'));
    });
    lines.push(['Straight total', '', fmtFt(s.straightTotalFt), '', fmtLb(s.straightTotalLb) + ' lb'].join('\t'));
    lines.push('');
    if (s.fittingMode === 'counted') {
      lines.push('Fittings (counted)');
      s.fittingRows.forEach((r) => {
        lines.push([(FITTING_LABELS[r.type] || r.type), r.sizeKey, String(r.count), r.lbEach.toFixed(1) + ' lb ea', fmtLb(r.pounds) + ' lb'].join('\t'));
      });
      lines.push(['Fittings total', '', '', '', fmtLb(s.fittingsCountedLb) + ' lb'].join('\t'));
    } else {
      lines.push(['Fittings (factor ' + s.fittingFactorPct + '% of straight)', fmtLb(s.fittingFactorLb) + ' lb'].join('\t'));
    }
    lines.push('');
    if (s.flexRows.length) {
      lines.push('Flex duct (by the drop — not in bid weight)');
      s.flexRows.forEach((r) => {
        const warn = flexOverLabel(r, s.maxFlexFt);
        lines.push([r.systemName, r.count + (r.count === 1 ? ' drop' : ' drops'), fmtFt(r.totalFt)]
          .concat(warn ? ['⚠ ' + warn] : []).join('\t'));
      });
      lines.push('');
    }
    if (s.linerSqFt > 0) lines.push(['Liner', fmtSqFt(s.linerSqFt) + ' sq ft'].join('\t'));
    if (s.wrapSqFt > 0) lines.push(['Wrap', fmtSqFt(s.wrapSqFt) + ' sq ft'].join('\t'));
    if (s.linerSqFt > 0 || s.wrapSqFt > 0) lines.push('');
    lines.push(['Straight + fittings', fmtLb(s.subtotalLb) + ' lb'].join('\t'));
    lines.push(['Seam & waste (+' + s.seamWastePct + '%)', fmtLb(s.seamWasteLb) + ' lb'].join('\t'));
    lines.push(['Bid weight', fmtLb(s.bidWeightLb) + ' lb'].join('\t'));
    return lines.join('\n');
  }

  // T1-05 gate collector, duct edition: flag pages (of the walked set) where a
  // duct run has no effective scale — its "pounds" would be raw-coordinate
  // garbage, the exact failure the line gate exists to catch.
  function collectUnscaledDuctPages(getAnnFn, pageIndices) {
    const state = App.state;
    const indices = pageIndices != null ? pageIndices : state.pages.map((_, i) => i);
    const flagged = [];
    indices.forEach((pi) => {
      const page = state.pages[pi];
      if (!page) return;
      const ann = getAnnFn ? getAnnFn(page, pi) : App.getActiveAnnotations(page, pi);
      const unscaled = (ann?.ductRuns || []).some((run) => {
        if ((run.vertices?.length || 0) < 2) return false;
        const eff = App.getEffectiveScaleForLine(ann, { points: run.vertices }, true, pi);
        return !(eff && eff.pixelsPerUnit);
      });
      if (unscaled) flagged.push(pi);
    });
    return flagged;
  }

  async function doCopyDuctSchedule(getAnnFn, pageIndices, mode) {
    const s = computeDuctSchedule({
      pageIndices,
      getAnnotations: getAnnFn ? (pi) => getAnnFn(App.state.pages[pi], pi) : undefined,
    });
    const text = buildDuctScheduleText(s);
    if (!text) {
      alert('No duct runs to schedule yet. Trace a run with the Duct tool first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      App.logUserEvent('copy_summary', App.state.currentProjectId || null, { surface: 'duct-schedule', mode: mode || 'project' });
      App.showToast('Duct schedule copied — Bid weight ' + fmtLb(s.bidWeightLb) + ' lb.');
    } catch (err) {
      console.error('[copy]', err);
      alert('Nothing was copied — the browser blocked clipboard access. Click Copy Schedule again, and allow clipboard access if the browser asks.');
    }
  }

  // --- report seam (report.js resolves this at call time — rooms precedent) --

  function getDuctScheduleForReport(opts) {
    return computeDuctSchedule(opts || {});
  }

  // --- wiring (static DOM — bound at load like duct-sidebar) ----------------

  const openBtn = document.getElementById('ductScheduleBtn');
  if (openBtn) openBtn.onclick = (e) => { e.stopPropagation(); openDuctScheduleModal(); };
  const closeBtn = document.getElementById('ductScheduleClose');
  if (closeBtn) closeBtn.onclick = () => App.hideModal('ductScheduleModal');
  const scopeSeg = document.getElementById('ductScheduleScope');
  if (scopeSeg) scopeSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-scope]');
    if (!b) return;
    scheduleScope = b.dataset.scope === 'page' ? 'page' : 'project';
    syncScopeSegment();
    renderScheduleBody();
  });
  const frictionInput = document.getElementById('ductFrictionRate');
  if (frictionInput) frictionInput.addEventListener('change', () => {
    const v = parseFloat(frictionInput.value);
    getDuctSettings().frictionInPer100ft = Number.isFinite(v) && v > 0 ? v : 0.08;
    syncDesignRow();
    App.markProjectDirty();
  });
  const velocityInput = document.getElementById('ductMaxVelocity');
  if (velocityInput) velocityInput.addEventListener('change', () => {
    const v = parseFloat(velocityInput.value);
    getDuctSettings().maxVelocityFpm = Number.isFinite(v) && v > 0 ? v : 1200;
    syncDesignRow();
    App.markProjectDirty();
  });
  // D8: deck height (empty clears — the auto-riser disarms), max-flex cap
  // (re-renders the body so the ⚠ labels track), VD-per-tap toggle (re-renders
  // so the Volume damper rows appear/disappear live).
  const deckInput = document.getElementById('ductDeckHeight');
  if (deckInput) deckInput.addEventListener('change', () => {
    const v = parseFloat(deckInput.value);
    getDuctSettings().deckHeightFt = Number.isFinite(v) && v > 0 ? v : null;
    syncDesignRow();
    App.markProjectDirty();
  });
  const maxFlexInput = document.getElementById('ductMaxFlex');
  if (maxFlexInput) maxFlexInput.addEventListener('change', () => {
    const v = parseFloat(maxFlexInput.value);
    getDuctSettings().maxFlexFt = Number.isFinite(v) && v > 0 ? v : 6;
    syncDesignRow();
    App.markProjectDirty();
    renderScheduleBody();
  });
  const vdBtn = document.getElementById('ductVdPerTapBtn');
  if (vdBtn) vdBtn.onclick = () => {
    const ds = getDuctSettings();
    ds.countVdPerTap = !ds.countVdPerTap;
    syncDesignRow();
    App.markProjectDirty();
    renderScheduleBody();
  };
  const copyBtn = document.getElementById('ductScheduleCopy');
  if (copyBtn) copyBtn.onclick = async () => {
    // The same pre-copy scale gate as Copy to /Tooling / Copy Summary
    // (T1-05), with the duct collector. The click is the user gesture, so the
    // clipboard write inside doCopyDuctSchedule stays permitted.
    const indices = scopePageIndices();
    await App.runGatedCopy(null, indices, doCopyDuctSchedule, 'duct-schedule',
      scheduleScope === 'page' ? 'this-sheet' : 'project', collectUnscaledDuctPages);
  };

  App.openDuctScheduleModal = openDuctScheduleModal;
  App.getDuctSettings = getDuctSettings;   // D6: duct-suggest.js reads the design knobs
  App.computeDuctSchedule = computeDuctSchedule;
  App.getDuctScheduleForReport = getDuctScheduleForReport;
  App.buildDuctScheduleText = buildDuctScheduleText;   // spec seam
})();
