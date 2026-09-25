#!/usr/bin/env node
/**
 * Lesson rules check (PERSONA-PLAN build item 7, 2026-09-25): a tour, lesson or course
 * step that teaches a number the rulebook holds names the rule, and says the rule's
 * number. The rulebook's own drift check (build:rules --check) keeps a rule equal to the
 * code; this keeps the teaching text equal to the rule, so a card, its rule and the app
 * cannot disagree without `npm run check` saying which.
 *
 * Static, no browser: the step files are parsed with espree (eslint's parser) and every
 * ObjectExpression carrying id + title + body is a step. Its text is the string literals,
 * template quasis and `+` concatenations in body / reveal / hint / progress (a function
 * contributes the strings inside it). A step may carry
 *   rules: ['plumb.hanger.pex', ...]   the rulebook ids (rules/rules.json) it teaches
 *   rulesExempt: '<why>'               it states a code section or number that is not a
 *                                      rulebook value (a section the rulebook has no entry
 *                                      for yet is the usual why: `--gaps` lists them)
 * and the check fails when
 *   (a) a rules id is not in rules/rules.json;
 *   (b) a sentence cites a code (IPC, UPC, NEC, IMC, SMACNA, NFPA 96, a §, a Table N, or
 *       a code family a rule's source names), or a clause states a number in a unit some
 *       rule carries AND (names that rule's subject: the words of its title, less the
 *       generic ones; or is a unit the rulebook gives that rule alone: WSFU, fps, gpm...;
 *       or is the number of a row the clause names: "duplex receptacles at 18 in"), and
 *       the step carries neither rules nor rulesExempt;
 *   (c) a step names a rule, and a clause that names the rule's subject or one of its
 *       rows' conditions ("a GFCI at a counter"), or states a number in a unit the
 *       rulebook gives only to this rule, states a number in one of the rule's units that
 *       none of the named rules holds in that unit (the rows the clause names, when it
 *       names some) nor states in a `when` condition ("1 in and smaller"). A decimal in
 *       the text may round the value ("0.91" for 0.906).
 * In (b) and (c) a clause that is only a value ("45%", "32 in horizontal") is read with
 * its label, the clause before it ("Conduit fill limit: 45%", "Hanger spacing for PEX,
 * 36 in"), and a value may be named by a short appositive after it ("44 in, the counter
 * height"). A clause that says more than its value is read on its own words, so a
 * derived reading ("9.5 ft per receptacle" after "the vertical") is not held to a rule.
 * The unit set is the rulebook's: each distinct unit in rules.json, spelled the ways a
 * card writes it (SPELLINGS; a unit with no entry matches its own literal text).
 *
 *   node scripts/check-lesson-rules.js           # the check (npm run check)
 *   node scripts/check-lesson-rules.js --gaps    # also list every rulesExempt, the
 *                                                # sections the rulebook does not hold yet
 *   node scripts/check-lesson-rules.js --trace   # also print every number (c) judged
 *   node scripts/check-lesson-rules.js --dump    # print each step's gathered text instead
 */
const fs = require('fs');
const path = require('path');
const espree = require('espree');

const ROOT = path.join(__dirname, '..');
const SOURCES = [
  'features/tutorial.js', 'features/tour-blank.js', 'features/lessons.js',
  'features/course-plumbing.js', 'features/course-electrical.js', 'features/course-hvac.js',
];
const TEXT_KEYS = ['body', 'reveal', 'hint', 'progress'];

