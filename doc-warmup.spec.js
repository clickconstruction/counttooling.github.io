// @ts-check
/**
 * Tests: the full-document background warm-up (prefetch tier 3).
 *
 * Once the near-field prefetch candidates (current-page rungs, neighbor
 * pages) are warm, idle time walks EVERY page outward from the current one,
 * rastering each at its rung-snapped fit zoom through the one-at-a-time
 * prefetch slot. Rung-snapped captures persist into the IndexedDB pyramid
 * (page-count-aware per-doc cap), so deep pages are warm on first visit this
 * session and across reopens. Asserts:
 *   1. the walk reaches pages BEYOND current±1 (prefetch rasters for far
 *      pages appear in the render-service log) and completes
 *      (__docWarmupState done === pages − 1),
 *   2. far-page fit rungs land in the persistent pyramid (persisted stat),
 *   3. a first visit to the LAST page is served warm — content paints with
 *      cache hits gained, no fresh visible-path raster needed for ink.
 */
const { test, expect } = require('@playwright/test');

// A minimal N-page PDF (each page a bordered rect + diagonal, so every page
// rasters real ink), assembled with a byte-accurate xref.
function buildMultiPagePdf(n) {
  const objs = [];
  const kids = [];
  for (let i = 0; i < n; i++) kids.push(`${3 + i * 2} 0 R`);
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${n} >>`);
  for (let i = 0; i < n; i++) {
    const contentNum = 4 + i * 2;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNum} 0 R >>`);
    const content = `1 w 40 40 532 712 re S 0 g 3 w 40 40 m ${80 + i * 40} 752 l S\n`;
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
  }
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

test.describe('Full-document warm-up', () => {
  test('walks every page, persists fit rungs, far page serves warm on first visit', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    await page.locator('#pdfInput').setInputFiles({
      name: 'five-pages.pdf', mimeType: 'application/pdf', buffer: buildMultiPagePdf(5),
    });
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, null, { timeout: 15000 });

    // 1. The walk completes: all 4 non-current pages marked, and the
    //    render-service log shows prefetch rasters for pages beyond
    //    current±1 (i.e. pageNumbers 3..5 while sitting on page 1).
    await page.waitForFunction(() => {
      const s = window.App.__docWarmupState && window.App.__docWarmupState();
      return s && s.pages === 5 && s.done === 4;
    }, null, { timeout: 30000 });
    const farPrefetches = await page.evaluate(() =>
      window.App.__renderServiceStats().log.filter((e) => e.kind === 'prefetch' && e.pageNumber >= 3).map((e) => e.pageNumber));
    expect(farPrefetches).toEqual(expect.arrayContaining([3, 4, 5]));

    // 2. Fit rungs persisted to the IndexedDB pyramid (webp writes are
    //    async — wait for the counter, not just the walk).
    await page.waitForFunction(() => window.App.__pdfBitmapCacheStats().persisted >= 4, null, { timeout: 30000 });

    // 3. First visit to the LAST page is warm: content paints promptly with
    //    cache hits gained (rung-served blit), no blank canvas.
    const before = await page.evaluate(() => window.App.__pdfBitmapCacheStats().hits);
    await page.evaluate(() => { document.querySelectorAll('#pagesList .sidebar-item')[4].click(); });
    await page.waitForFunction(() => window.state.currentPage === 4, null, { timeout: 5000 });
    await page.waitForFunction(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      if (!c || !c.width) return false;
      const s = document.createElement('canvas');
      s.width = 64; s.height = 64;
      const g = /** @type {CanvasRenderingContext2D} */ (s.getContext('2d'));
      g.drawImage(c, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 0 && (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250)) return true; }
      return false;
    }, null, { timeout: 3000 });
    expect(await page.evaluate(() => window.App.__pdfBitmapCacheStats().hits)).toBeGreaterThan(before);

    expect(errors).toEqual([]);
  });
});
