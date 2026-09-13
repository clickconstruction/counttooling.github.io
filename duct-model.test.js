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

// --- 3b. Fitting inference (D3) ----------------------------------------------

// A run factory for the walk tests: straight sizes unless segments given.
const run = (id, vertices, segments) => dm.makeDuctRun({
  id, vertices,
  segments: segments || [{ startVertexIdx: 0, size: dm.makeRectSize(24, 12) }],
});

test('ductBendAngleDeg: direction change at the middle vertex', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
  close(dm.ductBendAngleDeg(a, b, { x: 20, y: 0 }), 0);
  close(dm.ductBendAngleDeg(a, b, { x: 20, y: 10 }), 45, 1e-9);
  close(dm.ductBendAngleDeg(a, b, { x: 10, y: 10 }), 90);
  close(dm.ductBendAngleDeg(a, b, { x: 0, y: 0.001 }), 180, 0.01);
  // degenerate zero-length leg → 0 (never a fitting)
  close(dm.ductBendAngleDeg(a, a, { x: 20, y: 10 }), 0);
});

test('largerDuctSize: governing dim, then perimeter, ties → first', () => {
  const a = dm.makeRectSize(24, 12), b = dm.makeRectSize(22, 12);
  assert.strictEqual(dm.largerDuctSize(a, b), a);
  assert.strictEqual(dm.largerDuctSize(b, a), a);
  // same governing dim (24): 24×12 perim 72 < 24×20 perim 88
  const c = dm.makeRectSize(24, 20);
  assert.strictEqual(dm.largerDuctSize(a, c), c);
  // exact tie keeps the first argument
  const a2 = dm.makeRectSize(24, 12);
  assert.strictEqual(dm.largerDuctSize(a, a2), a);
  assert.strictEqual(dm.largerDuctSize(null, b), b);
  assert.strictEqual(dm.largerDuctSize(a, null), a);
});

test('ductSizeAtVertex: the incoming segment size, boundary included', () => {
  const r = run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 }], [
    { startVertexIdx: 0, size: dm.makeRectSize(24, 12) },
    { startVertexIdx: 2, size: dm.makeRectSize(20, 12) },
  ]);
  assert.deepStrictEqual(dm.ductSizeAtVertex(r, 0), { kind: 'rect', w: 24, h: 12 });
  assert.deepStrictEqual(dm.ductSizeAtVertex(r, 1), { kind: 'rect', w: 24, h: 12 });
  // the boundary vertex belongs to the ARRIVING segment (the duct being bent)
  assert.deepStrictEqual(dm.ductSizeAtVertex(r, 2), { kind: 'rect', w: 24, h: 12 });
  assert.deepStrictEqual(dm.ductSizeAtVertex(r, 3), { kind: 'rect', w: 20, h: 12 });
});

test('inferAutoDuctFittings: L-shaped run logs exactly one elbow90', () => {
  const fits = dm.inferAutoDuctFittings([run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])]);
  assert.strictEqual(fits.length, 1);
  assert.deepStrictEqual(fits[0], {
    runId: 'r1', vertexIdx: 1, origin: 'bend', type: 'elbow90',
    size: { kind: 'rect', w: 24, h: 12 }, auto: true,
  });
});

test('inferAutoDuctFittings: elbow thresholds — <30° nothing, 30–60° elbow45, ≥60° elbow90', () => {
  const bent = (deg) => {
    const rad = deg * Math.PI / 180;
    return run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100 + 100 * Math.cos(rad), y: 100 * Math.sin(rad) }]);
  };
  assert.strictEqual(dm.inferAutoDuctFittings([bent(20)]).length, 0);
  assert.strictEqual(dm.inferAutoDuctFittings([bent(29.9)]).length, 0);
  assert.strictEqual(dm.inferAutoDuctFittings([bent(30)])[0].type, 'elbow45');
  assert.strictEqual(dm.inferAutoDuctFittings([bent(45)])[0].type, 'elbow45');
  assert.strictEqual(dm.inferAutoDuctFittings([bent(59.9)])[0].type, 'elbow45');
  assert.strictEqual(dm.inferAutoDuctFittings([bent(60)])[0].type, 'elbow90');
  assert.strictEqual(dm.inferAutoDuctFittings([bent(90)])[0].type, 'elbow90');
});

test('inferAutoDuctFittings: size steps log transitions at the larger side', () => {
  const r = run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], [
    { startVertexIdx: 0, size: dm.makeRectSize(24, 12) },
    { startVertexIdx: 1, size: dm.makeRectSize(20, 12) },
  ]);
  const fits = dm.inferAutoDuctFittings([r]);
  assert.strictEqual(fits.length, 1);
  assert.deepStrictEqual(fits[0], {
    runId: 'r1', vertexIdx: 1, origin: 'step', type: 'transition',
    size: { kind: 'rect', w: 24, h: 12 }, auto: true,
  });
});

test('inferAutoDuctFittings: a corner AND a step at one vertex log both fittings', () => {
  const r = run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], [
    { startVertexIdx: 0, size: dm.makeRectSize(24, 12) },
    { startVertexIdx: 1, size: dm.makeRectSize(20, 12) },
  ]);
  const fits = dm.inferAutoDuctFittings([r]);
  assert.strictEqual(fits.length, 2);
  const elbow = fits.find(f => f.origin === 'bend'), step = fits.find(f => f.origin === 'step');
  assert.strictEqual(elbow.type, 'elbow90');
  // the elbow is cut from the ARRIVING duct
  assert.deepStrictEqual(elbow.size, { kind: 'rect', w: 24, h: 12 });
  assert.strictEqual(step.type, 'transition');
});

