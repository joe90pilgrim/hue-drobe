# UI review decisions, 27 November 2026

Joe's decisions on the UI review ([`docs/designs/2026-11-27-ui-review/ui-review.md`](../designs/2026-11-27-ui-review/ui-review.md)). They are settled and were applied in V10-02. Finding IDs (T1, F7 and so on) are defined in that review, section B.

## The seven decisions in the review

1. **Touch targets are 44px on the laptop too.** This replaces the V1.2 brief's "40 px on a laptop" (B1). See F7.
2. **Phone page titles are 24px on every page.** This replaces the brief's 28px. See T1.
3. **Error text is ink with an icon.** `--danger` stays for Delete text only. See E1 and E3.
4. **The closet rail and shelf greys are interface,** so they become tokens (`--closet-rail`, `--closet-shelf`).
5. **Chips for lists that grow; a segmented control for fixed sets of two or three options.** Garment stays chips, Neckline stays segmented.
6. **Filter chips with nothing in them are hidden.** See L12.
7. **The duplicate "Blazer" chip is a bug.** See L13.

## The four decisions for V10-02

1. **"Nice" findings (T6, T7, S7, R3, C6, C7, P3, E7, L11): include them** as a sixth phase after the "should" findings, instead of the backlog. Anything not reached goes to `docs/tickets/backlog.md`.
2. **L13, the blazer chip:** one "Blazer" chip that maps to the signed-in person's template (`blazer_male` for Joe, `blazer_female` for B).
3. **L8, grab handles:** no sheet can be dragged closed (the handle was decorative, `aria-hidden`, and hidden on a laptop), so the handle is removed from every sheet.
4. **L7, closing sheets:** the × (44px, accessible name "Close") is in the header of every sheet that is a form or a panel (Back up, trip form, line form, Add from photo, Add to trip, Match, Review, Suggest). A footer secondary button stays only for a real choice: Cancel on forms and on the small delete or replace questions, Not now on Review. Suggest has no Cancel while it is asking or showing an error; its Cancel stays while the request is running.
