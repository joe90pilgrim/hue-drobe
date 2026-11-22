import { describe, expect, it } from 'vitest';
import { cleanTrips, datesError, deleteTrip, formatDates, hasEntry, isDay, newTrip, packedCount, setPacked, todayIso, toggleEntry, updateTrip } from '../src/trips';

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

  it('adds an item or outfit once, and takes it off when it is tapped again', () => {
    const t = newTrip('Trip', '2026-12-14', '2026-12-14', 1);
    let list = toggleEntry([t], t.id, 'item', 'tee-1');
    expect(list[0].entries).toEqual([{ kind: 'item', ref: 'tee-1', packed: false }]);
    expect(hasEntry(list[0], 'item', 'tee-1')).toBe(true);
    list = toggleEntry(list, t.id, 'outfit', 'tee-1'); // same id, different kind: a separate entry
    expect(list[0].entries).toHaveLength(2);
    list = toggleEntry(list, t.id, 'item', 'tee-1');
    expect(list[0].entries).toEqual([{ kind: 'outfit', ref: 'tee-1', packed: false }]);
  });

  it('ticks an entry as packed and counts them', () => {
    const t = newTrip('Trip', '2026-12-14', '2026-12-14', 1);
    let list = toggleEntry(toggleEntry([t], t.id, 'item', 'a'), t.id, 'item', 'b');
    expect(packedCount(list[0])).toEqual({ packed: 0, total: 2 });
    list = setPacked(list, t.id, 'item', 'a', true);
    expect(packedCount(list[0])).toEqual({ packed: 1, total: 2 });
    expect(list[0].entries.find((e) => e.ref === 'a')?.packed).toBe(true);
    list = setPacked(list, t.id, 'item', 'a', false);
    expect(packedCount(list[0])).toEqual({ packed: 0, total: 2 });
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
    expect(out[0]).toMatchObject({ name: 'Trip', savedAt: 0, entries: [{ kind: 'item', ref: 'x', packed: false }] });
  });
});
