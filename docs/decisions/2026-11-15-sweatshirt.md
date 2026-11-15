# Sweatshirt template (MVP-07)

Date: 15 November 2026. Settles how the sweatshirt is built and checked. Joe's visual sign-off is still needed.

## Result

`python pack/build_pack.py --private` builds a regular-fit sweatshirt on Joe and the six synthetic bodies. Every check passes on all seven, with no known exceptions. Joe's pack is 832 KB, up from 744 KB (sweatshirt 88 KB). The tee and trousers code paths are unchanged.

| Check (tee's limits) | Limit | Synthetic bodies (6) | Joe |
| --- | --- | --- | --- |
| Pieces / openings | 1 / 4 | 1 / 4 on all | 1 / 4 |
| Body-through-cloth / self / through-trousers pairs | 0 / 0 / 0 | 0 / 0 / 0 on all | 0 / 0 / 0 |
| Minimum clearance to body | 0.2 cm | 0.3 on all | 0.3 |
| Shoulder gap, worst band mean / max | 0.5 / 1.0 cm | 0.38 to 0.47 / 0.44 to 0.54 | 0.37 / 0.50 |
| Chest vs default fit (chest + 10 cm) | ±2 cm | -0.2 to -0.1 | 0.0 |
| Hem above crotch (6 cm) | ±2 cm | -0.1 to 0.0 | 0.0 |
| Cuff short of the wrist joint (1.5 cm) | ±2 cm | -0.4 to -0.2 | -0.1 |
| Neckline width | ±2 cm | -0.3 on all | -0.3 |

## How it is built

The same offset shell as the tee (`spike/blender/garment.py`, `build_tee`), with four additions used only by the sweatshirt:

1. **Long sleeves.** The template keeps the whole arm up to the wrist joint (`define_tee(..., long_sleeves=True)`), and the sleeve is cut on the forearm. The hem cut leaves the sleeves alone, because in the A-pose the wrists hang below the hem.
2. **Fuller body, tapered sleeve.** Chest ease 10 cm against the tee's 8. The ease falls down the forearm to 40% of the chest ease at the wrist, so the sleeve isn't a tube.
3. **Ribbing by shape.** In a 5 cm band above the hem and before each cuff, the cloth is drawn in: to 0.8 cm over the trousers at the hem and 0.5 cm from the wrist at the cuffs, fading in over 3 cm.
4. **Placed by the body, not by a length.** The hem sits 6 cm above the crotch and the cuff 1.5 cm short of the wrist joint, so it sits the same way on every body. A length from the shoulder put the hem below the hips on some bodies, where the shell would need the hanging-tube extension and could not be drawn in.

All values are in `pack/fit_config.json` under `sweatshirt`. The checker (`spike/check_reports.py`) holds the sweatshirt to the tee's limits from `spike/tolerances.json`; no tolerance was added or changed. `build_pack.py` passes `--sweatshirt`, so a missing sweatshirt fails the pack build. The spike's committed reports have no sweatshirt and are checked as before.

## What was tried

- **Chest ease 12 cm:** 2 self-intersecting pairs in the armpit on `synthetic_female_large`, the same fold that capped the tee. Set to 10.
- **Cuff edge:** laying the cut edge flat pulled it to 0.08 cm from the wrist. Fixed by pushing it back out after the cut.
- **Hem band drawn towards the body:** 1 to 9 self-intersecting pairs on six bodies, in the cleft between the buttocks, and 4 pairs through Joe's trousers at the front. Fixed by drawing the hem band towards the trousers' surface instead.

## Decisions I made (say if any is wrong)

1. **The sweatshirt is an alternative top, in the Top slot** (T-shirt, Sweatshirt, None), as MVP-05's scope says. The concept design's separate Layer row is removed. A sweatshirt over the tee would need building over the tee, which this ticket rules out ("built over the trousers, like the tee").
2. **The ribbing is shape only**, with no texture, because garments are shape plus colour. A rib texture is in the backlog.
