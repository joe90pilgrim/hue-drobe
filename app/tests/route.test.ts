import { describe, expect, it } from 'vitest';
import { routeFromHash } from '../src/route';

describe('routeFromHash', () => {
  it('opens the three screens by their new links', () => {
    expect(routeFromHash('#/try-on')).toBe('try-on');
    expect(routeFromHash('#/wardrobe')).toBe('wardrobe');
    expect(routeFromHash('#/colours')).toBe('colours');
    expect(routeFromHash('#/packing')).toBe('packing');
  });
  it('still opens the right screen from the old links', () => {
    expect(routeFromHash('#/dress')).toBe('try-on');
    expect(routeFromHash('#/colour')).toBe('colours');
  });
  it('falls back to Try on for an empty or unknown hash', () => {
    expect(routeFromHash('')).toBe('try-on');
    expect(routeFromHash('#/nonsense')).toBe('try-on');
  });
});
