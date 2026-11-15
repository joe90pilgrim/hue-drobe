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

## v2-beth-joins

- **V2-01** Beth's measurements and photos: Beth agrees to what is stored and where, and to her avatar being on the hosted app behind its password.
- **V2-03** MVP garments on Beth: Should Beth's tee and trousers be the same cut as Joe's, or women's cuts (for example a more fitted tee)? Recommendation: same templates first; women's cuts as a later ticket if wanted.
- **V2-03** MVP garments on Beth: Fit per person or one fit for everyone? The MVP uses one set of ease values, the largest that pass on all seven bodies, so it is limited by the widest body (from the MVP backlog). Fitting each person separately gives looser, better-fitting garments but changes the data model. Recommendation: per person, decided here because Beth is the first real second body.
- **V2-04** Tights: Opaque only, or sheer too? Sheer means partly see-through, which needs a transparency setting. Recommendation: opaque only for v2.
- **V2-04** Tights: Can tights be worn with trousers, or only with shorts (and skirts later)? Recommendation: only with shorts and skirts.
- **V2-05** Individual logins: How should sign-in work? Option A: Identity-Aware Proxy on Cloud Run (Google does the sign-in in front of the app; simplest, very little code). Option B: Firebase Authentication in the app (more code, but needed later if data syncs between devices; see V2-06). Recommendation: A, unless you choose syncing in V2-06.
- **V2-05** Individual logins: Can Joe and Beth see each other's avatar and wardrobe? For example, to plan matching outfits. Recommendation: yes, read-only.
- **V2-05** Individual logins: Staying signed in: how long before you are asked to sign in again?
- **V2-06** Profiles and per-person data: Does your data stay on each device, or sync between devices? Staying on the device keeps the blueprint's 'no backend' principle, but your phone and laptop show different wardrobes. Syncing needs a database (for example Firestore) and Firebase sign-in (V2-05 option B). Recommendation: stay on the device for v2, and use backup (V1.1-06) to move data; revisit syncing at v4.

## v3-loose-clothes

- **V3-00** Experiment: loose clothes with cloth simulation: Which skirt and dress shapes matter most to Beth? For example A-line, midi, pencil, wrap. Pick one of each for the experiment.
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

- **Garment texture:** may garments carry a texture (for example ribbing on the sweatshirt cuffs, or patterns from photos in v4), or stay shape plus colour only? Affects V4-01 and the sweatshirt. Recommendation: decide before v4; keep plain colour until then.
