// @ts-check
/**
 * Tests: the PWA layer — manifest, head meta, service-worker registration, and the
 * headline guarantee that the app boots and renders a PDF **offline** (shell + the
 * vendored pdf.js worker served from the SW precache).
 *
 * Runs locally only (Playwright is excluded from CI). The offline test warms the SW
 * (load online → ready → reload so the page is SW-controlled and the precache is hot)
 * before flipping the context offline.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function waitForSW(page) {
  await page.waitForFunction(
    () => navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true),
    null,
    { timeout: 15000 }
  );
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!(reg && reg.active);
  });
}

test.describe('PWA', () => {
  test('manifest is linked, parseable, and has sized + maskable icons', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    const manifest = await page.evaluate(() => fetch('/manifest.webmanifest').then((r) => r.json()));
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBe('/app/');
    expect(manifest.display).toBe('standalone');
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i) => (i.purpose || '').includes('maskable'))).toBe(true);
    // Every declared icon must actually resolve (no broken paths).
    for (const icon of manifest.icons) {
      const status = await page.evaluate((src) => fetch(src).then((r) => r.status), icon.src);
      expect(status).toBe(200);
    }
  });

  test('PWA head meta tags are present', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#17171a');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveCount(1);
  });

  test('service worker registers and precaches the app shell', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    expect(await waitForSW(page)).toBe(true);
    const cache = await page.evaluate(async () => {
      const names = await caches.keys();
      const shell = names.find((n) => n.startsWith('counttooling-shell-'));
      if (!shell) return null;
      const keys = await (await caches.open(shell)).keys();
      const paths = keys.map((r) => new URL(r.url).pathname);
      return {
        name: shell,
        count: paths.length,
        hasWorker: paths.includes('/vendor/pdf.worker.min-3.11.174.js'),
        hasApp: paths.includes('/app.js'),
        hasShellHtml: paths.includes('/app/index.html') || paths.includes('/app/'),
      };
    });
    expect(cache).not.toBeNull();
    expect(cache.hasWorker).toBe(true);
    expect(cache.hasApp).toBe(true);
    expect(cache.hasShellHtml).toBe(true);
    expect(cache.count).toBeGreaterThan(50);
    // The SW is scoped to /app/ (the marketing site at / is outside it).
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope.replace(/\/$/, '')).toMatch(/\/app$/);
  });

  test('app boots and renders a PDF offline from the SW cache', async ({ page, context }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    // Warm the SW: load online, wait until active, reload so the page is SW-controlled
    // and the precache is populated.
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    expect(await waitForSW(page)).toBe(true);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.header')).toBeVisible();

    // Go offline and reload — the shell must come entirely from cache.
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.header')).toBeVisible();

    // The vendored pdf.js + its worker path must be available offline.
    const libs = await page.evaluate(() => ({
      pdfjs: typeof window.pdfjsLib,
      workerSrc: window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions.workerSrc,
    }));
    expect(libs.pdfjs).toBe('object');
    expect(libs.workerSrc).toContain('/vendor/pdf.worker.min-3.11.174.js');

    // Headline: upload + render a PDF while offline (reads the file locally; renders via
    // the cached worker — no network).
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    const canvasW = await page.evaluate(() => {
      const c = document.querySelector('#pdfCanvas');
      return c ? c.width : 0;
    });
    expect(canvasW).toBeGreaterThan(0);

    await context.setOffline(false);

    // No uncaught JS errors, and pdf.js did not fall back to the slow in-main-thread
    // "fake worker" (which would mean the worker wasn't cached). Supabase network errors
    // while offline are expected and ignored.
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((e) => /fake worker/i.test(e))).toEqual([]);
  });
});
