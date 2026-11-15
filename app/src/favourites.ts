// Favourite colours, saved from the quiz result or the colour picker and shown in the picker. Stored on the device.
import { kvGet, kvPut } from './store';

export interface Favourite {
  /** Lower-case sRGB hex, such as `#2e5e8c`. */
  hex: string;
  /** True when saved from the quiz result palette, so the picker can mark it. */
  fromPalette: boolean;
}

export const FAVOURITES_KEY = 'favourites';
/** The picker shows this many favourites, then a 'more' option for the rest. */
export const SHOWN_FIRST = 12;

const HEX = /^#[0-9a-f]{6}$/i;

/** Keeps only valid, unique entries, in their saved order. Anything else stored is dropped. */
export function cleanFavourites(value: unknown): Favourite[] {
  if (!Array.isArray(value)) return [];
  const out: Favourite[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { hex, fromPalette } = item as Record<string, unknown>;
    if (typeof hex !== 'string' || !HEX.test(hex)) continue;
    const h = hex.toLowerCase();
    if (out.some((f) => f.hex === h)) continue;
    out.push({ hex: h, fromPalette: fromPalette === true });
  }
  return out;
}

export function hasFavourite(list: Favourite[], hex: string): boolean {
  const h = hex.toLowerCase();
  return list.some((f) => f.hex === h);
}

/** Adds a colour to the end of the list. A colour already there is left as it is. */
export function addFavourite(list: Favourite[], hex: string, fromPalette: boolean): Favourite[] {
  if (!HEX.test(hex) || hasFavourite(list, hex)) return list;
  return [...list, { hex: hex.toLowerCase(), fromPalette }];
}

export function removeFavourite(list: Favourite[], hex: string): Favourite[] {
  const h = hex.toLowerCase();
  return list.filter((f) => f.hex !== h);
}

export async function loadFavourites(): Promise<Favourite[]> {
  return cleanFavourites(await kvGet<unknown>(FAVOURITES_KEY, []));
}

export async function saveFavourites(list: Favourite[]): Promise<void> {
  await kvPut(FAVOURITES_KEY, list);
}
