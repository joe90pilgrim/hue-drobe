# spike/blender

Headless Blender scripts. Tested with Blender 5.3.0 and MPFB 2.0.18.

| Script | What it does |
| --- | --- |
| `body_from_measurements.py` | Builds a body from a measurements JSON (height, waist, hips, chest), then fits a tee and trousers and writes `<name>.glb`, `<name>_tee.glb`, `<name>_trousers.glb` and `<name>_report.json`. If the garments file has a `sweatshirt` (MVP-07, from `pack/fit.py`), it also builds `<name>_sweatshirt.glb`. If the tee has `necklines` (V1.1-04), it also builds `<name>_tee_v.glb` and `<name>_tee_scoop.glb`: the crew tee's shell, with the same ease, sleeve and hem, cut with a different neck. If the garments file has `shorts` (V1.1-05), it also builds `<name>_shorts.glb`: the trousers' shell and ease cut at the shorts' inseam, with only the bottom flare band let out to the wider leg opening. |
| `garment.py` | Garment templates as offset shells of the body mesh, plus clipping and landmark checks. Long sleeves, a forearm ease taper and drawn-in rib bands (hem, cuffs) for the sweatshirt. `neckline_drop` holds the neck cut shapes (crew, v, scoop). `tuck_inside` fits skin-close tights under the shorts on the exported triangles (V2-04). Imported by the script above. |
| `mesh_checks.py` | Garment pieces and openings, intersecting face pairs (body with garment, garment with itself, tee with trousers, and each top with the shorts when there are shorts; tights with the shorts and each top when there are tights), cloth-to-body clearance and shoulder gap. Run by the build into `<name>_report.json` under `mesh_checks`; `check_reports.py` fails the build on the limits in `tolerances.json` (`garment_mesh`). |
| `analyse_meshes.py` | Read-only analysis of the exported GLBs: the same mesh checks plus centre-line profile, crotch ray test and circumference by height. Writes `<name>_analysis.json`. Analysis only; it does not fail the build. |
| `drape.py` | Task 5: settles the tee with Blender cloth under gravity onto the body and trousers. The rest shape is the shell with each torso ring below the chest resized to the garment's own circumference (chest down to `hem_circ_cm`). Used when the build is given `--drape`. |
| `export_test.py`, `mpfb_probe*.py` | Block 0 and Block 1 probes. Safe to ignore. |

## Run (PowerShell)
```
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" --background --python spike/blender/body_from_measurements.py -- spike/fixtures/synthetic_medium.json spike/out synthetic_medium
python spike/check_reports.py spike/out
```
A measurements file may carry an optional `"shape"` block (V2-02) for proportions that a tape does not pin down, chosen by eye: a macro (`muscle`, `proportions`, `cupsize`, `firmness`, 0 to 1), a fixed `"weight"`, or a signed MPFB target pair such as `"torso-scale-horiz": 0.7` (-1 to 1). The solver still sets the measured circumferences, so it refuses the keys it controls. The block is written into the report as `shape_by_eye`, and the build log gets a `SOLVER` line with the fine-control values (a value near +/-1 means the tape numbers are being met by an extreme setting).
Rebuild every fixture (and, with `--private`, J and B into `private/out`) and run the checker:
```
python spike/build_all.py --jobs 4
```
Check two builds of the same inputs are identical (copy `spike/out` somewhere first, then rebuild):
```
python spike/check_repeatable.py <copy_of_first_build> spike/out
```
Drape the tee with cloth (task 5); drape builds run Blender on one thread and are compared within a tolerance in cm, because the cloth solver is not bit-for-bit repeatable:
```
python spike/build_all.py --drape --jobs 4
python spike/check_repeatable.py <copy_of_first_build> spike/out --tol 1.0
```
Mesh analysis (pass the `hps_height_cm_estimate` value from the report; `spike/out` is git-ignored):
```
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" --background --python spike/blender/analyse_meshes.py -- spike/out synthetic_medium 149.5 spike/out
```
`check_reports.py` reads `spike/tolerances.json` and exits 1 if any tolerance is missed.
Personal measurements go in `private/` (git-ignored); committed tests use `spike/fixtures/`.
