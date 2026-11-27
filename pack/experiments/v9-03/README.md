# V9-03 spike: can the 3D avatar show patterns?

Throwaway experiment. Nothing here ships, and it changes nothing in `app/src/`, the pack build or any GLB. The write-up is `docs/decisions/2026-11-27-v9-03-3d-pattern-spike.md`.

It reads Joe's built pack (`private/pack/joe/`; build it first with `python pack/build_pack.py --private --only joe`). Output goes to the git-ignored `private/renders/v9-03/`.

| File | What it does |
| --- | --- |
| `inspect_glbs.py` | Q1: lists every GLB in the pack with triangles, `TEXCOORD_0`, `COLOR_0`, materials, textures, UV stretch. Pure Python and numpy. |
| `stretch_object_space.py` | Q2 to Q4: stretch of each object-space pattern on each garment, and what UVs copied from the body would give (islands crossed, stretch, bytes added). |
| `pattern-material.js` | The prototype material tweak (`onBeforeCompile`): horizontal stripes, vertical stripes (two ways), spots (two ways) and flowers, drawn from model-space position. |
| `index.html`, `serve.mjs` | Standalone three.js page and a tiny server for it (three.js from `app/node_modules`, pack from `private/pack/joe`). |
| `capture.mjs` | `render`: front, three-quarter and back PNGs per pattern. `bench`: ms per frame (150 frames, 1-pixel readback each, three runs). |
| `sheet.mjs` | Stitches the renders into one contact sheet. |

Run from the repo root (PowerShell or Git Bash):

```
python pack/experiments/v9-03/inspect_glbs.py
python pack/experiments/v9-03/stretch_object_space.py
node pack/experiments/v9-03/capture.mjs render tee hstripes,vstripes,vstripes_x,spots,flowers
node pack/experiments/v9-03/sheet.mjs tee hstripes,vstripes,vstripes_x tee_stripes 0.5
node pack/experiments/v9-03/capture.mjs bench tee none,hstripes,flowers
```

`capture.mjs` uses the Playwright already in `app/node_modules` (Chromium on the machine's own GPU through ANGLE/D3D11). No new dependency.
