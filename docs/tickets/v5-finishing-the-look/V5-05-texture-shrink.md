# V5-05 Shrink textures at build time

**Status:** ready when version 5 starts.

**Ceiling:** 45 minutes. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, low. A resize step in the build; small, but it touches every textured asset.
**Depends on:** V3-06

## Goal
Keep hair and shoe textures light enough for the phone.

## Scope
- In the pack build, resize any texture larger than 1024 x 1024 to 1024 x 1024 (hair and shoes are the only items allowed textures).
- Report each textured item's size before and after, and the total pack size against the 15 MB limit.

## Decisions needed from Joe
- None expected. If 1024 px makes hair look visibly worse on the phone, Joe decides between 1024 and 2048 from a side-by-side render.

## Acceptance criteria
- No texture in the pack is larger than 1024 x 1024.
- The whole pack, with hair and shoes, stays under 15 MB.
- Joe's visual sign-off on hair at the new size.
