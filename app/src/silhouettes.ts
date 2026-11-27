// V3-15: one drawn silhouette per garment, filled with the item's colour. Pure drawing, no DOM, no store.
// Mid-fidelity shapes from docs/decisions/2026-11-22-wardrobe-closet-redesign-spec.md. Joe signs off the look.
import { GARMENTS, NECKLINES, type GarmentId, type Neckline, type SavedItem } from './wardrobe';
import type { Outfit, OutfitLook } from './outfits';

export type SilhouetteMode = 'hang' | 'flat' | 'shelf' | 'ghost';

interface Shape {
  hook?: string;
  /** Content box [x, y, w, h] in the 100 by 100 drawing, used to crop `flat` and `shelf`. */
  box: readonly [number, number, number, number];
  body: string;
  collar?: string;
  detail?: string;
  extra?: string;
  xfill?: string;
}

const HOOK_TOP = 'M50 14 L50 9 Q50 3 56 3 Q61 3 61 8 M50 14 L12 27 M50 14 L88 27';
const HOOK_BOTTOM = 'M50 14 L50 9 Q50 3 56 3 Q61 3 61 8 M27 15 L73 15';
const HOOK_DRESS = 'M50 14 L50 9 Q50 3 56 3 Q61 3 61 8 M50 14 L38 10 M50 14 L62 10';
const COLLAR = 'M50 26 L36 12 L42 8 L50 16 L58 8 L64 12 Z';

const TEE_BODY = (neck: string) => `M38 14 ${neck} L86 26 L78 42 L70 37 L70 92 L30 92 L30 37 L22 42 L14 26 Z`;

