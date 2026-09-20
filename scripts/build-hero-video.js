#!/usr/bin/env node
/**
 * Generates the landing page hero films: one per trade, each a real takeoff done on
 * camera on a sample sheet, with a caption strip naming the beat. Drives the REAL app
 * headlessly (Chromium from @playwright/test) with real mouse moves, clicks, typing and
 * key presses, so every dialog, rubber band, size chip, tally and footer readout is the
 * app's own; nothing is drawn onto the frames except the cursor, the keycaps and the
 * captions. The landing's trade chips pick which film plays (index.html).
 *
 * Frame-stepped, not screen-recorded: the timeline is walked one frame at a time
 * (move the mouse, let the app paint, screenshot the app at 2x), so the output is
 * deterministic and never drops a frame. ffmpeg then encodes, per film:
 *
 *   img/hero-<film>.mp4    H.264 High, limited-range yuv420p (plays in every current browser;
 *                          a VP9 WebM was tried and hit a Chromium decode error, so one source)
 *   img/hero-<film>.png    the poster: the last frame, also the reduced-motion still and
 *                          (for plumbing, the default) the SEO spec's img.hero-shot
 *
 * Films (`--film <name>`, default plumbing):
 *   plumbing  "Kitchen, Tuesday" on the restaurant sheet P-101: a thirty-sheet set lands
 *             and Prepare PDF keeps three; the scale is proved on a printed dimension;
 *             Quick Count with the number row; two line types made on camera (+ Add, the
 *             name typed, the swatch) and the sheet's own cold and hot water traced over
 *             its lines, the rulebook's hanger row accepted for each; the riser; an RFI
 *             flag; the pull-back with marks hidden and shown; Copy to PipeTooling, held.
 *             Writes img/hero-plumbing.{mp4,png}.
 *   electrical "Circuit 7" on the office sheet A-101: the set lands and Prepare keeps three;
 *             the scale proved on the 24'-0" bay; devices made on the Quick tab (receptacles
 *             at 18 in, the switch, the troffers) and counted; the conduit type named, its
 *             raceway and conductors set; the circuit group LP-1/7; the chain writing 9.5 ft
 *             drops; the home run; Bid Check's voltage drop and fill; the pull-back; Open in
 *             TakeoffTooling. Writes img/hero-electrical.{mp4,png}.
 *   hvac      "Pounds, not feet" on A-101: the set lands and Prepare keeps three; the scale
 *             proved; three rooms boxed with the Room Sizer (names off the plan, ceiling,
 *             deck, type); a 150 CFM diffuser made on the Quick tab, three leaving the room
 *             short and the fourth turning its tag green; the system RTU-1 at 2,000 CFM;
 *             the main traced at 24×12 with S stepping it down; the Duct Schedule's bid
 *             weight; Bid Check signed; the pull-back; Copy Schedule. Writes
 *             img/hero-hvac.{mp4,png}.
 *
 * Manual, like build:screenshots (needs a browser and ffmpeg; pixels are not
 * deterministic across machines), so it is NOT in `npm run check`:
 *
 *   npm run build:hero-video                     the plumbing film, full quality (24 fps, ~4 min)
 *   npm run build:hero-video -- --film electrical   (or hvac)
 *   HERO_FPS=4 npm run build:hero-video          quick preview (same timeline, 4 fps)
 *   ... -- --keep-frames                         leave the JPEG frames in the temp dir
 *
 * The click targets are the three tours' own (features/tutorial.js), so the hero shows
 * exactly what "Five-minute walkthrough" under it delivers.
 */
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
const OUT_NAME = 'hero-' + FILM;
const FPS = Number(process.env.HERO_FPS) || 24;
const VIEWPORT = { width: 1280, height: 800 };   // the app is captured whole at 2x → 2560×1600
const OUT_W = 1920;                              // encoded width (1920×1200: 2x of the 980 px hero)
const KEEP_FRAMES = process.argv.includes('--keep-frames');
const FRAMES_ONLY = process.argv.includes('--frames-only');
// HERO-CHAPTERS: walk the film's script without shooting a frame and write only
// img/hero-<film>.chapters.json (the frame count is the script's, so the times are exact).
const CHAPTERS_ONLY = process.argv.includes('--chapters-only');
// The landing's chapter strip reads these: four chapters per film, each starting at the first
// caption of its beat (LANDING-REFRESH.md, "The hero chapters"). The second and third words are the
// trade's: what it counts (fixtures, devices, rooms) and what it runs (pipe, wire, duct).
// The last is Pricing, not Bid: the film ends at the hand-off, counts sent on for someone to price.
const CHAPTER_STARTS = {
  plumbing: [['Scale', '30 sheets.'], ['Fixtures', 'Count.'], ['Pipe', 'Cold in.'], ['Pricing', 'Nothing missed.']],
  electrical: [['Scale', '30 sheets.'], ['Devices', 'Count.'], ['Wire', 'Name the conduit.'], ['Pricing', 'The wire, derived. The checks, computed.']],
  hvac: [['Scale', '30 sheets.'], ['Rooms', 'Box the rooms; the plan names them.'], ['Duct', 'Trace the main from the unit.'], ['Pricing', 'Pounds, not feet.']],
};
const BEATS = [];   // every caption with the film time it appears at, in order
function writeChapters(frames) {
  const round = (t) => Math.round(t * 100) / 100;
  const duration = round(frames / FPS);
  const starts = (CHAPTER_STARTS[FILM] || []).map(([name, text]) => {
    const b = BEATS.find((x) => x.text === text);
    if (!b) throw new Error('chapters: no caption "' + text + '" in the ' + FILM + ' film');
    return { name, start: round(b.t) };
  });
  starts[0].start = 0;
  const chapters = starts.map((c, i) => ({ name: c.name, start: c.start, end: i + 1 < starts.length ? starts[i + 1].start : duration }));
  const out = { film: FILM, duration, chapters, beats: BEATS.map((b) => ({ t: round(b.t), text: b.text })) };
  fs.writeFileSync(path.join(OUT_DIR, OUT_NAME + '.chapters.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('  wrote img/' + OUT_NAME + '.chapters.json (' + chapters.map((c) => c.name + ' ' + c.start).join(' · ') + ' · end ' + duration + ')');
}

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
        // Captions ride the canvas's bottom edge unless the beat asks for the top (the
        // duct hint card lives at the bottom while a run is traced).
        cap.style.top = (caption && caption.pos === 'top' ? r.top + 22 + cap.offsetHeight : r.bottom - 22) + 'px';
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
    if (CHAPTERS_ONLY) { this.n++; if (this.n % 2 === 0) await this.page.waitForTimeout(16); return; }   // no shot, but let the app settle as it would between frames
    await this.page.evaluate(({ cur, clicks, cap, n, fps, keycap }) => window.__hero.update(cur, clicks, cap, n, fps, keycap), { cur: this.cur, clicks: this.clicks, cap: this.cap, n: this.n, fps: FPS, keycap: this.keycap });
    await this.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await this.page.screenshot({ path: path.join(this.dir, 'f_' + String(this.n).padStart(5, '0') + '.jpg'), clip: this.clip, type: 'jpeg', quality: 92 });
    this.n++;
    if (this.n % FPS === 0) process.stdout.write('  ' + (this.n / FPS) + 's');
  }
  async hold(s) { for (let i = 0; i < this.secs(s); i++) await this.frame(); }
  caption(trade, text, pos) {
    if (trade && (!this.cap || this.cap.trade !== trade)) this.acts.push({ trade, at: this.n / FPS });
    this.cap = { trade, text, since: this.n, pos: pos || 'bottom' };
    BEATS.push({ t: this.n / FPS, text });
  }
  async jump(x, y) { this.cur = { x, y }; await this.page.mouse.move(x, y); }
  // A real key press (the app's hotkey handler runs) with a keycap drawn by the cursor.
  async key(label) { this.keycap = { label, since: this.n }; await this.page.keyboard.press(label); await this.frame(); }
  // The same, showing one glyph and pressing another (show "P", press "p": hotkeys are lower-case).
  async keyAs(label, press) { this.keycap = { label, since: this.n }; await this.page.keyboard.press(press); await this.frame(); }
  // Visible typing: one character per FPS/cps frames, so a name appears the way a typist writes it.
  // (keyboard.type's own delay costs no film time; only frames do.)
  async type(text, cps = 12) { const per = Math.max(1, Math.round(FPS / cps)); for (const ch of text) { await this.page.keyboard.type(ch); for (let i = 0; i < per; i++) await this.frame(); } }
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
  // A real right-click (the app's own context menu opens), ringed like a click.
  async rightClick() {
    await this.page.mouse.down({ button: 'right' });
    this.clicks.push({ n: this.n, x: this.cur.x, y: this.cur.y });
    await this.frame();
    await this.page.mouse.up({ button: 'right' });
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
// FILM-FIXTURES (2026-09-20): the sheet draws these and the first cuts never counted them, under
// a caption that says "Nothing missed.": the wall-hung lav in MEN 102 and WOMEN 103, and the two
// floor sinks (in front of PREP; by the clean table in DISH).
const LAVATORIES = [B(584, 180), B(712, 180)];
const FLOOR_SINKS = [B(640, 346), B(668, 550)];
// The sheet's own domestic water, traced over the lines it already draws (LANDING-REFRESH.md,
// "trace the sheet's own hot and cold water"); the pipeLabels beside them name the sizes.
const COLD_SERVICE = [B(883, 614), B(883, 594), B(192, 594), B(192, 580)];              // 2" CW at the meter, 1" CW at the bar
const COLD_TRUNK = [B(564, 594), B(564, 110), B(930, 110), B(930, 384)];                // 1-1/2" CW up the kitchen, 3/4" CW across the top wall
const HOT_SUPPLY = [B(796, 572), B(786, 572), B(786, 590), B(188, 590), B(188, 580)];   // the water heater onto the south run
const HOT_RETURN = [B(570, 590), B(570, 105), B(936, 105), B(936, 572), B(918, 572)];   // 1-1/4" HW up, 3/4" HW down, the recirc back to the heater
const METER = COLD_SERVICE[0];                                                          // where the 3 ft service riser lands
const GREASE_INTERCEPTOR = B(1000, 500);
const CAM_SHEET = { x1: 0, y1: 0, x2: 1224, y2: 792 };
const CAM_PULL = { x1: 0, y1: 0, x2: 1224, y2: 990 };    // the sheet with a grey band beneath it: the caption and the Copied card sit there, off the sheet's legend and title block
const CAM_PLAN = { x1: 145, y1: 118, x2: 860, y2: 575 };   // through the grease interceptor outside the east wall
const CAM_KITCHEN = { x1: 455, y1: 255, x2: 790, y2: 465 };

// --- the electrical film, "Circuit 7", on the office sheet A-101 ----------------------
// candidateAPlan() draws at 12 px/ft on the same 918 pt sheet, placed at (60, 70) × 0.75,
// so B() converts its plan coordinates too. Open Office 105 is SVG (132..470, 384..600).
const DIM_24 = [B(132, 84), B(420, 84)];                                 // the 24'-0" bay string, grid 1 to 2 (exact since the two-pixel fix)
// "Complete the room" (2026-09-20): every device in the open office lands on a circuit, chained
// device to device, each circuit with a square home run to LP-1. Three circuits because one
// cannot carry it: eight receptacles on one run is 145 ft at 12 A, 5.7% on #12, and the app's own
// voltage-drop row says so. Loads are the NEC 180 VA per receptacle (4 x 180 = 720 VA = 6 A).
const C7_RECEPTS = [B(450, 402), B(395, 402), B(340, 402), B(285, 402)];   // circuit 7: the north wall, from the panel end west (clear of the switch and its drop label at the door)
const C9_RECEPTS = [B(400, 582), B(320, 582), B(240, 582), B(160, 582)];   // circuit 9: the south wall, from the panel end west (one wall, so no run cuts the corner)
const HOME_7 = [C7_RECEPTS[0], B(576, 402), B(576, 462)];                  // square to the panel, down the janitor's east wall (the three land apart so their LP-1 tags do not pile up)
const HOME_9 = [C9_RECEPTS[0], B(552, 582), B(552, 541), B(570, 541)];     // square to the panel, into its face below circuit 11 (an upward arrow floats its tag onto 11's)
const SWITCH_SPOT_E = B(232, 400);                                       // inside the door at (210, 384)
const LIGHT_SPOTS_E = [B(250, 455), B(390, 455), B(390, 525), B(250, 525)];   // a 2 × 2 troffer grid, in chain order from the switch
const HOME_11 = [B(390, 455), B(540, 455), B(540, 497), B(570, 497)];           // circuit 11: from the troffer nearest the panel, into the panel's face
const LP1 = B(576, 496);                                                 // panel LP-1 on the janitor's east wall
const CAM_A_PLAN = { x1: 120, y1: 95, x2: 800, y2: 560 };
const CAM_A_OFFICE = { x1: 118, y1: 318, x2: 560, y2: 552 };             // the open office with LP-1 and its home-run tags in frame
const CAM_A_PULL = { x1: 100, y1: 80, x2: 820, y2: 740 };                // the plan (not the whole sheet: one room's marks stay legible) with the band beneath

// --- the HVAC film, "Pounds, not feet", on the office sheet A-101 -----------------------
const ROOM_OPEN_OFFICE = { x1: B(132, 384).x, y1: B(132, 384).y, x2: B(470, 600).x, y2: B(470, 600).y };   // OPEN OFFICE 105, 508 ft²
const ROOM_CONFERENCE = { x1: B(640, 100).x, y1: B(640, 100).y, x2: B(790, 340).x, y2: B(790, 340).y };    // CONFERENCE 103
const ROOM_OFFICE_101 = { x1: B(300, 100).x, y1: B(300, 100).y, x2: B(470, 340).x, y2: B(470, 340).y };    // OFFICE 101
// "Complete the room" (2026-09-20): the three boxed rooms are all served, off one system that
// starts at its unit. RTU-1 sits on the roof over the corridor's east end; the trunk leaves it
// (so the deck height writes its riser), runs the corridor ceiling west, steps down as the
// branches leave it, and turns north into Office 101; a branch taps off into Conference 103 and
// another into the Open Office. Diffusers sit a foot off their duct, inside the 8 in (12 pt)
// reach, so each hangs off its run by a flex leader. 4 + 3 + 2 at 150 CFM = 1,350 of 2,000.
const RTU_SPOT = B(770, 362);
const TRUNK_H = [RTU_SPOT, B(715, 362), B(440, 362), B(385, 362), B(385, 186)];   // unit, the two takeoffs, the turn, the end of Office 101
const BRANCH_CONF_H = [B(715, 362), B(715, 150)];                                  // north into Conference 103
const BRANCH_OPEN_H = [B(440, 362), B(440, 490), B(176, 490)];                     // south into the Open Office, then west along it
const DIFF_OPEN_H = [B(420, 502), B(340, 502), B(260, 502), B(180, 502)];          // the fourth is the one that turns the room green
const DIFF_CONF_H = [B(727, 300), B(727, 228), B(727, 156)];
const DIFF_101_H = [B(397, 292), B(397, 192)];
const CAM_H_ROOMS = { x1: 140, y1: 132, x2: 672, y2: 530 };                        // the three rooms and the corridor between them
const SET_KEEP_H = [2, 12, 13];   // A-101, M-101, M-201

// The thirty-sheet set: one sheet per discipline, each stamped with a sheet number and name
// in a band across the top so the Prepare PDF grid reads as a real submission. Only the
// sheets a film keeps carry the drawing; the other twenty-seven are blank drawing sheets. The three plumbing sheets are what the film keeps; P-101 itself
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
const SET_KEEP_E = [2, 17, 18];   // A-101, E-101, E-201 (the takeoff happens on A-101, left unstamped)
// Only the sheets a film KEEPS carry the drawing; the rest of the set are blank drawing sheets
// (banner, border, title block, no plan), so the Prepare grid reads as thirty different sheets
// with the trade's three standing out, not thirty copies of one plan (Will, 2026-09-20).
async function buildSampleSet(outPath, srcPath = PLAN_B, unstamped = 'P-101', keep = SET_KEEP) {
  const { PDFDocument, StandardFonts, rgb } = require(path.join(ROOT, 'vendor', 'pdf-lib-1.17.1.min.js'));
  const src = await PDFDocument.load(fs.readFileSync(srcPath));
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  const plain = await out.embedFont(StandardFonts.Helvetica);
  const { width, height } = src.getPage(0).getSize();
  const ink = rgb(0.1, 0.1, 0.1);
  for (let i = 0; i < SET_SHEETS.length; i++) {
    const [num, title] = SET_SHEETS[i];
    let pg;
    if (keep.includes(i)) { [pg] = await out.copyPages(src, [0]); out.addPage(pg); }
    else {
      pg = out.addPage([width, height]);
      pg.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
      pg.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: ink, borderWidth: 1.5 });
      const tb = { x: width - 24 - 300, y: 24, w: 300, h: 78 };
      pg.drawRectangle({ x: tb.x, y: tb.y, width: tb.w, height: tb.h, borderColor: ink, borderWidth: 1.2 });
      pg.drawLine({ start: { x: tb.x + 196, y: tb.y }, end: { x: tb.x + 196, y: tb.y + tb.h }, color: ink, thickness: 0.8 });
      pg.drawText(srcPath === PLAN_B ? 'MAIN ST RESTAURANT' : 'SUITE 200 OFFICE TI', { x: tb.x + 10, y: tb.y + 54, size: 11, font, color: ink });
      pg.drawText(title, { x: tb.x + 10, y: tb.y + 34, size: 8.5, font: plain, color: ink });
      pg.drawText('SHEET', { x: tb.x + 206, y: tb.y + 58, size: 7, font: plain, color: rgb(0.45, 0.45, 0.45) });
      pg.drawText(num, { x: tb.x + 206, y: tb.y + 28, size: 22, font, color: ink });
    }
    if (num === unstamped) continue;
    pg.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: rgb(0.11, 0.11, 0.13) });
    pg.drawText(num, { x: 40, y: height - 66, size: 44, font, color: rgb(0.91, 0.77, 0.28) });
    pg.drawText(title, { x: 260, y: height - 62, size: 30, font, color: rgb(0.94, 0.93, 0.91) });
  }
  fs.writeFileSync(outPath, await out.save());
}