// ===== parsing the step files ============================================================
function keyName(p) {
  if (!p || p.type !== 'Property' || p.computed) return null;
  if (p.key.type === 'Identifier') return p.key.name;
  if (p.key.type === 'Literal') return String(p.key.value);
  return null;
}
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  if (visit(node) === false) return;
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'range') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => walk(c, visit));
    else if (v && typeof v.type === 'string') walk(v, visit);
  }
}
const isStr = (n) => !!n && n.type === 'Literal' && typeof n.value === 'string';
const isConcat = (n) => !!n && n.type === 'BinaryExpression' && n.operator === '+';
const HOLE = ' … ';
// The text of a string-ish expression, a non-literal part standing as " … ".
function flat(n) {
  if (isStr(n)) return n.value;
  if (n.type === 'TemplateLiteral') return n.quasis.map((q) => q.value.cooked).join(HOLE);
  if (isConcat(n)) return flat(n.left) + flat(n.right);
  return HOLE;
}
// Every piece of literal text under `node`: each maximal string / template / concatenation
// is one piece, then the strings inside its holes (a template's ${a ? 'x' : 'y'}) are more.
// An identifier bound to a string constant in the same file reads through to it.
function textPieces(node, decls, seen = new Set()) {
  const out = [];
  walk(node, (n) => {
    if (isStr(n) || n.type === 'TemplateLiteral' || isConcat(n)) {
      out.push({ text: flat(n), line: n.loc.start.line });
      const holes = [];
      (function collect(m) {
        if (isStr(m)) return;
        if (m.type === 'TemplateLiteral') { holes.push(...m.expressions); return; }
        if (isConcat(m)) { collect(m.left); collect(m.right); return; }
        holes.push(m);
      })(n);
      holes.forEach((h) => out.push(...textPieces(h, decls, seen)));
      return false;
    }
    if (n.type === 'Identifier' && decls.has(n.name) && !seen.has(n.name)) {
      seen.add(n.name);
      out.push(...textPieces(decls.get(n.name), decls, seen));
    }
    return undefined;
  });
  return out;
}
function parseSteps(src, file) {
  const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'script', loc: true });
  const decls = new Map();
  walk(ast, (n) => {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init && !decls.has(n.id.name)
      && (isStr(n.init) || n.init.type === 'TemplateLiteral' || isConcat(n.init))) decls.set(n.id.name, n.init);
  });
  const steps = [];
  walk(ast, (n) => {
    if (n.type !== 'ObjectExpression') return;
    const m = new Map();
    for (const p of n.properties) { const k = keyName(p); if (k != null) m.set(k, p); }
    if (!(m.has('id') && m.has('title') && m.has('body'))) return;
    const idNode = m.get('id').value;
    const step = {
      file, line: m.get('id').loc.start.line,
      id: isStr(idNode) ? idNode.value : flat(idNode).trim(),
      rules: null, rulesLine: null, rulesExempt: null, pieces: [],
    };
    if (m.has('rules')) {
      const v = m.get('rules').value;
      step.rulesLine = m.get('rules').loc.start.line;
      step.rules = v.type === 'ArrayExpression' ? v.elements.map((e) => (isStr(e) ? e.value : null)) : [null];
    }
    if (m.has('rulesExempt')) {
      const v = m.get('rulesExempt').value;
      step.rulesExempt = isStr(v) ? v.value : '';
    }
    for (const k of TEXT_KEYS) {
      if (m.has(k)) step.pieces.push(...textPieces(m.get(k).value, decls).map((p) => ({ ...p, key: k })));
    }
    steps.push(step);
  });
  return steps;
}

// ===== sentences, clauses, numbers =======================================================
const ABBREV = /(?:\b(?:No|vs|e\.g|i\.e|approx|w\.g)\.)$/;   // "18 in." ends a sentence on a card
function sentences(text) {
  const out = [];
  for (const para of text.split(/\n+/)) {
    let start = 0;
    const re = /[.!?](?=\s+["“(]?[A-Z0-9[])/g;
    let m;
    while ((m = re.exec(para))) {
      const upto = para.slice(start, m.index + 1);
      if (ABBREV.test(upto)) continue;
      out.push(upto.trim());
      start = m.index + 1;
    }
    out.push(para.slice(start).trim());
  }
  return out.filter((s) => s && /[A-Za-z0-9]/.test(s));
}
const clauses = (s) => s.split(/[,;:()]|\s[–—-]\s/).map((c) => c.trim()).filter(Boolean);

const WORD_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
function wordsToDigits(s) {
  return s.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)\b/gi,
    (_, a, b) => String(WORD_NUM[a.toLowerCase()] + WORD_NUM[b.toLowerCase()]))
    .replace(new RegExp('\\b(' + Object.keys(WORD_NUM).join('|') + ')\\b', 'gi'), (w) => String(WORD_NUM[w.toLowerCase()]));
}
function parseNum(t) {
  const s = String(t).replace(/,/g, '').trim();
  let m;
  if ((m = /^(\d+)[- ](\d+)\/(\d+)$/.exec(s))) return +m[1] + m[2] / m[3];
  if ((m = /^(\d+)\/(\d+)$/.exec(s))) return m[1] / m[2];
  return /^\d*\.?\d+$/.test(s) ? Number(s) : NaN;
}

