import { expect, test } from '@playwright/test';

// V1.2-01: look and feel foundations.

test('headings use the self-hosted Bricolage Grotesque, with no request leaving the app', async ({ page }) => {
  const external: string[] = [];
  const fonts: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4199')) external.push(r.url());
    if (r.url().endsWith('.woff2')) fonts.push(r.url());
  });
  await page.goto('/');
  const heading = page.locator('.topbar .wordmark');
  await expect(heading).toBeVisible();
  expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Bricolage Grotesque');
  // The font really loaded (not a fallback), and it came from this origin.
  await expect.poll(() => page.evaluate(() => document.fonts.check('700 18px "Bricolage Grotesque"'))).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].filter((f) => f.family.includes('Bricolage') && f.status === 'loaded').length)).toBeGreaterThan(0);
  expect(fonts.length).toBeGreaterThan(0);
  expect(external).toEqual([]);
});

test('the heading font is served from the app and is cached for offline use', async ({ request }) => {
  for (const w of ['600', '700']) {
    const res = await request.get(`/fonts/bricolage-grotesque-latin-${w}-normal.woff2`);
    expect(res.ok()).toBe(true);
    expect((await res.body()).subarray(0, 4).toString('latin1')).toBe('wOF2');
  }
  const sw = await request.get('/sw.js');
  const text = await sw.text();
  expect(text).toContain('./fonts/bricolage-grotesque-latin-600-normal.woff2');
  expect(text).toContain('./fonts/bricolage-grotesque-latin-700-normal.woff2');
});

test('the avatar stage is exactly #E3E3E3 and no text is under 12 px', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#stage')).toBeVisible();
  expect(await page.locator('#stage').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(227, 227, 227)');

  const small = () =>
    page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || !n.textContent?.trim() || el.closest('script,style')) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 12) out.push(`${el.tagName}.${el.className} ${size}px "${n.textContent.trim().slice(0, 30)}"`);
      }
      return out;
    });
  expect(await small()).toEqual([]);
  await page.getByRole('link', { name: 'My colours' }).click();
  await expect(page.getByRole('heading', { name: 'My colours' })).toBeVisible();
  expect(await small()).toEqual([]);
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('heading', { name: 'Wardrobe', level: 1 })).toBeVisible();
  expect(await small()).toEqual([]);
});
