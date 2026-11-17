import { describe, expect, it } from 'vitest';
import { keepLayers, layeredOk, necklinesUnder, parseLayerCombos } from '../src/wardrobe';

// V3-05: a tee under a sweatshirt or shirt, offered only for the combinations that passed on this body.
const manifest = { garments: { layers: { combinations: { sweatshirt: ['crew', 'v'], shirt_mid: ['crew', 'v', 'scoop'], shirt_short: [], tee: ['crew'], shirt_long: ['bogus'] } } } };

describe('layer combinations from the pack manifest', () => {
  it('keeps only known mid tops over known necklines', () => {
    expect(parseLayerCombos(manifest)).toEqual({ sweatshirt: ['crew', 'v'], shirt_mid: ['crew', 'v', 'scoop'] });
  });
  it('offers nothing for a pack without the list', () => {
    expect(parseLayerCombos({ garments: {} })).toEqual({});
    expect(parseLayerCombos(null)).toEqual({});
    expect(parseLayerCombos('<html>')).toEqual({});
  });
  it('names the necklines that pass under a top, and none for a tee or nothing', () => {
    const c = parseLayerCombos(manifest);
    expect(necklinesUnder(c, 'Sweatshirt')).toEqual(['crew', 'v']);
    expect(necklinesUnder(c, 'Shirt, short sleeves')).toEqual([]);
    expect(necklinesUnder(c, 'T-shirt')).toEqual([]);
    expect(necklinesUnder(c, undefined)).toEqual([]);
  });
  it('accepts a tee under only a passing combination', () => {
    const c = parseLayerCombos(manifest);
    expect(layeredOk(c, { Top: 'Sweatshirt', Under: 'T-shirt' }, 'v')).toBe(true);
    expect(layeredOk(c, { Top: 'Sweatshirt', Under: 'T-shirt' }, 'scoop')).toBe(false);
    expect(layeredOk(c, { Top: 'Sweatshirt', Under: 'None' }, 'crew')).toBe(false);
    expect(layeredOk(c, { Top: 'Shirt, short sleeves', Under: 'T-shirt' }, 'crew')).toBe(false);
  });
});

describe('the tee under a top in keepLayers', () => {
  it('stays under a sweatshirt or shirt', () => {
    const o = { Top: 'Sweatshirt', Bottom: 'Trousers', Under: 'T-shirt' };
    expect(keepLayers(o)).toBe(o);
  });
  it('goes when the top is not a sweatshirt or shirt, or a dress or skirt takes the top off', () => {
    expect(keepLayers({ Top: 'T-shirt', Under: 'T-shirt' }, 'Top').Under).toBe('None');
    expect(keepLayers({ Top: 'None', Under: 'T-shirt' }, 'Top').Under).toBe('None');
    expect(keepLayers({ Top: 'Sweatshirt', Bottom: 'Skirt', Under: 'T-shirt' }, 'Bottom')).toEqual({ Top: 'None', Bottom: 'Skirt', Under: 'None' });
    expect(keepLayers({ Top: 'Sweatshirt', Dress: 'Shift dress', Under: 'T-shirt' }, 'Dress').Under).toBe('None');
  });
});
