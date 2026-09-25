#!/usr/bin/env node
// Render a persona prompt (PERSONA-PROBER, 2026-09-25): scripts/persona-prompts/<role>.md with its
// placeholders filled. The .md files are the single source of the text-pass, live-pass and prober
// prompts (the calibration's lived only in a workflow script); the persona kinds, the seeds and the
// finding format are the tables and the last section of scripts/persona-prompts/README.md.
//
//   node scripts/lib/persona-prompts.js <text|live|prober> [--persona <kind>] [--seed <n>] [--var NAME=value ...]
//
// A placeholder left unfilled is an error: a prompt never goes out with a hole in it.
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'persona-prompts');
const ROLES = ['text', 'live', 'prober'];

// The README's two tables and its finding format.
function readme(dir = DIR) {
  const md = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  const section = (title) => { const i = md.indexOf('## ' + title); if (i < 0) throw new Error('README.md has no "## ' + title + '"'); const rest = md.slice(i + title.length + 3); const j = rest.indexOf('\n## '); return (j < 0 ? rest : rest.slice(0, j)).trim(); };
  const rows = (text) => text.split('\n').filter((l) => /^\|\s*[`\d]/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, '')));
  const personas = {};
  rows(section('Persona kinds')).forEach(([kind, device, who]) => { personas[kind] = { device, who }; });
  const seeds = {};
  rows(section('Seeds')).forEach(([n, how]) => { seeds[n] = how; });
  return { personas, seeds, findingFormat: section('Finding format') };
}

const fill = (text, vars) => text.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));

// The prompt for `role`, with { persona, seed, vars }. persona/seed fill PERSONA_ID, SEED, WHO,
// HOW and DEVICE (a --var wins over them); FINDING_FORMAT is the README's section.
function render(role, opts = {}, dir = DIR) {
  if (!ROLES.includes(role)) throw new Error('no prompt "' + role + '" (one of ' + ROLES.join(', ') + ')');
  const R = readme(dir);
  const vars = {};
  if (opts.persona != null) {
    const p = R.personas[opts.persona];
    if (!p) throw new Error('no persona kind "' + opts.persona + '" (README.md lists ' + Object.keys(R.personas).join(', ') + ')');
    Object.assign(vars, { PERSONA_ID: opts.persona, WHO: p.who, DEVICE: p.device });
  }
  if (opts.seed != null) {
    const how = R.seeds[String(opts.seed)];
    if (how == null) throw new Error('no seed ' + opts.seed + ' (README.md lists ' + Object.keys(R.seeds).join(', ') + ')');
    Object.assign(vars, { SEED: String(opts.seed), HOW: how });
  }
  Object.assign(vars, opts.vars || {});
  const text = fill(fill(fs.readFileSync(path.join(dir, role + '.md'), 'utf8'), { FINDING_FORMAT: R.findingFormat }), vars);
  const holes = Array.from(new Set((text.match(/\{\{[A-Z_]+\}\}/g) || [])));
  if (holes.length) throw new Error(role + '.md: unfilled ' + holes.join(', ') + ' (pass --var NAME=value)');
  return text;
}

function main() {
  const argv = process.argv.slice(2);
  const role = argv[0];
  const opts = { vars: {} };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--persona') opts.persona = argv[++i];
    else if (argv[i] === '--seed') opts.seed = argv[++i];
    else if (argv[i] === '--var') { const kv = argv[++i] || ''; const k = kv.indexOf('='); if (k < 1) { console.error('--var NAME=value'); process.exit(2); } opts.vars[kv.slice(0, k)] = kv.slice(k + 1); }
  }
  try { process.stdout.write(render(role, opts)); } catch (e) { console.error(e.message); process.exit(2); }
}

if (require.main === module) main();
module.exports = { ROLES, DIR, readme, render };
