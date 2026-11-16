# V5-01 Shoes: boots, sandals, trainers

**Status:** ready when version 5 starts. Rewritten after the asset-pack spike: shoes come from the free CC0 packs.

**Ceiling:** 2 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. One unsolved look problem (below) plus a layering rule. If the pale render isn't explained after three attempts, stop: Joe decides whether to move up to Opus.
**Depends on:** V3-06, V5-05

## Goal
Joe and Beth can wear shoes on their avatars.

## Scope
- **First, the pale render.** In the spike the ankle boots read as pale socks with orange soles and white patches at the back. Find the cause (likely how the leather texture or its maps export to glTF) before anything else.
- Boots from Shoes 01 (CC0), sex-matched as in the spike, through the V3-06 pipeline with body hiding over the feet, texture kept and shrunk (V5-05).
- **Layering rule:** trouser hems sit over boots. In the spike, trouser legs clipped the boots by up to 362 face pairs.
- In the clothes menu and saved items.

## Decisions needed from Joe
- **Which shoe types first?** Boots were tested. Trainers and sandals are in Shoes 02 (CC-BY, needs a credit). Recommendation: boots first, then trainers.
- Can shoes be recoloured, given they keep their texture? Recommendation: offer a tint, but accept the colour may not be exact.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- Boots look like boots on Joe and Beth, front, side and back (Joe's and Beth's visual sign-off).
- Passes the "body as drawn" check, with trousers and without.
- The pack stays under 15 MB.
