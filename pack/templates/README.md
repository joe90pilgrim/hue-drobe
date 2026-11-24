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
| `settle` | `"none"` (fitted garments), or Blender cloth from the MHCLO fit (V3.1-01, from the V3-14 experiment): `{"pin": {}}` at least. `pin` (pins on the garment itself, chosen on the template's own `.obj`, so the same vertices on every body): `front_cm` (default 3.5) and `back_cm` (default 8; 1.5 is a line along the collar and shoulder seam) of cloth below the top of the front and back across the shoulders, and `cuffs_cm` (default `null`; the cloth within this of the two sleeve openings). `rest`: `"fitted"` (default; the cloth keeps the fit's lengths) or `"template"` (its rest shape goes from the fit to the template as made over `morph_frames`, default 20, by Blender's dynamic base mesh, so it relaxes towards its designed shape). `collide_with`: other built garments it collides with besides the body and its `inner_layers` (e.g. `["trousers"]`); `grow_from_skin`: those of them whose collider grows out from the skin (inner layers always do). Optional cloth values: `frames` (60), `quality` (10), `mass` (0.15), `tension` (15), `compression` (15), `shear` (5), `bending` (0.3). Small pieces (buttons, pockets) follow the cloth by Surface Deform. The build then runs Blender on one thread, so two builds match. The report's `settle` entry gives the pins, colliders and how far the cloth moved. |
| `contact_groups` | Where the push-out may move the garment: base body vertex groups (a garment vertex belongs if its nearest body vertex does), or `["all"]`. |
| `clearance_cm` | How far off the body (and off each inner layer) the push-out keeps the garment. It only moves vertices that are inside or closer than this. |
| `replaces` | The layers the app takes off while this is worn (a dress replaces `base`, `mid` and `bottom`). |
| `inner_layers` | Garments it is worn over: legacy names (`tee`, `shirt_long`) or another template's `pack_file`. Each must be built earlier in the same session. They are cloth colliders when `settle` is set, and the layer check runs against each. |
| `approved` | `false` while the look is being tuned: the build renders it and reports its numbers but does not fail on them. `true` once Joe has signed off the renders; then `spike/check_reports.py` enforces them. |
| `colour` | `plain` (every garment) or `texture` (hair and shoes only). |
| `hide_inner` | Optional, V3.1-01; default `true` for a `mid` or `outer` layer with `inner_layers`, else `false`. The faces of each inner layer the garment covers (a ray from 3 cm under each face, out along its normal, meets the garment) are removed, as the body is under the dress, and the rest is exported as `<name>_<inner>_under_<pack_file>.glb`, which the app draws in place of the inner layer while the garment is worn (listed in the pack's `manifest.json` under `inner_layers_drawn`). The layer check then runs against the inner layer as drawn; the report's `inner_hidden` gives the faces hidden and `info_body_and_inner_as_drawn` the body and inner layer's gap rays together (information). Nothing is pushed off an inner layer. |
| `hide_all` | Optional; a list of `inner_layers` names, needs `hide_inner`. Every face of those inner layers is hidden: the exported `<name>_<inner>_under_<pack_file>.glb` has no faces, so the app draws nothing of that layer while the item is worn. Used by the blazers, so no sliver of tee shows at the neckline (the tee's coarse triangles gave a sawtooth edge at any margin). |
| `hide_overlap_cm` | Optional; `{inner layer: cm}` (above 0, at most 5), needs `hide_inner`. Covered faces within that surface distance of an uncovered face are kept, so the inner layer runs under the item's edge and the body does not show through a gap (the blazer's hem over the trousers). It can bring back layer pairs with the item (Joe's blazer: 20 at 2 cm, so only the female blazer uses it). A layer cannot be in both `hide_all` and `hide_overlap_cm`. |
| `skip_clearance_min` | Optional; a list of `inner_layers` names. The layer check's inside-clearance minimum (`tolerances.json` `layers.inner_clearance_cm_min`: every inner vertex within 5 cm of the item must lie inside it) is not held for those layers, because part of that layer is meant to show beside or below the item (trousers below a blazer's hem; the minimum was written for a tee under a sweatshirt). The face-pair limit (0) still applies. The report carries `clearance_min_skipped` and the check prints that it was skipped. Only the blazers use it. |
| `keep_islands` | Optional, V3-07c; default `null` (the whole pack item). A list of island indices (separately connected pieces of the item's mesh, numbered largest first as `python pack/list_islands.py <pack> <asset>` prints them) to keep: the rest are deleted from the attached garment before anything else, so they take no part in the settle, push-out, checks or export. Only whole islands are deleted; the `.mhclo` on disk is untouched. Used for pack items that are several garments in one file, such as a Suits 01 jacket without its trousers. |
| `keep_islands_vertices` | Required with `keep_islands`: the kept islands' vertex count in all, from `list_islands.py`. Island numbers are brittle if a pack is re-archived (two islands of equal size can swap, an edit changes sizes), so the build refuses a template whose kept islands no longer add up to this count, and asks for the listing to be checked again. |

With `keep_islands` and `delete_group: true`, MPFB still hides the body under everything the `.mhclo` lists in `delete_verts` (for a
suit, the legs too). That needs no special case: the build already gives back every body vertex that the fitted cloth does not cover
along its normal, and after the deletion the cloth is only the kept islands, so the legs come back and the hidden area is restricted to
the kept islands. The report's `body_vertices_restored_where_cloth_does_not_cover` shows how much came back, and the "body as drawn" check
still holds the result. The report's `keep_islands` entry gives the kept indices, the islands in the source, and the vertices kept and
removed.

Validation (`fit_template.validate_meta`, tested by `pack/test_fit_template.py`) fails with a clear message on a missing licence, a CC-BY item without a credit, an unknown layer or any other bad field.

Removed in V3.1-01 (no scripted reshaping of garments, CLAUDE.md): `loose`, `inner_push`, and `settle.pinned`,
`pin_above_armpit_cm`, `pin_small_pieces` and `gravity_ramp`. `validate_meta` refuses them by name. The V3-09 blazer templates were retired.
