/*
 * features/circuits.js - "Circuits" (Electrical, First-Class S4): a group with a
 * panel tag is a circuit; the schedule and the panel cross-check follow.
 *
 * Model (pure core in circuit-model.js): `group.panel` ("LP-1"), `group.circuit`
 * ("7"), optional `group.loadAmps`; a counter may be a panel (`panelName`,
 * `poles`); a line type or a single line may be a homerun (`homerun: true`) —
 * the run to the panel, drawn with the arrowhead (canvas-draw.js) and reported
 * apart from device-to-device runs. All of it rides existing objects, so
 * save/load, export/import and the Artboard carry it for free.
 *
 * Registrations (report.js consumes via guarded window.App lookups):
 *   - getCircuitSchedule({ pageIndices?, getAnnotations? }) ->
 *       { panels: [{ panel, circuits: [{ gid, group, panel, circuit, tag, loadAmps,
 *                     devices: [{ name, count }], deviceCount, conduitFt, homerunFt,
 *                     wireFt, farthestFt, farthestFrom, devicesOffRuns, pxRuns }] }],
 *         crossCheck: [{ panel, onPlan, scheduled, verdict }] }
 *     Circuits are grouped by panel (groups with a circuit but no panel land
 *     under '—'); panels sorted naturally; empty when no group is a circuit.
 *   - getPanelCrossCheck() — the pure check over state.groups / state.counters.
 *   - renderGroupCircuitFields(g) / applyGroupCircuitFields(grp) — the Panel /
 *     Circuit / Load row in #groupModal (features/groups.js calls both).
 *   - renderPanelSection(kind, item) — Panel name + poles on a counter, and the
 *     Homerun toggle on a line type, inside #counterLineTypeDetailsModal.
 *   - renderLineHomerun(line, lineType) — the per-run Homerun toggle in
 *     #linePropertiesModal.
 *   - renderPanelFooter(listEl) — the cross-check lines under the Groups list.
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const CM = () => window.CircuitModel;
  const PAGE_OFFSET = 1e6;   // runs on different pages never connect

  function electricalVisible(item) {
    const state = App.state;
    if (state && state.trade === 'electrical') return true;
    return !!(item && (item.panel || item.circuit || item.panelName || item.homerun || (typeof item.poles === 'number')));
  }
  const isHomerun = (line, lt) => !!(line && line.homerun) || !!(lt && lt.homerun);

  // --- the schedule -----------------------------------------------------------

  function getCircuitSchedule(opts) {
    const state = App.state;
    const cm = CM();
    if (!state || !state.pages || !state.pages.length || !cm) return { panels: [], crossCheck: [] };
    const groups = (state.groups || []).filter((g) => cm.isCircuitGroup(g));
    const crossCheck = cm.panelCrossCheck(state.groups || [], state.counters || []);
    if (!groups.length) return { panels: [], crossCheck };
    const o = opts || {};
    const pageIndices = o.pageIndices || state.pages.map((_, i) => i);
    const getAnn = o.getAnnotations || ((pi) => App.getActiveAnnotations(state.pages[pi], pi));
    const counters = state.counters || [];
    const counterById = new Map(counters.map((c) => [c.id, c]));
    const ltById = new Map((state.lineTypes || []).map((lt) => [lt.id, lt]));
    const conductorTotals = App.getConductorTotals ? App.getConductorTotals({ pageIndices, getAnnotations: getAnn }) : { byGroup: {} };

    // per group accumulators
    const acc = {};
    groups.forEach((g) => { acc[g.id] = { devices: {}, devicePts: [], runs: [], homerunEnds: [], conduitFt: 0, homerunFt: 0, pxRuns: 0, hotGauges: new Set() }; });
    // panel marks anywhere on the plan, by panel name
    const panelPts = {};
    const off = (pt, pi) => ({ x: pt.x + pi * PAGE_OFFSET, y: pt.y });

    pageIndices.forEach((pi) => {
      const ann = getAnn(pi);
      if (!ann) return;
      counters.forEach((c) => {
        const marks = ann.counterMarkers?.[c.id] || [];
        if (!marks.length) return;
        const pname = String(c.panelName || '').trim().toUpperCase();
        marks.forEach((m) => {
          if (pname) (panelPts[pname] = panelPts[pname] || []).push(off(m, pi));
          const a = acc[m.group || ''];
          if (!a || pname) return;
          const zone = App.getMultiplyZoneForPoint(ann, m);
          a.devices[c.id] = (a.devices[c.id] || 0) + zone;
          a.devicePts.push(off(m, pi));
        });
      });
      const addRun = (item, isPoly) => {
        const a = acc[item.group || ''];
        if (!a) return;
        const lt = ltById.get(item.lineTypeId);
        const split = App.getLineLengthSplitForTotals(item, pi, isPoly, ann);
        if (split.px > 0) { a.pxRuns++; return; }
        const pts = isPoly ? item.points || [] : [{ x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 }];
        if (pts.length < 2) return;
        const pa = off(pts[0], pi), pb = off(pts[pts.length - 1], pi);
        const hr = isHomerun(item, lt);
        if (hr) { a.homerunFt += split.feet; a.homerunEnds.push(pb, pa); } else a.conduitFt += split.feet;
        // the circuit's conductor gauges (S5 voltage drop takes the smallest hot)
        const conductors = window.ConductorModel ? window.ConductorModel.conductorsForLine(item, lt) : null;
        (conductors || []).forEach((c) => { if (c.role !== 'ground') a.hotGauges.add(c.gauge); });
        a.runs.push({ a: pa, b: pb, feet: split.feet, id: item.id });
      };
      (ann.quickLines || []).forEach((q) => addRun(q, false));
      (ann.polylines || []).forEach((p) => addRun(p, true));
    });

    const round2 = (n) => Math.round(n * 100) / 100;
    const byPanel = {};
    groups.forEach((g) => {
      const a = acc[g.id];
      const panel = String(g.panel || '').trim();
      const key = panel ? panel.toUpperCase() : '—';
      const wire = ((conductorTotals.byGroup || {})[g.id] || { wire: [] }).wire || [];
      const far = cm.farthestDeviceFeet({ runs: a.runs, devices: a.devicePts, panelPoints: panelPts[key] || [], homerunEnds: a.homerunEnds, tol: 3 });
      const devices = Object.entries(a.devices).map(([cid, count]) => ({ name: (counterById.get(cid) || {}).name || cid, count: round2(count) })).sort((x, y) => x.name.localeCompare(y.name));
      byPanel[key] = byPanel[key] || { panel: panel || '—', circuits: [] };
      byPanel[key].circuits.push({
        gid: g.id, group: g.name || 'Group', panel, circuit: String(g.circuit || '').trim(), tag: cm.circuitTag(g),
        loadAmps: typeof g.loadAmps === 'number' && g.loadAmps > 0 ? g.loadAmps : null,
        devices, deviceCount: round2(devices.reduce((s, d) => s + d.count, 0)),
        conduitFt: round2(a.conduitFt), homerunFt: round2(a.homerunFt), wireFt: round2(wire.reduce((s, r) => s + r.feet, 0)),
        farthestFt: far.feet, farthestFrom: far.from, devicesOffRuns: far.devicesOffRuns, pxRuns: a.pxRuns,
        hotGauges: [...a.hotGauges],
      });
    });
    const numeric = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
    const panels = Object.values(byPanel).sort((x, y) => (x.panel === '—' ? 1 : y.panel === '—' ? -1 : numeric(x.panel, y.panel)));
    panels.forEach((p) => p.circuits.sort((x, y) => numeric(x.circuit || 'zz', y.circuit || 'zz')));
    return { panels, crossCheck };
  }
  function getPanelCrossCheck() {
    const cm = CM(); const state = App.state;
    return cm && state ? cm.panelCrossCheck(state.groups || [], state.counters || []) : [];
  }

  // --- editors ----------------------------------------------------------------

  function panelNames() {
    const state = App.state;
    const names = new Set();
    (state.counters || []).forEach((c) => { if (c.panelName) names.add(String(c.panelName).trim()); });
    (state.groups || []).forEach((g) => { if (g.panel) names.add(String(g.panel).trim()); });
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  function renderGroupCircuitFields(g) {
    const row = document.getElementById('groupModalCircuitRow');
    if (!row) return;
    const show = electricalVisible(g);
    row.style.display = show ? '' : 'none';
    if (!show) return;
    document.getElementById('groupModalPanel').value = g ? (g.panel || '') : '';
    document.getElementById('groupModalCircuit').value = g ? (g.circuit || '') : '';
    document.getElementById('groupModalLoadAmps').value = g && typeof g.loadAmps === 'number' && g.loadAmps > 0 ? g.loadAmps : '';
    const dl = document.getElementById('panelNamesList');
    if (dl) dl.innerHTML = panelNames().map((n) => '<option value="' + App.escapeHtml(n) + '"></option>').join('');
  }
  // Read at Done. A group with no panel and no circuit stays byte-identical
  // (fields DELETED, not nulled) — the D4 system-field rule.
  function applyGroupCircuitFields(grp) {
    const row = document.getElementById('groupModalCircuitRow');
    if (!row || row.style.display === 'none') return;
    const panel = document.getElementById('groupModalPanel').value.trim().slice(0, 24);
    const circuit = document.getElementById('groupModalCircuit').value.trim().slice(0, 24);
    const amps = parseFloat(document.getElementById('groupModalLoadAmps').value);
    if (panel) grp.panel = panel; else delete grp.panel;
    if (circuit) grp.circuit = circuit; else delete grp.circuit;
    if ((panel || circuit) && Number.isFinite(amps) && amps > 0) grp.loadAmps = Math.round(amps * 10) / 10; else delete grp.loadAmps;
  }

  function renderPanelSection(kind, item) {
    const panelGroup = document.getElementById('panelGroup');
    const hrGroup = document.getElementById('homerunGroup');
    if (!panelGroup || !hrGroup) return;
    const show = electricalVisible(item);
    panelGroup.style.display = kind === 'counter' && show ? '' : 'none';
    hrGroup.style.display = kind === 'lineType' && show ? '' : 'none';
    if (!show) return;
    const commit = (mutate) => { App.pushUndoSnapshotCurrentPage(); mutate(); App.markProjectDirty(); App.updateUI(); App.renderAnnotations && App.renderAnnotations(); };
    if (kind === 'counter') {
      const nameEl = document.getElementById('panelName');
      const polesEl = document.getElementById('panelPoles');
      nameEl.value = item.panelName || '';
      polesEl.value = typeof item.poles === 'number' && item.poles > 0 ? item.poles : '';
      const write = () => {
        const name = nameEl.value.trim().slice(0, 24);
        const poles = parseInt(polesEl.value, 10);
        const next = { panelName: name || undefined, poles: name && Number.isFinite(poles) && poles > 0 ? poles : undefined };
        if (next.panelName === item.panelName && next.poles === item.poles) return;
        commit(() => {
          if (next.panelName) item.panelName = next.panelName; else delete item.panelName;
          if (next.poles) item.poles = next.poles; else delete item.poles;
        });
      };
      nameEl.onblur = write; polesEl.onblur = write;
      [nameEl, polesEl].forEach((el) => { el.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } }; });
    } else {
      const btn = document.getElementById('lineTypeHomerunBtn');
      const sync = () => btn.setAttribute('aria-pressed', String(!!item.homerun));
      btn.onclick = () => { commit(() => { if (item.homerun) delete item.homerun; else item.homerun = true; }); sync(); };
      sync();
    }
  }
  function renderLineHomerun(line, lineType) {
    const group = document.getElementById('linePropertiesHomerunGroup');
    const btn = document.getElementById('linePropertiesHomerunBtn');
    const hint = document.getElementById('linePropertiesHomerunHint');
    if (!group || !btn) return;
    const show = electricalVisible(lineType) || !!line.homerun;
    group.style.display = show ? '' : 'none';
    if (!show) return;
    const sync = () => {
      btn.setAttribute('aria-pressed', String(isHomerun(line, lineType)));
      if (hint) hint.textContent = lineType && lineType.homerun ? 'Every run of this line type is a homerun.' : (line.homerun ? 'This run is a homerun: it draws the arrow to the panel and reports apart from device-to-device runs.' : 'Mark this run as the homerun to the panel.');
    };
    btn.onclick = () => {
      if (lineType && lineType.homerun) return;
      App.pushUndoSnapshotCurrentPage();
      if (line.homerun) delete line.homerun; else line.homerun = true;
      App.markProjectDirty(); App.updateUI(); App.renderAnnotations && App.renderAnnotations();
      sync();
    };
    btn.disabled = !!(lineType && lineType.homerun);
    sync();
  }

  // The cross-check lines under the Groups list: "LP-1 · 31 on plan · 42 scheduled ⚠".
  function renderPanelFooter(listEl) {
    if (!listEl) return;
    const rows = getPanelCrossCheck();
    if (!rows.length) return;
    const esc = App.escapeHtml;
    const div = document.createElement('div');
    div.className = 'panel-check-rows';
    div.innerHTML = rows.map((r) => {
      const sched = r.scheduled == null ? 'schedule poles unknown' : r.scheduled + ' scheduled';
      const mark = r.verdict === 'match' ? '✓' : r.verdict === 'unknown' ? '' : '⚠';
      return '<div class="panel-check-row' + (r.verdict === 'over' || r.verdict === 'under' ? ' warn' : '') + '" title="Circuits on plan are the distinct circuit numbers among this panel\'s groups; scheduled is the panel counter\'s pole count">'
        + '<span class="name">' + esc(r.panel) + '</span><span class="meta">' + r.onPlan + ' on plan · ' + esc(sched) + ' ' + mark + '</span></div>';
    }).join('');
    listEl.appendChild(div);
  }

  App.getCircuitSchedule = getCircuitSchedule;
  App.getPanelCrossCheck = getPanelCrossCheck;
  App.renderGroupCircuitFields = renderGroupCircuitFields;
  App.applyGroupCircuitFields = applyGroupCircuitFields;
  App.renderPanelSection = renderPanelSection;
  App.renderLineHomerun = renderLineHomerun;
  App.renderPanelFooter = renderPanelFooter;
  App.isHomerunLine = isHomerun;
})();
