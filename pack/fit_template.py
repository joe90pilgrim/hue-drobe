"""V3-07: fit garment templates (pack/templates/<category>/<id>/meta.json, see pack/templates/README.md) to one person's body.

Generalises V3-06's pack_items.py: the same MPFB loader, plain colour, delete group, body restore, trim_body and "body as drawn" check,
now driven by each template's meta.json instead of a list of pack items. Run by pack/build_pack.py inside Blender; not by hand:
  blender --background --python pack/fit_template.py -- <inner script> <job.json> [--no-hide] :: <the inner script's own arguments>
job.json: {"templates": [<template folder>, ...], "packs_dir": <assets/packs/extracted>, "colour_srgb": [r, g, b]}

It runs the inner script (spike/blender/body_from_measurements.py, or spike/cloth/skirt_cloth.py for a woman) unchanged with runpy, so
the body and the app's own garments are exactly what the pack build makes, then for each template, in layer order (base, bottom, mid,
outer, full):
 1. attaches it with MPFB's own loader (HumanService.add_mhclo_asset): the pack's .mhclo, or the template's own template.mhclo;
 1b. with meta "loose" (V3-07b), lowers the hem and moves the cloth out to hang off the torso (loose_fit);
 2. settles it with a short Blender cloth pass, pinned groups held (only when meta "settle" is set; V3-00's skirt settings);
 3. pushes it out with Shrinkwrap modifiers in Blender's 'Outside' mode (only vertices inside, or closer than clearance_cm, move),
    limited to contact_groups, against the body and then each garment in inner_layers (or, with inner_push "body_normal",
    along the body's normal). Shrinkwrap is never the main fit;
 4. bakes it in world space and exports <name>_<pack_file>.glb in plain colour (texture only when colour is "texture": hair, shoes);
    with delete_group, hides the body under it, gives back what the cloth does not cover and exports <name>_body_<pack_file>.glb;
 5. writes into <name>_report.json under "pack_items" (the V3-06 key, so the checks and committed reports carry on): "body as drawn",
    the layer check against each inner layer, and the item's mesh facts. spike/check_reports.py enforces them only when approved is true.
With --no-hide nothing is pushed or hidden, which is how the "body as drawn" check is shown to fail.

The functions above run() need no Blender: build_pack.py and pack/test_fit_template.py use them to load and validate meta.json.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER_DIR = os.path.normpath(os.path.join(HERE, "..", "spike", "blender"))
TEMPLATES_DIR = os.path.join(HERE, "templates")
LAYERS = ("base", "bottom", "mid", "outer", "full")  # also the fitting order: what goes under is fitted first
BODIES = ("female", "male", "both")
LICENCES = ("CC0", "CC-BY")
COLOURS = ("plain", "texture")
TEXTURE_CATEGORIES = ("hair", "shoes")  # Joe, 16 Nov 2026: every other garment is plain colour
def pack_licence_error(pack_lic, meta):
    """Error text if the pack's own licence for an item can't be used for this template, else None (V3-07a): the pack must say the
    same licence as the template, which must be CC0, or CC-BY with a credit."""
    if pack_lic != meta.get("licence") or pack_lic not in LICENCES:
        return f"licensed {pack_lic!r} by its pack and {meta.get('licence')!r} by template {meta.get('id')}; only {', '.join(LICENCES)} are used"
    if pack_lic == "CC-BY" and not (isinstance(meta.get("credit"), str) and meta["credit"].strip()):
        return f"is CC-BY but template {meta.get('id')} has no credit"
    return None


REQUIRED = ("id", "category", "layer", "allowed_bodies", "source", "licence", "sha256", "delete_group", "settle", "contact_groups",
            "clearance_cm", "replaces", "inner_layers", "approved", "colour")
SETTLE_KEYS = ("pinned", "pin_above_armpit_cm", "pin_small_pieces", "frames", "quality", "mass", "tension", "compression", "shear", "bending", "gravity_ramp")
SETTLE_DEFAULTS = {"frames": 60, "quality": 10, "mass": 0.3, "tension": 15, "compression": 15, "shear": 5, "bending": 5.0,
                   "gravity_ramp": 20}  # spike/cloth/skirt_cloth.py (V3-00/V3-01a), fewer frames: a settle, not a full drape


# V3-07b: optional fields, off unless set. "loose" lets a template stand off the torso; "inner_push" picks how it is kept off inner layers.
LOOSE_DEFAULTS = {"ease_fraction": 0.06, "drape_taper": 0.25, "fade_cm": 6.0, "smooth_iterations": 6, "hem_to_crotch_cm": None,
                  "hem_from_crotch_cm": 20.0, "hem_curve_keep": 1.0, "chest_above_armpit_cm": 10.0}
LOOSE_LIMITS = {"ease_fraction": (0, 0.3), "drape_taper": (0, 2), "fade_cm": (0, 30), "smooth_iterations": (0, 50),
                "hem_to_crotch_cm": (-40, 40), "hem_from_crotch_cm": (5, 60), "hem_curve_keep": (0, 1),
                "chest_above_armpit_cm": (0, 20)}
INNER_PUSH = ("shrinkwrap", "body_normal")


class MetaError(ValueError):
    """A template's meta.json is missing something or has a value the build does not accept."""


def loose_settings(meta):
    """The template's loose-fit settings with defaults filled in, or None when it is fitted as the .mhclo binds it (the default)."""
    lo = meta.get("loose", "none")
    return None if lo == "none" else {**LOOSE_DEFAULTS, **lo}


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _validate_loose(m, p):
    lo = m.get("loose", "none")
    if lo != "none":
        if not isinstance(lo, dict):
            p.append('loose must be "none" or an object')
        else:
            if set(lo) - set(LOOSE_DEFAULTS):
                p.append(f"loose has unknown keys {sorted(set(lo) - set(LOOSE_DEFAULTS))}")
            for k, (a, b) in LOOSE_LIMITS.items():
                if k in lo and not (lo[k] is None and k == "hem_to_crotch_cm") and not (_num(lo[k]) and a <= lo[k] <= b):
                    p.append(f"loose.{k} must be a number from {a} to {b}" + (" or null" if k == "hem_to_crotch_cm" else ""))
            if "smooth_iterations" in lo and _num(lo["smooth_iterations"]) and lo["smooth_iterations"] != int(lo["smooth_iterations"]):
                p.append("loose.smooth_iterations must be a whole number")
    if m.get("inner_push", "shrinkwrap") not in INNER_PUSH:
        p.append(f"inner_push {m.get('inner_push')!r} is not one of {', '.join(INNER_PUSH)}")


