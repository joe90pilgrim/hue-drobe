import { describe, expect, it } from 'vitest';
import { dollFigureOf, dollPieces, dollShapeOf, mapPath, paperDollSvg, SLEEVE_HEM, type DollFigure } from '../src/paper-doll';
import { ALL_GARMENT_IDS, ALL_NECKLINES, SHAPES, silhouetteKey } from '../src/silhouettes';
import { GARMENTS, type GarmentId, type Neckline } from '../src/wardrobe';

const NONE = { Hat: 'None', Outer: 'None', Dress: 'None', Top: 'None', Bottom: 'None', Legs: 'None', Under: 'None', Shoes: 'None' };

function doll(outfit: Record<string, string>, more: { figure?: DollFigure; neckline?: Neckline; sheer?: boolean; layers?: Record<string, Neckline[]> } = {}) {
  const svg = paperDollSvg({
    figure: more.figure ?? 'joe',
    outfit: { ...NONE, ...outfit },
    neckline: more.neckline ?? 'crew',
    sheer: more.sheer ?? false,
    layers: more.layers ?? {},
    colour: (g: GarmentId) => `#${(ALL_GARMENT_IDS.indexOf(g) + 16).toString(16).padStart(2, '0')}3344`,
    hair: '#3b2a1f',
  });
  const order = [...svg.matchAll(/<g data-layer="([a-z-]+)"(?: data-garment="([a-z_]+)")?/g)].map((m) => (m[2] ? `${m[1]}:${m[2]}` : m[1]));
  return { svg, order };
}
/** The outfit that wears one garment, in its own slot (the blazer through the Outer slot). */
const wearing = (g: GarmentId): Record<string, string> => ({ [GARMENTS[g].slot]: GARMENTS[g].option });

