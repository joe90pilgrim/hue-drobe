// Packing lists (V4-03): a trip has a name and dates, and holds saved clothes and saved outfits to tick off as packed.
// Stored on the device with the other data, and synced like it (see backup.ts and deploy/datastore.mjs).
import { kvGet, kvPut } from './store';
import { cleanName } from './wardrobe';

/** One thing on a list: a saved item or a saved outfit, by id, and whether it is packed. */
export interface PackEntry {
  kind: 'item' | 'outfit';
  ref: string;
  packed: boolean;
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
    const { kind, ref, packed } = raw as Record<string, unknown>;
    if ((kind !== 'item' && kind !== 'outfit') || typeof ref !== 'string' || !ref) continue;
    if (out.some((e) => e.kind === kind && e.ref === ref)) continue;
    out.push({ kind, ref, packed: packed === true });
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

/** Puts an item or outfit on the list (not packed yet), or takes it off when it is already there. */
export function toggleEntry(list: Trip[], id: string, kind: PackEntry['kind'], ref: string): Trip[] {
  return mapTrip(list, id, (t) =>
    hasEntry(t, kind, ref)
      ? { ...t, entries: t.entries.filter((e) => !(e.kind === kind && e.ref === ref)) }
      : { ...t, entries: [...t.entries, { kind, ref, packed: false }] },
  );
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
  return { packed: trip.entries.filter((e) => e.packed).length, total: trip.entries.length };
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
