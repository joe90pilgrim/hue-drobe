# Backlog

Ideas noticed while working a ticket, not done. Each line says where it came from.

- **Loosen the fit for Joe only** (MVP-03). The eases in `pack/fit_config.json` are the largest that pass on all seven bodies, set by the widest synthetic body. Joe's own body has room for looser garments; a per-body ease would need a decision on the data model. Revisit after Joe's sign-off in MVP-04/05.
- **Rib texture on the sweatshirt** (MVP-07). The hem and cuffs are drawn in by shape only; a normal map or a darker band would make the ribbing read at a glance. Needs a decision on whether garments may carry texture, since garments are shape plus colour.
- **A roomier sweatshirt body** (MVP-07). Chest ease is 10 cm; 12 cm folds the shell in the armpit on `synthetic_female_large` (2 self-intersecting pairs), the same limit the tee hit.
- **Serve `private/pack/` to the app** (MVP-03 to MVP-04). The pack is written to `private/pack/joe/`, outside the app. MVP-04 needs a small Vite dev-server route or a copy step. Keep it out of `dist/` until MVP-10 decides whether the body may be deployed.
- **Show a borderline quiz result** (MVP-09). `scoreQuiz` already returns the runner-up season and a confidence figure; the result screen shows only the best season. Showing "you are also close to X" when confidence is low needs a wording decision from Joe.
- **Smoother necklines** (V1.1-04). Joe signed off the V-neck and scoop but noted some are still a little jagged along the cut edge. Cause: the cut removes whole mesh faces, so a slanted or curved edge comes out stepped; the V's lower edge near the tip is the worst. Ideas: refine the mesh near the neck before cutting (the cut then follows the curve more closely), or cut faces along the curve instead of deleting whole faces. Any fix must keep the hard mesh checks passing on all seven bodies and leave the crew tee byte-identical unless Joe agrees to change it. Also check the crew neck and the sweatshirt, which use the same cut.