# --- V3-07b loose fit: pure Python, so pack/test_fit_template.py can test it without Blender -------------------------------------

def split_by_gap(xs, gap):
    """Indices of xs grouped into runs along x, split wherever two neighbouring values are more than gap apart. Sorted by x."""
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    runs = []
    for i in order:
        if runs and xs[i] - xs[runs[-1][-1]] <= gap:
            runs[-1].append(i)
        else:
            runs.append([i])
    return runs


def convex_hull(pts):
    """2-D convex hull (Andrew's monotone chain), counter-clockwise, no repeated first point."""
    pts = sorted(set(pts))
    if len(pts) < 3:
        return pts
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for q in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0:
            lo.pop()
        lo.append(q)
    for q in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], q) <= 0:
            up.pop()
        up.append(q)
    return lo[:-1] + up[:-1]


def hull_radii(hull, centre, nbins):
    """Distance from centre to the hull's edge along each of nbins equal directions (bin b points at angle 2*pi*b/nbins), and the
    hull's perimeter. The centre should be inside the hull; a direction that meets no edge gets the furthest hull point's distance."""
    import math
    n = len(hull)
    per = sum(math.dist(hull[i], hull[(i + 1) % n]) for i in range(n))
    far = max((math.dist(p, centre) for p in hull), default=0.0)
    r = []
    for k in range(nbins):
        ux, uy = math.cos(2 * math.pi * k / nbins), math.sin(2 * math.pi * k / nbins)
        best = 0.0
        for i in range(n):
            (ax, ay), (bx, by) = hull[i], hull[(i + 1) % n]
            ex, ey, wx, wy = bx - ax, by - ay, ax - centre[0], ay - centre[1]
            den = ux * ey - uy * ex
            if abs(den) < 1e-12:
                continue
            t, s = (wx * ey - wy * ex) / den, (wx * uy - wy * ux) / den
            if t > 0 and -1e-9 <= s <= 1 + 1e-9:
                best = max(best, t)
        r.append(best or far)
    return r, per


def drape_envelope(zs, radii, perims, ease_fraction, taper):
    """How far out a loose top hangs at each height and direction: the torso's hull plus ease (ease_fraction of the hull's perimeter,
    as a radius), or, where a band above sticks out further, that band's surface stepping in by taper per metre of drop, so the cloth
    falls from the bust and the belly instead of following the body in under them. zs ascending; radii[k][b] for band k, direction b."""
    import math
    nb = len(radii[0]) if radii else 0
    own = [[radii[k][b] + ease_fraction * perims[k] / (2 * math.pi) for b in range(nb)] for k in range(len(zs))]
    env = [row[:] for row in own]
    for k in range(len(zs) - 2, -1, -1):  # from the top down: each band is at least the band above, stepped in
        dz = zs[k + 1] - zs[k]
        env[k] = [max(own[k][b], env[k + 1][b] - taper * dz) for b in range(nb)]
    return env


def smooth_up(grid, iterations):
    """Spreads a grid of outward moves (rows: heights, columns: directions round the body, wrapping) so neighbouring cloth moves
    together and the move reads as ease, not as a bump. Never lowers a cell: what each cell needs to clear the envelope is kept."""
    g = [row[:] for row in grid]
    nk, nb = len(g), len(g[0]) if g else 0
    for _ in range(iterations):
        g = [[max(g[k][b], (g[k][b - 1] + g[k][(b + 1) % nb] + g[max(k - 1, 0)][b] + g[min(k + 1, nk - 1)][b]) / 4.0)
              for b in range(nb)] for k in range(nk)]
    return g


def torso_bands(BV, cz, xc, dz=0.01, gap=0.05, jump=0.06, half=0.015, persist=3, above=0.0):
    """The torso's vertices in horizontal bands dz apart, from z_start = cz + 12 cm (the lower belly). BV: body vertex (x, y, z) list,
    cz: crotch height, xc: the body's centre x. In each band the vertices within half of it are split into runs along x wherever two
    neighbours are more than gap apart (the mesh is coarse: 2-4 cm gaps inside one torso slice, more between torso and arm in the
    A-pose). The start band takes the run nearest xc; each band above and below takes the runs overlapping the band before it. Going
    up, the armpit is the last band before the torso widens by more than jump (the arms join it) in persist bands running;
    one odd band on the coarse mesh is skipped (a single band once put the armpit 32 cm low on synthetic_female_large). Going down it carries on
    35 cm below the crotch (both legs), for tails that hang below it. Above the armpit it carries on for `above` metres with only the
    vertices inside the torso's x range at the armpit (the chest and upper back, not the shoulders or arms).
    Returns ({band offset k: [vertex indices]}, armpit height)."""
    import math
    buckets = {}
    for i, p in enumerate(BV):
        buckets.setdefault(int(math.floor(p[2] / dz)), []).append(i)

    def band(z):
        k0 = int(math.floor(z / dz))
        n = int(math.ceil(half / dz))
        return [i for kk in range(k0 - n, k0 + n + 1) for i in buckets.get(kk, []) if abs(BV[i][2] - z) <= half]

    def pick(idx, rng):
        runs = split_by_gap([BV[i][0] for i in idx], gap)
        if rng is None:
            best = min(runs, key=lambda r: min(abs(BV[idx[j]][0] - xc) for j in r))
            sel = [best]
        else:
            sel = [r for r in runs if BV[idx[r[-1]]][0] >= rng[0] - 0.01 and BV[idx[r[0]]][0] <= rng[1] + 0.01]
        pts = [idx[j] for r in sel for j in r]
        return pts, ((min(BV[i][0] for i in pts), max(BV[i][0] for i in pts)) if pts else rng)

    z_start = cz + 0.12
    start, rng0 = pick(band(z_start), None)
    bands = {0: start}
    rng, k, last, armpit = rng0, 0, 0, None
    while True:  # up to the armpit: the torso must widen in `persist` bands running; a single odd band is skipped
        k += 1
        pts, nr = pick(band(z_start + k * dz), rng)
        if not pts or nr[1] - nr[0] > rng[1] - rng[0] + jump:
            if k - last >= persist:
                armpit = z_start + last * dz
                break
            continue
        bands[k], rng, last = pts, nr, k
    if armpit is not None:
        lo_x, hi_x = rng
        for k in range(last + 1, last + 1 + int(round(above / dz))):
            pts = [i for i in band(z_start + k * dz) if lo_x <= BV[i][0] <= hi_x]
            if pts:
                bands[k] = pts
    rng, k = rng0, 0
    while z_start + (k - 1) * dz > cz - 0.35:  # down past the crotch, for tails that hang below it
        k -= 1
        pts, nr = pick(band(z_start + k * dz), rng)
        if not pts:
            break
        bands[k], rng = pts, nr
    return bands, armpit


