#!/usr/bin/env node
// The persona merge (PERSONA-PLAN build item 5, 2026-09-25): code, no model. Reads a folder of
// persona findings (*.jsonl, one finding per line, as the persona forks write them), groups
// them, and ranks the groups by how many INDEPENDENT persona kinds hit the same spot, because
// one persona's complaint is a lead and five kinds stalling on one control is a finding.
//
//   node scripts/persona-merge.js <findings dir> [--out <dir>] [--score known.json]
//
// Writes <out>/digest.json and <out>/digest.md (out defaults to the findings folder). With
// --score it also prints calibration numbers against a known list (below) and writes nothing
// new beyond the digest.
//
// ---- The finding schema (the persona agents write this; one JSON object per line) ----------
//   persona   string, required. "<kind>#<seed>": the persona's point on the axes, then which
//             run of it, e.g. "apprentice.first-time.desktop.skims.learn#2". The part before
//             "#" is the persona KIND (what the ranking counts); the seed tells runs apart.
//   kind      required: 'stall' (could not go on) | 'wording' (the card said something the
//             screen did not match) | 'gap' (a term or step the reader was assumed to know) |
//             'code-claim' (a statement about a code or trade value) | 'suggestion'.
//   set       required: the set id, as GET /sets lists it ("plumbing", "lesson:counting",
//             "course:plumbing:fixtures").
//   step      required: the step id inside the set ("counter").
//   control   optional: the control's label as the card or screen names it ("+ Add").
//   code      optional: the hint's reason code when one showed (not-armed, outside-zone,
//             wrong-page, wrong-scale, wrong-item, wrong-value, dialog-closed, not-yet, other).
//   tried     required: what the persona did, in a line.
//   expected  required: what it expected to happen.
//   evidence  required: what it saw instead (the status line, the card's words, an event).
//   ruleId    optional: a rulebook id (rules/rules.json) a code-claim is about. A persona cites
//             a rule only by its id; anything else is a question for a tester.
//   severity  required: 1 (friction) | 2 (a detour) | 3 (could not finish the step).
//
// ---- The known list for --score (calibration: the by-hand walks' findings) ------------------
//   [ { "id": "PW-3", "set": "plumbing", "step": "counter", "keywords": ["standing", "Water Closet"],
//       "desc": "a standing Water Closet ticks the step" } ]
//   A known item is FOUND when a group shares its set and step and either it has no keywords or
//   any keyword appears (case-insensitive) in the group's text: its control, code and every
//   finding's tried / expected / evidence. Recall is found / known. Groups that match no known
//   item are printed as noise candidates: each is either a false lead or something the by-hand
//   walks missed, and a person decides which.
const fs = require('node:fs');
const path = require('node:path');

const KINDS = ['stall', 'wording', 'gap', 'code-claim', 'suggestion'];
const REQUIRED = ['persona', 'kind', 'set', 'step', 'tried', 'expected', 'evidence', 'severity'];

