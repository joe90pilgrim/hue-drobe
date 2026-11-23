import { describe, expect, it } from 'vitest';
import { ALL_GARMENT_IDS, ALL_NECKLINES, SHAPES, flatLayLayout, flatLaySvg, flatLayOf, silhouetteKey, silhouetteSvg, itemSilhouette } from '../src/silhouettes';

describe('silhouettes', () => {
  it('draws every garment id with a shape of its own', () => {
    for (const g of ALL_GARMENT_IDS) {
      const key = silhouetteKey(g);
      expect(key, g).not.toBe('generic');
      expect(SHAPES[key], g).toBeDefined();
    }
  });
  it('draws every tee neckline differently', () => {
    const keys = ALL_NECKLINES.map((n) => silhouetteKey('tee', n));
    expect(new Set(keys).size).toBe(ALL_NECKLINES.length);
    for (const k of keys) expect(SHAPES[k]).toBeDefined();
  });
  it('falls back to a generic shape for unknown ids', () => {
    expect(silhouetteKey('cape')).toBe('generic');
    expect(silhouetteSvg({ garment: 'cape', colour: '#336699' })).toContain('<path');
  });
  it('carries the fill, is hidden from screen readers and has no text nodes', () => {
    for (const g of ALL_GARMENT_IDS) {
      for (const mode of ['hang', 'flat', 'shelf'] as const) {
        const svg = silhouetteSvg({ garment: g, colour: '#1f2a5a', mode });
        expect(svg).toContain('fill="#1f2a5a"');
        expect(svg).toContain('aria-hidden="true"');
        expect(svg).not.toMatch(/<(title|desc|text)\b/);
        expect(svg.replace(/<[^>]*>/g, '')).toBe('');
      }
    }
  });
  it("ghost mode: a dashed #7a7a7a outline, the colour at 40%, neutral grey when there is no colour", () => {
    const svg = silhouetteSvg({ garment: 'tee', colour: '#c0392b', mode: 'ghost' });
    expect(svg).toContain('stroke="#7a7a7a"');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('fill="#c0392b" fill-opacity="0.4"');
    expect(svg).toContain(`viewBox="${SHAPES.tee.box.join(' ')}"`);
    expect(svg).not.toContain('#8a8a8a'); // no hook
    expect(svg).toContain('aria-hidden="true"');
    expect(silhouetteSvg({ garment: 'boot', colour: '', mode: 'ghost' })).toContain('fill="#9a9a9a" fill-opacity="0.4"');
  });
  it('hang has a hook and a square box; flat crops to the content box without a hook', () => {
    const hang = silhouetteSvg({ garment: 'tee', colour: '#808080', mode: 'hang' });
    const flat = silhouetteSvg({ garment: 'tee', colour: '#808080', mode: 'flat' });
    expect(hang).toContain('viewBox="0 0 100 100"');
    expect(hang).toContain('stroke="#8a8a8a"');
    expect(flat).toContain(`viewBox="${SHAPES.tee.box.join(' ')}"`);
    expect(flat).not.toContain('#8a8a8a');
  });
  it('gives very dark colours a lighter edge and pale colours a darker one', () => {
    expect(silhouetteSvg({ garment: 'tee', colour: '#0a0a0a' })).toContain('stroke="#6b6b6b"');
    expect(silhouetteSvg({ garment: 'tee', colour: '#ffffff' })).toContain('stroke="#b3b3b3"');
  });
  it('draws sheer tights lighter than opaque', () => {
    const sheer = silhouetteSvg({ garment: 'tights', sheer: true, colour: '#222222' });
    const opaque = silhouetteSvg({ garment: 'tights', colour: '#222222' });
    expect(sheer).toContain('fill-opacity="0.55"');
    expect(opaque).not.toContain('fill-opacity');
  });
  it('ignores a bad colour string instead of injecting it', () => {
    expect(silhouetteSvg({ garment: 'tee', colour: '"><script>' })).not.toContain('script');
  });
});

