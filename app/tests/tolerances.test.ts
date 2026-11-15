import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The single tolerance file lives in spike/. The Python asset checks read it too, so one edit changes both.
const tol = JSON.parse(readFileSync(new URL('../../spike/tolerances.json', import.meta.url), 'utf8'));

describe('spike/tolerances.json', () => {
  it('holds the pass criteria from CLAUDE.md', () => {
    expect(tol.circumference_cm).toBe(2.0);
    expect(tol.length_cm).toBe(1.5);
    expect(tol.garment_landmark_cm).toBe(2.0);
    expect(tol.phone_min_fps).toBe(30);
    expect(tol.phone_max_load_mb).toBe(15);
  });
});
