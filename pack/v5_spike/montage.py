"""V5-00: put renders side by side in one picture, for reading. Blender (it has numpy and the PNG reader); no labels, row-major order.

  blender --background --python pack/v5_spike/montage.py -- <out.png> <columns> <image> [<image> ...]

Each image is shown at half size (every second pixel); a missing image is left grey."""
import os, sys
import bpy
import numpy as np

a = sys.argv[sys.argv.index("--") + 1:]
out, cols, paths = os.path.abspath(a[0]), int(a[1]), [os.path.abspath(p) for p in a[2:]]
tiles = []
for p in paths:
    try:
        img = bpy.data.images.load(p)
        w, h = img.size
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        tiles.append(px.reshape(h, w, 4)[::2, ::2])
    except Exception:  # noqa: BLE001
        tiles.append(np.full((450, 450, 4), 0.5, dtype=np.float32))
th, tw = tiles[0].shape[:2]
rows = (len(tiles) + cols - 1) // cols
sheet = np.full((rows * th, cols * tw, 4), 0.5, dtype=np.float32)
for i, t in enumerate(tiles):
    r, c = divmod(i, cols)
    sheet[(rows - 1 - r) * th:(rows - r) * th, c * tw:(c + 1) * tw] = t[:th, :tw]  # image rows run bottom-up
im = bpy.data.images.new("sheet", cols * tw, rows * th)
im.pixels.foreach_set(sheet.ravel())
im.filepath_raw, im.file_format = out, "PNG"
im.save()
print("MONTAGE", out)
