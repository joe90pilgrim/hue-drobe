# Ticket: Shirts: long, mid and short sleeves (V3-03)

## Summary
- **Status:** ready. Independent of the cloth work: shirts are close-fitting, so they use the app's own offset-shell method, like the tee.
- **Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · High. A new collar and button placket on the existing tee template. If the collar fails three times, stop: Joe decides whether to move up to Opus.
- **Depends on:** V1.1-04 (necklines), V3-05 if shirts are to be worn under other tops

## Target Files
Edit:
- `spike/blender/garment.py` (or its successor in the pack build): a shirt template built from the tee, with a collar and a front placket.
- The pack build config: shirt eases and sleeve lengths.
- The app's clothes menu, colour picker and saved items.

Paths outside `spike/` and `docs/` (the pack build and the app) were not visible when this ticket was written; confirm them before editing.

Do NOT touch:
- `spike/cloth/`: shirts don't use cloth simulation.
- `private/`, apart from the pack output folder.

## Scope
**Goal:** Joe and Beth can wear a collared shirt in three sleeve lengths.

**Scope:**
- Shirt template from the tee, with a collar and a button placket drawn as shape (no buttons modelled as separate parts).
- Sleeves: long, mid (elbow) and short.
- Untucked over trousers, shorts and the skirt (following V3-01b's rule for the skirt).
- Plain colour.

**Acceptance criteria:**
- Passes the hard mesh checks on Joe, Beth and the synthetic bodies in all three sleeve lengths.
- Joe's and Beth's visual sign-off: it reads as a shirt, not a tee with a collar.

**Decisions needed from Joe:**
- **Collar style?** Recommendation: a classic point collar first.
- **Tucked in, out or both?** Recommendation: untucked first; tucked follows V3-05's rules.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run Blender builds, checks and tests in a subagent, and bring back only the results table and render paths, not the logs.
- Run builds one at a time or with `--jobs` no higher than 3, and keep the computer awake: in the experiment, parallel builds stalled while it slept.
- Use the real Python, not the Microsoft Store `python` alias.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket.

## Result (17 Nov 2026)
Built: point collar and raised placket on the tee shell, three sleeve lengths, in the pack and the Top slot; all hard checks pass on Joe, B and the six synthetic bodies. Not signed off: in close-up the collar and placket are faint and may not read as a shirt, so the visual criterion is open. See `docs/decisions/2026-11-17-v3-03-shirts.md`.

Second pass (17 Nov 2026, Opus): the shirt no longer shades B's nipples, ribs and navel (5 cm shading normals; a new shading check, max 22 degrees, measured 12 to 19). The collar and placket now read in the app: collar lip, sharp folds, drawn COLOR_0 shading, a placket cut with straight edges. All hard checks pass on Joe, B and the six synthetic bodies. Visual sign-off by Joe and Beth still to come.
