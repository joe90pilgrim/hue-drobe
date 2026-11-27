// V8-01: the 2D paper-doll on Try On. A generic figure per person (the app holds no measurements), dressed in the garment shapes of
// silhouettes.ts. An approximate preview only: the 3D avatar stays the accurate view. Pure drawing, no DOM, no store.
// Each shape is drawn in its own 100 by 100 grid; a placement maps that grid onto the figure (tops onto the torso and arms, bottoms
// onto the hips and legs, and so on). The layer rules are wardrobe.ts's own (`isTucked`, `layeredOk`); nothing here decides what is worn.
import { SHAPES, edgeOf, silhouetteKey } from './silhouettes';
import {
  DRESS_SLOT,
  GARMENTS,
  HAT_SLOT,
  OUTER_OPTION,
  OUTER_SLOT,
  SHOES_SLOT,
  UNDER_OPTION,
  UNDER_SLOT,
  isTucked,
  layeredOk,
  type GarmentId,
  type LayerCombos,
  type Neckline,
} from './wardrobe';

export type DollFigure = 'joe' | 'b';
/** The figure drawn for a signed-in person: B's for `b`, Joe's for anyone else. */
export const dollFigureOf = (person: string): DollFigure => (person === 'b' ? 'b' : 'joe');

type Pt = readonly [number, number];
type MapFn = (x: number, y: number) => Pt;

/** Piecewise-linear through the stops, carried on straight past the ends. */
function piecewise(stops: readonly Pt[]): (v: number) => number {
  return (v) => {
    let i = 0;
    while (i < stops.length - 2 && v > stops[i + 1][0]) i++;
    const [a, fa] = stops[i];
    const [b, fb] = stops[i + 1];
    return fa + ((v - a) * (fb - fa)) / (b - a);
  };
}

/**
 * The figure, in a 100 by 200 drawing (the sole at y 196). `torso` and `hips` are how wide a top's body and a bottom are drawn; `sleeve` pulls
 * a hanging garment's sleeves in towards the arms (the shapes are drawn on a hanger, sleeves spread). Joe: broader shoulders; B: narrower
 * shoulders, a narrower waist and wider hips, and longer hair.
 */
interface Figure {
  torso: number;
  sleeve: number;
  hips: number;
  dress: number;
  neck: number;
  hair: 'short' | 'long';
}
const FIGURES: Record<DollFigure, Figure> = {
  joe: { torso: 0.86, sleeve: 0.5, hips: 0.86, dress: 0.95, neck: 9, hair: 'short' },
  b: { torso: 0.78, sleeve: 0.44, hips: 1.0, dress: 0.95, neck: 7.5, hair: 'long' },
};
/** Grid height -> figure height: a top's neckline, armpit and hem; a bottom's waistband, crotch and ankle; a dress's shoulder, waist and hem. */
const TOP_Y = piecewise([[14, 40], [37, 54], [92, 108]]);
const BOTTOM_Y = piecewise([[16, 86], [46, 106], [98, 192]]);
const DRESS_Y = piecewise([[10, 40], [40, 80], [94, 150]]);
const SOLE = 196;
/** The waist a tucked-in top is cut at (the skirt's waistband). */
const WAIST_Y = BOTTOM_Y(16);

type Place = 'top' | 'bottom' | 'dress' | 'hat' | 'shoe';
/** Where each shape goes on the figure. A garment whose shape is not here has no doll shape (the test fails). */
const PLACE: Record<string, Place> = {
  tee: 'top', tee_v: 'top', tee_scoop: 'top', sweat: 'top', shirt_short: 'top', shirt_mid: 'top', shirt_long: 'top', blazer: 'top',
  trousers: 'bottom', shorts: 'bottom', skirt: 'bottom', tights: 'bottom',
  dress: 'dress',
  beanie: 'hat', cap: 'hat',
  sneaker: 'shoe', boot: 'shoe', oxford: 'shoe', sandal: 'shoe',
};
/** The doll shape of a garment (and, for the tee, a neckline), or undefined when it has none. */
export function dollShapeOf(garment: string, neckline?: string): string | undefined {
  const k = silhouetteKey(garment, neckline);
  return k in PLACE ? k : undefined;
}

