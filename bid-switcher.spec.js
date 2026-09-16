// @ts-check
/**
 * Tests: the header bid switcher (BID-SWITCHER.md).
 *
 * Reported by an estimator 2026-09-15: "two different buttons to upload pdf on
 * top bar, none to load project". Both halves were true. The Export control
 * used to wear an "Import PDF" costume whenever no project was open
 * (updateUI's shieldImportMode), so the empty-state header shipped two upload
 * affordances and no door to a saved bid.
 *
 * Stage 0 pins the deletion of that costume. Later stages add the bid chip.
 */
const { test, expect } = require('@playwright/test');

function realErrors(errors) {
  return errors.filter((e) =>
    !/Failed to load resource|net::|Failed to fetch|config\.local\.js/.test(e));
}

test.describe('Empty-state header: one upload door, no decoy', () => {
  test('the Export control does not impersonate Upload PDF', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1380, height: 800 });
    await page.goto('/app/');
    await page.waitForFunction(() => !!(window.App && window.App.state), null, { timeout: 15000 });

    // Nothing open: the Export control is gone entirely rather than disguised.
    await expect(page.locator('#exportDropdown')).toBeHidden();
    await expect(page.locator('#exportDropdownBtn')).toBeHidden();

    // The disguise itself is gone from the DOM.
    await expect(page.locator('#exportDropdownIconImport')).toHaveCount(0);

    // No control anywhere in the header claims to upload a PDF except #uploadPdf.
    const uploadish = await page.evaluate(() => {
      const hits = [];
      document.querySelector('header.header').querySelectorAll('button').forEach((b) => {
        const r = b.getBoundingClientRect();
        if (getComputedStyle(b).display === 'none' || r.width === 0) return;
        const text = [b.id, b.getAttribute('aria-label') || '', b.getAttribute('title') || '', b.textContent || ''].join(' ');
        if (/upload|import/i.test(text) && /pdf|plan/i.test(text)) hits.push(b.id || text.trim().slice(0, 30));
      });
      return hits;
    });
    expect(uploadish).toEqual(['uploadPdf']);

    expect(realErrors(errors)).toEqual([]);
  });

  test('with a plan open the Export menu is back and opens', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1380, height: 800 });
    await page.goto('/app/');
    await page.locator('#pdfInput').setInputFiles(require('path').join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });

    const btn = page.locator('#exportDropdownBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-label', 'Export');
    await expect(btn).toHaveAttribute('aria-haspopup', 'menu');

    // It opens its menu now instead of firing the file picker.
    await btn.click();
    await expect(page.locator('#exportDropdownMenu')).toHaveClass(/visible/);

    expect(realErrors(errors)).toEqual([]);
  });
});

// Drive the header into "a bid is open" without a cloud round trip, the way
// view-only.spec.js flips state and re-runs updateUI.
async function openFakeBid(page, name, id) {
  await page.evaluate(([nm, pid]) => {
    const s = window.App.state;
    s.supabaseSession = { user: { id: 'u1', email: 'wendi@clickplumbing.com' } };
    s.currentProjectId = pid || 'proj-bid-chip';
    s.currentProjectName = nm;
    s.isViewer = false;
    s.loadedViaViewLink = false;
    window.App.updateUI();
  }, [name, id]);
}

