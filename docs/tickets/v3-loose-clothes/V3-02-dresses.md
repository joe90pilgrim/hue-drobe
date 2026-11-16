# V3-02 Dresses

**Status:** ready once V3-06 is done. Rewritten after the asset-pack spike: dresses come from the free CC0 packs, not from the cloth experiment.

**Ceiling:** 1 hour. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, medium. The pipeline work is in V3-06; this adds the dress to the app.
**Depends on:** V3-06

## Goal
Beth can wear a dress on her avatar, in any colour.

## Scope
- The pack shift dress (`toigo_shift_dress`, Dress 01, CC0) through the V3-06 pipeline, in plain colour.
- Women's bodies only for now (on Joe's body, skin showed at the shoulders and chest in the spike).
- In the clothes menu, colour picker and saved items. Wearing the dress removes the top and trousers.
- It is about 13,600 triangles, three and a half times a tee, so check the frame rate on the Pixel 8 with the dress on.

## Decisions needed from Joe
- **More dress styles?** The CC0 and CC-BY dress packs (Dress 01 to 03) hold more; CC-BY needs a credits screen. Recommendation: ship the shift dress first, then try one more style if Beth wants it.
- Can tights (V2-04) be worn with the dress? Recommendation: yes.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- Passes the "body as drawn" check on Beth and the female synthetic bodies.
- 30 fps or better on the Pixel 8 with the dress on.
- Beth's visual sign-off, front, side and back.
