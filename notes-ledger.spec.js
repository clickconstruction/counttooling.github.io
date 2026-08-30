// @ts-check
/**
 * Tests: Notes ledger (features/notes-ledger.js) — numbered pins, the header
 * drawer, filters, jump-to-note, and the RFI lifecycle (resolved + answer).
 * Pins replace plan-space text for RFIs / long notes / notes with a `detail`
 * payload ('auto' mode); short plain notes keep rendering as text. The drawer
 * lists every note across pages, the badge counts open RFIs, and resolving or
 * answering is project data (undo + dirty).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

async function boot(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.locator('#pdfInput').setInputFiles(path.join(__dirname, 'test-2pages.pdf'));
  await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
  await page.evaluate(() => {
    const s = window.state;
    s.currentProjectName = 'Ledger spec';
    s.pages[0].name = 'P200';
    s.pages[0].canvases[0].annotations.notes.push(
      { x: 100, y: 100, id: 'ln1', text: 'RFI: SB-2 in schedule but nowhere in plan view', width: 150, fontSize: 14 },
      { x: 200, y: 120, id: 'ln2', text: '3" typ', width: 150, fontSize: 14 },
      { x: 300, y: 140, id: 'ln3', text: 'East-wing water traced via dash-aware density and follow; per-run registration bars reflect each style dash duty.', width: 150, fontSize: 14 },
    );
    s.pages[1].canvases[0].annotations.notes.push(
      { x: 50, y: 60, id: 'ln4', text: 'short but carries payload', detail: 'long provenance body lives here', width: 150, fontSize: 14 },
    );
    window.App.updateUI();
  });
  return errors;
}

test.describe('Notes ledger', () => {
  test('registry + pin predicate + numbering + badge', async ({ page }) => {
    const errors = await boot(page);

    const r = await page.evaluate(() => {
      const App = window.App;
      const s = window.state;
      const notes0 = s.pages[0].canvases[0].annotations.notes;
      const notes1 = s.pages[1].canvases[0].annotations.notes;
      const rows = App.collectNotesLedger();
      return {
        fns: ['collectNotesLedger', 'isPinNote', 'getNotesPinMap', 'openNotesLedger', 'onNotesLedgerSync'].map((k) => typeof App[k]),
        btn: !!document.getElementById('notesLedgerBtn'),
        drawer: !!document.getElementById('notesLedgerDrawer'),
        kinds: rows.map((x) => x.kind),
        nums: rows.map((x) => x.num),
        pages: rows.map((x) => x.pageIdx),
        pinFlags: [App.isPinNote(notes0[0]), App.isPinNote(notes0[1]), App.isPinNote(notes0[2]), App.isPinNote(notes1[0])],
        mapSize: App.getNotesPinMap() ? App.getNotesPinMap().size : 0,
        badge: document.getElementById('notesLedgerBadge').textContent,
        btnVisible: document.getElementById('notesLedgerBtn').style.display !== 'none',
      };
    });
    expect(r.fns).toEqual(['function', 'function', 'function', 'function', 'function']);
    expect(r.btn && r.drawer).toBe(true);
    expect(r.kinds).toEqual(['rfi', 'note', 'note', 'note']);
    expect(r.nums).toEqual([1, 2, 3, 4]);
    expect(r.pages).toEqual([0, 0, 0, 1]);
    // auto mode: RFI pins, short plain note stays text, long note pins, detail-note pins
    expect(r.pinFlags).toEqual([true, false, true, true]);
    expect(r.mapSize).toBe(3);
    expect(r.badge).toBe('1');
    expect(r.btnVisible).toBe(true);
    expect(errors).toEqual([]);
  });

  test('display modes drive the pin map', async ({ page }) => {
    const errors = await boot(page);
    const r = await page.evaluate(() => {
      const App = window.App;
      const out = {};
      App.setNotesDisplayMode('text');
      out.text = App.getNotesPinMap();
      App.setNotesDisplayMode('pins');
      out.pins = App.getNotesPinMap() ? App.getNotesPinMap().size : 0;
      App.setNotesDisplayMode('auto');
      out.auto = App.getNotesPinMap() ? App.getNotesPinMap().size : 0;
      return out;
    });
    expect(r.text).toBeNull();
    expect(r.pins).toBe(4);
    expect(r.auto).toBe(3);
    expect(errors).toEqual([]);
  });

  test('drawer opens, filters, and jumps to a note on another page', async ({ page }) => {
    const errors = await boot(page);
    await page.evaluate(() => window.App.openNotesLedger());
    await expect(page.locator('#notesLedgerDrawer')).toHaveClass(/open/);
    await expect(page.locator('#notesLedgerDrawer .notes-ledger-row')).toHaveCount(4);

    await page.locator('#notesLedgerDrawer .notes-ledger-filter[data-filter="rfi"]').click();
    await expect(page.locator('#notesLedgerDrawer .notes-ledger-row')).toHaveCount(1);
    await page.locator('#notesLedgerDrawer .notes-ledger-filter[data-filter="all"]').click();

    // Last row lives on page 2 — clicking it must switch pages and center the pan.
    await page.locator('#notesLedgerDrawer .notes-ledger-row').last().click();
    const jumped = await page.evaluate(() => {
      const s = window.state;
      const wrap = document.querySelector('.canvas-wrapper').getBoundingClientRect();
      const drawerW = document.getElementById('notesLedgerDrawer').offsetWidth;
      const note = s.pages[1].canvases[0].annotations.notes[0];
      return {
        page: s.currentPage,
        centeredX: Math.abs((note.x * s.zoom + s.pan.x) - (wrap.width - drawerW) / 2) < 2,
        centeredY: Math.abs((note.y * s.zoom + s.pan.y) - wrap.height / 2) < 2,
      };
    });
    expect(jumped.page).toBe(1);
    expect(jumped.centeredX && jumped.centeredY).toBe(true);
    expect(errors).toEqual([]);
  });

  test('resolve + answer lifecycle marks project data dirty', async ({ page }) => {
    const errors = await boot(page);
    await page.evaluate(() => window.App.openNotesLedger());

    const r = await page.evaluate(() => {
      const App = window.App;
      let dirtyCalls = 0;
      const origDirty = App.markProjectDirty;
      App.markProjectDirty = () => { dirtyCalls += 1; return origDirty(); };
      const out = { dirtyCalls: () => dirtyCalls };

      const row = document.querySelector('#notesLedgerDrawer .notes-ledger-row');
      row.querySelector('.notes-ledger-resolve input').click();
      out.resolvedAfterCheck = !!window.state.pages[0].canvases[0].annotations.notes[0].resolved;
      out.dirtyAfterCheck = dirtyCalls;
      return { resolvedAfterCheck: out.resolvedAfterCheck, dirtyAfterCheck: out.dirtyAfterCheck };
    });
    expect(r.resolvedAfterCheck).toBe(true);
    expect(r.dirtyAfterCheck).toBe(1);

    // Un-resolve, then answer via the inline editor: answer implies resolved.
    await page.locator('#notesLedgerDrawer .notes-ledger-row').first().locator('.notes-ledger-resolve input').click();
    await page.locator('#notesLedgerDrawer .notes-ledger-row').first().locator('.notes-ledger-answer-btn').click();
    await page.locator('#notesLedgerDrawer .notes-ledger-answer-edit textarea').fill('SB-2 was deleted in addendum 2 — exclude it.');
    await page.locator('#notesLedgerDrawer .notes-ledger-answer-edit .save').click();

    const after = await page.evaluate(() => {
      const n = window.state.pages[0].canvases[0].annotations.notes[0];
      return { answer: n.answer, resolved: !!n.resolved, badge: document.getElementById('notesLedgerBadge').style.display };
    });
    expect(after.answer).toContain('addendum 2');
    expect(after.resolved).toBe(true);
    expect(after.badge).toBe('none');   // no open RFIs left
    expect(errors).toEqual([]);
  });

  test('hover chip appears over a pin and names its number', async ({ page }) => {
    const errors = await boot(page);
    // Hover the RFI pin (note ln1 at pdf 100,100 on page 1).
    const target = await page.evaluate(() => {
      const s = window.state;
      const wrap = document.querySelector('.canvas-wrapper').getBoundingClientRect();
      const n = s.pages[0].canvases[0].annotations.notes[0];
      return { x: wrap.left + n.x * s.zoom + s.pan.x, y: wrap.top + n.y * s.zoom + s.pan.y };
    });
    await page.mouse.move(target.x, target.y);
    await expect(page.locator('#notePeekChip')).toBeVisible();
    await expect(page.locator('#notePeekChip .note-chip-num')).toHaveText('1');
    await expect(page.locator('#notePeekChip .note-chip-kind')).toHaveText('RFI');
    // Moving away dismisses it.
    await page.mouse.move(target.x + 300, target.y + 200);
    await expect(page.locator('#notePeekChip')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