export const SHAPES: Record<string, Shape> = {
  tee: { hook: HOOK_TOP, box: [4, 12, 92, 86], body: TEE_BODY('Q50 24 62 14'), detail: 'M39.5 17 Q50 27 60.5 17 M30 86 L70 86' },
  tee_v: { hook: HOOK_TOP, box: [4, 12, 92, 86], body: TEE_BODY('L50 34 L62 14'), detail: 'M41 16.5 L50 30 L59 16.5 M30 86 L70 86' },
  // Derived from the tee: the same shape with a deeper neck curve.
  tee_scoop: { hook: HOOK_TOP, box: [4, 12, 92, 86], body: TEE_BODY('Q50 30 62 14'), detail: 'M39.5 17 Q50 33 60.5 17 M30 86 L70 86' },
  sweat: {
    hook: HOOK_TOP, box: [4, 12, 92, 86],
    body: 'M38 14 Q50 24 62 14 L84 24 L92 80 L80 83 L72 44 L72 90 L28 90 L28 44 L20 83 L8 80 L16 24 Z',
    detail: 'M39.5 17 Q50 27 60.5 17 M28 84 L72 84 M9 74 L19.5 77 M91 74 L80.5 77',
  },
  shirt_short: {
    hook: HOOK_TOP, box: [4, 6, 92, 90],
    body: 'M38 14 L50 26 L62 14 L86 26 L78 42 L70 37 L70 94 L30 94 L30 37 L22 42 L14 26 Z', collar: COLLAR, detail: 'M50 26 L50 94',
  },
  shirt_mid: {
    hook: HOOK_TOP, box: [4, 6, 92, 90],
    body: 'M38 14 L50 26 L62 14 L86 26 L90 58 L79 60 L70 37 L70 94 L30 94 L30 37 L21 60 L10 58 L14 26 Z', collar: COLLAR, detail: 'M50 26 L50 94',
  },
  shirt_long: {
    hook: HOOK_TOP, box: [4, 6, 92, 90],
    body: 'M38 14 L50 26 L62 14 L85 25 L92 84 L80 86 L70 38 L70 94 L30 94 L30 38 L20 86 L8 84 L15 25 Z', collar: COLLAR,
    detail: 'M50 26 L50 94 M9 78 L19.5 80 M91 78 L80.5 80',
  },
  trousers: { hook: HOOK_BOTTOM, box: [22, 14, 56, 86], body: 'M28 16 L72 16 L75 96 L55 96 L50 46 L45 96 L25 96 Z', detail: 'M28 22 L72 22 M50 22 L50 46' },
  shorts: { hook: HOOK_BOTTOM, box: [20, 14, 60, 48], body: 'M28 16 L72 16 L76 58 L55 58 L50 38 L45 58 L24 58 Z', detail: 'M28 22 L72 22 M50 22 L50 38' },
  skirt: { hook: HOOK_BOTTOM, box: [12, 14, 76, 64], body: 'M32 16 L68 16 L86 76 L14 76 Z', detail: 'M32 22 L68 22' },
  dress: {
    hook: HOOK_DRESS, box: [22, 8, 56, 88],
    body: 'M36 10 L42 10 L45 18 Q50 22 55 18 L58 10 L64 10 L66 34 L76 94 L24 94 L34 34 Z', detail: 'M35 40 L65 40',
  },
  tights: { hook: HOOK_BOTTOM, box: [30, 14, 40, 86], body: 'M34 16 L66 16 L68 98 L54 98 L50 46 L46 98 L32 98 Z', detail: 'M34 22 L66 22' },
  // Shelf items for V5 (hats, shoes). Not reachable from a GarmentId yet.
  beanie: {
    box: [12, 10, 76, 58], body: 'M18 50 Q16 14 50 12 Q84 14 82 50 Z', collar: 'M14 48 L86 48 L86 62 Q50 68 14 62 Z',
    detail: 'M30 49 L30 63 M40 49 L40 65 M50 49 L50 66 M60 49 L60 65 M70 49 L70 63',
  },
  cap: { box: [14, 16, 86, 52], body: 'M20 56 Q20 22 52 20 Q82 22 84 56 Z', extra: 'M62 54 Q92 52 98 62 Q80 66 58 62 Z', detail: 'M52 20 L52 56' },
  sneaker: {
    box: [4, 18, 94, 42], xfill: '#f4f1ec', body: 'M8 48 L8 30 Q22 30 30 20 L46 22 Q56 38 78 40 Q94 42 94 48 Z',
    extra: 'M6 48 L96 48 L96 54 Q96 58 90 58 L12 58 Q6 58 6 54 Z', detail: 'M34 24 L40 31 M41 23 L47 31',
  },
  boot: {
    box: [16, 6, 82, 60], xfill: '#2b2b2b', body: 'M26 8 L50 8 L52 40 Q78 42 92 50 L92 54 L22 54 Z',
    extra: 'M20 54 L94 54 L94 60 Q94 64 88 64 L24 64 Q20 64 20 60 Z', detail: 'M26 18 L50 18',
  },
  // V5-01: the two shoes that are not a trainer or a boot (a low lace-up, and a strappy sandal).
  oxford: {
    box: [4, 26, 94, 32], xfill: '#2b2b2b', body: 'M8 46 L8 38 Q24 36 34 30 L52 32 Q64 40 80 42 Q94 44 94 46 Z',
    extra: 'M6 46 L96 46 L96 50 Q96 54 90 54 L12 54 Q6 54 6 50 Z', detail: 'M36 31 L42 36 M43 31 L49 37',
  },
  sandal: {
    box: [4, 30, 94, 30], xfill: '#2b2b2b', body: 'M8 52 Q8 46 20 46 L82 46 Q94 46 94 52 Z',
    extra: 'M6 52 L96 52 L96 56 Q96 60 90 60 L12 60 Q6 60 6 56 Z', detail: 'M30 46 L34 34 Q48 30 62 34 L66 46 M48 32 L48 46',
  },
  // V3.1-06: the blazer, a jacket with lapels and a centre button line (the same drawing for both sexes).
  blazer: {
    hook: HOOK_TOP, box: [4, 8, 92, 88],
    body: 'M36 12 L50 30 L64 12 L86 24 L92 82 L80 84 L72 44 L72 92 L28 92 L28 44 L20 84 L8 82 L14 24 Z', collar: 'M50 30 L36 12 L30 22 L40 40 L50 52 Z M50 30 L64 12 L70 22 L60 40 L50 52 Z', detail: 'M50 52 L50 92',
  },
  // Any garment id without a shape: a plain rounded block, so nothing shows blank.
  generic: { hook: HOOK_TOP, box: [18, 14, 64, 80], body: 'M26 24 Q26 14 36 14 L64 14 Q74 14 74 24 L74 84 Q74 94 64 94 L36 94 Q26 94 26 84 Z', detail: 'M32 22 L68 22' },
};

/** Which shape a garment (and, for the tee, a neckline) is drawn with. Unknown ids get `generic`. */
export function silhouetteKey(garment: string, neckline?: string): string {
  switch (garment) {
    case 'tee':
      return neckline === 'v' ? 'tee_v' : neckline === 'scoop' ? 'tee_scoop' : 'tee';
    case 'sweatshirt':
      return 'sweat';
    case 'trainers':
      return 'sneaker';
    case 'ankle_boots':
      return 'boot';
    case 'oxfords': case 'monk_straps':
      return 'oxford';
    case 'sandals':
      return 'sandal';
    case 'blazer_male': case 'blazer_female':
      return 'blazer';
    case 'beanie': case 'cap': case 'sneaker': case 'boot': // V5 shelf shapes
    case 'shirt_short': case 'shirt_mid': case 'shirt_long': case 'trousers': case 'shorts': case 'skirt': case 'tights': case 'dress':
      return garment;
    default:
      return 'generic';
  }
}

