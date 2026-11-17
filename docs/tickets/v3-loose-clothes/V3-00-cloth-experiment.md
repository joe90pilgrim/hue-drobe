# V3-00 Experiment: loose clothes with cloth simulation

**Status:** done 17 November 2026, awaiting Joe's go/no-go. Skirt: A-line midi (Joe, 16 Nov). Write-up: `docs/decisions/2026-11-17-v3-00-cloth-skirt.md`.
**Ceiling:** 2 hours (hard stop). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Opus, high. The hardest technical question on the roadmap, and the area that used most of the spike's reworks. Worth the stronger model once, with a hard stop.
**Depends on:** V2-03, V2-07. Smaller since the asset spike: dresses now come from the pack (V3-02, V3-06), so this experiment covers skirts only.

## Goal
Find out whether Blender cloth simulation, run offline from the offset shell, can make a skirt that passes the checks on Joe, Beth and the synthetic bodies.

## Scope
- One skirt on Beth and two synthetic female bodies. The pack's long skirt failed on every body in V2-07 (103 to 577 body face pairs), so it is the baseline to beat.
- Simulation runs once on the computer; the result is saved as a fixed file and the checks run on that file. Run-to-run variation (2.3 cm in the spike) then only matters if a rebuild looks different, so record it.
- Record per garment: build time, hard mesh check results, variation between two builds, and renders front, side and back.
- No custom physics or material code; Blender's own cloth only.

## Decisions needed from Joe
- **Which skirt shape matters most to Beth?** For example A-line, midi, pencil, wrap. Pick one for the experiment.
- **Go/no-go:** Joe decides from the write-up whether version 3 goes ahead on this technique.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- A write-up in `docs/decisions/` with a recommendation and the numbers above, and renders for Joe and Beth to judge.
- Stop at the ceiling, whatever state the work is in.
