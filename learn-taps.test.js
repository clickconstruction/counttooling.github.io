// Node unit tests (node --test, in `npm run check` / CI) for the tap targets on the cards
// (LEARN-TAPS, features/learn-taps.js): which glossary names are looked for, which words a
// card underlines, and the HTML a run of text becomes.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { CAP, PLAIN, wordNames, entryOf, pickTaps, decorate } = require('./features/learn-taps.js');

const GROUPS = [{ name: 'Words', words: [
  { term: 'Riser', text: 'The upright pipe.' },
  { term: 'GC (general contractor)', text: 'The company that runs the job.' },
  { term: 'Amp (A)', text: 'The unit of current.' },
  { term: 'Set', text: 'All the drawings.' },
  { term: 'Scale zone', text: 'A box with its own scale.' },
  { term: 'Lavatory', text: 'A bathroom sink.' },
  { term: 'Hanger', text: 'A strap.' },
  { term: 'Elbow', text: 'A bend.' },
  { term: 'Keynote', text: 'A short tag.' },
] }];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

test('wordNames: a parenthesis holds more names; plain words and one-letter names are left out', () => {
  const names = wordNames(GROUPS).map((n) => n.name);
  assert.deepStrictEqual(names, ['Riser', 'GC', 'general contractor', 'Amp', 'Scale zone', 'Lavatory', 'Hanger', 'Elbow', 'Keynote']);
  assert.ok(PLAIN.has('set') && PLAIN.has('run'));
});

test('a name is a whole word, plural allowed; an acronym keeps its case', () => {
  const by = Object.fromEntries(wordNames(GROUPS).map((n) => [n.name, n.re]));
  assert.ok(by.Riser.test('the risers, upright'));
  assert.ok(by.Lavatory.test('three lavatories'));
  assert.ok(!by.Riser.test('a supriser'));
  assert.ok(by['Scale zone'].test('a scale-zone here'));
  assert.ok(by.GC.test('ask the GC.'));
  assert.ok(!by.GC.test('a gc here'));
  assert.ok(by.Amp.test('20 amps'));
});

test('entryOf: a course\'s chapters, the lessons, or the tour alone', () => {
  assert.strictEqual(entryOf('course:plumbing:waste'), 'course:plumbing:');
  assert.strictEqual(entryOf('lesson:counting'), 'lesson:');
  assert.strictEqual(entryOf('plumbing'), 'plumbing');
  assert.strictEqual(entryOf('blank'), 'blank');
});

test('pickTaps: never the card that uses a word first; later cards, the least used first, capped', () => {
  const names = wordNames(GROUPS);
  const cards = [
    'The riser is the upright pipe. Ask the GC, the general contractor.',            // 0: glosses riser and GC
    'A hanger is a strap. An elbow is a bend. A keynote is a tag. A lavatory is a sink.',   // 1: glosses four more
    'Trace the riser. Click [[Riser]] and the hanger.',                             // 2
    'The riser, the hanger, the elbow, the keynote and the lavatories. Ask the general contractor.',   // 3
    'The riser again.',                                                            // 4
  ];
  assert.deepStrictEqual(pickTaps(cards, 0, names), []);
  assert.deepStrictEqual(pickTaps(cards, 1, names), []);
  assert.deepStrictEqual(pickTaps(cards, 2, names).map((p) => p.term), ['Hanger', 'Riser']);   // hanger is used on 3 cards, riser on 4
  const third = pickTaps(cards, 3, names).map((p) => p.term);
  assert.strictEqual(third.length, CAP);
  assert.ok(!third.includes('Riser'), 'the most used word is the one the cap drops');
  assert.ok(third.includes('GC (general contractor)'), 'another of its names counts as the word');
  assert.deepStrictEqual(pickTaps(cards, 3, names, 1).map((p) => p.term), ['Elbow']);   // a tie on uses goes to the word that comes first on the card
  assert.deepStrictEqual(pickTaps(cards, 9, names), []);
  // a control's label is no use of the word: a card whose only "Riser" is a button does not underline it
  assert.deepStrictEqual(pickTaps(['The riser.', 'Click [[Riser]].'], 1, names), []);
});

test('decorate: a word\'s first appearance on the card is the tap target, escaped, once', () => {
  const names = wordNames(GROUPS);
  const picks = [{ term: 'Riser' }, { term: 'GC (general contractor)' }];
  const done = new Set();
  assert.strictEqual(decorate('Trace the <riser>, then the risers. Ask the GC & go.', picks, names, esc, done),
    'Trace the &lt;<span class="tour-word" role="button" tabindex="0" data-word="Riser">riser</span>&gt;, then the risers. Ask the <span class="tour-word" role="button" tabindex="0" data-word="GC (general contractor)">GC</span> &amp; go.');
  // the next run of text on the same card: both are done
  assert.strictEqual(decorate('The riser and the GC.', picks, names, esc, done), 'The riser and the GC.');
  assert.strictEqual(decorate('Nothing here.', picks, names, esc, new Set()), 'Nothing here.');
});

test('on the real glossary and the real lessons, no card underlines a plain word or passes the cap', () => {
  const sc = require('./scripts/score-courses.js');
  const names = wordNames(JSON.parse(fs.readFileSync(path.join(__dirname, 'guides', 'words.json'), 'utf8')).groups);
  assert.ok(names.length > 200);
  assert.ok(!names.some((n) => PLAIN.has(n.name.toLowerCase())));
  let shown = 0, cardsSeen = 0;
  for (const c of sc.COURSES) {
    const cards = [];
    sc.chaptersFor(c, fs.readFileSync(path.join(__dirname, c.file), 'utf8')).forEach((ch) => ch.cards.forEach((card) => cards.push(card.pieces.map((p) => p.text).join('\n'))));
    cards.forEach((_, i) => { const picks = pickTaps(cards, i, names); assert.ok(picks.length <= CAP); shown += picks.length; cardsSeen++; });
  }
  assert.ok(cardsSeen > 300);
  assert.ok(shown / cardsSeen > 1 && shown / cardsSeen < 3, 'about two words a card: ' + (shown / cardsSeen).toFixed(2));
});
