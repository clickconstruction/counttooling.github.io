/*
 * features/bend-override.js — the edit-mode vertex menu for "fittings from
 * bends" (punch row BEND-OVERRIDE, 2026-09-18; the model is fitting-model.js).
 *
 * In Edit Polyline, a right-click on a vertex of a run whose line type counts
 * fittings from bends opens a small menu instead of deleting the vertex:
 *   heading   "Vertex 2 · reads as 45°" (the angle read; the override, if any)
 *   No fitting here        points[i].fitting = 'none'   (a jog drawn to route around text)
 *   Count as 45            points[i].fitting = 'bend45'
 *   Count as 90            points[i].fitting = 'bend90'
 *   Read from the angle    delete points[i].fitting     (only while an override is set)
 *   Delete vertex          the pre-existing right-click action, kept reachable
 * Endpoints of an open run can never be elbows, so they get Delete vertex only.
 * A run whose type has the option OFF keeps the old behaviour untouched: the
 * right-click deletes the vertex, no menu (app.js handleContextMenu asks here
 * first and falls through when this returns false).
 *
 * The override rides the vertex (polylines serialize wholesale), so it survives
 * save, load, export and the Artboard; fitting-model.js vertexBendClass honours
 * it for the tally and the chips. The dismissal pattern is
 * features/tool-context-menu.js's (capture-phase Esc, outside pointerdown).
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const FM = () => window.FittingModel;

  let menuOpen = false;

  function menuEl() { return document.getElementById('bendVertexMenu'); }

  function hideMenu() {
    const menu = menuEl();
    if (menu) { menu.hidden = true; menu.innerHTML = ''; }
    menuOpen = false;
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('keydown', onDocKeyDown, true);
    window.removeEventListener('resize', hideMenu);
    window.removeEventListener('scroll', hideMenu, true);
  }
  function onDocPointerDown(e) {
    const menu = menuEl();
    if (menu && menu.contains(e.target)) return;
    hideMenu();
  }
  function onDocKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); hideMenu(); }
  }

  function showMenu(clientX, clientY, heading, actions) {
    const menu = menuEl();
    if (!menu) return false;
    menu.innerHTML = '';
    const h = document.createElement('div');
    h.className = 'tool-context-menu-heading';
    h.textContent = heading;
    menu.appendChild(h);
    actions.forEach((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'menuitem');
      btn.dataset.action = a.id;
      btn.textContent = a.label;
      btn.onclick = () => { hideMenu(); a.run(); };
      menu.appendChild(btn);
    });
    menu.hidden = false;
    menuOpen = true;
    menu.style.left = '-9999px';
    menu.style.top = '0px';
    App.placeFixedMenu(menu, clientX, clientY);
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onDocKeyDown, true);
    window.addEventListener('resize', hideMenu);
    window.addEventListener('scroll', hideMenu, true);
    const first = menu.querySelector('button');
    if (first) first.focus();
    return true;
  }

  const CLASS_WORDS = { bend45: '45°', bend90: '90°' };

  // The angle read alone (the override set aside), for the heading.
  function angleRead(pts, idx, closed) {
    const fm = FM();
    const bare = pts.map((p, i) => (i === idx ? { x: p.x, y: p.y } : p));
    return fm.vertexBendClass(bare, idx, closed);
  }

  // Route from app.js handleContextMenu (already viewer-gated there): the
  // right-clicked vertex index of state.editingPolyline. Returns false when
  // the type does not count fittings from bends, so the caller keeps the old
  // right-click-deletes behaviour.
  function tryOpenBendVertexMenu(idx, clientX, clientY) {
    const state = App.state;
    const fm = FM();
    const poly = state && state.editingPolyline;
    if (!fm || !poly) return false;
    const lt = (state.lineTypes || []).find((l) => l.id === poly.lineTypeId);
    if (!fm.bendFittingsEnabled(lt)) return false;
    const pts = poly.points || [];
    const p = pts[idx];
    if (!p) return false;
    const closed = !!poly.closed;
    const interior = closed || (idx > 0 && idx < pts.length - 1);
    const commit = (mutate) => { App.pushUndoSnapshotCurrentPage(); mutate(); App.markProjectDirty(); App.renderAnnotations(); App.updateUI(); };
    const set = (v) => commit(() => { if (v) p.fitting = v; else delete p.fitting; });
    const read = interior ? angleRead(pts, idx, closed) : null;
    let heading = 'Vertex ' + (idx + 1);
    if (interior) {
      heading += ' · reads as ' + (read ? CLASS_WORDS[read] : 'no fitting');
      if (p.fitting === 'none') heading += ' · set: no fitting';
      else if (p.fitting) heading += ' · set: ' + CLASS_WORDS[p.fitting];
    } else heading += ' · an end, never an elbow';
    const actions = [];
    if (interior) {
      if (p.fitting !== 'none') actions.push({ id: 'none', label: 'No fitting here', run: () => set('none') });
      if (p.fitting !== 'bend45') actions.push({ id: 'bend45', label: 'Count as 45', run: () => set('bend45') });
      if (p.fitting !== 'bend90') actions.push({ id: 'bend90', label: 'Count as 90', run: () => set('bend90') });
      if (p.fitting) actions.push({ id: 'angle', label: 'Read from the angle', run: () => set(null) });
    }
    if (pts.length > 2) {
      actions.push({ id: 'delete', label: 'Delete vertex', run: () => commit(() => { pts.splice(idx, 1); }) });
    }
    return showMenu(clientX, clientY, heading, actions);
  }

  App.tryOpenBendVertexMenu = tryOpenBendVertexMenu;
  App.hideBendVertexMenu = hideMenu;
  App.isBendVertexMenuOpen = () => menuOpen;   // spec seam
})();
