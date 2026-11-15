# pack

Builds the avatar pack: a body from tape measurements plus default-fit garments, checked against `spike/tolerances.json`.
It wraps the spike's Blender scripts (`spike/blender/`) and checker (`spike/check_reports.py`) in one command.

| File | What it does |
| --- | --- |
| `build_pack.py` | The command. Builds, checks, and (with `--private`) writes Joe's pack. |
| `fit_config.json` | The default fit: ease and proportions per garment type, and the neutral garment colour. One place to change a fit. |
| `fit.py` | Turns a body's measurements and the config into garment sizes. No Blender needed. |
| `test_fit.py` | Unit tests for `fit.py`; run by `npm run check`. |
| `test_reports.py` | Fails if the committed reports in `reports/` were not built from the current `fit_config.json`; run by `npm run check`. |
| `reports/` | The six synthetic bodies' reports, built by `build_pack.py` from `fit_config.json`. `npm run check` validates these, so it checks the garments the app ships. |

## Run (PowerShell)

Synthetic bodies only (the six in `spike/fixtures/`), built into `pack/out/` (git-ignored) and checked:
```
python pack/build_pack.py
```
Joe as well, from `private/measurements_joe.json`. If every check passes, his pack is written to `private/pack/joe/`:
```
python pack/build_pack.py --private
```
Try a different fit without editing the committed file: `python pack/build_pack.py --config path/to/my_fit.json --only synthetic_large`.
After changing `fit_config.json` itself, refresh the committed reports (all six bodies, committed config only), then commit them with the config:
```
python pack/build_pack.py --reports-to pack/reports
```
`npm run check` fails until you do, because each report carries the SHA-256 of the config it was built from.
Try a change on one body first: `python pack/build_pack.py --only synthetic_medium` (or `--only joe --private`).
About 40 seconds for one body, about 2 minutes for all seven (`--jobs 4`). The exit code is 0 only if every build and check passed.

**Windows note:** if it says Blender cannot import MPFB, the `python` on your PATH is the Microsoft Store alias, which hides Blender's
add-on folder from anything it starts. Run the script with the interpreter's full path (the error message prints it), for example
`& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" pack/build_pack.py --private`.

## What comes out

`private/pack/joe/` (git-ignored, because `private/` is):

- `body.glb`, `tee.glb`, `tee_v.glb`, `tee_scoop.glb`, `trousers.glb`, `sweatshirt.glb`: one mesh each, exported by Blender's glTF exporter.
  `tee.glb` is the crew neck; `tee_v.glb` and `tee_scoop.glb` (V1.1-04) are the same shell cut with a deeper V or scoop front. The depths and widths are in `fit_config.json` under `tee.necklines`.
- `manifest.json`: file sizes and SHA-256, Blender version, the fit config used, build time.

`private/pack/build/` holds the build logs, reports and garment size files for inspection. Garments are built in a neutral light grey;
the app sets the colour. The sweatshirt (MVP-07) is an alternative top over the trousers, held to the tee's mesh limits. So are the V and scoop tees: each gets the same hard mesh checks as the crew neck, plus its own neckline width and front depth against the config.

## How the fit works

Garments are not copied from real items. `fit.py` sizes each one from the body's own measurements plus the values in `fit_config.json`,
and the spike's offset-shell method fits it to the body (`--drape` is not used). Two things to know:

- The shell method sets how loose a garment can look. On the widest synthetic bodies the shell cannot reach a bigger trousers hip or a
  looser tee chest without failing a check, so the eases are the largest that pass on all seven bodies, not what a regular fit would be on a rail.
- The tee has no hem circumference, so the checker skips its tee-circumference comparison (it prints "no garment value"). That comparison
  was a cloth-drape check against a real item's hem, and the shell cannot make a loose tee at the waist (known limit B22).
  The mesh checks (no body through cloth, no self-intersection, tee clear of trousers, minimum clearance) all still apply.

Builds are repeatable: two builds of Joe give byte-identical GLBs.
