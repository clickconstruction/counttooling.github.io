// Node tests for scripts/build-sw.js (R06): PRECACHE_URLS is DERIVED from
// app/index.html's tags (+ fonts.css, the manifest and PRECACHE_EXTRA), so a
// shell file that has only its tag is precached on the next build:sw, and
// --check fails until then; and --resolve settles a stamp-only merge conflict.
// Run with: npm run test:unit (node:test, no deps). The CLI cases run the real
// script against a scratch COPY of sw.js (--sw), never the committed file.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  PRECACHE_EXTRA, shellTagUrls, fontUrls, manifestIconUrls,
  derivePrecacheGroups, parsePrecacheUrls, stamp, conflictSides, resolveConflicted,
} = require('./scripts/build-sw.js');

const ROOT = __dirname;
const SCRIPT = path.join(ROOT, 'scripts', 'build-sw.js');
const SW_TEXT = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
// Built by concatenation so this file never holds a literal column-0 conflict marker.
const OURS = '<'.repeat(7) + ' HEAD';
const BASE = '|'.repeat(7) + ' merged common ancestors';
const MID = '='.repeat(7);
const THEIRS = '>'.repeat(7) + ' claude/other-branch';

// A fresh stamp of the committed sw.js, so each case starts from a known-good text
// whatever state the working copy is in.
const FRESH = stamp(SW_TEXT).next;

function scratchSw(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-sw-test-'));
  const file = path.join(dir, 'sw.js');
  fs.writeFileSync(file, text, 'utf8');
  return file;
}
function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' });
}
function dropUrlLine(text, url) {
  const line = `  '${url}',\n`;
  const start = text.indexOf('const PRECACHE_URLS = [');
  const at = text.indexOf(line, start);
  assert.ok(at > start, `fixture: ${url} is in PRECACHE_URLS`);
  return text.slice(0, at) + text.slice(at + line.length);
}

test('shellTagUrls: root-absolute script/link refs in document order, remote skipped, relative refused', () => {
  const html = '<link rel="canonical" href="https://x.test/app/"><link rel="stylesheet" href="/a.css">'
    + '<script src="/b.js"></script><script defer src="/c.js"></script><script src="/b.js"></script>';
  assert.deepStrictEqual(shellTagUrls(html), ['/a.css', '/b.js', '/c.js']);
  assert.throws(() => shellTagUrls('<script src="app.js"></script>'), /relative path/);
});

test('fontUrls and manifestIconUrls resolve their refs to root-absolute URLs', () => {
  assert.deepStrictEqual(
    fontUrls("@font-face{src:url(a.woff2)} @font-face{src:url('/x/b.woff2')} @font-face{src:url(data:font/woff2;base64,AA)}"),
    ['/vendor/fonts/a.woff2', '/x/b.woff2'],
  );
  assert.deepStrictEqual(manifestIconUrls('{"icons":[{"src":"/i/a.png"},{"src":"i/b.png"}]}'), ['/i/a.png', '/i/b.png']);
});

