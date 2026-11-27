// V8-01: the 2D paper-doll on Try On. A generic figure per person (the app holds no measurements), drawn from a few landmarks
// (shoulders, chest, waist, hips, knees, wrists), with every garment drawn fitted to that figure, as in Gemini's prototype
// (docs/designs/2026-11-27-try-on-2d-gemini-prototype). An approximate preview only: the 3D avatar stays the accurate view.
// Pure drawing, no DOM, no store. The layer rules are wardrobe.ts's own (`isTucked`, `layeredOk`); nothing here decides what is worn.
import { silhouetteKey } from './silhouettes';
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

/** Half-widths and height of each figure, in drawing units (the drawing is 300 wide, the ground at y 414). Generic, not measured. */
interface Figure {
  height: number;
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  hair: 'short' | 'long';
}
const FIGURES: Record<DollFigure, Figure> = {
  joe: { height: 1, shoulder: 40, chest: 37, waist: 32, hip: 35, hair: 'short' },
  b: { height: 0.95, shoulder: 34, chest: 33, waist: 26, hip: 38, hair: 'long' },
};

const CX = 150;
const GROUND = 414;
const INK = '#2f3337';
const SKIN = '#e3b892';

/** The figure's landmarks. */
function landmarks(f: Figure) {
  const h = f.height;
  const top = GROUND - 365 * h;
  const headRx = 16.5;
  const headRy = 20.5;
  const headCy = top + headRy;
  const neckTop = headCy + headRy - 3;
  const sY = neckTop + 13 * h;
  const chestY = sY + 38 * h;
  const waistY = sY + 86 * h;
  const hipY = sY + 124 * h;
  const crotchY = hipY + 16 * h;
  const kneeY = crotchY + (GROUND - crotchY) * 0.48;
  const ankleY = GROUND - 12;
  const wristY = hipY + 12 * h;
  return {
    h, top, headRx, headRy, headCy, neckTop, sY, chestY, waistY, hipY, crotchY, kneeY, ankleY, wristY,
    neck: 7.5, hs: f.shoulder, hc: f.chest, hw: f.waist, hh: f.hip,
    armOut: f.shoulder + 8, legGap: 4, thigh: f.hip * 0.88, ankle: 11,
    /** The top of a skirt, trousers or shorts. */
    bTop: sY + 90 * h,
  };
}
type Marks = ReturnType<typeof landmarks>;

const r = (n: number) => String(Math.round(n * 10) / 10);
/** A point `d` out from the centre line: left of it for s = -1, right for s = 1. */
const P = (s: number, d: number, y: number) => `${r(CX + s * d)} ${r(y)}`;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// --- The arm, and a sleeve down it to a given height ------------------------------------------------------------------

/** The arm's outer and inner edges, as distances from the centre line at a height. */
function armEdges(m: Marks, y: number) {
  const outer = lerp(m.hs - 2, m.armOut + 5, (y - (m.sY + 3)) / (m.wristY - (m.sY + 3)));
  const inner = y <= m.chestY + 8 ? m.hc - 1 : lerp(m.hc - 1, m.armOut - 5, (y - (m.chestY + 8)) / (m.wristY - (m.chestY + 8)));
  return { outer, inner };
}
/** One sleeve (side s) from the shoulder to `hemY`, `ease` wider than the arm. */
function sleeve(m: Marks, s: number, hemY: number, ease: number, flare: number): string {
  const e = armEdges(m, hemY);
  const innerTop = Math.min(hemY, m.chestY + 8);
  return `M${P(s, m.hs + ease - 1, m.sY + 3)} L${P(s, e.outer + ease + flare, hemY)} L${P(s, e.inner - ease, hemY + 2 + flare / 2)} L${P(s, m.hc - 1 + ease, innerTop)} L${P(s, m.hc + ease, m.chestY - 6)} Z`;
}
/** Both sleeves. A short sleeve flares out from the arm; a long one follows it. */
const sleeves = (m: Marks, hemY: number, ease: number) => {
  const flare = hemY < m.chestY + 20 ? 6 : hemY < m.wristY - 20 ? 3 : 0;
  return sleeve(m, -1, hemY, ease, flare) + ' ' + sleeve(m, 1, hemY, ease, flare);
};
/** Where the short, mid and long sleeves end. */
const SHORT = (m: Marks) => m.chestY + 6 * m.h;
const ELBOW = (m: Marks) => lerp(m.sY, m.wristY, 0.55);
const CUFF = (m: Marks) => m.wristY - 4;

