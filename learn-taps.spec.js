// @ts-check
/**
 * The glossed words as tap targets on the cards (features/learn-taps.js, LEARN-TAPS).
 * Guards: a word an earlier card explained wears the underline on a later card, once, and
 * never on a control's label; a tap shows its entry from the guide's glossary under the
 * card's text; a second tap, the ×, or the next card closes it; the card that uses a word
 * first underlines nothing for it; a card's plain text is unchanged; with no word list the
 * cards read as they always did.
 */
const { test, expect } = require('@playwright/test');
const { collectConsoleErrors } = require('./spec-helpers');

async function openLesson(page, id, step) {
  await page.goto('/app/?lesson=' + id);
  await page.waitForFunction(() => window.App && window.App.tutorialStepId && window.App.tutorialStepId() === 'sheets', null, { timeout: 15000 });
  await page.evaluate(() => window.App.tutorialDoStep());
  await page.waitForFunction(() => window.App.tutorialStepId() !== 'sheets', null, { timeout: 30000 });
  await page.evaluate((s) => window.App.tutorialGoTo(s), step);
  await page.waitForFunction((s) => window.App.tutorialStepId() === s, step);
}
const words = (page) => page.evaluate(() => [...document.querySelectorAll('#tourBody .tour-word')].map((w) => [w.getAttribute('data-word'), w.textContent]));

test.describe('Learn: tap a word on a card', () => {
  test('a word an earlier card explained is underlined; a tap shows its glossary entry, and it closes three ways', async ({ page }) => {
    test.setTimeout(90000);
    const errors = collectConsoleErrors(page);
    await openLesson(page, 'measuring', 'read');
    await page.waitForFunction(() => document.querySelectorAll('#tourBody .tour-word').length > 0, null, { timeout: 10000 });
    const shown = await words(page);
    expect(shown.length).toBeLessThanOrEqual(4);
    expect(new Set(shown.map((w) => w[0])).size).toBe(shown.length);          // once a card
    expect(shown.map((w) => w[0])).toContain('Elbow');                         // glossed on the bends card, two cards back
    // never inside a control's label or a link, and the card reads as it did
    expect(await page.evaluate(() => document.querySelectorAll('#tourBody .tour-ui .tour-word, #tourBody a .tour-word').length)).toBe(0);
    expect(await page.evaluate(() => { const b = document.getElementById('tourBody'); const c = b.cloneNode(true); c.querySelectorAll('.tour-word').forEach((w) => w.replaceWith(w.textContent)); c.normalize(); return c.textContent === b.textContent; })).toBe(true);

    const entry = page.locator('#tourWord');
    await expect(entry).toBeHidden();
    const elbow = page.locator('#tourBody .tour-word[data-word="Elbow"]');
    await elbow.click();
    await expect(entry).toBeVisible();
    await expect(entry.locator('.tour-word-term')).toHaveText('Elbow.');
    const meaning = await page.evaluate(() => window.App.learnWordGroups().flatMap((g) => g.words).find((w) => w.term === 'Elbow').text);
    await expect(entry).toContainText(meaning);
    // the word is still there a tick later (the body is only rewritten when it changes), and the card is on screen
    await page.waitForTimeout(900);
    await expect(entry).toBeVisible();
    const box = await page.locator('#tourCard').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
    // 1. a second tap closes it
    await elbow.click();
    await expect(entry).toBeHidden();
    // 2. the keyboard opens it, the × closes it
    await elbow.focus();
    await page.keyboard.press('Enter');
    await expect(entry).toBeVisible();
    await page.click('#tourWordClose');
    await expect(entry).toBeHidden();
    // 3. the next card closes it
    await elbow.click();
    await expect(entry).toBeVisible();
    await page.evaluate(() => window.App.tutorialGoTo('done'));
    await expect(entry).toBeHidden();
    // leaving the lesson with an entry open closes it too
    await page.waitForFunction(() => document.querySelectorAll('#tourBody .tour-word').length > 0);
    await page.locator('#tourBody .tour-word').first().click();
    await expect(entry).toBeVisible();
    await page.click('#tourLeave');
    await expect(entry).toBeHidden();
    errors.assertNoErrors();
  });

  test('the card that uses a word first underlines nothing for it, and a run\'s first card underlines nothing at all', async ({ page }) => {
    test.setTimeout(90000);
    const errors = collectConsoleErrors(page);
    // Start here is the first lesson of the run: its open card is the run's first card
    await page.goto('/app/?lesson=start');
    await page.waitForFunction(() => window.App && window.App.tutorialStepId && window.App.tutorialStepId() === 'sheets', null, { timeout: 15000 });
    await page.waitForFunction(() => !!window.App.learnWordGroups());
    await page.waitForTimeout(600);
    expect(await words(page)).toEqual([]);
    // Measuring's opening card is where the lessons first say elbow (its intro glosses it):
    // not underlined there, underlined on the bends card after it
    await page.goto('/app/?lesson=measuring');
    await page.waitForFunction(() => window.App && window.App.tutorialStepId && window.App.tutorialStepId() === 'sheets', null, { timeout: 15000 });
    await page.waitForFunction(() => !!window.App.learnWordGroups());
    await page.waitForTimeout(600);
    expect(await page.locator('#tourBody').textContent()).toMatch(/elbow/i);
    expect((await words(page)).map((w) => w[0])).not.toContain('Elbow');
    await page.evaluate(() => window.App.tutorialDoStep());
    await page.waitForFunction(() => window.App.tutorialStepId() !== 'sheets', null, { timeout: 30000 });
    await page.evaluate(() => window.App.tutorialGoTo('bends'));
    await page.waitForFunction(() => [...document.querySelectorAll('#tourBody .tour-word')].some((w) => w.getAttribute('data-word') === 'Elbow'), null, { timeout: 10000 });
    // an everyday word is left alone everywhere
    expect((await words(page)).map((w) => w[0].toLowerCase())).not.toContain('run');
    errors.assertNoErrors();
  });

  test('with no word list the cards read as they always did', async ({ page }) => {
    test.setTimeout(90000);
    await page.route('**/guides/words.json', (route) => route.abort());
    await openLesson(page, 'measuring', 'read');
    await page.waitForTimeout(1200);
    expect(await words(page)).toEqual([]);
    await expect(page.locator('#tourBody')).toContainText(/elbow/i);
    await expect(page.locator('#tourWord')).toBeHidden();
  });
});
