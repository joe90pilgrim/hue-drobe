# Ticket: Loose-fit volume for templates: hem and room over the bust (V3-07b)

## Summary
- **Status:** ready. V3-08 is paused until this is done; then V3-08 is re-run on male and female bodies.
- **Ceiling:** 3 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Opus · High. This changes the pipeline (`pack/fit_template.py`), which V3-08 may not touch.
- **Depends on:** V3-07, V3-08 (the evidence)

## Problem
`pack/fit_template.py` fits a template exactly as its `.mhclo` binds it to the base body, then pushes it 0.2 cm off the skin. A garment made for a man's loose shirt therefore clings once the body is female or heavier: V3-08's `shirt_untucked_bd` (`pack/templates/mid/shirt_untucked_bd/`, `approved: false`) shows the bust as two cups and the belly outline on B and the female bodies, the hem is 3 to 5 cm short and curved, and it has 5 to 29 face pairs against the body (the procedural shirt has 0). On Joe and the male bodies it is fine.
`settle` (cloth pass) cannot fix it: it only moves cloth that starts skin-tight, and the MPFB base body has no vertex group for the neck or shoulders to pin on (the `joint-*` groups are 8-vertex cubes inside the body, so no garment vertex has one as its nearest body vertex). A bigger `clearance_cm` only moves the shirt out evenly.
Over the tee (`inner_layers: ["tee"]`) the push-off also tears the sleeves at the upper arm (21 cm largest push, 1854 pairs), because it chases the tee's short sleeve edge.

## Target Files
Edit:
- `pack/fit_template.py` and `pack/test_fit_template.py`: the new fitting step and meta fields.
- `pack/templates/README.md`: document them.
- `pack/templates/mid/shirt_untucked_bd/meta.json` only to turn the new fields on (V3-08 owns its look).

Read:
- `docs/tickets/v3-loose-clothes/V3-08-shirt-template.md` and `pack/templates/mid/shirt_untucked_bd/notes.md` (numbers per body), `docs/decisions/2026-11-17-v3-garment-pipeline-proposal.md`, `spike/tolerances.json` (`pack_item_body_as_drawn`, the layer limits).

Do NOT touch:
- The legacy offset garments and `spike/blender/garment.py` (CLAUDE.md), and `pack/templates/full/shift_dress/`, which is approved and must stay byte-for-byte the same in its numbers (the regression test).

## Scope
**Goal:** a template can be fitted loose: standing off the torso with room over the bust and belly and a hem that hangs below them, on any body, and no tearing over an inner layer. No custom physics (Blender's own cloth and modifiers only).

Ideas, not a prescription (Opus to choose, after measuring on `synthetic_female_large` first, then the medium bodies, B and Joe):
- A per-template inflate: move garment vertices outward from the body along the normal or from the torso centre line, by an amount that grows over the bust and waist (ease as a fraction of the body's own circumference at that height, from `fit_config.json` style numbers), smoothed so it does not read as a balloon, with the hem and cuffs kept.
- A hem-length option (to a body landmark such as crotch or hip), or relaxing the hem by dropping the lowest vertex rows.
- A pin-by-height or by-region option for `settle`, so a cloth pass can let the inflated shell drape from the shoulders. Only if the inflate alone does not look right.
- For inner layers: fit the shirt against the inner garment's torso only (a contact region), so the sleeve edge of a short tee no longer drags the cloth.
- Any new meta field is validated in `validate_meta`, defaults to "off", and is tested.

**Acceptance criteria:**
- `shirt_untucked_bd` on synthetic female large, medium, small, B and Joe: no visible cups or belly outline, a hem at least as low as the procedural `shirt_long` hem, side-by-side renders (front, three-quarter, back) in `private/` and `pack/out/renders/`. Report the numbers: face pairs against the body, gap rays, clearance, hem height, against the procedural shirt.
- The same shirt still looks right on the male bodies (renders and numbers), and the shift dress's report is unchanged.
- With `inner_layers: ["tee"]` the sleeves are not torn and the layer check numbers are reported (they need not pass until Joe approves the look).
- Unit tests for the new fields; `npm run check` passes.
- Everything stays report-only for the shirt (`approved: false`): Joe signs off the look in V3-08.

**Decisions needed from Joe:** none to start. If the best look needs a tolerance change (for example allowing a few face pairs for a loose cloth against the body), stop and ask.

## Execution Rules
- Visual first, numbers second: at most three render rounds per approach, then stop and ask Joe.
- Run Blender builds in a subagent and bring back only the numbers and render paths. Try one body first (`python pack/build_pack.py --only synthetic_female_large`), with the real Python (see `pack/README.md`).
- Three failed attempts at the same problem, or the ceiling: stop, write down what was done and what is left, and ask Joe.
- When done: commit, add a two-line note here, and stop. Then V3-08 resumes (Sonnet): rebuild, re-render, ask Joe to choose which shirt wins.
