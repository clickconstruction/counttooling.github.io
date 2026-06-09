// @ts-check
/**
 * Tests: the /guides/ Help section rendered in a real browser — the index lists the
 * articles with correct SEO/JSON-LD, and an article renders its Markdown body with
 * per-page SEO, breadcrumb, and working internal links.
 *
 * Local only (Playwright is excluded from CI; the Node unit test guides.test.js validates
 * the generated output in CI).
 */
const { test, expect } = require('@playwright/test');

async function attr(page, selector, name) {
  const el = page.locator(selector).first();
  return (await el.count()) ? el.getAttribute(name) : null;
}

test.describe('Guides', () => {
  test('the /guides/ index lists the articles with SEO + JSON-LD', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/guides/');
    await expect(page).toHaveTitle(/Guides/);
    expect(await attr(page, 'link[rel="canonical"]', 'href')).toBe('https://counttooling.com/guides/');
    expect(await attr(page, 'meta[property="og:title"]', 'content')).toContain('CountTooling');

    // Cards link to the seed articles
    await expect(page.locator('a.guide-card[href="/guides/how-to-do-a-pdf-takeoff/"]')).toHaveCount(1);
    await expect(page.locator('a.guide-card[href="/guides/plumbing-takeoff/"]')).toHaveCount(1);

    // JSON-LD parses
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(ld)['@type']).toBe('CollectionPage');

    // Nav + footer point back home / to the app
    await expect(page.locator('.site-nav a[href="/app/"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('an article renders its Markdown with breadcrumb, SEO, and working links', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/guides/how-to-do-a-pdf-takeoff/');
    await expect(page.locator('h1')).toHaveText(/takeoff from a PDF/i);
    expect(await attr(page, 'link[rel="canonical"]', 'href')).toBe('https://counttooling.com/guides/how-to-do-a-pdf-takeoff/');
    expect(await attr(page, 'meta[property="og:type"]', 'content')).toBe('article');

    // Markdown rendered to real HTML (headings + a list inside .prose)
    expect(await page.locator('.prose h2').count()).toBeGreaterThan(1);
    expect(await page.locator('.prose ul li').count()).toBeGreaterThan(0);

    // Breadcrumb + Article JSON-LD
    await expect(page.locator('nav.breadcrumb')).toContainText('Guides');
    const types = await page.locator('script[type="application/ld+json"]').allTextContents();
    const parsed = types.map((t) => JSON.parse(t)['@type']);
    expect(parsed).toContain('Article');
    expect(parsed).toContain('BreadcrumbList');

    // og-image resolves
    const status = await page.evaluate(() => fetch('/og-image.png').then((r) => r.status));
    expect(status).toBe(200);

    // "All guides" link goes back to the index
    await expect(page.locator('a.back-link[href="/guides/"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});
