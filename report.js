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

      html += '</section>';
    });

    html += '</body></html>';
    return html;
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

  document.getElementById('printReport').addEventListener('click', printReport);
})();