// How a card writes each rulebook unit. The KEY is the unit as rules.json spells it; a
// unit the rulebook adds with no entry here is matched by its own literal text.
const IN = '(?:in\\s+AFF\\b|in\\b(?!\\s+(?:the|a|an|each|every|this|that|these|those|its|their|your|all|both|any|one|two|three|four|[A-Z]{2,})\\b)|inch(?:es)?\\b|"|″)';
const SPELLINGS = {
  'in w.g. per 100 ft': '(?:in\\.?|"|″|inch(?:es)?)\\s*(?:w\\.?\\s?g\\.?\\s*|of water\\s*)?per 100\\s*(?:ft\\b|feet\\b|′|\')',
  'in w.g.': '(?:in\\.?|"|″|inch(?:es)?)\\s*(?:w\\.?\\s?g\\b\\.?|of water)|inches of water',
  'cfm/ft²': '(?:cfm|CFM)\\s*(?:\\/\\s*(?:ft²|sq\\.?\\s?ft)|per (?:square foot|sq\\.?\\s?ft))',
  'lb/ft²': '(?:lb|pounds?)\\s*(?:\\/\\s*(?:ft²|sq\\.?\\s?ft)|per (?:square foot|sq\\.?\\s?ft))',
  'Ω·cmil/ft': 'Ω·cmil\\/ft|ohm-circular-mils? per foot',
  fps: 'fps\\b|ft\\/s\\b|feet (?:per|a) second',
  fpm: 'fpm\\b|FPM\\b|feet (?:per|a) minute',
  gpm: 'gpm\\b|GPM\\b|gallons (?:per|a) minute',
  WSFU: 'WSFU\\b|(?:[Ww]ater supply )?fixture units?\\b',
  ga: 'ga\\b\\.?|gauge\\b|gage\\b',
  '%': '%|\\s?percent\\b',
  ft: '(?:ft\\b|feet\\b|foot\\b|′|\'(?![-\\w]))',
  in: IN + '(?:\\s*AFF\\b)?',   // "18 in AFF" (rules.json's own spelling), 18" AFF, 18 inches AFF
};
// Units the rulebook qualifies but a card writes plainly: compared as their base unit.
const BASE_UNIT = { 'in AFF': 'in' };
const baseUnit = (u) => BASE_UNIT[u] || u;
// Text that carries numbers and units but no quantity: a scale, a slope, a duct or wire size.
const NOT_QUANTITY = [
  /\d+(?:-\d+)?\/\d+"\s*=\s*1'(?:-0")?/g,          // 1/8" = 1'-0"
  /\d+(?:-\d+)?\/\d+"\s*per\s*(?:foot|ft)\b/g,        // 1/8" per foot (slope)
  /\b\d+\s*[x×]\s*\d+\b/g,                             // 24x12
  /#\d+(?:\/0)?/g,                                     // #12, #3/0
];
const NUM = '(?<![\\w#./-])(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+[- ]\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.\\d+|\\d+)';

