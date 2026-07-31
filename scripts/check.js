#!/usr/bin/env node
/**
 * Aggregate check runner (DECOMPOSITION_MAP Tier-4 #22). Replaces the
 * package.json `&&` chain: every step ALWAYS runs, so one stale stamp no
 * longer hides the next four — all failures are reported in one pass.
 *
 * Steps mirror the old chain exactly: lint, unit tests, the four generator
 * `--check`s, the service-worker stamp check, and the brand-token verifier.
 * Output for passing steps is suppressed to a status line; failing steps
 * replay their full output at the end. Exit code 1 when anything failed.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

const STEPS = [
  { name: 'lint', cmd: 'npm', args: ['run', 'lint'] },
  { name: 'unit tests', cmd: 'npm', args: ['run', 'test:unit'] },
  { name: 'build:toc --check', cmd: 'node', args: ['scripts/build-toc.js', '--check'] },
  { name: 'build:filemap --check', cmd: 'node', args: ['scripts/build-filemap.js', '--check'] },
  { name: 'build:macros --check', cmd: 'node', args: ['scripts/build-macros.js', '--check'] },
  { name: 'build:guides --check', cmd: 'node', args: ['scripts/build-guides.js', '--check'] },
  { name: 'build:sw --check', cmd: 'node', args: ['scripts/build-sw.js', '--check'] },
  { name: 'brand tokens', cmd: 'node', args: ['scripts/check-brand-tokens.js'] },
];

const failures = [];
for (const step of STEPS) {
  const t0 = Date.now();
  const res = spawnSync(step.cmd, step.args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  const ms = Date.now() - t0;
  const ok = res.status === 0;
  console.log((ok ? '✓' : '✗') + ' ' + step.name + ' (' + (ms / 1000).toFixed(1) + 's)');
  if (!ok) failures.push({ step, output: (res.stdout || '') + (res.stderr || '') });
}

if (failures.length) {
  console.error('\n' + failures.length + ' check step(s) FAILED:\n');
  for (const f of failures) {
    console.error('--- ' + f.step.name + ' ' + '-'.repeat(Math.max(1, 60 - f.step.name.length)));
    console.error(f.output.trim());
    console.error('');
  }
  process.exit(1);
}
console.log('\nAll ' + STEPS.length + ' check steps passed.');
