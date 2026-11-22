"""V5-00: one Blender session for one body. Runs pack/fit_template.py (the shipped loader, fit, push, delete group and "body as drawn" check)
on the scratch templates, then adds the measurements the spike needs. Run by pack/v5_spike/run.py, not by hand:

  blender --background --python pack/v5_spike/session.py -- spike/blender/body_from_measurements.py <job.json> :: <meas> <out dir> <name> <garments.json>

Writes <out dir>/<name>_report.json (fit_template's own, key "pack_items") and <out dir>/<name>_v5.json (this file's extras, key = template id):
  weight        GLB size as exported, GLB size with a plain colour, texture file size and pixels, triangles
  colour        texture mean colour and the dE after a red and a blue tint (pack/v5_spike/colour.py, V2-07's code)
  size          the item's extent in cm and height above the floor
  shoes         face pairs with the app's trousers and tee; body as drawn with the app's trousers in the scene
  hair          the hair check: hair vertices inside or within 2 mm of the skin, by body region (eye, face, ear, scalp), as the MHCLO fit
                gives the hair (before the pipeline's push) and as exported
Nothing here moves a vertex of any item.
"""
import json, math, os, sys, time, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
PACK_DIR = os.path.normpath(os.path.join(HERE, ".."))
BLENDER_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "spike", "blender"))
sys.path[:0] = [HERE, PACK_DIR, BLENDER_DIR]
import bpy  # noqa: E402
import bmesh  # noqa: E402
import fit_template  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
sep = args.index("::")
own, inner_args = args[:sep], args[sep + 1:]
JOB = json.load(open(own[1]))
OUT, NAME = inner_args[1], inner_args[2]
T0 = time.time()
fit_template.run()  # the body, the app's own garments, then every template, exactly as the pack build does

import mesh_checks  # noqa: E402
import colour  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402
from mathutils.kdtree import KDTree  # noqa: E402
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402

TOL = json.load(open(os.path.join(HERE, "..", "..", "spike", "tolerances.json")))["pack_item_body_as_drawn"]
BODY_GLB = os.path.join(OUT, NAME + ".glb")
full_bm = mesh_checks.load_glb(BODY_GLB)
full_m = mesh_checks.merged(full_bm)
floor = min(v.co.z for v in full_m.verts)
full_tree = BVHTree.FromBMesh(full_m)
h = bpy.data.objects["Human"]


def export_glb(ob, path):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)
    return os.path.getsize(path)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    ob = next(o for o in new if o.type == "MESH")
    ob.data.transform(ob.matrix_world)
    ob.parent = None
    ob.matrix_world = ob.matrix_world.Identity(4)
    for o in new:
        if o is not ob:
            bpy.data.objects.remove(o)
    return ob


def plain_kb(glb):
    """The same mesh in plain colour with no texture or UVs: what the colour-from-photo method ships."""
    ob = import_glb(glb)
    ob.data.materials.clear()
    m = bpy.data.materials.new("plain")
    m.use_nodes = True
    ob.data.materials.append(m)
    while ob.data.uv_layers:
        ob.data.uv_layers.remove(ob.data.uv_layers[0])
    tmp = os.path.join(OUT, "_plain_tmp.glb")
    kb = round(export_glb(ob, tmp) / 1024)
    os.remove(tmp)
    bpy.data.objects.remove(ob)
    return kb


def pairs(a, b):
    return len(BVHTree.FromBMesh(a).overlap(BVHTree.FromBMesh(b)))


def joined(*bms):
    o = bmesh.new()
    for x in bms:
        me = bpy.data.meshes.new("j")
        x.to_mesh(me)
        o.from_mesh(me)
        bpy.data.meshes.remove(me)
    return o


def extent(bm):
    xs, ys, zs = ([getattr(v.co, a) for v in bm.verts] for a in "xyz")
    return {"width_cm": round((max(xs) - min(xs)) * 100, 1), "depth_cm": round((max(ys) - min(ys)) * 100, 1),
            "height_cm": round((max(zs) - min(zs)) * 100, 1), "bottom_above_floor_cm": round((min(zs) - floor) * 100, 1),
            "top_above_floor_cm": round((max(zs) - floor) * 100, 1)}


