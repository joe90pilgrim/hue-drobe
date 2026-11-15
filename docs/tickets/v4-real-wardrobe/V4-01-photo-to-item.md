# V4-01 Photo to nearest item

**Status:** outline. Refine with Joe before starting.

**Ceiling:** Set when refined.
**Worker:** Sonnet, high (tentative). Combines image handling with matching to the template library.
**Depends on:** V4-00, V3 garments

## Goal
Upload a photo of a garment; the app suggests the nearest template and extracts its colour, and you confirm or correct both before saving.

## Scope
- Background removal and colour extraction (can run on the device).
- Template suggestion (on the device or via Gemini, per V4-00).
- Always shows the suggestion for you to confirm or correct.

## Decisions needed from Joe
- On the device only, or via Gemini? Depends on V4-00.
- Is the photo kept with the saved item (the blueprint said yes, so colour can be re-extracted later)?

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- Matches the right template for most items in a test set of your own clothes (target to agree).
- Extracted colour within an agreed colour-difference limit (the blueprint's delta E target).
