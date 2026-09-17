#!/usr/bin/env node
/**
 * Generates the landing page hero video: one continuous take on the sample plan where
 * the cursor does a plumbing, an electrical, and an HVAC takeoff in turn, each trade on
 * its own layer, with a caption strip naming the beat. Drives the REAL app headlessly
 * (Chromium from @playwright/test) with real mouse moves and clicks, so every rubber
 * band, size chip, tally and footer readout is the app's own; nothing is drawn onto the
 * frames except the cursor and the captions.
 *
 * Frame-stepped, not screen-recorded: the timeline is walked one frame at a time
 * (move the mouse, let the app paint, screenshot the app at 2x), so the output is
 * deterministic and never drops a frame. ffmpeg then encodes:
 *
 *   img/landing-hero.mp4   H.264 High, limited-range yuv420p (plays in every current browser;
 *                          a VP9 WebM was tried and hit a Chromium decode error, so one source)
 *   img/landing-hero.png   the poster: the last frame (all three trades on the plan),
 *                          also the reduced-motion still and the SEO spec's img.hero-shot
 *
 * Films (`--film <name>`, default plumbing):
 *   plumbing  "Kitchen, Tuesday" on the restaurant sheet P-101: a thirty-sheet set lands
 *             and Prepare PDF keeps three; the scale is proved on a printed dimension;
 *             Quick Count with the number row; the sheet's own cold and hot water traced,
 *             two line types, two hanger rows; the riser; an RFI flag; the pull-back with
 *             marks hidden and shown; Copy to PipeTooling, held. Writes img/hero-plumbing.{mp4,png}.
 *   trades    the original three-trade take on the office sheet, img/landing-hero.{mp4,png}.
 *
 * Manual, like build:screenshots (needs a browser and ffmpeg; pixels are not
 * deterministic across machines), so it is NOT in `npm run check`:
 *
 *   npm run build:hero-video                     full quality (24 fps, ~90 s to render)
 *   npm run build:hero-video -- --film trades    the older take
 *   HERO_FPS=4 npm run build:hero-video          quick preview (same timeline, 4 fps)
 *   ... -- --keep-frames                         leave the JPEG frames in the temp dir
 *
 * The click targets are the three tours' own (features/tutorial.js), so the hero shows
 * exactly what "Five-minute walkthrough" under it delivers.
 */
/* global makeRectSize */   // duct-model.js global, read inside page.evaluate
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const PLAN = path.join(ROOT, 'samples', 'sample-plan.pdf');
const PLAN_B = path.join(ROOT, 'samples', 'sample-plan-advanced.pdf');
const OUT_DIR = path.join(ROOT, 'img');
const FILM = (() => { const i = process.argv.indexOf('--film'); return i > -1 ? process.argv[i + 1] : 'plumbing'; })();
const OUT_NAME = FILM === 'trades' ? 'landing-hero' : 'hero-' + FILM;
const FPS = Number(process.env.HERO_FPS) || 24;
const VIEWPORT = { width: 1280, height: 800 };   // the app is captured whole at 2x → 2560×1600
const OUT_W = 1920;                              // encoded width (1920×1200: 2x of the 980 px hero)
const KEEP_FRAMES = process.argv.includes('--keep-frames');
const FRAMES_ONLY = process.argv.includes('--frames-only');

// --- geometry, in PDF points of the sample sheet (the tours' targets) -------------
const WC_SPOTS = [{ x: 645, y: 506 }, { x: 675, y: 506 }, { x: 705, y: 506 }];
const LAV_SPOTS = [{ x: 688.5, y: 369 }, { x: 717, y: 369 }, { x: 745.5, y: 369 }];
const OPEN_OFFICE = { x1: 158, y1: 358, x2: 412, y2: 520 };
const CHAIN_SPOTS = [{ x: 250, y: 506 }, { x: 310, y: 506 }, { x: 370, y: 506 }];
const MAIN_VERTICES = [{ x: 164, y: 452 }, { x: 285, y: 452 }, { x: 406, y: 452 }];
// four diffusers along the main, inside the 8" attach distance (6 pt at 9 pt/ft)
const DIFFUSER_SPOTS = [{ x: 200, y: 457 }, { x: 268, y: 457 }, { x: 336, y: 457 }, { x: 404, y: 457 }];
// camera frames: the restrooms for plumbing, Open Office for the other two
const CAM_RESTROOMS = { x1: 555, y1: 322, x2: 800, y2: 548 };
const CAM_OFFICE = { x1: 118, y1: 322, x2: 505, y2: 548 };   // room for the drag readout right of the box

