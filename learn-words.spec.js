// @ts-check
/**
 * The Words search at the top of Learn (features/learn-words.js, LEARN-WORDS): a box over
 * the Learn guide's glossary, /guides/words.json. Guards: a query shows its matches in
 * place of the menu, best first; emptied (the ×, Esc, or a reopened Learn) the menu is
 * back; a word that is not there says so and points at the guide; Esc empties the box
 * before it closes Learn; typing a hotkey letter in the box arms no tool.
 */
const { test, expect } = require('@playwright/test');
const { collectConsoleErrors } = require('./spec-helpers');

test.describe('Learn: the Words search', () => {
  test('a query shows the glossary\'s matches in place of the menu; emptied, the menu is back', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/app/?learn=1');
    await expect(page.locator('#learnModal')).toHaveClass(/visible/, { timeout: 10000 });
    const input = page.locator('#learnWordsInput'), results = page.locator('#learnWordsResults');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('');
    await expect(results).toBeHidden();
    await expect(page.locator('#learnList .learn-row').first()).toBeVisible();

    // the term itself first, then the entries whose meaning uses it
    await input.click();
    await page.keyboard.type('title block');
    await expect(results.locator('.learn-word').first().locator('.learn-word-term')).toHaveText('Title block');
    await expect(results.locator('.learn-word').first().locator('.learn-word-text')).toContainText('The box at the edge of a sheet');
    await expect(results.locator('.learn-word').first().locator('.learn-word-group')).toHaveText('The set and the sheet');
    await expect(page.locator('#learnList')).toBeHidden();
    await expect(page.locator('#learnTour-plumbing')).toBeHidden();
    await expect(page.locator('#learnCourseList-plumbing')).toBeHidden();
    // typing letters that are hotkeys (T, L, C, B) in the box armed no tool and left Learn open
    expect(await page.evaluate(() => window.state.tool === window.App.TOOL.NONE)).toBe(true);
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);

    // a broad query: the count, the first twelve
    await input.fill('a');
    await expect(results.locator('.learn-words-count')).toContainText('the first 12 shown');
    await expect(results.locator('.learn-word')).toHaveCount(12);

    // a word that is not there says so, and points at the guide
    await input.fill('zzzz');
    await expect(results.locator('.learn-words-note')).toContainText('No word matches “zzzz”');
    await expect(results.locator('.learn-words-note a')).toHaveAttribute('href', '/guides/learning-the-app/');
    await expect(results.locator('.learn-word')).toHaveCount(0);

    // the × empties it and the menu is back
    await page.click('#learnWordsClear');
    await expect(input).toHaveValue('');
    await expect(results).toBeHidden();
    await expect(page.locator('#learnList .learn-row').first()).toBeVisible();
    await expect(page.locator('#learnTour-plumbing')).toBeVisible();

    // Esc empties a box that holds a query first, and only then closes Learn
    await input.fill('riser');
    await expect(results.locator('.learn-word').first().locator('.learn-word-term')).toContainText('Riser');
    await input.press('Escape');
    await expect(input).toHaveValue('');
    await expect(page.locator('#learnModal')).toHaveClass(/visible/);
    await input.press('Escape');
    await expect(page.locator('#learnModal')).not.toHaveClass(/visible/);

    // a query left in the box is gone when Learn opens again
    await page.evaluate(() => window.App.openLearnMenu());
    await input.fill('bid');
    await expect(results.locator('.learn-word').first().locator('.learn-word-term')).toHaveText('Bid');
    await page.click('#learnModal [data-modal-close]');
    await page.evaluate(() => window.App.openLearnMenu());
    await expect(input).toHaveValue('');
    await expect(results).toBeHidden();
    await expect(page.locator('#learnList .learn-row').first()).toBeVisible();
    // a lesson still starts from its row after a search
    await page.click('#learnList .learn-row[data-lesson="counting"]');
    expect(await page.evaluate(() => window.App.tutorialId())).toBe('lesson:counting');
    errors.assertNoErrors();
  });

  test('the word list that cannot be loaded says so and points at the guide', async ({ page }) => {
    await page.route('**/guides/words.json', (route) => route.abort());
    await page.goto('/app/?learn=1');
    await expect(page.locator('#learnModal')).toHaveClass(/visible/, { timeout: 10000 });
    await page.locator('#learnWordsInput').fill('scale');
    await expect(page.locator('#learnWordsResults .learn-words-note')).toContainText('could not be loaded');
    await expect(page.locator('#learnWordsResults .learn-words-note a')).toHaveAttribute('href', '/guides/learning-the-app/');
  });
});
