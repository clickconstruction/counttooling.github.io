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
const PLAN_B = path.join(ROOT, 'samples', 'sample-plan-advanced.pdf');   // the restaurant sheet, the plumbing film's
const ACCENT = '#e8c547';
// The sample plan is a true ANSI B sheet (1224 × 792 pt); the drawing (candidate A at
// 0.75, placed at (60, 70) — see scripts/sample-plan-candidates.js PLAN_AT) and its
// room schedule occupy the top-left PLAN_W × PLAN_H of it. Markup is placed as
// fractions of that extent (a PDF point p is p/PLAN_W, p/PLAN_H), and every shot
// frames the drawing (fitPlan) rather than the whole sheet.
const PLAN_W = 830, PLAN_H = 660;
const FIT_PLAN_SRC = `window.__fitPlan = () => {
  const s = window.state, App = window.App;
  const wrap = document.querySelector('.canvas-wrapper');
  if (!wrap || !s.pages.length) return;
  const r = wrap.getBoundingClientRect();
  s.zoom = Math.max(0.2, Math.min(App.getMaxZoom(), Math.min(r.width / ${PLAN_W}, r.height / ${PLAN_H})));
  s.pan = { x: 0, y: 0 };
  App.renderPdf();
  App.updateUI();
};`;
async function fitPlan(page) {
  await page.evaluate(FIT_PLAN_SRC);
  await page.evaluate(() => window.__fitPlan());
  await page.waitForTimeout(250);
}
// Viewport coordinates of a point given as fractions of the drawing's extent (the
// annotation canvas covers the whole sheet, so its box fractions no longer line up
// with the drawing; the page origin is the canvas box origin at pan 0).
async function planPoint(page, fx, fy) {
  const box = await page.locator('#annCanvas').boundingBox();
  const zoom = await page.evaluate(() => window.state.zoom);
  return { x: box.x + fx * PLAN_W * zoom, y: box.y + fy * PLAN_H * zoom };
}

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
// fractions of the DRAWING's extent, PLAN_W × PLAN_H, so they land on the drawn
// fixtures), a measured waste line, a page scale, and the legend.
async function takeoffSetup(page) {
  await page.evaluate(({ dot, pw, ph }) => {
    const s = window.state, App = window.App, uid = () => App.uid();
    const wc = uid(), lav = uid(), lt = uid();
    s.counters.push({ id: wc, name: 'Water Closet', icon: dot, color: '#e8c547', size: 16 });
    s.counters.push({ id: lav, name: 'Lavatory', icon: dot, color: '#4a9eff', size: 16 });
    s.lineTypes.push({ id: lt, name: 'Waste line', color: '#47c88e', curveStyle: 'straight' });
    const ann = s.pages[0].canvases[0].annotations;
    const wcX = [0.6136, 0.6479, 0.7771, 0.8133, 0.8494];   // bowls at y 506.5 pt
    const lavX = [0.6660, 0.6931, 0.8295, 0.8639, 0.8982];   // counters at y 369 pt
    ann.counterMarkers[wc] = wcX.map((fx) => ({ x: fx * pw, y: 0.7674 * ph, id: uid(), group: null }));
    ann.counterMarkers[lav] = lavX.map((fx) => ({ x: fx * pw, y: 0.5595 * ph, id: uid(), group: null }));
    ann.quickLines.push({ id: uid(), x1: 0.5964 * pw, y1: 0.7045 * ph, x2: 0.8675 * pw, y2: 0.7045 * ph, lineTypeId: lt, color: '#47c88e', group: null });
    // the legend at the drawing's top-right corner, above the north arrow (the page's
    // own default corner is off the framed area now that the sheet is wider)
    ann.legend = { x: pw - 210, y: 16, w: 195, h: 60, userResized: false };
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
    App.renderPdf();
    App.updateUI();
  }, { dot: DOT, pw: PLAN_W, ph: PLAN_H });
  await fitPlan(page);
  await page.waitForTimeout(350);
}

// takeoffSetup plus drops (drop-size peek / Drop sizes toggle shots): the waste
// line gets a 3 ft start drop, and a copper riser dropping 10 ft joins it — two
// markers, two different values, so the shots show real variety.
async function dropSetup(page) {
  await takeoffSetup(page);
  await page.evaluate(({ pw, ph }) => {
    const s = window.state, App = window.App, uid = () => App.uid();
    const ann = s.pages[0].canvases[0].annotations;
    const waste = ann.quickLines[0];
    waste.startDrop = 3; waste.startDropUnit = 'ft';
    const cu = uid();
    s.lineTypes.push({ id: cu, name: '2" Cu riser', color: '#4a9eff', curveStyle: 'straight' });
    ann.quickLines.push({ id: uid(), x1: 0.5301 * pw, y1: 0.6061 * ph, x2: 0.5301 * pw, y2: 0.7652 * ph, lineTypeId: cu, color: '#4a9eff', group: null, endDrop: 10, endDropUnit: 'ft' });
    App.renderPdf();
    App.updateUI();
  }, { pw: PLAN_W, ph: PLAN_H });
  await page.waitForTimeout(250);
}

// Lay two finished room boxes onto the plan (Room Sizer guide), aligned with the
// sample plan's real rooms (Office 101 and Conference 103) so the boxes read as
// tracing actual rooms. The legend is nudged left so it isn't clipped at the edge.
async function roomSetup(page) {
  await page.evaluate(({ pw, ph }) => {
    const s = window.state, App = window.App, uid = () => App.uid();
    const office = uid(), conf = uid();
    s.rooms.push({ id: office, name: 'Office 101', color: '#e85447' });
    s.rooms.push({ id: conf, name: 'Conference 103', color: '#4a9eff' });
    const ann = s.pages[0].canvases[0].annotations;
    ann.roomBoxes.push({ id: uid(), x1: 0.3434 * pw, y1: 0.2197 * ph, x2: 0.4970 * pw, y2: 0.4924 * ph, heightFt: 9.5, roomId: office });
    ann.roomBoxes.push({ id: uid(), x1: 0.6506 * pw, y1: 0.2197 * ph, x2: 0.7861 * pw, y2: 0.4924 * ph, heightFt: 8, roomId: conf });
    ann.legend = { x: pw - 210, y: 16, w: 195, h: 60, userResized: false };
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
    App.renderPdf();
    App.updateUI();
  }, { pw: PLAN_W, ph: PLAN_H });
  await fitPlan(page);
  await page.waitForTimeout(350);
}

