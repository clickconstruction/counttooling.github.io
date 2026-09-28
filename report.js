/**
 * ClickCount Print Report
 * Uses globals: state, makeAnnotations, ptDist, polylineDistance, formatDist, renderIconHtml, getLineLengthPdfPts, getLineLengthFeetForTotals (per-line tally lengths in feet), getLineLengthSplitForTotals (ft/px split rollups — px never summed under a ft label), getLineRealWorldLength, getMultiplyZoneForPoint, getMultiplyZoneForLine
 */
(function() {
  // "Main St Restaurant Takeoff Report"; a project nobody named is just "Takeoff Report".
  function reportTitleFor(projectName) {
    const n = String(projectName || '').trim();
    return n && !/^untitled$/i.test(n) ? n + ' Takeoff Report' : 'Takeoff Report';
  }
  // A sheet someone named stands on its own ("P-101 · Plumbing Plan"); a default label (the
  // file name and page number the intake writes, or none) keeps its "Page N:" so it still says
  // where it sits in the set.
  function pageHeadingFor(label, i) {
    const l = String(label || '').trim();
    if (!l) return 'Page ' + (i + 1);
    if (/^Page \d+$/i.test(l)) return l;
    return /, p\d+$/i.test(l) ? 'Page ' + (i + 1) + ': ' + l : l;
  }
  function escapeHtml(s) {
    if (s == null) return '';
    const t = String(s);
    return t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pickScaleForLineType(pagesList) {
    const preferredUnits = ['ft', 'in', 'm', 'cm', 'yd'];
    for (const u of preferredUnits) {
      for (const p1 of pagesList) {
        const scale = state.pages[p1 - 1]?.scale;
        if (scale && scale.unit === u) return scale;
      }
    }
    for (const p1 of pagesList) {
      const scale = state.pages[p1 - 1]?.scale;
      if (scale) return scale;
    }
    return state.pages[0]?.scale ?? null;
  }

  // Annotation source shared by every builder: the app's per-canvas resolver
  // when present, else the page's legacy annotations, else an empty shape.
  function defaultGetAnnotations(page, pageIdx) {
    return (typeof window.getAnnotationsForReport === 'function' ? window.getAnnotationsForReport(page, pageIdx) : page?.annotations) || makeAnnotations();
  }

  // The one aggregation walk behind all three summary builders. Records carry
  // the superset of fields the builders need (icon/color for the HTML report,
  // runs for the report + email summary); each renderer reads what it uses.
  function collectSummaries(pageIndices, getAnn) {
    const counterSummaryByGroup = {};
    const lineTypeSummaryByGroup = {};
    // T1-05 ft/px split: each line routes its run/length/page into the feet
    // bucket (usable effective scale) or the px bucket (raw PDF-pts) — the
    // buckets are NEVER summed together. `pages` stays as the union for the
    // zero-length edge (both buckets zero), which keeps today's single
    // pickScaleForLineType row.
    const addLine = (item, lt, i, isPoly, ann) => {
      const gid = item.group || null;
      if (!lineTypeSummaryByGroup[gid]) lineTypeSummaryByGroup[gid] = {};
      if (!lineTypeSummaryByGroup[gid][lt.id]) lineTypeSummaryByGroup[gid][lt.id] = { name: lt.name, color: lt.color, runsFt: 0, runsPx: 0, lengthFt: 0, lengthPx: 0, pagesFt: [], pagesPx: [], pages: [] };
      const r = lineTypeSummaryByGroup[gid][lt.id];
      const split = typeof getLineLengthSplitForTotals === 'function'
        ? getLineLengthSplitForTotals(item, i, isPoly, ann)
        : { feet: 0, px: getLineLengthPdfPts(item, i, isPoly) * (typeof getMultiplyZoneForLine === 'function' ? getMultiplyZoneForLine(ann, item, isPoly) : 1) };
      if (split.px > 0) {
        r.runsPx++;
        r.lengthPx += split.px;
        if (!r.pagesPx.includes(i + 1)) r.pagesPx.push(i + 1);
      } else {
        r.runsFt++;
        r.lengthFt += split.feet;
        if (!r.pagesFt.includes(i + 1)) r.pagesFt.push(i + 1);
      }
      if (!r.pages.includes(i + 1)) r.pages.push(i + 1);
    };
    pageIndices.forEach((i) => {
      const page = state.pages[i];
      const ann = getAnn(page, i);
      (state.counters || []).forEach(c => {
        (ann.counterMarkers?.[c.id] || []).forEach(m => {
          const gid = m.group || null;
          if (!counterSummaryByGroup[gid]) counterSummaryByGroup[gid] = {};
          if (!counterSummaryByGroup[gid][c.id]) counterSummaryByGroup[gid][c.id] = { name: c.name, icon: c.icon, color: c.color, total: 0, pages: [] };
          const r = counterSummaryByGroup[gid][c.id];
          r.total += (typeof getMultiplyZoneForPoint === 'function' ? getMultiplyZoneForPoint(ann, m) : 1);
          if (!r.pages.includes(i + 1)) r.pages.push(i + 1);
        });
      });
      (state.lineTypes || []).forEach(lt => {
        (ann.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => addLine(q, lt, i, false, ann));
        (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => addLine(poly, lt, i, true, ann));
      });
    });
    return { counterSummaryByGroup, lineTypeSummaryByGroup };
  }

  function isUntaggedGroupId(x) {
    return x == null || x === '' || String(x) === 'null' || String(x) === 'undefined';
  }

  // Untagged last, then alphabetical by group name — the one ordering every
  // summary surface uses. getGroupName may return null for a deleted group's
  // id; treat that like Untagged for comparison purposes only.
  function orderGroupIds(counterSummaryByGroup, lineTypeSummaryByGroup, getGroupName) {
    const all = [...new Set([...Object.keys(counterSummaryByGroup), ...Object.keys(lineTypeSummaryByGroup)])];
    return all.sort((a, b) => {
      if (isUntaggedGroupId(a)) return 1;
      if (isUntaggedGroupId(b)) return -1;
      return (getGroupName(a) || 'Untagged').localeCompare(getGroupName(b) || 'Untagged');
    });
  }

  // T1-05: the report headline / group-totals length phrase. Feet and px stay
  // in separate buckets — "34.00 ft total length (+ 367 px on unscaled pages)"
  // | "367 px total length" | "34.00 ft total length" | "0 total length".
  function lengthTotalsLabel(feet, px) {
    if (feet > 0 && px > 0) return feet.toFixed(2) + ' ft total length (+ ' + Math.round(px) + ' px on unscaled pages)';
    if (px > 0) return Math.round(px) + ' px total length';
    return (feet > 0 ? feet.toFixed(2) + ' ft' : '0') + ' total length';
  }

  // The trade rollups the feature files register on window.App after this file
  // loads, resolved at call time and optional (R19: one adapter for all seven).
  // appRollup(name, fallback) is (pageIndices, getAnn) => App[name]({ pageIndices,
  // getAnnotations }), or the fallback when the feature is absent. Nothing
  // mutates a fallback, so one value serves every call.
  function appRollup(name, fallback) {
    return (pageIndices, getAnn) => ((window.App && typeof window.App[name] === 'function')
      ? window.App[name]({ pageIndices, getAnnotations: (pi) => getAnn(state.pages[pi], pi) })
      : fallback);
  }
  // Room Sizer totals (features/room-sizer.js).
  const getRoomTotals = appRollup('getRoomVolumeTotals', []);
  // Duct Schedule (features/duct-schedule.js, DUCT unit D5). null when the scope
  // holds no duct runs, so duct-free reports are byte-identical to before.
  const getDuctSchedule = appRollup('getDuctScheduleForReport', null);
  // Water Sizing (features/water-schedule.js, WATER-PLAN rung 5). null without water runs.
  const getWaterSchedule = appRollup('getWaterScheduleForReport', null);
  // Child counts (features/child-counts.js). Shape: byGroup[gid][kind][parentId]
  // -> [{ name, qty, per, ftInterval, total, excludedPxRuns }].
  const getChildTotals = appRollup('getChildCountTotals', { byGroup: {} });
  // Conductors (features/conductors.js, S3). Shape: byGroup[gid] -> { wire:
  // [{ name, feet, excludedPxRuns }], cable: [{ name, feet, source, parentId,
  // parentName, excludedPxRuns }] }. Wire rolls up ACROSS line types per group;
  // both are derived rows in feet, never px.
  const getConductorTotals = appRollup('getConductorTotals', { byGroup: {} });
  // Circuits (features/circuits.js, S4). Shape: { panels: [{ panel, circuits:
  // [...] }], crossCheck: [{ panel, onPlan, scheduled, verdict }] }.
  const getCircuitSchedule = appRollup('getCircuitSchedule', { panels: [], crossCheck: [] });
  // Bid Check (features/bid-check.js, S5). Shape: { auto: [{ id, label, verdict,
  // detail }], manual: [{ id, label, done }], open: { auto, manual, total } }.
  const getBidCheck = appRollup('getBidCheck', { auto: [], manual: [], open: { auto: 0, manual: 0, total: 0 } });
  const fmtFt = (n) => (typeof n === 'number' ? n.toFixed(2) + ' ft' : 'none');

  // D17 (J19 #4): the duct rows Copy Summary / Copy to /Tooling append under
  // a "--- Duct ---" heading — features/duct-schedule.js builds them from the
  // same schedule the report table reads (per-size LF · lb, straight total,
  // fittings total / factor, Bid weight; tab-separated). [] without duct.
  const DUCT_COPY_HEADING = '--- Duct ---';
  // WATER-PLAN rung 5: the Water Sizing rows (features/water-schedule.js) under
  // a "--- Water sizing ---" heading, the duct block's twin. [] without water runs.
  const WATER_COPY_HEADING = '--- Water sizing ---';
  // A schedule's rows or its report table, built by the feature that owns the
  // schedule (App[name](schedule, …)); no schedule or no builder, nothing.
  function appBuild(name, schedule, fallback, ...args) {
    return (schedule && window.App && typeof window.App[name] === 'function') ? window.App[name](schedule, ...args) : fallback;
  }
  const getWaterCopyRows = (pageIndices, getAnn) => appBuild('buildWaterCopyRows', getWaterSchedule(pageIndices, getAnn), []);
  const getDuctCopyRows = (pageIndices, getAnn) => appBuild('buildDuctCopyRows', getDuctSchedule(pageIndices, getAnn), []);

  // The prologue every summary builder shares (R19): the scope and annotation
  // source from the options, the group names, the aggregation walk, and the
  // child and conductor rollups over the same scope. An untagged row's group is
  // named `untaggedName`: 'Untagged' in the report and the email text, null in
  // the /Tooling text and the TakeoffTooling payload (no [Group] prefix there).
  function rollup(options, untaggedName) {
    const opts = options || {};
    const pageIndices = opts.pageIndices ?? state.pages.map((_, i) => i);
    const getAnn = opts.getAnnotations ?? defaultGetAnnotations;
    const groups = state.groups || [];
    const getGroupName = (gid) => (gid && groups.find(g => g.id === gid))?.name || untaggedName;
    const summaries = collectSummaries(pageIndices, getAnn);
    return { pageIndices, getAnn, getGroupName, summaries, childTotals: getChildTotals(pageIndices, getAnn), conductorTotals: getConductorTotals(pageIndices, getAnn) };
  }

  function childRuleLabel(r) {
    const sm = typeof window !== 'undefined' && window.SupportModel;
    return r.qty + '/' + (r.per === 'ft' ? (sm ? sm.childIntervalLabel(r) : r.ftInterval + ' ft') : r.per);
  }

  function buildReportHtml(options = {}) {
    if (!window.state || !state.pages || !state.pages.length) return '';

    const { pageIndices, getAnn, getGroupName, summaries, childTotals, conductorTotals } = rollup(options, 'Untagged');
    const { counterSummaryByGroup, lineTypeSummaryByGroup } = summaries;

    const styles = `
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; color: #000; margin: 2em; }
      .report-title { font-size: 1.5rem; font-weight: bold; margin-bottom: 1em; }
      .page-header { font-size: 1.2rem; font-weight: bold; margin: 1.5em 0 0.5em 0; }
      .section-header { font-size: 0.9rem; color: #535353; margin: 1em 0 0.5em 0; }
      .report-table { border-collapse: collapse; width: 100%; margin-bottom: 0.5em; }
      .report-table th, .report-table td { border-bottom: 1px solid #d5d5d5; padding: 8px 12px; text-align: left; }
      .report-table th { font-weight: bold; }
      .report-type-cell { display: flex; align-items: center; gap: 8px; }
      .report-type-cell .report-type-icon svg { width: 20px; height: 20px; flex-shrink: 0; }
      .report-type-cell .report-type-swatch { width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; border: 1px solid #ccc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @media print { .report-type-swatch { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      section { margin-bottom: 2em; }
      .report-date { margin: -0.4em 0 0.9em 0; font-size: 0.85rem; color: #535353; }
      .report-totals { margin-bottom: 1.5em; padding-bottom: 1em; border-bottom: 1px solid #e0e0e0; font-size: 0.9rem; color: #535353; }
      .report-group-totals { margin: 0.25em 0 0.5em 0; font-size: 0.85rem; color: #535353; }
    `;

    // The report says whose takeoff it is and when: "Main St Restaurant Takeoff Report" over a
    // date line. An unnamed project keeps the plain title.
    const title = escapeHtml(reportTitleFor(state.currentProjectName));
    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + title + '</title><style>' + styles + '</style></head><body>';
    html += '<h1 class="report-title">' + title + '</h1>';
    html += '<p class="report-date">' + escapeHtml(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })) + '</p>';

    const orderedGroupIds = orderGroupIds(counterSummaryByGroup, lineTypeSummaryByGroup, getGroupName);

    let totalCounters = 0;
    let totalLineRuns = 0;
    let totalLengthFt = 0;
    let totalLengthPx = 0;
    orderedGroupIds.forEach(gid => {
      const counters = counterSummaryByGroup[gid] || {};
      const lines = lineTypeSummaryByGroup[gid] || {};
      Object.values(counters).forEach(r => { totalCounters += r.total; });
      Object.values(lines).forEach(r => {
        totalLineRuns += r.runsFt + r.runsPx;
        totalLengthFt += r.lengthFt;
        totalLengthPx += r.lengthPx;
      });
    });
    if (totalCounters > 0 || totalLineRuns > 0) {
      const parts = [];
      if (totalCounters > 0) parts.push(totalCounters + ' counter' + (totalCounters !== 1 ? 's' : ''));
      if (totalLineRuns > 0) parts.push(totalLineRuns + ' line run' + (totalLineRuns !== 1 ? 's' : ''));
      if (totalLineRuns > 0) parts.push(lengthTotalsLabel(totalLengthFt, totalLengthPx));
      html += '<p class="report-totals">' + escapeHtml(parts.join(' · ')) + '</p>';
    }

    pageIndices.forEach((idx) => {
      const page = state.pages[idx];
      const i = idx;
      const ann = getAnn(page, i);
      html += '<section>';
      html += '<h2 class="page-header">' + escapeHtml(pageHeadingFor(page.label, i)) + '</h2>';

      const counterRows = [];
      (state.counters || []).forEach(c => {
        const markers = ann.counterMarkers?.[c.id] || [];
        if (markers.length > 0) {
          const count = markers.reduce((s, m) => s + (typeof getMultiplyZoneForPoint === 'function' ? getMultiplyZoneForPoint(ann, m) : 1), 0);
          counterRows.push({ type: c.name, count, icon: c.icon, color: c.color });
        }
      });
      if (counterRows.length > 0) {
        html += '<h3 class="section-header">Counters</h3>';
        html += '<table class="report-table"><tr><th>Type</th><th>Count</th></tr>';
        counterRows.forEach(r => {
          const iconHtml = r.icon ? renderIconHtml(r.icon, r.color || '#e8c547') : '';
          html += '<tr><td class="report-type-cell"><span class="report-type-icon">' + iconHtml + '</span><span>' + escapeHtml(r.type) + '</span></td><td>' + escapeHtml(r.count) + '</td></tr>';   // XSS-COLOR sweep: a count sums zone multipliers, which ride a project
        });
        html += '</table>';
      }

      const lineTypeRows = [];
      (state.lineTypes || []).forEach(lt => {
        let runs = 0;
        let len = 0;
        (ann.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => {
          runs++;
          len += typeof getLineLengthFeetForTotals === 'function' ? getLineLengthFeetForTotals(q, i, false, ann) : (getLineLengthPdfPts(q, i, false) * (typeof getMultiplyZoneForLine === 'function' ? getMultiplyZoneForLine(ann, q, false) : 1));
        });
        (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
          runs++;
          len += typeof getLineLengthFeetForTotals === 'function' ? getLineLengthFeetForTotals(poly, i, true, ann) : (getLineLengthPdfPts(poly, i, true) * (typeof getMultiplyZoneForLine === 'function' ? getMultiplyZoneForLine(ann, poly, true) : 1));
        });
        if (runs > 0) {
          lineTypeRows.push({ type: lt.name, runs, length: page.scale ? len.toFixed(2) + ' ft' : (len > 0 ? Math.round(len) + ' px' : '0'), color: lt.color });
        }
      });
      if (lineTypeRows.length > 0) {
        html += '<h3 class="section-header">Line Types</h3>';
        html += '<table class="report-table"><tr><th>Type</th><th>Runs</th><th>Length</th></tr>';
        lineTypeRows.forEach(r => {
          const swatchStyle = r.color ? 'background:' + escapeHtml(r.color) + ';' : 'background:#4a9eff;';   // XSS-COLOR: a line type's color rides a project; attribute text
          html += '<tr><td class="report-type-cell"><span class="report-type-swatch" style="' + swatchStyle + '"></span><span>' + escapeHtml(r.type) + '</span></td><td>' + escapeHtml(r.runs) + '</td><td>' + escapeHtml(r.length) + '</td></tr>';
        });
        html += '</table>';
      }

      const notes = ann.notes || [];
      if (notes.length > 0) {
        html += '<h3 class="section-header">Notes</h3>';
        html += '<ul>';
        notes.forEach(n => {
          html += '<li>' + escapeHtml(n.text) + '</li>';
        });
        html += '</ul>';
      }

      html += '</section>';
    });

    html += '<section>';
    html += '<h2 class="page-header">Summary</h2>';
    const roomTotals = getRoomTotals(pageIndices, getAnn);
    const ductSchedule = getDuctSchedule(pageIndices, getAnn);
    const waterSchedule = getWaterSchedule(pageIndices, getAnn);
    const hasSummary = orderedGroupIds.length > 0 || roomTotals.length > 0 || !!ductSchedule || !!waterSchedule || getCircuitSchedule(pageIndices, getAnn).panels.length > 0 || getBidCheck(pageIndices, getAnn).auto.length > 0;
    let anyPxSummaryRow = false;
    if (orderedGroupIds.length > 0) {
      orderedGroupIds.forEach(gid => {
        const groupName = getGroupName(gid);
        const counters = counterSummaryByGroup[gid] || {};
        const lines = lineTypeSummaryByGroup[gid] || {};
        const hasItems = Object.keys(counters).length > 0 || Object.keys(lines).length > 0;
        if (!hasItems) return;
        html += '<h3 class="section-header">' + escapeHtml(groupName) + '</h3>';
        const groupTotalCounters = Object.values(counters).reduce((s, r) => s + r.total, 0);
        const groupTotalRuns = Object.values(lines).reduce((s, r) => s + r.runsFt + r.runsPx, 0);
        const groupTotalFt = Object.values(lines).reduce((s, r) => s + r.lengthFt, 0);
        const groupTotalPx = Object.values(lines).reduce((s, r) => s + r.lengthPx, 0);
        const groupParts = [];
        if (groupTotalCounters > 0) groupParts.push(groupTotalCounters + ' counter' + (groupTotalCounters !== 1 ? 's' : ''));
        if (groupTotalRuns > 0) groupParts.push(groupTotalRuns + ' line run' + (groupTotalRuns !== 1 ? 's' : ''));
        if (groupTotalRuns > 0) groupParts.push(lengthTotalsLabel(groupTotalFt, groupTotalPx));
        if (groupParts.length > 0) html += '<p class="report-group-totals">' + escapeHtml(groupParts.join(' · ')) + '</p>';
        html += '<table class="report-table"><tr><th>Item</th><th>Total</th><th>Pages</th></tr>';
        // Child counts: indented, words-only rows under their parent — separate
        // per parent (the name merge happens only in the PipeTooling export).
        const childRow = (r, parentPages) =>
          '<tr><td style="padding-left:36px;color:#535353;">↳ ' + escapeHtml(r.name) + ' <span style="color:#999;">(' + escapeHtml(childRuleLabel(r)) + ')' + (r.excludedPxRuns ? ' *' : '') + '</span></td><td>' + escapeHtml(r.total) + '</td><td>' + escapeHtml(parentPages.join(', ')) + '</td></tr>';
        const groupChildren = childTotals.byGroup?.[gid] || {};
        let anyChildPxExcluded = false;
        (state.counters || []).forEach(c => {
          const r = counters[c.id];
          if (r) {
            const iconHtml = r.icon ? renderIconHtml(r.icon, r.color || '#e8c547') : '';
            html += '<tr><td class="report-type-cell"><span class="report-type-icon">' + iconHtml + '</span><span>' + escapeHtml(r.name) + '</span></td><td>' + escapeHtml(r.total) + '</td><td>' + escapeHtml(r.pages.join(', ')) + '</td></tr>';   // XSS-COLOR sweep: a total sums zone multipliers, which ride a project
            (groupChildren.counter?.[c.id] || []).forEach(cr => { html += childRow(cr, r.pages); if (cr.excludedPxRuns) anyChildPxExcluded = true; });
          }
        });
        (state.lineTypes || []).forEach(lt => {
          const r = lines[lt.id];
          if (r) {
            const swatchStyle = r.color ? 'background:' + escapeHtml(r.color) + ';' : 'background:#4a9eff;';   // XSS-COLOR: a line type's color rides a project; attribute text
            const row = (unit, num, pagesList) => '<tr><td class="report-type-cell"><span class="report-type-swatch" style="' + swatchStyle + '"></span><span>' + escapeHtml(unit + ' of ' + r.name) + '</span></td><td>' + escapeHtml(num) + '</td><td>' + escapeHtml(pagesList.join(', ')) + '</td></tr>';
            // T1-05 split rows: up to one ft row + one px row per line type —
            // px lengths are never summed under a ft label.
            if (r.lengthFt > 0) html += row('ft', r.lengthFt.toFixed(2), r.pagesFt);
            if (r.lengthPx > 0) { html += row('px', String(Math.round(r.lengthPx)), r.pagesPx); anyPxSummaryRow = true; }
            if (r.lengthFt === 0 && r.lengthPx === 0) {
              // Zero-length edge: keep today's single pickScaleForLineType row.
              const scale = pickScaleForLineType(r.pages);
              html += row(scale ? 'ft' : 'px', scale ? '0.00' : '0', r.pages);
            }
            (groupChildren.lineType?.[lt.id] || []).forEach(cr => { html += childRow(cr, r.pages); if (cr.excludedPxRuns) anyChildPxExcluded = true; });
          }
        });
        // S3 derived rows: cable per line type / counter, then wire by gauge
        // rolled up across the group's runs. Feet only — px runs are flagged.
        const derived = conductorTotals.byGroup?.[gid];
        if (derived && (derived.cable.length || derived.wire.length)) {
          const derivedRow = (label, r) =>
            '<tr><td style="padding-left:36px;color:#535353;">⚡ ' + escapeHtml(r.name) + ' <span style="color:#999;">(' + label + (r.excludedPxRuns ? ' *' : '') + ')</span></td><td>' + r.feet.toFixed(2) + ' ft</td><td></td></tr>';
          derived.cable.forEach(r => { html += derivedRow(r.source === 'counter' ? 'cable · ' + escapeHtml(r.parentName) : 'cable', r); if (r.excludedPxRuns) anyChildPxExcluded = true; });
          derived.wire.forEach(r => { html += derivedRow('wire', r); if (r.excludedPxRuns) anyChildPxExcluded = true; });
        }
        html += '</table>';
        if (anyChildPxExcluded) {
          html += '<p class="report-group-totals">* per-ft child counts exclude runs on pages without a scale.</p>';
        }
      });
      if (anyPxSummaryRow) {
        html += '<p class="report-group-totals">* px rows are runs on pages without a scale. Set the scale to include them in feet.</p>';
      }
    }
    // S4 Circuit schedule: per panel, each circuit with its devices, conduit /
    // homerun / wire feet and the farthest device; then the panel cross-check.
    const circuitSchedule = getCircuitSchedule(pageIndices, getAnn);
    if (circuitSchedule.panels.length > 0) {
      html += '<h3 class="section-header">Circuit schedule</h3>';
      circuitSchedule.panels.forEach(p => {
        const check = circuitSchedule.crossCheck.find(c => c.panel.toUpperCase() === p.panel.toUpperCase());
        const checkText = check ? (check.onPlan + ' circuit' + (check.onPlan === 1 ? '' : 's') + ' on plan' + (check.scheduled != null ? ' · ' + check.scheduled + ' scheduled ' + (check.verdict === 'match' ? '✓' : '⚠') : '')) : '';
        html += '<p class="report-group-totals"><strong>' + escapeHtml(p.panel === '—' ? 'No panel' : 'Panel ' + p.panel) + '</strong>' + (checkText ? ' · ' + escapeHtml(checkText) : '') + '</p>';
        html += '<table class="report-table"><tr><th>Circuit</th><th>Devices</th><th>Conduit</th><th>Homerun</th><th>Wire</th><th>Farthest device</th></tr>';
        p.circuits.forEach(c => {
          const devices = c.devices.map(d => escapeHtml(d.count) + ' × ' + escapeHtml(d.name)).join(', ') || 'none';
          const far = c.farthestFt != null ? c.farthestFt.toFixed(0) + ' ft' + (c.farthestFrom === 'homerun' ? ' (from the homerun)' : '') : 'none';
          html += '<tr><td>' + escapeHtml((c.circuit ? 'Ckt ' + c.circuit + ' · ' : '') + c.group) + (c.loadAmps ? ' <span style="color:#999;">' + escapeHtml(c.loadAmps) + ' A</span>' : '')   /* XSS-COLOR sweep: a circuit's load rides a project */ + '</td><td>' + devices + '</td><td>' + fmtFt(c.conduitFt) + '</td><td>' + fmtFt(c.homerunFt) + '</td><td>' + fmtFt(c.wireFt) + '</td><td>' + far + (c.devicesOffRuns ? ' <span style="color:#999;">(' + c.devicesOffRuns + ' not on a run)</span>' : '') + '</td></tr>';
        });
        html += '</table>';
      });
    }
    // S5 Bid Check: the auto verdicts with their work, then the manual ticks.
    const bidCheck = getBidCheck(pageIndices, getAnn);
    if (bidCheck.auto.length || bidCheck.manual.some(r => r.done)) {
      html += '<h3 class="section-header">Bid Check</h3>';
      html += '<p class="report-group-totals">' + escapeHtml(bidCheck.open.total + ' open item' + (bidCheck.open.total === 1 ? '' : 's') + ' · ' + bidCheck.open.auto + ' from the checks, ' + bidCheck.open.manual + ' unticked') + '</p>';
      html += '<table class="report-table"><tr><th>Check</th><th>Verdict</th><th>Detail</th></tr>';
      bidCheck.auto.forEach(r => {
        const mark = r.verdict === 'ok' ? '✓' : r.verdict === 'warn' ? '⚠' : 'n/a';
        html += '<tr><td>' + escapeHtml(r.label) + ' <span style="color:#999;">(auto)</span></td><td>' + mark + '</td><td style="color:#535353;">' + escapeHtml(r.detail) + '</td></tr>';
      });
      bidCheck.manual.forEach(r => {
        html += '<tr><td>' + escapeHtml(r.label) + '</td><td>' + (r.done ? '☑' : '☐') + '</td><td></td></tr>';
      });
      html += '</table>';
    }
    if (roomTotals.length > 0) {
      html += '<h3 class="section-header">Room Volumes</h3>';
      html += '<table class="report-table"><tr><th>Room</th><th>Area (ft²)</th><th>Volume (ft³)</th><th>Pages</th></tr>';
      roomTotals.forEach(t => {
        const pagesStr = [...new Set(t.boxes.map(b => b.pageIdx + 1))].sort((a, b) => a - b).join(', ');
        const swatchStyle = 'background:' + escapeHtml(t.color || '#47c88e') + ';';   // XSS-COLOR: a room's color rides a project; attribute text
        html += '<tr><td class="report-type-cell"><span class="report-type-swatch" style="' + swatchStyle + '"></span><span>' + escapeHtml(t.name) + (t.missingScale ? ' *' : '') + '</span></td><td>' + t.areaSqFt.toFixed(1) + '</td><td>' + t.volumeCuFt.toFixed(1) + '</td><td>' + pagesStr + '</td></tr>';
      });
      html += '</table>';
      if (roomTotals.some(t => t.missingScale)) {
        html += '<p class="report-group-totals">* Some boxes are on pages without a scale and are excluded from the totals.</p>';
      }
    }
    // The trade schedules' tables (R19): the Duct Schedule (DUCT unit D5) and the
    // Water Sizing table (WATER-PLAN rung 5), each built by the feature that owns
    // its schedule and modal, in that modal's words, only when the scope holds its
    // runs. No builder registered, no section.
    html += appBuild('buildDuctReportHtml', ductSchedule, '', escapeHtml);
    html += appBuild('buildWaterReportHtml', waterSchedule, '', escapeHtml);
    if (!hasSummary) {
      html += '<p class="section-header">No items to summarize.</p>';
    }
    html += '</section>';

    html += '</body></html>';
    return html;
  }

  // D25 (X6 option D): the scope line a copy carries when it was made from a
  // scope menu — "Counts — <project> · every sheet · layers: Main, Gas". Only
  // when opts.scope is present: legacy callers (the bid-basis manifest, the
  // spec seams) get the text they always got.
  function scopeHeaderText(opts) {
    const sc = opts && opts.scope;
    if (!sc) return null;
    const name = (window.state && state.currentProjectName) || 'Untitled';
    const parts = ['Counts, ' + name, sc.mode === 'this-canvas' ? 'this sheet' : 'every sheet'];
    if (sc.everyLayer) parts.push('every layer');   // Everything on a layered project (2026-09-14)
    else if (Array.isArray(sc.layers) && sc.layers.length) parts.push('layers: ' + sc.layers.join(', '));
    return parts.join(' · ');
  }
  function getPipeToolingSummary(options) {
    if (!window.state || !state.pages || !state.pages.length) return '';
    const scopeLine = scopeHeaderText(options);
    const { pageIndices, getAnn, getGroupName, summaries, childTotals, conductorTotals } = rollup(options, null);
    const { counterSummaryByGroup, lineTypeSummaryByGroup } = summaries;
    const lines = [];
    // Same Untagged-last, alphabetical order as the HTML report and the email
    // summary (previously unsorted object-key order — the one surface that
    // disagreed). Untagged rows still carry no [Group] prefix.
    const orderedGroupIds = orderGroupIds(counterSummaryByGroup, lineTypeSummaryByGroup, getGroupName);
    orderedGroupIds.forEach(gid => {
      const prefix = getGroupName(gid) ? '[' + getGroupName(gid) + '] ' : '';
      const counters = counterSummaryByGroup[gid] || {};
      const lineTypes = lineTypeSummaryByGroup[gid] || {};
      // Child counts export rule: rows are INDENTED (two spaces) under the
      // parent, and the same child name across parents merges into ONE row
      // within the group — emitted under the first parent that uses the name.
      const groupChildren = childTotals.byGroup?.[gid] || {};
      const merged = new Map();   // name -> { total, ownerKey, pages:Set }
      const collectChildren = (kind, id, parentPages) => {
        (groupChildren[kind]?.[id] || []).forEach(cr => {
          let m = merged.get(cr.name);
          if (!m) { m = { total: 0, ownerKey: kind + ':' + id, pages: new Set() }; merged.set(cr.name, m); }
          m.total += cr.total;
          parentPages.forEach(p => m.pages.add(p));
        });
      };
      (state.counters || []).forEach(c => { const r = counters[c.id]; if (r) collectChildren('counter', c.id, r.pages); });
      (state.lineTypes || []).forEach(lt => { const r = lineTypes[lt.id]; if (r) collectChildren('lineType', lt.id, r.pages); });
      const emitChildrenOf = (kind, id) => {
        merged.forEach((m, name) => {
          if (m.ownerKey !== kind + ':' + id) return;
          lines.push(['  ' + prefix + name, m.total, [...m.pages].sort((a, b) => a - b).join(', ')].join('\t'));
        });
      };
      (state.counters || []).forEach(c => {
        const r = counters[c.id];
        if (r) {
          lines.push([prefix + r.name, r.total, r.pages.join(', ')].join('\t'));
          emitChildrenOf('counter', c.id);
        }
      });
      (state.lineTypes || []).forEach(lt => {
        const r = lineTypes[lt.id];
        if (r) {
          // T1-05 split rows: up to one `ft of` row + one `px of` row per line
          // type (importers already handle `px of` — fully unscaled types
          // emitted it before). px is never summed under the ft label.
          if (r.lengthFt > 0) lines.push([prefix + 'ft of ' + r.name, r.lengthFt.toFixed(2), r.pagesFt.join(', ')].join('\t'));
          if (r.lengthPx > 0) lines.push([prefix + 'px of ' + r.name, String(Math.round(r.lengthPx)), r.pagesPx.join(', ')].join('\t'));
          if (r.lengthFt === 0 && r.lengthPx === 0) {
            // Zero-length edge: keep today's single pickScaleForLineType row.
            const scale = pickScaleForLineType(r.pages);
            lines.push([prefix + (scale ? 'ft' : 'px') + ' of ' + r.name, scale ? '0.00' : '0', r.pages.join(', ')].join('\t'));
          }
          emitChildrenOf('lineType', lt.id);
        }
      });
      // S3 derived rows: `ft of <cable>` / `ft of <gauge insul>` — the same
      // prefix convention importers already read as feet.
      const derived = conductorTotals.byGroup?.[gid];
      if (derived) {
        derived.cable.filter(r => r.feet > 0).forEach(r => lines.push([prefix + 'ft of ' + r.name, r.feet.toFixed(2), ''].join('\t')));
        derived.wire.filter(r => r.feet > 0).forEach(r => lines.push([prefix + 'ft of ' + r.name, r.feet.toFixed(2), ''].join('\t')));
      }
    });
    // D17: the duct pounds ride the handoff (DUCT-PLAN's promise) — the
    // Copy Schedule rows under one heading, only when the scope has duct.
    const ductRows = getDuctCopyRows(pageIndices, getAnn);
    if (ductRows.length) {
      if (lines.length) lines.push('');
      lines.push(DUCT_COPY_HEADING);
      lines.push(...ductRows);
    }
    // WATER-PLAN rung 5: the water sizing rows ride the handoff the same way.
    const waterRows = getWaterCopyRows(pageIndices, getAnn);
    if (waterRows.length) {
      if (lines.length) lines.push('');
      lines.push(WATER_COPY_HEADING);
      lines.push(...waterRows);
    }
    if (scopeLine) lines.unshift('--- ' + scopeLine + ' ---');   // D25: framed like '--- Duct ---', which the paste parser treats as a heading
    return lines.join('\n');
  }

  // Mirror of PipeTooling's import toast (its countRowUnit kernel): read the
  // /Tooling export text BACK and bucket rows by unit from the name prefix —
  // counts (ea), `ft of` line types (ft), `px of` unscaled runs (px). The
  // view-link footer and blank lines are skipped; child rows (indented) count
  // as ea. Buckets are never summed together. Both ends of the bridge report
  // the same numbers, so an estimator can reconcile copy against import.
  // TakeoffTooling handoff — payload v2 for its `#import=` route. The same
  // aggregation as the /Tooling text, stated as facts instead of name
  // conventions: a `unit` per row (ea / ft / px — the T1-05 buckets never
  // mix), the group by name, pages, and child counts NESTED under their own
  // parent (the text export merges same-named children per group; here each
  // parent keeps its own). Zero-length line types are omitted. The plans
  // link is attached by the caller (features/output.js) — minting it is
  // async and cloud-gated. Pure over state; no DOM.
  function getTakeoffToolingPayload(options) {
    if (!window.state || !state.pages || !state.pages.length) return null;
    const { pageIndices, getAnn, getGroupName, summaries, childTotals, conductorTotals } = rollup(options, null);
    const { counterSummaryByGroup, lineTypeSummaryByGroup } = summaries;
    const round2 = (n) => Math.round(n * 100) / 100;
    const items = [];
    orderGroupIds(counterSummaryByGroup, lineTypeSummaryByGroup, getGroupName).forEach(gid => {
      const group = getGroupName(gid) || null;
      const counters = counterSummaryByGroup[gid] || {};
      const lineTypes = lineTypeSummaryByGroup[gid] || {};
      const groupChildren = childTotals.byGroup?.[gid] || {};
      const childrenOf = (kind, id) => (groupChildren[kind]?.[id] || [])
        .filter(cr => cr.total > 0)
        .map(cr => ({ description: cr.name, quantity: round2(cr.total), unit: 'ea' }));
      (state.counters || []).forEach(c => {
        const r = counters[c.id];
        if (!r) return;
        items.push({ description: c.name, quantity: round2(r.total), unit: 'ea', pages: r.pages.join(', '), group, children: childrenOf('counter', c.id) });
      });
      (state.lineTypes || []).forEach(lt => {
        const r = lineTypes[lt.id];
        if (!r) return;
        const children = childrenOf('lineType', lt.id);
        if (r.lengthFt > 0) items.push({ description: lt.name, quantity: round2(r.lengthFt), unit: 'ft', pages: r.pagesFt.join(', '), group, children });
        // per-ft children are computed on scaled runs only (T1-05), so they ride the ft row
        if (r.lengthPx > 0) items.push({ description: lt.name, quantity: Math.round(r.lengthPx), unit: 'px', pages: r.pagesPx.join(', '), group, children: r.lengthFt > 0 ? [] : children });
      });
      // S3 derived rows: wire by gauge and cable, stated as facts —
      // `derived: 'wire' | 'cable'` so the importer knows not to explode
      // conductors for them, `type: 'wire'` for TakeoffTooling's book.
      const derived = conductorTotals.byGroup?.[gid];
      if (derived) {
        derived.cable.filter(r => r.feet > 0).forEach(r => items.push({ description: r.name, quantity: round2(r.feet), unit: 'ft', pages: '', group, children: [], type: 'wire', derived: 'cable' }));
        derived.wire.filter(r => r.feet > 0).forEach(r => items.push({ description: r.name, quantity: round2(r.feet), unit: 'ft', pages: '', group, children: [], type: 'wire', derived: 'wire' }));
      }
    });
    // S4: the circuits as facts beside the rows — TakeoffTooling shows them
    // with the manifest and PipeTooling's bid notes can quote the cross-check.
    const schedule = getCircuitSchedule(pageIndices, getAnn);
    const circuits = schedule.panels.flatMap(p => p.circuits.map(c => ({ group: c.group, panel: c.panel || null, circuit: c.circuit || null, load_amps: c.loadAmps, devices: c.deviceCount, conduit_ft: c.conduitFt, homerun_ft: c.homerunFt, wire_ft: c.wireFt, farthest_ft: c.farthestFt })));
    const panels = schedule.crossCheck.map(c => ({ panel: c.panel, circuits_on_plan: c.onPlan, poles: c.scheduled, verdict: c.verdict }));
    // S5: the open Bid Check items ride as notes for the twin's report and TakeoffTooling's review lane.
    const bc = getBidCheck(pageIndices, getAnn);
    const checks = bc.auto.filter(r => r.verdict !== 'na').map(r => ({ id: r.id, verdict: r.verdict, detail: r.detail })).concat(bc.manual.map(r => ({ id: r.id, verdict: r.done ? 'done' : 'open', detail: r.label })));
    return { v: 2, source: 'counttooling', project: { name: state.currentProjectName || '', ...(state.trade ? { trade: state.trade } : {}) }, items, ...(circuits.length ? { circuits, panels } : {}), ...(bc.auto.length ? { checks } : {}) };
  }

  function summarizeToolingExport(text) {
    const out = { ea: { items: 0, total: 0 }, ft: { items: 0, total: 0 }, px: { items: 0, total: 0 } };
    if (!text) return out;
    // D17: the "--- Duct ---" block (features/duct-schedule.js rows) is its
    // own unit — never ea/ft/px; `out.duct` = { rows, bidWeightLb } only when
    // the text carries one, so duct-free summaries keep their exact shape.
    let inDuct = false;
    // WATER-PLAN rung 5: the "--- Water sizing ---" block is its own unit too —
    // `out.water` = { rows, warnings } only when the text carries one.
    let inWater = false;
    String(text).split(/\r?\n/).forEach((line) => {
      if (!line.trim()) { inDuct = false; inWater = false; return; }
      if (line.trim() === DUCT_COPY_HEADING) { inDuct = true; inWater = false; out.duct = { rows: 0, bidWeightLb: 0 }; return; }
      if (line.trim() === WATER_COPY_HEADING) { inWater = true; inDuct = false; out.water = { rows: 0, warnings: 0 }; return; }
      if (inWater) {
        const total = /^(Cold|Hot) water total\t.*\t(\d+) ⚠$/.exec(line);
        if (total) { out.water.warnings += parseInt(total[2], 10); return; }
        if (/^(Cold|Hot) water total\t|^Sized at /.test(line)) return;
        out.water.rows += 1;
        return;
      }
      // D25: the scope header ("--- Counts — <project> · every sheet · layers: … ---")
      // is a heading in the same frame, never a row — nor is any framed line.
      if (/^---\s.*\s---$/.test(line.trim())) return;
      if (inDuct) {
        out.duct.rows += 1;
        const m = /^Bid weight\t.*?([\d,]+) lb$/.exec(line);
        if (m) out.duct.bidWeightLb = parseFloat(m[1].replace(/,/g, '')) || 0;
        return;
      }
      if (/https?:\/\/\S*[?&]t=/.test(line) || /^\s*view link/i.test(line)) return;
      const cells = line.split('\t');
      const name = (cells[0] || '').trim().replace(/^\[[^\]]*\]\s*/, '');
      const value = parseFloat(cells[1]);
      const bucket = /^px\s+of\s/i.test(name) ? out.px : /^ft\s+of\s/i.test(name) ? out.ft : out.ea;
      bucket.items += 1;
      bucket.total += Number.isFinite(value) ? value : 0;
    });
    return out;
  }

  // "29 counts (1,122 ea) · 6 line types (444.74 ft) · 1 unscaled run (367 px)"
  // — empty buckets omitted; '' when nothing was exported.
  function formatToolingExportSummary(s) {
    const fmt = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const parts = [];
    if (s.ea.items) parts.push(s.ea.items + (s.ea.items === 1 ? ' count (' : ' counts (') + fmt(s.ea.total) + ' ea)');
    if (s.ft.items) parts.push(s.ft.items + (s.ft.items === 1 ? ' line type (' : ' line types (') + fmt(s.ft.total) + ' ft)');
    if (s.px.items) parts.push(s.px.items + (s.px.items === 1 ? ' unscaled run (' : ' unscaled runs (') + fmt(s.px.total) + ' px)');
    if (s.duct && s.duct.rows) parts.push('duct (' + fmt(s.duct.bidWeightLb) + ' lb bid weight)');
    if (s.water && s.water.rows) parts.push('water sizing (' + s.water.rows + (s.water.rows === 1 ? ' run' : ' runs') + (s.water.warnings ? ', ' + s.water.warnings + ' ⚠' : '') + ')');
    return parts.join(' · ');
  }

  // Cheap existence probe: would getPipeToolingSummary() be non-empty? Same
  // annotation source and same "counts or lines" rule (a marker under a defined
  // counter id, or a quick line / polyline whose lineTypeId matches a defined
  // line type), but short-circuits at the first hit instead of building the
  // whole summary. updateUI() calls this on every state change to toggle the
  // export/summary buttons — the full walk was a measurable per-call cost on
  // large multi-page projects. Deliberately EXCLUDES room boxes: the /Tooling
  // summary never emits rooms, so a rooms-only hit here would surface a button
  // that copies an empty string. Rooms have their own probe below.
  function getPipeToolingHasData() {
    if (!window.state || !state.pages || !state.pages.length) return false;
    const getAnn = defaultGetAnnotations;
    const counterIds = new Set((state.counters || []).map(c => c.id));
    const lineTypeIds = new Set((state.lineTypes || []).map(lt => lt.id));
    for (let i = 0; i < state.pages.length; i++) {
      const ann = getAnn(state.pages[i], i);
      for (const [typeId, markers] of Object.entries(ann.counterMarkers || {})) {
        if (markers && markers.length && counterIds.has(typeId)) return true;
      }
      for (const q of ann.quickLines || []) {
        if (lineTypeIds.has(q.lineTypeId)) return true;
      }
      for (const poly of ann.polylines || []) {
        if (lineTypeIds.has(poly.lineTypeId)) return true;
      }
      // D17: a duct run is copyable data too (the /Tooling text carries the
      // schedule rows), once the schedule builder has registered.
      if ((ann.ductRuns || []).length && window.App && typeof window.App.buildDuctCopyRows === 'function') return true;
    }
    return false;
  }

  // Rooms counterpart to getPipeToolingHasData: would the report's "Room
  // Volumes" table / the email summary's "--- Rooms ---" block be non-empty?
  // Any roomBoxes entry produces a row (boxes with an unknown roomId aggregate
  // into an "Unassigned" bucket), so one box existing is the whole test — but
  // only once features/room-sizer.js has registered the totals builder that
  // getRoomTotals resolves at call time; without it the renderers emit nothing.
  function getReportHasRooms() {
    if (!window.state || !state.pages || !state.pages.length) return false;
    if (!(window.App && typeof window.App.getRoomVolumeTotals === 'function')) return false;
    for (let i = 0; i < state.pages.length; i++) {
      const ann = defaultGetAnnotations(state.pages[i], i);
      if ((ann.roomBoxes || []).length) return true;
    }
    return false;
  }

  function getEmailTextSummary(options) {
    const scopeLine = scopeHeaderText(options);
    if (!window.state || !state.pages || !state.pages.length) return '';
    const { pageIndices, getAnn, getGroupName, summaries, childTotals, conductorTotals } = rollup(options, 'Untagged');
    const { counterSummaryByGroup, lineTypeSummaryByGroup } = summaries;
    const orderedGroupIds = orderGroupIds(counterSummaryByGroup, lineTypeSummaryByGroup, getGroupName);
    const lines = [];
    // The text opens with the Takeoff Summary banner whichever block comes first (R19).
    const banner = () => { if (!lines.length) lines.push('Takeoff Summary', '---------------', ''); };
    // One block after the groups: the banner when it is the first, the heading,
    // its rows, a blank line.
    const pushSection = (heading, rows) => { banner(); lines.push(heading, ...rows, ''); };
    if (orderedGroupIds.length > 0) {
      banner();
      orderedGroupIds.forEach(gid => {
        const groupName = getGroupName(gid);
        const counters = counterSummaryByGroup[gid] || {};
        const lineTypes = lineTypeSummaryByGroup[gid] || {};
        const hasItems = Object.keys(counters).length > 0 || Object.keys(lineTypes).length > 0;
        if (!hasItems) return;
        lines.push('--- ' + groupName + ' ---');
        // Child counts: indented bullets under each parent (separate per
        // parent, like the Summary — the merge is PipeTooling-only).
        const groupChildren = childTotals.byGroup?.[gid] || {};
        const childBullets = (kind, id) => {
          (groupChildren[kind]?.[id] || []).forEach(cr => {
            lines.push('   ↳ ' + cr.name + ': ' + cr.total + ' (' + childRuleLabel(cr) + (cr.excludedPxRuns ? ', some runs have no scale' : '') + ')');
          });
        };
        (state.counters || []).forEach(c => {
          const r = counters[c.id];
          if (r) {
            const pagesStr = r.pages.length === 1 ? 'page ' + r.pages[0] : 'pages ' + r.pages.join(', ');
            lines.push('• ' + (r.name || 'Counter') + ': ' + r.total + ' (' + pagesStr + ')');
            childBullets('counter', c.id);
          }
        });
        (state.lineTypes || []).forEach(lt => {
          const r = lineTypes[lt.id];
          if (r) {
            // T1-05 split bullets: one ft bullet + one px bullet per line type
            // — px lengths are never summed under a ft label.
            const bullet = (num, unit, runs, pagesArr, suffix) => {
              const pagesStr = pagesArr.length === 1 ? 'page ' + pagesArr[0] : 'pages ' + pagesArr.join(', ');
              return '• ' + num + ' ' + unit + ' of ' + (r.name || 'Line') + ': ' + runs + ' run' + (runs > 1 ? 's' : '') + ' (' + pagesStr + suffix + ')';
            };
            if (r.lengthFt > 0) lines.push(bullet(r.lengthFt.toFixed(2), 'ft', r.runsFt, r.pagesFt, ''));
            if (r.lengthPx > 0) lines.push(bullet(String(Math.round(r.lengthPx)), 'px', r.runsPx, r.pagesPx, ', no scale set'));
            if (r.lengthFt === 0 && r.lengthPx === 0) {
              // Zero-length edge: keep today's single pickScaleForLineType bullet.
              const scale = pickScaleForLineType(r.pages);
              lines.push(bullet(scale ? '0.00' : '0', scale ? 'ft' : 'px', r.runsFt + r.runsPx, r.pages, ''));
            }
            childBullets('lineType', lt.id);
          }
        });
        // S3 derived bullets: cable and wire, feet, from the group's runs
        const derived = conductorTotals.byGroup?.[gid];
        if (derived) {
          derived.cable.forEach(r => lines.push('• ' + r.feet.toFixed(2) + ' ft of ' + r.name + ' (cable' + (r.source === 'counter' ? ', ' + r.parentName : '') + (r.excludedPxRuns ? ', some runs have no scale' : '') + ')'));
          derived.wire.forEach(r => lines.push('• ' + r.feet.toFixed(2) + ' ft of ' + r.name + ' (wire' + (r.excludedPxRuns ? ', some runs have no scale' : '') + ')'));
        }
        lines.push('');
      });
    }
    const circuitSchedule = getCircuitSchedule(pageIndices, getAnn);
    if (circuitSchedule.panels.length > 0) {
      const rows = [];
      circuitSchedule.panels.forEach(p => {
        const check = circuitSchedule.crossCheck.find(c => c.panel.toUpperCase() === p.panel.toUpperCase());
        rows.push((p.panel === '—' ? 'No panel' : 'Panel ' + p.panel) + (check && check.scheduled != null ? ': ' + check.onPlan + ' circuits on plan, ' + check.scheduled + ' scheduled' + (check.verdict === 'match' ? ' ✓' : ' ⚠') : ''));
        p.circuits.forEach(c => {
          rows.push('• ' + (c.circuit ? 'Ckt ' + c.circuit + ' · ' : '') + c.group + ': ' + c.deviceCount + ' device' + (c.deviceCount === 1 ? '' : 's') + ', ' + fmtFt(c.conduitFt) + ' conduit' + (c.homerunFt ? ', ' + fmtFt(c.homerunFt) + ' homerun' : '') + (c.wireFt ? ', ' + fmtFt(c.wireFt) + ' wire' : '') + (c.farthestFt != null ? ', farthest device ' + c.farthestFt.toFixed(0) + ' ft' : ''));
        });
      });
      pushSection('--- Circuits ---', rows);
    }
    const bidCheck = getBidCheck(pageIndices, getAnn);
    // D19 (J11-I): the EMAIL block carries verdicts, not setup hints. An 'na'
    // row is the panel telling the estimator how to make the row computable
    // ("Give a room a type on its Edit Room dialog…") — useful in the panel,
    // noise in a bid email sent to someone else. They are skipped here only;
    // the panel and the report table still show them. The header count is
    // unaffected: bidCheckOpenCount already counts 'warn' rows alone.
    // The gate stays on the UNFILTERED auto list: a project that had no Bid
    // Check block in its email before must not gain one now (the manual rows
    // are per-trade defaults and are almost never empty).
    const bidAuto = bidCheck.auto.filter(r => r.verdict !== 'na');
    if (bidCheck.auto.length) {
      pushSection('--- Bid Check (' + bidCheck.open.total + ' open) ---',
        bidAuto.map(r => (r.verdict === 'ok' ? '✓ ' : '⚠ ') + r.label + ': ' + r.detail)
          .concat(bidCheck.manual.map(r => (r.done ? '☑ ' : '☐ ') + r.label)));
    }
    // D17: the duct block — the same rows the /Tooling text carries.
    const ductRows = getDuctCopyRows(pageIndices, getAnn);
    if (ductRows.length) pushSection(DUCT_COPY_HEADING, ductRows);
    // WATER-PLAN rung 5: the water sizing block.
    const waterRowsE = getWaterCopyRows(pageIndices, getAnn);
    if (waterRowsE.length) pushSection(WATER_COPY_HEADING, waterRowsE);
    const roomTotals = getRoomTotals(pageIndices, getAnn);
    if (roomTotals.length > 0) {
      pushSection('--- Rooms ---', roomTotals.map(t => {
        const pages = [...new Set(t.boxes.map(b => b.pageIdx + 1))].sort((a, b) => a - b);
        const pagesStr = pages.length === 1 ? 'page ' + pages[0] : 'pages ' + pages.join(', ');
        return '• ' + (t.name || 'Room') + ': ' + t.volumeCuFt.toFixed(1) + ' ft³ (' + t.areaSqFt.toFixed(1) + ' ft², ' + pagesStr + ')' + (t.missingScale ? ', some boxes missing scale' : '');
      }));
    }
    if (scopeLine && lines.length) { const at = lines[0] === 'Takeoff Summary' ? 2 : 0; lines.splice(at, 0, scopeLine); }   // D25
    return lines.join('\n');
  }

  function printReport(mode) {
    if (!window.state || !state.pages || !state.pages.length) {
      if (window.App && window.App.showToast) window.App.showToast('No pages loaded. Upload a PDF first.', 3000);
      return;
    }
    const defaultGetAnn = undefined;
    const mergedGetAnn = typeof window.getMergedAnnotationsForPage === 'function'
      ? (page) => window.getMergedAnnotationsForPage(page)
      : defaultGetAnn;
    let options;
    if (mode === 'this-canvas') {
      options = { pageIndices: [state.currentPage], getAnnotations: defaultGetAnn };
    } else if (mode === 'all-canvases-on-page') {
      options = { pageIndices: [state.currentPage], getAnnotations: mergedGetAnn };
    } else if (mode === 'all-pages-current-canvas') {
      options = {};
    } else if (mode === 'all-pages-canvases') {
      options = { getAnnotations: mergedGetAnn };
    } else {
      options = {};
    }
    const html = buildReportHtml(options);
    const w = window.open('', '_blank');
    if (!w) {
      if (window.App && window.App.showToast) window.App.showToast('Popup blocked. Allow popups for this site and try again.', 5000);
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.buildReportHtml = buildReportHtml;
    window.printReport = printReport;
    window.getPipeToolingSummary = getPipeToolingSummary;
    window.getTakeoffToolingPayload = getTakeoffToolingPayload;
    window.getPipeToolingHasData = getPipeToolingHasData;
    window.summarizeToolingExport = summarizeToolingExport;
    window.formatToolingExportSummary = formatToolingExportSummary;
    window.getReportHasRooms = getReportHasRooms;
    window.getEmailTextSummary = getEmailTextSummary;
  }

  // Node test harness only: inert in the browser (where `module` is undefined).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml, pickScaleForLineType, reportTitleFor, pageHeadingFor, orderGroupIds, isUntaggedGroupId, collectSummaries, summarizeToolingExport, formatToolingExportSummary };
  }
})();
