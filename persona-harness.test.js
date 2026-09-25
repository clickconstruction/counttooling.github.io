// Node unit test (node --test, in `npm run check` / CI): the pure half of the persona harness's
// cheaper live pass and of the prober (PERSONA-PROBER, 2026-09-25). scripts/lib/persona-batch.js
// (the action list's lines and stops, obsMode diff, the no-work detector), persona-manifest.js's
// label index, and the prompt renderer. The browser half is run by hand against two apps
// (PERSONA-PLAN.md "Harness").
const { test } = require('node:test');
const assert = require('node:assert');
const B = require('./scripts/lib/persona-batch.js');
const { labelIndex, isSelector } = require('./scripts/persona-manifest.js');
const P = require('./scripts/lib/persona-prompts.js');

const obs = (o) => Object.assign({ tour: 'plumbing', i: 3, n: 17, id: 'counter', kind: 'do', title: 'Make a Water Closet counter', card: '1. …', status: 'Waiting for you…', miss: false, code: null, done: false, next: false, buttons: ['Show me where', 'Skip this step', 'Back', 'Next'], lit: null, dialog: null, zones: [], page: 0, stepPage: null }, o);
const ok = (clicked) => (clicked ? { ok: true, clicked } : { ok: true });
const card = (label) => ok({ label, scope: 'tour card' });

test('what counts as no work: the card\'s nav buttons, waiting, looking, a click that never landed', () => {
  assert.strictEqual(B.isNoWork({ wait: 800 }, ok()), true);
  assert.strictEqual(B.isNoWork({ screenshot: true }, ok()), true);
  assert.strictEqual(B.isNoWork({ scroll: [1, 2, 3] }, ok()), true);
  assert.strictEqual(B.isNoWork({ giveUp: 'x' }, ok()), true);
  assert.strictEqual(B.isNoWork({ click: 'Next' }, card('Next')), true);
  assert.strictEqual(B.isNoWork({ click: 'Skip this step' }, card('Skip this step')), true);
  assert.strictEqual(B.isNoWork({ click: 'Show me where' }, card('Show me where')), true);
  assert.strictEqual(B.isNoWork({ click: '+ Add' }, { ok: false, error: 'covered' }), true);   // nothing was pressed
  // work: a real control, even one called Next outside the card; a key; a zone; a field
  assert.strictEqual(B.isNoWork({ click: 'Next' }, ok({ label: 'Next', scope: 'dialog' })), false);
  assert.strictEqual(B.isNoWork({ click: 'COUNTERS + Add' }, ok({ label: '+ Add', scope: 'sidebar' })), false);
  assert.strictEqual(B.isNoWork({ key: 'X' }, ok()), false);
  assert.strictEqual(B.isNoWork({ clickZone: 1 }, ok()), false);
  assert.strictEqual(B.isNoWork({ fill: ['Name', 'Water Closet'] }, ok()), false);
  assert.strictEqual(B.navOf({ click: 'Back' }, card('Back')), 'back');
  assert.strictEqual(B.navOf({ click: 'Skip this step' }, card('Skip this step')), 'skip');
  assert.strictEqual(B.navOf({ click: 'Apply' }, ok({ label: 'Apply', scope: 'dialog' })), null);
});

test('a list answers with one line per action and stops at an error or a step change', () => {
  assert.strictEqual(B.describeAction({ click: '+ Add', within: 'COUNTERS' }), 'click "+ Add" within "COUNTERS"');
  assert.strictEqual(B.describeAction({ fill: ['Name', 'Water Closet'] }), 'fill "Name" = "Water Closet"');
  assert.strictEqual(B.describeAction({ drag: [[1, 2], [3, 4]] }), 'drag 1,2 to 3,4');
  assert.strictEqual(B.actionLine(3, { key: 'X' }, { ok: true, events: ['pressed X', 'dialog opened: Multiply Zone'] }), '3. key X: ok · pressed X · dialog opened: Multiply Zone');
  assert.strictEqual(B.actionLine(5, { click: 'Nope' }, { ok: false, error: 'no control named "Nope" is on screen', events: [] }), '5. click "Nope": ERROR no control named "Nope" is on screen');
  const a = obs(), b = obs({ id: 'place', i: 4 });
  assert.strictEqual(B.batchStop({ ok: false }, a, a, true), 'error');
  assert.strictEqual(B.batchStop({ ok: true, gaveUp: true }, a, a, true), 'gave up');
  assert.strictEqual(B.batchStop({ ok: true }, a, b, false), 'step changed');
  assert.strictEqual(B.batchStop({ ok: true }, a, b, true), null);   // "through"
  assert.strictEqual(B.batchStop({ ok: true }, a, null, false), 'the set ended');
  assert.strictEqual(B.batchStop({ ok: true }, a, obs({ status: '1 of 3 done' }), false), null);
});

