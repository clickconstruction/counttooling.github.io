#!/usr/bin/env node
/**
 * Generates samples/sample-electrical.pdf, the ELECTRICAL SET the electrical course runs on
 * (features/course-electrical.js; journeys/plans/ELECTRICAL-COURSE.md): four sheets of the
 * same Main St Restaurant as P-101, on the same shell, so a device on E-101 sits at a
 * P-101 coordinate.
 *   1. E-101 Power Plan       2. E-201 Lighting Plan
 *   3. E-501 Schedules        4. E-601 One-Line Diagram
 * True ANSI B pages (1224 × 792 pt), 1/8" = 1'-0" for the two plans.
 *
 *   npm run build:sample-electrical
 */
const path = require('path');
const { chromium } = require('@playwright/test');
const { W, H } = require('./sample-plan-candidates');
const E = require('./sample-electrical');

const OUT = path.join(__dirname, '..', 'samples', 'sample-electrical.pdf');
const land = (body, last) => `<div class="${last ? 'last' : 'land'}"><svg xmlns="http://www.w3.org/2000/svg" width="17in" height="11in" viewBox="0 0 ${W} ${H}">${body}</svg></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page land { size: 17in 11in; margin: 0; }
  html,body { margin:0; padding:0; } svg { display:block; }
  .land { page: land; break-after: page; } .last { page: land; }
</style></head><body>${land(E.sheetE101())}${land(E.sheetE201())}${land(E.sheetE501())}${land(E.sheetE601(), true)}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log('Wrote samples/sample-electrical.pdf (E-101, E-201, E-501, E-601).');
})().catch((e) => { console.error(e); process.exit(1); });
