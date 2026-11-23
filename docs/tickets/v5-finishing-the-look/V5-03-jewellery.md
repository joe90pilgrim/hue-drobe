# V5-03 Jewellery: a necklace, if wanted

**Status:** waits for Joe's decision below. Rewritten 23 Nov 2026 from V5-00 (`docs/decisions/2026-11-22-v5-00-asset-sources.md`); it was an outline for necklaces, rings and watches. The spike recommends rings and watches are dropped from 3D, and that a necklace is possible but low value. Joe decides whether this ticket runs at all.

**Ceiling:** 1.5 hours (proposed), necklace only. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, medium (proposed). One converted item took about 30 minutes in the spike.
**Depends on:** V3-07 (`pack/fit_template.py` and `pack/author_template.py`, done), V5-00 (done)

## Goal
A necklace on the avatar's neck, if Joe decides it is worth it.

## What the spike found
- **Rings and watches are not worth doing in 3D at phone size.** Projected on a Pixel 8 (stage assumed 1080 by 1700 px): a 2 cm ring is 12 px wide at the app's default framing and 32 px at its closest zoom; a 4 cm watch face 24 px and 63 px. The hand sits at the side of the avatar. A colour dot or icon in the outfit list would carry the same information.
- **What exists with a usable licence** (OpenGameArt, read 22 Nov 2026): *Necklace* by Paul Wortmann (CC0); *Ring Set - Precious Metals* by Clint Bellanger (CC-BY 3.0, `.blend` only); *Old Ring* by Kutejnikov (CC-BY 4.0, 23 MB). Neither ring was converted. No bracelet and no wristwatch with a CC0 or CC-BY licence turned up. The pocket watch is GPL or CC-BY-SA, so it is out.
- **Modelling our own** was estimated, not measured: about 6 to 9 hours for a necklace, a ring and a watch, against 30 minutes for the community necklace.
- **The one necklace** (`necklace_wortmann`, CC0, 448 triangles, 25 KB plain) converts and fits both bodies. It is a flat loop with no drape, at collarbone height with a small pendant, and a hair-thin line at the default framing:

| Body | Size (width x depth x height, cm) | Default framing (px) | Closest zoom (px) | Body as drawn: pairs / gap rays (0 / 0) | Self pairs |
| --- | --- | --- | --- | --- | --- |
| Joe | 17.8 x 14.7 x 4.7 | 109 x 29 | 282 x 75 | **64 / 0, fails** | 554 |
| B | 14.3 x 13.9 x 3.8 | 87 x 23 | 227 x 60 | **64 / 0, fails** | 449 |

- The line is about 1 px thick at the default framing. Visible but faint at the closest zoom. No phone test was run.
- **Not measured:** the necklace against the app's tops and collars.

## Scope (only if Joe wants the necklace)
- One template `pack/templates/jewellery/necklace_wortmann/` with a `meta.json` (CC0, source and author), made with `pack/author_template.py` as the spike did: a rigid 90 degree turn so the pendant faces front (`pack/v5_spike/prep_jewellery.py`), and three landmarks set by hand (the two clavicle joints and the neck joint).
- Fit it on Joe and B; check against the body as drawn and against the app's tops, collars included.
- Add a necklace slot in the clothes menu and saved items. A new slot changes the data model; agree the shape first.
- If it does not look right as the MHCLO fit gives it, report and stop. No scripted reshaping, no hand-nudging it to pass (CLAUDE.md).

## Decisions needed from Joe
Open: all of these.
- **Is a faint necklace worth a ticket?** If no, V5-03 is parked (kept, not deleted) and the roadmap's jewellery line is dropped. If yes, the ticket below runs.
- **Rings, watches, bracelets:** drop them from 3D (the spike's evidence), or keep them as a later ticket if the avatar's hands ever become a close-up feature? An icon in the outfit list is the alternative; that would be a different ticket, which Joe writes.
- **Model our own necklace, or use the community one?** The community one is CC0 and needs no credit. Modelling is 1 to 2 hours for a necklace (an estimate).
- **A necklace slot changes the data model** (saved items, outfits, backup and sync).

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Rules for this ticket
- Joe's and B's real bodies only; no synthetic bodies in builds, renders or acceptance numbers.
- Visual first, gates second: `spike/blender/render_closeup.py` front, three-quarter and back, at most three render rounds, then stop and ask Joe. The 64 face pairs are reported, not forced; the check is enforced only after Joe approves the look (`approved: true`), so a necklace that cannot pass does not ship.
- Don't create follow-up tickets.

## Acceptance criteria
- The necklace looks like a necklace on Joe and B, front and back, at the app's closest zoom and on the Pixel 8 (Joe's and Beth's visual sign-off).
- After approval it passes "body as drawn" (0 face pairs, 0 gap rays) on both, or Joe decides not to ship it.
- No clipping into the body, the tops or the collars.
- The pack stays under 15 MB.
