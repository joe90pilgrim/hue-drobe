// V3-06: a dress takes off the top and the bottom, and a top or a bottom takes off the dress.
import { describe, expect, it } from 'vitest';
import { DRESS_SLOT, keepLayers } from '../src/wardrobe';

describe('dress layering', () => {
  it('uses the Dress slot', () => {
    expect(DRESS_SLOT).toBe('Dress');
  });

  it('takes off the top and the bottom when put on', () => {
    expect(keepLayers({ Top: 'T-shirt', Bottom: 'Skirt', Dress: 'Shift dress' }, 'Dress')).toEqual({ Top: 'None', Bottom: 'None', Dress: 'Shift dress' });
    expect(keepLayers({ Top: 'Sweatshirt', Bottom: 'Trousers', Dress: 'Shift dress' }, 'Dress')).toEqual({ Top: 'None', Bottom: 'None', Dress: 'Shift dress' });
  });

  it('goes when a top or a bottom is put on', () => {
    expect(keepLayers({ Top: 'T-shirt', Dress: 'Shift dress' }, 'Top')).toEqual({ Top: 'T-shirt', Dress: 'None' });
    expect(keepLayers({ Bottom: 'Skirt', Dress: 'Shift dress' }, 'Bottom')).toEqual({ Bottom: 'Skirt', Dress: 'None' });
  });

  it('wins when no slot is named', () => {
    expect(keepLayers({ Top: 'T-shirt', Bottom: 'Shorts', Dress: 'Shift dress' })).toEqual({ Top: 'None', Bottom: 'None', Dress: 'Shift dress' });
  });

  it('leaves an outfit with no dress, or an empty one, as it was', () => {
    const o = { Top: 'T-shirt', Bottom: 'Skirt' };
    expect(keepLayers(o)).toBe(o);
    expect(keepLayers({ Top: 'None', Bottom: 'None', Dress: 'Shift dress' }, 'Dress')).toEqual({ Top: 'None', Bottom: 'None', Dress: 'Shift dress' });
    expect(keepLayers({ Top: 'T-shirt', Dress: 'None' }, 'Top')).toEqual({ Top: 'T-shirt', Dress: 'None' });
  });

  it('keeps the tights, and still applies the older rules', () => {
    expect(keepLayers({ Top: 'T-shirt', Bottom: 'Shorts', Legs: 'Tights', Dress: 'Shift dress' }, 'Dress')).toEqual({ Top: 'None', Bottom: 'None', Legs: 'Tights', Dress: 'Shift dress' });
    expect(keepLayers({ Bottom: 'Trousers', Legs: 'Tights' }, 'Legs')).toEqual({ Bottom: 'None', Legs: 'Tights' });
  });
});

describe('dress in the wardrobe and in outfits (V3-02)', () => {
  it('is a garment in the Dress slot, saved by colour', async () => {
    const { GARMENTS, newItem, itemKind } = await import('../src/wardrobe');
    expect(GARMENTS.dress).toEqual({ label: 'dress', slot: 'Dress', option: 'Shift dress' });
    const item = newItem('dress', '#2e5e8c', 1);
    expect(item.name).toBe('Blue dress');
    expect(itemKind(item)).toBe('Shift dress');
  });

  it('is kept by a saved outfit, and put on with the top and bottom off', async () => {
    const { cleanOutfits, newOutfit, resolveOutfit } = await import('../src/outfits');
    const { newItem } = await import('../src/wardrobe');
    const dress = newItem('dress', '#8c2e3a', 1);
    const tights = newItem('tights', '#222222', 2);
    const o = newOutfit({ dress, legs: tights }, 3);
    expect(o.dress).toBe(dress.id);
    expect(cleanOutfits([o])[0].dress).toBe(dress.id);
    expect(resolveOutfit(o, [dress, tights]).dress).toBe(dress);
    expect(cleanOutfits([{ ...o, legs: undefined, dress: undefined }])).toEqual([]);
  });
});