// --- page-side helpers shared by the films ---------------------------------------
const endTool = () => { const s = window.state, App = window.App; s.chainStart = null; s.tool = App.TOOL.NONE; App.updateUI(); App.renderAnnotations(); };

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
  const fd = { id: uid(), name: 'Floor Drain', icon: dot, color: '#47d4d4' };   // teal: the palette's blue is cold water's
  const hs = { id: uid(), name: 'Hand Sink', icon: ci('Mounted Sink') || bi('Sink') || first, color: '#e8c547' };
  const wc = { id: uid(), name: 'Water Closet', icon: ci('Toilet') || bi('Water Closet') || first, color: '#47c88e' };
  const cs = { id: uid(), name: '3-Comp Sink', icon: bi('Sink') || first, color: '#a47fff' };   // purple, so red stays the hot water's
  const lav = { id: uid(), name: 'Lavatory', icon: bi('Sink') || first, color: '#f07fc0' };          // pink: clear of the hot water's red
  const fs = { id: uid(), name: 'Floor Sink', icon: bi('Square Empty') || first, color: '#ff9a4d' };   // the sheet's own square symbol
  s.counters.push(fd, hs, wc, cs, lav, fs);
  // No line types here: the film makes them on camera (+ Add, the name typed, the swatch),
  // and accepts the hanger row the rulebook writes from each name.
  s.numberKeyBindings = { 1: { kind: 'counter', id: fd.id }, 2: { kind: 'counter', id: hs.id }, 3: { kind: 'counter', id: wc.id }, 4: { kind: 'counter', id: cs.id }, 5: { kind: 'counter', id: lav.id }, 6: { kind: 'counter', id: fs.id } };
  App.setProjectTrade && App.setProjectTrade('plumbing', { remember: false, route: 'tour' });
  window.__ids = { fd: fd.id, hs: hs.id, wc: wc.id, cs: cs.id, lav: lav.id, fs: fs.id };
  App.updateUI(); App.renderAnnotations();
};
const armScaleCheck = () => {
  const s = window.state, App = window.App;
  s.scaleCheckMode = true; s.tool = App.TOOL.SCALE; s.scaleMode = App.SCALE_MODES.POINT_A;
  s.scalePointA = null; s.scalePointB = null;
  App.updateUI(); App.renderAnnotations();
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
  await page.evaluate(() => {
    // Film-only chrome: the bid switcher would read "No bid open" for the whole take (the
    // film never saves to the cloud), and the 220 px sidebar wraps "3-Comp Sink" onto three
    // lines at hero size. Neither is an app change.
    const st = document.createElement('style');
    st.textContent = '#headerBidChip, #headerBidChipDivider { display: none !important; } .sidebar { width: 300px !important; }';
    document.head.appendChild(st);
  });
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
  await R.key('5');
  for (const p of LAVATORIES) { await R.moveToPt(p, 0.22); await R.click(); }
  await R.key('6');
  for (const p of FLOOR_SINKS) { await R.moveToPt(p, 0.22); await R.click(); }
  await page.evaluate(endTool);
  await R.hold(0.5);

  // 5 · Run. Cold in, hot back. The estimator makes each line type on camera: + Add under
  //     Line Types, the name typed in (side in the name, material and size where the
  //     rulebook reads them), the swatch, Create. P arms Polyline with the new type (the
  //     Create dialog arms Quick Line, so the P is honest), the sheet's own piping is traced,
  //     Enter commits. Then the row's pencil: the details dialog already carries "From the
  //     rulebook: Hanger · 1 per 10 ft · matches copper · horizontal · 2 in · § IPC 308.5",
  //     and one tap on Add is the row nobody typed. Twice, with two spacings.
  const createLineType = async (name, color) => {
    await R.moveToEl('#addLineType', 0.45); await R.click();
    await page.waitForSelector('#lineTypeModal.visible', { timeout: 5000 });
    await R.moveToEl('#lineTypeName', 0.3); await R.click();
    await R.type(name, 12);
    await R.hold(0.15);
    await R.moveToEl('#lineTypeColorRow .color-swatch[data-color="' + color + '"]', 0.35); await R.click();
    await R.hold(0.15);
    await R.moveToEl('#lineTypeCreate', 0.35); await R.click();
    await page.waitForFunction(() => !document.querySelector('#lineTypeModal.visible'), { timeout: 5000 });
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });   // the hotkey guard ignores keys typed into an input
    await R.hold(0.3);
  };
  const drawRun = async (pts, first, step) => {
    await R.keyAs('P', 'p');
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.POLYLINE && !!window.state.drawingPolyline, { timeout: 3000 });
    for (const [i, p] of pts.entries()) { await R.moveToPt(p, i ? step : first); await R.click(); }
    await R.key('Enter');
    await page.waitForFunction(() => !window.state.drawingPolyline, { timeout: 3000 });
    await R.hold(0.25);
  };
  const acceptHangers = async (name) => {
    const id = await page.evaluate((n) => window.state.lineTypes.find((l) => l.name === n).id, name);
    await R.moveToEl('#lineTypesList .sidebar-item-line-type[data-line-type-id="' + id + '"] .edit-btn', 0.45); await R.click();
    await page.waitForSelector('#counterLineTypeDetailsModal.visible', { timeout: 5000 });
    await page.waitForSelector('#childCountsSuggest .child-count-suggest-add', { timeout: 5000 });
    await R.hold(0.6);
    await R.moveToEl('#childCountsSuggest .child-count-suggest-add', 0.5); await R.click();
    await R.hold(0.6);
    await R.moveToEl('#counterLineTypeDetailsClose', 0.35); await R.click();
    await page.waitForFunction(() => !document.querySelector('#counterLineTypeDetailsModal.visible'), { timeout: 5000 });
    await R.hold(0.3);
  };
  R.caption('', 'Cold in.');
  await createLineType('2in Cu cold', '#4a9eff');
  await drawRun(COLD_SERVICE, 0.45, 0.22);
  await drawRun(COLD_TRUNK, 0.3, 0.22);
  R.caption('', 'Hangers, from the rulebook.');
  await acceptHangers('2in Cu cold');
  R.caption('', 'Hot back.');
  await createLineType('1-1/4in Cu hot', '#e85447');
  await drawRun(HOT_SUPPLY, 0.35, 0.2);
  await drawRun(HOT_RETURN, 0.3, 0.2);
  await acceptHangers('1-1/4in Cu hot');
  await R.hold(0.3);

  // 6 · Rise: the service riser at the meter.
  R.caption('', 'Rise.');
  await R.moveToPt(METER, 0.45); await R.click();
  await page.evaluate(applyDropAt, [METER, 3]);
  await R.hold(0.8);

  // 7 · A question, pinned where it belongs.
  await R.moveToPt(GREASE_INTERCEPTOR, 0.5); await R.click();
  await page.evaluate(addRfi, [GREASE_INTERCEPTOR, 'RFI: interceptor size?']);
  await R.hold(0.7);

  // 8 · Nothing missed: the whole sheet, marks off, marks on.
  R.caption('', 'Nothing missed.');
  await R.camera(CAM_PULL, 0.9);
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