test.describe('The bid chip (features/bid-chip.js)', () => {
  test('names the bid you are in, and says so when there is none', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1380, height: 800 });
    await page.goto('/app/');
    await page.waitForFunction(() => !!(window.App && window.App.state), null, { timeout: 15000 });

    const chip = page.locator('#headerBidChip');
    await expect(chip).toBeVisible();
    await expect(page.locator('#headerBidChipName')).toHaveText('No bid open');
    await expect(chip).toHaveClass(/is-empty/);
    // Nothing open: there is room and no bid to name, so the wordmark stays.
    await expect(page.locator('#headerLogo')).toBeVisible();

    await page.locator('#pdfInput').setInputFiles(require('path').join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await openFakeBid(page, 'Sysco Cold Box · P-101');

    await expect(page.locator('#headerBidChipName')).toHaveText('Sysco Cold Box · P-101');
    await expect(chip).not.toHaveClass(/is-empty/);
    await expect(chip).toHaveAttribute('title', 'Sysco Cold Box · P-101');
    // The wordmark hands over its slot once there is a bid to name.
    await expect(page.locator('#headerLogo')).toBeHidden();

    expect(realErrors(errors)).toEqual([]);
  });

  test('a long bid name ellipsises and keeps the full name on the title', async ({ page }) => {
    await page.setViewportSize({ width: 1380, height: 800 });
    await page.goto('/app/');
    await page.locator('#pdfInput').setInputFiles(require('path').join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    const LONG = 'Bastrop ISD High School Field House Addition · M-201';
    await openFakeBid(page, LONG);

    await expect(page.locator('#headerBidChip')).toHaveAttribute('title', LONG);
    const clipped = await page.locator('#headerBidChipName').evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped).toBe(true);
  });

  // The regression guard for the question that decided this design.
  //
  // The first measurement of this was wrong: forcing .header-tools-scroll to
  // flex:0 0 auto and zeroing the .spacer to read an "intrinsic width" removed
  // the slack the real layout runs on and reported a 139px cost that does not
  // exist. Measured against the live layout in a realistic signed-in state, the
  // chip changes the collapse verdict at exactly one width band, and the fix
  // was a width cap rather than removing the wordmark.
  //
  // So the property worth pinning is not "the header never collapses" (it does,
  // by design, on narrow windows) but "the chip is not what tips it". Anything
  // that grows the chip or the header's right side will fail this.
  for (const width of [1280, 1366, 1440]) {
    test('at ' + width + 'px the chip does not tip the header into collapsed mode', async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/app/');
      await page.locator('#pdfInput').setInputFiles(require('path').join(__dirname, 'test-page.pdf'));
      await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
      await openFakeBid(page, 'Bastrop ISD High School Field House Addition \u00b7 M-201');

      const r = await page.evaluate(async () => {
        const chip = document.getElementById('headerBidChip');
        const read = async () => {
          window.App.scheduleHeaderCollapseCheck && window.App.scheduleHeaderCollapseCheck();
          await new Promise((res) => setTimeout(res, 350));
          return document.body.classList.contains('header-collapsed');
        };
        const withChip = await read();
        chip.style.setProperty('display', 'none', 'important');
        const without = await read();
        chip.style.removeProperty('display');
        return {
          withChip,
          without,
          wordmarkVisible: getComputedStyle(document.getElementById('headerLogo')).display !== 'none',
        };
      });

      expect(r.withChip).toBe(r.without);
      // With a bid open the wordmark has yielded its slot to the chip.
      expect(r.wordmarkVisible).toBe(false);
    });
  }

  test('a view-link recipient gets no chip: they have no bids to switch between', async ({ page }) => {
    await page.setViewportSize({ width: 1380, height: 800 });
    await page.goto('/app/');
    await page.locator('#pdfInput').setInputFiles(require('path').join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    const hidden = await page.evaluate(() => {
      const s = window.App.state;
      s.loadedViaViewLink = true; s.isViewer = true;
      window.App.updateUI();
      const d = getComputedStyle(document.getElementById('headerBidChip')).display;
      s.loadedViaViewLink = false; s.isViewer = false; window.App.updateUI();
      return d;
    });
    expect(hidden).toBe('none');
  });

  test('the status bar carries the sidebar toggle the wordmark hides behind', async ({ page }) => {
    await page.setViewportSize({ width: 1380, height: 800 });
    await page.goto('/app/');
    await page.waitForFunction(() => !!(window.App && window.App.state), null, { timeout: 15000 });

    const link = page.locator('#statusBarSidebar');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
    await link.click();
    await expect(page.locator('body')).not.toHaveClass(/sidebar-collapsed/);
  });
});

// Seed the local recents store the way a working week would leave it.
async function seedRecents(page, rows) {
  await page.evaluate((r) => {
    const now = Date.now();
    localStorage.setItem('recentBids', JSON.stringify(r.map((x) => ({ id: x.id, name: x.name, at: now - x.agoMs }))));
  }, rows);
}

