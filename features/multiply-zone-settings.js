/*
 * features/multiply-zone-settings.js - the Multiply Zone settings modal,
 * extracted from the app.js IIFE as the fifth feature-file split under the
 * window.App registry pattern.
 *
 * Loaded as a classic <script src="features/multiply-zone-settings.js"> AFTER
 * app.js. Its own IIFE: it reaches the cross-cutting state + helpers through the
 * shared window.App registry that app.js populates during its own load,
 * registers openMultiplyZoneSettingsModal back onto App (the two inbound call
 * sites - right-click on the header / sidebar Multiply Zone button - call
 * App.openMultiplyZoneSettingsModal at user-action time), and binds the modal's
 * ShowLabel toggle / LabelSize slider / Close buttons at this file's load.
 *
 * This is the settings modal only (appearance prefs). The Multiply Zone apply
 * flow (the X-tool draw + multiplyZoneModal + getMultiplyZoneForPoint/...ForLine)
 * stays in app.js. Every shared dependency here (state, showModal, hideModal,
 * markProjectDirty, renderPdf, updateUI) was already published on App, so this
 * file adds no new publishes. Boundary rule: read shared deps from App.* at call
 * time, never captured at load. See ARCHITECTURE.md "Feature files / window.App
 * registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  document.getElementById('multiplyZoneSettingsShowLabelBtn').onclick = (e) => {
    e.preventDefault();
    const cb = document.getElementById('multiplyZoneSettingsShowLabel');
    cb.checked = !cb.checked;
    document.getElementById('multiplyZoneSettingsShowLabelBtn').setAttribute('aria-pressed', cb.checked);
  };
  document.getElementById('multiplyZoneSettingsLabelSize').oninput = () => {
    const v = document.getElementById('multiplyZoneSettingsLabelSize').value;
    const valEl = document.getElementById('multiplyZoneSettingsLabelSizeVal');
    if (valEl) valEl.textContent = v;
  };
  function openMultiplyZoneSettingsModal() {
    const state = App.state;
    const s = state.multiplyZoneSettings || { showLabelOnZone: true, defaultMultiplier: 2, labelSize: 14, labelPosition: 'center' };
    const showLabelEl = document.getElementById('multiplyZoneSettingsShowLabel');
    const showLabelBtn = document.getElementById('multiplyZoneSettingsShowLabelBtn');
    const defaultMultEl = document.getElementById('multiplyZoneSettingsDefaultMult');
    const labelSizeEl = document.getElementById('multiplyZoneSettingsLabelSize');
    const checked = s.showLabelOnZone !== false;
    if (showLabelEl) showLabelEl.checked = checked;
    if (showLabelBtn) showLabelBtn.setAttribute('aria-pressed', checked);
    if (defaultMultEl) defaultMultEl.value = String(s.defaultMultiplier ?? 2);
    if (labelSizeEl) {
      labelSizeEl.value = String(s.labelSize ?? 14);
      const valEl = document.getElementById('multiplyZoneSettingsLabelSizeVal');
      if (valEl) valEl.textContent = String(s.labelSize ?? 14);
    }
    const labelPosEl = document.getElementById('multiplyZoneSettingsLabelPosition');
    if (labelPosEl) labelPosEl.value = (['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(s.labelPosition) ? s.labelPosition : 'center');
    App.showModal('multiplyZoneSettingsModal');
  }
  document.getElementById('multiplyZoneSettingsClose').onclick = () => {
    const state = App.state;
    if (!state.multiplyZoneSettings) state.multiplyZoneSettings = { showLabelOnZone: true, defaultMultiplier: 2, labelSize: 14, labelPosition: 'center' };
    const showLabelEl = document.getElementById('multiplyZoneSettingsShowLabel');
    const defaultMultEl = document.getElementById('multiplyZoneSettingsDefaultMult');
    const labelSizeEl = document.getElementById('multiplyZoneSettingsLabelSize');
    const labelPosEl = document.getElementById('multiplyZoneSettingsLabelPosition');
    state.multiplyZoneSettings.showLabelOnZone = showLabelEl ? showLabelEl.checked : true;
    const mult = parseInt(defaultMultEl?.value || '2', 10);
    state.multiplyZoneSettings.defaultMultiplier = isNaN(mult) || mult < 1 ? 2 : mult;
    const size = parseInt(labelSizeEl?.value || '14', 10);
    state.multiplyZoneSettings.labelSize = isNaN(size) ? 14 : Math.max(8, Math.min(24, size));
    const validPos = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
    state.multiplyZoneSettings.labelPosition = validPos.includes(labelPosEl?.value) ? labelPosEl.value : 'center';
    App.markProjectDirty();
    App.hideModal('multiplyZoneSettingsModal');
    App.renderPdf();
    App.updateUI();
  };

  App.openMultiplyZoneSettingsModal = openMultiplyZoneSettingsModal;
})();