const HEX = /^#[0-9a-f]{6}$/i;
const lumOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255)) / 255 + (0.7152 * ((n >> 8) & 255)) / 255 + (0.0722 * (n & 255)) / 255;
};
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * (1 + f)))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};
/** Very dark colours get a lighter edge so the shape still reads; everything else a darker one (pale colours stay visible on light). */
export const edgeOf = (hex: string) => (lumOf(hex) < 0.12 ? '#6b6b6b' : shade(hex, -0.3));

export interface SilhouetteOptions {
  garment: string;
  neckline?: Neckline | string;
  sheer?: boolean;
  colour: string;
  mode?: SilhouetteMode;
}

/** The paths of one shape, without the svg wrapper. */
function shapeParts(key: string, colour: string, sheer: boolean, hook: boolean): string[] {
  const sh = SHAPES[key];
  const fill = HEX.test(colour) ? colour : '#9a9a9a';
  const edge = edgeOf(fill);
  const cfill = lumOf(fill) < 0.12 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.35)';
  const op = sheer ? ' fill-opacity="0.55"' : '';
  const stroke = `stroke="${edge}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;
  const parts: string[] = [];
  if (hook && sh.hook) parts.push(`<path d="${sh.hook}" fill="none" stroke="#8a8a8a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`);
  parts.push(`<path d="${sh.body}" fill="${fill}"${op} ${stroke}/>`);
  if (sh.extra) parts.push(`<path d="${sh.extra}" fill="${sh.xfill ?? edge}" ${stroke}/>`);
  if (sh.collar) parts.push(`<path d="${sh.collar}" fill="${cfill}" ${stroke}/>`);
  if (sh.detail) parts.push(`<path d="${sh.detail}" fill="none" stroke="${edge}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`);
  return parts;
}

/** V7-06: a suggestion, not a piece you own: a dashed grey outline, filled with the suggested colour at full strength (neutral grey when there is none). */
function ghostParts(key: string, colour: string): string[] {
  const sh = SHAPES[key];
  const fill = HEX.test(colour) ? colour : '#9a9a9a';
  const dash = 'stroke="#7a7a7a" stroke-width="1.6" stroke-dasharray="4 3" stroke-linejoin="round" stroke-linecap="round"';
  const parts = [`<path d="${sh.body}" fill="${fill}" ${dash} data-ghost="body"/>`];
  if (sh.extra) parts.push(`<path d="${sh.extra}" fill="${fill}" ${dash}/>`);
  if (sh.collar) parts.push(`<path d="${sh.collar}" fill="none" ${dash}/>`);
  if (sh.detail) parts.push(`<path d="${sh.detail}" fill="none" stroke="#7a7a7a" stroke-width="1" stroke-linecap="round" opacity="0.6"/>`);
  return parts;
}

/** Inline SVG for a garment in a colour. `hang` is the full 100 by 100 drawing with its hook; `flat` and `shelf` are cropped to the shape and have no hook. */
/** The silhouette of a saved item, in its own colour. Shared by the Wardrobe and Packing screens. */
export const itemSilhouette = (i: SavedItem, mode: SilhouetteMode): string =>
  silhouetteSvg({ garment: i.garment, neckline: i.neckline, sheer: i.sheer, colour: i.colour, mode });

export function silhouetteSvg({ garment, neckline, sheer = false, colour, mode = 'hang' }: SilhouetteOptions): string {
  const key = silhouetteKey(garment, neckline);
  if (mode === 'ghost') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SHAPES[key].box.join(' ')}" aria-hidden="true" focusable="false" data-shape="${key}" data-mode="ghost">${ghostParts(key, colour).join('')}</svg>`;
  const hang = mode === 'hang';
  const viewBox = hang ? '0 0 100 100' : SHAPES[key].box.join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false" data-shape="${key}">${shapeParts(key, colour, sheer, hang).join('')}</svg>`;
}

// --- V3-17: the flat-lay of an outfit ------------------------------------------------------------------------------

export type FlatSlot = 'hat' | 'outer' | 'top' | 'dress' | 'bottom' | 'legs' | 'shoes';

/** One piece of an outfit. No `item` means the piece was deleted: it is drawn as a dashed outline. */
export interface FlatPiece {
  slot: FlatSlot;
  item?: { garment: string; neckline?: string; sheer?: boolean; colour: string };
}

