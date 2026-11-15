# Brief for Fable: end of Stage 0 spike

Date: 2026-11-15. Go/no-go on the 3D approach is due this evening. This is a one-page summary; the evidence is in the files linked at the end. Nothing here uses real photos or measurements outside `private/`.

## What we want from you

Help us decide go or no-go, and sort the bug log (`docs/bug-log.md`) fast. The three bugs Joe cares most about (B22, B23, B24) are about garment drape and look. We have spent a lot of time on drape with an offset-shell method and it has not got there.

## Where we are

- **Body from tape measurements: works.** Joe's body hits every real measurement within tolerance (below). Built headlessly in Blender 5.3 with MPFB 2.0.18 (GPL code, CC0 core assets, output licence unconfirmed; personal use).
- **Garments: sizes right, drape wrong.** A tee and jeans are built as offset shells of the body and calibrated to real flat measurements, so landmarks match. But the cloth follows the anatomy too closely, floats off the shoulders, and still shows the body through it by a small amount.
- **Phone:** 60 fps with no drops while orbiting, 744 KB download, on Joe's phone (one device, one scene).
- **Decisions made 2026-11-15:** no runtime size blending (fit per person offline); garments get default ease profiles per cut with optional measured refinement; milestone 1 is close-fitting garments only (tee, shirt, trousers, one fitted knit).

## Pass criteria and measured values

| Criterion | Limit | Result | Verdict |
| --- | --- | --- | --- |
| Chest, waist, hips | 2 cm | Joe -0.0 / -0.0 / -0.1 cm (real tape); synthetic bodies within 0.1 cm | Pass |
| Height and limb lengths | 1.5 cm | Joe height +0.0, inside leg +0.7 cm. Arm lengths not measured | Partly proven |
| Garment landmarks | 2 cm | Joe: tee chest, length, sleeve, neck within 0.9 cm; jeans waist, hip, rise, inseam within 0.4 cm; **jeans leg opening +5.3 cm**. Synthetic: all within 2 cm | Pass except one |
| No body through cloth, 360 degrees, three shapes | 0.50% of samples | Tee 0.48 to 1.15%, trousers 0.40 to 0.97%. 11 of 13 garment builds fail. Joe: tee 0.62%, trousers 0.86% | **Fail** |
| In-between sizes plausible | n/a | Withdrawn by decision (blending dropped) | Withdrawn |
| 30 fps and under 15 MB on phone | 30 fps, 15 MB | 60 fps, 744 KB | Pass |

Full table: `docs/decisions/2026-11-15-results-table.md`. Beth (second user) has no real measurements yet, so her body is unverified; three synthetic female presets stand in.

## Open problems, in the order we would tackle them

1. **B22 tee drape.** Cloth is sucked in at the waist and into the buttocks. A real tee neither clings nor falls as a straight tube. We tried a radial "hang" constraint and reverted it: it either broke calibration or produced a straight tube.
2. **B23 floating shoulders.** The tee sits above Joe's shoulders; it should lie flush. Not measured yet.
3. **B24 stray fragment under the chin.** Present all day; probably head faces left in the template.
4. **B1 crotch clipping.** 0.67 to 0.97% on every body, unchanged from yesterday despite several fixes.
5. **B3 leg opening.** Jeans read 35.5 cm against 32 cm; the body is that wide near the heel and the ease is at its floor.
6. **B2, B4** tee clipping near the armpit, and calibrations that only match by construction because the ease floors out (stretch is not modelled).
7. **B6 colour.** Rough median from one dim, warm-lit photo, no white balance. No colour tolerance set.
8. Smaller items and test gaps: B7 curved hem, B8, B9, B15 to B18 (no visual baselines, no solver unit tests, loop-merging fragility in other measurements, licence).

## Questions for you

1. **Method:** is Blender cloth simulation (hung shell, pinned at the shoulders, gravity, body collision, baked headlessly in A-pose) the right next step for B22 and B23, or is there a cheaper way to get a believable tee? Would it also settle B1?
2. **Clipping limit:** is 0.5% a sensible test, given that the ray test is noisy near open edges and the crotch is a fold? Or should we test maximum penetration depth instead?
3. **Leg opening:** measure it above the foot, or model jeans that taper over the heel?
4. **Colour:** is a white reference in the photo enough, or do we need a colour picker as the primary route?
5. **Go or no-go.** Our reading: the body half is a clear go. The garment half is a conditional go, with cloth simulation as the first Stage 1 task and a fallback agreed in advance (see the risks section of the blueprint). We would like you to challenge that.

## Reproduce

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" --background --python spike/blender/body_from_measurements.py -- spike/fixtures/synthetic_medium.json spike/out synthetic_medium spike/fixtures/synthetic_medium_garments.json
python spike/check_reports.py spike/out
python spike/results_table.py spike/out
npm --prefix spike/viewer run dev   # then open http://localhost:5173/?m=preset_female_medium (models copied to spike/viewer/public/models/personal/)
```

Tolerances are in `spike/tolerances.json`. Joe's own bodies need `private/` files that are not in the repo.

## Where to look

- `docs/bug-log.md` all open problems with evidence
- `docs/decisions/2026-11-15-photo-review-fixes.md` what was fixed today and why
- `docs/decisions/2026-11-15-results-table.md` the numbers
- `docs/decisions/2026-11-14-spike-review.md` the earlier independent review (suggests cloth simulation)
- `docs/decisions/2026-11-14-decisions-to-confirm.md` the three confirmed decisions
- `spike/blender/garment.py`, `spike/blender/body_from_measurements.py` the code
