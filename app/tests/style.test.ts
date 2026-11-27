import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// V1.2-01: the stylesheet uses true neutrals only (equal red, green and blue), so the interface never tints a garment colour.
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const hexes = [...css.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)].map((m) => m[1].toLowerCase());
const full = (h: string) => (h.length === 3 ? [...h].map((c) => c + c).join('') : h);

// The allowed colours: --danger, used for Delete text, and (V7-06, from the V7 spec) the green of the "Gemini matched" banner and the
// "N in your wardrobe" text. They sit on chrome only, never on or near a garment.
const ALLOWED_COLOURS = ['b42318', '1f5a33', 'e8f1ea', 'b9d2bf'];

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
    const tokens = Object.fromEntries([...css.matchAll(/(--(?:text|display)-\d+):\s*(\d+)px/g)].map((m) => [m[1], Number(m[2])]));
    expect(Object.keys(tokens).length).toBeGreaterThan(5);
    const sizes = [...css.matchAll(/font-size:\s*([^;}]+)/g)].flatMap((m) => {
      const px = m[1].match(/^([\d.]+)px$/);
      if (px) return [Number(px[1])];
      const t = m[1].trim().match(/^var\((--(?:text|display)-\d+)\)$/);
      return t ? [tokens[t[1]]] : [];
    });
    expect(sizes.length).toBeGreaterThan(50);
    expect(sizes.filter((s) => s < 12)).toEqual([]);
  });

  // V10-02: one spacing, radius and type scale. Every font-size, border-radius and gap is a token, or on the review's "leave alone" list
  // (docs/designs/2026-11-27-ui-review/ui-review.md, section C): 20, 30, 34 and 40px type, 50% and 0 radius, 0 gap, and the .hud debug box.
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] }));
  const declarations = (prop: RegExp) => rules.flatMap((r) => [...r.body.matchAll(/(?:^|;)\s*([a-z-]+)\s*:\s*([^;]+)/g)].filter((d) => prop.test(d[1])).map((d) => ({ selector: r.selector, prop: d[1], value: d[2].trim() })));
  const literalsIn = (value: string) => value.replace(/var\([^)]*\)/g, '').replace(/calc\([^)]*\)/g, '').split(/\s+/).filter(Boolean);

  it('uses a token or a leave-alone value for every font-size, border-radius and gap', () => {
    const bad: string[] = [];
    for (const d of declarations(/^(font-size|border-radius|gap|row-gap|column-gap)$/)) {
      if (d.selector.includes('.hud') || d.selector === ':root') continue;
      const allowed = d.prop === 'font-size' ? ['20px', '30px', '34px', '40px'] : ['0', '50%'];
      for (const t of literalsIn(d.value)) if (!allowed.includes(t)) bad.push(`${d.selector} { ${d.prop}: ${d.value} }`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('keeps the banner green only in the --ok tokens, and uses them only on .p-sug-banner', () => {
    for (const h of ['1f5a33', 'e8f1ea', 'b9d2bf']) {
      const lines = css.split(/\r?\n/).filter((l) => l.toLowerCase().includes('#' + h));
      expect(lines.length, h).toBe(1);
      expect(lines[0], h).toContain('--ok-');
    }
    const users = rules.filter((r) => r.selector !== ':root' && /var\(--ok-/.test(r.body)).map((r) => r.selector);
    expect(users.length).toBeGreaterThan(0);
    expect(users.filter((u) => !/^\.p-sug-banner\b/.test(u))).toEqual([]);
  });

  it('gives every swatch the faint inner edge', () => {
    expect(css).toMatch(/--swatch-edge:\s*inset 0 0 0 1px rgba\(0,\s*0,\s*0,\s*\.1\)/);
    for (const sel of ['.swatch', '.w-tile', '.d-swatch', '.fav-tile', '.cur-swatch']) {
      const rule = css.split('\n').find((l) => l.startsWith(sel + ' '));
      expect(rule, sel).toContain('var(--swatch-edge)');
    }
  });
});
