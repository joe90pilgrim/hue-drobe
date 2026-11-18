import { describe, expect, it } from 'vitest';
import { GARMENTS } from '../src/wardrobe';
import { FALLBACK_COLOUR, FALLBACK_GARMENT, templateList, toSuggestion } from '../src/identify';

describe('templateList (what the server is told we ship)', () => {
  it('lists every garment the app can save, with only the variants it stores', () => {
    const list = templateList();
    expect(list.map((t) => t.id).sort()).toEqual(Object.keys(GARMENTS).sort());
    expect(list.find((t) => t.id === 'tee')!.variants).toEqual(['crew', 'v', 'scoop']);
    expect(list.find((t) => t.id === 'tights')!.variants).toEqual(['opaque', 'sheer']);
    expect(list.find((t) => t.id === 'shirt_mid')!.variants).toEqual([]);
  });
  it('uses ids and labels the server accepts', () => {
    for (const t of templateList()) {
      expect(t.id).toMatch(/^[a-z][a-z0-9_]{0,31}$/);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.label.length).toBeLessThanOrEqual(60);
    }
  });
});

describe('toSuggestion', () => {
  it('reads a match, its variant and a lower-cased colour', () => {
    expect(toSuggestion({ templateId: 'tee', variant: 'scoop', hexColor: '#2E5E8C', confidence: 0.9 })).toEqual({
      garment: 'tee',
      neckline: 'scoop',
      sheer: false,
      colour: '#2e5e8c',
      confidence: 0.9,
      matched: true,
    });
    expect(toSuggestion({ templateId: 'tights', variant: 'sheer', hexColor: '#1a1a1a', confidence: 0.4 })).toMatchObject({ garment: 'tights', sheer: true });
  });
  it('ignores a variant the garment does not have', () => {
    expect(toSuggestion({ templateId: 'trousers', variant: 'sheer', hexColor: '#1a1a1a', confidence: 1 })).toMatchObject({ sheer: false, neckline: 'crew' });
    expect(toSuggestion({ templateId: 'tights', variant: 'v', hexColor: '#1a1a1a', confidence: 1 })).toMatchObject({ sheer: false });
  });
  it('falls back to the default garment, to be chosen by hand, when nothing matched', () => {
    for (const templateId of [null, 'coat', 7]) {
      expect(toSuggestion({ templateId, variant: null, hexColor: '#aabbcc', confidence: 0.2 })).toMatchObject({ garment: FALLBACK_GARMENT, matched: false, colour: '#aabbcc' });
    }
  });
  it('clamps confidence and rejects an unusable colour', () => {
    expect(toSuggestion({ templateId: 'tee', variant: null, hexColor: '#000000', confidence: 5 })!.confidence).toBe(1);
    expect(toSuggestion({ templateId: 'tee', variant: null, hexColor: '#000000' })!.confidence).toBe(0);
    for (const bad of [null, 'x', {}, { templateId: 'tee', hexColor: 'blue' }, { templateId: 'tee', hexColor: '#12345' }]) expect(toSuggestion(bad)).toBeNull();
    expect(FALLBACK_COLOUR).toMatch(/^#[0-9a-f]{6}$/);
  });
});
