# V2-03 MVP garments on Beth

**Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. The spike found weak spots on the large female body (tee through trousers, waist fit). Default fits may avoid them; if three fixes fail, move to Opus rather than retrying.
**Depends on:** V2-02

## Goal
The tee (all necklines), sweatshirt, trousers and shorts fit Beth.

## Scope
- Run the existing garments through Beth's body; fix what fails the hard mesh checks.
- Check the tee shape over the bust: the offset shell may need more room there so it doesn't follow the body too closely.
- Re-run the checks on Joe and the synthetic bodies to make sure nothing regressed.

## Decisions needed from Joe
- Should Beth's tee and trousers be the same cut as Joe's, or women's cuts (for example a more fitted tee)? Recommendation: same templates first; women's cuts as a later ticket if wanted.
- **Fit per person or one fit for everyone?** The MVP uses one set of ease values, the largest that pass on all seven bodies, so it is limited by the widest body (from the MVP backlog). Fitting each person separately gives looser, better-fitting garments but changes the data model. Recommendation: per person, decided here because Beth is the first real second body.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- Every garment passes the hard mesh checks on Beth, Joe and the synthetic bodies.
- Beth's visual sign-off: no body showing through, front, side and back.
