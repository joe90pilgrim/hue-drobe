import { describe, expect, it } from 'vitest';
import { inOutfitOnly, peekItems, addOutfit, backfillOutfitPieces, cleanTrips, editTemplateLine, removeEntry, replaceTemplate, templateText, removeOutfit, datesError, deleteTrip, formatDates, hasEntry, isDay, matchesSearch, newTrip, packedCount, setPacked, todayIso, toggleEntry, updateTrip, type Trip } from '../src/trips';

describe('picker search', () => {
  it('matches any part of a name, ignoring case and spaces at the ends', () => {
    expect(matchesSearch('  NAVY ', ['Navy tee', 'T-shirt, crew neck'])).toBe(true);
    expect(matchesSearch('crew', ['Navy tee', 'T-shirt, crew neck'])).toBe(true);
    expect(matchesSearch('denim', ['Navy tee', 'T-shirt, crew neck'])).toBe(false);
  });

  it('matches everything when the search is blank', () => {
    expect(matchesSearch('', ['Navy tee'])).toBe(true);
    expect(matchesSearch('   ', [])).toBe(true);
  });
});

describe('trip dates', () => {
  it('accepts only real calendar days written as YYYY-MM-DD', () => {
    expect(isDay('2026-12-14')).toBe(true);
    expect(isDay('2026-02-29')).toBe(false); // 2026 is not a leap year
    expect(isDay('14/12/2026')).toBe(false);
    expect(isDay('')).toBe(false);
    expect(isDay(null)).toBe(false);
  });

  it('asks for both dates, and an end that is not before the start', () => {
    expect(datesError('', '2026-12-20')).toBe('Enter both dates.');
    expect(datesError('2026-12-14', '2026-12-13')).toBe('The end date is before the start date.');
    expect(datesError('2026-12-14', '2026-12-14')).toBeNull();
    expect(datesError('2026-12-14', '2026-12-20')).toBeNull();
  });

  it('formats a range in short form, with the year once when it is the same', () => {
    expect(formatDates('2026-12-14', '2026-12-14')).toBe('14 Dec 2026');
    expect(formatDates('2026-12-14', '2026-12-20')).toBe('14 Dec – 20 Dec 2026');
    expect(formatDates('2026-12-28', '2027-01-03')).toBe('28 Dec 2026 – 3 Jan 2027');
  });

  it('gives today in the device time zone, zero-padded', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('trips', () => {
  it('makes a trip with a name, dates and no entries, and falls back to a name when blank', () => {
    const t = newTrip('  Lisbon  weekend ', '2026-12-14', '2026-12-16', 7);
    expect(t).toMatchObject({ v: 1, name: 'Lisbon weekend', starts: '2026-12-14', ends: '2026-12-16', entries: [], savedAt: 7 });
    expect(t.id).toBeTruthy();
    expect(newTrip('   ', '2026-12-14', '2026-12-14').name).toBe('Trip');
  });

  it('adds an item by hand once, and takes it off when it is tapped again', () => {
    const t = newTrip('Trip', '2026-12-14', '2026-12-14', 1);
    let list = toggleEntry([t], t.id, 'tee-1');
    expect(list[0].entries).toEqual([{ kind: 'item', ref: 'tee-1', packed: false, own: true }]);
    expect(hasEntry(list[0], 'item', 'tee-1')).toBe(true);
    list = toggleEntry(list, t.id, 'tee-1');
    expect(list[0].entries).toEqual([]);
  });

  it('ticks items as packed and counts them', () => {
    const t = newTrip('Trip', '2026-12-14', '2026-12-14', 1);
    let list = toggleEntry(toggleEntry([t], t.id, 'a'), t.id, 'b');
    expect(packedCount(list[0])).toEqual({ packed: 0, total: 2 });
    list = setPacked(list, t.id, 'item', 'a', true);
    expect(packedCount(list[0])).toEqual({ packed: 1, total: 2 });
    expect(list[0].entries.find((e) => e.ref === 'a')?.packed).toBe(true);
    list = setPacked(list, t.id, 'item', 'a', false);
    expect(packedCount(list[0])).toEqual({ packed: 0, total: 2 });
  });

  it('adds an outfit as a planned look plus one item entry per garment, and counts garments only', () => {
    const t = newTrip('Trip', '2026-12-14', '2026-12-14', 1);
    const list = addOutfit([t], t.id, 'o1', ['tee', 'trousers']);
    expect(list[0].entries).toEqual([
      { kind: 'outfit', ref: 'o1', packed: false },
      { kind: 'item', ref: 'tee', packed: false, via: ['o1'] },
      { kind: 'item', ref: 'trousers', packed: false, via: ['o1'] },
    ]);
    expect(packedCount(list[0])).toEqual({ packed: 0, total: 2 });
    expect(packedCount(setPacked(list, t.id, 'item', 'tee', true)[0])).toEqual({ packed: 1, total: 2 });
  });

  it('lists a garment shared by two outfits once, and keeps it until both are gone', () => {
    const t = newTrip('Trip', '2026-12-14', '2026-12-14', 1);
    let list = addOutfit(addOutfit([t], t.id, 'o1', ['tee', 'trousers']), t.id, 'o2', ['tee', 'shoes']);
    expect(list[0].entries.filter((e) => e.ref === 'tee')).toEqual([{ kind: 'item', ref: 'tee', packed: false, via: ['o1', 'o2'] }]);
    expect(addOutfit(list, t.id, 'o2', ['tee', 'shoes'])).toEqual(list);
    list = removeOutfit(list, t.id, 'o1');
    expect(list[0].entries.map((e) => e.ref)).toEqual(['tee', 'o2', 'shoes']);
    list = removeOutfit(list, t.id, 'o2');
    expect(list[0].entries).toEqual([]);
  });

  it('keeps a hand-added garment when its outfit is removed, and when its hand-add is removed while an outfit needs it', () => {
    const t = newTrip('Trip', '2026-12-14', '2026-12-14', 1);
    let list = addOutfit(toggleEntry([t], t.id, 'tee'), t.id, 'o1', ['tee', 'trousers']);
    expect(list[0].entries.find((e) => e.ref === 'tee')).toEqual({ kind: 'item', ref: 'tee', packed: false, via: ['o1'], own: true });
    const removed = removeOutfit(list, t.id, 'o1');
    expect(removed[0].entries).toEqual([{ kind: 'item', ref: 'tee', packed: false, own: true }]);
    list = toggleEntry(list, t.id, 'tee');
    expect(list[0].entries.find((e) => e.ref === 'tee')).toEqual({ kind: 'item', ref: 'tee', packed: false, via: ['o1'] });
    list = toggleEntry(list, t.id, 'tee');
    expect(list[0].entries.find((e) => e.ref === 'tee')?.own).toBe(true);
  });

  it('keeps an item whose wardrobe entry was deleted until it is taken off', () => {
    const t = newTrip('Trip', '2026-12-14', '2026-12-14', 1);
    const list = addOutfit([t], t.id, 'o1', ['gone']);
    expect(list[0].entries.some((e) => e.ref === 'gone')).toBe(true);
    expect(removeEntry(list, t.id, 'item', 'gone')[0].entries.map((e) => e.ref)).toEqual(['o1']);
  });

  it('backfills the garments of outfits saved before V4-04, packed when the outfit was ticked, and then changes nothing', () => {
    const old = cleanTrips([
      {
        id: 't', name: 'Old', starts: '2026-12-14', ends: '2026-12-14', savedAt: 1,
        entries: [{ kind: 'item', ref: 'tee', packed: false }, { kind: 'outfit', ref: 'o1', packed: true }, { kind: 'outfit', ref: 'o2', packed: false }, { kind: 'outfit', ref: 'deleted', packed: false }],
      },
    ]);
    const pieces: Record<string, string[]> = { o1: ['tee', 'trousers'], o2: ['shoes'] };
    const done = backfillOutfitPieces(old, (id) => pieces[id] ?? []);
    expect(done[0].entries).toEqual([
      { kind: 'item', ref: 'tee', packed: true, via: ['o1'], own: true },
      { kind: 'outfit', ref: 'o1', packed: false },
      { kind: 'outfit', ref: 'o2', packed: false },
      { kind: 'outfit', ref: 'deleted', packed: false },
      { kind: 'item', ref: 'trousers', packed: true, via: ['o1'] },
      { kind: 'item', ref: 'shoes', packed: false, via: ['o2'] },
    ]);
    expect(packedCount(done[0])).toEqual({ packed: 2, total: 3 });
    expect(backfillOutfitPieces(done, (id) => pieces[id] ?? [])).toBe(done);
  });

  it('loads a trip with or without the new fields, and the backfill clears an old tick on an outfit', () => {
    const out = cleanTrips([
      { id: 'a', name: 'New', starts: '2026-12-14', ends: '2026-12-14', savedAt: 1, entries: [{ kind: 'item', ref: 'x', packed: true, via: ['o', 'o', 3] }, { kind: 'outfit', ref: 'o', packed: true }] },
    ]);
    expect(out[0].entries).toEqual([{ kind: 'item', ref: 'x', packed: true, via: ['o'] }, { kind: 'outfit', ref: 'o', packed: true }]);
    expect(packedCount(out[0])).toEqual({ packed: 1, total: 1 });
  });

  it('renames and re-dates a trip, and deletes it', () => {
    const t = newTrip('Trip', '2026-12-14', '2026-12-14', 1);
    let list = updateTrip([t], t.id, 'Ski week', '2027-02-01', '2027-02-08');
    expect(list[0]).toMatchObject({ name: 'Ski week', starts: '2027-02-01', ends: '2027-02-08' });
    expect(deleteTrip(list, t.id)).toEqual([]);
  });

  it('keeps only valid trips and entries when loading, oldest first, and drops bad dates', () => {
    const good = newTrip('Good', '2026-12-14', '2026-12-16', 5);
    const out = cleanTrips([
      good,
      good,
      { id: 'a', name: 'Backwards', starts: '2026-12-16', ends: '2026-12-14', entries: [], savedAt: 1 },
      { id: 'b', name: 'Bad day', starts: '2026-02-30', ends: '2026-03-01', entries: [], savedAt: 1 },
      { id: 'c', name: 3, starts: '2026-01-01', ends: '2026-01-01', entries: [{ kind: 'item', ref: 'x', packed: 'yes' }, { kind: 'shoe', ref: 'y' }, { kind: 'item', ref: 'x' }], savedAt: 'late' },
      null,
    ]);
    expect(out.map((t) => t.id)).toEqual(['c', good.id]);
    expect(out[0]).toMatchObject({ name: 'Trip', savedAt: 0, entries: [{ kind: 'item', ref: 'x', packed: false, own: true }] });
  });
});

describe('template lines (V6-01)', () => {
  const lines = [{ label: 'Socks', quantity: 3, group: 'Clothes' }, { label: 'Passport' }];
  const refs = () => {
    let n = 0;
    return () => `r${++n}`;
  };
  const trip = () => newTrip('Lisbon', '2026-12-14', '2026-12-16', 1);

  it('shows the quantity only when there is more than one', () => {
    expect(templateText({ label: 'Socks', quantity: 3 })).toBe('3 × Socks');
    expect(templateText({ label: 'Passport', quantity: 1 })).toBe('Passport');
    expect(templateText({ label: '  Rain   jacket ' })).toBe('Rain jacket');
  });

  it('adds template lines, each with its own tick, and counts them as packable', () => {
    const t = trip();
    let list = replaceTemplate([t], t.id, lines, refs());
    expect(list[0].entries).toEqual([
      { kind: 'template', ref: 'r1', packed: false, text: '3 × Socks', group: 'Clothes' },
      { kind: 'template', ref: 'r2', packed: false, text: 'Passport' },
    ]);
    list = setPacked(list, t.id, 'template', 'r1', true);
    expect(packedCount(list[0])).toEqual({ packed: 1, total: 2 });
  });

  it('replaces the template lines only: items, outfits and their ticks stay', () => {
    const t = trip();
    let list = toggleEntry([t], t.id, 'tee-1');
    list = addOutfit(list, t.id, 'o-1', ['tee-1', 'trousers-1']);
    list = setPacked(list, t.id, 'item', 'tee-1', true);
    list = replaceTemplate(list, t.id, lines, refs());
    list = setPacked(list, t.id, 'template', 'r1', true);
    list = replaceTemplate(list, t.id, [{ label: 'Umbrella' }], refs());
    const kinds = list[0].entries.map((e) => `${e.kind}:${e.ref}:${e.packed}`);
    expect(kinds).toEqual(['item:tee-1:true', 'outfit:o-1:false', 'item:trousers-1:false', 'template:r1:false']);
    expect(list[0].entries.find((e) => e.kind === 'template')?.text).toBe('Umbrella');
    // Only that trip changes.
    const other = trip();
    expect(replaceTemplate([t, other], t.id, lines, refs())[1]).toBe(other);
  });

  it('edits a line, ignores blank text, and removes a line on its own', () => {
    const t = trip();
    let list = replaceTemplate([t], t.id, lines, refs());
    list = editTemplateLine(list, t.id, 'r2', '  Passport and visa ');
    expect(list[0].entries[1].text).toBe('Passport and visa');
    expect(editTemplateLine(list, t.id, 'r2', '   ')).toBe(list);
    list = removeEntry(list, t.id, 'template', 'r1');
    expect(list[0].entries.map((e) => e.ref)).toEqual(['r2']);
  });

  it('cleans template entries on load, and leaves trips without them unchanged', () => {
    const base = { v: 1, id: 't', name: 'Lisbon', starts: '2026-12-14', ends: '2026-12-16', savedAt: 1 };
    const out = cleanTrips([
      {
        ...base,
        entries: [
          { kind: 'template', ref: 'a', packed: true, text: '  3 ×   Socks ', group: ' Clothes ' },
          { kind: 'template', ref: 'a', text: 'duplicate' },
          { kind: 'template', ref: 'b', text: '   ' },
          { kind: 'template', ref: 'c' },
          { kind: 'template', text: 'no ref' },
          { kind: 'template', ref: 'd', packed: 'yes', text: 'x'.repeat(100), group: 7 },
          { kind: 'item', ref: 'tee-1', packed: false, own: true },
        ],
      },
    ]);
    expect(out[0].entries).toEqual([
      { kind: 'template', ref: 'a', packed: true, text: '3 × Socks', group: 'Clothes' },
      { kind: 'template', ref: 'd', packed: false, text: 'x'.repeat(60) },
      { kind: 'item', ref: 'tee-1', packed: false, own: true },
    ]);
    const plain = { ...base, entries: [{ kind: 'item', ref: 'tee-1', packed: true, own: true }, { kind: 'outfit', ref: 'o-1', packed: false }] };
    expect(cleanTrips([plain])[0].entries).toEqual(plain.entries);
  });
});

describe('inOutfitOnly (V7-04)', () => {
  const trip = (entries: Trip['entries']): Trip => ({ ...newTrip('T', '2026-12-01', '2026-12-02'), entries });
  it('is false for an own item', () => expect(inOutfitOnly(trip([{ kind: 'item', ref: 'a', packed: false, own: true }]), 'a')).toBe(false));
  it('is true for an item only an outfit holds', () => expect(inOutfitOnly(trip([{ kind: 'item', ref: 'a', packed: false, via: ['o'] }]), 'a')).toBe(true));
  it('is false for an item both own and in an outfit', () => expect(inOutfitOnly(trip([{ kind: 'item', ref: 'a', packed: false, own: true, via: ['o'] }]), 'a')).toBe(false));
  it('is false for an item not on the list', () => expect(inOutfitOnly(trip([]), 'a')).toBe(false));
});

describe('peekItems', () => {
  const item = (id: string) => ({ v: 2, id, garment: 'tee', colour: '#000000', name: id, savedAt: 1 }) as never;
  const wardrobe = ['a', 'b', 'c', 'd', 'e'].map(item);
  const trip = (refs: string[]): Trip => ({ ...newTrip('T', '2026-12-01', '2026-12-02'), entries: refs.map((ref) => ({ kind: 'item' as const, ref, packed: false })) });
  const ids = (refs: string[]) => peekItems(trip(refs), wardrobe).map((i) => i.id);
  it('is empty for a trip with no items', () => expect(ids([])).toEqual([]));
  it('returns fewer than four when there are fewer', () => expect(ids(['a', 'b'])).toEqual(['a', 'b']));
  it('stops at four, in list order', () => expect(ids(['e', 'd', 'c', 'b', 'a'])).toEqual(['e', 'd', 'c', 'b']));
  it('skips a deleted item and outfit or template entries', () => {
    const t = trip(['a', 'gone', 'b']);
    t.entries.push({ kind: 'outfit', ref: 'o', packed: false }, { kind: 'template', ref: 't', packed: false, text: 'Socks' } as never);
    expect(peekItems(t, wardrobe).map((i) => i.id)).toEqual(['a', 'b']);
  });
});
