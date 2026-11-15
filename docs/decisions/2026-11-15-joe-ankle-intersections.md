# Joe's body-through-trousers pairs are at the back of the ankles (B3)

Date: 2026-11-15. Follows `2026-11-15-task4-crotch.md`.

## Result

All 16 of Joe's body-through-trousers face pairs are at the back of both ankles: 10.5 to 12.3 cm above the floor, 20 to 21.5 cm either side of the centre line, 8 pairs on each leg, mirrored. The body faces there point backwards and outwards on both sides of a ridge: the Achilles tendon. None are at the crotch, and no trouser face involved is on an opening edge.

## Cause

B3. Joe's jeans have a 32 cm leg opening, but at the modelled hem height (6.7 cm above the floor) his ankle and heel girth plus the 3 mm minimum gap is larger than that. Leg-opening calibration therefore pushes the hem ease to its floor and still misses (hem residual +3.46 cm, model opening 37.2 cm). That tight shell, smoothed over the sharp tendon ridge, is cut by the ridge between its vertices. Every vertex stays outside the body (minimum clearance 0.29 cm), which is why only the face-pair test catches it.

The review's B3 fix in task 6 should remove this: measure the leg opening above the foot, and place the hem at the lowest height where body girth plus minimum ease fits the opening.

## Change

`mesh_checks.py` now reports where body-through-cloth pairs are (`body_intersections_by_z_cm`, 5 cm bands), and `check_reports.py` prints it. Self-intersection heights are now measured from the floor too; before, they were in Blender coordinates, which put Joe's crotch pairs about 9 cm too high. Joe's report now gives `[[10, 16]]`.

The probe that located the pairs was a throwaway script run against `private/out`. It is not committed, as it reads Joe's build directly.

## Also seen

Beth's 38 body-through-tee pairs are at 105 to 115 cm above the floor, around chest height, on her default tee (no garment file, so no calibration). Not investigated further; it needs her real garment measurements first (task 6).
