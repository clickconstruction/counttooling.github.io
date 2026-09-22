// @ts-check
/**
 * LOAD-DEVICE-PDF (punch row, closed 2026-09-22): Load Project opens a cloud project on the
 * device's PDF when the cloud has none. A PDF upload cut short by a reload leaves the marks
 * autosaved, the row with no pdf_path (or an object that is empty or missing) and the device
 * backup holding the blob; the restore prompt learned to use it on 2026-09-20 and Load Project
 * went straight to "annotations but no PDF". Same rule as the restore: the backup's blob unless
 * both sides carry a hash and they disagree; the copy is handed to the engine
 * (state.pdfBuffer, no pdfStoragePath) so its autosave tick uploads it.
 *
 * Runs signed out against a fake cloud row through the registered App.loadCloudProjectRow, so
 * nothing on the test account is touched: the backup is seeded through the localhost test seam,
 * the row's Supabase fetches fail closed (a signed-out client), and the engine never uploads
 * without a session.
 */
const { test, expect } = require('@playwright/test');

const ready = (page) => page.waitForFunction(() => window.App && window.App.bootSettled === true && typeof window.__takeoffBackupPutForTest === 'function', null, { timeout: 30000 });
const ROW = (over) => Object.assign({ id: 'dev-pdf-test', name: 'Device copy', data: { counters: [{ id: 'c1', name: 'WC', icon: 'M0 0h10v10H0z', color: '#e8c547' }], lineTypes: [], pages: [{ index: 0, canvases: [{ id: 'cv1', name: 'Main', annotations: { counterMarkers: { c1: [{ x: 10, y: 10, id: 'm1' }] } } }] }] }, updated_at: new Date().toISOString(), pdf_path: null, pdf_hash: null, user_id: null }, over || {});

// A backup OLDER than the row (the marks in the cloud are the fresher side), holding the two-page
// PDF: the case the old gate lost, because "whose marks win" also decided the PDF.
async function seedOlderBackup(page, hash) {
  await page.evaluate(async ({ hash }) => {
    const res = await fetch('/test-2pages.pdf');
    const blob = await res.blob();
    await window.__takeoffBackupPutForTest('dev-pdf-test', { counters: [], lineTypes: [], pageCanvases: [[], []], pageScales: [null, null], pageRotations: [0, 0] }, blob, hash, Date.now() - 600000, 'Device copy', null);
  }, { hash });
}
const load = (page, over) => page.evaluate(async (row) => {
  const errors = [];
  await window.App.loadCloudProjectRow(row, { hostModalId: 'loadProjectModal', showError: (h) => errors.push(h) });
  const s = window.state;
  return { errors, pages: s.pages.length, storagePath: s.pdfStoragePath, bufferBytes: s.pdfBufferSize, hash: s.pdfHash, project: s.currentProjectId, marks: s.pages.length ? Object.values(window.App.getActiveAnnotations(s.pages[0]).counterMarkers || {}).flat().length : 0, needsPdf: document.getElementById('canvasOnlyNeedsPdfModal').classList.contains('visible') };
}, over);

test.describe('Load Project opens on the device PDF when the cloud has none', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/');
    await ready(page);
    await page.evaluate(() => window.__takeoffBackupDeleteForTest('dev-pdf-test', null).catch(() => {}));
  });

  test('no pdf_path, the device holds the file: the sheets open on it, the marks are the cloud\'s, the copy is handed to the engine', async ({ page }) => {
    await seedOlderBackup(page, 'device-hash');
    const r = await load(page, ROW());
    expect(r.errors).toEqual([]);
    expect(r.needsPdf).toBe(false);
    expect([r.pages, r.storagePath, r.project, r.marks]).toEqual([2, null, 'dev-pdf-test', 1]);
    expect(r.bufferBytes).toBe(795);   // test-2pages.pdf, byte for byte: the copy the engine will upload
    expect(r.hash).toBe('device-hash');   // the hash the row lacks is the backup's
    expect(await page.evaluate(() => window.state.pages.map((p) => p.label))).toEqual(['Device copy, p1', 'Device copy, p2']);
  });

  test('pdf_path set but the object is missing, the device holds the file: the same door, the storage path cleared so the engine re-uploads', async ({ page }) => {
    await seedOlderBackup(page, null);
    const r = await load(page, ROW({ pdf_path: 'pdfs/nobody/missing.pdf' }));
    expect(r.errors).toEqual([]);
    expect(r.needsPdf).toBe(false);
    expect([r.pages, r.storagePath, r.project]).toEqual([2, null, 'dev-pdf-test']);
    expect(r.bufferBytes).toBe(795);   // test-2pages.pdf, byte for byte: the copy the engine will upload
  });

  test('the hashes disagree: the device file is another sheet, so the canvas-only door opens as before', async ({ page }) => {
    await seedOlderBackup(page, 'device-hash');
    const r = await load(page, ROW({ pdf_hash: 'cloud-hash' }));
    expect(r.errors).toEqual([]);
    expect([r.pages, r.needsPdf, r.project]).toEqual([0, true, 'dev-pdf-test']);
  });

  test('no device copy: the canvas-only door opens as before', async ({ page }) => {
    const r = await load(page, ROW());
    expect(r.errors).toEqual([]);
    expect([r.pages, r.needsPdf, r.bufferBytes]).toEqual([0, true, 0]);
  });
});
