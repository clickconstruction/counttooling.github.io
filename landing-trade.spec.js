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
    test(`?trade=${trade} lands on that film, pinned, with its proof rows`, async ({ page }) => {
      await page.goto('/?trade=' + trade);
      await expect(page.locator('.trade-chips .chip[data-trade="' + trade + '"]')).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => window.__heroFilm())).toBe(trade);
      expect(await page.evaluate(() => document.querySelector('#heroMedia video source').getAttribute('src'))).toBe('/img/hero-' + trade + '.mp4');
      await expect(page.locator('.bidcheck-rows[data-trade="' + trade + '"]')).toBeVisible();
      // pinned: the film loops instead of advancing to the next trade
      await page.evaluate(() => document.querySelector('#heroMedia video').dispatchEvent(new Event('ended')));
      expect(await page.evaluate(() => window.__heroFilm())).toBe(trade);
    });
  }

  test('an unknown ?trade= falls back to plumbing, unpinned', async ({ page }) => {
    await page.goto('/?trade=roofing');
    expect(await page.evaluate(() => window.__heroFilm())).toBe('plumbing');
    await page.evaluate(() => document.querySelector('#heroMedia video').dispatchEvent(new Event('ended')));
    expect(await page.evaluate(() => window.__heroFilm())).toBe('electrical');
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