const WEEK = [
  { id: 'aaa', name: 'Sysco Cold Box \u00b7 P-101', agoMs: 2 * 3600e3 },
  { id: 'bbb', name: 'Midland Clinic \u00b7 M-200', agoMs: 26 * 3600e3 },
  { id: 'ccc', name: 'Bastrop ISD High School Field House Addition \u00b7 M-201', agoMs: 4 * 86400e3 },
];

test.describe('The bid menu (features/bid-chip.js)', () => {
  test('lists the recents, marks the open bid inert, and offers the two doors', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('/app/');
    await seedRecents(page, WEEK);
    await page.reload();
    await page.locator('#pdfInput').setInputFiles(require('path').join(__dirname, 'test-page.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
    await openFakeBid(page, 'Sysco Cold Box \u00b7 P-101', 'aaa');

    await page.locator('#headerBidChip').click();
    const menu = page.locator('#headerBidMenu');
    await expect(menu).toBeVisible();
    await expect(page.locator('#headerBidChip')).toHaveAttribute('aria-expanded', 'true');

    // The bid you are in is named but not re-openable.
    const current = menu.locator('.bm-row.is-current');
    await expect(current).toHaveText(/Sysco Cold Box/);
    await expect(current).toBeDisabled();

    // The others are offered, newest first, with coarse ages.
    const others = menu.locator('.bm-row.bm-recent');
    await expect(others.first()).toHaveText(/Midland Clinic/);
    await expect(menu).toContainText('yesterday');
    await expect(menu).toContainText('4d ago');
    // Listed once, not twice: the open bid is filtered out of the recents.
    await expect(menu.locator('.bm-row', { hasText: 'Sysco Cold Box' })).toHaveCount(1);
    await expect(others).toHaveCount(2);

    await expect(menu.locator('.bm-action')).toHaveText(/All my bids/);
    await expect(menu).toContainText('Upload a new plan');

    expect(realErrors(errors)).toEqual([]);
  });

  test('Escape and a click away both close it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('/app/');
    await seedRecents(page, WEEK);
    await page.reload();
    await page.waitForFunction(() => !!(window.App && window.App.state), null, { timeout: 15000 });

    const chip = page.locator('#headerBidChip');
    const menu = page.locator('#headerBidMenu');

    await chip.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(chip).toHaveAttribute('aria-expanded', 'false');

    await chip.click();
    await expect(menu).toBeVisible();
    await page.mouse.click(700, 500);
    await expect(menu).toBeHidden();
  });

  test('with no recents the two actions are the whole menu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('/app/');
    await page.evaluate(() => localStorage.removeItem('recentBids'));
    await page.reload();
    await page.waitForFunction(() => !!(window.App && window.App.state), null, { timeout: 15000 });

    await page.locator('#headerBidChip').click();
    const menu = page.locator('#headerBidMenu');
    await expect(menu).toBeVisible();
    // No headings, no separator, no empty-state copy: just the doors.
    await expect(menu.locator('.bm-head')).toHaveCount(0);
    await expect(menu.locator('.bm-sep')).toHaveCount(0);
    await expect(menu.locator('.bm-row')).toHaveCount(2);
  });

  test('the two doors are wired: the list opens, and Upload fires the picker', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('/app/');
    await page.waitForFunction(() => !!(window.App && window.App.state), null, { timeout: 15000 });
    await page.evaluate(() => { window.__pdfClicks = 0; document.getElementById('pdfInput').click = () => { window.__pdfClicks++; }; });

    await page.locator('#headerBidChip').click();
    await page.locator('#headerBidMenu .bm-row', { hasText: 'Upload a new plan' }).click();
    await expect(page.locator('#headerBidMenu')).toBeHidden();
    expect(await page.evaluate(() => window.__pdfClicks)).toBe(1);

    // Signed out, "All my bids…" routes through the auth gate rather than
    // dead-ending (Tier-3 B7), which is the wiring this asserts.
    await page.locator('#headerBidChip').click();
    await page.locator('#headerBidMenu .bm-action').click();
    await expect(page.locator('#authModal')).toHaveClass(/visible/);
  });
});