# ---- the body's regions, for the hair check ----------------------------------------------------------------------------------
def body_regions():
    """Skin vertices of the head labelled eye, ear, face or scalp, and a KD tree of all skin vertices. Eye: skin within 1.5 cm of either
    eye helper's centre. Ear: the 'ears' group. Scalp: the 'scalp' group. Face: other head skin above the mouth joint minus 2 cm, on the
    front half of the head. Everything else: 'other'. Positions are the body as built (modifiers off, helpers still in the mesh)."""
    for m in h.modifiers:
        m.show_viewport = False
    ev = h.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    co = [v.co.copy() for v in me.vertices]
    ev.to_mesh_clear()
    names = {g.index: g.name for g in h.vertex_groups}
    grp = {}
    for v in h.data.vertices:
        for g in v.groups:
            if g.weight > 0:
                grp.setdefault(names[g.group], set()).add(v.index)

    def centre(n):
        s = grp[n]
        return sum((co[i] for i in s), Vector()) / len(s)

    skin = sorted(grp["body"])
    eye_c = [centre("helper-l-eye"), centre("helper-r-eye")]
    z_mouth = centre("joint-mouth").z
    head_c = centre("joint-head")
    z_top = max(co[i].z for i in skin)
    label = {}
    for i in skin:
        p = co[i]
        if min((p - e).length for e in eye_c) < 0.015:
            label[i] = "eye"
        elif i in grp.get("ears", ()):
            label[i] = "ear"
        elif i in grp.get("scalp", ()):
            label[i] = "scalp"
        elif p.z >= z_mouth - 0.02 and p.y < head_c.y and p.z <= z_top:
            label[i] = "face"
        else:
            label[i] = "other"
    kd = KDTree(len(skin))
    for k, i in enumerate(skin):
        kd.insert(co[i], k)
    kd.balance()
    counts = {n: sum(1 for v in label.values() if v == n) for n in ("eye", "ear", "scalp", "face", "other")}
    return kd, [label[i] for i in skin], counts, {"z_mouth_cm": round((z_mouth - floor) * 100, 1), "z_top_cm": round((z_top - floor) * 100, 1)}


def hair_check(points, kd, labels, limit_m=0.002):
    """Hair vertices (world points) inside the skin or within limit_m of it, by the region of the nearest skin vertex."""
    out = {"hair_vertices": len(points), "eye": 0, "face": 0, "ear": 0, "scalp": 0, "other": 0}
    for p in points:
        loc, nor, _i, d = full_tree.find_nearest(p)
        signed = d if (p - loc).dot(nor) > 0 else -d
        if signed <= limit_m:
            out[labels[kd.find(p)[1]]] += 1
    out["eye_face_ear"] = out["eye"] + out["face"] + out["ear"]
    out["limit_cm"] = round(limit_m * 100, 2)
    return out


REG = None
EXTRA = {}
metas = sorted((fit_template.load_meta(d) for d in JOB["templates"]), key=lambda m: m["id"])
report = json.load(open(os.path.join(OUT, NAME + "_report.json")))
trousers_bm = tee_bm = None
for suffix in ("trousers", "tee"):
    p = os.path.join(OUT, f"{NAME}_{suffix}.glb")
    if os.path.exists(p):
        if suffix == "trousers":
            trousers_bm = mesh_checks.merged(mesh_checks.load_glb(p))
        else:
            tee_bm = mesh_checks.merged(mesh_checks.load_glb(p))

