// V3-03: the collared shirt in three sleeve lengths, untucked. Each length is a garment of its own in the Top slot.
import { describe, expect, it } from 'vitest';
import { GARMENTS, autoName, cleanItems, isTucked, isUntuckedTop, itemKind, keepLayers, meshName, meshesOf, newItem } from '../src/wardrobe';
import { newOutfit, resolveOutfit } from '../src/outfits';

const SHIRTS = ['shirt_short', 'shirt_mid', 'shirt_long'] as const;

describe('shirts', () => {
  it('are tops, one garment per sleeve length, each with its own pack mesh', () => {
    for (const g of SHIRTS) {
      expect(GARMENTS[g].slot).toBe('Top');
      expect(meshesOf(g)).toEqual([g]);
      expect(meshName(g, 'v', true)).toBe(g); // only the tee has necklines and a tucked version
    }
    expect(GARMENTS.shirt_long.option).toBe('Shirt, long sleeves');
    expect(new Set(SHIRTS.map((g) => GARMENTS[g].option)).size).toBe(3);
  });

  it('are named by colour and sleeve length, with no neckline or sheerness', () => {
    expect(autoName('shirt_short', '#1f2a5a')).toBe('Navy short-sleeve shirt');
    expect(autoName('shirt_mid', '#f2f2f2')).toBe('White mid-sleeve shirt');
    expect(autoName('shirt_long', '#2e5e8c')).toBe('Blue long-sleeve shirt');
    const i = newItem('shirt_long', '#2E5E8C', 1);
    expect(i).toEqual({ v: 2, id: i.id, garment: 'shirt_long', colour: '#2e5e8c', name: 'Blue long-sleeve shirt', savedAt: 1 });
    expect(itemKind(i)).toBe('Shirt, long sleeves');
  });

  it('load from storage like any other garment, and an unknown sleeve length is dropped', () => {
    const out = cleanItems([
      { v: 2, id: 'a', garment: 'shirt_mid', colour: '#1F2A5A', savedAt: 1 },
      { v: 2, id: 'b', garment: 'shirt_three_quarter', colour: '#1F2A5A', savedAt: 2 },
    ]);
    expect(out).toEqual([{ v: 2, id: 'a', garment: 'shirt_mid', colour: '#1f2a5a', name: 'Navy mid-sleeve shirt', savedAt: 1 }]);
  });

  it('are never tucked in, and never go with a skirt: whichever was put on last stays', () => {
    for (const g of SHIRTS) {
      const top = GARMENTS[g].option;
      expect(isUntuckedTop(top)).toBe(true);
      expect(isTucked({ Top: top, Bottom: 'Skirt' })).toBe(false);
      expect(keepLayers({ Top: top, Bottom: 'Skirt' }, 'Bottom')).toEqual({ Top: 'None', Bottom: 'Skirt' });
      expect(keepLayers({ Top: top, Bottom: 'Skirt' }, 'Top')).toEqual({ Top: top, Bottom: 'None' });
      for (const bottom of ['Trousers', 'Shorts', 'None']) expect(keepLayers({ Top: top, Bottom: bottom })).toEqual({ Top: top, Bottom: bottom });
    }
    expect(isUntuckedTop('Sweatshirt')).toBe(true);
    expect(isUntuckedTop('T-shirt')).toBe(false);
    expect(isUntuckedTop(undefined)).toBe(false);
  });

  it('give way to a dress, like any top', () => {
    expect(keepLayers({ Top: GARMENTS.shirt_short.option, Bottom: 'Trousers', Dress: 'Shift dress' }, 'Dress')).toEqual({ Top: 'None', Bottom: 'None', Dress: 'Shift dress' });
  });

  it('are kept in outfits, with their own saved colour', () => {
    const shirt = newItem('shirt_mid', '#2e5e8c', 1);
    const trousers = newItem('trousers', '#1f2a5a', 2);
    const o = newOutfit({ top: shirt, bottom: trousers }, 3);
    expect(o.name).toBe('Blue mid-sleeve shirt, Navy trousers');
    expect(resolveOutfit(o, [shirt, trousers]).top).toBe(shirt);
  });
});
