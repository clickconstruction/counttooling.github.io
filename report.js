// ─── PRINT REPORT ──────────────────────────────────────────────────────────────
// Loaded after main script; uses global state, makeAnnotations, ptDist, polylineDistance, formatDist, renderIconHtml

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReportHtml() {
  const parts = [];
  parts.push('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Takeoff Report</title>');
  parts.push('<style>body{font-family:system-ui,sans-serif;padding:20px;max-width:600px;margin:0 auto}h1{font-size:1.25rem;margin-bottom:1rem}.page-block{margin-bottom:1.5rem;page-break-inside:avoid}.page-title{font-weight:600;margin-bottom:0.5rem;font-size:14px}table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px}caption{text-align:left;font-size:11px;font-weight:600;color:#666;margin-bottom:4px}th,td{padding:4px 8px;text-align:left;border-bottom:1px solid #ddd}@media print{body{padding:0;max-width:100%}}</style></head><body><h1>Takeoff Report</h1>');

  state.pages.forEach((page, i) => {
    const ann = page.annotations || makeAnnotations();
    parts.push('<div class="page-block"><div class="page-title">Page ' + (i + 1) + ': ' + escapeHtml(page.label) + '</div>');

    const counterRows = state.counters
      .map(def => ({ def, count: (ann.counterMarkers[def.id] || []).length }))
      .filter(r => r.count > 0);
    if (counterRows.length > 0) {
      parts.push('<table><caption>Counters</caption><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>');
      counterRows.forEach(r => {
        parts.push('<tr><td>' + renderIconHtml(r.def.icon) + ' ' + escapeHtml(r.def.name) + '</td><td>' + r.count + '</td></tr>');
      });
      parts.push('</tbody></table>');
    }

    const typeStats = {};
    (ann.quickLines || []).forEach(l => {
      const d = ptDist({ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 });
      const k = l.lineTypeId || '__ungrouped__';
      if (!typeStats[k]) typeStats[k] = { runs: 0, length: 0 };
      typeStats[k].runs++;
      typeStats[k].length += d;
    });
    (ann.polylines || []).forEach(p => {
      const d = polylineDistance(p.points, p.closed);
      const k = p.lineTypeId || '__ungrouped__';
      if (!typeStats[k]) typeStats[k] = { runs: 0, length: 0 };
      typeStats[k].runs++;
      typeStats[k].length += d;
    });
    const lineTypeIds = state.lineTypes.map(l => l.id);
    const ordered = [
      ...lineTypeIds.filter(k => typeStats[k]),
      ...(typeStats['__ungrouped__'] ? ['__ungrouped__'] : []),
      ...Object.keys(typeStats).filter(k => !lineTypeIds.includes(k) && k !== '__ungrouped__')
    ];
    if (ordered.length > 0) {
      parts.push('<table><caption>Line Types</caption><thead><tr><th>Type</th><th>Runs</th><th>Length</th></tr></thead><tbody>');
      ordered.forEach(k => {
        const s = typeStats[k];
        const name = k === '__ungrouped__' ? 'Ungrouped' : (state.lineTypes.find(l => l.id === k)?.name || 'Unknown');
        parts.push('<tr><td>' + escapeHtml(name) + '</td><td>' + s.runs + '</td><td>' + escapeHtml(formatDist(s.length)) + '</td></tr>');
      });
      parts.push('</tbody></table>');
    }

    parts.push('</div>');
  });

  parts.push('</body></html>');
  return parts.join('');
}

function printReport() {
  if (state.pages.length === 0) { alert('No document loaded.'); return; }
  const html = buildReportHtml();
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
}
