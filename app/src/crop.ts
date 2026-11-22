// V4-02: the crop box for "Add from screenshot". Pure geometry, so it can be tested without a browser.
// All numbers are in the displayed image's own pixels (0..w, 0..h). The sheet maps them to the full-size screenshot.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Smallest box the person can leave, in displayed pixels. Anything smaller is treated as a tap, not a crop. */
export const MIN_CROP = 24;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The box drawn by dragging from one point to another, kept inside the image. */
export function rectFromDrag(a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number): Rect {
  const x0 = clamp(Math.min(a.x, b.x), 0, w);
  const x1 = clamp(Math.max(a.x, b.x), 0, w);
  const y0 = clamp(Math.min(a.y, b.y), 0, h);
  const y1 = clamp(Math.max(a.y, b.y), 0, h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The box moved by (dx, dy), kept inside the image. */
export function moveRect(r: Rect, dx: number, dy: number, w: number, h: number): Rect {
  return { ...r, x: clamp(r.x + dx, 0, w - r.w), y: clamp(r.y + dy, 0, h - r.h) };
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** The box with one corner dragged to a new point. The opposite corner stays put. */
export function resizeRect(r: Rect, corner: Corner, to: { x: number; y: number }, w: number, h: number): Rect {
  const fixed = { x: corner.endsWith('w') ? r.x + r.w : r.x, y: corner.startsWith('n') ? r.y + r.h : r.y };
  return rectFromDrag(fixed, to, w, h);
}

/** Which corner of the box a point is within `reach` of, if any. */
export function cornerAt(r: Rect, p: { x: number; y: number }, reach: number): Corner | null {
  const corners: [Corner, number, number][] = [
    ['nw', r.x, r.y],
    ['ne', r.x + r.w, r.y],
    ['sw', r.x, r.y + r.h],
    ['se', r.x + r.w, r.y + r.h],
  ];
  let best: Corner | null = null;
  let bestD = reach;
  for (const [c, cx, cy] of corners) {
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d <= bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

export const inside = (r: Rect, p: { x: number; y: number }) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** True when the box is big enough to be a deliberate crop. */
export const usable = (r: Rect) => r.w >= MIN_CROP && r.h >= MIN_CROP;

/** The box on the full-size screenshot (whole pixels, at least 1 px each way) for a box drawn on an image shown at `shown` size. */
export function toSource(r: Rect, shown: { w: number; h: number }, source: { w: number; h: number }): Rect {
  const sx = source.w / shown.w;
  const sy = source.h / shown.h;
  const x = clamp(Math.round(r.x * sx), 0, source.w - 1);
  const y = clamp(Math.round(r.y * sy), 0, source.h - 1);
  return { x, y, w: clamp(Math.round(r.w * sx), 1, source.w - x), h: clamp(Math.round(r.h * sy), 1, source.h - y) };
}
