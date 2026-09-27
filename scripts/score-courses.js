#!/usr/bin/env node
/**
 * Course language score and first-use check (COURSE-LANGUAGE-2026-09-27, option C, wave 2).
 * The courses teach people who have never estimated, so their words are held the way
 * check-lesson-rules holds their numbers: a card that reads too hard, or uses a trade word
 * before the course has said what it means, fails `npm run check` and says where.
 *
 * Static, no browser: each file in COURSES is parsed with espree (eslint's parser). A
 * chapter is an ObjectExpression with id + title + steps (a tour's `const X_STEPS = [...]`
 * is one chapter named by its variable; steps outside both are the file's own chapter).
 * A card is an ObjectExpression with id + title + body inside it; its text is the string
 * literals, template quasis and `+` concatenations in body / reveal, and the chapter's
 * `done` is one more card (id `(done)`). A function contributes the strings inside it; a
 * `[[Control]]` chip reads as its label for the score. The generated compare card
 * (`body: compareBody`, a function of the takeoff) is not read: it has no literal text.
 *
 * The score, per course and chapter: cards, words, the Flesch-Kincaid grade, the average
 * sentence, the sentences over SENTENCE_CAP words, and the FIRST_USE terms first used
 * there. `--check` (npm run check) fails on
 *   (a) a sentence over SENTENCE_CAP (25) words in a card's body, reveal or done text;
 *   (b) a course whose whole-course grade is above GRADE_CEILING (6). A lower grade is fine;
 *   (c) a FIRST_USE term used in a chapter before the chapter that glosses it (unless
 *       EARLY lists that use: a known finding, printed by --gaps), a term whose defining
 *       chapter never uses it, or a stale EARLY row (a use that is no longer early);
 *   (d) a FIRST_USE term with no bold entry in the Learn guide's "Words the cards use"
 *       list (GLOSSARY), so the guide's list is the one list.
 * Term matching is whole word, case-insensitive, a trailing s / es allowed, over the text
 * the score reads with the `[[Control]]` chips taken out (a control's label is the name of
 * a button, not the trade word) and a Markdown link read as its words.
 *
 * Adding a file is one line in COURSES and its FIRST_USE block (the tours and lessons next).
 *
 *   node scripts/score-courses.js            # the per-chapter score
 *   node scripts/score-courses.js --check    # the check (npm run check, npm run check:courses)
 *   node scripts/score-courses.js --gaps     # the known early uses and the unglossed terms
 *   node scripts/score-courses.js --trace    # every judgement: each sentence's length, each
 *                                            # term use and its verdict, each glossary match
 */
const fs = require('fs');
const path = require('path');
const espree = require('espree');

const ROOT = path.join(__dirname, '..');

// One line per file the score reads.
const COURSES = [
  { name: 'plumbing', file: 'features/course-plumbing.js' },
  { name: 'electrical', file: 'features/course-electrical.js' },
  { name: 'hvac', file: 'features/course-hvac.js' },
];
const SENTENCE_CAP = 25;     // words in one sentence on a card
const GRADE_CEILING = 6;     // the whole course's Flesch-Kincaid grade (the memo holds 4 to 6)
const GLOSSARY = { file: 'content/guides/learning-the-app.md', heading: 'Words the cards use' };

