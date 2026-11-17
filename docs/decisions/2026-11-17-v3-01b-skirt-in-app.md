# V3-01b Skirt in the app

Date: 17 November 2026. Result: **Beth can wear the A-line midi skirt in any colour, with a tee tucked into it. All hard mesh checks pass on B and on all three synthetic women (small, medium, large) inside `npm run check`.** Not yet done: Beth's visual sign-off and the Pixel 8 frame rate.

Joe's decisions (17 November 2026): tops are **tucked in** (cut at the skirt's waistband); **midi only** for now. Blender 5.3.0, MPFB 2.0.18.

## What was built
- **Pack build:** `pack/build_pack.py` runs `spike/cloth/skirt_cloth.py` in place of the body script for a woman's body (same Blender session, one thread, so builds are identical). Skirt settings are in `pack/fit_config.json` (`skirt`), so they are part of the config hash that the committed reports are checked against. A woman's pack gains `skirt.glb`, `tee_tucked.glb`, `tee_v_tucked.glb`, `tee_scoop_tucked.glb`; a man's pack is unchanged.
- **Tucked tee:** each tee is cut flat 1 mm above the skirt's top edge. Where the cut hem is wider than the skirt's top ring, it is drawn in to 1.5 mm inside the ring, easing out over 4 cm (134 to 158 vertices, largest move 2.1 to 2.4 cm).
- **Checks** (`spike/check_reports.py --skirt`, limits in `spike/tolerances.json`): skirt to the trousers' mesh limits, hem within 2 cm of target, skirt-through-tights, and each tucked tee to the tee's limits plus no face pairs with the skirt or tights.
- **App:** Skirt is a Bottom option, offered only when the person's pack has it; colour picker and saved items work as for other garments. A tee over a skirt shows the tucked version in its neckline. Tights are allowed with the skirt. A sweatshirt cannot be worn with a skirt (its ribbed hem has no tucked version): the option is greyed out with a note, and putting one on takes the other off.

## Results (all pass)
| | B | Small | Medium | Large |
| --- | --- | --- | --- | --- |
| Skirt body / self face pairs (limit 0) | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Skirt min clearance, cm (limit 0.2) | 0.62 | 0.62 | 0.63 | 0.62 |
| Hem lowest point vs target, cm (limit 2) | -1.2 | -1.0 | -1.1 | -1.3 |
| Skirt triangles / KB | 5,760 / 105 | 5,952 / 108 | 6,336 / 115 | 6,528 / 118 |
| Tucked tees: body, self, skirt, tights pairs | 0 | 0 | 0 | 0 |
| Tucked tees min clearance, cm (limit 0.2) | 0.3 | 0.3 | 0.3 | 0.3 |
| Untucked tee through skirt (information), pairs | n/a | 705 | n/a | n/a |

B's pack is 1,337 KB in all (limit 15 MB); Joe's is 1,066 KB. Synthetic female medium was not covered by V3-01a, and passes with the same settings. `npm run check`: 83 unit tests, 60 Playwright tests (including `app/e2e/skirt.spec.ts`), asset checks and deploy tests all pass. Renders (front, side, back; skirt alone, with each tucked tee, with tights): `private/pack/build/renders/` and `pack/out/renders/`.

## Not done or not reliable
- **Beth's visual sign-off** is still needed. In B's render the tucked tee meets the skirt in a clean straight line, front, side and back, with no visible clipping.
- **No phone test.** The skirt and tucked tees add about 270 KB to B's pack and about 6,000 triangles for the skirt, so the Pixel 8 frame rate with skirt and top on still needs measuring (`?debug`).
- **Hem is checked against a pattern target** (21% of height), not a real skirt.
- **No blended sizes:** each body has its own skirt.
- **Sweatshirt with skirt not supported.** Revisit with V3-05 (layers).
- **Joe's pack** has no skirt (women's bodies only, as the dress).
