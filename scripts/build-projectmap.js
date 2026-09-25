#!/usr/bin/env node
/*
 * build-projectmap.js — the measured skeleton under DECOMPOSITION_MAP.md.
 *
 * Writes project-map/project-map.json (every fact scripts/lib/project-map.js
 * measures) and project-map/PROJECT-MAP.md (the tables a person reads first:
 * the biggest files, what grew since the last map, app.js by SECTION, the
 * registry's heaviest edges, the modals and who binds them, the near-duplicate
 * blocks). The output directory is gitignored: the counts move with every
 * edit, so the map is regenerated on demand (a few seconds) rather than
 * committed and stamped. DECOMPOSITION_MAP.md is the dated, committed reading
 * of one run.
 *
 * --check does not compare counts. It runs the structural invariants, which
 * must hold on every commit (in `npm run check`):
 *   1. every first-party shell script and features/*.js has an ARCHITECTURE.md
 *      Files-table row;
 *   2. no App.* read at LOAD time names something a later script registers
 *      (the D1 prepare-pdf bug shape);
 *   3. no unguarded App.* read names something nothing registers.
 *
 * Usage: node scripts/build-projectmap.js [--out <dir>] [--since <ref>]
 *        node scripts/build-projectmap.js --check
 * --since defaults to DECOMPOSITION_MAP.md's `<!-- project-map-head: <sha> -->`
 * (the HEAD that map was read at), else the last commit that touched it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { build, invariants } = require('./lib/project-map');

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const ROOT = path.join(__dirname, '..');
const fmt = (n) => n.toLocaleString('en-US');

const map = build({ since: arg('--since'), skipDuplicates: argv.includes('--check') });

if (argv.includes('--check')) {
  const problems = invariants(map);
  if (problems.length) {
    console.error('Project map invariants FAILED (' + problems.length + '):');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  console.log('Project map invariants hold (Files-table rows, load-time App reads, registered App reads).');
  process.exit(0);
}

const outDir = path.resolve(ROOT, arg('--out') || 'project-map');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'project-map.json'), JSON.stringify(map, null, 1) + '\n');

// ---------------------------------------------------------------- summary markdown
const F = map.files;
const md = [];
const row = (cells) => '| ' + cells.join(' | ') + ' |';
md.push('# Project map (generated)', '');
md.push('HEAD `' + map.head.slice(0, 7) + '`, churn measured since `' + (map.baseline || 'n/a').slice(0, 7) + '` (the HEAD DECOMPOSITION_MAP.md was read at, unless `--since`). Regenerate with `npm run build:projectmap`; the JSON beside this file has every fact.', '');

const byKind = {};
for (const r of Object.values(F)) { const k = byKind[r.kind] = byKind[r.kind] || { files: 0, lines: 0, grew: 0 }; k.files++; k.lines += r.lines; k.grew += r.lines - r.churn.linesAtBaseline; }
md.push('## Totals by kind', '', row(['Kind', 'Files', 'Lines', 'Net since baseline']), row(['---', '---:', '---:', '---:']));
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].lines - a[1].lines)) md.push(row([k, v.files, fmt(v.lines), (v.grew >= 0 ? '+' : '') + fmt(v.grew)]));
md.push('');

const src = Object.entries(F).filter(([, r]) => !['spec', 'test', 'config', 'edge'].includes(r.kind));
md.push('## Largest source files', '', row(['File', 'Kind', 'Lines', 'At baseline', 'Commits since', 'Fan-in / fan-out (App names)']), row(['---', '---', '---:', '---:', '---:', '---']));
for (const [f, r] of src.sort((a, b) => b[1].lines - a[1].lines).slice(0, 45)) {
  const fin = (r.fanIn || []).reduce((n, e) => n + e.n, 0), fout = (r.fanOut || []).reduce((n, e) => n + e.n, 0);
  md.push(row([f, r.kind, fmt(r.lines), fmt(r.churn.linesAtBaseline), r.churn.commits, r.fanIn ? fin + ' / ' + fout : '']));
}
md.push('');

md.push('## New since baseline (source)', '', row(['File', 'Kind', 'Lines']), row(['---', '---', '---:']));
for (const [f, r] of src.filter(([, r]) => r.churn.linesAtBaseline === 0 && r.lines > 0).sort((a, b) => b[1].lines - a[1].lines)) md.push(row([f, r.kind, fmt(r.lines)]));
md.push('');

md.push('## app.js by SECTION', '', row(['Start', 'Section', 'Lines', 'Functions ≥ 20 lines']), row(['---:', '---', '---:', '---']));
for (const s of F['app.js'].sections) {
  const fns = F['app.js'].functions.filter((fn) => fn.start >= s.start && fn.start <= s.end && fn.depth <= 2).map((fn) => fn.name + ' ' + fn.lines).join(', ');
  md.push(row([s.start, s.name, s.lines, fns]));
}
md.push('');

md.push('## Largest functions (browser code)', '', row(['Function', 'File:line', 'Lines']), row(['---', '---', '---:']));
const fns = [];
for (const [f, r] of Object.entries(F)) if (r.functions && !['tooling', 'helper'].includes(r.kind)) for (const fn of r.functions) fns.push({ f, ...fn });
for (const fn of fns.filter((x) => x.depth <= 2).sort((a, b) => b.lines - a.lines).slice(0, 40)) md.push(row([fn.name, fn.f + ':' + fn.start, fn.lines]));
md.push('');

md.push('## Heaviest registry edges (reader -> registrant, App names)', '', row(['Reader', 'Registrant', 'Names']), row(['---', '---', '---:']));
for (const e of map.edges.filter((e) => e.to !== 'app.js').slice(0, 30)) md.push(row([e.from, e.to, e.n + ' (' + e.names.slice(0, 6).join(', ') + (e.n > 6 ? ', …' : '') + ')']));
md.push('', 'Reads of app.js-registered names by file (the core surface each feature leans on):', '', row(['Reader', 'app.js names']), row(['---', '---:']));
for (const e of map.edges.filter((e) => e.to === 'app.js').slice(0, 25)) md.push(row([e.from, e.n]));
md.push('');

md.push('## Modals: size and who binds them', '', row(['Modal', 'Shell lines', 'CSS lines', 'Bound by (id refs)']), row(['---', '---:', '---:', '---']));
for (const [id, m] of Object.entries(map.modals).sort((a, b) => (b[1].lines || 0) - (a[1].lines || 0))) {
  md.push(row(['#' + id, m.lines, m.cssLines, Object.entries(m.boundBy).sort((a, b) => b[1] - a[1]).map(([f, n]) => f + ' ' + n).join(', ') || '(none found)']));
}
md.push('');

md.push('## Near-duplicate blocks', '', 'Runs of ≥ ' + map.duplicates.minLines + ' identical normalized lines (' + map.duplicates.boilerplateWindows + ' windows shared by more than 6 places skipped as boilerplate).', '', row(['Norm. lines', 'A', 'B', 'Starts with']), row(['---:', '---', '---', '---']));
for (const d of map.duplicates.runs.slice(0, 60)) md.push(row([d.normLines, d.a.file + ':' + d.a.start + '-' + d.a.end, d.b.file + ':' + d.b.start + '-' + d.b.end, '`' + d.sample.replace(/\|/g, '\\|').replace(/`/g, "'") + '`']));
if (map.duplicates.runs.length > 60) md.push('', '(' + (map.duplicates.runs.length - 60) + ' more in the JSON.)');
md.push('');

const problems = invariants(map);
md.push('## Invariants', '', problems.length ? problems.map((p) => '- ' + p).join('\n') : 'All hold.', '');

fs.writeFileSync(path.join(outDir, 'PROJECT-MAP.md'), md.join('\n'));
console.log('Wrote ' + path.relative(ROOT, outDir) + '/project-map.json and PROJECT-MAP.md (' + Object.keys(F).length + ' files, ' + map.edges.length + ' registry edges, ' + map.duplicates.runs.length + ' duplicate runs, ' + problems.length + ' invariant problems).');
