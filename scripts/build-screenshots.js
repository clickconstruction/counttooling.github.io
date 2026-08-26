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

// takeoffSetup plus drops (drop-size peek / Drop sizes toggle shots): the waste
// line gets a 3 ft start drop, and a copper riser dropping 10 ft joins it — two
// markers, two different values, so the shots show real variety.
async function dropSetup(page) {
  await takeoffSetup(page);
  await page.evaluate(() => {
    const s = window.state, App = window.App, uid = () => App.uid();
    const vp = s.pages[0].pdfPage.getViewport({ scale: 1 });
    const pw = vp.width, ph = vp.height;
    const ann = s.pages[0].canvases[0].annotations;
    const waste = ann.quickLines[0];
    waste.startDrop = 3; waste.startDropUnit = 'ft';
    const cu = uid();
    s.lineTypes.push({ id: cu, name: '2" Cu riser', color: '#4a9eff', curveStyle: 'straight' });
    ann.quickLines.push({ id: uid(), x1: 0.68 * pw, y1: 0.30 * ph, x2: 0.68 * pw, y2: 0.62 * ph, lineTypeId: cu, color: '#4a9eff', group: null, endDrop: 10, endDropUnit: 'ft' });
    App.renderPdf();
    App.updateUI();
  });
  await page.waitForTimeout(250);
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

// A stubbed view-link session (no cloud needed): the get-view-project Edge Function
// is answered by a Playwright route (the view-only.spec.js recipe) with a takeoff
// laid out on the sample plan, and the "signed URL" is the same-origin sample PDF.
const VIEW_TOKEN = 'demo-view-token';
function viewProjectPayload(withDrops) {
  const pw = 921.6, ph = 597.6; // sample-plan.pdf page size in points (12.8 × 8.3 in)
  const wcX = [0.3717, 0.4003, 0.4289, 0.5310, 0.5596, 0.5882, 0.6168];
  const lavX = [0.3676, 0.3962, 0.4248, 0.5270, 0.5556, 0.5841, 0.6127];
  let n = 0; const uid = () => 'view-demo-' + (++n);
  return {
    projectId: 'proj-view-demo', name: 'Sample Plan', pdfHash: 'hash-view-demo',
    updatedAt: '2026-07-31T12:00:00Z', pdfSignedUrl: '/samples/sample-plan.pdf',
    data: {
      counters: [
        { id: 'wc', name: 'Water Closet', icon: DOT, color: '#e8c547' },
        { id: 'lav', name: 'Lavatory', icon: DOT, color: '#4a9eff' },
      ],
      lineTypes: withDrops
        ? [{ id: 'lt', name: 'Waste line', color: '#47c88e', curveStyle: 'straight' }, { id: 'cu', name: '2" Cu riser', color: '#4a9eff', curveStyle: 'straight' }]
        : [{ id: 'lt', name: 'Waste line', color: '#47c88e', curveStyle: 'straight' }],
      groups: [], rooms: [],
      pages: [{
        index: 0,
        scale: { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' },
        rotation: 0,
        canvases: [{
          id: 'cv1', name: 'Main',
          annotations: {
            counterMarkers: {
              wc: wcX.map((fx) => ({ x: fx * pw, y: 0.4962 * ph, id: uid(), group: null })),
              lav: lavX.map((fx) => ({ x: fx * pw, y: 0.7134 * ph, id: uid(), group: null })),
            },
            quickLines: withDrops
              ? [
                  { id: uid(), x1: 0.372 * pw, y1: 0.655 * ph, x2: 0.617 * pw, y2: 0.655 * ph, lineTypeId: 'lt', color: '#47c88e', group: null, startDrop: 3, startDropUnit: 'ft' },
                  { id: uid(), x1: 0.68 * pw, y1: 0.30 * ph, x2: 0.68 * pw, y2: 0.62 * ph, lineTypeId: 'cu', color: '#4a9eff', group: null, endDrop: 10, endDropUnit: 'ft' },
                ]
              : [{ id: uid(), x1: 0.372 * pw, y1: 0.655 * ph, x2: 0.617 * pw, y2: 0.655 * ph, lineTypeId: 'lt', color: '#47c88e', group: null }],
            polylines: [], highlights: [], notes: [], multiplyZones: [], scaleZones: [], roomBoxes: [],
            // withDrops: legend sits lower so the shot's "label them all" callout
            // (anchored under the header's Drop sizes button) doesn't cover it.
            legend: { x: pw - 210, y: withDrops ? 90 : 16, w: 195, h: 60, userResized: false },
          },
        }],
      }],
      activeCanvasIdByPage: { 0: 'cv1' },
    },
  };
}
async function routeViewProject(page, withDrops) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  await page.route('**/functions/v1/get-view-project', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    await route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(viewProjectPayload(withDrops)) });
  });
}