test('inferAutoDuctFittings: run-on-run logs a tap on the PARENT at the child start size', () => {
  const parent = run('p', [{ x: 0, y: 0 }, { x: 200, y: 0 }]);
  const child = run('c', [{ x: 100, y: 5 }, { x: 100, y: 100 }],
    [{ startVertexIdx: 0, size: dm.makeRoundSize(10) }]);
  const fits = dm.inferAutoDuctFittings([parent, child]);
  assert.strictEqual(fits.length, 1);
  assert.deepStrictEqual(fits[0], {
    runId: 'p', position: { x: 100, y: 5 }, origin: 'tap', type: 'tap',
    size: { kind: 'round', d: 10 }, auto: true,
  });
  // outside the snap distance → no tap
  const far = run('c2', [{ x: 100, y: 40 }, { x: 100, y: 140 }]);
  assert.strictEqual(dm.inferAutoDuctFittings([parent, far]).length, 0);
  // custom tolerance widens the snap
  assert.strictEqual(dm.inferAutoDuctFittings([parent, far], { tapSnapDist: 50 }).length, 1);
  // nearest parent wins: both parents sit within the child's snap distance
  // (5 vs 11 units) but far enough apart (16) not to tap each other.
  const parent2 = run('p2', [{ x: 0, y: 16 }, { x: 200, y: 16 }]);
  const both = dm.inferAutoDuctFittings([parent, parent2, child]);
  const taps = both.filter(f => f.type === 'tap');
  assert.strictEqual(taps.length, 1);
  assert.strictEqual(taps[0].runId, 'p');   // 5 units away beats 11
});

test('inferAutoDuctFittings: a run never taps itself; degenerate runs are skipped', () => {
  const r = run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  assert.strictEqual(dm.inferAutoDuctFittings([r]).length, 0);
  assert.strictEqual(dm.inferAutoDuctFittings([run('r2', [{ x: 0, y: 0 }])]).length, 0);
  assert.strictEqual(dm.inferAutoDuctFittings(null).length, 0);
});

test('ductFittingAnchor: vertexIdx through the run, position free, pruned when gone', () => {
  const r = run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
  const byVertex = dm.makeDuctFitting({ runId: 'r1', vertexIdx: 1, size: dm.makeRectSize(24, 12) });
  assert.deepStrictEqual(dm.ductFittingAnchor(byVertex, [r]), { x: 100, y: 0 });
  assert.strictEqual(dm.ductFittingAnchor(byVertex, []), null);                       // run gone
  const past = dm.makeDuctFitting({ runId: 'r1', vertexIdx: 9, size: dm.makeRectSize(24, 12) });
  assert.strictEqual(dm.ductFittingAnchor(past, [r]), null);                          // vertex gone
  const tap = dm.makeDuctFitting({ runId: 'r1', position: { x: 50, y: 1 }, type: 'tap', size: dm.makeRoundSize(8) });
  assert.deepStrictEqual(dm.ductFittingAnchor(tap, [r]), { x: 50, y: 1 });
  assert.strictEqual(dm.ductFittingAnchor(tap, []), null);                            // parent gone → tap gone
});

test('ductFittingOutDirection: outgoing leg, incoming at the last vertex', () => {
  const r = run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
  const mid = dm.makeDuctFitting({ runId: 'r1', vertexIdx: 1, size: dm.makeRectSize(24, 12) });
  assert.deepStrictEqual(dm.ductFittingOutDirection(mid, [r]), { x: 0, y: 1 });
  const last = dm.makeDuctFitting({ runId: 'r1', vertexIdx: 2, size: dm.makeRectSize(24, 12) });
  assert.deepStrictEqual(dm.ductFittingOutDirection(last, [r]), { x: 0, y: 1 });
  const tap = dm.makeDuctFitting({ runId: 'r1', position: { x: 50, y: 1 }, size: dm.makeRoundSize(8) });
  assert.strictEqual(dm.ductFittingOutDirection(tap, [r]), null);
});

test('reconcileDuctFittings: idempotent, id-stable, and type-updating for autos', () => {
  const runs = [run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])];
  const inferred = dm.inferAutoDuctFittings(runs);
  const first = dm.reconcileDuctFittings([], inferred, runs);
  assert.strictEqual(first.length, 1);
  assert.ok(first[0].id);
  assert.strictEqual(first[0].auto, true);
  // re-walking with unchanged geometry keeps the id and content
  const second = dm.reconcileDuctFittings(first, dm.inferAutoDuctFittings(runs), runs);
  assert.deepStrictEqual(second, first);
  assert.strictEqual(second[0].id, first[0].id);
  // geometry re-derives the auto's type in place (same anchor, same id)
  const asIf45 = dm.reconcileDuctFittings(
    [dm.makeDuctFitting({ ...first[0], type: 'elbow45' })], dm.inferAutoDuctFittings(runs), runs);
  assert.strictEqual(asIf45[0].type, 'elbow90');
  assert.strictEqual(asIf45[0].id, first[0].id);
});