// --- tiny static file server (zero deps; same as build-screenshots) ---------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// --- the overlay: a drawn cursor, click ripples, the caption strip ----------------
const OVERLAY_SRC = `window.__hero = (() => {
  const style = document.createElement('style');
  style.textContent = '#toastRegion, #airboardToastModal, .aim-loupe { display: none !important; }';
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100000;font-family:"DM Sans",system-ui,sans-serif;';
  root.innerHTML =
    '<div id="heroRipples"></div>' +
    '<div id="heroCursor" style="position:absolute;left:0;top:0;width:26px;height:33px;will-change:transform;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">' +
      '<svg viewBox="0 0 22 28" width="26" height="33"><path d="M2 2 L2 22 L7.5 17.2 L11 25.5 L14.6 24 L11.2 15.8 L18.5 15.8 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
    '</div>' +
    '<div id="heroKey" style="position:absolute;left:0;top:0;min-width:30px;height:30px;padding:0 8px;border-radius:7px;background:#1e1e22;border:1px solid #e8c547;box-shadow:0 2px 0 #b8952f,0 6px 16px rgba(0,0,0,.45);color:#f0ede8;font:600 16px/28px "DM Mono",monospace;text-align:center;opacity:0"></div>' +
    '<div id="heroCap" style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;align-items:center;gap:12px;padding:11px 18px;border-radius:12px;background:rgba(15,15,17,.9);border:1px solid #3a3a44;box-shadow:0 8px 28px rgba(0,0,0,.45);white-space:nowrap;opacity:0">' +
      '<span id="heroCapTrade" style="font-family:\\'DM Mono\\',monospace;font-size:13px;letter-spacing:.14em;color:#e8c547"></span>' +
      '<span id="heroCapText" style="font-size:17px;color:#f0ede8"></span>' +
    '</div>';
  document.body.appendChild(root);
  const cursor = root.querySelector('#heroCursor'), ripples = root.querySelector('#heroRipples');
  const cap = root.querySelector('#heroCap'), capTrade = root.querySelector('#heroCapTrade'), capText = root.querySelector('#heroCapText');
  const key = root.querySelector('#heroKey');
  return {
    update(cur, clicks, caption, n, fps, keycap) {
      cursor.style.transform = 'translate(' + (cur.x - 2) + 'px,' + (cur.y - 2) + 'px)';
      if (keycap && n - keycap.since < Math.round(fps * 0.8)) {
        const t = (n - keycap.since) / Math.round(fps * 0.8);
        key.textContent = keycap.label;
        key.style.opacity = (t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1).toFixed(2);
        key.style.transform = 'translate(' + (cur.x + 22) + 'px,' + (cur.y + 26) + 'px)';
      } else key.style.opacity = '0';
      const life = Math.round(fps * 0.45);
      ripples.innerHTML = clicks.filter((c) => n - c.n < life).map((c) => {
        const t = (n - c.n) / life;
        const r = 6 + 22 * t;
        return '<div style="position:absolute;left:' + (c.x - r) + 'px;top:' + (c.y - r) + 'px;width:' + (2 * r) + 'px;height:' + (2 * r) + 'px;border-radius:50%;border:2px solid #e8c547;opacity:' + (1 - t).toFixed(2) + '"></div>';
      }).join('');
      const wrap = document.querySelector('.canvas-wrapper');
      if (wrap) {
        const r = wrap.getBoundingClientRect();
        cap.style.left = (r.left + r.width / 2) + 'px';
        cap.style.top = (r.bottom - 22) + 'px';
      }
      if (caption) {
        capTrade.textContent = caption.trade;
        capTrade.style.display = caption.trade ? '' : 'none';
        capText.textContent = caption.text;
        const fade = Math.round(fps * 0.3);
        cap.style.opacity = Math.min(1, (n - caption.since + 1) / fade).toFixed(2);
      } else cap.style.opacity = '0';
    },
  };
})();`;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// --- the recorder: one method per thing the cursor does, each advancing frames --
class Recorder {
  constructor(page, clip, dir) {
    this.page = page; this.clip = clip; this.dir = dir;
    this.n = 0; this.cur = { x: 0, y: 0 }; this.clicks = []; this.cap = null; this.cam = null; this.acts = []; this.keycap = null;
  }
  secs(s) { return Math.max(1, Math.round(s * FPS)); }
  async frame() {
    await this.page.evaluate(({ cur, clicks, cap, n, fps, keycap }) => window.__hero.update(cur, clicks, cap, n, fps, keycap), { cur: this.cur, clicks: this.clicks, cap: this.cap, n: this.n, fps: FPS, keycap: this.keycap });
    await this.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await this.page.screenshot({ path: path.join(this.dir, 'f_' + String(this.n).padStart(5, '0') + '.jpg'), clip: this.clip, type: 'jpeg', quality: 92 });
    this.n++;
    if (this.n % FPS === 0) process.stdout.write('  ' + (this.n / FPS) + 's');
  }
  async hold(s) { for (let i = 0; i < this.secs(s); i++) await this.frame(); }
  caption(trade, text) {
    if (trade && (!this.cap || this.cap.trade !== trade)) this.acts.push({ trade, at: this.n / FPS });
    this.cap = { trade, text, since: this.n };
  }
  async jump(x, y) { this.cur = { x, y }; await this.page.mouse.move(x, y); }
  // A real key press (the app's hotkey handler runs) with a keycap drawn by the cursor.
  async key(label) { this.keycap = { label, since: this.n }; await this.page.keyboard.press(label); await this.frame(); }
  // Move to a DOM element's centre (a button, a tile), scrolling it into view first.
  async moveToEl(selector, s, dx = 0, dy = 0) {
    const loc = this.page.locator(selector).first();
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const b = await loc.boundingBox();
    if (!b) throw new Error('moveToEl: ' + selector + ' has no box');
    await this.moveTo(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, s);
  }
  async moveTo(x, y, s) {
    const from = { ...this.cur }, N = this.secs(s);
    for (let i = 1; i <= N; i++) {
      const t = ease(i / N);
      this.cur = { x: from.x + (x - from.x) * t, y: from.y + (y - from.y) * t };
      await this.page.mouse.move(this.cur.x, this.cur.y);
      await this.frame();
    }
  }
  async click() {
    await this.page.mouse.down();
    this.clicks.push({ n: this.n, x: this.cur.x, y: this.cur.y });
    await this.frame();
    await this.page.mouse.up();
    await this.frame();
  }
  // PDF point → viewport point (the annotation canvas covers the whole sheet from 0,0)
  async pt(p) {
    const box = await this.page.locator('#annCanvas').boundingBox();
    const zoom = await this.page.evaluate(() => window.state.zoom);
    return { x: box.x + p.x * zoom, y: box.y + p.y * zoom };
  }
  async moveToPt(p, s) { const v = await this.pt(p); await this.moveTo(v.x, v.y, s); }
  async setCamera(r) {
    await this.page.evaluate((r) => {
      const s = window.state, App = window.App;
      const w = document.querySelector('.canvas-wrapper').getBoundingClientRect();
      const zoom = Math.min(App.getMaxZoom(), Math.min(w.width / (r.x2 - r.x1), w.height / (r.y2 - r.y1)));
      s.zoom = zoom;
      s.pan = { x: (w.width - (r.x2 - r.x1) * zoom) / 2 - r.x1 * zoom, y: (w.height - (r.y2 - r.y1) * zoom) / 2 - r.y1 * zoom };
      App.renderPdf();
      App.updateUI();
    }, r);
    this.cam = r;
  }
  async camera(r, s) {
    const from = this.cam, N = this.secs(s);
    for (let i = 1; i <= N; i++) {
      const t = ease(i / N);
      const m = {};
      for (const k of ['x1', 'y1', 'x2', 'y2']) m[k] = from[k] + (r[k] - from[k]) * t;
      await this.setCamera(m);
      await this.page.mouse.move(this.cur.x, this.cur.y);   // keep the app's mousePos current
      await this.frame();
    }
  }
}

