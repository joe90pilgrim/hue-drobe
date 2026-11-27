// Preset outfits: a name and one saved item per slot (top, bottom, legs). Stored on the device.
import { kvGet, kvPut } from './store';
import { PATTERNS_KEY, cleanPatterns, withItemPattern } from './patterns';
import { GARMENTS, NECKLINE_KEY, SHEER_KEY, cleanName, keepLayers, type SavedItem } from './wardrobe';

/** A look made of saved items: one per slot (top, bottom, legs). A slot with no item is empty. */
export interface OutfitLook {
  top?: SavedItem;
  bottom?: SavedItem;
  /** V2-04: tights. */
  legs?: SavedItem;
  /** V3-02: a dress, which takes the place of the top and the bottom. */
  dress?: SavedItem;
  /** V5-01: shoes. */
  shoes?: SavedItem;
  /** V5-02: a hat. */
  hat?: SavedItem;
  /** V3.1-06: an outer layer (the blazer). */
  outer?: SavedItem;
}

/**
 * The stored record. `v` is the record version, as for saved items. A slot holds the id of a saved item; when that
 * item is deleted the id stays, and the slot shows as empty.
 */
export interface Outfit {
  v: 1;
  id: string;
  name: string;
  top?: string;
  bottom?: string;
  /** V2-04: the tights. Optional, so older outfits need no upgrade. */
  legs?: string;
  /** V3-02: the dress, in place of the top and the bottom. Optional, so older outfits need no upgrade. */
  dress?: string;
  /** V5-01: the shoes. Optional, so older outfits need no upgrade. */
  shoes?: string;
  /** V5-02: the hat. Optional, so older outfits need no upgrade. */
  hat?: string;
  /** V3.1-06: the outer layer (the blazer). Optional, so older outfits need no upgrade. */
  outer?: string;
  /** Milliseconds since 1970; the list shows outfits in this order. */
  savedAt: number;
}

export const OUTFITS_KEY = 'outfits';
const FALLBACK_NAME = 'Outfit';

/** Auto-named from the items, such as 'Navy tee, Light grey trousers'. Editable, like saved items. */
export function autoOutfitName(look: OutfitLook): string {
  const names = [look.hat, look.dress, look.top, look.outer, look.bottom, look.legs, look.shoes].filter((i): i is SavedItem => !!i).map((i) => i.name);
  return cleanName(names.join(', '), FALLBACK_NAME);
}

export function newOutfit(look: OutfitLook, now = Date.now()): Outfit {
  const id = globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`;
  return { v: 1, id, name: autoOutfitName(look), top: look.top?.id, bottom: look.bottom?.id, ...(look.dress && { dress: look.dress.id }), ...(look.legs && { legs: look.legs.id }), ...(look.shoes && { shoes: look.shoes.id }), ...(look.hat && { hat: look.hat.id }), ...(look.outer && { outer: look.outer.id }), savedAt: now };
}

/** Keeps only valid, unique outfits that point at something, oldest first. Anything else stored is dropped. */
export function cleanOutfits(value: unknown): Outfit[] {
  if (!Array.isArray(value)) return [];
  const out: Outfit[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id || out.some((o) => o.id === r.id)) continue;
    const top = typeof r.top === 'string' && r.top ? r.top : undefined;
    const bottom = typeof r.bottom === 'string' && r.bottom ? r.bottom : undefined;
    const legs = typeof r.legs === 'string' && r.legs ? r.legs : undefined;
    const dress = typeof r.dress === 'string' && r.dress ? r.dress : undefined;
    const shoes = typeof r.shoes === 'string' && r.shoes ? r.shoes : undefined;
    const hat = typeof r.hat === 'string' && r.hat ? r.hat : undefined;
    const outer = typeof r.outer === 'string' && r.outer ? r.outer : undefined;
    if (!top && !bottom && !legs && !dress && !shoes && !hat && !outer) continue;
    out.push({
      v: 1,
      id: r.id,
      name: cleanName(typeof r.name === 'string' ? r.name : '', FALLBACK_NAME),
      top,
      bottom,
      ...(dress && { dress }),
      ...(legs && { legs }),
      ...(shoes && { shoes }),
      ...(hat && { hat }),
      ...(outer && { outer }),
      savedAt: typeof r.savedAt === 'number' && Number.isFinite(r.savedAt) ? r.savedAt : 0,
    });
  }
  return out.sort((a, b) => a.savedAt - b.savedAt);
}

/** The items an outfit points at, given the saved items. A slot whose item was deleted comes back empty. */
export function resolveOutfit(outfit: Outfit, items: SavedItem[]): OutfitLook {
  return {
    top: outfit.top ? items.find((i) => i.id === outfit.top) : undefined,
    bottom: outfit.bottom ? items.find((i) => i.id === outfit.bottom) : undefined,
    legs: outfit.legs ? items.find((i) => i.id === outfit.legs) : undefined,
    dress: outfit.dress ? items.find((i) => i.id === outfit.dress) : undefined,
    shoes: outfit.shoes ? items.find((i) => i.id === outfit.shoes) : undefined,
    hat: outfit.hat ? items.find((i) => i.id === outfit.hat) : undefined,
    outer: outfit.outer ? items.find((i) => i.id === outfit.outer) : undefined,
  };
}

export function renameOutfit(list: Outfit[], id: string, name: string, fallback: string): Outfit[] {
  return list.map((o) => (o.id === id ? { ...o, name: cleanName(name, fallback) } : o));
}

export function deleteOutfit(list: Outfit[], id: string): Outfit[] {
  return list.filter((o) => o.id !== id);
}

export async function loadOutfits(): Promise<Outfit[]> {
  return cleanOutfits(await kvGet<unknown>(OUTFITS_KEY, []));
}

export async function saveOutfits(list: Outfit[]): Promise<void> {
  await kvPut(OUTFITS_KEY, list);
}

/** The Dress option for a slot: the item's garment option, or None when the slot is empty. */
function optionFor(item: SavedItem | undefined): string {
  return item ? GARMENTS[item.garment].option : 'None';
}

/**
 * Puts an outfit on the avatar in one go. Every slot is replaced, so a slot the outfit leaves empty is cleared.
 * The garments it uses take their saved colours. Dress reads the stored outfit and colours when it opens.
 */
export async function wearOutfit(outfit: Outfit, items: SavedItem[]): Promise<void> {
  const look = resolveOutfit(outfit, items);
  const colours = await kvGet<Record<string, string>>('colours', {});
  const used = [look.top, look.bottom, look.legs, look.dress, look.shoes, look.hat, look.outer].filter((i): i is SavedItem => !!i);
  await kvPut('outfit', keepLayers({ Top: optionFor(look.top), Bottom: optionFor(look.bottom), Legs: optionFor(look.legs), Dress: optionFor(look.dress), Shoes: optionFor(look.shoes), Hat: optionFor(look.hat), Outer: optionFor(look.outer) }));
  await kvPut('colours', { ...colours, ...Object.fromEntries(used.map((i) => [i.garment, i.colour])) });
  // Each garment the outfit uses takes its item's pattern, or none; garments the outfit does not use keep what they had, as with colours.
  await kvPut(PATTERNS_KEY, used.reduce(withItemPattern, cleanPatterns(await kvGet<unknown>(PATTERNS_KEY, {})) ?? {}));
  if (look.top?.neckline) await kvPut(NECKLINE_KEY, look.top.neckline);
  if (look.legs?.sheer !== undefined) await kvPut(SHEER_KEY, look.legs.sheer);
}
