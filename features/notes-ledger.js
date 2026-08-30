/*
 * features/notes-ledger.js - the Notes ledger: numbered pins on the canvas, a
 * header drawer listing every note across all pages/canvases, and the RFI
 * lifecycle (resolved + answer) — built 2026-08-30 after the estimator-twin
 * takeoffs buried P201 under eight paragraph-sized plan-space notes.
 *
 * The problem it solves: a note is drawn at fontSize 14pt in PLAN space — on a
 * 1/8" sheet that's a ~35-plan-foot billboard, and long notes (twin trace
 * provenance, multi-sentence RFIs) occlude the drawing with no way to list,
 * jump to, or resolve them. The ledger keeps the location signal and drops the
 * occlusion:
 *
 * - PINS: notes render as small numbered circles (red = RFI, gray = note;
 *   hollow = resolved) instead of text blocks. Display mode is per-device
 *   ('auto' | 'text' | 'pins', localStorage `ct:notesDisplay`); 'auto' pins
 *   RFIs, notes with a `detail` payload, and anything >= 100 chars — short
 *   human notes keep rendering as text exactly as before. The draw itself
 *   happens in canvas-draw.js via the live-only `env.notePin` seam (export /
 *   print envs never set it, so PDFs are unchanged); this file owns the
 *   numbering (getNotesPinMap) and the predicate (isPinNote).
 *
 * - HOVER CHIP: with a pin under the pointer, a floating DOM chip shows the
 *   full text (+ detail / answer). Dismissed on pointerdown, wheel, or
 *   keydown — the same rules as the drop-peek chip.
 *
 * - DRAWER (#notesLedgerDrawer, opened by the header #notesLedgerBtn whose
 *   badge counts OPEN RFIs): every note grouped by page, filter chips
 *   (all / RFI / open), click a row to jump — switches page, centers the pan
 *   on the note, and pins the chip there briefly. Rows carry the resolved
 *   checkbox and (for RFIs) an inline answer editor; saving an answer marks
 *   the note resolved. Both are project data (undo snapshot + dirty), so they
 *   sync to the cloud and reach the twin via manage-user `twin_projects`.
 *   "Copy RFI flags" (features/rfi-flags.js) is also reachable here.
 *
 * Note schema additions (all optional, backward compatible): `resolved`
 * (bool), `answer` (string), `detail` (string — long body imported by
 * import-takeoff; the on-sheet text stays short). `kind` is DERIVED from the
 * "RFI:" prefix (features/rfi-flags.js convention), never stored.
 *
 * Boundary rule: all shared dependencies are read from App.* / App.state at
 * call time (never captured at load). See ARCHITECTURE.md "Feature files /
 * window.App registry". No build step.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const RFI_RE = /^\s*RFI\s*:/i;
  const AUTO_PIN_CHARS = 100;
  const PIN_R = 9;               // pin radius, screen px (matches note-handle scale)
  const DISPLAY_KEY = 'ct:notesDisplay';
  const RFI_COLOR = '#e24b4a';
  const NOTE_COLOR = '#5f5e5a';

  function noteKind(text) {
    return RFI_RE.test(String(text || '')) ? 'rfi' : 'note';
  }

  function noteTitle(text) {
    const t = String(text || '').replace(RFI_RE, '').trim();
    const firstLine = t.split(/\n/)[0];
    return firstLine.length > 90 ? firstLine.slice(0, 87) + '…' : firstLine;
  }

  function getDisplayMode() {
    try {
      const v = localStorage.getItem(DISPLAY_KEY);
      return v === 'text' || v === 'pins' ? v : 'auto';
    } catch (_) { return 'auto'; }
  }

  function setDisplayMode(mode) {
    try { localStorage.setItem(DISPLAY_KEY, mode); } catch (_) { /* private mode */ }
    App.renderAnnotations?.();
    refreshDrawer();
  }

  function isPinNote(n) {
    const mode = getDisplayMode();
    if (mode === 'text') return false;
    if (mode === 'pins') return true;
    return noteKind(n.text) === 'rfi' || !!n.detail || String(n.text || '').length >= AUTO_PIN_CHARS;
  }

  // Every note in the project, numbered in stable (page, canvas, array) order.
  function collectNotesLedger() {
    const state = App.state;
    const rows = [];
    let num = 0;
    (state?.pages || []).forEach((page, pi) => {
      const canvases = page?.canvases || [];
      const multiCanvas = canvases.length > 1;
      canvases.forEach((cv, ci) => {
        ((cv?.annotations?.notes) || []).forEach((n, ni) => {
          if (!n || !String(n.text || '').trim()) return;
          num += 1;
          rows.push({
            num,
            pageIdx: pi,
            pageName: page?.name || '',
            canvasIdx: ci,
            canvasName: multiCanvas ? (cv?.name || 'Canvas ' + (ci + 1)) : '',
            noteIdx: ni,
            note: n,
            kind: noteKind(n.text),
            resolved: !!n.resolved,
            title: noteTitle(n.text),
          });
        });
      });
    });
    return rows;
  }

  // Per-render pin map for canvas-draw's env.notePin: note object -> pin info.
  // Rebuilt on each call (app.js's live env builder calls it once per render);
  // returns null when nothing should pin so the draw path stays untouched.
  function getNotesPinMap() {
    if (getDisplayMode() === 'text') return null;
    const map = new Map();
    collectNotesLedger().forEach((r) => {
      if (!isPinNote(r.note)) return;
      map.set(r.note, {
        num: r.num,
        color: r.kind === 'rfi' ? RFI_COLOR : NOTE_COLOR,
        resolved: r.resolved,
        r: PIN_R,
      });
    });
    return map.size ? map : null;
  }

  function notePinInfo(n) {
    if (!isPinNote(n)) return null;
    const row = collectNotesLedger().find((r) => r.note === n);
    return row ? { num: row.num, color: row.kind === 'rfi' ? RFI_COLOR : NOTE_COLOR, resolved: row.resolved, r: PIN_R } : null;
  }

  // ---- hover chip -----------------------------------------------------------

  let chipEl = null;
  let chipPinned = false;
  let chipTimer = null;

  function ensureChip() {
    if (chipEl) return chipEl;
    chipEl = document.createElement('div');
    chipEl.id = 'notePeekChip';
    chipEl.className = 'note-peek-chip';
    chipEl.style.display = 'none';
    document.body.appendChild(chipEl);
    return chipEl;
  }

  function hideChip() {
    if (chipEl) chipEl.style.display = 'none';
    chipPinned = false;
    if (chipTimer) { clearTimeout(chipTimer); chipTimer = null; }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showChipForRow(row, screenX, screenY) {
    const el = ensureChip();
    const kindChip = row.kind === 'rfi'
      ? '<span class="note-chip-kind note-chip-rfi">RFI</span>'
      : '<span class="note-chip-kind">Note</span>';
    const resolved = row.resolved ? '<span class="note-chip-resolved">Resolved</span>' : '';
    const body = escapeHtml(String(row.note.text || '').replace(RFI_RE, '').trim());
    const detail = row.note.detail ? '<div class="note-chip-detail">' + escapeHtml(row.note.detail) + '</div>' : '';
    const answer = row.note.answer ? '<div class="note-chip-answer">Answer: ' + escapeHtml(row.note.answer) + '</div>' : '';
    el.innerHTML = '<div class="note-chip-head"><span class="note-chip-num">' + row.num + '</span>' + kindChip + resolved + '</div>'
      + '<div class="note-chip-body">' + body + '</div>' + detail + answer;
    el.style.display = 'block';
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = screenX - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = screenY - h - 16;
    if (top < 8) top = screenY + 16;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function noteScreenPos(n) {
    const state = App.state;
    const el = document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + n.x * state.zoom + state.pan.x, y: rect.top + n.y * state.zoom + state.pan.y };
  }

  function pinRowAtClient(clientX, clientY) {
    const state = App.state;
    if (!state?.pages?.length) return null;
    const rows = collectNotesLedger().filter((r) => r.pageIdx === state.currentPage && isPinNote(r.note));
    let best = null, bestD = Infinity;
    for (const r of rows) {
      const p = noteScreenPos(r.note);
      if (!p) continue;
      const d = Math.hypot(clientX - p.x, clientY - p.y);
      if (d <= PIN_R + 4 && d < bestD) { best = r; bestD = d; }
    }
    return best;
  }

  function wireChip() {
    // Listen on the wrapper, not a specific canvas — pointer events bubble up
    // from whichever layer is on top, and the hit math is client-space anyway.
    const canvas = document.getElementById('canvasWrapper') || document.querySelector('.canvas-wrapper') || document.getElementById('annCanvas');
    if (!canvas) return;
    let raf = null;
    canvas.addEventListener('mousemove', (e) => {
      if (chipPinned) return;
      if (App.state?.draggingNoteIdx != null) return;   // dragging a pin — no chip
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const row = pinRowAtClient(e.clientX, e.clientY);
        if (row) {
          const p = noteScreenPos(row.note);
          showChipForRow(row, p.x, p.y - PIN_R);
        } else if (chipEl && chipEl.style.display !== 'none') {
          hideChip();
        }
      });
    });
    canvas.addEventListener('mouseleave', () => { if (!chipPinned) hideChip(); });
    ['pointerdown', 'wheel', 'keydown'].forEach((ev) => {
      window.addEventListener(ev, () => hideChip(), { capture: true, passive: true });
    });
  }

  // ---- drawer ---------------------------------------------------------------

  let filter = 'all';   // 'all' | 'rfi' | 'open'

  function drawerEl() { return document.getElementById('notesLedgerDrawer'); }

  function isDrawerOpen() {
    const el = drawerEl();
    return !!el && el.classList.contains('open');
  }

  function openNotesLedger() {
    const el = drawerEl();
    if (!el) return;
    el.classList.add('open');
    document.getElementById('notesLedgerBtn')?.setAttribute('aria-expanded', 'true');
    refreshDrawer();
    try { App.logUserEvent?.('open_modal', App.state?.currentProjectId || null, { surface: 'notes-ledger' }); } catch (_) { /* best-effort */ }
  }

  function closeNotesLedger() {
    const el = drawerEl();
    if (!el) return;
    el.classList.remove('open');
    document.getElementById('notesLedgerBtn')?.setAttribute('aria-expanded', 'false');
  }

  function toggleNotesLedger() { if (isDrawerOpen()) closeNotesLedger(); else openNotesLedger(); }

  function jumpToNote(row) {
    const state = App.state;
    if (!state?.pages?.[row.pageIdx]) return;
    state.currentPage = row.pageIdx;
    if (typeof row.canvasIdx === 'number' && state.pages[row.pageIdx].canvases?.[row.canvasIdx]) {
      state.pages[row.pageIdx].activeCanvas = row.canvasIdx;
    }
    if (state.zoom < 1) state.zoom = 1.2;
    const wrap = document.querySelector('.canvas-wrapper');
    if (wrap) {
      const r = wrap.getBoundingClientRect();
      // Center in the VISIBLE canvas — the open drawer overlays the right edge.
      const drawerW = isDrawerOpen() ? (drawerEl()?.offsetWidth || 0) : 0;
      state.pan = {
        x: Math.max(0, r.width - drawerW) / 2 - row.note.x * state.zoom,
        y: r.height / 2 - row.note.y * state.zoom,
      };
    }
    App.renderPdf?.();
    App.updateUI?.();
    // Pin the chip at the note for a beat so the eye lands on the right spot.
    setTimeout(() => {
      const p = noteScreenPos(row.note);
      if (!p) return;
      chipPinned = true;
      showChipForRow(row, p.x, p.y - PIN_R);
      if (chipTimer) clearTimeout(chipTimer);
      chipTimer = setTimeout(() => hideChip(), 2500);
    }, 120);
  }

  function setNoteResolved(row, resolved) {
    App.pushUndoSnapshot?.();
    if (resolved) row.note.resolved = true;
    else { delete row.note.resolved; }
    App.markProjectDirty?.();
    App.renderAnnotations?.();
    refreshDrawer();
  }

  function saveNoteAnswer(row, answer) {
    const text = String(answer || '').trim();
    App.pushUndoSnapshot?.();
    if (text) {
      row.note.answer = text;
      row.note.resolved = true;   // an answered RFI is a settled RFI
    } else {
      delete row.note.answer;
    }
    App.markProjectDirty?.();
    App.renderAnnotations?.();
    refreshDrawer();
  }

  function refreshDrawer() {
    const el = drawerEl();
    syncBadge();
    if (!el || !isDrawerOpen()) return;
    const list = el.querySelector('.notes-ledger-list');
    if (!list) return;
    lastSig = ledgerSig();
    const viewer = !!App.state?.isViewer;
    const rows = collectNotesLedger().filter((r) => {
      if (filter === 'rfi') return r.kind === 'rfi';
      if (filter === 'open') return !r.resolved;
      return true;
    });
    el.querySelectorAll('.notes-ledger-filter').forEach((b) => {
      b.classList.toggle('active', b.dataset.filter === filter);
    });
    const modeSel = el.querySelector('#notesDisplayMode');
    if (modeSel) modeSel.value = getDisplayMode();
    if (!rows.length) {
      list.innerHTML = '<div class="notes-ledger-empty">' +
        (collectNotesLedger().length ? 'Nothing matches this filter.' : 'No notes yet. Drop one with the Note tool — start it with "RFI:" to flag a question.') +
        '</div>';
      return;
    }
    list.innerHTML = '';
    let lastPage = -1;
    rows.forEach((r) => {
      if (r.pageIdx !== lastPage) {
        lastPage = r.pageIdx;
        const h = document.createElement('div');
        h.className = 'notes-ledger-page';
        h.textContent = 'p' + (r.pageIdx + 1) + (r.pageName ? ' · ' + r.pageName : '');
        list.appendChild(h);
      }
      const div = document.createElement('div');
      div.className = 'notes-ledger-row' + (r.resolved ? ' resolved' : '');
      const pinClass = r.kind === 'rfi' ? 'rfi' : 'plain';
      const detail = r.note.detail ? '<div class="notes-ledger-detail">' + escapeHtml(r.note.detail) + '</div>' : '';
      const answer = r.note.answer ? '<div class="notes-ledger-answer">Answer: ' + escapeHtml(r.note.answer) + '</div>' : '';
      const canvasTag = r.canvasName ? '<span class="notes-ledger-canvas">' + escapeHtml(r.canvasName) + '</span>' : '';
      div.innerHTML =
        '<span class="notes-ledger-pin ' + pinClass + (r.resolved ? ' resolved' : '') + '">' + r.num + '</span>' +
        '<div class="notes-ledger-main">' +
          '<div class="notes-ledger-title">' + escapeHtml(r.title) + canvasTag + '</div>' +
          detail + answer +
          (r.kind === 'rfi' && !viewer ? '<button class="notes-ledger-answer-btn" type="button">' + (r.note.answer ? 'Edit answer' : 'Answer…') + '</button>' : '') +
        '</div>' +
        (!viewer ? '<label class="notes-ledger-resolve" title="Resolved"><input type="checkbox" ' + (r.resolved ? 'checked' : '') + '></label>' : '');
      div.addEventListener('click', (e) => {
        if (e.target.closest('.notes-ledger-resolve') || e.target.closest('.notes-ledger-answer-btn') || e.target.closest('textarea')) return;
        jumpToNote(r);
      });
      const cb = div.querySelector('.notes-ledger-resolve input');
      if (cb) cb.addEventListener('change', () => setNoteResolved(r, cb.checked));
      const ansBtn = div.querySelector('.notes-ledger-answer-btn');
      if (ansBtn) ansBtn.addEventListener('click', () => {
        if (div.querySelector('.notes-ledger-answer-edit')) return;
        const wrap = document.createElement('div');
        wrap.className = 'notes-ledger-answer-edit';
        wrap.innerHTML = '<textarea rows="2" placeholder="Answer for the estimator">' + escapeHtml(r.note.answer || '') + '</textarea>' +
          '<div class="notes-ledger-answer-actions"><button type="button" class="save">Save</button><button type="button" class="cancel">Cancel</button></div>';
        div.querySelector('.notes-ledger-main').appendChild(wrap);
        const ta = wrap.querySelector('textarea');
        ta.focus();
        wrap.querySelector('.save').addEventListener('click', () => saveNoteAnswer(r, ta.value));
        wrap.querySelector('.cancel').addEventListener('click', () => wrap.remove());
      });
      list.appendChild(div);
    });
  }

  function syncBadge() {
    const btn = document.getElementById('notesLedgerBtn');
    if (!btn) return;
    const rows = collectNotesLedger();
    const openRfis = rows.filter((r) => r.kind === 'rfi' && !r.resolved).length;
    const badge = document.getElementById('notesLedgerBadge');
    if (badge) {
      badge.textContent = openRfis ? String(openRfis) : '';
      badge.style.display = openRfis ? '' : 'none';
    }
    btn.style.display = rows.length ? '' : 'none';
    btn.title = openRfis
      ? 'Notes ledger — ' + openRfis + ' open RFI' + (openRfis === 1 ? '' : 's')
      : 'Notes ledger';
  }

  // Core->feature callback: app.js updateUI() re-syncs the badge (and the open
  // drawer) after every UI reconcile, same seam as App.onHeaderMoreSync.
  // Guard rails: never rebuild rows while an answer editor is open (typing
  // would be wiped), and skip the rebuild entirely when the ledger content
  // hasn't changed since the last render (updateUI runs constantly).
  let lastSig = null;

  function ledgerSig() {
    return collectNotesLedger()
      .map((r) => r.num + ':' + r.pageIdx + ':' + (r.resolved ? 1 : 0) + ':' + (r.note.answer || '') + ':' + r.title)
      .join('|') + '§' + filter + '§' + getDisplayMode();
  }

  function onNotesLedgerSync() {
    syncBadge();
    if (!isDrawerOpen()) return;
    if (drawerEl()?.querySelector('.notes-ledger-answer-edit')) return;
    const sig = ledgerSig();
    if (sig === lastSig) return;
    refreshDrawer();
  }

  function wireDrawer() {
    document.getElementById('notesLedgerBtn')?.addEventListener('click', toggleNotesLedger);
    const el = drawerEl();
    if (!el) return;
    el.querySelector('.notes-ledger-close')?.addEventListener('click', closeNotesLedger);
    el.querySelectorAll('.notes-ledger-filter').forEach((b) => {
      b.addEventListener('click', () => { filter = b.dataset.filter; refreshDrawer(); });
    });
    el.querySelector('#notesDisplayMode')?.addEventListener('change', (e) => setDisplayMode(e.target.value));
    el.querySelector('#notesLedgerCopyRfi')?.addEventListener('click', () => { void App.copyRfiFlags?.(); });
  }

  wireChip();
  wireDrawer();

  App.noteKind = noteKind;
  App.noteTitle = noteTitle;
  App.isPinNote = isPinNote;
  App.notePinInfo = notePinInfo;
  App.getNotesPinMap = getNotesPinMap;
  App.collectNotesLedger = collectNotesLedger;
  App.getNotesDisplayMode = getDisplayMode;
  App.setNotesDisplayMode = setDisplayMode;
  App.openNotesLedger = openNotesLedger;
  App.closeNotesLedger = closeNotesLedger;
  App.onNotesLedgerSync = onNotesLedgerSync;
})();