test('reconcileDuctFittings: a reclassified (non-auto) fitting suppresses its inferred twin and survives', () => {
  const runs = [run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])];
  const inferred = dm.inferAutoDuctFittings(runs);
  const auto = dm.reconcileDuctFittings([], inferred, runs)[0];
  const manual = { ...auto, type: 'boot', auto: false };
  const next = dm.reconcileDuctFittings([manual], dm.inferAutoDuctFittings(runs), runs);
  assert.strictEqual(next.length, 1);
  assert.strictEqual(next[0], manual);   // survives verbatim (same reference)
  assert.strictEqual(next[0].type, 'boot');
  assert.strictEqual(next[0].auto, false);
});

test('reconcileDuctFittings: suppressed tombstones block resurrection; counts skip them', () => {
  const runs = [run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])];
  const auto = dm.reconcileDuctFittings([], dm.inferAutoDuctFittings(runs), runs)[0];
  const tombstone = { ...auto, auto: false, suppressed: true };
  const next = dm.reconcileDuctFittings([tombstone], dm.inferAutoDuctFittings(runs), runs);
  assert.strictEqual(next.length, 1);
  assert.strictEqual(next[0].suppressed, true);
  assert.deepStrictEqual(dm.tallyDuctFittingCounts(next), []);
});

test('reconcileDuctFittings: fittings of a deleted run are pruned (manual included)', () => {
  const runs = [run('r1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])];
  const kept = dm.reconcileDuctFittings([], dm.inferAutoDuctFittings(runs), runs);
  const manual = { ...kept[0], type: 'offset', auto: false };
  const afterDelete = dm.reconcileDuctFittings([manual], dm.inferAutoDuctFittings([]), []);
  assert.deepStrictEqual(afterDelete, []);
});

test('tallyDuctFittingCounts: groups by type + sizeKey in type order', () => {
  const s24 = dm.makeRectSize(24, 12), s20 = dm.makeRectSize(20, 12);
  const mk = (type, size) => dm.makeDuctFitting({ runId: 'r', vertexIdx: 0, type, size });
  const rows = dm.tallyDuctFittingCounts([
    mk('tap', s20), mk('elbow90', s24), mk('elbow90', s24), mk('transition', s24), mk('elbow90', s20),
  ]);
  assert.deepStrictEqual(rows, [
    { type: 'elbow90', sizeKey: '20×12', count: 1 },
    { type: 'elbow90', sizeKey: '24×12', count: 2 },
    { type: 'transition', sizeKey: '24×12', count: 1 },
    { type: 'tap', sizeKey: '20×12', count: 1 },
  ]);
});

// --- 3c. Design-build accumulation (unit D6) ---------------------------------

// A straight-line run helper: id, vertices, one segment at 24×12 unless given.
const netRun = (id, verts, extra) => dm.makeDuctRun({
  id, vertices: verts,
  segments: [{ startVertexIdx: 0, size: dm.makeRectSize(24, 12) }],
  ...extra,
});
const dev = (x, y, cfm, groupId) => ({ x, y, cfm, groupId: groupId || null });

test('ductNearestOnPolyline: distance + arclength of the nearest point', () => {
  const verts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  let hit = dm.ductNearestOnPolyline({ x: 50, y: 10 }, verts);
  close(hit.dist, 10);
  close(hit.s, 50);
  hit = dm.ductNearestOnPolyline({ x: 110, y: 60 }, verts);
  close(hit.dist, 10);
  close(hit.s, 160);   // 100 along the first leg + 60 down the second
  assert.strictEqual(dm.ductNearestOnPolyline({ x: 0, y: 0 }, [{ x: 0, y: 0 }]).dist, Infinity);
  close(dm.ductPolylineLength(verts), 200);
});

test('attachDuctDevices: nearest run within snap wins; far devices unattached', () => {
  const trunk = netRun('trunk', [{ x: 0, y: 0 }, { x: 300, y: 0 }]);
  const branch = netRun('branch', [{ x: 200, y: 4 }, { x: 200, y: 150 }]);
  const near = dev(100, 8, 150);            // 8 from trunk — attaches there
  const nearer = dev(196, 100, 300);        // 4 from branch, ~100 from trunk
  const far = dev(100, 50, 200);            // 50 from everything — unattached
  const res = dm.attachDuctDevices([near, nearer, far], [trunk, branch]);
  assert.strictEqual(res.attached.length, 2);
  assert.strictEqual(res.attached[0].runId, 'trunk');
  close(res.attached[0].s, 100);
  assert.strictEqual(res.attached[1].runId, 'branch');
  assert.deepStrictEqual(res.unattached, [far]);
  // A wider snap picks the far device up too.
  const wide = dm.attachDuctDevices([far], [trunk, branch], { snapDist: 60 });
  assert.strictEqual(wide.attached.length, 1);
});

test('ductChildLinks: a run starting on another run links to that parent at the tap arclength', () => {
  const trunk = netRun('trunk', [{ x: 0, y: 0 }, { x: 300, y: 0 }]);
  const branch = netRun('branch', [{ x: 120, y: 6 }, { x: 120, y: 150 }]);
  const loose = netRun('loose', [{ x: 0, y: 500 }, { x: 100, y: 500 }]);
  const links = dm.ductChildLinks([trunk, branch, loose]);
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].childId, 'branch');
  assert.strictEqual(links[0].parentId, 'trunk');
  close(links[0].s, 120);
});

