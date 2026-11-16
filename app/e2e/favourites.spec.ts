import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { chooseButton, chooserBack, closeSlot, setColour, expectColour, favourite, favouriteTiles, openSlot } from './helpers';

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

  await expect(mainToggles.first()).toHaveText('Saved');

  await page.getByRole('link', { name: 'Try on' }).click();

  await openSlot(page, 'Top');
  const tile = favouriteTiles(page).getByRole('button', { name: hex });
  await expect(tile).toBeVisible();
  await expect(favouriteTiles(page).locator('.palette-dot')).toHaveCount(1); // marked as from the palette
  await expect(page.getByText('From your colour palette')).toBeVisible();
  await tile.click();
  await expectColour(page, hex);
  await expect(favourite(page)).toHaveAttribute('aria-pressed', 'true');
  await closeSlot(page);
  await openSlot(page, 'Bottom');
  await expectColour(page, '#d6d6d6');

  await page.reload();

  await openSlot(page, 'Top');
  await expectColour(page, hex);
  await expect(favouriteTiles(page).getByRole('button', { name: hex })).toHaveClass(/\bon\b/);
});

test('saves a picked colour as a favourite, shows it in every slot, and removes it by turning Favourite off', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await expect(favourite(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('From your colour palette')).toBeHidden(); // no palette colours yet
  await setColour(page, '#2e5e8c');
  await favourite(page).click();
  await expect(favourite(page)).toHaveAttribute('aria-pressed', 'true');
  await setColour(page, '#aa5500');
  await expect(favourite(page)).toHaveAttribute('aria-pressed', 'false'); // a different colour is not a favourite yet
  await favourite(page).click();

  await page.reload();

  await openSlot(page, 'Top');
  await expect(favouriteTiles(page).getByRole('button', { name: '#2e5e8c' })).toBeVisible();
  await expect(favouriteTiles(page).getByRole('button', { name: '#aa5500' })).toBeVisible();
  await closeSlot(page);
  await openSlot(page, 'Bottom');
  await favouriteTiles(page).getByRole('button', { name: '#2e5e8c' }).click();
  await expectColour(page, '#2e5e8c');
  await expect(favourite(page)).toHaveAttribute('aria-pressed', 'true');
  await favourite(page).click();
  await expect(favouriteTiles(page).getByRole('button', { name: '#2e5e8c' })).toHaveCount(0);
  await closeSlot(page);

  await openSlot(page, 'Top');
  await expect(favouriteTiles(page).getByRole('button', { name: '#2e5e8c' })).toHaveCount(0);
  await expect(favouriteTiles(page).getByRole('button', { name: '#aa5500' })).toBeVisible();
  await expectColour(page, '#aa5500');
});

test('shows the first 12 favourites and Show all for the rest', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  const tiles = favouriteTiles(page);
  await chooseButton(page).click(); // stay in the chooser: its Favourite toggle is the same one
  for (let i = 1; i <= 13; i++) {
    await page.getByLabel('Colour code').fill(`#0a0${i.toString(16)}00`);
    await page.locator('.chooser').getByRole('button', { name: 'Favourite', exact: true }).click();
  }
  await chooserBack(page).click();
  await expect(tiles.locator('[data-hex]')).toHaveCount(12);
  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(tiles.locator('[data-hex]')).toHaveCount(13);
  await page.getByRole('button', { name: 'Show fewer' }).click();
  await expect(tiles.locator('[data-hex]')).toHaveCount(12);
});

test('after turning off the only favourite, Favourite still saves a new one', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await setColour(page, '#2e5e8c');
  await favourite(page).click();
  await expect(favouriteTiles(page).getByRole('button', { name: '#2e5e8c' })).toBeVisible();
  await favourite(page).click();
  await expect(favouriteTiles(page).getByRole('button', { name: '#2e5e8c' })).toHaveCount(0);
  await expect(favourite(page)).toBeEnabled();
  await favourite(page).click();
  await expect(favouriteTiles(page).getByRole('button', { name: '#2e5e8c' })).toBeVisible();
  await expect(favourite(page)).toHaveAttribute('aria-pressed', 'true');
});
