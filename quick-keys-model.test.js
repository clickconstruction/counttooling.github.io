// Node unit tests for quick-keys-model.js: the armed key and the list order of
// the Quick Keys dialog. Run with `node --test`.
const { test } = require('node:test');
const assert = require('node:assert');
const {
  QUICK_KEY_SLOTS, quickKeyNorm, firstOpenQuickKeySlot, nextOpenQuickKeySlot,
  quickKeySlotOf, quickKeyMatchScore, rankQuickKeyItems, firstUnboundQuickKeyIndex,
} = require('./quick-keys-model.js');

const c = (id, name, used) => ({ kind: 'counter', id, name, used: used || 0 });
const lt = (id, name, used) => ({ kind: 'lineType', id, name, used: used || 0 });
const bound = (kind, id) => ({ kind, id });
const names = (list) => list.map((x) => x.name);

test('the number row runs 1 to 9, then 0', () => {
  assert.deepStrictEqual(QUICK_KEY_SLOTS, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
});

test('a name is read without case, spaces or hyphens', () => {
  assert.strictEqual(quickKeyNorm('WC-1'), 'wc1');
  assert.strictEqual(quickKeyNorm(' 3IN  FD-1 '), '3infd1');
  assert.strictEqual(quickKeyNorm(null), '');
});

test('the dialog opens on the first empty key, or on 1 when all are held', () => {
  assert.strictEqual(firstOpenQuickKeySlot({}), '1');
  assert.strictEqual(firstOpenQuickKeySlot(null), '1');
  assert.strictEqual(firstOpenQuickKeySlot({ 1: bound('counter', 'a'), 2: bound('counter', 'b') }), '3');
  const full = Object.fromEntries(QUICK_KEY_SLOTS.map((s) => [s, bound('counter', 'x' + s)]));
  assert.strictEqual(firstOpenQuickKeySlot(full), '1');
});

test('after a pick the next empty key arms, wrapping past 0', () => {
  assert.strictEqual(nextOpenQuickKeySlot({ 1: bound('counter', 'a') }, '1'), '2');
  assert.strictEqual(nextOpenQuickKeySlot({ 1: bound('counter', 'a'), 2: bound('counter', 'b') }, '1'), '3');
  // key 0 just filled, 1 to 3 held: 4 is next
  const some = { 0: bound('counter', 'z'), 1: bound('counter', 'a'), 2: bound('counter', 'b'), 3: bound('counter', 'c') };
  assert.strictEqual(nextOpenQuickKeySlot(some, '0'), '4');
  const full = Object.fromEntries(QUICK_KEY_SLOTS.map((s) => [s, bound('counter', 'x' + s)]));
  assert.strictEqual(nextOpenQuickKeySlot(full, '5'), '5');
  assert.strictEqual(nextOpenQuickKeySlot({}, 'q'), '1');
});

test('a half-written binding does not hold its key', () => {
  assert.strictEqual(firstOpenQuickKeySlot({ 1: { kind: 'counter' }, 2: null }), '1');
});

test('which key holds an item', () => {
  const b = { 3: bound('counter', 'a'), 7: bound('lineType', 'a') };
  assert.strictEqual(quickKeySlotOf(b, 'counter', 'a'), '3');
  assert.strictEqual(quickKeySlotOf(b, 'lineType', 'a'), '7');
  assert.strictEqual(quickKeySlotOf(b, 'counter', 'nope'), null);
  assert.strictEqual(quickKeySlotOf(null, 'counter', 'a'), null);
});

test('match score: starts with, a word starts with, inside, no match', () => {
  assert.strictEqual(quickKeyMatchScore('WC-1', 'wc1'), 0);
  assert.strictEqual(quickKeyMatchScore('Ball Valve 1', 'ball v'), 0);
  assert.strictEqual(quickKeyMatchScore('Ball Valve 1', 'valve'), 1);
  assert.strictEqual(quickKeyMatchScore('Ball Valve 1', 'valve ball'), 1);
  assert.strictEqual(quickKeyMatchScore('ELECTRIC Water Heater', 'eater'), 2);
  assert.strictEqual(quickKeyMatchScore('Gate Valve', 'drain'), -1);
  assert.strictEqual(quickKeyMatchScore('Gate Valve', 'gate drain'), -1);
  assert.strictEqual(quickKeyMatchScore('Anything', '   '), 0);
  assert.strictEqual(quickKeyMatchScore(undefined, 'x'), -1);
});

test('no search: counters, then line types, the placed ones first and most used on top', () => {
  const items = [
    c('a', 'EWC-1'), c('b', 'HB1', 18), c('c', 'Lav-1'), c('d', 'WC-1', 40),
    lt('x', '4 in PVC'), lt('y', '3in Vent', 6),
  ];
  assert.deepStrictEqual(names(rankQuickKeyItems(items, '')), ['WC-1', 'HB1', 'EWC-1', 'Lav-1', '3in Vent', '4 in PVC']);
  // untouched input
  assert.deepStrictEqual(names(items), ['EWC-1', 'HB1', 'Lav-1', 'WC-1', '4 in PVC', '3in Vent']);
});

test('no search: an unused palette keeps its own order', () => {
  const items = [c('a', 'Zed'), c('b', 'Alpha'), lt('x', 'Waste'), c('c', 'Mid')];
  assert.deepStrictEqual(names(rankQuickKeyItems(items, '  ')), ['Zed', 'Alpha', 'Mid', 'Waste']);
});

test('a search ranks a leading match over a word match over an inside match', () => {
  const items = [
    c('a', 'Butterfly Valve'), c('b', 'Valve Box'), c('c', 'Revalved Unit'), c('d', 'Floor Drain'),
    lt('x', 'Valve Line'),
  ];
  assert.deepStrictEqual(names(rankQuickKeyItems(items, 'valve')), ['Valve Box', 'Valve Line', 'Butterfly Valve', 'Revalved Unit']);
});

test('a search breaks ties by use, then by palette order', () => {
  const items = [c('a', 'SK-3'), c('b', 'SK-1', 2), c('c', 'SK-2', 9), c('d', 'SK-4')];
  assert.deepStrictEqual(names(rankQuickKeyItems(items, 'sk')), ['SK-2', 'SK-1', 'SK-3', 'SK-4']);
});

test('two items with one name both come back, in palette order', () => {
  const items = [c('a', 'Gate Valve'), c('b', 'Ball Valve'), c('c', 'Gate Valve')];
  const out = rankQuickKeyItems(items, 'gate');
  assert.deepStrictEqual(out.map((x) => x.id), ['a', 'c']);
});

test('a search with no match is an empty list, and bad input is one too', () => {
  assert.deepStrictEqual(rankQuickKeyItems([c('a', 'HB1')], 'zzz'), []);
  assert.deepStrictEqual(rankQuickKeyItems(null, 'x'), []);
  assert.deepStrictEqual(rankQuickKeyItems(undefined, ''), []);
});

test('the lit row is the first one not yet on a key', () => {
  const ranked = [c('a', 'SK-1'), c('b', 'SK-2'), c('c', 'SK-3')];
  assert.strictEqual(firstUnboundQuickKeyIndex(ranked, {}), 0);
  assert.strictEqual(firstUnboundQuickKeyIndex(ranked, { 1: bound('counter', 'a') }), 1);
  assert.strictEqual(firstUnboundQuickKeyIndex(ranked, { 1: bound('counter', 'a'), 2: bound('counter', 'b') }), 2);
  const all = { 1: bound('counter', 'a'), 2: bound('counter', 'b'), 3: bound('counter', 'c') };
  assert.strictEqual(firstUnboundQuickKeyIndex(ranked, all), 0);
  assert.strictEqual(firstUnboundQuickKeyIndex([], {}), 0);
});
