#!/usr/bin/env node
// `npm run build:persona-manifest`: the persona pass's main read (PERSONA-PLAN build items 1
// and 2, 2026-09-25). Dumps every set's step manifest (the three five-minute tours, the blank
// tour, the lessons and the course chapters) as JSONL, one compact line per step in a stable
// key order, and labels.json, every control label a reader can meet, marked by where it comes
// from, so a text pass can catch "the card names a control that is not there" without a browser:
//   shell   app/index.html's labels (scripts/lib/shell-labels.js, the list teaching-labels.test.js
//           checks chips against)
//   target  the labels the engine manifest resolved for a step's lit controls (a walk: the one it lit)
//   dialog:<name>  a dialog's controls, read from the booted page (hidden dialogs too, and the ones
//           script builds, like the Set Scale presets) and, on a walk, from every dialog it saw open
//   card    the tour card's own buttons a walk saw ("Open the sample plan")
// The calibration's text pass flagged controls as missing that only live in a dialog or on the
// card (PERSONA-PLAN "Calibration results", C10 / C11); the sources close that.
// labels.json: { "sources": { name: what it means }, "labels": [[label, source, ...], ...] }.
//
//   node scripts/persona-manifest.js [--app <url>] [--out persona-out] [--sets plumbing,lesson:counting] [--jobs 4]
//
// Manual, like build:screenshots (a browser, and a walk takes a while): not in `npm run check`.
// With the engine's App.tutorialManifest the lines are the engine's (raw bodies, every target);
// on a commit without it each set is walked with the card's Skip / Next and the lines say
// "source":"walk" (see scripts/lib/persona-driver.js walkManifest for what a walk cannot see).
// Output lands in persona-out/ (gitignored), never the repo.
const fs = require('node:fs');
const path = require('node:path');
const D = require('./lib/persona-driver.js');
const { DEVICES } = require('./persona-devices.js');
const { shellLabels, labelsOfHtml } = require('./lib/shell-labels.js');

const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf('--' + name); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt; };
const OUT = path.resolve(arg('out', 'persona-out'));
const JOBS = Math.max(1, +arg('jobs', 4));

