(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Line color picker (registry split #36) -- extracted from app.js: the
  // edit-time color modal (showLineColorModal/applyLineColor), the shared
  // Recent-colors committer (pushRecentColor), and the inline Create-modal
  // picker builder (setupCreateColorPicker). COLORS / nextRecentColors are
  // constants.js classic-script globals.

  function showLineColorModal(currentColor, onApply) {
    App.state.pendingLineColorApply = onApply;
    const inp = document.getElementById('lineColorCustom');
    inp.value = currentColor || '#4a9eff';
    const presetsEl = document.getElementById('lineColorPresets');
    presetsEl.innerHTML = COLORS.map(c =>
      '<span class="color-swatch' + ((currentColor || '').toLowerCase() === c.toLowerCase() ? ' selected' : '') + '" data-color="' + c + '" style="background:' + c + '" title="' + c + '"></span>'
    ).join('');
    presetsEl.querySelectorAll('.color-swatch').forEach(s => {
      s.onclick = () => applyLineColor(s.dataset.color);
    });
    const recentEl = document.getElementById('lineColorRecent');
    const recentGroup = document.getElementById('lineColorRecentGroup');
    recentEl.innerHTML = '';
    (App.state.recentLineColors || []).forEach(c => {
      const s = document.createElement('span');
      s.className = 'color-swatch';
      s.style.background = c;
      s.dataset.color = c;
      s.onclick = () => applyLineColor(c);
      recentEl.appendChild(s);
    });
    recentGroup.style.display = (App.state.recentLineColors || []).length ? 'block' : 'none';
    App.showModal('lineColorModal');
  }
  function applyLineColor(color) {
    if (App.state.pendingLineColorApply) {
      App.state.pendingLineColorApply(color);
      pushRecentColor(color);
      App.state.pendingLineColorApply = null;
      App.hideModal('lineColorModal');
      App.updateUI();
      App.renderPdf();
    }
  }
  // Commit a chosen color to the shared Recent list (App.state.recentLineColors) and
  // persist it app-wide in localStorage. Only off-palette (custom) colors are
  // recorded; preset colors are skipped by nextRecentColors since they are always
  // shown. Shared by applyLineColor (edit picker) and the Create Counter / Create
  // Line Type pickers via App.pushRecentColor.
  function pushRecentColor(color) {
    App.state.recentLineColors = nextRecentColors(App.state.recentLineColors, color, COLORS);
    try { localStorage.setItem('recentLineColors', JSON.stringify(App.state.recentLineColors)); } catch (_) {}
  }
  // Render the inline color picker used by the Create Counter / Create Line Type
  // modals: the 18 preset swatches, a native <input type="color"> custom picker,
  // and a Recent-colors row. The single source of truth for the chosen value is
  // the presets row's dataset.selectedColor (lowercase hex). Clicking any preset
  // or recent swatch, or committing the custom input, updates that value and
  // re-rings the matching swatch by value. Recents are NOT committed here (only
  // on Create), so cancelling never pollutes the Recent list.
  function setupCreateColorPicker(opts) {
    const presetsRow = document.getElementById(opts.presetsRowId);
    const customInput = document.getElementById(opts.customInputId);
    const recentRow = document.getElementById(opts.recentRowId);
    const recentGroup = document.getElementById(opts.recentGroupId);
    if (!presetsRow) return;
    const initial = (opts.defaultColor || COLORS[2]).toLowerCase();

    function ring(color) {
      const c = (color || '').toLowerCase();
      [presetsRow, recentRow].forEach(row => {
        if (!row) return;
        row.querySelectorAll('.color-swatch').forEach(s =>
          s.classList.toggle('selected', (s.dataset.color || '').toLowerCase() === c));
      });
    }
    function select(color) {
      const c = (color || '').toLowerCase();
      presetsRow.dataset.selectedColor = c;
      if (customInput) customInput.value = c;
      ring(c);
    }

    presetsRow.innerHTML = COLORS.map(c =>
      '<span class="color-swatch" data-color="' + c + '" style="background:' + c + '" title="' + c + '"></span>'
    ).join('');
    presetsRow.querySelectorAll('.color-swatch').forEach(s => { s.onclick = () => select(s.dataset.color); });

    if (recentRow) {
      recentRow.innerHTML = '';
      (App.state.recentLineColors || []).forEach(c => {
        const s = document.createElement('span');
        s.className = 'color-swatch';
        s.style.background = c;
        s.dataset.color = c;
        s.title = c;
        s.onclick = () => select(c);
        recentRow.appendChild(s);
      });
    }
    if (recentGroup) recentGroup.style.display = (App.state.recentLineColors || []).length ? '' : 'none';

    if (customInput) customInput.onchange = () => select(customInput.value);

    select(initial);
  }

  const lineColorCancel = document.getElementById('lineColorCancel');
  if (lineColorCancel) lineColorCancel.onclick = () => { App.state.pendingLineColorApply = null; App.hideModal('lineColorModal'); };
  const lineColorCustom = document.getElementById('lineColorCustom');
  if (lineColorCustom) lineColorCustom.onchange = () => applyLineColor(lineColorCustom.value);

  App.showLineColorModal = showLineColorModal;
  App.pushRecentColor = pushRecentColor;
  App.setupCreateColorPicker = setupCreateColorPicker;
})();
