"""V3-07: fit garment templates (pack/templates/<category>/<id>/meta.json, see pack/templates/README.md) to one person's body.

Generalises V3-06's pack_items.py: the same MPFB loader, plain colour, delete group, body restore, trim_body and "body as drawn" check,
now driven by each template's meta.json instead of a list of pack items. Run by pack/build_pack.py inside Blender; not by hand:
  blender --background --python pack/fit_template.py -- <inner script> <job.json> [--no-hide] :: <the inner script's own arguments>
job.json: {"templates": [<template folder>, ...], "packs_dir": <assets/packs/extracted>, "colour_srgb": [r, g, b]}

It runs the inner script (spike/blender/body_from_measurements.py, or spike/cloth/skirt_cloth.py for a woman) unchanged with runpy, so
the body and the app's own garments are exactly what the pack build makes, then for each template, in layer order (base, bottom, mid,
outer, full):
 1. attaches it with MPFB's own loader (HumanService.add_mhclo_asset): the pack's .mhclo, or the template's own template.mhclo;
 1a. with meta "keep_islands" (V3-07c), deletes every other island of the attached mesh (a suit's trousers, keeping its jacket);
 2. with meta "settle" (V3.1-01, from the V3-14 experiment), runs Blender's cloth on it from the MHCLO fit: pinned on the garment itself
    (settle.pin, chosen on the template's own .obj), colliding with the body, the garments in settle.collide_with and the inner layers
    (grown out from the skin), small pieces following by Surface Deform; with settle.rest "template" its rest shape is the template as
    made (Blender's dynamic base mesh), so it relaxes towards its designed shape instead of the skin-tight fit;
 3. pushes it out of the body by clearance_cm, limited to contact_groups (V3-06's push). Shrinkwrap is never the main fit, and an
    outer garment is not pushed off its inner layers;
 4. bakes it in world space and exports <name>_<pack_file>.glb in plain colour (texture only when colour is "texture": hair, shoes);
    with delete_group, hides the body under it, gives back what the cloth does not cover and exports <name>_body_<pack_file>.glb;
 5. writes into <name>_report.json under "pack_items" (the V3-06 key, so the checks and committed reports carry on): "body as drawn",
    the layer check against each inner layer, and the item's mesh facts. With hide_inner (default for a mid or outer layer with
    inner_layers) each inner layer's faces the item covers are removed and the rest exported as <name>_<inner>_under_<pack_file>.glb,
    which the app draws in place of the inner layer while the item is worn; the layer check runs against that.
    spike/check_reports.py enforces them only when approved is true.
With --no-hide nothing is settled, pushed or hidden, which is how the "body as drawn" check is shown to fail.

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

# V3.1-01: "settle" is Blender's cloth from the MHCLO fit, pinned on the garment itself and colliding with the body, the garments in
# collide_with and the inner layers (the V3-14 experiment, with the V3-15/V3-16 rest shape). Defaults: V3-14's shirt cloth.
SETTLE_DEFAULTS = {"pin": {}, "rest": "fitted", "collide_with": [], "grow_from_skin": [], "frames": 60, "quality": 10, "mass": 0.15,
                   "tension": 15, "compression": 15, "shear": 5, "bending": 0.3, "morph_frames": 20}
SETTLE_LIMITS = {"frames": (10, 300), "quality": (1, 30), "mass": (0.01, 5), "tension": (0.1, 200), "compression": (0.1, 200),
                 "shear": (0.1, 200), "bending": (0.01, 100), "morph_frames": (1, 100)}
WHOLE = ("frames", "quality", "morph_frames")
RESTS = ("fitted", "template")
# Garment-side pins, chosen on the template's own .obj (MakeHuman base space, 1 unit = 10 cm), so the same vertices on every body:
# the top band of the front and of the back across the shoulders (collar, shoulder seams; a deeper back band is a shirt's yoke), and
# optionally the cloth within cuffs_cm of the two sleeve openings.
PIN_DEFAULTS = {"front_cm": 3.5, "back_cm": 8.0, "cuffs_cm": None}
PIN_LIMITS = {"front_cm": (0, 30), "back_cm": (0, 30), "cuffs_cm": (0, 20)}
PIN_COLUMN, PIN_COLLAR_X, PIN_TIP_DROP, PIN_TOP_DEPTH = 0.2, 6, 0.3, 1.5  # units: 2 cm columns; start 6 columns out (past the collar)
# Fixed cloth settings (V3-14 round 2): collision distances, the inner layers' collider growing out from the skin over GROW_FRAMES,
# small pieces (buttons, pockets, cuff pieces: islands under BIG_ISLAND of the garment) following the cloth by Surface Deform.
COLLIDE = {"thickness_outer": 0.002, "friction": 1.0, "cloth_distance": 0.004, "self_distance": 0.002}
AIR_DAMPING, GROW_FRAMES, FOLLOW_FALLOFF, BIG_ISLAND = 1.0, 25, 16.0, 0.10
HIDE_RAY_START, HIDE_RAY_LENGTH = 0.03, 0.08  # hide_inner: a ray from 3 cm under each inner face, out along its normal, up to 8 cm

# V3.1-01: removed with the V3-07b loose fit (CLAUDE.md: no scripted reshaping of garments). validate_meta names them.
REMOVED = {"loose": "the scripted loose fit is gone; a loose item gets its volume from settle (cloth, rest \"template\")",
           "inner_push": "an outer garment is no longer pushed off its inner layers; the covered inner faces are hidden (hide_inner)"}
REMOVED_SETTLE = {"pinned": "body-group pins are gone; use settle.pin (pins on the garment itself)",
                  "pin_above_armpit_cm": "pins by height are gone; use settle.pin (pins on the garment itself)",
                  "pin_small_pieces": "small pieces now follow the cloth (Surface Deform); nothing to set",
                  "gravity_ramp": "gravity is on from the first frame"}


class MetaError(ValueError):
    """A template's meta.json is missing something or has a value the build does not accept."""


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def settle_settings(meta):
    """The template's cloth settings with defaults filled in (pin included), or None when it is not settled (settle "none")."""
    s = meta.get("settle", "none")
    if s == "none":
        return None
    return {**SETTLE_DEFAULTS, **s, "pin": {**PIN_DEFAULTS, **s.get("pin", {})}}


