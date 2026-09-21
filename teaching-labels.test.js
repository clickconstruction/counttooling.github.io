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
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Everything the shell can show as a control's name.
function shellLabels() {
  const html = read('app/index.html');
  const out = new Set();
  decode(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '\n')).split('\n').forEach((s) => { const t = s.trim(); if (t) out.add(t); });
  for (const m of html.matchAll(/(?:title|aria-label)="([^"]*)"/g)) out.add(decode(m[1]).trim());
  return out;
}

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

function tourSources() {
  return ['features/tutorial.js'].concat(fs.existsSync(path.join(ROOT, 'features/lessons.js')) ? ['features/lessons.js'] : []);
}
function chipsOf(src) {
  return [...new Set([...src.matchAll(/\[\[(.+?)\]\]/g)].map((m) => m[1].replace(/\\'/g, "'")))];
}
// An action's own label ("Open the sample plan") is a control the tour card draws.
function actionLabels(src) {
  return new Set([...src.matchAll(/label:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));
}

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
