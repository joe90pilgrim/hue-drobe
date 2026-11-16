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

- **V2-09** Archive the free asset packs: where to keep the zips? Recommendation: a private Google Cloud Storage bucket plus a copy on Joe's machine.

## v3-loose-clothes

- **V3-00** Experiment: loose clothes with cloth simulation: Which skirt shape matters most to Beth? For example A-line, midi, pencil, wrap. Pick one for the experiment (dresses now come from the packs).
- **V3-00** Experiment: loose clothes with cloth simulation: Go/no-go: Joe decides from the write-up whether version 3 goes ahead on this technique.
- **V3-01** Skirts: Which skirt styles and lengths, in which order?
- **V3-02** Dresses: Which dress styles first? Sleeved or sleeveless?
- **V3-03** Shirts (long, mid and short sleeves): Collar style (classic, button-down)? Worn tucked in or out, or both?
- **V3-04** Jackets and coats: Which jacket and coat types first? Open or closed fronts?
- **V3-05** Multiple top layers: How many layers at most (recommendation: three)? Which combinations are allowed?

## v4-real-wardrobe

- **V4-00** Decision: sending data off the device: Yes or no, and with what limits? For example, photos of clothes only, never photos of people.
- **V4-01** Photo to nearest item: On the device only, or via Gemini? Depends on V4-00.
- **V4-01** Photo to nearest item: Is the photo kept with the saved item (the blueprint said yes, so colour can be re-extracted later)?
- **V4-02** URL to nearest item (recommend dropping): Keep or drop? Recommendation: drop in favour of uploading a screenshot through V4-01.
- **V4-03** Create a packing list: What is a trip: just a name and dates, or a destination too (needed for weather suggestions in V6-02)? Recommendation: include the destination now.

## v5-finishing-the-look

- **V5-00** Decision: where shoes, hats, jewellery and hair come from: Make, reuse or buy? Recommendation: reuse MPFB2's free (CC0) assets where they exist, and make simple shoes and jewellery in Blender.
- **V5-01** Shoes: boots, sandals, trainers: Should trouser hems sit over boots, or tuck in? Which shoe types first?
- **V5-02** Hats: Which hat types first? How do they work with hair styles (V5-04)?
- **V5-03** Jewellery: necklaces, rings, watches: Rings and watches are tiny on a phone screen; worth it, or necklaces first?
- **V5-04** Hair styles: Which styles? Hair colour from the quiz result, or chosen freely?

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
