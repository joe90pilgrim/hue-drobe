// V9-01: patterns on saved items.
import { describe, expect, it } from 'vitest';
import { PATTERN_IDS, cleanPatterns, contrastColour, isPatternable, withItemPattern } from '../src/patterns';
import { GARMENTS, autoName, cleanItems, ensureItem, newItem, type GarmentId } from '../src/wardrobe';

describe('patterns (V9-01)', () => {
  it('offers the five options', () => {
    expect(PATTERN_IDS).toEqual(['plain', 'hstripes', 'vstripes', 'spots', 'flowers']);
  });
  it('lets every garment except shoes have a pattern, and nothing else', () => {
    for (const g of Object.keys(GARMENTS) as GarmentId[]) expect(isPatternable(g), g).toBe(GARMENTS[g].slot !== 'Shoes');
    expect(isPatternable('hair')).toBe(false);
    expect(isPatternable('nonsense')).toBe(false);
  });
  it('omits the fields when plain, and keeps them otherwise', () => {
    const plain = newItem('tee', '#1f2a5a', 1);
    expect(plain).not.toHaveProperty('pattern');
    expect(plain).not.toHaveProperty('patternColour');
    const striped = newItem('tee', '#1f2a5a', 1, 'crew', false, { pattern: 'hstripes', colour: '#FFFFFF' });
    expect(striped).toMatchObject({ pattern: 'hstripes', patternColour: '#ffffff', name: 'Navy striped tee' });
  });
  it('puts the pattern word before the neckline, and drops it when the name would pass 40 characters', () => {
    expect(autoName('tee', '#1f2a5a', 'v', undefined, 'spots')).toBe('Navy spotted V-neck tee');
    expect(autoName('tee', '#1f2a5a', 'crew', undefined, 'plain')).toBe('Navy tee');
    expect(autoName('shirt_short', '#ffcc99', undefined, undefined, 'vstripes')).toBe('Light orange short-sleeve shirt'); // 42 characters with the word
    for (const g of Object.keys(GARMENTS) as GarmentId[]) for (const p of PATTERN_IDS) expect(autoName(g, '#ffcc99', 'scoop', true, p).length, `${g} ${p}`).toBeLessThanOrEqual(40);
  });
  it('treats pattern and pattern colour as part of an item', () => {
    let r = ensureItem([], 'tee', '#1f2a5a', 1);
    r = ensureItem(r.list, 'tee', '#1f2a5a', 2, 'crew', false, { pattern: 'hstripes', colour: '#ffffff' });
    r = ensureItem(r.list, 'tee', '#1f2a5a', 3, 'crew', false, { pattern: 'vstripes', colour: '#ffffff' });
    r = ensureItem(r.list, 'tee', '#1f2a5a', 4, 'crew', false, { pattern: 'hstripes', colour: '#ff0000' });
    expect(r.list).toHaveLength(4);
    expect(ensureItem(r.list, 'tee', '#1f2a5a', 5, 'crew', false, { pattern: 'hstripes', colour: '#FFFFFF' }).list).toHaveLength(4);
    expect(ensureItem(r.list, 'tee', '#1f2a5a', 6).item).toBe(r.list[0]); // plain still finds the plain one
  });
  it('never gives a shoe a pattern', () => {
    const shoe = newItem('trainers', '#ffffff', 1, 'crew', false, { pattern: 'spots', colour: '#000000' });
    expect(shoe).not.toHaveProperty('pattern');
    expect(ensureItem([shoe], 'trainers', '#ffffff', 2, 'crew', false, { pattern: 'spots', colour: '#000000' }).list).toHaveLength(1);
  });
  it('cleans pattern fields on load: unknown ids, bad colours and shoes lose them; plain records come back unchanged', () => {
    const base = { v: 2, savedAt: 1 };
    const out = cleanItems([
      { ...base, id: 'a', garment: 'tee', colour: '#1f2a5a', name: 'A', pattern: 'spots', patternColour: '#AABBCC' },
      { ...base, id: 'b', garment: 'tee', colour: '#1f2a5a', name: 'B', pattern: 'tartan', patternColour: '#aabbcc' },
      { ...base, id: 'c', garment: 'tee', colour: '#1f2a5a', name: 'C', pattern: 'spots', patternColour: 'red' },
      { ...base, id: 'd', garment: 'tee', colour: '#1f2a5a', name: 'D', pattern: 'spots' },
      { ...base, id: 'e', garment: 'trainers', colour: '#ffffff', name: 'E', pattern: 'spots', patternColour: '#aabbcc' },
      { ...base, id: 'f', garment: 'tee', colour: '#1f2a5a', name: 'F', pattern: 'plain', patternColour: '#aabbcc' },
    ]);
    expect(out.find((i) => i.id === 'a')).toMatchObject({ pattern: 'spots', patternColour: '#aabbcc' });
    for (const id of ['b', 'c', 'd', 'e', 'f']) {
      expect(out.find((i) => i.id === id), id).not.toHaveProperty('pattern');
      expect(out.find((i) => i.id === id), id).not.toHaveProperty('patternColour');
    }
    const plain = newItem('tee', '#1f2a5a', 1);
    expect(cleanItems([plain])).toEqual([plain]);
  });
  it('cleans the stored patterns map', () => {
    expect(cleanPatterns('x')).toBeUndefined();
    const dirty = {
      tee: { pattern: 'spots', colour: '#AABBCC' },
      trainers: { pattern: 'spots', colour: '#aabbcc' },
      hair: { pattern: 'spots', colour: '#aabbcc' },
      shorts: { pattern: 'plain', colour: '#aabbcc' },
      skirt: { pattern: 'flowers', colour: 'x' },
      trousers: 4,
    };
    expect(cleanPatterns(dirty)).toEqual({ tee: { pattern: 'spots', colour: '#aabbcc' } });
  });
  it('sets or clears a garment when an item is worn', () => {
    const map = { tee: { pattern: 'spots' as const, colour: '#aabbcc' } };
    expect(withItemPattern(map, newItem('tee', '#1f2a5a', 1))).toEqual({});
    expect(withItemPattern(map, newItem('tee', '#1f2a5a', 1, 'crew', false, { pattern: 'flowers', colour: '#ff0000' }))).toEqual({ tee: { pattern: 'flowers', colour: '#ff0000' } });
    expect(map).toEqual({ tee: { pattern: 'spots', colour: '#aabbcc' } }); // the input is not changed
  });
  it('offers a contrasting first colour', () => {
    expect(contrastColour('#1f2a5a')).toBe('#ffffff');
    expect(contrastColour('#f2ede3')).toBe('#1a1a1a');
    expect(contrastColour('#8c8c8c')).toBe('#1a1a1a');
  });
});
