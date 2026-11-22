# V4-01 Photo to nearest item

**Status:** ready. Refined with Joe.

**Ceiling:** 3 hours
**Worker:** Sonnet, high
**Depends on:** V4-00 (done), V3 garments

## Goal
Upload or snap a photo of a garment on mobile or desktop; the app identifies the nearest shipped garment template and extracts its dominant colour via the Gemini API in a single structured call, letting you confirm or adjust both before saving to your wardrobe.

## Scope
- **Input:** Camera capture (`accept="image/*" capture="environment"`) or file upload from the Wardrobe "Add item" flow. Client-side downscaling/compression before transmission so latency stays low.
- **Matching & Colour Extraction (Gemini API):** Send the compressed standalone garment image to a backend endpoint calling a fast multimodal Gemini model with **structured JSON output** alongside the list of shipped garment templates/variants.
  - Gemini returns: `templateId`, `variant` (if applicable), `hexColor` (dominant garment colour), and confidence.
- **Privacy & Storage Guardrail:** The uploaded photo is **discarded immediately** once Gemini returns the structured response. No photo files are stored locally or synced to git/cloud storage.
- **Confirmation UI:** Pre-fill the garment selector and colour picker with Gemini's suggestion so Joe or Beth can review, tweak, and confirm before saving.

## Guardrails (from V4-00)
- Standalone garment photos only; never transmit personal/avatar data or user identities.
- API key must live securely on the server/cloud function environment, never exposed in the client PWA bundle.

## Acceptance criteria
- [x] User can snap a photo on the Pixel 8 or upload an image file from the wardrobe screen. (Two buttons, "Take photo" with `capture="environment"` and "Upload photo"; tested with a file input in Playwright. Not yet tried on the Pixel 8.)
- [x] Gemini API returns a structured template match and dominant hex colour in a single call. (`deploy/identify.mjs`; tested against a stand-in for Gemini. Not yet tried against the real API: needs the key.)
- [x] Uploaded photo is discarded immediately after extraction. (Held in memory for the request only; the tests check nothing is written to disk and the stored record has no photo field.)
- [x] Confirmation step displays the suggested template and colour in the standard picker UI before saving.
- [x] `npm run check` passes and changes are committed cleanly. (Three clean runs, 68 e2e tests.)

## Notes (18 Nov 2026)
- Needs from Joe before it works live: put the Gemini key in `private/gemini-key.txt`, then `node deploy/deploy.mjs` (see `deploy/README.md`). Without the key the button opens the sheet with "not switched on yet" and the garment is chosen by hand. The model is `gemini-flash-latest` (set `GEMINI_MODEL` to change it). `gemini-2.5-flash` is listed but answered 404 on the first live try, so the default was changed. Checked live with a plain test image: structured answer and colour came back correctly. Gemini needed prepaid credit on the account first (it answered 402 until then).
- The key is a Cloud Run environment variable, not a Secret Manager secret (simpler, nothing else to set up). Say if you want Secret Manager instead.
- "Clothes only, never people" shows as a tooltip on the buttons and in the sheet while it reads. A permanent line on the page pushed the 4th row of cards off a phone screen (the 20-pieces test), so I left it out.
- Skirt and dress are offered to everyone, including Joe, whose pack has neither.
- `npm run check` stops at `check:assets`: `pack/test_fit_template.py::test_committed_templates_are_valid` expects only `shift_dress` and `shirt_untucked_bd`, but the V3.1-03 commit added `tee_male` and `tee_female`. Not touched here. The other steps (typecheck, Vitest, deploy tests, Playwright) were run on their own.

## Notes (22 Nov 2026)
- Tested successfully on the Pixel 8 (Joe).
- `npm run check` fixed: the template test now expects `tee_male` and `tee_female`; Playwright is capped at 2 workers with a 60 s test and 15 s assertion timeout, because the avatar pack load timed out under 3 parallel workers (a different test each run); `try-on.spec.ts` waits for the pack before measuring the stage height.
