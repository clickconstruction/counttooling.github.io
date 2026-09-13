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
 * AGENTS.md (D14, 2026-09-12): the load-order summary's "NN `features/*.js`
 * registry files" figure drifted (56 vs 84 on disk) — it is now stamped here
 * too, between `<!-- feature-count -->` / `<!-- /feature-count -->` marker
 * comments, and `--check` fails when it is stale. Same feature-dir count as
 * the ARCHITECTURE aggregate row.
 *
 * Usage: node scripts/build-filemap.js        (rewrite in place)
 *        node scripts/build-filemap.js --check (exit 1 if stale)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { assertNoConflictMarkers } = require('./lib/markers');

const ROOT = path.join(__dirname, '..');
const ARCH = path.join(ROOT, 'ARCHITECTURE.md');
const AGENTS = path.join(ROOT, 'AGENTS.md');
const FEATURE_COUNT_BEGIN = '<!-- feature-count -->';
const FEATURE_COUNT_END = '<!-- /feature-count -->';

function featureFiles() {
  return fs.readdirSync(path.join(ROOT, 'features')).filter((f) => f.endsWith('.js'));
}

function countLines(file) {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assertNoConflictMarkers(s, file);
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
    const files = featureFiles();
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

// AGENTS.md: the "NN `features/*.js` registry files" figure between the
// marker comments. Every marker pair is restamped; no pair at all is an
// error (the doc lost its anchor — put it back).
function rebuildAgents(src) {
  const count = String(featureFiles().length);
  const re = new RegExp(FEATURE_COUNT_BEGIN + '\\d+' + FEATURE_COUNT_END, 'g');
  if (!re.test(src)) throw new Error('AGENTS.md: no ' + FEATURE_COUNT_BEGIN + 'NN' + FEATURE_COUNT_END + ' marker pair found');
  const out = src.replace(re, FEATURE_COUNT_BEGIN + count + FEATURE_COUNT_END);
  return { out, changed: out !== src };
}

const src = fs.readFileSync(ARCH, 'utf8');
assertNoConflictMarkers(src, 'ARCHITECTURE.md');
const { out, changed } = rebuild(src);
const agentsSrc = fs.readFileSync(AGENTS, 'utf8');
assertNoConflictMarkers(agentsSrc, 'AGENTS.md');
const agents = rebuildAgents(agentsSrc);
const check = process.argv.includes('--check');

if (check) {
  let stale = false;
  if (changed) {
    console.error('Large-file map is stale. Run `npm run build:filemap` and commit the result.');
    stale = true;
  }
  if (agents.changed) {
    console.error('AGENTS.md feature-file count is stale (' + featureFiles().length + ' on disk). Run `npm run build:filemap` and commit the result.');
    stale = true;
  }
  if (stale) process.exit(1);
  console.log('Large-file map + AGENTS.md feature-file count up to date.');
} else {
  if (changed) {
    fs.writeFileSync(ARCH, out);
    console.log('Stamped fresh line counts into the ARCHITECTURE.md Large-file map.');
  } else {
    console.log('Large-file map already up to date.');
  }
  if (agents.changed) {
    fs.writeFileSync(AGENTS, agents.out);
    console.log('Stamped the feature-file count (' + featureFiles().length + ') into AGENTS.md.');
  } else {
    console.log('AGENTS.md feature-file count already up to date.');
  }
}
