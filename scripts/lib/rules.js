/**
 * scripts/lib/rules.js — the rulebook's loader: reads content/rules/<trade>/<slug>.md,
 * parses the structured front-matter (a small YAML subset — scalars, inline lists,
 * one level of block maps, and block lists of flat maps), validates the shape, and
 * resolves each value's `code:` pointer against the app's own modules so
 * build-rules.js --check can fail when a table in code drifts from its rule.
 *
 * A rule file:
 *   ---
 *   id: elec.conduit.fill-limit          # stable, dotted; never renamed
 *   title: Conduit fill limits
 *   trade: electrical | hvac | plumbing
 *   kind: code | standard | recommendation | convention
 *   status: applied | draft              # draft = written down, not yet used by the app
 *   summary: one sentence for the index and rules.json
 *   values:
 *     - when: 3 or more conductors
 *       value: 40
 *       unit: "%"
 *       code: bid-check-model.js#fillLimitFor(3)   # optional drift pointer
 *       scale: 100                                # code value × scale == value
 *   source:
 *     code: NEC
 *     section: Chapter 9, Table 1
 *     editions: [2017, 2020, 2023]
 *     url: https://...                            # where the public text lives
 *   amendments: []                                # [{ jurisdiction, note }]
 *   used_by: [bidCheck]                           # app surfaces that apply it
 *   updated: 2026-09-09
 *   ---
 *   Markdown body: what the rule says as the app applies it, and why.
 *
 * `code:` pointer grammar — `<file>#<expr>` where <file> is a repo-root module with a
 * CommonJS footer and <expr> is an identifier followed by any of `.key`, `[json]`,
 * `(json, args)` — resolved by walking the exports, never eval'd.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'rules');
const TRADES = ['electrical', 'hvac', 'plumbing'];
const KINDS = ['code', 'standard', 'recommendation', 'convention'];
const STATUSES = ['applied', 'draft'];

// --- YAML subset -------------------------------------------------------------------
function scalar(s) {
  const t = String(s).trim();
  if (t === '') return '';
  if (/^["'].*["']$/.test(t)) return t.slice(1, -1);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^\[.*\]$/.test(t)) return t.slice(1, -1).split(',').map((x) => x.trim()).filter((x) => x !== '').map(scalar);
  return t;
}
function parseYamlSubset(text) {
  const lines = text.split(/\r?\n/).map((raw, n) => ({ n: n + 1, raw }))
    .filter((l) => l.raw.trim() !== '' && !/^\s*#/.test(l.raw))
    .map((l) => ({ ...l, indent: l.raw.match(/^ */)[0].length, text: l.raw.trim() }));
  let i = 0;
  function parseMap(indent) {
    const out = {};
    while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('- ')) {
      const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(lines[i].text);
      if (!m) throw new Error(`front-matter line ${lines[i].n}: expected "key: value", got "${lines[i].text}"`);
      const key = m[1], rest = m[2];
      i++;
      if (rest !== '') { out[key] = scalar(rest); continue; }
      if (i < lines.length && lines[i].indent > indent) {
        out[key] = lines[i].text.startsWith('- ') ? parseList(lines[i].indent) : parseMap(lines[i].indent);
      } else out[key] = null;
    }
    return out;
  }
  function parseList(indent) {
    const out = [];
    while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('- ')) {
      const first = lines[i].text.slice(2).trim();
      const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(first);
      if (!kv) { out.push(scalar(first)); i++; continue; }
      // a map item: rewrite the first line as a key at (indent + 2) and parse the block
      lines[i] = { ...lines[i], indent: indent + 2, text: first };
      out.push(parseMap(indent + 2));
    }
    return out;
  }
  const result = parseMap(lines.length ? lines[0].indent : 0);
  if (i < lines.length) throw new Error(`front-matter line ${lines[i].n}: unexpected "${lines[i].text}"`);
  return result;
}
function splitFrontMatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new Error('missing front-matter block');
  return { meta: parseYamlSubset(m[1]), body: m[2] };
}

