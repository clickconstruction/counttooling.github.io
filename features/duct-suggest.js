/*
 * features/duct-suggest.js — the design-build ductulator suggestion (DUCT-PLAN
 * unit D6, "Design-build layer 1"). LIVE information, never automation: while
 * a duct trace is in progress and the system has CFM data, the size chip grows
 * a suggestion line ("450 CFM downstream · suggests 12×10 @ 0.08″/100′ — S
 * accepts") and the S popover's FIRST section is the pre-highlighted suggested
 * size — one tap applies it through the normal applyDuctSizeStep path.
 * Suggestions NEVER auto-apply (DUCT-PLAN philosophy: inference with override).
 *
 * The number: duct-model's ductDraftRemainingCfm — the system's total device
 * CFM minus what is already served (devices attached to a committed run of the
 * same system, or passed by the trace: attached to the draft polyline strictly
 * behind its tip). Devices are placed counter markers whose counter type
 * carries a `cfm` (unit D6's counter field); attachment/system inheritance is
 * the documented pure rule in duct-model.js (nearest-run-within-DUCT_TAP_SNAP_PDF,
 * marker-group fallback). Devices are read from the page's MERGED annotations
 * (diffusers often live on their own layer); runs from the ACTIVE canvas (the
 * duct-sidebar/schedule convention). The draft's placed vertices only — the
 * rubber-band cursor doesn't attach devices, so the number changes on clicks,
 * not on every hover.
 *
 * The size: duct-model's suggestRoundAndRect at the per-project design knobs
 * (state.ductSettings.frictionInPer100ft / maxVelocityFpm — the settings row
 * on the Duct Schedule modal, features/duct-schedule.js). D8 (the master
 * walkthrough's round-first rule): BOTH sizes are offered — '10"Ø or 12×8',
 * spiral first — as the chip line's dual label and as TWO popover chips,
 * either of which applies through applyDuctSizeStep; `size` stays the primary
 * (round) answer for the S-accept path. The binding constraint is NAMED when
 * the velocity cap governs ("velocity-limited") — DUCT-PLAN §5.
 *
 * Surfaces: App.getDuctDraftSuggestion() (consumed by duct-tool.js's overlay
 * for the chip line, and the spec seam), plus the popover section registered
 * at order 5 via the D2 seam (features/duct-size-popover.js).
 *
 * D7 additions (the balance glue this file owns because it owns the device
 * collection): App.collectDuctDevices(pageIdx) (the CFM-marker collector,
 * now shared with room-sizer's balance rows), App.getDuctSystemEquipmentPos
 * (pageIdx-scoped resolution of a system group's equipment marker — the
 * documented matching ladder in duct-model's ductEquipmentPosForGroup: tag
 * name ↔ counter name, then the group's single non-CFM marker), and
 * App.getDuctSystemDesignedCfm(groupId) (the capacity line's "designed"
 * number: duct-model's ductSystemDesignedCfm per page — the D6 accumulation
 * from each system root's equipment end, with equipmentPos passed through so
 * root-run orientation is right regardless of trace direction).
 *
 * D15 (the per-marker CFM override): a placed marker may carry its own
 * `cfmOverride` — "CFM for this one…" on the marker's context menu
 * (#ctxMarkerCfm, shown by app.js's showContextMenu for markers of a
 * CFM-carrying type) opens the tiny #markerCfmModal (the highlight-name
 * modal pattern: one number input, Save / Cancel, Enter commits); Save writes
 * a positive value as marker.cfmOverride and DELETES the key when the field
 * is cleared, so an un-overridden marker stays byte-identical. BOTH
 * collectors below resolve every marker through duct-model's ductMarkerCfm
 * (override ?? type CFM), so attachment, accumulation, the live suggestion,
 * the room served sums and the system designed totals all read one number.
 * App.getCounterCfmOverrideText(counter) renders the "(override 250)" note
 * the sidebar row title and the details modal show beside the type CFM.
 * Markers serialize wholesale, so the key rides save/load + export/import.
 *
 * Boundary rule: read shared deps from App.* at call time; pure duct math by
 * bare duct-model.js globals. See ARCHITECTURE.md "Feature files / window.App
 * registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Placed air devices on a page: every marker that resolves to a CFM through
  // duct-model's ductMarkerCfm (D15: the marker's own cfmOverride, else its
  // counter type's cfm), from the MERGED annotations (any layer), carrying its
  // marker group and — D8 — the counter's per-type flex-drop length (null =
  // the 5' table default, resolved in duct-model's tallyFlexDrops).
  function collectDuctDevices(pageIdx) {
    const state = App.state;
    const page = state.pages[pageIdx];
    if (!page) return [];
    const ann = App.getMergedAnnotationsForPage(page);
    const byId = new Map((state.counters || []).map((c) => [c.id, c]));
    const out = [];
    Object.entries(ann?.counterMarkers || {}).forEach(([typeId, markers]) => {
      const c = byId.get(typeId);
      if (!c) return;
      (markers || []).forEach((m) => {
        if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
        const cfm = ductMarkerCfm(m, c);
        if (!(cfm > 0)) return;
        out.push({ x: m.x, y: m.y, cfm: cfm, groupId: m.group || null, flexDropFt: c.flexDropFt > 0 ? c.flexDropFt : null });
      });
    });
    return out;
  }

  // D15: the "(override 250)" note for a counter whose placed markers carry a
  // cfmOverride that differs from the type's CFM — distinct values, ascending
  // ("(override 250, 300)"); null when no marker differs. Walks every page's
  // canvases (the details modal is project-scoped, like its usage list).
  function getCounterCfmOverrideText(counter) {
    if (!counter) return null;
    const values = new Set();
    (App.state.pages || []).forEach((p) => {
      App.getPageCanvases(p).forEach((cv) => {
        (cv.annotations?.counterMarkers?.[counter.id] || []).forEach((m) => {
          const o = m && m.cfmOverride;
          if (Number.isFinite(o) && o > 0 && o !== counter.cfm) values.add(o);
        });
      });
    });
    if (!values.size) return null;
    return '(override ' + [...values].sort((a, b) => a - b).map((v) => Math.round(v).toLocaleString()).join(', ') + ')';
  }

  // D8 neck-size prefill (DUCT-PLAN master walkthrough, MINIMAL surface):
  // "150 CFM → 8"Ø neck" from duct-model's D1 table, for a CFM counter whose
  // name carries NO explicit size already (8"Ø, 12×8, …). Consumed by the
  // sidebar counter-row title attr and the details-modal line — no new UI.
  const EXPLICIT_SIZE_RE = /\d+\s*["″]?\s*[Øø]|\d+\s*[x×]\s*\d+/;
  function getDuctNeckSuggestionText(counter) {
    if (!counter || !(counter.cfm > 0)) return null;
    if (EXPLICIT_SIZE_RE.test(counter.name || '')) return null;
    const n = typeof suggestNeckSize === 'function' ? suggestNeckSize(counter.cfm) : null;
    if (!n) return null;
    return Math.round(counter.cfm) + ' CFM → ' + n.neckDIn + '"Ø neck'
      + (n.overCapacity ? ' (over the table — split the drop)' : '');
  }

  // --- D7 balance glue ------------------------------------------------------

  // EVERY placed marker on a page (any counter type, CFM or not) with the
  // fields duct-model's equipment-matching ladder reads: position, the
  // counter-type name, its CFM (null when the type has none — that absence is
  // rule 3's "equipment-looking" signal), and the marker's group.
  function collectPageMarkers(pageIdx) {
    const state = App.state;
    const page = state.pages[pageIdx];
    if (!page) return [];
    const ann = App.getMergedAnnotationsForPage(page);
    const byId = new Map((state.counters || []).map((c) => [c.id, c]));
    const out = [];
    Object.entries(ann?.counterMarkers || {}).forEach(([typeId, markers]) => {
      const c = byId.get(typeId);
      if (!c) return;
      (markers || []).forEach((m) => {
        if (m && Number.isFinite(m.x) && Number.isFinite(m.y)) {
          out.push({ x: m.x, y: m.y, counterName: c.name || '', cfm: ductMarkerCfm(m, c), groupId: m.group || null });
        }
      });
    });
    return out;
  }

  /** The system group's equipment-marker position on one page (PDF-space), or
   * null — duct-model's documented ladder over that page's placed markers. */
  function getDuctSystemEquipmentPos(groupId, pageIdx) {
    const group = (App.state.groups || []).find((g) => g.id === groupId);
    if (!group) return null;
    return ductEquipmentPosForGroup(group, collectPageMarkers(pageIdx));
  }

  /**
   * The system's DESIGNED CFM across the project (the §3 capacity line's left
   * number): per page, the D6 accumulation over the ACTIVE canvas's runs (the
   * duct-sidebar/schedule convention) and the MERGED devices, from each
   * system root's equipment end — equipmentPos resolved per page and passed
   * through so a return main traced from the far grille orients correctly.
   */
  function getDuctSystemDesignedCfm(groupId) {
    const state = App.state;
    let total = 0;
    (state.pages || []).forEach((p, pi) => {
      const ann = App.getActiveAnnotations(p, pi);
      const runs = ann?.ductRuns || [];
      if (!runs.length) return;
      const devices = collectDuctDevices(pi);
      if (!devices.length) return;
      total += ductSystemDesignedCfm({
        runs: runs,
        devices: devices,
        systemGroupId: groupId,
        equipmentPos: getDuctSystemEquipmentPos(groupId, pi),
      }) || 0;
    });
    return total;
  }

  /**
   * The live suggestion for the in-progress trace, or null when there is no
   * draft / no CFM data / nothing left downstream (the clean-absence rule).
   * Returns { cfm, totalCfm, servedCfm, size, sizeLabel, binding, velocityFpm,
   *           frictionRate, chipText, popoverLabel }.
   */
  function getDuctDraftSuggestion() {
    const state = App.state;
    const draft = state.drawingDuct;
    if (!draft || state.tool !== App.TOOL.DUCT) return null;
    const page = state.pages[state.currentPage];
    if (!page) return null;
    const devices = collectDuctDevices(state.currentPage);
    if (!devices.length) return null;
    const ann = App.getActiveAnnotations(page);
    const remaining = ductDraftRemainingCfm({
      runs: ann?.ductRuns || [],
      draft: { systemGroupId: draft.systemGroupId || null, vertices: draft.vertices, segments: draft.segments },
      devices: devices,
    });
    if (!remaining || !(remaining.cfm > 0)) return null;
    const ds = App.getDuctSettings ? App.getDuctSettings() : {};
    const frictionRate = ds.frictionInPer100ft > 0 ? ds.frictionInPer100ft : 0.08;
    const maxVelocityFpm = ds.maxVelocityFpm > 0 ? ds.maxVelocityFpm : 1200;
    const s = suggestRoundAndRect(remaining.cfm, { frictionRate: frictionRate, maxVelocityFpm: maxVelocityFpm });
    if (!s) return null;
    // D8 round-first dual suggestion (the master walkthrough): BOTH sizes are
    // offered — spiral first ('10"Ø or 12×8'), the rect equivalent beside it
    // (absent when no rect fits the aspect cap). `size` stays the primary
    // (round) size — the S-accept path and older consumers keep working.
    const roundSize = makeRoundSize(s.round.diameterIn);
    const rectSize = s.rect ? makeRectSize(s.rect.w, s.rect.h) : null;
    const sizeLabel = formatDuctSize(roundSize) + (rectSize ? ' or ' + formatDuctSize(rectSize) : '');
    const cfmLabel = Math.round(remaining.cfm).toLocaleString();
    const limitNote = s.binding === 'velocity' ? ' · velocity-limited' : '';
    return {
      cfm: remaining.cfm,
      totalCfm: remaining.totalCfm,
      servedCfm: remaining.servedCfm,
      size: roundSize,
      roundSize: roundSize,
      rectSize: rectSize,
      sizeLabel: sizeLabel,
      binding: s.binding,
      velocityFpm: s.round.velocityFpm,
      frictionRate: frictionRate,
      chipText: cfmLabel + ' CFM downstream · suggests ' + sizeLabel + ' @ ' + frictionRate + '″/100′' + limitNote + ' — S accepts',
      popoverLabel: 'Suggested: ' + sizeLabel + ' · from ' + cfmLabel + ' CFM' + limitNote,
    };
  }

  // --- the S-popover section (order 5 — above the step grid: it IS the
  // answer; D2's seam doc reserves this slot for D6). Returns false with no
  // suggestion so projects without CFM data see no empty chrome. -------------
  App.registerDuctPopoverSection && App.registerDuctPopoverSection({
    id: 'ductulator-suggestion',
    order: 5,
    render(container, ctx) {
      const sug = getDuctDraftSuggestion();
      if (!sug) return false;
      const label = document.createElement('div');
      label.className = 'duct-popover-section-label';
      label.textContent = 'Suggested';
      container.appendChild(label);
      // D8 round-first dual chips: spiral first, the rect equivalent beside
      // it — tapping EITHER applies that size through applyDuctSizeStep.
      const row = document.createElement('div');
      row.className = 'duct-suggest-row';
      [[sug.roundSize, 'round'], [sug.rectSize, 'rect']].forEach(([size]) => {
        if (!size) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'duct-suggest-chip';
        const chipLabel = 'Suggested: ' + formatDuctSize(size) + ' · from '
          + Math.round(sug.cfm).toLocaleString() + ' CFM'
          + (sug.binding === 'velocity' ? ' · velocity-limited' : '');
        b.title = chipLabel;
        b.setAttribute('aria-label', chipLabel);
        b.textContent = formatDuctSize(size);
        b.onclick = () => ctx.applySize(size);
        row.appendChild(b);
      });
      container.appendChild(row);
      const from = document.createElement('div');
      from.className = 'duct-suggest-from';
      from.textContent = 'from ' + Math.round(sug.cfm).toLocaleString() + ' CFM @ '
        + sug.frictionRate + '″/100′' + (sug.binding === 'velocity' ? ' · velocity-limited' : '');
      container.appendChild(from);
    },
  });

  // --- D15: the per-marker CFM override ---------------------------------------
  // The marker being edited while #markerCfmModal is up ({ marker, counter }),
  // null otherwise. The context-menu target (state.ctxTarget = hitTest's
  // { type: 'marker', typeId, index }) names the ACTIVE canvas's marker — the
  // same array #ctxDelete splices.
  let editingMarkerCfm = null;

  function openMarkerCfmModal(marker, counter) {
    if (!marker || !counter) return;
    editingMarkerCfm = { marker: marker, counter: counter };
    const hint = document.getElementById('markerCfmHint');
    if (hint) {
      hint.textContent = counter.cfm > 0
        ? 'Leave empty to use the counter\u2019s CFM (' + Math.round(counter.cfm).toLocaleString() + ')'
        : 'Leave empty for no CFM on this one';
    }
    const input = document.getElementById('markerCfmInput');
    input.value = marker.cfmOverride > 0 ? marker.cfmOverride : '';
    input.placeholder = counter.cfm > 0 ? String(counter.cfm) : 'e.g. 150';
    App.showModal('markerCfmModal');
    input.focus();
    input.select();
  }

  function commitMarkerCfm() {
    if (!editingMarkerCfm) return;
    const { marker } = editingMarkerCfm;
    const v = parseFloat(document.getElementById('markerCfmInput').value);
    const next = Number.isFinite(v) && v > 0 ? v : null;
    const cur = marker.cfmOverride > 0 ? marker.cfmOverride : null;
    editingMarkerCfm = null;
    App.hideModal('markerCfmModal');
    if (next === cur) return;
    App.pushUndoSnapshotCurrentPage();
    if (next == null) delete marker.cfmOverride;   // cleared = back to the type's CFM, key gone
    else marker.cfmOverride = next;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }

  function cancelMarkerCfm() {
    editingMarkerCfm = null;
    App.hideModal('markerCfmModal');
  }

  const ctxMarkerCfmBtn = document.getElementById('ctxMarkerCfm');
  if (ctxMarkerCfmBtn) ctxMarkerCfmBtn.onclick = () => {
    const state = App.state;
    const t = state.ctxTarget;
    document.getElementById('contextMenu').classList.remove('visible');
    state.ctxTarget = null;
    if (!t || t.type !== 'marker') return;
    const page = state.pages[state.currentPage];
    const ann = page ? App.getActiveAnnotations(page) : null;
    const marker = ann?.counterMarkers?.[t.typeId]?.[t.index];
    const counter = (state.counters || []).find((c) => c.id === t.typeId);
    if (marker && counter) openMarkerCfmModal(marker, counter);
  };
  document.getElementById('markerCfmSave')?.addEventListener('click', commitMarkerCfm);
  document.getElementById('markerCfmCancel')?.addEventListener('click', cancelMarkerCfm);
  document.getElementById('markerCfmInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitMarkerCfm(); }
  });

  App.getDuctDraftSuggestion = getDuctDraftSuggestion;
  // D15: the per-marker override entry (spec seam + the context-menu row) and
  // the "(override 250)" note (sidebar row title + details modal).
  App.openMarkerCfmModal = openMarkerCfmModal;
  App.cancelMarkerCfm = cancelMarkerCfm;
  App.getCounterCfmOverrideText = getCounterCfmOverrideText;
  // D7 balance glue: shared device collection + the system designed/equipment
  // queries (consumed by room-sizer's balance rows and sidebar-lists' system
  // capacity line; equipmentPos wiring is D6's documented follow-up).
  App.collectDuctDevices = collectDuctDevices;
  App.getDuctSystemEquipmentPos = getDuctSystemEquipmentPos;
  App.getDuctSystemDesignedCfm = getDuctSystemDesignedCfm;
  // D8: the neck-size prefill text (sidebar row title + details-modal line).
  App.getDuctNeckSuggestionText = getDuctNeckSuggestionText;
})();