// --- app state helpers (the tours' recipes, minus the dialogs) ---------------------
const seedPlumbing = () => {
  const s = window.state, App = window.App, uid = () => App.uid();
  const ci = (name) => ((App.getEffectiveCustomIcons() || []).find((i) => i.name === name) || {}).value;
  const first = App.getOrderedIcons()[0].value;
  s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
  s.ceilingHeightFt = 10; s.makeUpFt = 1;
  const wc = { id: uid(), name: 'Water Closet', icon: ci('Toilet') || first, color: '#4a9eff' };
  const lav = { id: uid(), name: 'Lavatory', icon: ci('Mounted Sink') || first, color: '#e8c547' };
  const pex = { id: uid(), name: '1in PEX', color: '#47c88e', curveStyle: 'straight' };
  const sm = window.SupportModel, sg = sm && sm.hangerSuggestionsFor(pex.name)[0];
  if (sg) pex.childCounts = [{ name: sg.name, qty: sg.qty, per: sg.per, intervalIn: sg.intervalIn, ruleId: sg.ruleId }];
  s.counters.push(wc, lav); s.lineTypes.push(pex);
  window.__ids = { wc: wc.id, lav: lav.id, pex: pex.id };
  App.setProjectTrade && App.setProjectTrade('plumbing', { remember: false, route: 'tour' });
  App.updateUI(); App.renderAnnotations();
};
const armCounter = (id) => { const s = window.state, App = window.App; s.activeCounterType = id; s.tool = App.TOOL.COUNTER; App.updateUI(); };
const armChain = ([counterId, lineTypeId]) => { const s = window.state, App = window.App; s.activeCounterType = counterId; s.activeLineTypeId = lineTypeId; s.tool = App.TOOL.CHAIN; s.chainStart = null; App.updateUI(); };
const endTool = () => { const s = window.state, App = window.App; s.chainStart = null; s.tool = App.TOOL.NONE; App.updateUI(); App.renderAnnotations(); };
const applyRiser = (first) => {
  const s = window.state, App = window.App;
  const a = App.ensureActiveCanvas(s.pages[s.currentPage]).annotations;
  const nodes = App.collectDropNodes(a, 1) || [];
  let best = null, bestD = Infinity;
  nodes.forEach((n) => { const d = App.ptDist(n, first); if (d < bestD) { bestD = d; best = n; } });
  if (best) { App.applyDropToNode(a, best, 3, 'ft'); App.pushRecentDrop && App.pushRecentDrop(3, 'ft'); }
  s.tool = App.TOOL.NONE; App.markProjectDirty(); App.renderAnnotations(); App.updateUI();
};
const addLayer = (name) => {
  const s = window.state, App = window.App;
  const page = s.pages[s.currentPage];
  const c = { id: App.uid(), name, annotations: App.makeAnnotations() };
  page.canvases.push(c);
  s.activeCanvasIdByPage[s.currentPage] = c.id;
  App.renderAnnotations(); App.updateUI();
};
const seedElectrical = () => {
  const s = window.state, App = window.App, uid = () => App.uid();
  const ci = (name) => ((App.getEffectiveCustomIcons() || []).find((i) => i.name === name) || {}).value;
  const first = App.getOrderedIcons()[0].value;
  const rec = { id: uid(), name: 'Duplex Receptacle', icon: (App.tradeIconForType && App.tradeIconForType('electrical', 'Duplex')) || ci('Duplex Receptacle') || first, color: '#e85447', mountHeightIn: 18 };
  const emt = { id: uid(), name: '3/4" EMT', color: '#8a4bb0', curveStyle: 'straight', raceway: { kind: 'EMT', size: '3/4"' }, conductors: window.ConductorModel ? window.ConductorModel.parseConductorSpec('3 #12 THHN + 1 #12 G').conductors : [] };
  s.counters.push(rec); s.lineTypes.push(emt);
  window.__ids.rec = rec.id; window.__ids.emt = emt.id;
  App.setProjectTrade && App.setProjectTrade('electrical', { remember: false, route: 'tour' });
  App.updateUI(); App.renderAnnotations();
};
const seedHvac = () => {
  const s = window.state, App = window.App, uid = () => App.uid();
  const ci = (name) => ((App.getEffectiveCustomIcons() || []).find((i) => i.name === name) || {}).value;
  const first = App.getOrderedIcons()[0].value;
  const dif = { id: uid(), name: 'Supply Diffuser', icon: (App.cfmDefaultIcon && App.cfmDefaultIcon()) || ci('Supply diffuser') || first, color: '#e8c547', cfm: 150 };
  s.counters.push(dif);
  s.groups = s.groups || [];
  const rtu = { id: uid(), name: 'RTU-1', color: '#2e86de', equipmentTag: 'RTU-1', capacityCfm: 2000 };
  s.groups.push(rtu); s.groupsEnabled = true; s.activeGroupId = rtu.id;
  window.__ids.dif = dif.id; window.__ids.rtu = rtu.id;
  App.setProjectTrade && App.setProjectTrade('hvac', { remember: false, route: 'tour' });
  if (App.setDuctDeckHeight) App.setDuctDeckHeight(12);
  App.updateUI(); App.renderAnnotations();
};
const armRoom = () => { const s = window.state, App = window.App; s.tool = App.TOOL.ROOM; s.roomBoxStart = null; App.updateUI(); };
const commitRoom = (r) => {
  const s = window.state, App = window.App;
  App.hideModal && App.hideModal('roomBoxModal');
  s.pendingRoomBox = null; s.roomBoxStart = null;
  const canvas = App.ensureActiveCanvas(s.pages[s.currentPage]);
  s.rooms = s.rooms || [];
  const room = { id: App.uid(), name: 'OPEN OFFICE 105', color: '#2e86de', type: 'office', roomType: 'office', nameFromPlan: true };
  s.rooms.push(room);
  canvas.annotations.roomBoxes = canvas.annotations.roomBoxes || [];
  canvas.annotations.roomBoxes.push({ id: App.uid(), x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, heightFt: 9, roomId: room.id, roomType: 'office' });
  s.tool = App.TOOL.NONE; App.markProjectDirty(); App.updateUI(); App.renderAnnotations();
};
const startDuct = async () => {
  const s = window.state, App = window.App;
  const el = (id) => document.getElementById(id);
  if (el('ductBtn')) el('ductBtn').click();
  await new Promise((r) => setTimeout(r, 120));
  if (typeof makeRectSize === 'function' && App.setDuctCreateSize) App.setDuctCreateSize(makeRectSize(24, 12));
  if (el('ductCreateStart')) el('ductCreateStart').click();
  await new Promise((r) => setTimeout(r, 60));
  App.updateUI();
  return !!s.drawingDuct;
};
const stepDuctSize = () => {
  const App = window.App;
  const sug = App.getDuctDraftSuggestion && App.getDuctDraftSuggestion();
  const next = (sug && (sug.rectSize || sug.size)) || (typeof makeRectSize === 'function' ? makeRectSize(16, 10) : null);
  if (next && App.applyDuctSizeStep) App.applyDuctSizeStep(next);
  App.renderAnnotations();
};
const finishDuct = () => { const s = window.state, App = window.App; App.finishDuctRun && App.finishDuctRun(); s.tool = App.TOOL.NONE; App.updateUI(); App.renderAnnotations(); };

