/**
 * ClickCount Print Report
 * Uses globals: state, makeAnnotations, ptDist, polylineDistance, formatDist, renderIconHtml
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
    `;

    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Takeoff Report</title><style>' + styles + '</style></head><body>';
    html += '<h1 class="report-title">Takeoff Report</h1>';

    state.pages.forEach((page, i) => {
      const ann = page.annotations || makeAnnotations();
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
          len += ptDist({ x: q.x1, y: q.y1 }, { x: q.x2, y: q.y2 });
        });
        (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
          runs++;
          len += polylineDistance(poly.points || [], poly.closed);
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

    const counterSummary = {};
    state.pages.forEach((page, i) => {
      const ann = page.annotations || makeAnnotations();
      (state.counters || []).forEach(c => {
        const markers = ann.counterMarkers?.[c.id] || [];
        if (markers.length > 0) {
          if (!counterSummary[c.id]) counterSummary[c.id] = { name: c.name, icon: c.icon, color: c.color, total: 0, pages: [] };
          counterSummary[c.id].total += markers.length;
          counterSummary[c.id].pages.push(i + 1);
        }
      });
    });

    const lineTypeSummary = {};
    state.pages.forEach((page, i) => {
      const ann = page.annotations || makeAnnotations();
      (state.lineTypes || []).forEach(lt => {
        let runs = 0, len = 0;
        (ann.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => {
          runs++;
          len += ptDist({ x: q.x1, y: q.y1 }, { x: q.x2, y: q.y2 });
        });
        (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
          runs++;
          len += polylineDistance(poly.points || [], poly.closed);
        });
        if (runs > 0) {
          if (!lineTypeSummary[lt.id]) lineTypeSummary[lt.id] = { name: lt.name, color: lt.color, runs: 0, lengthPdfPts: 0, pages: [] };
          lineTypeSummary[lt.id].runs += runs;
          lineTypeSummary[lt.id].lengthPdfPts += len;
          lineTypeSummary[lt.id].pages.push(i + 1);
        }
      });
    });

    html += '<section>';
    html += '<h2 class="page-header">Summary</h2>';
    const hasSummary = Object.keys(counterSummary).length > 0 || Object.keys(lineTypeSummary).length > 0;
    if (hasSummary) {
      html += '<table class="report-table"><tr><th>Item</th><th>Total</th><th>Pages</th></tr>';
      (state.counters || []).forEach(c => {
        const r = counterSummary[c.id];
        if (r) {
          const iconHtml = r.icon ? renderIconHtml(r.icon, r.color || '#e8c547') : '';
          html += '<tr><td class="report-type-cell"><span class="report-type-icon">' + iconHtml + '</span><span>' + escapeHtml(r.name) + '</span></td><td>' + r.total + '</td><td>' + r.pages.join(', ') + '</td></tr>';
        }
      });
      (state.lineTypes || []).forEach(lt => {
        const r = lineTypeSummary[lt.id];
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
    } else {
      html += '<p class="section-header">No items to summarize.</p>';
    }
    html += '</section>';

    html += '</body></html>';
    return html;
  }

  function getPipeToolingSummary() {
    if (!window.state || !state.pages || !state.pages.length) return '';
    const counterSummary = {};
    state.pages.forEach((page, i) => {
      const ann = page.annotations || makeAnnotations();
      (state.counters || []).forEach(c => {
        const markers = ann.counterMarkers?.[c.id] || [];
        if (markers.length > 0) {
          if (!counterSummary[c.id]) counterSummary[c.id] = { name: c.name, total: 0, pages: [] };
          counterSummary[c.id].total += markers.length;
          counterSummary[c.id].pages.push(i + 1);
        }
      });
    });
    const lineTypeSummary = {};
    state.pages.forEach((page, i) => {
      const ann = page.annotations || makeAnnotations();
      (state.lineTypes || []).forEach(lt => {
        let runs = 0, len = 0;
        (ann.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => {
          runs++;
          len += ptDist({ x: q.x1, y: q.y1 }, { x: q.x2, y: q.y2 });
        });
        (ann.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => {
          runs++;
          len += polylineDistance(poly.points || [], poly.closed);
        });
        if (runs > 0) {
          if (!lineTypeSummary[lt.id]) lineTypeSummary[lt.id] = { name: lt.name, lengthPdfPts: 0, pages: [] };
          lineTypeSummary[lt.id].lengthPdfPts += len;
          lineTypeSummary[lt.id].pages.push(i + 1);
        }
      });
    });
    const lines = [];
    (state.counters || []).forEach(c => {
      const r = counterSummary[c.id];
      if (r) lines.push([r.name, r.total, r.pages.join(', ')].join('\t'));
    });
    (state.lineTypes || []).forEach(lt => {
      const r = lineTypeSummary[lt.id];
      if (r) {
        const scale = pickScaleForLineType(r.pages);
        const unit = scale?.unit || 'px';
        const num = scale
          ? (r.lengthPdfPts / scale.pixelsPerUnit).toFixed(2)
          : String(Math.round(r.lengthPdfPts));
        const fixture = unit + ' of ' + r.name;
        lines.push([fixture, num, r.pages.join(', ')].join('\t'));
      }
    });
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

  document.getElementById('printReport').addEventListener('click', printReport);
})();