/** Each top's left sleeve hem in its grid, outer corner then inner: the bare arm comes out of it. */
const SHORT_HEM: readonly [Pt, Pt] = [[22, 42], [30, 37]];
export const SLEEVE_HEM: Record<string, readonly [Pt, Pt]> = {
  tee: SHORT_HEM, tee_v: SHORT_HEM, tee_scoop: SHORT_HEM, shirt_short: SHORT_HEM,
  shirt_mid: [[10, 58], [21, 60]],
  shirt_long: [[8, 84], [20, 86]],
  sweat: [[8, 80], [20, 83]],
  blazer: [[8, 82], [20, 84]],
};
/** The bare left arm, in the tops' grid: shoulder, armpit and wrist (outer, inner). */
const SHOULDER: Pt = [21, 24];
const ARMPIT: Pt = [30.5, 38];
const WRIST: readonly [Pt, Pt] = [[9, 86], [19, 86]];
/** A sleeve's arm starts this far back inside the sleeve, so no skin shows at the hem's edge. */
const toward = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

function mapsOf(f: Figure) {
  const sx = (d: number) => (Math.abs(d) <= 20 ? d * f.torso : Math.sign(d) * (20 * f.torso + (Math.abs(d) - 20) * f.sleeve));
  const top: MapFn = (x, y) => [50 + sx(x - 50), TOP_Y(y)];
  const bottom: MapFn = (x, y) => [50 + (x - 50) * f.hips, BOTTOM_Y(y)];
  const dress: MapFn = (x, y) => [50 + (x - 50) * f.dress, DRESS_Y(y)];
  return { top, bottom, dress };
}
const mirror = (m: MapFn): MapFn => (x, y) => m(100 - x, y);

const r = (n: number) => String(Math.round(n * 100) / 100);
const pt = (p: Pt) => `${r(p[0])} ${r(p[1])}`;
/** A shape's path (absolute M, L, Q and Z only, as in silhouettes.ts) with every point mapped onto the figure. */
export function mapPath(d: string, m: MapFn): string {
  return (d.match(/[A-Za-z][^A-Za-z]*/g) ?? [])
    .map((seg) => {
      const n = seg.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
      const out: string[] = [];
      for (let i = 0; i + 1 < n.length; i += 2) out.push(pt(m(n[i], n[i + 1])));
      return seg[0] + out.join(' ');
    })
    .join(' ');
}

/** The placement of a shape on this figure: one map, or two for the shoes (one per foot). */
function placementOf(key: string, f: Figure): MapFn[] {
  const m = mapsOf(f);
  const [bx, by, , bh] = SHAPES[key].box;
  switch (PLACE[key]) {
    case 'top': return [m.top];
    case 'bottom': return [m.bottom];
    case 'dress': return [m.dress];
    case 'hat': {
      // Sized to the head (18 wide, its top at y 6); the cap is centred on its crown, not its peak.
      const s = key === 'cap' ? 0.3 : 0.27;
      const cx = key === 'cap' ? 52 : 50;
      const top = key === 'cap' ? 4 : 2.5;
      return [(x, y) => [50 + (x - cx) * s, top + (y - by) * s]];
    }
    case 'shoe': {
      // A side view under each leg, heel in, toe out (the left foot mirrored).
      const s = 0.15;
      const heel = m.bottom(54, 98)[0];
      const right: MapFn = (x, y) => [heel + (x - bx) * s, SOLE - (by + bh - y) * s];
      return [right, (x, y) => { const [X, Y] = right(x, y); return [100 - X, Y]; }];
    }
    default: return [];
  }
}

const HEX = /^#[0-9a-f]{6}$/i;
const SKIN = '#d9bca3';
const SKIN_SHADE = '#c9a88d';

/** The paths of one garment on the figure, filled with its colour, edged as in silhouettes.ts. */
function garmentPaths(key: string, f: Figure, colour: string, sheer: boolean): string {
  const sh = SHAPES[key];
  const fill = HEX.test(colour) ? colour : '#9a9a9a';
  const edge = edgeOf(fill);
  const stroke = `stroke="${edge}" stroke-width="0.7" stroke-linejoin="round" stroke-linecap="round"`;
  const op = sheer ? ' fill-opacity="0.55"' : '';
  return placementOf(key, f)
    .map((m) => {
      const p = [`<path d="${mapPath(sh.body, m)}" fill="${fill}"${op} ${stroke}/>`];
      if (sh.extra) p.push(`<path d="${mapPath(sh.extra, m)}" fill="${sh.xfill ?? edge}" ${stroke}/>`);
      if (sh.collar) p.push(`<path d="${mapPath(sh.collar, m)}" fill="rgba(255,255,255,0.3)" ${stroke}/>`);
      if (sh.detail) p.push(`<path d="${mapPath(sh.detail, m)}" fill="none" stroke="${edge}" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>`);
      return p.join('');
    })
    .join('');
}

