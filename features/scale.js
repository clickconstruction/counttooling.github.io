/*
 * features/scale.js - the Scale modal (scaleModal), extracted from the app.js
 * IIFE as the thirteenth feature-file split under the window.App registry
 * pattern. This is the picker opened by the Set Scale buttons / S hotkey, reused
 * for three jobs: setting a per-page scale, creating a scale zone, and editing a
 * scale zone (state.scaleModalApplyTarget === 'zone').
 *
 * Loaded as a classic <script src="features/scale.js"> AFTER app.js. Its own
 * IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, registers
 * openScaleModal + resetScaleModalZoneMode back onto App, and binds the modal's
 * tab clicks, unit change, Select-on-PDF, Cancel buttons, custom-fraction Apply,
 * Set button, and the #setScale / #setScaleSidebar openers at this file's load.
 *
 * First split to route geometry.js globals (ptDist, parseFraction,
 * parseRealWorldLength) and the SCALE_* constants through the registry, so the
 * feature reads them via App.* (the features/*.js ESLint group only grants
 * browser globals; bare geometry names would trip no-undef).
 *
 * Scope is the Scale modal only. The toolbar tool buttons that shared the old
 * grab-bag section (#measureBtn/#moveBtn/#quickLine/#undoBtn/#redoBtn/
 * #polylineBtn/#highlightBtn/#multiplyZoneBtn/#scaleZoneBtn/#deleteZoneBtn) stay
 * in app.js. The five external callers (the canvas two-point finish, the
 * scale-zone context-menu Edit, and the Escape-key close branch) reach this
 * modal via App.openScaleModal / App.resetScaleModalZoneMode at call time, with
 * their zone-entry state/DOM setup left inline in app.js.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  function updateScalePlaceholder() {
    const unit = document.getElementById('scaleUnit')?.value || 'ft';
    const inp = document.getElementById('scaleValue');
    if (!inp) return;
    if (unit === 'ft') inp.placeholder = "e.g. 5'9\" or 5.75";
    else if (unit === 'in') inp.placeholder = "e.g. 5'9\" or 69";
    else inp.placeholder = 'e.g. 10';
  }
  function openScaleModal() {
    const state = App.state;
    const finishingTwoPoints = state.scalePointA && state.scalePointB;
    const tabsEl = document.getElementById('scaleModalTabs');
    const pointsPanel = document.getElementById('scalePointsPanel');
    const presetsPanel = document.getElementById('scalePresetsPanel');
    const selectOnPdfGroup = document.getElementById('scaleSelectOnPdfGroup');
    const scaleInfo = document.getElementById('scaleInfo');
    const lengthInputGroup = document.getElementById('scaleLengthInputGroup');
    if (finishingTwoPoints) {
      tabsEl.style.display = 'none';
      presetsPanel.style.display = 'none';
      pointsPanel.style.display = '';
      selectOnPdfGroup.style.display = 'none';
      if (lengthInputGroup) lengthInputGroup.style.display = '';
      scaleInfo.textContent = 'You selected a line spanning ' + Math.round(App.ptDist(state.scalePointA, state.scalePointB)) + ' pdf-pts.';
      updateScalePlaceholder();
    } else {
      tabsEl.style.display = '';
      selectOnPdfGroup.style.display = '';
      if (lengthInputGroup) lengthInputGroup.style.display = 'none';
      if (state.scaleModalApplyTarget === 'zone') {
        if (state.pendingScaleZoneEdit != null) {
          const page = state.pages[state.currentPage];
          const ann = page && App.getActiveAnnotations(page);
          const z = ann?.scaleZones?.[state.pendingScaleZoneEdit.zoneIndex];
          const cur = z?.scale ? (z.scale.label || ((z.scale.unit || 'ft') + ' @ ' + (z.scale.pixelsPerUnit != null ? Number(z.scale.pixelsPerUnit).toFixed(2) : '?') + ' px/unit')) : '';
          scaleInfo.textContent = cur ? ('Current: ' + cur + '. Choose a new scale below.') : 'Choose a scale for this zone.';
        } else {
          scaleInfo.textContent = 'Lines fully inside this zone will use the scale you choose below.';
        }
      } else {
        scaleInfo.textContent = 'Click Select on PDF, then click two points on the drawing to define a scale line.';
      }
      showScaleTab('presets');
    }
    App.showModal('scaleModal');
  }
  function resetScaleModalZoneMode() {
    const state = App.state;
    state.scaleModalApplyTarget = null;
    state.pendingScaleZone = null;
    state.pendingScaleZoneEdit = null;
    const h2 = document.querySelector('#scaleModal h2');
    if (h2) h2.textContent = 'Set Scale';
  }
  function applyScaleObjectToZoneOrPage(scaleObj) {
    const state = App.state;
    if (state.scaleModalApplyTarget !== 'zone') return false;
    App.pushUndoSnapshot();
    const edit = state.pendingScaleZoneEdit;
    const pending = state.pendingScaleZone;
    const page = state.pages[state.currentPage];
    const canvas = page && App.ensureActiveCanvas(page);
    resetScaleModalZoneMode();
    App.hideModal('scaleModal');
    state.tool = App.TOOL.NONE;
    state.scaleMode = App.SCALE_MODES.NONE;
    state.scalePointA = null;
    state.scalePointB = null;
    if (canvas) {
      if (!canvas.annotations.scaleZones) canvas.annotations.scaleZones = [];
      if (edit && canvas.annotations.scaleZones[edit.zoneIndex]) {
        canvas.annotations.scaleZones[edit.zoneIndex].scale = { ...scaleObj };
      } else if (pending) {
        canvas.annotations.scaleZones.push({ x1: pending.x1, y1: pending.y1, x2: pending.x2, y2: pending.y2, scale: { ...scaleObj }, id: App.uid() });
      }
    }
    App.markProjectDirty();
    App.updateUI();
    App.renderPdf();
    return true;
  }
  function showScaleTab(tab) {
    const state = App.state;
    document.querySelectorAll('#scaleModalTabs .counter-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('scalePointsPanel').style.display = tab === 'points' ? '' : 'none';
    document.getElementById('scalePresetsPanel').style.display = tab === 'presets' ? '' : 'none';
    if (tab === 'points') {
      const hasTwoPoints = state.scalePointA && state.scalePointB;
      const lengthInputGroup = document.getElementById('scaleLengthInputGroup');
      if (lengthInputGroup) lengthInputGroup.style.display = hasTwoPoints ? '' : 'none';
      if (hasTwoPoints) updateScalePlaceholder();
    }
    if (tab === 'presets') {
      const list = document.getElementById('scalePresetsList');
      list.innerHTML = '';
      App.SCALE_PRESETS.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = p.label;
        btn.onclick = () => {
          const scaleObj = { pixelsPerUnit: p.pixelsPerUnit, unit: p.unit, label: p.label };
          if (applyScaleObjectToZoneOrPage(scaleObj)) return;
          App.pushUndoSnapshot();
          const page = state.pages[state.currentPage];
          if (page) page.scale = { pixelsPerUnit: p.pixelsPerUnit, unit: p.unit, label: p.label };
          App.markProjectDirty();
          App.hideModal('scaleModal');
          App.updateUI();
          App.renderPdf();
        };
        list.appendChild(btn);
      });
    }
  }
  const setScaleClick = () => {
    const state = App.state;
    resetScaleModalZoneMode();
    state.scalePointA = null;
    state.scalePointB = null;
    state.scaleMode = App.SCALE_MODES.NONE;
    state.tool = App.TOOL.NONE;
    openScaleModal();
  };
  document.getElementById('setScale').onclick = setScaleClick;
  document.getElementById('setScaleSidebar').onclick = setScaleClick;

  document.querySelectorAll('#scaleModalTabs .counter-tab').forEach(t => t.onclick = () => showScaleTab(t.dataset.tab));
  document.getElementById('scaleUnit').onchange = updateScalePlaceholder;
  document.getElementById('scaleSelectOnPdf').onclick = () => {
    const state = App.state;
    App.hideModal('scaleModal');
    state.tool = App.TOOL.SCALE;
    state.scaleMode = App.SCALE_MODES.POINT_A;
    state.scalePointA = null;
    state.scalePointB = null;
    App.updateUI();
    App.renderPdf();
  };
  document.getElementById('scalePresetsCancel').onclick = () => {
    const state = App.state;
    if (state.tool === App.TOOL.SCALE) { state.tool = App.TOOL.NONE; state.scaleMode = App.SCALE_MODES.NONE; state.scalePointA = null; state.scalePointB = null; }
    resetScaleModalZoneMode();
    App.hideModal('scaleModal');
    App.updateUI();
  };
  document.getElementById('scaleCustomApply').onclick = () => {
    const state = App.state;
    const fractionStr = document.getElementById('scaleCustomFraction').value;
    const feetStr = document.getElementById('scaleCustomFeet').value;
    const fractionInches = App.parseFraction(fractionStr);
    const feet = parseFloat(feetStr);
    if (!fractionInches || !feet || feet <= 0) {
      App.showToast('Enter a valid fraction and feet');
      return;
    }
    const pixelsPerUnit = (fractionInches * 72) / feet;
    const fractionDisplay = String(fractionStr).trim();
    const label = fractionDisplay + '" = ' + feet + ' ft';
    const scaleObj = { pixelsPerUnit, unit: 'ft', label };
    if (applyScaleObjectToZoneOrPage(scaleObj)) return;
    App.pushUndoSnapshot();
    const page = state.pages[state.currentPage];
    if (page) page.scale = { pixelsPerUnit, unit: 'ft', label };
    App.markProjectDirty();
    App.hideModal('scaleModal');
    App.updateUI();
    App.renderPdf();
  };
  document.getElementById('scaleCancel').onclick = () => {
    const state = App.state;
    if (state.tool === App.TOOL.SCALE) { state.tool = App.TOOL.NONE; state.scaleMode = App.SCALE_MODES.NONE; state.scalePointA = null; state.scalePointB = null; }
    resetScaleModalZoneMode();
    App.hideModal('scaleModal');
    App.updateUI();
  };
  document.getElementById('scaleSet').onclick = () => {
    const state = App.state;
    const unit = document.getElementById('scaleUnit').value;
    const val = App.parseRealWorldLength(document.getElementById('scaleValue').value, unit);
    if (!val || val <= 0 || !state.scalePointA || !state.scalePointB) {
      if (!state.scalePointA || !state.scalePointB) return;
      App.showToast('Enter a valid length');
      return;
    }
    const scaleObj = { pixelsPerUnit: App.ptDist(state.scalePointA, state.scalePointB) / val, unit, label: null };
    if (applyScaleObjectToZoneOrPage(scaleObj)) return;
    App.pushUndoSnapshot();
    const page = state.pages[state.currentPage];
    if (page) page.scale = scaleObj;
    App.markProjectDirty();
    state.tool = App.TOOL.NONE;
    state.scaleMode = App.SCALE_MODES.NONE;
    state.scalePointA = null;
    state.scalePointB = null;
    App.hideModal('scaleModal');
    App.updateUI();
    App.renderPdf();
  };

  App.openScaleModal = openScaleModal;
  App.resetScaleModalZoneMode = resetScaleModalZoneMode;
})();