// ===== the first-use table =================================================================
// Per course, the trade and app words it may use, each with the chapter id that glosses it
// (says what it means, in plain words, the first time). A term used in an earlier chapter
// fails. 'guide' means the course never glosses it and leans on the Learn guide's list: it
// never fails, and --gaps lists it as a finding. Every term here must have an entry in the
// guide's "Words the cards use".
const FIRST_USE = {
  plumbing: {
    // Chapter 0, Before you count
    'set': 'before', 'sheet': 'before', 'floor plan': 'before', 'title block': 'before', 'fixture': 'before',
    'water closet': 'before', 'estimator': 'before', 'bid': 'before', 'takeoff': 'before', 'count': 'before',
    'trace': 'before', 'chain': 'before', 'check': 'before', 'counter': 'before', 'armed': 'before', 'mark': 'before',
    'line type': 'before', 'bid check': 'before', 'scale': 'before', 'sidebar': 'before', 'summary': 'before',
    'header': 'before', 'footer': 'before', 'layer': 'before',
    // Chapter 1, the sheet
    'legend': 'sheet', 'discipline': 'sheet', 'mechanical': 'sheet', 'hot water return': 'sheet', 'sanitary': 'sheet',
    'grease waste': 'sheet', 'scale bar': 'sheet', 'dimension': 'sheet', 'keynote': 'sheet', 'tag': 'sheet',
    'hose bibb': 'sheet', 'fixture schedule': 'sheet', 'schedule': 'sheet', 'highlight': 'sheet', 'supply': 'sheet',
    'waste': 'sheet', 'vent': 'sheet', 'WSFU': 'sheet', 'DFU': 'sheet', 'fixture unit': 'sheet', 'IPC': 'sheet',
    'building sewer': 'sheet', 'slope': 'sheet', 'RFI': 'sheet',
    // Chapter 2, the fixtures
    'wet wall': 'fixtures', 'vent stack': 'fixtures', 'VTR': 'fixtures', 'branch': 'fixtures', 'lavatory': 'fixtures',
    'mop sink': 'fixtures', 'hand sink': 'sheet', 'cook line': 'fixtures', 'range': 'fixtures',
    '3-compartment sink': 'fixtures', 'dish pit': 'fixtures', 'FDA Food Code': 'fixtures', 'floor sink': 'fixtures',
    'indirect waste': 'fixtures', 'air gap': 'fixtures', 'typical': 'fixtures', 'trap': 'fixtures',
    'trap primer': 'fixtures', 'child count': 'fixtures', 'quick key': 'fixtures', 'status bar': 'fixtures',
    // Chapter 3, water
    'main': 'water', 'service': 'water', 'RPZ': 'water', 'backflow preventer': 'water', 'siphon': 'water',
    'trunk': 'water', 'hanger': 'water', 'general notes': 'water', 'water heater': 'water', 'HWR': 'water',
    'check valve': 'water', 'balancing valve': 'water', 'slab': 'sheet', 'riser': 'water', 'chip': 'water',
    'fitting': 'water', 'elbow': 'water',
    // Chapter 4, waste and vent
    'cleanout': 'waste', 'interceptor': 'waste', 'trench': 'waste', 'PVC': 'waste', 'DWV': 'waste', 'snake': 'waste',
    'terminal': 'waste',
    // Chapter 5, the riser
    'riser diagram': 'riser', 'trap arm': 'riser', 'building drain': 'riser', 'vertical': 'riser',
    // Chapter 6, gas
    'drop': 'gas', 'IFGC': 'gas', 'load': 'gas', 'BTU': 'gas', 'black iron': 'gas', 'threaded': 'gas', 'hood': 'gas',
    'suppression': 'gas', 'NFPA 96': 'gas', 'GC': 'gas',
    // Chapter 7, the enlarged plan and the typical
    'enlarged plan': 'gas', 'clearance': 'details', 'scale zone': 'details', 'multiply zone': 'details',
    // Chapter 8 and 9
    'foreman': 'whole', 'flue': 'bid', 'change order': 'bid', 'hand off': 'bid', 'PipeTooling': 'bid',
    // used, never glossed on a card
    'engineer': 'before', 'rulebook': 'gas', 'reference': 'whole',
  },
  electrical: {
    // Chapter 0, Before you count
    'set': 'before', 'sheet': 'before', 'floor plan': 'before', 'schedule': 'before', 'one-line': 'before',
    'engineer': 'before', 'estimator': 'before', 'bid': 'before', 'takeoff': 'before', 'count': 'before', 'scale': 'before', 'quick key': 'before',
    'trace': 'before', 'chain': 'before', 'check': 'before', 'counter': 'before', 'mark': 'before', 'run': 'before',
    'line type': 'before', 'bid check': 'before', 'sidebar': 'before', 'header': 'before', 'status bar': 'before',
    'summary': 'before',
    // Chapter 1, the E-sheets
    'title block': 'sheet', 'receptacle': 'sheet', 'hard-wired': 'sheet', 'panel': 'sheet', 'breaker': 'sheet',
    'circuit': 'sheet', 'service': 'sheet', 'panel schedule': 'sheet', 'load': 'sheet',
    'dimension': 'sheet', 'homerun': 'sheet', 'conduit': 'sheet', 'tag': 'sheet', 'mount height': 'sheet',
    'working space': 'sheet', 'NEC': 'sheet', 'change order': 'sheet', 'pole': 'sheet', 'VA': 'sheet', 'volt': 'sheet',
    'amp': 'sheet', 'conductor': 'sheet', 'ampacity': 'sheet', 'phase': 'sheet', 'neutral': 'sheet',
    // Chapter 2, devices
    'GFCI': 'devices', 'GFI': 'devices', 'dish pit': 'devices', 'RFI': 'devices', 'GC': 'devices',
    'duplex': 'devices', 'ADA': 'devices', 'rulebook': 'devices', 'vertical': 'devices', 'make-up': 'devices',
    'J-box': 'devices', 'junction box': 'devices',
    // Chapter 3, lighting
    'fixture schedule': 'lighting', 'armed': 'lighting', 'IBC': 'lighting', 'occupancy sensor': 'lighting',
    'IECC': 'lighting',
    // Chapter 4, conduit
    'keynote': 'conduit', 'raceway': 'conduit', 'ground': 'conduit', 'THHN': 'conduit', 'EMT': 'conduit',
    'gauge': 'conduit', 'gear': 'conduit', 'drop': 'conduit', 'fill': 'conduit', 'chip': 'conduit', 'strap': 'conduit',
    'child count': 'conduit',
    // Chapter 5, the circuit
    'group': 'circuits', 'voltage drop': 'circuits', 'branch circuit': 'circuits',
    // Chapter 6, the equipment
    'three phase': 'equipment', 'RTU': 'equipment', 'rooftop unit': 'equipment', 'disconnect': 'equipment',
    'shunt trip': 'equipment', 'hood': 'equipment', 'cook line': 'equipment', 'interlocked': 'equipment',
    'suppression': 'equipment', 'NFPA 96': 'equipment', 'dedicated circuit': 'equipment', 'callback': 'equipment',
    'cord-and-plug': 'equipment',
    // Chapter 7, the service
    'utility transformer': 'service', 'service lateral': 'service', 'meter': 'service', 'main disconnect': 'service',
    'feeder': 'service', 'terminal': 'service', 'equipment ground': 'service',
    'grounding electrode conductor': 'service', 'kVA': 'service', 'MDP': 'service',
    // Chapter 8 and 9
    'reference': 'whole', 'legend': 'whole', 'HVAC': 'bid', 'exclusion': 'bid', 'temporary power': 'bid',
    'pull point': 'bid',
  },
  hvac: {
    // Chapter 0, Before you count
    'set': 'before', 'sheet': 'before', 'mechanical': 'before', 'HVAC': 'before', 'engineer': 'before',
    'schedule': 'before', 'section': 'before', 'title block': 'before', 'scale': 'before', 'legend': 'before',
    'keynote': 'before', 'estimator': 'before', 'duct': 'before', 'takeoff': 'before', 'bid': 'before',
    'count': 'before', 'trace': 'before', 'check': 'before', 'counter': 'before', 'bid check': 'before',
    'header': 'before', 'sidebar': 'before', 'footer': 'before', 'summary': 'before',
    // Chapter 1, the M-sheets
    'supply': 'sheet', 'return': 'sheet', 'exhaust': 'sheet', 'grille': 'sheet', 'RTU': 'sheet',
    'rooftop unit': 'sheet', 'curb': 'sheet', 'exhaust fan': 'sheet', 'MAU': 'sheet', 'hood': 'sheet',
    'make-up air': 'sheet', 'roof key': 'sheet', 'leader': 'sheet', 'CFM': 'sheet', 'dimension': 'sheet',
    'ton': 'sheet', 'static pressure': 'sheet', 'tempered': 'sheet', 'register': 'sheet', 'interlocked': 'sheet',
    'positive': 'sheet', 'IMC': 'sheet',
    // Chapter 2, the rooms
    'rule of thumb': 'rooms', 'load': 'rooms', 'ventilation': 'before', 'ASHRAE': 'rooms', 'design-build': 'rooms',
    'diffuser': 'rooms', 'deck': 'rooms', 'deck height': 'rooms', 'main': 'rooms', 'trunk': 'rooms',
    'flex': 'rooms', 'conduit': 'rooms', 'plenum': 'rooms', 'wrap': 'rooms', 'hanger': 'rooms',
    // Chapter 3, the diffusers
    'tag': 'sheet', 'armed': 'diffusers', 'dish pit': 'diffusers', 'lay-in': 'diffusers', 'neck': 'diffusers',
    'velocity': 'diffusers', 'fpm': 'diffusers', 'tap': 'diffusers', 'branch': 'diffusers',
    // Chapter 4, the system
    'ESP': 'system', 'gear': 'system', 'group': 'system', 'capacity': 'system', 'run': 'system',
    'callback': 'system', 'addendum': 'system',
    // Chapter 5, the main
    'drop': 'main', 'liner': 'main', 'chip': 'main', 'transition': 'main', 'fitting': 'main', 'friction rate': 'main',
    'ductulator': 'main', 'gauge': 'main', 'volume damper': 'main', 'stray': 'main', 'elbow': 'main',
    'SMACNA': 'main', 'seam and waste': 'main', 'bid weight': 'main',
    // Chapter 6, the plenum
    'equivalent feet': 'plenum', 'inches of water': 'plenum', 'balancing report': 'plenum', 'rulebook': 'plenum',
    // Chapter 7, exhaust
    'galvanized': 'exhaust', 'black steel': 'exhaust', 'grease duct': 'exhaust', 'cleanout': 'exhaust',
    'NFPA 96': 'exhaust', 'combustibles': 'exhaust', 'listed enclosure': 'exhaust', 'rated wall': 'exhaust',
    'fire damper': 'exhaust', 'UL': 'exhaust', 'fusible link': 'exhaust', 'sleeve': 'exhaust',
    'penetration': 'exhaust', 'combustion air': 'exhaust', 'controls': 'exhaust', 'negative': 'exhaust',
    'RFI': 'exhaust',
    // Chapter 8 and 9
    'reference': 'whole', 'OA': 'bid', 'stat': 'bid', 'GC': 'bid', 'Tooling': 'bid',
    // used, never glossed on a card
    'mark': 'bid',
  },
};
// Known early uses: [course, term, chapter] where the course uses the term before the
// chapter that glosses it. Findings for the next course pass, not fixed by this check; a
// row that no longer matches an early use fails as stale, so the list only shrinks.
const EARLY = [
  ['hvac', 'run', 'before'],                 // "Measure what is run", and "when it runs short of room"
  ['hvac', 'run', 'sheet'],                  // the verb, several times; the noun is glossed in Chapter 4
  ['hvac', 'run', 'rooms'],
  ['hvac', 'run', 'diffusers'],
];

