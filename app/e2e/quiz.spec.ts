import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openRows } from './helpers';

const data = JSON.parse(readFileSync(new URL('../src/data/colour-quiz.json', import.meta.url), 'utf8'));
const QUESTIONS = data.questions.length as number;

test('takes the quiz, sees a season with its palette and advice, and keeps it after a reload', async ({ page }) => {
  await page.goto('/#/colours');
  await expect(page.getByRole('heading', { name: 'Find your season' })).toBeVisible();
  await page.getByRole('button', { name: 'Start the quiz' }).click();

  const next = page.getByRole('button', { name: 'Next' });
  await expect(page.getByText(`Question 1 of ${QUESTIONS}`)).toBeVisible();
  await expect(next).toBeDisabled();

  // Answer each question with its last option, and check Back keeps the answer on the way.
  for (let i = 1; i <= QUESTIONS; i++) {
    await expect(page.getByText(`Question ${i} of ${QUESTIONS}`)).toBeVisible();
    await page.getByRole('radio').last().click();
    if (i === 2) {
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(page.getByText(`Question 1 of ${QUESTIONS}`)).toBeVisible();
      await expect(page.getByRole('radio').last()).toHaveAttribute('aria-checked', 'true');
      await next.click();
      await expect(page.getByText(`Question 2 of ${QUESTIONS}`)).toBeVisible();
    }
    if (i < QUESTIONS) await next.click();
    else await page.getByRole('button', { name: 'See my result' }).click();
  }

  const season = page.locator('h2.season');
  await expect(season).toBeVisible();
  const name = (await season.textContent()) ?? '';
  const known = data.seasons.find((s: { name: string }) => s.name === name);
  expect(known, `season "${name}" is in the content`).toBeTruthy();
  // The season's own palette; a close second season (V1.1-07) has its own, hidden, inside #close-second-detail.
  await expect(page.locator('.palette:not(#close-second-detail *) .chip')).toHaveCount(known.palette.length);
  await expect(page.getByRole('heading', { name: 'Colours that flatter you' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Neutrals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Colours to approach with care' })).toBeVisible();

  await page.reload();

  await openRows(page);
  await expect(page.locator('h2.season')).toHaveText(name);

  await page.getByRole('button', { name: 'Retake the quiz' }).click();
  await expect(page.getByText(`Question 1 of ${QUESTIONS}`)).toBeVisible();
  await expect(next).toBeDisabled();
});
