#!/usr/bin/env node
/**
 * Generates samples/sample-lessons.pdf, the LESSON SET the Learn menu's lessons run on
 * (features/lessons.js; journeys/plans/LEARN-PLAN.md): three sheets in one PDF.
 *   1. P-101 Plumbing Plan: candidate B exactly as samples/sample-plan-advanced.pdf draws it.
 *   2. P-401 Enlarged Plans: the restrooms at 1/4" (a second page scale) and a hand sink
 *      station detail at 1/2" that is TYP. OF 4 (a scale zone and a multiply zone).
 *   3. P-501 Schedules: a portrait page whose landscape content is turned 90° (Rotate).
 * True ANSI B pages (1224 × 792 pt, and 792 × 1224 for the sideways one).
 *
 *   npm run build:sample-lessons
 */
const path = require('path');
const { chromium } = require('@playwright/test');
const { W, H, candidateB, lessonDetailSheet, lessonScheduleSheet } = require('./sample-plan-candidates');

const OUT = path.join(__dirname, '..', 'samples', 'sample-lessons.pdf');
const land = (body) => `<div class="land"><svg xmlns="http://www.w3.org/2000/svg" width="17in" height="11in" viewBox="0 0 ${W} ${H}">${body}</svg></div>`;
const port = (body) => `<div class="port"><svg xmlns="http://www.w3.org/2000/svg" width="11in" height="17in" viewBox="0 0 ${H} ${W}">${body}</svg></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page land { size: 17in 11in; margin: 0; } @page port { size: 11in 17in; margin: 0; }
  html,body { margin:0; padding:0; } svg { display:block; }
  .land { page: land; break-after: page; } .port { page: port; }
</style></head><body>${land(candidateB())}${land(lessonDetailSheet())}${port(lessonScheduleSheet())}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log('Wrote samples/sample-lessons.pdf (P-101, P-401, P-501).');
})().catch((e) => { console.error(e); process.exit(1); });