test('ductDeviceSystemId: attachment-derived, marker-group fallback, else null', () => {
  const trunk = netRun('trunk', [{ x: 0, y: 0 }, { x: 300, y: 0 }], { systemGroupId: 'sysA' });
  assert.strictEqual(dm.ductDeviceSystemId(dev(100, 5, 150), [trunk]), 'sysA');
  assert.strictEqual(dm.ductDeviceSystemId(dev(100, 90, 150, 'sysB'), [trunk]), 'sysB');
  assert.strictEqual(dm.ductDeviceSystemId(dev(100, 90, 150), [trunk]), null);
});

test('ductDownstreamCfm: branching network — devices beyond the point + tapped subtrees', () => {
  // trunk 0→400; branch taps at x=300 and carries one 150-CFM device;
  // two devices sit directly on the trunk at x=100 and x=350.
  const trunk = netRun('trunk', [{ x: 0, y: 0 }, { x: 400, y: 0 }]);
  const branch = netRun('branch', [{ x: 300, y: 5 }, { x: 300, y: 200 }]);
  const devices = [dev(100, 5, 100), dev(350, 5, 200), dev(300, 150, 150)];
  const q = (s) => dm.ductDownstreamCfm({ runs: [trunk, branch], devices, runId: 'trunk', s });
  assert.strictEqual(q(0), 450);      // everything is downstream of the unit
  assert.strictEqual(q(150), 350);    // past the first diffuser
  assert.strictEqual(q(320), 200);    // past the tap — the branch's air left
  assert.strictEqual(q(380), 0);      // past the last device
  // At the branch itself the subtree is its own device.
  assert.strictEqual(dm.ductDownstreamCfm({ runs: [trunk, branch], devices, runId: 'branch', s: 0 }), 150);
  assert.strictEqual(dm.ductDownstreamCfm({ runs: [trunk, branch], devices, runId: 'nope', s: 0 }), null);
});

test('ductDownstreamCfm: unattached devices are excluded', () => {
  const trunk = netRun('trunk', [{ x: 0, y: 0 }, { x: 400, y: 0 }]);
  const devices = [dev(100, 5, 100), dev(100, 300, 999)];   // second is 300 away
  assert.strictEqual(dm.ductDownstreamCfm({ runs: [trunk], devices, runId: 'trunk', s: 0 }), 100);
});

test('ductDownstreamCfm: equipment position flips the orientation (return traced from the far end)', () => {
  // Same geometry; the equipment (RTU) sits at the run's LAST vertex, so the
  // far-from-equipment side is toward vertex 0. Supply vs return share the
  // magnitude — only the equipment end matters.
  const main = netRun('main', [{ x: 0, y: 0 }, { x: 400, y: 0 }], { airside: 'return' });
  const devices = [dev(100, 5, 100), dev(350, 5, 200)];
  const q = (s, equipmentPos) => dm.ductDownstreamCfm({ runs: [main], devices, runId: 'main', s, equipmentPos });
  // Equipment at the start (default): downstream shrinks toward the end.
  assert.strictEqual(q(200), 200);
  // Equipment at the end: the SAME raw s now has only the x=100 grille beyond it.
  assert.strictEqual(q(200, { x: 400, y: 0 }), 100);
  assert.strictEqual(q(400, { x: 400, y: 0 }), 300);   // at the unit: everything
});

test('ductDraftRemainingCfm: total minus passed/served; tip-adjacent devices still count', () => {
  const devices = [dev(100, 5, 100), dev(250, 5, 150), dev(400, 60, 200)];
  const draft = { systemGroupId: null, vertices: [{ x: 0, y: 0 }, { x: 250, y: 0 }], segments: [{ startVertexIdx: 0, size: dm.makeRectSize(24, 12) }] };
  const r = dm.ductDraftRemainingCfm({ runs: [], draft, devices });
  // The x=100 device was passed; the x=250 one is AT the tip (still ahead);
  // the far one is unattached — assumed downstream.
  assert.strictEqual(r.totalCfm, 450);
  assert.strictEqual(r.servedCfm, 100);
  assert.strictEqual(r.cfm, 350);
});

test('ductDraftRemainingCfm: committed same-system runs serve their devices; other systems excluded', () => {
  const done = netRun('done', [{ x: 0, y: 300 }, { x: 300, y: 300 }], { systemGroupId: null });
  const otherSys = netRun('other', [{ x: 0, y: 600 }, { x: 300, y: 600 }], { systemGroupId: 'rtu2' });
  const devices = [
    dev(150, 305, 100),          // on the committed run — served
    dev(150, 605, 500),          // on the OTHER system's run — out of scope
    dev(150, 100, 250),          // loose — still to serve
    dev(150, 120, 300, 'rtu2'),  // loose but assigned to rtu2 — out of scope
  ];
  const draft = { systemGroupId: null, vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }], segments: [] };
  const r = dm.ductDraftRemainingCfm({ runs: [done, otherSys], draft, devices });
  assert.strictEqual(r.totalCfm, 350);
  assert.strictEqual(r.servedCfm, 100);
  assert.strictEqual(r.cfm, 250);
});

