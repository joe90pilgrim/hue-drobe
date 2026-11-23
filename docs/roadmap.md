# Hue-drobe roadmap

Started 15 November 2026, after the MVP was completed. This is a working plan, not a commitment: ideas are added as they come up and slotted into a version. Each version has a theme and should be usable on its own by Joe and Beth.

## The MVP (done)

Joe's avatar on phone and desktop; tee, trousers and sweatshirt with a colour picker; seasonal colour quiz with general advice. Garments use the offset-shell method. See `docs/decisions/2026-11-14-spike-writeup.md` and `docs/tickets/`.

## Versions

| Version | Theme | Ideas (number from the ideas list) |
| --- | --- | --- |
| 1.1 | Make it mine | 10 favourite colours in the picker, 1 preset outfits, 9 saved clothes library, 4 other necklines, shorts |
| 1.2 | Redesign | UI and navigation improvements from Joe's screenshots and issues list |
| 2 | Beth joins | 7 woman's body, 16 individual logins, tights |
| 3 | Loose clothes and layers | Dresses, skirts, shirts, jackets, coats, 2 multiple top layers |
| 4 | Your real wardrobe | 15 photo to nearest item, 5 screenshot to nearest item, 12 create a packing list |
| 5 | Finishing the look | Shoes, hats, jewellery, 11 hair styles |
| 6 | Style assistant | 14 Gemini advice and 13 suggested packing list (merged into one ticket) |
| 7 | Packing and the app icon | 23 new app icon, 24 packing page redesign, 25 match suggestions to your wardrobe |
| Later | Needs an architecture change first | 6 other poses, 8 change body dimensions or presets |

### 1.1 Make it mine
Cheap, because it reuses what the MVP already does.
- **Favourite colours (10):** at the end of the quiz, save colours from your palette; they appear in the colour picker. This links the quiz to the outfit screen, so the two halves of the app work together.
- **Preset outfits (1) and saved clothes library (9):** save a garment in a colour as a named item ("navy tee"), and save combinations of items as outfits. Both are simple saving features.
- **Other necklines (4):** V-neck and scoop as variations of the tee template.
- **Shorts:** the trouser template with a shorter leg.

### 1.2 Redesign
Comes before version 2 so the new screens for logins and profiles are built once, in the new design, and so Beth's first experience is the improved app.
- Scope comes from Joe's screenshots and UX/UI issues, worked through with a design specialist; the resulting brief becomes the 1.2 tickets.
- UI and navigation only, no new features. The navigation leaves room for profiles (v2) and more clothing types (v3) without building them.
- Every ticket has a ceiling and Joe's visual sign-off, like the rest.
- Designed and ticketed 15 Nov 2026: brief and designs in `docs/designs/2026-11-15-v1.2-redesign/`, tickets V1.2-01 to V1.2-08 in `docs/tickets/v1.2-redesign/`. Three findings went to the ideas list rather than 1.2 (19 to 21).

### 2 Beth joins
The product was always meant for two people, so this comes early.
- **Woman's body (7):** Beth's avatar from her real measurements, built the same way as Joe's. Needs Beth's tape measurements and front and side photos for her visual check.
- **Individual logins (16):** replaces the shared basic-auth password, now that there are two people.
- **Tights:** fits the current offset-shell method (close to the body, very little room).
- Garments in this version are limited to what the offset shell can do: tee, sweatshirt, trousers, shorts, tights.

### 3 Loose clothes and layers
**Needs a capped experiment first**, like the spike: the cloth technique deferred from the spike (Blender cloth simulation, run offline and starting from the offset shell). Decide go/no-go on its results before building the version.
- Dresses, skirts, jackets, coats.
- **Multiple top layers (2):** a jacket over a tee is the same technical problem as a dress, so it belongs here.
- Shirts (long, mid and short sleeves): collars and cuffs are new geometry.

### 4 Your real wardrobe
Comes after version 3 on purpose: matching real clothes to the library only works once the library has the kinds of things Joe and Beth actually own.
- **Photo to nearest item (15):** upload a photo; the app suggests the nearest template and extracts the colour.
- **Screenshot to nearest item (5):** replaces the original "paste a URL" idea, which was dropped on 22 Nov 2026 because retailer sites change and some forbid scraping. A screenshot is cropped on the device to one garment, then goes through the same route as 15.
- **Create a packing list (12):** a list built from saved items.

