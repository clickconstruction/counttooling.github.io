// @ts-check
/**
 * ALT-GROUPS (2026-09-29): a group can be an alternate — the section the
 * customer wants priced with and without. Guards the switch in the group
 * dialog (set only when on, deleted when off), the ALT mark in the sidebar and
 * on the assign buttons, the Summary's order and base / + alternate foot, the
 * /Tooling text (alternates last under "--- Alternate: <name> ---", rows still
 * [Group]-prefixed, the Copied detail naming it), the TakeoffTooling payload's
 * `alternate: true`, and the email summary's sentence.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Alternate groups', () => {
  test('dialog switch, sidebar mark, Summary foot, both exports, email sentence', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // A plain group through the dialog, then an alternate through the dialog.
    await page.evaluate(() => window.App.openGroupModal(null));
    await page.waitForSelector('#groupModal.visible', { timeout: 5000 });
    await expect(page.locator('#groupModalAlternateBtn')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#groupModalName').fill('Restroom A');
    await page.locator('#groupModalDone').click();
    await page.waitForFunction(() => !document.getElementById('groupModal')?.classList.contains('visible'), null, { timeout: 5000 });

    await page.evaluate(() => window.App.openGroupModal(null));
    await page.waitForSelector('#groupModal.visible', { timeout: 5000 });
    await page.locator('#groupModalName').fill('Break room');
    await page.locator('#groupModalAlternateBtn').click();
    await expect(page.locator('#groupModalAlternateBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#groupModalDone').click();
    await page.waitForFunction(() => !document.getElementById('groupModal')?.classList.contains('visible'), null, { timeout: 5000 });

    const groups = await page.evaluate(() => window.state.groups.map(g => ({ name: g.name, alternate: g.alternate, keys: Object.keys(g).sort() })));
    expect(groups[0]).toEqual({ name: 'Restroom A', alternate: undefined, keys: ['color', 'id', 'name'] });   // untouched shape
    expect(groups[1].alternate).toBe(true);

    // Reopening the alternate shows the switch on; the sidebar wears the mark.
    await page.evaluate(() => window.App.openGroupModal(window.state.groups[1]));
    await page.waitForSelector('#groupModal.visible', { timeout: 5000 });
    await expect(page.locator('#groupModalAlternateBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#groupModalCancel').click();
    await page.waitForFunction(() => !document.getElementById('groupModal')?.classList.contains('visible'), null, { timeout: 5000 });
    await page.evaluate(() => window.App.updateUI());
    await expect(page.locator('#groupsList .group-alt-chip')).toHaveCount(1);
    await expect(page.locator('#groupsList .sidebar-item').nth(1)).toContainText('ALT');

    // Marks: WC ×4 and 112 ft of 2" PVC in Restroom A, WC ×1 and 48.5 ft in the
    // alternate, one untagged WH — page 1 scaled at 24 px/ft.
    await page.evaluate(() => {
      const s = window.state, App = window.App;
      const base = s.groups[0].id, alt = s.groups[1].id;
      s.counters.push({ id: 'c-wc', name: 'WC', icon: 'M0 0h10v10H0z', color: '#e8c547' });
      s.counters.push({ id: 'c-wh', name: 'WH', icon: 'M0 0h10v10H0z', color: '#e8c547' });
      s.lineTypes.push({ id: 'lt-pvc', name: '2" PVC', color: '#4a9eff', curveStyle: 'straight' });
      s.pages[0].scale = { pixelsPerUnit: 24, unit: 'ft' };
      const ann = App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.counterMarkers = ann.counterMarkers || {};
      ann.counterMarkers['c-wc'] = [
        { x: 10, y: 10, id: 'm1', group: base }, { x: 20, y: 10, id: 'm2', group: base }, { x: 30, y: 10, id: 'm3', group: base }, { x: 40, y: 10, id: 'm4', group: base },
        { x: 60, y: 10, id: 'm5', group: alt },
      ];
      ann.counterMarkers['c-wh'] = [{ x: 80, y: 10, id: 'm6' }];
      ann.quickLines = [
        { id: 'q1', x1: 0, y1: 50, x2: 2688, y2: 50, lineTypeId: 'lt-pvc', color: '#4a9eff', group: base },   // 112 ft
        { id: 'q2', x1: 0, y1: 60, x2: 1164, y2: 60, lineTypeId: 'lt-pvc', color: '#4a9eff', group: alt },    // 48.5 ft
      ];
      App.updateUI();
    });

    // Summary: the alternate heading comes last and the foot carries both numbers.
    const summary = await page.evaluate(() => ({
      headings: Array.from(document.querySelectorAll('#summaryList h3')).map(h => h.textContent),
      foot: document.querySelector('#summaryList .summary-alt-totals')?.textContent || '',
    }));
    expect(summary.headings).toEqual(['Group: Restroom A', 'Group: Untagged', 'Alternate: Break room']);
    expect(summary.foot).toContain('Base · 5 counts · 112.00 ft');
    expect(summary.foot).toContain('+ Break room · 1 count · 48.50 ft');

    // /Tooling text: base rows, blank line, the framed heading, the alternate's
    // rows still prefixed, then the footer-free end; the Copied detail names it.
    const out = await page.evaluate(() => ({
      pipe: window.getPipeToolingSummary(),
      detail: window.formatToolingExportSummary(window.summarizeToolingExport(window.getPipeToolingSummary())),
      payload: window.getTakeoffToolingPayload(),
      email: window.getEmailTextSummary(),
    }));
    const lines = out.pipe.split('\n');
    const head = lines.indexOf('--- Alternate: Break room ---');
    expect(head).toBeGreaterThan(0);
    expect(lines[head - 1]).toBe('');
    expect(lines.slice(0, head - 1)).toEqual(['[Restroom A] WC\t4\t1', '[Restroom A] ft of 2" PVC\t112.00\t1', 'WH\t1\t1']);
    expect(lines.slice(head + 1)).toEqual(['[Break room] WC\t1\t1', '[Break room] ft of 2" PVC\t48.50\t1']);
    expect(out.detail).toBe('3 counts (6 ea) · 2 line types (160.5 ft) · 1 alternate: Break room (1 ea · 48.5 ft)');

    const alt = out.payload.items.filter(i => i.alternate === true).map(i => i.description + ' ' + i.quantity);
    expect(alt).toEqual(['WC 1', '2" PVC 48.5']);
    expect(out.payload.items.filter(i => 'alternate' in i && i.alternate !== true)).toEqual([]);
    expect(out.payload.items.map(i => i.group)).toEqual(['Restroom A', 'Restroom A', null, 'Break room', 'Break room']);

    expect(out.email).toContain('Base: 5 counts · 112.00 ft. Alternate Break room adds 1 count · 48.50 ft.');
    expect(out.email.indexOf('--- Alternate: Break room ---')).toBeGreaterThan(out.email.indexOf('--- Untagged ---'));

    // The assign buttons carry the mark; switching the alternate off deletes the key.
    await page.evaluate(() => { window.__assignItem = { group: null }; window.App.openGroupAssignModal(window.__assignItem); });
    await page.waitForSelector('#groupAssignModal.visible', { timeout: 5000 });
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('#groupAssignButtons .group-assign-btn')).map(b => b.textContent))).toEqual(['None', 'Restroom A', 'Break room · ALT']);
    await page.locator('#groupAssignCancel').click();
    await page.evaluate(() => window.App.openGroupModal(window.state.groups[1]));
    await page.waitForSelector('#groupModal.visible', { timeout: 5000 });
    await page.locator('#groupModalAlternateBtn').click();
    await page.locator('#groupModalDone').click();
    await page.waitForFunction(() => !document.getElementById('groupModal')?.classList.contains('visible'), null, { timeout: 5000 });
    expect(await page.evaluate(() => 'alternate' in window.state.groups[1])).toBe(false);
    expect(await page.evaluate(() => window.getPipeToolingSummary())).not.toContain('--- Alternate');

    expect(errors).toEqual([]);
  });

  // ALT-GROUPS rung 2 (2026-09-30): the alternate's own water sizing rides under
  // "--- Alternate: <name> · Water sizing ---" after the whole-plan block, in the
  // /Tooling text and the email; the Copied detail counts its runs.
  test('the alternate\'s water sizing rides under its own heading', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('config.local.js')) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/app/');
    await page.waitForFunction(() => !window.App || window.App.bootSettled === true, null, { timeout: 30000 });
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    await page.evaluate(() => {
      const s = window.state, App = window.App;
      s.groups = [{ id: 'g-base', name: 'Restroom A', color: '#4a9eff' }, { id: 'g-alt', name: 'Break room', color: '#e8c547', alternate: true }];
      s.counters.push({ id: 'c-wc', name: 'WC', icon: 'M0 0h10v10H0z', color: '#e8c547', wsfu: 5 });
      s.lineTypes.push({ id: 'lt-cold', name: '1" copper cold', color: '#4a9eff', curveStyle: 'straight', waterSide: 'cold' });
      s.pages[0].scale = { pixelsPerUnit: 24, unit: 'ft' };
      const ann = App.ensureActiveCanvas(s.pages[0]).annotations;
      ann.counterMarkers = ann.counterMarkers || {};
      ann.counterMarkers['c-wc'] = [
        { x: 100, y: 52, id: 'm1', group: 'g-base' }, { x: 300, y: 52, id: 'm2', group: 'g-base' },
        { x: 100, y: 152, id: 'm3', group: 'g-alt' },
      ];
      ann.quickLines = [
        { id: 'q1', x1: 0, y1: 50, x2: 2400, y2: 50, lineTypeId: 'lt-cold', color: '#4a9eff', group: 'g-base' },   // 100 ft, the base main
        { id: 'q2', x1: 0, y1: 150, x2: 480, y2: 150, lineTypeId: 'lt-cold', color: '#4a9eff', group: 'g-alt' },   // 20 ft, the alternate's branch
      ];
      App.updateUI();
    });

    const out = await page.evaluate(() => ({
      pipe: window.getPipeToolingSummary(),
      detail: window.formatToolingExportSummary(window.summarizeToolingExport(window.getPipeToolingSummary())),
      email: window.getEmailTextSummary(),
    }));
    const lines = out.pipe.split('\n');
    const whole = lines.indexOf('--- Water sizing ---');
    const altWater = lines.indexOf('--- Alternate: Break room · Water sizing ---');
    expect(whole).toBeGreaterThan(0);
    expect(altWater).toBeGreaterThan(whole);
    expect(lines[altWater - 1]).toBe('');
    // The whole-plan block sizes both runs; the alternate's block sizes only its own.
    // A block runs from its heading to the next blank line; its run rows are the lines that
    // are neither a side total, the "Sized at" foot, nor a "Not reached" note.
    const runsIn = (from) => {
      const rest = lines.slice(from + 1);
      const end = rest.indexOf('');
      return (end === -1 ? rest : rest.slice(0, end)).filter((l) => !/^(Cold|Hot) water total\t|^Sized at |^Not reached/.test(l));
    };
    expect(runsIn(whole).length).toBe(2);
    expect(runsIn(altWater).length).toBe(1);
    expect(out.detail).toContain('water sizing (2 runs');
    expect(out.detail).toMatch(/1 alternate: Break room \(1 ea · 20 ft · 1 water run\)/);
    expect(out.email.indexOf('--- Alternate: Break room · Water sizing ---')).toBeGreaterThan(out.email.indexOf('--- Water sizing ---'));

    expect(errors).toEqual([]);
  });
});
