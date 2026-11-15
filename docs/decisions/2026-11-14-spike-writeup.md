# Spike write-up (final)

Started 14 November 2026; closed 15 November 2026 by Joe. This replaces the draft prepared for the independent review. Detail for each step is in the decision records listed at the end.

## Decision

**Go for the MVP with close-fitting garments only: tee, shirt and trousers.** Garments use the offset-shell method (one template re-fitted to each body, ease calibrated to the real item's flat measurements). The cloth drape (`--drape`) stays off the MVP path.

Dresses and jumpers are deferred to a later, time-boxed experiment.

## Where the spike ended

All numbers are from `python spike/check_reports.py` on builds made on 15 November with Blender 5.3.0 and MPFB 2.0.18 (default build, offset-shell garments, unless stated).

- **Body from tape measurements: works.** Joe's height, chest, waist, hips, thigh and inside leg are all within tolerance (2 cm circumferences, 1.5 cm lengths). Six synthetic bodies (three male, three female) pass the same checks.
- **Garments (offset shell):** Joe's build passes every check:
  - 0 body-through-cloth and 0 self-intersecting face pairs
  - tee in 1 piece with 4 openings
  - shoulder gap within 0.5 cm mean and 1.0 cm max
  - all tee and jeans landmarks within 2 cm, the jeans leg opening included (+1.2 cm after the B3 fix)
- **Synthetic bodies:**
  - Trouser hip calibration still stops short on synthetic_large (-1.64 cm) and synthetic_female_large (-1.04 cm), and the female large trouser waist is +1.78 cm. The real garment is smaller than body plus 3 mm, and stretch is not modelled (B4).
  - The female large tee passes through its trousers at 33 face pairs with the offset shell.
- **Builds are repeatable:** two default builds give byte-identical files (`spike/check_repeatable.py`).
- **Phone:** Pixel 8, 60 fps and about 750 KB for body, tee and trousers (measured earlier in the spike; not re-measured on the final models).
- **Beth:** only her height is real, and she has no garment measurements, so her results are not meaningful yet.

What the spike changed since the review:
- **Checks:** clipping is now judged by hard mesh checks (intersecting face pairs, clearance, pieces and openings) on the exported GLBs, not a ray-test percentage.
- **Repeatability:** a face-order bug that made builds vary is fixed.
- **Garment fixes:** the stray piece under the chin (B24), the floating shoulders (B23), the trouser legs crossing at the crotch (B1) and Joe's leg opening (B3).

## Known limitations, moved to the backlog

- **Underarm folds.** With the cloth drape, Joe's tee folds under the arms (5 to 17 self-intersecting pairs across runs). This happens where its 94 cm hem has to stretch over about 98 cm of jeans, and knit stretch is not modelled.
- **Crotch clipping.** The offset shell is weakest in the fold between the legs. The trouser legs no longer cross (0 pairs on all eight builds after task 4), but this has only been checked on these bodies and stays on the backlog to recheck as new bodies and trousers are added.
- **Drape varies between runs.** Blender cloth is not bit-for-bit repeatable: up to 0.99 cm per vertex between two builds on the synthetic tees and 2.3 cm on Joe's, even on one thread. So `--drape` stays off the MVP path, and MVP garments use the offset shell, which is byte-identical between builds. The offset-shell tee still narrows at the waist (B22); the drape fixed that but is not used.

## Still to do by Joe

- Compare the avatar with his photos (front and side) and say whether it looks like him.

## Decision records

- `2026-11-15-fable-review.md`: the independent review and its task list
- `2026-11-15-joe-accepts-fable-review.md`: Joe's acceptance of the review
- `2026-11-15-task1-mesh-checks.md`: clipping test replaced by hard mesh checks
- `2026-11-15-repeatable-builds.md`: face-order bug fixed
- `2026-11-15-task2-chin-fragment.md`: B24
- `2026-11-15-task3-floating-shoulders.md`: B23
- `2026-11-15-task4-crotch.md`: B1
- `2026-11-15-joe-ankle-intersections.md`: B3 diagnosis
- `2026-11-15-b3-leg-opening.md`: B3 fix
- `2026-11-15-task5-tee-drape.md`: cloth drape (not on the MVP path)
- `2026-11-15-hem-stretched-size.md`: tee judged against its stretched size

## Reproduce

Blender 5.3.0 and MPFB 2.0.18. See `spike/README.md` and `spike/blender/README.md`. `python spike/build_all.py --jobs 4` rebuilds every synthetic body and runs the checker; add `--private` for Joe and Beth. Personal data is in the git-ignored `private/` folder; committed tests use `spike/fixtures/`.
