// Node unit tests for support-model.js (rulebook slice 3): material and size
// detection from a line type's name, the hanger suggestion a type earns, the
// interval helpers, and the Bid Check hanger-coverage row.
const test = require('node:test');
const assert = require('node:assert');
const sm = require('./support-model.js');

test('material from the name: word-bounded, CPVC is not PVC, ABS/DWV read as PVC', () => {
  assert.strictEqual(sm.supportMaterialFromName('1in PEX'), 'pex');
  assert.strictEqual(sm.supportMaterialFromName('3/4" Cu'), 'copper');
  assert.strictEqual(sm.supportMaterialFromName('Type L copper 1-1/4"'), 'copper');
  assert.strictEqual(sm.supportMaterialFromName('4" PVC waste'), 'pvc');
  assert.strictEqual(sm.supportMaterialFromName('3in ABS DWV'), 'pvc');
  assert.strictEqual(sm.supportMaterialFromName('2in CPVC'), null);
  assert.strictEqual(sm.supportMaterialFromName('4" no-hub cast iron'), 'cast-iron');
  assert.strictEqual(sm.supportMaterialFromName('3/4" EMT'), null);
  assert.strictEqual(sm.supportMaterialFromName(''), null);
});

test('trade size from the name: whole, fraction, mixed, with in / " / inch', () => {
  assert.strictEqual(sm.supportSizeInFromName('1in PEX'), 1);
  assert.strictEqual(sm.supportSizeInFromName('3/4" Cu'), 0.75);
  assert.strictEqual(sm.supportSizeInFromName('1-1/4 in copper'), 1.25);
  assert.strictEqual(sm.supportSizeInFromName('2 inch PVC'), 2);
  assert.strictEqual(sm.supportSizeInFromName('PEX'), null);
  assert.strictEqual(sm.formatSizeIn(1.25), '1-1/4 in');
  assert.strictEqual(sm.formatSizeIn(0.5), '1/2 in');
  assert.strictEqual(sm.formatSizeIn(2), '2 in');
});

test('the hanger suggestion follows material and size; no size means the tighter spacing', () => {
  assert.deepStrictEqual(sm.hangerSuggestionsFor('1in PEX').map((s) => [s.intervalIn, s.ruleId]), [[32, 'plumb.hanger.pex']]);
  assert.strictEqual(sm.hangerSuggestionsFor('1-1/4" PEX')[0].intervalIn, 48);
  assert.strictEqual(sm.hangerSuggestionsFor('PEX')[0].intervalIn, 32);
  assert.match(sm.hangerSuggestionsFor('PEX')[0].match, /size not in the name/);
  assert.strictEqual(sm.hangerSuggestionsFor('3/4" copper')[0].intervalIn, 72);
  assert.strictEqual(sm.hangerSuggestionsFor('2" Cu')[0].intervalIn, 120);
  assert.strictEqual(sm.hangerSuggestionsFor('4" PVC')[0].intervalIn, 48);
  assert.strictEqual(sm.hangerSuggestionsFor('4" cast iron')[0].intervalIn, 60);
  assert.deepStrictEqual(sm.hangerSuggestionsFor('1/2" EMT'), []);
});

test('interval helpers: inches win over whole feet; labels read in ft when whole', () => {
  assert.strictEqual(sm.childIntervalFeet({ intervalIn: 32 }), 32 / 12);
  assert.strictEqual(sm.childIntervalFeet({ ftInterval: 8 }), 8);
  assert.strictEqual(sm.childIntervalFeet({}), 10);
  assert.strictEqual(sm.childIntervalLabel({ intervalIn: 32 }), '32 in');
  assert.strictEqual(sm.childIntervalLabel({ intervalIn: 48 }), '4 ft');
  assert.strictEqual(sm.childIntervalLabel({ ftInterval: 6 }), '6 ft');
});

test('hanger coverage: only supported materials count; stamped or named hanger counts satisfy it', () => {
  assert.strictEqual(sm.hangerCoverage([{ name: '1/2" EMT' }]), null);
  const warn = sm.hangerCoverage([{ name: '1in PEX', childCounts: [] }, { name: '2" Cu', childCounts: [{ name: 'Hanger', per: 'ft', intervalIn: 120, ruleId: 'plumb.hanger.copper' }] }]);
  assert.strictEqual(warn.verdict, 'warn');
  assert.strictEqual(warn.rule, 'plumb.hanger.pex');
  assert.match(warn.detail, /1in PEX has no hanger count/);
  const ok = sm.hangerCoverage([{ name: '4" PVC', childCounts: [{ name: 'Pipe strap', per: 'ft', ftInterval: 4 }] }]);
  assert.strictEqual(ok.verdict, 'ok');
  assert.match(ok.detail, /counts its hangers/);
});
