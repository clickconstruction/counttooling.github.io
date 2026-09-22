/*
 * features/duct-fittings.js — auto duct fittings (DUCT-PLAN.md unit D3).
 *
 * The glue between duct-model.js's pure inference walk and the app: fittings
 * COUNT THEMSELVES from run geometry at commit (corner = elbow, size step =
 * transition, run-on-run = tap), and every inferred fitting is a marker the
 * user can right-click to reclassify or delete — the SMACNA-gauge-auto-pick
 * philosophy. Three surfaces:
 *
 *   1. Re-inference — App.reinferDuctFittings(pageIdx?) walks the current
 *      page's ACTIVE canvas: inferAutoDuctFittings over annotations.ductRuns,
 *      reconciled onto annotations.ductFittings via reconcileDuctFittings
 *      (idempotent; autos re-derived with stable ids, non-auto overrides and
 *      suppressed delete-tombstones preserved by anchor, orphans of deleted
 *      runs pruned — the contract is documented atop duct-model.js §3b).
 *      Called by features/duct-tool.js finishDuctRun (the commit moment) and
 *      by the Delete-run action here; markers paint in canvas-draw.js and
 *      hit-test in app.js's hitTest (both after the hideMarks gate, T2-03).
 *
 *   2. The #ductFittingMenu popover — app.js's handleContextMenu routes
 *      hitTest's { ductFitting } / { ductRun } targets to
 *      App.tryOpenDuctContextMenu. Fitting targets get the reclassify list
 *      (90°/45°/transition/tap/boot/offset — picking one sets auto:false so
 *      the walk can never overwrite the human's call) + Delete (a suppressed
 *      tombstone, so re-inference can't resurrect it); run targets get a
 *      name/size heading + (D12) the "Orientation: Flat | On edge" segment
 *      control (house .filter-scope-segment — how a rect run hangs in the
 *      plenum; `run.orientation` present only when 'edge', so a flat run
 *      stays byte-identical; the Bid Check's "Fits the roof" row re-reads it
 *      on the spot through updateUI, and the sidebar row tags it "on edge")
 *      + Delete run (removes the run, then re-walks so its
 *      fittings and any taps from children onto it dissolve). Dismissal is
 *      the tool-context-menu.js pattern: listeners attached only while open,
 *      Escape handled in the CAPTURE phase with stopImmediatePropagation so
 *      the app's global Escape ladder never sees the press (B1 rule).
 *      D18 (J19 #14): rise/drop entries (`run.verticalFt`, D8) are the
 *      family's fourth member — hitTest's { ductVertical, index, entryIdx }
 *      target opens "12' rise/drop · Trunk (· auto riser)" with
 *      "Edit rise/drop…" (an INLINE numeric row inside the menu, the S
 *      popover's own field via App.buildDuctVerticalFtInputs — Enter or Save
 *      commits; an edited auto riser drops `auto` so D17's retroactive deck
 *      pass never overwrites the human's number, the reclassify precedent)
 *      and "Remove" (splices the entry; the key goes when the list empties,
 *      the pre-D8 byte-alike rule). The entries live ON the run, so
 *      reconcileDuctFittings (which only ever rewrites ductFittings) preserves
 *      them exactly as it preserves manual fittings; the schedule already
 *      counts them as straight LF through runStraightItems — nothing here
 *      touches the tallies.
 *
 *   3. Counts — App.getDuctFittingCounts(pageIdx?) tallies committed fittings
 *      by type + size key (duct-model tallyDuctFittingCounts, tombstones
 *      skipped) across the page's canvases, or the whole project with no
 *      arg. The D4 sidebar / D5 schedule consume this; no UI here.
 *
 * Pure duct math (inference, reconciliation, anchors, tallies, size labels)
 * comes from duct-model.js globals. Boundary rule: read shared deps from
 * App.* at call time, never captured at load. See ARCHITECTURE.md "Feature
 * files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const FITTING_LABELS = {
    elbow90: '90° elbow', elbow45: '45° elbow', transition: 'Transition',
    tap: 'Tap', boot: 'Boot', offset: 'Offset',
  };

  function currentAnn() {
    const state = App.state;
    const page = state.pages[state.currentPage];
    return page ? App.getActiveAnnotations(page) : null;
  }

  // --- re-inference ----------------------------------------------------------

  function reinferForAnnotations(ann) {
    if (!ann) return;
    const runs = ann.ductRuns || [];
    ann.ductFittings = reconcileDuctFittings(ann.ductFittings, inferAutoDuctFittings(runs), runs);
  }

  // Walk the page's ACTIVE canvas (the only canvas D3's surfaces edit).
  function reinferDuctFittings(pageIdx) {
    const state = App.state;
    const page = state.pages[pageIdx != null ? pageIdx : state.currentPage];
    const canvas = page && App.getActiveCanvas(page);
    if (canvas && canvas.annotations) reinferForAnnotations(canvas.annotations);
  }

  // --- counts (the D4/D5 seam) ----------------------------------------------

  function getDuctFittingCounts(pageIdx) {
    const state = App.state;
    const pages = pageIdx != null ? [state.pages[pageIdx]] : (state.pages || []);
    const all = [];
    pages.forEach((p) => {
      if (!p) return;
      App.getPageCanvases(p).forEach((c) => {
        (c.annotations?.ductFittings || []).forEach((f) => all.push(f));
      });
    });
    return tallyDuctFittingCounts(all);
  }

  // --- the context menu ------------------------------------------------------

  let menuOpen = false;

  function hideDuctFittingMenu() {
    const menu = document.getElementById('ductFittingMenu');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    menu.innerHTML = '';
    menuOpen = false;
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('keydown', onDocKeyDown, true);
    window.removeEventListener('resize', hideDuctFittingMenu);
    window.removeEventListener('scroll', hideDuctFittingMenu, true);
  }
  function onDocPointerDown(e) {
    const menu = document.getElementById('ductFittingMenu');
    if (menu && !menu.contains(e.target)) hideDuctFittingMenu();
  }
  function onDocKeyDown(e) {
    if (e.key === 'Escape') {
      // Capture phase + stopImmediatePropagation (the tool-context-menu.js
      // rule): one Escape closes only this menu — the app's global Escape
      // ladder / modal-close handler must never see the same press.
      e.stopImmediatePropagation();
      e.preventDefault();
      hideDuctFittingMenu();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...document.querySelectorAll('#ductFittingMenu button')];
      if (!items.length) return;
      e.preventDefault();
      const idx = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown'
        ? items[(idx + 1) % items.length]
        : items[(idx - 1 + items.length) % items.length];
      next.focus();
    }
  }

  // D12 — a segment-control row inside the menu ({ segment: true, label,
  // options: [{ value, label }], value, pick(value) }): the house
  // .filter-scope-segment (aria-pressed marks the choice). Picking flips the
  // state IN PLACE and keeps the menu open — a toggle is a state, not an
  // action, so the human sees it land.
  function buildSegmentRow(a) {
    const row = document.createElement('div');
    row.className = 'duct-menu-segment-row';
    const label = document.createElement('span');
    label.className = 'duct-menu-segment-label';
    label.textContent = a.label;
    const seg = document.createElement('div');
    seg.className = 'filter-scope-segment';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', a.label);
    if (a.id) seg.id = a.id;
    a.options.forEach((opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.value = opt.value;
      b.textContent = opt.label;
      b.setAttribute('aria-pressed', String(opt.value === a.value));
      b.onclick = () => {
        a.pick(opt.value);
        seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.value === opt.value)));
      };
      seg.appendChild(b);
    });
    row.append(label, seg);
    return row;
  }

  function showMenu(clientX, clientY, heading, actions) {
    const menu = document.getElementById('ductFittingMenu');
    if (!menu) return false;
    menu.innerHTML = '';
    if (heading) {
      const h = document.createElement('div');
      h.className = 'tool-context-menu-heading';
      h.textContent = heading;
      menu.appendChild(h);
    }
    actions.forEach((a) => {
      if (a.segment) { menu.appendChild(buildSegmentRow(a)); return; }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'menuitem');
      btn.textContent = a.label;
      // `keepOpen` (D18): the action re-renders INSIDE the menu (the inline
      // rise/drop edit) instead of closing it.
      btn.onclick = a.keepOpen ? () => a.run() : () => { hideDuctFittingMenu(); a.run(); };
      menu.appendChild(btn);
    });
    menu.hidden = false;
    menuOpen = true;
    menu.style.left = '-9999px';
    menu.style.top = '0px';
    App.placeFixedMenu(menu, clientX, clientY);
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onDocKeyDown, true);
    window.addEventListener('resize', hideDuctFittingMenu);
    window.addEventListener('scroll', hideDuctFittingMenu, true);
    const first = menu.querySelector('button');
    if (first) first.focus();
    return true;
  }

  // Route from app.js's handleContextMenu (already viewer-gated there).
  // target = hitTest's { type: 'ductFitting'|'ductRun', index }.
  function tryOpenDuctContextMenu(target, clientX, clientY) {
    const ann = currentAnn();
    if (!ann || !target) return false;
    if (target.type === 'ductFitting') {
      const f = ann.ductFittings?.[target.index];
      if (!f || f.suppressed) return false;
      const heading = (FITTING_LABELS[f.type] || f.type) + ' · ' + formatDuctSize(f.size)
        + (f.auto ? ' · auto' : '');
      const actions = DUCT_FITTING_TYPES
        .filter((t) => t !== f.type)
        .map((t) => ({ label: FITTING_LABELS[t], run: () => reclassifyFitting(target.index, t) }));
      // D8 §6: taps carry the per-fitting volume-damper toggle (only while
      // the project counts VDs at all — the schedule-modal knob).
      if (f.type === 'tap' && App.getDuctSettings && App.getDuctSettings().countVdPerTap) {
        actions.push(f.noVd
          ? { label: 'Add volume damper', run: () => setTapVolumeDamper(target.index, true) }
          : { label: 'Remove volume damper', run: () => setTapVolumeDamper(target.index, false) });
      }
      actions.push({ label: 'Delete fitting', run: () => deleteFitting(target.index) });
      return showMenu(clientX, clientY, heading, actions);
    }
    if (target.type === 'ductVertical') {
      const run = ann.ductRuns?.[target.index];
      const e = run && Array.isArray(run.verticalFt) ? run.verticalFt[target.entryIdx] : null;
      if (!run || !e) return false;
      const heading = verticalLabel(e) + ' rise/drop · ' + (run.name || 'Duct run') + (e.auto ? ' · auto riser' : '');
      return showMenu(clientX, clientY, heading, [
        { label: 'Edit rise/drop…', keepOpen: true, run: () => showVerticalEdit(target.index, target.entryIdx, heading) },
        { label: 'Remove', run: () => removeVerticalFt(target.index, target.entryIdx) },
      ]);
    }
    if (target.type === 'ductRun') {
      const run = ann.ductRuns?.[target.index];
      if (!run) return false;
      const sizes = runSegmentSpans(run).map((s) => formatDuctSize(s.size));
      const heading = (run.name || 'Duct run') + (sizes.length ? ' · ' + sizes.join(' → ') : '');
      const actions = [];
      // D12: rect runs hang flat (h down) or on edge (the larger side down);
      // round duct has no orientation, so the chip stays off its menu.
      if (run.segments.some((s) => s.size && s.size.kind === 'rect')) {
        actions.push({
          segment: true, id: 'ductRunOrientationSegment', label: 'Orientation',
          options: [{ value: 'flat', label: 'Flat' }, { value: 'edge', label: 'On edge' }],
          value: run.orientation === 'edge' ? 'edge' : 'flat',
          pick: (v) => setRunOrientation(target.index, v),
        });
      }
      // D25: what the run is made of — galvanized through the gauge table, or
      // welded grease duct at its fixed gauge and its own sheet weight.
      actions.push({
        segment: true, id: 'ductRunMaterialSegment', label: 'Material',
        options: [{ value: 'galvanized', label: 'Galvanized' }, { value: 'black-steel', label: 'Black steel' }, { value: 'stainless', label: 'Stainless' }],
        value: ductMaterialOf(run),
        pick: (v) => setRunMaterial(target.index, v),
      });
      // The airside a run was started with, editable after the fact (the
      // exhaust chip is easy to miss in the create dialog).
      actions.push({
        segment: true, id: 'ductRunAirsideSegment', label: 'Airside',
        options: [{ value: 'supply', label: 'Supply' }, { value: 'return', label: 'Return' }, { value: 'exhaust', label: 'Exhaust' }],
        value: DUCT_AIRSIDES.includes(run.airside) ? run.airside : 'supply',
        pick: (v) => setRunAirside(target.index, v),
      });
      actions.push({ label: 'Delete run', run: () => deleteRun(target.index) });
      return showMenu(clientX, clientY, heading, actions);
    }
    return false;
  }

  // --- the actions -----------------------------------------------------------

  function reclassifyFitting(index, type) {
    const ann = currentAnn();
    const f = ann?.ductFittings?.[index];
    if (!f || !DUCT_FITTING_TYPES.includes(type)) return;
    App.pushUndoSnapshotCurrentPage();
    f.type = type;
    // The human's call: auto:false takes this fitting out of the re-derive
    // set — reconciliation preserves it by anchor and suppresses the walk's
    // twin at the same spot (see duct-model.js §3b).
    f.auto = false;
    f.suppressed = false;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }

  // D8 §6 — the per-tap "no volume damper here" flag. hasVd=false sets
  // noVd:true (the tap stops contributing a Volume damper schedule row);
  // hasVd=true clears it. Either way auto flips false — the reclassify
  // preservation pattern — so the human's call survives re-inference by
  // anchor (duct-model.js §3b; the reconcile walk also carries noVd as
  // belt-and-braces).
  function setTapVolumeDamper(index, hasVd) {
    const ann = currentAnn();
    const f = ann?.ductFittings?.[index];
    if (!f || f.type !== 'tap') return;
    App.pushUndoSnapshotCurrentPage();
    if (hasVd) delete f.noVd;
    else f.noVd = true;
    f.auto = false;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }

  function deleteFitting(index) {
    const ann = currentAnn();
    const f = ann?.ductFittings?.[index];
    if (!f) return;
    App.pushUndoSnapshotCurrentPage();
    // Tombstone, not splice: the inference walk re-derives auto fittings on
    // every edit, so a plain removal would resurrect this one on the next
    // walk. The suppressed non-auto record is the durable "no fitting here"
    // override — invisible to paint/hitTest/counts.
    f.auto = false;
    f.suppressed = true;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }

  // D12 — the run's orientation. 'edge' writes run.orientation; 'flat'
  // DELETES the key (flat is the default and a flat run's saved shape must
  // stay byte-identical to pre-D12). updateUI re-renders the Bid Check
  // ("Fits the roof" reads the larger side on edge) and the sidebar tag.
  // D25: the material rides the run; a grease run reprices in every tally
  // that reads it (sidebar, schedule, report) on the next render.
  function setRunMaterial(index, material) {
    const ann = currentAnn();
    const run = ann?.ductRuns?.[index];
    if (!run || !DUCT_MATERIALS[material]) return;
    if (ductMaterialOf(run) === material) return;
    App.pushUndoSnapshotCurrentPage();
    if (material === 'galvanized') delete run.material;
    else run.material = material;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }
  function setRunAirside(index, airside) {
    const ann = currentAnn();
    const run = ann?.ductRuns?.[index];
    if (!run || !DUCT_AIRSIDES.includes(airside) || run.airside === airside) return;
    App.pushUndoSnapshotCurrentPage();
    run.airside = airside;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }
  function setRunOrientation(index, orientation) {
    const ann = currentAnn();
    const run = ann?.ductRuns?.[index];
    if (!run || !DUCT_ORIENTATIONS.includes(orientation)) return;
    const current = run.orientation === 'edge' ? 'edge' : 'flat';
    if (current === orientation) return;
    App.pushUndoSnapshotCurrentPage();
    if (orientation === 'edge') run.orientation = 'edge';
    else delete run.orientation;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }

  // --- D18: rise/drop entries (the family's fourth member) --------------------

  const verticalLabel = (e) => (Number.isInteger(e.ft) ? String(e.ft) : String(Math.round(e.ft * 10) / 10)) + "'";

  // The inline edit: the open menu re-renders as heading + the S popover's
  // rise/drop field (App.buildDuctVerticalFtInputs, value prefilled) — Enter
  // or Save commits and closes; Escape / outside click abandon as usual.
  function showVerticalEdit(runIndex, entryIdx, heading) {
    const menu = document.getElementById('ductFittingMenu');
    const ann = currentAnn();
    const e = ann?.ductRuns?.[runIndex]?.verticalFt?.[entryIdx];
    if (!menu || !e || !App.buildDuctVerticalFtInputs) { hideDuctFittingMenu(); return; }
    menu.innerHTML = '';
    const h = document.createElement('div');
    h.className = 'tool-context-menu-heading';
    h.textContent = heading;
    menu.appendChild(h);
    const row = document.createElement('div');
    row.className = 'duct-menu-vertical-edit';
    row.appendChild(App.buildDuctVerticalFtInputs({
      value: e.ft, unitText: 'ft', buttonLabel: 'Save',
      onCommit: (ft) => { hideDuctFittingMenu(); setVerticalFt(runIndex, entryIdx, ft); },
    }));
    menu.appendChild(row);
    const input = row.querySelector('input');
    if (input) { input.focus(); input.select(); }
  }

  function setVerticalFt(runIndex, entryIdx, ft) {
    const ann = currentAnn();
    const run = ann?.ductRuns?.[runIndex];
    const e = run && Array.isArray(run.verticalFt) ? run.verticalFt[entryIdx] : null;
    if (!e || !(ft > 0)) return;
    if (e.ft === ft && !e.auto) return;
    App.pushUndoSnapshotCurrentPage();
    e.ft = ft;
    // The human's number: out of the auto set, so the D17 retroactive deck
    // pass leaves it alone (a manual entry at vertex 0 is never duplicated).
    delete e.auto;
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }

  function removeVerticalFt(runIndex, entryIdx) {
    const ann = currentAnn();
    const run = ann?.ductRuns?.[runIndex];
    if (!run || !Array.isArray(run.verticalFt) || !run.verticalFt[entryIdx]) return;
    App.pushUndoSnapshotCurrentPage();
    run.verticalFt.splice(entryIdx, 1);
    if (!run.verticalFt.length) delete run.verticalFt;   // pre-D8 byte-alike shape
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }

  function deleteRun(index) {
    const ann = currentAnn();
    if (!ann?.ductRuns?.[index]) return;
    App.pushUndoSnapshotCurrentPage();
    ann.ductRuns.splice(index, 1);
    // Reconciliation prunes every fitting whose anchor died with the run
    // (its own elbows/transitions, taps riding it as parent) and re-walks
    // the survivors — a child that tapped this run loses its auto tap too.
    reinferForAnnotations(ann);
    App.markProjectDirty();
    App.renderAnnotations();
    App.updateUI();
  }

  App.reinferDuctFittings = reinferDuctFittings;
  App.getDuctFittingCounts = getDuctFittingCounts;
  App.tryOpenDuctContextMenu = tryOpenDuctContextMenu;
  App.setDuctRunOrientation = setRunOrientation;   // D12 (spec seam + the sidebar)
  App.setDuctVerticalFt = setVerticalFt;           // D18 (spec seam)
  App.removeDuctVerticalFt = removeVerticalFt;     // D18 (spec seam)
  App.hideDuctFittingMenu = hideDuctFittingMenu;
  App.isDuctFittingMenuOpen = () => menuOpen;   // spec seam
})();
