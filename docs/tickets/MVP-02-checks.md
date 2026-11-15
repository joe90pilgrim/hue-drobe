# MVP-02 Checks command

**Ceiling:** 1 hour, the most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, medium. Mostly wiring existing checks together; Playwright on Windows can be fiddly, which is where Haiku would need reworks.

## Goal
One command that tells us the app still works, cheap enough to run before every commit.

## Scope
- `npm run check` runs: type check, unit tests (Vitest), the spike's asset checks on the committed synthetic bodies, and one end-to-end test (Playwright, phone-sized screen) that opens the app and moves between the two screens.
- Tolerances are read from one config file (move `spike/tolerances.json` or reference it).
- Extend the end-to-end test as later tickets add features.

## Acceptance criteria
- `npm run check` passes on a clean clone without the `private/` folder.
- A deliberately broken tolerance makes it fail.

## Done (15 Nov 2026)
`npm run check` (repo root or `app/`) runs type check, Vitest (4 tests), `spike/check_reports.py` on six synthetic reports now committed in `spike/fixtures/reports/`, and one Playwright test at 412 x 915. Passes on a clean clone with no `private/` folder (about 25 seconds); a broken tolerance makes it exit 1. Tolerances stay in `spike/tolerances.json`.
Three known spike misses (two B4 trouser calibrations, one 0.01 cm shoulder gap) are listed in `spike/known_exceptions.json` and print as KNOWN; Joe chose this over loosening tolerances. The checks read committed reports, so they do not rebuild bodies (that needs Blender). New dev dependencies: Vitest 2.1.8 (MIT), @playwright/test 1.49.1 (Apache-2.0), @types/node.
