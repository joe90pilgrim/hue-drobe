"""V5-00: the colour measurement from V2-07, copied unchanged from spike/assets/fit_pack_items.py (lines 67 to 151; spike/ is history and
is not edited). Needs Blender (bpy, numpy). texture_stats(texture path, object with UVs) gives the area-weighted mean colour of the
texture where the mesh uses it, and what a red and a blue picker tint would give as the CIE76 distance from the colour picked."""
import math, os
import bpy
import numpy as np

def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lab(srgb):
    l = srgb_to_lin(srgb)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = M @ l / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def parse_mhmat(path):
    d = {"diffuseTexture": None, "diffuseColor": None, "transparent": False, "opacity": 1.0, "other_textures": []}
    if not path or not os.path.exists(path):
        return d
    for line in open(path, encoding="utf8", errors="replace"):
        w = line.split()
        if len(w) < 2 or line.startswith(("#", "//")):
            continue
        if w[0] == "diffuseTexture":
            d["diffuseTexture"] = os.path.join(os.path.dirname(path), " ".join(w[1:]))
        elif w[0] == "diffuseColor":
            d["diffuseColor"] = [float(x) for x in w[1:4]]
        elif w[0] == "opacity":
            d["opacity"] = float(w[1])
        elif w[0] in ("transparent", "alphaToCoverage") and w[1].lower() == "true":
            d["transparent"] = True
        elif w[0].endswith("Texture") and w[0] != "diffuseTexture":
            d["other_textures"].append(w[0])
    return d


TINTS = {"red_217_51_64": [217, 51, 64], "blue_58_83_140": [58, 83, 140]}


def texture_stats(tex_path, ob):
    """Colour of the texture where the mesh actually uses it: the texel at each face's UV centre, weighted by the face's 3D area
    (so unused atlas space does not count). Reports the mean colour, pattern contrast, and what a plain colour-picker tint
    (glTF baseColorFactor, which multiplies the texture) would give: the effective mean colour and its CIE76 distance from the colour picked."""
    if not tex_path or not os.path.exists(tex_path):
        return None
    img = bpy.data.images.load(tex_path, check_existing=True)
    w, hgt = img.size
    buf = np.empty(w * hgt * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    px = buf.reshape(hgt, w, 4)  # byte images read back as sRGB-encoded 0..1, row 0 at the bottom (v = 0)
    me = ob.data
    uvl = me.uv_layers.active
    if uvl is None:
        return {"size_px": [w, hgt], "error": "no UV layer"}
    uv = np.empty(len(me.loops) * 2, dtype=np.float32)
    uvl.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    samples, weights = [], []
    for poly in me.polygons:
        c = uv[poly.loop_start:poly.loop_start + poly.loop_total].mean(axis=0)
        x, y = int(math.floor((c[0] % 1.0) * w)) % w, int(math.floor((c[1] % 1.0) * hgt)) % hgt
        samples.append(px[y, x])
        weights.append(poly.area)
    S, Wt = np.array(samples, dtype=np.float64), np.array(weights, dtype=np.float64)
    op = S[:, 3] > 0.5
    out = {"size_px": [w, hgt], "file_kb": round(os.path.getsize(tex_path) / 1024), "faces_sampled": int(len(S)),
           "opaque_fraction_of_surface": round(float(Wt[op].sum() / Wt.sum()), 3), "tinted": {}}
    if not op.any():
        return out
    lin = srgb_to_lin(S[op, :3])
    wt = Wt[op] / Wt[op].sum()
    lum = lin @ np.array([0.2126, 0.7152, 0.0722])
    mean_lin = (lin * wt[:, None]).sum(axis=0)
    mlum = float((lum * wt).sum())
    out["mean_srgb_255"] = [int(round(x * 255)) for x in lin_to_srgb(mean_lin)]
    out["luminance_cv"] = round(float(math.sqrt(((lum - mlum) ** 2 * wt).sum()) / max(mlum, 1e-9)), 3)
    for label, t in TINTS.items():
        tl = srgb_to_lin(np.array(t) / 255.0)
        eff = lin_to_srgb(tl * mean_lin) * 255
        out["tinted"][label] = {"effective_mean_srgb_255": [int(round(x)) for x in eff],
                                "delta_e76_from_picked": round(float(np.linalg.norm(lab(eff / 255.0) - lab(np.array(t) / 255.0))), 1)}
    return out
