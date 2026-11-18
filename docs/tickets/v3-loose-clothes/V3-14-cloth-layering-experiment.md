# Ticket: Experiment: cloth, garment-side pins and inner-layer hiding for loose and layered templates (V3-14)

## Summary
- **Status:** ready. Created by Joe on 18 November 2026. V3-08 and V3-09 are paused until this reports, and no new garment types are started.
- **Ceiling:** 2 hours (hard stop). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Opus · High. A one-off experiment on the hardest open question; the answer decides how every loose and layered template is fitted.
- **Depends on:** V3-07 (done), V3-07c (done: `keep_islands`, used to take the jacket from a suit)

## Why this experiment
The template route (V3-07) works for fitted items: the shift dress is unchanged. Since then, loose and layered templates have gone back to custom geometry (V3-07b's `loose` inflate, torso bands and hull maths, and the height-pinned settle), and still failed: the shirt clings to female bodies, and the blazer's bust shreds on every female body over a tee or shirt (102 to 1,061 layer pairs). Joe's direction (18 Nov 2026): **fitted items use plain MHCLO; loose items use Blender's own cloth and collision; no scripted warping of meshes.** This experiment tests whether three standard techniques together are enough.

## Target Files
Create:
- `pack/experiments/v3-14/` with one script, `run.py`, and a `README.md`. The experiment lives here and is **not** wired into `build_pack.py`.
- The write-up: `docs/decisions/2026-11-18-v3-14-cloth-layering-experiment.md`.

Read first:
- `docs/decisions/2026-11-18-v3-07-fit-template.md`.
- The notes on V3-07b, V3-08 and V3-09 in `docs/tickets/v3-loose-clothes/`, and `pack/templates/mid/shirt_untucked_bd/notes.md` and `pack/templates/outer/blazer_suit3/notes.md` (the numbers to beat).
- `spike/blender/drape.py`: `settle_over` already sets up cloth with collision on the body and inner tops; reuse its approach.
- `pack/fit_template.py`: call its attach, body-hiding and check functions as they are.
- `spike/blender/mesh_checks.py` and `spike/blender/render_closeup.py`.

Do NOT touch:
- `pack/fit_template.py`, `pack/build_pack.py` and `pack/test_fit_template.py`: no new options, flags or meta fields in this ticket.
- `pack/templates/`: no template changes. Copy what you need into the experiment folder.
- The legacy garments, `spike/blender/garment.py` and `spike/tolerances.json`.
- `private/`, apart from writing renders under `private/renders/v3-14/`.

## Scope
**Goal:** find out whether a loose shirt and a blazer over a tee can look right on female and male bodies using only standard techniques, with no scripted reshaping of the garment.

**The three techniques, together:**
1. **Pin the garment, not the body.** Make a pin vertex group on the garment itself: collar, shoulder seams, and for the shirt the yoke. Choose it once on the template (by its own geometry, for example the top ring and the seam loops), not per body. Previous attempts pinned to body groups that don't exist where needed.
2. **Cloth with collision.** Blender's own cloth (settings as in V3-00 and `drape.py`: one thread, fixed frames), with the body and the inner garments as collision objects. Start from the MHCLO fit as it is (no `loose` inflate). Gravity and collision give the volume.
3. **Hide the covered inner layer.** Where the outer garment covers the tee or shirt, remove those inner-garment faces from what is drawn, as the body is already hidden under the dress. Only the inner garment's visible edges (neckline, cuffs, hem) need to stay clear of the outer one.

**Garments and bodies:**
- Shirt: `elvs_male_shirt_untucked_bd1` (as in V3-08), alone, and over the tee.
- Blazer: the Suits 01 jacket from V3-09 (female variant on female bodies), over the tee.
- Bodies, in this order: `synthetic_female_large` first; only if it works, `synthetic_female_medium`, B, Joe and `synthetic_medium`.
- If a female-cut variant of the shirt exists in the archived packs, try it on the female bodies as a fourth case, with the same three techniques.

**Rules:**
- Visual first: front, three-quarter and back renders each round with `render_closeup.py`. **At most three render rounds**, then stop and write up.
- No custom physics, no inflate, hull or band maths, and no per-body hand tuning. Cloth settings are shared across bodies.
- Report the numbers but don't force them: body as drawn (pairs and gap rays), layer pairs at the visible edges only, minimum clearance, build time per garment, and variation between two builds.

**Acceptance criteria:**
- The write-up recommends **go** (this becomes the standard way to fit loose and layered templates), **partial** (which parts work and which don't), or **no-go**, with the numbers above per garment and body, against the V3-08 and V3-09 numbers.
- Renders in `private/renders/v3-14/` (B and Joe) and `pack/out/renders/v3-14/` (synthetic bodies), named so each before and after pair sits together.
- A short list of what would change in `fit_template.py` if it's a go, and which V3-07b options it would replace. Write the list only; don't change the code.

**Decisions needed from Joe:**
- From the write-up: go, partial or no-go. If go, Joe decides whether V3-07b's `loose` and `pin_above_armpit_cm` options are removed or kept off.
- None needed to start.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds and renders in a subagent, and bring back only the results table and render paths, not the logs.
- One body first. Run builds one at a time, and keep the computer awake.
- Use the real Python, not the Microsoft Store `python` alias (see `pack/README.md`).
- Stop at the ceiling, after three render rounds, or after three failed attempts at the same problem, and write up what was found.
- **Don't create follow-up tickets.** Put any proposed follow-up in the write-up, and stop.
- When done: commit, add a two-line note to this ticket, and stop.

## Note (18 Nov 2026)
Partial, after three render rounds on synthetic_female_large only (it failed there, so no other bodies): hiding the covered tee takes the shirt-over-tee layer pairs from 376 to 0. Cloth with garment-side pins is clean on the body (0 pairs, 0 gap rays) and repeats exactly, but it keeps the MHCLO cling (cups), and the closed blazer's fronts swing open.
Write-up, numbers and the fit_template.py change list: `docs/decisions/2026-11-18-v3-14-cloth-layering-experiment.md`. Renders: `pack/out/renders/v3-14/`. Go, partial or no-go is Joe's decision.

## Closed (18 Nov 2026, Joe)
Result accepted as the way forward: rest-shape cloth (`--rest template`) and inner-layer hiding are folded into `pack/fit_template.py` by V3.1-01.
