# Ticket: Gemini packing-list template

*Replaces V6-01 (Ask Gemini for advice) and V6-02 (Suggested packing list), merged on 23 Nov 2026.*

## Summary
- **Status:** built 23 Nov 2026 on branch `feat/V6-01-gemini-packing-template`; decisions answered (see the note at the end).
- **Ceiling:** 3 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
- **Worker:** Sonnet, high. Multi-file: a new Cloud Run route, a client module, a change to the trips model and the Packing screen. Copies the V4-01 Gemini pattern, so no architecture work.
- **Depends on:** V4-01 (Gemini route, built), V4-03 (built), V4-04 (outfit pieces in the packing list, must be merged first).

## Target Files
Read and edit only these first.

Server:
- `deploy/identify.mjs` (read only: the pattern to copy for the Gemini call, schema, timeout and error handling)
- `deploy/packing.mjs` (new: builds the request, calls Gemini, validates the answer)
- `deploy/packing.test.mjs` (new: copy the shape of `deploy/identify.test.mjs`)
- `deploy/server.mjs` (add the route, guarded like `/api/identify`: IAP person, same-origin, JSON, body-size cap, 404 when no key)
- `deploy/README.md` (a short section for the new route)

App:
- `app/src/packing-template.ts` (new: client fetch, modelled on `app/src/identify.ts`)
- `app/src/trips.ts` (a new `template` entry kind: a line of text with a packed tick; `cleanEntries` must accept it)
- `app/src/screens/packing.ts` (the "Make me a template" button, the loading and error states, template rows, the existing picker for adding wardrobe items on top)
- `app/src/quiz/quiz.ts` (read only: `scoreQuiz`, `Season.palette`)
- `app/src/screens/quiz.ts` (only to export `isComplete`, which is local today)
- `app/tests/trips.test.ts` (template entries)
- `app/tests/packing-template.test.ts` (new: request building, palette only sent when the quiz is complete)
- `app/e2e/packing.spec.ts` (one test with the route mocked)

Do NOT touch:
- `deploy/datastore.mjs` and `app/src/backup.ts`. No new sync key; templates live inside the existing `trips` key, so there is no change to sync.
- `deploy/identify.mjs`. Copy its pattern; don't change it.
- `deploy/out/` (generated) and `private/` (keys and users).

## Scope
**Goal.** On the Packing tab, ask Gemini to make a packing-list template from the trip name, the dates and your colour palette, if you have done the colour quiz. You then add clothes from your wardrobe on top of the template.

**What is built**
- A button on a trip: "Make me a template". It sends the trip name, the start and end dates (and so the length), and, only if the quiz is complete, the season name and its palette as hex colours. Nothing else leaves the phone. No photos, no measurements, no wardrobe contents.
- A Cloud Run route holds the Gemini key; the phone never does. It uses the same model, key and rules as `/api/identify`.
- Gemini returns a short structured list of lines (label, optional quantity, optional group such as "Tops" or "Weather"). The server validates and trims it before returning it.
- The lines are saved on the trip as `template` entries, each with its own tick. They are plain text, not wardrobe items.
- The existing picker still adds saved items and outfits on top (with V4-04, outfits add their garments). Template lines can be edited, deleted and ticked.
- The palette is used to steer suggestions (for example, colours that work together for the trip), not to restrict them.

**Out of scope:** weather forecasts (there is no destination), a free-form advice chat, matching template lines to wardrobe items, the Beth/Joe comparison. If a general "ask for style advice" feature is still wanted, it needs its own ticket from Joe.

**Acceptance criteria**
- With the key set, the button returns a template for a trip name and dates and shows it as ticked-off-able rows; it survives a restart and syncs.
- With the quiz complete, the request includes the season and palette; with it not done, the request has neither, and the screen still works.
- With no key, a 404 or a Gemini error, the screen shows a plain message and the trip is unchanged.
- The template can be edited and deleted line by line, and wardrobe items and outfits can be added on top.
- The server route rejects: no IAP person, a cross-site request, a non-JSON body, an oversized body, and an unsafe or malformed model answer (tests in `deploy/packing.test.mjs`).
- Error logs contain no trip name, dates or model output, as in `identify.mjs`.
- A trip with template entries is still cleaned correctly by `cleanTrips`, and trips without them are unchanged.
- The deployment steps are in `deploy/README.md`. The server needs redeploying; say so in the ticket note.
- Full `npm run check` passes.

## Decisions needed from Joe
If a decision isn't made when this ticket starts, stop and ask rather than guess.
1. **What may leave the phone.** `docs/decisions/2026-11-18-v4-data-off-device.md.md` allows garments and seasonal colour palettes for V6. A trip name and dates are not mentioned, and a trip name is free text that could hold a place or a person. Approve a one-line amendment: "trip name, trip dates, season name and palette may be sent for packing templates"? *Recommended: yes, with a note in the screen that the trip name is sent to Gemini.*
2. **Monthly spending cap** on the Gemini API (carried over from V6-01). A figure, or none while it is just the two of you?
3. **Destination.** V4-03 decided a trip has a name and dates only. Keep it that way, so the template is based on the name (for example "Lisbon, 4 days")? *Recommended: yes, no destination field.*
4. **Re-running.** If you press the button again, replace the template lines, or add to them? *Recommended: replace the template lines only; never touch garments you added.*
5. **Linking template lines to garments.** Out of scope here, as above. Confirm that is fine.

## Execution Rules
- **No broad repo search:** start directly with the files listed under Target Files.
- **Subagents for heavy output:** if you need to search outside Target Files, inspect large files, or run full test suites or builds, delegate that to a subagent and return only a 5-line summary.
- **Git:** follow the Git section of `CLAUDE.md`. V4-04 must be merged first; branch from an up-to-date `origin/master`, never from another feature branch. Never push or open a pull request unless Joe asks.
- **Key and privacy:** the Gemini key is in `private/gemini-key.txt`; never print it or commit it. Add no analytics and send nothing beyond what decision 1 allows.
- **Done check:** run `npm --prefix app run typecheck`, `npx vitest related` on the changed files, the server tests for `deploy/packing.test.mjs`, and `npx playwright test e2e/packing.spec.ts`. Run the full `npm run check` once before the final commit, with nothing else loading the machine. Then add a two-line note to this ticket and stop. Ideas go in `docs/tickets/backlog.md`.

## Note (23 Nov 2026)
Built: `POST /api/packing-template` (`deploy/packing.mjs`) and a "Make me a template" button on a trip, with template lines you can tick, edit and remove. Joe's decisions: trip name, dates, season and palette may be sent (V4-00 amended, note on the screen); no spending cap for now; no destination field and no linking of lines to garments; a re-run replaces only the template lines.
**The server needs redeploying** (`node deploy/deploy.mjs`, which now also copies `packing.mjs`); until then the button says templates are not switched on.
