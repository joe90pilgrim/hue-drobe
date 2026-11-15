"""Sample the median colour of rectangles in a photo. Records what colour extraction actually achieves (no white balance).

Run:
  blender --background --python spike/blender/sample_colour.py -- <photo.jpg> <name>:x0,y0,x1,y1 [<name>:x0,y0,x1,y1 ...]
Rectangles are in pixel coordinates with the origin at the top left. Prints median and spread (sRGB 0-255), so a
rectangle that straddles a logo or a shadow shows up as a large spread.
"""
import sys, statistics
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
img = bpy.data.images.load(argv[0])
img.colorspace_settings.name = "Non-Color"  # raw sRGB-encoded values, no conversion
w, h = img.size
px = list(img.pixels)
for spec in argv[1:]:
    nm, box = spec.split(":")
    x0, y0, x1, y1 = [int(v) for v in box.split(",")]
    chans = ([], [], [])
    for y in range(y0, y1, 3):
        row = (h - 1 - y) * w * 4
        for x in range(x0, x1, 3):
            for c in range(3):
                chans[c].append(px[row + x * 4 + c] * 255.0)
    med = [round(statistics.median(c), 1) for c in chans]
    sd = [round(statistics.pstdev(c), 1) for c in chans]
    print("COLOUR", nm, "median_srgb", med, "spread", sd, "hex", "#%02x%02x%02x" % tuple(int(round(m)) for m in med), "image", w, h)