function compileUnits(unitList) {
  // longest spelling first, so "in w.g. per 100 ft" wins over "in w.g." over "in"
  return unitList
    .map((u) => ({ unit: u, re: SPELLINGS[u] || u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }))
    .sort((a, b) => b.unit.length - a.unit.length);
}
// Feet-and-inches (12'-0", 6 ft 6 in) to one number of feet, then drop non-quantities.
function normalize(clause) {
  let s = wordsToDigits(clause);
  for (const re of NOT_QUANTITY) s = s.replace(re, ' ');
  s = s.replace(/(?<![\w#./-])(\d+)\s*(?:'|′|ft\b\.?|feet\b)\s*-?\s*(\d+(?:[- ]\d+\/\d+)?)\s*(?:"|″|in\b\.?|inches\b)/g,
    (_, f, i) => `${+f + parseNum(i) / 12} ft`);
  return s;
}
// Every number + unit in a clause: [{ value, unit, text, decimals }].
function quantities(clause, units) {
  const s = normalize(clause);
  const out = [];
  const re = new RegExp(NUM, 'g');
  let m;
  while ((m = re.exec(s))) {
    const after = s.slice(m.index + m[0].length);
    for (const u of units) {
      const tight = new RegExp('^(?:' + u.re + ')');
      const spaced = new RegExp('^\\s(?:' + u.re + ')');
      const hit = tight.exec(after) || spaced.exec(after);
      if (!hit) continue;
      if (!tight.test(after) && /^\s["″′']/.test(after)) continue;   // a quote mark sits on its number
      const dec = ((/\.(\d+)$/.exec(m[1].replace(/,/g, '')) || [])[1] || '').length;
      out.push({ value: parseNum(m[1]), unit: baseUnit(u.unit), text: (m[0] + hit[0]).trim(), decimals: dec });
      re.lastIndex = m.index + m[0].length + hit[0].length;   // "0.08" per 100 ft" is one quantity
      break;
    }
  }
  return out;
}

// ===== the rulebook side =================================================================
const STOP = new Set(('a an and as at by for from in into its of on or per the to with '
  + 'default minimum design size sizes sized pipe water duct type schedule inside sheet devices device '
  + 'tube gallons minute cast-iron copper pex pvc galvanized').split(' '));
const stem = (w) => w.toLowerCase().replace(/ies$/, 'y').replace(/(?<![su])s$/, '');
const WHEN_STOP = new Set('and the with per for larger smaller side when than more less into from each every nominal'.split(' '));
const whenWords = (when) => [...new Set(String(when || '').split(/[^A-Za-z]+/).filter((w) => w.length > 2)
  .map((w) => w.toLowerCase()).filter((w) => !WHEN_STOP.has(w) && !STOP.has(w)).map(stem))];
function subjectWords(rule) {
  return [...new Set(String(rule.title).split(/[^A-Za-z-]+/).filter(Boolean)
    .map((w) => w.toLowerCase()).filter((w) => !STOP.has(w) && w.length > 1).map(stem))];
}
const CODE_FAMILIES = ['IPC', 'UPC', 'NEC', 'IMC', 'IFGC', 'IECC', 'SMACNA', 'ASHRAE', 'NFPA 96'];
function citationRe(rules) {
  const fams = new Set(CODE_FAMILIES);
  for (const r of rules) for (const t of String((r.source && r.source.code) || '').split(/[^A-Za-z0-9]+/)) if (/^[A-Z]{3,}$/.test(t)) fams.add(t);
  return new RegExp('\\b(?:' + [...fams].map((f) => f.replace(/ /g, '\\s')).join('|') + ')\\b|§|\\bTable\\s\\d');
}
function buildIndex(rules) {
  const byId = new Map();
  const unitOwners = new Map();
  for (const r of rules) {
    // unit -> { rows: [{ value, words }], when: [numbers the conditions state in the unit] }
    const units = new Map();
    for (const v of r.values) {
      const u = v.unit == null ? '' : baseUnit(String(v.unit));
      const n = typeof v.value === 'number' ? v.value : parseNum(v.value);
      if (!u || !Number.isFinite(n)) continue;
      if (!units.has(u)) units.set(u, { rows: [], when: [] });
      units.get(u).rows.push({ value: n, words: whenWords(v.when) });
    }
    // "1 in and smaller": a card may state the condition as well as the value
    const unitList = compileUnits([...units.keys()]);
    for (const v of r.values) for (const q of quantities(String(v.when || ''), unitList)) units.get(q.unit).when.push(q.value);
    for (const u of units.keys()) unitOwners.set(u, (unitOwners.get(u) || new Set()).add(r.id));
    byId.set(r.id, { rule: r, units, subjects: subjectWords(r) });
  }
  const allUnits = compileUnits([...unitOwners.keys()]);
  // unit -> every row condition word of the rules carrying it ("horizontal" for in)
  const rowWords = new Map([...unitOwners.keys()].map((u) => [u, new Set([...unitOwners.get(u)]
    .flatMap((id) => byId.get(id).units.get(u).rows.flatMap((row) => row.words)))]));
  return { byId, unitOwners, allUnits, rowWords, citation: citationRe(rules) };
}
const hasWord = (clause, w) => new RegExp('\\b' + w.replace(/-/g, '[- ]?'), 'i').test(clause);
const namesSubject = (clause, subjects) => subjects.some((w) => hasWord(clause, w));
// The numbers a rule accepts in a unit for this clause: when the clause names a row's
// condition ("a public lavatory"), only the rows it names best; when it names none, the
// rows its label names ("Public lavatory: 2 WSFU"); else every row. The numbers its
// conditions state are always accepted.
function accepted(entry, unit, clause, label) {
  const u = entry.units.get(unit);
  const pick = (text) => {
    if (!text) return null;
    const scored = u.rows.map((row) => ({ row, score: row.words.filter((w) => hasWord(text, w)).length }));
    const best = Math.max(0, ...scored.map((x) => x.score));
    return best ? scored.filter((x) => x.score === best).map((x) => x.row.value) : null;
  };
  const rows = pick(clause) || pick(label) || u.rows.map((row) => row.value);
  return [...new Set(rows.concat(u.when))];
}
// A clause that is only a value ("45%", "32 in horizontal", "2 WSFU"): its quantities and,
// besides them, nothing but small words and the conditions of rows in the quantities' units
// ("9.5 ft per receptacle" says more: no feet rule has a receptacle row).
const BARE_STOP = new Set('a an the is are be of at to per each every about and or up down'.split(' '));
function isBare(clause, idx) {
  const qs = quantities(clause, idx.allUnits);
  if (!qs.length) return false;
  let rest = normalize(clause);
  for (const q of qs) rest = rest.replace(q.text, ' ');
  return rest.split(/[^A-Za-z]+/).filter(Boolean).map((w) => w.toLowerCase())
    .every((w) => BARE_STOP.has(w) || qs.some((q) => idx.rowWords.get(q.unit).has(stem(w))));
}
// The label a bare value clause answers: the nearest clause before it that is not a bare
// value itself ("Conduit fill limit: 45%", "Hanger spacing for PEX, 32 in, 10 ft").
// A clause that says more than its value has no label: its own words are its subject.
// A value may also be named after it, by a short appositive after a comma with no number
// of its own ("It arrives at 44 in, the counter height"; not "1.25in Copper (the hot supply)").
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function labelOf(cls, i, idx, sentence) {
  if (isBare(cls[i], idx)) {
    for (let j = i - 1; j >= 0; j--) if (!isBare(cls[j], idx)) return cls[j];
  }
  const next = cls[i + 1];
  if (next && /^the\s/i.test(next) && next.split(/\s+/).length <= 4 && !quantities(next, idx.allUnits).length
    && new RegExp(esc(cls[i]) + '\\s*,\\s*' + esc(next)).test(sentence)) return next;
  return null;
}
// A rule speaks to a number when its clause, or the label the clause answers, names the
// rule's subject or one of its rows' conditions ("a GFCI at a counter"), or when the
// rulebook gives the number's unit to this rule alone (WSFU, fps, gpm, fpm, CFM/sq ft).
const namesRow = (entry, unit, text) => !!text && entry.units.has(unit)
  && entry.units.get(unit).rows.some((row) => row.words.some((w) => hasWord(text, w)));
const speaksTo = (idx, entry, unit, clause, label) => namesSubject(clause, entry.subjects)
  || (!!label && namesSubject(label, entry.subjects))
  || namesRow(entry, unit, clause) || namesRow(entry, unit, label)
  || idx.unitOwners.get(unit).size === 1;
// A decimal may round the value to its own places, within 5% ("0.91" for 0.906, not "0.1" for 0.08).
function agrees(q, nums) {
  return nums.some((a) => Math.abs(a - q.value) <= 1e-9 * Math.max(1, Math.abs(a))
    || (q.decimals > 0 && Math.abs(Number(a.toFixed(q.decimals)) - q.value) < 1e-9 && Math.abs(a - q.value) <= 0.05 * Math.abs(a)));
}
const short = (s) => (s.length > 160 ? s.slice(0, 157) + '...' : s);

// ===== the check =========================================================================
// Returns [{ kind: 'a' | 'b' | 'c', msg }]. opts.trace(step, q, rules, ok) sees every number
// (c) judged, for --trace.
function checkSteps(steps, rules, opts = {}) {
  const idx = buildIndex(rules);
  const problems = [];
  const at = (step, line) => `${step.file}:${line} step '${step.id}'`;
  for (const step of steps) {
    // (a) every named id is a rule
    for (const id of step.rules || []) {
      if (typeof id !== 'string') problems.push({ kind: 'a', msg: `${at(step, step.rulesLine)}: rules must be a list of string ids` });
      else if (!idx.byId.has(id)) problems.push({ kind: 'a', msg: `${at(step, step.rulesLine)}: rules names '${id}', which is not in rules/rules.json` });
    }
    if (step.rules && !step.rules.length) problems.push({ kind: 'a', msg: `${at(step, step.rulesLine)}: rules is empty; name a rule or drop the key` });
    if (step.rulesExempt === '') problems.push({ kind: 'a', msg: `${at(step, step.line)}: rulesExempt must say why, as a string` });
    const named = (step.rules || []).filter((id) => idx.byId.has(id)).map((id) => idx.byId.get(id));
    const annotated = (step.rules && step.rules.length) || step.rulesExempt;
    const seen = new Set();
    for (const piece of step.pieces) {
      for (const sentence of sentences(piece.text)) {
        if (seen.has(sentence)) continue;
        seen.add(sentence);
        // (b) a citation, or a rule's number beside its subject, with nothing named
        if (!annotated) {
          const cite = idx.citation.exec(sentence);
          if (cite) {
            const sec = (/(?:Table\s)?[A-Z]?\d+(?:\.\d+)+(?:\([\w]+\))*/.exec(sentence.slice(cite.index)) || [])[0];
            const hint = sec ? rules.filter((r) => String(r.source.section).includes(sec.replace(/^Table\s/, ''))).map((r) => r.id) : [];
            problems.push({ kind: 'b', msg: `${at(step, piece.line)}: cites ${cite[0].trim()} with no rules (or rulesExempt): "${short(sentence)}"${hint.length ? ` (rule: ${hint.join(', ')})` : ''}` });
            continue;
          }
          const cls = clauses(sentence);
          for (let i = 0; i < cls.length; i++) {
            const clause = cls[i];
            const label = labelOf(cls, i, idx, sentence);
            const qs = quantities(clause, idx.allUnits);
            const hit = [];
            for (const q of qs) {
              for (const id of idx.unitOwners.get(q.unit) || []) {
                const e = idx.byId.get(id);
                // its subject, a unit it alone carries, or the number of the row the clause
                // names ("plain duplex receptacles at 18 in" is the duplex row's 18)
                const rowSays = () => (namesRow(e, q.unit, clause) || namesRow(e, q.unit, label))
                  && agrees(q, accepted(e, q.unit, clause, label).filter((v) => !e.units.get(q.unit).when.includes(v)));
                const says = namesSubject(clause, e.subjects) || (!!label && namesSubject(label, e.subjects))
                  || idx.unitOwners.get(q.unit).size === 1 || rowSays();
                if (says && !hit.includes(id)) hit.push(id);
              }
            }
            if (hit.length) {
              // name first the rules that hold the number said
              const holding = hit.filter((id) => qs.some((q) => idx.byId.get(id).units.has(q.unit) && agrees(q, accepted(idx.byId.get(id), q.unit, clause, label))));
              problems.push({ kind: 'b', msg: `${at(step, piece.line)}: states ${qs.map((q) => q.text).join(', ')} beside the subject of ${(holding.length ? holding : hit).join(', ')}, with no rules (or rulesExempt): "${short(sentence)}"` });
              break;
            }
          }
        }
        // (c) a named rule's number that is not the rule's
        if (named.length) {
          const cls = clauses(sentence);
          for (let i = 0; i < cls.length; i++) {
            const clause = cls[i];
            const label = labelOf(cls, i, idx, sentence);
            for (const q of quantities(clause, idx.allUnits)) {
              const holders = named.filter((n) => n.units.has(q.unit));
              const judges = holders.filter((n) => speaksTo(idx, n, q.unit, clause, label));
              if (!judges.length) continue;
              // judged by the rules whose subject is here, answered by any named rule in the unit
              // ("16 gauge" in a clause about the gauge table is the grease duct's 16)
              const ok = holders.some((n) => agrees(q, accepted(n, q.unit, clause, label)));
              if (opts.trace) opts.trace(step, q, holders.map((n) => n.rule.id), ok);
              if (ok) continue;
              const vals = [...new Set(holders.flatMap((n) => accepted(n, q.unit, clause, label)))].join(', ');
              problems.push({ kind: 'c', msg: `${at(step, piece.line)}: says ${q.text}, but ${holders.map((n) => n.rule.id).join(' / ')} holds ${vals} ${q.unit}: "${short(sentence)}"` });
            }
          }
        }
      }
    }
  }
  return problems;
}

// rules.json as published. Its values are the rule's own numbers in the rule's unit: where
// a row has a `scale` (scripts/lib/rules.js: code value × scale == value, the fill limit's
// 0.4 in code is 40 %), the value is already the scaled one, which is the number a card
// says, so the comparison is against rules.json and never the code's raw number.
function loadRulebook() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'rules', 'rules.json'), 'utf8')).rules;
}

