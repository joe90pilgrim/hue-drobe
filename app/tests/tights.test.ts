// V2-04: tights, opaque or sheer, worn under shorts and never under trousers.
import { describe, expect, it } from 'vitest';
import { autoName, cleanItems, ensureItem, itemKind, keepLayers, meshesOf, newItem, renameItem } from '../src/wardrobe';
import { autoOutfitName, cleanOutfits, newOutfit, resolveOutfit } from '../src/outfits';
import { buildBackup } from '../src/backup';

describe('tights', () => {
  it('are named and described by colour and sheerness', () => {
    expect(autoName('tights', '#111111')).toBe('Black tights');
    expect(autoName('tights', '#111111', undefined, true)).toBe('Black sheer tights');
    expect(autoName('trousers', '#111111', undefined, true)).toBe('Black trousers'); // only tights are sheer
    expect(itemKind(newItem('tights', '#111111', 1))).toBe('Tights, opaque');
    expect(itemKind(newItem('tights', '#111111', 1, 'crew', true))).toBe('Tights, sheer');
    expect(meshesOf('tights')).toEqual(['tights']);
  });

  it('store sheerness on tights only, and default to opaque', () => {
    expect(newItem('tights', '#111111', 1)).toMatchObject({ v: 2, sheer: false });
    expect(newItem('tights', '#111111', 1)).not.toHaveProperty('neckline');
    expect(newItem('shorts', '#111111', 1, 'crew', true)).not.toHaveProperty('sheer');
  });

  it('save one item per colour and sheerness', () => {
    let r = ensureItem([], 'tights', '#111111', 1, 'crew', false);
    const opaque = r.item;
    r = ensureItem(r.list, 'tights', '#111111', 2, 'crew', true);
    expect(r.list).toHaveLength(2);
    expect(r.item).not.toBe(opaque);
    expect(ensureItem(r.list, 'tights', '#111111', 3, 'crew', false).item).toBe(opaque);
  });

  it('load sheerness from storage, treating anything but true as opaque', () => {
    const out = cleanItems([
      { v: 2, id: 'a', garment: 'tights', colour: '#111111', sheer: true, savedAt: 1 },
      { v: 2, id: 'b', garment: 'tights', colour: '#111111', sheer: 'yes', savedAt: 2 },
      { v: 2, id: 'c', garment: 'shorts', colour: '#111111', sheer: true, savedAt: 3 },
    ]);
    expect(out.map((i) => [i.id, i.sheer, i.name])).toEqual([
      ['a', true, 'Black sheer tights'],
      ['b', false, 'Black tights'],
      ['c', undefined, 'Black shorts'],
    ]);
    expect(renameItem(out, 'a', '  ')[0].name).toBe('Black sheer tights');
  });

  it('never go with trousers: whichever was put on last stays', () => {
    expect(keepLayers({ Top: 'T-shirt', Bottom: 'Shorts', Legs: 'Tights' })).toEqual({ Top: 'T-shirt', Bottom: 'Shorts', Legs: 'Tights' });
    expect(keepLayers({ Bottom: 'Trousers', Legs: 'Tights' }, 'Legs')).toEqual({ Bottom: 'None', Legs: 'Tights' });
    expect(keepLayers({ Bottom: 'Trousers', Legs: 'Tights' }, 'Bottom')).toEqual({ Bottom: 'Trousers', Legs: 'None' });
    expect(keepLayers({ Bottom: 'Trousers', Legs: 'Tights' })).toEqual({ Bottom: 'Trousers', Legs: 'None' });
  });

  it('are kept in outfits, and an outfit of tights alone is kept when loading', () => {
    const tee = newItem('tee', '#1f2a5a', 1);
    const shorts = newItem('shorts', '#1f2a5a', 2);
    const tights = newItem('tights', '#111111', 3, 'crew', true);
    const o = newOutfit({ top: tee, bottom: shorts, legs: tights }, 4);
    expect(o.legs).toBe(tights.id);
    expect(o.name).toBe('Navy tee, Navy shorts, Black sheer tight'); // names stop at 40 characters, as for every outfit
    expect(resolveOutfit(o, [tee, shorts, tights]).legs).toBe(tights);
    expect(newOutfit({ top: tee }, 5)).not.toHaveProperty('legs'); // older two-piece outfits keep their shape
    expect(cleanOutfits([{ v: 1, id: 'x', name: '', legs: tights.id, savedAt: 1 }])).toHaveLength(1);
    expect(autoOutfitName({ legs: tights })).toBe('Black sheer tights');
  });

  it('back up the sheerness setting, and drop a value that is not true or false', () => {
    expect(buildBackup({ sheer: true }).data.sheer).toBe(true);
    expect(buildBackup({ sheer: 'yes' }).data).not.toHaveProperty('sheer');
  });
});
