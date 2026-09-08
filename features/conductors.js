/*
 * features/conductors.js - "Conductors on the run" (Electrical, First-Class
 * S3): the tally engine + the editors for raceway / conductors / cable-per-count.
 *
 * Model (pure core in conductor-model.js): a line type carries
 * `raceway: { kind, size }`, `conductors: [{ n, gauge, insul, role }]` and
 * `tickMarks` (default on when conductors are set); a single line may carry
 * its own `conductors` (one shared homerun carries three circuits' worth); a
 * counter may carry `cablePerCount: { ft, name }`. All of it rides save/load,
 * export/import and the Artboard for free because palettes serialize
 * wholesale and a line's override rides the annotation.
 *
 * Derived rows (never marks — the child-count discipline): per run,
 *   conduit  = the line-type row as today;
 *   wire     = split.feet × n per gauge, rolled up ACROSS line types per group,
 *              hots+neutrals of a gauge in one row, the ground its own row;
 *   cable    = ONE row per cable line type ("MC 12/2 w/G", feet) when the
 *              raceway is MC / AC / NM — no wire rows, the conductors are inside;
 *   cable    = count × ft per counter with cablePerCount ("Cat6", 150 ft each).
 * Unscaled (px) runs never contribute wire or cable — excluded and flagged,
 * the T1-05 rule. Multiply zones ride through split.feet / the marker's zone.
 *
 * Registrations (report.js consumes via a guarded window.App lookup):
 *   - getConductorTotals({ pageIndices?, getAnnotations? }) ->
 *       { byGroup: { gid: { wire: [{ name, gauge, insul, ground, feet, excludedPxRuns }],
 *                          cable: [{ name, feet, source: 'lineType'|'counter', parentId, parentName, excludedPxRuns }] } } }
 *     groups with neither are omitted; rows sorted by name.
 *   - renderConductorsSection(kind, item) — the editor inside
 *     #counterLineTypeDetailsModal (features/item-details.js calls it on open).
 *   - renderLineConductorOverride(line, lineType) — the per-line override
 *     field inside #linePropertiesModal.
 *   - lineTypeConductorChip(lt) — the short "3/4" EMT · 3 #12 + G" label the
 *     sidebar / lines list can show.
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const CM = () => window.ConductorModel;

  // Electrical fields show for electrical projects, and for any item that
  // already carries them (a mixed shop opening an old bid never loses a field).
  function electricalVisible(item) {
    const state = App.state;
    if (state && state.trade === 'electrical') return true;
    return !!(item && (item.raceway || (item.conductors && item.conductors.length) || item.cablePerCount));
  }

  // --- tally engine ---------------------------------------------------------

  function getConductorTotals(opts) {
    const state = App.state;
    const cm = CM();
    if (!state || !state.pages || !state.pages.length || !cm) return { byGroup: {} };
    const o = opts || {};
    const pageIndices = o.pageIndices || state.pages.map((_, i) => i);
    const getAnn = o.getAnnotations || ((pi) => App.getActiveAnnotations(state.pages[pi], pi));
    const lineTypes = state.lineTypes || [];
    const ltById = new Map(lineTypes.map((lt) => [lt.id, lt]));
    const cableCounters = (state.counters || []).filter((c) => c.cablePerCount && c.cablePerCount.ft > 0);
    const anyLineConductors = lineTypes.some((lt) => lt.conductors && lt.conductors.length);
    // Per-line overrides can exist without any line type carrying conductors,
    // so the walk always runs when the project is electrical.
    if (!anyLineConductors && !cableCounters.length && state.trade !== 'electrical') return { byGroup: {} };

    const acc = {};   // gid -> { wire: {key: row}, cable: {key: row} }
    const forGroup = (gid) => (acc[gid] = acc[gid] || { wire: {}, cable: {} });

    pageIndices.forEach((pi) => {
      const ann = getAnn(pi);
      if (!ann) return;
      const addRun = (item, isPoly) => {
        const lt = ltById.get(item.lineTypeId);
        const conductors = cm.conductorsForLine(item, lt);
        const raceway = lt && lt.raceway;
        const isCable = raceway && cm.isCableRaceway(raceway.kind);
        if (!conductors && !isCable) return;
        const g = forGroup(item.group || null);
        const split = App.getLineLengthSplitForTotals(item, pi, isPoly, ann);
        if (isCable) {
          const name = cm.cableNameFor(raceway, conductors || []);
          const key = ('lt:' + (lt ? lt.id : '') + ':' + name).toLowerCase();
          if (!g.cable[key]) g.cable[key] = { name, feet: 0, source: 'lineType', parentId: lt ? lt.id : null, parentName: lt ? lt.name : '', excludedPxRuns: 0 };
          if (split.px > 0) g.cable[key].excludedPxRuns++;
          else g.cable[key].feet += split.feet;
          return;
        }
        if (split.px > 0) {
          // flag every wire row this run would have fed
          Object.entries(cm.wireRowsFor(1, conductors)).forEach(([k, r]) => {
            if (!g.wire[k]) g.wire[k] = { name: r.name, gauge: r.gauge, insul: r.insul, ground: r.ground, feet: 0, excludedPxRuns: 0 };
            g.wire[k].excludedPxRuns++;
          });
          return;
        }
        Object.entries(cm.wireRowsFor(split.feet, conductors)).forEach(([k, r]) => {
          if (!g.wire[k]) g.wire[k] = { name: r.name, gauge: r.gauge, insul: r.insul, ground: r.ground, feet: 0, excludedPxRuns: 0 };
          g.wire[k].feet += r.feet;
        });
      };
      (ann.quickLines || []).forEach((q) => addRun(q, false));
      (ann.polylines || []).forEach((p) => addRun(p, true));
      cableCounters.forEach((c) => {
        (ann.counterMarkers?.[c.id] || []).forEach((m) => {
          const g = forGroup(m.group || null);
          const name = c.cablePerCount.name || 'Cable';
          const key = ('c:' + c.id + ':' + name).toLowerCase();
          if (!g.cable[key]) g.cable[key] = { name, feet: 0, source: 'counter', parentId: c.id, parentName: c.name, excludedPxRuns: 0 };
          g.cable[key].feet += App.getMultiplyZoneForPoint(ann, m) * c.cablePerCount.ft;
        });
      });
    });

    const byGroup = {};
    const round2 = (n) => Math.round(n * 100) / 100;
    Object.entries(acc).forEach(([gid, g]) => {
      const wire = Object.values(g.wire).filter((r) => r.feet > 0 || r.excludedPxRuns > 0).map((r) => ({ ...r, feet: round2(r.feet) })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const cable = Object.values(g.cable).filter((r) => r.feet > 0 || r.excludedPxRuns > 0).map((r) => ({ ...r, feet: round2(r.feet) })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (wire.length || cable.length) byGroup[gid] = { wire, cable };
    });
    return { byGroup };
  }

  // Short label for a line type's electrical facts: '3/4" EMT · 3 #12 + 1 #12 G'.
  function lineTypeConductorChip(lt) {
    const cm = CM();
    if (!lt || !cm) return '';
    const parts = [];
    if (lt.raceway && lt.raceway.kind) parts.push(cm.racewayLabel(lt.raceway));
    if (lt.conductors && lt.conductors.length) parts.push(cm.formatConductorSpec(lt.conductors));
    return parts.join(' · ');
  }

  // --- edit UI: the details modal --------------------------------------------

  function renderConductorsSection(kind, item) {
    const cm = CM();
    const rwGroup = document.getElementById('racewayGroup');
    const cableGroup = document.getElementById('cablePerCountGroup');
    if (!cm || !rwGroup || !cableGroup) return;
    const show = electricalVisible(item);
    rwGroup.style.display = kind === 'lineType' && show ? '' : 'none';
    cableGroup.style.display = kind === 'counter' && show ? '' : 'none';
    if (!show) return;
    const commit = (mutate) => { App.pushUndoSnapshotCurrentPage(); mutate(); App.markProjectDirty(); App.updateUI(); App.renderAnnotations && App.renderAnnotations(); };

    if (kind === 'lineType') {
      const kindSel = document.getElementById('racewayKind');
      const sizeSel = document.getElementById('racewaySize');
      const condEl = document.getElementById('conductorsSpec');
      const condHint = document.getElementById('conductorsSpecHint');
      const tickBtn = document.getElementById('lineTypeTickMarksBtn');
      const esc = App.escapeHtml;
      kindSel.innerHTML = '<option value="">— none —</option>' + cm.RACEWAY_KINDS.map((k) => '<option value="' + esc(k.kind) + '">' + esc(k.label) + '</option>').join('');
      sizeSel.innerHTML = '<option value="">size</option>' + cm.RACEWAY_SIZES.map((s) => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('');
      kindSel.value = item.raceway?.kind || '';
      sizeSel.value = item.raceway?.size || '';
      sizeSel.disabled = !kindSel.value || cm.isCableRaceway(kindSel.value);
      condEl.value = item.conductors && item.conductors.length ? cm.formatConductorSpec(item.conductors) : '';
      const syncHint = () => {
        const list = item.conductors || [];
        const rw = item.raceway;
        if (!list.length) { condHint.textContent = rw && cm.isCableRaceway(rw.kind) ? 'Cable: list the conductors inside (2 #12 + 1 #12 G) and the run tallies as ' + cm.cableNameFor(rw, []) + '.' : 'e.g. 3 #12 THHN + 1 #12 G — wire tallies by gauge from every run.'; return; }
        condHint.textContent = rw && cm.isCableRaceway(rw.kind)
          ? 'Tallies as ' + cm.cableNameFor(rw, list) + ' (cable, no wire rows).'
          : cm.conductorCount(list) + ' conductors → wire rows per gauge; ' + (item.tickMarks === false ? 'tick marks off.' : 'tick marks on the sheet.');
      };
      const writeRaceway = () => {
        const k = kindSel.value;
        commit(() => {
          if (!k) delete item.raceway;
          else item.raceway = { kind: k, ...(sizeSel.value && !cm.isCableRaceway(k) ? { size: sizeSel.value } : {}) };
        });
        sizeSel.disabled = !k || cm.isCableRaceway(k);
        if (sizeSel.disabled) sizeSel.value = '';
        syncHint();
      };
      kindSel.onchange = writeRaceway;
      sizeSel.onchange = writeRaceway;
      condEl.onblur = () => {
        const parsed = cm.parseConductorSpec(condEl.value);
        if (parsed.bad.length) { condEl.classList.add('field-invalid'); condHint.textContent = 'Could not read: ' + parsed.bad.join(', ') + ' — write it like 3 #12 THHN + 1 #12 G'; return; }
        condEl.classList.remove('field-invalid');
        const next = parsed.conductors;
        const same = JSON.stringify(next) === JSON.stringify(item.conductors || []);
        if (!same) commit(() => { if (next.length) item.conductors = next; else delete item.conductors; });
        condEl.value = next.length ? cm.formatConductorSpec(next) : '';
        syncHint();
      };
      condEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); condEl.blur(); } };
      const syncTick = () => tickBtn.setAttribute('aria-pressed', String(item.tickMarks !== false));
      tickBtn.onclick = () => { commit(() => { if (item.tickMarks === false) delete item.tickMarks; else item.tickMarks = false; }); syncTick(); syncHint(); };
      syncTick();
      syncHint();
    } else {
      const ftEl = document.getElementById('cablePerCountFt');
      const nameEl = document.getElementById('cablePerCountName');
      ftEl.value = item.cablePerCount && item.cablePerCount.ft > 0 ? item.cablePerCount.ft : '';
      nameEl.value = item.cablePerCount?.name || '';
      const write = () => {
        const ft = parseFloat(ftEl.value);
        const name = nameEl.value.trim();
        const next = Number.isFinite(ft) && ft > 0 ? { ft: Math.round(ft * 100) / 100, name: name || 'Cable' } : null;
        const same = JSON.stringify(next) === JSON.stringify(item.cablePerCount || null);
        if (same) return;
        commit(() => { if (next) item.cablePerCount = next; else delete item.cablePerCount; });
        if (next) nameEl.value = next.name;
      };
      ftEl.onblur = write;
      nameEl.onblur = write;
      [ftEl, nameEl].forEach((el) => { el.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } }; });
    }
  }

  // --- edit UI: the per-line override in Line Properties ---------------------

  function renderLineConductorOverride(line, lineType) {
    const cm = CM();
    const group = document.getElementById('linePropertiesConductorsGroup');
    const el = document.getElementById('linePropertiesConductors');
    const hint = document.getElementById('linePropertiesConductorsHint');
    if (!cm || !group || !el) return;
    const show = electricalVisible(lineType) || (line.conductors && line.conductors.length);
    group.style.display = show ? '' : 'none';
    if (!show) return;
    const inherited = lineType && lineType.conductors && lineType.conductors.length ? cm.formatConductorSpec(lineType.conductors) : '';
    el.placeholder = inherited ? 'inherits ' + inherited : 'e.g. 9 #12 THHN + 1 #12 G';
    el.value = line.conductors && line.conductors.length ? cm.formatConductorSpec(line.conductors) : '';
    const syncHint = () => {
      hint.textContent = line.conductors && line.conductors.length
        ? 'This run overrides its line type (' + (inherited || 'none') + '). Clear to inherit again.'
        : (inherited ? 'Inherits the line type\'s conductors. Type a list to override this one run — a shared homerun carrying three circuits.' : 'The line type has no conductors; a list here applies to this run only.');
    };
    el.onblur = () => {
      const parsed = cm.parseConductorSpec(el.value);
      if (parsed.bad.length) { el.classList.add('field-invalid'); hint.textContent = 'Could not read: ' + parsed.bad.join(', '); return; }
      el.classList.remove('field-invalid');
      const next = parsed.conductors;
      const same = JSON.stringify(next) === JSON.stringify(line.conductors || []);
      if (!same) {
        App.pushUndoSnapshotCurrentPage();
        if (next.length) line.conductors = next; else delete line.conductors;
        App.markProjectDirty();
        App.updateUI();
        App.renderAnnotations && App.renderAnnotations();
      }
      el.value = next.length ? cm.formatConductorSpec(next) : '';
      syncHint();
    };
    el.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } };
    syncHint();
  }

  App.getConductorTotals = getConductorTotals;
  App.renderConductorsSection = renderConductorsSection;
  App.renderLineConductorOverride = renderLineConductorOverride;
  App.lineTypeConductorChip = lineTypeConductorChip;
})();