describe('flat-lay', () => {
  const tee = { garment: 'tee', colour: '#1f2a5a' };
  const trousers = { garment: 'trousers', colour: '#c8c8c8' };
  const centred = (l: ReturnType<typeof flatLayLayout>) => l.placements.every((p) => Math.abs(p.x + p.w / 2 - l.width / 2) < 1e-9);

  it('stacks a top above a bottom, centred, with a gap, inside the viewBox', () => {
    const l = flatLayLayout([{ slot: 'bottom', item: trousers }, { slot: 'top', item: tee }]);
    expect(l.placements.map((p) => p.slot)).toEqual(['top', 'bottom']);
    const [t, b] = l.placements;
    expect(b.y).toBeGreaterThan(t.y + t.h);
    expect(centred(l)).toBe(true);
    expect(t.w).toBeGreaterThan(b.w);
    for (const p of l.placements) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(l.width);
      expect(p.y + p.h).toBeLessThanOrEqual(l.height);
    }
  });
  it('draws a dress alone as one tall shape', () => {
    const l = flatLayLayout([{ slot: 'dress', item: { garment: 'dress', colour: '#aa3355' } }]);
    expect(l.placements).toHaveLength(1);
    expect(l.placements[0].key).toBe('dress');
    expect(centred(l)).toBe(true);
    expect(l.height).toBeGreaterThan(l.width);
  });
  it('shows tights as legs under a short bottom, behind it', () => {
    const shorts = { garment: 'shorts', colour: '#885522' };
    const l = flatLayLayout([{ slot: 'bottom', item: shorts }, { slot: 'legs', item: { garment: 'tights', sheer: true, colour: '#222222' } }]);
    const b = l.placements.find((p) => p.slot === 'bottom')!;
    const legs = l.placements.find((p) => p.slot === 'legs')!;
    expect(legs.y).toBe(b.y);
    expect(legs.y + legs.h).toBeGreaterThan(b.y + b.h);
    expect(centred(l)).toBe(true);
    const svg = flatLaySvg([{ slot: 'bottom', item: shorts }, { slot: 'legs', item: { garment: 'tights', colour: '#222222' } }]);
    expect(svg.indexOf('data-slot="legs"')).toBeLessThan(svg.indexOf('data-slot="bottom"'));
  });
  it('keeps a deleted piece in its place as a dashed outline, with no fill colour', () => {
    const pieces = [{ slot: 'top' as const }, { slot: 'bottom' as const, item: trousers }];
    const l = flatLayLayout(pieces);
    expect(l.placements.map((p) => [p.slot, p.missing])).toEqual([['top', true], ['bottom', false]]);
    const svg = flatLaySvg(pieces);
    expect(svg.match(/class="o-gap"/g)).toHaveLength(1);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain('<text');
  });
});

describe('itemSilhouette', () => {
  it('draws a saved item in its own colour, the same as silhouetteSvg', () => {
    const item = { v: 2, id: 'x', garment: 'tee', colour: '#1f2a5a', name: 'Navy tee', savedAt: 1 } as never;
    expect(itemSilhouette(item, 'flat')).toBe(silhouetteSvg({ garment: 'tee', colour: '#1f2a5a', mode: 'flat' }));
  });
});

describe('flatLayOf', () => {
  const item = (id: string, garment: string, colour: string) => ({ v: 2, id, garment, colour, name: id, savedAt: 1 }) as never;
  const outfit = (o: object) => ({ v: 1, id: 'o', name: 'Look', savedAt: 1, ...o }) as never;
  const slots = (svg: string) => [...svg.matchAll(/data-slot="(\w+)"/g)].map((m) => m[1]);

  it('stacks a top above a bottom', () => {
    const svg = flatLayOf(outfit({ top: 't', bottom: 'b' }), { top: item('t', 'tee', '#1f2a5a'), bottom: item('b', 'trousers', '#c8c8c8') });
    expect(slots(svg)).toEqual(['top', 'bottom']);
    expect(svg).not.toContain('o-gap');
  });
  it('draws a dress alone, ignoring a top and bottom', () => {
    const svg = flatLayOf(outfit({ dress: 'd', top: 't' }), { dress: item('d', 'dress', '#aa3355'), top: item('t', 'tee', '#1f2a5a') });
    expect(slots(svg)).toEqual(['dress']);
  });
  it('keeps a deleted piece as a dashed outline in its place', () => {
    const svg = flatLayOf(outfit({ top: 't', bottom: 'b' }), { bottom: item('b', 'trousers', '#c8c8c8') });
    expect(slots(svg)).toEqual(['top', 'bottom']);
    expect(svg.match(/class="o-gap"/g)).toHaveLength(1);
  });
});
