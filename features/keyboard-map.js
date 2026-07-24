/*
 * features/keyboard-map.js - the Keyboard Map modal (keyboardMapModal), opened
 * by the "See Keyboard" button at the top of the Macros / Keyboard Shortcuts
 * modal. Renders a 65%-layout keyboard silhouette where every key that carries
 * a shortcut lights up (accent-yellow on the dark board) and hovering / tapping
 * a lit key names its action in the caption below.
 *
 * Loaded as a classic <script src="features/keyboard-map.js"> AFTER app.js.
 * Its own IIFE: it reaches the shared helpers through the window.App registry,
 * registers openKeyboardMapModal back onto App, and binds the "See Keyboard"
 * opener + the modal's close button at this file's load. A zero-new-dep split
 * (like legend-settings / multiply-zone-settings): both deps it uses,
 * App.showModal and App.hideModal, were already published.
 *
 * SINGLE SOURCE OF TRUTH: the lit keys are DERIVED from the Macros table
 * (#macrosModal .macros-table) at open time, not hand-declared here — each row's
 * <kbd> cells give the keys and the last cell gives the action. Adding a
 * shortcut row to that table therefore lights its key automatically, and the two
 * surfaces can never drift. Same idea as features/burger-menu.js rebuilding its
 * rows from the currently-visible header controls. keyboard-map.spec.js asserts
 * the derivation (every <kbd> token in the table resolves to a key on the board).
 *
 * The board layout below is presentation only — it is deliberately a superset of
 * the mapped keys (a recognizable keyboard), so unmapped keys render as the grey
 * silhouette. Boundary rule: read shared deps from App.* at call time, never
 * captured at load. See ARCHITECTURE.md "Feature files / window.App registry".
 * No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  // Board geometry: a 65% (60% + arrow cluster) ANSI layout. Every row totals 15
  // width units; the grid is 60 columns, so one unit spans 4 columns and 0.25-unit
  // widths (1.25/1.5/1.75/2.25) all land on exact column boundaries.
  const ROW_UNITS = 15;
  const COLS_PER_UNIT = 4;

  // [displayLabel, keyId, widthUnits]. keyId defaults to the label when omitted;
  // widthUnits defaults to 1. keyId is what normalizeKeyToken() produces, so the
  // ids here are the join between the board and the Macros table.
  const KB_ROWS = [
    [
      ['esc', 'Escape'], ['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9'], ['0'],
      ['-'], ['='], ['⌫', 'Backspace', 2]
    ],
    [
      ['tab', 'Tab', 1.5], ['Q'], ['W'], ['E'], ['R'], ['T'], ['Y'], ['U'], ['I'], ['O'], ['P'],
      ['['], [']'], ['\\', '\\', 1.5]
    ],
    [
      ['caps', 'CapsLock', 1.75], ['A'], ['S'], ['D'], ['F'], ['G'], ['H'], ['J'], ['K'], ['L'],
      [';'], ["'"], ['enter', 'Enter', 2.25]
    ],
    [
      ['shift', 'Shift', 2.25], ['Z'], ['X'], ['C'], ['V'], ['B'], ['N'], ['M'], [','], ['.'], ['/'],
      ['shift', 'Shift', 1.75], ['↑', 'ArrowUp']
    ],
    [
      ['ctrl', 'Control', 1.25], ['alt', 'Alt', 1.25], ['⌘', 'Meta', 1.25],
      ['', 'Space', 7], ['⌘', 'Meta', 1.25],
      ['←', 'ArrowLeft'], ['↓', 'ArrowDown'], ['→', 'ArrowRight']
    ]
  ];

  // Keys that only ever appear alongside another key. They still light up (they
  // ARE part of a shortcut) but get the softer outlined treatment so the primary
  // action keys are what the eye lands on.
  const MODIFIER_IDS = new Set(['Shift', 'Control', 'Meta', 'Alt']);

  // Macros-table <kbd> text -> board key id. Anything unrecognized that is a
  // single character normalizes to its uppercase form (covers every letter and
  // digit row); anything else returns null and is ignored.
  const TOKEN_ALIASES = {
    '←': 'ArrowLeft', '→': 'ArrowRight', '↑': 'ArrowUp', '↓': 'ArrowDown',
    'shift': 'Shift', 'ctrl': 'Control', 'control': 'Control',
    'cmd': 'Meta', 'command': 'Meta', '⌘': 'Meta',
    'alt': 'Alt', 'option': 'Alt', '⌥': 'Alt',
    'esc': 'Escape', 'escape': 'Escape',
    'space': 'Space', 'spacebar': 'Space',
    'enter': 'Enter', 'return': 'Enter', '⏎': 'Enter',
    'tab': 'Tab', 'caps': 'CapsLock', 'capslock': 'CapsLock',
    'backspace': 'Backspace', '⌫': 'Backspace'
  };

  const DEFAULT_CAPTION = 'Hover or tap a highlighted key to see what it does.';
  const MAX_CAPTION_ACTIONS = 3;

  function normalizeKeyToken(raw) {
    const text = (raw || '').trim();
    if (!text) return null;
    const alias = TOKEN_ALIASES[text.toLowerCase()] || TOKEN_ALIASES[text];
    if (alias) return alias;
    if (text.length === 1) return text.toUpperCase();
    return null;
  }

  /*
   * Walk the Macros table and return keyId -> [action, ...]. Rows without any
   * <kbd> (the section headers, the <th> header row, and the Scale Zone row
   * whose key cell is an em dash) drop out on their own.
   */
  function collectMacroKeys() {
    const map = new Map();
    const table = document.querySelector('#macrosModal .macros-table');
    if (!table) return map;
    table.querySelectorAll('tr').forEach((tr) => {
      const kbds = tr.querySelectorAll('kbd');
      if (!kbds.length) return;
      const cells = tr.querySelectorAll('td');
      const action = cells.length ? (cells[cells.length - 1].textContent || '').trim() : '';
      if (!action) return;
      kbds.forEach((kbd) => {
        const id = normalizeKeyToken(kbd.textContent);
        if (!id) return;
        const actions = map.get(id) || [];
        if (!actions.includes(action)) actions.push(action);
        map.set(id, actions);
      });
    });
    return map;
  }

  function captionFor(label, actions) {
    const shown = actions.slice(0, MAX_CAPTION_ACTIONS).join(' · ');
    const extra = actions.length - MAX_CAPTION_ACTIONS;
    return label + ' — ' + shown + (extra > 0 ? ' · +' + extra + ' more' : '');
  }

  // A readable name for the caption / aria-label, since several keycaps are
  // glyphs or (for Space) intentionally blank.
  function captionKeyName(displayLabel, keyId) {
    const NAMES = {
      Space: 'Space', Escape: 'Esc', Enter: 'Enter', Backspace: 'Backspace',
      Tab: 'Tab', CapsLock: 'Caps Lock', Shift: 'Shift', Control: 'Ctrl',
      Meta: 'Cmd', Alt: 'Alt', ArrowLeft: 'Left arrow', ArrowRight: 'Right arrow',
      ArrowUp: 'Up arrow', ArrowDown: 'Down arrow'
    };
    return NAMES[keyId] || displayLabel || keyId;
  }

  function buildBoard() {
    const board = document.getElementById('keyboardMapBoard');
    if (!board) return;
    const macroKeys = collectMacroKeys();
    board.innerHTML = '';

    KB_ROWS.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      rowEl.style.gridTemplateColumns = 'repeat(' + (ROW_UNITS * COLS_PER_UNIT) + ', 1fr)';
      row.forEach((def) => {
        const label = def[0];
        const keyId = def[1] || def[0];
        const width = def[2] || 1;
        const actions = macroKeys.get(keyId);
        const isMapped = !!(actions && actions.length);
        const isModifier = isMapped && MODIFIER_IDS.has(keyId);

        const keyEl = document.createElement('div');
        keyEl.className = 'kb-key'
          + (isMapped ? (isModifier ? ' is-modifier' : ' is-mapped') : '');
        keyEl.style.gridColumn = 'span ' + Math.round(width * COLS_PER_UNIT);
        keyEl.textContent = label;
        keyEl.dataset.key = keyId;
        if (isMapped) {
          const name = captionKeyName(label, keyId);
          const caption = captionFor(name, actions);
          keyEl.dataset.caption = caption;
          keyEl.setAttribute('tabindex', '0');
          keyEl.setAttribute('role', 'button');
          keyEl.setAttribute('title', caption);
          keyEl.setAttribute('aria-label', caption);
        } else {
          keyEl.setAttribute('aria-hidden', 'true');
        }
        rowEl.appendChild(keyEl);
      });
      board.appendChild(rowEl);
    });
  }

  function setCaption(text) {
    const el = document.getElementById('keyboardMapCaption');
    if (el) el.textContent = text || DEFAULT_CAPTION;
  }

  function openKeyboardMapModal() {
    buildBoard();
    setCaption(null);
    App.showModal('keyboardMapModal');
  }

  // Delegated interaction: pointer hover is mouse-only (a touch "hover" would
  // fire and immediately vanish), taps and keyboard focus both pin the caption.
  function wireBoardInteraction() {
    const board = document.getElementById('keyboardMapBoard');
    if (!board) return;
    const captionOf = (target) => {
      const key = target && target.closest ? target.closest('.kb-key') : null;
      return key && key.dataset.caption ? key.dataset.caption : null;
    };
    board.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const caption = captionOf(e.target);
      if (caption) setCaption(caption);
    });
    board.addEventListener('pointerout', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (captionOf(e.target)) setCaption(null);
    });
    board.addEventListener('click', (e) => {
      const caption = captionOf(e.target);
      if (caption) setCaption(caption);
    });
    board.addEventListener('focusin', (e) => {
      const caption = captionOf(e.target);
      if (caption) setCaption(caption);
    });
  }

  const seeKeyboardBtn = document.getElementById('macrosSeeKeyboard');
  if (seeKeyboardBtn) seeKeyboardBtn.onclick = () => openKeyboardMapModal();
  const closeBtn = document.getElementById('keyboardMapClose');
  if (closeBtn) closeBtn.onclick = () => App.hideModal('keyboardMapModal');
  wireBoardInteraction();

  App.openKeyboardMapModal = openKeyboardMapModal;
})();
