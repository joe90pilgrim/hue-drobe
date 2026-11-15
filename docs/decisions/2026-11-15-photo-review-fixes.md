# 2026-11-15 Fixes after Joe compared the render with his photo

Joe compared the front render with `private/photos/joe_front_arms_down.jpg` and listed six differences. Causes and fixes:

| # | Difference | Cause | Fix |
| --- | --- | --- | --- |
| 1 | Bumps either side of the belly button | The jeans' top (waistband) edge pushed the tee outwards. The body is smooth there. | `garment.build_tee` fades the inner garment's top 5 cm into the body surface before using it as the "stay outside this" surface. |
| 2 | Frayed sleeve ends | Plane bisect left sliver triangles (edges up to 7 cm) along the cut. | Sleeves are now cut by removing whole arm faces beyond the cut, then the open edge is flattened onto the cut plane and smoothed along the ring. |
| 3 | Tee covers the crotch | The flat length of 73 cm puts the hem at about 78 cm above the floor. The photo shows the hem at about 83 cm (read at 8.9 px per cm, roughly +/-3 cm). | `worn_hem_height_cm` in the garment JSON overrides the flat length. Joe's is set to 83. **Joe to re-measure the tee.** |
| 4 | Cut marks on the right buttock | The jeans poked through the tee in places. | After the tee is built, any jeans vertex that is not covered by the tee pushes the nearest tee vertices outwards. |
| 5 | Back neckline looked V-shaped | The neck opening was an ellipse cut with a fixed depth, so the back was as deep as the front. | Neckline depth now varies: 7.5 cm at the front centre, 2 cm at the back, 0 at the shoulders (`garment.neckline_drop`). The highest-point-shoulder height is now read at the neckline edge, not at the top of the neck. |
| 6 | Colour wrong | The viewer used a hard-coded red tee and blue jeans. | Colours come from `colour_srgb` in the garment JSON. Joe's values are the median of lit patches in the photo: tee (62, 78, 96), jeans (36, 34, 30). No white balance, dim warm room, so approximate. `spike/blender/sample_colour.py` records how they were read. |

Also fixed: the tee chest measurement sometimes read about 1.7 times too large, because the chest-height section joined the torso and sleeve into one loop. It now steps down in 1 cm steps until the loop is torso only. This was already happening on the committed code (synthetic_small read 167.8 cm on one iteration).

## Still failing (not caused by this change, same as before)

- Trousers clipping 0.67 to 0.97% on every body (limit 0.5%).
- Tee clipping 0.56 to 0.71% on synthetic medium, small and large (baseline 0.53 and 0.65 on medium and large).
- Joe: tee chest and trousers waist sit at their ease floor (the real items are smaller than the body plus 3 mm; stretch is not modelled), so calibration reports "not converged".
- Beth has no garment measurements, so there is no landmark comparison for her.

## Open question

The body's crotch is at 83.7 cm above the floor, and the jeans inseam of 72 cm puts the jeans hem at 11.7 cm. Joe's jeans reach the floor in the photo, so the body's leg length may be about 5 to 6 cm short or the jeans fork sits lower than the body crotch. Needs an inside-leg measurement.
