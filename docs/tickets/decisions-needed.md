# Decisions needed from Joe

Every open implementation decision across the roadmap tickets, by version. Tick each one off in its ticket when decided.

## v1.1-make-it-mine

- ~~**V1.1-01** Favourite colours in the picker: Can favourites include colours from outside your season's palette?~~ Decided 15 Nov 2026: yes, palette colours are marked as such.
- ~~**V1.1-01** Favourite colours in the picker: Is there a limit on the number of favourites?~~ Decided 15 Nov 2026: no limit; the picker shows the first 12 and a 'more' option.
- ~~**V1.1-02** Saved clothes library: Naming: required, or auto-named ('Navy tee') and editable?~~ Decided 15 Nov 2026: auto-named from the colour and garment, editable.
- ~~**V1.1-02** Saved clothes library: Where does the library live in the app's navigation?~~ Decided 15 Nov 2026: a Wardrobe tab, as in the concept designs.
- ~~**V1.1-03** Preset outfits: What does 'preset' mean? (a) outfits you save yourself, (b) starter outfits that come with the app, or (c) both. This ticket assumes (a). Starter outfits would need content from you.~~ Decided 15 Nov 2026: saved outfits only. Starter outfits go on the roadmap for later.
- ~~**V1.1-03** Preset outfits: Should applying an outfit replace everything on the avatar, or only the slots the outfit fills? Recommendation: replace everything.~~ Decided 15 Nov 2026: replace everything.
- ~~**V1.1-04** Other t-shirt necklines: Which necklines? Suggested: V-neck and scoop. Others such as henley (buttons) or polo (collar) are new geometry and would move to v3.~~ Decided 15 Nov 2026: V-neck and scoop.
- ~~**V1.1-04** Other t-shirt necklines: How deep should the V and the scoop be? A measurement in cm below the crew neck, or 'match a tee I own'.~~ Decided 15 Nov 2026: V-neck 12 cm and scoop 9 cm below the shoulder-top line.
- ~~**V1.1-05** Shorts: What length? Mid-thigh (about 18 cm inseam), above the knee (about 23 cm) or knee length (about 28 cm). One length for now; more later if wanted.~~ Decided 15 Nov 2026: above the knee, 23 cm inseam.
- **V1.1-06** Back up and restore your data (recommended addition): Is this wanted in 1.1? The blueprint listed backup as a must, and 1.1 is the first version where losing data would hurt (saved clothes and outfits). Recommendation: yes.
- **V1.1-07** Show a close second season: Wording and threshold. What should the line say, and how close counts as borderline? Recommendation: show it when the runner-up is within 15% of the top score.
- **V1.1-07** Show a close second season: Can you save favourites (V1.1-01) from the second season's palette too? Recommendation: yes.

## v1.2-redesign

- ~~**V1.2-00** Redesign brief: Which issues are in scope for 1.2, and which wait?~~ Decided 15 Nov 2026: all of them. Lighting, wardrobe search and undo go to the ideas list (19 to 21).
- ~~**V1.2-00** Redesign brief: Does the visual style change, or only layout and flow?~~ Decided 15 Nov 2026: keep the look, change to true neutrals with ink, add the name, logo and Bricolage Grotesque headings. See `docs/decisions/2026-11-15-v1.2-design-decisions.md`.
- ~~**V1.2-05** Colour chooser: In 1.2 or later?~~ Decided 15 Nov 2026: in 1.2, with the colour code field.

No open decisions for 1.2.

## v2-beth-joins

