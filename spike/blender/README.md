# spike/blender

Headless Blender scripts. Tested with Blender 5.3.0 and MPFB 2.0.18.

| Script | What it does |
| --- | --- |
| `body_from_measurements.py` | Builds a body from a measurements JSON (height, waist, hips, chest), then fits a tee and trousers and writes `<name>.glb`, `<name>_tee.glb`, `<name>_trousers.glb` and `<name>_report.json`. |
| `garment.py` | Garment templates as offset shells of the body mesh, plus clipping and landmark checks. Imported by the script above. |
| `analyse_meshes.py` | Read-only checks on the exported GLBs: garment pieces and openings, intersections, cloth clearance, shoulder gap, circumference by height. Writes `<name>_analysis.json`. Analysis only; it does not fail the build yet. |
| `export_test.py`, `mpfb_probe*.py` | Block 0 and Block 1 probes. Safe to ignore. |

## Run (PowerShell)
```
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" --background --python spike/blender/body_from_measurements.py -- spike/fixtures/synthetic_medium.json spike/out synthetic_medium
python spike/check_reports.py spike/out
```
Mesh analysis (pass the `hps_height_cm_estimate` value from the report; `spike/out` is git-ignored):
```
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" --background --python spike/blender/analyse_meshes.py -- spike/out synthetic_medium 149.5 spike/out
```
`check_reports.py` reads `spike/tolerances.json` and exits 1 if any tolerance is missed.
Personal measurements go in `private/` (git-ignored); committed tests use `spike/fixtures/`.
