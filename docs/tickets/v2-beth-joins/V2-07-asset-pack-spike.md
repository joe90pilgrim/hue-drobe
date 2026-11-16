# V2-07 Spike: free MakeHuman asset packs

**Status:** ready. Run before V3-00, because its result decides whether the cloth experiment is still needed.

**Ceiling:** 2 hours (hard stop). The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. Mostly loading, fitting, checking and rendering with tools that already exist. Escalate to Opus only on three strikes.
**Depends on:** V2-03 (Beth's avatar and garments in place)

## Goal
Find out whether free MakeHuman community asset packs (https://static.makehumancommunity.org/assets/assetpacks.html) can supply garments, shoes, hats and hair for Hue-drobe, saving development time on versions 3 and 5.

## Why this could pay off
- The app's bodies are MPFB2, which is MakeHuman for Blender, and these are MakeHuman assets made to fit MakeHuman bodies.
- Most packs are CC0, and between them they cover dresses, skirts, tops, trousers, shoes, hats, hair and even poses.
- If ready-made dresses and skirts fit well enough, V3-00 (the cloth experiment) can shrink or be dropped.

## Scope
- **CC0 packs only**, so there are no licence conditions to manage during the spike. Note which CC-BY packs look useful for later; they only need a credit.
- One item from each: Shirts 01 (a tee or sweater), Pants 01 (trousers), Skirts 01 (a skirt), Dress 01 (a simple dress), Shoes 01 (trainers or boots), Hair 01 (one style).
- Load and fit each item headlessly in Blender through MPFB2's own clothes support, on Joe, Beth and two synthetic bodies (one male, one female).
- For each item, record:
  1. **Fit:** does it attach to every body without manual work?
  2. **Checks:** does it pass the existing hard mesh checks (no body through cloth, no self-intersection)? Note whether MPFB2 hides the body under the garment, and whether that's acceptable.
  3. **Phone weight:** polygon count and GLB size per item, against the 15 MB pack limit and 30 fps.
  4. **Colour:** can the app's colour picker recolour it? Pack items usually carry textures; note whether a plain recolour works or the texture fights it.
  5. **Look:** front, side and back renders next to the app's own tee and trousers, so Joe can judge whether the styles sit well together.
  6. **Licence:** the exact licence of each pack used.
- No changes to the app. Spike code stays in `spike/assets/`.
- Don't fix assets by hand. If an item needs manual editing to work, record that and move on.

## Decisions needed from Joe
- **Per category, adopt or not:** from the write-up, Joe decides which categories use pack assets, which keep the app's own method, and which mix.
- **Mixed sources:** is it acceptable for some garments to be pack assets and others the app's own, if they look slightly different in style?
- **Textures:** pack items may only look right with their textures, which touches the open "garment texture" decision. Decide here whether any category may carry texture.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- A write-up in `docs/decisions/` with a table of the six items against the six points above, renders on Joe and Beth, and a recommendation per category: use the pack, keep our own method, or mix.
- A clear statement of what this means for V3-00 (still needed, smaller, or not needed) and for version 5.
- Stop at the ceiling, whatever state the work is in, and write up what was found.