// ===== parsing the course files ============================================================
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
function flat(n) {
  if (isStr(n)) return n.value;
  if (n.type === 'TemplateLiteral') return n.quasis.map((q) => q.value.cooked).join(HOLE);
  if (isConcat(n)) return flat(n.left) + flat(n.right);
  return HOLE;
}
// Every piece of literal text under `node`: each maximal string / template / concatenation
// is one piece (with its line), then the strings inside its holes are more pieces. A
// conditional's two branches are two pieces, so a sentence never runs across them.
function textPieces(node) {
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
      holes.forEach((h) => out.push(...textPieces(h)));
      return false;
    }
    return undefined;
  });
  return out.filter((p) => /[A-Za-z]/.test(p.text));
}
function propsOf(n) {
  const m = new Map();
  for (const p of n.properties) { const k = keyName(p); if (k != null) m.set(k, p); }
  return m;
}
const strOf = (n) => (isStr(n) ? n.value : flat(n).trim());
const CARD_KEYS = ['body', 'reveal'];

// The chapters of one file, in order: { id, title, line, cards: [{ id, line, pieces }] }.
// A piece is { key, text, line }.
function parseCourse(src, file) {
  const ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'script', loc: true });
  const chapters = [];
  const own = { id: '(file)', title: file, line: 1, cards: [] };
  (function visit(node, chapter) {
    walk(node, (n) => {
      if (n !== node && n.type === 'ObjectExpression') {
        const m = propsOf(n);
        if (m.has('id') && m.has('title') && m.has('steps')) {
          const ch = { id: strOf(m.get('id').value), title: strOf(m.get('title').value), line: n.loc.start.line, cards: [] };
          chapters.push(ch);
          visit(m.get('steps').value, ch);
          if (m.has('done')) {
            const pieces = textPieces(m.get('done').value).map((p) => ({ ...p, key: 'done' }));
            ch.cards.push({ id: '(done)', line: m.get('done').loc.start.line, pieces });
          }
          return false;
        }
        if (m.has('id') && m.has('title') && m.has('body')) {
          const card = { id: strOf(m.get('id').value), line: m.get('id').loc.start.line, pieces: [] };
          for (const k of CARD_KEYS) {
            if (m.has(k)) card.pieces.push(...textPieces(m.get(k).value).map((p) => ({ ...p, key: k })));
          }
          (chapter || own).cards.push(card);
          return false;
        }
      }
      if (n !== node && n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && /STEPS$/.test(n.id.name)
        && n.init && n.init.type === 'ArrayExpression') {
        const ch = { id: n.id.name, title: n.id.name, line: n.loc.start.line, cards: [] };
        chapters.push(ch);
        visit(n.init, ch);
        return false;
      }
      return undefined;
    });
  })(ast, null);
  if (own.cards.length) chapters.unshift(own);
  return chapters.filter((ch) => ch.cards.length);
}

