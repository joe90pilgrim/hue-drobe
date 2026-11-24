import { expect, test } from '@playwright/test';
import { closeSlot, garment, openSlot, signInAs } from './helpers';

// V3.1-06: the blazer, an outer layer. Each person's pack has only their own sex's blazer. While it is worn the tee and the trousers are drawn as the
// pack's `_under_blazer_*` files, and in full again when it comes off. The placeholder pack has stub blazers; the manifest is stubbed to list the under files.
test.use({ serviceWorkers: 'block' });

for (const [person, mesh] of [['joe', 'blazer_male'], ['b', 'blazer_female']] as const) {
  test(`${person} wears the blazer: the tee and trousers swap to their _under_ files, and come back when it comes off`, async ({ page }) => {
    await page.route('**/pack/*/manifest.json', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ garments: { inner_layers_drawn: { [mesh]: { tee: `tee_under_${mesh}.glb`, trousers: `trousers_under_${mesh}.glb` } } } }),
      }),
    );
    await signInAs(page, person);
    await page.goto('/#/try-on');
    await expect(page.locator('.stage-status')).not.toHaveText('Getting your avatar ready…');
    const stage = page.locator('.stage');
    await expect(page.locator('[data-slot="Outer"]')).toHaveText('Nothing');
    await expect(stage).not.toHaveAttribute('data-under', /_under_blazer/);
    await openSlot(page, 'Outer');
    await garment(page, 'Blazer').click();
    await expect(page.locator('[data-slot="Outer"]')).toHaveText('Blazer');
    await expect(stage).toHaveAttribute('data-under', new RegExp(`tee_under_${mesh}`));
    await expect(stage).toHaveAttribute('data-under', new RegExp(`trousers_under_${mesh}`));
    await garment(page, 'Nothing').click();
    await expect(page.locator('[data-slot="Outer"]')).toHaveText('Nothing');
    await expect(stage).not.toHaveAttribute('data-under', /_under_blazer/); // the full tee and trousers are back
    await closeSlot(page);
  });
}