// Page-side seed for the electrical film: the scale preset, the trade, the project's ceiling
// (10 ft; with an 18 in mount height the Chain tool writes 10 − 1.5 + 1 make-up = 9.5 ft per
// device) and the Groups gate. Devices, the conduit type and the circuit are made on camera.
const seedOffice = () => {
  const s = window.state, App = window.App;
  s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
  App.setProjectTrade && App.setProjectTrade('electrical', { remember: false, route: 'tour' });
  s.ceilingHeightFt = 10; s.makeUpFt = 1; s.groupsEnabled = true;
  App.updateUI(); App.renderAnnotations();
};

async function recordElectrical(page, dir, setPdf) {
  const clip = await page.locator('.app').boundingBox();
  const R = new Recorder(page, clip, dir);
  await page.evaluate(OVERLAY_SRC);
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = '#headerBidChip, #headerBidChipDivider { display: none !important; } .sidebar { width: 300px !important; }';
    document.head.appendChild(st);
    // The hand-off opens TakeoffTooling in a new tab; the film keeps the tab and shows the toast.
    window.open = () => ({ location: { set href(_) {} }, focus() {} });
  });
  await page.evaluate(bigMarks);
  await R.jump(clip.x + clip.width * 0.55, clip.y + clip.height * 0.5);

  // 1 · The set lands. Prepare PDF: thirty sheets, keep three.
  await page.locator('#pdfInput').setInputFiles(setPdf);
  await page.waitForSelector('#preparePdfModal.visible', { timeout: 20000 });
  await page.waitForSelector('#preparePdfGrid .prepare-pdf-tile', { timeout: 20000 });
  await page.waitForTimeout(900);
  R.caption('', '30 sheets.');
  await R.hold(0.25);
  await R.moveToEl('#preparePdfName', 0.35); await R.click();
  await page.keyboard.press('Meta+A'); await page.keyboard.type('Suite 200 Office TI', { delay: 14 }); await R.hold(0.1);
  await R.moveToEl('#preparePdfKeepNone', 0.35); await R.click();
  R.caption('', '30 sheets. Keep 3.');
  await R.hold(0.2);
  for (const idx of SET_KEEP_E) { await R.moveToEl('#preparePdfGrid .prepare-pdf-tile[data-orig-idx="' + idx + '"]', 0.25); await R.click(); }
  await R.hold(0.1);
  await R.moveToEl('#preparePdfDone', 0.3); await R.click();
  await page.waitForFunction(() => !document.querySelector('#preparePdfModal.visible') && window.state.pages.length === 3, { timeout: 30000 });
  await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); return c && c.width > 0; }, { timeout: 15000 });
  await page.evaluate(() => { window.App.pageTextItems && window.App.pageTextItems(0); });
  await page.evaluate(seedOffice);
  await page.evaluate(bigMarks);

  // 2 · A-101 opens. Push in from the sheet to the plan.
  R.caption('', 'Suite 200, A-101');
  await R.setCamera(CAM_SHEET);
  await page.waitForTimeout(500);
  await R.hold(0.25);
  await R.camera(CAM_A_PLAN, 0.75);
  await page.waitForTimeout(300);
  await R.hold(0.2);

  // 3 · Prove the scale on the 24'-0" bay.
  R.caption('', 'Prove the scale.');
  await page.evaluate(armScaleCheck);
  await R.moveToPt(DIM_24[0], 0.45); await R.click();
  await R.moveToPt(DIM_24[1], 0.5); await R.click();
  await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
  await R.hold(0.2);
  await R.moveToEl('#scaleCheckValue', 0.3); await R.click();
  await page.keyboard.type('24', { delay: 40 }); await R.hold(0.15);
  await R.moveToEl('#scaleCheckBtn', 0.3); await R.click();
  await R.hold(0.6);
  await R.moveToEl('#scaleCheckCancel', 0.25); await R.click();
  await page.waitForFunction(() => !document.querySelector('#scaleModal.visible'), { timeout: 5000 });
  await R.hold(0.15);

  // 4 · Devices. Each is made on the Quick tab (Category / Variant) and arrives with its mount
  //     height. Nothing is placed by hand except the panel: the Chain tool places every device
  //     WITH its conduit and its drop, which is how the room is wired below.
  const quickAdd = async (category, variant, pickTrade) => {
    await R.moveToEl('#addCounter', 0.4); await R.click();
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await R.moveToEl('#counterModal .counter-tab[data-tab="quickcount"]', 0.28); await R.click();
    await R.hold(0.12);
    if (pickTrade) { await R.moveToEl('#counterQuickCountTradeSegment [data-trade="electrical"]', 0.32); await R.click(); await R.hold(0.15); }
    await R.moveToEl('#counterQuickCountSize', 0.28); await R.click();
    await page.selectOption('#counterQuickCountSize', category); await R.hold(0.15);
    await R.moveToEl('#counterQuickCountType', 0.28); await R.click();
    await page.selectOption('#counterQuickCountType', variant); await R.hold(0.25);
    await R.moveToEl('#counterQuickCountAdd', 0.32); await R.click();
    await page.waitForFunction(() => !document.querySelector('#counterModal.visible'), { timeout: 5000 });
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await R.hold(0.15);
  };
  const recolor = (re, color) => page.evaluate(([r, c]) => { const k = window.state.counters.find((x) => new RegExp(r).test(x.name)); if (k) { k.color = c; window.App.renderAnnotations(); window.App.updateUI(); } }, [re, color]);
  const counterId = (re) => page.evaluate((r) => window.state.counters.find((c) => new RegExp(r).test(c.name)).id, re);
  R.caption('', 'Count.');
  await R.camera(CAM_A_OFFICE, 0.6);
  await page.waitForTimeout(300);
  await quickAdd('Receptacle', 'Duplex', true);
  R.caption('', 'Receptacles, 18 in AFF by default.');
  await page.evaluate(endTool);
  await quickAdd('Switch', 'Single Pole', false);
  await recolor('Switch', '#e8c547');
  R.caption('', 'The switch, 48 in.');
  await page.evaluate(endTool);
  await quickAdd('Fixture', '2x4 Troffer', false);
  await recolor('Troffer', '#4a9eff');
  R.caption('', 'Fixtures, at the ceiling.');
  await page.evaluate(endTool);
  await quickAdd('Panel', 'Panelboard', false);
  await recolor('Panel', '#47c88e');
  R.caption('', 'The panel, LP-1.');
  await R.moveToPt(LP1, 0.45); await R.click();   // the Quick tab left the tool armed
  await page.evaluate(endTool);
  // Name it in its details: a counter with a panel name IS the panel mark, which is what keeps
  // it out of "devices on no circuit" and lets the groups' LP-1 find it.
  const panelId = await counterId('Panel');
  await R.moveToEl('#countersList [data-counter-id="' + panelId + '"] .edit-btn', 0.4); await R.click();
  await page.waitForSelector('#counterLineTypeDetailsModal.visible', { timeout: 5000 });
  await R.moveToEl('#panelName', 0.4); await R.click();
  await R.type('LP-1', 12);
  await page.keyboard.press('Enter');
  await R.hold(0.35);
  await R.moveToEl('#counterLineTypeDetailsClose', 0.3); await R.click();
  await page.waitForFunction(() => !document.querySelector('#counterLineTypeDetailsModal.visible'), { timeout: 5000 });
  if (await page.evaluate((id) => ((window.App.getActiveAnnotations(window.state.pages[0]).counterMarkers || {})[id] || []).length, panelId) !== 1) throw new Error('electrical film: the panel mark was not placed');
  await R.hold(0.3);

  // 5 · The conduit: a line type made on camera, then its raceway and conductors in the
  //     details dialog. From here every run of it carries 3 #12 THHN + 1 #12 G.
  R.caption('', 'Name the conduit.');
  await R.moveToEl('#addLineType', 0.45); await R.click();
  await page.waitForSelector('#lineTypeModal.visible', { timeout: 5000 });
  await R.moveToEl('#lineTypeName', 0.3); await R.click();
  await R.type('3/4in EMT', 12);
  await R.hold(0.15);
  await R.moveToEl('#lineTypeColorRow .color-swatch[data-color="#a47fff"]', 0.35); await R.click();
  await R.hold(0.15);
  await R.moveToEl('#lineTypeCreate', 0.35); await R.click();
  await page.waitForFunction(() => !document.querySelector('#lineTypeModal.visible'), { timeout: 5000 });
  await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  await page.evaluate(endTool);
  await R.hold(0.25);
  R.caption('', 'List the wire inside it.');
  const emtId = await page.evaluate(() => window.state.lineTypes.find((l) => l.name === '3/4in EMT').id);
  await R.moveToEl('#lineTypesList .sidebar-item-line-type[data-line-type-id="' + emtId + '"] .edit-btn', 0.45); await R.click();
  await page.waitForSelector('#counterLineTypeDetailsModal.visible', { timeout: 5000 });
  await R.moveToEl('#racewayKind', 0.4); await R.click();
  await page.selectOption('#racewayKind', 'EMT'); await R.hold(0.25);
  await R.moveToEl('#racewaySize', 0.3); await R.click();
  await page.selectOption('#racewaySize', '3/4"'); await R.hold(0.25);
  await R.moveToEl('#conductorsSpec', 0.35); await R.click();
  await R.type('3 #12 THHN + 1 #12 G', 14);
  await page.keyboard.press('Enter');
  await R.hold(0.7);
  await R.moveToEl('#counterLineTypeDetailsClose', 0.35); await R.click();
  await page.waitForFunction(() => !document.querySelector('#counterLineTypeDetailsModal.visible'), { timeout: 5000 });
  await R.hold(0.25);

  // 6-8 · Three circuits, each the same three moves. The circuit is a group with its panel,
  //       number and load, made first so what follows lands in it. T chains device to device,
  //       every click writing its drop into the run. P draws the home run square to the panel,
  //       and Line Properties flags it the homerun, which is how the circuit knows its panel.
  const makeCircuit = async (name, number, amps) => {
    if (await page.evaluate(() => document.getElementById('groupsSection').classList.contains('collapsed'))) { await R.moveToEl('#groupsSectionTitle', 0.4); await R.click(); await R.hold(0.12); }
    await R.moveToEl('#addGroup', 0.3); await R.click();
    await page.waitForSelector('#groupModal.visible', { timeout: 5000 });
    await R.moveToEl('#groupModalName', 0.28); await R.click();
    await R.type(name, 14);
    await R.moveToEl('#groupModalPanel', 0.26); await R.click();
    await R.type('LP-1', 14);
    await R.moveToEl('#groupModalCircuit', 0.26); await R.click();
    await R.type(number, 14);
    await R.moveToEl('#groupModalLoadAmps', 0.26); await R.click();
    await R.type(amps, 14);
    await R.hold(0.12);
    await R.moveToEl('#groupModalDone', 0.3); await R.click();
    await page.waitForFunction(() => !document.querySelector('#groupModal.visible'), { timeout: 5000 });
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await R.hold(0.2);
  };
  // Open the Chain panel (T the first time, its header chip after), pick the device, close it.
  const chainPick = async (id, pickConduit) => {
    if (await page.evaluate(() => window.state.tool === window.App.TOOL.CHAIN)) { await R.moveToEl('#headerChainPair', 0.35); await R.click(); }
    else await R.keyAs('T', 't');
    await page.waitForSelector('#chainPanel', { state: 'visible', timeout: 5000 });
    await R.moveToEl('#chainCounterList .chain-row[data-id="' + id + '"] .chain-row-name', 0.35); await R.click();
    if (pickConduit) { await R.moveToEl('#chainLineTypeList .chain-row[data-id="' + emtId + '"] .chain-row-name', 0.3); await R.click(); }
    await R.hold(0.12);
    await R.moveToEl('#chainPanelClose', 0.26); await R.click();
  };
  const chain = async (pts, first, step) => { for (const [i, p] of pts.entries()) { await R.moveToPt(p, i ? step : first); await R.click(); await R.hold(0.1); } };
  const homeRun = async (pts) => {
    await page.evaluate(endTool);
    await R.keyAs('P', 'p');
    await page.waitForFunction(() => window.state.tool === window.App.TOOL.POLYLINE && !!window.state.drawingPolyline, { timeout: 3000 });
    for (const [i, p] of pts.entries()) { await R.moveToPt(p, i ? 0.32 : 0.3); await R.click(); }
    await R.key('Enter');
    await page.waitForFunction(() => !window.state.drawingPolyline, { timeout: 3000 });
    await page.evaluate(endTool);
    // flag it: right-click the run, Line Properties, Homerun
    await R.moveToPt({ x: (pts[0].x + pts[1].x) / 2, y: pts[0].y }, 0.3);
    await R.rightClick();
    await page.waitForSelector('#contextMenu.visible', { timeout: 5000 });
    await R.moveToEl('#ctxLineProperties', 0.28); await R.click();
    await page.waitForSelector('#linePropertiesModal.visible', { timeout: 5000 });
    const held = R.cap; R.cap = null;   // the strip would sit on the dialog's Done button
    await R.moveToEl('#linePropertiesHomerunBtn', 0.35); await R.click();
    await R.hold(0.3);
    await R.moveToEl('#linePropertiesClose', 0.28); await R.click();
    await page.waitForFunction(() => !document.querySelector('#linePropertiesModal.visible'), { timeout: 5000 });
    R.cap = held && { ...held, since: R.n };
    await R.hold(0.2);
  };
  const recId = await counterId('Receptacle'), swId = await counterId('Switch'), ltId = await counterId('Troffer');

  R.caption('', 'Circuit 7: the north wall, 6 A.');
  await makeCircuit('Circuit 7', '7', '6');
  R.caption('', 'Chain: each click writes its 9.5 ft drop.');
  await chainPick(recId, true);
  await chain(C7_RECEPTS, 0.45, 0.32);
  R.caption('', 'Home run, square to the panel.');
  await homeRun(HOME_7);

  R.caption('', 'Circuit 9: south and west.');
  await makeCircuit('Circuit 9', '9', '6');
  await R.keyAs('T', 't');
  await page.waitForSelector('#chainPanel', { state: 'visible', timeout: 5000 });
  await R.moveToEl('#chainCounterList .chain-row[data-id="' + recId + '"] .chain-row-name', 0.3); await R.click();
  await R.moveToEl('#chainPanelClose', 0.26); await R.click();
  await chain(C9_RECEPTS, 0.45, 0.32);
  await homeRun(HOME_9);

  R.caption('', 'Circuit 11: the lights and their switch.');
  await makeCircuit('Circuit 11', '11', '2');
  await R.keyAs('T', 't');
  await page.waitForSelector('#chainPanel', { state: 'visible', timeout: 5000 });
  await R.moveToEl('#chainCounterList .chain-row[data-id="' + swId + '"] .chain-row-name', 0.3); await R.click();
  await R.moveToEl('#chainPanelClose', 0.26); await R.click();
  await chain([SWITCH_SPOT_E], 0.4, 0.3);
  await chainPick(ltId, false);   // the same run, the next device: the chain keeps its anchor
  await chain(LIGHT_SPOTS_E, 0.4, 0.3);
  await homeRun(HOME_11);

  // The film only says "computed" if it is: every auto row of the app's own Bid Check must pass
  // or be neutral. A layout that trips one (a run too long for #12, a device off its run) fails
  // the render here instead of shipping a warning on camera.
  const verdicts = await page.evaluate(() => window.App.getBidCheck().auto.map((r) => ({ id: r.id, verdict: r.verdict, detail: r.detail })));
  const bad = verdicts.filter((r) => r.verdict === 'warn');
  if (bad.length) throw new Error('electrical film: Bid Check warns on camera: ' + JSON.stringify(bad));
  console.log('\n  bid check: ' + verdicts.map((r) => r.id + '=' + r.verdict).join(', '));

  // 9 · What the drawing knows: the derived wire and the two checks nobody typed.
  R.caption('', 'The wire, derived. The checks, computed.');
  await page.evaluate(() => { const s = window.state; s.bidCheckCollapsed = false; window.App.renderBidCheck && window.App.renderBidCheck(); });
  try { await R.moveToEl('.summary-derived-item', 0.6); await R.hold(0.8); } catch (_) { /* summary collapsed */ }
  await R.moveToEl('#bidCheckList .bid-check-row[data-row-id="voltage-drop"]', 0.6); await R.hold(1.2);
  await R.moveToEl('#bidCheckList .bid-check-row[data-row-id="conduit-fill"]', 0.35); await R.hold(0.8);
  await R.moveToEl('#bidCheckList .bid-check-row[data-row-id="devices-on-circuits"]', 0.35); await R.hold(0.9);   // all thirteen devices on a circuit and reached by a run

  // 10 · Nothing missed: the whole sheet, marks off, marks on.
  R.caption('', 'Nothing missed.');
  await R.camera(CAM_A_PULL, 0.9);
  await page.waitForTimeout(400);
  await R.hold(0.5);
  await page.evaluate(setHideMarks, true); await R.hold(0.4);
  await page.evaluate(setHideMarks, false); await R.hold(0.55);

  // 11 · Done: Open in TakeoffTooling. Its toast is let back in, alone, and held.
  await page.evaluate(() => {
    const st = document.createElement('style');
    const cw = document.querySelector('.canvas-wrapper').getBoundingClientRect();
    st.textContent = '#toastRegion { display: flex !important; top: auto !important; right: auto !important; left: ' + Math.round(cw.left + 28) + 'px !important; bottom: ' + Math.round(window.innerHeight - cw.bottom + 28) + 'px !important; align-items: flex-start !important; }'
      + ' #airboardToastModal.visible { display: block !important; } #toastRegion .toast-card:not(#airboardToastModal) { display: none !important; }';
    document.head.appendChild(st);
    // showToast shows AND hides through app.js's own showModal / hideModal (not the App.*
    // copies), so no wrapper reaches it; the park is an observer that, once the card has been
    // seen visible, puts .visible back the moment the 2 s wall-clock timer takes it away.
    const m = document.getElementById('airboardToastModal');
    let seen = false;
    new MutationObserver(() => { const v = m.classList.contains('visible'); if (v) seen = true; else if (seen) m.classList.add('visible'); }).observe(m, { attributes: true, attributeFilter: ['class'] });
  });
  await R.moveToEl('#forTakeoffTooling', 0.6); await R.click();
  await page.waitForTimeout(200);
  const menuOpen = await page.evaluate(() => !!document.querySelector('#forTakeoffToolingMenu.visible'));
  if (menuOpen) { await R.moveToEl('#forTakeoffToolingMenu .takeoff-tooling-option[data-mode="all"]', 0.3); await R.click(); }
  await page.waitForTimeout(400);
  console.log('\n  hand-off toast: ' + JSON.stringify(await page.evaluate(() => ({ text: document.getElementById('airboardToastText').textContent, visible: document.getElementById('airboardToastModal').classList.contains('visible'), modals: [...document.querySelectorAll('.modal-overlay.visible')].map((x) => x.id) }))));
  await R.moveToPt(B(560, 250), 0.35);
  await R.hold(1.3);
  R.caption('', 'Done.');
  await R.hold(1.0);
  console.log('\n  ' + R.n + ' frames');
  return R.n;
}

