(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // RFI flags — the CountTooling half of the cross-app RFI loop (PipeTooling's
  // docs/RFI_LOOP_PLAN.md R2; estimator-twin pipeline Wave 2.2). Convention: a canvas
  // note whose text starts with "RFI:" is a question for the GC, dropped at the exact
  // ambiguous spot while drawing. This feature collects every such note across ALL
  // pages and ALL canvases into a copyable tab-delimited list (page, canvas, text)
  // that pastes into PipeTooling's RFI queue — the same clipboard seam Copy to
  // /Tooling uses for counts. Zero schema on the CT side: the note IS the flag, so
  // human estimators and agent twins share the identical capture gesture.
  // Cross-file deps read from App at call time: state, showToast, logUserEvent.
  const RFI_RE = /^\s*RFI\s*:/i;

  function collectRfiFlags() {
    const state = App.state;
    const rows = [];
    (state.pages || []).forEach((page, pi) => {
      const multiCanvas = (page?.canvases || []).length > 1;
      (page?.canvases || []).forEach((cv, ci) => {
        ((cv?.annotations?.notes) || []).forEach((n) => {
          const text = String(n?.text || '');
          if (!RFI_RE.test(text)) return;
          rows.push({
            page: pi + 1,
            pageName: page?.name || '',
            // The canvas label only earns its place when it disambiguates.
            canvas: multiCanvas ? (cv?.name || 'Canvas ' + (ci + 1)) : '',
            text: text.replace(RFI_RE, '').trim(),
          });
        });
      });
    });
    return rows;
  }

  function buildRfiFlagsText(rows) {
    const state = App.state;
    const lines = ['RFI flags\t' + (state.currentProjectName || 'Untitled project')];
    rows.forEach((r) => {
      const where = 'p' + r.page + (r.pageName ? ' ' + r.pageName : '') + (r.canvas ? ' · ' + r.canvas : '');
      lines.push(where + '\t' + r.text);
    });
    return lines.join('\n');
  }

  async function copyRfiFlags() {
    const rows = collectRfiFlags();
    if (!rows.length) {
      alert('No RFI flags found. Drop a note starting with "RFI:" at the ambiguous spot first.');
      return;
    }
    const text = buildRfiFlagsText(rows);
    try {
      await navigator.clipboard.writeText(text);
      App.showToast(rows.length + ' RFI flag' + (rows.length === 1 ? '' : 's') + ' copied — paste into PipeTooling’s RFI queue.');
      try { App.logUserEvent?.('copy_summary', App.state.currentProjectId || null, { surface: 'rfi-flags', count: rows.length }); } catch (_) { /* best-effort */ }
    } catch (err) {
      alert('Could not copy to clipboard: ' + (err.message || err));
    }
  }

  document.getElementById('copyRfiFlags')?.addEventListener('click', () => { void copyRfiFlags(); });

  App.collectRfiFlags = collectRfiFlags;
  App.buildRfiFlagsText = buildRfiFlagsText;
  App.copyRfiFlags = copyRfiFlags;
})();
