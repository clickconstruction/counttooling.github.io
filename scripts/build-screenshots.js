#!/usr/bin/env node
/**
 * Generates annotated screenshots for the /guides/ help articles. Drives the real app
 * headlessly (Chromium from @playwright/test) onto the synthetic samples/sample-plan.pdf,
 * injects takeoff markup / opens dialogs, overlays numbered callouts + highlight boxes
 * anchored to real DOM elements, and writes guides/img/<name>.png.
 *
 * Self-contained: starts a tiny zero-dep static server on a free port, so it needs no
 * running dev server and no extra dependency. Run manually (it's NOT in `npm run check`
 * — it needs a browser, and PNG pixels aren't deterministic across machines):
 *
 *   npm run build:screenshots
 *
 * To add a screenshot: add an entry to SHOTS, run this, and reference
 * /guides/img/<name>.png in a content/guides/*.md article.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'guides', 'img');
const PLAN = path.join(ROOT, 'samples', 'sample-plan.pdf');
const ACCENT = '#e8c547';

// A round circle icon path (viewBox ~0..640) for the demo counters.
const DOT = 'M320 96C196 96 96 196 96 320s100 224 224 224 224-100 224-224S444 96 320 96z';

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

// Draws numbered badges + highlight boxes over the page (runs in the browser).
// items: [{type:'badge', n, x, y} | {type:'box', x, y, w, h}] in viewport coords.
async function drawOverlays(page, items, accent) {
  if (!items.length) return;
  await page.evaluate(({ items, accent }) => {
    const root = document.createElement('div');
    root.id = '__shot_overlay';
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    for (const it of items) {
      const el = document.createElement('div');
      if (it.type === 'box') {
        el.style.cssText = `position:absolute;left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px;border:3px solid ${accent};border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.45);`;
        if (it.label) {
          const lab = document.createElement('div');
          lab.textContent = it.label;
          // Place the label above the box, but drop it below if that would clip past the top edge.
          const labTop = it.y - 30 < 2 ? it.y + it.h + 8 : it.y - 30;
          lab.style.cssText = `position:absolute;left:${it.x}px;top:${labTop}px;background:${accent};color:#161617;font:600 15px/1 'DM Sans',system-ui,sans-serif;padding:6px 10px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5);`;
          root.appendChild(lab);
        }
      } else {
        el.textContent = String(it.n);
        el.style.cssText = `position:absolute;left:${it.x - 17}px;top:${it.y - 17}px;width:34px;height:34px;border-radius:50%;background:${accent};color:#161617;font:700 19px/34px 'DM Sans',system-ui,sans-serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.5);`;
      }
      root.appendChild(el);
    }
    document.body.appendChild(root);
  }, { items, accent });
}

// Lay a sample takeoff onto the plan: counters on the restroom fixtures (placed as
// fractions of the real PDF page size, read from pdf.js, so they land regardless of the
// page's point/pixel scale), a measured waste line, a page scale, and the legend.
async function takeoffSetup(page) {
  await page.evaluate((dot) => {
    const s = window.state, App = window.App, uid = () => App.uid();
    const vp = s.pages[0].pdfPage.getViewport({ scale: 1 });
    const pw = vp.width, ph = vp.height;
    const wc = uid(), lav = uid(), lt = uid();
    s.counters.push({ id: wc, name: 'Water Closet', icon: dot, color: '#e8c547', size: 16 });
    s.counters.push({ id: lav, name: 'Lavatory', icon: dot, color: '#4a9eff', size: 16 });
    s.lineTypes.push({ id: lt, name: 'Waste line', color: '#47c88e', curveStyle: 'straight' });
    const ann = s.pages[0].canvases[0].annotations;
    const wcX = [0.3717, 0.4003, 0.4289, 0.5310, 0.5596, 0.5882, 0.6168];
    const lavX = [0.3676, 0.3962, 0.4248, 0.5270, 0.5556, 0.5841, 0.6127];
    ann.counterMarkers[wc] = wcX.map((fx) => ({ x: fx * pw, y: 0.4962 * ph, id: uid(), group: null }));
    ann.counterMarkers[lav] = lavX.map((fx) => ({ x: fx * pw, y: 0.7134 * ph, id: uid(), group: null }));
    ann.quickLines.push({ id: uid(), x1: 0.372 * pw, y1: 0.655 * ph, x2: 0.617 * pw, y2: 0.655 * ph, lineTypeId: lt, color: '#47c88e', group: null });
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
    App.fitZoom();
    App.renderPdf();
    App.updateUI();
  }, DOT);
  await page.waitForTimeout(350);
}

// Lay two finished room boxes onto the plan (Room Sizer guide), aligned with the
// sample plan's real rooms (Office 101 and Conference 103) so the boxes read as
// tracing actual rooms. The legend is nudged left so it isn't clipped at the edge.
async function roomSetup(page) {
  await page.evaluate(() => {
    const s = window.state, App = window.App, uid = () => App.uid();
    const vp = s.pages[0].pdfPage.getViewport({ scale: 1 });
    const pw = vp.width, ph = vp.height;
    const office = uid(), conf = uid();
    s.rooms.push({ id: office, name: 'Office 101', color: '#e85447' });
    s.rooms.push({ id: conf, name: 'Conference 103', color: '#4a9eff' });
    const ann = s.pages[0].canvases[0].annotations;
    ann.roomBoxes.push({ id: uid(), x1: 0.135 * pw, y1: 0.175 * ph, x2: 0.345 * pw, y2: 0.41 * ph, heightFt: 9.5, roomId: office });
    ann.roomBoxes.push({ id: uid(), x1: 0.575 * pw, y1: 0.175 * ph, x2: 0.755 * pw, y2: 0.41 * ph, heightFt: 8, roomId: conf });
    ann.legend = { x: pw - 210, y: 16, w: 195, h: 60, userResized: false };
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
    App.fitZoom();
    App.renderPdf();
    App.updateUI();
  });
  await page.waitForTimeout(350);
}

// --- shot manifest ------------------------------------------------------------
// clip: a selector whose bounding box is captured.
// callouts: [{ n, sel?, x?, y? }]  (sel → anchored to that element; else x/y are
//           relative to the clip box). boxes: [{ sel?, rect? }].
const SHOTS = [
  // Marketing landing hero: the whole app with a takeoff on it (no callouts) → /img/.
  { name: 'landing-hero', dir: 'img', clip: '.app', setup: takeoffSetup },

  // The plan with a takeoff on it — clean hero (markup + legend speak for themselves).
  { name: 'plan-takeoff', clip: '#canvasWrapper', setup: takeoffSetup },

  // Offline/installing guide: the header save-&-sync indicator, highlighted.
  {
    name: 'offline-save-status',
    clip: '.app',
    async setup(page) {
      await takeoffSetup(page);
      // The save/sync indicator only shows for signed-in cloud users — surface it so the
      // shot depicts the signed-in (sync-capable) state the offline guide describes.
      await page.evaluate(() => {
        const b = document.querySelector('#saveStatusBtnHeader');
        if (b) { b.style.display = 'inline-flex'; b.classList.remove('supabase-only'); }
      });
      await page.waitForTimeout(120);
    },
    boxes: [{ sel: '#saveStatusBtnHeader', label: 'Save & sync status' }],
  },

  // Offline/installing guide: the whole app on a tablet (portrait viewport).
  { name: 'on-a-tablet', clip: '.app', viewport: { width: 1024, height: 1366 }, setup: takeoffSetup },

  // The same takeoff, framed to show the live tally in the sidebar.
  {
    name: 'counting',
    clip: '.app',
    setup: takeoffSetup,
    boxes: [{ sel: '#countersSection' }],
  },

  // Set Scale dialog — the three ways to calibrate.
  {
    name: 'set-scale',
    clip: '#scaleModal',
    async setup(page) {
      await page.evaluate(() => window.App.openScaleModal && window.App.openScaleModal());
      await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
      await page.waitForTimeout(150);
    },
    callouts: [
      { n: 1, sel: '#scaleModal >> text=Select two points' },
      { n: 2, sel: '#scaleModal >> text=Architectural' },
      { n: 3, sel: '#scaleModal input[placeholder*="0.25"]' },
    ],
  },

  // Export PDFs dialog — sizes, what to include, and download.
  {
    name: 'export-pdfs',
    clip: '#specificPagesModal',
    async setup(page) {
      await page.evaluate(() => window.App.openSpecificPagesModal && window.App.openSpecificPagesModal());
      await page.waitForSelector('#specificPagesModal.visible', { timeout: 5000 });
      await page.waitForTimeout(150);
    },
    callouts: [
      { n: 1, sel: '#specificPagesModal >> text=Marker size' },
      { n: 2, sel: '#specificPagesModal >> text=Include takeoff report' },
      { n: 3, sel: '#specificPagesModal >> text=Download' },
    ],
  },

  // Scale zone vs multiply zone — concept boxes on the bare plan.
  {
    name: 'zones',
    clip: '#canvasWrapper',
    async setup(page) {
      await page.evaluate(() => { window.App.fitZoom(); window.App.renderPdf(); });
      await page.waitForTimeout(250);
    },
    boxes: [
      { rect: { x: 0.12, y: 0.14, w: 0.64, h: 0.29 }, label: 'Multiply zone ×3' },
      { rect: { x: 0.345, y: 0.43, w: 0.165, h: 0.29 }, label: 'Scale zone' },
    ],
  },

  // Room Sizer guide: two labeled room boxes on the plan + the Rooms sidebar tally.
  {
    name: 'room-sizer',
    clip: '.app',
    setup: roomSetup,
    boxes: [{ sel: '#roomsSection' }],
  },

  // Room Size dialog — dims table, ceiling height, Add to Room list.
  {
    name: 'room-size-modal',
    clip: '#roomBoxModal',
    async setup(page) {
      await roomSetup(page);
      await page.evaluate(() => {
        const vp = window.state.pages[0].pdfPage.getViewport({ scale: 1 });
        window.App.openRoomBoxModal({ x1: 0.13 * vp.width, y1: 0.5 * vp.height, x2: 0.38 * vp.width, y2: 0.72 * vp.height });
        const h = document.getElementById('roomBoxHeight');
        h.value = "9'6";
        h.dispatchEvent(new Event('input'));
      });
      await page.waitForSelector('#roomBoxModal.visible', { timeout: 5000 });
      await page.waitForTimeout(150);
    },
    callouts: [
      { n: 1, sel: '#roomBoxModal >> text=Totals' },
      { n: 2, sel: '#roomBoxModal >> text=Ceiling height' },
      { n: 3, sel: '#roomBoxModal >> text=Add to Room' },
    ],
  },

  // Counter create dialog — name, color, custom icon.
  {
    name: 'counter-create',
    clip: '#counterModal',
    async setup(page) {
      // Use the real opener (#addCounter) so the icon grid + color picker populate.
      await page.evaluate(() => { const b = document.querySelector('#addCounter'); if (b) b.click(); });
      await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
      await page.evaluate(() => window.App.showCounterTab && window.App.showCounterTab('create'));
      await page.waitForTimeout(300);
    },
    callouts: [
      { n: 1, sel: '#counterModal >> text=Name' },
      { n: 2, sel: '#counterModal >> text=Custom Icons' },
      { n: 3, sel: '#counterModal >> text=Color' },
    ],
  },

  // Choose / Create Line Type dialog.
  {
    name: 'line-types',
    clip: '#chooseLineTypeModal',
    async setup(page) {
      await page.evaluate(() => {
        window.App.showChooseLineTypeModal && window.App.showChooseLineTypeModal();
        window.App.showLineTypeTab && window.App.showLineTypeTab('create');
      });
      await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 5000 });
      await page.waitForTimeout(250);
    },
    callouts: [
      { n: 1, sel: '#chooseLineTypeModal >> text=Name' },
      { n: 2, sel: '#chooseLineTypeModal >> text=Display' },
      { n: 3, sel: '#chooseLineTypeModal >> text=Color' },
    ],
  },
];

async function loadApp(page, baseUrl) {
  await page.goto(baseUrl + '/app/', { waitUntil: 'networkidle' });
  await page.locator('#pdfInput').setInputFiles(PLAN);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); return c && c.width > 0; }, { timeout: 15000 });
  // dismiss any restore/last-session prompt that could cover the canvas
  await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => m.classList.remove('visible')));
}

(async () => {
  if (!fs.existsSync(PLAN)) { console.error('Missing samples/sample-plan.pdf — run `npm run build:sample-plan` first.'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Optional CLI args = shot name(s) to (re)build; default builds all.
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const shots = only.length ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS;
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  try {
    for (const shot of shots) {
      const page = await browser.newPage({ viewport: shot.viewport || { width: 1380, height: 900 }, deviceScaleFactor: 2 });
      await loadApp(page, baseUrl);
      if (shot.setup) await shot.setup(page);
      const clip = await page.locator(shot.clip).boundingBox();
      if (!clip) throw new Error(`${shot.name}: clip ${shot.clip} not found`);
      const items = [];
      for (const c of shot.callouts || []) {
        if (c.sel) {
          const b = await page.locator(c.sel).first().boundingBox().catch(() => null);
          if (!b) { console.warn(`  ! ${shot.name}: callout target ${c.sel} not found, skipping #${c.n}`); continue; }
          items.push({ type: 'badge', n: c.n, x: b.x, y: b.y });
        } else { items.push({ type: 'badge', n: c.n, x: clip.x + c.x, y: clip.y + c.y }); }
      }
      for (const bx of shot.boxes || []) {
        if (bx.sel) {
          const b = await page.locator(bx.sel).first().boundingBox().catch(() => null);
          if (b) items.push({ type: 'box', label: bx.label, x: b.x - 4, y: b.y - 4, w: b.width + 8, h: b.height + 8 });
        } else {
          const r = bx.rect;
          items.push({ type: 'box', label: bx.label, x: clip.x + r.x * clip.width, y: clip.y + r.y * clip.height, w: r.w * clip.width, h: r.h * clip.height });
        }
      }
      await drawOverlays(page, items, ACCENT);
      await page.waitForTimeout(80);
      const relDir = shot.dir || 'guides/img';
      const dir = path.join(ROOT, relDir);
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, shot.name + '.png');
      await page.screenshot({ path: out, clip });
      await page.close();
      console.log('  wrote ' + relDir + '/' + shot.name + '.png');
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`Generated ${shots.length} screenshot(s).`);
})().catch((e) => { console.error(e); process.exit(1); });