test('obsMode diff: only the changed fields, the card only when it changed, gone fields as null', () => {
  const a = obs({ zones: [{ n: 1, kind: 'circle', done: false, cx: 1, cy: 2, r: 3 }] });
  assert.strictEqual(B.obsDiff(null, a), a);
  assert.deepStrictEqual(B.obsDiff(a, obs({ zones: a.zones })), {});
  assert.deepStrictEqual(B.obsDiff(a, obs({ status: '1 of 3 done', zones: [{ n: 1, kind: 'circle', done: true, cx: 1, cy: 2, r: 3 }] })), { status: '1 of 3 done', zones: [{ n: 1, kind: 'circle', done: true, cx: 1, cy: 2, r: 3 }] });
  const b = obs({ id: 'place', i: 4, title: 'Count the water closets', card: 'other', zones: a.zones });
  delete b.stepPage;
  assert.deepStrictEqual(B.obsDiff(a, b), { i: 4, id: 'place', title: 'Count the water closets', card: 'other', stepPage: null });
  assert.strictEqual(B.obsDiff(a, null), null);
});

test('the no-work detector: K4, a returning device\'s counter step Done in the /episode beat', () => {
  // it moved itself on inside the beat
  let t = new B.StepTracker(obs({ done: true }));
  assert.deepStrictEqual(t.idle(obs({ id: 'place', i: 4 })), [{ step: 'counter', i: 3, why: 'moved on', actions: [] }]);
  // or it sits there Done
  t = new B.StepTracker(obs());
  assert.deepStrictEqual(t.idle(obs({ done: true })).map((f) => f.why), ['done with no action']);
  // a first-timer's: not Done, nothing flagged; a reading step never is
  assert.deepStrictEqual(new B.StepTracker(obs()).idle(obs()), []);
  assert.deepStrictEqual(new B.StepTracker(obs({ kind: 'read', done: true })).idle(obs({ kind: 'read', done: true })), []);
});

test('the no-work detector: K5, a step Done on arrival after the reader\'s real work on the last one', () => {
  const t = new B.StepTracker(obs());
  const flags = t.after({ click: 'Create Counter' }, ok({ label: 'Create Counter', scope: 'dialog' }), obs({ id: 'linetype', i: 5, done: true }));
  assert.deepStrictEqual(flags, [{ step: 'linetype', i: 5, why: 'done on arrival', actions: [] }]);
  // it then moves itself on between calls: flagged once, not twice
  assert.deepStrictEqual(t.before(obs({ id: 'chain', i: 6 })), []);
  assert.strictEqual(t.flags.length, 1);
});

test('the no-work detector: waiting, looking and Next are not work; a real click is', () => {
  let t = new B.StepTracker(obs());
  assert.deepStrictEqual(t.after({ wait: 1500 }, ok(), obs()), []);
  assert.deepStrictEqual(t.after({ screenshot: true }, ok(), obs({ done: true })).map((f) => [f.why, f.actions]), [['turned done', ['wait 1500', 'screenshot']]]);
  assert.deepStrictEqual(t.after({ click: 'Next' }, card('Next'), obs({ id: 'place', i: 4 })), []);   // already flagged
  // the reader did the step: no flag when it turns Done, none when it moves on
  t = new B.StepTracker(obs());
  assert.deepStrictEqual(t.after({ click: 'COUNTERS + Add' }, ok({ label: '+ Add', scope: 'sidebar' }), obs({ dialog: { id: 'counterModal', title: 'Create' } })), []);
  assert.deepStrictEqual(t.after({ click: 'Create Counter' }, ok({ label: 'Create Counter', scope: 'dialog' }), obs({ done: true })), []);
  assert.deepStrictEqual(t.after({ wait: 900 }, ok(), obs({ id: 'place', i: 4 })), []);
  // an auto-advance seen only at the next call, after waiting: flagged as moved on
  t = new B.StepTracker(obs());
  t.after({ wait: 300 }, ok(), obs());
  assert.deepStrictEqual(t.before(obs({ id: 'place', i: 4 })).map((f) => [f.step, f.why]), [['counter', 'moved on']]);
});