// --- Garments: each a list of [path, fill] (fill 'self' = the garment's colour) ------------------------------------------

type Part = [d: string, fill: 'self' | 'line' | string];

/** A top's body, `ease` out from the skin, down to `hemY`, with the neckline drawn last. */
function topBody(m: Marks, ease: number, hemY: number, neck: string): string {
  const { hs, hc, hw, hh, sY } = m;
  const n = m.neck + 2;
  return `M${P(-1, n, sY - 1)} L${P(-1, hs + ease, sY + 3)} Q${P(-1, hc + ease, m.chestY)} ${P(-1, hw + ease, m.waistY)} Q${P(-1, Math.max(hh, hw) + ease, m.hipY)} ${P(-1, hh * 0.96 + ease, hemY)}` +
    ` L${P(1, hh * 0.96 + ease, hemY)} Q${P(1, Math.max(hh, hw) + ease, m.hipY)} ${P(1, hw + ease, m.waistY)} Q${P(1, hc + ease, m.chestY)} ${P(1, hs + ease, sY + 3)} L${P(1, n, sY - 1)} ${neck} Z`;
}
const NECKS: Record<string, (m: Marks) => string> = {
  crew: (m) => `Q${P(0, 0, m.sY + 12)} ${P(-1, m.neck + 2, m.sY - 1)}`,
  v: (m) => `L${P(0, 0, m.sY + 24 * m.h)}`,
  scoop: (m) => `Q${P(0, 0, m.sY + 34 * m.h)} ${P(-1, m.neck + 2, m.sY - 1)}`,
};
const teeParts = (neck: string) => (m: Marks): Part[] => [
  [sleeves(m, SHORT(m), 2), 'self'],
  [topBody(m, 2, m.hipY + 2 * m.h, NECKS[neck](m)), 'self'],
  [`M${P(-1, m.hh * 0.96 + 2, m.hipY - 3)} L${P(1, m.hh * 0.96 + 2, m.hipY - 3)}`, 'line'],
];
/** A shirt: a collar, a button placket and sleeves of a given length. */
const shirtParts = (hem: (m: Marks) => number) => (m: Marks): Part[] => {
  const v = m.sY + 16 * m.h;
  const hemY = m.hipY + 8 * m.h;
  return [
    [sleeves(m, hem(m), 3), 'self'],
    [topBody(m, 3, hemY, `L${P(0, 0, v)}`), 'self'],
    [`M${P(-1, m.neck + 3, m.sY - 3)} L${P(-1, m.neck + 9, m.sY + 11 * m.h)} L${P(0, 0, v)} L${P(-1, m.neck - 1, m.sY + 1)} Z M${P(1, m.neck + 3, m.sY - 3)} L${P(1, m.neck + 9, m.sY + 11 * m.h)} L${P(0, 0, v)} L${P(1, m.neck - 1, m.sY + 1)} Z`, 'rgba(255,255,255,0.35)'],
    [`M${P(0, 0, v)} L${P(0, 0, hemY)} M${P(-1, 1.5, v + 14)} L${P(-1, 1.5, v + 14.5)} M${P(-1, 1.5, v + 34)} L${P(-1, 1.5, v + 34.5)} M${P(-1, 1.5, v + 54)} L${P(-1, 1.5, v + 54.5)}`, 'line'],
  ];
};