test('ductDraftRemainingCfm: no CFM data → null (the clean-absence rule)', () => {
  const draft = { systemGroupId: null, vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }], segments: [] };
  assert.strictEqual(dm.ductDraftRemainingCfm({ runs: [], draft, devices: [] }), null);
  assert.strictEqual(dm.ductDraftRemainingCfm({ runs: [], draft, devices: [dev(50, 5, 0)] }), null);
  assert.strictEqual(dm.ductDraftRemainingCfm({ runs: [], draft: null, devices: [dev(50, 5, 100)] }), null);
});

// --- 3d. Room CFM defaults + air balance (unit D7) ---------------------------

test('ROOM_TYPE_CFM_PER_SQFT: the documented rates (§7)', () => {
  assert.strictEqual(dm.ROOM_TYPE_CFM_PER_SQFT.office.cfmPerSqFt, 1.0);
  assert.strictEqual(dm.ROOM_TYPE_CFM_PER_SQFT.conference.cfmPerSqFt, 1.5);
  assert.strictEqual(dm.ROOM_TYPE_CFM_PER_SQFT.break.cfmPerSqFt, 1.5);
  assert.strictEqual(dm.ROOM_TYPE_CFM_PER_SQFT.storage.cfmPerSqFt, 0.5);
  assert.strictEqual(dm.ROOM_TYPE_CFM_PER_SQFT.custom.cfmPerSqFt, null);
});

test('roomTargetCfm: area × rate, rounded; override wins; clean absence', () => {
  assert.strictEqual(dm.roomTargetCfm({ roomType: 'office' }, 450), 450);
  assert.strictEqual(dm.roomTargetCfm({ roomType: 'conference' }, 300), 450);
  assert.strictEqual(dm.roomTargetCfm({ roomType: 'storage' }, 301), 151);   // rounded
  // Override wins over the derived number.
  assert.strictEqual(dm.roomTargetCfm({ roomType: 'office', targetCfmOverride: 600 }, 450), 600);
  // Custom has no rate — the override IS the target; without one, no target.
  assert.strictEqual(dm.roomTargetCfm({ roomType: 'custom', targetCfmOverride: 275 }, 450), 275);
  assert.strictEqual(dm.roomTargetCfm({ roomType: 'custom' }, 450), null);
  // No type, no override, unknown type, no area → null (zero behavior change).
  assert.strictEqual(dm.roomTargetCfm({}, 450), null);
  assert.strictEqual(dm.roomTargetCfm({ roomType: 'ballroom' }, 450), null);
  assert.strictEqual(dm.roomTargetCfm({ roomType: 'office' }, 0), null);
  assert.strictEqual(dm.roomTargetCfm(null, 450), null);
  // A zero/negative override never sticks; the derived rate still applies.
  assert.strictEqual(dm.roomTargetCfm({ roomType: 'office', targetCfmOverride: 0 }, 450), 450);
});

test('pointInRoomBox: inside/edges/outside, unordered corners', () => {
  const box = { x1: 100, y1: 50, x2: 200, y2: 150 };
  assert.ok(dm.pointInRoomBox({ x: 150, y: 100 }, box));
  assert.ok(dm.pointInRoomBox({ x: 100, y: 50 }, box));    // corner counts
  assert.ok(dm.pointInRoomBox({ x: 200, y: 150 }, box));
  assert.ok(!dm.pointInRoomBox({ x: 99, y: 100 }, box));
  assert.ok(!dm.pointInRoomBox({ x: 150, y: 151 }, box));
  // A box drawn right-to-left / bottom-to-top stores swapped corners.
  const swapped = { x1: 200, y1: 150, x2: 100, y2: 50 };
  assert.ok(dm.pointInRoomBox({ x: 150, y: 100 }, swapped));
  assert.ok(!dm.pointInRoomBox({ x: 250, y: 100 }, swapped));
  assert.ok(!dm.pointInRoomBox(null, box));
  assert.ok(!dm.pointInRoomBox({ x: 150, y: 100 }, null));
});

test('roomServedCfm: point-in-rect sums, page scoping, overlap counted once', () => {
  const boxes = [
    { x1: 0, y1: 0, x2: 100, y2: 100, pageIdx: 0 },
    { x1: 50, y1: 0, x2: 150, y2: 100, pageIdx: 0 },   // overlaps the first
    { x1: 0, y1: 0, x2: 100, y2: 100, pageIdx: 2 },    // the room's page-3 box
  ];
  const d = (x, y, cfm, pageIdx) => ({ x, y, cfm, pageIdx });
  assert.strictEqual(dm.roomServedCfm(boxes, [
    d(25, 25, 150, 0),    // inside box 1
    d(75, 25, 200, 0),    // inside BOTH page-0 boxes — counts once
    d(125, 25, 100, 0),   // inside box 2 only
    d(500, 500, 999, 0),  // outside everything
    d(25, 25, 50, 1),     // right spot, WRONG page — excluded
    d(25, 25, 75, 2),     // the page-3 box serves it
    d(25, 25, 0, 0),      // zero CFM — not a device
  ]), 525);
  assert.strictEqual(dm.roomServedCfm([], [d(25, 25, 150, 0)]), 0);
  assert.strictEqual(dm.roomServedCfm(boxes, []), 0);
});

