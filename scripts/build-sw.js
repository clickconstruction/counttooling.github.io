#!/usr/bin/env node
/**
 * Stamps the service worker's two generated blocks:
 *
 *  - `CACHE_VERSION` — a joint content hash of every asset listed in the
 *    worker's own PRECACHE_URLS. The hash changes if and only if a precached
 *    asset's bytes change, so each deploy that alters the shell automatically
 *    gets a fresh cache name — the browser then installs the new worker,
 *    re-precaches the current asset set, and purges the stale cache.
 *  - `PRECACHE_SHA256` — a per-file sha256 map the install uses to VERIFY each
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
 *   node scripts/build-sw.js          rewrite both blocks in place
 *   node scripts/build-sw.js --check  exit non-zero if either is stale (CI)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assertNoConflictMarkers } = require('./lib/markers');

const ROOT = path.join(__dirname, '..');
const SW = path.join(ROOT, 'sw.js');
const VERSION_RE = /const CACHE_VERSION = '([^']*)';/;
const HASHES_RE = /const PRECACHE_SHA256 = \{[\s\S]*?\};/;

// Map a precache URL to the repo file that serves it. Directory URLs ('/app/')
// resolve to their index.html; everything else is a path relative to the repo root.
function urlToFile(url) {
  let rel = url.replace(/^\//, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  return path.join(ROOT, rel);
}

// Extract the quoted URL strings from the PRECACHE_URLS array literal in sw.js.
function parsePrecacheUrls(swText) {
  const start = swText.indexOf('const PRECACHE_URLS = [');
  if (start === -1) throw new Error('Could not find PRECACHE_URLS in sw.js');
  const end = swText.indexOf('];', start);
  if (end === -1) throw new Error('Could not find end of PRECACHE_URLS in sw.js');
  const block = swText.slice(start, end);
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

// Completeness: every root-absolute <script src>/<link href> the app shell
// (app/index.html) loads must be in PRECACHE_URLS, or the offline shell boots
// with those requests 504ing (cacheFirst has no cache entry and no network).
// The sw.js header names the HTML as the source of truth, but nothing enforced
// it — five registry-split feature files were silently missing when this check
// was added. One-directional on purpose: the precache legitimately carries
// extras the HTML never names (the lazily-fetched pdf.js worker, fonts pulled
// in via fonts.css, PWA icons, '/app/' itself). config.local.js is loaded via
// document.write (localhost-only, gitignored) so it never matches the regex.
const APP_HTML = path.join(ROOT, 'app', 'index.html');
function checkPrecacheCoversShell(urls) {
  const html = fs.readFileSync(APP_HTML, 'utf8');
  const precached = new Set(urls);
  const missing = [];
  for (const m of html.matchAll(/<(?:script[^>]*\bsrc|link[^>]*\bhref)="(\/[^"]+)"/g)) {
    if (!precached.has(m[1]) && !missing.includes(m[1])) missing.push(m[1]);
  }
  if (missing.length) {
    console.error('app/index.html loads shell asset(s) that are NOT in sw.js PRECACHE_URLS:');
    missing.forEach((u) => console.error(`  ${u}`));
    console.error('Add them to PRECACHE_URLS (offline, a precache miss 504s and the shell boots broken).');
    process.exit(1);
  }
}

// Merge-conflict guard over the precached SOURCE files: a conflicted asset
// would hash "successfully" and get its broken bytes stamped into the
// integrity map. Only text assets can carry git markers (git never merges
// binaries), so fonts/PNGs are skipped. Missing files are computeHash's error.
const TEXT_EXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.svg', '.md', '.map', '.txt', '.webmanifest']);
function checkPrecacheConflictMarkers(urls) {
  for (const url of urls) {
    const file = urlToFile(url);
    if (!TEXT_EXT.has(path.extname(file)) || !fs.existsSync(file)) continue;
    assertNoConflictMarkers(fs.readFileSync(file, 'utf8'), path.relative(ROOT, file));
  }
}

// Hash url + bytes for every precache asset, in declaration order. Missing files
// are a hard error: a precache entry that 404s would break `cache.addAll` and
// abort the whole SW install offline.
function computeHash(urls) {
  const hash = crypto.createHash('sha256');
  const missing = [];
  for (const url of urls) {
    const file = urlToFile(url);
    if (!fs.existsSync(file)) {
      missing.push(url);
      continue;
    }
    hash.update(url, 'utf8');
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  if (missing.length) {
    console.error('Precached asset(s) in sw.js have no matching file on disk:');
    missing.forEach((u) => console.error(`  ${u}  ->  ${path.relative(ROOT, urlToFile(u))}`));
    console.error('Fix the path in PRECACHE_URLS or add the file (a 404 here breaks the offline install).');
    process.exit(1);
  }
  return hash.digest('hex').slice(0, 12);
}

// The per-file integrity map, rendered exactly as it appears in sw.js (one
// full-sha256 entry per URL, declaration order). Runs after computeHash, so
// every file is known to exist.
function renderFileHashes(urls) {
  const entries = urls.map((url) => {
    const hex = crypto.createHash('sha256').update(fs.readFileSync(urlToFile(url))).digest('hex');
    return `  '${url}': '${hex}',`;
  });
  return `const PRECACHE_SHA256 = {\n${entries.join('\n')}\n};`;
}

function main() {
  const check = process.argv.slice(2).includes('--check');

  const swText = fs.readFileSync(SW, 'utf8');
  assertNoConflictMarkers(swText, 'sw.js');
  const m = swText.match(VERSION_RE);
  if (!m) {
    console.error("Could not find `const CACHE_VERSION = '...';` in sw.js.");
    process.exit(1);
  }

  const hm = swText.match(HASHES_RE);
  if (!hm) {
    console.error("Could not find `const PRECACHE_SHA256 = {...};` in sw.js.");
    process.exit(1);
  }

  const current = m[1];
  const urls = parsePrecacheUrls(swText);
  checkPrecacheConflictMarkers(urls);
  checkPrecacheCoversShell(urls);
  const expected = computeHash(urls);
  const currentHashes = hm[0];
  const expectedHashes = renderFileHashes(urls);

  const versionFresh = current === expected;
  const hashesFresh = currentHashes === expectedHashes;
  if (versionFresh && hashesFresh) {
    console.log(`Service worker cache version up to date (${expected}).`);
    return;
  }

  if (check) {
    const what = [
      versionFresh ? null : `cache version (sw.js has '${current}', expected '${expected}')`,
      hashesFresh ? null : 'PRECACHE_SHA256 integrity map',
    ].filter(Boolean).join(' and ');
    console.error(
      `Service worker generated block(s) stale: ${what}.\n` +
      'Run `npm run build:sw` and commit the result so returning browsers fetch the new assets.',
    );
    process.exit(1);
  }

  fs.writeFileSync(
    SW,
    swText
      .replace(VERSION_RE, `const CACHE_VERSION = '${expected}';`)
      .replace(HASHES_RE, expectedHashes),
    'utf8',
  );
  console.log(`Stamped sw.js cache version: '${current}' -> '${expected}' (+ ${urls.length}-entry integrity map).`);
}

main();