// Page-side seed for the HVAC film: the scale preset, the trade and the Groups gate. Rooms,
// the diffuser, the system, the main and its sizes are all made on camera; the deck height
// is typed into the first Room Size dialog.
const seedOfficeHvac = () => {
  const s = window.state, App = window.App;
  s.pages[0].scale = { pixelsPerUnit: 9, unit: 'ft', label: '1/8" = 1\'' };
  App.setProjectTrade && App.setProjectTrade('hvac', { remember: false, route: 'tour' });
  s.groupsEnabled = true;
  App.updateUI(); App.renderAnnotations();
};

async function recordHvac(page, dir, setPdf) {
  const clip = await page.locator('.app').boundingBox();
  const R = new Recorder(page, clip, dir);
  await page.evaluate(OVERLAY_SRC);
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = '#headerBidChip, #headerBidChipDivider { display: none !important; } .sidebar { width: 300px !important; }';
    document.head.appendChild(st);
  });
  await page.evaluate(bigMarks);
  await R.jump(clip.x + clip.width * 0.55, clip.y + clip.height * 0.5);

  // 1 · The set lands. Prepare PDF: thirty sheets, keep three.
  await page.locator('#pdfInput').setInputFiles(setPdf);
  await page.waitForSelector('#preparePdfModal.visible', { timeout: 20000 });
  await page.waitForSelector('#preparePdfGrid .prepare-pdf-tile', { timeout: 20000 });
  await page.waitForTimeout(900);
  R.caption('', '30 sheets.');
  await R.hold(0.25);
  await R.moveToEl('#preparePdfName', 0.35); await R.click();
  await page.keyboard.press('Meta+A'); await page.keyboard.type('Suite 200 Office TI', { delay: 14 }); await R.hold(0.1);
  await R.moveToEl('#preparePdfKeepNone', 0.35); await R.click();
  R.caption('', '30 sheets. Keep 3.');
  await R.hold(0.2);
  for (const idx of SET_KEEP_H) { await R.moveToEl('#preparePdfGrid .prepare-pdf-tile[data-orig-idx="' + idx + '"]', 0.25); await R.click(); }
  await R.hold(0.1);
  await R.moveToEl('#preparePdfDone', 0.3); await R.click();
  await page.waitForFunction(() => !document.querySelector('#preparePdfModal.visible') && window.state.pages.length === 3, { timeout: 30000 });
  await page.waitForFunction(() => { const c = document.getElementById('pdfCanvas'); return c && c.width > 0; }, { timeout: 15000 });
  await page.evaluate(() => { window.App.pageTextItems && window.App.pageTextItems(0); });
  await page.waitForFunction(() => (window.App.peekPageTextItems(0) || []).length > 0, { timeout: 15000 });   // the room names come off the plan's text
  await page.evaluate(seedOfficeHvac);
  await page.evaluate(bigMarks);

  // 2 · A-101 opens. Push in from the sheet to the plan.
  R.caption('', 'Suite 200, A-101');
  await R.setCamera(CAM_SHEET);
  await page.waitForTimeout(500);
  await R.hold(0.25);
  await R.camera(CAM_A_PLAN, 0.75);
  await page.waitForTimeout(300);
  await R.hold(0.2);

  // 3 · Prove the scale on the 24'-0" bay.
  R.caption('', 'Prove the scale.');
  await page.evaluate(armScaleCheck);
  await R.moveToPt(DIM_24[0], 0.45); await R.click();
  await R.moveToPt(DIM_24[1], 0.5); await R.click();
  await page.waitForSelector('#scaleModal.visible', { timeout: 5000 });
  await R.hold(0.2);
  await R.moveToEl('#scaleCheckValue', 0.3); await R.click();
  await page.keyboard.type('24', { delay: 40 }); await R.hold(0.15);
  await R.moveToEl('#scaleCheckBtn', 0.3); await R.click();
  await R.hold(0.6);
  await R.moveToEl('#scaleCheckCancel', 0.25); await R.click();
  await page.waitForFunction(() => !document.querySelector('#scaleModal.visible'), { timeout: 5000 });
  await R.hold(0.15);

  // 4 · Rooms. V arms the Room Sizer; a drag over each room opens Room Size with the name
  //     already read off the plan; ceiling 9, the deck 12 (once), the type, Apply. Each
  //     room answers with ft², ft³ and the air it needs.
  const boxRoom = async (r, type, deck) => {
    await R.moveToPt({ x: r.x1, y: r.y1 }, 0.5);
    await page.mouse.down(); R.clicks.push({ n: R.n, x: R.cur.x, y: R.cur.y }); await R.frame();
    await R.moveToPt({ x: r.x2, y: r.y2 }, 0.7);
    await page.mouse.up();
    await page.waitForSelector('#roomBoxModal.visible', { timeout: 5000 });
    await R.hold(0.35);
    const h = await page.evaluate(() => document.getElementById('roomBoxHeight').value);
    if (!h) { await R.moveToEl('#roomBoxHeight', 0.3); await R.click(); await R.type('9', 12); }
    if (deck) { await R.moveToEl('#roomBoxDeck', 0.3); await R.click(); await R.type(String(deck), 12); }
    const typeShown = await page.evaluate(() => document.getElementById('roomBoxTypeGroup').style.display !== 'none');
    if (typeShown) { await R.moveToEl('#roomBoxType', 0.3); await R.click(); await page.selectOption('#roomBoxType', type); await R.hold(0.2); }
    await R.moveToEl('#roomBoxApply', 0.35); await R.click();
    await page.waitForFunction(() => !document.querySelector('#roomBoxModal.visible'), { timeout: 5000 });
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await R.hold(0.45);
  };
  R.caption('', 'Box the rooms; the plan names them.');
  await R.keyAs('V', 'v');
  await boxRoom(ROOM_OPEN_OFFICE, 'office', 12);
  await boxRoom(ROOM_CONFERENCE, 'conference', 0);
  await boxRoom(ROOM_OFFICE_101, 'office', 0);
  await page.evaluate(endTool);
  await R.hold(0.3);

  // 5 · The system first, then its unit. A group with an equipment tag and a capacity; made
  //     first so everything after it (the unit, the diffusers, the duct) lands in it. The unit
  //     is a counter with no CFM placed in that group, which is how the system knows where its
  //     equipment is, and what arms the riser when a run starts on it.
  R.caption('', 'RTU-1, 2,000 CFM.');
  if (await page.evaluate(() => document.getElementById('groupsSection').classList.contains('collapsed'))) { await R.moveToEl('#groupsSectionTitle', 0.45); await R.click(); await R.hold(0.15); }
  await R.moveToEl('#addGroup', 0.3); await R.click();
  await page.waitForSelector('#groupModal.visible', { timeout: 5000 });
  await R.moveToEl('#groupModalName', 0.3); await R.click();
  await R.type('RTU-1', 12);
  await R.moveToEl('#groupModalEquipTag', 0.3); await R.click();
  await R.type('RTU-1', 12);
  await R.moveToEl('#groupModalCapacityCfm', 0.3); await R.click();
  await R.type('2000', 12);
  await R.hold(0.15);
  await R.moveToEl('#groupModalDone', 0.35); await R.click();
  await page.waitForFunction(() => !document.querySelector('#groupModal.visible'), { timeout: 5000 });
  await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  await R.hold(0.2);
  const quickAddH = async (size, type, cfm, pickTrade) => {
    await R.moveToEl('#addCounter', 0.4); await R.click();
    await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
    await R.moveToEl('#counterModal .counter-tab[data-tab="quickcount"]', 0.28); await R.click();
    await R.hold(0.12);
    if (pickTrade) { await R.moveToEl('#counterQuickCountTradeSegment [data-trade="hvac"]', 0.32); await R.click(); await R.hold(0.15); }
    if (size) { await R.moveToEl('#counterQuickCountSize', 0.28); await R.click(); await page.selectOption('#counterQuickCountSize', size); await R.hold(0.15); }
    await R.moveToEl('#counterQuickCountType', 0.28); await R.click();
    await page.selectOption('#counterQuickCountType', type); await R.hold(0.2);
    if (cfm) { await R.moveToEl('#counterQuickCountCfm', 0.28); await R.click(); await R.type(cfm, 10); await R.hold(0.15); }
    await R.moveToEl('#counterQuickCountAdd', 0.32); await R.click();
    await page.waitForFunction(() => !document.querySelector('#counterModal.visible'), { timeout: 5000 });
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await R.hold(0.15);
  };
  // The unit is made on the Create tab, named for its tag (the Quick tab would prefix a size).
  await R.moveToEl('#addCounter', 0.4); await R.click();
  await page.waitForSelector('#counterModal.visible', { timeout: 5000 });
  await R.moveToEl('#counterModal .counter-tab[data-tab="create"]', 0.28); await R.click();
  await R.hold(0.12);
  await R.moveToEl('#counterName', 0.3); await R.click();
  await page.keyboard.press('Meta+A');   // the field can arrive carrying the last name typed
  await R.type('RTU-1', 12);
  await R.hold(0.15);
  await R.moveToEl('#counterCreate', 0.35); await R.click();
  await page.waitForFunction(() => !document.querySelector('#counterModal.visible'), { timeout: 5000 });
  await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  await page.evaluate(() => { const k = window.state.counters.find((x) => x.name === 'RTU-1'); if (k) { k.color = '#e8c547'; window.App.renderAnnotations(); window.App.updateUI(); } });
  R.caption('', 'The unit, on the roof over the corridor.');
  await R.camera(CAM_H_ROOMS, 0.6);
  await page.waitForTimeout(300);
  await R.moveToPt(RTU_SPOT, 0.4); await R.click();
  await page.evaluate(endTool);
  await R.hold(0.3);

  // 6 · The diffuser, made on the Quick tab with its 150 CFM. Four in the open office: three
  //     leave the room's tag short, the fourth turns it green. Then the other two rooms.
  R.caption('', 'A diffuser, 150 CFM.');
  await quickAddH('12x12', 'Supply Diffuser', '150', true);
  R.caption('', 'Three leave the room short.');
  for (const [i, p] of DIFF_OPEN_H.slice(0, 3).entries()) { await R.moveToPt(p, i ? 0.3 : 0.45); await R.click(); await R.hold(0.12); }
  await R.hold(0.4);
  R.caption('', 'The fourth turns it green.');
  await R.moveToPt(DIFF_OPEN_H[3], 0.35); await R.click();
  await R.hold(0.5);
  R.caption('', 'Conference takes three, the office two.');
  for (const [i, p] of DIFF_CONF_H.entries()) { await R.moveToPt(p, i ? 0.26 : 0.55); await R.click(); await R.hold(0.1); }
  for (const [i, p] of DIFF_101_H.entries()) { await R.moveToPt(p, i ? 0.26 : 0.5); await R.click(); await R.hold(0.1); }
  await page.evaluate(endTool);
  await R.hold(0.5);

  // 7 · The duct. U opens New Duct Run, Start Tracing. The trunk starts ON the unit, so the
  //     deck height writes its riser; S right there takes the ductulator's size for the whole
  //     system's air, and S again steps it down where each branch leaves. Then the two
  //     branches, each started on the trunk (the tap counts itself) and sized by S from the air
  //     its own room still needs. Enter commits; elbows, taps and transitions count themselves.
  const typeInto = async (sel, text) => { await R.moveToEl(sel, 0.28); await R.click(); await page.keyboard.press('Meta+A'); await R.type(text, 10); };
  const startRun = async (w, h) => {
    await R.keyAs('U', 'u');
    await page.waitForSelector('#ductCreateModal.visible', { timeout: 5000 });
    await R.hold(0.3);
    if (w) { await typeInto('#ductCreateW', String(w)); await typeInto('#ductCreateH', String(h)); await R.hold(0.15); }
    await R.moveToEl('#ductCreateStart', 0.35); await R.click();
    await page.waitForFunction(() => !!window.state.drawingDuct, { timeout: 5000 });
  };
  // S opens the popover. `suggest` taps the ductulator's rectangular chip; otherwise the first
  // common step-down from the current size.
  const stepAtS = async (suggest) => {
    await R.keyAs('S', 's');
    await page.waitForSelector('#ductSizePopover', { state: 'visible', timeout: 5000 });
    await R.hold(0.4);
    const info = await page.evaluate(() => ({ suggest: [...document.querySelectorAll('#ductSizePopover .duct-suggest-chip')].map((c) => c.textContent.trim()), steps: [...document.querySelectorAll('#ductSizePopover .duct-step-chip')].map((c) => c.textContent.trim()) }));
    console.log('\n  S: suggests [' + info.suggest.join(' | ') + '] steps [' + info.steps.join(' | ') + ']');
    const si = info.suggest.findIndex((t) => /×/.test(t));
    const sel = suggest && info.suggest.length ? '#ductSizePopover .duct-suggest-chip:nth-of-type(' + ((si >= 0 ? si : 0) + 1) + ')' : '#ductSizePopover .duct-step-chip';
    await R.moveToEl(sel, 0.38); await R.click();
    await R.hold(0.2);
  };
  // S, then the Custom row: the size a master would give the air that is left past this takeoff.
  const stepTo = async (w, h) => {
    await R.keyAs('S', 's');
    await page.waitForSelector('#ductSizePopover', { state: 'visible', timeout: 5000 });
    await R.hold(0.3);
    const row = '#ductSizePopover .duct-size-inputs:has(input[aria-label="Width (inches)"])';
    await typeInto(row + ' input[aria-label="Width (inches)"]', String(w));
    await typeInto(row + ' input[aria-label="Depth (inches)"]', String(h));
    await R.moveToEl(row + ' .duct-custom-apply', 0.3); await R.click();
    await R.hold(0.2);
  };
  const finishRun = async () => {
    await R.key('Enter');
    await page.waitForFunction(() => !window.state.drawingDuct, { timeout: 5000 });
    await R.hold(0.3);
  };
  R.caption('', 'Trace the main from the unit.', 'top');   // the duct hint card holds the bottom
  await startRun();
  await R.moveToPt(TRUNK_H[0], 0.45); await R.click();
  await R.hold(0.2);
  await stepAtS(true);
  await R.moveToPt(TRUNK_H[1], 0.45); await R.click();
  R.caption('', 'S: the trunk steps down where a branch leaves.', 'top');
  await stepTo(14, 12);   // 900 CFM left past the conference takeoff
  await R.moveToPt(TRUNK_H[2], 0.8); await R.click();
  await stepTo(12, 8);    // 300 CFM left past the open office takeoff
  await R.moveToPt(TRUNK_H[3], 0.35); await R.click();
  await R.moveToPt(TRUNK_H[4], 0.6); await R.click();
  await finishRun();
  R.caption('', 'A branch to each room; the tap counts itself.', 'top');
  await startRun(16, 8);   // 450 CFM: the dialog takes the branch's size (the ductulator says 12"Ø or 16×8)
  await R.moveToPt(BRANCH_CONF_H[0], 0.5); await R.click();
  await R.moveToPt(BRANCH_CONF_H[1], 0.6); await R.click();
  await finishRun();
  await startRun();        // 600 CFM, the last air unserved, so S reads exactly this room's
  await R.moveToPt(BRANCH_OPEN_H[0], 0.5); await R.click();
  await stepAtS(true);
  await R.moveToPt(BRANCH_OPEN_H[1], 0.45); await R.click();
  await R.moveToPt(BRANCH_OPEN_H[2], 0.7); await R.click();
  await finishRun();
  await page.evaluate(endTool);
  await R.hold(0.5);

  // The film only says the rooms are served if they are: no auto row of the app's own Bid
  // Check may warn, every diffuser must hang off a run, and the system must carry its air.
  const audit = await page.evaluate(() => {
    const App = window.App, s = window.state;
    const rows = App.getBidCheck().auto.map((r) => ({ id: r.id, verdict: r.verdict, detail: r.detail }));
    const ann = App.getActiveAnnotations(s.pages[0]);
    return { rows, runs: (ann.ductRuns || []).length, fittings: (ann.ductFittings || []).length, counters: s.counters.map((c) => c.name + ' x' + ((ann.counterMarkers[c.id] || []).length)), groups: s.groups.map((g) => g.name) };
  });
  console.log('\n  hvac audit: ' + JSON.stringify(audit));
  const badH = audit.rows.filter((r) => r.verdict === 'warn');
  if (badH.length) throw new Error('hvac film: Bid Check warns on camera: ' + JSON.stringify(badH));

  // 8 · Pounds, not feet: the Duct Schedule, gauge and bid weight; sign off in Bid Check.
  R.caption('', 'Pounds, not feet.');
  await R.moveToEl('#ductScheduleBtn', 0.5); await R.click();
  await page.waitForSelector('#ductScheduleModal.visible', { timeout: 5000 });
  await R.hold(0.4);
  await R.moveToEl('#ductScheduleModal .duct-schedule-bid-row', 0.5);
  await R.hold(1.0);
  await R.moveToEl('#ductScheduleClose', 0.35); await R.click();
  await page.waitForFunction(() => !document.querySelector('#ductScheduleModal.visible'), { timeout: 5000 });
  // Bid Check: three rooms boxed, three served, the system inside its capacity. "Fits the
  // roof" computes itself once the deck height is known (12 ft), so it is green without a tick.
  R.caption('', 'Bid Check: every room served.');
  await page.evaluate(() => { const s = window.state; s.bidCheckCollapsed = false; window.App.renderBidCheck && window.App.renderBidCheck(); });
  await R.moveToEl('#bidCheckList .bid-check-row[data-row-id="duct-rooms-served"]', 0.6); await R.hold(1.0);
  R.caption('', 'Fits the roof: computed, green.');
  await R.moveToEl('#bidCheckList .bid-check-row[data-row-id="duct-fits-roof"]', 0.45); await R.hold(0.9);

  // 9 · Nothing missed: the plan, marks off, marks on.
  R.caption('', 'Nothing missed.');
  await R.camera(CAM_A_PULL, 0.9);
  await page.waitForTimeout(400);
  await R.hold(0.5);
  await page.evaluate(setHideMarks, true); await R.hold(0.4);
  await page.evaluate(setHideMarks, false); await R.hold(0.55);

  // 10 · Done: Copy Schedule, its toast let back in and pinned.
  await page.evaluate(() => {
    const st = document.createElement('style');
    const cw = document.querySelector('.canvas-wrapper').getBoundingClientRect();
    st.textContent = '#toastRegion { display: flex !important; top: auto !important; right: auto !important; left: ' + Math.round(cw.left + 28) + 'px !important; bottom: ' + Math.round(window.innerHeight - cw.bottom + 28) + 'px !important; align-items: flex-start !important; }'
      + ' #toastRegion .toast-card.visible { display: block !important; } #bidCheckAdvisoryModal { display: none !important; }';
    document.head.appendChild(st);
    const m = document.getElementById('airboardToastModal');
    let seen = false;
    new MutationObserver(() => { const v = m.classList.contains('visible'); if (v) seen = true; else if (seen) m.classList.add('visible'); }).observe(m, { attributes: true, attributeFilter: ['class'] });
  });
  await R.moveToEl('#ductScheduleBtn', 0.5); await R.click();
  await page.waitForSelector('#ductScheduleModal.visible', { timeout: 5000 });
  await R.moveToEl('#ductScheduleCopy', 0.45); await R.click();
  await page.waitForTimeout(400);
  console.log('\n  copy toast: ' + JSON.stringify(await page.evaluate(() => ({ text: document.getElementById('airboardToastText').textContent, visible: document.getElementById('airboardToastModal').classList.contains('visible'), cards: [...document.querySelectorAll('#toastRegion .toast-card.visible')].map((x) => x.id) }))));
  await R.moveToEl('#ductScheduleClose', 0.3); await R.click();
  await page.waitForFunction(() => !document.querySelector('#ductScheduleModal.visible'), { timeout: 5000 });
  await R.moveToPt(B(560, 250), 0.35);
  await R.hold(1.2);
  R.caption('', 'Done.');
  await R.hold(1.0);
  console.log('\n  ' + R.n + ' frames');
  return R.n;
}

