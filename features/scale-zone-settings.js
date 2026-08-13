/*
 * features/scale-zone-settings.js - the Scale Zone settings modal (the zone
 * label's show/size/position appearance prefs), a sibling of
 * features/multiply-zone-settings.js born from a field report: the zone's
 * fallback "0.23 ft/pt" label rendered dead-center over the very fixtures the
 * zone exists to count. Scale zones previously had no label controls at all
 * (always shown, always centered, size borrowed from multiplyZoneSettings);
 * they now read state.scaleZoneSettings (default position top-left), which
 * rides project save/load + export/import like multiplyZoneSettings.
 *
 * Loaded as a classic <script src="/features/scale-zone-settings.js"> AFTER
 * app.js. Its own IIFE: registers openScaleZoneSettingsModal onto App (the
 * inbound call sites - right-click on the header / sidebar Scale Zone button
 * via features/tool-context-menu.js - call it at user-action time), and binds
 * the modal's ShowLabel toggle / LabelSize slider / Close buttons at this
 * file's load. Every shared dependency here (state, showModal, hideModal,
 * markProjectDirty, renderAnnotations, updateUI) is already published on App,
 * so this file adds no new publishes. Boundary rule: read shared deps from
 * App.* at call time, never captured at load. See ARCHITECTURE.md "Feature
 * files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  const DEFAULTS = { showLabelOnZone: true, labelSize: 14, labelPosition: 'top-left' };
  const VALID_POS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

  document.getElementById('scaleZoneSettingsShowLabelBtn').onclick = (e) => {
    e.preventDefault();
    const cb = document.getElementById('scaleZoneSettingsShowLabel');
    cb.checked = !cb.checked;
    document.getElementById('scaleZoneSettingsShowLabelBtn').setAttribute('aria-pressed', cb.checked);
  };
  document.getElementById('scaleZoneSettingsLabelSize').oninput = () => {
    const v = document.getElementById('scaleZoneSettingsLabelSize').value;
    const valEl = document.getElementById('scaleZoneSettingsLabelSizeVal');
    if (valEl) valEl.textContent = v;
  };
  function openScaleZoneSettingsModal() {
    const state = App.state;
    const s = state.scaleZoneSettings || DEFAULTS;
    const showLabelEl = document.getElementById('scaleZoneSettingsShowLabel');
    const showLabelBtn = document.getElementById('scaleZoneSettingsShowLabelBtn');
    const labelSizeEl = document.getElementById('scaleZoneSettingsLabelSize');
    const checked = s.showLabelOnZone !== false;
    if (showLabelEl) showLabelEl.checked = checked;
    if (showLabelBtn) showLabelBtn.setAttribute('aria-pressed', checked);
    if (labelSizeEl) {
      labelSizeEl.value = String(s.labelSize ?? 14);
      const valEl = document.getElementById('scaleZoneSettingsLabelSizeVal');
      if (valEl) valEl.textContent = String(s.labelSize ?? 14);
    }
    const labelPosEl = document.getElementById('scaleZoneSettingsLabelPosition');
    if (labelPosEl) labelPosEl.value = (VALID_POS.includes(s.labelPosition) ? s.labelPosition : 'top-left');
    App.showModal('scaleZoneSettingsModal');
  }
  document.getElementById('scaleZoneSettingsClose').onclick = () => {
    const state = App.state;
    if (!state.scaleZoneSettings) state.scaleZoneSettings = { ...DEFAULTS };
    const showLabelEl = document.getElementById('scaleZoneSettingsShowLabel');
    const labelSizeEl = document.getElementById('scaleZoneSettingsLabelSize');
    const labelPosEl = document.getElementById('scaleZoneSettingsLabelPosition');
    state.scaleZoneSettings.showLabelOnZone = showLabelEl ? showLabelEl.checked : true;
    const size = parseInt(labelSizeEl?.value || '14', 10);
    state.scaleZoneSettings.labelSize = isNaN(size) ? 14 : Math.max(1, Math.min(24, size));
    state.scaleZoneSettings.labelPosition = VALID_POS.includes(labelPosEl?.value) ? labelPosEl.value : 'top-left';
    App.markProjectDirty();
    App.hideModal('scaleZoneSettingsModal');
    App.renderAnnotations();
    App.updateUI();
  };

  App.openScaleZoneSettingsModal = openScaleZoneSettingsModal;
})();
