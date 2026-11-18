# Garment templates (V3-07)

Every new garment type is a folder here, not new geometry code. `pack/fit_template.py` fits each one to each person's MPFB body at build
time; `pack/author_template.py` prepares one from a raw mesh, once. Design: `docs/decisions/2026-11-17-v3-garment-pipeline-proposal.md`.

## Layout

```
pack/templates/<category>/<template_id>/
  source.<obj|glb>   the raw download, untouched (left out for pack items used straight from assets/packs/)
  template.mhclo     MakeClothes output: each garment vertex bound to the MPFB base body (left out for pack items)
  template.obj       the aligned garment mesh MakeClothes wrote with it
  meta.json          licence, source, layer and fitting rules (below)
  notes.md           what was done to it, and Joe's visual sign-off
```

`<category>` and `<template_id>` must match `meta.json`'s `category` and `id`.

## `meta.json`

| Field | Meaning |
| --- | --- |
| `id` | The template's name; the folder name. |
| `pack_file` | Optional. The name its files get in the build and the pack (`<name>_<pack_file>.glb`, `<name>_body_<pack_file>.glb`); default `id`. The shift dress keeps `dress`, which the app already loads. |
| `category` | The parent folder: for example `full`, `tops`, `outer`, `hair`, `shoes`. |
| `layer` | `base`, `mid`, `outer`, `bottom` or `full`. Templates are fitted in that order (base and bottom first, full last), so an outer layer can sit over the ones under it. |
| `allowed_bodies` | `female`, `male` or `both`. |
| `source` | `{"pack": "<pack>", "asset": "<asset>"}` for an item in the archived packs (`assets/packs/MANIFEST.md`), or `{"url": "<page>"}` for a mesh from elsewhere (then `source.obj` or `source.glb` is in the folder). |
| `licence` | `CC0` or `CC-BY`. Anything else is refused. The build also checks the pack's own licence for the item. |
| `credit` | Required for `CC-BY` (author, title, source); goes in `assets/packs/CREDITS.md`. `null` for `CC0`. |
| `sha256` | SHA-256 of the pack's `.mhclo` (pack items) or of `source.<obj|glb>`. The build refuses a file that does not match. |
| `delete_group` | `true`: hide the body under the garment with MPFB's delete group, restore what the cloth does not cover, and export `<name>_body_<pack_file>.glb` (the body the app draws while it is worn). |
| `settle` | `"none"` (fitted garments), or a short cloth pass: `{"pinned": [<base body vertex groups>], "frames": 60}`, optionally `quality`, `mass`, `tension`, `compression`, `shear`, `bending`, `gravity_ramp` (defaults are V3-00's skirt settings). The build then runs Blender on one thread, so two builds match. |
| `contact_groups` | Where the push-out may move the garment: base body vertex groups (a garment vertex belongs if its nearest body vertex does), or `["all"]`. |
| `clearance_cm` | How far off the body (and off each inner layer) the push-out keeps the garment. It only moves vertices that are inside or closer than this. |
| `replaces` | The layers the app takes off while this is worn (a dress replaces `base`, `mid` and `bottom`). |
| `inner_layers` | Garments it is fitted and checked over: legacy names (`tee`, `shirt_long`) or another template's `pack_file`. Each must be built earlier in the same session. |
| `approved` | `false` while the look is being tuned: the build renders it and reports its numbers but does not fail on them. `true` once Joe has signed off the renders; then `spike/check_reports.py` enforces them. |
| `colour` | `plain` (every garment) or `texture` (hair and shoes only). |
| `loose` | Optional, V3-07b; default `"none"` (fitted exactly as the `.mhclo` binds it). An object makes a top hang loose off the torso, on any body: below the armpit each garment vertex over the torso moves straight out from the torso's centre line to at least the torso's convex hull at that height (so no cups or tuck under the bust) plus ease, or to where the cloth hangs from a fuller height above (the bust, the belly). Keys, all optional: `ease_fraction` (ease as a fraction of the hull's perimeter at that height, default 0.06), `drape_taper` (how far the hanging cloth steps in per metre of drop, default 0.25), `fade_cm` (the move fades to nothing over this far below the armpit, so shoulders and sleeves stay as fitted, default 6), `smooth_iterations` (default 6), `hem_to_crotch_cm` (lower the hem so its lowest point is this far above the crotch, negative for below; the cloth below `hem_from_crotch_cm`, default 20, is stretched evenly so the hem keeps its shape; default `null`, hem unchanged). The report's `loose` entry gives the armpit and crotch heights it found, the largest move and the hem's lowest and highest points (`hem_z_cm`). |
| `inner_push` | Optional, V3-07b: how the garment is kept `clearance_cm` off its `inner_layers`. `shrinkwrap` (default): Blender's Shrinkwrap in 'Outside' mode. `body_normal`: from the nearest skin point straight out along the body's normal; a vertex moves only where that line meets the inner layer from inside within 5 cm, so the cloth is not dragged to an inner layer's open edge (a tee's short sleeve). |

Validation (`fit_template.validate_meta`, tested by `pack/test_fit_template.py`) fails with a clear message on a missing licence, a CC-BY item without a credit, an unknown layer or any other bad field.