def hides_inner(meta):
    """True when the inner layers' covered faces are hidden: meta hide_inner, by default on for a mid or outer layer with inner_layers."""
    h = meta.get("hide_inner")
    return bool(meta.get("inner_layers")) and (h if isinstance(h, bool) else meta.get("layer") in ("mid", "outer"))


def _validate_settle(m, p):
    s = m["settle"]
    if s == "none":
        return
    if not isinstance(s, dict):
        p.append('settle must be "none" or an object')
        return
    for k in sorted(set(s) & set(REMOVED_SETTLE)):
        p.append(f"settle.{k} was removed in V3.1-01: {REMOVED_SETTLE[k]}")
    unknown = set(s) - set(SETTLE_DEFAULTS) - set(REMOVED_SETTLE)
    if unknown:
        p.append(f"settle has unknown keys {sorted(unknown)}")
    if "pin" not in s:
        p.append("settle needs pin (an object; {} for the defaults: front_cm, back_cm, cuffs_cm)")
    elif not isinstance(s["pin"], dict):
        p.append("settle.pin must be an object")
    else:
        if set(s["pin"]) - set(PIN_DEFAULTS):
            p.append(f"settle.pin has unknown keys {sorted(set(s['pin']) - set(PIN_DEFAULTS))}")
        for k, (a, b) in PIN_LIMITS.items():
            v = s["pin"].get(k, PIN_DEFAULTS[k])
            if not (v is None and k == "cuffs_cm") and not (_num(v) and a <= v <= b and (v > 0 or k != "cuffs_cm")):
                p.append(f"settle.pin.{k} must be a number from {a} to {b}" + (" (above 0) or null" if k == "cuffs_cm" else ""))
    if s.get("rest", "fitted") not in RESTS:
        p.append(f"settle.rest {s.get('rest')!r} is not one of {', '.join(RESTS)}")
    for k in ("collide_with", "grow_from_skin"):
        if not (isinstance(s.get(k, []), list) and all(isinstance(x, str) for x in s.get(k, []))):
            p.append(f"settle.{k} must be a list of garment names")
    if isinstance(s.get("grow_from_skin", []), list) and isinstance(s.get("collide_with", []), list):
        if set(s.get("grow_from_skin", [])) - set(s.get("collide_with", [])):
            p.append("settle.grow_from_skin may only name garments in settle.collide_with (inner layers always grow from the skin)")
        if isinstance(m["inner_layers"], list) and set(s.get("collide_with", [])) & set(m["inner_layers"]):
            p.append("settle.collide_with must not repeat inner_layers (they are colliders already)")
    for k, (a, b) in SETTLE_LIMITS.items():
        if k in s and not (_num(s[k]) and a <= s[k] <= b and (k not in WHOLE or s[k] == int(s[k]))):
            p.append(f"settle.{k} must be a {'whole ' if k in WHOLE else ''}number from {a} to {b}")
    st = {**SETTLE_DEFAULTS, **s}
    if st["rest"] == "template" and _num(st["morph_frames"]) and _num(st["frames"]) and st["morph_frames"] >= st["frames"]:
        p.append("settle.morph_frames must be fewer than settle.frames")