test('roomAirBalance: the ~10% tolerance gates the ⚠', () => {
  assert.strictEqual(dm.DUCT_BALANCE_TOLERANCE, 0.10);
  // Exactly served, over-served, and inside-tolerance shortfalls: no flag.
  assert.deepStrictEqual(dm.roomAirBalance(450, 450), { targetCfm: 450, servedCfm: 450, under: false });
  assert.strictEqual(dm.roomAirBalance(450, 600).under, false);
  assert.strictEqual(dm.roomAirBalance(450, 410).under, false);   // 8.9% short
  assert.strictEqual(dm.roomAirBalance(450, 405).under, false);   // exactly 10%
  // Beyond the tolerance: flagged.
  assert.strictEqual(dm.roomAirBalance(450, 300).under, true);
  assert.strictEqual(dm.roomAirBalance(450, 404).under, true);
  assert.deepStrictEqual(dm.roomAirBalance(450, 0), { targetCfm: 450, servedCfm: 0, under: true });
  // No target → no balance row (clean absence).
  assert.strictEqual(dm.roomAirBalance(null, 300), null);
  assert.strictEqual(dm.roomAirBalance(0, 300), null);
});

test('ductSystemDesignedCfm: root trees keyed by system, subtrees included, other systems excluded', () => {
  const trunkA = netRun('trunkA', [{ x: 0, y: 0 }, { x: 400, y: 0 }], { systemGroupId: 'rtu1' });
  const branchA = netRun('branchA', [{ x: 300, y: 5 }, { x: 300, y: 200 }]);   // taps trunkA (no own system)
  const trunkB = netRun('trunkB', [{ x: 0, y: 600 }, { x: 400, y: 600 }], { systemGroupId: 'rtu2' });
  const devices = [
    dev(100, 5, 100),    // on trunkA
    dev(300, 150, 150),  // on branchA — rtu1's tree through the tap
    dev(200, 605, 500),  // on trunkB — rtu2's air
    dev(200, 300, 999),  // attached to nothing — excluded
  ];
  const runs = [trunkA, branchA, trunkB];
  assert.strictEqual(dm.ductSystemDesignedCfm({ runs, devices, systemGroupId: 'rtu1' }), 250);
  assert.strictEqual(dm.ductSystemDesignedCfm({ runs, devices, systemGroupId: 'rtu2' }), 500);
  assert.strictEqual(dm.ductSystemDesignedCfm({ runs, devices, systemGroupId: 'rtu3' }), 0);
  assert.strictEqual(dm.ductSystemDesignedCfm({ runs: [], devices, systemGroupId: 'rtu1' }), 0);
});

test('ductSystemDesignedCfm: equipmentPos orients the root — the total is end-independent', () => {
  // A return main traced from the far grille TOWARD the unit: the equipment
  // sits at the LAST vertex. The designed total must not depend on trace
  // direction — equipmentPos rides through to the accumulation (D6 follow-up).
  const main = netRun('main', [{ x: 0, y: 0 }, { x: 400, y: 0 }], { systemGroupId: 'rtu1', airside: 'return' });
  const devices = [dev(100, 5, 100), dev(350, 5, 200)];
  const base = dm.ductSystemDesignedCfm({ runs: [main], devices, systemGroupId: 'rtu1' });
  const flipped = dm.ductSystemDesignedCfm({ runs: [main], devices, systemGroupId: 'rtu1', equipmentPos: { x: 400, y: 0 } });
  assert.strictEqual(base, 300);
  assert.strictEqual(flipped, 300);
});

test('ductEquipmentPosForGroup: the documented matching ladder', () => {
  const grp = { id: 'g1', equipmentTag: 'RTU-1', capacityCfm: 2000 };
  const mk = (x, y, counterName, cfm, groupId) => ({ x, y, counterName, cfm: cfm || null, groupId: groupId || null });
  // 1. tag-named AND group-assigned beats a loose tag-named marker.
  assert.deepStrictEqual(dm.ductEquipmentPosForGroup(grp, [
    mk(10, 10, 'RTU-1', null, null),
    mk(50, 50, 'rtu-1', null, 'g1'),
  ]), { x: 50, y: 50 });
  // 2. a UNIQUE tag-named marker wins even unassigned (case-insensitive).
  assert.deepStrictEqual(dm.ductEquipmentPosForGroup(grp, [
    mk(10, 10, 'rtu-1 ', null, null),
    mk(90, 90, 'Diffuser', 150, 'g1'),
  ]), { x: 10, y: 10 });
  // Two loose tag-named markers: ambiguous — falls to rule 3.
  assert.strictEqual(dm.ductEquipmentPosForGroup(grp, [
    mk(10, 10, 'RTU-1', null, null),
    mk(20, 20, 'RTU-1', null, null),
    mk(90, 90, 'Diffuser', 150, 'g1'),
  ]), null);
  // 3. exactly one group-assigned NON-CFM marker is the equipment.
  assert.deepStrictEqual(dm.ductEquipmentPosForGroup({ id: 'g2', equipmentTag: 'AHU-2' }, [
    mk(30, 40, 'Rooftop unit', null, 'g2'),
    mk(90, 90, 'Diffuser', 150, 'g2'),
  ]), { x: 30, y: 40 });
  // Two non-CFM markers in the group: ambiguous → null.
  assert.strictEqual(dm.ductEquipmentPosForGroup({ id: 'g2', equipmentTag: 'AHU-2' }, [
    mk(30, 40, 'Rooftop unit', null, 'g2'),
    mk(60, 40, 'Thermostat', null, 'g2'),
  ]), null);
  assert.strictEqual(dm.ductEquipmentPosForGroup(grp, []), null);
  assert.strictEqual(dm.ductEquipmentPosForGroup(null, [mk(1, 1, 'RTU-1')]), null);
});

