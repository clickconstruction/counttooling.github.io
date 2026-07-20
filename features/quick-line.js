/*
 * features/quick-line.js - the Quick Line modal, extracted from the app.js IIFE
 * as the sixteenth feature-file split under the window.App registry pattern. This
 * is the "Quick" tab body of #chooseLineTypeModal: a size/material picker (backed
 * by the persisted line modifiers) that auto-builds a line-type name and color,
 * opened by the Quick Plumbing "Line" button (#plumLineBtn).
 *
 * Loaded as a classic <script src="features/quick-line.js"> AFTER app.js. Its own
 * IIFE: it reaches the cross-cutting state + helpers through the shared window.App
 * registry that app.js populates during its own load, registers
 * populateQuickLineModal back onto App, and binds the #plumLineBtn opener + the
 * #quickLine* handlers at this file's load.
 *
 * Registry handoff: populateQuickLineModal used to be published *from* app.js and
 * is consumed by features/choose-create-line-type.js (showLineTypeTab('quick')).
 * That publish line moved here -- this file now registers App.populateQuickLineModal
 * and choose-create-line-type.js keeps reading it via App.* at call time (load
 * order between the two feature files does not matter: registration at load, the
 * call on user action). The tab-switch itself stays in choose-create-line-type.js
 * (reached here via App.showLineTypeTab('quick') from #plumLineBtn).
 *
 * Scope is the Quick Line modal only. getLineModifiers/saveLineModifiers (the
 * line-modifier persistence, used app-wide) and the separate "Add Line Type"
 * modal (#addLineType / #lineTypeModal) stay in app.js.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function populateQuickLineModal() {
    const mods = App.getLineModifiers();
    const esc = (s) => App.escapeHtml(s);
    const sizeSel = document.getElementById('quickLineSize');
    const materialSel = document.getElementById('quickLineMaterial');
    sizeSel.innerHTML = mods.sizes.map(s => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('');
    materialSel.innerHTML = mods.materials.map(m => '<option value="' + esc(m) + '">' + esc(m) + '</option>').join('');
    updateQuickLineNamePreview();
    const swatchEl = document.getElementById('quickLineSwatch');
    if (swatchEl) {
      swatchEl.onclick = () => {
        const mods = App.getLineModifiers();
        App.showLineColorModal(mods.defaultColor || App.COLORS[2], (color) => {
          mods.defaultColor = color;
          App.saveLineModifiers(mods);
          swatchEl.style.background = color;
        });
      };
      swatchEl.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); swatchEl.click(); } };
    }
    document.getElementById('quickLineRemoveSize').disabled = mods.sizes.length <= 1;
    document.getElementById('quickLineRemoveMaterial').disabled = mods.materials.length <= 1;
  }
  function updateQuickLineNamePreview() {
    const size = document.getElementById('quickLineSize').value;
    const material = document.getElementById('quickLineMaterial').value;
    const name = [size, material].filter(Boolean).join(' ');
    const nameEl = document.getElementById('quickLineName');
    if (nameEl) nameEl.value = name;
    const swatchEl = document.getElementById('quickLineSwatch');
    if (swatchEl) swatchEl.style.background = App.getLineModifiers().defaultColor || App.COLORS[2];
  }
  document.getElementById('plumLineBtn').onclick = () => {
    populateQuickLineModal();
    App.showLineTypeTab('quick');
    App.showModal('chooseLineTypeModal');
  };
  document.getElementById('quickLineSize').onchange = updateQuickLineNamePreview;
  document.getElementById('quickLineMaterial').onchange = updateQuickLineNamePreview;
  function removeLineModifier(kind, selectId) {
    const sel = document.getElementById(selectId);
    const value = sel?.value;
    if (!value) return;
    const mods = App.getLineModifiers();
    const arr = mods[kind];
    if (arr.length <= 1) return;
    const idx = arr.indexOf(value);
    if (idx < 0) return;
    arr.splice(idx, 1);
    App.saveLineModifiers(mods);
    populateQuickLineModal();
    sel.value = arr[0] || arr[Math.max(0, idx - 1)];
    updateQuickLineNamePreview();
  }
  document.getElementById('quickLineRemoveSize').onclick = () => removeLineModifier('sizes', 'quickLineSize');
  document.getElementById('quickLineRemoveMaterial').onclick = () => removeLineModifier('materials', 'quickLineMaterial');
  document.getElementById('quickLineAddSize').onclick = () => {
    const v = prompt('Enter new size:');
    if (v && v.trim()) {
      const mods = App.getLineModifiers();
      mods.sizes.push(v.trim());
      App.saveLineModifiers(mods);
      populateQuickLineModal();
      document.getElementById('quickLineSize').value = v.trim();
      updateQuickLineNamePreview();
    }
  };
  document.getElementById('quickLineAddMaterial').onclick = () => {
    const v = prompt('Enter new material:');
    if (v && v.trim()) {
      const mods = App.getLineModifiers();
      mods.materials.push(v.trim());
      App.saveLineModifiers(mods);
      populateQuickLineModal();
      document.getElementById('quickLineMaterial').value = v.trim();
      updateQuickLineNamePreview();
    }
  };
  document.getElementById('quickLineCancel').onclick = () => App.hideModal('chooseLineTypeModal');
  document.getElementById('quickLineAdd').onclick = () => {
    const state = App.state;
    const size = document.getElementById('quickLineSize').value;
    const material = document.getElementById('quickLineMaterial').value;
    const computedName = [size, material].filter(Boolean).join(' ');
    const nameInput = document.getElementById('quickLineName');
    const name = (nameInput?.value?.trim() || computedName) || 'Line';
    const mods = App.getLineModifiers();
    const color = mods.defaultColor || App.COLORS[2];
    const curveSel = document.querySelector('input[name="quickLineCurve"]:checked');
    const curveStyle = curveSel ? curveSel.value : 'straight';
    App.pushUndoSnapshot();
    const newLt = { id: App.uid(), name, color, curveStyle };
    state.lineTypes.push(newLt);
    state.activeLineTypeId = newLt.id;
    App.markProjectDirty();
    state.pagesListCollapsed = true;
    document.getElementById('pagesSection').classList.add('collapsed');
    document.getElementById('pagesCollapseIcon').textContent = '▶';
    App.hideModal('chooseLineTypeModal');
    App.updateUI();
  };

  App.populateQuickLineModal = populateQuickLineModal;
})();
