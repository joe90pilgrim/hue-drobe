// V7-07: matching a suggested line to a piece you own. Pure functions, no store and no screen, so they can be tested with fixed
// items. The sheet that uses them is screens/packing-match.ts; the list change is `matchLine` in trips.ts.
import { deltaEHex } from './delta-e';
import { GARMENTS, type SavedItem } from './wardrobe';
import type { PackEntry, Trip } from './trips';

/**
 * How near a piece's colour must be to a suggestion's colour (CIEDE2000, see delta-e.ts) to count as "close": the piece is
 * then tagged "Closest" and chosen for you. A piece Gemini matched is chosen whatever its colour.
 *
 * The app does not read `spike/tolerances.json` (that file is for the asset build and its tests), so the number lives here
 * until colour tolerances are set up properly (Joe, V7-07). The value comes from the distances measured in the V7-07 note.
 */
export const MATCH_CLOSE_DELTA_E = 10;

/** True when a colour distance is within the threshold. A suggestion with no colour has no distance, so nothing is close. */
export const isClose = (distance: number | null): boolean => distance !== null && distance <= MATCH_CLOSE_DELTA_E;

/**
 * The wardrobe slot a suggestion needs, or null when it is not clothes (such as "Toiletries"). The `type` Gemini gave wins;
 * without one, the group decides, with the same groups the prompt allows (deploy/packing.mjs). "Layers" are jumpers and the
 * like, which this app keeps in the Top slot.
 */
const GROUP_SLOT: Record<string, string> = { tops: 'Top', layers: 'Top', bottoms: 'Bottom', shoes: 'Shoes' };

export function slotOf(line: Pick<PackEntry, 'type' | 'group'>): string | null {
  if (line.type && Object.prototype.hasOwnProperty.call(GARMENTS, line.type)) return GARMENTS[line.type].slot;
  return GROUP_SLOT[(line.group ?? '').trim().toLowerCase()] ?? null;
}

/** One wardrobe piece offered for a suggestion. `distance` is null when the suggestion has no colour. */
export interface Candidate {
  item: SavedItem;
  distance: number | null;
  geminiPick: boolean;
  /** 'on': already on the list by hand. 'via': on the list only because an outfit holds it. null: not on the list. */
  status: 'on' | 'via' | null;
}

/**
 * The pieces to offer for a suggestion. `scope` 'slot' keeps the suggestion's own slot (every piece when the line has no
 * slot); 'all' offers the whole wardrobe.
 *
 * Order: the pieces Gemini matched come first, in the order it gave them, then the rest from nearest colour to furthest.
 * Gemini saw the names and types as well as the colours, so its pick carries more information than colour distance alone;
 * the distance only orders what Gemini did not choose. A pick is always shown, even from another slot, so the "Gemini matched
 * N" count on the page can never promise a piece the sheet hides. Ties and pieces with no distance keep wardrobe order.
 */
export function rankCandidates(line: PackEntry, items: SavedItem[], trip: Trip, scope: 'slot' | 'all' = 'slot'): Candidate[] {
  const slot = scope === 'slot' ? slotOf(line) : null;
  const picks = (line.matches ?? []).map((id) => items.find((i) => i.id === id)).filter((i): i is SavedItem => !!i);
  const pickIds = new Set(picks.map((i) => i.id));
  const status = (id: string): Candidate['status'] => {
    const e = trip.entries.find((x) => x.kind === 'item' && x.ref === id);
    return !e ? null : e.own ? 'on' : 'via';
  };
  const distance = (i: SavedItem) => (line.colour ? deltaEHex(line.colour, i.colour) : null);
  const make = (i: SavedItem, geminiPick: boolean): Candidate => ({ item: i, distance: distance(i), geminiPick, status: status(i.id) });
  const rest = items
    .filter((i) => !pickIds.has(i.id) && (!slot || GARMENTS[i.garment].slot === slot))
    .map((i) => make(i, false))
    .map((c, order) => ({ c, order }))
    .sort((a, b) => (a.c.distance === null ? 1 : b.c.distance === null ? -1 : a.c.distance - b.c.distance) || a.order - b.order)
    .map((x) => x.c);
  return [...picks.map((i) => make(i, true)), ...rest];
}

/**
 * The pieces the sheet has chosen when it opens: Gemini's picks and pieces within the threshold, in the order shown, up to
 * the number the suggestion needs. Empty when nothing qualifies ("nothing close").
 */
export function preselected(ranked: Candidate[], quantity: number): string[] {
  return ranked
    .filter((c) => c.geminiPick || isClose(c.distance))
    .slice(0, Math.max(1, quantity))
    .map((c) => c.item.id);
}
