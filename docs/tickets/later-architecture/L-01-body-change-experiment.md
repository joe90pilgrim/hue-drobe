# L-01 Experiment: changing body dimensions in the app

**Status:** outline. Refine with Joe before starting.

**Ceiling:** 2 hours (hard stop). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Opus, high. An architecture question with real trade-offs; worth the stronger model once.
**Depends on:** V2

## Goal
Find the best way to let you change measurements (or pick a preset) in the app, given bodies and garments are built offline.

## Scope
- Compare: (a) a server on Google Cloud that runs the Blender build on request, (b) runtime blending between pre-built shapes (dropped after the spike), (c) keep building on the computer and just make it easier.
- Record cost, time per rebuild, accuracy and effort for each.

## Decisions needed from Joe
- **Go/no-go** and which option, from the write-up.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- A write-up in `docs/decisions/` with a recommendation.
