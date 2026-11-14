# Hue-drobe weekend spike

Throwaway-friendly experiments answering: can we build an accurate body from tape measurements, and fit garments to it?

## Versions
- Blender 5.3.0 (hash 02f0899d78e3), run headlessly
- MPFB 2.0.18 (Blender extension, GPL-3.0-or-later code, CC0 core assets), SHA-256 c075b3e9...a2dad
- three.js 0.170.0, Vite 6.0.7, Node 24

## Layout
- `blender/export_test.py` - Block 0 smoke test, exports a placeholder figure.
- `blender/mpfb_probe.py`, `mpfb_probe2.py` - probes: can MPFB2 be driven headlessly?
- `blender/body_from_measurements.py` - builds a body from a measurements JSON and writes a pass/fail report.
- `viewer/` - minimal three.js viewer (`npm install && npm run dev`), phone-testable over Wi-Fi.

## Run
```
blender --background --python spike/blender/body_from_measurements.py -- private/measurements_joe.json private/out joe
```
Copy the resulting `.glb` into `spike/viewer/public/models/personal/` (git-ignored) and pick it with the viewer buttons.

## Privacy
`private/` and `spike/viewer/public/models/personal/` are git-ignored. Never commit real measurements, photos or personal bodies.
Install MPFB first: Blender Extensions -> MPFB, or `blender --command extension install-file -r user_default --enable <zip>`.
