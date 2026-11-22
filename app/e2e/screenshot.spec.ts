import { expect, test, type Page } from '@playwright/test';
import { card, wardrobeTab } from './helpers';

// V4-02: "Add from screenshot". The screenshot is synthetic: 400 x 900 (a tall phone screenshot), white, with a navy "garment" in the
// middle, a red marker at the top and a green marker at the bottom. Only the garment is cropped, so no red or green may be sent.
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Add from screenshot' });

async function makeScreenshot(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 900;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 400, 900);
    g.fillStyle = '#ff0000';
    g.fillRect(20, 20, 160, 100); // a "price" outside the crop
    g.fillStyle = '#1f2a5a';
    g.fillRect(100, 300, 200, 300); // the garment
    g.fillStyle = '#00cc00';
    g.fillRect(20, 780, 160, 100); // another "product" outside the crop
    return c.toDataURL('image/png').split(',')[1];
  });
  return { name: 'shop-page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

/** Drags a box on the crop canvas, given as fractions of its width and height. */
async function drawBox(page: Page, x0: number, y0: number, x1: number, y1: number) {
  const b = (await page.locator('.w-crop canvas').boundingBox())!;
  await page.mouse.move(b.x + b.width * x0, b.y + b.height * y0);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * ((x0 + x1) / 2), b.y + b.height * ((y0 + y1) / 2), { steps: 4 });
  await page.mouse.move(b.x + b.width * x1, b.y + b.height * y1, { steps: 4 });
  await page.mouse.up();
  return b;
}

/** Decodes a request's image and reports its size and whether it holds any strongly red or green pixels, or garment-navy ones. */
const inspect = (page: Page, image: string) =>
  page.evaluate(async (data) => {
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + data;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let red = 0;
    let green = 0;
    let navy = 0;
    for (let i = 0; i < px.length; i += 4) {
      const [r, gr, b] = [px[i], px[i + 1], px[i + 2]];
      if (r > 200 && gr < 70 && b < 70) red++;
      if (gr > 150 && r < 70 && b < 70) green++;
      if (Math.abs(r - 0x1f) < 30 && Math.abs(gr - 0x2a) < 30 && Math.abs(b - 0x5a) < 30) navy++;
    }
    return { w: img.width, h: img.height, red, green, navy };
  }, image);

test('the screenshot is cropped on the device, only the crop is sent, and nothing is kept', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/identify', async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ json: { templateId: 'sweatshirt', variant: null, hexColor: '#1f2a5a', confidence: 0.9 } });
  });
  await page.goto('/#/wardrobe');
  await expect(page.locator('input[data-input="screenshot"]')).not.toHaveAttribute('capture', /.*/); // a file picker, not the camera
  await page.locator('input[data-input="screenshot"]').setInputFiles(await makeScreenshot(page));

  // The crop step opens first, and nothing has been sent.
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText(/Leave out faces, prices and other items\. Never a photo of someone you know/)).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: 'Use this part' })).toBeDisabled();
  expect(bodies).toHaveLength(0);

  // A tap is not a crop.
  const canvas = (await page.locator('.w-crop canvas').boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await expect(sheet(page).getByRole('button', { name: 'Use this part' })).toBeDisabled();

  // Drag a box round the garment (source x 90..310, y 290..610), leaving both markers out.
  await drawBox(page, 90 / 400, 290 / 900, 310 / 400, 610 / 900);
  await expect(page.locator('.w-crop-box')).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Use this part' }).click();
  await expect(sheet(page).getByText(/Looks like navy sweatshirt/)).toBeVisible();

  // The request holds the crop only: its proportions (220 x 320) and none of the marker pixels.
  expect(bodies).toHaveLength(1);
  expect(Object.keys(bodies[0]).sort()).toEqual(['image', 'mimeType', 'templates']);
  const sent = await inspect(page, bodies[0].image as string);
  expect(sent.w / sent.h).toBeGreaterThan((220 / 320) * 0.95);
  expect(sent.w / sent.h).toBeLessThan((220 / 320) * 1.05);
  expect(sent.h).toBeLessThan(400); // nowhere near the 900 px of the whole screenshot
  expect(sent.red).toBe(0);
  expect(sent.green).toBe(0);
  expect(sent.navy).toBeGreaterThan(sent.w * sent.h * 0.3); // the garment is most of the crop

  // The confirm step is the usual one, filled in; save it.
  await expect(page.getByRole('radiogroup', { name: 'Garment' }).getByRole('radio', { name: 'Sweatshirt' })).toHaveAttribute('aria-checked', 'true');
  await expect(sheet(page).locator('.cur-hex')).toHaveText('#1F2A5A');
  await sheet(page).getByRole('button', { name: 'Add to wardrobe' }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(wardrobeTab(page, 'Clothes')).toHaveText('Clothes · 1');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(card(page, 'Navy sweatshirt')).toBeVisible();

  // The saved record holds the garment and colour only: no screenshot, no crop.
  const stored = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open('huedrobe-joe', 1);
        open.onsuccess = () => {
          const get = open.result.transaction('kv').objectStore('kv').get('wardrobe');
          get.onsuccess = () => resolve(get.result);
        };
      }),
  );
  expect(Object.keys((stored as Record<string, unknown>[])[0]).sort()).toEqual(['colour', 'garment', 'id', 'name', 'savedAt', 'v']);
});

