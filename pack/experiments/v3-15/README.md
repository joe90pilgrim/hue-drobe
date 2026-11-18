# V3-15 check: does Blender cloth use a rest shape key headless?

`rest_key_check.py` runs a 1 m cloth grid (no gravity, no pins) for 40 frames with a rest shape 1.2 times larger, set five ways, and
prints the mean edge length after against before. In Blender 5.3.0, `rest_shape_key` is ignored (1.00). Dynamic base mesh with the
input keyed to the larger shape, and `shrink_min = -0.2`, both give 1.20. Write-up: `docs/decisions/2026-11-18-v3-14-cloth-layering-experiment.md`.

```
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" --background --factory-startup --python pack/experiments/v3-15/rest_key_check.py
```
