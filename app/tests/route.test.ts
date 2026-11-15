import { describe, expect, it } from 'vitest';
import { routeFromHash } from '../src/route';

describe('routeFromHash', () => {
  it('opens the Colour screen for #/colour', () => expect(routeFromHash('#/colour')).toBe('colour'));
  it('opens the Dress screen for #/dress', () => expect(routeFromHash('#/dress')).toBe('dress'));
  it('falls back to Dress for an empty or unknown hash', () => {
    expect(routeFromHash('')).toBe('dress');
    expect(routeFromHash('#/nonsense')).toBe('dress');
  });
});
