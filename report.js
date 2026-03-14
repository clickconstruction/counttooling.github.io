/**
 * ClickCount Print Report
 * Uses globals: state, makeAnnotations, ptDist, polylineDistance, formatDist, renderIconHtml, getLineLengthPdfPts
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

  function buildReportHtml() {
    if (!window.state || !state.pages || !state.pages.length) return '';

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

    const counterSummaryByGroup = {};
    const lineTypeSummaryByGroup = {};
    state.pages.forEach((page, i) => {
      const ann = (typeof window.getAnnotationsForReport === 'function' ? window.getAnnotationsForReport(page) : page.annotations) || makeAnnotations();
      (state.counters || []).forEach(c => {
        const markers = (ann.counterMarkers?.[c.id] || []).filter(m => true);
        markers.forEach(m => {
          const gid = m.group || null;
          if (!counterSummaryByGroup[gid]) counterSummaryByGroup[gid] = {};
          if (!counterSummaryByGroup[gid][c.id]) counterSummaryByGroup[gid][c.id] = { name: c.name, icon: c.icon, color: c.color, total: 0, pages: [] };
          counterSummaryByGroup[gid][c.id].total++;
          if (!counterSummaryByGroup[gid][c.id].pages.includes(i + 1)) counterSummaryByGroup[gid][c.id].pages.push(i + 1);
        });
      });
      (state.lineTypes || []).forEach(lt => {
        (ann.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => {
          const gid = q.group || null;
          if (!lineTypeSummaryByGroup[gid]) lineTypeSummaryByGroup[gid] = {};
          if (!lineTypeSummaryByGroup[gid][lt.id]) lineTypeSummaryByGroup[gid][lt.id] = { name: lt.name, color: lt.color, runs: 0, lengthPdfPts: 0, pages: [] };
          lineTypeSummaryByGroup[gid][lt.id].runs++;
          lineTypeSummaryByGroup[gid][lt.id].lengthPdfPts += getLineLengthPdfPts(q, i, false);
          if (!lineTypeSummaryByGroup[gid][lt.id].pages.includes(i + 1)) lineTypeSummaryByGroup[gid][lt.id].pages.push(i + 1);
        });
        (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
          const gid = poly.group || null;
          if (!lineTypeSummaryByGroup[gid]) lineTypeSummaryByGroup[gid] = {};
          if (!lineTypeSummaryByGroup[gid][lt.id]) lineTypeSummaryByGroup[gid][lt.id] = { name: lt.name, color: lt.color, runs: 0, lengthPdfPts: 0, pages: [] };
          lineTypeSummaryByGroup[gid][lt.id].runs++;
          lineTypeSummaryByGroup[gid][lt.id].lengthPdfPts += getLineLengthPdfPts(poly, i, true);
          if (!lineTypeSummaryByGroup[gid][lt.id].pages.includes(i + 1)) lineTypeSummaryByGroup[gid][lt.id].pages.push(i + 1);
        });
      });
    });

    const allGroupIds = [...new Set([...Object.keys(counterSummaryByGroup), ...Object.keys(lineTypeSummaryByGroup)])];
    const orderedGroupIds = allGroupIds.sort((a, b) => {
      const isUntagged = (x) => x == null || x === '' || String(x) === 'null' || String(x) === 'undefined';
      if (isUntagged(a)) return 1;
      if (isUntagged(b)) return -1;
      const na = getGroupName(a);
      const nb = getGroupName(b);
      return na.localeCompare(nb);
    });

    let totalCounters = 0;
    let totalLineRuns = 0;
    let totalLengthPdfPts = 0;
    const allPagesWithLines = [];
    orderedGroupIds.forEach(gid => {
      const counters = counterSummaryByGroup[gid] || {};
      const lines = lineTypeSummaryByGroup[gid] || {};
      Object.values(counters).forEach(r => { totalCounters += r.total; });
      Object.values(lines).forEach(r => {
        totalLineRuns += r.runs;
        totalLengthPdfPts += r.lengthPdfPts;
        r.pages.forEach(p => { if (!allPagesWithLines.includes(p)) allPagesWithLines.push(p); });
      });
    });
    const scale = pickScaleForLineType(allPagesWithLines.length ? allPagesWithLines : state.pages.map((_, i) => i + 1));
    const totalLengthStr = scale
      ? (totalLengthPdfPts / scale.pixelsPerUnit).toFixed(2) + ' ' + scale.unit
      : (totalLengthPdfPts > 0 ? Math.round(totalLengthPdfPts) + ' px' : '0');

    if (totalCounters > 0 || totalLineRuns > 0) {
      const parts = [];
      if (totalCounters > 0) parts.push(totalCounters + ' counter' + (totalCounters !== 1 ? 's' : ''));
      if (totalLineRuns > 0) parts.push(totalLineRuns + ' line run' + (totalLineRuns !== 1 ? 's' : ''));
      if (totalLineRuns > 0) parts.push(totalLengthStr + ' total length');
      html += '<p class="report-totals">' + escapeHtml(parts.join(' · ')) + '</p>';
    }

    state.pages.forEach((page, i) => {
      const ann = (typeof window.getAnnotationsForReport === 'function' ? window.getAnnotationsForReport(page) : page.annotations) || makeAnnotations();
      const label = escapeHtml(page.label || 'Page ' + (i + 1));
      html += '<section>';
      html += '<h2 class="page-header">Page ' + (i + 1) + ': ' + label + '</h2>';

      const counterRows = [];
      (state.counters || []).forEach(c => {
        const markers = ann.counterMarkers?.[c.id] || [];
        if (markers.length > 0) {
          counterRows.push({ type: c.name, count: markers.length, icon: c.icon, color: c.color });
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
          len += getLineLengthPdfPts(q, i, false);
        });
        (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
          runs++;
          len += getLineLengthPdfPts(poly, i, true);
        });
        if (runs > 0) {
          lineTypeRows.push({ type: lt.name, runs, length: formatDist(len, page.scale), color: lt.color });
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
    const hasSummary = orderedGroupIds.length > 0;
    if (hasSummary) {
      orderedGroupIds.forEach(gid => {
        const groupName = getGroupName(gid);
        const counters = counterSummaryByGroup[gid] || {};
        const lines = lineTypeSummaryByGroup[gid] || {};
        const hasItems = Object.keys(counters).length > 0 || Object.keys(lines).length > 0;
        if (!hasItems) return;
        html += '<h3 class="section-header">' + escapeHtml(groupName) + '</h3>';
        const groupTotalCounters = Object.values(counters).reduce((s, r) => s + r.total, 0);
        const groupTotalRuns = Object.values(lines).reduce((s, r) => s + r.runs, 0);
        const groupTotalPdfPts = Object.values(lines).reduce((s, r) => s + r.lengthPdfPts, 0);
        const groupPages = [...new Set([...Object.values(counters).flatMap(r => r.pages), ...Object.values(lines).flatMap(r => r.pages)])];
        const groupScale = pickScaleForLineType(groupPages);
        const groupLengthStr = groupScale ? (groupTotalPdfPts / groupScale.pixelsPerUnit).toFixed(2) + ' ' + groupScale.unit : (groupTotalPdfPts > 0 ? Math.round(groupTotalPdfPts) + ' px' : '0');
        const groupParts = [];
        if (groupTotalCounters > 0) groupParts.push(groupTotalCounters + ' counter' + (groupTotalCounters !== 1 ? 's' : ''));
        if (groupTotalRuns > 0) groupParts.push(groupTotalRuns + ' line run' + (groupTotalRuns !== 1 ? 's' : ''));
        if (groupTotalRuns > 0) groupParts.push(groupLengthStr + ' total length');
        if (groupParts.length > 0) html += '<p class="report-group-totals">' + escapeHtml(groupParts.join(' · ')) + '</p>';
        html += '<table class="report-table"><tr><th>Item</th><th>Total</th><th>Pages</th></tr>';
        (state.counters || []).forEach(c => {
          const r = counters[c.id];
          if (r) {
            const iconHtml = r.icon ? renderIconHtml(r.icon, r.color || '#e8c547') : '';
            html += '<tr><td class="report-type-cell"><span class="report-type-icon">' + iconHtml + '</span><span>' + escapeHtml(r.name) + '</span></td><td>' + r.total + '</td><td>' + r.pages.join(', ') + '</td></tr>';
          }
        });
        (state.lineTypes || []).forEach(lt => {
          const r = lines[lt.id];
          if (r) {
            const scale = pickScaleForLineType(r.pages);
            const unit = scale?.unit || 'px';
            const num = scale
              ? (r.lengthPdfPts / scale.pixelsPerUnit).toFixed(2)
              : String(Math.round(r.lengthPdfPts));
            const swatchStyle = r.color ? 'background:' + r.color + ';' : 'background:#4a9eff;';
            html += '<tr><td class="report-type-cell"><span class="report-type-swatch" style="' + swatchStyle + '"></span><span>' + escapeHtml(unit + ' of ' + r.name) + '</span></td><td>' + num + '</td><td>' + r.pages.join(', ') + '</td></tr>';
          }
        });
        html += '</table>';
      });
    } else {
      html += '<p class="section-header">No items to summarize.</p>';
    }
    html += '</section>';

    html += '</body></html>';
    return html;
  }

  function getPipeToolingSummary() {
    if (!window.state || !state.pages || !state.pages.length) return '';
    const groups = state.groups || [];
    const getGroupName = (gid) => (gid && groups.find(g => g.id === gid))?.name || null;
    const counterSummaryByGroup = {};
    const lineTypeSummaryByGroup = {};
    state.pages.forEach((page, i) => {
      const ann = (typeof window.getAnnotationsForReport === 'function' ? window.getAnnotationsForReport(page) : page.annotations) || makeAnnotations();
      (state.counters || []).forEach(c => {
        (ann.counterMarkers?.[c.id] || []).forEach(m => {
          const gid = m.group || null;
          if (!counterSummaryByGroup[gid]) counterSummaryByGroup[gid] = {};
          if (!counterSummaryByGroup[gid][c.id]) counterSummaryByGroup[gid][c.id] = { name: c.name, total: 0, pages: [] };
          counterSummaryByGroup[gid][c.id].total++;
          if (!counterSummaryByGroup[gid][c.id].pages.includes(i + 1)) counterSummaryByGroup[gid][c.id].pages.push(i + 1);
        });
      });
      (state.lineTypes || []).forEach(lt => {
        (ann.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => {
          const gid = q.group || null;
          if (!lineTypeSummaryByGroup[gid]) lineTypeSummaryByGroup[gid] = {};
          if (!lineTypeSummaryByGroup[gid][lt.id]) lineTypeSummaryByGroup[gid][lt.id] = { name: lt.name, lengthPdfPts: 0, pages: [] };
          lineTypeSummaryByGroup[gid][lt.id].lengthPdfPts += getLineLengthPdfPts(q, i, false);
          if (!lineTypeSummaryByGroup[gid][lt.id].pages.includes(i + 1)) lineTypeSummaryByGroup[gid][lt.id].pages.push(i + 1);
        });
        (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
          const gid = poly.group || null;
          if (!lineTypeSummaryByGroup[gid]) lineTypeSummaryByGroup[gid] = {};
          if (!lineTypeSummaryByGroup[gid][lt.id]) lineTypeSummaryByGroup[gid][lt.id] = { name: lt.name, lengthPdfPts: 0, pages: [] };
          lineTypeSummaryByGroup[gid][lt.id].lengthPdfPts += getLineLengthPdfPts(poly, i, true);
          if (!lineTypeSummaryByGroup[gid][lt.id].pages.includes(i + 1)) lineTypeSummaryByGroup[gid][lt.id].pages.push(i + 1);
        });
      });
    });
    const lines = [];
    const allGroupIds = [...new Set([...Object.keys(counterSummaryByGroup), ...Object.keys(lineTypeSummaryByGroup)])];
    allGroupIds.forEach(gid => {
      const prefix = getGroupName(gid) ? '[' + getGroupName(gid) + '] ' : '';
      const counters = counterSummaryByGroup[gid] || {};
      const lineTypes = lineTypeSummaryByGroup[gid] || {};
      (state.counters || []).forEach(c => {
        const r = counters[c.id];
        if (r) lines.push([prefix + r.name, r.total, r.pages.join(', ')].join('\t'));
      });
      (state.lineTypes || []).forEach(lt => {
        const r = lineTypes[lt.id];
        if (r) {
          const scale = pickScaleForLineType(r.pages);
          const unit = scale?.unit || 'px';
          const num = scale
            ? (r.lengthPdfPts / scale.pixelsPerUnit).toFixed(2)
            : String(Math.round(r.lengthPdfPts));
          const fixture = prefix + unit + ' of ' + r.name;
          lines.push([fixture, num, r.pages.join(', ')].join('\t'));
        }
      });
    });
    return lines.join('\n');
  }

  function getEmailTextSummary() {
    if (!window.state || !state.pages || !state.pages.length) return '';
    const groups = state.groups || [];
    const getGroupName = (gid) => (gid && groups.find(g => g.id === gid))?.name || 'Untagged';
    const counterSummaryByGroup = {};
    const lineTypeSummaryByGroup = {};
    state.pages.forEach((page, i) => {
      const ann = (typeof window.getAnnotationsForReport === 'function' ? window.getAnnotationsForReport(page) : page.annotations) || makeAnnotations();
      (state.counters || []).forEach(c => {
        (ann.counterMarkers?.[c.id] || []).forEach(m => {
          const gid = m.group || null;
          if (!counterSummaryByGroup[gid]) counterSummaryByGroup[gid] = {};
          if (!counterSummaryByGroup[gid][c.id]) counterSummaryByGroup[gid][c.id] = { name: c.name, total: 0, pages: [] };
          counterSummaryByGroup[gid][c.id].total++;
          if (!counterSummaryByGroup[gid][c.id].pages.includes(i + 1)) counterSummaryByGroup[gid][c.id].pages.push(i + 1);
        });
      });
      (state.lineTypes || []).forEach(lt => {
        (ann.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => {
          const gid = q.group || null;
          if (!lineTypeSummaryByGroup[gid]) lineTypeSummaryByGroup[gid] = {};
          if (!lineTypeSummaryByGroup[gid][lt.id]) lineTypeSummaryByGroup[gid][lt.id] = { name: lt.name, runs: 0, lengthPdfPts: 0, pages: [] };
          lineTypeSummaryByGroup[gid][lt.id].runs++;
          lineTypeSummaryByGroup[gid][lt.id].lengthPdfPts += getLineLengthPdfPts(q, i, false);
          if (!lineTypeSummaryByGroup[gid][lt.id].pages.includes(i + 1)) lineTypeSummaryByGroup[gid][lt.id].pages.push(i + 1);
        });
        (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
          const gid = poly.group || null;
          if (!lineTypeSummaryByGroup[gid]) lineTypeSummaryByGroup[gid] = {};
          if (!lineTypeSummaryByGroup[gid][lt.id]) lineTypeSummaryByGroup[gid][lt.id] = { name: lt.name, runs: 0, lengthPdfPts: 0, pages: [] };
          lineTypeSummaryByGroup[gid][lt.id].runs++;
          lineTypeSummaryByGroup[gid][lt.id].lengthPdfPts += getLineLengthPdfPts(poly, i, true);
          if (!lineTypeSummaryByGroup[gid][lt.id].pages.includes(i + 1)) lineTypeSummaryByGroup[gid][lt.id].pages.push(i + 1);
        });
      });
    });
    const allGroupIds = [...new Set([...Object.keys(counterSummaryByGroup), ...Object.keys(lineTypeSummaryByGroup)])];
    const isUntagged = (x) => x == null || x === '' || String(x) === 'null' || String(x) === 'undefined';
    const orderedGroupIds = allGroupIds.sort((a, b) => {
      if (isUntagged(a)) return 1;
      if (isUntagged(b)) return -1;
      return getGroupName(a).localeCompare(getGroupName(b));
    });
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
        (state.counters || []).forEach(c => {
          const r = counters[c.id];
          if (r) {
            const pagesStr = r.pages.length === 1 ? 'page ' + r.pages[0] : 'pages ' + r.pages.join(', ');
            lines.push('• ' + (r.name || 'Counter') + ': ' + r.total + ' (' + pagesStr + ')');
          }
        });
        (state.lineTypes || []).forEach(lt => {
          const r = lineTypes[lt.id];
          if (r) {
            const scale = pickScaleForLineType(r.pages);
            const unit = scale?.unit || 'px';
            const num = scale
              ? (r.lengthPdfPts / scale.pixelsPerUnit).toFixed(2)
              : String(Math.round(r.lengthPdfPts));
            const pagesStr = r.pages.length === 1 ? 'page ' + r.pages[0] : 'pages ' + r.pages.join(', ');
            lines.push('• ' + num + ' ' + unit + ' of ' + (r.name || 'Line') + ': ' + r.runs + ' run' + (r.runs > 1 ? 's' : '') + ' (' + pagesStr + ')');
          }
        });
        lines.push('');
      });
    }
    return lines.join('\n');
  }

  function printReport() {
    if (!window.state || !state.pages || !state.pages.length) {
      alert('No pages loaded. Upload a PDF first.');
      return;
    }
    const html = buildReportHtml();
    const w = window.open('', '_blank');
    if (!w) {
      alert('Popup blocked. Please allow popups for this site.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  window.escapeHtml = escapeHtml;
  window.buildReportHtml = buildReportHtml;
  window.printReport = printReport;
  window.getPipeToolingSummary = getPipeToolingSummary;
  window.getEmailTextSummary = getEmailTextSummary;

  document.getElementById('printReport').addEventListener('click', printReport);
})();
