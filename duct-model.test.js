// Node unit tests for duct-model.js (DUCT-PLAN unit D1: pure math + model).
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
const test = require('node:test');
const assert = require('node:assert');
const dm = require('./duct-model.js');

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ~= ${b}`);

// --- 1. Model factories + validation ----------------------------------------

test('makeRectSize / makeRoundSize / isDuctSize', () => {
  assert.deepStrictEqual(dm.makeRectSize(24, 12), { kind: 'rect', w: 24, h: 12 });
  assert.deepStrictEqual(dm.makeRoundSize(12), { kind: 'round', d: 12 });
  assert.ok(dm.isDuctSize(dm.makeRectSize(24, 12)));
  assert.ok(dm.isDuctSize(dm.makeRoundSize(8)));
  assert.ok(!dm.isDuctSize(null));
  assert.ok(!dm.isDuctSize({}));
  assert.ok(!dm.isDuctSize({ kind: 'rect', w: 0, h: 12 }));
  assert.ok(!dm.isDuctSize({ kind: 'rect', w: 24 }));
  assert.ok(!dm.isDuctSize({ kind: 'round', d: -3 }));
  assert.ok(!dm.isDuctSize({ kind: 'oval', w: 24, h: 12 }));
});

test('cloneDuctSize is a fresh object', () => {
  const s = dm.makeRectSize(20, 12);
  const c = dm.cloneDuctSize(s);
  assert.deepStrictEqual(c, s);
  assert.notStrictEqual(c, s);
  assert.deepStrictEqual(dm.cloneDuctSize(dm.makeRoundSize(10)), { kind: 'round', d: 10 });
});

test('formatDuctSize: display label doubles as tally key', () => {
  assert.strictEqual(dm.formatDuctSize(dm.makeRectSize(24, 12)), '24×12');
  assert.strictEqual(dm.formatDuctSize(dm.makeRoundSize(12)), '12"Ø');
  // as-drawn orientation is preserved: 12×24 is NOT normalized to 24×12
  assert.strictEqual(dm.formatDuctSize(dm.makeRectSize(12, 24)), '12×24');
  assert.strictEqual(dm.formatDuctSize(null), '?');
});

test('makeDuctRun: defaults produce a valid empty supply run', () => {
  const run = dm.makeDuctRun();
  assert.ok(run.id && typeof run.id === 'string');
  assert.strictEqual(run.airside, 'supply');
  assert.strictEqual(run.pressureClass, '1');
  assert.strictEqual(run.linerType, null);
  assert.strictEqual(run.linerThicknessIn, 0);
  assert.strictEqual(run.systemGroupId, null);
  assert.deepStrictEqual(run.vertices, []);
  assert.deepStrictEqual(run.segments, []);
  assert.deepStrictEqual(dm.validateDuctRun(run), []);
});

test('makeDuctRun: options are honored, junk airside/liner normalized', () => {
  const run = dm.makeDuctRun({
    id: 'r1', name: 'Main trunk', airside: 'return', pressureClass: '2',
    linerType: 'wrap', linerThicknessIn: 2, systemGroupId: 'g9',
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    segments: [{ startVertexIdx: 0, size: dm.makeRectSize(24, 12) }],
  });
  assert.strictEqual(run.id, 'r1');
  assert.strictEqual(run.airside, 'return');
  assert.strictEqual(run.pressureClass, '2');
  assert.strictEqual(run.linerType, 'wrap');
  assert.strictEqual(run.linerThicknessIn, 2);
  assert.strictEqual(run.systemGroupId, 'g9');
  assert.deepStrictEqual(dm.validateDuctRun(run), []);
  assert.strictEqual(dm.makeDuctRun({ airside: 'sideways' }).airside, 'supply');
  assert.strictEqual(dm.makeDuctRun({ linerType: 'asbestos' }).linerType, null);
});

test('validateDuctRun flags each malformed field', () => {
  assert.deepStrictEqual(dm.validateDuctRun(null), ['run is not an object']);
  const bad = dm.makeDuctRun({
    vertices: [{ x: 0, y: 0 }, { x: 'nope' }, { x: 20, y: 0 }],
    segments: [
      { startVertexIdx: 1, size: dm.makeRectSize(24, 12) },   // must start at 0
      { startVertexIdx: 1, size: { kind: 'rect', w: 0, h: 12 } }, // not ascending + bad size
      { startVertexIdx: 9, size: dm.makeRoundSize(10) },      // out of range
    ],
  });
  bad.airside = 'diagonal';
  bad.pressureClass = '99';
  bad.id = '';
  const errs = dm.validateDuctRun(bad);
  assert.ok(errs.some(e => e.includes('missing id')), errs.join('; '));
  assert.ok(errs.some(e => e.includes('invalid airside')));
  assert.ok(errs.some(e => e.includes('unknown pressure class')));
  assert.ok(errs.some(e => e.includes('vertex 1')));
  assert.ok(errs.some(e => e.includes('segment 0 must start at vertex 0')));
  assert.ok(errs.some(e => e.includes('not ascending')));
  assert.ok(errs.some(e => e.includes('invalid size')));
  assert.ok(errs.some(e => e.includes('out of range')));
});

test('validateDuctRun: vertices without segments is an error', () => {
  const run = dm.makeDuctRun({ vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }] });
  assert.ok(dm.validateDuctRun(run).some(e => e.includes('no segments')));
});

test('makeDuctFitting + validateDuctFitting', () => {
  const f = dm.makeDuctFitting({ runId: 'r1', vertexIdx: 2, type: 'transition', size: dm.makeRectSize(24, 12), auto: true });
  assert.ok(f.id);
  assert.strictEqual(f.runId, 'r1');
  assert.strictEqual(f.vertexIdx, 2);
  assert.strictEqual(f.position, null);
  assert.strictEqual(f.type, 'transition');
  assert.strictEqual(f.auto, true);
  assert.deepStrictEqual(dm.validateDuctFitting(f), []);
  // free-position fitting (mid-segment tap)
  const tap = dm.makeDuctFitting({ runId: 'r1', position: { x: 5, y: 7 }, type: 'tap', size: dm.makeRoundSize(8) });
  assert.deepStrictEqual(tap.position, { x: 5, y: 7 });
  assert.strictEqual(tap.vertexIdx, null);
  assert.strictEqual(tap.auto, false);
  assert.deepStrictEqual(dm.validateDuctFitting(tap), []);
  // factory normalizes unknown type; validation flags missing anchor/size
  assert.strictEqual(dm.makeDuctFitting({ type: 'wye' }).type, 'elbow90');
  const errs = dm.validateDuctFitting({ id: 'f1', type: 'wye', size: null });
  assert.ok(errs.some(e => e.includes('invalid type')));
  assert.ok(errs.some(e => e.includes('invalid size')));
  assert.ok(errs.some(e => e.includes('needs vertexIdx or position')));
  assert.deepStrictEqual(dm.validateDuctFitting(null), ['fitting is not an object']);
});

test('every DUCT_FITTING_TYPES entry has a lb-eq table row', () => {
  dm.DUCT_FITTING_TYPES.forEach(t => {
    assert.ok(dm.FITTING_EQUIV_LF[t] > 0, `missing lb-eq for ${t}`);
  });
});

test('serialization round-trip: JSON.stringify/parse preserves run + fitting shapes', () => {
  const run = dm.makeDuctRun({
    id: 'r1', name: 'RTU-1 main', airside: 'supply', pressureClass: '2',
    linerType: 'liner', linerThicknessIn: 1, systemGroupId: 'sys1',
    vertices: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 80 }],
    segments: [
      { startVertexIdx: 0, size: dm.makeRectSize(24, 12) },
      { startVertexIdx: 1, size: dm.makeRoundSize(12) },
    ],
  });
  const fitting = dm.makeDuctFitting({ id: 'f1', runId: 'r1', vertexIdx: 1, type: 'elbow90', size: dm.makeRectSize(24, 12), auto: true });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(run)), run);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(fitting)), fitting);
  // annotation-payload style: arrays of them survive together
  const payload = { ductRuns: [run], ductFittings: [fitting] };
  const back = JSON.parse(JSON.stringify(payload));
  assert.deepStrictEqual(back, payload);
  assert.deepStrictEqual(dm.validateDuctRun(back.ductRuns[0]), []);
  assert.deepStrictEqual(dm.validateDuctFitting(back.ductFittings[0]), []);
});

// --- 2. SMACNA gauge selection ----------------------------------------------

test('sheet weights match the galvanized table', () => {
  assert.deepStrictEqual(dm.SHEET_WEIGHT_LB_PER_SQFT, { 18: 2.156, 20: 1.656, 22: 1.406, 24: 1.156, 26: 0.906 });
});

test('ductGoverningDimIn: larger rect side; round diameter', () => {
  assert.strictEqual(dm.ductGoverningDimIn(dm.makeRectSize(24, 12)), 24);
  assert.strictEqual(dm.ductGoverningDimIn(dm.makeRectSize(12, 30)), 30);
  assert.strictEqual(dm.ductGoverningDimIn(dm.makeRoundSize(14)), 14);
  assert.strictEqual(dm.ductGoverningDimIn(null), 0);
});

test('selectGauge: every 1" w.g. table boundary (and just past it)', () => {
  const at = (dim) => dm.selectGauge('1', dm.makeRectSize(dim, 6));
  assert.strictEqual(at(12), 26);
  assert.strictEqual(at(13), 24);
  assert.strictEqual(at(30), 24);
  assert.strictEqual(at(31), 22);
  assert.strictEqual(at(54), 22);
  assert.strictEqual(at(55), 20);
  assert.strictEqual(at(84), 20);
  assert.strictEqual(at(85), 18);
  assert.strictEqual(at(200), 18);
});

test('selectGauge: 2" and 3" w.g. boundaries tighten', () => {
  const at2 = (dim) => dm.selectGauge('2', dm.makeRectSize(dim, 6));
  assert.strictEqual(at2(10), 26);
  assert.strictEqual(at2(11), 24);
  assert.strictEqual(at2(24), 24);
  assert.strictEqual(at2(25), 22);
  assert.strictEqual(at2(48), 22);
  assert.strictEqual(at2(49), 20);
  assert.strictEqual(at2(72), 20);
  assert.strictEqual(at2(73), 18);
  const at3 = (dim) => dm.selectGauge('3', dm.makeRectSize(dim, 6));
  assert.strictEqual(at3(8), 26);
  assert.strictEqual(at3(9), 24);
  assert.strictEqual(at3(20), 24);
  assert.strictEqual(at3(21), 22);
  assert.strictEqual(at3(40), 22);
  assert.strictEqual(at3(41), 20);
  assert.strictEqual(at3(60), 20);
  assert.strictEqual(at3(61), 18);
});

test('selectGauge: ½" w.g. ships and matches 1"; round keys on diameter', () => {
  assert.strictEqual(dm.selectGauge('1/2', dm.makeRectSize(12, 12)), 26);
  assert.strictEqual(dm.selectGauge('1/2', dm.makeRectSize(31, 12)), 22);
  assert.strictEqual(dm.selectGauge('1', dm.makeRoundSize(12)), 26);
  assert.strictEqual(dm.selectGauge('1', dm.makeRoundSize(13)), 24);
  assert.ok(dm.DUCT_PRESSURE_CLASSES.includes('1/2'));
  assert.ok(dm.DUCT_PRESSURE_CLASSES.includes('1'));
  assert.ok(dm.DUCT_PRESSURE_CLASSES.includes('2'));
  assert.ok(dm.DUCT_PRESSURE_CLASSES.includes('3'));
});

test('selectGauge: unknown pressure class falls back to 1"; bad size → null', () => {
  assert.strictEqual(dm.selectGauge('10', dm.makeRectSize(24, 12)), 24);
  assert.strictEqual(dm.selectGauge('1', null), null);
});

// --- 3. Weight math ----------------------------------------------------------

test('ductPerimeterIn: rect 2(w+h), round π·d', () => {
  assert.strictEqual(dm.ductPerimeterIn(dm.makeRectSize(24, 12)), 72);
  assert.strictEqual(dm.ductPerimeterIn(dm.makeRectSize(16, 10)), 52);
  close(dm.ductPerimeterIn(dm.makeRoundSize(12)), Math.PI * 12);
  assert.strictEqual(dm.ductPerimeterIn(null), 0);
});

test('ductWeightPerFoot: the DUCT-PLAN worked numbers, verbatim at 2dp', () => {
  assert.strictEqual(dm.ductWeightPerFoot(dm.makeRectSize(24, 12), 24).toFixed(2), '6.94');
  assert.strictEqual(dm.ductWeightPerFoot(dm.makeRectSize(20, 12), 24).toFixed(2), '6.17');
  assert.strictEqual(dm.ductWeightPerFoot(dm.makeRectSize(16, 10), 26).toFixed(2), '3.93');
  assert.strictEqual(dm.ductWeightPerFoot(dm.makeRoundSize(12), 26).toFixed(2), '2.85');
});

test('ductWeightPerFoot: exact math + unknown gauge → null', () => {
  close(dm.ductWeightPerFoot(dm.makeRectSize(24, 12), 24), 6 * 1.156);
  close(dm.ductWeightPerFoot(dm.makeRoundSize(12), 26), Math.PI * 0.906);
  assert.strictEqual(dm.ductWeightPerFoot(dm.makeRectSize(24, 12), 21), null);
  assert.strictEqual(dm.ductWeightPerFoot(null, 24), null);
});

test('segmentPounds: lb/ft × ft', () => {
  close(dm.segmentPounds(dm.makeRectSize(24, 12), 24, 10), 69.36);
  assert.strictEqual(dm.segmentPounds(dm.makeRectSize(24, 12), 21, 10), null);
  assert.strictEqual(dm.segmentPounds(dm.makeRectSize(24, 12), 24, NaN), null);
});

test('fitting lb-eq table + fittingPounds (elbow 24×12 ≈ 35 lb per DUCT-PLAN)', () => {
  assert.strictEqual(dm.fittingEquivalentLF('elbow90'), 5);
  assert.strictEqual(dm.fittingEquivalentLF('transition'), 2);
  assert.strictEqual(dm.fittingEquivalentLF('tap'), 1.5);
  assert.strictEqual(dm.fittingEquivalentLF('boot'), 1);
  assert.strictEqual(dm.fittingEquivalentLF('elbow45'), 2.5);
  assert.strictEqual(dm.fittingEquivalentLF('offset'), 2.5);
  assert.strictEqual(dm.fittingEquivalentLF('wormhole'), 0);
  const lb = dm.fittingPounds('elbow90', dm.makeRectSize(24, 12), 24);
  close(lb, 34.68);            // 5 LF × 6.936 lb/ft — DUCT-PLAN's "elbow 24×12 ≈ 35 lb"
  assert.strictEqual(Math.round(lb), 35);
  close(dm.fittingPounds('tap', dm.makeRoundSize(12), 26), 1.5 * Math.PI * 0.906);
  assert.strictEqual(dm.fittingPounds('elbow90', dm.makeRectSize(24, 12), 21), null);
});

test('runSegmentSpans: last segment runs to the final vertex; degenerates → []', () => {
  const run = dm.makeDuctRun({
    vertices: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 50, y: 20 }],
    segments: [
      { startVertexIdx: 0, size: dm.makeRectSize(24, 12) },
      { startVertexIdx: 2, size: dm.makeRectSize(20, 12) },
    ],
  });
  const spans = dm.runSegmentSpans(run);
  assert.strictEqual(spans.length, 2);
  assert.deepStrictEqual([spans[0].fromIdx, spans[0].toIdx], [0, 2]);
  assert.deepStrictEqual([spans[1].fromIdx, spans[1].toIdx], [2, 3]);
  assert.deepStrictEqual(dm.runSegmentSpans(dm.makeDuctRun()), []);
  assert.deepStrictEqual(dm.runSegmentSpans(dm.makeDuctRun({ vertices: [{ x: 0, y: 0 }] })), []);
});

test('runStraightItems: polyline lengths per size, default Euclidean distance', () => {
  // Corner at vertex 1 inside segment 0 (no size change there).
  const run = dm.makeDuctRun({
    linerType: 'liner',
    vertices: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 50, y: 20 }],
    segments: [
      { startVertexIdx: 0, size: dm.makeRectSize(24, 12) },
      { startVertexIdx: 2, size: dm.makeRectSize(20, 12) },
    ],
  });
  const items = dm.runStraightItems(run);
  assert.strictEqual(items.length, 2);
  close(items[0].lengthFt, 50);         // 30 + 20
  close(items[1].lengthFt, 20);
  assert.deepStrictEqual(items[0].size, { kind: 'rect', w: 24, h: 12 });
  assert.strictEqual(items[0].liner, 'liner');
  assert.strictEqual(items[1].liner, 'liner');
});

test('runStraightItems: caller-supplied distFt (the scale glue seam)', () => {
  const run = dm.makeDuctRun({
    vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    segments: [{ startVertexIdx: 0, size: dm.makeRoundSize(12) }],
  });
  const items = dm.runStraightItems(run, (a, b) => Math.abs(b.x - a.x) / 10);
  close(items[0].lengthFt, 10);
  assert.strictEqual(items[0].liner, null);
});

test('tallyStraightBySize: merges same sizes, auto gauge, override wins', () => {
  const items = [
    { size: dm.makeRectSize(24, 12), lengthFt: 40 },
    { size: dm.makeRectSize(24, 12), lengthFt: 10 },
    { size: dm.makeRoundSize(12), lengthFt: 20 },
    { size: null, lengthFt: 99 },                       // ignored
    { size: dm.makeRectSize(24, 12), lengthFt: 0 },     // ignored
  ];
  const t = dm.tallyStraightBySize(items, '1');
  assert.strictEqual(t.rows.length, 2);
  const rect = t.rows.find(r => r.sizeKey === '24×12');
  const round = t.rows.find(r => r.sizeKey === '12"Ø');
  assert.strictEqual(rect.gauge, 24);
  close(rect.lengthFt, 50);
  close(rect.lbPerFt, 6.936);
  close(rect.pounds, 346.8);
  assert.strictEqual(round.gauge, 26);
  close(round.pounds, 20 * Math.PI * 0.906);
  close(t.totalLengthFt, 70);
  close(t.totalPounds, 346.8 + 20 * Math.PI * 0.906);
  // gauge override chip: force 24×12 to 22 ga
  const o = dm.tallyStraightBySize(items, '1', { '24×12': 22 });
  const orect = o.rows.find(r => r.sizeKey === '24×12');
  assert.strictEqual(orect.gauge, 22);
  close(orect.lbPerFt, 6 * 1.406);
});

test('rollupDuct: counted fittings, seam & waste %, insulation, bid weight', () => {
  const straightItems = [
    { size: dm.makeRectSize(24, 12), lengthFt: 40, liner: 'liner' },
    { size: dm.makeRectSize(24, 12), lengthFt: 10, liner: 'liner' },
    { size: dm.makeRoundSize(12), lengthFt: 20, liner: 'wrap' },
  ];
  const fittings = [
    { type: 'elbow90', size: dm.makeRectSize(24, 12) },
    { type: 'elbow90', size: dm.makeRectSize(24, 12) },
    { type: 'transition', size: dm.makeRectSize(24, 12) },
    { type: 'tap', size: dm.makeRoundSize(12) },
  ];
  const r = dm.rollupDuct({ straightItems, fittings, pressureClass: '1', seamWastePct: 15, fittingMode: 'counted', fittingFactorPct: 40 });
  const straightLb = 346.8 + 20 * Math.PI * 0.906;
  close(r.straight.totalPounds, straightLb);
  close(r.straight.totalLengthFt, 70);
  // counted fittings: 2 elbows @ 34.68, transition 13.872, tap 1.5·π·0.906
  const elbowRow = r.fittings.rows.find(x => x.type === 'elbow90');
  assert.strictEqual(elbowRow.count, 2);
  close(elbowRow.lbEach, 34.68);
  close(elbowRow.pounds, 69.36);
  const countedLb = 69.36 + 13.872 + 1.5 * Math.PI * 0.906;
  close(r.fittings.totalPounds, countedLb);
  // both fitting numbers always computed; counted applied
  close(r.fittingFactorPounds, straightLb * 0.4);
  close(r.fittingsAppliedPounds, countedLb);
  close(r.subtotalPounds, straightLb + countedLb);
  assert.strictEqual(r.seamWastePct, 15);
  close(r.seamWastePounds, (straightLb + countedLb) * 0.15);
  close(r.bidWeightPounds, (straightLb + countedLb) * 1.15);
  // insulation from the same items: liner on 50 ft of 24×12 (6 sqft/ft),
  // wrap on 20 ft of 12"Ø (π sqft/ft)
  close(r.linerSqFt, 300);
  close(r.wrapSqFt, 20 * Math.PI);
});

test('rollupDuct: factor mode applies the % fallback instead of the counted rows', () => {
  const straightItems = [{ size: dm.makeRectSize(24, 12), lengthFt: 100 }];
  const fittings = [{ type: 'elbow90', size: dm.makeRectSize(24, 12) }];
  const r = dm.rollupDuct({ straightItems, fittings, fittingMode: 'factor', fittingFactorPct: 40 });
  close(r.straight.totalPounds, 693.6);
  close(r.fittingFactorPounds, 277.44);
  close(r.fittingsAppliedPounds, 277.44);      // NOT the 34.68 counted elbow
  close(r.fittings.totalPounds, 34.68);        // still computed for the toggle
  assert.strictEqual(r.fittings.mode, 'factor');
  close(r.bidWeightPounds, 693.6 + 277.44);    // seam % defaults to 0
  assert.strictEqual(r.seamWastePounds, 0);
  assert.strictEqual(r.linerSqFt, 0);
  assert.strictEqual(r.wrapSqFt, 0);
});

test('rollupDuct: defaults are sane on empty input', () => {
  const r = dm.rollupDuct({});
  assert.strictEqual(r.straight.totalPounds, 0);
  assert.strictEqual(r.fittings.totalPounds, 0);
  assert.strictEqual(r.bidWeightPounds, 0);
  assert.strictEqual(r.fittingFactorPct, 40);
  assert.strictEqual(r.fittings.mode, 'counted');
});

test('rollupRunsToSchedule composes runs → items → rollup', () => {
  const run = dm.makeDuctRun({
    linerType: 'liner',
    vertices: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 50, y: 20 }],
    segments: [
      { startVertexIdx: 0, size: dm.makeRectSize(24, 12) },
      { startVertexIdx: 2, size: dm.makeRectSize(20, 12) },
    ],
  });
  const fittings = [{ type: 'elbow90', size: dm.makeRectSize(24, 12) }];
  const r = dm.rollupRunsToSchedule([run], fittings, { pressureClass: '1', seamWastePct: 15 });
  // 50 ft of 24×12 (6.936) + 20 ft of 20×12 (6.16533…) + elbow 34.68, ×1.15
  const straightLb = 50 * 6 * 1.156 + 20 * (64 / 12) * 1.156;
  close(r.straight.totalPounds, straightLb);
  close(r.bidWeightPounds, (straightLb + 34.68) * 1.15);
  close(r.linerSqFt, 50 * 6 + 20 * (64 / 12));    // whole lined run, both sizes
});

// --- 4. Insulation -----------------------------------------------------------

test('insulation: LF × perimeter/12, both kinds; bad input → 0', () => {
  assert.strictEqual(dm.insulationSqFtPerFoot(dm.makeRectSize(24, 12)), 6);
  close(dm.insulationSqFtPerFoot(dm.makeRoundSize(12)), Math.PI);
  assert.strictEqual(dm.insulationSqFt(dm.makeRectSize(24, 12), 50), 300);
  close(dm.insulationSqFt(dm.makeRoundSize(12), 20), 20 * Math.PI);
  assert.strictEqual(dm.insulationSqFt(dm.makeRectSize(24, 12), 0), 0);
  assert.strictEqual(dm.insulationSqFt(null, 50), 0);
});

// --- 5. Ductulator -----------------------------------------------------------

test('friction fit anchors: 600 CFM @ 0.08 ≈ 12"Ø, 150 CFM @ 0.08 ≈ 7"Ø', () => {
  // DUCT-PLAN's cited ductulator anchors — the fit must land inside them.
  const d600 = dm.frictionRoundDiameterIn(600, 0.08);
  assert.ok(d600 >= 11.5 && d600 <= 13, `600 CFM → ${d600}`);
  const d150 = dm.frictionRoundDiameterIn(150, 0.08);
  assert.ok(d150 >= 7 && d150 <= 8, `150 CFM → ${d150}`);
  // tighter pins so a formula regression can't drift inside the band
  close(d600, 11.98, 0.05);
  close(d150, 7.09, 0.05);
});

test('frictionRateForRound inverts frictionRoundDiameterIn', () => {
  const d = dm.frictionRoundDiameterIn(600, 0.08);
  close(dm.frictionRateForRound(600, d), 0.08, 1e-9);
  assert.strictEqual(dm.frictionRoundDiameterIn(0, 0.08), 0);
  assert.strictEqual(dm.frictionRoundDiameterIn(600, 0), 0);
  assert.strictEqual(dm.frictionRateForRound(600, 0), 0);
});

test('velocity helpers: area, fpm, cap diameter', () => {
  close(dm.roundAreaSqFt(12), Math.PI * 144 / 576);          // 0.7854 sq ft
  close(dm.roundVelocityFpm(600, 12), 600 / (Math.PI / 4));  // ≈ 763.9 fpm
  const vd = dm.velocityLimitedDiameterIn(600, 1200);
  close(vd, Math.sqrt(576 * 600 / (Math.PI * 1200)));        // ≈ 9.57"
  close(dm.roundVelocityFpm(600, vd), 1200, 1e-9);           // exactly at the cap
  assert.strictEqual(dm.velocityLimitedDiameterIn(0, 1200), 0);
  assert.strictEqual(dm.roundVelocityFpm(600, 0), 0);
});

test('suggestRoundDiameter: friction binds at defaults (600 CFM → 12"Ø)', () => {
  const s = dm.suggestRoundDiameter(600);
  assert.strictEqual(s.diameterIn, 12);
  assert.strictEqual(s.binding, 'friction');
  assert.ok(s.velocityFpm < 1200);
  close(s.frictionDiameterIn, 11.98, 0.05);
  close(s.velocityDiameterIn, 9.57, 0.05);
  // 150 CFM: raw 7.09 rounds up the stock ladder to 8"
  const small = dm.suggestRoundDiameter(150);
  assert.strictEqual(small.diameterIn, 8);
  assert.strictEqual(small.binding, 'friction');
});

test('suggestRoundDiameter: a low cap flips the binding to velocity and upsizes', () => {
  const s = dm.suggestRoundDiameter(600, { maxVelocityFpm: 600 });
  assert.strictEqual(s.binding, 'velocity');
  assert.strictEqual(s.diameterIn, 14);        // vel-limited 13.54" → stock 14"
  assert.ok(s.velocityFpm <= 600);
  assert.ok(s.velocityDiameterIn > s.frictionDiameterIn);
  assert.strictEqual(dm.suggestRoundDiameter(0), null);
});

test('suggestRoundDiameter: stock ladder is whole inches to 10", even above', () => {
  assert.strictEqual(dm.suggestRoundDiameter(150).diameterIn, 8);      // 7.09 → 8
  assert.strictEqual(dm.suggestRoundDiameter(1000).diameterIn, 16);    // 14.53 → 15 → even 16
  assert.strictEqual(dm.suggestRoundDiameter(50).diameterIn, 5);       // 4.68 → 5 (whole inch under 10)
  assert.strictEqual(dm.suggestRoundDiameter(1).diameterIn, 4);        // floor 4"
});

test('rectEquivalentDiameterIn: De = 1.30(ab)^0.625/(a+b)^0.25', () => {
  close(dm.rectEquivalentDiameterIn(12, 8), 1.30 * Math.pow(96, 0.625) / Math.pow(20, 0.25));
  close(dm.rectEquivalentDiameterIn(12, 8), 10.66, 0.01);   // DUCT-PLAN's '10"Ø or 12×8'
  close(dm.rectEquivalentDiameterIn(12, 12), 13.12, 0.01);
  assert.strictEqual(dm.rectEquivalentDiameterIn(0, 8), 0);
});

test('suggestRectForRound: 10"Ø → 12×8 (the DUCT-PLAN dual-suggestion pair)', () => {
  const r = dm.suggestRectForRound(10);
  assert.deepStrictEqual({ w: r.w, h: r.h }, { w: 12, h: 8 });
  assert.ok(r.equivalentDiameterIn >= 10);
});

test('suggestRectForRound: aspect cap, depth limit, and the impossible case', () => {
  const r12 = dm.suggestRectForRound(12);
  assert.ok(r12.w / r12.h <= 4);
  assert.ok(r12.equivalentDiameterIn >= 12);
  assert.strictEqual(2 * (r12.w + r12.h), 48);              // the minimal-perimeter tier
  // plenum depth limit forces a shallow, wider duct
  const shallow = dm.suggestRectForRound(12, { maxDepthIn: 8 });
  assert.ok(shallow.h <= 8);
  assert.ok(shallow.equivalentDiameterIn >= 12);
  assert.ok(shallow.w / shallow.h <= 4);
  // a depth limit the 4:1 aspect cap can't satisfy → null, never a bad rect
  assert.strictEqual(dm.suggestRectForRound(30, { maxDepthIn: 6 }), null);
  assert.strictEqual(dm.suggestRectForRound(0), null);
});

test('suggestRoundAndRect: both suggestions + the binding constraint named', () => {
  const s = dm.suggestRoundAndRect(600);
  assert.strictEqual(s.round.diameterIn, 12);
  assert.strictEqual(s.binding, 'friction');
  assert.ok(s.rect.equivalentDiameterIn >= 12);
  assert.ok(s.rect.w / s.rect.h <= 4);
  const capped = dm.suggestRoundAndRect(600, { maxVelocityFpm: 600 });
  assert.strictEqual(capped.binding, 'velocity');
  assert.strictEqual(capped.round.diameterIn, 14);
  assert.ok(capped.rect.equivalentDiameterIn >= 14);
  assert.strictEqual(dm.suggestRoundAndRect(-5), null);
});

// --- 6. Neck-size table ------------------------------------------------------

test('suggestNeckSize: every table boundary', () => {
  assert.strictEqual(dm.suggestNeckSize(150).neckDIn, 8);    // DUCT-PLAN: 150 CFM → 2×2 lay-in, 8"Ø
  assert.strictEqual(dm.suggestNeckSize(150).device, '2×2 lay-in diffuser');
  assert.strictEqual(dm.suggestNeckSize(151).neckDIn, 10);
  assert.strictEqual(dm.suggestNeckSize(300).neckDIn, 10);
  assert.strictEqual(dm.suggestNeckSize(301).neckDIn, 12);
  assert.strictEqual(dm.suggestNeckSize(450).neckDIn, 12);
  assert.strictEqual(dm.suggestNeckSize(451).neckDIn, 14);
  assert.strictEqual(dm.suggestNeckSize(700).neckDIn, 14);
  assert.strictEqual(dm.suggestNeckSize(1).neckDIn, 8);
  assert.strictEqual(dm.suggestNeckSize(450).overCapacity, false);
});

test('suggestNeckSize: past the table → largest row flagged overCapacity; bad input → null', () => {
  const big = dm.suggestNeckSize(701);
  assert.strictEqual(big.neckDIn, 14);
  assert.strictEqual(big.overCapacity, true);
  assert.strictEqual(dm.suggestNeckSize(0), null);
  assert.strictEqual(dm.suggestNeckSize(-10), null);
  assert.strictEqual(dm.suggestNeckSize(NaN), null);
});

// --- 5b. Stroke-width mapping (D2) -------------------------------------------

test('ductStrokePx: band boundaries on the governing dimension', () => {
  assert.strictEqual(dm.ductStrokePx(dm.makeRoundSize(6)), 3);     // ≤8
  assert.strictEqual(dm.ductStrokePx(dm.makeRoundSize(8)), 3);
  assert.strictEqual(dm.ductStrokePx(dm.makeRectSize(12, 8)), 4);  // ≤14 (larger side keys)
  assert.strictEqual(dm.ductStrokePx(dm.makeRectSize(8, 12)), 4);  // orientation-agnostic
  assert.strictEqual(dm.ductStrokePx(dm.makeRectSize(16, 10)), 5); // ≤20
  assert.strictEqual(dm.ductStrokePx(dm.makeRectSize(24, 12)), 6); // ≤28
  assert.strictEqual(dm.ductStrokePx(dm.makeRectSize(36, 12)), 8); // ≤40
  assert.strictEqual(dm.ductStrokePx(dm.makeRectSize(54, 20)), 10); // ≤60
  assert.strictEqual(dm.ductStrokePx(dm.makeRectSize(84, 24)), 12); // else
});

test('ductStrokePx: bad sizes fall back to the smallest band', () => {
  assert.strictEqual(dm.ductStrokePx(null), 3);
  assert.strictEqual(dm.ductStrokePx({ kind: 'rect', w: -1, h: 4 }), 3);
});