const DRAW: Record<string, (m: Marks) => Part[]> = {
  tee: teeParts('crew'),
  tee_v: teeParts('v'),
  tee_scoop: teeParts('scoop'),
  sweat: (m) => [
    [sleeves(m, CUFF(m), 3), 'self'],
    [topBody(m, 3, m.hipY + 4 * m.h, NECKS.crew(m)), 'self'],
    [`M${P(-1, m.hh * 0.96 + 3, m.hipY - 3)} L${P(1, m.hh * 0.96 + 3, m.hipY - 3)} M${P(-1, m.neck + 2, m.sY + 3)} Q${P(0, 0, m.sY + 16)} ${P(1, m.neck + 2, m.sY + 3)}` +
      ` M${P(-1, armEdges(m, CUFF(m) - 6).outer + 3, CUFF(m) - 6)} L${P(-1, armEdges(m, CUFF(m) - 6).inner - 3, CUFF(m) - 4)} M${P(1, armEdges(m, CUFF(m) - 6).outer + 3, CUFF(m) - 6)} L${P(1, armEdges(m, CUFF(m) - 6).inner - 3, CUFF(m) - 4)}`, 'line'],
  ],
  shirt_short: shirtParts(SHORT),
  shirt_mid: shirtParts(ELBOW),
  shirt_long: shirtParts(CUFF),
  blazer: (m) => {
    const hemY = m.crotchY + 4 * m.h;
    const btn = m.waistY + 2;
    const n = m.neck + 3;
    const lapel = (s: number) => `M${P(s, n, m.sY - 2)} L${P(s, m.neck + 12, m.chestY - 4)} L${P(s, m.neck + 6, m.chestY - 1)} L${P(0, 0, btn)} Z`;
    return [
      [sleeves(m, CUFF(m) + 1, 4), 'self'],
      [`M${P(-1, n, m.sY - 2)} L${P(-1, m.hs + 3, m.sY + 2)} Q${P(-1, m.hc + 4, m.chestY)} ${P(-1, m.hw + 3, m.waistY)} L${P(-1, Math.max(m.hh, m.hw) + 4, hemY)} L${P(1, Math.max(m.hh, m.hw) + 4, hemY)} L${P(1, m.hw + 3, m.waistY)} Q${P(1, m.hc + 4, m.chestY)} ${P(1, m.hs + 3, m.sY + 2)} L${P(1, n, m.sY - 2)} L${P(0, 0, btn)} Z`, 'self'],
      [`${lapel(-1)} ${lapel(1)}`, 'rgba(255,255,255,0.22)'],
      [`M${P(0, 0, btn)} L${P(0, 0, hemY)} M${P(-1, m.hw + 1, m.hipY - 4)} L${P(-1, m.hw - 11, m.hipY - 4)} M${P(1, m.hw - 11, m.hipY - 4)} L${P(1, m.hw + 1, m.hipY - 4)} M${P(-1, 1, btn + 8)} L${P(-1, 1, btn + 8.5)}`, 'line'],
    ];
  },
  trousers: (m) => legwear(m, m.ankleY - 2, m.ankle + 4),
  shorts: (m) => legwear(m, m.kneeY - 12 * m.h, m.thigh * 0.86),
  skirt: (m) => [
    [`M${P(-1, m.hw + 1, m.bTop)} Q${P(-1, m.hh + 3, m.hipY)} ${P(-1, m.hh + 13, m.kneeY - 4)} Q${P(0, 0, m.kneeY + 2)} ${P(1, m.hh + 13, m.kneeY - 4)} Q${P(1, m.hh + 3, m.hipY)} ${P(1, m.hw + 1, m.bTop)} Z`, 'self'],
    [`M${P(-1, m.hw + 1.5, m.bTop + 6)} L${P(1, m.hw + 1.5, m.bTop + 6)}`, 'line'],
  ],
  tights: (m) => [
    [`M${P(-1, m.hw, m.bTop)} Q${P(-1, m.hh + 1, m.hipY)} ${P(-1, m.thigh + 1, m.crotchY - 4)} L${P(-1, m.legGap + m.ankle + 1, m.ankleY + 2)} L${P(-1, m.legGap + 1, m.ankleY + 2)} L${P(0, 0, m.crotchY + 1)}` +
      ` L${P(1, m.legGap + 1, m.ankleY + 2)} L${P(1, m.legGap + m.ankle + 1, m.ankleY + 2)} L${P(1, m.thigh + 1, m.crotchY - 4)} Q${P(1, m.hh + 1, m.hipY)} ${P(1, m.hw, m.bTop)} Z`, 'self'],
    [`M${P(-1, m.hw + 0.5, m.bTop + 5)} L${P(1, m.hw + 0.5, m.bTop + 5)}`, 'line'],
  ],
  dress: (m) => {
    const n = m.neck + 4;
    const hemY = m.kneeY + 6;
    return [
      [`M${P(-1, n, m.sY - 2)} L${P(-1, m.hs - 7, m.sY + 1)} Q${P(-1, m.hc + 2, m.chestY - 4)} ${P(-1, m.hc + 2, m.chestY + 6)} Q${P(-1, m.hw + 2, m.waistY - 10)} ${P(-1, m.hw + 3, m.waistY)} L${P(-1, m.hh + 9, hemY)}` +
        ` L${P(1, m.hh + 9, hemY)} L${P(1, m.hw + 3, m.waistY)} Q${P(1, m.hw + 2, m.waistY - 10)} ${P(1, m.hc + 2, m.chestY + 6)} Q${P(1, m.hc + 2, m.chestY - 4)} ${P(1, m.hs - 7, m.sY + 1)} L${P(1, n, m.sY - 2)} Q${P(0, 0, m.sY + 22 * m.h)} ${P(-1, n, m.sY - 2)} Z`, 'self'],
      [`M${P(-1, m.hw + 3, m.waistY + 4)} L${P(1, m.hw + 3, m.waistY + 4)}`, 'line'],
    ];
  },
  beanie: (m) => {
    const w = m.headRx + 2.5;
    const band = m.headCy - 9;
    return [
      [`M${P(-1, w - 1, band)} C${P(-1, w, m.top - 9)} ${P(1, w, m.top - 9)} ${P(1, w - 1, band)} Z`, 'self'],
      [`M${P(-1, w + 1, band - 1)} L${P(1, w + 1, band - 1)} L${P(1, w + 1, band + 7)} Q${P(0, 0, band + 9)} ${P(-1, w + 1, band + 7)} Z`, 'self'],
      [[-12, -6, 0, 6, 12].map((x) => `M${r(CX + x)} ${r(band + 1)} L${r(CX + x)} ${r(band + 6)}`).join(' '), 'line'],
    ];
  },
  cap: (m) => {
    const w = m.headRx + 1.5;
    const y = m.headCy - 7;
    return [
      [`M${P(-1, w, y)} C${P(-1, w, m.top - 7)} ${P(1, w, m.top - 7)} ${P(1, w, y)} Z`, 'self'],
      [`M${P(-1, w + 2, y)} Q${P(0, 0, y + 3)} ${P(1, w + 2, y)} Q${P(1, w + 4, y + 7)} ${P(0, 0, y + 8)} Q${P(-1, w + 4, y + 7)} ${P(-1, w + 2, y)} Z`, 'self'],
      [`M${P(0, 0, m.top - 1)} L${P(0, 0, y)} M${P(0, 0, m.top - 1.5)} L${P(0, 0, m.top - 1)}`, 'line'],
    ];
  },
  sneaker: (m) => shoe(m, (s, x) => [
    [`M${P(s, x - 8, GROUND - 3)} Q${P(s, x - 8, m.ankleY - 6)} ${P(s, x, m.ankleY - 6)} Q${P(s, x + 9, m.ankleY - 6)} ${P(s, x + 9, GROUND - 3)} Z`, 'self'],
    [`M${P(s, x - 9, GROUND - 4)} L${P(s, x + 10, GROUND - 4)} L${P(s, x + 10, GROUND)} L${P(s, x - 9, GROUND)} Z`, '#f4f1ec'],
    [`M${P(s, x - 3, m.ankleY - 3)} L${P(s, x + 3, m.ankleY - 3)} M${P(s, x - 3, m.ankleY)} L${P(s, x + 3, m.ankleY)}`, 'line'],
  ]),
  oxford: (m) => shoe(m, (s, x) => [
    [`M${P(s, x - 7, GROUND - 1)} Q${P(s, x - 7, m.ankleY + 1)} ${P(s, x, m.ankleY + 1)} Q${P(s, x + 8, m.ankleY + 2)} ${P(s, x + 9, GROUND - 1)} Z`, 'self'],
    [`M${P(s, x - 8, GROUND - 1.5)} L${P(s, x + 10, GROUND - 1.5)} L${P(s, x + 10, GROUND)} L${P(s, x - 8, GROUND)} Z`, '#2b2b2b'],
    [`M${P(s, x - 5, m.ankleY + 5)} L${P(s, x + 6, m.ankleY + 5)}`, 'line'],
  ]),
  sandal: (m) => shoe(m, (s, x) => [
    [`M${P(s, x - 8, GROUND - 2.5)} L${P(s, x + 10, GROUND - 2.5)} L${P(s, x + 10, GROUND)} L${P(s, x - 8, GROUND)} Z`, '#2b2b2b'],
    [`M${P(s, x - 7, GROUND - 2.5)} L${P(s, x - 6, GROUND - 6)} L${P(s, x + 8, GROUND - 6)} L${P(s, x + 9, GROUND - 2.5)} L${P(s, x + 6, GROUND - 2.5)} L${P(s, x + 5, GROUND - 4)} L${P(s, x - 4, GROUND - 4)} L${P(s, x - 5, GROUND - 2.5)} Z`, 'self'],
    [`M${P(s, x - 5, m.ankleY + 1)} L${P(s, x + 5, m.ankleY + 1)} L${P(s, x + 5, m.ankleY + 3.5)} L${P(s, x - 5, m.ankleY + 3.5)} Z`, 'self'],
  ]),
  boot: (m) => shoe(m, (s, x) => [
    [`M${P(s, x - 7, m.ankleY - 18)} L${P(s, x + 5, m.ankleY - 18)} L${P(s, x + 6, m.ankleY)} Q${P(s, x + 9, m.ankleY + 3)} ${P(s, x + 9, GROUND - 1)} L${P(s, x - 8, GROUND - 1)} Z`, 'self'],
    [`M${P(s, x - 8.5, GROUND - 2)} L${P(s, x + 10, GROUND - 2)} L${P(s, x + 10, GROUND)} L${P(s, x - 8.5, GROUND)} Z`, '#2b2b2b'],
    [`M${P(s, x - 7, m.ankleY - 14)} L${P(s, x + 5, m.ankleY - 14)}`, 'line'],
  ]),
};