// A stubbed view-link session (no cloud needed): the get-view-project Edge Function
// is answered by a Playwright route (the view-only.spec.js recipe) with a takeoff
// laid out on the sample plan, and the "signed URL" is the same-origin sample PDF.
const VIEW_TOKEN = 'demo-view-token';
function viewProjectPayload(withDrops) {
  const pw = PLAN_W, ph = PLAN_H; // the drawing's extent on the ANSI B sample sheet
  const wcX = [0.6136, 0.6479, 0.7771, 0.8133, 0.8494];
  const lavX = [0.6660, 0.6931, 0.8295, 0.8639, 0.8982];
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
              wc: wcX.map((fx) => ({ x: fx * pw, y: 0.7674 * ph, id: uid(), group: null })),
              lav: lavX.map((fx) => ({ x: fx * pw, y: 0.5595 * ph, id: uid(), group: null })),
            },
            quickLines: withDrops
              ? [
                  { id: uid(), x1: 0.5964 * pw, y1: 0.7045 * ph, x2: 0.8675 * pw, y2: 0.7045 * ph, lineTypeId: 'lt', color: '#47c88e', group: null, startDrop: 3, startDropUnit: 'ft' },
                  { id: uid(), x1: 0.5301 * pw, y1: 0.6061 * ph, x2: 0.5301 * pw, y2: 0.7652 * ph, lineTypeId: 'cu', color: '#4a9eff', group: null, endDrop: 10, endDropUnit: 'ft' },
                ]
              : [{ id: uid(), x1: 0.5964 * pw, y1: 0.7045 * ph, x2: 0.8675 * pw, y2: 0.7045 * ph, lineTypeId: 'lt', color: '#47c88e', group: null }],
            polylines: [], highlights: [], notes: [], multiplyZones: [], scaleZones: [], roomBoxes: [],
            // withDrops: legend sits lower so the shot's "label them all" callout
            // (anchored under the header's Drop sizes button) doesn't cover it.
            legend: { x: pw - 210, y: withDrops ? 135 : 16, w: 195, h: 60, userResized: false },
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
  // (The marketing landing hero is three films now: scripts/build-hero-video.js writes
  // img/hero-<trade>.{mp4,png}; the PNGs are their posters, not shots from here.)

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
      await fitPlan(page);
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
        const pw = 830, ph = 660;   // the drawing's extent on the sheet (PLAN_W × PLAN_H)
        window.App.openRoomBoxModal({ x1: 0.1904 * pw, y1: 0.5424 * ph, x2: 0.4964 * pw, y2: 0.7879 * ph });
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
    clip: '#confirmModal',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => { window.state.tool = window.App.TOOL.DELETE_ZONE; window.App.updateUI(); });
      { const pt = await planPoint(page, 0.5964, 0.5303); await page.mouse.click(pt.x, pt.y); }
      await page.waitForTimeout(150);
      { const pt = await planPoint(page, 0.9277, 0.7955); await page.mouse.click(pt.x, pt.y); }
      await page.waitForSelector('#confirmModal.visible', { timeout: 5000 });
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
        const pw = 830, ph = 660;   // the drawing's extent on the sheet (PLAN_W × PLAN_H)
        const ann = s.pages[0].canvases[0].annotations;
        ann.highlights.push({ x1: 0.4096 * pw, y1: 0.8303 * ph, x2: 0.9398 * pw, y2: 0.9879 * ph, id: App.uid(), label: 'Room schedule' });
        ann.notes.push({ x: 0.2048 * pw, y: 0.6061 * ph, text: 'Confirm fixture spec — see addendum 2', id: App.uid(), width: 150, fontSize: 14, placementRotation: 0, color: '#e85447' });
        App.renderAnnotations();
      });
      await page.waitForTimeout(250);
    },
  },

  // Named highlights + the bookmarks panel (annotating guide).
  {
    name: 'highlight-bookmarks',
    clip: '.app',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => {
        const s = window.state, App = window.App;
        const pw = 830, ph = 660;   // the drawing's extent on the sheet (PLAN_W × PLAN_H)
        const ann = s.pages[0].canvases[0].annotations;
        ann.highlights.push({ x1: 0.4096 * pw, y1: 0.8303 * ph, x2: 0.9398 * pw, y2: 0.9879 * ph, id: App.uid(), label: 'Room schedule' });
        ann.highlights.push({ x1: 0.1892 * pw, y1: 0.2197 * ph, x2: 0.3434 * pw, y2: 0.4924 * ph, id: App.uid(), label: 'Lobby finishes' });
        App.renderAnnotations();
        // Arm the Highlight tool — its bookmarks panel opens with the rows.
        document.getElementById('highlightBtn').click();
      });
      await page.waitForTimeout(300);
    },
    boxes: [{ sel: '#highlightPanel', label: 'Click a row to jump to its page' }],
  },

  // Right-click context menu on a placed mark (fixing-mistakes guide).
  {
    name: 'context-menu',
    clip: '#canvasWrapper',
    async setup(page) {
      await takeoffSetup(page);
      { const pt = await planPoint(page, 0.6479, 0.7674); await page.mouse.click(pt.x, pt.y, { button: 'right' }); }
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
      { const pt = await planPoint(page, 0.5964, 0.7045); await page.mouse.click(pt.x, pt.y); }
      await page.waitForTimeout(500); // scale taps are debounced 400ms
      { const pt = await planPoint(page, 0.8675, 0.7045); await page.mouse.click(pt.x, pt.y); }
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
        s.groups.push({ id: App.uid(), name: 'Restroom 107', color: '#e8c547' });
        s.groups.push({ id: App.uid(), name: 'Restroom 108', color: '#4a9eff' });
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
      // the real two-click tool path around Women 108, so the "In this area" count is
      // the app's own reading of what the box holds
      await page.evaluate(() => { window.state.tool = window.App.TOOL.MULTIPLY_ZONE; window.App.updateUI(); });
      { const pt = await planPoint(page, 0.7590, 0.5424); await page.mouse.click(pt.x, pt.y); }
      await page.waitForTimeout(150);
      { const pt = await planPoint(page, 0.9217, 0.7879); await page.mouse.click(pt.x, pt.y); }
      await page.waitForSelector('#multiplyZoneModal.visible', { timeout: 5000 });
      await page.evaluate(() => { const el = document.getElementById('multiplyZoneMultiplier'); if (el) el.value = '3'; });
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
      { const pt = await planPoint(page, 0.42, 0.35); await page.mouse.click(pt.x, pt.y, { button: 'right' }); }
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
        const pw = 830, ph = 660;   // the drawing's extent on the sheet (PLAN_W × PLAN_H)
        const ann = s.pages[0].canvases[0].annotations;
        // Zone labels render at the rectangle's CENTER (canvas-draw.js), so both
        // rects are placed with their centers on empty floor — clear of room
        // names, fixtures, and the title block — and inside the building.
        ann.multiplyZones.push({ x1: 0.7590 * pw, y1: 0.5424 * ph, x2: 0.9217 * pw, y2: 0.7879 * ph, multiplier: 3, id: App.uid() });
        ann.scaleZones.push({ x1: 0.6506 * pw, y1: 0.2197 * ph, x2: 0.7861 * pw, y2: 0.4924 * ph, scale: { pixelsPerUnit: 18, unit: 'ft', label: '1/4" = 1\'' }, id: App.uid() });
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
      await fitPlan(page);
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
      await fitPlan(page);
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

  // --- Overseer guide shots (synthetic bids + demo emails — no cloud) ----------

  // The All Bids board as an overseer lands on it after sign-in.
  {
    name: 'overseer-all-bids',
    clip: '.app',
    setup: overseerBoardSetup,
    callouts: [
      { n: 1, sel: '#bidBoardSearch' },
      { n: 2, sel: '#bidBoardOwnerFilter' },
      { n: 3, sel: '#bidBoardList .bid-card' },
    ],
    boxes: [{ sel: '#bidBoardList .bid-card-badge-warn', label: 'Cloud status' }],
  },

  // A bid open in the overseer's read-only viewer ("Viewing only" banner).
  {
    name: 'overseer-viewing-only',
    clip: '.app',
    async setup(page) {
      await takeoffSetup(page);
      await page.evaluate(() => {
        const s = window.state, App = window.App;
        s.supabaseSession = { user: { id: 'demo-overseer', email: 'overseer@clickplumbing.com' } };
        s.isOverseer = true; s.isAdmin = false; s.isViewer = true; s.canCheckOut = false;
        s.currentProjectId = 'demo-overseer-project';
        s.currentProjectName = 'Riverside Apartments — Plumbing';
        App.updateUI();
      });
      await page.waitForTimeout(250);
    },
    boxes: [{ sel: '#headerEditStatusBanner', label: 'Read-only — nothing can be changed' }],
  },

  // Manage Users with the overseer eye-toggle (admin granting the role).
  {
    name: 'overseer-grant-toggle',
    clip: '#manageUserModal .modal-card',
    async setup(page) {
      const day = 864e5, now = Date.now();
      const demoUsers = [
        { id: 'du-1', email: 'alex@clickplumbing.com', role: 'Admin', is_overseer: false, project_count: 12, last_sign_in_at: new Date(now).toISOString(), last_seen_at: new Date(now).toISOString() },
        { id: 'du-2', email: 'jordan@clickplumbing.com', role: 'Overseer', is_overseer: true, project_count: 0, last_sign_in_at: new Date(now - day).toISOString(), last_seen_at: new Date(now - day).toISOString() },
        { id: 'du-3', email: 'sam@clickplumbing.com', role: 'User', is_overseer: false, project_count: 31, last_sign_in_at: new Date(now).toISOString(), last_seen_at: new Date(now).toISOString() },
      ];
      await page.route('**/rest/v1/rpc/list_users_for_admin', async (route) => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
          return;
        }
        await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify(demoUsers) });
      });
      await page.evaluate(() => {
        const s = window.state;
        s.isAdmin = true;
        s.supabaseSession = { user: { id: 'du-1', email: 'alex@clickplumbing.com' }, access_token: 'demo' };
        window.App.openManageUserModal();
      });
      await page.waitForSelector('#manageUserModal .settings-user-overseer', { timeout: 10000 });
      await page.waitForTimeout(250);
    },
    boxes: [{ sel: '#manageUserModal .settings-user-overseer.active', label: 'Overseer toggle' }],
  },
];