def garment_pins(V0, cloth_v, front_cm, back_cm):
    """Garment-side pins (V3-14), chosen on the template's own vertices V0 (MakeHuman base space: x across, y up, z forward; 1 unit =
    10 cm). Across the shoulders, in each PIN_COLUMN-wide column of the cloth vertices cloth_v out to the shoulder tips (where the top
    line drops more than PIN_TIP_DROP between columns), the front and back are split at the column's mid-depth, and the cloth within
    front_cm / back_cm of each side's top is pinned. Returns (pinned vertex indices, left and right shoulder tip x in units)."""
    front, back = front_cm / 10, back_cm / 10
    bins = {}
    for i in cloth_v:
        bins.setdefault(round(V0[i][0] / PIN_COLUMN), []).append(i)
    ytop = {b: max(V0[i][1] for i in g) for b, g in bins.items()}

    def tip(sign):
        b = PIN_COLLAR_X * sign
        while (b + sign) in ytop and ytop[b] - ytop[b + sign] <= PIN_TIP_DROP:
            b += sign
        return b
    bl, br = tip(-1), tip(1)
    pins = set()
    for b, g in bins.items():
        if not bl <= b <= br:
            continue
        top = [i for i in g if V0[i][1] > ytop[b] - PIN_TOP_DEPTH]
        zmid = (min(V0[i][2] for i in top) + max(V0[i][2] for i in top)) / 2
        for part, bd in (([i for i in g if V0[i][2] >= zmid], front), ([i for i in g if V0[i][2] < zmid], back)):
            if part:
                yt = max(V0[i][1] for i in part)
                pins.update(i for i in part if V0[i][1] >= yt - bd)
    return pins, round(bl * PIN_COLUMN, 1), round(br * PIN_COLUMN, 1)


def cuff_pins(V0, F0, cloth_v, cuffs_cm):
    """V3-16: the cloth within cuffs_cm of the two sleeve openings (the two open-edge loops furthest out in x on the template)."""
    band = cuffs_cm / 10
    cset = set(cloth_v)
    ec = {}
    for f in F0:
        if f[0] in cset:
            for a_, b_ in zip(f, f[1:] + f[:1]):
                k_ = (min(a_, b_), max(a_, b_))
                ec[k_] = ec.get(k_, 0) + 1
    adj = {}
    for (a_, b_), c_ in ec.items():
        if c_ == 1:
            adj.setdefault(a_, set()).add(b_)
            adj.setdefault(b_, set()).add(a_)
    loops, seen = [], set()
    for s0 in adj:
        if s0 not in seen:
            st, comp = [s0], []
            seen.add(s0)
            while st:
                x_ = st.pop()
                comp.append(x_)
                for y_ in adj[x_] - seen:
                    seen.add(y_)
                    st.append(y_)
            loops.append(comp)
    loops.sort(key=lambda L: -abs(sum(V0[i][0] for i in L) / len(L)))
    ring = [i for L in loops[:2] for i in L]
    return {i for i in cloth_v if min(sum((V0[i][t] - V0[j][t]) ** 2 for t in range(3)) for j in ring) <= band ** 2}

# --- V3-07c keep_islands: use part of a pack item (a suit's jacket) by deleting whole islands; pure Python ---------------------------

