#!/usr/bin/env node
/*
 * build-filemap.js — stamp the "Large-file map" table in ARCHITECTURE.md with
 * current line counts, the same committed-artifact-generator pattern as
 * build-toc.js / build-sw.js. The table kept drifting (its own caption asked
 * humans to "refresh when they drift", and they didn't); now `npm run check`
 * includes `build:filemap -- --check`, so staleness fails CI instead of being
 * a chore.
 *
 * Division of ownership: this script owns the NUMBERS — each row's Lines cell,
 * the `features/*.js (NN files) | NN,NNN total` row, and the `wc -l, DATE`
 * caption (restamped only when a count actually changes, so --check stays
 * deterministic day to day). Humans own everything else: which files are worth
 * listing, and the Status / verdict prose. Adding a row by hand just means its
 * count gets kept fresh from then on.
 *
 * Usage: node scripts/build-filemap.js        (rewrite in place)
 *        node scripts/build-filemap.js --check (exit 1 if stale)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ARCH = path.join(ROOT, 'ARCHITECTURE.md');

function countLines(file) {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  // wc -l semantics: number of newline characters.
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === '\n') n++;
  return n;
}
const fmt = (n) => n.toLocaleString('en-US');

function rebuild(src) {
  const start = src.indexOf('## Large-file map');
  if (start === -1) throw new Error('Large-file map heading not found');
  const end = src.indexOf('\n### ', start);
  if (end === -1) throw new Error('end of Large-file map section not found');
  let section = src.slice(start, end);
  let changed = false;

  // Per-file rows: | [name](path) | N,NNN | prose |
  section = section.replace(/^\| \[([^\]]+)\]\(([^)]+)\) \| ([\d,]+) \| /gm, (full, name, file, oldN) => {
    let fresh;
    try { fresh = fmt(countLines(file)); } catch (_) { return full; }   // row for a deleted file: leave for a human
    if (fresh !== oldN) changed = true;
    return `| [${name}](${file}) | ${fresh} | `;
  });

  // The aggregate row: | `features/*.js` (NN files) | NN,NNN total | prose |
  section = section.replace(/^\| `features\/\*\.js` \((\d+) files\) \| ([\d,]+) total \| /m, (full, oldCount, oldTotal) => {
    const files = fs.readdirSync(path.join(ROOT, 'features')).filter((f) => f.endsWith('.js'));
    const total = files.reduce((n, f) => n + countLines(path.join('features', f)), 0);
    if (String(files.length) !== oldCount || fmt(total) !== oldTotal) changed = true;
    return `| \`features/*.js\` (${files.length} files) | ${fmt(total)} total | `;
  });

  // Caption date — restamped only when a count moved, so --check is stable
  // across days with no drift.
  if (changed) {
    section = section.replace(/\(`wc -l`, \d{4}-\d{2}-\d{2} — /, `(\`wc -l\`, ${new Date().toISOString().slice(0, 10)} — `);
  }

  return { out: src.slice(0, start) + section + src.slice(end), changed };
}

const src = fs.readFileSync(ARCH, 'utf8');
const { out, changed } = rebuild(src);
const check = process.argv.includes('--check');

if (check) {
  if (changed) {
    console.error('Large-file map is stale. Run `npm run build:filemap` and commit the result.');
    process.exit(1);
  }
  console.log('Large-file map up to date.');
} else if (changed) {
  fs.writeFileSync(ARCH, out);
  console.log('Stamped fresh line counts into the ARCHITECTURE.md Large-file map.');
} else {
  console.log('Large-file map already up to date.');
}
