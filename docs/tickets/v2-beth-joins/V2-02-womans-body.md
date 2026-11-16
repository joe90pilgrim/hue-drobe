# V2-02 A woman's body: Beth's avatar

**Ceiling:** 1.5 hours. The most this ticket may take, not a target. Stop as soon as the acceptance criteria are met.
**Worker:** Sonnet, high. The pipeline already builds female synthetic bodies; this adds bust and underbust and Beth's real numbers. Escalate to Opus on three strikes.
**Depends on:** V2-01

## Goal
Build Beth's avatar from her real measurements, as Joe's was built.

## Scope
- Add bust and underbust to the body solving for female bodies.
- Build Beth's body through the pack build.
- All body checks within tolerance (2 cm circumferences, 1.5 cm lengths).

## Decisions needed from Joe
- None expected, beyond Beth's visual sign-off.

If a decision isn't made when this ticket starts, stop and ask rather than guess.

## Acceptance criteria
- Beth's body passes every body check.
- **Beth's visual sign-off** against her photos, front and side, in the app served locally.

## Note, 16 Nov 2026
Built B's body from J's figures for height, bust and waist (waist lowered one inch after the first look, torso widened to calm the belly): every body check passes, 611 KB, repeatable. **Not done:** B's sign-off (no photos in `private/` yet; the app cannot show her until V2-06, so view her in the spike viewer at `/?m=b`), her hips (placeholder), and underbust, thigh and inside leg (not supplied, so not added). See `docs/decisions/2026-11-16-v2-02-b-avatar.md`.
