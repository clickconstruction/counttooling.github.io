const test = require('node:test');
const assert = require('node:assert');
const { RECENT_BIDS_MAX, nextRecentBids, withoutRecentBid, formatBidAge } = require('./recent-bids.js');

const T = 1_757_000_000_000; // fixed "now" so the age cases never drift

test('nextRecentBids puts the newest bid first', () => {
  const a = nextRecentBids([], { id: 'a', name: 'Sysco Cold Box' }, T);
  const b = nextRecentBids(a, { id: 'b', name: 'Midland Clinic' }, T + 1000);
  assert.deepStrictEqual(b.map(x => x.id), ['b', 'a']);
  assert.strictEqual(b[0].name, 'Midland Clinic');
  assert.strictEqual(b[0].at, T + 1000);
});

test('reopening a bid keeps ONE row and moves it to the top', () => {
  let list = [];
  list = nextRecentBids(list, { id: 'a', name: 'A' }, T);
  list = nextRecentBids(list, { id: 'b', name: 'B' }, T + 1);
  list = nextRecentBids(list, { id: 'a', name: 'A' }, T + 2);
  assert.deepStrictEqual(list.map(x => x.id), ['a', 'b']);
  assert.strictEqual(list.length, 2);
});

test('a rename elsewhere corrects itself on the next open', () => {
  let list = nextRecentBids([], { id: 'a', name: 'Old Name' }, T);
  list = nextRecentBids(list, { id: 'a', name: 'New Name' }, T + 1);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, 'New Name');
});

test('the list caps at RECENT_BIDS_MAX, dropping the oldest', () => {
  let list = [];
  for (let i = 0; i < RECENT_BIDS_MAX + 3; i++) list = nextRecentBids(list, { id: 'id' + i, name: 'Bid ' + i }, T + i);
  assert.strictEqual(list.length, RECENT_BIDS_MAX);
  assert.strictEqual(list[0].id, 'id' + (RECENT_BIDS_MAX + 2));
  assert.ok(!list.some(b => b.id === 'id0'));
});

test('a local-only takeoff (no id) is not remembered', () => {
  const list = nextRecentBids([{ id: 'a', name: 'A', at: T }], { id: '', name: 'Untitled' }, T + 1);
  assert.deepStrictEqual(list.map(x => x.id), ['a']);
});

test('a nameless bid reads as Untitled, matching the settings subtitle', () => {
  const list = nextRecentBids([], { id: 'a' }, T);
  assert.strictEqual(list[0].name, 'Untitled');
});

test('junk rows from an older or corrupted store are dropped, not thrown on', () => {
  const junk = [null, { name: 'no id' }, { id: 'ok', name: 'Fine', at: T }, 'nope', { id: 7 }];
  const list = nextRecentBids(junk, { id: 'new', name: 'New' }, T + 1);
  assert.deepStrictEqual(list.map(x => x.id), ['new', 'ok']);
});

test('nextRecentBids never mutates the list it was given', () => {
  const orig = [{ id: 'a', name: 'A', at: T }];
  const copy = JSON.parse(JSON.stringify(orig));
  nextRecentBids(orig, { id: 'b', name: 'B' }, T + 1);
  assert.deepStrictEqual(orig, copy);
});

test('withoutRecentBid drops a deleted bid and leaves the rest', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepStrictEqual(withoutRecentBid(list, 'b').map(x => x.id), ['a', 'c']);
  assert.deepStrictEqual(withoutRecentBid(list, 'zz').map(x => x.id), ['a', 'b', 'c']);
  assert.deepStrictEqual(withoutRecentBid(null, 'a'), []);
});

test('formatBidAge speaks in coarse trade time', () => {
  assert.strictEqual(formatBidAge(T, T), 'just now');
  assert.strictEqual(formatBidAge(T - 60_000 * 25, T), '25m ago');
  assert.strictEqual(formatBidAge(T - 3600_000 * 2, T), '2h ago');
  assert.strictEqual(formatBidAge(T - 3600_000 * 26, T), 'yesterday');
  assert.strictEqual(formatBidAge(T - 86_400_000 * 3, T), '3d ago');
  assert.strictEqual(formatBidAge(T - 86_400_000 * 10, T), '1w ago');
  assert.strictEqual(formatBidAge(T - 86_400_000 * 400, T), 'a while ago');
});

test('formatBidAge returns empty for a missing or future stamp', () => {
  assert.strictEqual(formatBidAge(0, T), '');
  assert.strictEqual(formatBidAge(undefined, T), '');
  assert.strictEqual(formatBidAge(T + 5000, T), '');
});
