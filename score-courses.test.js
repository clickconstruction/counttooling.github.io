// Node unit tests (node --test, in `npm run check` / CI) for scripts/score-courses.js, the
// course language score and first-use check (COURSE-LANGUAGE-2026-09-27, wave 2). The parser,
// the 25-word sentence cap, the grade ceiling, the first-use rule and the glossary match each
// fail on a crafted fixture and pass once it is fixed. No browser and no app files: the
// fixtures below are the whole input.
const { test } = require('node:test');
const assert = require('node:assert');
const {
  parseCourse, chaptersFor, sentences, words, termRe, glossaryTerms, inGlossary, checkCourse, scoreCourse,
  SENTENCE_CAP, GRADE_CEILING,
} = require('./scripts/score-courses');

// A two-chapter course in the course files' shape.
function course(ch0Body, ch1Body, extra = '') {
  return `(function () {
  const CHAPTERS = [
    { id: 'before', title: 'Chapter 0: Before you count', steps: [
      { id: 'set', title: 'A set', kind: 'read', body: ${JSON.stringify(ch0Body)} },
    ], done: 'Next: Chapter 1.' },
    { id: 'sheet', title: 'Chapter 1: Read the sheet', steps: [
      { id: 'what', title: 'What', kind: 'read', body: ${JSON.stringify(ch1Body)}, reveal: 'The answer.' },
      ${extra}
    ], done: 'The sheet, read.' },
  ];
})();`;
}
const GLOSSARY_MD = [
  '## How a lesson works', '', '- **Takeoff.** Not in the section.', '',
  '### Words the cards use', '', 'Every word, in one list.', '',
  '#### The set and the sheet', '',
  '- **Set.** All the drawings for one job.',
  '- **Legend.** The key to the symbols.',
  '#### The estimator\'s words', '',
  '- **RFI (request for information).** A written question.',
  '- **Tooling (PipeTooling, TakeoffTooling).** The pricing apps.',
  '- **The line beside Show me where.** The card\'s last line.',
  '', '## Start with your trade', '', '- **Keynote.** After the section.',
].join('\n');
const glossary = glossaryTerms(GLOSSARY_MD);
const run = (src, table, early = []) => checkCourse({
  course: 'fixture', file: 'fixture.js', chapters: parseCourse(src, 'fixture.js'), table, early, glossary,
});
const kinds = (res) => res.problems.map((p) => p.kind).join('');

test('the parser finds chapters, cards, reveals, the chapter done and function bodies', () => {
  const chapters = parseCourse(course('A set is all the drawings.', 'Read the [[Legend]] here.',
    `{ id: 'prove', title: 'Prove it', kind: 'do', body: () => (ok() ? v() + ': the scale is right.' : 'Measure the string.') },
      { id: 'compare', title: 'Against the reference', kind: 'read', body: compareBody }`), 'f.js');
  assert.deepStrictEqual(chapters.map((c) => c.id), ['before', 'sheet']);
  assert.deepStrictEqual(chapters[1].cards.map((c) => c.id), ['what', 'prove', 'compare', '(done)']);
  const what = chapters[1].cards[0];
  assert.deepStrictEqual(what.pieces.map((p) => p.key), ['body', 'reveal']);
  // a conditional's branches are separate pieces; a generated body has no literal text
  assert.deepStrictEqual(chapters[1].cards[1].pieces.map((p) => p.text.trim()), ['… : the scale is right.', 'Measure the string.']);
  assert.deepStrictEqual(chapters[1].cards[2].pieces, []);
  assert.strictEqual(chapters[1].cards[3].pieces[0].text, 'The sheet, read.');
  // a tour's `const X_STEPS = [...]` is one chapter
  const tour = parseCourse("const PLUMBING_STEPS = [{ id: 'a', title: 'A', body: 'One.' }, { id: 'b', title: 'B', body: 'Two.' }];", 't.js');
  assert.deepStrictEqual(tour.map((c) => [c.id, c.cards.length]), [['PLUMBING_STEPS', 2]]);
});

test('a shared step constant is read in place, and an entry can cut chapters and read card by card', () => {
  const src = `
    const SCALE_STEP = { id: 'scale', title: 'Scale', body: 'The scale sets the takeoff.' };
    const PLUMBING_STEPS = [{ id: 'welcome', title: 'W', body: 'A takeoff is a count.' }, SCALE_STEP, { id: 'counter', title: 'C', body: 'A counter.' }];
    const HVAC_STEPS = [{ id: 'welcome', title: 'W', body: 'HVAC is air.' }, SCALE_STEP];
    const manifest = { id: st.id, title: st.title, body: stepText(st.body) };`;
  // the constant is not a (file) card of its own, and a card needs a literal id
  assert.deepStrictEqual(parseCourse(src, 't.js').map((c) => [c.id, c.cards.map((k) => k.id).join(',')]),
    [['PLUMBING_STEPS', 'welcome,scale,counter'], ['HVAC_STEPS', 'welcome,scale']]);
  const tour = chaptersFor({ file: 't.js', chapters: ['PLUMBING_STEPS'], unit: 'card' }, src);
  assert.deepStrictEqual(tour.map((c) => c.id), ['welcome', 'scale', 'counter']);
  assert.strictEqual(tour[1].cards[0].pieces[0].text, 'The scale sets the takeoff.');
  // read card by card, a word on a card before the one that glosses it is early
  const res = checkCourse({ course: 'tour', file: 't.js', chapters: tour, table: { takeoff: 'scale' }, glossary });
  assert.deepStrictEqual(res.problems.filter((p) => p.kind === 'c').map((p) => p.msg), ['t.js:3 welcome/welcome: uses "takeoff" before chapter "scale" glosses it']);
});

