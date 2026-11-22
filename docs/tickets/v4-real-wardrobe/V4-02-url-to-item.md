# V4-02 Screenshot to nearest item

**Status:** built; waiting on Joe for the live check on real screenshots and the Pixel 8 (started 22 Nov 2026, 20:00). Refined with Joe on 22 Nov 2026. Replaces the old "paste a link" idea, which is dropped. Both decisions answered.

**Ceiling:** 2 hours (confirmed by Joe)
**Worker:** Sonnet, high (confirmed by Joe)
**Depends on:** V4-00 (done), V4-01 (built; see "Before starting")

## Goal
Make a screenshot a clear, separate way to add an item. Joe or Beth screenshots a product page, crops to the one garment, and the app suggests the nearest template and colour through the V4-01 route, for them to confirm. Our server never fetches a web page.

## Why it needs its own option
"Upload photo" already accepts a screenshot, but it isn't built for one:
- A phone screenshot is roughly twice as tall as it is wide, and the garment is a small part of it. V4-01 shrinks the whole image to 1024 px, so the garment ends up with very few pixels and the colour and shape get less reliable.
- Everything on screen goes to Gemini: prices, buttons, other products and, often, a model.
- Nothing tells the person to screenshot a product page, or what to leave out.

A crop step on the device fixes all three, and means the person chooses exactly what leaves the phone.

## Scope
- **Entry point:** a third button, "Add from screenshot", beside "Take photo" and "Upload photo" on the Wardrobe Clothes tab. Final wording and layout to be checked on a phone-width screen. The fourth row of cards must stay on screen (V4-01 found that an extra permanent line pushed it off).
- **On a laptop** the same option also takes a pasted image (for example Win+Shift+S, then Ctrl+V) and a dropped file.
- **Crop step (new):** the chosen screenshot is shown in the sheet, on the device only. The person drags a box around the one garment and taps "Use this part". One short line of help: crop to the clothes, leave out faces, prices and other items. Plain canvas code, no new dependency.
- **Send the crop only:** the crop, not the whole screenshot, is shrunk (longest side 1024 px) and sent. Reuse `downscale` and `identifyPhoto` in `app/src/identify.ts`, the `/api/identify` route and the V4-01 confirm sheet unchanged.
- **Server prompt (`deploy/identify.mjs`):** tell Gemini the image may be a cropped web page, so it ignores text, prices, buttons, colour swatches and other products. A cropped product image of a model wearing the garment is allowed (decision 1b): it describes the garment only and ignores the person. A photo that looks like a private snapshot of a real person (not a retailer image) gets "no match".
- **Not kept:** as V4-01. The screenshot and crop live in memory for the request only.
- **Out of scope:** reading the product name or description, more than one garment per screenshot, fetching URLs, and sharing to Hue-drobe from the Android share menu (proposed for the backlog below).

## Decisions made by Joe (22 Nov 2026)
1. **Product images that show a model: (b), amend V4-00.** A cropped product image of a model wearing the garment is allowed. Photos of Joe, Beth or anyone they know are never sent. The app cannot check this itself, so the help line in the crop step says so. V4-00 and its decision record are amended to match.
2. **Ceiling and worker:** 2 hours, Sonnet, high.

## Before starting (both resolved 22 Nov 2026)
- `npm run check` was fixed when V4-01 was closed (the template test now expects `tee_male` and `tee_female`).
- V4-01 was tried on the Pixel 8 and works.

## Acceptance criteria
- [x] "Add from screenshot" is its own option, apart from "Take photo" and "Upload photo", and the fourth row of cards is still on screen at phone size (Playwright). (`e2e/screenshot.spec.ts` and the 20-pieces test in `wardrobe.spec.ts`. See Notes: the phone labels are shortened.)
- [x] Choosing a screenshot opens the crop step: file picker on phone; file picker, paste and drop on laptop. Tested with a tall synthetic screenshot. (400 x 900 synthetic; the box can also be moved and resized.)
- [x] Only the cropped area is sent. Test: the decoded request image has the crop's proportions and none of the pixels from a marker placed outside the crop. (Red and green markers outside the crop: 0 pixels of either in the sent image; sent 220 x 320 within 5% of the box drawn; the whole screenshot is 400 x 900.)
- [x] Nothing is stored: the saved record has no image field and the server writes nothing to disk (same checks as V4-01). (The record keys are `colour, garment, id, name, savedAt, v`; the server route is unchanged. The screenshot is closed and its pixels freed before the request starts.)
- [x] The confirm step is the V4-01 one, pre-filled with the suggested garment and colour.
- [ ] **Joe to run.** Live check with at least 8 real retailer screenshots chosen by Joe (script written and tried on one synthetic screenshot against the real API: right template, dE 0.8): a table of suggested template against Joe's choice (right or wrong) and colour difference (ΔE) against the colour Joe would pick, from a committed script (`app/scripts/screenshot-check.mjs`, see `app/README.md`). Numbers are reported, not forced to pass; Joe judges whether they are good enough.
- [ ] **Joe to do.** Tried on the Pixel 8; Joe signs off the look and feel.
- [x] `npm run check` passes and changes are committed cleanly. (73 Playwright tests, Vitest, deploy tests, assets.)

## Notes (22 Nov 2026)
- Built in about 25 minutes of the 2 hour ceiling. The crop is `app/src/crop.ts` (tested), the sheet changes are in `app/src/screens/wardrobe-photo.ts`, and the server prompt change is in `deploy/identify.mjs` (V4-00 as amended: a retailer model is allowed, the garment only is described). The `/api/identify` route and confirm sheet are unchanged.
- **Decision for Joe (layout):** a third button at full width pushed the 4th row of cards off a 412 px phone screen. On a phone the labels are now "Take photo", "Upload" and "Screenshot", the page title is 24 px, and the row sits beside the title. On a laptop the full words show. The accessible names are always the full words. Say if you would rather keep the full words and give up the 4th row.
- The crop box starts empty: the person draws it, and "Use this part" stays off until they do. A tap clears the box. There is no "use the whole screenshot" shortcut; say if you want one.
- To run the live check: save your screenshots and a `manifest.json` in `private/screenshot-check/` (format in `app/scripts/screenshot-check.example.json`), then `node scripts/screenshot-check.mjs` from `app/`. Results go to `results.md` beside the manifest.

## Proposed for `docs/tickets/backlog.md` (if Joe agrees)
- Android share target: share a screenshot straight from the gallery or Chrome into Hue-drobe, skipping the file picker. Needs a service worker handler, so it is its own piece of work.
- Read the product name, stated colour and material from the page text when the screenshot shows it.
