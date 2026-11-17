# Pack items and the "body as drawn" check (V3-06)

Date: 17 November 2026. Follows `2026-11-16-v2-07-joe-decisions.md` (decision 4: body hiding for pack items only, with a new check).

**Result.** The shift dress (`toigo_shift_dress`, CC0, from the archived `dress01` pack) builds on all three synthetic women and on B, in plain grey, with `body_dress.glb` (the body with the hidden parts removed). Every body has 0 face pairs between the body as drawn and the dress, and 0 gap rays (255,231 to 341,396 rays each). Dress 242 KB, body as drawn about 562 KB. The app's own garments are unchanged and still pass the strict check.

**What the check does** (`spike/blender/mesh_checks.py` `body_as_drawn`, limits in `spike/tolerances.json` `pack_item_body_as_drawn`): no face pairs between the drawn body and the dress, and no gap ray. A gap ray is one of about 290,000 parallel rays (1 cm apart, every 15 degrees round, at the five heights the app's camera can reach) that would hit skin on the whole body but, with the hidden parts removed, shows the inside of the cloth or nothing. A ray that only slips between two triangles is not counted (the rays 0.5 mm either side must also see through).

**What it took.** The pack's own delete group was not enough. It left skin crossing the cloth at the shoulders (76 face pairs on the medium body) and, once those faces were cut out, a hole visible from behind. The build now (1) pushes dress vertices that sit inside the skin, or closer than 0.2 cm, out to 0.2 cm (down to 0.96 cm on B), (2) keeps a body vertex hidden only if the cloth lies outside it along its normal, and (3) gives back the body vertices that a gap ray would have seen, then checks again.

**Things Joe should know.**
- Hiding off alone would not fail the check on every body any more, because step 1 stops the skin crossing the dress (0 pairs on the small body without hiding, 56 on the medium, 96 on the large, 78 on B). So the control is the dress as the pack fits it, over the whole body (24 to 637 pairs), and `python pack/build_pack.py --only synthetic_female_medium --no-hide` builds without hiding or our fitting and fails the check (503 face pairs). The ticket's wording, "turning the body hiding off makes the check fail", holds in that sense only.
- The gap-ray heights stop at 18 degrees below horizontal because `app/src/viewer.ts` stops the camera there. Looking up a skirt from further below would show the inside of any hidden-body dress.
- The sampling values (1 cm, 15 degrees, push 0.2 cm, 2 rings, up to 6 repair rounds) are mine, to be agreed.
- Taking a pack item off the body object before the body is exported brings the body's helper geometry back into the export; `pack_items.py` exports from a copy and removes the item last. The check fails if the body as drawn has as many faces as the whole body.

**App.** `keepLayers` has a `Dress` slot rule: a dress takes off the top and the bottom; a top or bottom takes off the dress. There is no dress in the app until V3-02.