function ffmpeg(args) {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error('ffmpeg failed: ' + (res.stderr || res.stdout));
}

(async () => {
  if (!fs.existsSync(PLAN)) { console.error('Missing samples/sample-plan.pdf: run `npm run build:sample-plan` first.'); process.exit(1); }
  if (!FRAMES_ONLY && !CHAPTERS_ONLY && spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('ffmpeg is needed to encode (brew install ffmpeg), or pass --frames-only.'); process.exit(1); }
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
      // Drop sizes on (the "3 ft" beside the riser); the scale reference line off (a device
      // preference that draws a dashed ruler at the sheet's bottom left whenever a preset scale
      // has no measured line; on the film it read as a stray mark).
      await page.addInitScript(() => { try { localStorage.setItem('clickcount-show-drop-sizes', '1'); localStorage.setItem('showScaleRefLine', 'false'); } catch (_) { /* private mode */ } });
      await page.goto(`http://127.0.0.1:${port}/app/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => m.classList.remove('visible')));
      frames = await recordPlumbing(page, dir, setPdf);
    } else if (FILM === 'electrical') {
      const setPdf = path.join(dir, 'sample-set.pdf');
      await buildSampleSet(setPdf, PLAN, 'A-101', SET_KEEP_E);
      await page.addInitScript(() => { try { localStorage.setItem('clickcount-show-drop-sizes', '1'); localStorage.setItem('showScaleRefLine', 'false'); } catch (_) { /* private mode */ } });
      await page.goto(`http://127.0.0.1:${port}/app/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => m.classList.remove('visible')));
      frames = await recordElectrical(page, dir, setPdf);
    } else if (FILM === 'hvac') {
      const setPdf = path.join(dir, 'sample-set.pdf');
      await buildSampleSet(setPdf, PLAN, 'A-101', SET_KEEP_H);
      await page.addInitScript(() => { try { localStorage.setItem('clickcount-show-drop-sizes', '1'); localStorage.setItem('showScaleRefLine', 'false'); } catch (_) { /* private mode */ } });
      await page.goto(`http://127.0.0.1:${port}/app/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelectorAll('.modal-overlay.visible').forEach((m) => m.classList.remove('visible')));
      frames = await recordHvac(page, dir, setPdf);
    } else {
      console.error('Unknown film "' + FILM + '": plumbing, electrical or hvac.');
      process.exit(1);
    }
    console.log('\n  ' + frames + ' frames (' + (frames / FPS).toFixed(1) + ' s) in ' + dir);
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  writeChapters(frames);
  if (CHAPTERS_ONLY) { fs.rmSync(dir, { recursive: true, force: true }); return; }
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