// Synthetic list_accessible_projects rows for the Bid Board shots: realistic
// bid names and demo estimator emails, dates relative to the run so the
// "days ago" labels read naturally. One canvas-only row shows the warn badge.
function overseerBidRows() {
  const day = 864e5, now = Date.now();
  let n = 0;
  const row = (name, owner, cnt, ln, daysAgo, pdf) => ({
    id: 'ov-demo-' + (++n), name, owner_email: owner,
    counter_count: cnt, line_count: ln,
    updated_at: new Date(now - daysAgo * day).toISOString(),
    pdf_path: pdf ? 'demo/plan.pdf' : null,
    is_owner: false, can_edit: false, can_check_out: false, my_access_role: 'viewer',
  });
  return [
    row('Riverside Apartments — Plumbing', 'wendi@clickplumbing.com', 214, 38, 0, true),
    row('Oak Hill Elementary Reno', 'wendi@clickplumbing.com', 96, 12, 1, true),
    row('Lakeway Medical Office — Permit Set', 'jordan@clickplumbing.com', 310, 54, 2, true),
    row('Sunset Strip Retail Shell', 'trace@clickplumbing.com', 45, 9, 5, true),
    row('Travis County Annex', 'jordan@clickplumbing.com', 128, 22, 9, false),
    row('Hyde Park Duplexes — Issued for Bid', 'trace@clickplumbing.com', 61, 17, 12, true),
    row('Mueller Hangar TI', 'wendi@clickplumbing.com', 154, 41, 15, true),
    row('Barton Springs Bathhouse', 'jordan@clickplumbing.com', 88, 26, 21, true),
  ];
}

// Boot the board the way an overseer sees it: fake session + overseer flags,
// App.getSupabase stubbed so list_accessible_projects returns the demo rows.
async function overseerBoardSetup(page) {
  await page.evaluate(async (rows) => {
    const s = window.state, App = window.App;
    s.supabaseSession = { user: { id: 'demo-overseer', email: 'overseer@clickplumbing.com' }, access_token: 'demo' };
    s.isOverseer = true; s.isAdmin = false;
    // Read-only flags so no "Unsaved"/save affordances leak into an overseer shot
    // (loadApp's sample-plan upload would otherwise read as an editable project).
    s.isViewer = true; s.canCheckOut = false;
    App.getSupabase = () => ({ rpc: async () => ({ data: rows, error: null }) });
    App.updateUI();
    const pdfLabel = document.getElementById('statusPdfLabel');
    if (pdfLabel && pdfLabel.parentElement) pdfLabel.parentElement.style.visibility = 'hidden';
    await App.openBidBoard();
  }, overseerBidRows());
  await page.waitForSelector('#bidBoardList .bid-card', { timeout: 5000 });
  await page.waitForTimeout(250);
}

