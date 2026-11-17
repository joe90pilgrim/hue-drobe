"""V3-06: add pack items (MakeHuman community assets, archived by V2-09) to a body build, hide the body under them, and check them.

Run by pack/build_pack.py inside Blender; not meant to be run by hand:
  blender --background --python pack/pack_items.py -- <inner script> <items.json> [--no-hide] :: <the inner script's own arguments>

It runs the inner script (spike/blender/body_from_measurements.py, or spike/cloth/skirt_cloth.py for a woman) unchanged with runpy, so
the body and the app's own garments are exactly what the pack build makes, then for each item in items.json:
 1. loads it with MPFB's own loader (HumanService.add_mhclo_asset), as the V2-07 spike did (spike/assets/fit_pack_items.py);
 2. bakes it into world space and exports <name>_<id>.glb: plain colour (the neutral grey, the app sets the colour), no UVs, unless the item
    keeps its texture (hair and shoes, Joe's decision of 16 Nov 2026);
 3. exports <name>_body_<id>.glb: the body with the parts the item hides removed (MPFB's delete group). The app draws this body, not
    body.glb, while the item is worn. With --no-hide it is the whole body, which is how the check is shown to fail;
 4. runs the "body as drawn" check (spike/blender/mesh_checks.body_as_drawn) on the exported GLBs and writes it, with the item's own
    mesh facts, into <name>_report.json under "pack_items", where spike/check_reports.py reads it.
The app's own garments are not touched and keep the strict check.
"""
import sys, os, json, runpy, math, time, traceback
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER_DIR = os.path.normpath(os.path.join(HERE, "..", "spike", "blender"))
args = sys.argv[sys.argv.index("--") + 1:]
sep = args.index("::")
own, inner_args = args[:sep], args[sep + 1:]
inner, items_path = own[0], own[1]
HIDE = "--no-hide" not in own
inner_name = os.path.basename(inner)
meas_path, out_dir, name = (inner_args[0], inner_args[1], inner_args[2]) if inner_name == "body_from_measurements.py" else (inner_args[0], inner_args[2], inner_args[3])
T0 = time.time()

sys.argv = [sys.argv[0], "--"] + inner_args
ns = runpy.run_path(inner, run_name="__main__")
body_ns = ns["G"] if isinstance(ns.get("G"), dict) and "eval_bm" in ns["G"] else ns  # skirt_cloth.py keeps the body script's globals in G
h, eval_bm = body_ns["h"], body_ns["eval_bm"]

import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
from mathutils.kdtree import KDTree  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

sys.path.insert(0, BLENDER_DIR)
import mesh_checks  # noqa: E402
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402

cfg = json.load(open(items_path))
tol = json.load(open(os.path.join(HERE, "..", "spike", "tolerances.json")))["pack_item_body_as_drawn"]
BODY_GLB = os.path.join(out_dir, name + ".glb")


def lin(rgb):
    f = lambda c: (c / 255.0) / 12.92 if c / 255.0 <= 0.04045 else (((c / 255.0) + 0.055) / 1.055) ** 2.4
    return (f(rgb[0]), f(rgb[1]), f(rgb[2]), 1)


def export_glb(ob, path):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)
    return os.path.getsize(path)


