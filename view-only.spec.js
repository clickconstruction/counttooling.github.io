// @ts-check
/**
 * Tests: view-link boot (features/view-only.js initViewOnlyMode).
 *
 * The whole view-link session entry: /app/?t=TOKEN triggers the gated email
 * prompt, the get-view-project Edge Function fetch, PDF download via the
 * returned signed URL, project-data hydration (App.hydrateStateFromProjectData),
 * viewer state flags, and the offline view-cache fallback (IndexedDB snapshot
 * used only when the server is unreachable).
 *
 * The Edge Function is stubbed with a Playwright route (CORS-complete: the
 * cross-origin POST preflights, so OPTIONS is answered too); the "signed URL"
 * is the same-origin test-2pages.pdf, so no cloud credentials are needed and
 * every test always runs. The viewer-scale layer has its own spec
 * (viewer-scale.spec.js); this one pins the boot path around it.
 */
const { test, expect } = require('@playwright/test');

const TOKEN = 'spec-view-only-token';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** A minimal cloud `proj`-format payload: one counter with a marker and a
 * scale on page 0 of the 2-page test PDF. */
function projectPayload() {
  return {
    projectId: 'proj-view-spec',
    name: 'View Spec Project',
    pdfHash: 'hash-view-spec',
    updatedAt: '2026-07-30T12:00:00Z',
    pdfSignedUrl: '/test-2pages.pdf',
    data: {
      counters: [{ id: 'c1', name: 'Floor Drain', icon: 'M0 0h24v24H0z', color: '#ff0000' }],
      lineTypes: [{ id: 'lt1', name: 'Copper', color: '#00ff00' }],
      groups: [],
      rooms: [],
      pages: [{
        index: 0,
        scale: { pixelsPerUnit: 5, unit: 'ft' },
        rotation: 0,
        canvases: [{
          id: 'cv1',
          name: 'Main',
          annotations: {
            counterMarkers: { c1: [{ x: 100, y: 120, id: 'm1' }] },
            quickLines: [{ x1: 10, y1: 10, x2: 60, y2: 10, color: '#00ff00', id: 'q1', lineTypeId: 'lt1' }],
            polylines: [], highlights: [], notes: [], multiplyZones: [], scaleZones: [], roomBoxes: [],
            legend: null,
          },
        }],
      }],
      activeCanvasIdByPage: { 0: 'cv1' },
    },
  };
}

/**
 * Stub the get-view-project Edge Function. `respond(email)` returns
 * { status, body } for a POST with that email.
 * @param {import('@playwright/test').Page} page
 * @param {(email: string) => { status: number, body: any }} respond
 */
