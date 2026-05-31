/*
 * features/save-status.js - the Save Status modal (the on-demand detail view),
 * extracted from the app.js IIFE as the eighteenth feature-file split under the
 * window.App registry pattern. This is the modal opened by the header / in-modal
 * Save Status bells: a cloud/PDF summary, a rolling activity log (with Verbose
 * toggle), and Copy/Export logs.
 *
 * Loaded as a classic <script src="features/save-status.js"> AFTER app.js. Its
 * own IIFE: it reaches the cross-cutting helpers through the shared window.App
 * registry that app.js populates during its own load, registers
 * openSaveStatusModal back onto App, and binds the bell open buttons + the
 * #saveStatus* modal handlers at this file's load.
 *
 * Boundary: this is the on-demand UI only. The hot-path bell
 * (updateSaveStatusIndicator, called from 25+ sites incl. updateUI) and the whole
 * save engine stay in app.js. The modal reads engine state through publish-only
 * deps; two of those are GETTER accessors rather than value publishes, because
 * the underlying app.js vars are reassigned and a captured reference would go
 * stale: App.getSaveStatusLog() (the log array, reset to [] on session reset) and
 * App.isCheckoutExpiredAttention() (a flag with many engine writers). Reuse that
 * getter-accessor pattern for the eventual SaveManager extraction.
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 * See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  let saveStatusModalTickTimer = null;

  function escSaveStatusHtml(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function applySaveStatusSummaryBlock(rootEl, data, iconBase) {
    if (!rootEl) return;
    const iconEl = rootEl.querySelector('.save-status-summary-icon');
    const agoEl  = rootEl.querySelector('.save-status-summary-ago');
    const bodyEl = rootEl.querySelector('.save-status-summary-body');
    if (iconEl) iconEl.className = 'save-status-summary-icon ' + iconBase + ' ' + iconBase + '-' + (data.state || 'grey');
    if (agoEl)  agoEl.textContent = data.ago ? '(' + data.ago + ')' : '';
    if (bodyEl) {
      const parts = [];
      if (data.status) parts.push(data.status);
      if (data.clock) parts.push(data.clock);
      bodyEl.textContent = parts.length === 2 ? parts.join(': ') : (parts[0] || '');
    }
  }

  function renderSaveStatusModalContent() {
    App.pruneSaveStatusLog();
    const sum = App.getCloudSaveSummary();
    const listEl = document.getElementById('saveStatusEventList');
    const headingEl = document.getElementById('saveStatusActivityHeading');
    const verboseChk = document.getElementById('saveStatusVerboseToggle');
    const windowMin = Math.round(App.getSaveStatusLogWindowMs() / 60000);
    if (headingEl) headingEl.textContent = 'Activity (last ' + windowMin + ' minutes)';
    if (verboseChk) verboseChk.checked = App.isSaveDebugEnabled();
    const calloutEl = document.getElementById('saveStatusExpiredCallout');
    if (calloutEl) calloutEl.style.display = App.isCheckoutExpiredAttention() ? '' : 'none';
    applySaveStatusSummaryBlock(document.getElementById('saveStatusSummaryCanvas'), sum.canvas, 'dot');
    applySaveStatusSummaryBlock(document.getElementById('saveStatusSummaryPdf'),    sum.pdf,    'square');
    if (listEl) {
      const entries = App.getSaveStatusLog().slice().reverse();
      if (!entries.length) {
        listEl.innerHTML = '<p class="save-status-empty" style="color:var(--text2);font-size:0.9rem;">No save activity in the last ' + windowMin + ' minutes.</p>';
      } else {
        listEl.innerHTML = '';
        entries.forEach((ev) => {
          const d = new Date(ev.ts);
          const agoMs = Date.now() - ev.ts;
          const agoStr = agoMs < 1000 ? 'just now' : (agoMs < 60000 ? Math.floor(agoMs / 1000) + 's ago' : Math.floor(agoMs / 60000) + 'm ago');
          const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
          const msg = ev.message || '';
          const caretHtml = ev.detail ? '<span class="save-status-event-caret" aria-hidden="true"></span>' : '';
          const rowHtml =
            '<span class="save-status-event-time">' + escSaveStatusHtml(timeStr) + '</span>' +
            '<span class="save-status-event-kind">' + escSaveStatusHtml(ev.kind) + '</span>' +
            '<span class="save-status-event-msg" title="' + escSaveStatusHtml(msg) + '">' + escSaveStatusHtml(msg) + '</span>' +
            caretHtml +
            '<span class="save-status-event-ago">(' + escSaveStatusHtml(agoStr) + ')</span>';
          let el;
          if (ev.detail) {
            const detStr = typeof ev.detail === 'string' ? ev.detail : JSON.stringify(ev.detail, null, 2);
            el = document.createElement('details');
            el.className = 'save-status-event';
            el.innerHTML =
              '<summary><span class="save-status-event-row">' + rowHtml + '</span></summary>' +
              '<pre class="save-status-event-detail">' + escSaveStatusHtml(detStr) + '</pre>';
          } else {
            el = document.createElement('div');
            el.className = 'save-status-event';
            el.innerHTML = '<span class="save-status-event-row">' + rowHtml + '</span>';
          }
          listEl.appendChild(el);
        });
      }
    }
  }

  function openSaveStatusModal() {
    renderSaveStatusModalContent();
    App.showModal('saveStatusModal');
    if (saveStatusModalTickTimer) { clearInterval(saveStatusModalTickTimer); saveStatusModalTickTimer = null; }
    saveStatusModalTickTimer = setInterval(() => {
      const modal = document.getElementById('saveStatusModal');
      if (!modal || !modal.classList.contains('visible')) {
        clearInterval(saveStatusModalTickTimer);
        saveStatusModalTickTimer = null;
        return;
      }
      renderSaveStatusModalContent();
    }, 5000);
  }

  const saveStatusBtnEl = document.getElementById('saveStatusBtn');
  if (saveStatusBtnEl) saveStatusBtnEl.onclick = () => openSaveStatusModal();
  const saveStatusHeaderBtnEl = document.getElementById('saveStatusBtnHeader');
  if (saveStatusHeaderBtnEl) saveStatusHeaderBtnEl.onclick = () => openSaveStatusModal();
  const saveStatusModalCloseEl = document.getElementById('saveStatusModalClose');
  if (saveStatusModalCloseEl) saveStatusModalCloseEl.onclick = () => {
    if (saveStatusModalTickTimer) { clearInterval(saveStatusModalTickTimer); saveStatusModalTickTimer = null; }
    App.hideModal('saveStatusModal');
  };
  const saveStatusModalDoneEl = document.getElementById('saveStatusModalDone');
  if (saveStatusModalDoneEl) saveStatusModalDoneEl.onclick = () => {
    if (saveStatusModalTickTimer) { clearInterval(saveStatusModalTickTimer); saveStatusModalTickTimer = null; }
    App.hideModal('saveStatusModal');
  };
  const saveStatusVerboseToggleEl = document.getElementById('saveStatusVerboseToggle');
  if (saveStatusVerboseToggleEl) saveStatusVerboseToggleEl.onchange = (e) => {
    const on = !!e.target.checked;
    App.setSaveDebugEnabled(on);
    App.pushSaveEvent(on ? 'verbose_on' : 'verbose_off', on ? 'Verbose logging enabled' : 'Verbose logging disabled');
    renderSaveStatusModalContent();
  };
  const saveStatusExportBtnEl = document.getElementById('saveStatusExportBtn');
  if (saveStatusExportBtnEl) saveStatusExportBtnEl.onclick = async () => {
    try {
      const envelope = await App.buildSaveLogsEnvelopeWithSnapshots();
      const json = JSON.stringify(envelope, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = 'clickcount-save-logs-' + ts + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 1000);
      App.showToast('Logs exported');
    } catch (err) {
      App.showToast('Export failed: ' + (err && err.message || 'unknown'));
    }
  };
  const saveStatusCopyBtnEl = document.getElementById('saveStatusCopyBtn');
  if (saveStatusCopyBtnEl) saveStatusCopyBtnEl.onclick = async () => {
    try {
      const envelope = await App.buildSaveLogsEnvelopeWithSnapshots();
      const json = JSON.stringify(envelope, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(json);
      } else {
        const ta = document.createElement('textarea');
        ta.value = json;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
      }
      App.showToast('Logs copied to clipboard');
    } catch (err) {
      App.showToast('Copy failed: ' + (err && err.message || 'unknown'));
    }
  };

  App.openSaveStatusModal = openSaveStatusModal;
  App.renderSaveStatusModalContent = renderSaveStatusModalContent;
})();