// ============================================================================
// The landing's trade spotlight (LANDING-REFRESH.md "The trade spotlight"): six frames of
// the real app per trade, JPEG, a fixed 1200×750 window centred on the surface so the six
// share one aspect on the page. `--set spotlight` builds them into img/spotlight/. The
// setups seed what each trade's hero film makes on camera, same names and colours, so the
// frames match the film above them. HVAC first (the film "Pounds, not feet").
// ============================================================================
// Each spotlight frame is a 4:3 window sized to its surface: `crop: { sel, w, h, ax, ay, ox, oy }`
// aligns the window's (ax, ay) fraction point to the anchor element's (ax, ay) fraction point
// (default its centre), then shifts by (ox, oy) px and clamps to the viewport. So a dialog's
// valuable rows fill the frame instead of sitting in the middle of 1200×900 of dimmed plan.
const CROP_QUICK = { sel: '#counterModal .modal-card', w: 520, h: 390, ax: 0.5, ay: 0, oy: 70 };            // the Trade row to the More block
const CROP_BID = { sel: '#bidCheckSection', w: 560, h: 420, ax: 0, ay: 0, ox: -6, oy: -8 };                  // the checklist column, a sliver of plan beside it
const CSS_BID = '.sidebar{width:420px}';                                                                     // wide enough that a check reads on one line

// The office sheet's rooms and the HVAC main, in PDF points (the film's MAIN_H / rooms).
const OPEN_OFFICE_105 = { x1: 159, y1: 358, x2: 412.5, y2: 520 };
const CONFERENCE_103 = { x1: 540, y1: 145, x2: 652.5, y2: 325 };
const DIFFUSERS = [[200, 457], [268, 457], [336, 457], [404, 457]];
const MAIN_PTS = [[164, 452], [240, 452], [320, 452], [406, 452]];

// Frame a region of the sheet (PDF points) in the canvas wrapper: the film's camera, so the
// two trace frames show the open office at the size the hero film shows it.
async function frameRegion(page, r) {
  await page.evaluate((r) => {
    const s = window.state, App = window.App;
    const w = document.querySelector('.canvas-wrapper').getBoundingClientRect();
    const zoom = Math.min(App.getMaxZoom(), Math.min(w.width / (r.x2 - r.x1), w.height / (r.y2 - r.y1)));
    s.zoom = zoom;
    s.pan = { x: (w.width - (r.x2 - r.x1) * zoom) / 2 - r.x1 * zoom, y: (w.height - (r.y2 - r.y1) * zoom) / 2 - r.y1 * zoom };
    App.renderPdf(); App.updateUI();
  }, r);
  await page.waitForTimeout(350);
}
const CAM_OPEN_OFFICE = { x1: 118, y1: 322, x2: 560, y2: 548 };   // the open office with LP-1 in frame, the film's office camera

async function clickPlanPt(page, x, y) {
  const p = await planPoint(page, x / PLAN_W, y / PLAN_H);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(140);
}
async function movePlanPt(page, x, y) {
  const p = await planPoint(page, x / PLAN_W, y / PLAN_H);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(220);
}

// Trade hvac on the office sheet; OPEN OFFICE 105 boxed (office, 9 ft, deck 12); a 150 CFM
// diffuser four times on the main's line; the system RTU-1 at 2,000 CFM, active.
async function hvacBase(page) {
  await page.evaluate(() => { window.App.pageTextItems && window.App.pageTextItems(0); });
  await page.waitForFunction(() => (window.App.peekPageTextItems(0) || []).length > 0, { timeout: 15000 }).catch(() => {});
  await page.evaluate(({ pw, room, dif }) => {
    const s = window.state, App = window.App, uid = () => App.uid();
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
    App.setProjectTrade && App.setProjectTrade('hvac', { remember: false, route: 'tour' });
    s.groupsEnabled = true;
    const ann = s.pages[0].canvases[0].annotations;
    const open = uid();
    s.rooms.push({ id: open, name: 'OPEN OFFICE 105', color: '#e85447', roomType: 'office', nameFromPlan: true });
    ann.roomBoxes.push({ id: uid(), x1: room.x1, y1: room.y1, x2: room.x2, y2: room.y2, heightFt: 9, roomId: open });
    const ci = (name) => ((App.getEffectiveCustomIcons() || []).find((i) => i.name === name) || {}).value;
    const d = { id: uid(), name: '12x12 Supply Diffuser', icon: (App.cfmDefaultIcon && App.cfmDefaultIcon()) || ci('Supply Diffuser') || App.getOrderedIcons()[0].value, color: '#e8c547', cfm: 150 };
    s.counters.push(d);
    ann.counterMarkers[d.id] = dif.map(([x, y]) => ({ x, y, id: uid(), group: null }));
    const rtu = { id: uid(), name: 'RTU-1', color: '#2e86de', equipmentTag: 'RTU-1', capacityCfm: 2000 };
    s.groups.push(rtu); s.activeGroupId = rtu.id;
    ann.legend = { x: pw - 210, y: 16, w: 195, h: 60, userResized: false };
    if (App.setDuctDeckHeight) App.setDuctDeckHeight(12);
    App.renderPdf(); App.updateUI(); App.renderAnnotations();
  }, { pw: PLAN_W, room: OPEN_OFFICE_105, dif: DIFFUSERS });
  await fitPlan(page);
  await page.waitForTimeout(350);
}
async function armDuctRun(page) {
  await page.evaluate(() => document.getElementById('ductBtn').click());
  await page.waitForSelector('#ductCreateModal.visible', { timeout: 5000 });
  await page.evaluate(() => document.getElementById('ductCreateStart').click());
  await page.waitForFunction(() => !!window.state.drawingDuct, { timeout: 5000 });
}
const stepRect = (page) => page.evaluate(() => { const App = window.App; const sug = App.getDuctDraftSuggestion && App.getDuctDraftSuggestion(); const next = sug && (sug.rectSize || sug.size); if (next && App.applyDuctSizeStep) App.applyDuctSizeStep(next); App.renderAnnotations(); });
// Two vertices placed and the cursor on the third: the chip at the cursor, the hint card above the footer.
async function hvacDraft(page) {
  await hvacBase(page);
  await frameRegion(page, CAM_OPEN_OFFICE);
  await armDuctRun(page);
  await clickPlanPt(page, ...MAIN_PTS[0]);
  await clickPlanPt(page, ...MAIN_PTS[1]);
  await movePlanPt(page, ...MAIN_PTS[2]);
}
// The main committed: 24×12 → 16×8 → 12×8 with two transitions, the diffusers attached.
async function hvacRun(page) {
  await hvacBase(page);
  await armDuctRun(page);
  await clickPlanPt(page, ...MAIN_PTS[0]);
  await clickPlanPt(page, ...MAIN_PTS[1]);
  await stepRect(page);
  await clickPlanPt(page, ...MAIN_PTS[2]);
  await stepRect(page);
  await clickPlanPt(page, ...MAIN_PTS[3]);
  await page.evaluate(() => { const App = window.App; App.finishDuctRun && App.finishDuctRun(); window.state.tool = App.TOOL.NONE; App.updateUI(); App.renderAnnotations(); });
  await page.waitForTimeout(300);
}

