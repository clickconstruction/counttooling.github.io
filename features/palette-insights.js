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

  function nameKey(s) { return String(s || '').trim().toLowerCase(); }
  function isFrequent(it) { return (it.project_count || 0) >= 2; }
  function isOnArtboard(it) { return onArtboard[it.kind === 'counter' ? 'counter' : 'lineType'].has(nameKey(it.name)); }

  // Narrow, additive merge of the given usage rows into user_airboard's
  // counters/line_types columns. Name-deduped against the fetched artboard;
  // defs (id/icon/color/curveStyle) come from the RPC's most-recent-project
  // values, so Quick Keys lineage keeps a real id.
  async function mergeIntoArtboard(items) {
    const supabase = App.getSupabase();
    const user = App.state.supabaseSession?.user;
    if (!supabase || !user || !items.length) return false;
    const ab = (await App.fetchUserAirboard()) || {};
    const counters = Array.isArray(ab.counters) ? ab.counters.slice() : [];
    const lineTypes = Array.isArray(ab.lineTypes) ? ab.lineTypes.slice() : [];
    const cNames = new Set(counters.map((c) => nameKey(c.name)));
    const ltNames = new Set(lineTypes.map((lt) => nameKey(lt.name)));
    items.forEach((it) => {
      if (it.kind === 'counter') {
        if (cNames.has(nameKey(it.name))) return;
        counters.push({ id: it.item_id || ('pi-' + nameKey(it.name)), name: it.name, icon: it.icon || '', color: it.color || '#e8c547' });
        cNames.add(nameKey(it.name));
      } else {
        if (ltNames.has(nameKey(it.name))) return;
        lineTypes.push({ id: it.item_id || ('pi-' + nameKey(it.name)), name: it.name, color: it.color || '#4a9eff', curveStyle: it.curve_style || 'straight' });
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

  function renderRows() {
    const countersEl = document.getElementById('paletteInsightsCounters');
    const linesEl = document.getElementById('paletteInsightsLines');
    countersEl.innerHTML = '';
    linesEl.innerHTML = '';
    const rank = (a, b) => (isOnArtboard(a) - isOnArtboard(b)) ||
      (b.project_count - a.project_count) || (b.placement_count - a.placement_count) ||
      String(a.name).localeCompare(String(b.name));
    const counters = insightRows.filter((r) => r.kind === 'counter').sort(rank);
    const lines = insightRows.filter((r) => r.kind !== 'counter').sort(rank);
    if (!counters.length) countersEl.innerHTML = '<p class="pi-empty">No counters found in your cloud projects yet.</p>';
    counters.forEach((it) => countersEl.appendChild(rowEl(it)));
    if (!lines.length) linesEl.innerHTML = '<p class="pi-empty">No line types found in your cloud projects yet.</p>';
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
    const targets = insightRows.filter((it) => !isOnArtboard(it) && isFrequent(it));
    if (!targets.length) { App.showToast('Everything you use frequently is already on your Artboard.', 3000); return; }
    btn.disabled = true;
    const ok = await mergeIntoArtboard(targets);
    btn.disabled = false;
    if (ok) {
      App.showToast('Added ' + targets.length + ' item' + (targets.length === 1 ? '' : 's') + ' to your Artboard.', 3000);
      renderRows();
    } else {
      App.showToast('Could not update your Artboard. Try again.', 4000);
    }
  };

  App.openPaletteInsightsModal = openPaletteInsightsModal;
})();
