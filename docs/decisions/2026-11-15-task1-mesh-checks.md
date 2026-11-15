# Task 1 result: clipping test replaced by hard mesh checks

Date: 2026-11-15. Task 1 of `2026-11-15-fable-review.md`, limits agreed in `2026-11-15-joe-accepts-fable-review.md`.

## Result

The checker now fails today's builds for the reasons the review expected, and no longer on the ray fraction. It also found two problems the review did not know about: the synthetic_large tee build is not repeatable, and Joe's trousers do pass through his body.

| Body | Tee pieces/openings | Body through tee/trousers | Self tee/trousers | Tee through trousers | Min clearance tee/trousers (cm) |
| --- | --- | --- | --- | --- | --- |
| synthetic_small | 2/5 | 0/0 | 0/28 | 0 | 0.31/0.27 |
| synthetic_medium | 2/5 | 0/0 | 0/22 | 0 | 0.30/0.30 |
| synthetic_large | 2/5 | 2657/0 | 3104/39 | 1073 | -6.23/0.30 |
| synthetic_female_small | 2/5 | 0/0 | 0/11 | 0 | 0.30/0.30 |
| synthetic_female_medium | 2/5 | 0/0 | 3/23 | 0 | 0.30/0.29 |
| synthetic_female_large | 2/5 | 0/0 | 0/28 | 40 | 0.30/0.31 |

Trousers are 1 piece with 3 openings on every body. Produced by `python spike/build_all.py --private --jobs 4`, then `python spike/results_table.py spike/out`.

- **Joe:** body through trousers 16 face pairs, trouser self-intersections 32 (all at 85 to 90 cm, the crotch), tee 2 pieces and 5 openings. So "no body through cloth" does **not** hold on Joe's build, unlike the synthetic bodies.
- **Beth** (no garment fixture, default tee): body through tee 38 pairs, minimum tee clearance -0.1 cm, tee through trousers 4 pairs.

## synthetic_large is not repeatable

**Fixed:** see `2026-11-15-repeatable-builds.md`, which also has the current figures for the table above.


The tee chest calibration reads about 114 cm, then `nan`, then about 139 cm (torso and sleeve loops merged) on different iterations. Two solo runs with the same inputs gave different sequences from iteration 3 onwards. One of the four builds today converged; the other three did not. When it fails, the exported tee is torn (one boundary loop 1,907 cm long). Likely cause, unverified: iteration order over Python sets of mesh elements in `garment.py`. This needs fixing before task 5's "same result from two consecutive builds" can pass.

## What changed

- `spike/blender/mesh_checks.py`: pieces, openings, intersecting face pairs, clearance and shoulder gap. The build runs it on the **exported GLBs** read back in, not on the in-memory meshes: glTF export splits quads into its own triangles, and the in-memory quads gave lower counts (synthetic_medium trouser self-intersections 14 against 24; female large tee through trousers 24 against 40). The GLB figures match the review's.
- `spike/tolerances.json`: `garment_clipping_max_fraction` and `garment_clipping_max_depth_cm` removed (the depth was never read and its `worst_cm` source was always 0), replaced by `garment_mesh` hard limits.
- `spike/check_reports.py`: checks the hard limits; ray and nearest-point tests are information only; `inside_leg_cm` now uses the 1.5 cm length tolerance.
- `garment.py`: `worst_cm` removed from the ray report.
- `analyse_meshes.py`: reuses `mesh_checks.py`; the unreliable camera visibility test is removed.
- `spike/build_all.py`: rebuilds every fixture (and `--private` bodies) and runs the checker. A missing report counts as a failed build, because Blender exits 0 when the script raises.

## Not done

- No screenshots; nothing here changes the visuals.
- Where Joe's 16 body-through-trouser pairs sit is not recorded; the check counts them but does not locate them.
- Running from inside the Claude desktop app, the Store `python` alias starts Blender outside the app's redirected AppData, where MPFB is not installed. Calling the Python executable by its full path works. Running from Joe's own PowerShell is not affected.
