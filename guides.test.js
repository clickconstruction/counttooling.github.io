// Node unit tests (node --test, runs in `npm run check` / CI) for the generated
// Help/Guides output: per-page SEO invariants, internal-link integrity, and that the
// sitemap matches the generated guide pages. No browser — reads the committed files.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const GUIDES_DIR = path.join(ROOT, 'guides');

function guidePages() {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name === 'index.html') out.push(p);
    }
  };
  walk(GUIDES_DIR);
  return out;
}

// Map a root-absolute URL path to the file that should serve it.
function urlToFile(urlPath) {
  const clean = urlPath.split(/[?#]/)[0];
  if (clean.endsWith('/')) return path.join(ROOT, clean, 'index.html');
  return path.join(ROOT, clean);
}

const pages = guidePages();

test('guides output exists (run `npm run build:guides`)', () => {
  assert.ok(fs.existsSync(path.join(GUIDES_DIR, 'index.html')), 'guides/index.html missing');
  assert.ok(pages.length >= 1, 'no guide pages generated');
});

test('each guide page has exactly one title + self-referential canonical', () => {
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    assert.equal((html.match(/<title>/g) || []).length, 1, `${file}: expected one <title>`);
    const canon = html.match(/<link rel="canonical" href="(https:\/\/counttooling\.com[^"]*)">/);
    assert.ok(canon, `${file}: missing canonical`);
    // canonical path should match the file's directory under the repo root
    const rel = '/' + path.relative(ROOT, path.dirname(file)).split(path.sep).join('/') + '/';
    assert.ok(canon[1].endsWith(rel), `${file}: canonical ${canon[1]} should end with ${rel}`);
  }
});

test('each guide page has parseable JSON-LD with an @type', () => {
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length >= 1, `${file}: no JSON-LD`);
    for (const b of blocks) {
      const data = JSON.parse(b[1]); // throws on malformed JSON-LD
      assert.ok(data['@type'], `${file}: JSON-LD missing @type`);
    }
  }
});

test('every internal link in the guides resolves to a real file', () => {
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    const hrefs = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
    for (const href of new Set(hrefs)) {
      if (href.startsWith('//') || href.startsWith('/app/')) continue; // app shell not built here
      assert.ok(fs.existsSync(urlToFile(href)), `${file}: broken internal link ${href}`);
    }
  }
});

test('sitemap lists every generated guide page and the home + guides index', () => {
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace('https://counttooling.com', ''));
  assert.ok(locs.includes('/'), 'sitemap missing /');
  assert.ok(locs.includes('/guides/'), 'sitemap missing /guides/');
  for (const file of pages) {
    if (path.dirname(file) === GUIDES_DIR) continue; // index.html itself
    const rel = '/' + path.relative(ROOT, path.dirname(file)).split(path.sep).join('/') + '/';
    assert.ok(locs.includes(rel), `sitemap missing ${rel}`);
  }
});
