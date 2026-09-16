#!/usr/bin/env node
/**
 * Punch-list link check.
 *
 * [PUNCHLIST.md](../PUNCHLIST.md) is an INDEX: each row's `Detail` cell points
 * at the document that actually owns the item. A row may carry no link (a
 * one-line item is self-contained), but a link that IS there must resolve —
 * otherwise the index quietly rots into the ninth place a to-do hides, which is
 * the exact failure the list exists to end.
 *
 * Checks, in the repo's pure-verifier idiom (no generation step; always
 * --check). Exits 1 with every problem listed. Run via `npm run check`.
 *   1. Every markdown link target in the table resolves to a file in the repo.
 *   2. Where the link carries a `#anchor`, a heading in that file produces it
 *      (GitHub's slug algorithm).
 *   3. Rows are well formed: six cells, a unique non-empty ID, a known `Kind`
 *      and `Who`, and any `Blocked by` that names a row actually names one.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const KINDS = new Set(['bug', 'build', 'decision', 'test', 'chore']);
const WHO = new Set(['agent', 'dev', 'tester', '⚑ call']);

// GitHub's heading -> anchor slug: lowercase, drop punctuation except - and _,
// spaces to hyphens. (An em dash is punctuation, so " — " yields "--".)
function slug(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s/g, '-');   // each space, not each RUN: " — " becomes "--"
}

function anchorsFor(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const out = new Set();
  for (const line of text.split('\n')) {
    const m = line.match(/^#{1,6}\s+(.*?)\s*$/);
    if (m) out.add(slug(m[1]));
  }
  return out;
}

const failures = [];
const listPath = 'PUNCHLIST.md';
const lines = fs.readFileSync(path.join(root, listPath), 'utf8').split('\n');

const ids = [];
const blockers = [];
const anchorCache = new Map();
let links = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Table body rows only: start with '|', and skip the header + separator.
  if (!line.startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  if (cells.length !== 6) {
    failures.push(`${listPath}:${i + 1}: expected 6 cells, found ${cells.length}`);
    continue;
  }
  const [id, , kind, who, blocked, detail] = cells;
  if (id === 'ID' || /^-+$/.test(id)) continue;   // header / separator

  if (!id) failures.push(`${listPath}:${i + 1}: empty ID`);
  else if (ids.includes(id)) failures.push(`${listPath}:${i + 1}: duplicate ID '${id}'`);
  else ids.push(id);

  if (!KINDS.has(kind)) failures.push(`${listPath}:${i + 1}: unknown Kind '${kind}' (expected ${[...KINDS].join(', ')})`);
  if (!WHO.has(who)) failures.push(`${listPath}:${i + 1}: unknown Who '${who}' (expected ${[...WHO].join(', ')})`);
  if (blocked && blocked !== '—' && !blocked.startsWith('⚑')) blockers.push({ line: i + 1, id: blocked });

  for (const m of detail.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    links++;
    const [file, anchor] = m[1].split('#');
    if (!fs.existsSync(path.join(root, file))) {
      failures.push(`${listPath}:${i + 1}: '${id}' links to a missing file: ${file}`);
      continue;
    }
    if (!anchor) continue;
    if (!anchorCache.has(file)) anchorCache.set(file, anchorsFor(file));
    if (!anchorCache.get(file).has(anchor)) {
      failures.push(`${listPath}:${i + 1}: '${id}' links to a missing anchor: ${file}#${anchor}`);
    }
  }
}

for (const b of blockers) {
  if (!ids.includes(b.id)) failures.push(`${listPath}:${b.line}: 'Blocked by' names '${b.id}', which is not a row in this list`);
}

if (!ids.length) failures.push(`${listPath}: no rows found — the table is missing or malformed`);

if (failures.length) {
  console.error('Punch list has problems:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`Punch list OK (${ids.length} open rows, ${links} detail links resolved).`);