// --- the take ------------------------------------------------------------------
async function record(page, dir) {
  const clip = await page.locator('.app').boundingBox();
  const R = new Recorder(page, clip, dir);
  await page.evaluate(OVERLAY_SRC);

  // Act 1 · Plumbing, the restrooms
  await page.evaluate(seedPlumbing);
  await R.setCamera(CAM_RESTROOMS);
  await page.waitForTimeout(400);
  const start = await R.pt({ x: 600, y: 450 });
  await R.jump(start.x, start.y);
  R.caption('PLUMBING', 'Count the water closets');
  await page.evaluate(armCounter, await page.evaluate(() => window.__ids.wc));
  await R.hold(0.35);
  for (const [i, p] of WC_SPOTS.entries()) { await R.moveToPt(p, i ? 0.5 : 0.8); await R.click(); await R.hold(0.15); }
  await R.hold(0.3);
  R.caption('PLUMBING', 'Chain the lav battery on 1in PEX');
  await page.evaluate(armChain, await page.evaluate(() => [window.__ids.lav, window.__ids.pex]));
  for (const [i, p] of LAV_SPOTS.entries()) { await R.moveToPt(p, i ? 0.8 : 0.7); await R.click(); await R.hold(0.15); }
  await page.evaluate(endTool);
  await R.hold(0.3);
  R.caption('PLUMBING', 'Add the 3 ft riser; hangers count themselves');
  await R.moveToPt(LAV_SPOTS[0], 0.6);
  await R.click();
  await page.evaluate(applyRiser, LAV_SPOTS[0]);
  await R.hold(0.9);

  // Act 2 · Electrical, Open Office on its own layer
  R.caption('ELECTRICAL', 'Chain three receptacles on 3/4" EMT');
  await page.evaluate(addLayer, 'Electrical');
  await page.evaluate(seedElectrical);
  await R.camera(CAM_OFFICE, 0.9);
  await page.waitForTimeout(350);
  await page.evaluate(armChain, await page.evaluate(() => [window.__ids.rec, window.__ids.emt]));
  for (const [i, p] of CHAIN_SPOTS.entries()) { await R.moveToPt(p, i ? 0.9 : 0.8); await R.click(); await R.hold(0.15); }
  await page.evaluate(endTool);
  await R.hold(0.3);
  R.caption('ELECTRICAL', 'Wire and cable derived from the raceway');
  const emtRow = await page.getByText('3/4" EMT', { exact: false }).first().boundingBox().catch(() => null);
  if (emtRow) await R.moveTo(emtRow.x + Math.min(120, emtRow.width / 2), emtRow.y + emtRow.height / 2, 1.0);
  await R.hold(1.6);

  // Act 3 · HVAC, Open Office on its own layer
  R.caption('HVAC', 'Box the room, then trace the main');
  await page.evaluate(addLayer, 'HVAC');
  await page.evaluate(seedHvac);
  await page.evaluate(armRoom);
  await R.moveToPt({ x: OPEN_OFFICE.x1, y: OPEN_OFFICE.y1 }, 0.7);
  await page.mouse.down();
  R.clicks.push({ n: R.n, x: R.cur.x, y: R.cur.y });
  await R.frame();
  await R.moveToPt({ x: OPEN_OFFICE.x2, y: OPEN_OFFICE.y2 }, 0.9);
  await page.mouse.up();
  await page.evaluate(commitRoom, OPEN_OFFICE);
  await R.hold(0.4);
  const drawing = await page.evaluate(startDuct);
  if (!drawing) throw new Error('duct trace did not arm (state.drawingDuct is false)');
  R.caption('HVAC', 'Trace the main; the size steps down with the air');
  await R.moveToPt(MAIN_VERTICES[0], 0.5); await R.click();
  await R.moveToPt(MAIN_VERTICES[1], 0.9); await R.click();
  await page.evaluate(stepDuctSize);
  await R.hold(0.2);
  await R.moveToPt(MAIN_VERTICES[2], 0.9); await R.click();
  await page.evaluate(finishDuct);
  await R.hold(0.3);
  R.caption('HVAC', 'Diffusers attach and carry their CFM');
  await page.evaluate(armCounter, await page.evaluate(() => window.__ids.dif));
  for (const [i, p] of DIFFUSER_SPOTS.entries()) { await R.moveToPt(p, i ? 0.45 : 0.6); await R.click(); await R.hold(0.1); }
  await page.evaluate(endTool);
  const park = await R.pt({ x: 430, y: 535 });
  R.caption('', 'One plan. Three trades. One takeoff.');
  await R.moveTo(park.x, park.y, 0.6);
  await R.hold(1.2);
  console.log('\n  act starts (index.html chip sync): ' + R.acts.map((a) => a.trade.toLowerCase() + ' ' + a.at.toFixed(2) + 's').join(' · '));
  return R.n;
}


