# V2-07 Spike: free MakeHuman asset packs

Date: 16 November 2026. Result: **none of the 32 fits passes our hard mesh checks, so no category can drop in as it is.** Every item loads and attaches to every body with MPFB's own loader and no manual work (32 of 32). Beyond that, three findings matter: the packs depend on MPFB hiding the body under the garment, textures decide the weight and the colour, and hair and shoes look usable now. Nothing was changed in the app. Joe decides the three questions at the end.

Spike code: `spike/assets/` (README there). Blender 5.3.0, MPFB 2.0.18. Renders and reports are in `private/assets_spike/` on Joe's machine, git-ignored because they show real bodies. B's files and renders are named `b`.

## What was run

- Six CC0 packs (below), one item each, on Joe, B, and one synthetic male and one synthetic female body (the medium ones).
- Each body is built by the unchanged `body_from_measurements.py`, so the app's own tee and trousers are the shipped ones. Each pack item is loaded with `HumanService.add_mhclo_asset` (MPFB's loader, plain-material mode), baked and exported to GLB, then checked with the existing `mesh_checks.py` functions on the GLB read back in. The limits are those in `spike/tolerances.json` for the app's own garments: 0 body face pairs, 0 self pairs, clearance at least 0.2 cm.
- Shoes and hair are the sex-matched variant (male boots and short messy hair on the male bodies, female ankle boots and a blunt bob on the female bodies). The shirt, pants, skirt and dress are the same asset on all four. Two extra items were run for comparison: the crude tees (male and female) and a mini skirt.
- Frame rate on Joe's phone was not measured.

## The six items, against the six points

Ranges are across the four bodies. Face-pair counts are the same check the app's garments must pass at 0.

### 1 and 2. Fit and checks

| Item (asset) | Attaches, no manual work | Body pairs (limit 0) | Self pairs (limit 0) | Min clearance, cm (limit 0.2) | Body vertices MPFB hides | Body pairs with that body hidden |
| --- | --- | --- | --- | --- | --- | --- |
| Shirt (toigo_basic_tucked_t-shirt) | 4 of 4 | 164 to 243 | 15 to 16 | -0.14 to -0.17 | 0 | 115 to 142 |
| Pants (toigo_wool_pants) | 4 of 4 | 9 to 18 | 23 to 39 | -0.02 to 0.01 | 0 | 8 to 16 |
| Skirt (toigo_long_full_skirt) | 4 of 4 | 103 to 577 | 0 to 42 | -0.31 to -1.03 | 1194 | 48 to 136 |
| Dress (toigo_shift_dress) | 4 of 4 | 400 to 689 | 32 to 50 | -0.26 to -0.57 | 1379 | 60 to 65 on B and synthetic female; 335 to 356 on the male bodies |
| Shoes (toigo_ankle_boots, sex-matched) | 4 of 4 | 367 to 868 | 12 to 36 | -0.54 to -1.01 | 2166 to 2206 | 21 to 44 |
| Hair (cortu_short_messy / toigo_blunt_bob) | 4 of 4 | 299 to 1366 | 107 to 1381 | -1.51 to -3.07 | 0 | 247 to 984 |
| *Extra: crude tee, male on Joe and synthetic male* | 2 of 2 | **0** | **0** | **0.18** (misses by 0.02) | 649 | 0 |
| *Extra: crude tee, female on B and synthetic female* | 2 of 2 | 36 on B, 20 synthetic | 0 | 0.05 | 1408 | 0 |
| *Extra: mini skirt (frankyaye_mini_skirt_01)* | 4 of 4 | **0** | 194 to 215 (three layered pieces) | 0.15 to 0.18 | 0 | 0 |

- **0 of 32 fits pass all three limits.** The nearest is the male crude tee: 0 body pairs, 0 self pairs, clearance 0.18 against 0.2.
- **The packs expect the body to be hidden.** MPFB adds a mask on the body for the garment's "delete group" (skirt 1194 vertices, dress 1379, boots about 2200). With the body hidden the dress on B looks clean in front, side and back (render `b__dress__hiddenbody.png`); with it shown, white patches of skin come through at the hips (`synthetic_female_medium__dress.png`). Hiding is acceptable for a garment that covers a region for good, but it would need the checks changed from "no face pairs with the full body" to "nothing of the body shows as drawn", and a layering rule with the app's own garments.
- **Control, to separate the assets from our bodies.** The same items on MPFB's own default body (male variants, same in-memory method): dress 259 pairs, skirt 207, boots 165, tucked tee 115, crude tee 36, hair 979. So the assets clip on the default body too. Our bodies make the skirt (207 to 455), dress (259 to 593) and boots (165 to 338) about twice as bad; the male crude tee gets better (36 to 0). The control crashed Blender for the female variants (an access violation after creating a second body), so it covers the male synthetic only.
- **Mixing with the app's own garments.** The pack tops through the app's trousers: 0 to 220 face pairs (0 only for the male crude tee). The pack trousers through the app's tee: 108 to 293. Pack skirt and dress through the app's tee: 274 to 2038. In the render, the app's tee over a pack skirt shows the skirt's gathered waist poking through in spikes. Any mix needs layer rules, which the app does not have yet.
- **Hair is not a fair test of the body check.** Hair sits on the scalp by design, and a hair style is dozens of separate strand cards (26 pieces on the male style), so its pair counts mean little. It needs its own check (clear of the face, ears and eyes).

