// V5-02: the hat slot. A cap and a beanie, in a slot of their own, for both people; plain colour; an outfit has an optional `hat`.
import { describe, expect, it } from 'vitest';
import { GARMENTS, HAT_MESHES, HAT_SLOT, autoName, cleanItems, ensureItem, isHat, isShoe, keepLayers, newItem } from '../src/wardrobe';
import { autoOutfitName, cleanOutfits, newOutfit, resolveOutfit } from '../src/outfits';
import { silhouetteKey, SHAPES } from '../src/silhouettes';

describe('hats in the wardrobe', () => {
  it('has a cap and a beanie, both in the Hat slot, and no other garment is a hat', () => {
    const hats = (Object.keys(GARMENTS) as (keyof typeof GARMENTS)[]).filter((g) => isHat(g));
    expect(hats.sort()).toEqual(['beanie', 'cap']);
    for (const h of hats) expect(GARMENTS[h].slot).toBe(HAT_SLOT);
    expect([...HAT_MESHES].sort()).toEqual(['beanie', 'cap']);
    expect(isHat('tee')).toBe(false);
    expect(isHat('trainers')).toBe(false);
    expect(isShoe('cap')).toBe(false);
  });

  it('names a hat from its colour, and saves each colour once', () => {
    expect(autoName('cap', '#1f2a44')).toMatch(/ cap$/);
    expect(autoName('beanie', '#2e5e8c')).toBe('Blue beanie');
    const item = newItem('beanie', '#8a5a3c', 1000);
    expect(item).toMatchObject({ v: 2, garment: 'beanie', colour: '#8a5a3c' });
    expect(item).not.toHaveProperty('neckline');
    expect(cleanItems([item])).toEqual([item]);
    const once = ensureItem([], 'beanie', '#8a5a3c', 1000);
    expect(ensureItem(once.list, 'beanie', '#8a5a3c', 2000).list).toHaveLength(1);
    expect(ensureItem(once.list, 'beanie', '#2e5e8c', 3000).list).toHaveLength(2);
  });

  it('is not touched by the layering rules', () => {
    const o = { Hat: 'Cap', Top: 'T-shirt', Bottom: 'Trousers' };
    expect(keepLayers(o)).toBe(o);
    expect(keepLayers({ Dress: 'Shift dress', Hat: 'Beanie' }, 'Dress')).toEqual({ Dress: 'Shift dress', Hat: 'Beanie' });
  });
});

describe('a hat in an outfit', () => {
  const hat = newItem('cap', '#1f2a44', 1);
  const top = newItem('tee', '#2e5e8c', 2);

  it('saves and reads back the hat, and names the outfit with it', () => {
    const o = newOutfit({ top, hat }, 5);
    expect(o.hat).toBe(hat.id);
    expect(autoOutfitName({ top, hat })).toBe('Navy cap, Blue tee');
    expect(cleanOutfits([o])).toEqual([o]);
    expect(resolveOutfit(o, [hat, top]).hat).toEqual(hat);
  });

  it('keeps an outfit that is only a hat, and a deleted hat shows as empty', () => {
    const o = newOutfit({ hat }, 5);
    expect(cleanOutfits([o])).toHaveLength(1);
    expect(resolveOutfit(o, []).hat).toBeUndefined();
  });

  it('loads an older outfit with no hat, unchanged', () => {
    const old = { v: 1, id: 'a', name: 'Old', top: 't', bottom: 'b', savedAt: 9 };
    const [o] = cleanOutfits([old]);
    expect(o).toEqual(old);
    expect(o).not.toHaveProperty('hat');
  });
});

describe('hats drawn flat', () => {
  it('give the cap and the beanie a shape each', () => {
    expect(silhouetteKey('cap')).toBe('cap');
    expect(silhouetteKey('beanie')).toBe('beanie');
    for (const k of ['cap', 'beanie']) expect(SHAPES[k]).toBeDefined();
  });
});
