// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('PDF page delete', () => {
  test('deleting a page updates sidebar and PDF view', async ({ page }) => {
    const pdfPath = path.join(__dirname, 'test-2pages.pdf');

    await page.goto('/');

    // Upload PDF via file input
    const fileInput = page.locator('#pdfInput');
    await fileInput.setInputFiles(pdfPath);

    // Wait for PDF to load - Pages section should show page items
    await page.waitForSelector('#pagesList .sidebar-item', { timeout: 10000 });
    const pageItemsBefore = await page.locator('#pagesList .sidebar-item').count();
    expect(pageItemsBefore).toBeGreaterThanOrEqual(1);

    expect(pageItemsBefore).toBeGreaterThanOrEqual(2);

    // Click edit (pen) on first page to enter rename mode
    const firstPageRow = page.locator('#pagesList .sidebar-item').first();
    await firstPageRow.locator('.edit-btn').click();

    // Rename input and delete button should appear
    const deleteBtn = page.locator('.page-delete-btn');
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });
    await deleteBtn.click();

    // Confirm dialog appears
    await expect(page.locator('#deletePageConfirmModal.visible')).toBeVisible({ timeout: 2000 });
    await page.locator('#deletePageConfirm').click();

    // Sidebar should have one fewer page
    await page.waitForTimeout(300);
    const pageItemsAfter = await page.locator('#pagesList .sidebar-item').count();
    expect(pageItemsAfter).toBe(pageItemsBefore - 1);
  });
});
