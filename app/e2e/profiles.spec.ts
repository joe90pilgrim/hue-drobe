import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { card, seedStore, signInAs, wardrobeTab } from './helpers';

// V2-06: each person sees only their own data and avatar. The server says who is signed in through /api/me; here the tests answer it.
// Service workers are blocked so every request reaches the page's routes and is seen here.
test.use({ serviceWorkers: 'block' });

const quiz = JSON.parse(readFileSync(new URL('../src/data/colour-quiz.json', import.meta.url), 'utf8'));
const FINISHED_QUIZ = {
  answers: Object.fromEntries(quiz.questions.map((q: { id: string; answers: { id: string }[] }) => [q.id, q.answers[0].id])),
  finishedAt: '2026-11-01T00:00:00.000Z',
};
const item = (id: string, name: string, colour: string) => ({ v: 2, id, garment: 'tee', neckline: 'crew', colour, name, savedAt: 1000 });

const seasonHeading = (page: Page) => page.locator('h2.season');
const takeQuiz = (page: Page) => page.getByRole('button', { name: 'Take the quiz' });

test("Joe's data from before profiles is moved to him, and stays after a reload", async ({ page }) => {
  await page.goto('/#/wardrobe');
  await seedStore(page, { wardrobe: [item('old-1', 'Old tee', '#336699')], colourQuiz: FINISHED_QUIZ }, 'huedrobe');
  await page.reload();
  await expect(card(page, 'Old tee')).toBeVisible();
  await page.getByRole('link', { name: 'My colours' }).click();
  await expect(seasonHeading(page)).toBeVisible();

  await page.reload();
  await expect(seasonHeading(page)).toBeVisible();
  // The old database is marked as moved, not deleted.
  const moved = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.open('huedrobe', 1);
        r.onsuccess = () => {
          const q = r.result.transaction('kv').objectStore('kv').get('__movedTo');
          q.onsuccess = () => resolve(q.result);
        };
      }),
  );
  expect(moved).toBe('joe');
});

test("B does not get the data from before profiles, and it waits for Joe", async ({ page }) => {
  await signInAs(page, 'b');
  await page.goto('/#/wardrobe');
  await seedStore(page, { wardrobe: [item('old-1', 'Old tee', '#336699')] }, 'huedrobe');
  await page.reload();
  await expect(wardrobeTab(page, 'Clothes')).toHaveText('Clothes · 0');

  await signInAs(page, 'joe');
  await page.reload();
  await expect(card(page, 'Old tee')).toBeVisible();
});

test('Joe and B each see only their own clothes and quiz result, and their own avatar', async ({ page }) => {
  await page.goto('/#/wardrobe');
  await seedStore(page, { wardrobe: [item('j-1', 'Joe tee', '#112233')], colourQuiz: FINISHED_QUIZ });
  await seedStore(page, { wardrobe: [item('b-1', 'B tee', '#aa3355')] }, 'huedrobe-b');

  // Joe.
  await page.reload();
  await expect(card(page, 'Joe tee')).toBeVisible();
  await expect(card(page, 'B tee')).toHaveCount(0);
  await page.getByRole('link', { name: 'My colours' }).click();
  await expect(seasonHeading(page)).toBeVisible();

  // B on the same device: her clothes, no quiz result yet, her avatar pack.
  await signInAs(page, 'b');
  await page.goto('about:blank'); // leave Joe's page, so none of its requests are counted
  const packs: string[] = [];
  page.on('request', (r) => r.url().includes('/pack/') && packs.push(new URL(r.url()).pathname));
  await page.goto('/#/try-on');
  await expect.poll(() => packs.some((p) => p.startsWith('/pack/b/'))).toBe(true);
  expect(packs.filter((p) => !p.startsWith('/pack/b/'))).toEqual([]);
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(card(page, 'B tee')).toBeVisible();
  await expect(card(page, 'Joe tee')).toHaveCount(0);
  await page.getByRole('link', { name: 'My colours' }).click();
  await expect(takeQuiz(page)).toBeVisible();

  // Back to Joe: nothing of B's came with him.
  await signInAs(page, 'joe');
  await page.reload();
  await expect(seasonHeading(page)).toBeVisible();
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(card(page, 'Joe tee')).toBeVisible();
  await expect(card(page, 'B tee')).toHaveCount(0);
});

test('offline, the app opens as the person last signed in on this device', async ({ page }) => {
  await signInAs(page, 'b');
  await page.goto('/#/wardrobe');
  await seedStore(page, { wardrobe: [item('b-1', 'B tee', '#aa3355')] }, 'huedrobe-b');
  await page.reload();
  await expect(card(page, 'B tee')).toBeVisible();

  await signInAs(page, null);
  await page.reload();
  await expect(card(page, 'B tee')).toBeVisible();
});

test('with no answer from the server and no one remembered, the app says so and loads no one', async ({ page }) => {
  await signInAs(page, null);
  await page.goto('/#/wardrobe');
  await expect(page.getByRole('alert')).toHaveText('Could not tell who is signed in. Connect to the internet and reload.');
  await expect(page.locator('.w-card')).toHaveCount(0);
});
