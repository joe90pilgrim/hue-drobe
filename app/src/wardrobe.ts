// Saved clothes: a garment in a colour, with a name. Stored on the device.
import { kvGet, kvPut } from './store';

/** Garments in the avatar pack that can be saved, with the Dress slot and option that shows each one. */
export const GARMENTS = {
  tee: { label: 'tee', slot: 'Top', option: 'T-shirt' },
  sweatshirt: { label: 'sweatshirt', slot: 'Top', option: 'Sweatshirt' },
  // V3-03: a collared shirt, untucked, in three sleeve lengths. Each length is a garment of its own (its own pack mesh, its own saved items),
  // so the stored records need no new field; each length keeps its own colour.
  shirt_short: { label: 'short-sleeve shirt', slot: 'Top', option: 'Shirt, short sleeves' },
  shirt_mid: { label: 'mid-sleeve shirt', slot: 'Top', option: 'Shirt, mid sleeves' },
  shirt_long: { label: 'long-sleeve shirt', slot: 'Top', option: 'Shirt, long sleeves' },
  trousers: { label: 'trousers', slot: 'Bottom', option: 'Trousers' },
  shorts: { label: 'shorts', slot: 'Bottom', option: 'Shorts' },
  // V2-04: a layer of its own, under the shorts (never the trousers), so it has its own slot.
  tights: { label: 'tights', slot: 'Legs', option: 'Tights' },
  // V3-01b: a bottom, so it replaces the trousers or shorts. Women's packs only (the Dress screen offers it when the pack has it).
  skirt: { label: 'skirt', slot: 'Bottom', option: 'Skirt' },
  // V3-02: the pack's shift dress, a slot of its own that replaces the top and the bottom (see `keepLayers`). Women's packs only.
  dress: { label: 'dress', slot: 'Dress', option: 'Shift dress' },
} as const;
export type GarmentId = keyof typeof GARMENTS;

/**
 * Tee necklines (V1.1-04). `label` is the Dress button, `words` is how a neckline reads in a list, and `name` is the
 * word put in an automatic name (the crew neck is the plain 'tee', so it adds nothing).
 */
export const NECKLINES = {
  crew: { label: 'Crew', words: 'crew neck', name: '' },
  v: { label: 'V-neck', words: 'V-neck', name: 'V-neck' },
  scoop: { label: 'Scoop', words: 'scoop neck', name: 'scoop-neck' },
} as const;
export type Neckline = keyof typeof NECKLINES;
export const DEFAULT_NECKLINE: Neckline = 'crew';
export const isNeckline = (x: unknown): x is Neckline => typeof x === 'string' && Object.keys(NECKLINES).includes(x);
/** Only the tee has necklines. */
export const hasNecklines = (garment: GarmentId) => garment === 'tee';

/** Only tights come opaque or sheer (V2-04, decided by Joe on 16 Nov 2026). Sheer is a display setting: the same mesh, partly see-through. */
export const hasSheer = (garment: GarmentId) => garment === 'tights';
/** The sheerness the Dress screen shows on the tights: true for sheer. */
export const SHEER_KEY = 'sheer';
/** Joe's decision (16 Nov 2026): tights go under shorts (and skirts in v3), never under trousers. */
export const TIGHTS_BLOCKED_BY = 'Trousers';

/**
 * Joe's decision (17 Nov 2026, V3-01b): a top is tucked into a skirt. The tee has a version cut flat at the skirt's waistband,
 * and it is that version that is shown while the skirt is worn. The sweatshirt has no such version (its ribbed hem would not
 * tuck), so it cannot be worn with a skirt. Nor can the shirts (V3-03): Joe's decision of 17 Nov 2026 is that a shirt is untucked
 * first, so a shirt, like the sweatshirt, gives way to a skirt and the other way round.
 */
export const TUCKS_INTO = 'Skirt';
/** The tops that are never tucked in: the sweatshirt and the three shirts. */
export const NOT_WITH_SKIRT: readonly string[] = ['Sweatshirt', GARMENTS.shirt_short.option, GARMENTS.shirt_mid.option, GARMENTS.shirt_long.option];
export const isUntuckedTop = (option: string | undefined) => !!option && NOT_WITH_SKIRT.includes(option);
/** True when the outfit shows the tucked-in tee: a tee over a skirt. */
export const isTucked = (outfit: Record<string, string>) => outfit.Bottom === TUCKS_INTO && outfit.Top === GARMENTS.tee.option;

/** V3-06: the slot a dress goes in. A dress covers the top and the bottom, so it takes the place of both (see `keepLayers`). */
export const DRESS_SLOT = 'Dress';
/** The pack meshes for the dress, and the body drawn in place of `body` while it is worn (the body with the parts under the dress removed). */
export const DRESS_OPTION = 'Shift dress';
const isOn = (option: string | undefined) => !!option && option !== 'None';

