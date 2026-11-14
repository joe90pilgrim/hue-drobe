# Spike write-up (draft for review)

Date: 14 November 2026 (Saturday evening). The spike's deadline is Sunday evening, 15 November. Prepared for an independent review and a go/no-go.

## Result in one paragraph

A body built from tape measurements, and a tee and trousers fitted to it, come within 2 cm of Joe's real measurements and of his real garments' flat measurements on every check. The body works on a Pixel 8 at 60 fps. Two things are not proven: the two clipping checks still fail on Joe's jeans (crotch) and tee (neckline), and nothing has been judged by eye against the photos or against Beth's real numbers. Provisional recommendation: **go, with conditions** (below). It is not a clean pass.

## Pass criteria against the measured numbers

Tolerances are in `spike/tolerances.json`. Check with `python spike/check_reports.py <folder>`.

| Criterion | Limit | Measured | Status |
| --- | --- | --- | --- |
| Circumferences (chest, waist, hips, thigh), Joe, real tape | 2 cm | chest 0.04, waist 0.08, hips 0.06, thigh 1.2 | Pass |
| Height, Joe | 1.5 cm | 0.01 | Pass |
| Same checks on 3 synthetic sizes (small, medium, large) | 2 / 1.5 cm | all within limits | Pass |
| Beth | 2 cm | within limits, but only her height is real; other values are placeholders | Not meaningful yet |
| Limb lengths (arm, inside leg, back) | 1.5 cm | not measured, not modelled | Not tested |
| Tee landmarks vs real tee (chest circ, length, sleeve, neckline) | 2 cm | +1.1, 0.0, -0.7, +0.3 | Pass |
| Jeans landmarks vs real jeans (waist, hip, rise, inseam, leg opening) | 2 cm | +1.3, 0.0, 0.0, 0.0, -0.1 | Pass |
| No body showing through cloth | 0.5% of points, 1 cm deep | jeans 3.9% (worst 3.6 cm, crotch); tee 0.69% (worst 0.5 cm, neckline); synthetic sizes 0% | **Fail** (Joe only) |
| In-between sizes plausible | no tearing or stretching | not tested | Not tested |
| Phone: at least 30 fps, under 15 MB | 30 fps, 15 MB | Pixel 8: 60 fps (readout on the placeholder figure and earlier garments); body plus tee plus trousers about 750 KB | Pass for frame rate on early garments; load size pass; not re-measured on the final models |
| Recognisability ("looks like me") | each person says yes | Joe judged the earlier body "realistic"; not compared with photos | Not tested |
| Honor 200 Pro | n/a | not tested | Not tested |

## What worked

- MPFB2 (GPL code, CC0 core assets) runs headlessly in Blender 5.3 and has a Python route to set body shape. Licence: fine for personal use; output licence unconfirmed.
- Body solving: macro controls (height, weight) first, then the fine measure controls, with fallbacks (hip width, stomach, leg fat) when a control saturates. About 10 seconds per body.
- Garments as offset shells of the body mesh. All MPFB2 bodies share one vertex layout, so one template re-fits to any body. The phone loads a finished pack.
- Calibrated ease: smoothing shrinks the shell, so the script builds, measures the garment circumference, and adjusts until it matches the real item.
- Automatic checks that fail the build on a missed tolerance.

## What did not work, or is open

- **Jeans crotch clipping (3.9%, worst 3.6 cm).** Cause unconfirmed: either the inside/outside test misjudges a deep fold, or the shell overlaps between the thighs. Not inspected from below on screen. This is the biggest open item.
- **Tee neckline clipping (0.69%).** Marginally over the limit.
- **The clipping check is lenient:** it skips body points within 1.2 cm of an open fabric edge (about 10% of covered points).
- **Hips bug found and fixed late:** the hip landmark was at the crotch notch and made hips about 8 cm too big. Beth's earlier numbers were affected; she is rebuilt with the fix but still on placeholders.
- **Landmark definitions are ours** (narrowest/widest torso point, shoulder estimate from the mesh). They may differ from where a tape sits. Only a photo or tape check on the avatar can show that.
- **Blueprint divergence:** the blueprint planned fitted small, medium and large shapes blended at runtime. We fit per person offline instead. Runtime blending is untested and may not be needed for two users. This should be a conscious decision, not an accident.
- **Tee hem below the crotch** is a straight tube from 5 cm above the crotch, not draped.
- **Simplifications:** plain single colour, no folds, no collar band, neutral head only, A-pose only. Wrist is recorded but not modelled. Shoulder width, arm length, back length, underbust, neck, upper arm are not used.

## Effort per garment type

Roughly one to two hours each for the first tee and trousers, including debugging. Most time went on shared machinery (clipping check, ease calibration, layering) that the next garment reuses. A new type still needs a face-selection template and landmark definitions. A dress or jumper is untested and is likely harder (longer, looser, two-layer drape).

## Recommendation (provisional)

Decision rule from the blueprint: body passes and garments pass on fit, with clipping failing in two places. Proposed: **go to milestone 1 on this pipeline, on three conditions:**

1. Fix or explain the jeans crotch clipping, and bring the tee neckline under the limit.
2. Joe and Beth each judge the avatar against their photos, and Beth supplies real measurements and a real garment to check.
3. Decide on purpose whether runtime size blending is dropped from the blueprint.

Not required for the go, but worth doing early: Honor 200 Pro test, a skirt or dress to test the harder garment shape, and an automated front/side/back visual regression render.

## Questions for the reviewer

- Is "offset shell, fitted per person" a sound foundation, or will it hit a ceiling on loose or layered clothing (dresses, jumpers, coats)?
- Is dropping runtime blending acceptable for a two-user app, given the pack is built on a laptop?
- Is a 2 cm tolerance with our own landmark definitions credible, or should we validate against a tape on the avatar?
- Should the clipping check use a more robust test (for example ray casting) before we trust it?

## Reproduce

Blender 5.3.0 and MPFB 2.0.18. See `spike/README.md` and `spike/blender/README.md`. Personal data is in the git-ignored `private/` folder; committed tests use `spike/fixtures/`.