// --- shot manifest ------------------------------------------------------------
// clip: a selector whose bounding box is captured.
// noLoad: skip the default upload-a-PDF loadApp (the shot's setup drives its own
//         navigation, e.g. the view-link boot via /app/?t=…; setup receives baseUrl).
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

  // Prepare PDF dialog — trim/rotate the set before starting (preparing-a-plan-set guide).
  {
    name: 'prepare-pdf',
    clip: '#preparePdfModal',
    async setup(page) {
      await page.evaluate(() => {
        window.App.openPreparePdfModal(window.state.pages, window.state.pdfBuffer, 'Sample Plan');
      });
      await page.waitForSelector('#preparePdfModal.visible', { timeout: 5000 });
      await page.waitForTimeout(300);
    },
    callouts: [
      { n: 1, sel: '#preparePdfRotate' },
      { n: 2, sel: '#preparePdfDelete' },
      { n: 3, sel: '#preparePdfSaveAndOpen' },
    ],
  },

  // Set Scale presets tab on a rescaled sheet: the sheet-size warning + the verify
  // advisory (verifying-your-scale guide). The analysis is stubbed (the synthetic
  // sample plan is a standard sheet, so the real detector would stay silent), which
  // exercises the exact UI path a compressed PDF triggers.
  {
    name: 'sheet-warning',
    clip: '#scaleModal',
    async setup(page) {
      await page.evaluate(() => {
        const App = window.App;
        const vp = window.state.pages[0].pdfPage.getViewport({ scale: 1 });
        const best = App.STANDARD_SHEETS.find((s) => /arch/i.test(s.id)) || App.STANDARD_SHEETS[0];
        App.getPageSheetAnalysis = () => ({ isStandard: false, widthPt: vp.width, heightPt: vp.height, bestGuessSheet: best, candidates: [best] });
        App.openScaleModal();
      });
      await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
      await page.waitForTimeout(200);
    },
    boxes: [
      { sel: '#scaleSheetWarning', label: 'Rescaled-sheet warning' },
      { sel: '#scaleVerifyAdvisory', label: 'Verify your scale' },
    ],
  },

  // Delete Area confirm — the count of what a rubber-banded region holds
  // (fixing-mistakes guide). Drives the real two-click tool path over the takeoff.
  {
    name: 'delete-area',
    clip: '#deleteZoneModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => { window.state.tool = window.App.TOOL.DELETE_ZONE; window.App.updateUI(); });
      const box = await page.locator('#annCanvas').boundingBox();
      await page.mouse.click(box.x + box.width * 0.30, box.y + box.height * 0.42);
      await page.waitForTimeout(150);
      await page.mouse.click(box.x + box.width * 0.68, box.y + box.height * 0.80);
      await page.waitForSelector('#deleteZoneModal.visible', { timeout: 5000 });
      await page.waitForTimeout(150);
    },
  },

  // Manage Icons dialog (custom-icons guide).
  {
    name: 'manage-icons',
    clip: '#manageIconsModal',
    async setup(page) {
      await page.evaluate(() => window.App.openManageIconsModal && window.App.openManageIconsModal());
      await page.waitForSelector('#manageIconsModal.visible', { timeout: 5000 });
      await page.waitForTimeout(200);
    },
  },

  // Quick Count tab — Size / Type / Material pickers (quick-creators guide).
  {
    name: 'quick-count',
    clip: '#counterModal',
    async setup(page) {
      await page.evaluate(() => { const b = document.querySelector('#addCounter'); if (b) b.click(); });
      await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
      await page.evaluate(() => window.App.showCounterTab && window.App.showCounterTab('quickcount'));
      await page.waitForTimeout(300);
    },
    callouts: [
      { n: 1, sel: '#counterQuickCountSize' },
      { n: 2, sel: '#counterQuickCountType' },
      { n: 3, sel: '#counterQuickCountMaterial' },
    ],
  },

  // Add Canvas dialog — new vs duplicate layer (canvas-layers guide).
  {
    name: 'add-canvas',
    clip: '#addCanvasModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => { const b = document.querySelector('#addCanvasBtn'); if (b) b.click(); });
      await page.waitForSelector('#addCanvasModal.visible', { timeout: 5000 });
      await page.waitForTimeout(150);
    },
    callouts: [
      { n: 1, sel: '#addCanvasModalNew' },
      { n: 2, sel: '#addCanvasModalDuplicate' },
    ],
  },

  // Save Status dialog — the activity log + Copy/Export (how-your-work-is-saved guide).
  {
    name: 'save-status',
    clip: '#saveStatusModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => window.App.openSaveStatusModal && window.App.openSaveStatusModal());
      await page.waitForSelector('#saveStatusModal.visible', { timeout: 5000 });
      await page.waitForTimeout(200);
    },
    callouts: [
      { n: 1, sel: '#saveStatusVerboseToggle' },
      { n: 2, sel: '#saveStatusCopyBtn' },
      { n: 3, sel: '#saveStatusExportBtn' },
    ],
  },

  // Macros modal with the inline Keyboard Map (working-faster guide).
  {
    name: 'keyboard-map',
    clip: '#macrosModal',
    async setup(page) {
      await page.evaluate(() => window.App.showModal('macrosModal'));
      await page.waitForSelector('#macrosModal.visible', { timeout: 5000 });
      await page.waitForTimeout(250);
    },
    boxes: [{ sel: '#macrosKeyboardInline', label: 'Every mapped key lights up' }],
  },

  // Quick Keys binding modal with two seeded bindings (working-faster guide).
  {
    name: 'quick-keys',
    clip: '#quickKeysModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => {
        const s = window.state;
        const wc = s.counters.find((c) => c.name === 'Water Closet');
        const lt = s.lineTypes.find((l) => l.name === 'Waste line');
        s.numberKeyBindings = { 1: { kind: 'counter', id: wc.id }, 2: { kind: 'lineType', id: lt.id } };
        window.App.openQuickKeysModal();
      });
      await page.waitForSelector('#quickKeysModal.visible', { timeout: 5000 });
      await page.waitForTimeout(200);
    },
  },

  // Quick Line tab — Size / Material pickers (quick-creators guide).
  {
    name: 'quick-line',
    clip: '#chooseLineTypeModal',
    async setup(page) {
      await page.evaluate(() => {
        window.App.showChooseLineTypeModal();
        window.App.showLineTypeTab('quick');
      });
      await page.waitForSelector('#chooseLineTypeModal.visible', { timeout: 5000 });
      await page.waitForTimeout(250);
    },
    callouts: [
      { n: 1, sel: '#quickLineSize' },
      { n: 2, sel: '#quickLineMaterial' },
    ],
  },

  // Highlight + note on the plan (annotating guide).
  {
    name: 'annotate',
    clip: '#canvasWrapper',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => {
        const s = window.state, App = window.App;
        const vp = s.pages[0].pdfPage.getViewport({ scale: 1 });
        const pw = vp.width, ph = vp.height;
        const ann = s.pages[0].canvases[0].annotations;
        ann.highlights.push({ x1: 0.535 * pw, y1: 0.55 * ph, x2: 0.755 * pw, y2: 0.86 * ph, id: App.uid() });
        ann.notes.push({ x: 0.135 * pw, y: 0.56 * ph, text: 'Confirm fixture spec — see addendum 2', id: App.uid(), width: 150, fontSize: 14, placementRotation: 0, color: '#e85447' });
        App.renderAnnotations();
      });
      await page.waitForTimeout(250);
    },
  },

  // Right-click context menu on a placed mark (fixing-mistakes guide).
  {
    name: 'context-menu',
    clip: '#canvasWrapper',
    async setup(page) {
      await takeoffSetup(page);
      const box = await page.locator('#annCanvas').boundingBox();
      await page.mouse.click(box.x + box.width * 0.4003, box.y + box.height * 0.4962, { button: 'right' });
      await page.waitForSelector('#contextMenu', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(150);
    },
    boxes: [{ sel: '#contextMenu', label: 'Right-click any mark' }],
  },

  // Line Properties — name, color, drops (measuring guide).
  {
    name: 'line-properties',
    clip: '#linePropertiesModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => {
        const q = window.state.pages[0].canvases[0].annotations.quickLines[0];
        q.startDrop = 3;
        window.App.openLinePropertiesModal({ type: 'quick', q });
      });
      await page.waitForSelector('#linePropertiesModal.visible', { timeout: 5000 });
      await page.waitForTimeout(200);
    },
  },

  // Scale verify-check panel — Expected vs reads + % error (verifying guide).
  // Drives the REAL flow: Verify button → two clicks on the 25 ft waste line →
  // known length 25 ft → Check.
  {
    name: 'scale-check',
    clip: '#scaleModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => window.App.openScaleModal());
      await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
      await page.locator('#scaleVerifyBtn').click();
      await page.waitForTimeout(500);
      const box = await page.locator('#annCanvas').boundingBox();
      await page.mouse.click(box.x + box.width * 0.372, box.y + box.height * 0.655);
      await page.waitForTimeout(500); // scale taps are debounced 400ms
      await page.mouse.click(box.x + box.width * 0.617, box.y + box.height * 0.655);
      await page.waitForSelector('#scaleCheckPanel', { state: 'visible', timeout: 5000 });
      await page.locator('#scaleCheckValue').fill('25');
      await page.locator('#scaleCheckBtn').click();
      await page.waitForTimeout(250);
    },
  },

  // Group Assign dialog (organizing guide).
  {
    name: 'group-assign',
    clip: '#groupAssignModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => {
        const s = window.state, App = window.App;
        s.groups.push({ id: App.uid(), name: 'Restroom 105', color: '#e8c547' });
        s.groups.push({ id: App.uid(), name: 'Restroom 106', color: '#4a9eff' });
        const wc = s.counters.find((c) => c.name === 'Water Closet');
        const item = s.pages[0].canvases[0].annotations.counterMarkers[wc.id][0];
        App.openGroupAssignModal(item);
      });
      await page.waitForSelector('#groupAssignModal.visible', { timeout: 5000 });
      await page.waitForTimeout(150);
    },
  },

  // Counter Settings dialog (organizing guide).
  {
    name: 'counter-settings',
    clip: '#counterSettingsModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => window.App.openCounterSettingsModal());
      await page.waitForSelector('#counterSettingsModal.visible', { timeout: 5000 });
      await page.waitForTimeout(200);
    },
  },

  // Multiply Zone value dialog (zones guide).
  {
    name: 'multiply-zone-value',
    clip: '#multiplyZoneModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => {
        const el = document.getElementById('multiplyZoneMultiplier');
        if (el) el.value = '3';
        window.App.showModal('multiplyZoneModal');
      });
      await page.waitForSelector('#multiplyZoneModal.visible', { timeout: 5000 });
      await page.waitForTimeout(150);
    },
  },

  // Footer canvas switcher with two layers + the show-all peek (canvas-layers guide).
  {
    name: 'canvas-switcher',
    clip: '.app',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => {
        const s = window.state, App = window.App;
        s.pages[0].canvases.push({ id: App.uid(), name: 'Alternate', annotations: App.makeAnnotations() });
        App.updateUI();
      });
      await page.waitForTimeout(250);
    },
    boxes: [{ sel: '#canvasSwitcher', label: 'Layers on this page — with the show-all peek' }],
  },

  // The zoom rail on a tablet viewport (tablet guide).
  {
    name: 'zoom-rail',
    clip: '.app',
    viewport: { width: 1024, height: 1366 },
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => window.App.openZoomRail());
      await page.waitForTimeout(400);
    },
    boxes: [{ sel: '#zoomRail', label: 'Zoom rail' }],
  },

  // The Rooms sidebar section — per-room area/volume + box rows (room-volumes guide).
  {
    name: 'rooms-sidebar',
    clip: '#roomsSection',
    async setup(page) {
      await roomSetup(page);
      await page.waitForSelector('#roomsSection', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(150);
    },
  },

  // Right-click menu on a room box — Edit room box / Delete (room-volumes guide).
  {
    name: 'room-context-menu',
    clip: '#canvasWrapper',
    async setup(page) {
      await roomSetup(page);
      const box = await page.locator('#annCanvas').boundingBox();
      await page.mouse.click(box.x + box.width * 0.24, box.y + box.height * 0.29, { button: 'right' });
      await page.waitForSelector('#contextMenu', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(150);
    },
    boxes: [{ sel: '#contextMenu', label: 'Right-click a room box' }],
  },

  // Real zone chrome on the plan — a live multiply zone and scale zone rendered by
  // the actual draw core (zones guide).
  {
    name: 'zones-on-plan',
    clip: '#canvasWrapper',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => {
        const s = window.state, App = window.App;
        const vp = s.pages[0].pdfPage.getViewport({ scale: 1 });
        const pw = vp.width, ph = vp.height;
        const ann = s.pages[0].canvases[0].annotations;
        // Zone labels render at the rectangle's CENTER (canvas-draw.js), so both
        // rects are placed with their centers on empty floor — clear of room
        // names, fixtures, and the title block — and inside the building.
        ann.multiplyZones.push({ x1: 0.512 * pw, y1: 0.615 * ph, x2: 0.745 * pw, y2: 0.73 * ph, multiplier: 3, id: App.uid() });
        ann.scaleZones.push({ x1: 0.16 * pw, y1: 0.61 * ph, x2: 0.335 * pw, y2: 0.725 * ph, scale: { pixelsPerUnit: 18, unit: 'ft', label: '1/4" = 1\'' }, id: App.uid() });
        App.renderAnnotations();
      });
      await page.waitForTimeout(250);
    },
  },

  // Summary count-detail drill-down — per-page breakdown with thumbnails
  // (how-to-do-a-pdf-takeoff guide, "review the summary" step).
  {
    name: 'summary-detail',
    clip: '#summaryCountDetailModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => window.App.openSummaryCountDetailModal('counter', window.state.counters[0].id));
      await page.waitForSelector('#summaryCountDetailModal.visible', { timeout: 5000 });
      // let the async pdf.js thumbnail render land
      await page.waitForTimeout(1500);
    },
  },

  // View-link email gate — what a recipient sees first (sharing guide).
  {
    name: 'view-link-gate',
    clip: '#viewLinkEmailModal',
    noLoad: true,
    async setup(page, baseUrl) {
      await routeViewProject(page);
      await page.goto(baseUrl + '/app/?t=' + VIEW_TOKEN, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#viewLinkEmailModal.visible', { timeout: 10000 });
      await page.locator('#viewLinkEmailInput').fill('inspector@clickplumbing.com');
      await page.waitForTimeout(150);
    },
  },

  // View-link viewer session — the live takeoff with the viewer toolbar (sharing guide).
  {
    name: 'view-link-viewer',
    clip: '.app',
    noLoad: true,
    async setup(page, baseUrl) {
      await routeViewProject(page);
      await page.addInitScript((token) => {
        try { localStorage.setItem('view:allowed:' + token, 'inspector@clickplumbing.com'); } catch (_) {}
      }, VIEW_TOKEN);
      await page.goto(baseUrl + '/app/?t=' + VIEW_TOKEN, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); return c && c.width > 0 && window.state && window.state.isViewer; }, { timeout: 20000 });
      await page.waitForTimeout(500);
    },
    boxes: [{ sel: '#hideMarksBtn', label: 'Hide marks' }],
  },

  // Drop-size peek — a pinned chip over the waste line's 3 ft drop (measuring guide).
  {
    name: 'drop-peek',
    clip: '#canvasWrapper',
    async setup(page) {
      await dropSetup(page);
      await page.evaluate(() => {
        const q = window.state.pages[0].canvases[0].annotations.quickLines[0];
        window.App.onDropPeekClick({ x: q.x1, y: q.y1 }, null);   // pin the 3 ft chip
      });
      await page.waitForTimeout(200);
    },
    boxes: [{ sel: '#dropPeekChip', label: 'Hover or tap a drop marker' }],
  },

  // Drop sizes toggle on — every drop labeled on the sheet, header button active
  // (measuring guide).
  {
    name: 'drop-sizes-toggle',
    clip: '.app',
    async setup(page) {
      await dropSetup(page);
      await page.evaluate(() => window.App.toggleDropSizes());
      await page.waitForTimeout(200);
    },
    boxes: [{ sel: '#dropSizesBtn', label: 'Drop sizes' }],
  },

  // Drop-size peek in a view-link session — wendi's use case (sharing guide).
  {
    name: 'view-drop-peek',
    clip: '.app',
    noLoad: true,
    async setup(page, baseUrl) {
      await routeViewProject(page, true);
      await page.addInitScript((token) => {
        try { localStorage.setItem('view:allowed:' + token, 'inspector@clickplumbing.com'); } catch (_) {}
      }, VIEW_TOKEN);
      await page.goto(baseUrl + '/app/?t=' + VIEW_TOKEN, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); return c && c.width > 0 && window.state && window.state.isViewer; }, { timeout: 20000 });
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const q = window.state.pages[0].canvases[0].annotations.quickLines[0];
        window.App.onDropPeekClick({ x: q.x1, y: q.y1 }, null);   // pin the 3 ft chip
      });
      await page.waitForTimeout(200);
    },
    boxes: [
      { sel: '#dropPeekChip', label: 'Tap any drop marker' },
      { sel: '#dropSizesBtn', label: 'Or label them all' },
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
      if (!shot.noLoad) await loadApp(page, baseUrl);
      if (shot.setup) await shot.setup(page, baseUrl);
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