test('the no-work detector: Skip, Back and Next on an undone step are the reader leaving, not a pass', () => {
  let t = new B.StepTracker(obs());
  assert.deepStrictEqual(t.after({ click: 'Skip this step' }, card('Skip this step'), obs({ id: 'place', i: 4 })), []);
  t = new B.StepTracker(obs({ id: 'place', i: 4 }));
  assert.deepStrictEqual(t.after({ click: 'Back' }, card('Back'), obs()), []);
  t = new B.StepTracker(obs());
  assert.deepStrictEqual(t.after({ click: 'Next' }, card('Next'), obs({ id: 'place', i: 4 })), []);
  // a step that ends the set on Finish with nothing done
  t = new B.StepTracker(obs({ id: 'bidcheck', i: 12, done: true }));
  assert.deepStrictEqual(t.after({ click: 'Finish' }, card('Finish'), null).map((f) => f.why), ['moved on']);
});

test('labels.json: every label once, marked by where it comes from', () => {
  assert.strictEqual(isSelector('#noteModalDone'), true);
  assert.strictEqual(isSelector('#counterModal .counter-tab[data-tab="quickcount"]'), true);
  assert.strictEqual(isSelector('+ Add'), false);
  assert.strictEqual(isSelector('...'), false);
  assert.strictEqual(isSelector('1/8" = 1\''), false);
  const idx = labelIndex({
    shell: ['Set Scale', 'Apply', '  Upload&nbsp;PDF '],
    manifests: [
      { id: 'plumbing', source: 'engine', steps: [{ targets: ['Set Scale', '#noteModalDone', 'Apply'] }] },
      { id: 'lesson:x', source: 'walk', steps: [{ targets: ['Create Counter'] }], seen: { dialogs: { 'Multiply Zone': ['Apply', 'Enter multiplier'] }, card: ['Open the sample plan', 'Next'] } },
    ],
    dialogs: { 'Set Scale': ['1/8" = 1\'', 'Apply'] },
    card: ['Next'],
  });
  assert.deepStrictEqual(idx.labels, [
    ['1/8" = 1\'', 'dialog:Set Scale'],
    ['Apply', 'shell', 'target', 'dialog:Multiply Zone', 'dialog:Set Scale'],
    ['Create Counter', 'target'],
    ['Enter multiplier', 'dialog:Multiply Zone'],
    ['Next', 'card'],
    ['Open the sample plan', 'card'],
    ['Set Scale', 'shell', 'target'],
    ['Upload PDF', 'shell'],
  ]);
  assert.deepStrictEqual(Object.keys(idx.sources), ['shell', 'target', 'dialog:<name>', 'card']);
});

test('the persona prompts render from one source, with no hole left', () => {
  const R = P.readme();
  assert.strictEqual(Object.keys(R.personas).length, 5);
  assert.strictEqual(R.personas['estimator.returning.laptop.careful.check'].device, 'laptop');
  assert.deepStrictEqual(Object.keys(R.seeds), ['1', '2', '3']);
  assert.match(R.findingFormat, /false-pass/);
  const vars = { HARNESS: 'http://127.0.0.1:3490', SET: 'plumbing', STEP: 'zone', OUT: '/x/f.jsonl', MANIFEST: '/x/m.jsonl', LABELS: '/x/labels.json' };
  const text = P.render('text', { persona: 'none.first-time.desktop.skims.learn', seed: 2, vars });
  assert.match(text, /"persona":"none\.first-time\.desktop\.skims\.learn#2"/);
  assert.match(text, /make the choice a newcomer most plausibly would/);
  const live = P.render('live', { persona: 'journeyman.returning.desktop.impatient.bid-fast', seed: 3, vars });
  assert.match(live, /"device":"returning","obsMode":"diff"/);
  assert.match(live, /"actions":\[/);
  const prober = P.render('prober', { vars: Object.assign({ PERSONA_ID: 'prober.returning', SEED: '1', DEVICE: 'returning' }, vars) });
  assert.match(prober, /kind "false-pass"/);
  assert.doesNotMatch(text + live + prober, /\{\{[A-Z_]+\}\}/);
  assert.throws(() => P.render('live', { persona: 'none.first-time.desktop.skims.learn', seed: 1, vars: { SET: 'plumbing' } }), /unfilled \{\{HARNESS\}\}/);
  assert.throws(() => P.render('live', { persona: 'wizard' }), /no persona kind "wizard"/);
  assert.throws(() => P.render('judge'), /no prompt "judge"/);
});
