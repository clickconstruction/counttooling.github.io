#!/usr/bin/env node
/**
 * Generates the PWA / home-screen icons AND the tab favicon from the single
 * vector mark in scripts/lib/brand-mark.js, using the Chromium that ships with
 * the existing @playwright/test devDependency (no new deps).
 * Run with: npm run build:pwa-icons
 *
 * Outputs:
 *   icons/icon.svg            canonical source (rounded, transparent corners)
 *   icons/favicon.svg         same mark, served as the SVG tab icon
 *   favicon.ico               16/32/48 PNG-in-ICO at the site root (Safari +
 *                             anything that ignores SVG icons; browsers also
 *                             request /favicon.ico on their own)
 *   icons/icon-192.png        192, rounded, transparent corners   (manifest "any")
 *   icons/icon-512.png        512, rounded, transparent corners   (manifest "any")
 *   icons/maskable-512.png    512, FULL-BLEED yellow to all edges  (manifest "maskable")
 *   icons/apple-touch-180.png 180, FULL-BLEED yellow, opaque       (iOS apple-touch-icon)
 *
 * Brand: CountTooling yellow #e8c547 tile + the dark "C-reticle" (an open ring
 * that reads as a C, three ticks, a center dot — the marker-placement motif).
 * The glyph stays within the central ~80% "safe zone" so platform maskable
 * shapes never clip it. Every page head links the favicon via
 * FAVICON_LINKS from brand-mark.js; sw.js precaches both favicon files.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { mark } = require('./lib/brand-mark');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'icons');

async function renderPng(page, variant, size, opaque) {
  const markup = `<!doctype html><html><head><meta charset="utf-8">
    <style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style></head>
    <body>${mark(variant, `width="${size}" height="${size}"`)}</body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(markup, { waitUntil: 'networkidle' });
  return page.screenshot({ omitBackground: !opaque, clip: { x: 0, y: 0, width: size, height: size } });
}

async function render(page, variant, size, file, opaque) {
  fs.writeFileSync(path.join(OUT_DIR, file), await renderPng(page, variant, size, opaque));
  console.log('  wrote icons/' + file);
}

// ICO container holding PNG-encoded images (supported everywhere since Vista /
// all current browsers). 6-byte header, one 16-byte directory entry per image,
// then the PNG payloads back to back.
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = header.length + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);     // width (0 means 256)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1); // height
    dir.writeUInt8(0, o + 2);                      // palette colors
    dir.writeUInt8(0, o + 3);                      // reserved
    dir.writeUInt16LE(1, o + 4);                   // color planes
    dir.writeUInt16LE(32, o + 6);                  // bits per pixel
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'icon.svg'), mark('rounded') + '\n');
  console.log('  wrote icons/icon.svg');
  fs.writeFileSync(path.join(OUT_DIR, 'favicon.svg'), mark('rounded') + '\n');
  console.log('  wrote icons/favicon.svg');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await render(page, 'rounded', 192, 'icon-192.png', false);
  await render(page, 'rounded', 512, 'icon-512.png', false);
  await render(page, 'bleed', 512, 'maskable-512.png', true);
  await render(page, 'bleed', 180, 'apple-touch-180.png', true);
  const pngs = [];
  for (const size of [16, 32, 48]) pngs.push({ size, data: await renderPng(page, 'rounded', size, false) });
  fs.writeFileSync(path.join(ROOT, 'favicon.ico'), ico(pngs));
  console.log('  wrote favicon.ico (16/32/48)');
  await browser.close();
  console.log('PWA icons + favicon generated.');
})().catch((e) => { console.error(e); process.exit(1); });
