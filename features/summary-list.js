(function () {
  'use strict';
  const App = (window.App = window.App || {});
  /*
   * features/summary-list.js - the sidebar Summary section renderer
   * (renderSummary: per-group or flat counter/line-type rollups with
   * multiply-zone-adjusted counts and always-feet lengths; rows open
   * features/summary-detail.js via App.openSummaryCountDetailModal),
   * extracted from app.js's UI Render Functions region per the lines-list
   * recipe. updateUI reaches it defensively via App.renderSummary. Zero new
   * publish-only deps — everything it reads was already on the registry.
   * Boundary rule: read shared deps from App.* at call time, never at load.
   */

  // Child counts (features/child-counts.js): appends the indented, words-only
  // child rows under a parent's summary row. Separate rows per parent per
  // group by design (the merge happens only in the exports). Defensive: a
  // missing registration renders nothing.
  function appendChildRows(el, kind, id, gid, childTotals) {
    const rows = childTotals?.byGroup?.[gid]?.[kind]?.[id];
    if (!rows) return;
    const esc = App.escapeHtml;
    rows.forEach((r) => {
      const div = document.createElement('div');
      div.className = 'summary-child-item';
      div.innerHTML = '<span class="name">' + esc(r.name) + '</span>'
        + '<span class="child-rule">' + esc(r.qty + '/' + (r.per === 'ft' ? r.ftInterval + ' ft' : r.per)) + (r.excludedPxRuns ? ' *' : '') + '</span>'
        + '<span class="child-total">' + r.total + '</span>';
      if (r.excludedPxRuns) div.title = r.excludedPxRuns + ' run(s) without a scale are excluded from this per-ft count';
      el.appendChild(div);
    });
  }

  function renderSummary() {
    const el = document.getElementById('summaryList');
    el.innerHTML = '';
    const esc = App.escapeHtml;
    const childTotals = App.getChildCountTotals ? App.getChildCountTotals() : null;
    const groups = App.state.groups || [];
    const getGroupName = (gid) => (gid && groups.find(g => g.id === gid))?.name || 'Untagged';
    let hasAnyGroups = false;
    App.state.pages.forEach((p, pi) => {
      const ann = App.getActiveAnnotations(p, pi);
      Object.values(ann?.counterMarkers || {}).forEach(arr => arr.forEach(m => { if (m.group) hasAnyGroups = true; }));
      (ann?.quickLines || []).forEach(q => { if (q.group) hasAnyGroups = true; });
      (ann?.polylines || []).forEach(poly => { if (poly.group) hasAnyGroups = true; });
    });
    const counterByGroup = {};
    const lineTypeByGroup = {};
    App.state.pages.forEach((p, pi) => {
      const ann = App.getActiveAnnotations(p, pi);
      (App.state.counters || []).forEach(c => {
        (ann?.counterMarkers?.[c.id] || []).forEach(m => {
          const gid = m.group || null;
          if (!counterByGroup[gid]) counterByGroup[gid] = {};
          if (!counterByGroup[gid][c.id]) counterByGroup[gid][c.id] = { name: c.name, total: 0, placed: 0, pageIndices: [] };
          // T2-11: total is the multiply-adjusted number the row shows; placed
          // (marks physically on the sheet) feeds the hover title when a
          // multiply zone makes them differ.
          counterByGroup[gid][c.id].total += App.getMultiplyZoneForPoint(ann, m);
          counterByGroup[gid][c.id].placed++;
          if (!counterByGroup[gid][c.id].pageIndices.includes(pi)) counterByGroup[gid][c.id].pageIndices.push(pi);
        });
      });
      (App.state.lineTypes || []).forEach(lt => {
        // T1-05 ft/px split: feet and raw-px lengths accumulate in separate
        // buckets and are never summed under one label.
        const addSplit = (item, isPoly) => {
          const gid = item.group || null;
          if (!lineTypeByGroup[gid]) lineTypeByGroup[gid] = {};
          if (!lineTypeByGroup[gid][lt.id]) lineTypeByGroup[gid][lt.id] = { name: lt.name, runs: 0, lenFt: 0, lenPx: 0, pageIndices: [] };
          const r = lineTypeByGroup[gid][lt.id];
          r.runs++;
          const s = App.getLineLengthSplitForTotals(item, pi, isPoly, ann);
          r.lenFt += s.feet; r.lenPx += s.px;
          if (!r.pageIndices.includes(pi)) r.pageIndices.push(pi);
        };
        (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id).forEach(q => addSplit(q, false));
        (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id).forEach(poly => addSplit(poly, true));
      });
    });
    const allGroupIds = [...new Set([...Object.keys(counterByGroup), ...Object.keys(lineTypeByGroup)])];
    const isUntagged = (x) => x == null || x === '' || String(x) === 'null' || String(x) === 'undefined';
    const orderedGroupIds = hasAnyGroups ? allGroupIds.sort((a, b) => {
      if (isUntagged(a)) return 1;
      if (isUntagged(b)) return -1;
      return getGroupName(a).localeCompare(getGroupName(b));
    }) : [];
    const renderItems = (gid) => {
      const counters = counterByGroup[gid] || {};
      const lineTypes = lineTypeByGroup[gid] || {};
      (App.state.counters || []).forEach(c => {
        const r = counters[c.id];
        if (r && r.total > 0) {
          const div = document.createElement('div');
          div.className = 'sidebar-item summary-item-clickable';
          div.dataset.type = 'counter';
          div.dataset.id = c.id;
          div.innerHTML = '<span class="name">' + esc(r.name) + '</span><span class="badge">[' + r.total + ']</span>';
          if (r.total !== r.placed) div.title = r.placed + ' placed · ' + r.total + ' with repeats';
          div.onclick = () => App.openSummaryCountDetailModal('counter', c.id);
          el.appendChild(div);
          appendChildRows(el, 'counter', c.id, gid, childTotals);
        }
      });
      (App.state.lineTypes || []).forEach(lt => {
        const r = lineTypes[lt.id];
        if (r && r.runs > 0) {
          const div = document.createElement('div');
          div.className = 'sidebar-item summary-item-clickable summary-line-item';
          div.dataset.type = 'lineType';
          div.dataset.id = lt.id;
          div.innerHTML = '<span class="name">' + esc(r.name) + '</span><span class="summary-line-meta">' + r.runs + ' lines · ' + App.formatFeetPx(r.lenFt, r.lenPx) + '</span>';
          div.onclick = () => App.openSummaryCountDetailModal('lineType', lt.id);
          el.appendChild(div);
          appendChildRows(el, 'lineType', lt.id, gid, childTotals);
        }
      });
    };
    if (hasAnyGroups && orderedGroupIds.length > 0) {
      orderedGroupIds.forEach(gid => {
        const groupName = getGroupName(gid);
        const hasItems = Object.keys(counterByGroup[gid] || {}).some(cid => (counterByGroup[gid][cid]?.total || 0) > 0) ||
          Object.keys(lineTypeByGroup[gid] || {}).some(lid => (lineTypeByGroup[gid][lid]?.runs || 0) > 0);
        if (!hasItems) return;
        const h = document.createElement('h3');
        h.style.cssText = 'font-size:0.7rem;color:var(--text3);margin:8px 0 4px 0;';
        h.textContent = 'Group: ' + groupName;
        el.appendChild(h);
        renderItems(gid);
      });
    } else {
      App.state.counters.forEach(c => {
        // T2-11: one shared arithmetic — the row shows withRepeats, the hover
        // title carries placed when a multiply zone makes them differ.
        let placed = 0, count = 0;
        App.state.pages.forEach(p => {
          const t = App.counterTally(App.getActiveAnnotations(p), c.id);
          placed += t.placed; count += t.withRepeats;
        });
        if (count > 0) {
          const div = document.createElement('div');
          div.className = 'sidebar-item summary-item-clickable';
          div.dataset.type = 'counter';
          div.dataset.id = c.id;
          div.innerHTML = '<span class="name">' + esc(c.name) + '</span><span class="badge">[' + count + ']</span>';
          if (count !== placed) div.title = placed + ' placed · ' + count + ' with repeats';
          div.onclick = () => App.openSummaryCountDetailModal('counter', c.id);
          el.appendChild(div);
          appendChildRows(el, 'counter', c.id, 'null', childTotals);
        }
      });
      App.state.lineTypes.forEach(lt => {
        let runs = 0, lenFt = 0, lenPx = 0;
        App.state.pages.forEach((p, pi) => {
          const ann = App.getActiveAnnotations(p);
          const qLines = (ann?.quickLines || []).filter(q => q.lineTypeId === lt.id);
          const polys = (ann?.polylines || []).filter(poly => poly.lineTypeId === lt.id);
          const addSplit = (item, isPoly) => {
            runs++;
            const s = App.getLineLengthSplitForTotals(item, pi, isPoly, ann);
            lenFt += s.feet; lenPx += s.px;
          };
          qLines.forEach(q => addSplit(q, false));
          polys.forEach(poly => addSplit(poly, true));
        });
        if (runs > 0) {
          const div = document.createElement('div');
          div.className = 'sidebar-item summary-item-clickable summary-line-item';
          div.dataset.type = 'lineType';
          div.dataset.id = lt.id;
          div.innerHTML = '<span class="name">' + esc(lt.name) + '</span><span class="summary-line-meta">' + runs + ' lines · ' + App.formatFeetPx(lenFt, lenPx) + '</span>';
          div.onclick = () => App.openSummaryCountDetailModal('lineType', lt.id);
          el.appendChild(div);
          appendChildRows(el, 'lineType', lt.id, 'null', childTotals);
        }
      });
    }
  }

  App.renderSummary = renderSummary;
})();
