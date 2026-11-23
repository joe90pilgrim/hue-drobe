// V5-01: the shoes slot. Four shoes in a slot of their own; a saved item's colour is a tint, white meaning as made; an outfit has an optional `shoes`.
import { describe, expect, it } from 'vitest';
import { GARMENTS, SHOES_AS_MADE, SHOES_SLOT, SHOE_MESHES, autoName, bodyWithShoe, cleanItems, ensureItem, isShoe, keepLayers, newItem } from '../src/wardrobe';
import { autoOutfitName, cleanOutfits, newOutfit, resolveOutfit } from '../src/outfits';
import { silhouetteKey, SHAPES } from '../src/silhouettes';

describe('shoes in the wardrobe', () => {
  it('has four shoes, all in the Shoes slot, and no other garment is a shoe', () => {
    const shoes = (Object.keys(GARMENTS) as (keyof typeof GARMENTS)[]).filter((g) => isShoe(g));
    expect(shoes.sort()).toEqual(['ankle_boots', 'oxfords', 'sandals', 'trainers']);
    for (const s of shoes) expect(GARMENTS[s].slot).toBe(SHOES_SLOT);
    expect(isShoe('tee')).toBe(false);
    expect(isShoe('cape')).toBe(false);
  });

  it('names a shoe as made without a colour, and a tinted one with it', () => {
    expect(autoName('trainers', SHOES_AS_MADE)).toBe('Trainers');
    expect(autoName('ankle_boots', '#FFFFFF')).toBe('Ankle boots');
    expect(autoName('sandals', '#2e5e8c')).toBe('Blue sandals');
  });

  it('keeps a saved shoe, with its tint, through cleaning, and saves each tint once', () => {
    const item = newItem('oxfords', '#8a5a3c', 1000);
    expect(item).toMatchObject({ v: 2, garment: 'oxfords', colour: '#8a5a3c' });
    expect(item).not.toHaveProperty('neckline');
    expect(item).not.toHaveProperty('sheer');
    expect(cleanItems([item])).toEqual([item]);
    const once = ensureItem([], 'oxfords', '#8a5a3c', 1000);
    const twice = ensureItem(once.list, 'oxfords', '#8a5a3c', 2000);
    expect(twice.list).toHaveLength(1);
    expect(ensureItem(once.list, 'oxfords', SHOES_AS_MADE, 3000).list).toHaveLength(2);
  });

  it('is not touched by the layering rules', () => {
    const o = { Top: 'T-shirt', Bottom: 'Trousers', Shoes: 'Trainers' };
    expect(keepLayers(o)).toBe(o);
    expect(keepLayers({ Dress: 'Shift dress', Shoes: 'Sandals' }, 'Dress')).toEqual({ Dress: 'Shift dress', Shoes: 'Sandals' });
  });

  it('names the body files: one per shoe, and one per shoe with the dress', () => {
    expect(bodyWithShoe('trainers')).toBe('body_trainers');
    expect(bodyWithShoe('trainers', true)).toBe('body_dress_trainers');
    expect(SHOE_MESHES).toHaveLength(12);
    expect(new Set(SHOE_MESHES).size).toBe(12);
  });
});

describe('shoes in an outfit', () => {
  const shoes = newItem('trainers', SHOES_AS_MADE, 1);
  const top = newItem('tee', '#2e5e8c', 2);

  it('saves and reads back the shoes, and names the outfit with them', () => {
    const o = newOutfit({ top, shoes }, 5);
    expect(o.shoes).toBe(shoes.id);
    expect(autoOutfitName({ top, shoes })).toBe('Blue tee, Trainers');
    expect(cleanOutfits([o])).toEqual([o]);
    expect(resolveOutfit(o, [shoes, top]).shoes).toEqual(shoes);
  });

  it('keeps an outfit that is only shoes, and a deleted pair shows as empty', () => {
    const o = newOutfit({ shoes }, 5);
    expect(cleanOutfits([o])).toHaveLength(1);
    expect(resolveOutfit(o, []).shoes).toBeUndefined();
  });

  it('loads an older outfit with no shoes, unchanged', () => {
    const old = { v: 1, id: 'a', name: 'Old', top: 't', bottom: 'b', savedAt: 9 };
    const [o] = cleanOutfits([old]);
    expect(o).toEqual(old);
    expect(o).not.toHaveProperty('shoes');
  });
});

describe('shoes drawn flat', () => {
  it('give each shoe a shape of its own', () => {
    const keys = (['trainers', 'oxfords', 'sandals', 'ankle_boots'] as const).map((g) => silhouetteKey(g));
    expect(new Set(keys).size).toBe(4);
    for (const k of keys) {
      expect(k).not.toBe('generic');
      expect(SHAPES[k]).toBeDefined();
    }
  });
});