// ===== reading the text ====================================================================
// For the score a chip reads as its label and a link as its words.
const scoreText = (t) => t.replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
// For the terms a chip is taken out: it names a button, not the trade word.
const termText = (t) => t.replace(/\[\[[^\]]+\]\]/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

// A sentence ends at . ! or ? before a capital, a digit, a quote or a bracket, and at every
// line break. "TYP. is" does not end one; an abbreviation before a capital does not either.
const ABBREV = /(?:^|\s)(?:No|vs|e\.g|i\.e|approx|w\.g|TYP|Typ|St|Mr|Dr)\.$/;
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
  return out.filter((s) => words(s).length);
}
// A word is a run between spaces that holds a letter or a digit ("1." on a step line is not
// one; it is the renderer's number).
function words(s) {
  return s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w) && !/^\d+\.$/.test(w));
}
function syllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}
// Totals for a body of text. Only words with a letter carry syllables (a number is read, not
// spelled), the way the memo's score counted.
function tally(text) {
  const sents = sentences(text);
  const ws = sents.flatMap(words);
  const lettered = ws.filter((w) => /[A-Za-z]/.test(w));
  return { sentences: sents.length, words: ws.length, lettered: lettered.length, syllables: lettered.reduce((a, w) => a + syllables(w), 0) };
}
function addTally(a, b) {
  return { sentences: a.sentences + b.sentences, words: a.words + b.words, lettered: a.lettered + b.lettered, syllables: a.syllables + b.syllables };
}
const ZERO = { sentences: 0, words: 0, lettered: 0, syllables: 0 };
// Flesch-Kincaid grade: 0.39 (words / sentences) + 11.8 (syllables / words) - 15.59.
function grade(t) {
  if (!t.sentences || !t.lettered) return 0;
  return 0.39 * (t.lettered / t.sentences) + 11.8 * (t.syllables / t.lettered) - 15.59;
}
const round1 = (x) => Math.round(x * 10) / 10;

