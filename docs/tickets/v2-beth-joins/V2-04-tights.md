# V2-04 Tights

**Ceiling:** 1 hour. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, medium. The offset shell with almost no room; the method suits it well.
**Depends on:** V2-02

## Goal
Add tights as a layer under shorts (and under skirts in v3).

## Scope
- Very close-fitting shell from waist to ankle (feet are covered once shoes arrive in v5; until then, end at the ankle).
- Layering: tights sit under shorts and trousers.
- Available in the clothes menu, colour picker and saved items.

## Decisions needed from Joe
- **Opaque only, or sheer too?** Sheer means partly see-through, which needs a transparency setting. Recommendation: opaque only for v2.
- Can tights be worn with trousers, or only with shorts (and skirts later)? Recommendation: only with shorts and skirts.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- Passes the hard mesh checks under shorts on all bodies.
- Beth's visual sign-off.

## Status (16 Nov 2026): checks pass, waiting for B's sign-off
Joe chose opaque **and** sheer, and under shorts only. Every hard mesh check passes on all eight bodies, with tights clearance 0.21 to 0.25 cm and 0 crossings with the body, shorts or any top. In the app, tights have their own Legs row, a colour and an opaque/sheer choice, can be saved, and are greyed out under trousers. The shorts moved slightly where they meet the tights, so Joe's `shorts.glb` changed. The ticket overran its 1-hour ceiling: Sonnet spent about 30 minutes on margin tweaks that could not work, and Opus finished. Record: `docs/decisions/2026-11-16-v2-04-tights.md`. Still to do: B's visual sign-off and the phone check.
