# spike/blender

Headless Blender scripts. Tested with Blender 5.3.0 and MPFB 2.0.18.

| Script | What it does |
| --- | --- |
| `body_from_measurements.py` | Builds a body from a measurements JSON (height, waist, hips, chest), then fits a tee and trousers and writes `<name>.glb`, `<name>_tee.glb`, `<name>_trousers.glb` and `<name>_report.json`. |
| `garment.py` | Garment templates as offset shells of the body mesh, plus clipping and landmark checks. Imported by the script above. |
| `export_test.py`, `mpfb_probe*.py` | Block 0 and Block 1 probes. Safe to ignore. |

## Run (PowerShell)
```
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" --background --python spike/blender/body_from_measurements.py -- spike/fixtures/synthetic_medium.json spike/out synthetic_medium
python spike/check_reports.py spike/out
```
`check_reports.py` reads `spike/tolerances.json` and exits 1 if any tolerance is missed.
Personal measurements go in `private/` (git-ignored); committed tests use `spike/fixtures/`.
