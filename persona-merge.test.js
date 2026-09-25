// Node unit test (node --test, in `npm run check` / CI): the persona merge (scripts/persona-merge.js,
// PERSONA-PLAN build item 5). It is the one step between persona runs and a person, so its
// grouping, its ranking and its calibration score are pinned here, dependency-free.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const M = require('./scripts/persona-merge.js');

const f = (o) => Object.assign({ persona: 'apprentice#1', kind: 'stall', set: 'plumbing', step: 'counter', control: '+ Add', tried: 'clicked + Add', expected: 'the counter dialog', evidence: 'nothing opened', severity: 2 }, o);
const lines = (arr) => arr.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('\n');

test('a control is one control however it is written', () => {
  assert.strictEqual(M.normalizeControl('[[+ Add]]'), '+ add');
  assert.strictEqual(M.normalizeControl('the "+ Add" button'), '+ add');
  assert.strictEqual(M.normalizeControl('  + ADD '), '+ add');
  assert.strictEqual(M.normalizeControl('Create tab'), 'create');
  assert.strictEqual(M.normalizeControl(undefined), '');
});

test('the persona splits into its kind and its seed', () => {
  assert.deepStrictEqual(M.splitPersona('journeyman.returning#3'), { personaKind: 'journeyman.returning', seed: '3' });
  assert.deepStrictEqual(M.splitPersona('estimator'), { personaKind: 'estimator', seed: '0' });
});

test('bad lines are rejected with the reason, good ones kept', () => {
  const r = M.parseFindings(lines([f({}), 'not json', f({ kind: 'rant' }), f({ severity: 5 }), f({ tried: '' }), '', f({ step: 'place' })]), 'a.jsonl');
  assert.strictEqual(r.findings.length, 2);
  assert.deepStrictEqual(r.rejected.map((x) => [x.line, x.why.split(' ')[0]]), [[2, 'not'], [3, 'kind'], [4, 'severity'], [5, 'missing']]);
});

test('groups by set, step, control, code and kind; ranks by persona kinds, then severity', () => {
  const findings = [
    // three kinds, four seeds, on one control written three ways
    f({ persona: 'apprentice#1', control: '[[+ Add]]' }), f({ persona: 'apprentice#2', control: '+ add' }),
    f({ persona: 'estimator#1', control: 'the "+ Add" button' }), f({ persona: 'journeyman#1' }),
    // one kind, but severity 3
    f({ persona: 'apprentice#1', step: 'place', control: '', code: 'outside-zone', severity: 3 }),
    // same spot, other kind of finding: its own group
    f({ persona: 'estimator#2', kind: 'wording', severity: 1 }),
    // two kinds, severity 1
    f({ persona: 'apprentice#1', set: 'lesson:counting', step: 'key', control: 'Quick Keys', severity: 1 }), f({ persona: 'estimator#1', set: 'lesson:counting', step: 'key', control: 'quick keys', severity: 1 }),
  ];
  const g = M.groupFindings(findings);
  assert.deepStrictEqual(g.map((x) => [x.rank, x.set, x.step, x.kind, x.personaKinds, x.seeds, x.count, x.severity]), [
    [1, 'plumbing', 'counter', 'stall', 3, 4, 4, 2],
    [2, 'lesson:counting', 'key', 'stall', 2, 2, 2, 1],
    [3, 'plumbing', 'place', 'stall', 1, 1, 1, 3],
    [4, 'plumbing', 'counter', 'wording', 1, 1, 1, 1],
  ]);
  assert.deepStrictEqual(g[0].personas, ['apprentice', 'estimator', 'journeyman']);
  assert.strictEqual(g[0].samples.length, 3);
  assert.strictEqual(g[2].code, 'outside-zone');
});

test('the digest and its page come out of a folder, and --score finds, misses and flags noise', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-merge-'));
  fs.writeFileSync(path.join(dir, 'a.jsonl'), lines([f({}), f({ persona: 'estimator#1', evidence: 'the standing Water Closet ticked it' })]) + '\n');
  fs.writeFileSync(path.join(dir, 'b.jsonl'), lines([f({ persona: 'journeyman#4', step: 'place', control: '', code: 'outside-zone', evidence: 'the card sat on circle 2' }), f({ set: 'hvac', step: 'duct', control: 'Duct', evidence: 'U did nothing' }), 'oops']) + '\n');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignored');
  const read = M.readFolder(dir);
  assert.deepStrictEqual(read.files, ['a.jsonl', 'b.jsonl']);
  const d = M.buildDigest(read, '2026-09-25T00:00:00Z');
  assert.deepStrictEqual(d.inputs, { files: 2, findings: 4, rejected: 1, personaKinds: 3 });
  assert.strictEqual(d.groups[0].key, 'plumbing|counter|+ add||stall');
  assert.ok(!('text' in d.groups[0]), 'the digest does not carry the scoring text');
  const md = M.renderMarkdown(d);
  assert.match(md, /^# Persona digest/);
  assert.match(md, /\| 1 \| 2 \| 2 \| 2 \| plumbing · counter \| stall \| \+ Add \|/);
  assert.match(md, /b\.jsonl:3: not JSON/);
  const known = [
    { id: 'K1', set: 'plumbing', step: 'counter', keywords: ['standing'], desc: 'a standing counter ticks the step' },
    { id: 'K2', set: 'plumbing', step: 'place', keywords: [], desc: 'the card covers a circle' },
    { id: 'K3', set: 'plumbing', step: 'place', keywords: ['hanger'], desc: 'right step, wrong words' },
    { id: 'K4', set: 'lesson:scale', step: 'set', desc: 'never reached' },
  ];
  const s = M.score(M.groupFindings(read.findings), known);
  assert.strictEqual(s.recall, 0.5);
  assert.deepStrictEqual(s.found, ['K1', 'K2']);
  assert.deepStrictEqual(s.missed, ['K3', 'K4']);
  assert.deepStrictEqual(s.noise.map((n) => n.key), ['hvac|duct|duct||stall']);
  fs.rmSync(dir, { recursive: true, force: true });
});
