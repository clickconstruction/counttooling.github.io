#!/usr/bin/env node
/**
 * Brand-token drift check (DECOMPOSITION_MAP D13).
 *
 * The brand tokens exist in three places that previously had only a "keep in
 * sync" comment guarding them:
 *   1. styles.css `:root`            — the source of truth (the app UI)
 *   2. marketing.css `:root`         — a mirrored subset (landing + /guides/)
 *   3. manifest.webmanifest          — theme_color (= --surface) and
 *      background_color (= --bg), plus every <meta name="theme-color">.
 *
 * Pure verifier in the repo's generator-check idiom (always --check; there is
 * no generation step because each copy has a different format). Exits 1 with
 * every mismatch listed. Run via `npm run check`.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// Parse the FIRST :root { ... } block's simple `--name: #hex;` declarations.
// env()/derived values are skipped — only literal tokens can be mirrored.
function parseRootTokens(css, file) {
  const m = css.match(/:root\s*{([^}]*)}/);
  if (!m) throw new Error('No :root block found in ' + file);
  const tokens = {};
  for (const decl of m[1].split(';')) {
    const dm = decl.match(/--([\w-]+)\s*:\s*([^;]+)/);
    if (!dm) continue;
    const value = dm[2].trim();
    if (value.includes('env(') || value.includes('var(')) continue;
    tokens[dm[1]] = value;
  }
  return tokens;
}

const failures = [];

const appTokens = parseRootTokens(read('styles.css'), 'styles.css');
const marketingTokens = parseRootTokens(read('marketing.css'), 'marketing.css');

// 1. Every marketing token must exist in styles.css with the same value.
for (const [name, value] of Object.entries(marketingTokens)) {
  if (!(name in appTokens)) {
    failures.push(`marketing.css --${name} has no counterpart in styles.css :root`);
  } else if (appTokens[name] !== value) {
    failures.push(`--${name} differs: styles.css '${appTokens[name]}' vs marketing.css '${value}'`);
  }
}

// 2. Manifest colors mirror --surface / --bg.
const manifest = JSON.parse(read('manifest.webmanifest'));
if (manifest.theme_color !== appTokens.surface) {
  failures.push(`manifest.webmanifest theme_color '${manifest.theme_color}' != styles.css --surface '${appTokens.surface}'`);
}
if (manifest.background_color !== appTokens.bg) {
  failures.push(`manifest.webmanifest background_color '${manifest.background_color}' != styles.css --bg '${appTokens.bg}'`);
}

// 3. Every committed <meta name="theme-color"> mirrors --surface.
for (const file of ['index.html', 'app/index.html', 'guides/index.html']) {
  const mm = read(file).match(/<meta name="theme-color" content="([^"]+)"/);
  if (!mm) { failures.push(`${file}: no <meta name="theme-color"> found`); continue; }
  if (mm[1] !== appTokens.surface) {
    failures.push(`${file} theme-color '${mm[1]}' != styles.css --surface '${appTokens.surface}'`);
  }
}

if (failures.length) {
  console.error('Brand tokens have drifted:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`Brand tokens in sync (${Object.keys(marketingTokens).length} mirrored tokens, manifest, ${3} theme-color metas).`);
