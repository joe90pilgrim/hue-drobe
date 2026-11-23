import { describe, expect, it } from 'vitest';
import { MATCH_CLOSE_DELTA_E, isClose, preselected, rankCandidates, slotOf } from '../src/match';
import { newTrip, type PackEntry, type Trip } from '../src/trips';
import { GARMENTS, type GarmentId, type SavedItem } from '../src/wardrobe';

const item = (id: string, garment: GarmentId, colour: string, name = id): SavedItem => ({ v: 2, id, garment, colour, name, savedAt: 1 });
const line = (over: Partial<PackEntry> = {}): PackEntry => ({ kind: 'template', ref: 'l1', packed: false, text: 'Jumper', ...over });
const trip = (entries: PackEntry[] = []): Trip => ({ ...newTrip('Prague', '2026-12-11', '2026-12-14', 1), id: 't', entries });
const ids = (r: { item: SavedItem }[]) => r.map((c) => c.item.id);

describe('slotOf', () => {
  it('maps every garment type the prompt can return to its wardrobe slot', () => {
    for (const [type, g] of Object.entries(GARMENTS)) expect(slotOf({ type: type as GarmentId })).toBe(g.slot);
  });

  it('maps the groups the prompt allows when there is no type, ignoring case and spaces', () => {
    expect(slotOf({ group: 'Tops' })).toBe('Top');
    expect(slotOf({ group: ' layers ' })).toBe('Top');
    expect(slotOf({ group: 'BOTTOMS' })).toBe('Bottom');
    expect(slotOf({ group: 'Shoes' })).toBe('Shoes');
  });

  it('prefers the type over the group, and is null for things that are not clothes', () => {
    expect(slotOf({ type: 'trousers', group: 'Tops' })).toBe('Bottom');
    for (const group of ['Toiletries', 'Documents', 'Weather', '']) expect(slotOf({ group })).toBeNull();
    expect(slotOf({})).toBeNull();
  });
});

describe('rankCandidates', () => {
  const wardrobe = [
    item('red', 'sweatshirt', '#b3262e'),
    item('navy', 'sweatshirt', '#1f2a5a'),
    item('blue', 'tee', '#2e5e8c'),
    item('grey-trousers', 'trousers', '#d6d6d6'),
  ];

  it('offers only the line\'s slot, nearest colour first', () => {
    const r = rankCandidates(line({ type: 'sweatshirt', colour: '#2b3a6a' }), wardrobe, trip());
    expect(ids(r)).toEqual(['navy', 'blue', 'red']);
    expect(r[0].distance!).toBeLessThan(r[1].distance!);
    expect(r[1].distance!).toBeLessThan(r[2].distance!);
  });

  it('puts the pieces Gemini matched first, in its order, then the rest by distance', () => {
    const r = rankCandidates(line({ type: 'sweatshirt', colour: '#2b3a6a', matches: ['red', 'blue'] }), wardrobe, trip());
    expect(ids(r)).toEqual(['red', 'blue', 'navy']);
    expect(r.map((c) => c.geminiPick)).toEqual([true, true, false]);
  });

  it('keeps a Gemini pick from another slot, and ignores a pick that is no longer in the wardrobe', () => {
    const r = rankCandidates(line({ type: 'sweatshirt', colour: '#2b3a6a', matches: ['gone', 'grey-trousers'] }), wardrobe, trip());
    expect(ids(r)).toEqual(['grey-trousers', 'navy', 'blue', 'red']);
  });

  it('offers the whole wardrobe with the "all" scope, and for a line with no slot', () => {
    expect(ids(rankCandidates(line({ type: 'sweatshirt', colour: '#2b3a6a' }), wardrobe, trip(), 'all'))).toHaveLength(4);
    expect(ids(rankCandidates(line({ group: 'Documents', colour: '#2b3a6a' }), wardrobe, trip()))).toHaveLength(4);
  });

  it('has no distances without a colour, and keeps wardrobe order', () => {
    const r = rankCandidates(line({ type: 'sweatshirt' }), wardrobe, trip());
    expect(ids(r)).toEqual(['red', 'navy', 'blue']);
    expect(r.every((c) => c.distance === null)).toBe(true);
  });

  it('says whether a piece is on the list by hand, or only because of an outfit', () => {
    const t = trip([
      { kind: 'item', ref: 'red', packed: false, own: true },
      { kind: 'item', ref: 'navy', packed: false, via: ['o1'] },
    ]);
    const r = rankCandidates(line({ type: 'sweatshirt', colour: '#b3262e' }), wardrobe, t);
    expect(Object.fromEntries(r.map((c) => [c.item.id, c.status]))).toEqual({ red: 'on', navy: 'via', blue: null });
  });

  it('gives an empty list when the slot has nothing', () => {
    expect(rankCandidates(line({ type: 'ankle_boots', colour: '#3b2f2a' }), wardrobe, trip())).toEqual([]);
  });
});

describe('isClose', () => {
  it('is true just under the threshold and at it, false just over, and false with no distance', () => {
    expect(isClose(MATCH_CLOSE_DELTA_E - 0.01)).toBe(true);
    expect(isClose(MATCH_CLOSE_DELTA_E)).toBe(true);
    expect(isClose(MATCH_CLOSE_DELTA_E + 0.01)).toBe(false);
    expect(isClose(0)).toBe(true);
    expect(isClose(null)).toBe(false);
  });
});

describe('preselected', () => {
  const wardrobe = [item('a', 'tee', '#1f2a5a'), item('b', 'tee', '#202c5c'), item('c', 'tee', '#b3262e')];

  it('chooses the close pieces, up to the quantity', () => {
    const r = rankCandidates(line({ type: 'tee', colour: '#1f2a5a' }), wardrobe, trip());
    expect(preselected(r, 1)).toEqual(['a']);
    expect(preselected(r, 2)).toEqual(['a', 'b']);
    expect(preselected(r, 3)).toEqual(['a', 'b']); // the red one is not close
  });

  it('chooses a Gemini pick whatever its colour', () => {
    const r = rankCandidates(line({ type: 'tee', colour: '#1f2a5a', matches: ['c'] }), wardrobe, trip());
    expect(preselected(r, 1)).toEqual(['c']);
  });

  it('chooses nothing when nothing is close', () => {
    expect(preselected(rankCandidates(line({ type: 'tee', colour: '#3a7d44' }), [wardrobe[2]], trip()), 1)).toEqual([]);
    expect(preselected(rankCandidates(line({ type: 'tee' }), wardrobe, trip()), 1)).toEqual([]);
  });
});
