// Node unit tests (node --test, in `npm run check` / CI) for scripts/check-lesson-rules.js,
// the check that a tour, lesson or course step teaching a rulebook number names the rule
// and says the rule's number (PERSONA-PLAN build item 7). Each failure mode (a) (b) (c)
// fails on a crafted fixture and passes once the fixture is fixed. No browser, no app
// files: the fixtures below are the whole input.
const { test } = require('node:test');
const assert = require('node:assert');
const { parseSteps, checkSteps, quantities, compileUnits } = require('./scripts/check-lesson-rules');

// A slice of the rulebook in rules.json's shape.
const RULES = [
  {
    id: 'plumb.hanger.pvc', title: 'Hanger spacing for PVC pipe', summary: 'How far apart PVC pipe may be supported.',
    values: [{ when: 'horizontal', value: 4, unit: 'ft' }, { when: 'vertical', value: 10, unit: 'ft' }],
    source: { code: 'IPC', section: '308.5, Table 308.5' },
  },
  {
    id: 'plumb.hanger.pex', title: 'Hanger spacing for PEX', summary: 'How far apart PEX may be supported.',
    values: [{ when: 'horizontal, 1 in and smaller', value: 32, unit: 'in' }, { when: 'vertical', value: 10, unit: 'ft' }],
    source: { code: 'IPC', section: '308.5, Table 308.5' },
  },
  {
    id: 'plumb.wsfu.fixtures', title: 'Water supply fixture units by fixture', summary: 'The load a fixture puts on the supply.',
    values: [
      { when: 'Lavatory, private, faucet · total', value: 0.7, unit: 'WSFU' },
      { when: 'Lavatory, public, faucet · total', value: 2, unit: 'WSFU' },
      { when: 'Water closet, public, flush valve · total', value: 10, unit: 'WSFU' },
    ],
    source: { code: 'IPC', section: 'Appendix E, Table E103.3(2)' },
  },
  {
    id: 'hvac.duct.schedule-factors', title: 'Duct Schedule factors', summary: 'The estimating knobs.',
    values: [{ when: 'design friction rate', value: 0.08, unit: 'in w.g. per 100 ft' }],
    source: { code: 'trade practice', section: 'estimating convention' },
  },
];
const src = (steps) => `(function () {\n  const STEPS = [\n${steps.join(',\n')}\n  ];\n})();\n`;
const run = (...steps) => checkSteps(parseSteps(src(steps), 'fixture.js'), RULES);
const kinds = (problems) => problems.map((p) => p.kind).join('');

test('the parser finds step objects and gathers their literal text', () => {
  const steps = parseSteps(`
    const NOTE = 'A constant the body names.';
    const LESSON = { id: 'l1', title: 'Not a step', steps: [
      { id: 'one', title: 'One', kind: 'do',
        rules: ['plumb.hanger.pvc'],
        body: 'First line.\\n' + 'Second, ' + NOTE,
        hint: () => (x ? 'hint a' : \`hint \${y ? 'b' : 'c'} tail\`) },
      { id: 'two', title: 'Two', kind: 'read', rulesExempt: 'why', body: () => 'from a function', reveal: 'The answer.' },
    ] };`, 'f.js');
  assert.deepStrictEqual(steps.map((s) => s.id), ['one', 'two']);
  assert.deepStrictEqual(steps[0].rules, ['plumb.hanger.pvc']);
  assert.strictEqual(steps[0].rulesLine, 5);
  assert.strictEqual(steps[1].rulesExempt, 'why');
  const text = (s) => s.pieces.map((p) => p.text);
  assert.ok(text(steps[0]).includes('First line.\nSecond,  … '));
  assert.ok(text(steps[0]).includes('A constant the body names.'), 'an identifier reads through to its string');
  assert.ok(text(steps[0]).includes('hint a') && text(steps[0]).includes('b'), 'strings inside a template hole');
  assert.deepStrictEqual(text(steps[1]), ['from a function', 'The answer.']);
});

test('quantities: units as a card writes them, and what is not a quantity', () => {
  const units = compileUnits(['ft', 'in', 'in AFF', 'in w.g. per 100 ft', 'WSFU', 'ga', '%']);
  const q = (s) => quantities(s, units).map((x) => `${x.value} ${x.unit}`);
  assert.deepStrictEqual(q('one hanger every 4 ft, and 32" apart'), ['4 ft', '32 in']);
  assert.deepStrictEqual(q('a 10\'-0" ceiling and 8 ft 6 in of conduit'), ['10 ft', '8.5 ft']);
  assert.deepStrictEqual(q('drawn at 1/8" = 1\'-0", sloped 1/8" per foot, 24x12 duct, #12 wire'), []);
  assert.deepStrictEqual(q('count 3 in the corridor'), [], '"in" the preposition is not inches');
  assert.deepStrictEqual(q('at 0.08" per 100 ft'), ['0.08 in w.g. per 100 ft'], 'one quantity, not a stray 100 ft');
  assert.deepStrictEqual(q('forty percent, and 44 in AFF, and 16 gauge'), ['40 %', '44 in', '16 ga']);
});