/**
 * Keeps an outfit (slot -> option) to the layering rules. `changed` is the slot just set; the other one gives way, so wearing
 * something from the wardrobe takes off what it cannot go with, and the other way round. With no `changed`, the layer named
 * first below gives way.
 *  - A dress (V3-06, Joe's decision of 16 Nov 2026) replaces the top and the bottom: putting it on takes both off, and putting a top or
 *    a bottom on takes the dress off. With no `changed`, the dress wins. Tights are a separate layer and stay.
 *  - Tights and trousers are never worn together (V2-04); the trousers give way to tights just put on, otherwise the tights go.
 *  - A sweatshirt or a shirt (V3-03) and a skirt are never worn together (V3-01b); the top gives way to a skirt just put on, otherwise the skirt goes.
 */
export function keepLayers(outfit: Record<string, string>, changed?: string): Record<string, string> {
  let o = outfit;
  if (isOn(o[DRESS_SLOT]) && (isOn(o.Top) || isOn(o.Bottom))) {
    o = changed === 'Top' || changed === 'Bottom' ? { ...o, [DRESS_SLOT]: 'None' } : { ...o, Top: 'None', Bottom: 'None' };
  }
  if (o.Legs === GARMENTS.tights.option && o.Bottom === TIGHTS_BLOCKED_BY) o = changed === 'Legs' ? { ...o, Bottom: 'None' } : { ...o, Legs: 'None' };
  if (isUntuckedTop(o.Top) && o.Bottom === TUCKS_INTO) o = changed === 'Bottom' ? { ...o, Top: 'None' } : { ...o, Bottom: 'None' };
  return o;
}

/** The avatar pack mesh that shows a garment: the crew tee is `tee`, the others `tee_v` and `tee_scoop`; `tucked` (a tee over a skirt) adds `_tucked`. */
export function meshName(garment: GarmentId, neckline: Neckline = DEFAULT_NECKLINE, tucked = false): string {
  const base = hasNecklines(garment) && neckline !== DEFAULT_NECKLINE ? `${garment}_${neckline}` : garment;
  return tucked && hasNecklines(garment) ? `${base}_tucked` : base;
}

/** Every pack mesh a garment can be shown with: its necklines, and with `tucked` their tucked-in versions (tees only). */
export function meshesOf(garment: GarmentId, tucked = false): string[] {
  return hasNecklines(garment) ? (Object.keys(NECKLINES) as Neckline[]).map((n) => meshName(garment, n, tucked)) : [garment];
}

/**
 * The stored record. `v` is the record version: a later version can add a photo, an owner or a source
 * (v2 and v4) as optional fields and bump `v`, and `cleanItems` upgrades older records on load.
 * Version 2 (V1.1-04) added `neckline`; version 1 tees load as crew necks.
 */
export interface SavedItem {
  v: 2;
  id: string;
  garment: GarmentId;
  /** Tees only; absent on other garments. */
  neckline?: Neckline;
  /** Tights only (V2-04): true when sheer, false when opaque; absent on other garments. No version bump: no older record holds tights. */
  sheer?: boolean;
  /** Lower-case sRGB hex, such as `#2e5e8c`. */
  colour: string;
  name: string;
  /** Milliseconds since 1970; the library lists items in this order. */
  savedAt: number;
}

export const WARDROBE_KEY = 'wardrobe';
/** The neckline the Dress screen shows on the tee. */
export const NECKLINE_KEY = 'neckline';
const HEX = /^#[0-9a-f]{6}$/i;
const NAME_MAX = 40;

/** A plain English name for a colour, such as 'Navy' or 'Light green'. Rough by design; the name is editable. */
export function colourName(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.12) return 'Black';
  if (l > 0.92) return 'White';
  if (s < 0.12) return l < 0.35 ? 'Charcoal' : l < 0.7 ? 'Grey' : 'Light grey';
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  let base: string;
  if (h < 15 || h >= 345) base = 'red';
  else if (h < 40) base = l < 0.4 ? 'brown' : 'orange';
  else if (h < 65) base = l < 0.4 ? 'olive' : 'yellow';
  else if (h < 160) base = 'green';
  else if (h < 195) base = 'teal';
  else if (h < 255) base = l < 0.3 ? 'navy' : 'blue';
  else if (h < 290) base = 'purple';
  else base = 'pink';
  const shade = l < 0.25 && base !== 'navy' ? 'Dark ' : l > 0.75 ? 'Light ' : '';
  const word = shade + base;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The automatic name, such as 'Navy tee', 'Navy V-neck tee' or 'Black sheer tights'. */
export function autoName(garment: GarmentId, hex: string, neckline?: Neckline, sheer?: boolean): string {
  const word = hasNecklines(garment) && neckline ? NECKLINES[neckline].name : hasSheer(garment) && sheer ? 'sheer' : '';
  return `${colourName(hex)} ${word ? word + ' ' : ''}${GARMENTS[garment].label}`;
}

