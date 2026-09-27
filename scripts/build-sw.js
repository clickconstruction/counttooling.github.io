#!/usr/bin/env node
/**
 * Stamps the service worker's three generated blocks:
 *
 *  - `PRECACHE_URLS`: the list the worker precaches, DERIVED (R06, 2026-09-26):
 *    every root-absolute `<script src>` / `<link href>` in app/index.html in
 *    document order, the font files /vendor/fonts/fonts.css names, the icons
 *    /manifest.webmanifest names, then PRECACHE_EXTRA below (the few assets the
 *    app fetches at run time and no tag names). A new shell file needs only its
 *    tag: the next `npm run build:sw` precaches it, and `--check` fails until then.
 *  - `CACHE_VERSION`: a joint content hash of every asset in that list. The
 *    hash changes if and only if a precached asset's bytes change, so each
 *    deploy that alters the shell automatically gets a fresh cache name, the
 *    browser then installs the new worker, re-precaches the current asset set,
 *    and purges the stale cache.
 *  - `PRECACHE_SHA256`: a per-file sha256 map the install uses to VERIFY each
 *    fetched asset before caching it (GitHub Pages deploys propagate
 *    non-atomically, so a mid-deploy install could otherwise permanently
 *    precache a mixed shell; a mismatch now aborts the install and the browser
 *    retries once the CDN settles).
 *
 * This replaces the old manual "remember to bump CACHE_VERSION" step (which was
 * forgotten across 10 deploys, leaving returning browsers on stale code). A raw
 * git SHA can't be used because a commit can't contain its own hash and CI could
 * not then verify freshness; a content hash is deterministic and enforceable.
 *
 * Usage:
 *   node scripts/build-sw.js            rewrite the three blocks in place
 *   node scripts/build-sw.js --check    exit non-zero if any is stale (CI)
 *   node scripts/build-sw.js --resolve  settle a merge conflict in sw.js: when
 *                                       every conflict hunk sits inside the
 *                                       generated blocks, take either side and
 *                                       restamp; otherwise refuse (resolve by hand)
 *   --sw <file>                         operate on another copy of sw.js (tests)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assertNoConflictMarkers, findConflictMarkerLine } = require('./lib/markers');

const ROOT = path.join(__dirname, '..');
const VERSION_RE = /const CACHE_VERSION = '([^']*)';/;
const URLS_RE = /const PRECACHE_URLS = \[\n[\s\S]*?\n\];/;
const HASHES_RE = /const PRECACHE_SHA256 = \{[\s\S]*?\};/;

// The assets the shell needs offline that NO tag in app/index.html, fonts.css or
// the manifest names. Hand-maintained on purpose and kept short: each one is
// reached at run time by code, so no markup can derive it. A missing file here
// fails the build (a 404 would abort the whole offline install).
const PRECACHE_EXTRA = [
  // The shell itself: navigations are network-first, and this cached copy is
  // what an offline visit to /app/ (or /app/index.html) is served.
  '/app/',
  '/app/index.html',
  // The render worker: render-service.js constructs it with new Worker(), never a tag.
  '/render-worker.js',
  // pdf.js's own worker: app.js points GlobalWorkerOptions.workerSrc at it; without
  // it nothing renders offline. Rename it here when vendor/pdf.min-* is bumped.
  '/vendor/pdf.worker.min-3.11.174.js',
  // The machine-readable rulebook: features/rules.js fetches it for the rule chips
  // (rules-chip.spec.js pins that it is precached).
  '/rules/rules.json',
  // The Learn guide's glossary as data: features/learn-words.js fetches it for the
  // Words search at the top of Learn (build-guides.js writes it).
  '/guides/words.json',
];

const FONTS_CSS = '/vendor/fonts/fonts.css';
const MANIFEST = '/manifest.webmanifest';

// Map a precache URL to the repo file that serves it. Directory URLs ('/app/')
// resolve to their index.html; everything else is a path relative to the repo root.
function urlToFile(url, root = ROOT) {
  let rel = url.replace(/^\//, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  return path.join(root, rel);
}

// Every root-absolute <script src> / <link href> in the shell, in document order,
// deduplicated. Remote hrefs (the canonical link) are not ours to cache. A
// RELATIVE ref is an error: the shell is served at /app/, so 'styles.css' would
// resolve to /app/styles.css, and its precache entry would name the wrong file.
// config.local.js is loaded via document.write (localhost-only, gitignored), so
// the tag regex never sees it.
function shellTagUrls(html) {
  const urls = [];
  for (const m of html.matchAll(/<(?:script[^>]*\bsrc|link[^>]*\bhref)="([^"]+)"/g)) {
    const ref = m[1];
    if (/^https?:\/\//.test(ref)) continue;
    if (!ref.startsWith('/')) {
      throw new Error(`app/index.html loads '${ref}' by a relative path; shell refs are root-absolute ('/${ref}').`);
    }
    if (!urls.includes(ref)) urls.push(ref);
  }
  return urls;
}

// The font files fonts.css names, as URLs (its url() refs are relative to it).
function fontUrls(css, cssUrl = FONTS_CSS) {
  const base = cssUrl.slice(0, cssUrl.lastIndexOf('/') + 1);
  const urls = [];
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    const ref = m[1];
    if (/^(?:https?:|data:)/.test(ref)) continue;
    const url = ref.startsWith('/') ? ref : base + ref;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

// The install icons the manifest names.
function manifestIconUrls(json) {
  const icons = JSON.parse(json).icons || [];
  return icons.map((i) => (i.src.startsWith('/') ? i.src : '/' + i.src));
}

// The generated list, as labelled groups (the labels become comments in sw.js;
// no quotes in them, so the quoted-string parsers never pick one up). A URL that
// an earlier group already holds is dropped from the later one.
function derivePrecacheGroups(root = ROOT) {
  const read = (url) => fs.readFileSync(urlToFile(url, root), 'utf8');
  const raw = [
    { label: 'app/index.html: every root-absolute <script src> and <link href>, document order', urls: shellTagUrls(read('/app/index.html')) },
    { label: `${FONTS_CSS}: the font files it names`, urls: fontUrls(read(FONTS_CSS)) },
    { label: `${MANIFEST}: the install icons it names`, urls: manifestIconUrls(read(MANIFEST)) },
    { label: 'PRECACHE_EXTRA in scripts/build-sw.js: fetched at run time, no tag names them', urls: PRECACHE_EXTRA },
  ];
  const seen = new Set();
  return raw.map((g) => ({
    label: g.label,
    urls: g.urls.filter((u) => (seen.has(u) ? false : (seen.add(u), true))),
  }));
}

function renderPrecacheUrls(groups) {
  const lines = [];
  for (const g of groups) {
    if (!g.urls.length) continue;
    lines.push(`  // ${g.label}`);
    for (const u of g.urls) lines.push(`  '${u}',`);
  }
  return `const PRECACHE_URLS = [\n${lines.join('\n')}\n];`;
}

// Extract the quoted URL strings from the PRECACHE_URLS array literal in sw.js.
function parsePrecacheUrls(swText) {
  const m = swText.match(URLS_RE);
  if (!m) throw new Error('Could not find `const PRECACHE_URLS = [...];` in sw.js.');
  return [...m[0].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

// Hash url + bytes for every precache asset, in declaration order. Missing files
// are a hard error: a precache entry that 404s would break the install and leave
// the offline shell on the previous version forever.
function computeHash(urls, root = ROOT) {
  const missing = urls.filter((u) => !fs.existsSync(urlToFile(u, root)));
  if (missing.length) {
    throw new Error(
      'Precached asset(s) have no matching file on disk:\n' +
      missing.map((u) => `  ${u}  ->  ${path.relative(root, urlToFile(u, root))}`).join('\n') +
      '\nFix the tag in app/index.html or PRECACHE_EXTRA, or add the file (a 404 here breaks the offline install).',
    );
  }
  const hash = crypto.createHash('sha256');
  for (const url of urls) {
    hash.update(url, 'utf8');
    hash.update('\0');
    hash.update(fs.readFileSync(urlToFile(url, root)));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

// The per-file integrity map, rendered exactly as it appears in sw.js (one
// full-sha256 entry per URL, declaration order).
function renderFileHashes(urls, root = ROOT) {
  const entries = urls.map((url) => {
    const hex = crypto.createHash('sha256').update(fs.readFileSync(urlToFile(url, root))).digest('hex');
    return `  '${url}': '${hex}',`;
  });
  return `const PRECACHE_SHA256 = {\n${entries.join('\n')}\n};`;
}

// Merge-conflict guard over the precached SOURCE files: a conflicted asset
// would hash "successfully" and get its broken bytes stamped into the
// integrity map. Only text assets can carry git markers (git never merges
// binaries), so fonts/PNGs are skipped. Missing files are computeHash's error.
const TEXT_EXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.svg', '.md', '.map', '.txt', '.webmanifest']);
function checkPrecacheConflictMarkers(urls, root = ROOT) {
  for (const url of urls) {
    const file = urlToFile(url, root);
    if (!TEXT_EXT.has(path.extname(file)) || !fs.existsSync(file)) continue;
    assertNoConflictMarkers(fs.readFileSync(file, 'utf8'), path.relative(root, file));
  }
}

// The whole stamp, pure over (sw.js text, repo files): what sw.js should read,
// and which blocks of the given text differ from it.
function stamp(swText, root = ROOT) {
  for (const [re, what] of [[VERSION_RE, "const CACHE_VERSION = '...';"], [URLS_RE, 'const PRECACHE_URLS = [...];'], [HASHES_RE, 'const PRECACHE_SHA256 = {...};']]) {
    if (!re.test(swText)) throw new Error(`Could not find \`${what}\` in sw.js.`);
  }
  const groups = derivePrecacheGroups(root);
  const urls = groups.flatMap((g) => g.urls);
  const version = computeHash(urls, root);
  const urlsBlock = renderPrecacheUrls(groups);
  const hashesBlock = renderFileHashes(urls, root);
  const next = swText
    .replace(VERSION_RE, () => `const CACHE_VERSION = '${version}';`)
    .replace(URLS_RE, () => urlsBlock)
    .replace(HASHES_RE, () => hashesBlock);
  const current = parsePrecacheUrls(swText);
  const stale = {
    version: swText.match(VERSION_RE)[1] === version ? null : { was: swText.match(VERSION_RE)[1], want: version },
    urls: swText.match(URLS_RE)[0] === urlsBlock ? null : {
      missing: urls.filter((u) => !current.includes(u)),
      extra: current.filter((u) => !urls.includes(u)),
    },
    hashes: swText.match(HASHES_RE)[0] !== hashesBlock,
  };
  return { next, urls, version, stale, fresh: !stale.version && !stale.urls && !stale.hashes };
}

// Split a conflicted text into its two sides. Handles the plain and the diff3 /
// zdiff3 styles (a '|||||||' base section is dropped from both sides).
function conflictSides(text) {
  const ours = [];
  const theirs = [];
  let mode = 'both';
  for (const line of text.split('\n')) {
    if (/^<{7}(?: |$)/.test(line)) { mode = 'ours'; continue; }
    if (mode !== 'both' && /^\|{7}(?: |$)/.test(line)) { mode = 'base'; continue; }
    if (mode !== 'both' && /^={7}$/.test(line)) { mode = 'theirs'; continue; }
    if (/^>{7}(?: |$)/.test(line)) { mode = 'both'; continue; }
    if (mode === 'both' || mode === 'ours') ours.push(line);
    if (mode === 'both' || mode === 'theirs') theirs.push(line);
  }
  return { ours: ours.join('\n'), theirs: theirs.join('\n') };
}

// Blank the three generated blocks, leaving the hand-written rest of sw.js.
function handWritten(swText) {
  return swText.replace(VERSION_RE, '@@CACHE_VERSION@@').replace(URLS_RE, '@@PRECACHE_URLS@@').replace(HASHES_RE, '@@PRECACHE_SHA256@@');
}

// --resolve: a conflicted sw.js whose two sides differ ONLY inside the generated
// blocks is settled by taking our side (the restamp regenerates every block from
// the files, so which side is irrelevant). Anything else is a real conflict in
// the worker's code, and a human resolves it.
function resolveConflicted(swText) {
  if (!findConflictMarkerLine(swText)) return swText;
  const { ours, theirs } = conflictSides(swText);
  if (handWritten(ours) !== handWritten(theirs)) {
    throw new Error(
      'sw.js conflicts outside its generated blocks (CACHE_VERSION, PRECACHE_URLS, PRECACHE_SHA256).\n' +
      'Resolve the hand-written part by hand, then run `npm run build:sw`.',
    );
  }
  return ours;
}

function parseArgs(argv) {
  const opts = { check: false, resolve: false, sw: path.join(ROOT, 'sw.js') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') opts.check = true;
    else if (argv[i] === '--resolve') opts.resolve = true;
    else if (argv[i] === '--sw') opts.sw = path.resolve(argv[++i]);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  let swText = fs.readFileSync(opts.sw, 'utf8');
  let resolved = false;
  if (opts.resolve && findConflictMarkerLine(swText)) {
    swText = resolveConflicted(swText);
    resolved = true;
  }
  assertNoConflictMarkers(swText, 'sw.js');

  const groups = derivePrecacheGroups();
  checkPrecacheConflictMarkers(groups.flatMap((g) => g.urls));
  const r = stamp(swText);

  if (r.fresh && !resolved) {
    console.log(`Service worker cache version up to date (${r.version}, ${r.urls.length} precached).`);
    return;
  }

  if (opts.check) {
    const what = [];
    if (r.stale.urls) {
      const lines = [
        ...r.stale.urls.missing.map((u) => `    + ${u}`),
        ...r.stale.urls.extra.map((u) => `    - ${u}`),
      ];
      what.push(`PRECACHE_URLS (derived from app/index.html, fonts.css, the manifest and PRECACHE_EXTRA)${lines.length ? ':\n' + lines.join('\n') : ' (order or grouping)'}`);
    }
    if (r.stale.version) what.push(`cache version (sw.js has '${r.stale.version.was}', expected '${r.stale.version.want}')`);
    if (r.stale.hashes) what.push('PRECACHE_SHA256 integrity map');
    console.error(
      `Service worker generated block(s) stale:\n  ${what.join('\n  ')}\n` +
      'Run `npm run build:sw` and commit the result so returning browsers fetch the new assets.',
    );
    process.exit(1);
  }

  fs.writeFileSync(opts.sw, r.next, 'utf8');
  const was = swText.match(VERSION_RE)[1];
  console.log(`${resolved ? 'Resolved the sw.js stamp conflict and stamped' : 'Stamped'} sw.js cache version: '${was}' -> '${r.version}' (${r.urls.length} precached + integrity map).`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = {
  PRECACHE_EXTRA,
  shellTagUrls,
  fontUrls,
  manifestIconUrls,
  derivePrecacheGroups,
  renderPrecacheUrls,
  parsePrecacheUrls,
  stamp,
  conflictSides,
  resolveConflicted,
};
