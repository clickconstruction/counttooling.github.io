// Node invariant tests for scripts/lib/markers.js — the shared generated-region
// splice + merge-conflict guard used by the committed-artifact generators
// (build-toc / build-filemap / build-macros / build-sw).
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
const test = require('node:test');
const assert = require('node:assert');
const { spliceMarkedRegion, findConflictMarkerLine } = require('./scripts/lib/markers.js');

// Built by concatenation so this test file never contains a literal
// column-0 conflict marker itself.
const OURS = '<'.repeat(7) + ' HEAD';
const MID = '='.repeat(7);
const THEIRS = '>'.repeat(7) + ' claude/some-branch';

test('findConflictMarkerLine flags each git marker at column 0, 1-based', () => {
  assert.strictEqual(findConflictMarkerLine(`a\n${OURS}\nb`), 2);
  assert.strictEqual(findConflictMarkerLine(`a\nb\n${MID}\n`), 3);
  assert.strictEqual(findConflictMarkerLine(`${THEIRS}\nrest`), 1);
  // A full conflict block reports the FIRST marker line.
  assert.strictEqual(findConflictMarkerLine(`x\n${OURS}\nours\n${MID}\ntheirs\n${THEIRS}\n`), 2);
});

test('findConflictMarkerLine returns 0 for clean text', () => {
  assert.strictEqual(findConflictMarkerLine(''), 0);
  assert.strictEqual(findConflictMarkerLine('const CACHE_VERSION = "abc";\n'), 0);
});

test('findConflictMarkerLine ignores non-marker lookalikes', () => {
  // Indented or mid-line — git puts markers at column 0 only.
  assert.strictEqual(findConflictMarkerLine(`  ${MID}\n`), 0);
  assert.strictEqual(findConflictMarkerLine(`a ${OURS}\n`), 0);
  // Too short: 6 chars, or '<<<<<<<' with no trailing space.
  assert.strictEqual(findConflictMarkerLine('<'.repeat(6) + ' x\n'), 0);
  assert.strictEqual(findConflictMarkerLine('<'.repeat(7) + '\n'), 0);
  assert.strictEqual(findConflictMarkerLine('='.repeat(6) + '\n'), 0);
});

test('spliceMarkedRegion replaces the marked region inclusive of markers', () => {
  const src = 'head\nBEGIN\nold\nEND\ntail';
  assert.strictEqual(
    spliceMarkedRegion(src, 'BEGIN', 'END', 'BEGIN\nnew\nEND'),
    'head\nBEGIN\nnew\nEND\ntail',
  );
});

test('spliceMarkedRegion returns null when markers are missing or reversed', () => {
  assert.strictEqual(spliceMarkedRegion('no markers', 'BEGIN', 'END', 'x'), null);
  assert.strictEqual(spliceMarkedRegion('BEGIN only', 'BEGIN', 'END', 'x'), null);
  assert.strictEqual(spliceMarkedRegion('END before\nBEGIN', 'BEGIN', 'END', 'x'), null);
});
