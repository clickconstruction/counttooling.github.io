// Node unit tests for bid-check-model.js — the pure Bid Check rule table
// (Electrical, First-Class S5). npm run test:unit. Figures are the report's
// appendix values (NEC Chapter 9 tables).
const test = require('node:test');
const assert = require('node:assert');
const bc = require('./bid-check-model.js');

const c = (n, gauge, role = 'hot', insul = 'THHN') => ({ n, gauge, insul, role });

test('conduitFill: 10 #12 THHN in 1/2" EMT is 43.8% ⚠, 3/4" EMT passes at 25.0%', () => {
  const r = bc.conduitFill({ kind: 'EMT', size: '1/2"' }, [c(10, '#12')]);
  assert.strictEqual(Math.round(r.pct * 1000) / 10, 43.8);
  assert.strictEqual(r.limit, 0.4);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.upsize.size, '3/4"');
  assert.strictEqual(Math.round(r.upsize.pct * 1000) / 10, 25);
  const ok = bc.conduitFill({ kind: 'EMT', size: '3/4"' }, [c(3, '#12'), c(1, '#12', 'ground')]);
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.count, 4);
  // two conductors use the 31% limit; one uses 53%
  assert.strictEqual(bc.conduitFill({ kind: 'EMT', size: '1/2"' }, [c(2, '#12')]).limit, 0.31);
  assert.strictEqual(bc.conduitFill({ kind: 'EMT', size: '1/2"' }, [c(1, '#12')]).limit, 0.53);
  // unknowns
  assert.strictEqual(bc.conduitFill({ kind: 'MC' }, [c(2, '#12')]), null);
  assert.strictEqual(bc.conduitFill({ kind: 'EMT' }, [c(2, '#12')]), null);
  assert.strictEqual(bc.conduitFill({ kind: 'EMT', size: '1/2"' }, []), null);
});

test('voltageDrop: LP-1/7 at 12 A over 112 ft — #12 4.4% ⚠, #10 2.8% ✓', () => {
  const r = bc.voltageDrop({ feet: 112, amps: 12, gauge: '#12', volts: 120 });
  assert.strictEqual(Math.round(r.pct * 10) / 10, 4.4);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.upsize.gauge, '#10');
  assert.strictEqual(Math.round(r.upsize.pct * 10) / 10, 2.8);
  assert.strictEqual(bc.voltageDrop({ feet: 50, amps: 12, gauge: '#12' }).ok, true);
  // three-phase uses 1.732; aluminum uses K = 21.2
  assert.ok(bc.voltageDrop({ feet: 112, amps: 12, gauge: '#12', phase: 'three' }).pct < r.pct);
  assert.ok(bc.voltageDrop({ feet: 112, amps: 12, gauge: '#12', material: 'aluminum' }).pct > r.pct);
  assert.strictEqual(bc.voltageDrop({ feet: 0, amps: 12, gauge: '#12' }), null);
  assert.strictEqual(bc.voltageDrop({ feet: 10, amps: 12, gauge: '#99' }), null);
});

test('smallestGauge / nextGaugeUp', () => {
  assert.strictEqual(bc.smallestGauge(['#10', '#12', '1/0']), '#12');
  assert.strictEqual(bc.smallestGauge([]), null);
  assert.strictEqual(bc.nextGaugeUp('#12'), '#10');
  assert.strictEqual(bc.nextGaugeUp('4/0'), '250 kcmil');
  assert.strictEqual(bc.nextGaugeUp('500 kcmil'), null);
});

test('bidCheckAutoRows: verdicts show their work; empty inputs read as not-applicable', () => {
  const rows = bc.bidCheckAutoRows({
    fillCases: [{ label: '1/2" EMT · 10 #12 THHN', raceway: { kind: 'EMT', size: '1/2"' }, conductors: [c(10, '#12')] }, { label: '3/4" EMT · 3 #12 + G', raceway: { kind: 'EMT', size: '3/4"' }, conductors: [c(3, '#12'), c(1, '#12', 'ground')] }],
    circuits: [{ tag: 'LP-1/7', group: 'Open office', farthestFt: 112, loadAmps: 12, hotGauges: ['#12'] }, { tag: 'LP-1/1', group: 'Lights', farthestFt: 40, loadAmps: null, hotGauges: ['#12'] }],
    crossCheck: [{ panel: 'LP-1', onPlan: 31, scheduled: 34, verdict: 'under' }],
    untaggedDevices: 4, offRunDevices: 0,
  });
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.strictEqual(byId['conduit-fill'].verdict, 'warn');
  assert.ok(byId['conduit-fill'].detail.includes('43.8% ⚠ → 3/4" EMT 25% ✓'), byId['conduit-fill'].detail);
  assert.strictEqual(byId['voltage-drop'].verdict, 'warn');
  assert.ok(byId['voltage-drop'].detail.startsWith('LP-1/7 · 112 ft · 12 A · #12 4.4% ⚠ → #10 2.8% ✓'), byId['voltage-drop'].detail);
  assert.strictEqual(byId['circuits-vs-panel'].verdict, 'warn');
  assert.strictEqual(byId['circuits-vs-panel'].detail, 'LP-1 · 31 on plan · 34 scheduled ⚠');
  assert.strictEqual(byId['devices-on-circuits'].verdict, 'warn');
  assert.strictEqual(byId['devices-on-circuits'].detail, '4 devices on no circuit');
  const empty = bc.bidCheckAutoRows({});
  assert.ok(empty.every((r) => r.verdict === 'na'));
  assert.strictEqual(empty.length, 4);
});

