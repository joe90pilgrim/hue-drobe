// V3.1-06: the blazer, an outer layer in a slot of its own. Joe's decision (24 Nov 2026): worn with anything, so the layering rules leave it alone.
import { describe, expect, it } from 'vitest';
import { GARMENTS, OUTER_MESHES, OUTER_OPTION, OUTER_SLOT, cleanItems, keepLayers, newItem, parseUnderFiles } from '../src/wardrobe';
import { autoOutfitName, cleanOutfits, newOutfit, resolveOutfit } from '../src/outfits';
import { flatLayOf, silhouetteKey, SHAPES } from '../src/silhouettes';

describe('the blazer in the wardrobe', () => {
  it('is two pack garments (a man\'s and a woman\'s) in the Outer slot, both offered as "Blazer"', () => {
    expect([...OUTER_MESHES]).toEqual(['blazer_male', 'blazer_female']);
    for (const g of OUTER_MESHES) expect(GARMENTS[g as keyof typeof GARMENTS]).toMatchObject({ slot: OUTER_SLOT, option: OUTER_OPTION });
    const item = newItem('blazer_female', '#1f2a44', 1000);
    expect(item).toMatchObject({ v: 2, garment: 'blazer_female', colour: '#1f2a44' });
    expect(cleanItems([item])).toEqual([item]);
  });

  it('is never changed by the layering rules, with any top, bottom, dress or tights', () => {
    const combos: Record<string, string>[] = [
      { Top: 'T-shirt', Bottom: 'Trousers' },
      { Top: 'Sweatshirt', Bottom: 'Shorts' },
      { Top: 'Shirt, mid sleeves', Bottom: 'Skirt' },
      { Dress: 'Shift dress' },
      { Top: 'None', Bottom: 'Shorts', Legs: 'Tights' },
      { Top: 'None', Bottom: 'None' },
    ];
    for (const c of combos) {
      const o = { ...c, [OUTER_SLOT]: OUTER_OPTION };
      expect(keepLayers(o)[OUTER_SLOT]).toBe(OUTER_OPTION);
      for (const changed of Object.keys(o)) expect(keepLayers(o, changed)[OUTER_SLOT]).toBe(OUTER_OPTION);
    }
    const alone = { [OUTER_SLOT]: OUTER_OPTION, Top: 'T-shirt', Bottom: 'Trousers' };
    expect(keepLayers(alone)).toBe(alone);
  });

  it('reads the blazer\'s inner files from the manifest, as for any outer garment', () => {
    const files = parseUnderFiles({ garments: { inner_layers_drawn: { blazer_male: { tee: 'tee_under_blazer_male.glb', trousers: 'trousers_under_blazer_male.glb' } } } });
    expect(files).toEqual({ blazer_male: { tee: 'tee_under_blazer_male.glb', trousers: 'trousers_under_blazer_male.glb' } });
  });
});

describe('a blazer in an outfit', () => {
  const blazer = newItem('blazer_male', '#1f2a44', 1);
  const top = newItem('tee', '#2e5e8c', 2);
  const bottom = newItem('trousers', '#8a5a3c', 3);

  it('saves, reads back, and is named with the blazer after the top', () => {
    const o = newOutfit({ top, bottom, outer: blazer }, 5);
    expect(o.outer).toBe(blazer.id);
    expect(autoOutfitName({ top, bottom, outer: blazer })).toBe('Blue tee, Navy blazer, Brown trousers');
    expect(cleanOutfits([o])).toEqual([o]);
    expect(resolveOutfit(o, [blazer, top, bottom]).outer).toEqual(blazer);
    expect(resolveOutfit(o, [top, bottom]).outer).toBeUndefined(); // a deleted blazer shows as empty
  });

  it('loads an old outfit with no blazer unchanged, and gives it no `outer` key', () => {
    const old = { v: 1, id: 'a', name: 'Old', top: top.id, bottom: bottom.id, savedAt: 9 };
    const [o] = cleanOutfits([old]);
    expect(o).toEqual(old);
    expect(o).not.toHaveProperty('outer');
  });

  it('keeps an outfit that is only a blazer', () => {
    const o = newOutfit({ outer: blazer }, 5);
    expect(cleanOutfits([o])).toHaveLength(1);
  });
});

describe('the blazer\'s flat-lay icon', () => {
  it('has a shape for both blazers, and stands in for the top in a saved outfit', () => {
    expect(silhouetteKey('blazer_male')).toBe('blazer');
    expect(silhouetteKey('blazer_female')).toBe('blazer');
    expect(SHAPES.blazer.body).toBeTruthy();
    const blazer = newItem('blazer_male', '#1f2a44', 1);
    const top = newItem('tee', '#2e5e8c', 2);
    const o = newOutfit({ top, outer: blazer }, 5);
    const svg = flatLayOf(o, resolveOutfit(o, [blazer, top]));
    expect(svg).toContain('data-shape="blazer"');
    expect(svg).not.toContain('data-shape="tee"');
  });
});
