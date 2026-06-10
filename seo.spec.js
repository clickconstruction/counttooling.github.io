// @ts-check
/**
 * Tests: Tier 1 technical SEO — the static meta/OG/Twitter/JSON-LD tags on the clean
 * URL, the og-image asset, and the privacy-critical behavior that private/utility URLs
 * (view links `?t=`, dev bypass `?devAuth=1`) get a `noindex` robots meta while the clean
 * `/` stays indexable.
 *
 * Local only (Playwright is excluded from CI).
 */
const { test, expect } = require('@playwright/test');

async function content(page, selector) {
  const el = page.locator(selector);
  return (await el.count()) ? el.first().getAttribute('content') : null;
}

test.describe('SEO (Tier 1)', () => {
  test('clean URL carries the SEO tags, JSON-LD, a working og-image, and stays indexable', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(await content(page, 'meta[name="description"]')).toMatch(/takeoff/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://counttooling.com/');

    // Open Graph + Twitter
    expect(await content(page, 'meta[property="og:title"]')).toContain('CountTooling');
    expect(await content(page, 'meta[property="og:description"]')).toMatch(/takeoff/i);
    expect(await content(page, 'meta[property="og:image"]')).toBe('https://counttooling.com/og-image.png');
    expect(await content(page, 'meta[property="og:url"]')).toBe('https://counttooling.com/');
    expect(await content(page, 'meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(await content(page, 'meta[name="twitter:image"]')).toBe('https://counttooling.com/og-image.png');

    // JSON-LD parses and describes the app
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(ld);
    expect(data['@type']).toBe('WebApplication');
    expect(data.name).toBe('CountTooling');
    expect(Array.isArray(data.sameAs)).toBe(true);

    // The og-image is actually served
    const status = await page.evaluate(() => fetch('/og-image.png').then((r) => r.status));
    expect(status).toBe(200);

    // Clean URL is indexable: no robots meta at all
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  // Backward-compat: old share/view links were counttooling.com/?t=... The landing
  // forwards them (and the localhost ?devAuth=1 bypass) to the app at /app/, which is
  // itself noindex — so private takeoffs never get indexed under the marketing root.
  test('private view-link URL (?t=) is forwarded to /app/', async ({ page }) => {
    await page.goto('/?t=faketoken123');
    await page.waitForURL(/\/app\//, { timeout: 5000 });
    expect(page.url()).toContain('/app/');
    expect(page.url()).toContain('t=faketoken123');
  });

  test('dev bypass URL (?devAuth=1) is forwarded to /app/', async ({ page }) => {
    await page.goto('/?devAuth=1');
    await page.waitForURL(/\/app\//, { timeout: 5000 });
    expect(page.url()).toContain('/app/');
    expect(page.url()).toContain('devAuth=1');
  });

  test('the app shell at /app/ is noindex (landing owns SEO)', async ({ page }) => {
    await page.goto('/app/');
    const robots = await content(page, 'meta[name="robots"]');
    expect(robots).toMatch(/noindex/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://counttooling.com/app/');
  });
});