// --- electrical, "Circuit 7": what the film makes on camera, seeded -------------------
const RECEPT_E = [[238.5, 371.5], [288.75, 371.5], [339, 371.5], [389.25, 371.5], [172.5, 437.5]];   // north wall east of the door, then the west wall
const SWITCH_E = [234, 370];
const LIGHTS_E = [[247.5, 411.25], [352.5, 411.25], [247.5, 463.75], [352.5, 463.75]];
const CHAIN_E = [[247.5, 506.5], [300, 506.5], [352.5, 506.5]];   // along the south wall
const LP1_E = [492, 442];                                          // panel LP-1 on the janitor's east wall
async function electricalBase(page) {
  await page.evaluate(({ pw, rec, sw, lights, chain, lp1 }) => {
    const s = window.state, App = window.App, uid = () => App.uid();
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
    App.setProjectTrade && App.setProjectTrade('electrical', { remember: false, route: 'tour' });
    s.ceilingHeightFt = 10; s.makeUpFt = 1; s.groupsEnabled = true;
    const ann = s.pages[0].canvases[0].annotations;
    const ci = (name) => ((App.getEffectiveCustomIcons() || []).find((i) => i.name === name) || {}).value;
    const icon = (variant, fallback) => (App.tradeIconForType && App.tradeIconForType('electrical', variant)) || ci(fallback) || App.getOrderedIcons()[0].value;
    const r = { id: uid(), name: 'Duplex Receptacle', icon: icon('Duplex', 'Duplex Receptacle'), color: '#e85447', mountHeightIn: 18 };
    const w = { id: uid(), name: 'Single Pole Switch', icon: icon('Single Pole', 'Single Pole Switch'), color: '#e8c547', mountHeightIn: 48 };
    const l = { id: uid(), name: '2x4 Troffer Fixture', icon: icon('2x4 Troffer', '2x4 Troffer'), color: '#4a9eff' };
    s.counters.push(r, w, l);
    const cm = window.ConductorModel;
    const emt = { id: uid(), name: '3/4in EMT', color: '#a47fff', curveStyle: 'straight', raceway: { kind: 'EMT', size: '3/4"' }, conductors: cm ? cm.parseConductorSpec('3 #12 THHN + 1 #12 G').conductors : [] };
    s.lineTypes.push(emt);
    const g = { id: uid(), name: 'Circuit 7', color: '#c8963a', panel: 'LP-1', circuit: '7', loadAmps: 12 };
    s.groups.push(g); s.activeGroupId = g.id;
    ann.counterMarkers[r.id] = rec.map(([x, y]) => ({ x, y, id: uid(), group: g.id }));
    ann.counterMarkers[w.id] = [{ x: sw[0], y: sw[1], id: uid(), group: g.id }];
    ann.counterMarkers[l.id] = lights.map(([x, y]) => ({ x, y, id: uid(), group: g.id }));
    s.counterSettings = Object.assign({}, s.counterSettings, { size: 40, outlineSize: 2 });
    // the chain, device to device, each click writing its drop (ceiling 10 − mount 1.5 + make-up 1)
    s.activeCounterType = r.id; s.activeLineTypeId = emt.id; s.tool = App.TOOL.CHAIN; s.chainStart = null;
    chain.forEach(([x, y]) => App.commitChainPoint({ x, y }));
    s.chainStart = null; s.tool = App.TOOL.NONE;
    // the home run to LP-1 on the same conduit
    ann.quickLines.push({ id: uid(), x1: chain[2][0], y1: chain[2][1], x2: lp1[0], y2: lp1[1], lineTypeId: emt.id, color: emt.color, group: g.id, homerun: true });
    ann.legend = { x: pw - 210, y: 16, w: 195, h: 60, userResized: false };
    window.__spot = { r: r.id, emt: emt.id };
    App.markProjectDirty(); App.renderPdf(); App.updateUI(); App.renderAnnotations();
  }, { pw: PLAN_W, rec: RECEPT_E, sw: SWITCH_E, lights: LIGHTS_E, chain: CHAIN_E, lp1: LP1_E });
  await fitPlan(page);
  await page.waitForTimeout(350);
}

