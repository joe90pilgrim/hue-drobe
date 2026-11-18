# Ticket: Second template: a blazer from Suits 01 (V3-09)

## Summary
- **Status:** ready once V3-08 is done. Replaces the jacket part of V3-04.
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · High. The first outer layer: it must sit over the shirt and tee, which tests the push-out and layering of V3-07. If layering fails three times, stop: Joe decides whether to move up to Opus.
- **Depends on:** V3-07, V3-07a, V3-08

## Target Files
Create:
- `pack/templates/outer/<blazer_id>/meta.json` and `notes.md`.

Read:
- `pack/templates/README.md`, `assets/packs/MANIFEST.md`, the Suits 01 items (CC0).

Do NOT touch:
- `pack/fit_template.py` and `pack/author_template.py` (report pipeline problems instead).
- `spike/blender/`.
- `private/`, apart from the pack output folders.

## Scope
**Goal:** Joe and B can wear a blazer over a tee or a shirt.

- Suits 01 items are often a jacket and trousers together. Use the jacket only; if they're one mesh, report that rather than splitting it by hand.
- `layer: outer`, `inner_layers: [base, mid]`, with `contact_groups` at the shoulders and collar.
- Build over the tee, then over the shirt from V3-08, then over the sweatshirt.
- Plain colour. At most three render rounds.

**Acceptance criteria:**
- Renders front, three-quarter and back over each inner top, on Joe, B and the synthetic bodies.
- Report numbers for the blazer and for each layer pair.
- 30 fps or better on the Pixel 8 with tee, shirt, blazer and trousers on.
- **Joe's and B's visual sign-off.** Then set `approved: true` and make the checks pass.

**Decisions needed from Joe:**
- **Open or closed front?** Recommendation: whatever the chosen Suits 01 jacket is modelled as; don't remodel it.
- **Over the sweatshirt too, or only over the tee and shirt?** Recommendation: tee and shirt first.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Try changes on one body first (`python pack/build_pack.py --only synthetic_medium`, or a female body for women-only items). Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake.
- Use the real Python, not the Microsoft Store `python` alias (see `pack/README.md`).
- **Visual first, gates second:** while tuning a template, render with `spike/blender/render_closeup.py` and report the check numbers without trying to force them to pass. At most three render rounds, then stop and ask Joe.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.