// "[[+ Add]]", "the '+ Add' button", "+ add" all name one control.
function normalizeControl(c) {
  if (c == null) return '';
  return String(c).toLowerCase()
    .replace(/\[\[|\]\]/g, ' ')
    .replace(/["'`“”‘’]/g, ' ')
    .replace(/\b(the|button|tab|link|field|dropdown|menu|icon)\b/g, ' ')
    .replace(/[.,;:!?()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function splitPersona(p) {
  const s = String(p || '').trim();
  const i = s.indexOf('#');
  return i < 0 ? { personaKind: s, seed: '0' } : { personaKind: s.slice(0, i).trim(), seed: s.slice(i + 1).trim() || '0' };
}
// Why a finding cannot be used, or '' when it can.
function invalid(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return 'not an object';
  const missing = REQUIRED.filter((k) => f[k] == null || f[k] === '');
  if (missing.length) return 'missing ' + missing.join(', ');
  if (!KINDS.includes(f.kind)) return 'kind "' + f.kind + '" is not one of ' + KINDS.join(' | ');
  if (![1, 2, 3].includes(+f.severity)) return 'severity must be 1, 2 or 3';
  if (!splitPersona(f.persona).personaKind) return 'persona has no kind before "#"';
  return '';
}
// One file's text -> { findings, rejected }. Blank lines are skipped.
function parseFindings(text, file) {
  const findings = [], rejected = [];
  String(text).split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    let f;
    try { f = JSON.parse(line); } catch (_) { rejected.push({ file, line: i + 1, why: 'not JSON' }); return; }
    const why = invalid(f);
    if (why) { rejected.push({ file, line: i + 1, why }); return; }
    findings.push(Object.assign({}, f, { severity: +f.severity, _file: file, _line: i + 1 }));
  });
  return { findings, rejected };
}
function readFolder(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
  const out = { files, findings: [], rejected: [] };
  files.forEach((f) => { const r = parseFindings(fs.readFileSync(path.join(dir, f), 'utf8'), f); out.findings.push(...r.findings); out.rejected.push(...r.rejected); });
  return out;
}
const groupKey = (f) => [f.set, f.step, normalizeControl(f.control), String(f.code || '').toLowerCase(), f.kind].join('|');
// Group, count, rank: persona kinds first (independent hits), then the worst severity, then
// how many findings, then the key (a stable order for equal groups).
function groupFindings(findings) {
  const map = new Map();
  findings.forEach((f) => {
    const k = groupKey(f);
    if (!map.has(k)) map.set(k, { key: k, set: f.set, step: f.step, kind: f.kind, control: f.control || '', code: f.code || '', findings: [] });
    map.get(k).findings.push(f);
  });
  const groups = Array.from(map.values()).map((g) => {
    const kinds = new Set(), seeds = new Set();
    g.findings.forEach((f) => { const p = splitPersona(f.persona); kinds.add(p.personaKind); seeds.add(p.personaKind + '#' + p.seed); });
    const sev = g.findings.map((f) => f.severity);
    return {
      key: g.key, set: g.set, step: g.step, kind: g.kind, control: g.control, code: g.code,
      personaKinds: kinds.size, seeds: seeds.size, count: g.findings.length,
      severity: Math.max(...sev), meanSeverity: Math.round((sev.reduce((a, b) => a + b, 0) / sev.length) * 10) / 10,
      personas: Array.from(kinds).sort(),
      ruleIds: Array.from(new Set(g.findings.map((f) => f.ruleId).filter(Boolean))).sort(),
      samples: g.findings.slice(0, 3).map((f) => ({ persona: f.persona, tried: f.tried, expected: f.expected, evidence: f.evidence })),
      text: [g.control, g.code].concat(...g.findings.map((f) => [f.control, f.tried, f.expected, f.evidence])).filter(Boolean).join(' \n '),
    };
  });
  groups.sort((a, b) => b.personaKinds - a.personaKinds || b.severity - a.severity || b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  groups.forEach((g, i) => { g.rank = i + 1; });
  return groups;
}
function buildDigest(read, generated) {
  const groups = groupFindings(read.findings);
  return {
    generated: generated || new Date().toISOString(),
    inputs: { files: read.files.length, findings: read.findings.length, rejected: read.rejected.length, personaKinds: new Set(read.findings.map((f) => splitPersona(f.persona).personaKind)).size },
    rejected: read.rejected,
    groups: groups.map((g) => { const o = Object.assign({}, g); delete o.text; return o; }),
  };
}
const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
function renderMarkdown(d) {
  const out = ['# Persona digest', '', d.inputs.findings + ' findings from ' + d.inputs.files + ' files, ' + d.inputs.personaKinds + ' persona kinds, ' + d.groups.length + ' groups' + (d.inputs.rejected ? ' (' + d.inputs.rejected + ' lines rejected, listed at the end)' : '') + '. Ranked by how many persona kinds hit the spot, then the worst severity.', '',
    '| # | Kinds | Sev | N | Set · step | Kind | Control | Code | What they tried → saw |', '|---|---|---|---|---|---|---|---|---|'];
  d.groups.forEach((g) => { const s = g.samples[0] || {}; out.push('| ' + [g.rank, g.personaKinds, g.severity, g.count, cell(g.set + ' · ' + g.step), g.kind, cell(g.control), cell(g.code), cell(s.tried) + ' → ' + cell(s.evidence)].join(' | ') + ' |'); });
  if (d.rejected.length) { out.push('', '## Rejected lines', ''); d.rejected.forEach((r) => out.push('- ' + r.file + ':' + r.line + ': ' + r.why)); }
  return out.join('\n') + '\n';
}
// Calibration: which known items the groups found, which they missed, and the groups that
// match no known item (noise candidates).
function score(groups, known) {
  const matches = (g, k) => g.set === k.set && g.step === k.step && (!(k.keywords || []).length || k.keywords.some((w) => (g.text || '').toLowerCase().includes(String(w).toLowerCase())));
  const found = [], missed = [];
  known.forEach((k) => (groups.some((g) => matches(g, k)) ? found : missed).push(k.id));
  const noise = groups.filter((g) => !known.some((k) => matches(g, k))).map((g) => ({ rank: g.rank, key: g.key, personaKinds: g.personaKinds, severity: g.severity }));
  return { recall: known.length ? Math.round((found.length / known.length) * 1000) / 1000 : null, found, missed, noise, groups: groups.length };
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf('--' + n); return i > -1 ? argv[i + 1] : null; };
  const dir = argv.find((a, i) => !a.startsWith('--') && !['--out', '--score'].includes(argv[i - 1]));
  if (!dir || !fs.existsSync(dir)) { console.error('usage: node scripts/persona-merge.js <findings dir> [--out <dir>] [--score known.json]'); process.exit(2); }
  const out = flag('out') || dir;
  const read = readFolder(dir);
  const digest = buildDigest(read);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'digest.json'), JSON.stringify(digest, null, 1) + '\n');
  fs.writeFileSync(path.join(out, 'digest.md'), renderMarkdown(digest));
  console.log(read.findings.length + ' findings -> ' + digest.groups.length + ' groups · ' + path.join(out, 'digest.md') + (read.rejected.length ? ' · ' + read.rejected.length + ' lines rejected' : ''));
  const knownFile = flag('score');
  if (knownFile) {
    const s = score(groupFindings(read.findings), JSON.parse(fs.readFileSync(knownFile, 'utf8')));
    console.log('recall ' + (s.recall == null ? 'n/a' : (s.recall * 100).toFixed(1) + '%') + ' (' + s.found.length + ' of ' + (s.found.length + s.missed.length) + ')');
    console.log('found:  ' + (s.found.join(', ') || '(none)'));
    console.log('missed: ' + (s.missed.join(', ') || '(none)'));
    console.log('noise candidates (' + s.noise.length + ' of ' + s.groups + ' groups match no known item):');
    s.noise.forEach((n) => console.log('  #' + n.rank + ' ' + n.key + ' (kinds ' + n.personaKinds + ', sev ' + n.severity + ')'));
  }
}

if (require.main === module) main();
module.exports = { KINDS, normalizeControl, splitPersona, invalid, parseFindings, readFolder, groupFindings, buildDigest, renderMarkdown, score };