describe('paper doll (V8-01)', () => {
  it('has a doll shape for every garment id, and draws each one', () => {
    for (const g of ALL_GARMENT_IDS) {
      expect(dollShapeOf(g), g).toBeDefined();
      const figure: DollFigure = g === 'blazer_female' ? 'b' : 'joe';
      const { svg } = doll(wearing(g), { figure });
      expect(svg, g).toContain(`data-garment="${g}" data-shape="${silhouetteKey(g)}"`);
    }
  });

  it('gives every top a sleeve hem for the arms to come out of', () => {
    for (const g of ALL_GARMENT_IDS)
      if (GARMENTS[g].slot === 'Top' || GARMENTS[g].slot === 'Outer')
        for (const n of ALL_NECKLINES) expect(SLEEVE_HEM[dollShapeOf(g, n)!], `${g} ${n}`).toBeDefined();
  });

  it('draws every tee neckline with its own shape', () => {
    for (const n of ALL_NECKLINES) expect(doll({ Top: 'T-shirt' }, { neckline: n }).svg).toContain(`data-shape="${silhouetteKey('tee', n)}"`);
  });

  it('draws the tights sheer only when sheer', () => {
    const tights = (svg: string) => /<g data-layer="legs" data-garment="tights"[^>]*>(.*?)<\/g>/.exec(svg)![1];
    expect(tights(doll({ Legs: 'Tights', Bottom: 'Shorts' }, { sheer: true }).svg)).toContain('fill-opacity="0.55"');
    expect(tights(doll({ Legs: 'Tights', Bottom: 'Shorts' }).svg)).not.toContain('fill-opacity');
    expect(/data-garment="shorts"[^>]*>(.*?)<\/g>/.exec(doll({ Legs: 'Tights', Bottom: 'Shorts' }, { sheer: true }).svg)![1]).not.toContain('fill-opacity');
  });

  it('fills each garment with its colour', () => {
    const { svg } = doll({ Top: 'Sweatshirt' });
    expect(svg).toContain(`fill="#${(ALL_GARMENT_IDS.indexOf('sweatshirt') + 16).toString(16)}3344"`);
  });

  it('layers back to front: body, legs, shoes, bottom, arms, top, outer, hair, hat', () => {
    expect(doll({ Top: 'T-shirt', Bottom: 'Shorts', Legs: 'Tights', Shoes: 'Trainers', Outer: 'Blazer', Hat: 'Cap' }).order).toEqual([
      'hair-back', 'body', 'legs:tights', 'shoes:trainers', 'bottom:shorts', 'arms', 'top:tee', 'outer:blazer_male', 'hair', 'hat:cap',
    ]);
  });

  it('draws the dress over the body and the tights, with the arms over it', () => {
    expect(doll({ Dress: 'Shift dress', Legs: 'Tights' }, { figure: 'b' }).order).toEqual(['hair-back', 'body', 'legs:tights', 'dress:dress', 'arms', 'hair']);
  });

  it('cuts a tee tucked into a skirt at the waist, and only then', () => {
    const tucked = doll({ Top: 'T-shirt', Bottom: 'Skirt' }, { figure: 'b' });
    expect(tucked.svg).toMatch(/<g data-layer="top" data-garment="tee" data-shape="tee" clip-path="url\(#doll-tuck\)" data-tucked="true">/);
    expect(tucked.svg).toContain('<clipPath id="doll-tuck">');
    const untucked = doll({ Top: 'T-shirt', Bottom: 'Trousers' });
    expect(untucked.svg).not.toContain('doll-tuck');
  });

  it('draws the tee under a sweatshirt or shirt only for a combination that passed on this body', () => {
    const outfit = { Top: 'Sweatshirt', Under: 'T-shirt' };
    expect(doll(outfit, { layers: { sweatshirt: ['crew'] } }).order).toEqual(['hair-back', 'body', 'arms', 'under:tee', 'top:sweatshirt', 'hair']);
    expect(doll(outfit, { layers: {} }).order).not.toContain('under:tee');
    expect(doll(outfit, { layers: { sweatshirt: ['v'] } }).order).not.toContain('under:tee'); // crew did not pass
    expect(doll(outfit, { layers: { sweatshirt: ['v'] }, neckline: 'v' }).svg).toContain('data-garment="tee" data-shape="tee_v"');
  });

  it('brings the arms out of the outermost sleeves', () => {
    expect(doll({}).svg).toContain('data-layer="arms"');
    // The blazer's long sleeves end at the wrist; the tee's short sleeves end at the upper arm, so the arm starts higher.
    const armTop = (svg: string) => Number(/<g data-layer="arms"><path d="M[\d.]+ ([\d.]+)/.exec(svg)![1]);
    expect(armTop(doll({ Top: 'T-shirt' }).svg)).toBeLessThan(armTop(doll({ Top: 'T-shirt', Outer: 'Blazer' }).svg));
  });

  it('draws the blazer the pack has, or the figure\'s own', () => {
    expect(dollPieces({ outfit: { ...NONE, Outer: 'Blazer' }, neckline: 'crew', layers: {}, figure: 'b' })[0].garment).toBe('blazer_female');
    expect(dollPieces({ outfit: { ...NONE, Outer: 'Blazer' }, neckline: 'crew', layers: {}, outer: 'blazer_male', figure: 'b' })[0].garment).toBe('blazer_male');
  });

  it('draws a figure for each person: B for b, Joe for anyone else', () => {
    expect(dollFigureOf('b')).toBe('b');
    expect(dollFigureOf('joe')).toBe('joe');
    expect(dollFigureOf('someone')).toBe('joe');
    const joe = doll({}, { figure: 'joe' }).svg;
    const b = doll({}, { figure: 'b' }).svg;
    expect(joe).toContain('data-figure="joe"');
    expect(b).toContain('data-figure="b"');
    expect(joe).not.toEqual(b.replace('data-figure="b"', 'data-figure="joe"'));
  });

  it('maps every point of a shape path and keeps its commands', () => {
    expect(mapPath('M10 20 L30 40 Q50 60 70 80 Z', (x, y) => [x + 1, y * 2])).toBe('M11 40 L31 80 Q51 120 71 160 Z');
    for (const key of Object.keys(SHAPES)) expect(mapPath(SHAPES[key].body, (x, y) => [x, y]).replace(/\s+/g, ' '), key).toBe(SHAPES[key].body.replace(/\s+/g, ' '));
  });
});
