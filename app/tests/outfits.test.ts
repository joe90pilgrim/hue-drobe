import { describe, expect, it, vi } from 'vitest';
import { autoOutfitName, cleanOutfits, deleteOutfit, newOutfit, renameOutfit, resolveOutfit, wearOutfit } from '../src/outfits';
import { ensureItem, newItem, wearItem } from '../src/wardrobe';

// An in-memory store, so wearItem and wearOutfit can run without IndexedDB.
const kv = new Map<string, unknown>();
vi.mock('../src/store', () => ({
  kvGet: async (key: string, fallback: unknown) => kv.get(key) ?? fallback,
  kvPut: async (key: string, value: unknown) => void kv.set(key, structuredClone(value)),
}));

const navyTee = newItem('tee', '#1f2a5a', 1);
const greyTrousers = newItem('trousers', '#d6d6d6', 2);

describe('outfits', () => {
  it('auto-names an outfit from its items', () => {
    expect(autoOutfitName({ top: navyTee, bottom: greyTrousers })).toBe('Navy tee, Light grey trousers');
    expect(autoOutfitName({ top: navyTee })).toBe('Navy tee');
    expect(autoOutfitName({})).toBe('Outfit');
  });

  it('stores the ids of its items', () => {
    const o = newOutfit({ top: navyTee, bottom: greyTrousers }, 9);
    expect(o).toMatchObject({ v: 1, name: 'Navy tee, Light grey trousers', top: navyTee.id, bottom: greyTrousers.id, savedAt: 9 });
    expect(o.id).toBeTruthy();
  });

  it('resolves items, and a slot whose item was deleted comes back empty', () => {
    const o = newOutfit({ top: navyTee, bottom: greyTrousers }, 1);
    expect(resolveOutfit(o, [navyTee, greyTrousers])).toEqual({ top: navyTee, bottom: greyTrousers });
    expect(resolveOutfit(o, [greyTrousers])).toEqual({ top: undefined, bottom: greyTrousers });
    expect(resolveOutfit(o, [])).toEqual({ top: undefined, bottom: undefined });
  });

  it('renames, falling back when blank, and deletes', () => {
    const o = newOutfit({ top: navyTee }, 1);
    let list = renameOutfit([o], o.id, '  Work   day ', 'Navy tee');
    expect(list[0].name).toBe('Work day');
    list = renameOutfit(list, o.id, '   ', 'Navy tee');
    expect(list[0].name).toBe('Navy tee');
    expect(deleteOutfit(list, o.id)).toEqual([]);
  });

  it('drops bad records, duplicates and outfits with no slots when loading', () => {
    const good = newOutfit({ top: navyTee }, 1);
    const out = cleanOutfits([
      good,
      good,
      { id: 'a', name: 'Empty', savedAt: 0 },
      { id: 'b', name: 'Not a list', top: 7, bottom: null, savedAt: 0 },
      null,
      { id: 'c', top: 'x', name: 3, savedAt: 'late' },
    ]);
    expect(out.map((o) => o.id)).toEqual(['c', good.id]);
    expect(out.find((o) => o.id === 'c')).toMatchObject({ name: 'Outfit', top: 'x', savedAt: 0 });
  });
});

describe('ensureItem', () => {
  it('adds a garment in a colour once, and reuses it after', () => {
    const first = ensureItem([], 'tee', '#1F2A5A', 1);
    expect(first.list).toHaveLength(1);
    expect(first.item).toMatchObject({ garment: 'tee', colour: '#1f2a5a', name: 'Navy tee' });
    const again = ensureItem(first.list, 'tee', '#1f2a5a', 2);
    expect(again.list).toBe(first.list);
    expect(again.item.id).toBe(first.item.id);
  });
});

describe('wearing patterned items (V9-01)', () => {
  const stripedTee = newItem('tee', '#1f2a5a', 1, 'crew', false, { pattern: 'hstripes', colour: '#ffffff' });
  const plainTee = newItem('tee', '#1f2a5a', 2);
  const spotTrousers = newItem('trousers', '#d6d6d6', 3, 'crew', false, { pattern: 'spots', colour: '#111111' });

  it('a plain item worn after a patterned one leaves no pattern behind', async () => {
    kv.clear();
    await wearItem(stripedTee);
    expect(kv.get('patterns')).toEqual({ tee: { pattern: 'hstripes', colour: '#ffffff' } });
    await wearItem(plainTee);
    expect(kv.get('patterns')).toEqual({});
  });
  it('wearing an outfit sets or clears the pattern of each garment it uses, and leaves the others alone', async () => {
    kv.clear();
    kv.set('patterns', { tee: { pattern: 'flowers', colour: '#ff0000' }, shorts: { pattern: 'spots', colour: '#000000' } });
    await wearOutfit(newOutfit({ top: plainTee, bottom: spotTrousers }, 1), [plainTee, spotTrousers]);
    expect(kv.get('patterns')).toEqual({ shorts: { pattern: 'spots', colour: '#000000' }, trousers: { pattern: 'spots', colour: '#111111' } });
  });
});
