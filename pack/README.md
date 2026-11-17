# pack

Builds the avatar pack: a body from tape measurements plus default-fit garments, checked against `spike/tolerances.json`.
It wraps the spike's Blender scripts (`spike/blender/`) and checker (`spike/check_reports.py`) in one command.

| File | What it does |
| --- | --- |
| `build_pack.py` | The command. Builds, checks, and (with `--private`) writes Joe's pack. |
| `fit_config.json` | The default fit: ease and proportions per garment type, and the neutral garment colour. One place to change a fit. |
| `fit_people.json` | Per-person fit (V2-03): overrides for Joe and B laid over `fit_config.json` (`fit.merge`). Both are empty for now, so both use the default fit. The synthetic bodies never read it. Each pack's `manifest.json` records the fit used and the overrides. |
| `fit.py` | Turns a body's measurements and the config into garment sizes. No Blender needed. |
| `test_fit.py` | Unit tests for `fit.py`; run by `npm run check`. |
| `measure_glb.py` | Measures an exported body GLB against its tape measurements, with numpy only (no Blender, none of the generator's code). `python pack/measure_glb.py private/pack/b/body.glb private/measurements_b.json private/pack/build/b_report.json` |
| `test_measure_glb.py` | Unit tests for `measure_glb.py` on small synthetic tubes. |
| `bust_shape.py` | V2-08: how a top sits over the bust on a female body, from the GLBs with numpy only: the tuck under each breast (hollow below the apex) and how sharply the cloth falls away from the apex. The generator writes it into each female body's report (`bust_shape`), and `check_reports.py` holds it to `spike/tolerances.json` `bust_shape`. By hand: `python pack/bust_shape.py private/pack/b/body.glb private/pack/build/b_report.json private/pack/b/tee.glb private/pack/b/sweatshirt.glb`. V2-09 added `body_cup` (bust minus underbust, and projection of each breast in front of the chest wall), reported with no limit. |
| `cup.py`, `test_cup.py` | V2-09: the cup letter in a measurements file (`"cup": "A"`) to MPFB's cupsize macro, from `spike/cup_sizes.json`. No Blender needed. |
| `pack_items.py`, `pack_items.json` | V3-06: pack items from the archived MakeHuman packs (`assets/packs/`, V2-09). `pack_items.json` lists them and which sex of body gets each (for now the shift dress, `toigo_shift_dress`, on women). `build_pack.py` unpacks just those items from the zips into `assets/packs/extracted/` (git-ignored; checks the zip against `MANIFEST.md` and refuses anything not CC0), then runs `pack_items.py` in the same Blender session as the body. It loads each item with MPFB's own loader, exports it in plain colour (texture kept only for hair and shoes), removes the body parts it hides (MPFB's delete group) into `body_dress.glb`, and runs the "body as drawn" check. |
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
B (V2-02) is built from `private/measurements_b.json` and packed to `private/pack/b/`. The same command builds her whenever the file exists;
`python pack/build_pack.py --private --only b` builds just her. Since V2-03 she gets every garment and every garment check, like Joe.
A measurements file with `"body_only": true` is still accepted: the build, the checker and the pack then cover the body alone.
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

- `body.glb`, `tee.glb`, `tee_v.glb`, `tee_scoop.glb`, `trousers.glb`, `shorts.glb`, `tights.glb`, `sweatshirt.glb`: one mesh each, exported by Blender's glTF exporter.
  `tee.glb` is the crew neck; `tee_v.glb` and `tee_scoop.glb` (V1.1-04) are the same shell cut with a deeper V or scoop front. The depths and widths are in `fit_config.json` under `tee.necklines`.
- `manifest.json`: file sizes and SHA-256, Blender version, the fit config used, build time.