function main() {
  const rules = loadRulebook();
  const steps = SOURCES.flatMap((f) => parseSteps(fs.readFileSync(path.join(ROOT, f), 'utf8'), f));
  const trace = process.argv.includes('--trace')
    ? (step, q, ids, ok) => console.log(`${ok ? 'agrees ' : 'DIFFERS'} ${step.file}:${step.line} ${step.id}: ${q.text} against ${ids.join(', ')}`)
    : null;
  const problems = checkSteps(steps, rules, { trace });
  const named = steps.filter((s) => s.rules && s.rules.length);
  const exempt = steps.filter((s) => s.rulesExempt);
  if (process.argv.includes('--gaps')) {
    for (const s of exempt) console.log(`${s.file}:${s.line} ${s.id}: ${s.rulesExempt}`);
  }
  if (problems.length) {
    console.error(`check-lesson-rules: ${problems.length} problem(s) in ${steps.length} steps:\n`);
    for (const p of problems) console.error(`  (${p.kind}) ${p.msg}`);
    console.error('\nA step that teaches a rulebook value names it: rules: [\'<id>\'] on the step (ids in rules/rules.json);'
      + '\na step that cites a section the rulebook does not hold yet says so: rulesExempt: \'<why>\'. See scripts/check-lesson-rules.js.');
    process.exit(1);
  }
  console.log(`check-lesson-rules: ${steps.length} steps, ${named.length} name rules, ${exempt.length} exempt. OK`);
}

module.exports = { SOURCES, parseSteps, sentences, clauses, quantities, compileUnits, buildIndex, checkSteps, loadRulebook, subjectWords };

if (require.main === module) {
  if (process.argv.includes('--dump')) {
    for (const f of SOURCES) {
      for (const s of parseSteps(fs.readFileSync(path.join(ROOT, f), 'utf8'), f)) {
        console.log(`\n## ${f}:${s.line} ${s.id}${s.rules ? ' rules=' + s.rules.join(',') : ''}`);
        for (const p of s.pieces) console.log(`  [${p.key}:${p.line}] ${p.text.replace(/\n/g, ' / ')}`);
      }
    }
  } else main();
}