export interface FlatPlacement {
  slot: FlatSlot;
  key: string;
  missing: boolean;
  /** Top-left of the piece's content box in the flat-lay, and its size (the drawing's own units). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlatLayout {
  width: number;
  height: number;
  placements: FlatPlacement[];
}

const SLOT_ORDER: FlatSlot[] = ['hat', 'outer', 'top', 'dress', 'bottom', 'legs', 'shoes'];
/** The outline drawn for a deleted piece. */
const EMPTY_KEY: Record<FlatSlot, string> = { hat: 'beanie', outer: 'blazer', top: 'tee', dress: 'dress', bottom: 'trousers', legs: 'tights', shoes: 'sneaker' };
const PAD = 4;
export const FLAT_GAP = 5;

/**
 * Stack the pieces head to toe and centre each one. Tights are drawn behind a bottom, from its waist, so they show as legs
 * under shorts or a skirt; with no bottom (or with a dress) they sit under it.
 */
export function flatLayLayout(pieces: FlatPiece[]): FlatLayout {
  const sized = SLOT_ORDER.flatMap((slot) => {
    const p = pieces.find((q) => q.slot === slot);
    if (!p) return [];
    const key = p.item ? silhouetteKey(p.item.garment, p.item.neckline) : EMPTY_KEY[slot];
    const [, , w, h] = SHAPES[key].box;
    return [{ slot, key, missing: !p.item, w, h }];
  });
  const hasBottom = sized.some((s) => s.slot === 'bottom');
  const placements: FlatPlacement[] = [];
  let y = PAD;
  let bottomY = 0;
  let rowEnd = y;
  for (const s of sized) {
    const overlap = s.slot === 'legs' && hasBottom;
    const top = overlap ? bottomY : y;
    placements.push({ slot: s.slot, key: s.key, missing: s.missing, x: 0, y: top, w: s.w, h: s.h });
    if (s.slot === 'bottom') bottomY = top;
    rowEnd = Math.max(rowEnd, top + s.h);
    if (!overlap) y = rowEnd + FLAT_GAP;
    else y = Math.max(y, rowEnd + FLAT_GAP);
  }
  const widest = Math.max(0, ...placements.map((p) => p.w));
  const width = widest + PAD * 2;
  for (const p of placements) p.x = (width - p.w) / 2;
  const height = placements.length ? rowEnd + PAD : PAD * 2;
  return { width, height, placements };
}

/** One SVG: the outfit's silhouettes stacked head to toe and centred, in the order of `flatLayLayout`. Deleted pieces get a dashed outline (`.o-gap`). */
export function flatLaySvg(pieces: FlatPiece[]): string {
  const { width, height, placements } = flatLayLayout(pieces);
  const byDrawOrder = [...placements].sort((a, b) => (a.slot === 'legs' ? -1 : 0) - (b.slot === 'legs' ? -1 : 0)); // tights behind the bottom
  const groups = byDrawOrder.map((pl) => {
    const piece = pieces.find((q) => q.slot === pl.slot)!;
    const [bx, by] = SHAPES[pl.key].box;
    const tf = `translate(${pl.x - bx} ${pl.y - by})`;
    if (pl.missing) {
      const sh = SHAPES[pl.key];
      return `<g class="o-gap" data-slot="${pl.slot}" transform="${tf}"><path d="${sh.body}"/></g>`;
    }
    const it = piece.item!;
    return `<g data-slot="${pl.slot}" data-shape="${pl.key}" transform="${tf}">${shapeParts(pl.key, it.colour, !!it.sheer, false).join('')}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">${groups.join('')}</svg>`;
}

/**
 * The flat-lay of an outfit (V3-17): the silhouettes of its pieces, stacked head to toe. A piece the outfit has but that was deleted
 * is a dashed outline in its place; a piece the outfit never had is left out. An outfit with nothing in it shows a dashed top and bottom.
 * Shared by the Wardrobe and Packing screens (V7-03).
 */
export function flatLayOf(o: Outfit, look: OutfitLook): string {
  const piece = (slot: FlatSlot, id: string | undefined, item: SavedItem | undefined): FlatPiece[] =>
    id ? [{ slot, item: item && { garment: item.garment, neckline: item.neckline, sheer: item.sheer, colour: item.colour } }] : [];
  const pieces = [
    ...piece('hat', o.hat, look.hat),
    // V3.1-06: a blazer stands in for the top in the flat-lay, as on the avatar (where the tee is not drawn under it).
    ...piece('outer', o.outer, look.outer),
    ...(o.dress ? piece('dress', o.dress, look.dress) : [...(o.outer ? [] : piece('top', o.top, look.top)), ...piece('bottom', o.bottom, look.bottom)]),
    ...piece('legs', o.legs, look.legs),
    ...piece('shoes', o.shoes, look.shoes),
  ];
  return flatLaySvg(pieces.length ? pieces : [{ slot: 'top' }, { slot: 'bottom' }]);
}

// Shared by callers and the test, so adding a garment or neckline fails the test until it gets a shape.
export const ALL_GARMENT_IDS = Object.keys(GARMENTS) as GarmentId[];
export const ALL_NECKLINES = Object.keys(NECKLINES) as Neckline[];