// --- plumbing, "Kitchen, Tuesday", on the restaurant sheet --------------------------
// The restaurant plan is drawn at 12 px/ft and placed at (60, 70) × 0.75 on the ANSI B
// sheet (the hero film's B()), so these are PDF points of that sheet. fitPlan is the office
// sheet's; the plumbing frames use frameRegion with the film's cameras instead.
const RB = (x, y) => [60 + 0.75 * x, 70 + 0.75 * y];
const FLOOR_DRAINS_P = [[610, 432], [740, 430], [860, 440], [648, 536], [740, 528], [238, 542], [340, 545], [630, 192], [766, 196], [902, 206]].map((p) => RB(...p));
const HAND_SINKS_P = [[600, 308], [928, 392], [330, 578]].map((p) => RB(...p));
const WATER_CLOSETS_P = [[596, 118], [732, 118]].map((p) => RB(...p));
const THREE_COMP_P = [[578, 476], [170, 560]].map((p) => RB(...p));
const COLD_SERVICE_P = [[883, 614], [883, 594], [192, 594], [192, 580]].map((p) => RB(...p));
const COLD_TRUNK_P = [[564, 594], [564, 110], [930, 110], [930, 384]].map((p) => RB(...p));
const HOT_SUPPLY_P = [[796, 572], [786, 572], [786, 590], [188, 590], [188, 580]].map((p) => RB(...p));
const HOT_RETURN_P = [[570, 590], [570, 105], [936, 105], [936, 572], [918, 572]].map((p) => RB(...p));
const DIM_31_8_P = [RB(560, 84), RB(940, 84)];
const CAM_PLAN_P = { x1: 145, y1: 118, x2: 860, y2: 575 };
const CAM_METER_P = { x1: 600, y1: 420, x2: 800, y2: 570 };   // the service riser at the meter (4:3, the WH/WM/GM corner of the plan)
// A PDF point of the current sheet in viewport pixels (any zoom / pan; the film's R.pt).
async function pdfPoint(page, x, y) {
  const box = await page.locator('#annCanvas').boundingBox();
  const zoom = await page.evaluate(() => window.state.zoom);
  return { x: box.x + x * zoom, y: box.y + y * zoom };
}
async function plumbingBase(page, opts = {}) {
  await page.evaluate(({ o, fd, hs, wc, cs, cold1, cold2, hot1, hot2 }) => {
    const s = window.state, App = window.App, uid = () => App.uid();
    s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
    App.setProjectTrade && App.setProjectTrade('plumbing', { remember: false, route: 'tour' });
    const ci = (name) => ((App.getEffectiveCustomIcons() || []).find((i) => i.name === name) || {}).value;
    const bi = (name) => ((App.getOrderedIcons() || []).find((i) => i.name === name) || {}).value;
    const first = App.getOrderedIcons()[0].value;
    const dot = 'M320 96C196 96 96 196 96 320s100 224 224 224 224-100 224-224S444 96 320 96z';
    const cFd = { id: uid(), name: 'Floor Drain', icon: dot, color: '#47d4d4' };
    const cHs = { id: uid(), name: 'Hand Sink', icon: ci('Mounted Sink') || bi('Sink') || first, color: '#e8c547' };
    const cWc = { id: uid(), name: 'Water Closet', icon: ci('Toilet') || bi('Water Closet') || first, color: '#47c88e' };
    const cCs = { id: uid(), name: '3-Comp Sink', icon: bi('Sink') || first, color: '#a47fff' };
    s.counters.push(cFd, cHs, cWc, cCs);
    const ann = s.pages[0].canvases[0].annotations;
    const marks = (pts) => pts.map(([x, y]) => ({ x, y, id: uid(), group: null }));
    ann.counterMarkers[cFd.id] = marks(fd); ann.counterMarkers[cHs.id] = marks(hs); ann.counterMarkers[cWc.id] = marks(wc); ann.counterMarkers[cCs.id] = marks(cs);
    const sm = window.SupportModel;
    const withHangers = (lt) => { const sg = sm && sm.hangerSuggestionsFor(lt.name)[0]; if (sg) lt.childCounts = [{ name: sg.name, qty: sg.qty, per: sg.per, intervalIn: sg.intervalIn, ruleId: sg.ruleId }]; return lt; };
    const cu = { id: uid(), name: '2in Cu cold', color: '#4a9eff', curveStyle: 'straight' };
    const hw = { id: uid(), name: '1-1/4in Cu hot', color: '#e85447', curveStyle: 'straight' };
    if (!o.noHangers) { withHangers(cu); withHangers(hw); }
    s.lineTypes.push(cu, hw);
    const poly = (lt, pts, name) => ({ id: uid(), name, color: lt.color, points: pts.map(([x, y]) => ({ x, y })), closed: false, lineTypeId: lt.id, group: null });
    ann.polylines.push(poly(cu, cold1, 'Cold service'), poly(cu, cold2, 'Cold trunk'), poly(hw, hot1, 'Hot supply'), poly(hw, hot2, 'Hot return'));
    // the service riser at the meter: 3 ft on the node nearest the meter
    const meter = { x: cold1[0][0], y: cold1[0][1] };
    const nodes = App.collectDropNodes(ann, 1) || [];
    let best = null, bestD = Infinity;
    nodes.forEach((n) => { const d = App.ptDist(n, meter); if (d < bestD) { bestD = d; best = n; } });
    if (best) App.applyDropToNode(ann, best, 3, 'ft');
    s.counterSettings = Object.assign({}, s.counterSettings, { size: 40, outlineSize: 2 });
    s.lineTypeSettings = Object.assign({}, s.lineTypeSettings, { lineSize: 6, lengthLabelSize: 14, dropXSize: 14 });
    ann.legend = { x: 1224 - 230, y: 16, w: 210, h: 60, userResized: false };
    window.__spot = { cu: cu.id, hw: hw.id };
    App.markProjectDirty(); App.renderPdf(); App.updateUI(); App.renderAnnotations();
  }, { o: opts, fd: FLOOR_DRAINS_P, hs: HAND_SINKS_P, wc: WATER_CLOSETS_P, cs: THREE_COMP_P, cold1: COLD_SERVICE_P, cold2: COLD_TRUNK_P, hot1: HOT_SUPPLY_P, hot2: HOT_RETURN_P });
  await frameRegion(page, CAM_PLAN_P);
}

