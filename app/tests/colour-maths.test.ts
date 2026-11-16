import { describe, expect, it } from 'vitest';
import data from '../src/data/colour-quiz.json';
import { BASICS } from '../src/colour-chooser';
import { hexToHsv, hsvToHex, isHex, normaliseHex } from '../src/colour-maths';

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const trueWinter = data.seasons.find((s) => s.id === 'true-winter')!.palette.map((h) => h.toLowerCase());

// HSV is held as whole numbers (the sliders step by one), so a round trip can move a channel by a step or two.
// The chooser never round-trips a colour it is given: a typed code, tile or favourite is applied as that exact hex.
const ROUND_TRIP_TOLERANCE = 3;

describe('hsvToHex', () => {
  it('gives the primaries, black, white and grey', () => {
    expect(hsvToHex(0, 100, 100)).toBe('#ff0000');
    expect(hsvToHex(120, 100, 100)).toBe('#00ff00');
    expect(hsvToHex(240, 100, 100)).toBe('#0000ff');
    expect(hsvToHex(0, 0, 100)).toBe('#ffffff');
    expect(hsvToHex(200, 50, 0)).toBe('#000000');
    expect(hsvToHex(77, 0, 50)).toBe('#808080');
  });
  it('always returns a lower-case six-digit hex over the whole slider range', () => {
    for (let h = 0; h < 360; h += 7) for (let s = 0; s <= 100; s += 10) for (let v = 0; v <= 100; v += 10) expect(hsvToHex(h, s, v)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('hexToHsv', () => {
  it('reads known colours', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 100, v: 100 });
    expect(hexToHsv('#00ff00')).toEqual({ h: 120, s: 100, v: 100 });
    expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 100 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv('#1e2959')).toEqual({ h: 229, s: 66, v: 35 });
  });
  it('keeps the hue inside 0 to 359', () => {
    expect(hexToHsv('#ff0001').h).toBe(0); // 359.8 degrees rounds to 360, which wraps to 0
    for (const hex of ['#ff0001', '#fe0002', '#ff00fe']) expect(hexToHsv(hex).h).toBeLessThanOrEqual(359);
  });
});

describe('round trips', () => {
  it('lists the six Basics from the ticket', () => {
    expect(BASICS.map((b) => b.hex)).toEqual(['#ffffff', '#f2ede3', '#c8b89a', '#8c8c8c', '#1a1a1a', '#5b4636']);
  });
  for (const [name, list] of [
    ['the Basics', BASICS.map((b) => b.hex)],
    ['the True Winter palette', trueWinter],
  ] as const) {
    it(`hex to HSV to hex stays within ${ROUND_TRIP_TOLERANCE} per channel for ${name}`, () => {
      for (const hex of list) {
        expect(isHex(hex)).toBe(true);
        const { h, s, v } = hexToHsv(hex);
        const back = hsvToHex(h, s, v);
        const worst = Math.max(...channels(hex).map((c, i) => Math.abs(c - channels(back)[i])));
        expect(worst, `${hex} came back as ${back}`).toBeLessThanOrEqual(ROUND_TRIP_TOLERANCE);
      }
    });
  }
  it('greys and the extremes come back exactly', () => {
    for (const hex of ['#ffffff', '#000000', '#8c8c8c', '#1a1a1a']) {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    }
  });
});

describe('normaliseHex', () => {
  it('accepts a code with or without the # and any case', () => {
    expect(normaliseHex('1E2959')).toBe('#1e2959');
    expect(normaliseHex(' #1E2959 ')).toBe('#1e2959');
  });
  it('rejects anything that is not six hex digits', () => {
    for (const bad of ['', '#', '#fff', '12345', '#12345g', '#1234567']) expect(normaliseHex(bad)).toBeNull();
  });
});