- **V2-01** Beth's measurements and photos: Beth agrees to what is stored and where, and to her avatar being on the hosted app behind its password.
- **V2-03** MVP garments on Beth: Should Beth's tee and trousers be the same cut as Joe's, or women's cuts (for example a more fitted tee)? Recommendation: same templates first; women's cuts as a later ticket if wanted.
- **V2-03** MVP garments on Beth: Fit per person or one fit for everyone? The MVP uses one set of ease values, the largest that pass on all seven bodies, so it is limited by the widest body (from the MVP backlog). Fitting each person separately gives looser, better-fitting garments but changes the data model. Recommendation: per person, decided here because Beth is the first real second body.
- ~~**V2-04** Tights: Opaque only, or sheer too?~~ Decided 16 Nov 2026: opaque and sheer. See `docs/decisions/2026-11-16-v2-04-tights.md`.
- ~~**V2-04** Tights: Can tights be worn with trousers, or only with shorts (and skirts later)?~~ Decided 16 Nov 2026: only with shorts (and skirts later).
- ~~**V2-05** Individual logins: How should sign-in work?~~ Decided 16 Nov 2026: Identity-Aware Proxy on Cloud Run. See `docs/decisions/2026-11-16-v2-05-logins.md`.
- ~~**V2-05** Individual logins: Can Joe and Beth see each other's avatar and wardrobe?~~ Decided 16 Nov 2026: not for now.
- ~~**V2-05** Individual logins: Staying signed in: how long before you are asked to sign in again?~~ Decided 16 Nov 2026: 30 days.
- ~~**V2-06** Profiles and per-person data: Does your data stay on each device, or sync between devices?~~ Decided 16 Nov 2026 (asked during V2-05): sync through a small Firestore database written in the background, with IAP for sign-in (the server writes for the signed-in person; no Firebase sign-in). Changes the blueprint's on-device, no-backend principle. See `docs/decisions/2026-11-16-v2-05-logins.md`.
- ~~**V2-07** Spike: free MakeHuman asset packs: per category, adopt pack assets, keep our own method, or mix. Recommendation (spike ran 16 Nov 2026, none of 32 fits passes the hard checks): keep our own method for tops, trousers and skirts; mix for dresses, if body hiding is accepted; use the pack for shoes (V5-01) and hair (V5-04). Hats and jewellery were not tested. See `docs/decisions/2026-11-16-v2-07-asset-pack-spike.md`.~~ **Decided 16 Nov 2026:** as recommended. See `docs/decisions/2026-11-16-v2-07-joe-decisions.md`.
- ~~**V2-07** Spike: free MakeHuman asset packs: is a mix of pack and own garments acceptable if the styles differ slightly? Recommendation: yes for dresses, shoes and hair, but pack and own garments clip into each other (0 to 2038 face pairs), so a mix needs layering rules first.~~ **Decided 16 Nov 2026:** as recommended. See `docs/decisions/2026-11-16-v2-07-joe-decisions.md`.
- ~~**V2-07** Spike: free MakeHuman asset packs: may any category carry texture (ties to the garment texture decision below)? Recommendation: hair and shoes only, with textures shrunk to about 1024 px; plain colour for everything else (keeps clothes near 1 MB and recolouring exact).~~ **Decided 16 Nov 2026:** as recommended. See `docs/decisions/2026-11-16-v2-07-joe-decisions.md`.
- ~~**V2-07** Spike: free MakeHuman asset packs: may a pack garment hide the body underneath it (MPFB's delete group), with the hard body-clipping check changed to test the body as drawn? Recommendation: yes. It decides the dress and shoes.~~ **Decided 16 Nov 2026:** as recommended. See `docs/decisions/2026-11-16-v2-07-joe-decisions.md`.
- ~~**V2-08** Bug: the tops show a point at each breast: if the fix is a bra garment, is it shown in the app when no top is worn? Recommendation: yes, as part of the body, with no menu entry.~~ **Closed 16 Nov 2026:** no bra garment was needed. Joe agreed the "no point" limits instead (`spike/tolerances.json` `bust_shape`). See `docs/decisions/2026-11-16-v2-08-bust-shape.md`.

- ~~**V2-09** Archive the free asset packs: where to keep the zips? Recommendation: a private Google Cloud Storage bucket plus a copy on Joe's machine.~~ **Decided 16 Nov 2026:** as recommended. Bucket `huedrobe-joe-4821-asset-packs`, europe-west2.

## v3-loose-clothes

- ~~**V3-00** Experiment: loose clothes with cloth simulation: Which skirt shape matters most to Beth?~~ **Decided 16 Nov 2026:** A-line midi.
- **V3-00** Go/no-go on cloth simulation for skirts. **Recorded as go, with conditions (17 Nov 2026), following Joe's request to update the version 3 tickets. Joe to confirm.** See `docs/decisions/2026-11-17-v3-00-cloth-skirt.md`.
- ~~**V3-01a** Skirt fixes: if the small body can't be fixed within the ceiling, ship for Beth only or hold the skirt?~~ **Decided 17 Nov 2026:** ship for Beth only. Not needed in the end: the small body was fixed (see `docs/decisions/2026-11-17-v3-01a-skirt-fixes.md`).
- **V3-01b** Skirt in the app: how should a top sit with the skirt, tucked in or worn over? Recommendation: tucked in first.
- **V3-01b** Skirt in the app: other lengths and styles? Recommendation: midi only until it's in use.
- **V3-02** Dresses: more dress styles beyond the shift dress? Recommendation: one more only if Beth asks (Dress 02 and 03 are CC-BY, needing a credits screen).
- **V3-02** Dresses: tights with the dress? Recommendation: yes.
- ~~**V3-03** Shirts: collar style?~~ **Decided 17 Nov 2026:** classic point collar.
- ~~**V3-03** Shirts: tucked in, out or both?~~ **Decided 17 Nov 2026:** untucked first.
- **V3-03** Shirts: agree the limits in `spike/tolerances.json` `shirt` (shoulder gap measured from 10 cm out, collar tip drop 4 cm, placket 0.3 cm; second pass: drawn collar shading at most 0.6) and `shading` (every garment's cloth shading turns at most 22 degrees in 1.5 cm); and look at the second-pass renders: does it read as a shirt, and do the tee, sweatshirt and trousers now read as cloth? (Joe asked on 17 Nov 2026 for the smoother shading on those too; done.)
- ~~**V3-05** Multiple top layers: how many layers at most?~~ **Decided 17 Nov 2026:** three (base, mid, outer).
- ~~**V3-05** Multiple top layers: which combinations?~~ **Decided 17 Nov 2026:** tee under shirt and tee under sweatshirt; not shirt under sweatshirt; jackets added in V3-04. See `docs/decisions/2026-11-17-v3-05-layers.md`.
- ~~**V3-04** Jackets and coats: open or closed front; which jacket first?~~ **Superseded 17 Nov 2026:** the first jacket is the Suits 01 blazer template (V3-09).
- ~~**Template pipeline** (proposal of 17 Nov 2026): approve the design, the three-round limit, the test pair and folding V3-06.~~ **Decided 17 Nov 2026:** approved across the board.
- ~~**V3-05** Legacy layered tops: ship only the combinations that pass on each body, or drop legacy layering?~~ **Decided 17 Nov 2026:** ship only the passing combinations; no further procedural geometry work.
- **V3-07** If MakeClothes can't run headlessly, how are templates from outside the packs authored? Decide only if V3-07 reports it.
- **V3-08** Shirt: keep the procedural shirt, switch to the template, or offer both? Decide from the side-by-side renders.
- **V3-09** Blazer: over the sweatshirt too, or only the tee and shirt? Recommendation: tee and shirt first.
- **V3-10** Credits screen: where should it live? Recommendation: settings, as "About and credits".
- ~~**V3-14** From the experiment's write-up: go, partial or no-go? If go: remove V3-07b's options or keep them off?~~ **Decided 18 Nov 2026:** carry on with rest-shape cloth and inner-layer hiding; remove V3-07b's options (V3.1-01).

## v3.1-templates

- ~~**V3.1-01** Merge the whole branch chain into `master` in one go, then remove the V3-07b code? Recommendation: yes.~~ **Decided 18 Nov 2026:** yes, one merge, then remove.
- ~~**V3.1-01** Accept the shirt's remaining bust crease and cuff body pairs on the large female body as a known limit? Recommendation: accept; judge each template from its renders.~~ **Decided 18 Nov 2026:** accept as a known limit; judge each template from its renders.
- **V3.1-03** Tee: ship the template alongside the legacy tee, and retire the legacy one later once necklines and tucking are covered? Recommendation: yes.
- **V3.1-04** Trousers: add alongside first, retire legacy trousers (and the shorts and tights built from them) once approved? Recommendation: yes. If Pants 01 has no straight leg: archive Pants 02 (CC-BY) or model one?
- **V3.1-05** Coat source: a long cardigan from Shirts 02 (CC-BY, archived), a coat modelled in Blender, or another site? Recommendation: the cardigan first.

## v4-real-wardrobe

- **V4-00** Decision: sending data off the device: Yes or no, and with what limits? For example, photos of clothes only, never photos of people.
- **V4-01** Photo to nearest item: On the device only, or via Gemini? Depends on V4-00.
- **V4-01** Photo to nearest item: Is the photo kept with the saved item (the blueprint said yes, so colour can be re-extracted later)?
- ~~**V4-02** URL to nearest item: Keep or drop?~~ **Decided 22 Nov 2026:** drop the URL idea; V4-02 is now "Screenshot to nearest item", a clear option beside Take photo and Upload photo.
- ~~**V4-02** Screenshot to nearest item: product images showing a model.~~ **Decided 22 Nov 2026:** (b). A cropped product image of a model is allowed; never Joe, Beth or anyone they know. V4-00 amended.
- ~~**V4-02** Screenshot to nearest item: ceiling and worker.~~ **Decided 22 Nov 2026:** 2 hours, Sonnet, high.
- ~~**V4-03** Create a packing list: What is a trip: just a name and dates, or a destination too (needed for weather suggestions in V6-02)? Recommendation: include the destination now.~~ **Decided 22 Nov 2026:** a name and dates only. See `docs/decisions/2026-11-22-v4-03-packing-list.md`.

## v5-finishing-the-look

- **V5-00** Spike: where shoes, hats, jewellery and hair come from. Before starting: ~~(1) ceiling 4 hours, Sonnet high?~~ **Decided 22 Nov 2026:** yes. ~~(2) archive the five CC-BY packs, locally and in the bucket?~~ **Decided 22 Nov 2026:** yes. ~~(3) may a rigid item (hat, jewellery) have one uniform size per body, with no change of shape?~~ **Decided 22 Nov 2026:** yes.
- **V5-00** After the spike (write-up: `docs/decisions/2026-11-22-v5-00-asset-sources.md`): (a) which item per category per body, or none; (b) ~~does each person get their own garment library?~~ **Decided 22 Nov 2026 (Joe):** a mix of shared and per-person. Garments are shared by default; a garment type is restricted to one person (or kept for both) case by case, when it is added or amended, and the ticket for that type says which. There is no category rule. The app should offer each person only the garments in their own pack (this also fixes skirts and dresses being offered to Joe). The V2-06 data model is to be checked for saved outfits and sync before the ticket for that filter is written; (c) a hat over hair: accept the leftover hair tips or hide the hair under any hat; (d) is the pack json enough for items whose header says AGPL3; (e) hair that matches neither Joe nor B: nearest style and recolour, or model one.
- **V5-01** Shoes (updated 23 Nov 2026 from the V5-00 write-up): which shoe per body, or none (the spike's proposal: Joe biker boots; B sandals and Oxfords); who sees which shoe (sex-matched items proposed as one person each, sneakers for both); trouser hems over the shoes or tucked in; texture or plain colour if the texture diagnosis fails (the sandals cannot be plain); can shoes be recoloured, given they keep their texture; agree the shape of a shoes slot in saved items and outfits (data model); V5-00 (d) for the sandals; does V3-10 (credits screen) go first? Ceiling 3 hours proposed.
- **V5-02** Hats (updated 23 Nov 2026): which hats per body, or none (proposal: cap and beanie for both, trilby for Joe if the Pixel 8 frame rate allows, nothing brimmed for B); V5-00 (c) the rule for a hat over hair; is the trilby's 28,602 triangles acceptable; shared for both (proposed); agree the shape of a hat slot; V5-00 (d) for the cap's AGPL3 header; credits (the cap is CC0 and could ship first). Ceiling 2 hours proposed.
- **V5-03** Jewellery (updated 23 Nov 2026): is a faint necklace worth a ticket, or park V5-03; rings, watches and bracelets dropped from 3D (the spike says not worth it at phone size), or kept for later; community necklace or modelled; agree the shape of a necklace slot. Ceiling 1.5 hours proposed if it runs.
- **V5-04** Hair styles (updated 23 Nov 2026): which styles per person, or none; V5-00 (e) nearest style recoloured or modelled; do you accept styles that fail the pack-item check (Maxwell by 6 pairs, the hippy hair by 54) on the strength of the render; hair colour from the quiz result or chosen freely (recommendation: free, with the quiz answer as the start); plain colour or tinted texture; separate lists for Joe and B (proposed); V5-00 (d) for `punkduck_alpha7_long`; V3-10 before or after. Ceiling 2 hours and Sonnet high proposed.
- **V5-05** Shrink textures: none expected. Joe decides between 1024 and 2048 px only if 1024 looks visibly worse.
- **Per-person garment filter** (from V5-00 (b)): no ticket yet. Joe writes it after the V2-06 data model is checked for saved outfits and sync.

## v6-style-assistant

- **V6-01** Ask Gemini for advice: What should Gemini be told about you, exactly?
- **V6-01** Ask Gemini for advice: A monthly spending cap on the Gemini API?
- **V6-01** Ask Gemini for advice: Free-form chat, or set questions such as 'What goes with this?'
- **V6-02** Suggested packing list: Which weather service, and is its cost acceptable?

## later-architecture

- **L-01** Experiment: changing body dimensions in the app: Go/no-go and which option, from the write-up.
- **L-02** Experiment: other avatar poses: Which poses matter? And are they for viewing only, or animated?

## From the MVP backlog, not yet in a ticket

- **Garment texture:** may garments carry a texture (for example ribbing on the sweatshirt cuffs, or patterns from photos in v4), or stay shape plus colour only? Affects V4-01 and the sweatshirt. Recommendation: decide before v4; keep plain colour until then. **Partly decided 16 Nov 2026:** shape plus colour for garments; textures for hair and shoes only. Patterns from photos stay open for V4-01.
