# V2-03 MVP garments on B

Date: 16 November 2026. Every garment passes every hard mesh check on B, J and the six synthetic bodies, with the default fit. Not signed off: B's visual check is still to do, and the tops trace B's bust and navel (below). An attempt to fix that failed three times and was taken out.

## Decisions (J, 16 Nov 2026)

1. **Same templates as J.** No women's cuts in this ticket. A women's cut can be a later ticket.
2. **Fit per person.** New committed file `pack/fit_people.json`: each person's entry is laid over `pack/fit_config.json` (`fit.merge`). The synthetic bodies never read it, so the committed reports and their config hash are unchanged. Each pack's `manifest.json` now records the merged `fit_config` and the person's `fit_overrides`. Both entries are empty, because B passes on the default fit.
3. **Fit B now and refit later.** B's hips are still the 98 cm placeholder. The trousers and shorts must be rebuilt and rechecked when her tape hips arrive.

## Result

`"body_only"` is removed from `private/measurements_b.json`, as the V2-02 record asked. The 10 failures V2-02 found came from B's first body. On her current body (wider torso) the default fit passes with nothing changed.

| Check on B (all garments) | Measured | Limit |
| --- | --- | --- |
| Body through cloth (tee, V, scoop, sweatshirt, trousers, shorts) | 0 face pairs each | 0 |
| Self-intersection, every garment | 0 | 0 |
| Every top through trousers and through shorts (8 pairs) | 0 each | 0 |
| Minimum clearance to body | 0.29 to 0.30 cm | at least 0.2 |
| Shoulder gap, all four tops | band mean 0.50, max 0.59 cm | 0.5 and 1.0 |
| Tee chest, length, sleeve | +0.3, 0.0, +0.2 cm | 2.0 |
| Trousers waist, hip, leg opening | +0.3, -0.5, +1.3 cm | 2.0 |
| Pack size | 1006 KB | 15 MB |

- B's shoulder gap is exactly at its band-mean limit (0.50 against 0.5). J's is 0.46.
- Full run `python pack/build_pack.py --private --jobs 4`: all eight bodies pass (0 failures in both folders), `PACK BUILD OK`.
- J's seven pack GLBs are byte-identical before and after (`cmp`). His `manifest.json` gains an empty `fit_overrides`.
- `npm run check` passes. `python -m unittest discover -s pack`: 17 tests, 3 of them new (`PerPersonFit`).
- Blender 5.3.0, MPFB 2.0.18, unchanged.

## What is not right: the tops trace B's bust

In the spike viewer (front, side and torso close-ups), no body shows through any garment. But every top rests 3 mm off B's body, so it shows the nipples and the navel, and in side view it follows the underside of the bust instead of hanging from it. The ticket asked for this check. It is a shape problem, not a clip, so no hard check catches it. Screenshots are in `private/experiments/v2-03-screens/` (git-ignored, not committed, because they show B's body).

The cause is in the offset-shell method: the shell is smoothed and then pushed back out to `min_gap` from the nearest body point, so it rests on every convex bump.

### Tried: a "bust dome" (three attempts, taken out)

The idea was a smooth floor in front of each bust apex that the top could not sink below: a cap over the apex, a flat band across the cleavage, and a gentle fall below. It only moved cloth forward, and it was set per person through `fit_people.json`.

| Attempt | Change | Result on B |
| --- | --- | --- |
| 1 | Apex as the front-most point at 64 to 78% of height, 12 cm cap, 30 cm fall | Apex found the front of the belly (B's waist sits 1.5 cm ahead of her bust). 8 failures: every top through the trousers (8 to 64 pairs) |
| 2 | Apex at the bust landmark height | 22 failures: the 12 cm cap reached the neck and shoulders (neckline +3.6 cm wide, shoulder gap 1.6 cm, self-intersections at 115 to 120 cm), tops through trousers (163 to 171 pairs) |
| 3 | 6 cm cap, flat band between apexes | 16 failures: tee chest calibration swung between 95 and 103 cm and never converged, V-neck through the body (773 pairs, down to -5 cm), tops through trousers (141 to 158 pairs) |

Under the three-strikes rule I stopped there. The patch and the three check logs are in `private/experiments/` (`v2-03-bust-dome-attempt3.patch`, `b_v203_run1.txt` to `run3.txt`). Nothing of it is in the tree.

What I think is wrong, not tested: the floor moves cloth along one axis only, so neighbouring vertices that it does and does not move shear apart (folds, and clashes at the trousers waistband). And because it changes the chest section, it fights the chest calibration.

## Options for the bust (J to choose)

1. **Accept for now.** B signs off on "no body showing through", and the bust shape goes to the backlog. Cheapest.
2. **Smooth the body under the tops, not the cloth.** Fit the tops to a copy of B's body with the nipples and navel smoothed away. MPFB has nipple size and point targets that could go in the `shape` block. The cloth code stays as it is, and the hard checks still run against the real body. A new attempt, probably an hour.
3. **Wait for V2-07.** MakeHuman asset-pack tops are made for MakeHuman bodies and may hang from the bust already.

## Tried: a bra shape on every female body (J's call, three attempts, taken out)

J chose option 2 in a different form: every woman wears a bra by default, so the bust is round and the tops do not trace it. I did this on the body, through MPFB targets and smoothing, not as a garment. Measured on B, one build each; checks are the full set.

| Attempt | Change to every female body | Checks on B | Seen in the viewer |
| --- | --- | --- | --- |
| 1 | `nipple-point` and `nipple-size` at -1 | 6 failures: the tees through the trousers and shorts, 74 face pairs, all at 85 to 95 cm (the waistband) | Nipple tips moved in 0.8 cm (measured), but the tee still shows a point at each breast |
| 2 | As 1, plus `breast-point` -1 and `firmness` 1.0 (lift) | 6 failures: the tee's chest calibration swung between 90 and 104 cm and never settled (V and scoop 5.8 cm out). The waistband clash was gone | Smaller bust, still a point |
| 3 | As 1 and `breast-point` -1, plus Blender's Smooth modifier around each apex (factor 0.5, 10 passes, full weight within 4 cm, none past 10 cm) | All passed. Exported bust -0.23 cm from tape | No visible change: still a point |

The patch, the check logs and a small measuring script (`surface_bumps.py`, whose number did not follow what the eye sees) are in `private/experiments/`. Nothing of it is in the tree, and B's pack was rebuilt from the committed code.

What this shows:

- **The point is the breast mesh itself.** The base female mesh comes to a cone at each breast. The nipple targets work but are small next to that cone, and 10 smoothing passes on a mesh this dense reach only a few rings.
- **B's tee has no margin at the trousers' waistband.** In attempt 1 a change to the bust alone made the tees cut through the waistband (74 pairs at 85 to 95 cm), and attempt 2 made it go away again. Expect this when her real hips change the trousers.
- **Lifting the bust breaks the chest measurement.** It brings the widest line near the armpit, where the section flips between torso alone and torso plus sleeve.

Untried: much stronger smoothing (dozens of passes or Blender's Corrective Smooth), or a real bra garment for the tops to sit over.

## Next

- J chooses how to go on with the bust: stronger smoothing, a bra garment, wait for V2-07, or accept for now.
- B's visual sign-off in the viewer, front, side and back (not yet done).
- Refit the trousers and shorts when B's tape hips arrive.
