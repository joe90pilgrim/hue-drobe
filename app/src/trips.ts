// Packing lists (V4-03): a trip has a name and dates, and holds saved clothes and saved outfits to tick off as packed.
// Stored on the device with the other data, and synced like it (see backup.ts and deploy/datastore.mjs).
import { kvGet, kvPut } from './store';
import { cleanName } from './wardrobe';

/**
 * One thing on a list: a saved item or a saved outfit, by id. Items are packed and ticked off. An outfit is a "planned
 * look": it is never ticked, and its garments are the item entries that name it in `via` (V4-04). Both extra fields are
 * optional, so lists saved before V4-04 still load.
 */
export interface PackEntry {
  kind: 'item' | 'outfit';
  ref: string;
  packed: boolean;
  /** Item entries only: ids of the outfits that brought this item onto the list. */
  via?: string[];
  /** Item entries only: true when the item was also added by hand. */
  own?: true;
}

/**
 * The stored record. `v` is the record version, as for saved items. Dates are local calendar days, `YYYY-MM-DD`, so
 * they compare as text. An entry whose item or outfit was deleted stays on the list and shows as removed.
 */
export interface Trip {
  v: 1;
  id: string;
  name: string;
  starts: string;
  ends: string;
  entries: PackEntry[];
  /** Milliseconds since 1970; the list shows trips in this order. */
  savedAt: number;
}

export const TRIPS_KEY = 'trips';
const FALLBACK_NAME = 'Trip';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** True for a real calendar day written as `YYYY-MM-DD`. */
export function isDay(s: unknown): s is string {
  if (typeof s !== 'string' || !DAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Today as `YYYY-MM-DD`, in the device's own time zone. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The message to show for a date range, or null when it is fine: both days given, and the end not before the start. */
export function datesError(starts: string, ends: string): string | null {
  if (!isDay(starts) || !isDay(ends)) return 'Enter both dates.';
  if (ends < starts) return 'The end date is before the start date.';
  return null;
}

/** Such as '14 Dec 2026' for one day, or '14 Dec – 20 Dec 2026' when the years match, or the full dates when they do not. */
export function formatDates(starts: string, ends: string): string {
  const day = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return { y, m, d };
  };
  const a = day(starts);
  const b = day(ends);
  const label = (x: { y: number; m: number; d: number }) => `${x.d} ${MONTHS[x.m - 1]}`;
  if (starts === ends) return `${label(a)} ${a.y}`;
  if (a.y === b.y) return `${label(a)} – ${label(b)} ${b.y}`;
  return `${label(a)} ${a.y} – ${label(b)} ${b.y}`;
}

/** Keeps only valid, unique trips, oldest first. Anything else stored is dropped. */
export function cleanTrips(value: unknown): Trip[] {
  if (!Array.isArray(value)) return [];
  const out: Trip[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id || out.some((t) => t.id === r.id)) continue;
    const starts = r.starts;
    const ends = r.ends;
    if (!isDay(starts) || !isDay(ends) || ends < starts) continue;
    out.push({
      v: 1,
      id: r.id,
      name: cleanName(typeof r.name === 'string' ? r.name : '', FALLBACK_NAME),
      starts,
      ends,
      entries: cleanEntries(r.entries),
      savedAt: typeof r.savedAt === 'number' && Number.isFinite(r.savedAt) ? r.savedAt : 0,
    });
  }
  return out.sort((a, b) => a.savedAt - b.savedAt);
}

/** Keeps the entries that name an item or an outfit, once each. */
function cleanEntries(value: unknown): PackEntry[] {
  if (!Array.isArray(value)) return [];
  const out: PackEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const { kind, ref, packed, via, own } = raw as Record<string, unknown>;
    if ((kind !== 'item' && kind !== 'outfit') || typeof ref !== 'string' || !ref) continue;
    if (out.some((e) => e.kind === kind && e.ref === ref)) continue;
    if (kind === 'outfit') {
      out.push({ kind, ref, packed: packed === true }); // an old tick is read by the backfill, then cleared
      continue;
    }
    const ids = Array.isArray(via) ? [...new Set(via.filter((v): v is string => typeof v === 'string' && !!v))] : [];
    // An item that no outfit brought in can only have been added by hand, so lists saved before V4-04 count as hand-added.
    const entry: PackEntry = { kind, ref, packed: packed === true };
    if (ids.length) entry.via = ids;
    if (own === true || !ids.length) entry.own = true;
    out.push(entry);
  }
  return out;
}

