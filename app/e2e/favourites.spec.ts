import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { openRows } from './helpers';

const data = JSON.parse(readFileSync(new URL('../src/data/colour-quiz.json', import.meta.url), 'utf8'));
const QUESTIONS = data.questions.length as number;

/** Takes the quiz, answering every question with its last option, and waits for the result. */
async function takeQuiz(page: Page) {
  await page.goto('/#/colours');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  for (let i = 1; i <= QUESTIONS; i++) {
    await page.getByRole('radio').last().click();
    await page.getByRole('button', { name: i < QUESTIONS ? 'Next' : 'See my result' }).click();
  }
  await expect(page.locator('h2.season')).toBeVisible();
}

test('saves a palette colour from the quiz, applies it to the tee, and keeps it after a reload', async ({ page }) => {
  await takeQuiz(page);
  // The season's own palette; a close second season (V1.1-07) has its own, hidden, inside #close-second-detail.
  const mainToggles = page.locator('.palette:not(#close-second-detail *) .fav-toggle');
  const first = mainToggles.first();
  const hex = (await first.getAttribute('data-fav'))!.toLowerCase();
  await first.click();
  await expect(first).toHaveText('Saved');
  await expect(first).toHaveAttribute('aria-pressed', 'true');

  await page.reload();

  await openRows(page);
  await expect(mainToggles.first()).toHaveText('Saved');

  await page.getByRole('link', { name: 'Try on' }).click();

  await openRows(page);
  const top = page.getByRole('group', { name: 'Top favourite colours' });
  const tile = top.getByRole('button', { name: hex });
  await expect(tile).toBeVisible();
  await expect(top.locator('.palette-dot')).toHaveCount(1); // marked as from the palette
  await tile.click();
  await expect(page.getByLabel('Top colour')).toHaveValue(hex);
  await expect(page.getByLabel('Bottom colour')).toHaveValue('#d6d6d6');

  await page.reload();

  await openRows(page);
  await expect(page.getByLabel('Top colour')).toHaveValue(hex);
  await expect(page.getByRole('group', { name: 'Top favourite colours' }).getByRole('button', { name: hex })).toHaveClass(/\bon\b/);
});

test('saves a picked colour with the star, shows it in every slot, and removes it in edit mode', async ({ page }) => {
  await page.goto('/#/try-on');
  await openRows(page);
  const top = page.getByRole('group', { name: 'Top favourite colours' });
  const bottom = page.getByRole('group', { name: 'Bottom favourite colours' });
  const star = (group: typeof top) => group.getByRole('button', { name: 'Save this colour to favourites' });

  await page.getByLabel('Top colour').fill('#2e5e8c');
  await star(top).click();
  await expect(star(top)).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Top colour').fill('#aa5500');
  await star(top).click();

  await page.reload();

  await openRows(page);
  await expect(top.getByRole('button', { name: '#2e5e8c' })).toBeVisible();
  await expect(top.getByRole('button', { name: '#aa5500' })).toBeVisible();
  await expect(bottom.getByRole('button', { name: '#2e5e8c' })).toBeVisible();

  await bottom.getByRole('button', { name: 'Edit' }).click();
  await bottom.getByRole('button', { name: '#2e5e8c' }).click();
  await bottom.getByRole('button', { name: 'Done' }).click();
  await expect(top.getByRole('button', { name: '#2e5e8c' })).toHaveCount(0);
  await expect(top.getByRole('button', { name: '#aa5500' })).toBeVisible();
  await expect(page.getByLabel('Top colour')).toHaveValue('#aa5500');
});

test('shows the first 12 favourites and a more option for the rest', async ({ page }) => {
  await page.goto('/#/try-on');
  await openRows(page);
  const top = page.getByRole('group', { name: 'Top favourite colours' });
  for (let i = 1; i <= 13; i++) {
    await page.getByLabel('Top colour').fill(`#0a0${i.toString(16).padStart(1, '0')}00`);
    await top.getByRole('button', { name: 'Save this colour to favourites' }).click();
  }
  await expect(top.locator('[data-hex]')).toHaveCount(12);
  await top.getByRole('button', { name: 'More (1)' }).click();
  await expect(top.locator('[data-hex]')).toHaveCount(13);
  await top.getByRole('button', { name: 'Fewer' }).click();
  await expect(top.locator('[data-hex]')).toHaveCount(12);
});

test('after removing the last favourite in edit mode, the star still saves a new one', async ({ page }) => {
  await page.goto('/#/try-on');
  await openRows(page);
  const top = page.getByRole('group', { name: 'Top favourite colours' });
  const star = top.getByRole('button', { name: 'Save this colour to favourites' });

  await page.getByLabel('Top colour').fill('#2e5e8c');
  await star.click();
  await top.getByRole('button', { name: 'Edit' }).click();
  await top.getByRole('button', { name: '#2e5e8c' }).click();
  await expect(top.getByRole('button', { name: '#2e5e8c' })).toHaveCount(0);

  // With no favourites left, Edit is gone, so the star must not be stuck disabled.
  await expect(star).toBeEnabled();
  await star.click();
  await expect(top.getByRole('button', { name: '#2e5e8c' })).toBeVisible();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
});
