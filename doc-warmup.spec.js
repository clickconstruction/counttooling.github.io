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
 *      cache hits gained, no fresh visible-path raster needed for ink,
 *   4. the status-bar hint ("Preparing pages N/M") shows while the walk runs
 *      and hides at completion,
 *   5. MARKED pages warm before unmarked ones (the sheets carrying the
 *      user's annotations are the ones they jump to),
 *   6. a truly cold flip (no cached bitmap at any rung) clears the canvas to
 *      paper-white instead of leaving the PREVIOUS sheet visible until the
 *      raster lands.
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

    // The status-bar hint appears while the walk is running…
    await page.waitForFunction(() => {
      const el = document.getElementById('statusWarmup');
      return el && el.style.display !== 'none' && /^Preparing pages \d+\/4$/.test(el.textContent);
    }, null, { timeout: 30000 });

    // 1. The walk completes: all 4 non-current pages marked, and the
    //    render-service log shows prefetch rasters for pages beyond
    //    current±1 (i.e. pageNumbers 3..5 while sitting on page 1).
    await page.waitForFunction(() => {
      const s = window.App.__docWarmupState && window.App.__docWarmupState();
      return s && s.pages === 5 && s.done === 4;
    }, null, { timeout: 30000 });
    // …and hides once the whole document is warm.
    await page.waitForFunction(() => document.getElementById('statusWarmup').style.display === 'none', null, { timeout: 5000 });
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

  test('marked pages warm before unmarked ones', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    // Hold the prefetch chain back (each prefetch raster +400ms) so the walk
    // cannot reach the far field before the marker below is seeded — the
    // ordering assertion must not race the walk (flaked on CI without this).
    await page.evaluate(() => window.App.__setRasterTestDelay(400, ['prefetch']));
    await page.locator('#pdfInput').setInputFiles({
      name: 'five-pages.pdf', mimeType: 'application/pdf', buffer: buildMultiPagePdf(5),
    });
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, null, { timeout: 15000 });

    // Seed a counter marker on PAGE 4 (index 3) before the walk gets going —
    // it should now warm before the nearer-but-unmarked pages 3 and 5.
    await page.evaluate(() => {
      const p = window.state.pages[3];
      p.canvases[0].annotations.counterMarkers = { seed: [{ x: 100, y: 100, id: 'seed1' }] };
      window.App.__setRasterTestDelay(0);   // seed is in — release the chain
    });

    await page.waitForFunction(() => window.App.__docWarmupState().done === 4, null, { timeout: 30000 });
    const farOrder = await page.evaluate(() =>
      window.App.__renderServiceStats().log.filter((e) => e.kind === 'prefetch' && e.pageNumber >= 3).map((e) => e.pageNumber));
    expect(farOrder.length).toBeGreaterThanOrEqual(3);
    expect(farOrder[0]).toBe(4);   // the marked page led the far-field walk
    expect(errors).toEqual([]);
  });

  test('a truly cold flip clears to paper-white instead of showing the previous sheet', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    // Slow every raster BEFORE the upload so nothing (page 2 included) can be
    // prefetched or persisted ahead of the flip — the flip is guaranteed cold.
    // (The crafted PDF is used because its pages carry guaranteed ink;
    // test-2pages.pdf's sheets are blank.)
    await page.evaluate(() => window.App.__setRasterTestDelay(800));
    await page.locator('#pdfInput').setInputFiles({
      name: 'two-pages-inked.pdf', mimeType: 'application/pdf', buffer: buildMultiPagePdf(2),
    });
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await page.waitForFunction(() => document.getElementById('pdfCanvas').width > 0, null, { timeout: 15000 });
    // Page 1 painted (it has ink). Now flip cold: the canvas must go
    // paper-white within a frame — NOT keep page 1's drawing for the 800ms
    // raster.
    await page.waitForTimeout(300);
    const sample = () => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      const s = document.createElement('canvas');
      s.width = 96; s.height = 96;
      const g = /** @type {CanvasRenderingContext2D} */ (s.getContext('2d'));
      g.drawImage(c, 0, 0, 96, 96);
      const d = g.getImageData(0, 0, 96, 96).data;
      let ink = 0, painted = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0) painted++;
        if (d[i + 3] > 0 && (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245)) ink++;
      }
      return { ink, painted };
    };
    expect((await page.evaluate(sample)).ink).toBeGreaterThan(0);   // page 1 visibly has content
    await page.locator('#nextPage').click();
    await page.waitForFunction(() => window.state.currentPage === 1, null, { timeout: 5000 });
    await page.waitForTimeout(120);   // well inside the 800ms raster delay
    const during = await page.evaluate(sample);
    expect(during.painted).toBeGreaterThan(0);   // canvas is a white placeholder…
    expect(during.ink).toBe(0);                  // …not the previous sheet
    // The crisp raster then lands normally.
    await page.waitForFunction(() => {
      const c = /** @type {HTMLCanvasElement} */ (document.getElementById('pdfCanvas'));
      const s = document.createElement('canvas');
      s.width = 96; s.height = 96;
      const g = /** @type {CanvasRenderingContext2D} */ (s.getContext('2d'));
      g.drawImage(c, 0, 0, 96, 96);
      const d = g.getImageData(0, 0, 96, 96).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0 && (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245)) return true;
      }
      return false;
    }, null, { timeout: 10000 });
    await page.evaluate(() => window.App.__setRasterTestDelay(0));
    expect(errors).toEqual([]);
  });
});
