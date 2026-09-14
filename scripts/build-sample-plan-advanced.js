#!/usr/bin/env node
/**
 * Generates samples/sample-plan-advanced.pdf — the ENGINEERED sample plan: a
 * restaurant plumbing sheet (Main St Restaurant, P-101) with dining, bar, kitchen
 * (cook line under its hood), a dish pit with a FOH pass-thru, storage with the water
 * heater and recirc pump, restrooms, a grease interceptor, keynotes and the CW / HW /
 * gas piping. Candidate B from scripts/sample-plan-candidates.js. Rendered like the
 * design-build plan: a TRUE ANSI B sheet (17 × 11 in = 1224 × 792 pt) with the plan
 * group at PLAN_AT (0.75 → 9 pt/ft = 1/8" = 1'-0"), so Set Scale's standard-sheet check
 * passes (2026-09-14; it used to print at 918 × 594 pt).
 *
 *   npm run build:sample-plan-advanced
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { W, H, candidateB } = require('./sample-plan-candidates');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'samples', 'sample-plan-advanced.pdf');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="17in" height="11in" viewBox="0 0 ${W} ${H}">${candidateB()}</svg>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: 17in 11in; margin: 0; } html,body { margin:0; padding:0; } svg { display:block; }
</style></head><body>${svg}</body></html>`;

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({ path: OUT, width: '17in', height: '11in', printBackground: true, pageRanges: '1' });
  await browser.close();
  console.log('Wrote samples/sample-plan-advanced.pdf (ANSI B, 1224x792 pt, plan at 9 pt/ft).');
})().catch((e) => { console.error(e); process.exit(1); });