// --- loading + validation -----------------------------------------------------------
function loadRules() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const rules = [];
  for (const trade of fs.readdirSync(CONTENT_DIR).sort()) {
    const dir = path.join(CONTENT_DIR, trade);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
      const rel = `content/rules/${trade}/${file}`;
      let parsed;
      try { parsed = splitFrontMatter(fs.readFileSync(path.join(dir, file), 'utf8')); } catch (e) { throw new Error(`${rel}: ${e.message}`); }
      const { meta, body } = parsed;
      const problems = validate(meta, trade);
      if (problems.length) throw new Error(`${rel}:\n  - ${problems.join('\n  - ')}`);
      rules.push({ ...meta, trade, slug: file.replace(/\.md$/, ''), file: rel, body, url: `/rules/${trade}/${file.replace(/\.md$/, '')}/` });
    }
  }
  const ids = new Map();
  for (const r of rules) {
    if (ids.has(r.id)) throw new Error(`${r.file}: id "${r.id}" is also used by ${ids.get(r.id)}`);
    ids.set(r.id, r.file);
  }
  return rules;
}
function validate(m, trade) {
  const p = [];
  if (!m.id || !/^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/.test(String(m.id))) p.push('id: dotted lowercase, e.g. elec.conduit.fill-limit');
  if (!m.title) p.push('title is required');
  if (!m.summary) p.push('summary is required');
  if (m.trade !== trade) p.push(`trade must be "${trade}" (the folder)`);
  if (!KINDS.includes(m.kind)) p.push(`kind must be one of ${KINDS.join(' | ')}`);
  if (!STATUSES.includes(m.status)) p.push(`status must be one of ${STATUSES.join(' | ')}`);
  if (!Array.isArray(m.values) || !m.values.length) p.push('values: at least one { when, value, unit }');
  else m.values.forEach((v, i) => {
    if (!v || typeof v !== 'object') p.push(`values[${i}]: expected a map`);
    else {
      if (v.when == null || v.when === '') p.push(`values[${i}].when is required`);
      if (v.value == null || v.value === '') p.push(`values[${i}].value is required`);
      if (v.code != null && !/^[A-Za-z0-9_./-]+\.js#.+$/.test(String(v.code))) p.push(`values[${i}].code: expected "<file>.js#<expr>"`);
    }
  });
  if (!m.source || typeof m.source !== 'object') p.push('source: { code, section } is required');
  else {
    if (!m.source.code) p.push('source.code is required (NEC, IPC, SMACNA, …)');
    if (!m.source.section) p.push('source.section is required');
  }
  if (m.amendments != null && !Array.isArray(m.amendments)) p.push('amendments: a list (may be empty)');
  if (!Array.isArray(m.used_by)) p.push('used_by: a list (may be empty)');
  if (m.status === 'applied' && !(m.used_by || []).length) p.push('status applied needs a non-empty used_by');
  if (!m.updated || !/^\d{4}-\d{2}-\d{2}$/.test(String(m.updated))) p.push('updated: YYYY-MM-DD');
  return p;
}

// --- code pointers ------------------------------------------------------------------
const moduleCache = new Map();
function loadModule(file) {
  if (!moduleCache.has(file)) {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) throw new Error(`module not found: ${file}`);
    moduleCache.set(file, require(abs));
  }
  return moduleCache.get(file);
}
// Walk `ident(.key | [json] | (json, …))*` over a module's exports.
function resolvePointer(pointer) {
  const hash = pointer.indexOf('#');
  const file = pointer.slice(0, hash), expr = pointer.slice(hash + 1);
  const mod = loadModule(file);
  const head = /^[A-Za-z_$][\w$]*/.exec(expr);
  if (!head) throw new Error(`bad pointer "${pointer}"`);
  let cur = mod[head[0]];
  if (cur === undefined) throw new Error(`${file} does not export "${head[0]}"`);
  let rest = expr.slice(head[0].length);
  while (rest.length) {
    let m;
    if ((m = /^\.([A-Za-z_$][\w$-]*)/.exec(rest))) { cur = cur == null ? undefined : cur[m[1]]; rest = rest.slice(m[0].length); }
    else if ((m = /^\[([^\]]*)\]/.exec(rest))) { cur = cur == null ? undefined : cur[JSON.parse(m[1])]; rest = rest.slice(m[0].length); }
    else if ((m = /^\(([^)]*)\)/.exec(rest))) {
      if (typeof cur !== 'function') throw new Error(`"${pointer}": not a function at "(${m[1]})"`);
      const args = m[1].trim() === '' ? [] : JSON.parse('[' + m[1] + ']');
      cur = cur(...args); rest = rest.slice(m[0].length);
    } else throw new Error(`bad pointer "${pointer}" near "${rest}"`);
    if (cur === undefined) throw new Error(`"${pointer}" resolves to undefined`);
  }
  return cur;
}
// Every value row with a code pointer must equal the code (× scale). Returns the
// mismatches as strings; empty = no drift.
function driftCheck(rules) {
  const problems = [];
  let checked = 0;
  for (const r of rules) {
    for (const v of r.values) {
      if (v.code == null) continue;
      let actual;
      try { actual = resolvePointer(String(v.code)); } catch (e) { problems.push(`${r.file} · ${v.when}: ${e.message}`); continue; }
      checked++;
      const scaled = typeof actual === 'number' ? actual * (v.scale || 1) : actual;
      const expected = v.value;
      const same = typeof expected === 'number' && typeof scaled === 'number'
        ? Math.abs(scaled - expected) <= 1e-9 * Math.max(1, Math.abs(expected))
        : String(scaled) === String(expected);
      if (!same) problems.push(`${r.file} · "${v.when}": rule says ${expected}${v.unit ? ' ' + v.unit : ''}, code (${v.code}${v.scale ? ' × ' + v.scale : ''}) says ${scaled}`);
    }
  }
  return { problems, checked };
}

// The public shape (rules.json): what the app and an AI read. Prose stays on the page.
function toJson(rules) {
  return rules.map((r) => ({
    id: r.id, trade: r.trade, kind: r.kind, status: r.status, title: r.title, summary: r.summary,
    values: r.values.map((v) => ({ when: v.when, value: v.value, unit: v.unit == null ? '' : String(v.unit), ...(v.note ? { note: v.note } : {}) })),
    source: { code: r.source.code, section: r.source.section, editions: r.source.editions || [], ...(r.source.url ? { url: r.source.url } : {}) },
    amendments: r.amendments || [],
    used_by: r.used_by,
    url: r.url,
    updated: r.updated,
  }));
}

module.exports = { CONTENT_DIR, TRADES, KINDS, STATUSES, parseYamlSubset, splitFrontMatter, loadRules, resolvePointer, driftCheck, toJson };