def hem_lower(z, z_from, z_lowest, z_target):
    """New height for a cloth vertex when the hem is lowered from z_lowest to z_target: everything below z_from is stretched down
    evenly, so the hem keeps its shape (a shirt's curved tails stay curved). Unchanged above z_from, or when the hem is already low enough."""
    if z >= z_from or z_target >= z_lowest or z_lowest >= z_from:
        return z
    return z_from - (z_from - z) * (z_from - z_target) / (z_from - z_lowest)


def validate_meta(m, where="meta.json"):
    """Returns the meta with defaults filled in (pack_file), or raises MetaError naming every problem."""
    if not isinstance(m, dict):
        raise MetaError(f"{where}: not a JSON object")
    p = [f"missing field {f!r}" for f in REQUIRED if f not in m]
    if "licence" not in m or not m.get("licence"):
        p = [x for x in p if "'licence'" not in x] + ["no licence: every template needs one (CC0 or CC-BY)"]
    if p:
        raise MetaError(f"{where}: " + "; ".join(p))
    if m["licence"] not in LICENCES:
        p.append(f"licence {m['licence']!r} is not allowed (only {', '.join(LICENCES)})")
    if m["licence"] == "CC-BY" and not (isinstance(m.get("credit"), str) and m["credit"].strip()):
        p.append("a CC-BY template needs a credit (author, title, source) for assets/packs/CREDITS.md")
    if m["layer"] not in LAYERS:
        p.append(f"unknown layer {m['layer']!r} (one of {', '.join(LAYERS)})")
    if m["allowed_bodies"] not in BODIES:
        p.append(f"allowed_bodies {m['allowed_bodies']!r} is not one of {', '.join(BODIES)}")
    for f in ("id", "category"):
        if not (isinstance(m[f], str) and re.fullmatch(r"[a-z0-9_]+", m[f])):
            p.append(f"{f} {m[f]!r} must be lower-case letters, digits and underscores")
    if "pack_file" in m and not (isinstance(m["pack_file"], str) and re.fullmatch(r"[a-z0-9_]+", m["pack_file"])):
        p.append(f"pack_file {m['pack_file']!r} must be lower-case letters, digits and underscores")
    src = m["source"]
    if not isinstance(src, dict) or not (("pack" in src and "asset" in src) ^ ("url" in src)):
        p.append('source must be {"pack": ..., "asset": ...} or {"url": ...}')
    if not (isinstance(m["sha256"], str) and re.fullmatch(r"[0-9a-f]{64}", m["sha256"])):
        p.append("sha256 must be 64 lower-case hex digits")
    for f in ("delete_group", "approved"):
        if not isinstance(m[f], bool):
            p.append(f"{f} must be true or false")
    s = m["settle"]
    if s != "none":
        if not isinstance(s, dict) or not ((s.get("pinned") and isinstance(s["pinned"], list) and all(isinstance(g, str) for g in s["pinned"]))
                                           or "pin_above_armpit_cm" in s):
            p.append('settle must be "none" or an object with a non-empty "pinned" list of body vertex groups or "pin_above_armpit_cm"')
        elif "pin_above_armpit_cm" in s and not (_num(s["pin_above_armpit_cm"]) and -20 <= s["pin_above_armpit_cm"] <= 30):
            p.append("settle.pin_above_armpit_cm must be a number from -20 to 30")
        elif "pin_above_armpit_cm" in s and m.get("loose", "none") == "none":
            p.append("settle.pin_above_armpit_cm needs loose (the armpit is found there)")
        elif set(s) - set(SETTLE_KEYS):
            p.append(f"settle has unknown keys {sorted(set(s) - set(SETTLE_KEYS))}")
    for f in ("contact_groups", "replaces", "inner_layers"):
        if not isinstance(m[f], list) or not all(isinstance(x, str) for x in m[f]):
            p.append(f"{f} must be a list of names")
    if isinstance(m["contact_groups"], list) and not m["contact_groups"]:
        p.append('contact_groups is empty (use ["all"] for the whole garment)')
    if isinstance(m["replaces"], list) and set(m["replaces"]) - set(LAYERS):
        p.append(f"replaces names unknown layers {sorted(set(m['replaces']) - set(LAYERS))}")
    if not isinstance(m["clearance_cm"], (int, float)) or isinstance(m["clearance_cm"], bool) or not 0 < m["clearance_cm"] <= 5:
        p.append("clearance_cm must be a number above 0 and at most 5")
    if m["colour"] not in COLOURS:
        p.append(f"colour {m['colour']!r} is not one of {', '.join(COLOURS)}")
    elif m["colour"] == "texture" and m["category"] not in TEXTURE_CATEGORIES:
        p.append("only hair and shoes keep a texture; every other garment is plain colour")
    _validate_loose(m, p)
    if p:
        raise MetaError(f"{where}: " + "; ".join(p))
    return {**m, "pack_file": m.get("pack_file") or m["id"]}


def load_meta(folder):
    """The template in folder (pack/templates/<category>/<id>/), validated, with "dir" added. The folder names must match id and category."""
    path = os.path.join(folder, "meta.json")
    if not os.path.exists(path):
        raise MetaError(f"{path}: no meta.json")
    try:
        m = json.load(open(path, encoding="utf8"))
    except json.JSONDecodeError as e:
        raise MetaError(f"{path}: not valid JSON ({e})") from None
    m = validate_meta(m, path)
    norm = os.path.normpath(os.path.abspath(folder))
    if os.path.basename(norm) != m["id"] or os.path.basename(os.path.dirname(norm)) != m["category"]:
        raise MetaError(f"{path}: the folder must be <category>/<id>, here {m['category']}/{m['id']}")
    if "url" in m["source"] and not any(os.path.exists(os.path.join(folder, f)) for f in ("template.mhclo",)):
        raise MetaError(f"{path}: a template from outside the packs needs template.mhclo (run pack/author_template.py)")
    return {**m, "dir": norm}