/** Trousers or shorts: from the waist, over the hips, to a hem `hemY` with its outer edge `hemOuter` from the centre. */
function legwear(m: Marks, hemY: number, hemOuter: number): Part[] {
  const inseam = m.crotchY + 4;
  return [
    [`M${P(-1, m.hw + 1, m.bTop)} Q${P(-1, m.hh + 2, m.hipY)} ${P(-1, hemOuter, hemY)} L${P(-1, m.legGap - 1, hemY)} L${P(0, 0, inseam)} L${P(1, m.legGap - 1, hemY)} L${P(1, hemOuter, hemY)} Q${P(1, m.hh + 2, m.hipY)} ${P(1, m.hw + 1, m.bTop)} Z`, 'self'],
    [`M${P(-1, m.hw + 1, m.bTop + 6)} L${P(1, m.hw + 1, m.bTop + 6)} M${P(0, 0, m.bTop + 6)} L${P(0, 0, inseam)}`, 'line'],
  ];
}
/** A pair of shoes: the same drawing on each foot, mirrored. */
function shoe(m: Marks, one: (s: number, x: number) => Part[]): Part[] {
  const x = m.legGap + m.ankle / 2 + 1; // the foot's centre, out from the centre line
  return [...one(-1, x), ...one(1, x)];
}