def trim_body(body_glb, item_glb):
    """Takes out of the exported body (as MPFB's delete group left it) every face that still crosses the item: skin poking through the
    cloth where the delete group stops short, such as at the shoulders. Works on the exported triangles, which is what the phone draws, and
    writes the body GLB again with its material. Returns the number of faces taken out. Whether this leaves a hole that shows is what
    the gap rays in the "body as drawn" check are for."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=body_glb)
    new = [o for o in bpy.data.objects if o not in before]
    ob = next(o for o in new if o.type == "MESH")
    ob.data.transform(ob.matrix_world)
    ob.parent = None
    ob.matrix_world = Matrix.Identity(4)
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
    for o in new:
        if o is not ob:
            bpy.data.objects.remove(o)
    export_glb(ob, body_glb)
    bpy.data.objects.remove(ob)
    return len(hit)


def tris(bm):
    return sum(len(f.verts) - 2 for f in bm.faces)


report_path = os.path.join(out_dir, name + "_report.json")
report = json.load(open(report_path))
report["pack_items"] = {}
full_bm = mesh_checks.load_glb(BODY_GLB)
floor = min(v.co.z for v in mesh_checks.merged(full_bm).verts)
full_tree = BVHTree.FromBMesh(mesh_checks.merged(full_bm))

for it in cfg["items"]:
    iid = it["id"]
    R = {"pack": it["pack"], "asset": it["asset"], "role": it["role"], "licence": it["licence"], "hides_body": HIDE}
    report["pack_items"][iid] = R
    try:
        mhclo = os.path.join(cfg["packs_dir"], it["pack"], "hair" if it["kind"] == "hair" else "clothes", it["asset"], it["asset"] + ".mhclo")
        before_mods = {m.name for m in h.modifiers}
        ob = HumanService.add_mhclo_asset(mhclo, h, asset_type="Hair" if it["kind"] == "hair" else "Clothes", subdiv_levels=0,
                                          material_type="GAMEENGINE", set_up_rigging=False, interpolate_weights=False,
                                          import_subrig=False, import_weights=False)
        bpy.context.view_layer.update()
        wm = ob.data.copy()  # the item in world space, to push and test on; the object itself is baked after the body is exported
        wm.transform(ob.matrix_world)
        # The pack fits an item by binding it to the body, and it can end up a little inside the skin (the V2-07 dress: down to -0.26 cm at the
        # shoulder). Push any vertex that is inside, or closer than push_min_cm, out to push_min_cm, so skin does not poke through the cloth.
        pushed, deepest = 0, 0.0
        _sb = bmesh.new()  # the item exactly as the pack fits it: the control, which must cross the whole body or the check proves nothing
        _sb.from_mesh(wm)
        bmesh.ops.triangulate(_sb, faces=_sb.faces[:])
        R["pairs_with_whole_body_as_shipped"] = len(full_tree.overlap(BVHTree.FromBMesh(_sb)))
        _sb.free()
        for _pass in range(2 if HIDE else 0):  # --no-hide leaves the item as the pack fits it too, so the check shows what it is for
            for v in wm.vertices:
                loc, nor, _i, d = full_tree.find_nearest(v.co)
                sd = d if (v.co - loc).dot(nor) > 0 else -d
                if sd < tol["push_min_cm"] / 100:
                    v.co = loc + nor * (tol["push_min_cm"] / 100)
                    pushed += _pass == 0
                    deepest = max(deepest, tol["push_min_cm"] / 100 - sd)
        R["item_vertices_pushed_out_of_skin"], R["deepest_push_cm"] = pushed, round(deepest * 100, 2)
        new_mods = [m for m in h.modifiers if m.name not in before_mods]
        hidden = restored = 0
        masks, nbrs, kd = [], {}, None
        for m in new_mods:
            m.show_viewport = False
        if HIDE:
            # Hide only what the cloth covers: a body vertex stays in the pack's delete group only if the item lies outside it along its
            # own normal (within 10 cm). Where the pack's group reaches past the item's edge (the shoulders and neckline of a tank-style
            # dress), the vertex comes back, so the viewer sees skin there and not the inside of the cloth.
            _was = {m.name: m.show_viewport for m in h.modifiers}  # the body's own masks (helper geometry) change its vertex count: switch every modifier off
            for m in h.modifiers:
                m.show_viewport = False
            fb = eval_bm(h)
            for m in h.modifiers:
                m.show_viewport = _was[m.name]
            bpy.context.view_layer.update()
            fb.verts.ensure_lookup_table()
            fb.normal_update()
            assert len(fb.verts) == len(h.data.vertices), "evaluated body and base mesh differ in vertex count"
            kd = KDTree(len(fb.verts))
            for q_ in fb.verts:
                kd.insert(q_.co, q_.index)
            kd.balance()
            _ib = bmesh.new()
            _ib.from_mesh(wm)
            bmesh.ops.triangulate(_ib, faces=_ib.faces[:])
            _tree = BVHTree.FromBMesh(_ib)
            for m in new_mods:
                if m.type == "MASK" and m.vertex_group in h.vertex_groups:
                    vg = h.vertex_groups[m.vertex_group]
                    drop = []
                    for v in h.data.vertices:
                        if any(g.group == vg.index and g.weight > 0 for g in v.groups):
                            q = fb.verts[v.index]
                            loc, nor, _i, _d = _tree.ray_cast(q.co - q.normal * 0.005, q.normal, 0.10)
                            if loc is None or nor.dot(q.normal) <= 0:
                                drop.append(v.index)
                    # a few rings of body vertices around each uncovered one come back too: skin just inside the cloth's edge can be seen
                    # from above through the neckline, which the normal test alone does not catch
                    members = {v.index for v in h.data.vertices if any(g.group == vg.index and g.weight > 0 for g in v.groups)}
                    for e in h.data.edges:
                        a_, b_ = e.vertices
                        nbrs.setdefault(a_, []).append(b_); nbrs.setdefault(b_, []).append(a_)
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
            m.show_viewport = HIDE
        bpy.context.view_layer.update()
        body_glb = os.path.join(out_dir, f"{name}_body_{iid}.glb")

        def export_hidden():
            """The body as the app would draw it while this item is worn (the pack's delete group as it now stands), then the faces that still cross the cloth taken out."""
            bpy.context.view_layer.update()
            _e = h.evaluated_get(bpy.context.evaluated_depsgraph_get())
            _hb = bpy.data.objects.new(f"{name}_body_{iid}", bpy.data.meshes.new_from_object(_e))
            bpy.context.scene.collection.objects.link(_hb)
            export_glb(_hb, body_glb)
            bpy.data.objects.remove(_hb)
            return trim_body(body_glb, glb) if HIDE else 0

        # export the item, in world space with the pushed-out vertices, from a copy; the pack object itself stays where MPFB put it until
        # the end, because taking it off the body upsets the body's own helper mask
        keep_texture = it["role"] == "shoes" or it["kind"] == "hair"
        if not keep_texture:
            wm.materials.clear()
            m_ = bpy.data.materials.new(iid)
            m_.use_nodes = True
            m_.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = lin(cfg["colour_srgb"])
            wm.materials.append(m_)
            while wm.uv_layers:
                wm.uv_layers.remove(wm.uv_layers[0])
        iob = bpy.data.objects.new(f"{name}_{iid}", wm)
        bpy.context.scene.collection.objects.link(iob)
        glb = os.path.join(out_dir, f"{name}_{iid}.glb")
        R["glb_kb"] = round(export_glb(iob, glb) / 1024)
        R["texture_kept"] = keep_texture
        bpy.data.objects.remove(iob)
        item_bm = mesh_checks.load_glb(glb)
        im = mesh_checks.merged(item_bm)
        R["triangles"] = tris(im)
        R["pieces"], R["openings"] = len(mesh_checks.pieces(im)), len(mesh_checks.openings(im))
        R["info_self_intersecting_pairs"] = mesh_checks.self_intersections(im, BVHTree.FromBMesh(im), floor)[0]
        R["info_clearance_to_full_body_cm"] = mesh_checks.clearance_cm(im, BVHTree.FromBMesh(mesh_checks.merged(full_bm)))
        im.free()
        # Export, check, and where a gap ray shows the inside of the cloth where skin was removed, give back the body vertices nearest to
        # what that ray would have seen, then export and check again. The final check is the same independent function either way.
        R["body_faces_trimmed_where_skin_pokes_through"] = 0
        R["repair_rounds"] = 0
        for _round in range(cfg.get("max_repair_rounds", 6) + 1):
            R["body_faces_trimmed_where_skin_pokes_through"] = export_hidden()
            gaps_seen = []
            t1 = time.time()
            R["body_as_drawn"] = mesh_checks.body_as_drawn(full_bm, mesh_checks.load_glb(body_glb), item_bm, floor, tol, gaps_seen)
            R["body_as_drawn"]["seconds"] = round(time.time() - t1, 1)
            if not HIDE or not gaps_seen or _round == cfg.get("max_repair_rounds", 6):
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
        R["body_glb_kb"] = round(os.path.getsize(body_glb) / 1024)
        for m in new_mods:
            h.modifiers.remove(m)
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(wm)
        R["status"] = "ok"
    except Exception as e:  # noqa: BLE001  recorded; check_reports.py fails the build on it
        R["status"] = "failed: " + repr(e)
        R["traceback"] = traceback.format_exc()
    print("PACKITEM", name, iid, R.get("status"), json.dumps(R.get("body_as_drawn", {})), flush=True)

json.dump(report, open(report_path, "w"), indent=2)
print("PACKITEMS DONE", name, "%.0f s" % (time.time() - T0))