// ===== terms ===============================================================================
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole word: a hyphen joins words, so "ground" is not in "ground-fault"; a space in the
// term matches a space or a hyphen ("three phase", "three-phase"); a plural s / es, and
// ies for a term in y ("lavatories"), count as the term.
function termRe(term) {
  let body = escRe(term).replace(/\s+/g, '[\\s-]+');
  body = /[^aeiou]y$/i.test(term) ? body.slice(0, -1) + '(?:y|ies)' : body + '(?:e?s)?';
  return new RegExp('(?<![A-Za-z0-9-])' + body + '(?![A-Za-z0-9]|-[A-Za-z])', 'i');
}

// ===== the glossary ========================================================================
// The bold terms of the list under the GLOSSARY heading, to the next ## or ### heading
// (#### group headings stay inside it). A term is the bold text of a list item less its
// trailing period and a leading a / an / the (or a leading "/"); a parenthesis holds more
// names, comma-separated: "WSFU (water supply fixture units)" is two names, "Header" one.
function glossaryTerms(md, heading = GLOSSARY.heading) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^#{2,3}\s/.test(l) && l.replace(/^#+\s*/, '').trim() === heading);
  if (start < 0) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) break;
    const m = /^\s*[-*]\s+\*\*([^*]+)\*\*/.exec(lines[i]);
    if (!m) continue;
    const bold = m[1].trim().replace(/[.:]$/, '').trim();
    const names = [];
    const paren = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(bold);
    if (paren) names.push(paren[1], ...paren[2].split(/,\s*/)); else names.push(bold);
    out.push({ bold, line: i + 1, names: names.map(glossName).filter(Boolean) });
  }
  return out;
}
function glossName(n) {
  return n.trim().replace(/^[^A-Za-z0-9§]+/, '').replace(/^(?:a|an|the)\s+/i, '').toLowerCase();
}
function inGlossary(entries, term) {
  const t = glossName(term);
  return entries.find((e) => e.names.includes(t)) || null;
}

