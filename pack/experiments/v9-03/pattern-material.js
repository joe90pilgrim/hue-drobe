// V9-03 spike only: a runtime material tweak that draws a two-colour pattern from the vertex's position in model space,
// so it needs no UVs. Nothing here ships; CLAUDE.MD currently rules out custom material code.
// Model space = the pack's space: metres, Y up, torso axis near x 0, z 0.03.
export const PATTERN_GLSL = /* glsl */ `
uniform vec3 uSecond;
varying vec3 vObjPos;
varying vec3 vObjNormal;
float band(float s, float w) { // 0 or 1 in equal halves of each period, softened by w (the pixel width in s)
  return smoothstep(0.5 - w, 0.5 + w, abs(fract(s) - 0.5) * 2.0);
}
// 2D flower in a cell: five petals round the middle, the middle left as the base colour. p in cell units, 0..1.
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
#elif PATTERN == 2 // vertical stripes by angle round the body's axis (a whole number of them, so no seam)
  vec2 d = p.xz - vec2(0.0, 0.03);
  float s = atan(d.x, d.y) / 6.2831853 * 48.0;
  float w = clamp(length(vec2(dFdx(s), dFdy(s))), 1e-4, 0.5);
  return band(s, w);
#elif PATTERN == 3 // vertical stripes by distance along x (a plain plane)
  float s = p.x / 0.05; float w = max(fwidth(s), 1e-4);
  return band(s, w);
#elif PATTERN == 4 // spots: balls on a 3D lattice, cut by the cloth, so there is no projection to stretch
  vec3 q = p / 0.04; vec3 f = fract(q) - 0.5; float d = length(f);
  float w = max(length(fwidth(q)), 1e-4);
  return 1.0 - smoothstep(0.30 - w, 0.30 + w, d);
#elif PATTERN == 6 // spots drawn on whichever of the three planes the cloth faces most (hexagonal rows, 4 cm apart)
  vec3 a = abs(n); vec2 uv;
  if (a.z >= a.x && a.z >= a.y) uv = p.xy; else if (a.x >= a.y) uv = p.zy; else uv = p.xz;
  uv /= 0.04; float row = floor(uv.y); uv.x += 0.5 * mod(row, 2.0);
  vec2 f = fract(uv) - 0.5; float w = max(length(fwidth(p)) / 0.04, 1e-4); // from the position, which is continuous where the plane switches
  return 1.0 - smoothstep(0.30 - w, 0.30 + w, length(f));
#else              // flowers: the flower drawn on whichever of the three planes the cloth faces most
  vec3 a = abs(n); vec2 uv;
  if (a.z >= a.x && a.z >= a.y) uv = p.xy; else if (a.x >= a.y) uv = p.zy; else uv = p.xz;
  uv /= 0.07; float row = floor(uv.y); uv.x += 0.5 * mod(row, 2.0);
  return flower(fract(uv));
#endif
}
`;
const IDS = { hstripes: 1, vstripes: 2, vstripes_x: 3, spots3d: 4, flowers: 5, spots: 6 };
export function applyPattern(mat, name, secondHex) {
  const id = IDS[name];
  mat.userData.second = { value: new mat.color.constructor(secondHex) };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSecond = mat.userData.second;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos; varying vec3 vObjNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position; vObjNormal = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#define PATTERN ${id}\n#include <common>\n${PATTERN_GLSL}`)
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, uSecond, patternMask(vObjPos, normalize(vObjNormal)));');
  };
  mat.customProgramCacheKey = () => 'v9-03-' + id;
}
