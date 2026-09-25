#!/usr/bin/env node
// `npm run build:persona-manifest`: the persona pass's main read (PERSONA-PLAN build items 1
// and 2, 2026-09-25). Dumps every set's step manifest (the three five-minute tours, the blank
// tour, the lessons and the course chapters) as JSONL, one compact line per step in a stable
// key order, and labels.json, every label the shell shows (scripts/lib/shell-labels.js, the
// list teaching-labels.test.js checks chips against), so a text pass can catch "the card names
// a control that is not there" without a browser.
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
const { shellLabels } = require('./lib/shell-labels.js');

const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf('--' + name); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt; };
const OUT = path.resolve(arg('out', 'persona-out'));
const JOBS = Math.max(1, +arg('jobs', 4));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // the shell's labels, with the one entity shellLabels leaves encoded (&nbsp;) read as a space
  const labels = new Set([...shellLabels()].map((l) => l.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean));
  fs.writeFileSync(path.join(OUT, 'labels.json'), JSON.stringify([...labels].sort()) + '\n');
  let app = arg('app', null), server = null;
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
    await first.context.close();
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

main().catch((e) => { console.error(e); process.exit(1); });