test('suggestSystemsForCfm: the ~2,000 CFM/system rule of thumb', () => {
  assert.strictEqual(dm.DUCT_SYSTEM_RULE_OF_THUMB.cfmPerTon, 400);
  assert.strictEqual(dm.DUCT_SYSTEM_RULE_OF_THUMB.maxTonsPerSystem, 5);
  // The worked line: 2,400 CFM → about 2 systems at 1,200 CFM.
  assert.deepStrictEqual(dm.suggestSystemsForCfm(2400), { systems: 2, cfmEach: 1200, tons: 6 });
  assert.deepStrictEqual(dm.suggestSystemsForCfm(2000), { systems: 1, cfmEach: 2000, tons: 5 });
  assert.strictEqual(dm.suggestSystemsForCfm(6000).systems, 3);
  assert.strictEqual(dm.suggestSystemsForCfm(6000).cfmEach, 2000);
  // Uneven split rounds each system UP to the next 50 so the sum covers.
  const s = dm.suggestSystemsForCfm(2510);
  assert.strictEqual(s.systems, 2);
  assert.strictEqual(s.cfmEach, 1300);
  assert.ok(s.systems * s.cfmEach >= 2510);
  assert.strictEqual(dm.suggestSystemsForCfm(0), null);
  assert.strictEqual(dm.suggestSystemsForCfm(-5), null);
  assert.strictEqual(dm.suggestSystemsForCfm(NaN), null);
});

// --- D8: vertical footage, flex drops, VD-per-tap ----------------------------

test('makeDuctRun: verticalFt attached only when valid entries exist (pre-D8 shape otherwise)', () => {
  const base = dm.makeDuctRun({ id: 'r1' });
  assert.ok(!('verticalFt' in base));
  assert.ok(!('verticalFt' in dm.makeDuctRun({ id: 'r2', verticalFt: [] })));
  // Junk filtered; auto normalized to presence-only-when-true.
  const run = dm.makeDuctRun({
    id: 'r3',
    verticalFt: [
      { vertexIdx: 0, ft: 12, auto: true },
      { vertexIdx: 2, ft: 4.5 },
      { vertexIdx: -1, ft: 3 },          // bad index
      { vertexIdx: 1, ft: 0 },           // non-positive
      { vertexIdx: 1.5, ft: 2 },         // non-integer index
      null,
    ],
  });
  assert.deepStrictEqual(run.verticalFt, [
    { vertexIdx: 0, ft: 12, auto: true },
    { vertexIdx: 2, ft: 4.5 },
  ]);
  // All-junk input → key absent.
  assert.ok(!('verticalFt' in dm.makeDuctRun({ id: 'r4', verticalFt: [{ vertexIdx: 0, ft: -2 }] })));
});

test('runStraightItems: verticalFt entries tally at the segment-at-vertex size', () => {
  // 24×12 for 10 units, steps to 20×12 for 10 more (unit distances = feet).
  const run = dm.makeDuctRun({
    id: 'r1', linerType: 'liner',
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
    segments: [
      { startVertexIdx: 0, size: dm.makeRectSize(24, 12) },
      { startVertexIdx: 1, size: dm.makeRectSize(20, 12) },
    ],
    verticalFt: [
      { vertexIdx: 0, ft: 12, auto: true },   // the deck riser — 24×12 arrives at v0
      { vertexIdx: 2, ft: 3 },                // a drop at the far end — 20×12
    ],
  });
  const items = dm.runStraightItems(run);
  assert.strictEqual(items.length, 4);
  const vertical = items.filter(i => i.vertical);
  assert.strictEqual(vertical.length, 2);
  assert.deepStrictEqual(vertical[0], { size: { kind: 'rect', w: 24, h: 12 }, lengthFt: 12, liner: 'liner', vertical: true });
  assert.deepStrictEqual(vertical[1], { size: { kind: 'rect', w: 20, h: 12 }, lengthFt: 3, liner: 'liner', vertical: true });
  // The tally folds them into the per-size rows: 24×12 = 10 + 12, 20×12 = 10 + 3.
  const tally = dm.tallyStraightBySize(items, '1');
  const by = Object.fromEntries(tally.rows.map(r => [r.sizeKey, r.lengthFt]));
  assert.strictEqual(by['24×12'], 22);
  assert.strictEqual(by['20×12'], 13);
  assert.strictEqual(tally.totalLengthFt, 35);
  // A degenerate run (no drawable spans) contributes nothing, verticals included.
  assert.deepStrictEqual(dm.runStraightItems(dm.makeDuctRun({ id: 'r2', verticalFt: [{ vertexIdx: 0, ft: 5 }] })), []);
});

