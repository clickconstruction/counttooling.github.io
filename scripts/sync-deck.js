#!/usr/bin/env node
/**
 * Makes deck/ match a saved copy of the "ClickTooling Pitch" Slides artifact and rebuilds
 * deck/index.html. The artifact at claude.ai is where the deck is edited; when the Artifact
 * tool reads its files it saves them under a folder like
 *   …/artifact-files/<artifact id>/project   (deck.json + slides/<id>.html)
 * and that folder is this script's one argument.
 *
 *   node scripts/sync-deck.js <project folder>           # copy, prune, rebuild
 *   node scripts/sync-deck.js <project folder> --check   # say what differs, change nothing (exit 1 if anything)
 *
 * What it does: copies deck.json; copies every slide the index's `order` names; deletes a hosted
 * slide the order no longer names; applies MEDIA below, the one deliberate difference between
 * the two copies (the artifact can only show a still where the site plays the recording); then
 * runs scripts/build-deck.js. A slide the artifact holds but the order does not name is left out,
 * as the viewer leaves it out.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DECK = path.join(ROOT, 'deck');

// Per-slide substitutions applied on the way in. `find` must match once; when it does not, the
// artifact's version is copied unchanged and the mismatch is reported, since the slide was edited
// around the media and the swap needs a human look.
const MEDIA = {
  'see-it': {
    find: /<img src="\/_blob\/04b16088b69beefa5b24535ea1758d79"[^>]*>/,
    replace:
      '<video src="/img/hero-hvac.mp4" poster="/img/hero-hvac.png" muted loop playsinline preload="metadata" data-autoplay ' +
      'aria-label="CountTooling in use: an HVAC duct takeoff on an office plan, every room boxed with its airflow and the duct runs drawn on the sheet" ' +
      'style="width:1120px;height:700px;object-fit:cover;border-radius:16px;border:1px solid #2E3138"></video>',
  },
};

const args = process.argv.slice(2);
const check = args.includes('--check');
const src = args.find((a) => !a.startsWith('--'));
if (!src || !fs.existsSync(path.join(src, 'deck.json')) || !fs.existsSync(path.join(src, 'slides'))) {
  console.error('usage: node scripts/sync-deck.js <folder holding deck.json and slides/> [--check]');
  process.exit(2);
}

const index = JSON.parse(fs.readFileSync(path.join(src, 'deck.json'), 'utf8'));
if (!Array.isArray(index.order) || !index.order.length) {
  console.error('sync-deck: the index has no `order`');
  process.exit(2);
}

const changes = [];
const warnings = [];
function plan(file, next) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (current === next) return;
  changes.push({ file, next, kind: current === null ? 'added' : 'changed' });
}

for (const id of index.order) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    console.error('sync-deck: bad slide id ' + JSON.stringify(id));
    process.exit(2);
  }
  const from = path.join(src, 'slides', id + '.html');
  if (!fs.existsSync(from)) {
    warnings.push('the order names "' + id + '" but the artifact copy has no slides/' + id + '.html');
    continue;
  }
  let html = fs.readFileSync(from, 'utf8');
  const media = MEDIA[id];
  if (media) {
    if (media.find.test(html)) html = html.replace(media.find, media.replace);
    else warnings.push('slide "' + id + '": the media tag to swap was not found; copied as the artifact has it');
  }
  plan(path.join(DECK, 'slides', id + '.html'), html);
}
plan(path.join(DECK, 'deck.json'), fs.readFileSync(path.join(src, 'deck.json'), 'utf8'));

const prune = fs
  .readdirSync(path.join(DECK, 'slides'))
  .filter((f) => f.endsWith('.html') && !index.order.includes(f.slice(0, -5)))
  .map((f) => path.join(DECK, 'slides', f));

for (const c of changes) console.log((check ? 'would ' : '') + c.kind + ' ' + path.relative(ROOT, c.file));
for (const f of prune) console.log((check ? 'would remove ' : 'remove ') + path.relative(ROOT, f));
for (const w of warnings) console.log('warning: ' + w);

if (check) {
  if (!changes.length && !prune.length) console.log('deck/ already matches the artifact copy');
  process.exit(changes.length || prune.length || warnings.length ? 1 : 0);
}

for (const c of changes) fs.writeFileSync(c.file, c.next);
for (const f of prune) fs.unlinkSync(f);
const build = spawnSync(process.execPath, [path.join(__dirname, 'build-deck.js')], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
console.log(changes.length || prune.length ? 'deck/ now matches the artifact copy; commit deck/ and merge' : 'nothing to sync; deck/index.html rebuilt');
