# V9-03 Spike: can the 3D avatar show patterns?

Date: 27 November 2026. Result: **yes, without changing the pack.** None of Joe's wearable garments has UVs, but a small runtime material tweak that draws the pattern from each point's position in model space works on all of them. Horizontal stripes, spots and flowers look good on the tee and sweatshirt. Vertical stripes work on the body of a top but fan out at the shoulders and sleeves, and are predicted to be poor on trousers. The extra cost on desktop is under 0.3 ms a frame and no extra download. Joe decides whether to ticket the build; it needs a `CLAUDE.MD` change (custom material code).

Spike code and README: `pack/experiments/v9-03/`. Three.js 0.170.0 (the app's), Chromium (Playwright) on an AMD Radeon iGPU through ANGLE/D3D11. Renders and JSON reports are in `private/renders/v9-03/`, git-ignored.

**Covered:** Joe's pack only (tee, `tee_v`, `tee_scoop`, sweatshirt, `shirt_short`, `shirt_long`, trousers, shorts, tights, `blazer_male`, cap, beanie). **Not covered:** B's pack, so the skirt, dress and `blazer_female` were not looked at. Rendered: tee and sweatshirt only. The other garments have numbers but no renders.

I treated decision 1 in the ticket (prototype material code, spike only) as a yes, as the ticket recommends, since Question 3 cannot be answered otherwise. The prototype lives only in the harness.

## 1. UVs: only the body and shoes have them

Script: `inspect_glbs.py` (report `private/renders/v9-03/uv_report.json`). Every garment Joe can wear lacks `TEXCOORD_0`.

| Garment | Triangles | KB | `TEXCOORD_0` |
| --- | --- | --- | --- |
| tee, `tee_v`, `tee_scoop` | 3,804 / 4,276 / 4,200 | 70 / 79 / 77 | **no** |
| sweatshirt | 4,864 | 88 | **no** |
| `shirt_short`, `shirt_mid`, `shirt_long` | 4,696 / 4,836 / 5,844 | 115 / 118 / 139 | **no** (they carry `COLOR_0` shading) |
| trousers, shorts, tights | 3,444 / 2,016 / 3,220 | 63 / 38 / 59 | **no** |
| `blazer_male` | 8,242 | 149 | **no** |
| cap, beanie | 996 / 1,180 | 19 / 22 | **no** |
| hair (all three) | 3,460 / 1,652 / 274 | 76 / 36 / 8 | no |
| body (all variants) | 26,756 | 611 | yes |
| sandals, trainers, monk straps | 1,384 / 9,042 / 13,332 | 397 / 680 / 5,109 | yes (they keep textures) |

So the ticket's guess was right: the legacy shells lose UVs when they are rebuilt in `garment.py` (`bmesh.new()`, around line 356, with no UV layer), and template garments have theirs stripped at export (`fit_template.py` ~906). All garments are one material and no pack garment has a texture. Joe's pack has no cloth garments, as inferred.

## 2. Where UVs exist: nothing to test

The only garments with UVs are the body and the shoes, and the shoes are not to be patterned (V9 decision). The body's own UV map is poor for this anyway: normalised stretch median 1.65 and 95th percentile 5.3 (same report), because it is MakeHuman's skin atlas.

For a sense of what putting UVs on a garment would give, `stretch_object_space.py` copies each garment vertex's UV from the nearest body vertex (the cheapest thing a build could do, as the shells are cut from the body mesh):

| Garment | Triangles straddling an island | Stretch of the rest (median / p95) |
| --- | --- | --- |
| tee | 23.6% | 1.45 / 4.1 |
| sweatshirt | 18.7% | 1.47 / 4.0 |
| trousers | 28.9% | 1.46 / 2.8 |
| `blazer_male` | 23.6% | 1.81 / 5.5 |

About a fifth to a third of triangles would be torn across islands, so a simple transfer does not work. It would need a proper unwrap per garment (see question 4). This is a measure of one crude method, not a finished design.

## 3. Where UVs are missing: an object-space pattern works

Script: `stretch_object_space.py` (report `stretch_report.json`); shader: `pattern-material.js`; renders below. The material tweak (`onBeforeCompile`, about 2.3 KB of GLSL source, 1.6 KB gzipped) mixes a second colour into the base colour using the vertex's model-space position and normal. It keeps the garment's own `COLOR_0` shading and the colour picker working.

Stretch is how much wider or narrower a pattern is on the cloth than its nominal size, area-weighted; 1.0 is true size and 2 is twice too wide or narrow. Format: median / 95th percentile / share of area over 2.

| Garment | Horizontal stripes | Vertical stripes (angle round body axis) | Vertical stripes (plain x) | Spots and flowers (triplanar) |
| --- | --- | --- | --- | --- |
| tee | 1.01 / 1.52 / 2.2% | 1.12 / 2.72 / 11.9% | 1.11 / 4.45 / 17.2% | 1.10 / 1.41 / 0% |
| sweatshirt | 1.02 / 1.76 / 3.4% | 1.18 / 4.90 / 30.9% | 1.14 / 3.83 / 13.6% | 1.15 / 1.46 / 0% |
| `shirt_short` | 1.01 / 1.58 / 2.7% | 1.13 / 2.68 / 12.8% | 1.11 / 4.32 / 16.4% | 1.10 / 1.41 / 0% |
| `shirt_long` | 1.02 / 1.76 / 3.1% | 1.19 / 4.72 / 29.0% | 1.13 / 3.86 / 13.7% | 1.14 / 1.44 / 0% |
| `blazer_male` | 1.03 / 1.77 / 2.8% | 1.19 / 4.57 / 27.2% | 1.15 / 3.73 / 14.4% | 1.16 / 1.44 / 0% |
| trousers | 1.01 / 1.08 / 0.2% | 1.52 / 4.19 / 23.4% | 1.39 / 5.63 / 30.0% | 1.10 / 1.36 / 0% |
| shorts | 1.01 / 1.08 / 0.4% | 1.30 / 2.92 / 13.9% | 1.30 / 4.52 / 26.8% | 1.09 / 1.35 / 0% |
| tights | 1.01 / 1.08 / 0.1% | 1.49 / 3.97 / 23.8% | 1.42 / 5.11 / 31.0% | 1.11 / 1.39 / 0% |
| cap | 1.65 / 14.3 / 35.1% | 1.62 / 3.50 / 22.9% | 1.08 / 2.53 / 9.9% | 1.16 / 1.42 / 0% |
| beanie | 1.09 / 2.23 / 8.3% | 1.59 / 3.11 / 23.9% | 1.38 / 4.14 / 30.3% | 1.19 / 1.46 / 0% |

(`tee_v`, `tee_scoop` match the tee within 0.02. Triplanar stretch is one-directional; its worst case is 1.73 where the cloth faces between two axes, and the 95th percentile here is 1.46 or less.)

What the renders show (front, three-quarter and back; Joe's tee and sweatshirt over the plain trousers):

- **Horizontal stripes: good.** `private/renders/v9-03/tee_stripes.png` (top row), `sweatshirt_sheet.png` (top row). Even bands on the torso, and across the sleeves they slice round the arm as a stripe top would.
- **Vertical stripes: acceptable on the torso, poor at the shoulders and sleeves.** `tee_stripes.png` (middle and bottom rows), `sweatshirt_sheet.png`. The angle version (middle) stays even down the body, then fans out over the shoulder, and on the back view the sleeve shows large blotches. The plain-x version (bottom) is even on the front and back but smears across the sides of the body. Both are predicted worse on trousers and tights (the legs need their own axis, not the body's) and I did not render those.
- **Spots: good with the triplanar method.** `tee_spots_front.png` (and the other two views of `tee_spots_*`), `sweatshirt_sheet.png` (row 4). Even round dots. There is a faint vertical break where the projection plane switches at the side (visible at the underarm in `tee_spots_front.png`). The 3D-lattice version (`spots3d`, `tee_spots_variants.png` bottom row) is **not usable**: the cloth cuts the lattice unevenly, giving bare patches and rows of different size dots.
- **Flowers: good.** `tee_spots_flowers.png` (bottom row), `sweatshirt_sheet.png` (row 5). Clean petals on the front, back and sleeves, with the same small plane-switch seams and a few cut flowers at the collar and underarm.

Render rounds used: three (first all patterns on the tee; second the sweatshirt plus the two spot methods; third the spots after fixing a seam-line fault in the first spots shader). The two contact sheets that show spots rows (`sweatshirt_sheet.png`, `tee_spots_variants.png`) were made before that fix and show faint horizontal hairlines that `tee_spots_front.png` does not.

## 4. If a pack change were wanted: estimate only

Not needed for the result above, so this is for completeness. Nothing was built.

- **Where:** legacy shells are built in `spike/blender/garment.py` (`build_tee` ~261 and the trousers, shorts, tights and shirt builders), which makes a fresh `bmesh` with no UV layer. Template garments have their UVs removed at `pack/fit_template.py` ~906, and the MHCLO's own UVs (made for its texture) would be the starting point.
- **Work:** templates, small (keep the UV layer, add a check): about half a day. Legacy shells, large: they need a proper unwrap per garment with sensible seams, because copying the body's UVs tears 19% to 33% of triangles (section 2) and the body's map is itself badly stretched. Roughly two to three days, plus changes to the mesh checks and per-garment tolerances, and a full pack rebuild for both people.
- **File size:** a `TEXCOORD_0` attribute adds 8 bytes a vertex: 4 to 34 KB raw per garment, 1 to 18 KB gzipped (same script). About 0.3 MB raw across a pack of twenty garments. Small against the 15 MB budget.
- **Weaker than the shader on its own terms:** UVs still need a pattern texture drawn at runtime and give seams at every island edge, so the stripes would not be better than the object-space ones unless the unwrap were designed for them.

## 5. Cost

Scripts: `capture.mjs bench` (150 frames, three runs per setting, each frame followed by a 1-pixel readback so the GPU has finished; 600 x 800; tee, trousers and body, 34,004 triangles). Outputs: `bench_tee.txt`, `bench_sweatshirt.txt`. GPU: AMD Radeon iGPU through ANGLE/D3D11.

| Setting | ms per frame, three runs (best of the three) |
| --- | --- |
| tee, plain | 1.95, 1.60, 1.54 (1.54) |
| tee, horizontal stripes | 1.50, 1.43, 1.37 (1.37) |
| tee, vertical stripes | 1.75, 1.69, 1.62 (1.62) |
| tee, spots | 1.52, 1.47, 1.43 (1.43) |
| tee, flowers | 1.78, 1.70, 1.58 (1.58) |
| sweatshirt, plain (two runs) | 1.56, 1.44, 1.44 and 1.66, 1.70, 1.46 |
| sweatshirt, flowers (two runs) | 1.73, 1.74, 1.61 and 1.76, 1.65, 1.65 |

The patterns cost between about 0.15 ms less (noise, the first setting warms up) and about 0.2 ms more, so a 60 fps frame budget of 16.7 ms is untouched on this machine. **Extra download: 0 bytes of pack**, and about 1.6 KB gzipped of app code. **This says nothing about the Pixel 8.** A phone's GPU is far slower at fragment work and the app draws at the phone's pixel ratio, so the frame rate would still need the Pixel 8 check before shipping. The shader is a few arithmetic operations and one `fwidth` per pixel, so I would expect it to be cheap, but that is an expectation, not a measurement.

## Recommendation: (a), it works as the pack is

Build it on the pack as it stands. The build ticket would be small and live in `app/` only:

1. A `CLAUDE.MD` change allowing one named material tweak (`onBeforeCompile`, no custom shader files), because the Garments section currently says no custom material code.
2. `viewer.ts`: `setPattern(name, pattern, colour2)`, using the V9-01 pattern ids, applied beside `setColour`. Keep `COLOR_0` shading, sheer tights and the shoe exclusion working.
3. Horizontal stripes, spots and flowers as in `pattern-material.js` (triplanar, with the AA fix for spots). Treat vertical stripes as the open design point: acceptable on the body of a top, not on sleeves or legs. Options: ship the angle version for tops only; or give each sleeve and leg its own axis (its joint line from the manifest, no pack change); or offer vertical stripes on the 2D doll only.
4. Skip or fix the cap (horizontal stripes 35% of area over 2x) and beanie.
5. A Pixel 8 frame-rate check, and a look at B's garments (skirt, dress, `blazer_female`), which this spike did not cover. The skirt and dress flare away from the body, which may stretch horizontal stripes there.

## Decisions needed from Joe

1. **Ticket the build (a)?** My recommendation: yes, after deciding point 1 (a `CLAUDE.MD` change for one material tweak).
2. **Vertical stripes:** which option in point 3, or accept the torso-only limit.

## What was not done or not reliable

- Joe's body only. B's garments and the dress and skirt shapes are untested.
- Trousers, shorts, tights, shirts, blazer, cap and beanie have stretch numbers but no renders. The vertical-stripe prediction for legs is from the numbers alone.
- Stretch figures use face normals and centroids in Python, written to mirror the shader; the shader uses smoothed vertex normals, so the triplanar seams in the render are slightly different from the numbers.
- Desktop iGPU numbers only, one resolution, no phone. Run-to-run noise is about 0.2 ms, the same size as the pattern cost.
- Lighting, roughness and colours in the harness are my own, not the app's.
