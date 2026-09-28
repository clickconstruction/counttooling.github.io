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

  // Physical left-to-right order of the number row, which is also the order of
  // the dialog's key strip. '0' is last because that is where it sits on a keyboard.
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

  // Reverse lookup: which slot (if any) is bound to this item? Used by the
  // sidebar list renderers to badge bound rows — the bindings teach themselves
  // during normal work instead of living only in the modal. First match wins
  // (binding the same item to two slots is pointless but not illegal).
  function getQuickKeySlotFor(kind, id) {
    const bindings = getBindings();
    for (const slot of SLOTS) {
      const b = bindings[slot];
      if (b && b.kind === kind && b.id === id) return slot;
    }
    return null;
  }

  // The sidebar rows render badges from the bindings, so a binding change must
  // refresh them. Defensive: both renderers live in app.js and are publish-only.
  function refreshSidebarBadges() {
    App.renderCountersList && App.renderCountersList();
    App.renderLineTypesList && App.renderLineTypesList();
  }

  /*
   * ARTBOARD CARRY. Bindings are per-project (ids are uid()-scoped), but
   * Save/Load Artboard stores the palette WITH its ids — so bindings saved
   * alongside it (user_airboard.number_key_bindings) resolve against the
   * restored palette, and a standard layout follows the user into every new
   * bid. Two lifecycle rules, both here so they can't drift apart:
   *
   * seedQuickKeysFromArtboard(bindings, {replace}) — sign-in auto-restore seeds
   * FILL-IF-EMPTY (never stomps an active layout); My Settings -> Load from
   * Cloud passes replace:true (the user just confirmed "replace my artboard").
   * Sets the seeded-lineage flag.
   *
   * applyProjectQuickKeys(incoming) — every project-data intake (cloud load,
   * PDF-intake canvas restore, canvas-JSON import) funnels through this: a
   * payload WITH bindings replaces (and clears the lineage flag — they're the
   * project's now); a payload WITHOUT keeps an artboard-seeded layout but drops
   * a previous project's, so dead ids never leak between unrelated projects.
   */
  function sanitizeBindings(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const cleaned = {};
    SLOTS.forEach((slot) => {
      const b = raw[slot];
      if (b && typeof b === 'object' && (b.kind === 'counter' || b.kind === 'lineType') && typeof b.id === 'string' && b.id) {
        cleaned[slot] = { kind: b.kind, id: b.id };
      }
    });
    return Object.keys(cleaned).length ? cleaned : null;
  }

  function seedQuickKeysFromArtboard(raw, opts) {
    const state = App.state;
    const cleaned = sanitizeBindings(raw);
    if (!cleaned) return false;
    const replace = !!(opts && opts.replace);
    if (!replace && Object.keys(state.numberKeyBindings || {}).length) return false;
    state.numberKeyBindings = cleaned;
    state.numberKeyBindingsSeededFromArtboard = true;
    refreshSidebarBadges();
    return true;
  }

  function applyProjectQuickKeys(incoming) {
    const state = App.state;
    const cleaned = sanitizeBindings(incoming);
    if (cleaned) {
      state.numberKeyBindings = cleaned;
      state.numberKeyBindingsSeededFromArtboard = false;
    } else if (!state.numberKeyBindingsSeededFromArtboard) {
      state.numberKeyBindings = {};
    }
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

  /*
   * THE DIALOG: one armed key, one list (2026-09-28; the pure half is
   * quick-keys-model.js). It was ten native dropdowns under a search box that
   * filtered them unseen. Now the strip shows the ten keys, one of them armed;
   * the list under the search shows every counter and line type with its
   * symbol, its colour, what the project has placed and the key it is on. A
   * pick lands on the armed key and the next empty key arms, so the search
   * word is kept: "sk", Enter, Enter, Enter fills three keys.
   *
   * An item sits on ONE key: picking one that is already on another key moves it.
   */
  let armedSlot = '1';
  let litIndex = 0;
  let shown = [];          // the ranked rows on screen, [{ kind, id, name, used, item, usedText }]
  let palette = [];        // the same rows in palette order, built once per open

  const M = () => window.QuickKeysModel;
  const valueOf = (row) => row.kind + ':' + row.id;

  // What the project has placed, read once when the dialog opens (the sheets do
  // not change under it). The numbers are the sidebar's: a counter's total with
  // repeats, a line type's runs and length.
  function buildPalette() {
    const state = App.state;
    const pages = state.pages || [];
    const counters = (state.counters || []).map((c) => {
      let used = 0;
      pages.forEach((p) => { used += App.counterTally(App.getMergedAnnotationsForPage(p), c.id).withRepeats; });
      return { kind: 'counter', id: c.id, name: c.name || '(unnamed)', used, item: c, usedText: used ? String(used) : '' };
    });
    const lineTypes = (state.lineTypes || []).map((lt) => {
      let runs = 0, lenFt = 0, lenPx = 0;
      pages.forEach((p, pi) => {
        const ann = App.getMergedAnnotationsForPage(p);
        const add = (item, isPoly) => {
          runs++;
          const s = App.getLineLengthSplitForTotals(item, pi, isPoly, ann);
          lenFt += s.feet; lenPx += s.px;
        };
        (ann?.quickLines || []).filter((q) => q.lineTypeId === lt.id).forEach((q) => add(q, false));
        (ann?.polylines || []).filter((poly) => poly.lineTypeId === lt.id).forEach((poly) => add(poly, true));
      });
      return { kind: 'lineType', id: lt.id, name: lt.name || '(unnamed)', used: runs, item: lt, usedText: runs ? App.formatFeetPx(lenFt, lenPx) : '' };
    });
    palette = counters.concat(lineTypes);
  }

  function symbolHtml(row) {
    const esc = App.escapeHtml;
    const color = row.item.color || '#e8c547';
    if (row.kind === 'lineType') return `<span class="quick-key-line" style="background:${esc(color)}"></span>`;
    if (!row.item.icon) return `<span class="quick-key-swatch" style="background:${esc(color)}"></span>`;
    return `<svg class="quick-key-icon" viewBox="${esc(App.iconVbFor(row.item.icon))}" width="18" height="18" aria-hidden="true"><path fill="${esc(color)}" d="${esc(row.item.icon)}"/></svg>`;
  }

  function renderStrip() {
    const stripEl = document.getElementById('quickKeysStrip');
    if (!stripEl) return;
    const esc = App.escapeHtml;
    stripEl.innerHTML = M().QUICK_KEY_SLOTS.map((slot) => {
      const r = resolveSlot(slot);
      const stale = !!(r && !r.item);
      const name = r && r.item ? (r.item.name || '(unnamed)') : '';
      const cls = 'quick-key-cap' + (slot === armedSlot ? ' is-armed' : '') + (r ? ' is-bound' : '') + (stale ? ' is-stale' : '');
      // What the key holds, small: a counter's own symbol in its colour, else a colour bar.
      const color = (r && r.item && r.item.color) || '#e8c547';
      const bar = r && r.item && r.kind === 'counter' && r.item.icon
        ? `<svg class="quick-key-cap-icon" viewBox="${esc(App.iconVbFor(r.item.icon))}" width="14" height="14" aria-hidden="true"><path fill="${esc(color)}" d="${esc(r.item.icon)}"/></svg>`
        : r && r.item
          ? `<span class="quick-key-cap-bar" style="background:${esc(color)}"></span>`
          : '<span class="quick-key-cap-bar"></span>';
      const label = 'Key ' + slot + (stale ? ', holds a deleted item' : name ? ', holds ' + name : ', empty');
      return `<button type="button" class="${cls}" data-slot="${esc(slot)}" aria-pressed="${slot === armedSlot ? 'true' : 'false'}" aria-label="${esc(label)}" title="${esc(name || (stale ? 'Deleted item' : 'Empty'))}"><span class="quick-key-cap-digit">${esc(slot)}</span>${bar}</button>`;
    }).join('');
  }

  function renderNow() {
    const nowEl = document.getElementById('quickKeysNow');
    if (!nowEl) return;
    const esc = App.escapeHtml;
    const r = resolveSlot(armedSlot);
    const clear = `<button type="button" class="quick-key-clear" data-slot="${esc(armedSlot)}">Clear key ${esc(armedSlot)}</button>`;
    if (!r) {
      nowEl.innerHTML = `<span class="quick-key-now-text">Key ${esc(armedSlot)} is empty. Pick what goes on it.</span>`;
    } else if (!r.item) {
      nowEl.innerHTML = `<span class="quick-key-now-text">Key ${esc(armedSlot)} held an item that was <span class="quick-key-stale">deleted</span>. Pick another, or clear it.</span>${clear}`;
    } else {
      const row = palette.find((x) => x.kind === r.kind && x.id === r.id) || { kind: r.kind, id: r.id, item: r.item };
      nowEl.innerHTML = `<span class="quick-key-now-text">Key ${esc(armedSlot)} holds</span>${symbolHtml(row)}<span class="quick-key-now-name">${esc(r.item.name || '(unnamed)')}</span>${clear}`;
    }
  }

  function renderResults() {
    const listEl = document.getElementById('quickKeysResults');
    if (!listEl) return;
    const esc = App.escapeHtml;
    const query = (document.getElementById('quickKeysSearch')?.value || '').trim();
    if (!shown.length) {
      listEl.innerHTML = '<div class="empty-state quick-key-none">No counter or line type has that name.</div>';
      return;
    }
    if (litIndex >= shown.length) litIndex = shown.length - 1;
    let lastKind = '';
    listEl.innerHTML = shown.map((row, i) => {
      let head = '';
      if (!query && row.kind !== lastKind) {
        lastKind = row.kind;
        head = `<div class="quick-key-group">${row.kind === 'counter' ? 'Counters' : 'Line types'}</div>`;
      }
      const slot = M().quickKeySlotOf(getBindings(), row.kind, row.id);
      const badge = slot ? `<span class="quick-key-slot-badge" title="On key ${esc(slot)}">${esc(slot)}</span>` : '';
      const kind = query ? `<span class="quick-key-kind">${row.kind === 'counter' ? 'counter' : 'line type'}</span>` : '';
      const cls = 'quick-key-item' + (i === litIndex ? ' is-lit' : '') + (slot ? ' is-bound' : '');
      return `${head}<div class="${cls}" role="option" aria-selected="${i === litIndex ? 'true' : 'false'}" data-index="${i}" data-value="${esc(valueOf(row))}">${symbolHtml(row)}<span class="quick-key-item-name">${esc(row.name)}</span>${badge}${kind}<span class="quick-key-used">${esc(row.usedText)}</span></div>`;
    }).join('');
    const lit = listEl.querySelector('.quick-key-item.is-lit');
    if (lit && lit.scrollIntoView) lit.scrollIntoView({ block: 'nearest' });
  }

  function rank() {
    const query = document.getElementById('quickKeysSearch')?.value || '';
    shown = M().rankQuickKeyItems(palette, query);
    litIndex = M().firstUnboundQuickKeyIndex(shown, getBindings());
  }

  function renderQuickKeysList() {
    const state = App.state;
    const empty = !(state.counters || []).length && !(state.lineTypes || []).length;
    const emptyEl = document.getElementById('quickKeysEmpty');
    if (emptyEl) emptyEl.style.display = empty ? 'block' : 'none';
    const bodyEl = document.getElementById('quickKeysBody');
    if (bodyEl) bodyEl.style.display = empty ? 'none' : '';
    renderStrip();
    renderNow();
    renderResults();
  }

  function bindingsChanged() {
    App.markProjectDirty();
    refreshSidebarBadges();
    App.renderKeyboardMapInline && App.renderKeyboardMapInline();
  }

  function armSlot(slot) {
    if (M().QUICK_KEY_SLOTS.indexOf(slot) < 0) return;
    armedSlot = slot;
    renderStrip();
    renderNow();
  }

  function clearSlot(slot) {
    if (!getBindings()[slot]) return;
    delete getBindings()[slot];
    litIndex = M().firstUnboundQuickKeyIndex(shown, getBindings());
    bindingsChanged();
    renderQuickKeysList();
  }

  // Put a row on the armed key, then arm the next empty key.
  function putOnArmedKey(index) {
    const row = shown[index];
    if (!row) return;
    const bindings = getBindings();
    const was = M().quickKeySlotOf(bindings, row.kind, row.id);
    if (was && was !== armedSlot) delete bindings[was];
    bindings[armedSlot] = { kind: row.kind, id: row.id };
    armedSlot = M().nextOpenQuickKeySlot(bindings, armedSlot);
    litIndex = M().firstUnboundQuickKeyIndex(shown, bindings);
    bindingsChanged();
    renderQuickKeysList();
    // A typed word is kept for the next key, selected so the next word replaces it.
    const searchEl = document.getElementById('quickKeysSearch');
    if (searchEl && document.activeElement === searchEl) searchEl.select();
  }

  function moveLit(by) {
    if (!shown.length) return;
    litIndex = Math.max(0, Math.min(shown.length - 1, litIndex + by));
    renderResults();
  }

  function openQuickKeysModal() {
    // Fresh filter every open — a stale search quietly hiding most of the
    // palette is worse than retyping two letters.
    const searchEl = document.getElementById('quickKeysSearch');
    if (searchEl) searchEl.value = '';
    buildPalette();
    armedSlot = M().firstOpenQuickKeySlot(getBindings());
    rank();
    renderQuickKeysList();
    const listEl = document.getElementById('quickKeysResults');
    if (listEl) listEl.scrollTop = 0;
    App.showModal('quickKeysModal');
    // A mouse gets the caret in the search; a finger does not, or the on-screen
    // keyboard would cover the list it came to read.
    if (searchEl && window.matchMedia && window.matchMedia('(pointer: fine)').matches) searchEl.focus();
  }

  const opener = document.getElementById('statusBarQuickKeys');
  if (opener) opener.onclick = () => openQuickKeysModal();
  // Project Settings row — the mobile path: the status-bar link is desktop-only,
  // but the settings modal is reachable everywhere (sidebar logo on mobile), so a
  // tablet-with-keyboard user can still set up bindings. Mirrors the
  // settingsMacros handler in app.js: close settings, open ours.
  const settingsOpener = document.getElementById('settingsQuickKeys');
  if (settingsOpener) settingsOpener.onclick = () => { App.hideModal('settingsModal'); openQuickKeysModal(); };

  // One listener per container, bound once: the rows are rebuilt on every render.
  const stripEl = document.getElementById('quickKeysStrip');
  if (stripEl) {
    stripEl.onclick = (e) => {
      const cap = e.target.closest('.quick-key-cap');
      if (cap) armSlot(cap.dataset.slot);
    };
    stripEl.onkeydown = (e) => {
      const cap = e.target.closest('.quick-key-cap');
      if (!cap) return;
      const slots = M().QUICK_KEY_SLOTS;
      const at = slots.indexOf(cap.dataset.slot);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = slots[(at + (e.key === 'ArrowRight' ? 1 : slots.length - 1)) % slots.length];
        armSlot(next);
        stripEl.querySelector('.quick-key-cap[data-slot="' + next + '"]')?.focus();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        armSlot(cap.dataset.slot);
        clearSlot(cap.dataset.slot);
        stripEl.querySelector('.quick-key-cap[data-slot="' + cap.dataset.slot + '"]')?.focus();
      }
    };
  }
  const nowEl = document.getElementById('quickKeysNow');
  if (nowEl) nowEl.onclick = (e) => {
    const btn = e.target.closest('.quick-key-clear');
    if (btn) clearSlot(btn.dataset.slot);
  };
  const resultsEl = document.getElementById('quickKeysResults');
  if (resultsEl) resultsEl.onclick = (e) => {
    const row = e.target.closest('.quick-key-item');
    if (row) putOnArmedKey(Number(row.dataset.index));
  };
  const searchInput = document.getElementById('quickKeysSearch');
  if (searchInput) {
    // The input sits outside the rebuilt containers, so typing keeps focus.
    searchInput.oninput = () => { rank(); renderResults(); };
    searchInput.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveLit(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveLit(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); putOnArmedKey(litIndex); }
    };
  }
  const doneBtn = document.getElementById('quickKeysDone');
  if (doneBtn) doneBtn.onclick = () => App.hideModal('quickKeysModal');

  App.openQuickKeysModal = openQuickKeysModal;
  App.triggerQuickKey = triggerQuickKey;
  App.getQuickKeyLabels = getQuickKeyLabels;
  App.getQuickKeySlotFor = getQuickKeySlotFor;
  App.seedQuickKeysFromArtboard = seedQuickKeysFromArtboard;
  App.applyProjectQuickKeys = applyProjectQuickKeys;
})();
