# Ticket: Pack asset pipeline and body-hiding check (V3-06)

## Summary
- **Status:** ready. Needed before V3-02 dresses and V5-01 shoes.
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · High. Extends the build and checks with pieces V2-07 proved; a new check is easy to get subtly wrong.
- **Depends on:** V2-07, V2-09

## Target Files
Read first:
- `spike/assets/README.md` and `spike/assets/fit_pack_items.py`: how V2-07 loaded items with MPFB's `HumanService.add_mhclo_asset` and applied the delete-group mask.
- `spike/blender/mesh_checks.py` and `spike/tolerances.json`.
- `assets/packs/MANIFEST.md` (from V2-09): which archived packs to load from.

Edit:
- The pack build: load a pack item, bake and export it in plain colour (texture kept only for hair and shoes), and hide the body under it.
- The checks: add the "body as drawn" check for pack items.
- The app's layering code: a dress takes off the top and bottom.

Paths outside `spike/` and `docs/` (the pack build and the app) were not visible when this ticket was written; confirm them before editing.

Do NOT touch:
- The existing strict check for the app's own garments.
- `spike/assets/` (spike history) and `private/`, apart from the pack output folder.

## Scope
**Goal:** The pack build can bring in a pack item, fitted and plain-coloured, with the body hidden under it, and check it properly.

**Scope:**
- Load from the archived packs (V2-09), not from the internet.
- Hide the body under pack items only; the app's own garments keep the existing check.
- **"Body as drawn" check:** with the hidden parts removed, no visible body face intersects the garment, and no gap shows the inside of the garment where the body is missing.
- Runs in `npm run check` on the synthetic bodies.

**Acceptance criteria:**
- The shift dress builds, hides the body and passes the new check on Beth and the female synthetic bodies.
- Turning the body hiding off makes the check fail.
- The app's own garments still pass the existing check.

**Decisions needed from Joe:**
- None expected; decided in `docs/decisions/2026-11-16-v2-07-joe-decisions.md`.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake: in the experiment, parallel builds stalled while it slept.
- Use the real Python, not the Microsoft Store `python` alias.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.

## Done (17 Nov 2026)
Shift dress builds, hides the body and passes the new "body as drawn" check on B and the three synthetic women (0 face pairs, 0 gap rays); `--no-hide` fails it; `npm run check` passes (the offline timing test failed once under load and passed alone). The dress needed fitting (push out of the skin, restore uncovered body) as well as the pack's delete group, and hiding off alone no longer fails on every body: see `docs/decisions/2026-11-17-v3-06-pack-items-and-body-as-drawn.md`.
