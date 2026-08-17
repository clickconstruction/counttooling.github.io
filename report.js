/**
 * ClickCount Print Report
 * Uses globals: state, makeAnnotations, ptDist, polylineDistance, formatDist, renderIconHtml, getLineLengthPdfPts, getLineLengthFeetForTotals (per-line tally lengths in feet), getLineLengthSplitForTotals (ft/px split rollups — px never summed under a ft label), getLineRealWorldLength, getMultiplyZoneForPoint, getMultiplyZoneForLine
 */
(function() {
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

  // Room Sizer totals (features/room-sizer.js registers this on window.App
  // after this file loads; resolved at call time, optional).
  function getRoomTotals(pageIndices, getAnn) {
    return (window.App && typeof window.App.getRoomVolumeTotals === 'function')
      ? window.App.getRoomVolumeTotals({ pageIndices, getAnnotations: (pi) => getAnn(state.pages[pi], pi) })
      : [];
  }

  // Child counts (features/child-counts.js registers this on window.App after
  // this file loads; resolved at call time, optional). Shape:
  // byGroup[gid][kind][parentId] -> [{ name, qty, per, ftInterval, total,
  // excludedPxRuns }].
  function getChildTotals(pageIndices, getAnn) {
    return (window.App && typeof window.App.getChildCountTotals === 'function')
      ? window.App.getChildCountTotals({ pageIndices, getAnnotations: (pi) => getAnn(state.pages[pi], pi) })
      : { byGroup: {} };
  }

  function childRuleLabel(r) {
    return r.qty + '/' + (r.per === 'ft' ? r.ftInterval + ' ft' : r.per);
  }

  function buildReportHtml(options = {}) {
    if (!window.state || !state.pages || !state.pages.length) return '';

    const pageIndices = options.pageIndices ?? state.pages.map((_, i) => i);
    const getAnn = options.getAnnotations ?? defaultGetAnnotations;

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
      .report-totals { margin-bottom: 1.5em; padding-bottom: 1em; border-bottom: 1px solid #e0e0e0; font-size: 0.9rem; color: #535353; }
      .report-group-totals { margin: 0.25em 0 0.5em 0; font-size: 0.85rem; color: #535353; }
    `;

    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Takeoff Report</title><style>' + styles + '</style></head><body>';
    html += '<h1 class="report-title">Takeoff Report</h1>';

    const groups = state.groups || [];
    const getGroupName = (gid) => (gid && groups.find(g => g.id === gid))?.name || 'Untagged';

    const { counterSummaryByGroup, lineTypeSummaryByGroup } = collectSummaries(pageIndices, getAnn);
    const orderedGroupIds = orderGroupIds(counterSummaryByGroup, lineTypeSummaryByGroup, getGroupName);
    const childTotals = getChildTotals(pageIndices, getAnn);

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
      const label = escapeHtml(page.label || 'Page ' + (i + 1));
      html += '<section>';
      html += '<h2 class="page-header">Page ' + (i + 1) + ': ' + label + '</h2>';

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
          html += '<tr><td class="report-type-cell"><span class="report-type-icon">' + iconHtml + '</span><span>' + escapeHtml(r.type) + '</span></td><td>' + r.count + '</td></tr>';
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
          const swatchStyle = r.color ? 'background:' + r.color + ';' : 'background:#4a9eff;';
          html += '<tr><td class="report-type-cell"><span class="report-type-swatch" style="' + swatchStyle + '"></span><span>' + escapeHtml(r.type) + '</span></td><td>' + r.runs + '</td><td>' + r.length + '</td></tr>';
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
    const hasSummary = orderedGroupIds.length > 0 || roomTotals.length > 0;
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
          '<tr><td style="padding-left:36px;color:#535353;">↳ ' + escapeHtml(r.name) + ' <span style="color:#999;">(' + escapeHtml(childRuleLabel(r)) + ')' + (r.excludedPxRuns ? ' *' : '') + '</span></td><td>' + r.total + '</td><td>' + parentPages.join(', ') + '</td></tr>';
        const groupChildren = childTotals.byGroup?.[gid] || {};
        let anyChildPxExcluded = false;
        (state.counters || []).forEach(c => {
          const r = counters[c.id];
          if (r) {
            const iconHtml = r.icon ? renderIconHtml(r.icon, r.color || '#e8c547') : '';
            html += '<tr><td class="report-type-cell"><span class="report-type-icon">' + iconHtml + '</span><span>' + escapeHtml(r.name) + '</span></td><td>' + r.total + '</td><td>' + r.pages.join(', ') + '</td></tr>';
            (groupChildren.counter?.[c.id] || []).forEach(cr => { html += childRow(cr, r.pages); if (cr.excludedPxRuns) anyChildPxExcluded = true; });
          }
        });
        (state.lineTypes || []).forEach(lt => {
          const r = lines[lt.id];
          if (r) {
            const swatchStyle = r.color ? 'background:' + r.color + ';' : 'background:#4a9eff;';
            const row = (unit, num, pagesList) => '<tr><td class="report-type-cell"><span class="report-type-swatch" style="' + swatchStyle + '"></span><span>' + escapeHtml(unit + ' of ' + r.name) + '</span></td><td>' + num + '</td><td>' + pagesList.join(', ') + '</td></tr>';
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
        html += '</table>';
        if (anyChildPxExcluded) {
          html += '<p class="report-group-totals">* per-ft child counts exclude runs on pages without a scale.</p>';
        }
      });
      if (anyPxSummaryRow) {
        html += '<p class="report-group-totals">* px rows are runs on pages without a scale — set the scale to include them in feet.</p>';
      }
    }
    if (roomTotals.length > 0) {
      html += '<h3 class="section-header">Room Volumes</h3>';
      html += '<table class="report-table"><tr><th>Room</th><th>Area (ft²)</th><th>Volume (ft³)</th><th>Pages</th></tr>';
      roomTotals.forEach(t => {
        const pagesStr = [...new Set(t.boxes.map(b => b.pageIdx + 1))].sort((a, b) => a - b).join(', ');
        const swatchStyle = 'background:' + (t.color || '#47c88e') + ';';
        html += '<tr><td class="report-type-cell"><span class="report-type-swatch" style="' + swatchStyle + '"></span><span>' + escapeHtml(t.name) + (t.missingScale ? ' *' : '') + '</span></td><td>' + t.areaSqFt.toFixed(1) + '</td><td>' + t.volumeCuFt.toFixed(1) + '</td><td>' + pagesStr + '</td></tr>';
      });
      html += '</table>';
      if (roomTotals.some(t => t.missingScale)) {
        html += '<p class="report-group-totals">* Some boxes are on pages without a scale and are excluded from the totals.</p>';
      }
    }
    if (!hasSummary) {
      html += '<p class="section-header">No items to summarize.</p>';
    }
    html += '</section>';

    html += '</body></html>';
    return html;
  }

  function getPipeToolingSummary(options) {
    if (!window.state || !state.pages || !state.pages.length) return '';
    const opts = options || {};
    const pageIndices = opts.pageIndices ?? state.pages.map((_, i) => i);
    const getAnn = opts.getAnnotations ?? defaultGetAnnotations;
    const groups = state.groups || [];
    const getGroupName = (gid) => (gid && groups.find(g => g.id === gid))?.name || null;
    const { counterSummaryByGroup, lineTypeSummaryByGroup } = collectSummaries(pageIndices, getAnn);
    const childTotals = getChildTotals(pageIndices, getAnn);
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
    });
    return lines.join('\n');
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
    if (!window.state || !state.pages || !state.pages.length) return '';
    const opts = options || {};
    const pageIndices = opts.pageIndices ?? state.pages.map((_, i) => i);
    const getAnn = opts.getAnnotations ?? defaultGetAnnotations;
    const groups = state.groups || [];
    const getGroupName = (gid) => (gid && groups.find(g => g.id === gid))?.name || 'Untagged';
    const { counterSummaryByGroup, lineTypeSummaryByGroup } = collectSummaries(pageIndices, getAnn);
    const childTotals = getChildTotals(pageIndices, getAnn);
    const orderedGroupIds = orderGroupIds(counterSummaryByGroup, lineTypeSummaryByGroup, getGroupName);
    const lines = [];
    if (orderedGroupIds.length > 0) {
      lines.push('Takeoff Summary');
      lines.push('---------------');
      lines.push('');
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
            lines.push('   ↳ ' + cr.name + ': ' + cr.total + ' (' + childRuleLabel(cr) + (cr.excludedPxRuns ? ' — some runs have no scale' : '') + ')');
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
            if (r.lengthPx > 0) lines.push(bullet(String(Math.round(r.lengthPx)), 'px', r.runsPx, r.pagesPx, ' — no scale set'));
            if (r.lengthFt === 0 && r.lengthPx === 0) {
              // Zero-length edge: keep today's single pickScaleForLineType bullet.
              const scale = pickScaleForLineType(r.pages);
              lines.push(bullet(scale ? '0.00' : '0', scale ? 'ft' : 'px', r.runsFt + r.runsPx, r.pages, ''));
            }
            childBullets('lineType', lt.id);
          }
        });
        lines.push('');
      });
    }
    const roomTotals = getRoomTotals(pageIndices, getAnn);
    if (roomTotals.length > 0) {
      if (!lines.length) {
        lines.push('Takeoff Summary');
        lines.push('---------------');
        lines.push('');
      }
      lines.push('--- Rooms ---');
      roomTotals.forEach(t => {
        const pages = [...new Set(t.boxes.map(b => b.pageIdx + 1))].sort((a, b) => a - b);
        const pagesStr = pages.length === 1 ? 'page ' + pages[0] : 'pages ' + pages.join(', ');
        lines.push('• ' + (t.name || 'Room') + ': ' + t.volumeCuFt.toFixed(1) + ' ft³ (' + t.areaSqFt.toFixed(1) + ' ft², ' + pagesStr + ')' + (t.missingScale ? ' — some boxes missing scale' : ''));
      });
      lines.push('');
    }
    return lines.join('\n');
  }

  function printReport(mode) {
    if (!window.state || !state.pages || !state.pages.length) {
      alert('No pages loaded. Upload a PDF first.');
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
      alert('Popup blocked. Please allow popups for this site.');
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
    window.getPipeToolingHasData = getPipeToolingHasData;
    window.getReportHasRooms = getReportHasRooms;
    window.getEmailTextSummary = getEmailTextSummary;
  }

  // Node test harness only: inert in the browser (where `module` is undefined).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml, pickScaleForLineType, orderGroupIds, isUntaggedGroupId, collectSummaries };
  }
})();
