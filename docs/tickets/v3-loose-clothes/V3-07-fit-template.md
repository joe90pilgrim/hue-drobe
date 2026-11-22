# Ticket: Generic template fitting: `pack/fit_template.py` (V3-07)

## Summary
- **Status:** ready. Approved by Joe on 17 November 2026 (`docs/decisions/2026-11-17-v3-garment-pipeline-proposal.md`). Replaces procedural geometry for every new garment type. Folds in V3-06.
- **Ceiling:** 3 hours (hard stop). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Opus · High. One-off architecture: a generic fitter that every later template depends on. Templates after this are data work on Sonnet.
- **Depends on:** V3-06 (done: `pack/pack_items.py`), V3-07a (archived packs for the test templates)

## Target Files
Read first:
- `docs/decisions/2026-11-17-v3-garment-pipeline-proposal.md`: the approved design (sections 1 and 2).
- `pack/pack_items.py` and `pack/pack_items.json`: V3-06's working pack-item path (MPFB loader, plain colour, delete group, `trim_body`, "body as drawn" check). **This is the starting point: generalise it, don't rewrite it.**
- `docs/decisions/2026-11-17-v3-06-pack-items-and-body-as-drawn.md`: why the dress needed a push-out and restored body parts.
- `pack/build_pack.py`: how pack items are unpacked (`prepare_items`, licence guard) and run in the same Blender session as the body.
- `spike/blender/mesh_checks.py` (`body_as_drawn`, clearance and pair checks) and `spike/tolerances.json` (`pack_item_body_as_drawn`).
- `spike/blender/render_closeup.py`: the close-up renders used for visual sign-off.
- `spike/cloth/skirt_cloth.py` and `docs/decisions/2026-11-17-v3-00-cloth-skirt.md`: the cloth settings that gave identical builds (for the optional settle step).

Create:
- `pack/fit_template.py`: the generic per-person fitter (Stage B below).
- `pack/author_template.py`: the one-off template authoring tool (Stage A below).
- `pack/templates/README.md`: the folder layout and the `meta.json` schema.
- `pack/templates/full/shift_dress/meta.json`: the existing shift dress moved to a template, as the regression test.
- `pack/test_fit_template.py`: unit tests for `meta.json` loading and validation (pure Python, no Blender).

Edit:
- `pack/build_pack.py`: run templates through `fit_template.py`; keep `pack_items.json` working until the dress is migrated, then point it at the template.
- `pack/README.md`: document the new path.

Do NOT touch:
- `spike/blender/garment.py` and the legacy garment code in `spike/blender/body_from_measurements.py` (tee, sweatshirt, trousers, shorts, tights, shirts, skirt). No new geometry code there.
- The strict checks for legacy garments in `spike/tolerances.json`.
- `private/`, apart from the pack output folders the build already writes to.
- `app/`: no app changes in this ticket.

## Scope
**Goal:** One generic fitter that takes any MHCLO garment template and fits it to any person's MPFB body, so adding a garment type becomes adding a folder, not writing geometry code.

**Folder and schema** (`pack/templates/<category>/<template_id>/`):
- `source.<obj|glb>` (raw download, untouched; omitted for pack items that are used straight from `assets/packs/`), `template.mhclo` and `template.obj` (MakeClothes output, or a pointer to the pack's own), `meta.json`, `notes.md`.
- `meta.json` fields: `id`, `category`, `layer` (`base`, `mid`, `outer`, `bottom`, `full`), `allowed_bodies` (`female`, `male`, `both`), `source` (`pack` + `asset`, or `url`), `licence` (`CC0` or `CC-BY`), `credit` (required for CC-BY), `sha256`, `delete_group` (true or false), `settle` (`none`, or cloth settings plus pinned vertex groups), `contact_groups` and `clearance_cm` (for the Shrinkwrap push-out), `replaces` (for example a dress replaces `base`, `mid` and `bottom`), `inner_layers` (which layers it must sit over), `approved` (false until Joe's visual sign-off) and `colour` (`plain`, or `texture` for hair and shoes only).
- Validation fails clearly on a missing licence, a CC-BY item without a credit, or an unknown layer.

**Stage A, `author_template.py` (once per template):**
1. Import and normalise: apply transforms, check the scale matches the MPFB base body (MakeClothes fails otherwise), recalculate normals, drop textures unless `colour` is `texture`.
2. Align to the MPFB reference body by landmarks (neck base, shoulders, chest or bust, waist, hips, crotch for bottoms), read from the body's joint groups as the spike's `joint_positions()` does. Fit in order: uniform scale and translation, per-axis widths, then a Lattice for shoulders and hips. Rotate T-pose sleeves down to the base body's rest pose.
3. Convert with MPFB's bundled MakeClothes to `template.mhclo`. **First check whether it runs headlessly;** if it doesn't, stop and report, with a recommendation (for example, a one-off authoring step in the Blender window).
4. Pack items that are already MHCLO (such as the shift dress, Suits 01 and Shirts 02/03) skip steps 1 to 3.

**Stage B, `fit_template.py` (per person, every build):**
1. Attach with `HumanService.add_mhclo_asset` to the body `body_from_measurements.py` built.
2. Settle (only when `settle` is set): a short Blender cloth pass with the `pinned` groups held, using the V3-00 settings (one thread, fixed frame count). Fitted garments skip this.
3. Push out without crushing the shape: a Shrinkwrap modifier in *Outside Surface* mode, offset `clearance_cm`, limited to `contact_groups`, targeting the body and, for outer layers, the inner garments named in `inner_layers`. Never use Shrinkwrap as the main fit.
4. Bake, export the GLB in plain colour, and apply the delete group and body restore exactly as `pack_items.py` does now.
5. Write the checks into the report: "body as drawn" for every template, plus layer pairs against each inner layer. **Report only while `approved` is false; enforced by `spike/check_reports.py` once it is true.**
6. Render front, three-quarter and back close-ups with `render_closeup.py` for every template that isn't approved yet.

**Acceptance criteria:**
- `pack/fit_template.py`, `pack/author_template.py`, `pack/templates/README.md` and `pack/test_fit_template.py` exist; the unit tests pass.
- The shift dress, moved to `pack/templates/full/shift_dress/`, builds through `fit_template.py` with the same results as before (0 face pairs and 0 gap rays on B and the three synthetic women), and `--no-hide` still fails the check.
- Legacy garments and their checks are unchanged: `npm run check` passes.
- A template with `approved: false` produces renders and report numbers but doesn't fail the build; with `approved: true` it is enforced.
- A short decision record in `docs/decisions/` says what was built, whether MakeClothes runs headlessly, and any deviation from the design.

**Decisions needed from Joe:**
- None expected; the design was approved on 17 November 2026. If MakeClothes can't run headlessly, Joe decides how templates from outside the packs get authored (see Stage A step 3).

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Try changes on one body first (`python pack/build_pack.py --only synthetic_medium`, or a female body for women-only items). Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake.
- Use the real Python, not the Microsoft Store `python` alias (see `pack/README.md`).
- **Visual first, gates second:** while tuning a template, render with `spike/blender/render_closeup.py` and report the check numbers without trying to force them to pass. At most three render rounds, then stop and ask Joe.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.

**Done (18 Nov 2026):** `fit_template.py`, `author_template.py`, the templates folder and tests are built; the shift dress builds as a template with 0 pairs and 0 gap rays on the three synthetic women and B, `--no-hide` still fails, and `approved: false` reports and renders without failing. MakeClothes runs headlessly; deviations (V3-06's push kept for the body, no Lattice or T-pose step yet) are in `docs/decisions/2026-11-18-v3-07-fit-template.md`.