async function routeViewProject(page, respond) {
  await page.route('**/functions/v1/get-view-project', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const req = route.request().postDataJSON() || {};
    const { status, body } = respond(String(req.email || ''));
    await route.fulfill({
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
}

function collectErrors(page, errors) {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => { errors.push(err.message); });
}

/** Network noise from deliberately-failed fetches (offline test) and the
 * gitignored config.local.js 404 — not app errors. */
function realErrors(errors) {
  return errors.filter((e) =>
    !/Failed to load resource|net::|Failed to fetch|config\.local\.js/.test(e));
}

async function submitEmail(page, email) {
  await page.waitForSelector('#viewLinkEmailModal.visible', { timeout: 10000 });
  await page.locator('#viewLinkEmailInput').fill(email);
  await page.locator('#viewLinkEmailSubmit').click();
}

async function expectViewerLoaded(page) {
  await page.waitForSelector('body.has-pdf', { timeout: 20000 });
  await page.waitForFunction(() => window.App?.state?.isViewer === true, { timeout: 10000 });
}

test.describe('View-only mode (view-link boot)', () => {
  test('registry wired', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await page.goto('/app/');
    await page.waitForLoadState('networkidle');
    const wired = await page.evaluate(() => ({
      init: typeof window.App?.initViewOnlyMode,
      cancel: typeof window.App?.cancelViewLinkEmailPrompt,
      notice: typeof window.App?.maybeShowViewerScaleNotice,
      failure: typeof window.App?.showViewLinkFailure,
    }));
    expect(wired).toEqual({ init: 'function', cancel: 'function', notice: 'function', failure: 'function' });
    expect(realErrors(errors)).toEqual([]);
  });

  test('boot via ?t=: email gate, hydration, viewer flags, allowed-email persisted', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await routeViewProject(page, () => ({ status: 200, body: projectPayload() }));

    await page.goto('/app/?t=' + TOKEN);
    await submitEmail(page, 'crew@clickplumbing.com');
    await expectViewerLoaded(page);

    const after = await page.evaluate((token) => {
      const s = window.App.state;
      const ann = s.pages[0].canvases[0].annotations;
      return {
        pages: s.pages.length,
        name: s.currentProjectName,
        projectId: s.currentProjectId,
        viewToken: s.viewToken,
        isViewer: s.isViewer,
        canCheckOut: s.canCheckOut,
        loadedViaViewLink: s.loadedViaViewLink,
        counters: s.counters.map((c) => c.id),
        markers: (ann.counterMarkers.c1 || []).length,
        quickLines: ann.quickLines.length,
        scalePpu: s.pages[0].scale?.pixelsPerUnit,
        page1Scale: s.pages[1].scale,
        allowedEmail: localStorage.getItem('view:allowed:' + token),
      };
    }, TOKEN);
    expect(after.pages).toBe(2);
    expect(after.name).toBe('View Spec Project');
    expect(after.projectId).toBe('proj-view-spec');
    expect(after.viewToken).toBe(TOKEN);
    expect(after.isViewer).toBe(true);
    expect(after.canCheckOut).toBe(false);
    expect(after.loadedViaViewLink).toBe(true);
    expect(after.counters).toEqual(['c1']);
    expect(after.markers).toBe(1);
    expect(after.quickLines).toBe(1);
    expect(after.scalePpu).toBe(5);
    expect(after.page1Scale).toBeNull();
    expect(after.allowedEmail).toBe('crew@clickplumbing.com');
    expect(realErrors(errors)).toEqual([]);
  });

  test('domain_restricted: error shown, re-prompt keeps the message, allowed domain loads', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await routeViewProject(page, (email) => email.endsWith('@clickplumbing.com')
      ? { status: 200, body: projectPayload() }
      : { status: 403, body: { error: 'domain_restricted', message: 'Access restricted to clickplumbing.com' } });

    await page.goto('/app/?t=' + TOKEN);
    await submitEmail(page, 'outsider@example.com');

    // Rejected: the modal re-opens with the server message still visible.
    await page.waitForFunction(() => {
      const err = document.getElementById('viewLinkEmailError');
      return document.getElementById('viewLinkEmailModal')?.classList.contains('visible')
        && err && err.style.display !== 'none' && /restricted/.test(err.textContent || '');
    }, { timeout: 10000 });

    await page.locator('#viewLinkEmailInput').fill('crew@clickplumbing.com');
    await page.locator('#viewLinkEmailSubmit').click();
    await expectViewerLoaded(page);

    const allowed = await page.evaluate((t) => localStorage.getItem('view:allowed:' + t), TOKEN);
    expect(allowed).toBe('crew@clickplumbing.com');
    expect(realErrors(errors)).toEqual([]);
  });

  test('cancel at the email gate: no load, app stays usable', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await routeViewProject(page, () => ({ status: 200, body: projectPayload() }));

    await page.goto('/app/?t=' + TOKEN);
    await page.waitForSelector('#viewLinkEmailModal.visible', { timeout: 10000 });
    await page.locator('#viewLinkEmailCancel').click();

    await page.waitForFunction(
      () => !document.getElementById('viewLinkEmailModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const after = await page.evaluate(() => ({
      pages: window.App.state.pages.length,
      hasPdf: document.body.classList.contains('has-pdf'),
      isViewer: window.App.state.isViewer,
    }));
    expect(after.pages).toBe(0);
    expect(after.hasPdf).toBe(false);
    expect(after.isViewer).toBe(false);
    expect(realErrors(errors)).toEqual([]);
  });

  test('offline fallback: server unreachable on revisit serves the cached snapshot', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);

    // First visit online: populates the IndexedDB view cache (blob + data snapshot).
    await routeViewProject(page, () => ({ status: 200, body: projectPayload() }));
    await page.goto('/app/?t=' + TOKEN);
    await submitEmail(page, 'crew@clickplumbing.com');
    await expectViewerLoaded(page);

    // Revisit with the Edge Function unreachable: allowed email is remembered
    // (no prompt) and the cached snapshot loads.
    await page.unroute('**/functions/v1/get-view-project');
    await page.route('**/functions/v1/get-view-project', (route) => route.abort('failed'));
    await page.goto('/app/?t=' + TOKEN);
    await expectViewerLoaded(page);

    const after = await page.evaluate(() => {
      const s = window.App.state;
      return {
        projectId: s.currentProjectId,
        pages: s.pages.length,
        markers: (s.pages[0].canvases[0].annotations.counterMarkers.c1 || []).length,
        promptVisible: document.getElementById('viewLinkEmailModal')?.classList.contains('visible'),
        deadScreenVisible: document.getElementById('viewLinkDeadScreen')?.classList.contains('visible'),
      };
    });
    expect(after.projectId).toBe('proj-view-spec');
    expect(after.pages).toBe(2);
    expect(after.markers).toBe(1);
    expect(after.promptVisible).toBe(false);
    // Cache-served revisits must never show the failure screen.
    expect(after.deadScreenVisible).toBe(false);
    expect(realErrors(errors)).toEqual([]);
  });

  test('dead link: full-screen inactive message, no Retry, editor never exposed', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    await routeViewProject(page, () => ({ status: 404, body: { message: 'View link not found' } }));

    await page.goto('/app/?t=' + TOKEN);
    await submitEmail(page, 'crew@clickplumbing.com');

    await page.waitForSelector('#viewLinkDeadScreen.visible', { timeout: 10000 });
    await expect(page.locator('#viewLinkDeadMessage')).toHaveText(
      'This plan link isn’t active anymore. Ask the person who sent it for a new one.');
    await expect(page.locator('#viewLinkDeadRetry')).toBeHidden();

    const after = await page.evaluate((token) => ({
      hasPdf: document.body.classList.contains('has-pdf'),
      isViewer: window.App.state.isViewer,
      pages: window.App.state.pages.length,
      allowedEmail: localStorage.getItem('view:allowed:' + token),
    }), TOKEN);
    expect(after.hasPdf).toBe(false);
    expect(after.isViewer).toBe(false);
    expect(after.pages).toBe(0);
    // Only persisted on a successful fetch — a dead link never remembers the email.
    expect(after.allowedEmail).toBeNull();
    expect(realErrors(errors)).toEqual([]);
  });

  test('network failure with no cache: Retry shown, reload recovers', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);
    // Edge Function unreachable (OPTIONS included) — untagged network failure.
    await page.route('**/functions/v1/get-view-project', (route) => route.abort('failed'));

    await page.goto('/app/?t=' + TOKEN);
    await submitEmail(page, 'crew@clickplumbing.com');

    await page.waitForSelector('#viewLinkDeadScreen.visible', { timeout: 10000 });
    await expect(page.locator('#viewLinkDeadMessage')).toHaveText(
      'Couldn’t load this plan. Check your connection and try again.');
    await expect(page.locator('#viewLinkDeadRetry')).toBeVisible();

    // The server comes back; Retry reloads the page — the boot IS the retry
    // loop. The email was never persisted (fetch failed), so the gate re-asks.
    await page.unroute('**/functions/v1/get-view-project');
    await routeViewProject(page, () => ({ status: 200, body: projectPayload() }));
    await page.locator('#viewLinkDeadRetry').click();
    await submitEmail(page, 'crew@clickplumbing.com');
    await expectViewerLoaded(page);
    expect(realErrors(errors)).toEqual([]);
  });

  test('revoked link with a cached snapshot shows the dead screen, not the cached plan', async ({ page }) => {
    const errors = [];
    collectErrors(page, errors);

    // First visit online: populates the IndexedDB view cache (blob + data snapshot).
    await routeViewProject(page, () => ({ status: 200, body: projectPayload() }));
    await page.goto('/app/?t=' + TOKEN);
    await submitEmail(page, 'crew@clickplumbing.com');
    await expectViewerLoaded(page);

    // Revisit after revocation: the server answers 404 (dead-tagged) — the
    // cached snapshot must NOT be served ("It will stop working immediately").
    await page.unroute('**/functions/v1/get-view-project');
    await routeViewProject(page, () => ({ status: 404, body: { message: 'View link not found' } }));
    await page.goto('/app/?t=' + TOKEN);

    await page.waitForSelector('#viewLinkDeadScreen.visible', { timeout: 10000 });
    await expect(page.locator('#viewLinkDeadMessage')).toHaveText(
      'This plan link isn’t active anymore. Ask the person who sent it for a new one.');
    await expect(page.locator('#viewLinkDeadRetry')).toBeHidden();
    const after = await page.evaluate(() => ({
      hasPdf: document.body.classList.contains('has-pdf'),
      pages: window.App.state.pages.length,
    }));
    expect(after.hasPdf).toBe(false);
    expect(after.pages).toBe(0);
    expect(realErrors(errors)).toEqual([]);
  });
});