const SOURCES = {
  shell: 'in app/index.html (a label on a control, a title or an aria-label)',
  target: 'a control a step lights, as the engine manifest named it (a walk: the one it lit)',
  'dialog:<name>': 'a control inside that dialog (it is on screen only while the dialog is open)',
  card: 'a button on the tour card itself',
};
const clean = (l) => String(l == null ? '' : l).replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// An unresolved target stays a CSS selector in the engine manifest ("#noteModalDone"): not a label.
const isSelector = (t) => /^([#.][A-Za-z_][\w-]*|\[[^\]]+\])/.test(t) || /^[a-z]+[#.[][A-Za-z_]/i.test(t);
// The label index: { sources, labels: [[label, source...]] }, labels sorted, each label's sources
// in the order shell, target, card, then its dialogs by name. Pure (persona-harness.test.js).
function labelIndex({ shell = [], manifests = [], dialogs = {}, card = [] }) {
  const map = new Map();
  const add = (label, src) => { const l = clean(label); if (!l) return; if (!map.has(l)) map.set(l, new Set()); map.get(l).add(src); };
  shell.forEach((l) => add(l, 'shell'));
  manifests.forEach((m) => {
    (m.steps || []).forEach((st) => (st.targets || []).forEach((t) => { if (!isSelector(String(t))) add(t, 'target'); }));
    const seen = m.seen || {};
    Object.entries(seen.dialogs || {}).forEach(([name, ls]) => ls.forEach((l) => add(l, 'dialog:' + clean(name))));
    (seen.card || []).forEach((l) => add(l, 'card'));
  });
  Object.entries(dialogs).forEach(([name, ls]) => ls.forEach((l) => add(l, 'dialog:' + clean(name))));
  card.forEach((l) => add(l, 'card'));
  const rank = (s) => (s === 'shell' ? 0 : s === 'target' ? 1 : s === 'card' ? 2 : 3);
  const labels = Array.from(map.keys()).sort().map((l) => [l].concat(Array.from(map.get(l)).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0))));
  return { sources: SOURCES, labels };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let app = arg('app', null), server = null;
  // the shell's labels: the served app's own index.html (an --app at another commit has its own),
  // this checkout's when it serves itself
  let shell;
  if (app) {
    const r = await fetch(app.replace(/\/$/, '') + '/app/index.html');
    if (!r.ok) throw new Error('could not read ' + app + '/app/index.html (' + r.status + ')');
    shell = [...labelsOfHtml(await r.text())];
  } else shell = [...shellLabels()];
  if (!app) { server = await D.serveRepo(0); app = server.url; }
  const browser = await D.launch();
  try {
    const first = await D.newSession(browser, DEVICES['first-timer']);
    await D.boot(first.page, app);
    const all = await D.setIds(first.page);
    const engine = await first.page.evaluate(() => typeof window.App.tutorialManifest === 'function');
    const only = arg('sets', null);
    const sets = only ? only.split(',').filter((s) => all.includes(s)) : all;
    if (only && sets.length !== only.split(',').length) console.warn('unknown set(s): ' + only.split(',').filter((s) => !all.includes(s)).join(', '));
    console.log(sets.length + ' sets, ' + (engine ? 'from App.tutorialManifest' : 'walked with Skip / Next (no App.tutorialManifest on this commit)'));
    const results = {};
    if (engine) {
      for (const set of sets) results[set] = await D.manifestOf(first.page, set);
    } else {
      // one fresh context per walk (a walk opens sheets and leaves a tour behind), JOBS at a time
      const queue = sets.slice();
      await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
        while (queue.length) {
          const set = queue.shift();
          const s = await D.newSession(browser, DEVICES['first-timer']);
          const t0 = Date.now();
          try { await D.boot(s.page, app); results[set] = await D.manifestOf(s.page, set); console.log('  ' + set + ': ' + results[set].steps.length + ' steps, ' + Math.round((Date.now() - t0) / 1000) + ' s'); }
          catch (e) { results[set] = { id: set, source: 'walk', error: String(e.message || e).split('\n')[0], steps: [] }; console.warn('  ' + set + ': FAILED ' + results[set].error); }
          finally { await s.context.close().catch(() => {}); }
        }
      }));
    }
    const dialogs = await D.dialogLabels(first.page);
    const card = engine ? await D.cardLabels(first.page, sets) : [];   // a walk reads the card itself
    await first.context.close();
    const index = labelIndex({ shell, manifests: sets.map((set) => results[set]).filter(Boolean), dialogs, card });
    fs.writeFileSync(path.join(OUT, 'labels.json'), JSON.stringify(index) + '\n');
    const bySource = {};
    index.labels.forEach((row) => row.slice(1).forEach((src) => { const k = src.startsWith('dialog:') ? 'dialog' : src; bySource[k] = (bySource[k] || 0) + 1; }));
    console.log('labels.json: ' + index.labels.length + ' labels (' + Object.entries(bySource).map(([k, v]) => k + ' ' + v).join(', ') + ')');
    const lines = [];
    sets.forEach((set) => {
      const m = results[set];
      if (m.error) lines.push(JSON.stringify({ set, source: m.source, error: m.error }));
      m.steps.forEach((st) => lines.push(JSON.stringify(Object.assign({ set }, m.source === 'walk' ? { source: 'walk' } : {}, st))));
    });
    fs.writeFileSync(path.join(OUT, 'manifest.jsonl'), lines.join('\n') + '\n');
    const bytes = fs.statSync(path.join(OUT, 'manifest.jsonl')).size;
    console.log('wrote ' + path.relative(process.cwd(), path.join(OUT, 'manifest.jsonl')) + ' (' + lines.length + ' lines, ' + Math.round(bytes / 1024) + ' KB) and labels.json');
    if (Object.values(results).some((m) => m.error)) process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) server.server.close();
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { labelIndex, isSelector, SOURCES };
