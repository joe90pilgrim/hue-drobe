# Joe's real measurements and garments against the model

Date: 2026-11-14. Source numbers live in `private/` (git-ignored). Run: `python spike/check_reports.py private/out`.

## Body (Joe, tape measurements, all real)
Height, chest, waist, hips, thigh: every one within 2 cm of the tape value (height 0.01 cm, chest 0.04, waist 0.08, hips 0.06, thigh 1.2 cm).
Wrist (18 cm) is recorded but not modelled yet.

## Garments against flat measurements of the real items (tolerance 2 cm)
Tee (Jack Wills): chest circumference +1.1, length 0.0, sleeve -0.7, neckline width +0.3. All pass.
Jeans (Gap Slim): waist +1.3, hip 0.0, rise 0.0, inseam 0.0, leg opening -0.1. All pass.

## Still failing
- Jeans: 55 of 1,411 covered body points (3.9%, worst 3.6 cm) show through at the centre of the crotch. Cause not confirmed; may be the surface test misjudging a deep concave fold, or the shell self-intersecting between the thighs. Not yet checked from below on screen.
- Tee: 14 of 2,040 points (0.69%, worst 0.5 cm) at the neckline, over the 0.5% limit.

## How the garments are sized
Smoothing shrinks the shell, so ease is calibrated: build, measure the garment circumference, adjust ease, repeat. The tee below the shell hangs straight down from 5 cm above the crotch.

## Caveats
- Hip is read at the widest point above the crotch; an earlier version read the crotch notch and made the hips about 8 cm too big.
- Hips on the garment are read 5 cm above the crotch.
- No photo comparison yet; "looks like me" is unjudged.
