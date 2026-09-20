// Landing: the hero chips, the ?trade= link, and the proof panel that follows the trade.
// Local + CI (the landing is static HTML at /). Sibling of seo.spec.js.
const { test, expect } = require('@playwright/test');

const trades = ['plumbing', 'electrical', 'hvac'];

test.describe('Landing · trade chips, ?trade= link, proof panel', () => {
  test('plumbing first; the proof panel shows plumbing rows; the chips swap film, poster and panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.trade-chips .chip[data-trade="plumbing"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-hero-trade'))).toBe('plumbing');
    await expect(page.locator('.bidcheck-rows[data-trade="plumbing"]')).toBeVisible();
    await expect(page.locator('.bidcheck-rows[data-trade="hvac"]')).toBeHidden();
    await page.locator('.trade-chips .chip[data-trade="hvac"]').click();
    await expect(page.locator('.trade-chips .chip[data-trade="hvac"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.querySelector('#heroMedia video source').getAttribute('src'))).toBe('/img/hero-hvac.mp4');
    expect(await page.evaluate(() => document.querySelector('img.hero-shot').getAttribute('src'))).toBe('/img/hero-hvac.png');
    await expect(page.locator('.bidcheck-rows[data-trade="hvac"]')).toBeVisible();
    await expect(page.locator('.bidcheck-rows[data-trade="hvac"]')).toContainText('Bid weight');
    await expect(page.locator('.bidcheck-rows[data-trade="plumbing"]')).toBeHidden();
  });

  for (const trade of trades) {
    test(`?trade=${trade} lands on that film, with its proof rows, and the film holds at its end`, async ({ page }) => {
      await page.goto('/?trade=' + trade);
      await expect(page.locator('.trade-chips .chip[data-trade="' + trade + '"]')).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => window.__heroFilm())).toBe(trade);
      expect(await page.evaluate(() => document.querySelector('#heroMedia video source').getAttribute('src'))).toBe('/img/hero-' + trade + '.mp4');
      await expect(page.locator('.bidcheck-rows[data-trade="' + trade + '"]')).toBeVisible();
      // HERO-CHAPTERS: the film plays once and holds; it neither loops nor hands over to the next trade
      await page.evaluate(() => document.querySelector('#heroMedia video').dispatchEvent(new Event('ended')));
      expect(await page.evaluate(() => window.__heroFilm())).toBe(trade);
      await expect(page.locator('#heroChapters')).toHaveClass(/is-ended/);
    });
  }

  test('an unknown ?trade= falls back to plumbing, and the ended film stays on plumbing', async ({ page }) => {
    await page.goto('/?trade=roofing');
    expect(await page.evaluate(() => window.__heroFilm())).toBe('plumbing');
    await page.evaluate(() => document.querySelector('#heroMedia video').dispatchEvent(new Event('ended')));
    expect(await page.evaluate(() => window.__heroFilm())).toBe('plumbing');
  });

  // HERO-CHAPTERS (LANDING-REFRESH.md "The hero chapters"): the bar under the film.
  for (const [trade, second, third] of [['plumbing', 'Fixtures', 'Pipe'], ['electrical', 'Devices', 'Wire'], ['hvac', 'Rooms', 'Duct']]) {
    test(`the ${trade} chapters file has four ascending chapters ending at the film's length, and the strip shows them`, async ({ page, request }) => {
      const j = await (await request.get('/img/hero-' + trade + '.chapters.json')).json();
      expect(j.chapters.map((c) => c.name)).toEqual(['Scale', second, third, 'Pricing']);
      expect(j.chapters[0].start).toBe(0);
      j.chapters.forEach((c, i) => { expect(c.end).toBeGreaterThan(c.start); if (i) expect(c.start).toBe(j.chapters[i - 1].end); });
      expect(j.chapters[3].end).toBe(j.duration);
      await page.goto('/?trade=' + trade);
      await expect(page.locator('#heroChapters .hc-card')).toHaveCount(4);
      await expect(page.locator('#heroChapters .hc-card .hc-name > span')).toHaveText(['Scale', second, third, 'Pricing']);
      // each section names its own length, and the four add up to the film's stated length
      const secs = (await page.locator('#heroChapters .hc-card .hc-name small').allTextContents()).map((x) => { expect(x).toMatch(/^\d+s$/); return parseInt(x, 10); });
      expect(secs.reduce((a, b) => a + b, 0)).toBe(Math.round(j.duration));
      const dur = await page.evaluate(() => new Promise((r) => { const v = document.querySelector('#heroMedia video'); if (v.duration) r(v.duration); else { v.addEventListener('loadedmetadata', () => r(v.duration), { once: true }); v.preload = 'auto'; v.load(); } }));
      expect(Math.abs(dur - j.duration)).toBeLessThan(0.1);   // the file is the footage's, not a guess
    });
  }

  test('the strip follows the film: a card seeks, the clock answers, the film holds, Play again and Next takeoff work', async ({ page }) => {
    await page.goto('/');
    await page.locator('#heroMedia').scrollIntoViewIfNeeded();
    await expect(page.locator('#heroChapters')).toBeVisible();
    await expect(page.locator('#hcQ')).toHaveText('How long does it take to count a restaurant?');
    // under the film, never over it: the bar starts where the frame ends, and the film keeps its own box
    const boxes = await page.evaluate(() => { const f = document.querySelector('#heroMedia .hero-frame').getBoundingClientRect(), s = document.getElementById('heroChapters').getBoundingClientRect(), v = document.querySelector('#heroMedia video').getBoundingClientRect(); return { gap: Math.round(s.top - f.bottom), videoInFrame: Math.abs(v.bottom - f.bottom) < 1 }; });
    expect(boxes).toEqual({ gap: 0, videoInFrame: true });
    await page.waitForFunction(() => !document.querySelector('#heroMedia video').paused);
    // a card is a seek
    await page.locator('#heroChapters .hc-card').nth(2).click();
    await page.waitForFunction(() => document.querySelector('#heroMedia video').currentTime >= 14);
    await expect(page.locator('#heroChapters .hc-card').nth(2)).toHaveClass(/is-now/);
    await expect(page.locator('#heroChapters .hc-card').nth(0)).toHaveClass(/is-done/);
    await expect(page.locator('#hcEnd')).toBeHidden();
    // the end: the answer, the hold on the still, the end row
    await page.evaluate(() => { document.querySelector('#heroMedia video').currentTime = 41.5; });
    await expect(page.locator('#heroChapters')).toHaveClass(/is-ended/, { timeout: 8000 });
    await expect(page.locator('#hcA')).toHaveText('Forty-three seconds, from start to sent for pricing.');
    await expect(page.locator('#hcA')).toBeVisible();
    await expect(page.locator('#hcTime')).toHaveText('0:43.0');
    await expect(page.locator('#heroMedia')).not.toHaveClass(/is-playing/);   // the still (the last frame) shows, never the fade to black
    await expect(page.locator('#hcEnd')).toBeVisible();   // over the held frame; the bar keeps its height
    await expect(page.locator('#hcEnd .hc-next')).toHaveText([/^Electrical, \d+ s$/, /^HVAC, \d+ s$/]);
    expect(await page.evaluate(() => window.__heroFilm())).toBe('plumbing');
    // Play again
    await page.locator('#hcAgain').click();
    await expect(page.locator('#heroChapters')).not.toHaveClass(/is-ended/);
    await expect(page.locator('#hcEnd')).toBeHidden();
    await page.waitForFunction(() => { const v = document.querySelector('#heroMedia video'); return !v.paused && v.currentTime < 5; });
    await expect(page.locator('#heroMedia')).toHaveClass(/is-playing/);
    // Next takeoff is the chips by another name
    await page.evaluate(() => { document.querySelector('#heroMedia video').currentTime = 41.5; });
    await expect(page.locator('#heroChapters')).toHaveClass(/is-ended/, { timeout: 8000 });
    await page.locator('#hcEnd .hc-next').first().click();
    expect(await page.evaluate(() => window.__heroFilm())).toBe('electrical');
    await expect(page.locator('.trade-chips .chip[data-trade="electrical"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#hcQ')).toHaveText('How long does it take to wire an office suite?');
    await expect(page.locator('#heroChapters')).not.toHaveClass(/is-ended/);
  });

  test('reduced motion keeps the still and gets the four names as a static row', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('#heroChapters')).toHaveClass(/is-static/);
    await expect(page.locator('#heroChapters .hc-card')).toHaveCount(4);
    await expect(page.locator('#heroChapters .hc-ask')).toBeHidden();
    await context.close();
  });

  test('the spotlight shows the selected trade\'s six frames, loads them lazily, and swaps with the chips', async ({ page }) => {
    await page.goto('/');
    const set = (t) => page.locator('.spotlight-set[data-trade="' + t + '"]');
    await expect(set('plumbing')).toBeVisible();
    await expect(set('electrical')).toBeHidden();
    await expect(set('hvac')).toBeHidden();
    await expect(set('plumbing').locator('figure.spot')).toHaveCount(6);
    await expect(set('plumbing').locator('figure.spot img')).toHaveCount(6);
    await expect(set('plumbing').locator('figure.spot figcaption')).toHaveCount(6);
    // lazy: the visible set's frames load once scrolled to; a hidden set's never do
    const first = set('plumbing').locator('figure.spot img').first();
    await first.scrollIntoViewIfNeeded();
    await expect.poll(() => first.evaluate((el) => el.complete && el.naturalWidth > 0), { timeout: 10000 }).toBe(true);
    expect(await set('hvac').locator('figure.spot img').first().evaluate((el) => el.naturalWidth)).toBe(0);
    await page.locator('.trade-chips .chip[data-trade="hvac"]').click();
    await expect(set('hvac')).toBeVisible();
    await expect(set('plumbing')).toBeHidden();
    await expect(set('hvac').locator('h2')).toContainText('HVAC');
    await expect(set('hvac').locator('figure.spot')).toHaveCount(6);
  });

  test('a spotlight frame opens in the lightbox, the arrows walk the set, Escape closes it', async ({ page }) => {
    await page.goto('/?trade=hvac');
    const set = page.locator('.spotlight-set[data-trade="hvac"]');
    const first = set.locator('figure.spot').first();
    const title = await first.locator('figcaption b').textContent();
    const second = await set.locator('figure.spot').nth(1).locator('figcaption b').textContent();
    await first.locator('.spot-open').click();
    const lb = page.locator('#spotLightbox');
    await expect(lb).toBeVisible();
    await expect(lb.locator('.lb-title')).toHaveText(title);
    await expect(lb.locator('.lb-count')).toHaveText('1 / 6');
    await expect(lb.locator('.lb-img')).toHaveAttribute('src', /\/img\/spotlight\/hvac-1-/);
    await page.keyboard.press('ArrowRight');
    await expect(lb.locator('.lb-title')).toHaveText(second);
    await expect(lb.locator('.lb-count')).toHaveText('2 / 6');
    await lb.locator('.lb-img').click();   // a click on the picture never closes it
    await expect(lb).toBeVisible();
    await lb.locator('.lb-img').dblclick();
    await expect.poll(() => lb.locator('.lb-img').evaluate((el) => el.style.transform)).toContain('scale(2.5)');
    await lb.locator('.lb-img').dblclick();
    await expect.poll(() => lb.locator('.lb-img').evaluate((el) => el.style.transform)).toContain('scale(1)');
    await lb.locator('.lb-in').click();
    await expect.poll(() => lb.locator('.lb-img').evaluate((el) => el.style.transform)).toContain('scale(1.5)');
    await page.keyboard.press('Escape');
    await expect(lb).toBeHidden();
    await expect(first.locator('.spot-open')).toBeFocused();
  });

  test('?trade=hvac opens on the HVAC spotlight', async ({ page }) => {
    await page.goto('/?trade=hvac');
    await expect(page.locator('.spotlight-set[data-trade="hvac"]')).toBeVisible();
    await expect(page.locator('.spotlight-set[data-trade="plumbing"]')).toBeHidden();
  });

  test('the shop section and the Texas line are on the page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#shop h2')).toContainText('every estimator');
    const shot = page.locator('#shop img.proof-shot');
    await shot.scrollIntoViewIfNeeded();   // loading="lazy": it fetches once in view
    await expect.poll(() => shot.evaluate((el) => el.complete && el.naturalWidth > 0), { timeout: 10000 }).toBe(true);
    await expect(page.locator('footer')).toContainText('Austin, Texas');
  });
});
