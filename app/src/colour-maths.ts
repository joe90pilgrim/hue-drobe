// Colour maths for the colour chooser (V1.2-05). Same formulae as the design files (`hsvToHex`, `hexToHsv`).
// Hue is 0 to 359 degrees; strength (saturation) and lightness (HSV value) are 0 to 100. Hex is lower-case sRGB.

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** A six-digit hex with its `#`, in any case. */
export const isHex = (value: string): boolean => HEX.test(value);

/** Accepts `1E2959` or `#1e2959` and returns `#1e2959`; anything else gives null. */
export function normaliseHex(text: string): string | null {
  let t = text.trim();
  if (t && t[0] !== '#') t = '#' + t;
  return HEX.test(t) ? t.toLowerCase() : null;
}

export function hsvToHex(h: number, s: number, v: number): string {
  const sat = s / 100;
  const val = v / 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + to(f(5)) + to(f(3)) + to(f(1));
}

export function hexToHsv(hex: string): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h) % 360, s: max ? Math.round((d / max) * 100) : 0, v: Math.round(max * 100) };
}