/** The torso, neck, head and legs, in skin; the arms are drawn later, between the bottoms and the tops. */
function bodyPaths(f: Figure): string {
  const { top: T, bottom: B } = mapsOf(f);
  const neckX = 50 - f.neck / 2 / f.torso; // the neck's edge, in the tops' grid
  const half = (side: (m: MapFn) => MapFn) => {
    const t = side(T);
    const b = side(B);
    return [t(neckX, 14), t(31, 15), t(...SHOULDER), t(...ARMPIT), t(32.8, 55), t(32.5, 62), b(34, 16), b(33.5, 40), b(50, 46)];
  };
  const l = half((m) => m);
  const q = half(mirror);
  const torso =
    `M${pt(l[0])} Q${pt(l[1])} ${pt(l[2])} L${pt(l[3])} Q${pt(l[4])} ${pt(l[5])} L${pt(l[6])} L${pt(l[7])} L${pt(l[8])}` +
    ` L${pt(q[7])} L${pt(q[6])} L${pt(q[5])} Q${pt(q[4])} ${pt(q[3])} L${pt(q[2])} Q${pt(q[1])} ${pt(q[0])} Z`;
  const leg = (m: MapFn) => `M${pt(m(34, 16))} L${pt(m(32, 98))} L${pt(m(46, 98))} L${pt(m(50, 46))} L${pt(m(50, 16))} Z`;
  const [ax] = B(32, 98);
  const [ix] = B(46, 98);
  const foot = (cx: number) => `<ellipse cx="${r(cx)}" cy="${SOLE - 2.6}" rx="6" ry="2.6" fill="${SKIN}"/>`;
  return [
    `<rect x="${r(50 - f.neck / 2)}" y="24" width="${r(f.neck)}" height="20" fill="${SKIN_SHADE}"/>`,
    `<path d="${torso}" fill="${SKIN}"/>`,
    `<path d="${leg(B)}" fill="${SKIN}"/>`,
    `<path d="${leg(mirror(B))}" fill="${SKIN}"/>`,
    foot((ax + ix) / 2 - 1.5),
    foot(100 - (ax + ix) / 2 + 1.5),
    `<ellipse cx="50" cy="18" rx="9" ry="12" fill="${SKIN}"/>`,
  ].join('');
}

/** Both arms and hands, coming out of the sleeve hem of the outermost top, or from the shoulder when nothing with sleeves is worn. */
function armPaths(f: Figure, sleeveKey: string | undefined): string {
  const hem = sleeveKey ? SLEEVE_HEM[sleeveKey] : undefined;
  const inside: Pt = [25, 26];
  const outer = hem ? toward(hem[0], inside, 0.3) : SHOULDER;
  const inner = hem ? toward(hem[1], inside, 0.3) : ARMPIT;
  const [wo, wi] = WRIST;
  const arm = (m: MapFn) =>
    `M${pt(m(...outer))} L${pt(m(...wo))} Q${pt(m(7, 97))} ${pt(m(14, 99))} Q${pt(m(21, 97))} ${pt(m(...wi))} L${pt(m(...inner))} Z`;
  const { top } = mapsOf(f);
  return `<path d="${arm(top)}" fill="${SKIN}"/><path d="${arm(mirror(top))}" fill="${SKIN}"/>`;
}

/** The hair: Joe's short, on the head; B's long, behind the head and shoulders with a fringe and side locks in front. */
function hairPaths(f: Figure, colour: string, part: 'back' | 'front'): string {
  const fill = HEX.test(colour) ? colour : '#3b2a1f';
  const edge = edgeOf(fill);
  const stroke = `stroke="${edge}" stroke-width="0.5" stroke-linejoin="round"`;
  if (f.hair === 'short')
    return part === 'front' ? `<path d="M40.8 17 Q40 4 50 4.5 Q60 4 59.2 17 Q57.5 9.5 50 10 Q42.5 9.5 40.8 17 Z" fill="${fill}" ${stroke}/>` : '';
  if (part === 'back') return `<path d="M40.5 16 Q38 3 50 3.5 Q62 3 59.5 16 L62 54 Q50 58 38 54 Z" fill="${fill}" ${stroke}/>`;
  return [
    `<path d="M40.6 21 Q39 3.5 50 4 Q61 3.5 59.4 21 Q57 9 50 9.5 Q43 9 40.6 21 Z" fill="${fill}" ${stroke}/>`,
    `<path d="M41 15 Q39 32 38.5 48 Q41.5 49 43.5 46 Q42.5 30 43.6 17 Z" fill="${fill}" ${stroke}/>`,
    `<path d="M59 15 Q61 32 61.5 48 Q58.5 49 56.5 46 Q57.5 30 56.4 17 Z" fill="${fill}" ${stroke}/>`,
  ].join('');
}