test('(a) a rules id that is not in the rulebook fails; a real one passes', () => {
  const bad = run(`{ id: 's', title: 'S', kind: 'read',\n rules: ['plumb.hanger.steel'],\n body: 'Hangers.' }`);
  assert.strictEqual(kinds(bad), 'a');
  assert.match(bad[0].msg, /fixture\.js:\d+ step 's': rules names 'plumb\.hanger\.steel'/);
  assert.deepStrictEqual(run(`{ id: 's', title: 'S', kind: 'read',\n rules: ['plumb.hanger.pvc'],\n body: 'Hangers.' }`), []);
  assert.strictEqual(kinds(run(`{ id: 's', title: 'S', kind: 'read', rules: [], body: 'x' }`)), 'a', 'an empty list says nothing');
});

test('(b) a code citation with nothing named fails; rules or rulesExempt passes', () => {
  const cite = `body: 'Every trap needs a vent (IPC 901).'`;
  const bad = run(`{ id: 'v', title: 'V', kind: 'read', ${cite} }`);
  assert.strictEqual(kinds(bad), 'b');
  assert.match(bad[0].msg, /cites IPC/);
  assert.deepStrictEqual(run(`{ id: 'v', title: 'V', kind: 'read', rulesExempt: 'no rulebook entry: IPC 901 vents', ${cite} }`), []);
  // a section a rule holds is suggested by name
  const hanger = run(`{ id: 'h', title: 'H', kind: 'read', body: 'Hang it per IPC Table 308.5.' }`);
  assert.match(hanger[0].msg, /rule: plumb\.hanger\.pvc, plumb\.hanger\.pex/);
  assert.deepStrictEqual(run(`{ id: 'h', title: 'H', kind: 'read', rules: ['plumb.hanger.pvc'], body: 'Hang it per IPC Table 308.5.' }`), []);
});

test('(b) a rule\'s number beside its subject with nothing named fails; naming the rule passes', () => {
  const body = `body: 'Above a ceiling, add one hanger every 4 ft to that type.'`;
  const bad = run(`{ id: 'u', title: 'U', kind: 'read', ${body} }`);
  assert.strictEqual(kinds(bad), 'b');
  assert.match(bad[0].msg, /states 4 ft beside the subject of plumb\.hanger\.pvc,/, 'the rule holding the number comes first');
  assert.deepStrictEqual(run(`{ id: 'u', title: 'U', kind: 'read', rules: ['plumb.hanger.pvc'], ${body} }`), []);
  // a number that is not a rule's (a dimension, a drop) with no rule subject is left alone
  assert.deepStrictEqual(run(`{ id: 'd', title: 'D', kind: 'do', body: 'Measure the 20\\'-0" dimension, then choose 3 ft in the Drop palette.' }`), []);
});

test('(c) a named rule\'s number that the rule does not hold fails; the rule\'s number passes', () => {
  const step = (n) => `{ id: 'c', title: 'C', kind: 'do',\n rules: ['plumb.hanger.pvc'],\n body: 'Add the PVC rule, one hanger every ${n} ft.' }`;
  const bad = run(step(5));
  assert.strictEqual(kinds(bad), 'c');
  assert.match(bad[0].msg, /says 5 ft, but plumb\.hanger\.pvc holds 4, 10 ft/);
  assert.deepStrictEqual(run(step(4)), []);
  // a unit only one rule carries is judged without its subject word
  const duct = (n) => `{ id: 'k', title: 'K', kind: 'do', rules: ['hvac.duct.schedule-factors'], body: 'The chip suggests a size at ${n}" per 100 ft.' }`;
  assert.strictEqual(kinds(run(duct(0.1))), 'c', '0.1 does not round 0.08');
  assert.deepStrictEqual(run(duct(0.08)), []);
  // the condition a rule states is a number a card may say ("PEX at 1 in")
  assert.deepStrictEqual(run(`{ id: 'p', title: 'P', kind: 'do', rules: ['plumb.hanger.pex'], body: 'Hanger, 1 per 32 in (the spacing for PEX at 1 in).' }`), []);
});

test('(c) a clause that names a row is held to that row', () => {
  const step = (n, who) => `{ id: 'w', title: 'W', kind: 'do', rules: ['plumb.wsfu.fixtures'], body: 'The app reads ${n} WSFU for a ${who} lavatory.' }`;
  assert.deepStrictEqual(run(step(2, 'public')), []);
  assert.deepStrictEqual(run(step(0.7, 'private')), []);
  const bad = run(step(10, 'public'));
  assert.strictEqual(kinds(bad), 'c', '10 is a water closet, not a lavatory');
  assert.match(bad[0].msg, /holds 2 WSFU/);
});