test('the derived list holds every shell tag, every font file, every manifest icon and every PRECACHE_EXTRA entry, once', () => {
  const urls = derivePrecacheGroups().flatMap((g) => g.urls);
  assert.strictEqual(new Set(urls).size, urls.length, 'no duplicates');
  const html = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');
  for (const u of shellTagUrls(html)) assert.ok(urls.includes(u), `shell tag ${u}`);
  for (const f of fs.readdirSync(path.join(ROOT, 'vendor', 'fonts'))) assert.ok(urls.includes(`/vendor/fonts/${f}`), `font ${f}`);
  for (const u of manifestIconUrls(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'))) assert.ok(urls.includes(u), `icon ${u}`);
  for (const u of PRECACHE_EXTRA) assert.ok(urls.includes(u), `extra ${u}`);
  // The worker the render service builds and the offline shell itself are the reasons
  // PRECACHE_EXTRA exists; pin them by name so a trim of the list is a visible choice.
  for (const u of ['/app/', '/app/index.html', '/render-worker.js', '/vendor/pdf.worker.min-3.11.174.js', '/rules/rules.json']) {
    assert.ok(PRECACHE_EXTRA.includes(u), `PRECACHE_EXTRA keeps ${u}`);
  }
});

test('a fresh stamp is a fixed point', () => {
  const again = stamp(FRESH);
  assert.strictEqual(again.fresh, true);
  assert.strictEqual(again.next, FRESH);
});

test('--check fails, naming the file, when a shell tag is missing from PRECACHE_URLS', () => {
  const file = scratchSw(dropUrlLine(FRESH, '/app.js'));
  const r = run(['--check', '--sw', file]);
  assert.notStrictEqual(r.status, 0, 'stale list must fail the check');
  assert.match(r.stderr, /PRECACHE_URLS/);
  assert.match(r.stderr, /\+ \/app\.js/);
  // and the plain build puts it back
  assert.strictEqual(run(['--sw', file]).status, 0);
  assert.ok(parsePrecacheUrls(fs.readFileSync(file, 'utf8')).includes('/app.js'));
  assert.strictEqual(run(['--check', '--sw', file]).status, 0);
});

test('PRECACHE_EXTRA entries survive a restamp even when sw.js lost them', () => {
  let text = FRESH;
  for (const u of PRECACHE_EXTRA) text = dropUrlLine(text, u);
  const file = scratchSw(text);
  assert.notStrictEqual(run(['--check', '--sw', file]).status, 0);
  assert.strictEqual(run(['--sw', file]).status, 0);
  const urls = parsePrecacheUrls(fs.readFileSync(file, 'utf8'));
  for (const u of PRECACHE_EXTRA) assert.ok(urls.includes(u), `restamped list keeps ${u}`);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), FRESH);
});

// Wrap one line of the text in a conflict hunk whose other side is `theirs`.
function conflictAt(text, line, theirs, { diff3 = false } = {}) {
  assert.ok(text.includes(line + '\n'), `fixture: ${line}`);
  const hunk = [OURS, line, ...(diff3 ? [BASE, line] : []), MID, theirs, THEIRS].join('\n');
  return text.replace(line + '\n', () => hunk + '\n');
}

test('conflictSides splits both sides and drops a diff3 base section', () => {
  const t = ['a', OURS, 'o', BASE, 'b', MID, 't', THEIRS, 'z'].join('\n');
  assert.deepStrictEqual(conflictSides(t), { ours: 'a\no\nz', theirs: 'a\nt\nz' });
});

test('--resolve settles a conflict inside the generated blocks and restamps', () => {
  const versionLine = FRESH.match(/const CACHE_VERSION = '[^']*';/)[0];
  const hashLine = FRESH.split('\n').find((l) => l.startsWith("  '/app.js': '"));
  let text = conflictAt(FRESH, versionLine, "const CACHE_VERSION = 'deadbeef0000';", { diff3: true });
  text = conflictAt(text, hashLine, `  '/app.js': '${'0'.repeat(64)}',`);
  text = conflictAt(text, "  '/report.js',", "  '/features/from-the-other-branch.js',\n  '/report.js',");
  assert.strictEqual(resolveConflicted(text).includes(OURS), false);
  const file = scratchSw(text);
  const r = run(['--resolve', '--sw', file]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), FRESH);
});

test('--resolve refuses a conflict in the hand-written code and leaves the file alone', () => {
  const line = "const CACHE_NAME = `counttooling-shell-${CACHE_VERSION}`;";
  const text = conflictAt(FRESH, line, "const CACHE_NAME = `other-shell-${CACHE_VERSION}`;");
  assert.throws(() => resolveConflicted(text), /outside its generated blocks/);
  const file = scratchSw(text);
  const r = run(['--resolve', '--sw', file]);
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /by hand/);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), text);
});

test('without --resolve a conflicted sw.js is refused, as before', () => {
  const versionLine = FRESH.match(/const CACHE_VERSION = '[^']*';/)[0];
  const text = conflictAt(FRESH, versionLine, "const CACHE_VERSION = 'deadbeef0000';");
  const file = scratchSw(text);
  const r = run(['--sw', file]);
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /conflict marker/);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), text);
});