// ============================================================================
// Film: plumbing, "Kitchen, Tuesday" (the restaurant sheet, P-101)
// ============================================================================
// Geometry in PDF points of the sheet. The restaurant plan is drawn at 12 px/ft in
// scripts/sample-plan-candidates.js and placed at (60, 70) × 0.75, so a plan pixel p
// lands at 60 + 0.75·x, 70 + 0.75·y (9 pt/ft; the 1/8" preset is exact).
const B = (x, y) => ({ x: 60 + 0.75 * x, y: 70 + 0.75 * y });
const DIM_31_8 = [B(560, 84), B(940, 84)];                       // the 31'-8" string along the top
const FLOOR_DRAINS = [B(610, 432), B(740, 430), B(860, 440), B(648, 536), B(740, 528), B(238, 542), B(340, 545), B(630, 192), B(766, 196), B(902, 206)];
const HAND_SINKS = [B(600, 308), B(928, 392), B(330, 578)];
const WATER_CLOSETS = [B(596, 118), B(732, 118)];
const THREE_COMP = [B(578, 476), B(170, 560)];
// The sheet's own domestic water, traced over the lines it already draws (LANDING-REFRESH.md,
// "trace the sheet's own hot and cold water"); the pipeLabels beside them name the sizes.
const COLD_SERVICE = [B(883, 614), B(883, 594), B(192, 594), B(192, 580)];              // 2" CW at the meter, 1" CW at the bar
const COLD_TRUNK = [B(564, 594), B(564, 110), B(930, 110), B(930, 384)];                // 1-1/2" CW up the kitchen, 3/4" CW across the top wall
const HOT_SUPPLY = [B(796, 572), B(786, 572), B(786, 590), B(188, 590), B(188, 580)];   // the water heater onto the south run
const HOT_RETURN = [B(570, 590), B(570, 105), B(936, 105), B(936, 572), B(918, 572)];   // 1-1/4" HW up, 3/4" HW down, the recirc back to the heater
const METER = COLD_SERVICE[0];                                                          // where the 3 ft service riser lands
const GREASE_INTERCEPTOR = B(1000, 500);
const CAM_SHEET = { x1: 0, y1: 0, x2: 1224, y2: 792 };
const CAM_PLAN = { x1: 145, y1: 118, x2: 860, y2: 575 };   // through the grease interceptor outside the east wall
const CAM_KITCHEN = { x1: 455, y1: 255, x2: 790, y2: 465 };

// The thirty-sheet set: the restaurant sheet copied per discipline, each copy stamped
// with a sheet number and name in a band across the top so the Prepare PDF grid reads
// as a real submission. The three plumbing sheets are what the film keeps; P-101 itself
// is left unstamped, since it is the sheet the takeoff happens on.
const SET_SHEETS = [
  ['G-001', 'COVER SHEET'], ['G-002', 'GENERAL NOTES'], ['A-101', 'FIRST FLOOR PLAN'], ['A-102', 'REFLECTED CEILING PLAN'],
  ['A-201', 'EXTERIOR ELEVATIONS'], ['A-301', 'BUILDING SECTIONS'], ['A-401', 'WALL SECTIONS'], ['A-501', 'FINISH PLAN'],
  ['A-601', 'DOOR AND WINDOW SCHEDULES'], ['S-101', 'FOUNDATION PLAN'], ['S-201', 'ROOF FRAMING PLAN'], ['S-301', 'STRUCTURAL DETAILS'],
  ['M-101', 'HVAC PLAN'], ['M-201', 'DUCTWORK PLAN'], ['M-301', 'MECHANICAL SCHEDULES'], ['M-401', 'MECHANICAL DETAILS'],
  ['M-501', 'CONTROLS'], ['E-101', 'LIGHTING PLAN'], ['E-201', 'POWER PLAN'], ['E-301', 'ONE-LINE DIAGRAM'],
  ['E-401', 'PANEL SCHEDULES'], ['E-501', 'ELECTRICAL DETAILS'], ['FP-101', 'FIRE PROTECTION PLAN'],
  ['P-101', 'PLUMBING PLAN'], ['P-201', 'WASTE AND VENT ISOMETRIC'], ['P-301', 'DOMESTIC WATER ISOMETRIC'],
  ['P-401', 'PLUMBING SCHEDULES'], ['P-501', 'PLUMBING DETAILS'], ['T-101', 'TECHNOLOGY PLAN'], ['L-101', 'LANDSCAPE PLAN'],
];
const SET_KEEP = [23, 24, 25];   // P-101, P-201, P-301
async function buildSampleSet(outPath) {
  const { PDFDocument, StandardFonts, rgb } = require(path.join(ROOT, 'vendor', 'pdf-lib-1.17.1.min.js'));
  const src = await PDFDocument.load(fs.readFileSync(PLAN_B));
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < SET_SHEETS.length; i++) {
    const [pg] = await out.copyPages(src, [0]);
    out.addPage(pg);
    if (SET_SHEETS[i][0] === 'P-101') continue;
    const { width, height } = pg.getSize();
    pg.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: rgb(0.11, 0.11, 0.13) });
    pg.drawText(SET_SHEETS[i][0], { x: 40, y: height - 66, size: 44, font, color: rgb(0.91, 0.77, 0.28) });
    pg.drawText(SET_SHEETS[i][1], { x: 260, y: height - 62, size: 30, font, color: rgb(0.94, 0.93, 0.91) });
  }
  fs.writeFileSync(outPath, await out.save());
}

