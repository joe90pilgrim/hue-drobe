# blazer_suit3 and blazer_suit_f2 (V3-09)

- Source: the jacket of `toigo_male_suit_3` (men) and `toigo_female_suit_2` (women), Suits 01, CC0 (Toigo). `keep_islands` 0 and 4-14 (5033 and 5015 vertices); island 1 is the trousers, 2 and 3 the shirt panel and tie. Open front, notch collar, one chest pocket, as modelled.
- Status: `approved: false`. Both templates are report-only. Not ready for sign-off: see below.

## Rounds (3 of 3 used)

1. Male jacket, `inner_layers: ["tee", "shirt_untucked_bd"]`, `inner_push: body_normal`. Synthetic medium: reads as a blazer, pocket flap rough. Synthetic female large: chest panels and pocket shredded across the bust.
2. Same plus `loose: {ease_fraction: 0.08}`. Moved 2.8 cm at most; female large unchanged.
3. Female suit's jacket (`blazer_suit_f2`) on synthetic female large and small: still shredded at the bust and down the front opening, so the source jacket is not the cause.

## Numbers (cm; pairs against inner layers; limits once approved: 0 pairs, inner at least +0.2 inside)

| Body | Body as drawn (pairs, gap rays) | Hem z | Tee: pairs / deepest | Shirt: pairs / deepest |
| --- | --- | --- | --- | --- |
| medium, male jacket | 0, 0 | 79.4 | 102 / -4.45 | 621 / -4.96 |
| female large, male jacket | 0, 0 | 73.3 | 776 / -2.85 | 827 / -4.67 |
| female large, female jacket | 0, 0 | 73.5 | 463 / -3.20 | 1061 / -5.00 |
| female small, female jacket | 0, 0 | 65.9 | 362 / -3.06 | 815 / -4.96 |

Body as drawn passes everywhere. The layer check fails everywhere, worst over the shirt. The deepest inner vertices sit at the collar front (x about 0, z 138-145 cm): the shirt's collar and the tee neck stand outside the jacket's V.

## Diagnosis (not proved)

Tearing is the same on both source jackets, so it comes from the pipeline: the `body_normal` push-off moves each jacket vertex out to clear the tee or shirt, and over a bust the inner layer is a lot fuller than the jacket's bind, so the front of the jacket (separate pocket and button pieces included) is pulled apart. That is a `fit_template.py` change (V3-07 follow-up, Opus), not template data.

## Renders

`pack/out/renders/v3-09/`, `v3-09-r2/`, `v3-09-r3/` (git-ignored). Joe's visual sign-off: not asked for yet.
