# spike/assets

V2-07: do the free MakeHuman community asset packs supply garments, shoes and hair for Hue-drobe? Spike code only; nothing here touches the app or the shipped pack. The write-up is in `docs/decisions/2026-11-16-v2-07-asset-pack-spike.md`.

| File | What it does |
| --- | --- |
| `items.json` | The pack items tried, per sex of the body base. Six are the ticket's items, two are marked `extra`. |
| `fit_pack_items.py` | Blender script. Builds one body with `spike/blender/body_from_measurements.py` (unchanged, through `runpy`), loads each item with MPFB's own loader (`HumanService.add_mhclo_asset`), exports it to GLB, runs the existing hard mesh checks (`mesh_checks.py`) on the exported GLB, measures weight, hidden body and recolour, and renders front, side and back. |
| `run_all.py` | Runs the script above for Joe, B and one synthetic male and one synthetic female body, in parallel. |
| `summarise.py` | Prints the measured tables as Markdown from the reports. |

## Packs (not committed)

Six CC0 zips from the MakeHuman community site, each unzipped into its own folder under `private/assetpacks/<pack>/x/` (git-ignored): `shirts01`, `pants01`, `skirts01`, `dress01`, `shoes01`, `hair01`, each `<pack>_cc0.zip` from `https://files.makehumancommunity.org/asset_packs/<pack>/`. The `files2` mirror was far slower (about 40 KB/s against about 9 MB/s) and its partial files did not resume on the other mirror, so download each zip whole from one mirror. Test every zip before unpacking (`python -I`, `zipfile.testzip()`).

## Run (PowerShell)

Use the real Python, not the Microsoft Store `python` alias, which hides Blender's add-on folder from Blender (the same reason `pack/build_pack.py` checks for MPFB first).

```
& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" spike/assets/run_all.py --jobs 4
& "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe" spike/assets/summarise.py
```

Options: `--only joe,b`, `--item shirt`, `--no-render`, `--packs <dir>`, `--out <dir>`. Output goes to `private/assets_spike/<body>/` (git-ignored, because the renders show real bodies): `<body>_assets_report.json`, `assets/*.glb`, `renders/*.png`.

Tested with Blender 5.3.0 and MPFB 2.0.18. About one minute per body for the build, then a few seconds per item and per render.