def find_templates(root=TEMPLATES_DIR):
    """Every template under root, in fitting order. Raises MetaError on the first bad one, and on two with the same pack_file."""
    metas = []
    for cat in sorted(os.listdir(root)) if os.path.isdir(root) else []:
        cdir = os.path.join(root, cat)
        for tid in sorted(os.listdir(cdir)) if os.path.isdir(cdir) else []:
            if os.path.isdir(os.path.join(cdir, tid)):
                metas.append(load_meta(os.path.join(cdir, tid)))
    seen = {}
    for m in metas:
        if m["pack_file"] in seen:
            raise MetaError(f"templates {seen[m['pack_file']]} and {m['id']} both write {m['pack_file']}.glb")
        seen[m["pack_file"]] = m["id"]
    return sorted(metas, key=lambda m: (LAYERS.index(m["layer"]), m["id"]))


def for_body(metas, sex):
    """The templates a body of this sex ("female" or "male") gets."""
    return [m for m in metas if m["allowed_bodies"] in ("both", sex)]


def mhclo_path(meta, packs_dir):
    """The .mhclo MPFB attaches: the pack's own for a pack item (unpacked by build_pack.prepare_templates), else template.mhclo."""
    src = meta["source"]
    if "pack" in src:
        folder = "hair" if meta["category"] == "hair" else "clothes"
        return os.path.join(packs_dir, src["pack"], folder, src["asset"], src["asset"] + ".mhclo")
    return os.path.join(meta["dir"], "template.mhclo")


def enforced(meta):
    """True once Joe has approved the look: only then do the template's numbers fail the build."""
    return meta["approved"] is True


