# spike/cloth

V3-00 experiment: an A-line midi skirt draped with Blender's own cloth solver, run once offline and saved as a fixed GLB. Write-up: `docs/decisions/2026-11-17-v3-00-cloth-skirt.md`. Blender 5.3.0, MPFB 2.0.18, numpy (Blender's own, and the real Python's for the runner).

| Script | What it does |
| --- | --- |
| `skirt_cloth.py` | In one Blender session: builds the body and tee with the unchanged `spike/blender/body_from_measurements.py`, makes the skirt's start shell from the body GLB (waist to hip follows the body outline plus ease, then a linear flare to mid-calf), drapes it with Blender cloth (waistband pinned, body as collider, self-collision on), exports `<name>_skirt.glb`, runs the hard mesh checks from `spike/blender/mesh_checks.py` on the GLB read back in, saves the vertex positions (`<name>_skirt_verts.npy`) and renders front, side and back. Writes `<name>_skirt_report.json`. |
| `run_all.py` | Runs the above for B and the small and large synthetic female bodies, twice each (full rebuilds, one Blender thread each), and writes `summary.json` with the checks and the vertex distance between the two builds. |

## Run (PowerShell)
Use the real Python, not the Microsoft Store `python` alias (it hides Blender's add-on folder from Blender). On Joe's machine `py` and `python` both resolve to `AppData\Local\Microsoft\WindowsApps`, and Blender then fails with `No module named 'bl_ext.user_default.mpfb'`, so call the interpreter by its full path:
```
& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" spike/cloth/run_all.py --jobs 3 --runs 2
```
Output goes to `private/cloth_spike/` (git-ignored, because B's renders show a real body). `--only b,synthetic_female_small` limits the bodies; `--out` changes the folder.

Pattern and cloth values are constants at the top of `skirt_cloth.py` and are written into each report. For experiments, `SKIRT_HEM_RATIO`, `SKIRT_BENDING`, `SKIRT_MASS`, `SKIRT_FRICTION`, `SKIRT_FRAMES` and `SKIRT_TENSION` environment variables override them.

For diagnosis only (never a shipped build): `SKIRT_DIAG_NO_SELF=1` turns self-collision off, `SKIRT_DIAG_NO_LEGS=1` drops the body below the crotch from the collider, `SKIRT_DIAG_NO_BODY=1` drops the collider altogether. `SKIRT_SELF_DIST` and `SKIRT_GRAVITY_RAMP` also override. Each report has `hem_track` (hem height and radius every 10 frames) and `ring_profile` (height, circumference and how many directions the body rather than the flare sets, per ring).

## V3-01a changes (17 November 2026)
Write-up: `docs/decisions/2026-11-17-v3-01a-skirt-fixes.md`. One set of settings for every body.
- **Waistband (large body):** the top ring's outline also clears the body up to 4 cm above it (`WAIST_LOOK_UP`), so the edge no longer dips into a belly that bulges above the waist.
- **Hip step (large body):** between waist and hip no ring is narrower than a straight line from waistband to hip ring, so the fitted part runs into the flare without a ledge.
- **Small body hem riding up:** caused by self-collision, not the legs. With a 0.6 cm self distance the hem was thrown up and under from frame 1 (with the legs out of the collider too, and with gravity at 13%). `SELF_DIST` is now 0.3 cm.
- **Hem length:** the hem hung 1.8 to 2.6 cm below target because the flared wall swings nearly vertical as it settles (stiffer tension made no difference). The bottom ring is now raised so the cloth length from hip to hem equals the hip-to-target height.
- **Gravity ramp:** gravity rises from 0 to full over 40 frames, then 60 frames to settle (100 in all). Kept as a safeguard; on its own it did not fix the small body.

Known issue: several Blender builds in parallel stall if the computer sleeps; a stalled run shows a huge `build_s.body` in its report.
