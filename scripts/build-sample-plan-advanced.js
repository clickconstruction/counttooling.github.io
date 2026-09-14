#!/usr/bin/env node
/**
 * Generates samples/sample-plan-advanced.pdf — the ADVANCED sample plan: a
 * restaurant plumbing sheet (Main St Restaurant, P-101, 1/8" = 1'-0": 12 px/ft on a
 * 918 pt sheet, the same scale as the simple plan) with a
 * dining room, bar, kitchen, dish, restrooms, a grease interceptor and keynotes.
 * Candidate B from scripts/sample-plan-candidates.js (Will, 2026-09-14: "use both,
 * A as the simple plan, B as the advanced plan"); today's samples/sample-plan.pdf
 * stays the simple plan the three tours walk. Same pipeline as build-sample-plan.js
 * (inline SVG -> Playwright PDF).
 *
 *   npm run build:sample-plan-advanced
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { W, H, candidateB, pageHtml } = require('./sample-plan-candidates');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'samples', 'sample-plan-advanced.pdf');

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(pageHtml(candidateB()), { waitUntil: 'networkidle' });
  await page.pdf({ path: OUT, width: `${W}px`, height: `${H}px`, printBackground: true, pageRanges: '1' });
  await browser.close();
  console.log('Wrote samples/sample-plan-advanced.pdf (' + W + 'x' + H + ' pt).');
})().catch((e) => { console.error(e); process.exit(1); });
