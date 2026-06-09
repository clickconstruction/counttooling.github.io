#!/usr/bin/env node
/**
 * Generates the Open Graph / social share card (og-image.png, 1200x630) — the rich
 * preview shown when counttooling.com or a view link is pasted into a text / Slack /
 * email / LinkedIn. Uses the Chromium that ships with @playwright/test (no new deps).
 *
 * Run with: npm run build:og-image
 *
 * Design: dark brand background (#0f0f11) with a faint blueprint/takeoff motif (grid +
 * a sample line run with counter reticles), the gold reticle logo, the "CountTooling"
 * wordmark (Instrument Serif), and a benefit-forward tagline (DM Sans). Brand fonts are
 * base64-embedded from the vendored woff2 so the headless render is faithful without a
 * running server.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'vendor', 'fonts');
const OUT = path.join(ROOT, 'og-image.png');

const W = 1200;
const H = 630;
const YELLOW = '#e8c547';
const DARK = '#0f0f11';
const GLYPH_DARK = '#161617';
const TEXT2 = '#b9b6b1';

function fontFace(family, file, weight) {
  const b64 = fs.readFileSync(path.join(FONT_DIR, file)).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}

// The takeoff reticle (same motif as the app icon), on a 120x120 viewBox.
function reticle(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill="${YELLOW}"/>
    <g fill="none" stroke="${GLYPH_DARK}" stroke-width="30" stroke-linecap="round">
      <circle cx="256" cy="256" r="118"/>
      <line x1="256" y1="78" x2="256" y2="170"/><line x1="256" y1="342" x2="256" y2="434"/>
      <line x1="78" y1="256" x2="170" y2="256"/><line x1="342" y1="256" x2="434" y2="256"/>
    </g>
    <circle cx="256" cy="256" r="34" fill="${GLYPH_DARK}"/>
  </svg>`;
}

// Faint blueprint motif: a grid + a sample line run with small counter reticles.
function motif() {
  const grid = `<defs><pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="${YELLOW}" stroke-opacity="0.05" stroke-width="1"/>
    </pattern></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>`;
  const run = `<g stroke="${YELLOW}" stroke-opacity="0.14" stroke-width="3" fill="none">
      <polyline points="760,430 880,360 1010,470 1130,400"/>
    </g>
    <g fill="${YELLOW}" fill-opacity="0.14">
      <circle cx="760" cy="430" r="7"/><circle cx="880" cy="360" r="7"/>
      <circle cx="1010" cy="470" r="7"/><circle cx="1130" cy="400" r="7"/>
    </g>`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0">${grid}${run}</svg>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  ${fontFace('Instrument Serif', 'instrumentserif-400-normal-latin.woff2', 400)}
  ${fontFace('DM Sans', 'dmsans-400-normal-latin.woff2', 400)}
  ${fontFace('DM Sans', 'dmsans-600-normal-latin.woff2', 600)}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;background:${DARK};overflow:hidden}
  .card{position:relative;width:${W}px;height:${H}px;display:flex;flex-direction:column;justify-content:center;padding:0 96px}
  .row{display:flex;align-items:center;gap:36px;position:relative;z-index:1}
  .wordmark{font-family:'Instrument Serif',serif;font-size:118px;line-height:1;color:${YELLOW}}
  .tagline{position:relative;z-index:1;margin-top:40px;max-width:900px;font-family:'DM Sans',sans-serif;font-weight:400;font-size:38px;line-height:1.35;color:${TEXT2}}
  .domain{position:absolute;left:96px;bottom:54px;z-index:1;font-family:'DM Sans',sans-serif;font-weight:600;font-size:26px;letter-spacing:.02em;color:${YELLOW}}
</style></head><body>
  <div class="card">
    ${motif()}
    <div class="row">${reticle(150)}<div class="wordmark">CountTooling</div></div>
    <div class="tagline">Do construction &amp; plumbing takeoffs right in your browser &mdash; count fixtures, measure runs, and export reports from any plan PDF.</div>
    <div class="domain">counttooling.com</div>
  </div>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: W, height: H } });
  await browser.close();
  console.log('Wrote og-image.png (' + W + 'x' + H + ')');
})().catch((e) => { console.error(e); process.exit(1); });
