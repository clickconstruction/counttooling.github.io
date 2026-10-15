#!/usr/bin/env node
/**
 * smoke-demo.js: every demo-track moment (DEMO-TRACK, features/demo-<trade>.js) walked on a real
 * site, each in a fresh browser context (no cache, no service worker: a first-time guest), by the
 * demo's own "Do it for me" seam, to the last card.
 *
 *   npm run smoke:demo                         the live site, https://counttooling.com
 *   npm run smoke:demo -- http://localhost:3456   any other origin
 *   npm run smoke:demo -- --trade hvac         one trade
 *
 * Prints, per moment: whether it finished, the seconds from goto to the last card, the seconds
 * to the FIRST payoff (the plan's one number: under 60), and every payoff sentence as the guest
 * reads it. Fails (exit 1) when a moment does not finish, a page error or console error shows,
 * or the quiet UI is still on after the demo stops.
 *
 * Manual, like build:screenshots: it needs a browser and a network, so it is NOT in `npm run
 * check`. Run it after a deploy that touches the demo track, the tour engine or a course's seeds.
 * The moment ids are the test page's (test/index.html TRADES): change them together.
 *
 * Two things it taught, 2026-10-02: a fixed-position card has no offsetParent (ask the engine
 * whether a tour is active, never the card's layout box), and a headless context refuses
 * clipboard writes unless granted (the HVAC pounds moment's Copy Schedule).
 */
const { chromium } = require('@playwright/test');

const MOMENTS = {
  hvac: ['size', 'pounds', 'rooms', 'mistake', 'handoff'],
  plumbing: ['schedule', 'pipe', 'riser', 'scale', 'bid'],
  electrical: ['gfci', 'wire', 'circuit', 'fill', 'handoff'],
};
const args = process.argv.slice(2);
const tradeAt = args.indexOf('--trade');
const only = tradeAt >= 0 ? args[tradeAt + 1] : null;
const base = (args.find((a, i) => /^https?:/.test(a) && i !== tradeAt + 1) || 'https://counttooling.com').replace(/\/$/, '');
const BENIGN = /config\.local|favicon|Failed to load resource/;

async function walk(browser, trade, moment) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !BENIGN.test(m.text())) errs.push(m.text()); });
  const t0 = Date.now();
  await page.goto(base + '/app/?demo=' + trade + ':' + moment, { waitUntil: 'commit' });
  const card = () => page.evaluate(() => {
    const c = document.querySelector('#tourCard');
    return c && window.App && window.App.isTutorialActive && window.App.isTutorialActive() ? c.innerText : '';
  }).catch(() => '');
  const active = () => page.evaluate(() => !!(window.App && window.App.isTutorialActive && window.App.isTutorialActive())).catch(() => false);
  const done = (c) => /✓ Done/.test(c);
  const payoffs = [];
  let finished = false, stuck = '', firstPayoff = null;
  for (let i = 0; i < 450 && !done(await card()); i++) await page.waitForTimeout(100);   // the orientation, on a painted sheet
  for (let step = 0; step < 8; step++) {
    let c = await card();
    if (!done(c)) {
      await page.evaluate(() => window.App.tutorialDoStep()).catch(() => {});
      for (let i = 0; i < 150 && !done(c = await card()); i++) await page.waitForTimeout(100);
      if (!done(c)) { stuck = c.replace(/\n+/g, ' | ').slice(0, 140); break; }
    }
    if (step > 0) {
      const lines = c.split('\n').map((l) => l.trim()).filter(Boolean);
      const at = lines.findIndex((l) => /^\d+ \/ \d+$/.test(l));
      payoffs.push(lines.slice(at + 3, lines.indexOf('✓ Done')).join(' '));
      if (firstPayoff == null) firstPayoff = Date.now() - t0;
    }
    await page.click('#tourNext', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(700);
    if (!(await active())) { finished = true; break; }
  }
  const quietLeft = await page.evaluate(() => document.body.classList.contains('demo-quiet') || document.querySelectorAll('.demo-quiet-fold, .demo-quiet-dim').length > 0).catch(() => false);
  await ctx.close();
  const secs = (ms) => (ms == null ? 'never' : (ms / 1000).toFixed(1) + 's');
  const ok = finished && !stuck && !errs.length && !quietLeft && firstPayoff != null && firstPayoff < 60000;
  console.log((ok ? 'OK  ' : 'FAIL') + ' ' + trade + ':' + moment + '  whole ' + secs(Date.now() - t0) + '  first payoff ' + secs(firstPayoff)
    + (stuck ? '  STUCK AT: ' + stuck : '') + (quietLeft ? '  QUIET UI LEFT ON' : '') + (errs.length ? '  ERRORS: ' + errs.join(' ; ').slice(0, 240) : ''));
  payoffs.forEach((p) => console.log('      ' + p));
  return ok;
}

(async () => {
  const browser = await chromium.launch();
  let bad = 0, n = 0;
  for (const trade of Object.keys(MOMENTS)) {
    if (only && only !== trade) continue;
    for (const moment of MOMENTS[trade]) { n++; if (!(await walk(browser, trade, moment))) bad++; }
  }
  await browser.close();
  console.log(bad ? bad + ' of ' + n + ' moment(s) FAILED on ' + base : 'all ' + n + ' moments finish on ' + base);
  process.exit(bad ? 1 : 0);
})();
