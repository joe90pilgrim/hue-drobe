import { describe, expect, it } from 'vitest';
import { ALL_GARMENT_IDS, ALL_NECKLINES, SHAPES, silhouetteKey, silhouetteSvg } from '../src/silhouettes';

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
