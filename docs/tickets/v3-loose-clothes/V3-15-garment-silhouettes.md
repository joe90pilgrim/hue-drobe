# Ticket: Garment silhouettes module (V3-15)

## Summary
- **Status:** done. Numbered in V3 because that is where the Wardrobe work began, although the README marks Version 3 closed: rename the ticket and folder if Joe wants it under a new version.
- **Ceiling:** 90 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · Medium. Drawing code plus a visual check, with up to three render rounds.
- **Depends on:** none. V3-16 and V3-17 depend on it.

## Target Files
Read first: `docs/decisions/2026-11-22-wardrobe-closet-redesign-spec.md` (the design, the id-to-shape table and the starting path data).

Add:
- `app/src/silhouettes.ts`: the shape table, a key function from (garment id, neckline) to a shape, and `silhouetteSvg(...)`, which returns an inline SVG string for a garment and a colour.
- `app/tests/silhouettes.test.ts`.

Read only (do not edit): `app/src/wardrobe.ts` for `GARMENTS`, `GarmentId` and `NECKLINES`.

Do NOT touch:
- `app/src/screens/`, `app/src/style.css` (V3-16 and V3-17 use the module).
- `pack/`, `spike/`, `deploy/`, `app/src/store.ts`, `app/src/sync.ts`.

## Scope
**Goal:** One drawn silhouette per garment, filled with the item's colour, ready for the Wardrobe cards and the detail panel. Nothing in the app calls it yet.

- Cover every `GarmentId` today: tee (crew, V-neck, scoop), sweatshirt, the three shirts, trousers, shorts, skirt, tights (sheer and opaque), dress. Start from the path data in the spec. The scoop neck is not drawn there: derive it from the tee.
- `silhouetteSvg` takes the garment id, optional neckline, optional sheer flag, a hex colour and a mode: `hang` (with hanger hook, for rails), `flat` (no hook, cropped to the shape's content box, for outfit cards) or `shelf` (for later hats and shoes).
- Edge, collar overlay and detail lines are worked out from the colour: very dark colours get a lighter edge so the shape still reads, and pale colours a darker one. Pale colours (white, cream, light grey) must stay visible on a light background.
- Unknown ids get a generic rounded shape, so nothing shows blank.
- Output is plain inline SVG: `aria-hidden="true"`, no `<title>`, `<desc>` or `<text>` (the e2e helpers find cards by their visible name text).
- No new dependency.

**Acceptance criteria:**
- Vitest: every `GarmentId` and every tee neckline has a shape, so adding a garment to `GARMENTS` fails the test until it gets one; the fallback works; the output carries the fill colour, `aria-hidden` and no text nodes; sheer tights are lighter than opaque.
- A contact sheet of every shape in three colours (a dark, a mid and a very pale one) in `hang` and `flat` modes, rendered to `private/silhouette-sheet.png` (git-ignored) for Joe, using a temporary script or spec that is not committed.
- `npm run check` passes.
- Joe's visual sign-off on the contact sheet. At most three render rounds, then stop and ask.

**Decisions needed from Joe:**
1. Are the mock-up drawings good enough as a base? They are mid-fidelity. If not, say what to change before the rounds start.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check` and any Playwright render in a subagent, and bring back only the pass/fail list and the image path, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.

## Note
Done: `app/src/silhouettes.ts` and its Vitest file added; `npm run check` passes. Joe signed off the contact sheet after round 1 of 3.
