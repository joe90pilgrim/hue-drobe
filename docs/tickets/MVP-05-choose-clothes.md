# MVP-05 Choose clothes

**Ceiling:** 1 hour, the most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, low. Simple switching and saving; the hard part (no body showing through) comes from the assets, not this code.

## Goal
Joe clicks through the pre-defined clothes on his avatar.

## Scope
- Top: t-shirt, sweatshirt (once MVP-07 is done) or none.
- Bottom: trousers or none.
- Switching is instant, with no reload.
- The current outfit is remembered between visits (IndexedDB).

## Acceptance criteria
- Every combination shows correctly.
- **Joe's visual sign-off:** no body showing through the cloth, viewed front, side and back.
- The end-to-end test switches between at least two outfits.

## Done (15 Nov 2026)
Top (T-shirt/None) and Bottom (Trousers/None) switch instantly by toggling garment visibility, with the outfit saved in IndexedDB. Layer stays disabled until MVP-07. `npm run check` passes, with a new e2e test that switches outfit and reloads. About 10 minutes of work.
**Awaiting Joe's visual sign-off** (no body showing through, front, side and back, all four combinations).
