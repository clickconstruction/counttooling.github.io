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

  // Sheet-size correction (compressed / re-boxed PDF fix). The architectural presets and the
  // custom dialog assume 72 pt = 1 real inch of paper; a rescaled page breaks that. When the
  // current page isn't a standard sheet size we warn and offer to correct the preset's
  // pixelsPerUnit by (actual long edge / chosen sheet long edge). PAGE SCALE ONLY — never zones
  // (which inherit the page scale) and never two-point calibration (already ground truth).
  let sheetAnalysis = null;          // last analysis for the current page (page-scale presets)
  let activeSheetCorrection = null;  // { sheetId, factor } in effect, or null (no correction)

  function clearSheetCorrection() {
    sheetAnalysis = null;
    activeSheetCorrection = null;
    const warn = document.getElementById('scaleSheetWarning');
    if (warn) warn.style.display = 'none';
  }
  function setSheetCorrectionFromSheet(sheet) {
    if (!sheet || !sheetAnalysis) { activeSheetCorrection = null; return; }
    const factor = App.sheetCorrectionFactor(sheetAnalysis.widthPt, sheetAnalysis.heightPt, sheet);
    activeSheetCorrection = { sheetId: sheet.id, factor };
  }
  // Show/hide the non-standard-sheet warning + picker for the presets tab and prime the
  // correction. No-op (cleared) for zone mode, a missing analysis, or a true standard size.
  function refreshSheetWarning() {
    const state = App.state;
    const warn = document.getElementById('scaleSheetWarning');
    const sel = document.getElementById('scaleSheetSelect');
    if (!warn || !sel) return;
    if (state.scaleModalApplyTarget === 'zone') { clearSheetCorrection(); return; }
    const a = App.getPageSheetAnalysis(state.currentPage);
    if (!a || a.isStandard) { clearSheetCorrection(); return; }
    sheetAnalysis = a;
    sel.innerHTML = '';
    App.STANDARD_SHEETS.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.label;
      sel.appendChild(opt);
    });
    const offOpt = document.createElement('option');
    offOpt.value = ''; offOpt.textContent = "Non-standard — don't correct";
    sel.appendChild(offOpt);
    sel.value = a.bestGuessSheet ? a.bestGuessSheet.id : '';
    setSheetCorrectionFromSheet(a.bestGuessSheet || null);
    warn.style.display = '';
  }
  // Fold the active sheet correction into a page-scale object built from a preset / custom entry.
  // No-op when no correction is active (standard / true-size page), so the common case is unchanged.
  function withSheetCorrection(scaleObj) {
    if (!activeSheetCorrection) return scaleObj;
    const sheet = App.STANDARD_SHEETS.find(s => s.id === activeSheetCorrection.sheetId);
    scaleObj.pixelsPerUnit *= activeSheetCorrection.factor;
    scaleObj.sheetSize = activeSheetCorrection.sheetId;
    scaleObj.correctionFactor = activeSheetCorrection.factor;
    if (scaleObj.label && sheet) scaleObj.label += ' · ' + sheet.id.replace('_', ' ');
    return scaleObj;
  }

  function updateScalePlaceholder() {
    const unit = document.getElementById('scaleUnit')?.value || 'ft';
    const inp = document.getElementById('scaleValue');
    if (!inp) return;
    if (unit === 'ft') inp.placeholder = "e.g. 5.75 or 5'9";
    else if (unit === 'in') inp.placeholder = "e.g. 69 or 5'9";
    else if (unit === 'm') inp.placeholder = 'e.g. 1.75';
    else if (unit === 'cm') inp.placeholder = 'e.g. 175';
    else if (unit === 'yd') inp.placeholder = 'e.g. 1.92';
    else inp.placeholder = 'e.g. 10';
  }
  function openScaleModal() {
    const state = App.state;
    clearSheetCorrection();   // recomputed by refreshSheetWarning when the presets tab shows
    const finishingTwoPoints = state.scalePointA && state.scalePointB;
    const tabsEl = document.getElementById('scaleModalTabs');
    const pointsPanel = document.getElementById('scalePointsPanel');
    const presetsPanel = document.getElementById('scalePresetsPanel');
    const checkPanel = document.getElementById('scaleCheckPanel');
    const selectOnPdfGroup = document.getElementById('scaleSelectOnPdfGroup');
    const scaleInfo = document.getElementById('scaleInfo');
    const lengthInputGroup = document.getElementById('scaleLengthInputGroup');
    if (checkPanel) checkPanel.style.display = 'none';
    if (finishingTwoPoints && state.scaleCheckMode) {
      // Verify mode: compare the just-measured line against the current scale (never overwrite
      // until the user picks "Use measured"). Show the dedicated check panel, freshly reset.
      tabsEl.style.display = 'none';
      presetsPanel.style.display = 'none';
      pointsPanel.style.display = 'none';
      if (checkPanel) checkPanel.style.display = '';
      const page = state.pages[state.currentPage];
      const sc = page && page.scale;
      const scName = sc ? (sc.label || ((sc.pixelsPerUnit != null ? Number(sc.pixelsPerUnit).toFixed(1) : '?') + ' px/' + (sc.unit || 'ft'))) : 'the current scale';
      const infoEl = document.getElementById('scaleCheckInfo');
      if (infoEl) infoEl.textContent = 'Checking against ' + scName + '. Enter the real length of the line you just measured.';
      const cv = document.getElementById('scaleCheckValue'); if (cv) cv.value = '';
      const cu = document.getElementById('scaleCheckUnit'); if (cu && sc && sc.unit) cu.value = sc.unit;
      const res = document.getElementById('scaleCheckResult'); if (res) res.style.display = 'none';
      document.getElementById('scaleCheckBtn').style.display = '';
      document.getElementById('scaleCheckUseMeasured').style.display = 'none';
      const cc = document.getElementById('scaleCheckCancel'); if (cc) cc.textContent = 'Cancel';
    } else if (finishingTwoPoints) {
      tabsEl.style.display = 'none';
      presetsPanel.style.display = 'none';
      pointsPanel.style.display = '';
      selectOnPdfGroup.style.display = 'none';
      if (lengthInputGroup) lengthInputGroup.style.display = '';
      scaleInfo.textContent = 'Line selected on the plan — enter its real-world length below.';
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
    const refChk = document.getElementById('scaleShowRefLine');
    if (refChk) refChk.checked = !!state.showScaleRefLine;
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
  // Clear the verify/check flow (flag + result UI). Called by every scale-modal exit and by
  // app.js's Escape-key TOOL.SCALE branches (via App.resetScaleCheckMode).
  function resetScaleCheckMode() {
    App.state.scaleCheckMode = false;
    const res = document.getElementById('scaleCheckResult'); if (res) res.style.display = 'none';
    const um = document.getElementById('scaleCheckUseMeasured'); if (um) um.style.display = 'none';
  }
  // Enter verify mode: measure two known points against the CURRENT page scale. Mirrors
  // #scaleSelectOnPdf but sets scaleCheckMode so openScaleModal routes to the check panel.
  function startScaleCheck() {
    const state = App.state;
    const page = state.pages[state.currentPage];
    if (!page || !page.scale || !page.scale.pixelsPerUnit) { App.showToast('Set a scale first, then verify it'); return; }
    state.scaleCheckMode = true;
    App.hideModal('scaleModal');
    state.tool = App.TOOL.SCALE;
    state.scaleMode = App.SCALE_MODES.POINT_A;
    state.scalePointA = null;
    state.scalePointB = null;
    App.updateUI();
    App.renderPdf();
  }
  // The shared two-point apply (extracted from #scaleSet): recalibrate page.scale (or a zone) so
  // the picked line equals `val` in `unit`, stamping a refLine. Reused by #scaleSet and by the
  // verify panel's "Use measured". Returns false (with a toast) when the line is too short.
  function applyTwoPointScale(unit, val) {
    const state = App.state;
    const dist = App.ptDist(state.scalePointA, state.scalePointB);
    if (dist < 1) { App.showToast('Scale line too short — pick two points further apart'); return false; }
    const scaleObj = { pixelsPerUnit: dist / val, unit, label: null, refLine: { x1: state.scalePointA.x, y1: state.scalePointA.y, x2: state.scalePointB.x, y2: state.scalePointB.y } };
    if (applyScaleObjectToZoneOrPage(scaleObj)) return true;
    App.pushUndoSnapshot();
    const page = state.pages[state.currentPage];
    if (page) page.scale = scaleObj;
    App.markProjectDirty();
    App.noteViewerTempScale && App.noteViewerTempScale(state.currentPage);
    state.tool = App.TOOL.NONE;
    state.scaleMode = App.SCALE_MODES.NONE;
    state.scalePointA = null;
    state.scalePointB = null;
    App.hideModal('scaleModal');
    App.updateUI();
    App.renderPdf();
    return true;
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
          if (applyScaleObjectToZoneOrPage(scaleObj)) return;   // zone target: no sheet correction
          App.pushUndoSnapshot();
          const page = state.pages[state.currentPage];
          if (page) page.scale = withSheetCorrection({ pixelsPerUnit: p.pixelsPerUnit, unit: p.unit, label: p.label });
          App.markProjectDirty();
          App.noteViewerTempScale && App.noteViewerTempScale(state.currentPage);
          App.hideModal('scaleModal');
          App.updateUI();
          App.renderPdf();
          App.showToast('Scale set — verify it against a known dimension');
        };
        list.appendChild(btn);
      });
      refreshSheetWarning();
    }
  }
  const setScaleClick = () => {
    const state = App.state;
    resetScaleModalZoneMode();
    resetScaleCheckMode();
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
  document.getElementById('scaleShowRefLine').onchange = (e) => {
    App.state.showScaleRefLine = e.target.checked;   // device view-preference, not project data
    try { localStorage.setItem('showScaleRefLine', String(e.target.checked)); } catch (_) { /* private mode */ }
    App.renderPdf();
  };
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
    resetScaleCheckMode();
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
    if (applyScaleObjectToZoneOrPage(scaleObj)) return;   // zone target: no sheet correction
    App.pushUndoSnapshot();
    const page = state.pages[state.currentPage];
    if (page) page.scale = withSheetCorrection({ pixelsPerUnit, unit: 'ft', label });
    App.markProjectDirty();
    App.noteViewerTempScale && App.noteViewerTempScale(state.currentPage);
    App.hideModal('scaleModal');
    App.updateUI();
    App.renderPdf();
    App.showToast('Scale set — verify it against a known dimension');
  };
  const sheetSelectEl = document.getElementById('scaleSheetSelect');
  if (sheetSelectEl) sheetSelectEl.onchange = (e) => {
    const sheet = App.STANDARD_SHEETS.find(s => s.id === e.target.value) || null;
    setSheetCorrectionFromSheet(sheet);
  };
  document.getElementById('scaleCancel').onclick = () => {
    const state = App.state;
    if (state.tool === App.TOOL.SCALE) { state.tool = App.TOOL.NONE; state.scaleMode = App.SCALE_MODES.NONE; state.scalePointA = null; state.scalePointB = null; }
    resetScaleModalZoneMode();
    resetScaleCheckMode();
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
    applyTwoPointScale(unit, val);   // handles apply + modal close + re-render
  };
  document.getElementById('scaleVerifyBtn').onclick = startScaleCheck;
  document.getElementById('scaleCheckBtn').onclick = () => {
    const state = App.state;
    const page = state.pages[state.currentPage];
    const scale = page && page.scale;
    if (!scale || !scale.pixelsPerUnit) { App.showToast('Set a scale first'); return; }
    if (!state.scalePointA || !state.scalePointB) return;
    const unit = document.getElementById('scaleCheckUnit').value;
    const known = App.parseRealWorldLength(document.getElementById('scaleCheckValue').value, unit);
    if (!known || known <= 0) { App.showToast('Enter a valid length'); return; }
    const dist = App.ptDist(state.scalePointA, state.scalePointB);
    if (dist < 1) { App.showToast('Line too short — pick two points further apart'); return; }
    const { reading, deltaPct } = App.scaleCheckDelta(dist, scale, known, unit);
    const fmt = (v) => unit === 'ft' ? App.formatFeetInchesFromVal(v, 'ft') : (Math.round(v * 100) / 100 + ' ' + unit);
    document.getElementById('scaleCheckExpected').textContent = fmt(known);
    document.getElementById('scaleCheckMeasured').textContent = fmt(reading);
    const absPct = Math.abs(deltaPct);
    const deltaEl = document.getElementById('scaleCheckDelta');
    deltaEl.classList.remove('ok', 'off');
    if (absPct < 1) {
      deltaEl.classList.add('ok');
      deltaEl.textContent = 'Within ' + absPct.toFixed(1) + '% — the scale looks correct.';
    } else {
      deltaEl.classList.add('off');
      deltaEl.textContent = 'Off by about ' + absPct.toFixed(1) + '% (reads ' + (deltaPct > 0 ? 'long' : 'short') + '). Use measured to fix it.';
    }
    document.getElementById('scaleCheckResult').style.display = '';
    document.getElementById('scaleCheckUseMeasured').style.display = '';
    document.getElementById('scaleCheckBtn').style.display = 'none';
    const cc = document.getElementById('scaleCheckCancel'); if (cc) cc.textContent = 'Keep current scale';
  };
  document.getElementById('scaleCheckUseMeasured').onclick = () => {
    const unit = document.getElementById('scaleCheckUnit').value;
    const known = App.parseRealWorldLength(document.getElementById('scaleCheckValue').value, unit);
    if (!known || known <= 0) { App.showToast('Enter a valid length'); return; }
    if (applyTwoPointScale(unit, known)) resetScaleCheckMode();   // recalibrate to the measured line
  };
  document.getElementById('scaleCheckCancel').onclick = () => {
    const state = App.state;
    if (state.tool === App.TOOL.SCALE) { state.tool = App.TOOL.NONE; state.scaleMode = App.SCALE_MODES.NONE; state.scalePointA = null; state.scalePointB = null; }
    resetScaleCheckMode();
    App.hideModal('scaleModal');
    App.updateUI();
    App.renderPdf();
  };

  App.openScaleModal = openScaleModal;
  App.resetScaleModalZoneMode = resetScaleModalZoneMode;
  App.resetScaleCheckMode = resetScaleCheckMode;
})();