// ===== scoring and checking ================================================================
function scoreCourse(course, chapters, table = {}) {
  const seen = new Set();
  let all = ZERO;
  const rows = chapters.map((ch) => {
    let t = ZERO;
    const long = [];
    for (const card of ch.cards) {
      for (const p of card.pieces) {
        const text = scoreText(p.text);
        t = addTally(t, tally(text));
        for (const s of sentences(text)) {
          const n = words(s).length;
          if (n > SENTENCE_CAP) long.push({ card: card.id, line: p.line, key: p.key, words: n, sentence: s });
        }
      }
    }
    all = addTally(all, t);
    const firsts = [];
    const text = ch.cards.flatMap((c) => c.pieces.map((p) => termText(p.text))).join('\n');
    for (const term of Object.keys(table)) {
      if (!seen.has(term) && termRe(term).test(text)) { seen.add(term); firsts.push(term); }
    }
    return { chapter: ch.id, title: ch.title, cards: ch.cards.length, words: t.words, sentences: t.sentences, grade: round1(grade(t)), avg: round1(t.sentences ? t.words / t.sentences : 0), long, firsts };
  });
  return { course, rows, all: { words: all.words, sentences: all.sentences, grade: round1(grade(all)), avg: round1(all.sentences ? all.words / all.sentences : 0), long: rows.reduce((a, r) => a + r.long.length, 0) } };
}

