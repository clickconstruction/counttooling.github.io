(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/palette-insights.js - the "Palette insights" modal: a
   * cross-project analysis of the user's counters and line types (via the
   * user_palette_usage RPC, which aggregates server-side so the client never
   * downloads whole project JSONB blobs), with one-click ADDITIVE adds to the
   * cloud Artboard. Opened from My Settings -> Artboard -> Analyze My Usage.
   *
   * Identity is name-based (case-insensitive): counter/line-type ids are
   * uid()-scoped per project, so "already on your Artboard" and the add-dedupe
   * both match on name. The add is a narrow fetch-merge-upsert of ONLY the
   * counters/line_types columns — deliberately NOT App.saveUserAirboard, which
   * is the wholesale save (it would replace the artboard with the CURRENT
   * project's palette). Rows are ranked unadded-first, then by how many
   * projects use the item (breadth beats raw volume — one huge bid shouldn't
   * dominate), then placements.
   *
   * Boundary rule: read shared deps from App.* at call time, never captured at
   * load. See ARCHITECTURE.md "Feature files / window.App registry".
   */

  let insightRows = [];   // last fetched usage rows (RPC shape)
  const onArtboard = { counter: new Set(), lineType: new Set() };   // name keys

  // Minimum-projects threshold: filters BOTH lists and drives "Add all shown"
  // (one control, two jobs — no invisible add-all rule). Persisted per device.
  const MIN_PROJECT_OPTIONS = [{ v: 1, label: 'Any' }, { v: 2, label: '2+' }, { v: 3, label: '3+' }, { v: 5, label: '5+' }];
  const MIN_PROJECTS_LS_KEY = 'paletteInsightsMinProjects';
  let minProjects = (() => {
    const v = parseInt(localStorage.getItem(MIN_PROJECTS_LS_KEY) || '2', 10);
    return MIN_PROJECT_OPTIONS.some((o) => o.v === v) ? v : 2;
  })();

  function nameKey(s) { return String(s || '').trim().toLowerCase(); }
  function visibleRows() { return insightRows.filter((r) => (r.project_count || 0) >= minProjects); }
  function isOnArtboard(it) { return onArtboard[it.kind === 'counter' ? 'counter' : 'lineType'].has(nameKey(it.name)); }

  // Narrow, additive merge of the given usage rows into user_airboard's
  // counters/line_types columns. Deduped against the fetched artboard by name
  // AND by id: defs (id/icon/color/curveStyle) come from the RPC's
  // most-recent-project values, so Quick Keys lineage keeps a real id — which
  // means a RENAMED item arrives with a new name but an id the artboard may
  // already hold. That id is the placed-marks key (counterMarkers[id]), so
  // appending would make every rename generation claim the same marks (the
  // Wendi FD bug: one placed drain counted as 4 counters). Same id -> treat
  // the add as the rename it is and update that entry in place.
  async function mergeIntoArtboard(items) {
    const supabase = App.getSupabase();
    const user = App.state.supabaseSession?.user;
    if (!supabase || !user || !items.length) return false;
    const ab = (await App.fetchUserAirboard()) || {};
    const counters = App.dedupePaletteById(Array.isArray(ab.counters) ? ab.counters.slice() : []);
    const lineTypes = App.dedupePaletteById(Array.isArray(ab.lineTypes) ? ab.lineTypes.slice() : []);
    const cNames = new Set(counters.map((c) => nameKey(c.name)));
    const ltNames = new Set(lineTypes.map((lt) => nameKey(lt.name)));
    const cById = new Map(counters.map((c) => [c.id, c]));
    const ltById = new Map(lineTypes.map((lt) => [lt.id, lt]));
    items.forEach((it) => {
      if (it.kind === 'counter') {
        if (cNames.has(nameKey(it.name))) return;
        const existing = it.item_id != null ? cById.get(it.item_id) : null;
        if (existing) Object.assign(existing, { name: it.name, icon: it.icon || existing.icon || '', color: it.color || existing.color || '#e8c547' });
        else {
          const added = { id: it.item_id || ('pi-' + nameKey(it.name)), name: it.name, icon: it.icon || '', color: it.color || '#e8c547' };
          counters.push(added);
          cById.set(added.id, added);
        }
        cNames.add(nameKey(it.name));
      } else {
        if (ltNames.has(nameKey(it.name))) return;
        const existing = it.item_id != null ? ltById.get(it.item_id) : null;
        if (existing) Object.assign(existing, { name: it.name, color: it.color || existing.color || '#4a9eff', curveStyle: it.curve_style || existing.curveStyle || 'straight' });
        else {
          const added = { id: it.item_id || ('pi-' + nameKey(it.name)), name: it.name, color: it.color || '#4a9eff', curveStyle: it.curve_style || 'straight' };
          lineTypes.push(added);
          ltById.set(added.id, added);
        }
        ltNames.add(nameKey(it.name));
      }
    });
    const { error } = await supabase.from('user_airboard').upsert({
      user_id: user.id,
      counters,
      line_types: lineTypes,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) return false;
    items.forEach((it) => onArtboard[it.kind === 'counter' ? 'counter' : 'lineType'].add(nameKey(it.name)));
    return true;
  }

  // The "where did it go?" fix (Wendi, 2026-07-30): a successful Artboard add
  // ALSO drops the item into the OPEN project's palette (name-deduped), so it
  // appears in the sidebar picker immediately instead of only in future bids.
  // Full undo snapshot (palette adds are cross-page), dirty + updateUI.
  function addToCurrentProject(items) {
    const state = App.state;
    if (state.isViewer) return 0;
    const cNames = new Set((state.counters || []).map((c) => nameKey(c.name)));
    const ltNames = new Set((state.lineTypes || []).map((lt) => nameKey(lt.name)));
    const cById = new Map((state.counters || []).map((c) => [c.id, c]));
    const ltById = new Map((state.lineTypes || []).map((lt) => [lt.id, lt]));
    let added = 0;
    let snapshotTaken = false;
    items.forEach((it) => {
      const isCounter = it.kind === 'counter';
      if (isCounter ? cNames.has(nameKey(it.name)) : ltNames.has(nameKey(it.name))) return;
      if (!snapshotTaken) { App.pushUndoSnapshot(); snapshotTaken = true; }
      // Same id already in the project = a rename generation of an existing
      // item; update it in place so its placed marks aren't double-claimed
      // (see mergeIntoArtboard).
      if (isCounter) {
        const existing = it.item_id != null ? cById.get(it.item_id) : null;
        if (existing) Object.assign(existing, { name: it.name, icon: it.icon || existing.icon || '', color: it.color || existing.color || '#e8c547' });
        else state.counters.push({ id: it.item_id || App.uid(), name: it.name, icon: it.icon || '', color: it.color || '#e8c547' });
        cNames.add(nameKey(it.name));
      } else {
        const existing = it.item_id != null ? ltById.get(it.item_id) : null;
        if (existing) Object.assign(existing, { name: it.name, color: it.color || existing.color || '#4a9eff', curveStyle: it.curve_style || existing.curveStyle || 'straight' });
        else state.lineTypes.push({ id: it.item_id || App.uid(), name: it.name, color: it.color || '#4a9eff', curveStyle: it.curve_style || 'straight' });
        ltNames.add(nameKey(it.name));
      }
      added++;
    });
    if (added) {
      App.markProjectDirty();
      App.updateUI();
    }
    return added;
  }

  function rowEl(it) {
    const esc = App.escapeHtml;
    const div = document.createElement('div');
    div.className = 'pi-row';
    const glyph = it.kind === 'counter' && it.icon
      ? '<span class="pi-icon"><svg viewBox="' + App.iconVbFor(it.icon) + '"><path fill="' + (it.color || '#e8c547') + '" d="' + it.icon + '"/></svg></span>'
      : '<span class="pi-swatch" style="background:' + (it.color || '#4a9eff') + ';"></span>';
    const stat = it.project_count + ' project' + (it.project_count === 1 ? '' : 's') + ' · ' +
      it.placement_count + (it.kind === 'counter' ? ' placed' : ' runs');
    div.innerHTML = glyph +
      '<span class="pi-name" title="' + esc(it.name) + '">' + esc(it.name) + '</span>' +
      '<span class="pi-stat">' + stat + '</span>';
    if (isOnArtboard(it)) {
      div.insertAdjacentHTML('beforeend', '<span class="pi-on-badge">✓ On Artboard</span>');
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pi-add-btn';
      btn.textContent = '+ Add';
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = 'Adding…';
        const ok = await mergeIntoArtboard([it]);
        if (ok) {
          const badge = document.createElement('span');
          badge.className = 'pi-on-badge';
          badge.textContent = '✓ Added';
          btn.replaceWith(badge);
          updateAddAllLabel();
          if (addToCurrentProject([it])) App.showToast('Added to your Artboard and this project.', 2500);
          else App.showToast('Added to your Artboard.', 2500);
        } else {
          btn.disabled = false;
          btn.textContent = '+ Add';
          App.showToast('Could not update your Artboard. Try again.', 4000);
        }
      };
      div.appendChild(btn);
    }
    return div;
  }

  function renderMinSeg() {
    const segEl = document.getElementById('paletteInsightsMinSeg');
    segEl.innerHTML = '';
    MIN_PROJECT_OPTIONS.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.label;
      b.className = o.v === minProjects ? 'active' : '';
      b.onclick = () => {
        minProjects = o.v;
        localStorage.setItem(MIN_PROJECTS_LS_KEY, String(o.v));
        renderRows();
      };
      segEl.appendChild(b);
    });
  }

  function updateAddAllLabel() {
    const addable = visibleRows().filter((it) => !isOnArtboard(it)).length;
    document.getElementById('paletteInsightsAddAll').textContent = 'Add all shown (' + addable + ')';
  }

  function renderRows() {
    renderMinSeg();
    const countersEl = document.getElementById('paletteInsightsCounters');
    const linesEl = document.getElementById('paletteInsightsLines');
    countersEl.innerHTML = '';
    linesEl.innerHTML = '';
    const shown = visibleRows();
    const hiddenCount = insightRows.length - shown.length;
    document.getElementById('paletteInsightsHidden').textContent = hiddenCount ? hiddenCount + ' hidden' : '';
    updateAddAllLabel();
    const rank = (a, b) => (isOnArtboard(a) - isOnArtboard(b)) ||
      (b.project_count - a.project_count) || (b.placement_count - a.placement_count) ||
      String(a.name).localeCompare(String(b.name));
    const counters = shown.filter((r) => r.kind === 'counter').sort(rank);
    const lines = shown.filter((r) => r.kind !== 'counter').sort(rank);
    if (!counters.length) countersEl.innerHTML = '<p class="pi-empty">No counters at this threshold.</p>';
    counters.forEach((it) => countersEl.appendChild(rowEl(it)));
    if (!lines.length) linesEl.innerHTML = '<p class="pi-empty">No line types at this threshold.</p>';
    lines.forEach((it) => linesEl.appendChild(rowEl(it)));
  }

  async function openPaletteInsightsModal() {
    const user = App.state.supabaseSession?.user;
    if (!App.SUPABASE_ENABLED || !user || !App.getSupabase()) {
      App.showToast('Sign in to analyze your palette usage.', 4000);
      return;
    }
    const subtitleEl = document.getElementById('paletteInsightsSubtitle');
    subtitleEl.textContent = 'Loading your usage…';
    document.getElementById('paletteInsightsCounters').innerHTML = '';
    document.getElementById('paletteInsightsLines').innerHTML = '';
    App.hideModal('mySettingsModal');
    App.showModal('paletteInsightsModal');
    try {
      const [rpc, ab] = await Promise.all([
        App.getSupabase().rpc('user_palette_usage'),
        App.fetchUserAirboard(),
      ]);
      if (rpc.error) throw new Error(rpc.error.message || 'Analysis failed');
      insightRows = Array.isArray(rpc.data) ? rpc.data : [];
      onArtboard.counter = new Set(((ab && ab.counters) || []).map((c) => nameKey(c.name)));
      onArtboard.lineType = new Set(((ab && ab.lineTypes) || []).map((lt) => nameKey(lt.name)));
      subtitleEl.textContent = insightRows.length
        ? 'Across your cloud projects · ranked by how many bids use each item'
        : 'No cloud projects yet — save a project and check back.';
      renderRows();
    } catch (e) {
      subtitleEl.textContent = (e && e.message) || 'Analysis failed. Try again.';
    }
  }

  document.getElementById('mySettingsPaletteInsights').onclick = () => openPaletteInsightsModal();
  document.getElementById('paletteInsightsClose').onclick = () => App.hideModal('paletteInsightsModal');
  document.getElementById('paletteInsightsAddAll').onclick = async () => {
    const btn = document.getElementById('paletteInsightsAddAll');
    const targets = visibleRows().filter((it) => !isOnArtboard(it));
    if (!targets.length) { App.showToast('Everything shown is already on your Artboard.', 3000); return; }
    btn.disabled = true;
    const ok = await mergeIntoArtboard(targets);
    btn.disabled = false;
    if (ok) {
      const inProject = addToCurrentProject(targets);
      App.showToast('Added ' + targets.length + ' item' + (targets.length === 1 ? '' : 's') + ' to your Artboard' + (inProject ? ' and this project' : '') + '.', 3000);
      renderRows();
    } else {
      App.showToast('Could not update your Artboard. Try again.', 4000);
    }
  };

  App.openPaletteInsightsModal = openPaletteInsightsModal;
})();