// --- page-side helpers for the plumbing film -----------------------------------
const bigMarks = () => {
  const s = window.state, App = window.App;
  // Marks that read at hero size: twice the default, ringed in the counter's colour,
  // outlined, numbered large. Line labels and drop crosses up to match.
  // (ringSize is a PERCENT of the mark; the default 22 draws an 11 px dot at hero scale.)
  s.counterSettings = Object.assign({}, s.counterSettings, { size: 72, showRings: true, ringSize: 170, ringOpacity: 0.95, ringSolid: true, outlineSize: 3, numberSize: 26 });
  // lineSize is the stroke the canvas reads (canvas-draw env.lineWidth; app.js lw = lts.lineSize);
  // the first cut set a "lineWidth" key nothing reads and the runs drew at the 2 px default.
  s.lineTypeSettings = Object.assign({}, s.lineTypeSettings, { lengthLabelSize: 18, dropXSize: 18, lineSize: 7 });
  App.renderAnnotations(); App.updateUI();
};
const seedRestaurant = () => {
  const s = window.state, App = window.App, uid = () => App.uid();
  const ci = (name) => ((App.getEffectiveCustomIcons() || []).find((i) => i.name === name) || {}).value;
  const bi = (name) => ((App.getOrderedIcons() || []).find((i) => i.name === name) || {}).value;
  const first = App.getOrderedIcons()[0].value;
  const dot = 'M320 96C196 96 96 196 96 320s100 224 224 224 224-100 224-224S444 96 320 96z';
  s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
  const fd = { id: uid(), name: 'Floor Drain', icon: dot, color: '#4a9eff' };
  const hs = { id: uid(), name: 'Hand Sink', icon: ci('Mounted Sink') || bi('Sink') || first, color: '#e8c547' };
  const wc = { id: uid(), name: 'Water Closet', icon: ci('Toilet') || bi('Water Closet') || first, color: '#47c88e' };
  const cs = { id: uid(), name: '3-Comp Sink', icon: bi('Sink') || first, color: '#a47fff' };   // purple, so red stays the hot water's
  s.counters.push(fd, hs, wc, cs);
  // Cold reads blue and hot reads red: line types cannot be dashed, so the sheet's
  // solid-versus-dashed convention becomes colour. The names are the rulebook's: 2in Cu
  // hangs every 120 in and 1-1/4in HW Cu every 72 in (plumb.hanger.copper), two hanger
  // rows nobody typed. The water-sizing slice should ship these two colours on its line types.
  const sm = window.SupportModel;
  const withHangers = (lt) => { const sg = sm && sm.hangerSuggestionsFor(lt.name)[0]; if (sg) lt.childCounts = [{ name: sg.name, qty: sg.qty, per: sg.per, intervalIn: sg.intervalIn, ruleId: sg.ruleId }]; return lt; };
  const cu = withHangers({ id: uid(), name: '2in Cu', color: '#2e86de', curveStyle: 'straight' });
  const hw = withHangers({ id: uid(), name: '1-1/4in HW Cu', color: '#e85447', curveStyle: 'straight' });
  s.lineTypes.push(cu, hw);
  s.numberKeyBindings = { 1: { kind: 'counter', id: fd.id }, 2: { kind: 'counter', id: hs.id }, 3: { kind: 'counter', id: wc.id }, 4: { kind: 'counter', id: cs.id } };
  App.setProjectTrade && App.setProjectTrade('plumbing', { remember: false, route: 'tour' });
  window.__ids = { fd: fd.id, hs: hs.id, wc: wc.id, cs: cs.id, cu: cu.id, hw: hw.id };
  App.updateUI(); App.renderAnnotations();
};
const armScaleCheck = () => {
  const s = window.state, App = window.App;
  s.scaleCheckMode = true; s.tool = App.TOOL.SCALE; s.scaleMode = App.SCALE_MODES.POINT_A;
  s.scalePointA = null; s.scalePointB = null;
  App.updateUI(); App.renderAnnotations();
};
const armPolyline = (lineTypeId) => {
  const s = window.state, App = window.App;
  const lt = s.lineTypes.find((l) => l.id === lineTypeId);
  s.activeLineTypeId = lt.id; s.tool = App.TOOL.POLYLINE;
  s.drawingPolyline = { id: App.uid(), name: lt.name, color: lt.color, points: [], closed: false, lineTypeId: lt.id, group: s.activeGroupId || null };
  App.updateUI();
};
const applyDropAt = ([pt, ft]) => {
  const s = window.state, App = window.App;
  const a = App.ensureActiveCanvas(s.pages[s.currentPage]).annotations;
  const nodes = App.collectDropNodes(a, 1) || [];
  let best = null, bestD = Infinity;
  nodes.forEach((n) => { const d = App.ptDist(n, pt); if (d < bestD) { bestD = d; best = n; } });
  if (best) { App.applyDropToNode(a, best, ft, 'ft'); App.pushRecentDrop && App.pushRecentDrop(ft, 'ft'); }
  s.tool = App.TOOL.NONE; App.markProjectDirty(); App.renderAnnotations(); App.updateUI();
};
const addRfi = ([pt, text]) => {
  const s = window.state, App = window.App;
  const page = s.pages[s.currentPage];
  const canvas = App.ensureActiveCanvas(page);
  canvas.annotations.notes = canvas.annotations.notes || [];
  canvas.annotations.notes.push({ x: pt.x, y: pt.y, text, id: App.uid(), width: 150, fontSize: 14, placementRotation: page.rotation ?? 0, color: '#e85447' });
  App.markProjectDirty(); App.renderAnnotations(); App.updateUI();
};
const setHideMarks = (on) => { const s = window.state, App = window.App; s.hideMarks = !!on; App.renderAnnotations(); };

