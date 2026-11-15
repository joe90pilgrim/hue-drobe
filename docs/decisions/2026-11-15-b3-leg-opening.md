# B3 fixed: trouser hem rises to where the leg opening fits

Date: 2026-11-15. The B3 item of task 6 in `2026-11-15-fable-review.md`; follows `2026-11-15-joe-ankle-intersections.md`.

## Result

Joe's build now passes every check in `check_reports.py`.

| Joe's jeans | Before | Now |
| --- | --- | --- |
| Hem height above floor | 6.7 cm | 8.7 cm |
| Leg opening, model against real 32 cm | 37.2 (+5.2) | 33.2 (+1.2) |
| Leg-opening calibration residual | +3.46, not converged | +0.01, converged |
| Body through trousers | 16 pairs (Achilles tendon) | 0 |
| Inseam | 72.0 visible | 70.0 visible + 2.0 left over |
| Minimum trouser clearance | 0.29 cm | 0.24 cm |

Synthetic bodies are unchanged: their hems already fitted, so nothing moved (leftover 0.0 cm, every figure identical). Two full builds are byte-identical (`check_repeatable.py`: REPEATABLE).

The bug log's first figure for B3, 35.5 cm (+3.5), was stale: it was recorded before the trousers template was extended to the sole. The +5.2/+5.3 in the brief and results table was the current one. The bug log is updated.

## Change (`body_from_measurements.py`, trousers)

After placing the hem from the inseam, scan upwards in 5 mm steps for the lowest height where the leg's girth plus the minimum gap (3 mm all round) fits the real leg opening, and put the hem there. The difference is reported as `inseam_leftover_cm`: fabric that would stack over the foot. The inseam landmark compares visible plus leftover against the real inseam, so it still describes the garment's length. The taper over the heel is not modelled, as the review advised.

## Notes

- Calibration reads the leg opening 1 cm above the hem, the report 0.5 cm above. That is why calibration shows +0.01 cm and the landmark +1.2 cm. Both were like this before; the landmark is inside the 2 cm limit.
- Joe's ankle not checked by eye: the near-black jeans make the viewer's back view unreadable at that scale. The face-pair count is the measure.

## Remaining failures after tasks 1 to 4 and B3

- synthetic_large and synthetic_female_large trouser hip calibration (-1.64, -1.04 cm) and female large waist (+1.78 cm): B4, real garment smaller than body plus 3 mm.
- synthetic_female_large tee through trousers, 33 pairs: waits for task 5's new tee method.
- Beth: no garment file, so default garments fail several checks.