export function newTrip(name: string, starts: string, ends: string, now = Date.now()): Trip {
  const id = globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`;
  return { v: 1, id, name: cleanName(name, FALLBACK_NAME), starts, ends, entries: [], savedAt: now };
}

/** Changes a trip's name and dates. The caller checks the dates first with `datesError`. */
export function updateTrip(list: Trip[], id: string, name: string, starts: string, ends: string): Trip[] {
  return mapTrip(list, id, (t) => ({ ...t, name: cleanName(name, FALLBACK_NAME), starts, ends }));
}

export function deleteTrip(list: Trip[], id: string): Trip[] {
  return list.filter((t) => t.id !== id);
}

export const hasEntry = (trip: Trip, kind: PackEntry['kind'], ref: string) => trip.entries.some((e) => e.kind === kind && e.ref === ref);

/** Items on a list are tickable; outfits are planned looks and are not. */
const isItem = (e: PackEntry) => e.kind === 'item';

/**
 * Hand-adds an item (not packed yet), or takes the hand-add off when it was already hand-added. An item that an outfit
 * also needs stays on the list. Outfits go through `addOutfit` and `removeOutfit`.
 */
export function toggleEntry(list: Trip[], id: string, ref: string): Trip[] {
  return mapTrip(list, id, (t) => {
    const e = t.entries.find((x) => x.kind === 'item' && x.ref === ref);
    if (!e) return { ...t, entries: [...t.entries, { kind: 'item', ref, packed: false, own: true }] };
    if (!e.own) return { ...t, entries: t.entries.map((x) => (x === e ? { ...x, own: true } : x)) };
    if (e.via?.length) return { ...t, entries: t.entries.map((x) => (x === e ? withoutOwn(x) : x)) };
    return { ...t, entries: t.entries.filter((x) => x !== e) };
  });
}

function withoutOwn(e: PackEntry): PackEntry {
  const { own: _own, ...rest } = e;
  return rest;
}

/** Takes one entry off the list whatever else needs it. Used for entries whose item was deleted from the wardrobe. */
export function removeEntry(list: Trip[], id: string, kind: PackEntry['kind'], ref: string): Trip[] {
  return mapTrip(list, id, (t) => ({ ...t, entries: t.entries.filter((e) => !(e.kind === kind && e.ref === ref)) }));
}

/** Adds the outfit as a planned look and each of its items as an entry, once each. Items already there just record the outfit. */
export function addOutfit(list: Trip[], id: string, outfitId: string, itemIds: string[]): Trip[] {
  return mapTrip(list, id, (t) => ({ ...t, entries: withOutfit(t.entries, outfitId, itemIds) }));
}

function withOutfit(entries: PackEntry[], outfitId: string, itemIds: string[], packed = false): PackEntry[] {
  let out = entries.some((e) => e.kind === 'outfit' && e.ref === outfitId) ? entries : [...entries, { kind: 'outfit' as const, ref: outfitId, packed: false }];
  for (const ref of new Set(itemIds)) {
    const e = out.find((x) => x.kind === 'item' && x.ref === ref);
    if (!e) {
      out = [...out, { kind: 'item', ref, packed, via: [outfitId] }];
    } else if (!e.via?.includes(outfitId) || (packed && !e.packed)) {
      out = out.map((x) => (x === e ? { ...x, via: [...new Set([...(x.via ?? []), outfitId])], packed: x.packed || packed } : x));
    }
  }
  return out;
}

/** Takes the outfit off, and the items only it brought in. Items added by hand or by another outfit stay. */
export function removeOutfit(list: Trip[], id: string, outfitId: string): Trip[] {
  return mapTrip(list, id, (t) => ({
    ...t,
    entries: t.entries.flatMap((e): PackEntry[] => {
      if (e.kind === 'outfit') return e.ref === outfitId ? [] : [e];
      if (!e.via?.includes(outfitId)) return [e];
      const via = e.via.filter((v) => v !== outfitId);
      if (!via.length && !e.own) return [];
      const { via: _via, ...rest } = e;
      return [via.length ? { ...rest, via } : rest];
    }),
  }));
}

/**
 * One-off backfill for trips saved before V4-04, which hold outfit entries with no items. Each outfit's items are added
 * (packed if the outfit was ticked) and the outfit stops being ticked. Safe to run on every load: once done it changes
 * nothing, and it returns the same list object so the caller can tell.
 */
export function backfillOutfitPieces(list: Trip[], itemsOf: (outfitId: string) => string[]): Trip[] {
  let changed = false;
  const out = list.map((t) => {
    let entries = t.entries;
    for (const o of t.entries.filter((e) => e.kind === 'outfit')) {
      const next = withOutfit(entries, o.ref, itemsOf(o.ref), o.packed);
      if (next !== entries || o.packed) {
        entries = next.map((e) => (e.kind === 'outfit' && e.ref === o.ref ? { ...e, packed: false } : e));
      }
    }
    if (entries === t.entries) return t;
    changed = true;
    return { ...t, entries };
  });
  return changed ? out : list;
}

/** Ticks an entry as packed, or unticks it. */
export function setPacked(list: Trip[], id: string, kind: PackEntry['kind'], ref: string, packed: boolean): Trip[] {
  return mapTrip(list, id, (t) => ({ ...t, entries: t.entries.map((e) => (e.kind === kind && e.ref === ref ? { ...e, packed } : e)) }));
}

/** Basic search: the query, ignoring case and spaces at the ends, appears in one of the texts. A blank query matches everything. */
export function matchesSearch(query: string, texts: string[]): boolean {
  const q = query.trim().toLowerCase();
  return !q || texts.some((t) => t.toLowerCase().includes(q));
}

export function packedCount(trip: Trip): { packed: number; total: number } {
  const items = trip.entries.filter(isItem);
  return { packed: items.filter((e) => e.packed).length, total: items.length };
}

function mapTrip(list: Trip[], id: string, fn: (t: Trip) => Trip): Trip[] {
  return list.map((t) => (t.id === id ? fn(t) : t));
}

export async function loadTrips(): Promise<Trip[]> {
  return cleanTrips(await kvGet<unknown>(TRIPS_KEY, []));
}

export async function saveTrips(list: Trip[]): Promise<void> {
  await kvPut(TRIPS_KEY, list);
}
