#!/usr/bin/env node
/**
 * Generates samples/sample-plan.pdf — the SIMPLE sample plan: candidate A from
 * scripts/sample-plan-candidates.js (Suite 200 Office TI, A-101), the DESIGN-BUILD
 * sheet the app's lessons run on (journeys/plans/SAMPLE-PLANS.md §2). Promoted
 * 2026-09-14 in place of the first synthetic office plan.
 *
 * The sheet is a TRUE ANSI B (17 × 11 in = 1224 × 792 PDF points): the SVG user unit
 * is one point, and the plan group sits on it at PLAN_AT (0.75 → 9 pt per foot =
 * 1/8" = 1'-0"), so the title block's scale is literally correct and Set Scale's
 * standard-sheet check passes (a 918 × 594 pt print of the same drawing tripped the
 * "compressed or re-boxed" warning on every tour, 2026-09-09). A drawing point lands
 * at (PLAN_AT.x + 0.75·px, PLAN_AT.y + 0.75·py) — the figure features/tutorial.js and
 * scripts/build-screenshots.js carry.
 *
 * Run with: npm run build:sample-plan
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { W, H, candidateA } = require('./sample-plan-candidates');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'samples', 'sample-plan.pdf');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="17in" height="11in" viewBox="0 0 ${W} ${H}">${candidateA()}</svg>`;
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
  console.log('Wrote samples/sample-plan.pdf (ANSI B, 1224x792 pt, plan at 9 pt/ft).');
})().catch((e) => { console.error(e); process.exit(1); });
