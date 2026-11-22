// V3-15: one drawn silhouette per garment, filled with the item's colour. Pure drawing, no DOM, no store.
// Mid-fidelity shapes from docs/decisions/2026-11-22-wardrobe-closet-redesign-spec.md. Joe signs off the look.
import { GARMENTS, NECKLINES, type GarmentId, type Neckline } from './wardrobe';

export type SilhouetteMode = 'hang' | 'flat' | 'shelf';

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

/** Inline SVG for a garment in a colour. `hang` is the full 100 by 100 drawing with its hook; `flat` and `shelf` are cropped to the shape and have no hook. */
export function silhouetteSvg({ garment, neckline, sheer = false, colour, mode = 'hang' }: SilhouetteOptions): string {
  const key = silhouetteKey(garment, neckline);
  const sh = SHAPES[key];
  const fill = HEX.test(colour) ? colour : '#9a9a9a';
  const edge = edgeOf(fill);
  const cfill = lumOf(fill) < 0.12 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.35)';
  const hang = mode === 'hang';
  const viewBox = hang ? '0 0 100 100' : sh.box.join(' ');
  const op = sheer ? ' fill-opacity="0.55"' : '';
  const stroke = `stroke="${edge}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"`;
  const parts: string[] = [];
  if (hang && sh.hook) parts.push(`<path d="${sh.hook}" fill="none" stroke="#8a8a8a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`);
  parts.push(`<path d="${sh.body}" fill="${fill}"${op} ${stroke}/>`);
  if (sh.extra) parts.push(`<path d="${sh.extra}" fill="${sh.xfill ?? edge}" ${stroke}/>`);
  if (sh.collar) parts.push(`<path d="${sh.collar}" fill="${cfill}" ${stroke}/>`);
  if (sh.detail) parts.push(`<path d="${sh.detail}" fill="none" stroke="${edge}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false" data-shape="${key}">${parts.join('')}</svg>`;
}

// Shared by callers and the test, so adding a garment or neckline fails the test until it gets a shape.
export const ALL_GARMENT_IDS = Object.keys(GARMENTS) as GarmentId[];
export const ALL_NECKLINES = Object.keys(NECKLINES) as Neckline[];
