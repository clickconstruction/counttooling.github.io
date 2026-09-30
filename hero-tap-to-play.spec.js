// Landing: the hero film's Play pill. A browser may refuse the start the page asks for on its
// own (iOS Low Power Mode above all; a data saver; a strict autoplay policy): the film then shows
// a Play pill over the still, a tap is the user gesture those browsers honour, and the pill goes
// once the film plays. Any other failure (a codec the browser lacks) keeps the still with no pill.
// Local + CI (the landing is static HTML at /). Sibling of landing-trade.spec.js.
const { test, expect } = require('@playwright/test');

// Stand in for the phone: every play() the page asks for is refused with NotAllowedError until a
// tap "unlocks" it; an unlocked play resolves and fires 'playing', as the real element would.
function refuseUntilUnlocked() {
  window.__plays = 0;
  window.__unlocked = false;
  HTMLMediaElement.prototype.play = function () {
    window.__plays++;
    if (!window.__unlocked) return Promise.reject(new DOMException('The request is not allowed by the user agent.', 'NotAllowedError'));
    const el = this;
    setTimeout(() => el.dispatchEvent(new Event('playing')), 0);
    return Promise.resolve();
  };
}

test.describe('Landing · hero film Play pill when autoplay is refused', () => {
  test('a refused start shows the pill; a tap starts the film and the pill goes', async ({ page }) => {
    await page.addInitScript(refuseUntilUnlocked);
    await page.goto('/');
    const media = page.locator('#heroMedia');
    await media.scrollIntoViewIfNeeded();           // the start comes from the hero scrolling into view
    await expect(media).toHaveClass(/needs-tap/);   // and was refused
    await expect(page.locator('#heroPlay')).toBeVisible();
    expect(await page.evaluate(() => window.__heroPlayError)).toContain('NotAllowedError');
    await page.evaluate(() => { window.__unlocked = true; });
    await page.locator('#heroPlay').click();
    await expect(media).not.toHaveClass(/needs-tap/);
    await expect(page.locator('#heroPlay')).toBeHidden();
    await expect(media).toHaveClass(/is-playing/);
  });

  test('while the pill shows, a tap on the frame itself also starts the film', async ({ page }) => {
    await page.addInitScript(refuseUntilUnlocked);
    await page.goto('/');
    await page.locator('#heroMedia').scrollIntoViewIfNeeded();
    await expect(page.locator('#heroMedia')).toHaveClass(/needs-tap/);
    const before = await page.evaluate(() => window.__plays);
    await page.evaluate(() => { window.__unlocked = true; });
    await page.locator('#heroMedia img.hero-shot').click({ position: { x: 20, y: 20 } });
    expect(await page.evaluate(() => window.__plays)).toBeGreaterThan(before);
    await expect(page.locator('#heroMedia')).not.toHaveClass(/needs-tap/);
  });

  test('a failure that is not the autoplay policy keeps the still and shows no pill', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('The element has no supported sources.', 'NotSupportedError')); };
    });
    await page.goto('/');
    await page.locator('#heroMedia').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => window.__heroPlayError || '')).toContain('NotSupportedError');
    await expect(page.locator('#heroMedia')).not.toHaveClass(/needs-tap/);
    await expect(page.locator('#heroPlay')).toBeHidden();
  });
});