test('sentences split at a stop before a capital and at every line, and a step number is not a word', () => {
  assert.deepStrictEqual(sentences('TYP. is the engineer saving ink. Drawn once.\n1. Click Next.'),
    ['TYP. is the engineer saving ink.', 'Drawn once.', 'Click Next.']);
  assert.deepStrictEqual(words('1. In the header, click Set Scale (or press S).').length, 9);
});

test('a sentence over the cap fails, naming the chapter, the card and the sentence', () => {
  const long = Array.from({ length: SENTENCE_CAP + 1 }, (_, i) => (i ? 'word' : 'Every')).join(' ') + '.';
  const bad = run(course('A set is short.', long), {});
  assert.strictEqual(kinds(bad), 'a');
  assert.match(bad.problems[0].msg, /fixture\.js:\d+ sheet\/what \(body\): 26 words, over 25/);
  const atCap = long.replace('Every word', 'Every');
  assert.strictEqual(kinds(run(course('A set is short.', atCap), {})), '');
});

test('a course above the grade ceiling fails; a lower grade does not', () => {
  const hard = 'Contemporaneous electromechanical interconnections necessitate comprehensive documentation.';
  const bad = run(course(hard, hard), {});
  assert.ok(scoreCourse('x', parseCourse(course(hard, hard), 'x')).all.grade > GRADE_CEILING);
  assert.strictEqual(kinds(bad), 'b');
  assert.strictEqual(kinds(run(course('The cat sat.', 'A dog ran.'), {})), '');
});

test('term matching is whole word, case-insensitive, plural-tolerant, and a hyphen joins words', () => {
  assert.ok(termRe('lavatory').test('two lavatories'));
  assert.ok(termRe('RFI').test('RFIs'));
  assert.ok(termRe('branch').test('the Branches'));
  assert.ok(termRe('three phase').test('three-phase'));
  assert.ok(termRe('make-up').test('make-up air'));
  assert.ok(!termRe('ground').test('ground-fault'));
  assert.ok(!termRe('set').test('settings'));
});

test('the first-use rule: a term before its chapter fails, EARLY allows it, a stale row fails', () => {
  const table = { set: 'before', legend: 'sheet' };
  // clean: legend first used in the chapter that glosses it
  assert.strictEqual(kinds(run(course('A set is all the drawings.', 'The legend is the key.'), table)), '');
  // legend used in Chapter 0, glossed in Chapter 1
  const early = run(course('A set, and its legend.', 'The legend is the key.'), table);
  assert.strictEqual(kinds(early), 'c');
  assert.match(early.problems[0].msg, /before\/set: uses "legend" before chapter "sheet" glosses it/);
  // the known early use is allowed, and counted
  const allowed = run(course('A set, and its legend.', 'The legend is the key.'), table, [['fixture', 'legend', 'before']]);
  assert.strictEqual(kinds(allowed), '');
  assert.strictEqual(allowed.early.length, 1);
  // a row that no longer matches fails as stale
  const stale = run(course('A set is all the drawings.', 'The legend is the key.'), table, [['fixture', 'legend', 'before']]);
  assert.match(stale.problems.map((p) => p.msg).join('\n'), /EARLY row .* is stale/);
  // a [[Legend]] chip is a button's name, not a use
  assert.strictEqual(kinds(run(course('A set. Click [[Legend]].', 'The legend is the key.'), table)), '');
  // the defining chapter has to use the term; a chapter id has to exist
  assert.match(run(course('A set, and its legend.', 'Nothing here.'), { set: 'before', legend: 'sheet' }, [['fixture', 'legend', 'before']])
    .problems.map((p) => p.msg).join('\n'), /says chapter "sheet" glosses it, and that chapter never uses it/);
  assert.match(run(course('A set.', 'Read.'), { set: 'nowhere' }).problems[0].msg, /names chapter "nowhere"/);
  // 'guide': used, never glossed on a card, never a failure
  const guide = run(course('A set, and its legend.', 'Read.'), { set: 'before', legend: 'guide' });
  assert.strictEqual(kinds(guide), '');
  assert.deepStrictEqual(guide.unglossed.map((g) => g.term), ['legend']);
});

test('the glossary: the bold terms of the one section, aliases in parentheses, groups inside it', () => {
  assert.deepStrictEqual(glossary.map((e) => e.bold),
    ['Set', 'Legend', 'RFI (request for information)', 'Tooling (PipeTooling, TakeoffTooling)', 'The line beside Show me where']);
  assert.ok(inGlossary(glossary, 'request for information'));
  assert.ok(inGlossary(glossary, 'rfi'));
  assert.ok(inGlossary(glossary, 'TakeoffTooling'));
  assert.ok(inGlossary(glossary, 'line beside Show me where'));
  assert.strictEqual(inGlossary(glossary, 'takeoff'), null);   // above the section
  assert.strictEqual(inGlossary(glossary, 'keynote'), null);   // below it
  assert.strictEqual(glossaryTerms('## Nothing here\n- **Set.** x'), null);
});

test('a first-use term missing from the glossary fails (d)', () => {
  const src = course('A set is all the drawings.', 'The keynote and the legend.');
  const bad = run(src, { set: 'before', legend: 'sheet', keynote: 'sheet' });
  assert.strictEqual(kinds(bad), 'd');
  assert.match(bad.problems[0].msg, /"keynote" \(FIRST_USE\.fixture\) has no bold entry under "Words the cards use"/);
  assert.strictEqual(kinds(checkCourse({ course: 'fixture', file: 'f.js', chapters: parseCourse(src, 'f.js'), table: { set: 'before' }, glossary: null })), 'd');
});
