// @ts-check
/**
 * Tests: the window.App registry pilot #2 - the Note modal extracted to
 * features/note.js still wires up and runs add / edit / cancel correctly.
 *
 * Guards the registry failure modes (entry point never registered; binding
 * fires before the registry is populated) plus the modal's three branches:
 * add a note, edit its text, and cancel without mutating state. Reads the
 * active-canvas notes back through the published window.App.ensureActiveCanvas.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('window.App registry pilot - Note modal', () => {
  test('registry wired; add / edit / cancel behave with no errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => { errors.push(err.message); });

    await page.goto('/app/');
    await page.waitForLoadState('networkidle');

    // 1. Upload a 2-page PDF.
    await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });

    // 2. Registry contract: app.js published the entry point + the new deps.
    const wired = await page.evaluate(() => ({
      open: typeof window.App?.openNoteModal,
      ensureCanvas: typeof window.App?.ensureActiveCanvas,
      colorModal: typeof window.App?.showLineColorModal,
    }));
    expect(wired.open).toBe('function');
    expect(wired.ensureCanvas).toBe('function');
    expect(wired.colorModal).toBe('function');

    const noteCount = () => page.evaluate(() => {
      const p = window.state.pages[window.state.currentPage];
      const notes = window.App.ensureActiveCanvas(p).annotations.notes;
      return notes ? notes.length : 0;
    });
    const firstNoteText = () => page.evaluate(() => {
      const p = window.state.pages[window.state.currentPage];
      const notes = window.App.ensureActiveCanvas(p).annotations.notes;
      return notes && notes[0] ? notes[0].text : null;
    });

    expect(await noteCount()).toBe(0);

    // 3. ADD path: open via the registry, type, Done -> one note persisted.
    await page.evaluate(() => window.App.openNoteModal('add', '', { x: 200, y: 200 }));
    await page.waitForSelector('#noteModal.visible', { timeout: 5000 });
    await page.fill('#noteModalText', 'Note A');
    await page.locator('#noteModalDone').click();
    await page.waitForFunction(
      () => !document.getElementById('noteModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    expect(await noteCount()).toBe(1);
    expect(await firstNoteText()).toBe('Note A');

    // 4. EDIT path: reopen on the existing note object, change text, Done.
    await page.evaluate(() => {
      const p = window.state.pages[window.state.currentPage];
      const notes = window.App.ensureActiveCanvas(p).annotations.notes;
      window.App.openNoteModal('edit', notes[0].text, notes[0]);
    });
    await page.waitForSelector('#noteModal.visible', { timeout: 5000 });
    await page.fill('#noteModalText', 'Note A edited');
    await page.locator('#noteModalDone').click();
    await page.waitForFunction(
      () => !document.getElementById('noteModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    expect(await noteCount()).toBe(1);
    expect(await firstNoteText()).toBe('Note A edited');

    // 5. CANCEL path: open add, Cancel -> no new note, pending/editing cleared.
    await page.evaluate(() => window.App.openNoteModal('add', '', { x: 300, y: 300 }));
    await page.waitForSelector('#noteModal.visible', { timeout: 5000 });
    await page.locator('#noteModalCancel').click();
    await page.waitForFunction(
      () => !document.getElementById('noteModal')?.classList.contains('visible'),
      { timeout: 5000 },
    );
    const cleared = await page.evaluate(() => ({
      pendingNote: window.state.pendingNote,
      editingNote: window.state.editingNote,
      pendingNoteColor: window.state.pendingNoteColor,
    }));
    expect(cleared.pendingNote).toBeNull();
    expect(cleared.editingNote).toBeNull();
    expect(cleared.pendingNoteColor).toBeNull();
    expect(await noteCount()).toBe(1);

    expect(errors).toEqual([]);
  });
});
