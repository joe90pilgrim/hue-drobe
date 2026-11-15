// Saved clothes: a garment in a colour, with a name. Stored on the device.
import { kvGet, kvPut } from './store';

/** Garments in the avatar pack that can be saved, with the Dress slot and option that shows each one. */
export const GARMENTS = {
  tee: { label: 'tee', slot: 'Top', option: 'T-shirt' },
  sweatshirt: { label: 'sweatshirt', slot: 'Top', option: 'Sweatshirt' },
  trousers: { label: 'trousers', slot: 'Bottom', option: 'Trousers' },
} as const;
export type GarmentId = keyof typeof GARMENTS;

/**
 * The stored record. `v` is the record version: a later version can add a photo, an owner or a source
 * (v2 and v4) as optional fields and bump `v`, and `cleanItems` upgrades older records on load.
 */
export interface SavedItem {
  v: 1;
  id: string;
  garment: GarmentId;
  /** Lower-case sRGB hex, such as `#2e5e8c`. */
  colour: string;
  name: string;
  /** Milliseconds since 1970; the library lists items in this order. */
  savedAt: number;
}

export const WARDROBE_KEY = 'wardrobe';
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

/** The automatic name, such as 'Navy tee'. */
export function autoName(garment: GarmentId, hex: string): string {
  return `${colourName(hex)} ${GARMENTS[garment].label}`;
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
    out.push({
      v: 1,
      id: r.id,
      garment,
      colour,
      name: cleanName(typeof r.name === 'string' ? r.name : '', autoName(garment, colour)),
      savedAt: typeof r.savedAt === 'number' && Number.isFinite(r.savedAt) ? r.savedAt : 0,
    });
  }
  return out.sort((a, b) => a.savedAt - b.savedAt);
}

export function newItem(garment: GarmentId, colour: string, now = Date.now()): SavedItem {
  const hex = colour.toLowerCase();
  const id = globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`;
  return { v: 1, id, garment, colour: hex, name: autoName(garment, hex), savedAt: now };
}

export function renameItem(list: SavedItem[], id: string, name: string): SavedItem[] {
  return list.map((i) => (i.id === id ? { ...i, name: cleanName(name, autoName(i.garment, i.colour)) } : i));
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
  await kvPut('outfit', { ...outfit, [g.slot]: g.option });
  await kvPut('colours', { ...colours, [item.garment]: item.colour });
}
