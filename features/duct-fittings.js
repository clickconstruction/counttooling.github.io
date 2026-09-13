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
 *      name/size heading + Delete run (removes the run, then re-walks so its
 *      fittings and any taps from children onto it dissolve). Dismissal is
 *      the tool-context-menu.js pattern: listeners attached only while open,
 *      Escape handled in the CAPTURE phase with stopImmediatePropagation so
 *      the app's global Escape ladder never sees the press (B1 rule).
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
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'menuitem');
      btn.textContent = a.label;
      btn.onclick = () => { hideDuctFittingMenu(); a.run(); };
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
    if (target.type === 'ductRun') {
      const run = ann.ductRuns?.[target.index];
      if (!run) return false;
      const sizes = runSegmentSpans(run).map((s) => formatDuctSize(s.size));
      const heading = (run.name || 'Duct run') + (sizes.length ? ' · ' + sizes.join(' → ') : '');
      return showMenu(clientX, clientY, heading, [
        { label: 'Delete run', run: () => deleteRun(target.index) },
      ]);
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
  App.hideDuctFittingMenu = hideDuctFittingMenu;
  App.isDuctFittingMenuOpen = () => menuOpen;   // spec seam
})();
