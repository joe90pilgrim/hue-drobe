# spike/cloth

V3-00 experiment: an A-line midi skirt draped with Blender's own cloth solver, run once offline and saved as a fixed GLB. Write-up: `docs/decisions/2026-11-17-v3-00-cloth-skirt.md`. Blender 5.3.0, MPFB 2.0.18, numpy (Blender's own, and the real Python's for the runner).

| Script | What it does |
| --- | --- |
| `skirt_cloth.py` | In one Blender session: builds the body and tee with the unchanged `spike/blender/body_from_measurements.py`, makes the skirt's start shell from the body GLB (waist to hip follows the body outline plus ease, then a linear flare to mid-calf), drapes it with Blender cloth (waistband pinned, body as collider, self-collision on), exports `<name>_skirt.glb`, runs the hard mesh checks from `spike/blender/mesh_checks.py` on the GLB read back in, saves the vertex positions (`<name>_skirt_verts.npy`) and renders front, side and back. Writes `<name>_skirt_report.json`. |
| `run_all.py` | Runs the above for B and the small and large synthetic female bodies, twice each (full rebuilds, one Blender thread each), and writes `summary.json` with the checks and the vertex distance between the two builds. |

## Run (PowerShell)
Use the real Python, not the Microsoft Store `python` alias (it hides Blender's add-on folder from Blender):
```
py spike/cloth/run_all.py --jobs 3 --runs 2
```
Output goes to `private/cloth_spike/` (git-ignored, because B's renders show a real body). `--only b,synthetic_female_small` limits the bodies; `--out` changes the folder.

Pattern and cloth values are constants at the top of `skirt_cloth.py` and are written into each report. For experiments, `SKIRT_HEM_RATIO`, `SKIRT_BENDING`, `SKIRT_MASS`, `SKIRT_FRICTION`, `SKIRT_FRAMES` and `SKIRT_TENSION` environment variables override them.

Known issue: several Blender builds in parallel stall if the computer sleeps; a stalled run shows a huge `build_s.body` in its report.
