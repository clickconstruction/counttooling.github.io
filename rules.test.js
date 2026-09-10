// Node unit tests (node --test, runs in `npm run check` / CI) for the rulebook:
// the sources parse and validate, every code pointer resolves and agrees with its
// rule, the generated pages carry the SEO invariants, rules.json is well-formed and
// complete, and the sitemap lists every rule page. No browser — reads committed files.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadRules, driftCheck, toJson, parseYamlSubset, resolvePointer } = require('./scripts/lib/rules');

const ROOT = __dirname;
const rules = loadRules();

test('the front-matter subset parses scalars, inline lists, block maps and lists of maps', () => {
  const m = parseYamlSubset('id: a.b\nn: 1.5\nflag: true\nlist: [2017, x, "y"]\nmap:\n  k: v\n  q: "quoted: colon"\nrows:\n  - when: one\n    value: 53\n  - two\n');
  assert.deepStrictEqual(m, { id: 'a.b', n: 1.5, flag: true, list: [2017, 'x', 'y'], map: { k: 'v', q: 'quoted: colon' }, rows: [{ when: 'one', value: 53 }, 'two'] });
});

test('every rule loads, validates, and has a unique dotted id', () => {
  assert.ok(rules.length >= 10, 'expected the slice-1 rule set');
  const ids = new Set(rules.map((r) => r.id));
  assert.strictEqual(ids.size, rules.length);
  for (const r of rules) assert.ok(r.values.length >= 1, r.id);
});

test('every code pointer resolves and agrees with its rule (the drift check)', () => {
  const d = driftCheck(rules);
  assert.deepStrictEqual(d.problems, []);
  assert.ok(d.checked >= 30, 'expected the slice-1 pointers');
  // an applied rule must be pinned to code somewhere
  for (const r of rules.filter((x) => x.status === 'applied')) assert.ok(r.values.some((v) => v.code), `${r.id}: applied but no code pointer`);
});

test('pointer resolution walks exports without eval and rejects the unknown', () => {
  assert.strictEqual(resolvePointer('constants.js#DEFAULT_MAKE_UP_FT'), 1);
  assert.strictEqual(resolvePointer('bid-check-model.js#fillLimitFor(2)'), 0.31);
  assert.strictEqual(resolvePointer('duct-model.js#DUCT_GAUGE_TABLE["1"][0].gauge'), 26);
  assert.throws(() => resolvePointer('constants.js#NOPE'), /does not export/);
  assert.throws(() => resolvePointer('constants.js#DEFAULT_MAKE_UP_FT.x.y'), /undefined/);
});

test('rules.json is generated, complete, and carries no prose', () => {
  const file = path.join(ROOT, 'rules', 'rules.json');
  assert.ok(fs.existsSync(file), 'rules/rules.json missing (run `npm run build:rules`)');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(json.rules, toJson(rules));
  for (const r of json.rules) {
    assert.ok(!('body' in r) && !('file' in r), `${r.id}: prose leaked into rules.json`);
    assert.ok(r.url.startsWith('/rules/'), r.id);
    assert.ok(fs.existsSync(path.join(ROOT, r.url, 'index.html')), `${r.url} page missing`);
  }
});

test('each rule page has one title, a self-referential canonical, and the drift-safe value', () => {
  for (const r of rules) {
    const html = fs.readFileSync(path.join(ROOT, r.url, 'index.html'), 'utf8');
    assert.strictEqual((html.match(/<title>/g) || []).length, 1, r.url);
    assert.ok(html.includes(`<link rel="canonical" href="https://counttooling.com${r.url}">`), r.url);
    for (const v of r.values) assert.ok(html.includes(`<span class="rule-value">${v.value}</span>`), `${r.url}: value ${v.value} not rendered`);
    assert.ok(html.includes('href="/rules/"'), `${r.url}: no way back to the index`);
  }
});

test('the index lists every rule and the sitemap lists every rule page', () => {
  const index = fs.readFileSync(path.join(ROOT, 'rules', 'index.html'), 'utf8');
  for (const r of rules) assert.ok(index.includes(`href="${r.url}"`), `index missing ${r.url}`);
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  assert.ok(sitemap.includes('<loc>https://counttooling.com/rules/</loc>'));
  for (const r of rules) assert.ok(sitemap.includes(`<loc>https://counttooling.com${r.url}</loc>`), `sitemap missing ${r.url}`);
});