/** The doll shape of a garment (and, for the tee, a neckline), or undefined when it has none. */
export function dollShapeOf(garment: string, neckline?: string): string | undefined {
  const k = silhouetteKey(garment, neckline);
  return k in DRAW ? k : undefined;
}

function partsSvg(parts: Part[], colour: string, sheer: boolean): string {
  const fill = /^#[0-9a-f]{6}$/i.test(colour) ? colour : '#9a9a9a';
  const op = sheer ? ' fill-opacity="0.55"' : '';
  return parts
    .map(([d, f]) =>
      f === 'line'
        ? `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round" opacity="0.55"/>`
        : `<path d="${d}" fill="${f === 'self' ? fill : f}"${f === 'self' ? op : ''} stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
    )
    .join('');
}

// --- The body ---------------------------------------------------------------------------------------------------------

const skin = (d: string) => `<path d="${d}" fill="${SKIN}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;

function bodySvg(m: Marks): string {
  const { hs, hc, hw, hh, sY } = m;
  const torso = `M${P(-1, m.neck, m.neckTop)} L${P(-1, m.neck, sY - 3)} L${P(-1, hs, sY + 3)} Q${P(-1, hc, m.chestY)} ${P(-1, hw, m.waistY)} Q${P(-1, hh, m.hipY)} ${P(-1, hh * 0.92, m.crotchY)}` +
    ` L${P(1, hh * 0.92, m.crotchY)} Q${P(1, hh, m.hipY)} ${P(1, hw, m.waistY)} Q${P(1, hc, m.chestY)} ${P(1, hs, sY + 3)} L${P(1, m.neck, sY - 3)} L${P(1, m.neck, m.neckTop)} Z`;
  const leg = (s: number) => `M${P(s, m.thigh, m.crotchY - 4)} L${P(s, m.legGap, m.crotchY)} L${P(s, m.legGap + 2, m.ankleY)} L${P(s, m.legGap + m.ankle, m.ankleY)} Z`;
  const foot = (s: number) => `M${P(s, m.legGap + m.ankle, m.ankleY)} L${P(s, m.legGap + 2, m.ankleY)} L${P(s, m.legGap, GROUND)} L${P(s, m.legGap + m.ankle + 5, GROUND)} Z`;
  return [leg(-1), leg(1), foot(-1), foot(1), torso].map(skin).join('') + `<ellipse cx="${CX}" cy="${r(m.headCy)}" rx="${m.headRx}" ry="${m.headRy}" fill="${SKIN}" stroke="${INK}" stroke-width="1.5"/>`;
}

function armsSvg(m: Marks): string {
  const arm = (s: number) =>
    `M${P(s, m.hs - 2, m.sY + 3)} L${P(s, m.armOut + 5, m.wristY)} Q${P(s, m.armOut + 2, m.wristY + 10)} ${P(s, m.armOut - 5, m.wristY)} L${P(s, m.hc - 1, m.chestY + 8)} Z`;
  return skin(arm(-1)) + skin(arm(1));
}

/** The hair: Joe's short; B's long, behind the head and down to the shoulders, with a fringe in front. */
function hairSvg(m: Marks, f: Figure, colour: string, part: 'back' | 'front'): string {
  const fill = /^#[0-9a-f]{6}$/i.test(colour) ? colour : '#3b2a1f';
  const { headRx: rx, headCy: cy, top } = m;
  const path = (d: string) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
  if (f.hair === 'short')
    return part === 'front' ? path(`M${P(-1, rx - 1, cy - 5)} C${P(-1, rx, top - 3)} ${P(1, rx, top - 3)} ${P(1, rx - 1, cy - 5)} Q${P(0, 0, cy - 14)} ${P(-1, rx - 1, cy - 5)} Z`) : '';
  if (part === 'back') return path(`M${P(-1, rx + 3, cy - 4)} Q${P(-1, rx + 8, m.neckTop + 20)} ${P(-1, rx + 4, m.sY + 26)} L${P(1, rx + 4, m.sY + 26)} Q${P(1, rx + 8, m.neckTop + 20)} ${P(1, rx + 3, cy - 4)} Z`);
  return path(`M${P(-1, rx, cy + 2)} C${P(-1, rx + 1, top - 4)} ${P(1, rx + 1, top - 4)} ${P(1, rx, cy + 2)} Q${P(1, rx - 4, cy - 10)} ${P(0, 0, cy - 12)} Q${P(-1, rx - 4, cy - 10)} ${P(-1, rx, cy + 2)} Z`);
}

// --- What is worn, and the whole drawing ------------------------------------------------------------------------------

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
  const m = landmarks(f);
  const pieces = dollPieces(o);
  const tucked = isTucked(o.outfit);
  const group = (p: DollPiece) => {
    const clip = p.layer === 'top' && tucked ? ' clip-path="url(#doll-tuck)" data-tucked="true"' : '';
    const sheer = o.sheer && p.garment === 'tights';
    return `<g data-layer="${p.layer}" data-garment="${p.garment}" data-shape="${p.key}"${clip}>${partsSvg(DRAW[p.key](m), o.colour(p.garment), sheer)}</g>`;
  };
  const layers: string[] = [
    `<ellipse cx="${CX}" cy="${GROUND}" rx="48" ry="6" fill="rgba(0,0,0,0.1)"/>`,
    `<g data-layer="hair-back">${hairSvg(m, f, o.hair, 'back')}</g>`,
    `<g data-layer="body">${bodySvg(m)}</g>`,
  ];
  // The arms go over the bottoms and the dress and under the sleeves; the front hair over everything but a hat.
  const arms = `<g data-layer="arms">${armsSvg(m)}</g>`;
  const hair = `<g data-layer="hair">${hairSvg(m, f, o.hair, 'front')}</g>`;
  let armsDone = false;
  let hairDone = false;
  for (const p of pieces) {
    if (!armsDone && ['under', 'top', 'outer', 'hat'].includes(p.layer)) (layers.push(arms), (armsDone = true));
    if (p.layer === 'hat') (layers.push(hair), (hairDone = true));
    layers.push(group(p));
  }
  if (!armsDone) layers.push(arms);
  if (!hairDone) layers.push(hair);
  // A tee tucked into a skirt is cut where the skirt's waistband starts.
  const defs = tucked ? `<defs><clipPath id="doll-tuck"><rect x="0" y="0" width="300" height="${r(m.bTop + 2)}"/></clipPath></defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="80 34 140 388" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" data-figure="${o.figure}">${defs}${layers.join('')}</svg>`;
}
