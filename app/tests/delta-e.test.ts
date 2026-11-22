import { describe, expect, it } from 'vitest';
import { deltaE2000, deltaEHex, hexToLab } from '../src/delta-e';

describe('CIEDE2000 colour difference', () => {
  it('matches published test pairs (Sharma, Wu and Dalal, 2005)', () => {
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
    expect(deltaE2000([50, 3.1571, -77.2803], [50, 0, -82.7485])).toBeCloseTo(2.8615, 3);
    expect(deltaE2000([50, 2.5, 0], [50, 0, -2.5])).toBeCloseTo(4.3065, 3);
    expect(deltaE2000([60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387])).toBeCloseTo(1.2644, 3);
    expect(deltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 3);
  });
  it('converts sRGB hex to Lab', () => {
    const [L, a, b] = hexToLab('#ffffff');
    expect(L).toBeCloseTo(100, 1);
    expect(Math.abs(a)).toBeLessThan(0.1);
    expect(Math.abs(b)).toBeLessThan(0.1);
    expect(hexToLab('#000000')[0]).toBeCloseTo(0, 1);
    const [L2, a2, b2] = hexToLab('#ff0000'); // sRGB red
    expect(L2).toBeCloseTo(53.24, 1);
    expect(a2).toBeCloseTo(80.09, 0);
    expect(b2).toBeCloseTo(67.2, 0);
  });
  it('is 0 for the same colour and large for black against white', () => {
    expect(deltaEHex('#2e5e8c', '#2E5E8C')).toBe(0);
    expect(deltaEHex('#000000', '#ffffff')).toBeCloseTo(100, 0);
    expect(deltaEHex('#2e5e8c', '#2f5e8c')).toBeLessThan(1);
  });
  it('rejects a colour that is not hex', () => {
    expect(() => hexToLab('navy')).toThrow();
  });
});
