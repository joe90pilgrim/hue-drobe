// V9-04: the one runtime material tweak CLAUDE.MD allows. It draws a two-colour pattern on a garment's material from each point's
// position and normal in model space (metres, Y up), because no garment in the pack has UVs. The base colour stays the material's own
// colour; the second colour is a uniform. Same pattern sizes as the 2D doll's, from the V9-03 spike
// (docs/decisions/2026-11-27-v9-03-3d-pattern-spike.md). Nothing else in the app edits shaders; no files in the pack carry pattern data.
import * as THREE from 'three';
import type { PatternId } from './patterns';

/** The `#if PATTERN` branch each pattern id draws. `plain` has none: it takes the tweak off. */
const SHADER_ID: Record<Exclude<PatternId, 'plain'>, number> = { hstripes: 1, vstripes: 2, spots: 3, flowers: 4 };

/** How a garment's vertical stripes are laid out (the LIMBS define): 1 for tops with sleeves, 2 for trousers, shorts and tights, 0 for the rest (dress, skirt, hats). */
const limbsOf = (group: string): number => (/^(tee|sweatshirt|shirt_\w+|blazer_\w+)$/.test(group) ? 1 : /^(trousers|shorts|tights)$/.test(group) ? 2 : 0);

const GLSL = /* glsl */ `
uniform vec3 uSecond;
varying vec3 vObjPos;
varying vec3 vObjNormal;
float band(float s, float w) { // 0 or 1 in equal halves of each period, softened by w (the pixel width in s)
  return smoothstep(0.5 - w, 0.5 + w, abs(fract(s) - 0.5) * 2.0);
}
// A flower in a cell: five petals round the middle, the middle left as the base colour. p in cell units, 0..1.
float flower(vec2 p) {
  vec2 c = p - 0.5; float r = length(c); float a = atan(c.y, c.x);
  float petal = 0.26 + 0.14 * cos(5.0 * a);
  float body = 1.0 - smoothstep(petal - 0.02, petal + 0.02, r);
  float hole = 1.0 - smoothstep(0.07, 0.10, r);
  return clamp(body - hole, 0.0, 1.0);
}
float patternMask(vec3 p, vec3 n) {
#if PATTERN == 1   // horizontal stripes: bands 2.5 cm high
  float s = p.y / 0.05; float w = max(fwidth(s), 1e-4);
  return band(s, w);
#elif PATTERN == 2 // vertical stripes
  float wp = length(fwidth(p)); // one pixel in metres, from the position, so it stays continuous across the branches below
#if LIMBS == 0     // dress, skirt, hats: by angle round the body's axis (22 of them, about 5 cm apart like the others, so no seam)
  vec2 d = p.xz - vec2(0.0, 0.03);
  float s = atan(d.x, d.y) / 6.2831853 * 22.0;
  return band(s, clamp(wp / 0.0486, 1e-4, 0.5));
#else              // each sleeve and leg runs its stripes along its own axis (fixed constants, A-pose; V9-04 decision 2b)
  vec2 q = vec2(abs(p.x), p.y); vec2 nq = vec2(abs(n.x), n.y);
#if LIMBS == 1     // tops: the torso (inside the armholes) by angle, each sleeve across its axis (about 38 degrees out from straight down)
  if (abs(p.x) < 0.19) {
    vec2 d = p.xz - vec2(0.0, 0.03);
    float s = atan(d.x, d.y) / 6.2831853 * 22.0;
    return band(s, clamp(wp / 0.0486, 1e-4, 0.5));
  }
  const vec2 across = vec2(0.78, 0.62);
#else              // trousers, shorts, tights: each leg across its axis (about 9 degrees out from straight down); the two legs meet at x = 0
  const vec2 across = vec2(0.988, 0.155);
#endif
  // Where the cloth faces sideways to that direction the projection collapses, so use the depth (z) there instead.
  float s = (abs(dot(nq, across)) > abs(n.z) ? p.z : dot(q, across)) / 0.05;
  return band(s, clamp(wp / 0.05, 1e-4, 0.5));
#endif
#elif PATTERN == 3 // spots on whichever of the three planes the cloth faces most (hexagonal rows, 4 cm apart)
  vec3 a = abs(n); vec2 uv;
  if (a.z >= a.x && a.z >= a.y) uv = p.xy; else if (a.x >= a.y) uv = p.zy; else uv = p.xz;
  uv /= 0.04; float row = floor(uv.y); uv.x += 0.5 * mod(row, 2.0);
  vec2 f = fract(uv) - 0.5; float w = max(length(fwidth(p)) / 0.04, 1e-4); // from the position, which is continuous where the plane switches
  return 1.0 - smoothstep(0.30 - w, 0.30 + w, length(f));
#else              // flowers 7 cm across, on the plane the cloth faces most
  vec3 a = abs(n); vec2 uv;
  if (a.z >= a.x && a.z >= a.y) uv = p.xy; else if (a.x >= a.y) uv = p.zy; else uv = p.xz;
  uv /= 0.07; float row = floor(uv.y); uv.x += 0.5 * mod(row, 2.0);
  return flower(fract(uv));
#endif
}
`;

interface PatternState {
  id: Exclude<PatternId, 'plain'>;
  limbs: number;
  second: { value: THREE.Color };
}
const states = new WeakMap<THREE.Material, PatternState>();

/** Draws `pattern` in `hex` (the second colour) on a material, or takes the pattern off for `plain`. Changing only the colour does not recompile. */
export function applyPattern(mat: THREE.Material, pattern: PatternId, hex: string, group = ''): void {
  const had = states.get(mat);
  if (pattern === 'plain') {
    if (!had) return;
    states.delete(mat);
    mat.onBeforeCompile = THREE.Material.prototype.onBeforeCompile;
    mat.customProgramCacheKey = THREE.Material.prototype.customProgramCacheKey;
    mat.needsUpdate = true;
    return;
  }
  const limbs = limbsOf(group);
  if (had && had.id === pattern && had.limbs === limbs) {
    had.second.value.set(hex); // read as sRGB, like the base colour
    return;
  }
  const second = had?.second ?? { value: new THREE.Color(hex) };
  second.value.set(hex);
  states.set(mat, { id: pattern, limbs, second });
  const n = SHADER_ID[pattern];
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSecond = second;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos; varying vec3 vObjNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position; vObjNormal = normal;');
    // After map_fragment and before color_fragment, so a shirt's vertex colours (collar and placket shading) still multiply the result.
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#define PATTERN ${n}\n#define LIMBS ${limbs}\n#include <common>\n${GLSL}`)
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, uSecond, patternMask(vObjPos, normalize(vObjNormal)));');
  };
  mat.customProgramCacheKey = () => `v9-pattern-${n}-${limbs}`; // each GLB has its own material, so the cache must tell the patterns apart
  mat.needsUpdate = true;
}

/** True when the material has a pattern on it (for tests and the `?debug` hook). */
export const hasPattern = (mat: THREE.Material): boolean => states.has(mat);
