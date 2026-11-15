# MVP-03 Avatar pack build

**Ceiling:** 1 hour, the most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. Repackages spike code that already works into one command. High effort because a mistake here quietly breaks every later ticket.

## Goal
One command that builds Joe's avatar and his MVP garments, ready for the app.

## Scope
- `python build_pack.py --private` builds Joe's body, tee and trousers (sweatshirt added in MVP-07) from `private/` measurements, into a git-ignored folder the app reads.
- **Garments use a default fit per garment type**, not real-item flat measurements: regular-fit tee, regular-fit trousers. Record the ease values in one config file.
- The garments are built in a neutral colour; the app sets the colour (MVP-06).
- The spike's checks run as part of the build and fail it on a missed tolerance.
- Without `--private`, it builds the synthetic bodies only, for the checks.

## Acceptance criteria
- The command runs cleanly and every check passes for Joe and the six synthetic bodies.
- `git status` shows no personal files after a build.
- Total pack size for Joe is recorded in this ticket.