### 3. Phone weight (limit: 15 MB for the whole pack, at least 30 fps)

| Item (B's variant) | Triangles | GLB with texture | GLB with plain colour | Texture |
| --- | --- | --- | --- | --- |
| Shirt | 2,700 | 907 KB | 66 KB | 2048 x 2048, 841 KB |
| Pants | 2,669 | 1,389 KB | 65 KB | 2048 x 2048, 1,323 KB |
| Skirt | 5,848 | 9,825 KB | 133 KB | 2048 x 2048, 9,692 KB |
| Dress | 13,568 | 1,893 KB | 307 KB | 2048 x 2048, 1,586 KB |
| Boots | 4,120 | 3,601 KB | 101 KB | 2048 x 2048, 1,396 KB |
| Hair (blunt bob) | 2,858 | 20,399 KB | 75 KB | 3600 x 3600, 10,303 KB |
| **All six** | | **38,014 KB (37 MB)** | **747 KB** | |

For scale, the app's tee is 3,796 triangles and 69 KB, and its trousers 3,576 triangles and 65 KB. Triangle counts are fine except the dress, at about three and a half times a tee. The weight is all texture: with plain colour all six are under 1 MB, and with textures the bob alone is over the limit. Textures can be shrunk, but that is a build step we do not have. Frame rate: not measured.

### 4. Colour (can the picker recolour it?)

The picker sets the glTF base colour, which multiplies the texture. I measured the texture where the mesh uses it (texel at each face's UV centre, weighted by face area), then what a red (217, 51, 64) and a blue (58, 83, 140) tint would give, as the CIE76 distance from the colour picked (ΔE; about 2 is barely visible, above 10 is clearly different).

| Item | Texture mean (sRGB) | Pattern | Red tint, ΔE | Blue tint, ΔE | Verdict |
| --- | --- | --- | --- | --- | --- |
| Crude tee (male and female) | 247 and 255, plain white | none | 2.3 and 0.0 | 1.5 and 0.0 | **Recolours exactly** |
| Shirt (tucked tee) | 130, mid grey | faint weave | 38.0 | 24.8 | Dull and dark |
| Pants | 64, dark | wool flecks | 61.8 | 39.0 | Cannot go light |
| Skirt | 87, floral | strong print | 53.0 | 33.2 | Print fights the colour |
| Mini skirt | 110, brown | strong | 41.7 | 46.3 | Print fights the colour |
| Dress | 43, near black | knit | 72.8 | 45.2 | Cannot go light |
| Boots (female / male) | 187 / 97 | leather grain | 19.0 / 47.1 | 18.4 / 45.2 | Male boots dark |
| Hair (blunt bob / messy) | 183 / 157 | strands | 19.7 / 27.7 | 30.2 / 27.2 | Tints, with some drift |

So a plain recolour works only on near-white textures. The fix is to drop the texture and ship plain colour (exact, and the weight above), which loses the print and the strand detail. Normalising a texture's brightness at build time would also help, but it is more pipeline.

### 5. Look

Front, side and back of every item on every body are in `private/assets_spike/<body>/renders/`, next to the app's own tee and trousers (`<body>__app_tee_trousers.png`). The suffix `__hiddenbody` shows the body as MPFB would show it, and `shoes__bare` shows the boots without trousers. What I saw:

- **Crude tee (male):** clean on Joe, plain white and close to the app's tee, with the hem about 12 cm higher (90 cm against 78 cm on Joe).
- **Tucked tee:** a short, cropped top with a scalloped hem and small gaps at the collar. Not acceptable as it is.
- **Dress:** on B and the synthetic female with the body hidden, a clean tank-style shift dress with no point at the bust. On Joe (a woman's dress on a male body) skin still shows at the shoulders and chest.
- **Skirt:** a gathered long skirt with a ragged top edge at the waist and the print visible. Not acceptable.
- **Hair:** the bob on the female bodies and the messy style on Joe both look good and sit without visible clipping. These are the best-looking items.
- **Boots:** low ankle boots that read as pale socks with orange soles, with white patches at the back. I did not find out why; it may be how the leather texture or its maps export to glTF.
- **Style match:** the pack tee has a ribbed collar and cuffs, which the app's smooth tee does not. The dress and skirt are strongly patterned. Whether that is a pleasing mix is Joe's judgement from the renders.

### 6. Licence

All eight assets are CC0, in both the item's own `mhclo` header and the pack's `packs/<pack>.json`. No credit is needed. Packs were downloaded whole from `files.makehumancommunity.org` on 16 November 2026 (sha256 starts: shirts01 `a5a723b0`, pants01 `e4e0ec60`, skirts01 `293fa0c1`, dress01 `f49ba54a`, shoes01 `ded3f704`, hair01 `49445d69`; every zip passes a CRC test). The community site's news says its services are shutting down and moving to Discord, so these links may not last. CC0 allows keeping our own copies of any item we adopt.

## Recommendation per category

| Category | Recommendation | Why |
| --- | --- | --- |
| Tops | **Keep our own method** | 0 of 8 top fits pass (the tucked tee and the crude tee, on four bodies each). The male crude tee comes closest (0.02 cm short on clearance) and recolours exactly, so it is worth a second look as an alternative style, but it is a "crude starting point" by its author's own description |
| Trousers | **Keep our own method** | 9 to 18 body pairs and 23 to 39 self pairs, clearance about 0 |
| Skirts | **Keep our own method** | The long skirt has 103 to 577 body pairs on every body. The mini skirt has no body pairs but three layered pieces that intersect (194 to 215 pairs); the check cannot tell that from a fault |
| Dresses | **Mix, if Joe accepts body hiding** | The only category that looks right on B once the body is hidden. It needs the check changed and a texture decision (the dress texture is near black, so colour is lost without plain colour) |
| Shoes | **Use the pack for V5-01** | We have no method of our own, and plain-colour boots are about 100 KB. Needs body hiding, a rule against trouser legs (up to 362 pairs), and a look at why the boots render pale |
| Hair | **Use the pack for V5-04** | Looks good on both sexes. Shrink the textures (the bob's 3600 x 3600 map alone makes 20 MB), and add a hair-specific check |
| Hats and jewellery | Not tested | The hats packs were not in this spike's scope |

## What this means for later tickets

- **V3-00 (cloth experiment): still needed, but smaller.** The pack skirt fails on all four bodies, so the skirt experiment stays. If Joe accepts body hiding for dresses, drop the dress from V3-00 and use the pack dress as the baseline to beat. If not, V3-00 is unchanged.
- **V5 (shoes, hats, jewellery, hair): pack assets are the likely source for shoes and hair**, which settles most of V5-00 for those two. The open work is body hiding, layering rules and texture limits, not modelling.
- **V2-08 (bust point): not closed.** By eye, the pack's female crude tee and dress show a rounder bust without the point in the front and side renders on B. That is not measured, and the V2-08 ticket asks for an agreed number first. One lead not tested here: the Underwear 01 pack (CC0) may hold a bra to wear under the tops.

## Decisions needed from Joe

1. **Per category:** adopt, keep, or mix, as in the table above. My recommendation: keep tops, trousers and skirts; mix dresses; adopt shoes and hair.
2. **Mixed sources:** is it acceptable for some garments to be pack assets and others the app's own, if the styles differ slightly? It also needs layering rules, because pack and app garments clip into each other (0 to 2038 face pairs depending on the pair).
3. **Textures:** may any category carry texture? My recommendation: hair and shoes only, with textures shrunk to about 1024 px, and plain colour everywhere else. That keeps the pack near 1 MB for clothes and keeps recolouring exact. This also answers the open garment-texture decision for V4-01 and the sweatshirt in part.
4. **Body hiding:** may a garment hide the body underneath it, with the hard check changed to match? It decides the dress and shoes.

## What was not done or not reliable

- **No phone test.** Frame rate and load time on Joe's phone are not measured.
- **One item per category, sex-matched for shoes and hair.** A different skirt, dress or boot could do better. The mini skirt and crude tees are the only second tries.
- **Two methods for hidden-body counts.** The "hidden body" pairs come from a triangulated in-memory mesh, not the exported GLB, so they are lower than the GLB counts (for example the tucked tee, 136 in memory against 164 on the GLB for the synthetic male). Compare the hidden column with the full-body in-memory figures in the control table, not with the GLB column.
- **Colour numbers use the mean colour only.** ΔE is the distance of the area-weighted mean, not a per-pixel error. Bump, normal and specular maps are ignored.
- **The default-body control covers the male variants only.**
- **No hand fixes.** Nothing was edited by hand, as the ticket says.
- **Downloads.** The first mirror (`files2`) ran at about 40 KB/s. Resuming a partial file from the other mirror produced a corrupt zip, so the five affected zips were downloaded again whole from `files`. Use one mirror for the whole file. A leftover loop from the first attempt also rewrote the pants and skirts zips from the slow mirror late in the run; both were checked and restored (hashes match the ones above, and all six pass a CRC test). The unpacked items had come from the good copies, so the results are not affected.
- Run `spike/assets/run_all.py` with the real Python, not the Microsoft Store `python` alias, which hides Blender's add-on folder from Blender.
