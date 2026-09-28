#!/usr/bin/env node
/*
 * scripts/card-walk.js - walk a tour, a lesson or a course chapter and print every card the way a
 * reviewer needs it (the card pass, journeys/plans/CARD-PASS.md): its text, its status line and
 * buttons, its chips (DEAD = named on the card, not on screen to light), the lit box, the card's box,
 * and SCROLLS / OFF-SCREEN when the card does not fit the window. One screenshot per card.
 *
 *   node scripts/card-walk.js <entry> <outdir> [tablet|-] [id,id,…]
 *
 *   <entry>   lesson:<id> | plumbing | electrical | hvac | blank | course:<trade>:<chapter>
 *   <outdir>  where the screenshots go (it must exist)
 *   tablet    1024 x 768 with a coarse pointer, else 1280 x 720
 *   id,id     only these cards are printed and shot (the walk still does every step before them)
 *
 * It needs the app served: CARD_WALK_URL (default http://localhost:4900) is the origin, e.g.
 * `npx serve -l 4900` in the checkout. Every doing step is done through the spec seam
 * App.tutorialDoStep(), so the state the next card reads is real. Manual, like build:screenshots:
 * not part of `npm run check`.
 */
const { chromium } = require('@playwright/test');
(async () => {
  const [start, out, mode, only] = process.argv.slice(2);
  const tablet = mode === 'tablet';
  const want = only && only !== '-' ? only.split(',') : null;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: tablet ? { width: 1024, height: 768 } : { width: 1280, height: 720 }, hasTouch: tablet, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (tablet) await page.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/pointer:\s*coarse/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); });
  await page.goto((process.env.CARD_WALK_URL || 'http://localhost:4900') + '/app/');
  await page.waitForFunction(() => window.App && window.App.bootSettled === true && window.App.startLesson);
  await page.evaluate((s) => { const m = s.match(/^lesson:(.*)$/); return m ? window.App.startLesson(m[1]) : window.App.startTutorial(s); }, start);
  const snap = async (tag) => {
    const o = await page.evaluate(() => {
      const box = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); };
      const card = document.getElementById('tourCard'), body = document.getElementById('tourBody');
      const vis = (e) => e && e.style.display !== 'none' && e.getBoundingClientRect().width > 0;
      return {
        id: window.App.tutorialStepId(), no: document.getElementById('tourStepNo').textContent, title: document.getElementById('tourTitle').textContent,
        body: body.innerText, status: document.getElementById('tourStatus').textContent,
        buttons: ['tourShow', 'tourAlt', 'tourReveal', 'tourSkip', 'tourBack', 'tourNext'].filter((i) => vis(document.getElementById(i)) && document.getElementById(i).style.visibility !== 'hidden').map((i) => document.getElementById(i).textContent.trim()),
        chips: [...body.querySelectorAll('.tour-ui')].map((c) => c.innerText.trim() + (c.classList.contains('tour-ui-live') ? '' : ' (DEAD)')),
        spot: box(document.getElementById('tourSpot')), card: box(card), scrolls: body.scrollHeight > body.clientHeight + 2 || card.scrollHeight > card.clientHeight + 2,
        win: [window.innerWidth, window.innerHeight], modal: (document.querySelector('.modal-overlay.visible') || {}).id || null,
      };
    });
    const c = o.card; o.off = c[1] < 0 || c[0] < 0 || c[1] + c[3] > o.win[1] || c[0] + c[2] > o.win[0];
    console.log('\n##', o.no, o.id, tag, '|', o.title);
    console.log(o.body.split('\n').filter(Boolean).map((l) => '   ' + l).join('\n'));
    console.log('   [status]', JSON.stringify(o.status), '[buttons]', o.buttons.join(' · '));
    console.log('   [chips]', o.chips.join(', ') || '-', '[lit]', o.spot.join(','), '[card]', o.card.join(','), o.scrolls ? 'SCROLLS' : '', o.off ? 'OFF-SCREEN' : '', o.modal ? '[modal ' + o.modal + ']' : '');
    await page.screenshot({ path: out + '/' + start.replace(/[^a-z0-9]+/gi, '-') + (tablet ? '-tablet' : '') + '-' + o.no.split(' ')[0].padStart(2, '0') + '-' + o.id + '-' + tag + '.png' });
    return o;
  };
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(3300);   // the glide and the arrival glow
    const id = await page.evaluate(() => window.App.tutorialStepId());
    if (!id) break;
    const show = !want || want.includes(id);
    if (show) await snap('a');
    const info = await page.evaluate(() => window.App.tutorialStepInfo());
    if (await page.evaluate(() => { const r = document.getElementById('tourReveal'); return r && r.style.display !== 'none'; })) { await page.click('#tourReveal'); await page.waitForTimeout(400); if (show) await snap('revealed'); }
    if (info.hasAction && !info.done) {
      await page.evaluate(() => window.App.tutorialDoStep());
      // Trim your set, by hand: the dialog is the next click
      await page.waitForTimeout(1200);
      if (await page.evaluate(() => { const m = document.getElementById('preparePdfModal'); return !!m && m.classList.contains('visible'); })) { await page.waitForTimeout(800); if (show) await snap('trim'); await page.click('#preparePdfDone'); }
      await page.waitForFunction((was) => window.App.tutorialStepId() !== was || document.getElementById('tourNext').classList.contains('tour-next-ready'), id, { timeout: 30000 }).catch(() => console.log('   !! the step did not finish'));
      await page.waitForTimeout(500);
      if (await page.evaluate(() => window.App.tutorialStepId()) === id && show) await snap('done');
    }
    if (await page.evaluate(() => window.App.tutorialStepId()) === id) await page.click('#tourNext');
  }
  if (errors.length) console.log('\nPAGE ERRORS', errors);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
