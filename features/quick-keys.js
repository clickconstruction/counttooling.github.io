/*
 * features/quick-keys.js - Quick Keys: bind the number row (1-9, 0) to counters
 * and line types so the user can switch what they are placing without a trip to
 * the sidebar. Placing a mark is already one click; picking WHAT to place was the
 * slow part of a takeoff, and this makes it a keystroke.
 *
 * Loaded as a classic <script src="features/quick-keys.js"> AFTER app.js. Its own
 * IIFE: it reaches shared state/helpers through the window.App registry, registers
 * openQuickKeysModal / triggerQuickKey / getQuickKeyLabels back onto App, and
 * binds the status-bar opener + modal buttons at load.
 *
 * ONE SELECTION PATH: a number key does not implement its own activation — it
 * calls App.setActiveCounterType / App.setActiveLineType, the same functions the
 * sidebar rows call (app.js, published for this). So toggle-off semantics
 * (pressing the same key twice clears the selection), the tool switch, and the
 * pages-section collapse can never drift between the two entry points.
 *
 * DATA: state.numberKeyBindings, a map of slot -> { kind: 'counter'|'lineType', id }.
 * Per-project, because counter/line-type ids come from uid() and are scoped to the
 * project. In practice bindings still follow a user across bids: Save/Load Artboard
 * stores state.counters / state.lineTypes wholesale, ids included, so an artboard
 * restore lands the same ids the bindings point at. Rides save/load, export/import,
 * and the IDB takeoff backup (see ARCHITECTURE.md "Quick Keys").
 *
 * A binding whose target has since been deleted resolves to null and is reported
 * as stale rather than silently doing nothing — the id is kept, so re-creating or
 * re-importing that counter revives the slot.
 */
(function() {
  const App = (window.App = window.App || {});

  // Physical left-to-right order of the number row, which is also the row order
  // in the modal. '0' is last because that is where it sits on a keyboard.
  const SLOTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  function getBindings() {
    const state = App.state;
    if (!state.numberKeyBindings || typeof state.numberKeyBindings !== 'object') state.numberKeyBindings = {};
    return state.numberKeyBindings;
  }

  // slot -> { kind, id, item } | null. `item` is null when the binding is stale
  // (target deleted); callers distinguish "unbound" (null) from "stale" (item null).
  function resolveSlot(slot) {
    const b = getBindings()[slot];
    if (!b || !b.id || !b.kind) return null;
    const state = App.state;
    const list = b.kind === 'counter' ? (state.counters || []) : (state.lineTypes || []);
    return { kind: b.kind, id: b.id, item: list.find((x) => x.id === b.id) || null };
  }

  /*
   * Fire a slot. Unbound slots are a silent no-op — the number row is otherwise
   * unused, so a stray keypress should not nag. A bound-but-missing target DOES
   * toast, because that is a real "why didn't that work" moment.
   */
  function triggerQuickKey(slot) {
    const state = App.state;
    if (state.isViewer) return false;
    const r = resolveSlot(slot);
    if (!r) return false;
    if (!r.item) {
      App.showToast(`Quick Key ${slot} points at a deleted item`);
      return false;
    }
    if (r.kind === 'counter') App.setActiveCounterType(r.id);
    else App.setActiveLineType(r.id);
    return true;
  }

  // Slot -> display name, for the Keyboard Map captions. Only bound, live slots.
  function getQuickKeyLabels() {
    const out = {};
    SLOTS.forEach((slot) => {
      const r = resolveSlot(slot);
      if (r && r.item) out[slot] = r.item.name || (r.kind === 'counter' ? 'Counter' : 'Line type');
    });
    return out;
  }

  function optionsHtml(selected) {
    const state = App.state;
    const esc = App.escapeHtml;
    const opt = (kind, item) => {
      const value = kind + ':' + item.id;
      const sel = value === selected ? ' selected' : '';
      return `<option value="${esc(value)}"${sel}>${esc(item.name || '(unnamed)')}</option>`;
    };
    const counters = (state.counters || []).map((c) => opt('counter', c)).join('');
    const lineTypes = (state.lineTypes || []).map((lt) => opt('lineType', lt)).join('');
    return `<option value=""${selected ? '' : ' selected'}>— none —</option>`
      + (counters ? `<optgroup label="Counters">${counters}</optgroup>` : '')
      + (lineTypes ? `<optgroup label="Line Types">${lineTypes}</optgroup>` : '');
  }

  function renderQuickKeysList() {
    const listEl = document.getElementById('quickKeysList');
    if (!listEl) return;
    const state = App.state;
    const esc = App.escapeHtml;
    const empty = !(state.counters || []).length && !(state.lineTypes || []).length;
    const emptyEl = document.getElementById('quickKeysEmpty');
    if (emptyEl) emptyEl.style.display = empty ? 'block' : 'none';

    listEl.innerHTML = SLOTS.map((slot) => {
      const r = resolveSlot(slot);
      const selected = r ? r.kind + ':' + r.id : '';
      const stale = !!(r && !r.item);
      const color = (r && r.item && r.item.color) || null;
      const swatch = color
        ? `<span class="quick-key-swatch" style="background:${esc(color)}"></span>`
        : '<span class="quick-key-swatch is-empty"></span>';
      const staleNote = stale ? '<span class="quick-key-stale" title="The bound item no longer exists">deleted</span>' : '';
      return `<div class="quick-key-row" data-slot="${esc(slot)}">
          <span class="quick-key-cap">${esc(slot)}</span>
          ${swatch}
          <select class="quick-key-select" data-slot="${esc(slot)}" aria-label="Quick Key ${esc(slot)}">${optionsHtml(selected)}</select>
          ${staleNote}
          <button type="button" class="quick-key-clear" data-slot="${esc(slot)}" aria-label="Clear Quick Key ${esc(slot)}"${r ? '' : ' disabled'}>×</button>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.quick-key-select').forEach((sel) => {
      sel.onchange = () => {
        const slot = sel.dataset.slot;
        const raw = sel.value;
        if (!raw) delete getBindings()[slot];
        else {
          const [kind, id] = raw.split(':');
          getBindings()[slot] = { kind, id };
        }
        App.markProjectDirty();
        renderQuickKeysList();
        App.renderKeyboardMapInline && App.renderKeyboardMapInline();
      };
    });
    listEl.querySelectorAll('.quick-key-clear').forEach((btn) => {
      btn.onclick = () => {
        delete getBindings()[btn.dataset.slot];
        App.markProjectDirty();
        renderQuickKeysList();
        App.renderKeyboardMapInline && App.renderKeyboardMapInline();
      };
    });
  }

  function openQuickKeysModal() {
    renderQuickKeysList();
    App.showModal('quickKeysModal');
  }

  const opener = document.getElementById('statusBarQuickKeys');
  if (opener) opener.onclick = () => openQuickKeysModal();
  const closeBtn = document.getElementById('quickKeysModalClose');
  if (closeBtn) closeBtn.onclick = () => App.hideModal('quickKeysModal');
  const doneBtn = document.getElementById('quickKeysDone');
  if (doneBtn) doneBtn.onclick = () => App.hideModal('quickKeysModal');

  App.openQuickKeysModal = openQuickKeysModal;
  App.triggerQuickKey = triggerQuickKey;
  App.getQuickKeyLabels = getQuickKeyLabels;
  App.QUICK_KEY_SLOTS = SLOTS;
})();
