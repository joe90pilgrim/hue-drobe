"""V3-07: fit garment templates (pack/templates/<category>/<id>/meta.json, see pack/templates/README.md) to one person's body.

Generalises V3-06's pack_items.py: the same MPFB loader, plain colour, delete group, body restore, trim_body and "body as drawn" check,
now driven by each template's meta.json instead of a list of pack items. Run by pack/build_pack.py inside Blender; not by hand:
  blender --background --python pack/fit_template.py -- <inner script> <job.json> [--no-hide] :: <the inner script's own arguments>
job.json: {"templates": [<template folder>, ...], "packs_dir": <assets/packs/extracted>, "colour_srgb": [r, g, b]}

It runs the inner script (spike/blender/body_from_measurements.py, or spike/cloth/skirt_cloth.py for a woman) unchanged with runpy, so
the body and the app's own garments are exactly what the pack build makes, then for each template, in layer order (base, bottom, mid,
outer, full):
 1. attaches it with MPFB's own loader (HumanService.add_mhclo_asset): the pack's .mhclo, or the template's own template.mhclo;
 2. settles it with a short Blender cloth pass, pinned groups held (only when meta "settle" is set; V3-00's skirt settings);
 3. pushes it out with Shrinkwrap modifiers in Blender's 'Outside' mode (only vertices inside, or closer than clearance_cm, move),
    limited to contact_groups, against the body and then each garment in inner_layers. Shrinkwrap is never the main fit;
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
REQUIRED = ("id", "category", "layer", "allowed_bodies", "source", "licence", "sha256", "delete_group", "settle", "contact_groups",
            "clearance_cm", "replaces", "inner_layers", "approved", "colour")
SETTLE_KEYS = ("pinned", "frames", "quality", "mass", "tension", "compression", "shear", "bending", "gravity_ramp")
SETTLE_DEFAULTS = {"frames": 60, "quality": 10, "mass": 0.3, "tension": 15, "compression": 15, "shear": 5, "bending": 5.0,
                   "gravity_ramp": 20}  # spike/cloth/skirt_cloth.py (V3-00/V3-01a), fewer frames: a settle, not a full drape


class MetaError(ValueError):
    """A template's meta.json is missing something or has a value the build does not accept."""


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
        if not isinstance(s, dict) or not s.get("pinned") or not all(isinstance(g, str) for g in s["pinned"]):
            p.append('settle must be "none" or an object with a non-empty "pinned" list of body vertex groups')
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

            # 2. settle (loose garments only): a short cloth pass with the pinned groups held, on one thread (build_pack.py), fixed frames
            if meta["settle"] != "none" and HIDE:
                s = {**SETTLE_DEFAULTS, **meta["settle"]}
                t1 = time.time()
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
                for i_, tgt in enumerate(targets):
                    sw = iob.modifiers.new(f"push_{i_}", "SHRINKWRAP")
                    sw.target, sw.wrap_method, sw.wrap_mode = tgt, "NEAREST_SURFACEPOINT", "OUTSIDE"
                    sw.offset, sw.vertex_group = clear, "contact"
                if targets:
                    R["largest_push_off_inner_layers_cm"] = round(apply_modifiers(iob, wm) * 100, 2)
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
