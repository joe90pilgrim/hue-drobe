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
