#!/usr/bin/env node
/**
 * Generates samples/sample-hvac.pdf, the HVAC SET the HVAC course runs on
 * (features/course-hvac.js; journeys/plans/HVAC-COURSE.md): three sheets of the
 * same Main St Restaurant as P-101, on the same shell, so a device on M-101 sits at a
 * P-101 coordinate.
 *   1. M-101 Mechanical Plan   2. M-501 Schedules
 *   3. M-601 Section (1/2" = 1'-0")
 * True ANSI B pages (1224 × 792 pt), 1/8" = 1'-0" for the plan.
 *
 *   npm run build:sample-hvac
 */
const path = require('path');
const { chromium } = require('@playwright/test');
const { W, H } = require('./sample-plan-candidates');
const M = require('./sample-hvac');

const OUT = path.join(__dirname, '..', 'samples', 'sample-hvac.pdf');
const land = (body, last) => `<div class="${last ? 'last' : 'land'}"><svg xmlns="http://www.w3.org/2000/svg" width="17in" height="11in" viewBox="0 0 ${W} ${H}">${body}</svg></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page land { size: 17in 11in; margin: 0; }
  html,body { margin:0; padding:0; } svg { display:block; }
  .land { page: land; break-after: page; } .last { page: land; }
</style></head><body>${land(M.sheetM101())}${land(M.sheetM501())}${land(M.sheetM601(), true)}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log('Wrote samples/sample-hvac.pdf (M-101, M-501, M-601).');
})().catch((e) => { console.error(e); process.exit(1); });