test('tallyFlexDrops: attached CFM devices, per system, defaults + over-max counting', () => {
  assert.deepStrictEqual(dm.DUCT_FLEX_DEFAULTS, { dropFt: 8, maxFlexFt: 6 });
  const runA = dm.makeDuctRun({
    id: 'a', systemGroupId: 'g1',
    vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    segments: [{ startVertexIdx: 0, size: dm.makeRectSize(24, 12) }],
  });
  const runB = dm.makeDuctRun({
    id: 'b',
    vertices: [{ x: 0, y: 50 }, { x: 100, y: 50 }],
    segments: [{ startVertexIdx: 0, size: dm.makeRoundSize(10) }],
  });
  const devices = [
    { x: 20, y: 2, cfm: 150 },                     // on A → default 8'
    { x: 60, y: 2, cfm: 200, flexDropFt: 5 },      // on A → its own 5'
    { x: 40, y: 52, cfm: 100, flexDropFt: 7 },     // on B (no system) → 7' (over 6)
    { x: 40, y: 200, cfm: 100 },                   // attached to nothing → excluded
  ];
  const rows = dm.tallyFlexDrops(devices, [runA, runB]);
  assert.strictEqual(rows.length, 2);
  const g1 = rows.find(r => r.systemGroupId === 'g1');
  assert.deepStrictEqual(g1, { systemGroupId: 'g1', count: 2, totalFt: 13, overCount: 1 });
  const none = rows.find(r => r.systemGroupId === null);
  assert.deepStrictEqual(none, { systemGroupId: null, count: 1, totalFt: 7, overCount: 1 });
  // A tighter cap flags more; a looser one clears them.
  assert.strictEqual(dm.tallyFlexDrops(devices, [runA, runB], { maxFlexFt: 4 }).find(r => r.systemGroupId === 'g1').overCount, 2);
  assert.strictEqual(dm.tallyFlexDrops(devices, [runA, runB], { maxFlexFt: 10 }).reduce((n, r) => n + r.overCount, 0), 0);
  // Custom default drop length.
  assert.strictEqual(dm.tallyFlexDrops([{ x: 20, y: 2, cfm: 150 }], [runA], { defaultDropFt: 6 })[0].totalFt, 6);
  assert.deepStrictEqual(dm.tallyFlexDrops([], [runA]), []);
});

test('ductVolumeDamperFittings: one vd per live tap; noVd/suppressed/non-tap skipped', () => {
  assert.ok(dm.FITTING_EQUIV_LF.vd > 0);
  const size = dm.makeRoundSize(10);
  const fittings = [
    dm.makeDuctFitting({ id: 'f1', runId: 'a', type: 'tap', size: size, position: { x: 1, y: 1 }, auto: true }),
    dm.makeDuctFitting({ id: 'f2', runId: 'a', type: 'tap', size: dm.makeRectSize(12, 8), position: { x: 2, y: 2 }, noVd: true }),
    dm.makeDuctFitting({ id: 'f3', runId: 'a', type: 'tap', size: size, position: { x: 3, y: 3 }, suppressed: true }),
    dm.makeDuctFitting({ id: 'f4', runId: 'a', type: 'elbow90', size: size, vertexIdx: 1 }),
  ];
  const vds = dm.ductVolumeDamperFittings(fittings);
  assert.deepStrictEqual(vds, [{ type: 'vd', size: { kind: 'round', d: 10 } }]);
  // The vd rows price through the normal fitting math (equiv-LF × lb/ft).
  const lb = dm.fittingPounds('vd', size, 26);
  assert.ok(Math.abs(lb - dm.FITTING_EQUIV_LF.vd * dm.ductWeightPerFoot(size, 26)) < 1e-9);
  // And ride rollupDuct like any counted fitting.
  const r = dm.rollupDuct({ straightItems: [], fittings: vds, pressureClass: '1' });
  assert.strictEqual(r.fittings.rows.length, 1);
  assert.strictEqual(r.fittings.rows[0].type, 'vd');
  assert.strictEqual(r.fittings.rows[0].count, 1);
});

test('noVd survives re-inference (the auto:false preservation pattern + auto carry)', () => {
  // Parent + child (the child's first vertex ON the parent) → one auto tap.
  const parent = dm.makeDuctRun({
    id: 'p', vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    segments: [{ startVertexIdx: 0, size: dm.makeRectSize(24, 12) }],
  });
  const child = dm.makeDuctRun({
    id: 'c', vertices: [{ x: 50, y: 0 }, { x: 50, y: 60 }],
    segments: [{ startVertexIdx: 0, size: dm.makeRoundSize(10) }],
  });
  const runs = [parent, child];
  let fittings = dm.reconcileDuctFittings([], dm.inferAutoDuctFittings(runs), runs);
  const tap = fittings.find(f => f.type === 'tap');
  assert.ok(tap && tap.auto);
  assert.strictEqual(dm.ductVolumeDamperFittings(fittings).length, 1);

  // The context-menu gesture: noVd + auto:false (features/duct-fittings.js).
  tap.noVd = true;
  tap.auto = false;
  fittings = dm.reconcileDuctFittings(fittings, dm.inferAutoDuctFittings(runs), runs);
  const tap2 = fittings.filter(f => f.type === 'tap' && !f.suppressed);
  assert.strictEqual(tap2.length, 1);                       // no auto twin resurrected
  assert.strictEqual(tap2[0].noVd, true);
  assert.strictEqual(dm.ductVolumeDamperFittings(fittings).length, 0);

  // Belt-and-braces: a still-auto tap carrying noVd keeps it through re-derive.
  const autoTap = dm.reconcileDuctFittings(
    [dm.makeDuctFitting({ ...tap2[0], auto: true, noVd: true })],
    dm.inferAutoDuctFittings(runs), runs,
  ).filter(f => f.type === 'tap');
  assert.strictEqual(autoTap.length, 1);
  assert.strictEqual(autoTap[0].noVd, true);
  assert.strictEqual(autoTap[0].auto, true);
});
