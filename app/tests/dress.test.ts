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