export type DollLayer = 'legs' | 'shoes' | 'bottom' | 'dress' | 'arms' | 'under' | 'top' | 'outer' | 'hat';
export interface DollPiece {
  layer: DollLayer;
  garment: GarmentId;
  key: string;
}

/** The garment a slot's option shows. Both blazers share the option, so the Outer slot takes `outer` (the pack's blazer). */
const garmentIn = (slot: string, option: string | undefined): GarmentId | undefined =>
  (Object.keys(GARMENTS) as GarmentId[]).find((g) => GARMENTS[g].slot === slot && GARMENTS[g].option === option);

export interface DollOptions {
  outfit: Record<string, string>;
  neckline: Neckline;
  /** The layered combinations that passed on this body (the viewer's `layers()`): the tee under a top is drawn only for these, as on the avatar. */
  layers: LayerCombos;
  /** The blazer this person's pack has; without it, the figure's own (Joe a man's, B a woman's). */
  outer?: string;
  figure?: DollFigure;
}

/** What the doll wears, back to front. A tucked-in top stays in its place; it is cut at the waist instead (see `paperDollSvg`). */
export function dollPieces({ outfit, neckline, layers, outer, figure = 'joe' }: DollOptions): DollPiece[] {
  const pieces: DollPiece[] = [];
  const add = (layer: DollLayer, g: GarmentId | undefined, n?: string) => {
    const key = g && dollShapeOf(g, n);
    if (g && key) pieces.push({ layer, garment: g, key });
  };
  add('legs', garmentIn('Legs', outfit.Legs));
  add('shoes', garmentIn(SHOES_SLOT, outfit[SHOES_SLOT]));
  add('bottom', garmentIn('Bottom', outfit.Bottom));
  add('dress', garmentIn(DRESS_SLOT, outfit[DRESS_SLOT]));
  if (layeredOk(layers, outfit, neckline) && outfit[UNDER_SLOT] === UNDER_OPTION) add('under', 'tee', neckline);
  add('top', garmentIn('Top', outfit.Top), neckline);
  if (outfit[OUTER_SLOT] === OUTER_OPTION) add('outer', (outer ?? (figure === 'b' ? 'blazer_female' : 'blazer_male')) as GarmentId);
  add('hat', garmentIn(HAT_SLOT, outfit[HAT_SLOT]));
  return pieces;
}

export interface PaperDollOptions extends DollOptions {
  figure: DollFigure;
  sheer: boolean;
  /** The colour a garment is drawn in (the person's pick, or the default). */
  colour: (garment: GarmentId) => string;
  hair: string;
}

/** The doll in the current outfit, as one SVG. Each layer is a `<g data-layer>` with its garment and shape, for the tests. */
export function paperDollSvg(o: PaperDollOptions): string {
  const f = FIGURES[o.figure];
  const pieces = dollPieces(o);
  const tucked = isTucked(o.outfit);
  // The arms come out of the outermost sleeves: the blazer's, else the top's.
  const sleeved = [...pieces].reverse().find((p) => p.layer === 'outer' || p.layer === 'top');
  const group = (p: DollPiece) => {
    const clip = p.layer === 'top' && tucked ? ' clip-path="url(#doll-tuck)" data-tucked="true"' : '';
    const sheer = o.sheer && p.garment === 'tights';
    return `<g data-layer="${p.layer}" data-garment="${p.garment}" data-shape="${p.key}"${clip}>${garmentPaths(p.key, f, o.colour(p.garment), sheer)}</g>`;
  };
  const layers: string[] = [
    `<g data-layer="hair-back">${hairPaths(f, o.hair, 'back')}</g>`,
    `<g data-layer="body">${bodyPaths(f)}</g>`,
  ];
  // The arms go over the bottoms and the dress and under the sleeves; the front hair over everything but a hat.
  const arms = `<g data-layer="arms">${armPaths(f, sleeved?.key)}</g>`;
  const hair = `<g data-layer="hair">${hairPaths(f, o.hair, 'front')}</g>`;
  let armsDone = false;
  let hairDone = false;
  for (const p of pieces) {
    if (!armsDone && ['under', 'top', 'outer', 'hat'].includes(p.layer)) (layers.push(arms), (armsDone = true));
    if (p.layer === 'hat') (layers.push(hair), (hairDone = true));
    layers.push(group(p));
  }
  if (!armsDone) layers.push(arms);
  if (!hairDone) layers.push(hair);
  const defs = tucked ? `<defs><clipPath id="doll-tuck"><rect x="0" y="0" width="100" height="${r(WAIST_Y + 1)}"/></clipPath></defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 0 84 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" data-figure="${o.figure}">${defs}${layers.join('')}</svg>`;
}
