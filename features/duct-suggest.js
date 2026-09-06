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
 * on the Duct Schedule modal, features/duct-schedule.js). The offered size
 * follows the draft's current shape (rect draft → rect equivalent, round →
 * round), and the binding constraint is NAMED when the velocity cap governs
 * ("velocity-limited") — DUCT-PLAN §5.
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
 * Boundary rule: read shared deps from App.* at call time; pure duct math by
 * bare duct-model.js globals. See ARCHITECTURE.md "Feature files / window.App
 * registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Placed air devices on a page: every marker of a counter type with cfm > 0,
  // from the MERGED annotations (any layer), carrying its marker group.
  function collectDuctDevices(pageIdx) {
    const state = App.state;
    const page = state.pages[pageIdx];
    if (!page) return [];
    const ann = App.getMergedAnnotationsForPage(page);
    const byId = new Map((state.counters || []).map((c) => [c.id, c]));
    const out = [];
    Object.entries(ann?.counterMarkers || {}).forEach(([typeId, markers]) => {
      const c = byId.get(typeId);
      if (!c || !(c.cfm > 0)) return;
      (markers || []).forEach((m) => {
        if (m && Number.isFinite(m.x) && Number.isFinite(m.y)) out.push({ x: m.x, y: m.y, cfm: c.cfm, groupId: m.group || null });
      });
    });
    return out;
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
          out.push({ x: m.x, y: m.y, counterName: c.name || '', cfm: c.cfm > 0 ? c.cfm : null, groupId: m.group || null });
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
    // Offer the draft's own shape: a rect trace gets the rect equivalent, a
    // round trace the round size (rect falls back to round if no rect fits).
    const cur = App.getCurrentDuctSize ? App.getCurrentDuctSize() : null;
    const wantRound = cur ? cur.kind === 'round' : false;
    const size = !wantRound && s.rect ? makeRectSize(s.rect.w, s.rect.h) : makeRoundSize(s.round.diameterIn);
    const sizeLabel = formatDuctSize(size);
    const cfmLabel = Math.round(remaining.cfm).toLocaleString();
    const limitNote = s.binding === 'velocity' ? ' · velocity-limited' : '';
    return {
      cfm: remaining.cfm,
      totalCfm: remaining.totalCfm,
      servedCfm: remaining.servedCfm,
      size: size,
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
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'duct-suggest-chip';
      b.title = sug.popoverLabel;
      b.setAttribute('aria-label', sug.popoverLabel);
      b.textContent = sug.sizeLabel;
      const from = document.createElement('span');
      from.className = 'duct-suggest-from';
      from.textContent = 'from ' + Math.round(sug.cfm).toLocaleString() + ' CFM @ '
        + sug.frictionRate + '″/100′' + (sug.binding === 'velocity' ? ' · velocity-limited' : '');
      b.appendChild(from);
      b.onclick = () => ctx.applySize(sug.size);
      container.appendChild(b);
    },
  });

  App.getDuctDraftSuggestion = getDuctDraftSuggestion;
  // D7 balance glue: shared device collection + the system designed/equipment
  // queries (consumed by room-sizer's balance rows and sidebar-lists' system
  // capacity line; equipmentPos wiring is D6's documented follow-up).
  App.collectDuctDevices = collectDuctDevices;
  App.getDuctSystemEquipmentPos = getDuctSystemEquipmentPos;
  App.getDuctSystemDesignedCfm = getDuctSystemDesignedCfm;
})();
