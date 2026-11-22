# pack/v5_spike

V5-00: where do shoes, hats, jewellery and hair come from? Spike code only. It ships nothing and changes nothing in the app, `pack/out/` or `pack/templates/`. The write-up is `docs/decisions/2026-11-22-v5-00-asset-sources.md`.

Joe's and B's real bodies only. Everything it writes goes to `private/v5_spike/` (git-ignored, because the renders show real bodies).

| File | What it does |
| --- | --- |
| `candidates.json` | The items tried and on which body. Chosen from pack names and sex tags before any fitting. |
| `prepare.py` | Plain Python. Checks the zips against `assets/packs/MANIFEST.md`, unpacks each candidate into `private/v5_spike/extracted/`, writes a scratch template (`meta.json`) per candidate under `private/v5_spike/templates/`, and one job file per body. |
| `session.py` | One Blender session per body. Runs `pack/fit_template.py` (the shipped loader, fit, push, delete group and "body as drawn" check) unchanged, then adds weight, colour, size, shoe-against-trousers and the hair check. |
| `colour.py` | V2-07's colour measurement, copied unchanged from `spike/assets/fit_pack_items.py` (`spike/` is history and is not edited). |
| `run.py` | `stage1` (each candidate alone), `hats` (each hat over the body's best hair), `renders`. |
| `render_textured.py` | Renders an item with its own textures, for the pale, sock-like shoe look. `spike/blender/render_closeup.py` is used for the plain-colour renders. |
| `prep_jewellery.py` | Prepares the one non-MakeHuman item converted (the CC0 OpenGameArt necklace): turns its OBJ 90 degrees and writes its template folder. Then `blender --background --python pack/author_template.py -- <that folder>` runs MakeClothes. The landmarks are in `jewellery/necklace_wortmann/meta.json`. |
| `montage.py` | Blender script: puts renders side by side in one picture for reading. |
| `summarise.py` | Prints the tables as Markdown from the reports. |

## Run (PowerShell)

Use the real Python, not the Microsoft Store `python` alias, which hides Blender's add-on folder from Blender.

```
& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" -I pack/v5_spike/prepare.py
& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" -I pack/v5_spike/run.py stage1
& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" -I pack/v5_spike/run.py hats
& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" -I pack/v5_spike/run.py renders
& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" -I pack/v5_spike/summarise.py
```

Options: `--only joe,b`, `--items id1,id2` (stage1), `--jobs N`. Needs the five new packs in `assets/packs/zips/` (`python -I assets/packs/fetch_packs.py`). Blender 5.3.0, MPFB 2.0.18.

Every scratch template has the same settings (`settle` none, `approved` false, `clearance_cm` 0.2, 0.1 for hair, delete group for shoes only), so nothing is tuned per item and no number is forced to pass.
