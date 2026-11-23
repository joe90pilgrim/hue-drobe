# Ticket: Send the wardrobe list to Gemini, with structured suggestions (V7-05)

## Summary
- **Status:** done 23 Nov 2026 (decisions approved by Joe at the start). Needs Joe to redeploy and try one live request.
- **Ceiling:** 2.5 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet · High. Server and app contract, validation, a privacy amendment and tests on both sides.
- **Depends on:** V6-01 (the Gemini packing template, done).

## Target Files
Read first: `docs/decisions/2026-11-23-v7-packing-and-icon-spec.md` (section 4) and `docs/decisions/2026-11-18-v4-data-off-device.md.md` (rules 3 and the 23 Nov amendment).

Edit:
- `deploy/packing.mjs`: accept `wardrobe: [{id, garment, name, colour}]` in `cleanRequest`; raise `MAX_BODY_BYTES` from 4096 to 32768 and add `MAX_WARDROBE = 150`; validate `id` (short string), `garment` (against a `GARMENT_IDS` list), `name` (trim, at most 40 characters) and `colour` (`#rrggbb`); `buildPrompt` lists the clothes as JSON, so a name can never be read as an instruction; `buildRequest` adds `colour`, `type` and `matches` (array of wardrobe ids) to each line in `responseSchema`; `parseAnswer` keeps only ids that were sent, a valid hex and a known type, and drops anything else quietly.
- `deploy/packing.test.mjs`: cases for the new fields, the size cap, an unknown id, a name that tries to give instructions, and an answer with a made-up id.
- `deploy/server.mjs`: only if the body cap is applied there (`handlePacking`, lines 257-281). Keep the route as it is.
- `app/src/packing-template.ts`: `buildTemplateRequest` adds the wardrobe list from `loadItems()` (id, garment, name, colour; never a photo or a measurement); `toLines` keeps the new fields.
- `app/src/trips.ts`: `TemplateLine` and the template entry gain optional `colour`, `type` and `matches`, and `cleanEntries` keeps them. Old trips load unchanged.
- `app/tests/packing-template.test.ts`, `app/tests/trips.test.ts`: tests for the above, and one that fails if the app's `GARMENT_IDS` and the server's list differ.
- `docs/decisions/2026-11-18-v4-data-off-device.md.md`: add an amendment, in the existing style: `*Amended 23 Nov 2026 (V7-05, Joe's decision):* …` The wardrobe list (id, garment type, name, colour) goes to Gemini for packing suggestions. Photos and measurements never do.

Do NOT touch:
- The Suggest sheet, the Suggested rows and the screen text (V7-06). The old privacy sentence on the page stays until then. This ticket must not ship alone to users with the old sentence still saying the wardrobe is not sent, so work on the V7 branch, or hold the deploy until V7-06 is done.
- `SYNC_KEYS` (`trips` is already synced; new optional fields inside it need no change), `deploy/deploy.mjs`, `pack/`, `spike/`.

## Scope
**Goal:** Gemini can see what you own, and answers with structured suggestions that the app can match to your clothes.

- Request body (extends V6-01): trip name and dates, season and palette as before, plus `wardrobe`.
- Answer lines: `{label, quantity?, group?, colour?, type?, matches?}`. `colour` is a hex for the suggested piece. `type` is one of the garment ids. `matches` lists wardrobe ids Gemini judges to fit that line.
- Keep V6-01's limits (60 lines, trip name 40 characters, 90 days). New limits: 150 wardrobe items, 32 KB body.
- No new dependency.

**Acceptance criteria:**
- `node --test deploy/packing.test.mjs` passes with the new cases.
- A request with 150 items and long names stays under the cap. A request over the cap is refused with the existing error shape.
- `parseAnswer` never returns an id that was not sent, a bad hex or an unknown type.
- Old trips and old answers (no new fields) still load and display.
- `npm run check` passes.
- The decision doc has the amendment.
- Joe redeploys with `node deploy/deploy.mjs` and tries one live request. Say so in the two-line note.

**Decisions needed from Joe:**
1. Data model. Recommendation: the new optional fields (`colour`, `type`, `matches`, and `label` and `quantity` kept on the entry) go inside the existing `trips` records. This changes the data model, so it is yours to approve.
2. Wardrobe size cap of 150 items and a 32 KB body. Recommendation: yes.
3. Ceiling and worker as proposed.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Execution Rules
- Read only the Target Files above first. Open other files only if one of them points you there.
- Run `npm run check`, `node --test deploy/packing.test.mjs` and the Playwright specs in a subagent, and bring back only the pass/fail list and any failing assertion, not the logs.
- Scripts must work in PowerShell as well as bash.
- No new dependency. If one seems needed, say why and stop.
- Stop at the ceiling, or after three failed attempts at the same problem, and report what was done, what's left and why.
- When done: commit, add a two-line note to this ticket saying what was done, and stop. Don't start the next ticket. Ideas go in `docs/tickets/backlog.md`.

## Note (23 Nov 2026)
Server and app now send the wardrobe list (id, garment, name, colour; up to 150 pieces, 32 KB) and keep `colour`, `type` and `matches` on trip template lines; `node --test deploy/packing.test.mjs`, the packing Playwright spec and the full `npm run check` pass, and the V4-00 decision has the amendment. One edit outside the target files: `app/src/screens/packing.ts` passes `loadItems()` to the request builder, so the old privacy sentence is now wrong until V7-06; do not deploy before then. Not yet tried against live Gemini: Joe redeploys with `node deploy/deploy.mjs` and tries one request.