### 5 Finishing the look
- Shoes (boots, sandals, trainers), hats, hair styles (11), and possibly a necklace.
- **Updated 23 Nov 2026 after the V5-00 spike** (`docs/decisions/2026-11-22-v5-00-asset-sources.md`). These items are not a separate, easier technique: they are MHCLO templates fitted to each person's body by `pack/fit_template.py`, like the garments, and they are judged by the same checks. The community packs supply shoes, hats and hair. The sources are mostly CC-BY, so credits are needed (V3-10).
- **Shoes:** usable for Joe (biker boots) and B (sandals, Oxfords); the shoe textures look wrong on 8 of 10 fits and must be diagnosed first. **Hats:** a cap and a beanie work on both; a hat over hair is not solved by hiding the hair alone. **Hair:** no style matches Joe's real hair, and B's only roughly. **Jewellery:** rings and watches are not worth doing in 3D at phone size; a necklace is possible but faint, and Joe decides whether it runs.
- Each person is offered only the garments in their own pack (a mix of shared and per-person items, decided 22 Nov 2026).
- Polish rather than core value.

### 6 Style assistant
These are recommendations, which the MVP deliberately left out. They work best once the app knows your wardrobe and your season.
- **Gemini advice (14) and suggested packing list (13):** built together as one ticket, V6-01, which asks Gemini for a packing template from the trip name, dates and your season. Free-form advice and a weather service were dropped: a trip has no destination. Version 7 builds on it.

### 7 Packing and the app icon
Designed on 23 Nov 2026 from the packing mock-up and the icon options canvas. The spec is `docs/decisions/2026-11-23-v7-packing-and-icon-spec.md`.
- **New app icon (23):** a tee in the colour wheel with a hanger hook (option A2), in the app icon, the favicon and the header.
- **Packing page redesign (24):** trip cards with progress, a tray of silhouette tiles, planned looks as flat-lay cards, a collapsed Packed section, an Add sheet with tabs and search, and a laptop layout.
- **Match suggestions to your wardrobe (25):** Gemini gets the list of your clothes (names, types and colours, never photos or measurements), suggests a list, and you swap each suggestion for a piece you own, one at a time or in bulk with Undo.

### Later: needs an architecture change first
Both are bigger than they look and need their own capped experiment before going into a version.
- **Change body dimensions or use a preset (8):** bodies and garments are built offline on Joe's computer. Changing them in the app means either building on a server or bringing back the runtime size blending that was dropped after the spike.
- **Other poses (6):** garments are currently fitted to one fixed pose. New poses mean the garments must bend with the body (skinning), which they don't yet.

## Decisions to make along the way

- **Sending data off the device (versions 4 and 6).** Photo matching, page scraping and Gemini all send data to outside services, which breaks the blueprint's "data stays on the device" principle. Decide deliberately before version 4, and agree it with Beth.
- **Wardrobe list sent to Gemini (version 7).** Joe decided on 23 Nov 2026 that the list of saved clothes (id, garment type, name, colour) goes to Gemini for packing suggestions, because it is not photos. Photos and measurements still never leave the device. V7-05 records the amendment.
- **Hosting and accounts (version 2).** Moving from one shared password to individual logins affects how the avatar files are protected on Google Cloud.

## Ideas list

Ideas are numbered in the order they were raised, not by priority. New ideas get the next number and a version, or "unassigned" until placed.

1. Preset outfit combinations (1.1)
2. Multiple top layers (3)
3. Jackets, coats, shoes, hats, jewellery, dresses, shirts, skirts, shorts, tights (split across 1.1, 2, 3 and 5)
4. Other t-shirt necklines (1.1)
5. Provide a URL to find the nearest item in the library (4)
6. Other avatar poses (Later)
7. A woman's body (2)
8. Change your body dimensions, or use a preset (Later)
9. A library of saved clothes (1.1)
10. Save quiz colours as favourites shown in the colour picker (1.1)
11. Hair styles (5)
12. Create a packing list (4)
13. Suggest a packing list (6; built in V6-01, merged with 14)
14. Ask Gemini for advice (6; merged into 13, built as the packing template in V6-01)
15. Upload a photo to find the nearest item in the library (4)
16. Individual logins (2)
17. Starter outfits that come with the app, as well as saved ones (unassigned, to consider later)
18. Redesign of the UI and navigation (1.2)
19. Neutral lighting for the avatar: the hemisphere light's ground colour is warm and tints the lower part of each garment (unassigned; found in the 1.2 redesign, a viewer change)
20. Search and more filters in the Wardrobe, once there are enough clothes to need them (unassigned; from the 1.2 redesign)
21. Undo after deleting a piece or outfit, in place of the confirmation (unassigned; from the 1.2 redesign)
22. Baggier clothes slider or level setting per piece
23. New app icon: a tee in the colour wheel with a hanger hook (7)
24. Packing page redesign (7)
25. Match Gemini's packing suggestions to clothes in your wardrobe (7)
