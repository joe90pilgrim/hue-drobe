# V5-00 Spike: where shoes, hats, jewellery and hair come from

Date: 22 November 2026. Worker: Sonnet, high. About 1 h 20 min of the 4 h ceiling. Blender 5.3.0, MPFB 2.0.18. Nothing was tuned, nothing ships, and `CREDITS.md` is untouched.

## Result

**Shoes, hats and hair can come from the community packs; jewellery mostly cannot.** 22 candidates were fitted on Joe's and B's own bodies (27 fits) with the shipped loader (`pack/fit_template.py`, unchanged): all 27 attach with no manual work. Against the check the build enforces on pack items (0 face pairs between the body as drawn and the item, 0 gap rays), 5 of 10 shoe fits, 1 of 9 hair fits, 5 of 6 hat fits and 0 of 2 necklace fits pass. Where a hat goes over hair, hiding the covered hair faces cuts the hair-through-hat pairs by 71 to 99 per cent but never to 0.

What matters for Joe's decisions:

1. **Pass is not the same as looks right.** The check passes a lumpy trainer and fails a clean-looking boot by 2 gap rays. Every pass or fail below comes with a render.
2. **The shoe textures are a problem in the pipeline, separate from the pack.** Rendered with their own textures, the baseline boots (B) and the Oxfords (B) show pale, sock-like uppers (the V2-07 look, reproduced), and the sneakers, the biker boots, the knee boots and Joe's baseline boots show a patchy, blocky or scrambled texture (8 of 10 fits wrong; only B's sandals and half boots look right). The cause is not diagnosed (V5-01's job). Plain colour hides it but breaks the sandals, whose straps are cut by a transparent texture.
3. **Joe's real hair is not matched by any candidate** (short, fringe sweeping slightly to either side, dark brown), **and B's is matched only roughly** (long, below the shoulders, no fringe, dark brown). Joe gave this description on 22 Nov 2026. The nearest are `elvs_maxwell_hair` (Joe) and `elvs_lady_hippy_hair` (B).
4. **Rings and watches are not worth doing in 3D at phone size**: a 2 cm ring is 12 px wide at the app's default framing and 32 px at its closest zoom. Only a necklace is a candidate, and the one found is a hair-thin line.
5. **Separate or shared**: the five items tried on both bodies got the same verdict on both (5 of 5). Items made for one sex were tried on that body only. Shoes and hair are mostly sex-specific, so they need separate lists; unisex hats do not.

## What was run

- **Packs.** Five CC-BY packs were downloaded whole from `files.makehumancommunity.org` (one mirror), CRC-tested, hashed and copied to the bucket (sizes compared): shoes02, shoes03, hair02, hair03 and hats03. They are in `assets/packs/MANIFEST.md` with sha256 and licence. The Hats 03 file is named `hats03_cc-by.zip` on the site (the others are `_ccby`); `assets/packs/fetch_packs.py` now knows all five. The site was up and serving on 22 Nov 2026; the pack page's shutdown question from V2-07 is not answered by that, but our copies are safe.
- **Loader.** `pack/v5_spike/prepare.py` writes a scratch template per candidate under `private/v5_spike/templates/`, never under `pack/templates/`. Every one has the same settings (cloth settle off, `approved` false, clearance 0.2 cm and 0.1 cm for hair, delete group for shoes only), so no number is forced or tuned. `pack/v5_spike/session.py` runs `pack/fit_template.py` unchanged and then adds weight, colour, size, shoe-against-trousers and the hair check. Bodies are Joe's and B's real bodies only, built by the unchanged `body_from_measurements.py`; the app's own tee and trousers are in every scene.
- **Candidates** (`pack/v5_spike/candidates.json`, chosen from pack names and sex tags before any fitting): shoes, 9 items (Joe 4, B 6, sneakers on both; Shoes 01 baseline boots on each); hair, 7 items (Joe 4, B 5, one on both; Hair 01 baseline on each); hats, 4 items (Joe 3, B 3, two on both); jewellery, 1 item (both). The numbers below are the first run; the renders are in `private/v5_spike/out/<body>/renders/` (git-ignored: they show real bodies), with contact sheets in `private/v5_spike/out/sheets/`.
- **Scale.** No scale was used. The MHCLO fit binds each item to the body's own surface, so a cap or necklace follows each head or neck without a size choice. Joe's decision of 22 Nov (a rigid item may have one uniform size per body) was not needed.
- **Pass rule** (`spike/check_reports.py`): body as drawn 0 face pairs and 0 gap rays. Self pairs and clearance are information for pack items, shown here against the app's own limits (0 and 0.2 cm). A hat over hair also has the layer check (0 pairs, hair 0.2 cm inside).
- **Hair check** (new, in `session.py`, no limit set yet): hair vertices inside the skin or within 2 mm of it, by region of the nearest skin vertex (eye: within 1.5 cm of an eye helper; ear; face: head skin above the mouth joint less 2 cm, front half; scalp). It is counted as the MHCLO fit gives the hair, before the pipeline's push.
- **Hats over hair.** Hats are run alone, then over a hair style using the pipeline's own layering (`hide_inner`: the hair faces a hat covers are removed). Over three styles per body: the one with the fewest hair-check vertices (Joe `cortu_short_messy_hair`, B `punkduck_alpha7_long`), the one that looks best, and the one nearest the real hair (Joe `elvs_maxwell_hair` and `elvs_grump_hair`, B `toigo_blunt_bob` and `elvs_lady_hippy_hair`). The hair check does not see a fringe covering the eyes: the lowest-count hair for Joe has exactly that, and the lowest-count hair for B is a hood over the forehead.

## Tables

Every number is from `python -I pack/v5_spike/summarise.py`, which reads the reports. `Pairs as the pack fits it` is the item over the whole body before our push (the check has teeth where this is above 0). Colour: the area-weighted mean of the texture where the mesh uses it, and the ΔE (CIE76, as V2-07) of that mean after a red, a blue and, for hair, a dark brown tint; about 2 is barely visible, above 10 clearly different. Plain-colour shipping makes the colour exact, but loses the texture.


### shoes

#### Joe

| Item (pack, licence) | Fits | Pairs as drawn / gap rays (0 / 0) | Pairs as the pack fits it | Self pairs / min clearance cm (0 / 0.2) | Weight (GLB KB texture / plain) | Colour | Extra | Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| toigo_ankle_boots_male (shoes01, CC0) | yes | 0 / 2 | 375 | 40 / 0.2 | 4120 tris; 3715 / 82 KB; texture 1510 KB | mean [97, 70, 47]; dE red 47.1, blue 45.2 | trousers pairs 362; drawn with trousers: pairs 362, gaps 2 | **no** |
| culturalibre_sneakers (shoes02, CC-BY) | yes | 0 / 0 | 1579 | 4580 / -0.2 | 9042 tris; 680 / 205 KB; texture 424 KB | mean [136, 115, 113]; dE red 34.6, blue 28.5 | trousers pairs 782; drawn with trousers: pairs 782, gaps 0 | **PASS** |
| mindfront_shoes_oxford_male (shoes02, CC-BY) | yes | 0 / 9 | 1322 | 812 / 0.15 | 5192 tris; 3064 / 104 KB; texture 235 KB | mean [119, 119, 119]; dE red 41.8, blue 27.2 | trousers pairs 332; drawn with trousers: pairs 332, gaps 9 | **no** |
| mindfront_shoes_biker_boots_male (shoes03, CC-BY) | yes | 0 / 0 | 356 | 1410 / 0.2 | 15844 tris; 6474 / 294 KB; texture 1665 KB | mean [70, 63, 58]; dE red 59.1, blue 41.7 | trousers pairs 406; drawn with trousers: pairs 406, gaps 0 | **PASS** |

#### B

| Item (pack, licence) | Fits | Pairs as drawn / gap rays (0 / 0) | Pairs as the pack fits it | Self pairs / min clearance cm (0 / 0.2) | Weight (GLB KB texture / plain) | Colour | Extra | Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| toigo_ankle_boots_female (shoes01, CC0) | yes | 0 / 3 | 852 | 200 / -0.2 | 4120 tris; 3601 / 82 KB; texture 1396 KB | mean [187, 172, 163]; dE red 19.0, blue 18.4 | trousers pairs 48; drawn with trousers: pairs 48, gaps 0 | **no** |
| culturalibre_sneakers (shoes02, CC-BY) | yes | 0 / 0 | 1634 | 4881 / 0.2 | 9042 tris; 680 / 205 KB; texture 424 KB | mean [136, 115, 113]; dE red 34.6, blue 28.5 | trousers pairs 276; drawn with trousers: pairs 276, gaps 0 | **PASS** |
| mindfront_shoes_oxford_female (shoes02, CC-BY) | yes | 0 / 0 | 548 | 462 / 0.2 | 5192 tris; 3064 / 104 KB; texture 235 KB | mean [118, 118, 118]; dE red 41.9, blue 27.3 | trousers pairs 148; drawn with trousers: pairs 148, gaps 0 | **PASS** |
| dressupdoc_sandals1 (shoes02, CC-BY) | yes | 0 / 0 | 24 | 218 / 0.2 | 1384 tris; 397 / 28 KB; texture 362 KB | mean [164, 152, 132]; dE red 25.7, blue 25.6 | trousers pairs 48; drawn with trousers: pairs 48, gaps 0 | **PASS** |
| punkduck_female_half_boots (shoes03, CC-BY) | yes | 0 / 9 | 444 | 100 / 0.2 | 4632 tris; 2383 / 94 KB; texture 866 KB | mean [38, 38, 38]; dE red 75.4, blue 46.3 | trousers pairs 352; drawn with trousers: pairs 352, gaps 0 | **no** |
| punkduck_female_knee_boots (shoes03, CC-BY) | yes | 0 / 101 | 572 | 62 / 0.2 | 3496 tris; 1547 / 71 KB; texture 811 KB | mean [87, 81, 73]; dE red 52.1, blue 38.0 | trousers pairs 420; drawn with trousers: pairs 420, gaps 2 | **no** |

### hair

#### Joe

| Item (pack, licence) | Fits | Pairs as drawn / gap rays (0 / 0) | Pairs as the pack fits it | Self pairs / min clearance cm (0 / 0.2) | Weight (GLB KB texture / plain) | Colour | Extra | Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cortu_short_messy_hair (hair01, CC0) | yes | 825 / 0 | 1366 | 1464 / 0.1 | 1092 tris; 907 / 27 KB; texture 518 KB | mean [159, 141, 124]; dE red 27.2, blue 27.0, dark brown 12.2 | hair check as fitted: eye 0, face 18, ear 8 (of 832 vertices); exported 26 | **no** |
| elvs_maxwell_hair (hair02, CC-BY) | yes | 6 / 0 | 189 | 19 / 0.1 | 1468 tris; 663 / 28 KB; texture 629 KB | mean [125, 5, 4]; dE red 36.2, blue 50.3, dark brown 18.6 | hair check as fitted: eye 0, face 25, ear 12 (of 765 vertices); exported 37 | **no** |
| elvs_grump_hair (hair02, CC-BY) | yes | 198 / 0 | 466 | 10005 / 0.1 | 12332 tris; 3838 / 297 KB; texture 3467 KB | mean [146, 106, 88]; dE red 30.4, blue 34.7, dark brown 15.0 | hair check as fitted: eye 0, face 62, ear 72 (of 9522 vertices); exported 135 | **no** |
| culturalibre_hair_11 (hair03, CC-BY) | yes | 402 / 0 | 1477 | 541 / -0.1 | 44039 tris; 1068 / 844 KB; texture 31 KB | mean [176, 174, 175]; dE red 23.3, blue 15.4, dark brown 9.3 | hair check as fitted: eye 0, face 643, ear 195 (of 22427 vertices); exported 835 | **no** |

#### B

| Item (pack, licence) | Fits | Pairs as drawn / gap rays (0 / 0) | Pairs as the pack fits it | Self pairs / min clearance cm (0 / 0.2) | Weight (GLB KB texture / plain) | Colour | Extra | Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| toigo_blunt_bob (hair01, CC0) | yes | 0 / 0 | 295 | 133 / 0.09 | 2858 tris; 20399 / 61 KB; texture 10303 KB | mean [183, 137, 112]; dE red 19.7, blue 30.2, dark brown 11.4 | hair check as fitted: eye 0, face 68, ear 4 (of 1510 vertices); exported 72 | **PASS** |
| culturalibre_hair_11 (hair03, CC-BY) | yes | 282 / 0 | 1457 | 761 / 0.09 | 44029 tris; 1068 / 844 KB; texture 31 KB | mean [176, 174, 175]; dE red 23.3, blue 15.4, dark brown 9.3 | hair check as fitted: eye 0, face 789, ear 122 (of 22427 vertices); exported 903 | **no** |
| elvs_wavy_bob (hair02, CC-BY) | yes | 4 / 0 | 24 | 253 / -0.1 | 2138 tris; 804 / 111 KB; texture 665 KB | mean [33, 33, 33]; dE red 77.8, blue 47.3, dark brown 22.4 | hair check as fitted: eye 0, face 12, ear 44 (of 3606 vertices); exported 16 | **no** |
| elvs_lady_hippy_hair (hair02, CC-BY) | yes | 54 / 0 | 287 | 866 / -0.1 | 5003 tris; 2395 / 126 KB; texture 1218 KB | mean [185, 127, 72]; dE red 21.1, blue 42.4, dark brown 12.2 | hair check as fitted: eye 0, face 9, ear 15 (of 4001 vertices); exported 24 | **no** |
| punkduck_alpha7_long (hair03, CC-BY) | yes | 1525 / 0 | 1008 | 1314 / 0.1 | 3888 tris; 4171 / 79 KB; texture 4074 KB | mean [46, 38, 37]; dE red 71.4, blue 46.6, dark brown 22.0 | hair check as fitted: eye 0, face 10, ear 3 (of 2258 vertices); exported 13 | **no** |

### hats

#### Joe

| Item (pack, licence) | Fits | Pairs as drawn / gap rays (0 / 0) | Pairs as the pack fits it | Self pairs / min clearance cm (0 / 0.2) | Weight (GLB KB texture / plain) | Colour | Extra | Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| jujube_newsboy_cap (hats01, CC0) | yes | 0 / 0 | 0 | 20 / 0.35 | 996 tris; none / 19 KB; texture 0 KB | plain, no texture | over elvs_grump_hair (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 3005, after 186; 6121 hair faces hidden; layer check fails; over elvs_maxwell_hair (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 712, after 74; 810 hair faces hidden; layer check fails; over cortu_short_messy_hair (fewest hair-check vertices): hair pairs before hiding 479, after 67; 636 hair faces hidden; layer check fails | **PASS** |
| elvs_slouchy_beanie1 (hats03, CC-BY) | yes | 0 / 0 | 30 | 127 / 0.2 | 1180 tris; ~2057 / 22 KB; texture 2035 KB | mean [93, 84, 76]; dE red 49.9, blue 37.0 | over elvs_grump_hair (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 4410, after 48; 11771 hair faces hidden; layer check fails; over elvs_maxwell_hair (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 517, after 12; 977 hair faces hidden; layer check fails; over cortu_short_messy_hair (fewest hair-check vertices): hair pairs before hiding 1031, after 105; 930 hair faces hidden; layer check fails | **PASS** |
| elvs_male_trilby_hat (hats03, CC-BY) | yes | 0 / 0 | 0 | 228 / 0.2 | 28602 tris; ~1198 / 518 KB; texture 680 KB | mean [134, 108, 60]; dE red 34.5, blue 44.4 | over elvs_grump_hair (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 2889, after 168; 6464 hair faces hidden; layer check fails; over elvs_maxwell_hair (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 960, after 91; 787 hair faces hidden; layer check fails; over cortu_short_messy_hair (fewest hair-check vertices): hair pairs before hiding 1082, after 230; 610 hair faces hidden; layer check fails | **PASS** |

#### B

| Item (pack, licence) | Fits | Pairs as drawn / gap rays (0 / 0) | Pairs as the pack fits it | Self pairs / min clearance cm (0 / 0.2) | Weight (GLB KB texture / plain) | Colour | Extra | Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| jujube_newsboy_cap (hats01, CC0) | yes | 0 / 0 | 0 | 20 / 0.29 | 996 tris; none / 19 KB; texture 0 KB | plain, no texture | over elvs_lady_hippy_hair (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 787, after 86; 1531 hair faces hidden; layer check fails; over punkduck_alpha7_long (fewest hair-check vertices): hair pairs before hiding 822, after 99; 538 hair faces hidden; layer check fails; over toigo_blunt_bob (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 154, after 44; 1030 hair faces hidden; layer check fails | **PASS** |
| elvs_slouchy_beanie1 (hats03, CC-BY) | yes | 0 / 0 | 29 | 207 / -0.2 | 1180 tris; ~2057 / 22 KB; texture 2035 KB | mean [93, 84, 76]; dE red 49.9, blue 37.0 | over elvs_lady_hippy_hair (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 1141, after 50; 2292 hair faces hidden; layer check fails; over punkduck_alpha7_long (fewest hair-check vertices): hair pairs before hiding 1336, after 80; 1088 hair faces hidden; layer check fails; over toigo_blunt_bob (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 638, after 19; 1638 hair faces hidden; layer check fails | **PASS** |
| aethelraed_unraed_cloche_hat (hats01, CC0) | yes | 54 / 0 | 56 | 0 / 0.34 | 771 tris; ~598 / 16 KB; texture 582 KB | mean [70, 101, 75]; dE red 60.5, blue 39.6 | over elvs_lady_hippy_hair (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 1071, after 25; 2510 hair faces hidden; layer check fails; over punkduck_alpha7_long (fewest hair-check vertices): hair pairs before hiding 783, after 16; 1272 hair faces hidden; layer check fails; over toigo_blunt_bob (chosen by eye: best look, or closest to the real hair): hair pairs before hiding 520, after 5; 1857 hair faces hidden; layer check fails | **no** |

### jewellery

#### Joe

| Item (pack, licence) | Fits | Pairs as drawn / gap rays (0 / 0) | Pairs as the pack fits it | Self pairs / min clearance cm (0 / 0.2) | Weight (GLB KB texture / plain) | Colour | Extra | Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| necklace_wortmann (OpenGameArt, CC0) | yes | 64 / 0 | 42 | 554 / 0.2 | 448 tris; none / 25 KB; texture 0 KB | plain, no texture |  | **no** |

#### B

| Item (pack, licence) | Fits | Pairs as drawn / gap rays (0 / 0) | Pairs as the pack fits it | Self pairs / min clearance cm (0 / 0.2) | Weight (GLB KB texture / plain) | Colour | Extra | Check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| necklace_wortmann (OpenGameArt, CC0) | yes | 64 / 0 | 42 | 449 / 0.2 | 448 tris; none / 25 KB; texture 0 KB | plain, no texture |  | **no** |

### Shared versus separate

| Category | Pass on both | Pass on Joe only | Pass on B only | Pass on neither |
| --- | --- | --- | --- | --- |
| shoes | 1: culturalibre_sneakers | 1: mindfront_shoes_biker_boots_male (tried on joe only) | 2: dressupdoc_sandals1 (tried on b only), mindfront_shoes_oxford_female (tried on b only) | 5: mindfront_shoes_oxford_male (tried on joe only), punkduck_female_half_boots (tried on b only), punkduck_female_knee_boots (tried on b only), toigo_ankle_boots_female (tried on b only), toigo_ankle_boots_male (tried on joe only) |
| hair | 0:  | 0:  | 1: toigo_blunt_bob (tried on b only) | 7: cortu_short_messy_hair (tried on joe only), culturalibre_hair_11, elvs_grump_hair (tried on joe only), elvs_lady_hippy_hair (tried on b only), elvs_maxwell_hair (tried on joe only), elvs_wavy_bob (tried on b only), punkduck_alpha7_long (tried on b only) |
| hats | 2: elvs_slouchy_beanie1, jujube_newsboy_cap | 1: elvs_male_trilby_hat (tried on joe only) | 0:  | 1: aethelraed_unraed_cloche_hat (tried on b only) |
| jewellery | 0:  | 0:  | 0:  | 1: necklace_wortmann |

### Jewellery: projected size on a Pixel 8

| Body | Item | Width x depth x height (cm) | Default framing px (wide x high) | Closest zoom px (wide x high) |
| --- | --- | --- | --- | --- |
| joe | necklace_wortmann | 17.8 x 14.7 x 4.7 | 109 x 29 | 282 x 75 |
| b | necklace_wortmann | 14.3 x 13.9 x 3.8 | 87 x 23 | 227 x 60 |

Reference items on the same screen: a 2 cm ring is 12 px and 32 px wide (default, closest); a 4 cm watch face 24 px and 63 px.


## What the renders show (the look claim for each table row)

Renders are in `private/v5_spike/out/<body>/renders/<item>_front|q34|back.png` (plain colour, `spike/blender/render_closeup.py`), `<item>__trousers_*.png` (shoes with the app's trousers), `<item>__textured_*.png` (shoes with their own texture, `pack/v5_spike/render_textured.py`) and `<hat>_over_<hair>_*.png` (hat over hair, the covered hair faces hidden). One round each, no tuning.

- **Shoes, plain colour.** Joe: the baseline ankle boots and the biker boots are clean; the Oxfords have white holes over the toe cap (the 9 gap rays); the sneakers are a lumpy high-top that reads as a trainer. B: the Oxfords are a neat low lace-up; the half boots and the knee boots show bare toes through the front (101 gap rays on the knee boots); the baseline ankle boots show bare toes too. The sandals look like a closed shoe in plain colour, because their straps are cut by a transparent texture; with the texture they are proper sandals.
- **Shoes, textured.** The baseline boots (B) and the Oxfords (B) show a near-white sock-like upper over a dark or wedge sole, the V2-07 look reproduced. The sneakers show scrambled red and black; the knee boots, the biker boots and Joe's baseline boots show blocky, mis-registered leather. Joe: 4 of 4 look wrong with the texture; B: 4 of 6 (the sandals and the half boots look right). I did not diagnose it.
- **Hair (plain colour).** Joe: `cortu_short_messy_hair` has a fringe over the eyes; `elvs_maxwell_hair` is a neat short spiky cut with no fringe; `elvs_grump_hair` is swept to the side; `culturalibre_hair_11` brings its own eyebrows, goatee and a top knot (not usable as hair; it shows the packs hold beard parts, which matters for Joe). B: the blunt bob is clean and ends at the shoulders; `elvs_wavy_bob` is curly and short; `elvs_lady_hippy_hair` is long and parted with a side sweep over one eye; `punkduck_alpha7_long` is a hood over the forehead.
- **Hats alone** are clean on both bodies. The cloche is the only hat with a fault: 54 face pairs with B's head.
- **Hats over hair.** The covered hair is hidden, but on spiky or short hair the tips still show through the crown (Joe, `elvs_maxwell_hair` under the cap and the trilby), and the cap's band shows a row of jagged hair edges. Over long hair (B) the result reads as a cap over loose hair, with a jagged edge where the hidden hair stops.
- **Necklace.** A hair-thin gold line at collarbone height with a small pendant, on both bodies. Seen from behind, a short bar at the back of the neck.

## Recommendation per category per body

"Use" means the item is the best found and is worth a ticket; the cost to ship is in the right-hand column. Costs are in work steps and are not measured except where a number is given. Nothing here is Joe's decision.

| Category, body | Recommendation | Why | Cost to ship |
| --- | --- | --- | --- |
| Shoes, Joe, boots | **Use `mindfront_shoes_biker_boots_male`** (CC-BY, Mindfront) | Passes (0 pairs, 0 gap rays); clean in every render. Baseline `toigo_ankle_boots_male` also looks clean but misses by 2 gap rays | Template and credit; 15,844 triangles (4.2 times the app's tee); 406 trouser-hem pairs need a rule; texture 1,665 KB (V5-05), render patchy (V5-01) |
| Shoes, Joe, trainers | **None found**, `culturalibre_sneakers` (CC-BY) passes but is lumpy | Passes on both bodies; 4,580 self pairs; patchy texture; 782 trouser pairs on Joe | As above, plus a better trainer |
| Shoes, Joe, low shoes | **None found** | `mindfront_shoes_oxford_male` fails: 9 gap rays, holes over the toe | None |
| Shoes, B, sandals | **Use `dressupdoc_sandals1`** (CC-BY, DressUpDoc) | Passes; 1,384 triangles; but its shape needs the transparent texture (362 KB), so it cannot be plain colour | Template and credit; keep the texture (V5-05 shrinks it); no delete group, so nothing hidden |
| Shoes, B, low shoes | **Use `mindfront_shoes_oxford_female`** (CC-BY, Mindfront) | Passes (0, 0); neat | Template and credit; the pale-upper texture to diagnose (V5-01); 148 trouser pairs |
| Shoes, B, boots | **None found**; baseline `toigo_ankle_boots_female` (CC0) fails by 3 gap rays | The two CC-BY boots fail (9 and 101 gap rays) and show bare toes | Pale-sock diagnosis first (V5-01) |
| Hair, Joe | **None matches.** Nearest: `elvs_maxwell_hair` (CC-BY, Elvaerwyn); baseline `cortu_short_messy_hair` (CC0) has a fringe over the eyes | No style has a fringe that sweeps to both sides. Maxwell is neat and short but fails the pack check by 6 pairs | Credit; needs a hair check with a limit (none exists); its texture is red (mean 125, 5, 4), so plain colour only |
| Hair, B | **Keep the baseline `toigo_blunt_bob`** (CC0) as the stopgap; nearest long style `elvs_lady_hippy_hair` (CC-BY) | The bob is the only hair that passes (0 pairs) but ends at the shoulders, not below; the long style fails by 54 pairs | The bob's 3,600 px texture makes a 20.4 MB file (over the 15 MB pack limit alone; 61 KB in plain colour); V5-05 or plain colour |
| Hats, both | **Use `jujube_newsboy_cap`** (CC0) **and `elvs_slouchy_beanie1`** (CC-BY, Elvaerwyn) | Both pass alone on both bodies; the cap is 996 triangles, 19 KB; the beanie 1,180 triangles, 22 KB in plain colour | Templates and one credit; a layering rule over hair |
| Hats, Joe, brimmed | **Use with care `elvs_male_trilby_hat`** (CC-BY) | Passes alone, but 28,602 triangles (7.5 times a tee) | Frame rate on the Pixel 8 first |
| Hats, B, brimmed | **None found** | `aethelraed_unraed_cloche_hat` has 54 face pairs with B's head | None |
| Hat over hair | **Not solved by hiding alone** | 71 to 99 per cent of the hair-through-hat pairs go, but 5 to 230 remain and show as jagged tips | A rule from Joe (below) |
| Jewellery, necklace | **Possible, low value**: `necklace_wortmann` (CC0, Paul Wortmann) | Converts in 5 s of Blender once the landmarks are chosen; 448 triangles, 25 KB; but 64 face pairs and a 1 px line | Template, no credit; a hand-set pendant orientation |
| Jewellery, ring, watch, bracelet | **Not worth it at phone size**; none with a usable licence found for watch or bracelet | See below | None |

### Jewellery

- **What exists.** OpenGameArt, read on 22 Nov 2026: *Necklace* by Paul Wortmann (CC0, `necklace_1.zip`, 420 KB, blend and OBJ); *Ring Set - Precious Metals* by Clint Bellanger (CC-BY 3.0, `.blend` only, ten rings of 1,000 to 3,000 triangles); *Old Ring* by Kutejnikov (CC-BY 4.0, 23 MB, FBX and OBJ with 2048 px PBR maps). The *Pocket watch* by johndh is GPL or CC-BY-SA, so it is out, and it is not a wristwatch anyway. No bracelet and no wristwatch with a CC0 or CC-BY licence turned up (title, tag and keyword searches). The site refuses an automated fetch (403), so the pages were read in the built-in browser. Only the necklace and the rings zip were downloaded (small, licence read first); the 23 MB ring was not.
- **Converting one (the ticket's limit).** The necklace needed three steps: a rigid 90 degree turn of the OBJ so the pendant faces front (`pack/v5_spike/prep_jewellery.py`), three landmarks set by hand in `meta.json` (the two clavicle joints and the neck joint, with the source scaled to fit; residual 0.0 cm because they are correspondences, not points on the mesh), and `pack/author_template.py` (MakeClothes, 5 s). About 30 minutes of work for the first item; a second necklace would be about 10 minutes. The result fits both bodies and builds, but it is a flat loop with no drape: at clavicle height, 14 by 10 cm on the base body, scaled by the fit.
- **Rough cost to model one each ourselves** (not measured; no modelling was done): necklace 1 to 2 hours, ring 1 hour plus risk (the fingers' pose and size are unknown to the base mesh), watch 2 hours, then about 1 hour each to wire into a template, checks and the app. About 6 to 9 hours for the three, against the 30 minutes above for a community necklace.
- **Projected size on a Pixel 8** (1080 by 2400 px; stage assumed 1080 by 1700 px, the app's camera at 30 degrees vertical field of view, 5.2 m default distance, 2 m closest zoom): see the table above. The necklace spans 109 px (Joe) and 87 px (B) at the default framing and 282 and 227 px at the closest zoom, but its line is about 1 px thick at the default. A 2 cm ring would be 12 px and 32 px wide; a 4 cm watch face 24 px and 63 px. **Plain statement: rings and watches are not worth doing in 3D at phone size.** A ring at the default is a dot and at the closest zoom the size of a thumbnail, on a hand that sits at the side of the avatar; a necklace is the only one that reads, and only at close zoom. A colour dot or icon in the outfit list would show the same information.
- Rendered at that scale (the closest-zoom sheets for both bodies) the necklace is visible but faint; the sheets are `private/v5_spike/out/sheets/joe_neck.png` and `b_neck.png`. No phone test was run.

## Shared versus separate: reading

The generated table above counts the items that pass on both, on one and on neither, per category. Reading it with the renders:

- **Items tried on both bodies agree.** The sneakers, the cap and the beanie pass on both; `culturalibre_hair_11` and the necklace fail on both (5 of 5 the same verdict). The numbers differ by body (for example the sneakers' trouser pairs are 782 on Joe and 276 on B), but not the verdict.
- **Shoes and hair are mostly sex-specific** (6 of 9 shoes and 5 of 8 hair styles are tagged or sized for one body), so a separate list is natural, and a shared list would offer Joe skirt-length boots and B men's biker boots. **Hats are unisex** in these packs.
- **A per-person garment library is a data-model change** (Joe's decision). The evidence is that a shared catalogue with a per-body "fits / does not fit" flag would hold for hats but not for shoes or hair; a per-person list is cleaner for shoes and hair. The spike did not try a female item on Joe's body or a male item on B's, so it cannot say what that looks like.

## Licences and credits

- Every candidate is CC0 or CC-BY by its pack's json, which is what the build checks (`fit_template.pack_licence_error`). The item's own `mhclo` header can differ: `dressupdoc_sandals1`, `punkduck_alpha7_long` (both CC-BY by the pack) and `jujube_newsboy_cap` (CC0 by the pack) carry the MakeClothes default line `AGPL3` in the header; `cortu_short_messy_hair`, `elvs_grump_hair` and `elvs_slouchy_beanie1` have no licence line. The others agree with the pack (`CC BY 4.0` for Mindfront, `CC_by` for Elvaerwyn, `cc-by` for culturalibre). Joe's call whether the pack json is enough for items whose header says AGPL3; V3-07a already took it as the authority.
- Credits needed if these ship (CC-BY): Mindfront (biker boots, Oxford, Mindfront (Sweden)), DressUpDoc (sandals), Elvaerwyn (beanie, hair, trilby), culturalibre (sneakers), punkduck (alpha7). CC0 items need none: Newsboy cap, `toigo_blunt_bob`, `toigo_ankle_boots_*`, `cortu_short_messy_hair`, the necklace. The known exception in Shoes 01, `culturalibre_heroine_boots_4`, was not used.

## What this means for V5-01 to V5-05 (proposals only; Joe writes the tickets)

- **V5-01 shoes.** Start with Joe: biker boots; B: sandals and Oxfords. Before any shoe ships: diagnose the pale and patchy textures (8 of 10 fits wrong with their texture here); a trouser-hem rule (the clash is 48 to 782 face pairs with the app's trousers, so it is real); and a decision on plain colour (the sandals cannot be plain). Weight: the biker boots are 6.5 MB with texture, 294 KB without.
- **V5-02 hats.** Cap and beanie for both, trilby for Joe if its 28,602 triangles are acceptable on the phone. The open question is the rule for a hat over hair (see below).
- **V5-03 jewellery.** Necklace only, and only if Joe wants a faint line; the ring and the watch are better as an icon or nothing. Rings could come back if the avatar's hands become a close-up feature.
- **V5-04 hair.** Needs a hair check with a limit first (the spike's check has none; the numbers per style are in the tables), and a decision on style: no candidate matches Joe's fringe and none matches B's length. Hair also needs plain colour or a brightness fix, because the dark-brown ΔE is 9 to 22 and the Maxwell texture is red.
- **V5-05 texture shrink.** The sizes to shrink are in the tables: `toigo_blunt_bob` 10.3 MB texture (20.4 MB file), `punkduck_alpha7_long` 4.1 MB, `elvs_grump_hair` 3.5 MB, the biker boots 1.7 MB. It should also explain the scrambled mapping before shrinking it.

## Decisions for Joe afterwards

1. Per category and per body: which item, or none (the table above is a recommendation, not the answer).
2. Does each person get their own garment library? (Data model and library scope; the counts above are the evidence.)
3. A hat over hair: accept the leftover jagged hair tips, hide the hair completely under any hat, or limit hats to the styles that leave no hair through them? Hiding covered faces alone leaves 5 to 230 face pairs.
4. Is the pack json enough for items whose header says AGPL3?
5. Hair that is not Joe's or B's: stay with the nearest style and recolour, or model one (a hair model is a different job from the clothes templates)?

## Not done, not reliable

- **No phone test.** Frame rate and download on the Pixel 8 were not measured; the jewellery sizes assume a stage height.
- **Ticket scope, not done.** Not every category reached three candidates per body that look right; B's boots, Joe's trainers and low shoes have none that do. The Old Ring and the ring set were not downloaded or converted (ticket limit: one conversion).
- **One render round each**, as the ticket says, so a look claim is from one view set. EEVEE crashed now and then in parallel, so renders were rerun one at a time until the three views existed.
- **Hair choices.** The first hat-over-hair run used the hair with the fewest hair-check vertices, which looked worst; the other two runs per body were chosen by eye after the first renders, and Joe gave his and B's hair afterwards. That is a judgement, not a number.
- **Pass rule.** Pass means the build's check for pack items. It says nothing about fringes, trouser hems or texture, which the renders show and the table does not.
- **Self pairs** are large for the sneakers (4,580 and 4,881) because of laces and panels; they are information for pack items in the build, so they did not decide pass.
- **Out of scope, seen.** Hair 03 `culturalibre_hair_11` includes eyebrows, a goatee and a top knot (beards exist in the packs). Glasses, nails and socks were not looked at.
- Scripts: `pack/v5_spike/` (README there). Reports: `private/v5_spike/out/<body>/` (git-ignored).