def run():
    import runpy, time, traceback
    import bpy

    args = sys.argv[sys.argv.index("--") + 1:]
    sep = args.index("::")
    own, inner_args = args[:sep], args[sep + 1:]
    inner, job_path = own[0], own[1]
    HIDE = "--no-hide" not in own
    inner_name = os.path.basename(inner)
    meas_path, out_dir, name = (inner_args[0], inner_args[1], inner_args[2]) if inner_name == "body_from_measurements.py" else (inner_args[0], inner_args[2], inner_args[3])
    T0 = time.time()

    sys.argv = [sys.argv[0], "--"] + inner_args
    ns = runpy.run_path(inner, run_name="__main__")
    body_ns = ns["G"] if isinstance(ns.get("G"), dict) and "eval_bm" in ns["G"] else ns  # skirt_cloth.py keeps the body script's globals in G
    h, eval_bm = body_ns["h"], body_ns["eval_bm"]

    import bmesh
    from mathutils import Matrix, Vector
    from mathutils.kdtree import KDTree
    from mathutils.bvhtree import BVHTree

    sys.path.insert(0, BLENDER_DIR)
    import mesh_checks
    from bl_ext.user_default.mpfb.services.humanservice import HumanService

    job = json.load(open(job_path))
    metas = sorted((load_meta(d) for d in job["templates"]), key=lambda m: (LAYERS.index(m["layer"]), m["id"]))
    tol = json.load(open(os.path.join(HERE, "..", "spike", "tolerances.json")))["pack_item_body_as_drawn"]
    BODY_GLB = os.path.join(out_dir, name + ".glb")
    sc = bpy.context.scene

    def lin(rgb):
        f = lambda c: (c / 255.0) / 12.92 if c / 255.0 <= 0.04045 else (((c / 255.0) + 0.055) / 1.055) ** 2.4
        return (f(rgb[0]), f(rgb[1]), f(rgb[2]), 1)

    def export_glb(ob, path):
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)
        return os.path.getsize(path)

    def import_glb(path):
        """The GLB's mesh as one object in world space (other imported objects removed)."""
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]
        ob = next(o for o in new if o.type == "MESH")
        ob.data.transform(ob.matrix_world)
        ob.parent = None
        ob.matrix_world = Matrix.Identity(4)
        for o in new:
            if o is not ob:
                bpy.data.objects.remove(o)
        return ob

    def trim_body(body_glb, item_glb):
        """Takes out of the exported body (as MPFB's delete group left it) every face that still crosses the item: skin poking through the
        cloth where the delete group stops short, such as at the shoulders. Works on the exported triangles, which is what the phone draws,
        and writes the body GLB again with its material. Returns the number of faces taken out. Whether this leaves a hole that shows is
        what the gap rays in the "body as drawn" check are for."""
        ob = import_glb(body_glb)
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bm.faces.ensure_lookup_table()
        item = mesh_checks.merged(mesh_checks.load_glb(item_glb))
        hit = {a for a, _ in BVHTree.FromBMesh(bm).overlap(BVHTree.FromBMesh(item))}
        item.free()
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in sorted(hit)], context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(ob.data)
        bm.free()
        export_glb(ob, body_glb)
        bpy.data.objects.remove(ob)
        return len(hit)

    def tris(bm):
        return sum(len(f.verts) - 2 for f in bm.faces)

    def apply_modifiers(ob, me):
        """Bakes ob's modifier stack into me's vertex positions (same vertex count) and removes the modifiers."""
        bpy.context.view_layer.update()
        ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
        em = ev.to_mesh()
        assert len(em.vertices) == len(me.vertices), "a modifier changed the garment's vertex count"
        moved = max(((a.co - b.co).length for a, b in zip(me.vertices, em.vertices)), default=0.0)
        for a, b in zip(me.vertices, em.vertices):
            a.co = b.co
        ev.to_mesh_clear()
        ob.modifiers.clear()
        return moved

    report_path = os.path.join(out_dir, name + "_report.json")
    report = json.load(open(report_path))
    report["pack_items"] = {}
    full_bm = mesh_checks.load_glb(BODY_GLB)
    full_m = mesh_checks.merged(full_bm)
    floor = min(v.co.z for v in full_m.verts)
    full_tree = BVHTree.FromBMesh(full_m)
    body_ob = bpy.data.objects.new(f"{name}_fit_body", bpy.data.meshes.new(f"{name}_fit_body"))  # the body as exported: push-out target and collider
    full_m.to_mesh(body_ob.data)
    sc.collection.objects.link(body_ob)
    body_ob.hide_render = True

    # The body with every modifier off (the base mesh's own vertices, helpers included), for the delete-group restore and for mapping
    # garment vertices to the body's vertex groups (contact_groups, settle pinned).
    # Read again after each template is attached, as V3-06's pack_items.py did: read once before, the large synthetic woman kept 19 gap rays.
    def read_body():
        _was = {m.name: m.show_viewport for m in h.modifiers}
        for m in h.modifiers:
            m.show_viewport = False
        fb_ = eval_bm(h)
        for m in h.modifiers:
            m.show_viewport = _was[m.name]
        bpy.context.view_layer.update()
        fb_.verts.ensure_lookup_table()
        fb_.normal_update()
        assert len(fb_.verts) == len(h.data.vertices), "evaluated body and base mesh differ in vertex count"
        kd_ = KDTree(len(fb_.verts))
        for q_ in fb_.verts:
            kd_.insert(q_.co, q_.index)
        kd_.balance()
        return fb_, kd_

    fb, kd = read_body()
    nbrs = {}
    for e in h.data.edges:
        a_, b_ = e.vertices
        nbrs.setdefault(a_, []).append(b_)
        nbrs.setdefault(b_, []).append(a_)

    def garment_group(ob, gname, body_groups):
        """A vertex group on the garment: every vertex for ["all"], else those whose nearest body vertex is in one of body_groups."""
        if body_groups == ["all"]:
            idx = [v.index for v in ob.data.vertices]
        else:
            missing = [g for g in body_groups if g not in h.vertex_groups]
            if missing:
                raise ValueError(f"body has no vertex group {missing}")
            gi = {h.vertex_groups[g].index for g in body_groups}
            member = [any(g.group in gi and g.weight > 0 for g in v.groups) for v in h.data.vertices]
            idx = [v.index for v in ob.data.vertices if member[kd.find(v.co)[1]]]
        vg = ob.vertex_groups.new(name=gname)
        vg.add(idx, 1.0, "REPLACE")
        return idx

    def signed_to_body(co):
        loc, nor, _i, d = full_tree.find_nearest(co)
        return d if (co - loc).dot(nor) > 0 else -d

    full_kd = KDTree(len(full_m.verts))
    for q_ in full_m.verts:
        full_kd.insert(q_.co, q_.index)
    full_kd.balance()

    def loose_fit(wm, lo):
        """V3-07b: lets a template stand off the torso as a loose top does. Works on the body as exported, in 1 cm horizontal bands:
        the torso in each band is found by following it up and down from the lower belly (in the A-pose the arms and hands are
        separate in x below the armpit; the armpit is where the torso suddenly widens). Optionally lowers the hem first
        (hem_to_crotch_cm, stretching the cloth below hem_from_crotch_cm evenly). Then every garment vertex whose nearest body vertex is
        torso, below the armpit, is moved straight out from the torso's centre line to at least drape_envelope(): the band's convex hull
        (so no cleavage or tuck under the bust) plus ease, or the cloth hanging from a fuller band above. The move is set per height
        and direction (smooth_up), not per vertex, so layered pieces (placket, pockets, buttons) keep their order, and it fades to
        nothing over fade_cm below the armpit, so the shoulders and sleeves stay as fitted. Only Blender's own data; no physics."""
        import math
        dz, nb = 0.01, 72
        BV = [(q.co.x, q.co.y, q.co.z) for q in full_m.verts]
        top, bot = max(p[2] for p in BV), min(p[2] for p in BV)
        cz = body_ns.get("crotch_z")
        xc = sum(p[0] for p in BV) / len(BV)
        if not isinstance(cz, (int, float)):  # the lowest body point on the centre line above the knees
            cz = min(p[2] for p in BV if abs(p[0] - xc) < 0.01 and p[2] > bot + 0.35 * (top - bot))
        bands, armpit = torso_bands(BV, cz, xc, dz, above=lo["chest_above_armpit_cm"] / 100)
        z_top = armpit + lo["chest_above_armpit_cm"] / 100  # the loose zone's top: the move fades out over fade_cm below it
        z_start = cz + 0.12  # torso_bands' start band
        if armpit < cz + 0.25:  # the torso was not followed up to the chest: fail loudly rather than fit a shirt that is not loose
            raise ValueError(f"loose fit: armpit found at {armpit * 100:.1f} cm, only {(armpit - cz) * 100:.1f} cm above the crotch "
                             f"({len(BV)} body vertices, centre x {xc * 100:.1f} cm, {len(bands)} bands)")
        ks = sorted(bands)
        zs = [z_start + kk * dz for kk in ks]
        torso = {i for kk in ks for i in bands[kk]}
        hulls = [convex_hull([(BV[i][0], BV[i][1]) for i in bands[kk]]) for kk in ks]
        mid = [h_ for h_, z in zip(hulls, zs) if cz <= z <= armpit] or hulls
        cx = sum(sum(p[0] for p in h_) / len(h_) for h_ in mid) / len(mid)
        cy = sum(sum(p[1] for p in h_) / len(h_) for h_ in mid) / len(mid)
        rp = [hull_radii(h_, (cx, cy), nb) for h_ in hulls]
        env = drape_envelope(zs, [r for r, _ in rp], [p for _, p in rp], lo["ease_fraction"], lo["drape_taper"])

        tv = [v.index for v in wm.vertices if v.co.z < z_top and full_kd.find(v.co)[1] in torso]
        out = {"crotch_z_cm": round(cz * 100, 1), "armpit_z_cm": round(armpit * 100, 1), "torso_bands": len(zs),
               "torso_vertices": len(tv)}
        if lo["hem_to_crotch_cm"] is not None:
            z_from, z_target = cz + lo["hem_from_crotch_cm"] / 100, cz + lo["hem_to_crotch_cm"] / 100
            # each direction round the body is lowered to its own target: the lowest point to z_target, the rest keeping
            # hem_curve_keep of how far above the lowest point they were (1: the hem's shape kept, 0: a level hem)
            nh = 36
            hx = sum(wm.vertices[i].co.x for i in tv) / len(tv)
            hy = sum(wm.vertices[i].co.y for i in tv) / len(tv)
            hb = {i: math.atan2(wm.vertices[i].co.y - hy, wm.vertices[i].co.x - hx) / (2 * math.pi) * nh % nh for i in tv}
            low = [None] * nh
            for i in tv:
                b = int(hb[i]) % nh
                z = wm.vertices[i].co.z
                low[b] = z if low[b] is None else min(low[b], z)
            known = [b for b in range(nh) if low[b] is not None]
            for b in range(nh):  # empty directions: the nearer known one
                if low[b] is None:
                    low[b] = low[min(known, key=lambda j: min(abs(j - b), nh - abs(j - b)))]
            z_low = min(low)
            for i in tv:
                f = hb[i] - 0.5
                b0, t = int(f // 1) % nh, f - f // 1
                L = low[b0] * (1 - t) + low[(b0 + 1) % nh] * t
                wm.vertices[i].co.z = hem_lower(wm.vertices[i].co.z, z_from, L, z_target + lo["hem_curve_keep"] * (L - z_low))
            out["hem_lowered_cm"] = round(max(0.0, z_low - z_target) * 100, 1)

        fade = max(lo["fade_cm"] / 100, 1e-6)
        w = lambda z: (lambda t: t * t * (3 - 2 * t))(min(max((z_top - z) / fade, 0.0), 1.0))
        polar = {}
        grid = [[0.0] * nb for _ in zs]
        for i in tv:
            c = wm.vertices[i].co
            th = math.atan2(c.y - cy, c.x - cx)
            fk = min(max((c.z - zs[0]) / dz, 0.0), len(zs) - 1.0)
            fb = th / (2 * math.pi) * nb % nb
            polar[i] = (th, fk, fb)
            kk, bb = int(round(fk)), int(round(fb)) % nb
            grid[kk][bb] = max(grid[kk][bb], (env[kk][bb] - math.hypot(c.x - cx, c.y - cy)) * w(c.z))
        grid = smooth_up(grid, int(lo["smooth_iterations"]))
        largest = moved = 0
        for i, (th, fk, fb) in polar.items():
            k0, b0 = int(fk), int(fb)
            k1, b1, tk, tb = min(k0 + 1, len(zs) - 1), (b0 + 1) % nb, fk - int(fk), fb - int(fb)
            d = ((grid[k0][b0] * (1 - tb) + grid[k0][b1] * tb) * (1 - tk) + (grid[k1][b0] * (1 - tb) + grid[k1][b1] * tb) * tk)
            if d > 0:
                c = wm.vertices[i].co
                c.x, c.y = c.x + math.cos(th) * d, c.y + math.sin(th) * d
                largest, moved = max(largest, d), moved + (d > 0.001)
        out["vertices_moved_out"], out["largest_move_out_cm"] = moved, round(largest * 100, 2)
        return out, cz, armpit, set(tv)

    def hem_heights(wm, tv, cz):
        """Lowest and highest point of the hem: the lowest open edge of the torso cloth in each of 36 directions round the body."""
        import math
        count = {}
        for poly in wm.polygons:
            for ek in poly.edge_keys:
                count[ek] = count.get(ek, 0) + 1
        edge_v = {i for ek, n in count.items() if n == 1 for i in ek if i in tv and wm.vertices[i].co.z < cz + 0.25}
        if not edge_v:
            return None
        cx = sum(wm.vertices[i].co.x for i in edge_v) / len(edge_v)
        cy = sum(wm.vertices[i].co.y for i in edge_v) / len(edge_v)
        low = {}
        for i in edge_v:
            c = wm.vertices[i].co
            b = int(math.atan2(c.y - cy, c.x - cx) / (2 * math.pi) * 36) % 36
            low[b] = min(low.get(b, 9.0), c.z)
        return [round(min(low.values()) * 100, 1), round(max(low.values()) * 100, 1)]

    for meta in metas:
        tid, pf = meta["id"], meta["pack_file"]
        hides = HIDE and meta["delete_group"]
        R = {"template": tid, "category": meta["category"], "layer": meta["layer"], "source": meta["source"], "licence": meta["licence"],
             "approved": meta["approved"], "delete_group": meta["delete_group"], "hides_body": hides, "inner_layers": meta["inner_layers"]}
        report["pack_items"][pf] = R
        inner_obs = []
        try:
            mhclo = mhclo_path(meta, job["packs_dir"])
            before_mods = {m.name for m in h.modifiers}
            ob = HumanService.add_mhclo_asset(mhclo, h, asset_type="Hair" if meta["category"] == "hair" else "Clothes", subdiv_levels=0,
                                              material_type="GAMEENGINE", set_up_rigging=False, interpolate_weights=False,
                                              import_subrig=False, import_weights=False)
            bpy.context.view_layer.update()
            new_mods = [m for m in h.modifiers if m.name not in before_mods]
            for m in new_mods:
                m.show_viewport = False
            fb, kd = read_body()
            wm = ob.data.copy()  # the item in world space, to settle, push and test on; the MPFB object stays until the body is exported
            wm.transform(ob.matrix_world)
            iob = bpy.data.objects.new(f"{name}_{pf}", wm)
            sc.collection.objects.link(iob)
            _sb = bmesh.new()  # the item exactly as the pack fits it: the control, which must cross the whole body or the check proves nothing
            _sb.from_mesh(wm)
            bmesh.ops.triangulate(_sb, faces=_sb.faces[:])
            R["pairs_with_whole_body_as_shipped"] = len(full_tree.overlap(BVHTree.FromBMesh(_sb)))
            _sb.free()

            # 1b. loose (V3-07b, only when meta "loose" is set): hem lowered, cloth moved out to hang off the torso
            lo = loose_settings(meta)
            loose_tv, _armpit = None, None
            if lo is not None and HIDE:
                t1 = time.time()
                R["loose"], loose_cz, _armpit, loose_tv = loose_fit(wm, lo)
                R["loose"]["seconds"] = round(time.time() - t1, 1)

            # 2. settle (loose garments only): a short cloth pass with the pinned groups held, on one thread (build_pack.py), fixed frames
            if meta["settle"] != "none" and HIDE and ("pin_above_armpit_cm" not in meta["settle"] or lo is not None):
                s = {**SETTLE_DEFAULTS, **meta["settle"]}
                t1 = time.time()
                if "pin_above_armpit_cm" in s:  # V3-07b: hang from the shoulders: pin everything above a height, plus small loose pieces
                    pz = _armpit + s["pin_above_armpit_cm"] / 100
                    pin_idx = {v.index for v in wm.vertices if v.co.z >= pz}
                    if s.get("pin_small_pieces", True):  # buttons and pocket flaps are separate pieces; cloth would drop them
                        _pb = bmesh.new()
                        _pb.from_mesh(wm)
                        _pb.verts.ensure_lookup_table()
                        seen_ = set()
                        for v0 in _pb.verts:
                            if v0.index in seen_:
                                continue
                            comp, stack = [], [v0]
                            seen_.add(v0.index)
                            while stack:
                                q = stack.pop()
                                comp.append(q.index)
                                for e in q.link_edges:
                                    o_ = e.other_vert(q)
                                    if o_.index not in seen_:
                                        seen_.add(o_.index)
                                        stack.append(o_)
                            if len(comp) < 0.02 * len(wm.vertices):
                                pin_idx.update(comp)
                        _pb.free()
                    iob.vertex_groups.new(name="pin").add(sorted(pin_idx), 1.0, "REPLACE")
                    R["settle"] = {"pinned_vertices": len(pin_idx), "pinned_above_z_cm": round(pz * 100, 1), "frames": s["frames"]}
                else:
                    R["settle"] = {"pinned_vertices": len(garment_group(iob, "pin", s["pinned"])), "frames": s["frames"]}
                col = body_ob.modifiers.new("Collision", "COLLISION")
                body_ob.collision.thickness_outer = 0.002
                body_ob.collision.cloth_friction = 5.0
                cm = iob.modifiers.new("Cloth", "CLOTH")
                cs = cm.settings
                cs.quality, cs.mass = s["quality"], s["mass"]
                cs.tension_stiffness, cs.compression_stiffness = s["tension"], s["compression"]
                cs.shear_stiffness, cs.bending_stiffness = s["shear"], s["bending"]
                cs.air_damping, cs.vertex_group_mass, cs.pin_stiffness = 1.0, "pin", 1.0
                if s["gravity_ramp"] > 0:
                    cs.effector_weights.gravity = 0.0
                    cs.effector_weights.keyframe_insert("gravity", frame=1)
                    cs.effector_weights.gravity = 1.0
                    cs.effector_weights.keyframe_insert("gravity", frame=1 + s["gravity_ramp"])
                cc = cm.collision_settings
                cc.use_collision, cc.distance_min, cc.collision_quality = True, 0.005, 5
                cc.use_self_collision, cc.self_distance_min = True, 0.003
                was_frames = (sc.frame_start, sc.frame_end, sc.frame_current)
                sc.frame_start, sc.frame_end = 1, s["frames"]
                cm.point_cache.frame_start, cm.point_cache.frame_end = 1, s["frames"]
                sc.frame_set(0)
                for f in range(1, s["frames"] + 1):
                    sc.frame_set(f)
                R["settle"]["largest_move_cm"] = round(apply_modifiers(iob, wm) * 100, 2)
                R["settle"]["seconds"] = round(time.time() - t1, 1)
                body_ob.modifiers.remove(col)
                iob.animation_data_clear()
                sc.frame_start, sc.frame_end = was_frames[:2]
                sc.frame_set(was_frames[2])

            # 3. push out of the body, then out of each inner layer: Blender's Shrinkwrap in 'Outside' mode moves only the vertices that
            # are inside the target or closer than its offset, so the garment keeps its own shape everywhere else
            clear = meta["clearance_cm"] / 100
            close = [signed_to_body(v.co) for v in wm.vertices]
            R["item_vertices_pushed_out_of_skin"] = sum(d < clear for d in close)
            R["deepest_push_cm"] = round(max([clear - d for d in close if d < clear], default=0.0) * 100, 2)
            if HIDE:  # --no-hide leaves the item as the pack fits it, so the check shows what it is for
                contact = garment_group(iob, "contact", meta["contact_groups"])
                R["contact_vertices"] = len(contact)
                # Off the body: V3-06's push, kept exactly (two passes; a vertex pushed off one face can land inside the next). With a
                # Shrinkwrap in 'Outside' mode here instead, the dress left 19 gap rays on synthetic_female_large (V3-07 record).
                for _pass in range(2):
                    for vi in contact:
                        v = wm.vertices[vi]
                        loc, nor, _i, d = full_tree.find_nearest(v.co)
                        if (d if (v.co - loc).dot(nor) > 0 else -d) < clear:
                            v.co = loc + nor * clear
                targets = []  # off each inner layer: Shrinkwrap in 'Outside' mode
                for inner_name_ in meta["inner_layers"]:
                    path = os.path.join(out_dir, f"{name}_{inner_name_}.glb")
                    if not os.path.exists(path):
                        raise FileNotFoundError(f"inner layer {inner_name_} was not built before {tid} ({path})")
                    io_ = import_glb(path)
                    io_.hide_render = True
                    inner_obs.append(io_)
                    targets.append(io_)
                if targets and meta.get("inner_push", "shrinkwrap") == "body_normal":
                    # V3-07b: off each inner layer along the body's own normal. From the nearest skin point a ray goes straight out; if
                    # it meets the inner layer from inside (within 5 cm) and the garment is not clearance_cm beyond it, the garment
                    # vertex moves out along that normal. Where the inner layer stops (a tee's short sleeve) the ray meets nothing and
                    # nothing moves, so the cloth is no longer dragged to the inner layer's open edge.
                    trees = []
                    for tgt in targets:
                        _tb = bmesh.new()
                        _tb.from_mesh(tgt.data)
                        bmesh.ops.triangulate(_tb, faces=_tb.faces[:])
                        trees.append(BVHTree.FromBMesh(_tb))
                        _tb.free()
                    largest = 0.0
                    for _pass in range(2):
                        for vi in contact:
                            v = wm.vertices[vi]
                            loc, nor, _i, _d = full_tree.find_nearest(v.co)
                            dg = (v.co - loc).dot(nor)
                            for tr in trees:
                                hit, hn, _i, _d = tr.ray_cast(loc + nor * 0.0005, nor, 0.05)
                                if hit is not None and hn.dot(nor) > 0:
                                    need = (hit - loc).dot(nor) + clear - dg
                                    if need > 0:
                                        v.co += nor * need
                                        dg += need
                                        largest = max(largest, need)
                    R["largest_push_off_inner_layers_cm"] = round(largest * 100, 2)
                else:
                    for i_, tgt in enumerate(targets):
                        sw = iob.modifiers.new(f"push_{i_}", "SHRINKWRAP")
                        sw.target, sw.wrap_method, sw.wrap_mode = tgt, "NEAREST_SURFACEPOINT", "OUTSIDE"
                        sw.offset, sw.vertex_group = clear, "contact"
                    if targets:
                        R["largest_push_off_inner_layers_cm"] = round(apply_modifiers(iob, wm) * 100, 2)
            R["min_clearance_to_body_after_push_cm"] = round(min(signed_to_body(v.co) for v in wm.vertices) * 100, 2)
            if loose_tv is not None:
                R["loose"]["hem_z_cm"] = hem_heights(wm, loose_tv, loose_cz)
            for vg_ in list(iob.vertex_groups):
                iob.vertex_groups.remove(vg_)

            # 4. hide the body under it: MPFB's delete group, less what the cloth does not cover
            hidden = restored = 0
            masks = []
            if hides:
                # Hide only what the cloth covers: a body vertex stays in the pack's delete group only if the item lies outside it along
                # its own normal (within 10 cm). Where the pack's group reaches past the item's edge (the shoulders and neckline of a
                # tank-style dress), the vertex comes back, so the viewer sees skin there and not the inside of the cloth.
                _ib = bmesh.new()
                _ib.from_mesh(wm)
                bmesh.ops.triangulate(_ib, faces=_ib.faces[:])
                _tree = BVHTree.FromBMesh(_ib)
                for m in new_mods:
                    if m.type == "MASK" and m.vertex_group in h.vertex_groups:
                        vg = h.vertex_groups[m.vertex_group]
                        members = {v.index for v in h.data.vertices if any(g.group == vg.index and g.weight > 0 for g in v.groups)}
                        drop = []
                        for vi in sorted(members):
                            q = fb.verts[vi]
                            loc, nor, _i, _d = _tree.ray_cast(q.co - q.normal * 0.005, q.normal, 0.10)
                            if loc is None or nor.dot(q.normal) <= 0:
                                drop.append(vi)
                        # a few rings of body vertices around each uncovered one come back too: skin just inside the cloth's edge can
                        # be seen from above through the neckline, which the normal test alone does not catch
                        edge = set(drop)
                        for _ring in range(tol["restore_rings"]):
                            edge = {n for q_ in edge for n in nbrs.get(q_, []) if n in members and n not in drop}
                            drop += sorted(edge)
                        hidden += len(members) - len(drop)
                        if drop:
                            vg.remove(drop)
                        restored += len(drop)
                        masks.append((vg, members - set(drop)))
                _ib.free()
            for m in new_mods:
                m.show_viewport = hides
            bpy.context.view_layer.update()
            body_glb = os.path.join(out_dir, f"{name}_body_{pf}.glb") if meta["delete_group"] else BODY_GLB
            glb = os.path.join(out_dir, f"{name}_{pf}.glb")

            def export_hidden():
                """The body as the app would draw it while this item is worn (the pack's delete group as it now stands), then the faces
                that still cross the cloth taken out. A template without a delete group is worn over the whole body (body.glb)."""
                if not meta["delete_group"]:
                    return 0
                bpy.context.view_layer.update()
                _e = h.evaluated_get(bpy.context.evaluated_depsgraph_get())
                _hb = bpy.data.objects.new(f"{name}_body_{pf}", bpy.data.meshes.new_from_object(_e))
                sc.collection.objects.link(_hb)
                export_glb(_hb, body_glb)
                bpy.data.objects.remove(_hb)
                return trim_body(body_glb, glb) if hides else 0

            # 5. export the item in plain colour (texture only for hair and shoes); the MPFB object stays where MPFB put it until the
            # end, because taking it off the body upsets the body's own helper mask
            keep_texture = meta["colour"] == "texture"
            if not keep_texture:
                wm.materials.clear()
                m_ = bpy.data.materials.new(pf)
                m_.use_nodes = True
                m_.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = lin(job["colour_srgb"])
                wm.materials.append(m_)
                while wm.uv_layers:
                    wm.uv_layers.remove(wm.uv_layers[0])
            R["glb_kb"] = round(export_glb(iob, glb) / 1024)
            R["texture_kept"] = keep_texture
            item_bm = mesh_checks.load_glb(glb)
            im = mesh_checks.merged(item_bm)
            R["triangles"] = tris(im)
            R["top_z_m"], R["bottom_z_m"] = round(max(v.co.z for v in im.verts), 3), round(min(v.co.z for v in im.verts), 3)
            R["pieces"], R["openings"] = len(mesh_checks.pieces(im)), len(mesh_checks.openings(im))
            R["info_self_intersecting_pairs"] = mesh_checks.self_intersections(im, BVHTree.FromBMesh(im), floor)[0]
            R["info_clearance_to_full_body_cm"] = mesh_checks.clearance_cm(im, full_tree)
            im.free()
            if meta["inner_layers"]:  # the V3-05 layer check against each garment it is worn over
                inners = {n_: mesh_checks.load_glb(os.path.join(out_dir, f"{name}_{n_}.glb")) for n_ in meta["inner_layers"]}
                R["layers"] = mesh_checks.layers({pf: item_bm}, inners)[pf]
            # Export, check, and where a gap ray shows the inside of the cloth where skin was removed, give back the body vertices nearest
            # to what that ray would have seen, then export and check again. The final check is the same independent function either way.
            R["body_faces_trimmed_where_skin_pokes_through"] = 0
            R["repair_rounds"] = 0
            rounds = job.get("max_repair_rounds", 6)
            for _round in range(rounds + 1):
                R["body_faces_trimmed_where_skin_pokes_through"] = export_hidden()
                gaps_seen = []
                t1 = time.time()
                R["body_as_drawn"] = mesh_checks.body_as_drawn(full_bm, mesh_checks.load_glb(body_glb), item_bm, floor, tol, gaps_seen)
                R["body_as_drawn"]["seconds"] = round(time.time() - t1, 1)
                if not hides or not gaps_seen or _round == rounds:
                    break
                R["repair_rounds"] += 1
                for vg, still in masks:
                    give = set()
                    for _a, _e, loc_b, *_r in gaps_seen:
                        for _co, ix, _d in kd.find_n(Vector(loc_b), 4):
                            give.add(ix)
                    edge = set(give)
                    for _ring in range(tol["restore_rings"]):
                        edge = {n for q_ in edge for n in nbrs.get(q_, []) if n in still and n not in give}
                        give |= edge
                    give &= still
                    if give:
                        vg.remove(sorted(give))
                    still -= give
                    restored += len(give)
                    hidden -= len(give)
            R["body_vertices_hidden"] = hidden
            R["body_vertices_restored_where_cloth_does_not_cover"] = restored
            R["body_glb_kb"] = round(os.path.getsize(body_glb) / 1024) if meta["delete_group"] else 0
            for m in new_mods:
                h.modifiers.remove(m)
            bpy.data.objects.remove(iob)
            bpy.data.objects.remove(ob)
            bpy.data.meshes.remove(wm)
            R["status"] = "ok"
        except Exception as e:  # noqa: BLE001  recorded; check_reports.py fails the build on it
            R["status"] = "failed: " + repr(e)
            R["traceback"] = traceback.format_exc()
        for io_ in inner_obs:
            bpy.data.objects.remove(io_)
        print("TEMPLATE", name, tid, R.get("status"), json.dumps(R.get("body_as_drawn", {})), flush=True)

    json.dump(report, open(report_path, "w"), indent=2)
    print("TEMPLATES DONE", name, "%.0f s" % (time.time() - T0))


if __name__ == "__main__":
    run()
