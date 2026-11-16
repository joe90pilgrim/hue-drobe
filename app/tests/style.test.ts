import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// V1.2-01: the stylesheet uses true neutrals only (equal red, green and blue), so the interface never tints a garment colour.
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const hexes = [...css.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)].map((m) => m[1].toLowerCase());
const full = (h: string) => (h.length === 3 ? [...h].map((c) => c + c).join('') : h);

// The only allowed colour: --danger, used for Delete text.
const ALLOWED_COLOURS = ['b42318'];

describe('style.css colours', () => {
  it('has hex colours to check', () => expect(hexes.length).toBeGreaterThan(10));

  it('uses only true neutral greys, apart from the Delete red', () => {
    const tinted = hexes.map(full).filter((h) => !ALLOWED_COLOURS.includes(h) && !(h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6)));
    expect(tinted).toEqual([]);
  });

  it('uses only black or white in rgb() and rgba() colours', () => {
    const rgbs = [...css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)];
    for (const m of rgbs) expect(m[1] === m[2] && m[2] === m[3], m[0]).toBe(true);
  });

  it('keeps the avatar stage at exactly #E3E3E3', () => {
    expect(css).toMatch(/--stage:\s*#e3e3e3;/i);
    expect(css).toMatch(/\.stage\s*\{[^}]*background:\s*var\(--stage\)/);
  });

  it('has no green accent left', () => {
    expect(css).not.toMatch(/--accent/);
    for (const old of ['3e5c4e', '334e41', 'eef3f0', 'f6f8f7', 'f4f2ee', 'ece8e1']) expect(hexes).not.toContain(old);
  });

  it('has no text below 12 px', () => {
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.filter((s) => s < 12)).toEqual([]);
  });

  it('gives every swatch the faint inner edge', () => {
    expect(css).toMatch(/--swatch-edge:\s*inset 0 0 0 1px rgba\(0,\s*0,\s*0,\s*\.1\)/);
    for (const sel of ['.swatch', '.w-tile', '.d-swatch', '.o-slice', '.fav-tile', '.cur-swatch']) {
      const rule = css.split('\n').find((l) => l.startsWith(sel + ' '));
      expect(rule, sel).toContain('var(--swatch-edge)');
    }
  });
});