// Every use of each term, chapter by chapter: [{ term, chapter, index, card, line }] (the
// first use in each card).
function termUses(chapters, terms) {
  const uses = [];
  chapters.forEach((ch, index) => {
    for (const card of ch.cards) {
      for (const term of terms) {
        const re = termRe(term);
        const p = card.pieces.find((pc) => re.test(termText(pc.text)));
        if (p) uses.push({ term, chapter: ch.id, index, card: card.id, line: p.line });
      }
    }
  });
  return uses;
}

// The whole check for one course. `glossary` is glossaryTerms()'s list (null: none found).
// Returns { score, problems: [{ kind, msg }], early: [...], unglossed: [...] }.
function checkCourse({ course, file, chapters, table, early = [], glossary, trace }) {
  const problems = [];
  const at = (ch, card, line) => `${file}:${line} ${ch}/${card}`;
  // (a) the sentence cap
  const score = scoreCourse(course, chapters, table);
  for (const r of score.rows) {
    for (const l of r.long) problems.push({ kind: 'a', msg: `${at(r.chapter, l.card, l.line)} (${l.key}): ${l.words} words, over ${SENTENCE_CAP}: "${l.sentence}"` });
  }
  if (trace) {
    for (const ch of chapters) for (const card of ch.cards) for (const p of card.pieces) {
      for (const s of sentences(scoreText(p.text))) trace(`${words(s).length > SENTENCE_CAP ? 'LONG   ' : 'ok     '} ${at(ch.id, card.id, p.line)}: ${words(s).length} words`);
    }
  }
  // (b) the grade ceiling
  if (trace) trace(`${score.all.grade > GRADE_CEILING ? 'HARD   ' : 'ok     '} ${course}: grade ${score.all.grade} (ceiling ${GRADE_CEILING})`);
  if (score.all.grade > GRADE_CEILING) problems.push({ kind: 'b', msg: `${course} (${file}): reads at grade ${score.all.grade}, above ${GRADE_CEILING}` });
  // (c) first use
  const ids = chapters.map((ch) => ch.id);
  const terms = Object.keys(table);
  const uses = termUses(chapters, terms);
  const allowed = early.filter((e) => e[0] === course);
  const usedAllowance = new Set();
  const earlyFound = [];
  const unglossed = [];
  for (const term of terms) {
    const def = table[term];
    const mine = uses.filter((u) => u.term === term);
    if (def === 'guide') {
      unglossed.push({ term, uses: mine });
      if (trace) trace(`guide   ${course}: "${term}" is glossed by the guide only (${mine.length} cards)`);
      continue;
    }
    const di = ids.indexOf(def);
    if (di < 0) { problems.push({ kind: 'c', msg: `${file}: FIRST_USE.${course}["${term}"] names chapter "${def}", which the course does not have (${ids.join(', ')})` }); continue; }
    if (!mine.some((u) => u.index === di)) problems.push({ kind: 'c', msg: `${file}: FIRST_USE.${course}["${term}"] says chapter "${def}" glosses it, and that chapter never uses it` });
    for (const u of mine) {
      if (u.index >= di) { if (trace) trace(`ok      ${at(u.chapter, u.card, u.line)}: "${term}" (glossed in ${def})`); continue; }
      if (allowed.some((e) => e[1] === term && e[2] === u.chapter)) {
        usedAllowance.add(`${term}@${u.chapter}`);
        earlyFound.push(u);
        if (trace) trace(`early   ${at(u.chapter, u.card, u.line)}: "${term}" before ${def} (EARLY)`);
        continue;
      }
      if (trace) trace(`EARLY   ${at(u.chapter, u.card, u.line)}: "${term}" before ${def}`);
      problems.push({ kind: 'c', msg: `${at(u.chapter, u.card, u.line)}: uses "${term}" before chapter "${def}" glosses it` });
    }
  }
  for (const e of allowed) {
    if (!usedAllowance.has(`${e[1]}@${e[2]}`)) problems.push({ kind: 'c', msg: `${file}: EARLY row [${e.map((x) => `'${x}'`).join(', ')}] is stale: "${e[1]}" is no longer used in "${e[2]}" before its gloss. Delete the row` });
  }
  // (d) the glossary
  if (!glossary) problems.push({ kind: 'd', msg: `${GLOSSARY.file}: no "${GLOSSARY.heading}" section` });
  else {
    for (const term of terms) {
      const hit = inGlossary(glossary, term);
      if (trace) trace(`${hit ? 'listed ' : 'MISSING'} ${course}: "${term}"${hit ? ` as **${hit.bold}** (line ${hit.line})` : ''}`);
      if (!hit) problems.push({ kind: 'd', msg: `${GLOSSARY.file}: "${term}" (FIRST_USE.${course}) has no bold entry under "${GLOSSARY.heading}"` });
    }
  }
  return { score, problems, early: earlyFound, unglossed };
}

