// Node unit test (node --test, in `npm run check` / CI): the teaching surfaces name
// controls that exist. A tour step writes a control as [[Label]]; every such label must
// be something the shell really shows (its text, a title or an aria-label), or a label
// a feature file renders, proven by a pointer below. And no guide or tour may use a
// label the app has retired. This is the guard for the "Copy to PipeTooling" class of
// drift (2026-09-21): the button was renamed and six teaching surfaces kept the old name.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
// Everything the shell can show as a control's name (scripts/lib/shell-labels.js, shared with
// the persona manifest's labels.json).
const { shellLabels } = require('./scripts/lib/shell-labels.js');

// Labels a feature file renders at run time: label -> [file, the literal that proves it].
const RENDERED_IN_JS = {
  '1/8" = 1\'': ['constants.js', "label: '1/8\" = 1\\''"],
  '1/4" = 1\'': ['constants.js', "label: '1/4\" = 1\\''"],
  '1/2" = 1\'': ['constants.js', "label: '1/2\" = 1\\''"],
  '+ New counter': ['features/chain.js', '">+ New '],
  '⋯': ['app/index.html', 'id="headerMoreBtn"'],   // the More tools button is a glyph, named ⋯ in prose
};

// Labels the app no longer shows. Add one here when a control is renamed.
const RETIRED = ['Copy to PipeTooling', 'Legend Settings]]', 'Snap to horizontal/vertical'];

// The teaching files are FOUND, never listed (R16, D24): the tour engine and the lessons by
// name, any tour-*, course-* or demo-* file, and any feature file that registers a tour through
// App.registerTour. A new tour or course is checked the day it lands, with no edit here.
const TEACHING_NAME = /^(tutorial|lessons|tour-.+|course-.+|demo-.+)\.js$/;   // demo-*: the demo track (DEMO-TRACK)
function tourSources() {
  return fs.readdirSync(path.join(ROOT, 'features'))
    .filter((f) => f.endsWith('.js') && (TEACHING_NAME.test(f) || read('features/' + f).includes('App.registerTour(')))
    .sort()
    .map((f) => 'features/' + f);
}
function chipsOf(src) {
  return [...new Set([...src.matchAll(/\[\[(.+?)\]\]/g)].map((m) => m[1].replace(/\\'/g, "'")))];
}
// An action's own label ("Open the sample plan") is a control the tour card draws.
function actionLabels(src) {
  return new Set([...src.matchAll(/label:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));
}

test('the teaching files are found by pattern, the tours and courses among them', () => {
  const found = tourSources();
  // a floor, so a finder that matches nothing cannot pass the two checks below vacuously
  ['features/tutorial.js', 'features/lessons.js', 'features/tour-blank.js', 'features/course-plumbing.js', 'features/course-electrical.js', 'features/course-hvac.js', 'features/demo-track.js', 'features/demo-hvac.js']
    .forEach((f) => assert.ok(found.includes(f), f + ' is a teaching file'));
  fs.readdirSync(path.join(ROOT, 'features')).filter((f) => f.endsWith('.js') && read('features/' + f).includes('App.registerTour('))
    .forEach((f) => assert.ok(found.includes('features/' + f), f + ' registers a tour, so its labels are checked'));
});

test('every [[control]] a tour names is a control the app shows', () => {
  const labels = shellLabels();
  const startsWith = (chip) => [...labels].some((l) => l.startsWith(chip + ' (') || l.startsWith(chip + ':'));
  const missing = [];
  tourSources().forEach((file) => {
    const src = read(file);
    const actions = actionLabels(src);
    chipsOf(src).forEach((chip) => {
      if (labels.has(chip) || actions.has(chip) || startsWith(chip)) return;
      const ptr = RENDERED_IN_JS[chip];
      if (ptr && read(ptr[0]).includes(ptr[1])) return;
      missing.push(file + ': [[' + chip + ']]');
    });
  });
  assert.deepStrictEqual(missing, [], 'tour steps name controls the shell does not show (renamed? add to RENDERED_IN_JS if a feature file draws it)');
});

test('no guide or tour uses a retired label', () => {
  const dir = path.join(ROOT, 'content/guides');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => 'content/guides/' + f).concat(tourSources());
  const hits = [];
  files.forEach((f) => { const src = read(f); RETIRED.forEach((r) => { if (src.includes(r)) hits.push(f + ': "' + r + '"'); }); });
  assert.deepStrictEqual(hits, []);
});