async function recordPlumbing(page, dir, setPdf) {
  const clip = await page.locator('.app').boundingBox();
  const R = new Recorder(page, clip, dir);
  await page.evaluate(OVERLAY_SRC);
  await page.evaluate(bigMarks);
  await R.jump(clip.x + clip.width * 0.55, clip.y + clip.height * 0.5);

  // 1 · The set lands. Prepare PDF: thirty sheets, keep three.
  await page.locator('#pdfInput').setInputFiles(setPdf);
  await page.waitForSelector('#preparePdfModal.visible', { timeout: 20000 });
  await page.waitForSelector('#preparePdfGrid .prepare-pdf-tile', { timeout: 20000 });
  await page.waitForTimeout(900);   // the visible tiles rasterize
  R.caption('', '30 sheets.');
  await R.hold(0.25);
  await R.moveToEl('#preparePdfName', 0.35); await R.click();
  await page.keyboard.press('Meta+A'); await page.keyboard.type('Main St Restaurant', { delay: 14 }); await R.hold(0.1);
  await R.moveToEl('#preparePdfKeepNone', 0.35); await R.click();
  R.caption('', '30 sheets. Keep 3.');
  await page.evaluate(() => { const w = document.getElementById('preparePdfGridWrap'); if (w) w.scrollTop = w.scrollHeight; });
  await R.hold(0.2);
  for (const idx of SET_KEEP) { await R.moveToEl('#preparePdfGrid .prepare-pdf-tile[data-orig-idx="' + idx + '"]', 0.2); await R.click(); }
  await R.hold(0.1);
  await R.moveToEl('#preparePdfDone', 0.3); await R.click();
  await page.waitForFunction(() => !document.querySelector('#preparePdfModal.visible') && window.state.pages.length === 3, { timeout: 30000 });
  await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); return c && c.width > 0; }, { timeout: 15000 });
  await page.evaluate(() => { window.App.pageTextItems && window.App.pageTextItems(0); });
  await page.evaluate(seedRestaurant);
  await page.evaluate(bigMarks);

  // 2 · P-101 opens. Push in from the sheet to the plan.
  R.caption('', 'Main St Restaurant, P-101');
  await R.setCamera(CAM_SHEET);
  await page.waitForTimeout(500);
  await R.hold(0.25);
  await R.camera(CAM_PLAN, 0.75);
  await page.waitForTimeout(300);
  await R.hold(0.2);

  // 3 · Prove the scale on the 31'-8" string.
  R.caption('', 'Prove the scale.');
  await page.evaluate(armScaleCheck);
  await R.moveToPt(DIM_31_8[0], 0.45); await R.click();
  await R.moveToPt(DIM_31_8[1], 0.5); await R.click();
  await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
  await R.hold(0.2);
  await R.moveToEl('#scaleCheckValue', 0.3); await R.click();
  await page.keyboard.type("31'8", { delay: 40 }); await R.hold(0.15);
  await R.moveToEl('#scaleCheckBtn', 0.3); await R.click();
  await R.hold(0.6);
  await R.moveToEl('#scaleCheckCancel', 0.25); await R.click();
  await page.waitForFunction(() => !document.querySelector('#scaleModal.visible'), { timeout: 5000 });
  await R.hold(0.15);

  // 4 · Count. Deliberate, then the number row and the pace lifts.
  R.caption('', 'Count.');
  await R.camera(CAM_KITCHEN, 0.6);
  await page.waitForTimeout(300);
  await R.key('1');
  for (const [i, p] of FLOOR_DRAINS.slice(0, 3).entries()) { await R.moveToPt(p, i ? 0.3 : 0.4); await R.click(); }
  await R.camera(CAM_PLAN, 0.55);
  await page.waitForTimeout(300);
  for (const p of FLOOR_DRAINS.slice(3)) { await R.moveToPt(p, 0.18); await R.click(); }
  await R.key('2');
  for (const p of HAND_SINKS) { await R.moveToPt(p, 0.2); await R.click(); }
  await R.key('3');
  for (const p of WATER_CLOSETS) { await R.moveToPt(p, 0.2); await R.click(); }
  await R.key('4');
  for (const p of THREE_COMP) { await R.moveToPt(p, 0.22); await R.click(); }
  await page.evaluate(endTool);
  await R.hold(0.5);

  // 5 · Run. Cold in, hot back: the sheet's own piping, each run on its own line type,
  //     so the legend gains a second row and the hangers row appears twice.
  const trace = async (lineTypeKey, pts, first, step) => {
    await page.evaluate(armPolyline, await page.evaluate((k) => window.__ids[k], lineTypeKey));
    for (const [i, p] of pts.entries()) { await R.moveToPt(p, i ? step : first); await R.click(); }
    await page.keyboard.press('Enter');
  };
  R.caption('', 'Cold in.');
  await trace('cu', COLD_SERVICE, 0.45, 0.22);
  await trace('cu', COLD_TRUNK, 0.3, 0.22);
  await page.evaluate(endTool);
  await R.hold(0.35);
  R.caption('', 'Hot back.');
  await trace('hw', HOT_SUPPLY, 0.35, 0.2);
  await trace('hw', HOT_RETURN, 0.3, 0.2);
  await page.evaluate(endTool);
  await R.hold(0.6);

  // 6 · Rise and hang: the service riser at the meter, then the hangers rows nobody typed.
  R.caption('', 'Rise and hang.');
  await R.moveToPt(METER, 0.45); await R.click();
  await page.evaluate(applyDropAt, [METER, 3]);
  await R.hold(0.8);

  // 7 · A question, pinned where it belongs.
  await R.moveToPt(GREASE_INTERCEPTOR, 0.5); await R.click();
  await page.evaluate(addRfi, [GREASE_INTERCEPTOR, 'RFI: interceptor size?']);
  await R.hold(0.7);

  // 8 · Nothing missed: the whole sheet, marks off, marks on.
  R.caption('', 'Nothing missed.');
  await R.camera(CAM_SHEET, 0.9);
  await page.waitForTimeout(400);
  await R.hold(0.5);
  await page.evaluate(setHideMarks, true); await R.hold(0.4);
  await page.evaluate(setHideMarks, false); await R.hold(0.55);

  // 9 · Done: Copy to PipeTooling. The overlay hides #toastRegion for the whole film (stray
  //     toasts are noise), so the Copied card is let back in here, alone; and since it hides
  //     itself after 1.5 s of wall clock, which a 24 fps hold outlasts, its hide is parked.
  await page.evaluate(() => {
    const st = document.createElement('style');
    const cw = document.querySelector('.canvas-wrapper').getBoundingClientRect();
    // bottom-left of the canvas, so the card never covers the legend at the sheet's top right
    st.textContent = '#toastRegion { display: flex !important; top: auto !important; right: auto !important; left: ' + Math.round(cw.left + 28) + 'px !important; bottom: ' + Math.round(window.innerHeight - cw.bottom + 28) + 'px !important; align-items: flex-start !important; }'
      + ' #toastRegion .toast-card:not(#pipeToolingCopiedModal) { display: none !important; }';
    document.head.appendChild(st);
    const App = window.App, hide = App.hideModal;
    App.hideModal = (id) => { if (id === 'pipeToolingCopiedModal') return; return hide(id); };
  });
  await R.moveToEl('#forPipeTooling', 0.6); await R.click();
  await page.waitForTimeout(150);
  await R.moveToEl('#forPipeToolingMenu .pipe-tooling-option[data-mode="all"]', 0.3); await R.click();
  await page.waitForTimeout(250);
  await R.moveToPt(B(520, 330), 0.35);   // off the sidebar, so no button sits highlighted under "Done."
  await page.evaluate(() => { const m = document.getElementById('pipeToolingCopiedModal'); if (m && !m.classList.contains('visible')) window.App.showModal('pipeToolingCopiedModal'); });
  await R.hold(1.3);
  R.caption('', 'Done.');
  await R.hold(1.0);
  console.log('\n  ' + R.n + ' frames');
  return R.n;
}

