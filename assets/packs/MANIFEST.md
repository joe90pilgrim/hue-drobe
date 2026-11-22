# Archived MakeHuman asset packs (V2-09)

Our own verified copies of the free MakeHuman community packs, kept because the community site is shutting down. Downloaded whole on **16 November 2026** from `https://files.makehumancommunity.org/asset_packs/<pack>/<pack>_cc0.zip`. Every zip passes a CRC test (`zipfile.testzip()`).

Stored in two places (zips are never committed):

- Local: `assets/packs/zips/` (git-ignored).
- Cloud: `gs://huedrobe-joe-4821-asset-packs/asset-packs/` (europe-west2, same region as Cloud Run; uniform access, public access prevention enforced). Downloaded back and compared: identical to the local copies.

Rebuild or check with `python -I assets/packs/fetch_packs.py` (`--check` to verify only, `--upload gs://...` to copy to the bucket).

| Pack | Size (bytes) | sha256 | Licence (per pack json) | Use |
| --- | ---: | --- | --- | --- |
| shirts01 | 24,479,483 | `a5a723b0e84a109bb190fcfeac7f1de4138d875da3e30fe5b3340eac9f38bcd3` | CC0 (10 items) | Tops. Spike used `joepal_crude_t-shirt_female` / `elvs_crude_t-shirt_male`. |
| pants01 | 21,908,723 | `e4e0ec60db34f279be291a83cfd7b342a7c5cf09bb7676682a5f39f4f6ac4ad9` | CC0 (4 items) | Trousers and shorts. |
| skirts01 | 29,554,534 | `293fa0c15e28e8dcea8dfff20cae31aa4b0d1268a6e6ba0a53a92ebb0f36c882` | CC0 (6 items) | Skirts. |
| dress01 | 46,598,791 | `f49ba54a3c93acd3c3307cc5a96cfc65daf8abfed9212a7e580791d821c9e93a` | CC0 (13 items) | Dresses. Spike used `toigo_shift_dress`. |
| shoes01 | 82,953,569 | `ded3f70428505eabbf1f6d7b5f61196a7366ef20757103d276ad0ed336c35ada` | CC0 except one item, see below (23 items) | Shoes. Spike used `toigo_ankle_boots_male` / `_female`. |
| hair01 | 227,775,853 | `49445d69848a313ec41a9970f6a0fe4bcf925c9f1c6ef40a76f119c2e07940c9` | CC0 (25 items) | Hair. Spike used `cortu_short_messy_hair` / `toigo_blunt_bob`. |
| hats01 | 6,636,192 | `97b70d7bd90e74ee87a49faeb7c4a1b2762b311902974db575851daaae05b50e` | CC0 (6 items) | Hats, for later tickets. |
| underwear01 | 60,561,755 | `8c3b51cf18d26ea096cb92b79a7a379d1a00273ef029b5779715486180fd47d5` | CC0 (19 items) | Underwear, stockings, sleeves, for later tickets. |
| suits01 | 42,624,017 | `2b1d8676f3863b188e9eea98c1d8f234543d54c440e791d92b819f8ee1861f19` | CC0 (8 items) | Suits and jackets (V3-07a). File `suits01_cc0.zip`. |
| shirts02 | 175,395,076 | `d711ca9f73212de855257ac08422e1e0ccb802e5231315c2a360d0fcfea5033e` | **CC-BY** (13 items; authors EWS, Elvaerwyn, Mindfront, janexx, punkduck) | Shirts (V3-07a). File `shirts02_ccby.zip`. Needs a credit in `CREDITS.md`. |
| shirts03 | 71,659,687 | `b3ff3596723dbc87cb07389895da760b667cf413f2c67869ccb0cdfb82a79a8a` | **CC-BY** (19 items; authors DredNicolson, Elvaerwyn, Mindfront, punkduck) | Shirts (V3-07a). File `shirts03_ccby.zip`. Needs a credit in `CREDITS.md`. |
| shoes02 | 105,745,850 | `1b544d87dd8b3d3a9c8317e4f059be456491be979cbc9984fc53f403046f5061` | **CC-BY** (24 items; authors callharvey3d, culturalibre, DressUpDoc, Elvaerwyn, Mindfront, punkduck) | Low shoes, sneakers, sandals (V5-00 spike). File `shoes02_ccby.zip`. Needs a credit in `CREDITS.md` if an item ships. |
| shoes03 | 50,300,350 | `7818b43a520a90bb0286aaa1e137ddb9bbe59640c3edbdf4d9d849064ec2761b` | **CC-BY** (12 items; authors Elvaerwyn, MaciekG, madmanny, Mindfront, punkduck, scailman) | Boots (V5-00 spike). File `shoes03_ccby.zip`. Needs a credit if an item ships. |
| hair02 | 72,283,345 | `c681e5efd37df4007a52253a8d071aedbfe3b614f199d8dae4ae76d5bd7d95c9` | **CC-BY** (21 items; author Elvaerwyn) | Hair, high-poly (V5-00 spike). File `hair02_ccby.zip`. Needs a credit if an item ships. |
| hair03 | 40,087,657 | `776c277cb6bcebc32907e05fa94d119e48742cdc1c34183996fc3e65e17a2740` | **CC-BY** (14 items; authors culturalibre, grinsegold, punkduck) | Hair (V5-00 spike). File `hair03_ccby.zip`. Needs a credit if an item ships. |
| hats03 | 76,001,637 | `2702d58fa04e57235881551c45adcda36a6eafde8043c2695375bc0b4b79f550` | **CC-BY** (19 items; authors culturalibre, Elvaerwyn, MaciekG, Mindfront, punkduck) | Hats and caps (V5-00 spike). **File `hats03_cc-by.zip`** (the site spells this one with a hyphen). Needs a credit if an item ships. |

The six spike packs match the sha256 prefixes recorded in `docs/decisions/2026-11-16-v2-07-asset-pack-spike.md`.

## Licence exception

`shoes01_cc0.zip` is not wholly CC0. In `packs/shoes01.json`, `culturalibre_heroine_boots_4` (author culturalibre) is **CC-BY**, which needs credit. Do not use that item unless we add the credit. The other 22 shoes are CC0. All other packs list CC0 for every item.

CC-BY packs download from `.../asset_packs/<pack>/<pack>_ccby.zip` (hats03 is `hats03_cc-by.zip`). V5-00 added shoes02, shoes03, hair02, hair03 and hats03 on 22 November 2026, from `files.makehumancommunity.org` only, each CRC-tested, hashed and copied to the bucket (sizes compared; same `asset-packs/` folder). The site was still up that day. The build accepts a CC-BY item only when its template's `meta.json` has a `credit` (`fit_template.pack_licence_error`). Downloaded 18 November 2026.
