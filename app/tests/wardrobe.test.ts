import { describe, expect, it } from 'vitest';
import { autoName, cleanItems, colourName, deleteItem, newItem, renameItem } from '../src/wardrobe';
import { routeFromHash } from '../src/route';

describe('colourName and autoName', () => {
  it('names common colours', () => {
    expect(colourName('#000000')).toBe('Black');
    expect(colourName('#ffffff')).toBe('White');
    expect(colourName('#1f2a5a')).toBe('Navy');
    expect(colourName('#2e7d32')).toBe('Green');
    expect(colourName('#d6d6d6')).toBe('Light grey');
  });
  it('builds an automatic name from colour and garment', () => {
    expect(autoName('tee', '#1f2a5a')).toBe('Navy tee');
    expect(autoName('trousers', '#000000')).toBe('Black trousers');
  });
});

describe('records', () => {
  it('creates a versioned, auto-named item', () => {
    const i = newItem('sweatshirt', '#1F2A5A', 5);
    expect(i).toMatchObject({ v: 1, garment: 'sweatshirt', colour: '#1f2a5a', name: 'Navy sweatshirt', savedAt: 5 });
    expect(i.id).toBeTruthy();
  });
  it('renames, falling back to the auto name when blank, and deletes', () => {
    const a = newItem('tee', '#1f2a5a', 1);
    const b = newItem('tee', '#000000', 2);
    let list = renameItem([a, b], a.id, '  My   good tee ');
    expect(list[0].name).toBe('My good tee');
    list = renameItem(list, a.id, '   ');
    expect(list[0].name).toBe('Navy tee');
    expect(deleteItem(list, a.id)).toEqual([b]);
  });
  it('drops bad records and duplicates when loading', () => {
    const good = newItem('tee', '#1f2a5a', 1);
    const out = cleanItems([good, good, { id: 'x', garment: 'hat', colour: '#000000' }, { id: 'y', garment: 'tee', colour: 'red' }, null, { id: 'z', garment: 'tee', colour: '#AABBCC', name: 7, savedAt: 0 }]);
    expect(out.map((i) => i.id)).toEqual(['z', good.id]);
    expect(out.find((i) => i.id === 'z')).toMatchObject({ colour: '#aabbcc', name: 'Blue tee' });
  });
});

describe('routes', () => {
  it('knows the wardrobe screen', () => {
    expect(routeFromHash('#/wardrobe')).toBe('wardrobe');
    expect(routeFromHash('#/nonsense')).toBe('dress');
  });
});
