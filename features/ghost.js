// features/ghost.js — the Ghost tool: copy a batch of marks as a translucent
// reference overlay ("a typical"), drag it over another part of the plan, and
// optionally stamp it down as real, counted marks.
//
// Division of labour:
//   annotation-model.js  the pure half — capture / bounds / translate / stamp,
//                        and the ann.ghosts[] shape itself.
//   canvas-draw.js       drawGhosts (live overlay only — never the export path).
//   app.js               tool button, the TOOL.GHOST click branch, drag.
//   here                 the capture→place gesture and the per-ghost menu.
//
// The load-bearing rule: a ghost is a DISTINCT annotation kind, never a real
// mark carrying an isGhost flag. Nothing that tallies (footer, sidebar,
// Summary, legend, report, Copy to /Tooling, Copy Summary, the PDF legend)
// reads ann.ghosts, so a ghost cannot leak into a number. The single door from
// ghost to counted mark is Stamp.
(function () {
  const App = (window.App = window.App || {});

  let menuGhostId = null;

  // --- The capture → place gesture ------------------------------------------
  // Three clicks: corner, corner, drop. The two-corner rectangle is the same
  // gesture Delete Area / Multiply Zone / Scale Zone already use, and the copy
  // rides the cursor between click 2 and click 3 so capture and placement are
  // one motion rather than "capture, then go find the thing you made".
  function handleGhostCanvasClick(pdf) {
    const state = App.state;
    const page = state.pages[state.currentPage];
    if (!page) return;

    // Click 3: drop the copy where it sits.
    if (state.placingGhost) {
      // Close the gap between the last tracked point and the drop click. On
      // desktop mousemove has been feeding placingGhostLast, so this delta is
      // ~zero; on touch there IS no mousemove, so this is what carries the
      // ghost from the capture box to the tapped drop point.
      if (state.placingGhostLast) {
        App.translateGhost(state.placingGhost, pdf.x - state.placingGhostLast.x, pdf.y - state.placingGhostLast.y);
        state.placingGhostLast = { x: pdf.x, y: pdf.y };
      }
      const canvas = App.ensureActiveCanvas(page);
      const ann = canvas && canvas.annotations;
      if (ann) {
        App.pushUndoSnapshot();
        if (!Array.isArray(ann.ghosts)) ann.ghosts = [];
        ann.ghosts.push(state.placingGhost);
        state.activeGhostId = state.placingGhost.id;
        App.markProjectDirty();
        const c = App.ghostCounts(state.placingGhost);
        App.showToast('Ghost placed — ' + describeCounts(c) + '. Right-click it to stamp or hide parts.', 3200);
        App.logUserEvent && App.logUserEvent('ghost_placed', { counters: c.counters, lines: c.lines });
      }
      state.placingGhost = null;
      state.placingGhostLast = null;
      return;
    }

    // Click 1: first corner.
    if (!state.ghostRectStart) {
      state.ghostRectStart = pdf;
      return;
    }

    // Click 2: capture whatever the box caught.
    const x1 = Math.min(state.ghostRectStart.x, pdf.x), x2 = Math.max(state.ghostRectStart.x, pdf.x);
    const y1 = Math.min(state.ghostRectStart.y, pdf.y), y2 = Math.max(state.ghostRectStart.y, pdf.y);
    state.ghostRectStart = null;
    const ann = App.getActiveAnnotations(page);
    const ghost = App.captureGhostFromRect(ann, state.currentPage, x1, y1, x2, y2, 'Typical');
    if (!ghost) {
      // Same wording shape as Delete Area's empty box. Lines need BOTH ends
      // inside, which is the usual reason a box "looks" full but catches
      // nothing — say so rather than leaving the user to guess.
      App.showToast('Nothing to copy in that box. A run counts only when both its ends are inside.', 3000);
      return;
    }
    state.placingGhost = ghost;
    state.placingGhostLast = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    const c = App.ghostCounts(ghost);
    App.showToast('Copied ' + describeCounts(c) + ' — click to drop the ghost.', 2600);
  }

  function describeCounts(c) {
    const parts = [];
    if (c.counters) parts.push(c.counters + (c.counters === 1 ? ' count' : ' counts'));
    if (c.lines) parts.push(c.lines + (c.lines === 1 ? ' run' : ' runs'));
    return parts.join(' + ') || 'nothing';
  }

  // Escape unwinds one step at a time (the Quick Line convention), so a stray
  // Escape never throws away more than the user's last click.
  function handleGhostEscape() {
    const state = App.state;
    if (state.placingGhost) {
      state.placingGhost = null;
      state.placingGhostLast = null;
      App.showToast('Ghost discarded.', 1600);
      return true;
    }
    if (state.ghostRectStart) {
      state.ghostRectStart = null;
      return true;
    }
    return false;
  }

  // --- The per-ghost menu ---------------------------------------------------
  // Right-click (or long-press) a ghost. Deliberately its own popover rather
  // than rows on the shared #contextMenu: that menu is built around a single
  // hit-tested mark, and everything here acts on the batch.
  function openGhostMenu(clientX, clientY, ghostId) {
    const menu = document.getElementById('ghostMenu');
    if (!menu) return;
    menuGhostId = ghostId;
    const g = findGhost(ghostId);
    if (!g) return;
    const c = App.ghostCounts(g);
    const row = (action, label, checked) =>
      '<div class="canvas-menu-item" data-ghost-action="' + action + '">' +
        (checked === undefined ? '' : '<span class="ghost-menu-check">' + (checked ? '✓' : '') + '</span>') +
        label +
      '</div>';
    menu.innerHTML =
      '<div class="canvas-menu-heading">' + (g.label || 'Typical') + ' · ' + describeCounts(c) + '</div>' +
      row('stamp', 'Stamp as real marks') +
      '<div class="canvas-menu-sep"></div>' +
      row('toggleCounters', 'Show counts', g.showCounters !== false) +
      row('toggleLines', 'Show runs', g.showLines !== false) +
      '<div class="canvas-menu-sep"></div>' +
      row('delete', 'Delete ghost');
    menu.querySelectorAll('[data-ghost-action]').forEach(el => {
      el.onclick = () => { onGhostMenuAction(el.dataset.ghostAction); };
    });
    menu.style.left = '-9999px';
    menu.classList.add('visible');
    App.placeFixedMenu(menu, clientX, clientY);
    document.addEventListener('pointerdown', onGhostMenuDocPointerDown, true);
    document.addEventListener('keydown', onGhostMenuDocKeyDown, true);
    window.addEventListener('resize', hideGhostMenu);
  }

  function hideGhostMenu() {
    const menu = document.getElementById('ghostMenu');
    if (menu) { menu.classList.remove('visible'); menu.innerHTML = ''; }
    menuGhostId = null;
    document.removeEventListener('pointerdown', onGhostMenuDocPointerDown, true);
    document.removeEventListener('keydown', onGhostMenuDocKeyDown, true);
    window.removeEventListener('resize', hideGhostMenu);
  }

  function onGhostMenuDocPointerDown(e) {
    const menu = document.getElementById('ghostMenu');
    if (menu && !menu.contains(e.target)) hideGhostMenu();
  }
  function onGhostMenuDocKeyDown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); hideGhostMenu(); }
  }

  function findGhost(id) {
    const page = App.state.pages[App.state.currentPage];
    const ann = page && App.getActiveAnnotations(page);
    return (ann && ann.ghosts || []).find(g => g.id === id) || null;
  }

  function onGhostMenuAction(action) {
    const state = App.state;
    const page = state.pages[state.currentPage];
    const canvas = page && App.ensureActiveCanvas(page);
    const ann = canvas && canvas.annotations;
    const g = findGhost(menuGhostId);
    if (!ann || !g) { hideGhostMenu(); return; }

    if (action === 'stamp') {
      App.pushUndoSnapshot();
      const res = App.stampGhostIntoAnnotations(ann, g);
      if (!res.counters && !res.lines) {
        App.showToast('Nothing to stamp — both counts and runs are hidden on this ghost.', 2800);
        hideGhostMenu();
        return;
      }
      App.markProjectDirty();
      // The ghost SURVIVES the stamp: the whole point is to move it to the
      // next location and stamp again. Undo takes the marks back off.
      App.showToast('Stamped ' + describeCounts(res) + ' — the ghost stays put for the next one. Stamped in error? Ctrl+Z undoes it.', 4000);
      App.logUserEvent && App.logUserEvent('ghost_stamped', { counters: res.counters, lines: res.lines });
    } else if (action === 'toggleCounters') {
      g.showCounters = g.showCounters === false;
      App.markProjectDirty();
    } else if (action === 'toggleLines') {
      g.showLines = g.showLines === false;
      App.markProjectDirty();
    } else if (action === 'delete') {
      App.pushUndoSnapshot();
      const i = (ann.ghosts || []).indexOf(g);
      if (i >= 0) ann.ghosts.splice(i, 1);
      if (state.activeGhostId === g.id) state.activeGhostId = null;
      App.markProjectDirty();
      App.showToast('Ghost deleted. Ctrl+Z brings it back.', 2400);
    }
    hideGhostMenu();
    App.renderAnnotations();
    App.updateUI();
  }

  // Called from app.js's contextmenu handler while TOOL.GHOST is armed.
  // Returns true when a ghost was hit and the menu opened, so the caller knows
  // to suppress the normal mark context menu.
  function tryOpenGhostMenuAt(pdfPos, clientX, clientY) {
    const state = App.state;
    if (state.tool !== App.TOOL.GHOST) return false;
    const page = state.pages[state.currentPage];
    const ann = page && App.getActiveAnnotations(page);
    if (!ann) return false;
    const i = App.ghostIndexAtPoint(ann, pdfPos);
    if (i < 0) return false;
    state.activeGhostId = ann.ghosts[i].id;
    App.renderAnnotations();
    openGhostMenu(clientX, clientY, ann.ghosts[i].id);
    return true;
  }

  App.handleGhostCanvasClick = handleGhostCanvasClick;
  App.handleGhostEscape = handleGhostEscape;
  App.tryOpenGhostMenuAt = tryOpenGhostMenuAt;
  App.hideGhostMenu = hideGhostMenu;
})();
