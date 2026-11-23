# V5-05 Shrink textures at build time

**Status:** ready when version 5 starts. Updated 23 Nov 2026 after V5-00 (`docs/decisions/2026-11-22-v5-00-asset-sources.md`): the spike measured the textures that need shrinking, and found that one hair file is over the pack limit on its own.

**Ceiling:** 45 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, low. A resize step in the build; small, but it touches every textured asset.
**Depends on:** V3-07 (`pack/fit_template.py`; V3-06 was folded into it)

## Goal
Keep hair and shoe textures light enough for the phone.

## What the spike found
- Hair and shoes are the only items allowed textures (Joe's decision of 16 Nov 2026). Everything else is plain colour.
- Textures to shrink, from the V5-00 tables (all KB, texture only; GLB file with texture in brackets where the spike gave it):
  - `toigo_blunt_bob` (B's baseline hair): 10,303 (20,399). **Over the 15 MB pack limit on its own.** 61 KB in plain colour.
  - `punkduck_alpha7_long`: 4,074. `elvs_grump_hair`: 3,467. `elvs_lady_hippy_hair`: 1,218.
  - `mindfront_shoes_biker_boots_male`: 1,665 (6,474). `toigo_ankle_boots_male`: 1,510.
  - `dressupdoc_sandals1`: 362. This one has a **transparent (alpha) texture that cuts the straps**, so a resize must keep the alpha channel. In plain colour the sandals look like a closed shoe.
- Nothing textured ships yet. Hair and shoes arrive in V5-04 and V5-01, so this ticket cannot be tested against a real pack. It is tested on the spike's scratch templates instead (below).

## Scope
- In the pack build, resize any texture larger than 1024 x 1024 to 1024 x 1024. Keep the alpha channel.
- Do not diagnose the pale or scrambled shoe textures here. That is V5-01's job. Shrinking must not be blamed for it, so render the same items before and after the resize, side by side, and say whether the look changed.
- Test on **Joe's body only** first, using the scratch templates `pack/v5_spike/prepare.py` writes under `private/v5_spike/templates/` (git-ignored): `toigo_blunt_bob`, `elvs_grump_hair`, the biker boots and `dressupdoc_sandals1`. Then B's.
- Report each textured item's size before and after, the projected size of a pack carrying them, and the 15 MB limit.

## Decisions needed from Joe
- None expected. If 1024 px makes hair or shoes look visibly worse on the phone, Joe decides between 1024 and 2048 from a side-by-side render.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- No texture the build writes is larger than 1024 x 1024, and the sandals keep their transparency (a render shows the straps).
- A before-and-after table for the four test items, and `toigo_blunt_bob` alone comes out under 15 MB.
- A side-by-side render of each test item at full size and at 1024, on Joe's body, with a one-line verdict on whether the resize changed the look.
- Joe's visual sign-off on hair and shoes at the new size.
- The check that the whole pack, with hair and shoes, stays under 15 MB moves to V5-01 and V5-04, because that needs real items in a real pack.