export function cleanName(name: string, fallback: string): string {
  const t = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
  return t || fallback;
}

/** Keeps only valid, unique records, oldest first. Anything else stored is dropped. */
export function cleanItems(value: unknown): SavedItem[] {
  if (!Array.isArray(value)) return [];
  const out: SavedItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id || out.some((i) => i.id === r.id)) continue;
    if (typeof r.garment !== 'string' || !(r.garment in GARMENTS)) continue;
    if (typeof r.colour !== 'string' || !HEX.test(r.colour)) continue;
    const garment = r.garment as GarmentId;
    const colour = r.colour.toLowerCase();
    const neckline = hasNecklines(garment) ? (isNeckline(r.neckline) ? r.neckline : DEFAULT_NECKLINE) : undefined;
    const sheer = hasSheer(garment) ? r.sheer === true : undefined;
    out.push({
      v: 2,
      id: r.id,
      garment,
      ...(neckline && { neckline }),
      ...(sheer !== undefined && { sheer }),
      colour,
      name: cleanName(typeof r.name === 'string' ? r.name : '', autoName(garment, colour, neckline, sheer)),
      savedAt: typeof r.savedAt === 'number' && Number.isFinite(r.savedAt) ? r.savedAt : 0,
    });
  }
  return out.sort((a, b) => a.savedAt - b.savedAt);
}

/** `neckline` applies to tees only and defaults to the crew neck; `sheer` applies to tights only and defaults to opaque. Both are ignored for other garments. */
export function newItem(garment: GarmentId, colour: string, now = Date.now(), neckline: Neckline = DEFAULT_NECKLINE, sheer = false): SavedItem {
  const hex = colour.toLowerCase();
  const id = globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`;
  const n = hasNecklines(garment) ? neckline : undefined;
  const sh = hasSheer(garment) ? sheer : undefined;
  return { v: 2, id, garment, ...(n && { neckline: n }), ...(sh !== undefined && { sheer: sh }), colour: hex, name: autoName(garment, hex, n, sh), savedAt: now };
}

/** The saved item for a garment in a colour (and, for a tee, a neckline; for tights, opaque or sheer). Adds it to the list if it is not there yet, so each is saved once. */
export function ensureItem(
  list: SavedItem[],
  garment: GarmentId,
  colour: string,
  now = Date.now(),
  neckline: Neckline = DEFAULT_NECKLINE,
  sheer = false,
): { list: SavedItem[]; item: SavedItem } {
  const hex = colour.toLowerCase();
  const found = list.find(
    (i) => i.garment === garment && i.colour === hex && (!hasNecklines(garment) || i.neckline === neckline) && (!hasSheer(garment) || i.sheer === sheer),
  );
  if (found) return { list, item: found };
  const item = newItem(garment, hex, now, neckline, sheer);
  return { list: [...list, item], item };
}

/** What a saved item is, for a list: 'T-shirt, V-neck' for a tee, 'Tights, sheer' for tights, otherwise just the garment. */
export function itemKind(item: SavedItem): string {
  const g = GARMENTS[item.garment].option;
  if (item.neckline) return `${g}, ${NECKLINES[item.neckline].words}`;
  if (item.sheer !== undefined) return `${g}, ${item.sheer ? 'sheer' : 'opaque'}`;
  return g;
}

export function renameItem(list: SavedItem[], id: string, name: string): SavedItem[] {
  return list.map((i) => (i.id === id ? { ...i, name: cleanName(name, autoName(i.garment, i.colour, i.neckline, i.sheer)) } : i));
}

export function deleteItem(list: SavedItem[], id: string): SavedItem[] {
  return list.filter((i) => i.id !== id);
}

export async function loadItems(): Promise<SavedItem[]> {
  return cleanItems(await kvGet<unknown>(WARDROBE_KEY, []));
}

export async function saveItems(list: SavedItem[]): Promise<void> {
  await kvPut(WARDROBE_KEY, list);
}

/** Puts an item on the avatar by updating the stored outfit and colours, which the Dress screen reads when it opens. */
export async function wearItem(item: SavedItem): Promise<void> {
  const g = GARMENTS[item.garment];
  const outfit = await kvGet<Record<string, string>>('outfit', {});
  const colours = await kvGet<Record<string, string>>('colours', {});
  await kvPut('outfit', keepLayers({ ...outfit, [g.slot]: g.option }, g.slot));
  await kvPut('colours', { ...colours, [item.garment]: item.colour });
  if (item.neckline) await kvPut(NECKLINE_KEY, item.neckline);
  if (item.sheer !== undefined) await kvPut(SHEER_KEY, item.sheer);
}
