#!/usr/bin/env node
/**
 * build-modal-gallery — the modal contact sheet (Modal Gallery, phase 2).
 *
 * Drives the Modal Gallery (/app/?gallery=1, features/modal-gallery.js) headlessly
 * with Chromium from @playwright/test, loads the sample plan, runs every tile's
 * registered opener (each variant of it) and writes one PNG per tile at desktop
 * width and at phone width (the `&narrow=1` page at 375px), plus a contact
 * sheet (`index.html`) and a `manifest.json`. Self-contained: starts a tiny
 * zero-dep static server on a free port, like build-screenshots.js.
 *
 *   npm run build:modal-gallery                       # → contact-sheet/
 *   npm run build:modal-gallery -- --out /tmp/before  # keep a run
 *   npm run build:modal-gallery -- --baseline /tmp/before
 *       # the sheet shows the baseline beside the new shot, row by row, and flags
 *       # the tiles whose PNG changed — a before/after for a styling PR
 *   npm run build:modal-gallery -- --only scaleModal,counterModal --no-populate
 *   npm run build:modal-gallery -- --base-url http://localhost:5502   # a running server
 *   npm run build:modal-gallery -- --widths 768,1024   # extra viewports beside desktop + phone
 *
 * Every shot is also AUDITED: the tile's card is measured for horizontal
 * overflow, for descendants whose text is clipped (scrollWidth past clientWidth
 * with no ellipsis), and for an action row that wrapped onto a second line.
 * Findings ride the manifest and flag the row on the sheet, so "check them all
 * at every viewport" is one command.
 *
 * Manual (a browser, non-deterministic pixels), NOT in `npm run check`, output
 * gitignored (contact-sheet/ — its own dir, because Playwright empties
 * test-results/ on every run). The live gallery is the editing loop; this is
 * the record of it.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf(name); return i === -1 ? dflt : argv[i + 1]; };
const has = (name) => argv.includes(name);
const OUT_DIR = path.resolve(arg('--out', path.join(ROOT, 'contact-sheet')));
const BASELINE = arg('--baseline', null) ? path.resolve(arg('--baseline')) : null;
const ONLY = arg('--only', null) ? new Set(arg('--only').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const POPULATE = !has('--no-populate');
const BASE_URL_ARG = arg('--base-url', null);
const DESKTOP = { width: 1400, height: 900 };
const PHONE = { width: 375, height: 812 };
// Extra viewports (--widths 768,1024): the gallery's own grid at that width, the
// media queries key off it. Labelled w<px> in file names and on the sheet.
const EXTRA = (arg('--widths', '') || '').split(',').map((w) => parseInt(w, 10)).filter((w) => w > 0);
const VIEWPORTS = [
  { key: 'desktop', label: 'desktop (1400)', viewport: DESKTOP, narrow: false },
  ...EXTRA.map((w) => ({ key: 'w' + w, label: w + 'px', viewport: { width: w, height: 900 }, narrow: w < 700 })),
  { key: 'mobile', label: 'phone (375)', viewport: PHONE, narrow: true },
];

// --- tiny static file server (zero deps) --------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function startServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fileFor = (id, variant, width) => `${id}${variant ? '--' + variant.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''}.${width}.png`;

async function openGallery(browser, baseUrl, viewport, narrow, errors) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(`[${narrow ? 'mobile' : 'desktop'}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${narrow ? 'mobile' : 'desktop'}] ${e.message}`));
  await page.goto(baseUrl + '/app/?gallery=1' + (narrow ? '&narrow=1' : ''), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#modalGallery .mg-tile', { timeout: 20000 });
  await page.waitForFunction(() => window.App && window.state && window.App.modalGalleryPopulate);
  // The owner annotation is async (fetches the shell + feature files); the sheet wants it.
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.mg-where')).every((w) => w.textContent), { timeout: 15000 }).catch(() => {});
  if (POPULATE) {
    const r = await page.evaluate(async () => { try { await window.App.modalGalleryLoadSample(); return 'ok'; } catch (e) { return String(e && e.message || e); } });
    if (r !== 'ok') console.warn(`  sample plan not loaded (${r}); state-hungry openers will report in the manifest`);
    await page.waitForTimeout(400);
  }
  return page;
}

async function listTiles(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.mg-tile')).map((t) => ({
    id: t.dataset.id,
    owner: t.dataset.owner || '',
    section: (t.closest('.mg-grid')?.previousElementSibling?.querySelector('h2')?.textContent) || '',
    variants: window.App.modalGalleryOpenerVariants(t.dataset.id),
  })));
}

async function shootTiles(page, tiles, width, manifest) {
  for (const t of tiles) {
    const variants = t.variants.length ? t.variants : [null];
    for (const variant of variants) {
      let populate = null;
      if (POPULATE && t.variants.length) {
        populate = await page.evaluate(([id, v]) => window.App.modalGalleryPopulate(id, v || undefined), [t.id, variant]);
        await page.waitForTimeout(populate.async ? 1200 : 300);
      }
      const file = fileFor(t.id, variant, width);
      const tile = page.locator(`.mg-tile[data-id="${t.id}"]`);
      await tile.scrollIntoViewIfNeeded();
      // An opener that focuses its input leaves a caret; blur so two identical
      // runs shoot the same pixels (Save Status keeps its clock regardless).
      await page.evaluate(() => { const a = document.activeElement; if (a && a !== document.body) a.blur(); });
      await page.waitForTimeout(60);
      await tile.screenshot({ path: path.join(OUT_DIR, file), animations: 'disabled' });
      const err = await page.locator(`.mg-tile[data-id="${t.id}"] .mg-err`).textContent().catch(() => '');
      const entry = manifest.get(t.id + '|' + (variant || ''));
      entry.files[width] = file;
      if (populate) entry.populate[width] = err ? { ran: false, reason: err } : populate;
      entry.audit[width] = await page.evaluate((id) => {
        const tileEl = document.querySelector(`.mg-tile[data-id="${id}"] .mg-tile-body`);
        const card = tileEl && (tileEl.querySelector('.modal-card') || tileEl.firstElementChild);
        if (!card) return null;
        const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const findings = [];
        if (card.scrollWidth > card.clientWidth + 1) findings.push('card overflows by ' + (card.scrollWidth - card.clientWidth) + 'px');
        const cardRect = card.getBoundingClientRect();
        let clipped = 0, past = 0;
        card.querySelectorAll('*').forEach((el) => {
          if (!vis(el)) return;
          const cs = getComputedStyle(el);
          if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis' && !el.matches('input, textarea, select, .icon-grid, [class*="scroll"], .modal-flex-scroll')) clipped++;
          const r = el.getBoundingClientRect();
          const scroller = el.parentElement && el.parentElement.closest('[class*="scroll"], .kb-board, .icon-grid');   // inside a scroll container is by design
          if (r.right > cardRect.right + 2 && cs.position !== 'fixed' && cs.position !== 'absolute' && !scroller) past++;
        });
        if (clipped) findings.push(clipped + ' clipped element' + (clipped > 1 ? 's' : ''));
        if (past) findings.push(past + ' element' + (past > 1 ? 's' : '') + ' past the card edge');
        card.querySelectorAll('.actions').forEach((row) => {
          if (!vis(row)) return;
          const btns = Array.from(row.querySelectorAll('button:not(.link)')).filter(vis);   // a .link may take its own line by design
          if (btns.length < 2) return;
          const tops = btns.map((b) => b.getBoundingClientRect().top);
          const tallest = Math.max(...btns.map((b) => b.getBoundingClientRect().height));
          if (Math.max(...tops) - Math.min(...tops) > tallest * 0.6) findings.push('action row wraps (' + btns.length + ' buttons)');
        });
        return findings;
      }, t.id);
    }
  }
}

function buildSheet(entries, errors, baseUrl) {
  const hasBase = !!BASELINE;
  const rows = entries.map((e) => {
    const cell = (width) => {
      const file = e.files[width];
      if (!file) return '<td class="miss">no shot</td>';
      const fresh = path.join(OUT_DIR, file);
      let changed = null, baseImg = '';
      if (hasBase) {
        const old = path.join(BASELINE, file);
        if (fs.existsSync(old)) {
          changed = !fs.readFileSync(old).equals(fs.readFileSync(fresh));
          baseImg = `<td class="base ${changed ? 'changed' : 'same'}"><img loading="lazy" src="${esc(path.relative(OUT_DIR, old))}" alt="baseline ${esc(file)}"></td>`;
        } else baseImg = '<td class="miss">no baseline</td>';
      }
      const badge = changed === null ? '' : `<span class="badge ${changed ? 'changed' : 'same'}">${changed ? 'changed' : 'same'}</span>`;
      const pop = e.populate[width];
      const popNote = pop && !pop.ran ? `<div class="note">populate: ${esc(pop.reason)}</div>` : '';
      const audit = e.audit[width] || [];
      const auditNote = audit.length ? `<div class="audit">${audit.map(esc).join(' · ')}</div>` : '';
      return `${baseImg}<td class="${changed ? 'changed' : ''} ${audit.length ? 'flagged' : ''}">${badge}${auditNote}<img loading="lazy" src="${esc(file)}" alt="${esc(file)}">${popNote}</td>`;
    };
    return `<tr id="${esc(e.id)}"><th><code>#${esc(e.id)}</code>${e.variant ? `<span class="variant">${esc(e.variant)}</span>` : ''}<div class="owner">${esc(e.owner)}</div><div class="section">${esc(e.section)}</div></th>${VIEWPORTS.map((vp) => cell(vp.key)).join('')}</tr>`;
  }).join('\n');
  const flagged = entries.reduce((n, e) => n + VIEWPORTS.filter((vp) => (e.audit[vp.key] || []).length).length, 0);
  const changedCount = hasBase ? entries.reduce((n, e) => n + VIEWPORTS.map((vp) => vp.key).filter((w) => { const f = e.files[w]; if (!f) return false; const old = path.join(BASELINE, f); return fs.existsSync(old) && !fs.readFileSync(old).equals(fs.readFileSync(path.join(OUT_DIR, f))); }).length, 0) : null;
  const head = '<tr><th>modal</th>' + VIEWPORTS.map((vp) => (hasBase ? `<th>${esc(vp.label)} · baseline</th>` : '') + `<th>${esc(vp.label)}</th>`).join('') + '</tr>';
  return `<!doctype html>
<meta charset="utf-8">
<title>Modal contact sheet · CountTooling</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 20px; background: #111; color: #ddd; font: 14px/1.4 system-ui, sans-serif; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #999; font-size: 12px; margin-bottom: 16px; }
  .meta b { color: #e8c547; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  thead th:first-child { width: 220px; }
  th, td { border-top: 1px solid #333; padding: 10px 8px; vertical-align: top; text-align: left; }
  thead th { position: sticky; top: 0; background: #1a1a1a; z-index: 1; font-size: 12px; color: #aaa; }
  tbody th { font-weight: 500; overflow-wrap: anywhere; }
  tbody th code { color: #fff; font-size: 13px; }
  .variant { display: inline-block; margin-left: 6px; padding: 1px 6px; border: 1px solid #555; border-radius: 999px; font-size: 11px; color: #ccc; }
  .owner, .section { font: 11px ui-monospace, monospace; color: #888; margin-top: 4px; }
  td img { max-width: 100%; height: auto; display: block; border: 1px solid #2a2a2a; border-radius: 4px; background: #0d0d0d; }
  td.miss { color: #666; font-size: 12px; }
  td.changed { outline: 2px solid #e8c547; outline-offset: -2px; }
  td.flagged { outline: 2px solid #e85447; outline-offset: -2px; }
  .audit { margin-bottom: 6px; font: 11px ui-monospace, monospace; color: #f0a0a0; }
  .badge { display: inline-block; margin-bottom: 6px; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge.changed { background: #e8c547; color: #111; }
  .badge.same { background: #2a2a2a; color: #888; }
  .note { margin-top: 6px; font: 11px ui-monospace, monospace; color: #e85447; }
  .errors { margin: 0 0 16px; padding: 10px 12px; background: #2a1414; border: 1px solid #5a2323; border-radius: 6px; font: 12px ui-monospace, monospace; color: #f0a0a0; white-space: pre-wrap; }
  .filter { margin-bottom: 12px; }
  .filter input { padding: 6px 10px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #eee; font: inherit; width: 320px; }
  tr.hidden { display: none; }
</style>
<h1>Modal contact sheet</h1>
<div class="meta">${entries.length} shots · built ${esc(new Date().toISOString())} from <b>${esc(baseUrl)}</b>${hasBase ? ` · baseline <b>${esc(BASELINE)}</b> · <b>${changedCount}</b> changed` : ''} · <b>${flagged}</b> shots flagged by the layout audit${POPULATE ? '' : ' · openers not run (--no-populate)'}</div>
${errors.length ? `<div class="errors">console errors while shooting:\n${esc(errors.join('\n'))}</div>` : ''}
<div class="filter"><input type="search" placeholder="Filter by id or owner…" oninput="for (const r of document.querySelectorAll('tbody tr')) r.classList.toggle('hidden', !!this.value && !r.textContent.toLowerCase().includes(this.value.toLowerCase()))"></div>
<table><thead>${head}</thead><tbody>
${rows}
</tbody></table>
`;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (BASELINE && !fs.existsSync(BASELINE)) { console.error(`--baseline ${BASELINE} does not exist`); process.exit(1); }
  if (POPULATE && !fs.existsSync(path.join(ROOT, 'samples', 'sample-plan.pdf'))) console.warn('samples/sample-plan.pdf is missing (npm run build:sample-plan); shooting without the sample takeoff.');
  let server = null, baseUrl = BASE_URL_ARG;
  if (!baseUrl) { const s = await startServer(); server = s.server; baseUrl = `http://127.0.0.1:${s.port}`; }
  const browser = await chromium.launch();
  const errors = [];
  const manifest = new Map();
  try {
    const desktop = await openGallery(browser, baseUrl, DESKTOP, false, errors);
    let tiles = await listTiles(desktop);
    if (ONLY) tiles = tiles.filter((t) => ONLY.has(t.id));
    if (!tiles.length) throw new Error('no tiles matched');
    for (const t of tiles) for (const v of (t.variants.length ? t.variants : [null])) manifest.set(t.id + '|' + (v || ''), { id: t.id, variant: v, owner: t.owner, section: t.section, files: {}, populate: {}, audit: {} });
    console.log(`${tiles.length} tiles · desktop ${DESKTOP.width}px`);
    await shootTiles(desktop, tiles, 'desktop', manifest);
    await desktop.close();
    for (const vp of VIEWPORTS.slice(1)) {
      console.log(`${tiles.length} tiles · ${vp.label}`);
      const pg = await openGallery(browser, baseUrl, vp.viewport, vp.narrow, errors);
      await shootTiles(pg, tiles, vp.key, manifest);
      await pg.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  const entries = Array.from(manifest.values());
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ builtAt: new Date().toISOString(), baseUrl, baseline: BASELINE, populate: POPULATE, errors, tiles: entries }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), buildSheet(entries, errors, baseUrl));
  const keys = VIEWPORTS.map((vp) => vp.key);
  const refused = entries.flatMap((e) => keys.filter((w) => e.populate[w] && !e.populate[w].ran).map((w) => `${e.id}${e.variant ? ' (' + e.variant + ')' : ''} [${w}]: ${e.populate[w].reason}`));
  if (refused.length) console.log(`openers that refused (${refused.length}):\n  ` + refused.join('\n  '));
  const flags = entries.flatMap((e) => keys.filter((w) => (e.audit[w] || []).length).map((w) => `${e.id}${e.variant ? ' (' + e.variant + ')' : ''} [${w}]: ${e.audit[w].join(', ')}`));
  if (flags.length) console.log(`layout audit flagged (${flags.length}):\n  ` + flags.join('\n  ')); else console.log('layout audit: clean at every viewport');
  if (errors.length) console.log(`console errors (${errors.length}):\n  ` + errors.join('\n  '));
  console.log(`wrote ${entries.length} rows → ${path.join(OUT_DIR, 'index.html')}`);
})().catch((e) => { console.error(e); process.exit(1); });
