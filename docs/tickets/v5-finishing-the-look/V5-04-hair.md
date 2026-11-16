# V5-04 Hair styles

**Status:** ready when version 5 starts. Rewritten after the asset-pack spike: hair comes from the free CC0 packs, and it looked the best of everything tested.

**Ceiling:** 1.5 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, medium. The styles already sit well; the work is a hair-specific check and wiring it into the app.
**Depends on:** V5-05

## Goal
Joe and Beth can choose a hair style and colour.

## Scope
- The spike's styles first: short messy (Joe) and blunt bob (Beth), from Hair 01 (CC0), texture shrunk (V5-05).
- **Hair check:** hair is many separate strand cards sitting on the scalp, so the body clipping check doesn't apply. Instead: hair must stay clear of the eyes, face and ears.
- A hair colour picker, tinting the texture.
- Chosen style and colour saved per person.

## Decisions needed from Joe
- **Which styles?** Recommendation: two or three per person from Hair 01 (CC0) first; Hair 02 and 03 (CC-BY) hold more, with a credit.
- **Hair colour:** chosen freely, or suggested from the colour quiz result? Recommendation: chosen freely, with the quiz's hair answer as the starting value.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- Each style passes the hair check on its bodies.
- Joe's and Beth's visual sign-off on their own styles.
- The pack stays under 15 MB.
