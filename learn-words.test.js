// Node unit tests (node --test, in `npm run check` / CI) for the Words search (LEARN-WORDS):
// the guide's glossary read as data (scripts/lib/guide-words.js), the committed
// guides/words.json, and the search's ranking (features/learn-words.js searchWords).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { guideWords, wordsJson, SOURCE, HEADING } = require('./scripts/lib/guide-words.js');
const { searchWords } = require('./features/learn-words.js');

const MD = [
  '## How a lesson works', '', '- **Not a word.** A list item before the section.', '',
  '### ' + HEADING, '', 'A paragraph, not an entry.', '',
  '#### The set and the sheet', '',
  '- **Title block.** The box at the edge of a sheet with its **name**, its number and its `scale`.',
  '- **Set.** All the drawings for one job. See [the guide](/guides/x/).', '',
  '#### The estimator\'s words', '',
  '- **GC (general contractor).** The company that runs the whole job.',
  '- **Bid.** The price a contractor offers.', '',
  '## The next section', '', '- **Outside.** Past the section.',
].join('\n');

test('guideWords: the section\'s groups and entries, plain text, nothing from outside it', () => {
  const groups = guideWords(MD);
  assert.deepStrictEqual(groups.map((g) => [g.name, g.words.map((w) => w.term)]), [
    ['The set and the sheet', ['Title block', 'Set']],
    ['The estimator\'s words', ['GC (general contractor)', 'Bid']],
  ]);
  assert.strictEqual(groups[0].words[0].text, 'The box at the edge of a sheet with its name, its number and its scale.');
  assert.strictEqual(groups[0].words[1].text, 'All the drawings for one job. See the guide.');
  assert.strictEqual(guideWords('## Nothing here\n'), null);
});

test('wordsJson: counts the entries, and refuses a missing section or a term with no meaning', () => {
  const j = JSON.parse(wordsJson(MD));
  assert.strictEqual(j.count, 4);
  assert.strictEqual(j.source, SOURCE.url);
  assert.throws(() => wordsJson('## Nothing here\n'), /no "Words the cards use" section/);
  assert.throws(() => wordsJson('### ' + HEADING + '\n\n- **Bare.**\n'), /no meaning/);
});

test('guides/words.json is the guide\'s own list: every bold entry, in order', () => {
  const md = fs.readFileSync(path.join(__dirname, SOURCE.file), 'utf8');
  const committed = JSON.parse(fs.readFileSync(path.join(__dirname, 'guides', 'words.json'), 'utf8'));
  assert.deepStrictEqual(committed.groups, guideWords(md));
  assert.ok(committed.count > 200, 'the glossary holds the courses\' words');
  assert.strictEqual(committed.groups.length, 8);
});

test('searchWords: ranked the term, its start, a word in it, the term anywhere, then the meaning', () => {
  const groups = [
    { name: 'A', words: [
      { term: 'Scale bar', text: 'A printed ruler on the sheet.' },
      { term: 'Sheet', text: 'One page of a set.' },
      { term: 'Scale', text: 'How many feet of building one inch of paper stands for.' },
      { term: 'Title block', text: 'The box with the sheet\'s name and its scale.' },
      { term: 'GC (general contractor)', text: 'The company that runs the whole job.' },
      { term: 'Rescale', text: 'Made up, for the term-anywhere rank.' },
    ] },
  ];
  assert.deepStrictEqual(searchWords(groups, 'scale').map((h) => h.term), ['Scale', 'Scale bar', 'Rescale', 'Title block']);
  assert.deepStrictEqual(searchWords(groups, '  BLOCK ').map((h) => h.term), ['Title block']);        // a word inside the term, any case
  assert.deepStrictEqual(searchWords(groups, 'general').map((h) => h.term), ['GC (general contractor)']);   // a name in the parenthesis
  assert.deepStrictEqual(searchWords(groups, 'ruler').map((h) => [h.term, h.group]), [['Scale bar', 'A']]);   // the meaning
  assert.deepStrictEqual(searchWords(groups, ''), []);
  assert.deepStrictEqual(searchWords(groups, 'zzz'), []);
  assert.deepStrictEqual(searchWords(null, 'scale'), []);
});

test('the real list answers the words lesson 0 sends a reader to look up', () => {
  const { groups } = JSON.parse(fs.readFileSync(path.join(__dirname, 'guides', 'words.json'), 'utf8'));
  for (const q of ['title block', 'takeoff', 'armed', 'status bar']) assert.strictEqual(searchWords(groups, q)[0].term.toLowerCase().replace(/ \(.*$/, ''), q, q);
});
