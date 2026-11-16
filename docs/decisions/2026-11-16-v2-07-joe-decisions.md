# Joe's decisions on the asset-pack spike (V2-07)

Date: 16 November 2026. Follows `2026-11-16-v2-07-asset-pack-spike.md`. Joe agreed with the reviewer's view on all four questions.

1. **Per category.** Keep the app's own method for tops, trousers and skirts. Use pack assets for dresses (with body hiding) and hair. Use pack assets for shoes, with the pale render treated as an unsolved problem to fix first. Hats and jewellery are untested and stay open.
2. **Mixed sources: yes.** Two layering rules cover it: a dress replaces the top and the trousers (it doesn't layer with them), and trouser hems sit over boots.
3. **Textures: hair and shoes only,** shrunk to about 1024 px at build time. Everything else is plain colour, so recolouring stays exact and clothes stay near 1 MB. This settles the open garment-texture decision for now: garments are shape plus colour, apart from hair and shoes. Patterns from photos (V4-01) are a separate question for version 4.
4. **Body hiding: yes, for pack items only** (dresses and shoes), with a new check that nothing of the body shows as drawn. The app's own garments keep the existing, stricter check.

Also: archive the CC0 packs now, because the MakeHuman community site is shutting down (V2-09).

## Effect on tickets
- New: V2-09 archive the packs, V3-06 pack asset pipeline and body-hiding check, V5-05 texture shrinking.
- V3-00: dress removed; skirt only, smaller ceiling.
- V3-02 dresses: now built from the pack dress through V3-06, no longer waiting on V3-00.
- V5-00: decided for shoes and hair; hats and jewellery still open.
- V5-01 shoes and V5-04 hair: rewritten around pack assets.
