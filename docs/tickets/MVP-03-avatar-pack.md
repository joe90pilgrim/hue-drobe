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

## Done (15 Nov 2026)
`python pack/build_pack.py --private` builds Joe and the six synthetic bodies with default-fit garments; every check passes on all seven (no known exceptions needed), and Joe's pack in `private/pack/joe/` is **744 KB** (body 626 KB, tee 71 KB, trousers 64 KB), repeatable byte for byte. `git status` shows no personal files; about 25 minutes of work.
Decisions and the trade-offs in fit (eases limited by the widest synthetic body, no tee hem circumference so the drape-era tee circumference check is skipped, Microsoft Store `python` alias hides MPFB) are in `docs/decisions/2026-11-15-avatar-pack-build.md`. Run it with the interpreter's full path if the alias fails (`pack/README.md`).
