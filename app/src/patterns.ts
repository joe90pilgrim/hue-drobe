// Patterns (V9-01): the five options, which garments can have one, and the stored shapes. Shared by the data (wardrobe.ts, outfits.ts),
// the Try On editor, and later the 2D drawing (V9-02) and the 3D spike (V9-03). Nothing here draws.
// Decisions: docs/decisions/2026-11-27-v9-patterns.md (two colours only; every garment except shoes; five options).
import { GARMENTS, isShoe, type GarmentId } from './wardrobe';

export const PATTERNS = {
  plain: { label: 'Plain', word: '' },
  hstripes: { label: 'Horizontal stripes', word: 'striped' },
  vstripes: { label: 'Vertical stripes', word: 'pinstriped' },
  spots: { label: 'Spots', word: 'spotted' },
  flowers: { label: 'Flowers', word: 'floral' },
} as const;
export type PatternId = keyof typeof PATTERNS;
export const PATTERN_IDS = Object.keys(PATTERNS) as PatternId[];
export const isPatternId = (x: unknown): x is PatternId => typeof x === 'string' && Object.prototype.hasOwnProperty.call(PATTERNS, x);

/** The Try On key that remembers each garment's pattern: `{ [garment id]: { pattern, colour } }`, a garment with no entry being plain. Same shape rules as `colours`. */
export const PATTERNS_KEY = 'patterns';

/** A pattern and its colour (the second colour; the first is the garment's own). Never `plain`: a plain garment has no choice. */
export interface PatternChoice {
  pattern: Exclude<PatternId, 'plain'>;
  colour: string;
}
export type PatternMap = Record<string, PatternChoice>;

const HEX = /^#[0-9a-f]{6}$/i;

/** Every garment except shoes (Joe, 27 Nov 2026). False for `hair` and for ids that are not garments. */
export const isPatternable = (garment: string): boolean => garment in GARMENTS && !isShoe(garment);

/** A pattern choice, checked: undefined when the id is unknown or plain, the colour is not a hex, or the garment cannot have a pattern. */
export function cleanChoice(garment: string, pattern: unknown, colour: unknown): PatternChoice | undefined {
  if (!isPatternable(garment) || !isPatternId(pattern) || pattern === 'plain') return undefined;
  if (typeof colour !== 'string' || !HEX.test(colour)) return undefined;
  return { pattern, colour: colour.toLowerCase() };
}

/** Cleans the stored `patterns` map; anything unusable is dropped. Returns undefined when the value is not an object (as the backup cleaners do). */
export function cleanPatterns(v: unknown): PatternMap | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: PatternMap = {};
  for (const [g, c] of Object.entries(v)) {
    const r = c && typeof c === 'object' ? (c as Record<string, unknown>) : {};
    const choice = cleanChoice(g, r.pattern, r.colour);
    if (choice) out[g] = choice;
  }
  return out;
}

/** What an item says about its pattern, as a choice (undefined for plain). */
export function choiceOf(item: { garment: string; pattern?: unknown; patternColour?: unknown }): PatternChoice | undefined {
  return cleanChoice(item.garment, item.pattern, item.patternColour);
}

/** The map after wearing an item: its garment gets the item's pattern, or none (so a plain item leaves no earlier pattern behind). */
export function withItemPattern(map: PatternMap, item: { garment: GarmentId; pattern?: unknown; patternColour?: unknown }): PatternMap {
  const { [item.garment]: _old, ...rest } = map;
  const choice = choiceOf(item);
  return choice ? { ...rest, [item.garment]: choice } : rest;
}

/** A colour that shows up on the base: white on a dark base, near-black on a light one. The first pattern colour offered for a garment. */
export function contrastColour(base: string): string {
  const n = parseInt(base.slice(1), 16);
  const y = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return y < 0.5 ? '#ffffff' : '#1a1a1a';
}
