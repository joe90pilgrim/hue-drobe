# Backlog

Ideas noticed while working a ticket, not done. Each line says where it came from.

- **Loosen the fit for Joe only** (MVP-03). The eases in `pack/fit_config.json` are the largest that pass on all seven bodies, set by the widest synthetic body. Joe's own body has room for looser garments; a per-body ease would need a decision on the data model. Revisit after Joe's sign-off in MVP-04/05.
- **Committed reports from the pack's garments** (MVP-03). `spike/fixtures/reports/` still holds the spike's reports, built with `--drape` and real-item-style garment numbers. `npm run check` therefore validates those, not the garments the pack ships. Replacing them is a reviewed edit.
- **A `--config` option on `build_pack.py`** (MVP-03) to try a fit config without editing the committed file.
- **Serve `private/pack/` to the app** (MVP-03 to MVP-04). The pack is written to `private/pack/joe/`, outside the app. MVP-04 needs a small Vite dev-server route or a copy step. Keep it out of `dist/` until MVP-10 decides whether the body may be deployed.
