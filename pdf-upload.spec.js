// @ts-check
/**
 * Tests: the robust PDF upload work (Phase C size-aware/abortable/verify timeout
 * + Phase D resumable/TUS upload with cross-reload resume). Non-cloud smoke:
 *  - the tus-js-client CDN library loads and integrates with no page errors;
 *  - the pdf_upload_resume IndexedDB store round-trips in a real browser (the
 *    idb.js helpers are classic-script globals on window).
 * The actual large-file resumable upload + size-aware timeout need a signed-in
 * cloud session and a slow connection, so they are covered by the Node unit
 * tests (pdfUploadTimeoutMs, the resume store) + a manual large-file smoke.
 */
const { test, expect } = require('@playwright/test');

test.describe('robust PDF upload', () => {
  test('tus-js-client loads and integrates with no page errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const tusInfo = await page.evaluate(() => ({
      defined: typeof window.tus !== 'undefined',
      upload: typeof (window.tus && window.tus.Upload),
      isSupported: !!(window.tus && window.tus.isSupported),
    }));
    expect(tusInfo.defined).toBe(true);
    expect(tusInfo.upload).toBe('function');
    expect(tusInfo.isSupported).toBe(true);
    // No error attributable to the tus integration (e.g. a failed CDN load or a
    // resumable-helper reference error). A pre-existing, unrelated boot-timing
    // race can log "App.hasAnyHighlights is not a function" before the feature
    // scripts register, so scope this assertion to tus/resumable rather than all.
    const tusErrors = errors.filter((e) => /tus|resumable|uploadPdf/i.test(e));
    expect(tusErrors).toEqual([]);
  });

  test('pdf_upload_resume IndexedDB store round-trips (real browser)', async ({ page }) => {
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const fp = 'spec-fp-' + Date.now();
      await window.idbPdfUploadResumePut({ urlStorageKey: fp + '::k1', fingerprint: fp, uploadUrl: 'https://example/1' });
      await window.idbPdfUploadResumePut({ urlStorageKey: fp + '::k2', fingerprint: fp, uploadUrl: 'https://example/2' });
      const afterPut = (await window.idbPdfUploadResumeGetByFingerprint(fp)).length;
      await window.idbPdfUploadResumeDelete(fp + '::k1');
      const afterDelete = (await window.idbPdfUploadResumeGetByFingerprint(fp)).length;
      await window.idbPdfUploadResumeDeleteByFingerprint(fp);
      const afterClear = (await window.idbPdfUploadResumeGetByFingerprint(fp)).length;
      return { afterPut, afterDelete, afterClear };
    });

    expect(result).toEqual({ afterPut: 2, afterDelete: 1, afterClear: 0 });
  });
});
