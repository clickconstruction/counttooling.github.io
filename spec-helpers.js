// @ts-check
/**
 * Shared Playwright spec helpers (R07, 2026-09-26): the boot wait, the PDF upload and
 * the console-error collector that every spec used to carry its own copy of.
 *
 *   const { bootApp, uploadPdf, collectConsoleErrors } = require('./spec-helpers');
 *   const errors = collectConsoleErrors(page);   // before the goto, so boot errors count
 *   await bootApp(page);                         // goto /app/ + App.bootSettled
 *   await uploadPdf(page);                       // test-2pages.pdf through #pdfInput + the pages list
 *   ...
 *   errors.assertNoErrors();                     // or expect(errors).toEqual([]), the same check
 *
 * Not a *.spec.js, so playwright.config.js's testMatch never collects it. Linted by the
 * Node group in eslint.config.js. scripts/lib/project-map.js reads a spec that requires
 * this file as if the helper's `App.*` reads were the spec's own (the "specs that pin each
 * file" attribution), so moving a boot wait in here takes nothing from the map.
 */
const path = require('path');
const { expect } = require('@playwright/test');

/** The two test PDFs at the repo root, and the synthetic sample plan. */
const PDFS = {
  twoPages: path.join(__dirname, 'test-2pages.pdf'),
  onePage: path.join(__dirname, 'test-page.pdf'),
  samplePlan: path.join(__dirname, 'samples', 'sample-plan.pdf'),
};

/**
 * The suite's allowlist: console lines that are not app errors. A console error whose
 * SOURCE is the gitignored, localhost-only config.local.js include (its 404 in a fresh
 * clone or worktree without the stub) is dropped by location; these match on the text.
 */
const BENIGN_ERRORS = [
  // pdf.js, when a canvas gets a new render() before the last one settled (prepare-pdf's
  // preview thumbnails re-render on every page toggle).
  /multiple render\(\) operations/i,
];

/**
 * Collect the page's console errors and uncaught page errors into an array, minus the
 * allowlist. Call it before the first goto so a boot error counts.
 * @param {import('@playwright/test').Page} page
 * @param {{ ignore?: Array<RegExp | string> }} [opts] extra lines this spec expects
 * @returns {string[] & { assertNoErrors: () => void }} the live array; assertNoErrors()
 *   expects it empty. The method is non-enumerable, so `expect(errors).toEqual([])` still holds.
 */
function collectConsoleErrors(page, opts = {}) {
  const ignore = BENIGN_ERRORS.concat(opts.ignore || []);
  const benign = (text) => ignore.some((p) => (typeof p === 'string' ? String(text || '').includes(p) : p.test(String(text || ''))));
  /** @type {any} */
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if ((m.location()?.url || '').includes('config.local.js')) return;
    if (benign(m.text())) return;
    errors.push(m.text());
  });
  page.on('pageerror', (e) => { if (!benign(e.message)) errors.push(e.message); });
  Object.defineProperty(errors, 'assertNoErrors', { value: () => expect(errors).toEqual([]), enumerable: false });
  return errors;
}

/**
 * Wait for the app's own ready signal, App.bootSettled (never a quiet network).
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number, ready?: string | Function }} [opts] `ready`: one more
 *   in-page condition to wait for after boot (e.g. a lazily registered entry point)
 */
async function waitForBoot(page, opts = {}) {
  const timeout = opts.timeout || 30000;
  await page.waitForFunction(() => !!window.App && window.App.bootSettled === true, null, { timeout });
  if (opts.ready) await page.waitForFunction(/** @type {any} */ (opts.ready), null, { timeout });
}

/**
 * Open the app and wait for it to boot.
 * @param {import('@playwright/test').Page} page
 * @param {{ url?: string, viewport?: { width: number, height: number }, timeout?: number, ready?: string | Function }} [opts]
 *   url defaults to '/app/'; viewport is set before the goto
 */
async function bootApp(page, opts = {}) {
  if (opts.viewport) await page.setViewportSize(opts.viewport);
  await page.goto(opts.url || '/app/');
  await waitForBoot(page, opts);
}

/**
 * Reload the page and wait for the app to boot again.
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number, ready?: string | Function }} [opts]
 */
async function reloadApp(page, opts = {}) {
  await page.reload();
  await waitForBoot(page, opts);
}

/**
 * Put a PDF through #pdfInput, the way a picked file arrives, and wait for the pages list.
 * @param {import('@playwright/test').Page} page
 * @param {string | { name: string, mimeType: string, buffer: Buffer }} [file] a path (a bare
 *   name resolves from the repo root), or a setInputFiles payload; default test-2pages.pdf
 * @param {{ timeout?: number, waitForPages?: boolean }} [opts] waitForPages false skips the wait
 */
async function uploadPdf(page, file = PDFS.twoPages, opts = {}) {
  const input = typeof file === 'string' && !path.isAbsolute(file) ? path.join(__dirname, file) : file;
  await page.locator('#pdfInput').setInputFiles(input);
  if (opts.waitForPages !== false) await page.waitForSelector('#pagesList .sidebar-item', { timeout: opts.timeout || 15000 });
}

/**
 * LEARN-START: a device that has finished nothing sees one Start here card on the empty
 * canvas, and the line of tour, lesson and course links only once something is finished.
 * A spec that clicks one of those links marks Start here as done first, like a returning
 * device (an init script, so it holds across reloads). Call it before the goto.
 */
async function pastStartHere(page) {
  await page.addInitScript(() => {
    try {
      const d = JSON.parse(localStorage.getItem('clickcount-lessons-done') || '{}') || {};
      if (!d.start) { d.start = '2026-09-27T00:00:00.000Z'; localStorage.setItem('clickcount-lessons-done', JSON.stringify(d)); }
    } catch (_) { /* storage unavailable: the spec sees the fresh card */ }
  });
}


// Wait for a tour, lesson or chapter step. A doing step that carries an `answer` holds on it once it
// is done (the card pass, 2026-09-28): the card reads the result and waits for Next. A reader clicks
// Next; so does this, once the card has stood done for longer than the engine's own 900 ms beat.
async function stepTo(page, id, timeout = 8000) {
  await page.waitForFunction((want) => {
    const A = window.App;
    if (A.tutorialStepId() === want) return true;
    const n = document.getElementById('tourNext'), i = A.tutorialStepInfo && A.tutorialStepInfo();
    if (i && i.kind === 'do' && i.done && n && !n.disabled) {
      if (window.__heldId !== i.id) { window.__heldId = i.id; window.__heldAt = Date.now(); }
      else if (Date.now() - window.__heldAt > 1400) { window.__heldId = null; n.click(); }
    } else window.__heldId = null;
    return false;
  }, id, { timeout, polling: 100 });
}

module.exports = { PDFS, BENIGN_ERRORS, collectConsoleErrors, waitForBoot, bootApp, reloadApp, uploadPdf, pastStartHere, stepTo };
