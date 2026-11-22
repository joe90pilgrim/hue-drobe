import { describe, expect, it } from 'vitest';
import { cornerAt, inside, moveRect, rectFromDrag, resizeRect, toSource, usable } from '../src/crop';

describe('crop box geometry', () => {
  it('draws a box from a drag in any direction and keeps it inside the image', () => {
    expect(rectFromDrag({ x: 50, y: 80 }, { x: 10, y: 20 }, 100, 200)).toEqual({ x: 10, y: 20, w: 40, h: 60 });
    expect(rectFromDrag({ x: 50, y: 80 }, { x: 500, y: -30 }, 100, 200)).toEqual({ x: 50, y: 0, w: 50, h: 80 });
  });
  it('moves the box without letting it leave the image', () => {
    const r = { x: 10, y: 10, w: 40, h: 60 };
    expect(moveRect(r, 20, 30, 100, 200)).toEqual({ x: 30, y: 40, w: 40, h: 60 });
    expect(moveRect(r, 500, 500, 100, 200)).toEqual({ x: 60, y: 140, w: 40, h: 60 });
    expect(moveRect(r, -500, -500, 100, 200)).toEqual({ x: 0, y: 0, w: 40, h: 60 });
  });
  it('resizes from a corner and keeps the opposite corner still', () => {
    const r = { x: 10, y: 20, w: 40, h: 60 };
    expect(resizeRect(r, 'se', { x: 90, y: 150 }, 100, 200)).toEqual({ x: 10, y: 20, w: 80, h: 130 });
    expect(resizeRect(r, 'nw', { x: 0, y: 0 }, 100, 200)).toEqual({ x: 0, y: 0, w: 50, h: 80 });
    expect(resizeRect(r, 'ne', { x: 5, y: 40 }, 100, 200)).toEqual({ x: 5, y: 40, w: 5, h: 40 }); // dragged past the other side: flips
  });
  it('finds the nearest corner within reach, and the box interior', () => {
    const r = { x: 10, y: 20, w: 40, h: 60 };
    expect(cornerAt(r, { x: 12, y: 22 }, 20)).toBe('nw');
    expect(cornerAt(r, { x: 48, y: 78 }, 20)).toBe('se');
    expect(cornerAt(r, { x: 30, y: 50 }, 20)).toBeNull();
    expect(inside(r, { x: 30, y: 50 })).toBe(true);
    expect(inside(r, { x: 80, y: 50 })).toBe(false);
  });
  it('treats a tiny box as a tap', () => {
    expect(usable({ x: 0, y: 0, w: 5, h: 100 })).toBe(false);
    expect(usable({ x: 0, y: 0, w: 30, h: 100 })).toBe(true);
  });
  it('maps the box to whole pixels on the full-size screenshot', () => {
    // A 400 x 900 screenshot shown at 200 x 450.
    expect(toSource({ x: 50, y: 100, w: 100, h: 200 }, { w: 200, h: 450 }, { w: 400, h: 900 })).toEqual({ x: 100, y: 200, w: 200, h: 400 });
    // The whole image maps to the whole screenshot, never past its edge.
    expect(toSource({ x: 0, y: 0, w: 200, h: 450 }, { w: 200, h: 450 }, { w: 401, h: 901 })).toEqual({ x: 0, y: 0, w: 401, h: 901 });
  });
});
