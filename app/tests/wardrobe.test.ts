import { describe, expect, it } from 'vitest';
import {
  autoName,
  cleanItems,
  colourName,
  deleteItem,
  ensureItem,
  itemKind,
  meshName,
  meshesOf,
  newItem,
  renameItem,
} from '../src/wardrobe';
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
    expect(autoName('shorts', '#1f2a5a')).toBe('Navy shorts');
  });
});

describe('records', () => {
  it('creates a versioned, auto-named item', () => {
    const i = newItem('sweatshirt', '#1F2A5A', 5);
    expect(i).toMatchObject({ v: 2, garment: 'sweatshirt', colour: '#1f2a5a', name: 'Navy sweatshirt', savedAt: 5 });
    expect(i).not.toHaveProperty('neckline');
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

describe('necklines', () => {
  it('names a tee after its neckline, leaving the crew neck as the plain tee', () => {
    expect(autoName('tee', '#1f2a5a')).toBe('Navy tee');
    expect(autoName('tee', '#1f2a5a', 'crew')).toBe('Navy tee');
    expect(autoName('tee', '#1f2a5a', 'v')).toBe('Navy V-neck tee');
    expect(autoName('tee', '#1f2a5a', 'scoop')).toBe('Navy scoop-neck tee');
    expect(autoName('sweatshirt', '#1f2a5a', 'v')).toBe('Navy sweatshirt'); // only the tee has necklines
  });
  it('stores the neckline on a saved tee, and on no other garment', () => {
    expect(newItem('tee', '#1f2a5a', 1)).toMatchObject({ neckline: 'crew', name: 'Navy tee' });
    expect(newItem('tee', '#1f2a5a', 1, 'v')).toMatchObject({ neckline: 'v', name: 'Navy V-neck tee' });
    expect(newItem('trousers', '#000000', 1, 'v')).not.toHaveProperty('neckline');
  });
  it('saves one item per neckline in the same colour, and finds the right one again', () => {
    const a = ensureItem([], 'tee', '#1f2a5a', 1, 'crew');
    const b = ensureItem(a.list, 'tee', '#1f2a5a', 2, 'v');
    expect(b.list).toHaveLength(2);
    expect(ensureItem(b.list, 'tee', '#1F2A5A', 3, 'v').item).toBe(b.item);
    expect(ensureItem(b.list, 'tee', '#1f2a5a', 3, 'crew').item).toBe(a.item);
    expect(ensureItem(b.list, 'tee', '#1f2a5a', 3, 'scoop').list).toHaveLength(3);
  });
  it('upgrades saved version 1 tees to crew necks, and drops a neckline it does not know', () => {
    const out = cleanItems([
      { v: 1, id: 'old', garment: 'tee', colour: '#1f2a5a', name: 'My tee', savedAt: 1 },
      { v: 2, id: 'vee', garment: 'tee', colour: '#1f2a5a', neckline: 'v', savedAt: 2 },
      { v: 2, id: 'odd', garment: 'tee', colour: '#1f2a5a', neckline: 'polo', savedAt: 3 },
      { v: 1, id: 'sw', garment: 'sweatshirt', colour: '#1f2a5a', neckline: 'v', savedAt: 4 },
    ]);
    expect(out.map((i) => [i.id, i.v, i.neckline])).toEqual([['old', 2, 'crew'], ['vee', 2, 'v'], ['odd', 2, 'crew'], ['sw', 2, undefined]]);
    expect(out[1].name).toBe('Navy V-neck tee');
  });
  it('renaming to blank falls back to the neckline name', () => {
    const v = newItem('tee', '#1f2a5a', 1, 'v');
    expect(renameItem([v], v.id, '  ')[0].name).toBe('Navy V-neck tee');
  });
  it('picks the pack mesh for a neckline, and lists every mesh a garment can use', () => {
    expect(meshName('tee')).toBe('tee');
    expect(meshName('tee', 'crew')).toBe('tee');
    expect(meshName('tee', 'v')).toBe('tee_v');
    expect(meshName('tee', 'scoop')).toBe('tee_scoop');
    expect(meshName('sweatshirt', 'v')).toBe('sweatshirt');
    expect(meshesOf('tee')).toEqual(['tee', 'tee_v', 'tee_scoop']);
    expect(meshesOf('trousers')).toEqual(['trousers']);
  });
  it('describes an item for the library list', () => {
    expect(itemKind(newItem('tee', '#000000', 1, 'scoop'))).toBe('T-shirt, scoop neck');
    expect(itemKind(newItem('trousers', '#000000', 1))).toBe('Trousers');
    expect(itemKind(newItem('shorts', '#000000', 1))).toBe('Shorts');
    expect(meshesOf('shorts')).toEqual(['shorts']);
    expect(newItem('shorts', '#000000', 1, 'v')).not.toHaveProperty('neckline');
  });
});

describe('routes', () => {
  it('knows the wardrobe screen', () => {
    expect(routeFromHash('#/wardrobe')).toBe('wardrobe');
    expect(routeFromHash('#/nonsense')).toBe('try-on');
  });
});