async function loadApp(page, baseUrl) {
  // the Drop-sizes canvas label ("3 ft" beside the riser) is a per-device toggle
  await page.addInitScript(() => { try { localStorage.setItem('clickcount-show-drop-sizes', '1'); } catch (_) { /* private mode */ } });
  await page.goto(baseUrl + '/app/', { waitUntil: 'networkidle' });
  await page.locator('#pdfInput').setInputFiles(PLAN);
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); return c && c.width > 0; }, { timeout: 15000 });
  await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => m.classList.remove('visible')));
  // warm the page's text layer so the plan-named room box tags itself on its first frame
  await page.evaluate(() => { window.App.pageTextItems && window.App.pageTextItems(0); });
  await page.waitForFunction(() => (window.App.peekPageTextItems(0) || []).length > 0, { timeout: 15000 });
  await page.waitForTimeout(300);
}

function ffmpeg(args) {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error('ffmpeg failed: ' + (res.stderr || res.stdout));
}

(async () => {
  if (!fs.existsSync(PLAN)) { console.error('Missing samples/sample-plan.pdf: run `npm run build:sample-plan` first.'); process.exit(1); }
  if (!FRAMES_ONLY && spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('ffmpeg is needed to encode (brew install ffmpeg), or pass --frames-only.'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-frames-'));
  const { server, port } = await startServer();
  const browser = await chromium.launch();
  let frames = 0;
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    process.stdout.write('rendering ' + FILM + ' at ' + FPS + ' fps:');
    if (FILM === 'plumbing') {
      if (!fs.existsSync(PLAN_B)) { console.error('Missing samples/sample-plan-advanced.pdf: run `npm run build:sample-plan-advanced` first.'); process.exit(1); }
      const setPdf = path.join(dir, 'sample-set.pdf');
      await buildSampleSet(setPdf);
      await page.addInitScript(() => { try { localStorage.setItem('clickcount-show-drop-sizes', '1'); } catch (_) { /* private mode */ } });
      await page.goto(`http://127.0.0.1:${port}/app/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => m.classList.remove('visible')));
      frames = await recordPlumbing(page, dir, setPdf);
    } else {
      await loadApp(page, `http://127.0.0.1:${port}`);
      frames = await record(page, dir);
    }
    console.log('\n  ' + frames + ' frames (' + (frames / FPS).toFixed(1) + ' s) in ' + dir);
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (FRAMES_ONLY) return;
  const dur = frames / FPS;
  const input = ['-framerate', String(FPS), '-i', path.join(dir, 'f_%05d.jpg')];
  // JPEG frames are full-range (yuvj420p); scale into the limited range every decoder expects.
  const vf = `scale=${OUT_W}:-2:flags=lanczos:in_range=pc:out_range=tv,fade=t=in:st=0:d=0.35,fade=t=out:st=${(dur - 0.45).toFixed(2)}:d=0.45,format=yuv420p`;
  ffmpeg([...input, '-vf', vf, '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-profile:v', 'high', '-color_range', 'tv', '-movflags', '+faststart', '-an', path.join(OUT_DIR, OUT_NAME + '.mp4')]);
  console.log('  wrote img/' + OUT_NAME + '.mp4');
  const last = path.join(dir, 'f_' + String(frames - 1).padStart(5, '0') + '.jpg');
  ffmpeg(['-i', last, '-vf', `scale=${OUT_W}:-2:flags=lanczos`, path.join(OUT_DIR, OUT_NAME + '.png')]);
  console.log('  wrote img/' + OUT_NAME + '.png (poster)');
  for (const f of [OUT_NAME + '.mp4', OUT_NAME + '.png']) {
    console.log('  ' + f + ': ' + (fs.statSync(path.join(OUT_DIR, f)).size / 1024 / 1024).toFixed(2) + ' MB');
  }
  if (!KEEP_FRAMES) fs.rmSync(dir, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
