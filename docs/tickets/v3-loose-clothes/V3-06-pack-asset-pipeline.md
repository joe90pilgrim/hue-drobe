# V3-06 Pack asset pipeline and body-hiding check

**Status:** ready. Needed before V3-02 dresses and V5-01 shoes.

**Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. Extends the existing build and checks with pieces the spike already proved (MPFB's loader, the delete-group mask). A new check is easy to get subtly wrong, hence high effort.
**Depends on:** V2-07, V2-09

## Goal
Let the pack build bring in a pack item, fitted and plain-coloured, with the body hidden underneath it, and check it properly.

## Scope
- Load a pack item with MPFB's own loader (`HumanService.add_mhclo_asset`), bake it and export it as part of the avatar pack, in plain colour (texture dropped) unless the item is hair or shoes.
- Apply the item's delete group so the body under it is hidden in the exported body, for pack items only.
- **New check, "body as drawn":** with the hidden body parts removed, no visible body face may intersect the garment, and no gap may show the inside of the garment where the body is missing. Keep the existing strict check for the app's own garments.
- **Layering rule:** when a dress is worn, the app's top and trousers come off; switching back restores them.
- The checks run in `npm run check` on the synthetic bodies.

## Decisions needed from Joe
- None expected; the decisions were made in `docs/decisions/2026-11-16-v2-07-joe-decisions.md`.

If something comes up that needs a decision, stop and ask rather than guess.

## Acceptance criteria
- The spike's shift dress builds, hides the body under it and passes the new check on Beth and the female synthetic bodies.
- Deliberately disabling the body hiding makes the check fail.
- The app's own garments still pass the existing check.
