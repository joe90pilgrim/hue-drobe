# Garment builds are now repeatable

Date: 2026-11-15. Follows `2026-11-15-task1-mesh-checks.md`, which found the synthetic_large tee build was not repeatable.

## Result

Two full builds of all six synthetic bodies, Joe and Beth give byte-identical GLBs and identical reports (`python spike/check_repeatable.py <first> <second>`: REPEATABLE for `spike/out` and `private/out`). synthetic_large's tee now calibrates on every run (chest 117.7 against 118 cm) and is no longer torn.

## Cause

Found by logging an exact hash of the tee's vertices and faces after each stage of `build_tee`, in two runs from the same inputs:

1. **Face order.** `extrude_edge_only` (the tee hem extended below the crotch) created the same faces in a different order on each run; vertex positions matched bit for bit. The push that keeps the tee over the trousers looks faces up by index, so a different order pushed different faces. That push repeats up to 12 times and amplifies any difference, which is how the tee tore.
2. **Stale indices.** `BVHTree.FromBMesh` returns each face's stored index, and the deletes and plane cuts before it leave those stale. The same problem affected `mesh_checks.py` and `analyse_meshes.py` after `remove_doubles`.
3. **Garbage source indices** on vertices created by the hem and waist plane cuts, which `push_out` then used to look up body vertices.

A probe showed that building a BVH tree twice from the same mesh gives identical answers, so the tree itself was not the cause.

## Fix (`spike/blender/garment.py`, `mesh_checks.py`, `analyse_meshes.py`)

- `canonical_faces()` sorts the garment's faces by position and refreshes all indices, before each tree build in the push and before export.
- `nearest()` breaks nearest-face ties by lowest index, so the answer depends on geometry alone.
- Vertices created by plane cuts are marked as having no source vertex.
- Indices are refreshed after `remove_doubles`.

## Numbers moved

Trousers go through the same code, so their counts changed slightly too. Current figures (body through tee/trousers, self tee/trousers, tee through trousers):

| Body | Before | Now |
| --- | --- | --- |
| synthetic_small | 0/0, 0/28, 0 | 0/0, 0/26, 0 |
| synthetic_medium | 0/0, 0/22, 0 | 0/0, 0/26, 0 |
| synthetic_large | 2657/0, 3104/39, 1073 | 0/0, 0/38, 0 |
| synthetic_female_small | 0/0, 0/11, 0 | 0/0, 0/8, 0 |
| synthetic_female_medium | 0/0, 3/23, 0 | 0/0, 0/27, 0 |
| synthetic_female_large | 0/0, 0/28, 40 | 0/0, 0/30, 33 |

Joe: body through trousers still 16 pairs, trouser self-intersections 33. Beth: body through tee still 38 pairs. Every tee is still 2 pieces and 5 openings (task 2). The checker fails for the expected reasons only.

## Still open

The "before" figures in the review and in the task 1 note came from builds that were not repeatable, so treat them as one sample each. Task 5's "same result from two consecutive builds" can now be checked with `check_repeatable.py`.