test('the box can be moved and resized before it is used', async ({ page }) => {
  await page.route('**/api/identify', (route) => route.fulfill({ json: { templateId: 'tee', variant: 'crew', hexColor: '#1f2a5a', confidence: 0.9 } }));
  await page.goto('/#/wardrobe');
  await page.locator('input[data-input="screenshot"]').setInputFiles(await makeScreenshot(page));
  await expect(sheet(page)).toBeVisible();
  const b = await drawBox(page, 0.1, 0.05, 0.4, 0.2);
  const box = page.locator('.w-crop-box');
  const before = (await box.boundingBox())!;

  // Drag from the middle: the box moves, same size.
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 60, before.y + before.height / 2 + 100, { steps: 4 });
  await page.mouse.up();
  const moved = (await box.boundingBox())!;
  expect(moved.x - before.x).toBeCloseTo(60, 0);
  expect(moved.y - before.y).toBeCloseTo(100, 0);
  expect(moved.width).toBeCloseTo(before.width, 0);

  // Drag the bottom-right corner: the box grows, the top-left stays.
  await page.mouse.move(moved.x + moved.width, moved.y + moved.height);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width + 40, moved.y + moved.height + 50, { steps: 4 });
  await page.mouse.up();
  const grown = (await box.boundingBox())!;
  expect(grown.x).toBeCloseTo(moved.x, 0);
  expect(grown.y).toBeCloseTo(moved.y, 0);
  expect(grown.width).toBeCloseTo(moved.width + 40, 0);
  expect(grown.height).toBeCloseTo(moved.height + 50, 0);
  expect(grown.x + grown.width).toBeLessThanOrEqual(b.x + b.width + 1);

  // Cancel closes it all; nothing was sent or saved.
  await sheet(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(wardrobeTab(page, 'Clothes')).toHaveText('Clothes · 0');
});

test('on a phone the three buttons share one row and the screenshot picker is a plain file picker', async ({ page }) => {
  await page.goto('/#/wardrobe');
  const row = page.locator('.w-photo-row');
  const names = ['Take photo', 'Upload photo', 'Add from screenshot'];
  const boxes = [];
  for (const n of names) boxes.push((await row.getByRole('button', { name: n }).boundingBox())!);
  expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1); // one line
  // Short words on a phone, so the row sits beside the page title and the 4th row of cards stays on screen; the full names stay as the accessible names.
  expect(await row.getByRole('button', { name: 'Add from screenshot' }).evaluate((e) => (e as HTMLElement).innerText)).toBe('Screenshot');
  expect(await row.getByRole('button', { name: 'Upload photo' }).evaluate((e) => (e as HTMLElement).innerText)).toBe('Upload');
  const title = (await page.getByRole('heading', { name: 'Wardrobe' }).boundingBox())!;
  expect(boxes[0].y).toBeLessThan(title.y + title.height); // not wrapped below the title
  expect(boxes[2].x + boxes[2].width).toBeLessThanOrEqual(412 - 8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
  await expect(page.locator('input[data-input="screenshot"]')).toHaveAttribute('accept', 'image/*');
});

test('on a laptop a pasted or dropped screenshot opens the crop step', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#/wardrobe');
  const shot = await makeScreenshot(page);
  const b64 = shot.buffer.toString('base64');

  // Paste, as after Win+Shift+S then Ctrl+V.
  await page.evaluate((data) => {
    const file = new File([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], 'clip.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, b64);
  await expect(sheet(page)).toBeVisible();
  await expect(page.locator('.w-crop canvas')).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet(page)).toBeHidden();

  // Drop a file on the page.
  await page.evaluate((data) => {
    const file = new File([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], 'drop.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    document.body.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64);
  await expect(sheet(page)).toBeVisible();
  await expect(page.locator('.w-crop canvas')).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Cancel' }).click();

  // Text on the clipboard is left alone.
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'hello');
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(sheet(page)).toBeHidden();
});

test('on a laptop the buttons use their full words', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#/wardrobe');
  const row = page.locator('.w-photo-row');
  expect(await row.getByRole('button', { name: 'Add from screenshot' }).evaluate((e) => (e as HTMLElement).innerText)).toBe('Add from screenshot');
  expect(await row.getByRole('button', { name: 'Upload photo' }).evaluate((e) => (e as HTMLElement).innerText)).toBe('Upload photo');
});
