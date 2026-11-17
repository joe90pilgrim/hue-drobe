// V3-01b: the skirt, a bottom for women's packs, with the tee tucked into it and no sweatshirt.
import { describe, expect, it } from 'vitest';
import { GARMENTS, autoName, cleanItems, isTucked, itemKind, keepLayers, meshName, meshesOf, newItem } from '../src/wardrobe';
import { newOutfit, resolveOutfit } from '../src/outfits';

describe('skirt', () => {
  it('is a bottom, named by colour, with no neckline or sheerness', () => {
    expect(GARMENTS.skirt).toEqual({ label: 'skirt', slot: 'Bottom', option: 'Skirt' });
    expect(autoName('skirt', '#1f2a5a')).toBe('Navy skirt');
    expect(itemKind(newItem('skirt', '#1f2a5a', 1))).toBe('Skirt');
    expect(newItem('skirt', '#1f2a5a', 1)).not.toHaveProperty('neckline');
    expect(newItem('skirt', '#1f2a5a', 1)).not.toHaveProperty('sheer');
    expect(meshesOf('skirt')).toEqual(['skirt']);
    expect(meshName('skirt', 'v', true)).toBe('skirt');
  });

  it('loads from storage like any other garment', () => {
    const out = cleanItems([{ v: 2, id: 'a', garment: 'skirt', colour: '#1F2A5A', savedAt: 1 }]);
    expect(out).toEqual([{ v: 2, id: 'a', garment: 'skirt', colour: '#1f2a5a', name: 'Navy skirt', savedAt: 1 }]);
  });

  it('shows the tucked-in tee, in its neckline, only while a tee is worn over the skirt', () => {
    expect(isTucked({ Top: 'T-shirt', Bottom: 'Skirt' })).toBe(true);
    expect(isTucked({ Top: 'T-shirt', Bottom: 'Trousers' })).toBe(false);
    expect(isTucked({ Top: 'None', Bottom: 'Skirt' })).toBe(false);
    expect(isTucked({ Top: 'Sweatshirt', Bottom: 'Skirt' })).toBe(false);
    expect(meshName('tee', 'crew', true)).toBe('tee_tucked');
    expect(meshName('tee', 'v', true)).toBe('tee_v_tucked');
    expect(meshName('tee', 'scoop', true)).toBe('tee_scoop_tucked');
    expect(meshName('tee', 'v')).toBe('tee_v');
    expect(meshName('sweatshirt', 'v', true)).toBe('sweatshirt'); // only the tee has a tucked version
    expect(meshesOf('tee', true)).toEqual(['tee_tucked', 'tee_v_tucked', 'tee_scoop_tucked']);
  });

  it('never go with a sweatshirt: whichever was put on last stays', () => {
    expect(keepLayers({ Top: 'T-shirt', Bottom: 'Skirt' })).toEqual({ Top: 'T-shirt', Bottom: 'Skirt' });
    expect(keepLayers({ Top: 'Sweatshirt', Bottom: 'Skirt' }, 'Bottom')).toEqual({ Top: 'None', Bottom: 'Skirt' });
    expect(keepLayers({ Top: 'Sweatshirt', Bottom: 'Skirt' }, 'Top')).toEqual({ Top: 'Sweatshirt', Bottom: 'None' });
    expect(keepLayers({ Top: 'Sweatshirt', Bottom: 'Skirt' })).toEqual({ Top: 'Sweatshirt', Bottom: 'None' });
  });

  it('go with tights, and the tights rule still holds beside the skirt rule', () => {
    expect(keepLayers({ Top: 'T-shirt', Bottom: 'Skirt', Legs: 'Tights' })).toEqual({ Top: 'T-shirt', Bottom: 'Skirt', Legs: 'Tights' });
    expect(keepLayers({ Top: 'T-shirt', Bottom: 'Trousers', Legs: 'Tights' }, 'Legs')).toEqual({ Top: 'T-shirt', Bottom: 'None', Legs: 'Tights' });
  });

  it('are kept in outfits', () => {
    const tee = newItem('tee', '#f2f2f2', 1);
    const skirt = newItem('skirt', '#1f2a5a', 2);
    const o = newOutfit({ top: tee, bottom: skirt }, 3);
    expect(o.name).toBe('White tee, Navy skirt');
    expect(resolveOutfit(o, [tee, skirt]).bottom).toBe(skirt);
  });
});