function loadCourse(c) {
  return parseCourse(fs.readFileSync(path.join(ROOT, c.file), 'utf8'), c.file);
}
function loadGlossary() {
  return glossaryTerms(fs.readFileSync(path.join(ROOT, GLOSSARY.file), 'utf8'));
}

function printScore(score) {
  const a = score.all;
  console.log(`== ${score.course}: ${a.words} words, grade ${a.grade}, avg sentence ${a.avg}, ${a.long} sentences over ${SENTENCE_CAP} words`);
  for (const r of score.rows) {
    console.log(`  ${r.chapter.padEnd(10)} cards ${String(r.cards).padStart(2)}  words ${String(r.words).padStart(5)}  grade ${String(r.grade).padStart(4)}  avg ${String(r.avg).padStart(4)}  long ${String(r.long.length).padStart(2)}  new: ${r.firsts.join(', ')}`);
  }
}

function main(argv) {
  const check = argv.includes('--check');
  const gaps = argv.includes('--gaps');
  const trace = argv.includes('--trace') ? (s) => console.log(s) : null;
  const glossary = loadGlossary();
  const problems = [];
  let earlyCount = 0;
  let guideCount = 0;
  let termCount = 0;
  for (const c of COURSES) {
    const chapters = loadCourse(c);
    const table = FIRST_USE[c.name] || {};
    termCount += Object.keys(table).length;
    const res = checkCourse({ course: c.name, file: c.file, chapters, table, early: EARLY, glossary, trace });
    if (!check || trace) printScore(res.score);
    problems.push(...res.problems);
    earlyCount += res.early.length;
    guideCount += res.unglossed.length;
    if (gaps) {
      for (const u of res.early) console.log(`early   ${c.file}:${u.line} ${u.chapter}/${u.card}: "${u.term}" before chapter "${table[u.term]}" glosses it`);
      for (const g of res.unglossed) console.log(`guide   ${c.name}: "${g.term}" is never glossed on a card (${g.uses.length} cards use it; the guide's list is its gloss)`);
    }
  }
  if (problems.length) {
    const out = check ? console.error : console.log;
    out(`\nscore-courses: ${problems.length} problem(s):\n`);
    for (const p of problems) out(`  (${p.kind}) ${p.msg}`);
    out(`\nA card sentence runs to ${SENTENCE_CAP} words and a course reads at grade ${GRADE_CEILING} or under; a trade or app word is glossed`
      + '\nin or before the first chapter that uses it (FIRST_USE, EARLY) and listed in the Learn guide\'s "Words the cards use".'
      + '\nSee scripts/score-courses.js.');
    if (check) process.exit(1);
    return;
  }
  const summary = `score-courses: ${COURSES.length} courses, ${termCount} first-use terms, ${earlyCount} known early uses, ${guideCount} glossed by the guide only.`;
  console.log(check ? `${summary} OK` : `\n${summary}`);
}

module.exports = {
  COURSES, FIRST_USE, EARLY, SENTENCE_CAP, GRADE_CEILING, GLOSSARY,
  parseCourse, sentences, words, syllables, tally, grade, termRe, termText, scoreText,
  glossaryTerms, inGlossary, scoreCourse, termUses, checkCourse,
};

if (require.main === module) main(process.argv.slice(2));