test('bidCheckOpenCount: ⚠ auto rows + unticked manual rows for the trade', () => {
  const auto = [{ verdict: 'warn' }, { verdict: 'ok' }, { verdict: 'na' }];
  const all = bc.bidCheckOpenCount(auto, {}, 'electrical');
  assert.deepStrictEqual(all, { auto: 1, manual: 8, total: 9 });
  // plumbing: the 3 trade-neutral rows (addenda ticked) + the 4 plumbing rows
  assert.deepStrictEqual(bc.bidCheckOpenCount(auto, { addenda: true }, 'plumbing'), { auto: 1, manual: 6, total: 7 });
  assert.deepStrictEqual(bc.bidCheckOpenCount([], null, null), { auto: 0, manual: 3, total: 3 });
  // D9: rows another table contributes (the duct manual rows) count by the same tick map; upgraded (auto) ones do not
  const extra = [{ id: 'duct-fits-roof', kind: 'auto' }, { id: 'duct-oa-code', kind: 'manual' }, { id: 'duct-controls', kind: 'manual' }];
  assert.deepStrictEqual(bc.bidCheckOpenCount([], { 'duct-controls': true }, null, extra), { auto: 0, manual: 4, total: 4 });
});

test('the auto rows that apply a public rule name it (rulebook chips)', () => {
  const rows = bc.bidCheckAutoRows({ fillCases: [], circuits: [], crossCheck: [], untaggedDevices: 0, offRunDevices: 0, defaults: { loadAmps: 12, volts: 120 } });
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.strictEqual(byId['conduit-fill'].rule, 'elec.conduit.fill-limit');
  assert.strictEqual(byId['voltage-drop'].rule, 'elec.voltage-drop.branch-limit');
});

// R13: the one row resolver the duct and water tables delegate to.
test('resolveBidCheckRows: an answered evaluator makes an auto row, a silent one a manual row read from the ticks', () => {
  const table = [
    { id: 'a-ok', kind: 'auto', label: 'Scale set: every sheet', rule: 'x.rule', evaluate: () => ({ verdict: 'ok', detail: 'all scaled ✓' }) },
    { id: 'a-warn', kind: 'auto', label: 'Rooms served', short: 'Every room served', evaluate: (i) => ({ verdict: i.bad ? 'warn' : 'ok', detail: 'd' }) },
    { id: 'm-up', kind: 'manual', label: 'Fits the roof', evaluate: (i) => (i.deck ? { verdict: 'ok', detail: 'fits' } : null) },
    { id: 'm-open', kind: 'manual', label: 'Fire dampers located' },
    { id: 'm-done', kind: 'manual', label: 'Controls set', short: 'Controls' },
  ];
  const rows = bc.resolveBidCheckRows(table, { bad: true }, { 'm-done': true, 'm-up': true });
  assert.deepStrictEqual(rows.map((r) => [r.id, r.kind, r.verdict, r.done, r.upgraded]), [
    ['a-ok', 'auto', 'ok', false, false],
    ['a-warn', 'auto', 'warn', false, false],
    ['m-up', 'manual', 'done', true, false],
    ['m-open', 'manual', 'open', false, false],
    ['m-done', 'manual', 'done', true, false],
  ]);
  assert.strictEqual(rows[0].rule, 'x.rule');
  assert.strictEqual(rows[0].short, 'Scale set: every sheet');   // short falls back to the label
  assert.strictEqual(rows[1].short, 'Every room served');
  // Once its inputs exist the manual row upgrades to auto and its tick is ignored.
  const up = bc.resolveBidCheckRows(table, { deck: 12 }, { 'm-up': true }).find((r) => r.id === 'm-up');
  assert.deepStrictEqual({ kind: up.kind, verdict: up.verdict, done: up.done, upgraded: up.upgraded }, { kind: 'auto', verdict: 'ok', done: false, upgraded: true });
  // No inputs and no ticks are fine; no table is an empty list.
  assert.strictEqual(bc.resolveBidCheckRows(table, null, null).filter((r) => r.kind === 'manual').length, 3);
  assert.deepStrictEqual(bc.resolveBidCheckRows(null, {}, {}), []);
});

test('bidCheckUnresolved: auto ⚠ first, then unticked manual; first names the one the gate toast shows', () => {
  const rows = [
    { id: 'm1', kind: 'manual', done: false },
    { id: 'a1', kind: 'auto', verdict: 'ok' },
    { id: 'a2', kind: 'auto', verdict: 'warn' },
    { id: 'm2', kind: 'manual', done: true },
  ];
  const u = bc.bidCheckUnresolved(rows);
  assert.deepStrictEqual(u.auto.map((r) => r.id), ['a2']);
  assert.deepStrictEqual(u.manual.map((r) => r.id), ['m1']);
  assert.strictEqual(u.first.id, 'a2');
  assert.strictEqual(bc.bidCheckUnresolved(rows.filter((r) => r.id !== 'a2')).first.id, 'm1');
  assert.deepStrictEqual(bc.bidCheckUnresolved(null), { auto: [], manual: [], first: null });
});
