// @ts-check
/**
 * Codes & jurisdiction (rulebook slice 4): Project Settings carries which editions
 * the rulebook resolves against (per trade) and the jurisdiction whose amendments
 * apply. Guards: the rows show the defaults; a change lands on state.codes, marks
 * the project dirty, and is remembered as the device default for the next bid;
 * the choices ride hydrate and the local backup; the rule popover's "This project"
 * line names the edition and jurisdiction and warns when the rule was not checked
 * against that edition or the project follows another code family; Bid Check's
 * footer says what the rows resolve for and opens Project Settings.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function load(page) {
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-page.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 15000 });
  await page.evaluate(() => window.App.rulesReady());
}

test.describe('Codes & jurisdiction', () => {
  test('defaults, a change, dirty, the device default, and the popover project line', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });
    await load(page);
    expect(await page.evaluate(() => window.App.getProjectCodes())).toEqual({ plumbing: 'IPC 2021', electrical: 'NEC 2023', hvac: 'SMACNA 2020', jurisdiction: '' });
    expect(await page.evaluate(() => window.state.codes)).toBe(null);
    await page.click('#settingsGearBtn');
    await expect(page.locator('#settingsModal')).toHaveClass(/visible/);
    expect(await page.locator('#settingsCodePlumbing').inputValue()).toBe('IPC 2021');
    expect(await page.locator('#settingsCodeElectrical').inputValue()).toBe('NEC 2023');
    expect(await page.locator('#settingsCodeHvac').inputValue()).toBe('SMACNA 2020');
    expect(await page.locator('#settingsJurisdiction').inputValue()).toBe('');
    // a change: state, dirty, remembered
    await page.evaluate(() => { window.App.setAutoSaveDirty(false); });
    await page.locator('#settingsCodePlumbing').selectOption('IPC 2024');
    await page.locator('#settingsJurisdiction').fill('Texas · Austin');
    await page.locator('#settingsJurisdiction').press('Enter');
    expect(await page.evaluate(() => window.state.codes)).toEqual({ plumbing: 'IPC 2024', jurisdiction: 'Texas · Austin' });
    expect(await page.evaluate(() => window.App.getAutoSaveDirty())).toBe(true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('codesDefault')))).toEqual({ plumbing: 'IPC 2024', jurisdiction: 'Texas · Austin' });
    await page.evaluate(() => window.App.hideModal('settingsModal'));
    // the popover: not checked against IPC 2024 (the PEX rule was checked against 2018 · 2021)
    await page.evaluate(() => window.App.openRulePopover('plumb.hanger.pex', document.body));
    let text = (await page.locator('#rulePopover').textContent()) || '';
    expect(text).toContain('This project');
    expect(text).toContain('IPC 2024 · Texas · Austin');
    expect(text).toContain('not checked against IPC 2024');
    expect(text).toContain('no state or local amendment on file for Texas · Austin');
    await page.keyboard.press('Escape');
    // another code family: cited from the IPC, the project follows the UPC
    await page.evaluate(() => window.App.setProjectCodes({ plumbing: 'UPC 2021' }));
    await page.evaluate(() => window.App.openRulePopover('plumb.hanger.pex', document.body));
    text = (await page.locator('#rulePopover').textContent()) || '';
    expect(text).toContain('cited from the IPC — this project follows UPC 2021');
    await page.keyboard.press('Escape');
    // an electrical rule is untouched by the plumbing choice
    await page.evaluate(() => window.App.openRulePopover('elec.conduit.fill-limit', document.body));
    text = (await page.locator('#rulePopover').textContent()) || '';
    expect(text).toContain('NEC 2023 · Texas · Austin');
    expect(text).not.toContain('not checked');
    await page.keyboard.press('Escape');
    // Bid Check's footer says what the rows resolve for and opens Project Settings
    await page.evaluate(() => { window.state.trade = 'plumbing'; window.state.bidCheckCollapsed = false; window.App.updateUI(); });
    expect(await page.locator('#bidCheckList .bid-check-codes').textContent()).toContain('Rules resolve for UPC 2021 · Texas · Austin');
    await page.click('#bidCheckCodesLink');
    await expect(page.locator('#settingsModal')).toHaveClass(/visible/);
    expect(await page.locator('#settingsCodePlumbing').inputValue()).toBe('UPC 2021');
    await page.evaluate(() => window.App.hideModal('settingsModal'));
    // the device default survives a fresh project: state.codes null, the resolved codes carry the last choice
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => window.state.codes)).toBe(null);
    expect(await page.evaluate(() => window.App.getProjectCodes())).toEqual({ plumbing: 'UPC 2021', electrical: 'NEC 2023', hvac: 'SMACNA 2020', jurisdiction: 'Texas · Austin' });
    expect(errors).toEqual([]);
  });

  test('the choices ride hydrate, the local backup, and the export data; an old save without them resolves to the defaults', async ({ page }) => {
    await load(page);
    await page.evaluate(() => localStorage.removeItem('codesDefault'));
    // hydrate from project data
    await page.evaluate(() => window.App.hydrateStateFromProjectData({ counters: [], lineTypes: [], groups: [], codes: { plumbing: 'IPC 2018', hvac: 'SMACNA 2005', jurisdiction: 'Ohio', electrical: 7 } }));
    expect(await page.evaluate(() => window.state.codes)).toEqual({ plumbing: 'IPC 2018', hvac: 'SMACNA 2005', jurisdiction: 'Ohio' });
    expect(await page.evaluate(() => window.App.getProjectCodes())).toEqual({ plumbing: 'IPC 2018', electrical: 'NEC 2023', hvac: 'SMACNA 2005', jurisdiction: 'Ohio' });
    // an old save carries no codes → null → defaults
    await page.evaluate(() => window.App.hydrateStateFromProjectData({ counters: [], lineTypes: [], groups: [] }));
    expect(await page.evaluate(() => window.state.codes)).toBe(null);
    expect(await page.evaluate(() => window.App.getProjectCodes().plumbing)).toBe('IPC 2021');
    // the takeoff backup shape
    await page.evaluate(() => window.App.applyTakeoffBackupToState({ counters: [], lineTypes: [], codes: { electrical: 'NEC 2020' } }));
    expect(await page.evaluate(() => window.state.codes)).toEqual({ electrical: 'NEC 2020' });
    // canvas JSON import (features/import-clear.js) restores the same shape
    await page.evaluate(() => window.App.hydrateStateFromProjectData({ counters: [], lineTypes: [], groups: [], codes: { plumbing: 'UPC 2024' } }));
    expect(await page.evaluate(() => window.state.codes)).toEqual({ plumbing: 'UPC 2024' });
  });
});