for meta in metas:
    tid = meta["id"]
    E = EXTRA[tid] = {}
    try:
        glb = os.path.join(OUT, f"{NAME}_{tid}.glb")
        R = report["pack_items"].get(tid, {})
        if R.get("status") != "ok":
            E["status"] = "pipeline: " + str(R.get("status"))
            continue
        item = mesh_checks.merged(mesh_checks.load_glb(glb))
        E["extent"] = extent(item)
        # weight
        mhclo = fit_template.mhclo_path(meta, JOB["packs_dir"])
        folder = os.path.dirname(mhclo)
        text = open(mhclo, encoding="utf8", errors="replace").read().splitlines()
        mat_name = next((l.split(None, 1)[1].strip() for l in text if l.startswith("material ")), None)
        obj_name = next(l.split(None, 1)[1].strip() for l in text if l.startswith("obj_file"))
        mat = colour.parse_mhmat(os.path.join(folder, mat_name)) if mat_name else colour.parse_mhmat(None)
        tex = mat["diffuseTexture"] if mat["diffuseTexture"] and os.path.exists(mat["diffuseTexture"]) else None
        tex_kb = round(os.path.getsize(tex) / 1024) if tex else 0
        kept_texture = bool(R.get("texture_kept"))
        glb_kb = round(os.path.getsize(glb) / 1024)
        E["weight"] = {"triangles": R.get("triangles"), "glb_kb_exported": glb_kb, "exported_with_texture": kept_texture,
                       "glb_kb_plain_colour": plain_kb(glb) if kept_texture else glb_kb,
                       "glb_kb_with_texture": glb_kb if kept_texture else None,
                       "texture_file_kb": tex_kb, "texture_note": None if tex else "no diffuse texture"}
        if not kept_texture and tex:  # a plain-colour template: the texture would add roughly its own file size
            E["weight"]["glb_kb_with_texture_estimate"] = glb_kb + tex_kb
        # colour (V2-07 method) on the pack's own obj, which carries the UVs
        if tex:
            before = set(bpy.data.objects)
            bpy.ops.wm.obj_import(filepath=os.path.join(folder, obj_name))
            new = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
            E["colour"] = colour.texture_stats(tex, new[0]) if new else {"error": "obj did not import"}
            for o in new:
                bpy.data.objects.remove(o)
        else:
            E["colour"] = None
        # shoes: against the app's own trousers and tee, and the body as drawn with the trousers in the scene
        if meta["category"] == "shoes":
            E["with_app_garments"] = {"pairs_with_app_trousers": pairs(trousers_bm, item) if trousers_bm else None,
                                      "pairs_with_app_tee": pairs(tee_bm, item) if tee_bm else None}
            body_drawn = os.path.join(OUT, f"{NAME}_body_{tid}.glb")
            if trousers_bm and os.path.exists(body_drawn):
                fj = joined(full_bm, trousers_bm)
                dj = joined(mesh_checks.load_glb(body_drawn), trousers_bm)
                b = mesh_checks.body_as_drawn(fj, dj, mesh_checks.load_glb(glb), floor, TOL)
                E["with_app_garments"]["body_as_drawn_with_trousers"] = {k: b[k] for k in ("visible_body_intersecting_pairs", "gap_rays", "gap_by_z_cm", "worst_view") if k in b}
                fj.free()
                dj.free()
        # hair: the hair check as the MHCLO fit gives it and as exported
        if meta["category"] == "hair":
            if REG is None:
                REG = body_regions()
            kd, labels, counts, zs = REG
            E["region_vertices"] = counts
            E["hair_check_exported"] = hair_check([v.co.copy() for v in item.verts], kd, labels)
            before_mods = {m.name for m in h.modifiers}
            ob = HumanService.add_mhclo_asset(mhclo, h, asset_type="Hair", subdiv_levels=0, material_type="GAMEENGINE", set_up_rigging=False,
                                              interpolate_weights=False, import_subrig=False, import_weights=False)
            bpy.context.view_layer.update()
            E["hair_check_as_fitted"] = hair_check([ob.matrix_world @ v.co for v in ob.data.vertices], kd, labels)
            for m in [m for m in h.modifiers if m.name not in before_mods]:
                h.modifiers.remove(m)
            bpy.data.objects.remove(ob)
        item.free()
        E["status"] = "ok"
    except Exception as e:  # noqa: BLE001  recorded, then the next item
        E["status"] = "failed: " + repr(e)
        E["traceback"] = traceback.format_exc()
    print("V5", NAME, tid, E.get("status"), flush=True)

json.dump(EXTRA, open(os.path.join(OUT, NAME + "_v5.json"), "w"), indent=2)
print("V5 DONE", NAME, "%.0f s" % (time.time() - T0))