def read_obj(text):
    """Vertices [(x, y, z)] and faces [[vertex index, ...]] (0-based) of a Wavefront .obj's text."""
    verts, faces = [], []
    for line in text.splitlines():
        if line.startswith("v "):
            verts.append(tuple(float(x) for x in line.split()[1:4]))
        elif line.startswith("f "):
            faces.append([int(t.split("/")[0]) - 1 for t in line.split()[1:]])
    return verts, [[i if i >= 0 else len(verts) + i + 1 for i in f] for f in faces]


def islands(n_verts, faces):
    """The mesh's islands (vertices joined through faces), each a sorted list of vertex indices, largest first; equal sizes in order
    of their lowest vertex index. The numbering keep_islands uses and pack/list_islands.py prints. A vertex in no face is its own island."""
    parent = list(range(n_verts))

    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for f in faces:
        r0 = root(f[0])
        for i in f[1:]:
            ri = root(i)
            if ri != r0:
                parent[ri] = r0
    groups = {}
    for i in range(n_verts):
        groups.setdefault(root(i), []).append(i)
    return sorted(groups.values(), key=lambda g: (-len(g), g[0]))


def kept_vertices(isl, keep, want_vertices):
    """The vertex indices of the islands numbered in keep. Raises ValueError if an index is out of range, or if the kept islands do not
    have want_vertices vertices in all (meta keep_islands_vertices): the pack item is not the mesh the template was set up on."""
    bad = [k for k in keep if k >= len(isl)]
    if bad:
        raise ValueError(f"keep_islands {bad} out of range: the mesh has {len(isl)} islands (0 to {len(isl) - 1})")
    got = sorted(i for k in keep for i in isl[k])
    if len(got) != want_vertices:
        raise ValueError(f"keep_islands {keep} have {len(got)} vertices, meta keep_islands_vertices says {want_vertices}: "
                         "the mesh has changed; check it again with pack/list_islands.py")
    return got


