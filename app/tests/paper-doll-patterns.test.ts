// V9-02: patterns on the 2D paper-doll.
import { describe, expect, it } from 'vitest';
import { paperDollSvg, type DollFigure } from '../src/paper-doll';
import { PATTERN_IDS, isPatternable } from '../src/patterns';
import { ALL_GARMENT_IDS, patternPaint } from '../src/silhouettes';
import { GARMENTS, type GarmentId } from '../src/wardrobe';

const NONE = { Hat: 'None', Outer: 'None', Dress: 'None', Top: 'None', Bottom: 'None', Legs: 'None', Under: 'None', Shoes: 'None' };
/** The outfit that wears one garment, in its own slot (the blazer through the Outer slot). */
const wearing = (g: GarmentId): Record<string, string> => ({ [GARMENTS[g].slot]: GARMENTS[g].option });
const real = PATTERN_IDS.filter((p) => p !== 'plain') as Exclude<(typeof PATTERN_IDS)[number], 'plain'>[];
type Choice = { pattern: (typeof real)[number]; colour: string };

const dollWith = (outfit: Record<string, string>, pattern: (g: GarmentId) => Choice | undefined, more: { figure?: DollFigure; sheer?: boolean } = {}) =>
  paperDollSvg({
    figure: more.figure ?? 'joe',
    outfit: { ...NONE, ...outfit },
    neckline: 'crew',
    sheer: more.sheer ?? false,
    layers: {},
    colour: () => '#1f2a5a',
    pattern,
    hair: '#3b2a1f',
  });

describe('patterns on the doll (V9-02)', () => {
  it('draws every pattern on every patternable garment, over its own colour, and a shoe ignores it', () => {
    for (const g of ALL_GARMENT_IDS) {
      const figure: DollFigure = g === 'blazer_female' ? 'b' : 'joe';
      for (const p of real) {
        const svg = dollWith(wearing(g), () => ({ pattern: p, colour: '#ffffff' }), { figure });
        const id = patternPaint({ pattern: p, colour: '#ffffff' }, '#1f2a5a', 2).id;
        const group = new RegExp(`<g data-layer="[a-z]+" data-garment="${g}"[^>]*>(.*?)</g>`).exec(svg)![1];
        if (isPatternable(g)) {
          expect(svg, `${g} ${p}`).toContain(`<pattern id="${id}" patternUnits="userSpaceOnUse"`);
          expect(group, `${g} ${p}`).toContain(`fill="url(#${id})"`);
          expect(group, `${g} ${p}`).toContain('fill="#1f2a5a"');
        } else {
          expect(svg, `${g} ${p}`).not.toContain('<pattern');
          expect(svg, `${g} ${p}`).not.toContain('url(#');
        }
      }
    }
  });

  it('leaves a plain doll exactly as it was', () => {
    const outfit = { Top: 'T-shirt', Bottom: 'Trousers' };
    const plain = dollWith(outfit, () => undefined);
    expect(plain).not.toContain('<pattern');
    expect(plain).not.toContain('url(#');
  });

  it('paints a pattern over the body and both sleeves in one space, so it runs on across the seams', () => {
    const svg = dollWith({ Top: 'T-shirt' }, () => ({ pattern: 'hstripes', colour: '#ffffff' }));
    const group = /<g data-layer="top"[^>]*>(.*?)<\/g>/.exec(svg)![1];
    expect(group.match(/fill="url\(#/g)!.length).toBe(2); // the sleeves (one path) and the body, painted from the same pattern
    expect(svg.match(/<pattern /g)).toHaveLength(1);
    expect(svg).toContain('patternUnits="userSpaceOnUse"');
    expect(svg).not.toContain('patternTransform');
  });

  it('keeps a tucked tee clipped, with its pattern inside the clip', () => {
    const svg = dollWith({ Top: 'T-shirt', Bottom: 'Skirt' }, () => ({ pattern: 'spots', colour: '#ffffff' }));
    const group = /<g data-layer="top"[^>]*clip-path="url\(#doll-tuck\)"[^>]*>(.*?)<\/g>/.exec(svg)![1];
    expect(group).toContain('fill="url(#');
    expect(svg).toContain('<clipPath id="doll-tuck">');
  });

  it('defines a pattern once however many layers use it', () => {
    const svg = dollWith({ Top: 'T-shirt', Bottom: 'Trousers' }, () => ({ pattern: 'vstripes', colour: '#ffffff' }));
    expect(svg.match(/<pattern /g)).toHaveLength(1); // same colours and size for both garments
  });

  it('keeps sheer tights sheer with a pattern on top', () => {
    const svg = dollWith({ Legs: 'Tights' }, (g) => (g === 'tights' ? { pattern: 'vstripes', colour: '#8c8c8c' } : undefined), { sheer: true });
    const group = /<g data-layer="legs"[^>]*>(.*?)<\/g>/.exec(svg)![1];
    expect(group.match(/fill-opacity="0.55"/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it('draws the doll at twice the tile size', () => {
    const svg = dollWith({ Top: 'T-shirt' }, () => ({ pattern: 'hstripes', colour: '#ffffff' }));
    expect(svg).toContain('-s2"');
  });
});
