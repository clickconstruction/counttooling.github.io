#!/usr/bin/env node
/**
 * Generates the PWA / home-screen icons from a single vector definition, using
 * the Chromium that ships with the existing @playwright/test devDependency (no
 * new deps). Run with: npm run build:pwa-icons
 *
 * Outputs into icons/:
 *   - icon.svg            canonical source (rounded, transparent corners)
 *   - icon-192.png        192, rounded, transparent corners   (manifest "any")
 *   - icon-512.png        512, rounded, transparent corners   (manifest "any")
 *   - maskable-512.png    512, FULL-BLEED yellow to all edges  (manifest "maskable")
 *   - apple-touch-180.png 180, FULL-BLEED yellow, opaque       (iOS apple-touch-icon)
 *
 * Brand: CountTooling yellow #e8c547 square + a dark takeoff reticle (crosshair +
 * ring + center dot — the marker-placement motif). The glyph stays within the
 * central 80% "safe zone" so platform maskable shapes never clip it.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const YELLOW = '#e8c547';
const DARK = '#161617';
const OUT_DIR = path.join(__dirname, '..', 'icons');

// The takeoff reticle, drawn on a 512x512 viewBox, centered, inside the safe zone.
function glyph() {
  return `
    <g fill="none" stroke="${DARK}" stroke-width="30" stroke-linecap="round">
      <circle cx="256" cy="256" r="118"/>
      <line x1="256" y1="78"  x2="256" y2="170"/>
      <line x1="256" y1="342" x2="256" y2="434"/>
      <line x1="78"  y1="256" x2="170" y2="256"/>
      <line x1="342" y1="256" x2="434" y2="256"/>
    </g>
    <circle cx="256" cy="256" r="34" fill="${DARK}"/>`;
}

// variant: 'rounded' (rounded square, transparent corners) or 'bleed' (full square to edges)
function svg(variant) {
  const bg = variant === 'bleed'
    ? `<rect width="512" height="512" fill="${YELLOW}"/>`
    : `<rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill="${YELLOW}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${bg}${glyph()}</svg>`;
}

async function render(page, variant, size, file, opaque) {
  const markup = `<!doctype html><html><head><meta charset="utf-8">
    <style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style></head>
    <body>${svg(variant).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(markup, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT_DIR, file), omitBackground: !opaque, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('  wrote icons/' + file);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'icon.svg'), svg('rounded') + '\n');
  console.log('  wrote icons/icon.svg');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await render(page, 'rounded', 192, 'icon-192.png', false);
  await render(page, 'rounded', 512, 'icon-512.png', false);
  await render(page, 'bleed', 512, 'maskable-512.png', true);
  await render(page, 'bleed', 180, 'apple-touch-180.png', true);
  await browser.close();
  console.log('PWA icons generated.');
})().catch((e) => { console.error(e); process.exit(1); });
