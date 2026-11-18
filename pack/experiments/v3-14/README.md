# V3-14 experiment: cloth, garment-side pins and inner-layer hiding

A one-off experiment (ticket `docs/tickets/v3-loose-clothes/V3-14-cloth-layering-experiment.md`, write-up
`docs/decisions/2026-11-18-v3-14-cloth-layering-experiment.md`). It is not part of the pack build and changes nothing in `pack/` outside this folder.

`run.py` builds one body with Blender (one thread) and fits three cases:

| Case | Template copy | Inner garment |
| --- | --- | --- |
| `shirt_alone` | `templates/mid/shirt_alone` (copy of `shirt_untucked_bd`) | none |
| `shirt_over_tee` | `templates/mid/shirt_over_tee` | the tee |
| `blazer_over_tee` | `templates/outer/blazer_m_over_tee` (men) or `blazer_f_over_tee` (women), copies of `blazer_suit3` and `blazer_suit_f2` | the tee |

The copies differ from the real templates only in `inner_layers: []` (no push-off against the tee), `settle: "none"` and a `v3_14` block
(which inner garment, which cloth settings). `pack/fit_template.py` runs exactly as it is; the script swaps in a cloth pass at the moment
MPFB attaches the garment (see the docstring in `run.py`), then hides the tee where the outer garment covers it and runs the layer and gap
checks on what is left.

## Run (PowerShell, repo root, the real Python)

```
& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" pack/experiments/v3-14/run.py synthetic_female_large --round r2
```

Options: `--cases shirt_alone,shirt_over_tee,blazer_over_tee` (default all three), `--round <tag>` (output folder and render names),
`--no-render`. About 10 minutes per body. Private bodies (`joe`, `b`) build into `private/out/v3-14/` and render into `private/renders/v3-14/`.

Output: `pack/out/v3-14/<round>/<body>/<body>_v3-14.json` (the numbers; the summary is printed at the end), renders in
`pack/out/renders/v3-14/<body>_<case>_<round>_<view>.png` next to `<body>_<case>_before_<view>.png` copied from the V3-08 and V3-09
renders. In the renders the tee as drawn is light grey (it is staged as `trousers_tee_as_drawn.glb`, because `render_closeup.py` draws
files named `trousers*` grey), so the tee shows against the navy outer garment.

Blender 5.3.0, MPFB 2.0.18, as the pack build.

`--rest template` (V3-15 follow-up): the cloth's rest shape goes from the fit to the template's own .obj over 20 frames (Blender's dynamic
base mesh; `rest_shape_key` is ignored headless, see `pack/experiments/v3-15/rest_key_check.py`). Default `--rest fitted` is V3-14 as it was.
Tuning options (V3-16 rounds, all off by default): `--back-band <units>`, `--pin-cuffs`, `--frames <n>`, `--bending <x>`, `--grow-trousers`.