const SPOTLIGHT = [
  {
    name: 'plumbing-1-quick-tab', dir: 'img/spotlight', format: 'jpeg', crop: CROP_QUICK, clip: '#counterModal .modal-card', plan: PLAN_B,
    async setup(page) {
      await plumbingBase(page);
      await page.evaluate(() => document.getElementById('addCounter').click());
      await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
      await page.evaluate(() => window.App.showCounterTab && window.App.showCounterTab('quickcount'));
      await page.waitForTimeout(200);
      await page.locator('#counterQuickCountTradeSegment [data-trade="plumbing"]').click();
      await page.waitForTimeout(200);
      for (const [sel, val] of [['#counterQuickCountSize', '2"'], ['#counterQuickCountMaterial', 'PVC'], ['#counterQuickCountType', 'Floor Drain']]) {
        try { await page.selectOption(sel, val); } catch (_) { /* the profile's vocabulary decides; keep its default */ }
      }
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'plumbing-2-rulebook', dir: 'img/spotlight', format: 'jpeg', crop: { sel: '#childCountsSuggest', w: 525, h: 394, ax: 0.5, ay: 1, oy: 14 }, clip: '#counterLineTypeDetailsModal .modal-card', plan: PLAN_B,
    async setup(page) {
      await plumbingBase(page, { noHangers: true });   // no hanger row yet, so "From the rulebook" offers it
      await page.evaluate(() => { const lt = window.state.lineTypes.find((l) => l.id === window.__spot.cu); window.App.openCounterLineTypeDetailsModal('lineType', lt); });
      await page.waitForSelector('#counterLineTypeDetailsModal.visible', { timeout: 5000 });
      await page.waitForSelector('#childCountsSuggest .child-count-suggest-add', { timeout: 5000 });
      await page.waitForTimeout(250);
    },
  },
  {
    name: 'plumbing-3-riser', dir: 'img/spotlight', format: 'jpeg', crop: { w: 800, h: 600 }, clip: '#canvasWrapper', plan: PLAN_B, dropSizes: true,
    async setup(page) {
      await plumbingBase(page);
      await frameRegion(page, CAM_METER_P);
    },
  },
  {
    name: 'plumbing-4-scale-check', dir: 'img/spotlight', format: 'jpeg', crop: { w: 587, h: 440 }, clip: '#scaleModal .modal-card', plan: PLAN_B,
    async setup(page) {
      await plumbingBase(page);
      await page.evaluate(() => { const s = window.state, App = window.App; s.scaleCheckMode = true; s.tool = App.TOOL.SCALE; s.scaleMode = App.SCALE_MODES.POINT_A; s.scalePointA = null; s.scalePointB = null; App.updateUI(); App.renderAnnotations(); });
      const a = await pdfPoint(page, ...DIM_31_8_P[0]); const b = await pdfPoint(page, ...DIM_31_8_P[1]);
      await page.mouse.click(a.x, a.y); await page.waitForTimeout(150);
      await page.mouse.click(b.x, b.y);
      await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
      await page.locator('#scaleCheckValue').fill("31'8");
      await page.locator('#scaleCheckBtn').click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'plumbing-5-bid-check', dir: 'img/spotlight', format: 'jpeg', crop: CROP_BID, css: CSS_BID, clip: '#bidCheckSection', plan: PLAN_B,
    async setup(page) {
      await plumbingBase(page);
      await page.evaluate(() => { const s = window.state; s.bidCheckCollapsed = false; window.App.renderBidCheck && window.App.renderBidCheck(); });
      await page.evaluate(() => document.getElementById('bidCheckSection').scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'plumbing-6-handoff', dir: 'img/spotlight', format: 'jpeg', crop: { sel: '#toastRegion .toast-card.visible', w: 640, h: 480, ax: 1, ay: 0, ox: 14, oy: -14 }, clip: '#canvasWrapper', plan: PLAN_B, clipboard: true,
    async setup(page) {
      await plumbingBase(page);
      await page.locator('#forPipeTooling').scrollIntoViewIfNeeded();
      await page.locator('#forPipeTooling').click();
      await page.waitForTimeout(300);
      const menu = await page.evaluate(() => !!document.querySelector('#forPipeToolingMenu.visible'));
      if (menu) { await page.locator('#forPipeToolingMenu .pipe-tooling-option[data-mode="all"]').click(); await page.waitForTimeout(300); }
      await page.waitForSelector('#toastRegion .toast-card.visible', { timeout: 5000 });
      await page.waitForTimeout(150);
    },
  },
  {
    name: 'electrical-1-quick-tab', dir: 'img/spotlight', format: 'jpeg', crop: CROP_QUICK, clip: '#counterModal .modal-card',
    async setup(page) {
      await electricalBase(page);
      await page.evaluate(() => document.getElementById('addCounter').click());
      await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
      await page.evaluate(() => window.App.showCounterTab && window.App.showCounterTab('quickcount'));
      await page.waitForTimeout(200);
      await page.locator('#counterQuickCountTradeSegment [data-trade="electrical"]').click();
      await page.waitForTimeout(200);
      await page.selectOption('#counterQuickCountSize', 'Receptacle');
      await page.selectOption('#counterQuickCountType', 'Duplex');
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'electrical-2-chain', dir: 'img/spotlight', format: 'jpeg', crop: { w: 880, h: 660, ax: 0, ay: 0, ox: -12, oy: -12 }, clip: '#chainPanel',   // the panel at the canvas's top left, the chained run below it
    async setup(page) {
      await electricalBase(page);
      await frameRegion(page, CAM_OPEN_OFFICE);
      await page.evaluate(() => { const s = window.state, App = window.App; s.activeCounterType = window.__spot.r; s.activeLineTypeId = window.__spot.emt; document.getElementById('chainBtn').click(); App.updateUI(); });
      await page.waitForSelector('#chainPanel', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'electrical-3-conduit', dir: 'img/spotlight', format: 'jpeg', crop: { sel: '#homerunGroup', w: 525, h: 394, ax: 0.5, ay: 0, oy: -202 }, clip: '#counterLineTypeDetailsModal .modal-card',
    async setup(page) {
      await electricalBase(page);
      await page.evaluate(() => { const lt = window.state.lineTypes.find((l) => l.id === window.__spot.emt); window.App.openCounterLineTypeDetailsModal('lineType', lt); });
      await page.waitForSelector('#counterLineTypeDetailsModal.visible', { timeout: 5000 });
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'electrical-4-wire', dir: 'img/spotlight', format: 'jpeg', crop: { w: 560, h: 420, ax: 0, ay: 0, ox: -6, oy: -40 }, css: CSS_BID, clip: '#summaryList',
    async setup(page) {
      await electricalBase(page);
      await page.evaluate(() => { const sec = document.getElementById('summarySection'); if (sec) sec.classList.remove('collapsed'); if ('summaryCollapsed' in window.state) window.state.summaryCollapsed = false; window.App.updateUI(); });
      await page.locator('.summary-derived-item').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'electrical-5-bid-check', dir: 'img/spotlight', format: 'jpeg', crop: CROP_BID, css: CSS_BID, clip: '#bidCheckSection',
    async setup(page) {
      await electricalBase(page);
      await page.evaluate(() => { const s = window.state; s.bidCheckCollapsed = false; window.App.renderBidCheck && window.App.renderBidCheck(); });
      await page.evaluate(() => document.getElementById('bidCheckSection').scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'electrical-6-handoff', dir: 'img/spotlight', format: 'jpeg', crop: { sel: '#toastRegion .toast-card.visible', w: 640, h: 480, ax: 1, ay: 0, ox: 14, oy: -14 }, clip: '#canvasWrapper',
    async setup(page) {
      await electricalBase(page);
      await page.evaluate(() => { window.open = () => ({ location: { set href(_) {} }, focus() {} }); window.state.showLegendOverlay = false; window.App.renderAnnotations(); });
      await page.locator('#forTakeoffTooling').scrollIntoViewIfNeeded();
      await page.locator('#forTakeoffTooling').click();
      await page.waitForTimeout(300);
      const menu = await page.evaluate(() => !!document.querySelector('#forTakeoffToolingMenu.visible'));
      if (menu) { await page.locator('#forTakeoffToolingMenu .takeoff-tooling-option[data-mode="all"]').click(); await page.waitForTimeout(300); }
      await page.waitForSelector('#airboardToastModal.visible', { timeout: 5000 });
      await page.waitForTimeout(150);
    },
  },
  {
    name: 'hvac-1-quick-tab', dir: 'img/spotlight', format: 'jpeg', crop: CROP_QUICK, clip: '#counterModal .modal-card',
    async setup(page) {
      await hvacBase(page);
      await page.evaluate(() => document.getElementById('addCounter').click());
      await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
      await page.evaluate(() => window.App.showCounterTab && window.App.showCounterTab('quickcount'));
      await page.waitForTimeout(200);
      await page.locator('#counterQuickCountTradeSegment [data-trade="hvac"]').click();
      await page.waitForTimeout(200);
      await page.selectOption('#counterQuickCountSize', '12x12');
      await page.selectOption('#counterQuickCountType', 'Supply Diffuser');
      await page.locator('#counterQuickCountCfm').fill('150');
      await page.waitForTimeout(250);
    },
  },
  {
    name: 'hvac-2-room-size', dir: 'img/spotlight', format: 'jpeg', crop: { w: 747, h: 560, ax: 0.5, ay: 0, oy: 22 }, clip: '#roomBoxModal .modal-card',
    async setup(page) {
      await hvacBase(page);
      await page.evaluate(() => { const s = window.state, App = window.App; s.tool = App.TOOL.ROOM; s.roomBoxStart = null; App.updateUI(); });
      const a = await planPoint(page, CONFERENCE_103.x1 / PLAN_W, CONFERENCE_103.y1 / PLAN_H);
      const b = await planPoint(page, CONFERENCE_103.x2 / PLAN_W, CONFERENCE_103.y2 / PLAN_H);
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      for (let i = 1; i <= 6; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6); await page.waitForTimeout(40); }
      await page.mouse.up();
      await page.waitForSelector('#roomBoxModal.visible', { timeout: 5000 });
      await page.waitForTimeout(400);   // the plan's text layer names the room
      const typeShown = await page.evaluate(() => document.getElementById('roomBoxTypeGroup').style.display !== 'none');
      if (typeShown) await page.selectOption('#roomBoxType', 'conference');
      await page.locator('#roomBoxHeight').fill('9');
      await page.waitForTimeout(250);
    },
  },
  { name: 'hvac-3-trace', dir: 'img/spotlight', format: 'jpeg', crop: { sel: '#ductHintCard', w: 800, h: 600, ax: 0.5, ay: 1, ox: -100, oy: 16 }, clip: '#canvasWrapper', setup: hvacDraft },
  {
    name: 'hvac-4-size-popover', dir: 'img/spotlight', format: 'jpeg', crop: { sel: '#ductSizePopover', w: 693, h: 520, ax: 1, ay: 0.5, ox: 16 }, clip: '#canvasWrapper',
    async setup(page) {
      await hvacDraft(page);
      await page.keyboard.press('s');
      await page.waitForSelector('#ductSizePopover', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(250);
    },
  },
  {
    name: 'hvac-5-schedule', dir: 'img/spotlight', format: 'jpeg', crop: { w: 680, h: 510, ax: 0.5, ay: 0, oy: 46 }, clip: '#ductScheduleModal .modal-card',
    async setup(page) {
      await hvacRun(page);
      await page.evaluate(() => document.getElementById('ductScheduleBtn').click());
      await page.waitForSelector('#ductScheduleModal.visible', { timeout: 5000 });
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'hvac-6-bid-check', dir: 'img/spotlight', format: 'jpeg', crop: CROP_BID, css: CSS_BID, clip: '#bidCheckSection',
    async setup(page) {
      await hvacRun(page);
      await page.evaluate(() => { const s = window.state; s.bidCheckCollapsed = false; window.App.renderBidCheck && window.App.renderBidCheck(); });
      await page.evaluate(() => document.getElementById('bidCheckSection').scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(300);
    },
  },
];

async function loadApp(page, baseUrl, plan = PLAN) {
  await page.goto(baseUrl + '/app/', { waitUntil: 'networkidle' });
  await page.locator('#pdfInput').setInputFiles(plan);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); return c && c.width > 0; }, { timeout: 15000 });
  // dismiss any restore/last-session prompt that could cover the canvas
  await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => m.classList.remove('visible')));
  await fitPlan(page);
}

(async () => {
  if (!fs.existsSync(PLAN)) { console.error('Missing samples/sample-plan.pdf — run `npm run build:sample-plan` first.'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Optional CLI args = shot name(s) to (re)build; default builds all.
  const argv = process.argv.slice(2);
  const setIdx = argv.indexOf('--set');
  const SET = setIdx > -1 ? argv[setIdx + 1] : 'guides';   // guides (default) or spotlight
  const only = argv.filter((a, i) => !a.startsWith('-') && argv[i - 1] !== '--set');
  const catalogue = SET === 'spotlight' ? SPOTLIGHT : SHOTS;
  const shots = only.length ? catalogue.filter((s) => only.includes(s.name)) : catalogue;
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  try {
    for (const shot of shots) {
      const page = await browser.newPage({ viewport: shot.viewport || { width: 1380, height: 900 }, deviceScaleFactor: 2, ...(shot.clipboard ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}) });
      if (shot.dropSizes) await page.addInitScript(() => { try { localStorage.setItem('clickcount-show-drop-sizes', '1'); } catch (_) { /* private mode */ } });
      if (!shot.noLoad) await loadApp(page, baseUrl, shot.plan || PLAN);
      if (shot.css) await page.addStyleTag({ content: shot.css });
      if (shot.setup) await shot.setup(page, baseUrl);
      let clip = await page.locator(shot.clip).first().boundingBox();
      if (!clip) throw new Error(`${shot.name}: clip ${shot.clip} not found`);
      if (shot.crop) {
        const c = shot.crop;
        const a = c.sel ? await page.locator(c.sel).first().boundingBox() : clip;
        if (!a) throw new Error(`${shot.name}: crop anchor ${c.sel} not found`);
        const vp = page.viewportSize();
        const ax = c.ax == null ? 0.5 : c.ax, ay = c.ay == null ? 0.5 : c.ay;
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        clip = { x: clamp(a.x + a.width * ax - c.w * ax + (c.ox || 0), 0, vp.width - c.w), y: clamp(a.y + a.height * ay - c.h * ay + (c.oy || 0), 0, vp.height - c.h), width: c.w, height: c.h };
        console.log(`  ${shot.name}: anchor ${Math.round(a.x)},${Math.round(a.y)} ${Math.round(a.width)}×${Math.round(a.height)} → window ${Math.round(clip.x)},${Math.round(clip.y)} ${c.w}×${c.h}`);
      }
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
      const ext = shot.format === 'jpeg' ? '.jpg' : '.png';
      const out = path.join(dir, shot.name + ext);
      await page.screenshot({ path: out, clip, ...(shot.format === 'jpeg' ? { type: 'jpeg', quality: 85 } : {}) });
      await page.close();
      console.log('  wrote ' + relDir + '/' + shot.name + ext);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`Generated ${shots.length} screenshot(s).`);
})().catch((e) => { console.error(e); process.exit(1); });