def _validate_keep_islands(m, p):
    ki, kv = m.get("keep_islands"), m.get("keep_islands_vertices")
    if ki is None:
        if kv is not None:
            p.append("keep_islands_vertices is set but keep_islands is not")
        return
    if not isinstance(ki, list) or not ki:
        p.append("keep_islands must be null or a non-empty list of island indices")
    elif not all(isinstance(k, int) and not isinstance(k, bool) and k >= 0 for k in ki):
        p.append("keep_islands must hold whole numbers from 0 (islands numbered by pack/list_islands.py)")
    elif len(set(ki)) != len(ki):
        p.append("keep_islands has duplicate indices")
    if not (isinstance(kv, int) and not isinstance(kv, bool) and kv > 0):
        p.append("keep_islands needs keep_islands_vertices: the kept islands' vertex count, from pack/list_islands.py")


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
    for k in sorted(set(m) & set(REMOVED)):
        p.append(f"{k} was removed in V3.1-01: {REMOVED[k]}")
    if "hide_inner" in m and not isinstance(m["hide_inner"], bool):
        p.append("hide_inner must be true or false")
    elif m.get("hide_inner") is True and not m["inner_layers"]:
        p.append("hide_inner needs inner_layers")
    _validate_settle(m, p)
    _validate_keep_islands(m, p)
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

    report_path = os.path.join(out_dir, name + "_report.json")
    report = json.load(open(report_path))
    report["pack_items"] = {}
    full_bm = mesh_checks.load_glb(BODY_GLB)
    full_m = mesh_checks.merged(full_bm)
    floor = min(v.co.z for v in full_m.verts)
    full_tree = BVHTree.FromBMesh(full_m)

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

    def collider(cname, path, grow, trees):
        """A cloth collider from a built GLB (triangulated, single-sided, so cloth on the wrong side is pushed out along its normals).
        With grow, its basis shape lies on the skin and a shape key moves it out to where it really is over GROW_FRAMES: the cloth
        starts inside it (the MHCLO fit lies on the skin) and is carried out with it. Animates the collider only, never the garment."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"{cname} was not built before this template ({path})")
        bm = mesh_checks.load_glb(path)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.normal_update()
        trees[cname] = BVHTree.FromBMesh(bm)
        me = bpy.data.meshes.new(f"fit_col_{cname}")
        bm.to_mesh(me)
        bm.free()
        co = bpy.data.objects.new(f"fit_col_{cname}", me)
        sc.collection.objects.link(co)
        if grow and GROW_FRAMES:
            btree = trees["body"]
            sk0 = co.shape_key_add(name="on_skin")
            for v in co.data.vertices:
                loc, nor, _i, _d = btree.find_nearest(v.co)
                sk0.data[v.index].co = loc + nor * 0.001
            sk1 = co.shape_key_add(name="worn", from_mix=False)
            for v in co.data.vertices:
                sk1.data[v.index].co = v.co
            sk1.value = 0.0
            sk1.keyframe_insert("value", frame=1)
            sk1.value = 1.0
            sk1.keyframe_insert("value", frame=1 + GROW_FRAMES)
        co.modifiers.new("Collision", "COLLISION")
        c = co.collision
        c.thickness_outer, c.cloth_friction = COLLIDE["thickness_outer"], COLLIDE["friction"]
        c.use_culling = c.use_normal = True
        return co

    def cloth_settle(wm, meta, s, mhclo, kept):
        """V3.1-01 (from the V3-14 experiment, with V3-15/V3-16's rest shape): Blender cloth on the garment from its MHCLO fit, in place
        (wm, world space), pinned on the garment itself (garment_pins, cuff_pins on the template's .obj), colliding with the body, the
        garments in collide_with and the inner layers. Small pieces follow the cloth by Surface Deform. With rest "template" the cloth's
        rest lengths go from the fit to the template as made over morph_frames (Blender's dynamic base mesh; rest_shape_key is ignored
        headless, pack/experiments/v3-15/rest_key_check.py). kept: the .obj vertex index of each wm vertex. Returns the numbers."""
        t0 = time.time()
        n = len(wm.vertices)
        faces = [list(p_.vertices) for p_ in wm.polygons]
        isl = islands(n, faces)
        cloth_v = sorted(i for g in isl if len(g) >= BIG_ISLAND * n for i in g)
        follow_v = sorted(set(range(n)) - set(cloth_v))
        obj_file = next(l.split(None, 1)[1].strip() for l in open(mhclo, encoding="utf8", errors="replace") if l.startswith("obj_file"))
        V0a, F0a = read_obj(open(os.path.join(os.path.dirname(mhclo), obj_file), encoding="utf8", errors="replace").read())
        new_of = {o: k for k, o in enumerate(kept)}
        V0 = [V0a[o] for o in kept]
        F0 = [[new_of[i] for i in f] for f in F0a if f[0] in new_of]
        assert len(V0) == n, f"template .obj keeps {len(V0)} vertices, the attached mesh has {n}"
        assert [len(g) for g in islands(n, F0)] == [len(g) for g in isl], "template .obj and attached mesh islands differ"
        pins, x_l, x_r = garment_pins(V0, cloth_v, s["pin"]["front_cm"], s["pin"]["back_cm"])
        shoulder_pins = set(pins)
        cuffs = cuff_pins(V0, F0, cloth_v, s["pin"]["cuffs_cm"]) if s["pin"]["cuffs_cm"] else set()
        pins |= cuffs
        W = {i: wm.vertices[i].co.copy() for i in range(n)}

        trees, temp = {}, []
        names = ["body"] + s["collide_with"] + meta["inner_layers"]
        grow = set(meta["inner_layers"]) | set(s["grow_from_skin"])
        for cn in names:
            path = BODY_GLB if cn == "body" else os.path.join(out_dir, f"{name}_{cn}.glb")
            temp.append(collider(cn, path, cn in grow, trees))

        ci = {v: k for k, v in enumerate(cloth_v)}
        cm = bpy.data.meshes.new("fit_cloth")
        cm.from_pydata([W[v] for v in cloth_v], [], [[ci[i] for i in f] for f in faces if f[0] in ci])
        cloth_ob = bpy.data.objects.new("fit_cloth", cm)
        sc.collection.objects.link(cloth_ob)
        temp.append(cloth_ob)
        cloth_ob.vertex_groups.new(name="pin").add([ci[i] for i in pins], 1.0, "REPLACE")
        out = {"rest": s["rest"], "pinned_vertices": len(pins), "cuff_pinned_vertices": len(cuffs), "pin_cm": s["pin"],
               "pin_shoulder_x_cm": [x_l * 10, x_r * 10], "cloth_vertices": len(cloth_v), "follower_vertices": len(follow_v),
               "colliders": names, "grown_from_skin": sorted(grow), "frames": s["frames"]}
        if s["rest"] == "template":
            # the template as made (base space to Blender: (x, -z, y) / 10), scaled once, uniformly, so its pinned shoulder span is
            # the fit's, and moved so the shoulder pins' centres meet; pinned vertices keep the fit (their goal)
            Rv = [Vector((V0[v][0], -V0[v][2], V0[v][1])) * 0.1 for v in cloth_v]
            pk = [ci[i] for i in shoulder_pins]
            pin_all = {ci[i] for i in pins}
            span_fit = max(W[cloth_v[k]].x for k in pk) - min(W[cloth_v[k]].x for k in pk)
            sc_ = span_fit / (max(Rv[k].x for k in pk) - min(Rv[k].x for k in pk))
            c_fit = sum((W[cloth_v[k]] for k in pk), Vector()) / len(pk)
            c_t = sum((Rv[k] * sc_ for k in pk), Vector()) / len(pk)
            T = [W[cloth_v[k]] if k in pin_all else Rv[k] * sc_ + (c_fit - c_t) for k in range(len(Rv))]
            cloth_ob.shape_key_add(name="Basis")
            rk = cloth_ob.shape_key_add(name="rest", from_mix=False)
            for k, p_ in enumerate(T):
                rk.data[k].co = p_
            rk.value = 0.0
            rk.keyframe_insert("value", frame=1)
            rk.value = 1.0
            rk.keyframe_insert("value", frame=1 + s["morph_frames"])
            out.update({"rest_scale": round(sc_, 4), "pin_span_fit_cm": round(span_fit * 100, 1), "morph_frames": s["morph_frames"]})
        follow_ob = fi = None
        if follow_v:
            fi = {v: k for k, v in enumerate(follow_v)}
            fm = bpy.data.meshes.new("fit_follow")
            fm.from_pydata([W[v] for v in follow_v], [], [[fi[i] for i in f] for f in faces if f[0] in fi])
            follow_ob = bpy.data.objects.new("fit_follow", fm)
            sc.collection.objects.link(follow_ob)
            temp.append(follow_ob)

        mod = cloth_ob.modifiers.new("Cloth", "CLOTH")
        cs = mod.settings
        cs.quality, cs.mass = s["quality"], s["mass"]
        cs.tension_stiffness, cs.compression_stiffness = s["tension"], s["compression"]
        cs.shear_stiffness, cs.bending_stiffness = s["shear"], s["bending"]
        cs.air_damping, cs.vertex_group_mass, cs.pin_stiffness = AIR_DAMPING, "pin", 1.0
        cs.use_dynamic_mesh = s["rest"] == "template"
        cc = mod.collision_settings
        cc.use_collision, cc.distance_min, cc.collision_quality = True, COLLIDE["cloth_distance"], 5
        cc.use_self_collision, cc.self_distance_min = True, COLLIDE["self_distance"]
        was = (sc.frame_start, sc.frame_end, sc.frame_current)
        sc.frame_start, sc.frame_end = 1, s["frames"]
        mod.point_cache.frame_start, mod.point_cache.frame_end = 1, s["frames"]
        bpy.context.view_layer.update()
        sc.frame_set(0)
        if follow_ob is not None:
            sd = follow_ob.modifiers.new("SD", "SURFACE_DEFORM")
            sd.target, sd.falloff = cloth_ob, FOLLOW_FALLOFF
            bpy.context.view_layer.objects.active = follow_ob
            with bpy.context.temp_override(object=follow_ob, active_object=follow_ob, selected_objects=[follow_ob]):
                bpy.ops.object.surfacedeform_bind(modifier="SD")
            out["followers_bound"] = bool(sd.is_bound)
        for f in range(1, s["frames"] + 1):
            sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = cloth_ob.evaluated_get(dg).data
        moved = []
        for v, k in ci.items():
            p_ = ev.vertices[k].co.copy()
            moved.append((p_ - W[v]).length)
            W[v] = p_
        if follow_ob is not None:
            fe = follow_ob.evaluated_get(dg).data
            for v, k in fi.items():
                W[v] = fe.vertices[k].co.copy()
        for v in range(n):
            wm.vertices[v].co = W[v]
        wm.update()
        for o in temp:
            bpy.data.objects.remove(o)
        sc.frame_start, sc.frame_end = was[:2]
        sc.frame_set(was[2])
        moved.sort()
        out["moved_cm_median_p99_max"] = [round(moved[len(moved) // 2] * 100, 2), round(moved[int(len(moved) * 0.99)] * 100, 2),
                                          round(moved[-1] * 100, 2)]
        out["seconds"] = round(time.time() - t0, 1)
        return out

    def hide_covered(item_bm, inner_, pf):
        """V3.1-01 (V3-14): the inner layer as drawn under this item. A ray from HIDE_RAY_START under each inner face, out along its
        normal, that meets the item marks the face covered; covered faces are removed (as the body is under the dress) and the rest is
        exported, with the inner layer's own material, as <name>_<inner>_under_<pack_file>.glb. Returns (path, faces, faces hidden)."""
        otb = item_bm.copy()
        bmesh.ops.triangulate(otb, faces=otb.faces[:])
        otree = BVHTree.FromBMesh(otb)
        otb.free()
        io_ = import_glb(os.path.join(out_dir, f"{name}_{inner_}.glb"))
        bm = bmesh.new()
        bm.from_mesh(io_.data)
        bm.normal_update()
        covered = [f for f in bm.faces if otree.ray_cast(f.calc_center_median() - f.normal * HIDE_RAY_START, f.normal, HIDE_RAY_LENGTH)[0] is not None]
        total = len(bm.faces)
        bmesh.ops.delete(bm, geom=covered, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(io_.data)
        bm.free()
        path = os.path.join(out_dir, f"{name}_{inner_}_under_{pf}.glb")
        export_glb(io_, path)
        bpy.data.objects.remove(io_)
        return path, total, len(covered)

    def joined(*bms):
        out = bmesh.new()
        for x in bms:
            me_ = bpy.data.meshes.new("joined")
            x.to_mesh(me_)
            out.from_mesh(me_)
            bpy.data.meshes.remove(me_)
        return out

    for meta in metas:
        tid, pf = meta["id"], meta["pack_file"]
        hides = HIDE and meta["delete_group"]
        R = {"template": tid, "category": meta["category"], "layer": meta["layer"], "source": meta["source"], "licence": meta["licence"],
             "approved": meta["approved"], "delete_group": meta["delete_group"], "hides_body": hides, "inner_layers": meta["inner_layers"]}
        report["pack_items"][pf] = R
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
            kept = list(range(len(wm.vertices)))  # the template .obj's vertex index of each wm vertex
            if meta.get("keep_islands") is not None:  # V3-07c: only these islands go on; the rest are deleted before any fitting
                _kb = bmesh.new()
                _kb.from_mesh(wm)
                _kb.verts.ensure_lookup_table()
                _isl = islands(len(_kb.verts), [[v.index for v in f.verts] for f in _kb.faces])
                kept = kept_vertices(_isl, meta["keep_islands"], meta["keep_islands_vertices"])
                _keep = set(kept)
                bmesh.ops.delete(_kb, geom=[v for v in _kb.verts if v.index not in _keep], context="VERTS")
                _kb.to_mesh(wm)
                _kb.free()
                R["keep_islands"] = {"kept": meta["keep_islands"], "islands_in_source": len(_isl),
                                     "vertices_kept": len(_keep), "vertices_removed": sum(map(len, _isl)) - len(_keep),
                                     "kept_island_vertices": [len(_isl[k]) for k in meta["keep_islands"]]}
            iob = bpy.data.objects.new(f"{name}_{pf}", wm)
            sc.collection.objects.link(iob)
            _sb = bmesh.new()  # the item exactly as the pack fits it: the control, which must cross the whole body or the check proves nothing
            _sb.from_mesh(wm)
            bmesh.ops.triangulate(_sb, faces=_sb.faces[:])
            R["pairs_with_whole_body_as_shipped"] = len(full_tree.overlap(BVHTree.FromBMesh(_sb)))
            _sb.free()

            # 2. settle (only when meta "settle" is set): Blender cloth, pinned on the garment, colliding with the body, collide_with and
            # the inner layers, on one thread (build_pack.py), fixed frames
            st = settle_settings(meta)
            if st is not None and HIDE:
                R["settle"] = cloth_settle(wm, meta, st, mhclo, kept)

            # 3. push out of the body (V3-06's push, kept exactly: two passes; a vertex pushed off one face can land inside the next).
            # Inner layers are not pushed off: with hide_inner their covered faces are hidden after export.
            clear = meta["clearance_cm"] / 100
            close = [signed_to_body(v.co) for v in wm.vertices]
            R["item_vertices_pushed_out_of_skin"] = sum(d < clear for d in close)
            R["deepest_push_cm"] = round(max([clear - d for d in close if d < clear], default=0.0) * 100, 2)
            if HIDE:  # --no-hide leaves the item as the pack fits it, so the check shows what it is for
                contact = garment_group(iob, "contact", meta["contact_groups"])
                R["contact_vertices"] = len(contact)
                for _pass in range(2):
                    for vi in contact:
                        v = wm.vertices[vi]
                        loc, nor, _i, d = full_tree.find_nearest(v.co)
                        if (d if (v.co - loc).dot(nor) > 0 else -d) < clear:
                            v.co = loc + nor * clear
            R["min_clearance_to_body_after_push_cm"] = round(min(signed_to_body(v.co) for v in wm.vertices) * 100, 2)
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
            # the V3-05 layer check against each inner layer: as drawn under this item (hide_inner), else the whole inner layer
            R["hides_inner"] = HIDE and hides_inner(meta)
            if meta["inner_layers"]:
                R["layers"], whole, drawn = {}, [], []
                for inner_ in meta["inner_layers"]:
                    ipath = os.path.join(out_dir, f"{name}_{inner_}.glb")
                    if not os.path.exists(ipath):
                        raise FileNotFoundError(f"inner layer {inner_} was not built before {tid} ({ipath})")
                    ib = mesh_checks.load_glb(ipath)
                    whole.append(ib)
                    if not R["hides_inner"]:
                        R["layers"][inner_] = mesh_checks.layers({pf: item_bm}, {inner_: ib})[pf][inner_]
                        continue
                    upath, nf, nh = hide_covered(item_bm, inner_, pf)
                    db = mesh_checks.load_glb(upath)
                    drawn.append(db)
                    R["layers"][inner_] = (mesh_checks.layers({pf: item_bm}, {inner_: db})[pf][inner_] if len(db.faces)
                                           else {"intersecting_pairs": 0, "inner_inside_clearance_cm": {"min": None}})
                    R.setdefault("inner_hidden", {})[inner_] = {
                        "glb": os.path.basename(upath), "faces": nf, "faces_hidden": nh, "glb_kb": round(os.path.getsize(upath) / 1024),
                        "info_pairs_with_whole_inner": mesh_checks.layers({pf: item_bm}, {inner_: ib})[pf][inner_]["intersecting_pairs"]}
                if drawn:  # information: the body and the inner layers as drawn together, under the item (gap rays see through both)
                    full_j, drawn_j = joined(full_bm, *whole), joined(mesh_checks.load_glb(body_glb), *drawn)
                    bad_ = mesh_checks.body_as_drawn(full_j, drawn_j, item_bm, floor, tol)
                    R["info_body_and_inner_as_drawn"] = {k: bad_[k] for k in ("visible_body_intersecting_pairs", "gap_rays", "gap_by_z_cm",
                                                                             "worst_view")}
                    full_j.free()
                    drawn_j.free()
                for b_ in whole + drawn:
                    b_.free()
            for m in new_mods:
                h.modifiers.remove(m)
            bpy.data.objects.remove(iob)
            bpy.data.objects.remove(ob)
            bpy.data.meshes.remove(wm)
            R["status"] = "ok"
        except Exception as e:  # noqa: BLE001  recorded; check_reports.py fails the build on it
            R["status"] = "failed: " + repr(e)
            R["traceback"] = traceback.format_exc()
        print("TEMPLATE", name, tid, R.get("status"), json.dumps(R.get("body_as_drawn", {})), flush=True)

    json.dump(report, open(report_path, "w"), indent=2)
    print("TEMPLATES DONE", name, "%.0f s" % (time.time() - T0))


if __name__ == "__main__":
    run()