`private/pack/build/` holds the build logs, reports and garment size files for inspection. Garments are built in a neutral light grey;
the app sets the colour. The sweatshirt (MVP-07) is an alternative top over the trousers, held to the tee's mesh limits. So are the V and scoop tees: each gets the same hard mesh checks as the crew neck, plus its own neckline width and front depth against the config.
The shorts (V1.1-05) are the trousers' shell cut at a 23 cm inseam, with the bottom 8 cm let out so the leg opening is 4 cm wider
than the trousers at that height (`fit_config.json`, `shorts`). They get the trousers' hard mesh checks, and every top is checked
for intersections with them as well as with the trousers.
The tights (V2-04) are the trousers' template as a skin-close shell, 2.5 mm off the skin, from 1 cm below the waistband to 8 cm above
the floor (`fit_config.json`, `tights`). The shorts are built over them, then the tights are tucked inside the shorts on the exported
triangles (`garment.tuck_inside`). They get the trousers' hard mesh checks, and the shorts and every top are checked against them.
Opaque or sheer is set in the app. Record: `docs/decisions/2026-11-16-v2-04-tights.md`.
A woman's pack also has the skirt and the tucked-in tops (V3-01b, `fit_config.json` `skirt`): `skirt.glb`, an A-line midi draped once on her own
body by Blender's cloth solver (`spike/cloth/skirt_cloth.py`, run in the same Blender session as the body on one thread, so two builds are identical),
and `tee_tucked.glb`, `tee_v_tucked.glb`, `tee_scoop_tucked.glb`, the tees cut flat at the skirt's waistband. Joe's decision (17 Nov 2026): a top is
tucked in; the app shows the tucked tee while a skirt is worn, and a sweatshirt cannot be worn with it. There are no blended sizes: each body gets its own
skirt. A man's pack has none of these files. The checks (`spike/check_reports.py --skirt`) hold the skirt to the trousers' mesh limits, its hem to
the target height, and each tucked tee to the tee's limits plus no face pairs with the skirt or the tights. `--renders` adds front, side and back renders
for the synthetic women; the private bodies always render into `private/pack/build/renders`. Record: `docs/decisions/2026-11-17-v3-01b-skirt-in-app.md`.
A woman's pack also has the pack dress (V3-06): `dress.glb` (plain grey, the app sets the colour) and `body_dress.glb`, the body with the parts under the dress removed,
which the app draws in place of `body.glb` while the dress is worn. `pack_items.py` fits the dress before it hides anything: item vertices inside the skin, or closer than 0.2 cm, are pushed out to 0.2 cm; body vertices stay hidden only where the cloth lies outside them along their normal; and wherever a gap ray still shows the inside of the cloth, the body vertices it would have seen come back, and the check runs again (up to 6 rounds). The numbers are in `spike/tolerances.json` `pack_item_body_as_drawn`. The dress is a pack item, so it is not held to the strict mesh limits above. `spike/check_reports.py
--pack-items` holds it to `spike/tolerances.json` `pack_item_body_as_drawn` instead: no face pairs between the body as drawn and the dress, and no gap ray
(`spike/blender/mesh_checks.py` `body_as_drawn`: rays from 120 viewpoints over the dress's silhouette; a gap is a ray that would have hit skin on the whole body but, with the
parts removed, shows the inside of the cloth or nothing). The check also counts face pairs with the body not hidden, which must be over zero, so it cannot pass by doing nothing.
`python pack/build_pack.py --only synthetic_female_medium --no-hide` builds without hiding and fails the check, as a demonstration. The app takes off the top and the bottom
when a dress is worn (`app/src/wardrobe.ts` `keepLayers`, slot `Dress`); the dress itself is not in the app until V3-02.
On a female body every top hangs from the bust instead of tucking under it (V2-08, `fit_config.json` `bust`): the top's size is
calibrated without the hang, then the shell is built once more with it, and the report carries both `chest_circ_cm` (the size) and
`chest_circ_as_worn_cm`. Male bodies never read the block, so their garments are unchanged. Record: `docs/decisions/2026-11-16-v2-08-bust-shape.md`.

## How the fit works

Garments are not copied from real items. `fit.py` sizes each one from the body's own measurements plus the values in `fit_config.json`,
and the spike's offset-shell method fits it to the body (`--drape` is not used). Two things to know:

- The shell method sets how loose a garment can look. On the widest synthetic bodies the shell cannot reach a bigger trousers hip or a
  looser tee chest without failing a check, so the eases are the largest that pass on all seven bodies, not what a regular fit would be on a rail.
- The tee has no hem circumference, so the checker skips its tee-circumference comparison (it prints "no garment value"). That comparison
  was a cloth-drape check against a real item's hem, and the shell cannot make a loose tee at the waist (known limit B22).
  The mesh checks (no body through cloth, no self-intersection, tee clear of trousers, minimum clearance) all still apply.

Builds are repeatable: two builds of Joe give byte-identical GLBs.
