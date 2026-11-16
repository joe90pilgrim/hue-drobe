"""V2-07: fit MakeHuman asset-pack items to one body, headlessly, and measure them.

Run (through spike/assets/run_all.py, which does this for four bodies):
  blender --background --python spike/assets/fit_pack_items.py -- <measurements.json> <garments.json|-> <out_dir> <name> <packs_dir> <items.json>

What it does, in one Blender session:
 1. Runs spike/blender/body_from_measurements.py unchanged (runpy), so the body and the app's own tee and trousers are exactly
    what the pack build makes, and keeps the MPFB body object `h` it leaves behind.
 2. For each item in items.json, loads it with MPFB's own loader (HumanService.add_mhclo_asset: no manual work), exports it to GLB
    as the phone would get it, and measures: fit, the hard mesh checks (spike/blender/mesh_checks.py functions, run on the GLBs
    read back in), the body MPFB would hide, polygon count and GLB size, texture and recolour, licence.
 3. Renders front, side and back of each item next to the app's own tee and trousers (Cycles, CPU).
Writes <out_dir>/<name>_assets_report.json, <out_dir>/assets/<name>__<item>.glb and <out_dir>/renders/<name>__<item>.png.
Nothing here changes the app or the shipped pack.
"""
import sys, os, re, json, math, runpy, time, traceback
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER_DIR = os.path.normpath(os.path.join(HERE, "..", "blender"))
argv = sys.argv[sys.argv.index("--") + 1:]
meas_path, gar_path, out_dir, name, packs_dir, items_path = argv[:6]
NO_RENDER = "--no-render" in argv
ONLY = [a.split("=", 1)[1] for a in argv if a.startswith("--only=")]
os.makedirs(os.path.join(out_dir, "assets"), exist_ok=True)
os.makedirs(os.path.join(out_dir, "renders"), exist_ok=True)
T0 = time.time()

# ---- 1. the body and the app's own garments, built by the unchanged body script -------------------------------------------
sys.argv = [sys.argv[0], "--", meas_path, out_dir, name] + ([] if gar_path == "-" else [gar_path])
G = runpy.run_path(os.path.join(BLENDER_DIR, "body_from_measurements.py"), run_name="__main__")
h = G["h"]
eval_bm = G["eval_bm"]
sex = json.load(open(meas_path))["sex_base"]
print("PACKS body built in %.0f s; object matrix identity: %s" % (time.time() - T0, h.matrix_world == Matrix.Identity(4)))

sys.path.insert(0, BLENDER_DIR)
import mesh_checks  # noqa: E402
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.entities.clothes.mhclo import Mhclo  # noqa: E402

BODY_GLB = os.path.join(out_dir, name + ".glb")
TEE_GLB = os.path.join(out_dir, name + "_tee.glb")
TRO_GLB = os.path.join(out_dir, name + "_trousers.glb")
body_bm = mesh_checks.merged(mesh_checks.load_glb(BODY_GLB))
body_tree = BVHTree.FromBMesh(body_bm)
floor = min(v.co.z for v in body_bm.verts)
height_cm = (max(v.co.z for v in body_bm.verts) - floor) * 100
tee_bm = mesh_checks.merged(mesh_checks.load_glb(TEE_GLB))
tro_bm = mesh_checks.merged(mesh_checks.load_glb(TRO_GLB))
tee_tree, tro_tree = BVHTree.FromBMesh(tee_bm), BVHTree.FromBMesh(tro_bm)


def extent_cm(bm):
    xs, ys, zs = ([getattr(v.co, a) for v in bm.verts] for a in "xyz")
    return {"x_cm": [round(min(xs) * 100, 1), round(max(xs) * 100, 1)], "y_cm": [round(min(ys) * 100, 1), round(max(ys) * 100, 1)],
            "z_above_floor_cm": [round((min(zs) - floor) * 100, 1), round((max(zs) - floor) * 100, 1)]}


def tris(bm):
    return sum(len(f.verts) - 2 for f in bm.faces)


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


def plain_material(label, srgb255):
    m = bpy.data.materials.new(label)
    m.use_nodes = True
    f = srgb_to_lin(np.array(srgb255) / 255.0)
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (f[0], f[1], f[2], 1)
    return m


def export_glb(ob, path):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)
    return os.path.getsize(path)


def tri_bm_from_object(ob):
    me = ob.data.copy()
    me.transform(ob.matrix_world)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    return mesh_checks.merged(bm)


def pairs(tree_a, tree_b):
    return len(tree_a.overlap(tree_b))


def lerp_note(x):
    return round(float(x), 2)


report = {"name": name, "sex_base": sex, "height_cm": round(height_cm, 1), "blender": bpy.app.version_string,
          "app_garments": {"body": {"glb_kb": round(os.path.getsize(BODY_GLB) / 1024), "triangles": tris(body_bm)},
                           "tee": {"glb_kb": round(os.path.getsize(TEE_GLB) / 1024), "triangles": tris(tee_bm), **extent_cm(tee_bm)},
                           "trousers": {"glb_kb": round(os.path.getsize(TRO_GLB) / 1024), "triangles": tris(tro_bm), **extent_cm(tro_bm)}},
          "items": {}}
items = json.load(open(items_path))["items"]
if ONLY:
    items = [i for i in items if i["id"] in ONLY]
loaded = {}  # id -> exported GLB path, for the renders
hidden_bodies = {}  # id -> the body with MPFB's delete group applied, for the renders

# ---- 2. fit and measure each item --------------------------------------------------------------------------------------------
for it in items:
    iid = it["id"]
    R = {"category": it["category"], "pack": it["pack"], "asset": it["name"][sex], "extra": bool(it.get("extra")), "role": it["role"]}
    report["items"][iid] = R
    t1 = time.time()
    try:
        folder = os.path.join(packs_dir, it["pack"], "x", "hair" if it["kind"] == "hair" else "clothes", it["name"][sex])
        mhclo_path = os.path.join(folder, it["name"][sex] + ".mhclo")
        meta = Mhclo()
        meta.load(mhclo_path)
        mat = parse_mhmat(os.path.join(folder, os.path.basename(meta.material)) if meta.material else None)
        packjson = json.load(open(os.path.join(packs_dir, it["pack"], "x", "packs", it["pack"] + ".json")))
        R["licence"] = {"mhclo_header": meta.license, "pack_json": packjson.get(it["name"][sex], {}).get("license"),
                        "author": meta.author, "source": packjson.get(it["name"][sex], {}).get("source")}
        R["mhclo"] = {"basemesh_tag_ok": True, "vertices_bound": len(meta.verts), "delete_verts_declared": len(meta.delverts) if meta.delete else 0}
        before_obs, before_mods = set(bpy.data.objects), {m.name for m in h.modifiers}
        ob = HumanService.add_mhclo_asset(mhclo_path, h, asset_type="Hair" if it["kind"] == "hair" else "Clothes", subdiv_levels=0,
                                          material_type="GAMEENGINE", set_up_rigging=False, interpolate_weights=False,
                                          import_subrig=False, import_weights=False)
        bpy.context.view_layer.update()
        n_obj_verts = len(ob.data.vertices)
        R["fit"] = {"loaded_without_manual_work": True, "obj_vertices": n_obj_verts, "mhclo_vertices_bound": len(meta.verts),
                    "all_vertices_bound": n_obj_verts == len(meta.verts),
                    "nan_vertices": int(sum(1 for v in ob.data.vertices if any(math.isnan(c) for c in v.co)))}
        # the body MPFB would hide under the item: the delete group it adds to the body, and a mask modifier on the body
        new_mods = [m for m in h.modifiers if m.name not in before_mods]
        hidden_verts = 0
        for m in new_mods:
            if m.type == "MASK" and m.vertex_group in h.vertex_groups:
                gi = h.vertex_groups[m.vertex_group].index
                hidden_verts = sum(1 for v in h.data.vertices if any(g.group == gi and g.weight > 0 for g in v.groups))
        R["hides_body"] = {"mask_modifier_added": bool(new_mods), "body_vertices_hidden": hidden_verts,
                           "share_of_body_vertices": round(hidden_verts / max(len(h.data.vertices), 1), 3)}
        item_bm_mem = tri_bm_from_object(ob)
        item_tree_mem = BVHTree.FromBMesh(item_bm_mem)
        # body-through-cloth with the body MPFB would show (mask on) and the full body (mask off), same triangulated in-memory method
        for m in new_mods:
            m.show_viewport = True
        b_hidden = mesh_checks.merged(eval_bm(h))
        if hidden_verts:  # the body as MPFB would show it under this item, exported like the body, for the hidden-body renders
            _e = h.evaluated_get(bpy.context.evaluated_depsgraph_get())
            _hb = bpy.data.objects.new(name + "_hidden", bpy.data.meshes.new_from_object(_e))
            bpy.context.scene.collection.objects.link(_hb)
            hidden_glb = os.path.join(out_dir, "assets", f"{name}__{iid}__bodyhidden.glb")
            export_glb(_hb, hidden_glb)
            hidden_bodies[iid] = hidden_glb
            bpy.data.objects.remove(_hb)
        for m in new_mods:
            m.show_viewport = False
        b_full = mesh_checks.merged(eval_bm(h))
        R["checks_in_memory"] = {"body_pairs_hidden_body": pairs(BVHTree.FromBMesh(b_hidden), item_tree_mem),
                                 "body_pairs_full_body": pairs(BVHTree.FromBMesh(b_full), item_tree_mem)}
        b_hidden.free(); b_full.free()
        for m in new_mods:
            h.modifiers.remove(m)
        tex_stats = texture_stats(mat["diffuseTexture"], ob) if mat["diffuseTexture"] else "none"
        # bake the item into world space and export it as the phone would get it
        ob.data.transform(ob.matrix_world)
        ob.parent = None
        ob.matrix_world = Matrix.Identity(4)
        glb = os.path.join(out_dir, "assets", f"{name}__{iid}.glb")
        R["glb_kb_with_texture"] = round(export_glb(ob, glb) / 1024)
        # same mesh, plain colour, no texture: what the app's colour-from-photo method would ship
        flat = ob.copy(); flat.data = ob.data.copy(); flat.data.materials.clear()
        flat.data.materials.append(plain_material("flat", [200, 200, 200]))
        bpy.context.scene.collection.objects.link(flat)
        R["glb_kb_plain_colour"] = round(export_glb(flat, os.path.join(out_dir, "assets", f"{name}__{iid}__plain.glb")) / 1024)
        bpy.data.objects.remove(flat)
        bpy.data.objects.remove(ob)
        # the existing hard mesh checks, run on the exported GLB read back in (what the phone shows)
        g = mesh_checks.merged(mesh_checks.load_glb(glb))
        gt = BVHTree.FromBMesh(g)
        si, si_z = mesh_checks.self_intersections(g, gt, floor)
        bz = mesh_checks.pieces(g)
        R["checks_glb"] = {"triangles": tris(g), "pieces": len(bz), "openings": len(mesh_checks.openings(g)),
                           "body_intersecting_pairs": pairs(body_tree, gt), "self_intersecting_pairs": si,
                           "self_intersections_by_z_cm": si_z, "clearance_to_body_cm": mesh_checks.clearance_cm(g, body_tree),
                           "pairs_with_app_tee": pairs(tee_tree, gt), "pairs_with_app_trousers": pairs(tro_tree, gt), **extent_cm(g)}
        g.free()
        R["material"] = {"mhmat": os.path.basename(meta.material) if meta.material else None, "diffuseColor": mat["diffuseColor"],
                         "transparent": mat["transparent"], "opacity": mat["opacity"], "other_textures": mat["other_textures"],
                         "texture": tex_stats}
        loaded[iid] = glb
        R["status"] = "ok"
    except Exception as e:  # noqa: BLE001  record and carry on with the next item
        R["status"] = "failed: " + repr(e)
        R["traceback"] = traceback.format_exc()
        print("PACKS item failed", iid, R["status"])
    R["seconds"] = round(time.time() - t1, 1)
    print("PACKS", name, iid, R.get("status"), "%.0f s" % R["seconds"], flush=True)

if "--control" in argv:
    # Control: the same items on MPFB's own default body (no targets from us). If they clip there too, it is the asset, not our body shapes.
    report["control_default_body"] = {}
    try:
        d = HumanService.create_human()
        bpy.context.view_layer.update()
        _zs = [v.co.z for v in eval_bm(d).verts]
        report["control_default_body"]["height_cm"] = round((max(_zs) - min(_zs)) * 100, 1)
        for it in items:
            C = {}
            report["control_default_body"][it["id"]] = C
            try:
                folder = os.path.join(packs_dir, it["pack"], "x", "hair" if it["kind"] == "hair" else "clothes", it["name"][sex])
                before_mods = {m.name for m in d.modifiers}
                ob = HumanService.add_mhclo_asset(os.path.join(folder, it["name"][sex] + ".mhclo"), d, asset_type="Hair" if it["kind"] == "hair" else "Clothes",
                                                  subdiv_levels=0, material_type="GAMEENGINE", set_up_rigging=False, interpolate_weights=False,
                                                  import_subrig=False, import_weights=False)
                bpy.context.view_layer.update()
                new_mods = [m for m in d.modifiers if m.name not in before_mods]
                for m in new_mods:
                    m.show_viewport = False
                full = mesh_checks.merged(eval_bm(d))
                itm = tri_bm_from_object(ob)
                it_tree = BVHTree.FromBMesh(itm)
                si, _ = mesh_checks.self_intersections(itm, it_tree)
                C.update({"body_pairs_full_body": pairs(BVHTree.FromBMesh(full), it_tree), "self_pairs": si,
                          "clearance_to_body_cm_min": mesh_checks.clearance_cm(itm, BVHTree.FromBMesh(full))["min"]})
                for m in new_mods:
                    d.modifiers.remove(m)
                bpy.data.objects.remove(ob)
            except Exception as e:  # noqa: BLE001
                C["error"] = repr(e)
    except Exception as e:  # noqa: BLE001
        report["control_default_body"]["error"] = repr(e)

json.dump(report, open(os.path.join(out_dir, name + "_assets_report.json"), "w"), indent=2)


# ---- 3. renders: front, side and back in one picture ----------------------------------------------------------------------
def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        o.hide_render = True
        o.hide_viewport = True
    return [o for o in new if o.type == "MESH"]


def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 24
    sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = 1500, 1000
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w") if not sc.world else sc.world
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.30, 0.30, 0.32, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(55), 0, math.radians(-25))
    sc.collection.objects.link(sun)
    fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "SUN"))
    fill.data.energy = 1.2
    fill.rotation_euler = (math.radians(60), 0, math.radians(155))
    sc.collection.objects.link(fill)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 3.0
    cam.location = (0, -8, height_cm / 200.0)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.collection.objects.link(cam)
    sc.camera = cam


def render_triple(objs, path):
    made = []
    for dx, rot in ((-1.0, 0.0), (0.0, 90.0), (1.0, 180.0)):
        e = bpy.data.objects.new("rig", None)
        e.location = (dx, 0, 0)
        e.rotation_euler = (0, 0, math.radians(rot))
        bpy.context.scene.collection.objects.link(e)
        made.append(e)
        for o in objs:
            c = o.copy()
            c.hide_render = False
            c.hide_viewport = False
            c.parent = e
            bpy.context.scene.collection.objects.link(c)
            made.append(c)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in made:
        bpy.data.objects.remove(o)


if not NO_RENDER:
    # clear what the body script left in the scene so only the GLB copies are drawn
    for o in list(bpy.data.objects):
        o.hide_render = True
    setup_scene()
    body_o, tee_o, tro_o = import_glb(BODY_GLB), import_glb(TEE_GLB), import_glb(TRO_GLB)
    # base scenario: the app's own tee and trousers, for the look comparison
    render_triple(body_o + tee_o + tro_o, os.path.join(out_dir, "renders", f"{name}__app_tee_trousers.png"))
    for it in items:
        iid = it["id"]
        if iid not in loaded:
            continue
        item_o = import_glb(loaded[iid])
        role = it["role"]
        parts = {"top": body_o + item_o + tro_o, "bottom": body_o + tee_o + item_o, "dress": body_o + item_o,
                 "shoes": body_o + tee_o + tro_o + item_o, "hair": body_o + tee_o + tro_o + item_o}[role]
        render_triple(parts, os.path.join(out_dir, "renders", f"{name}__{iid}.png"))
        if role == "shoes":  # the boots on their own, because the app's trousers cover most of them
            render_triple(body_o + item_o, os.path.join(out_dir, "renders", f"{name}__{iid}__bare.png"))
        if iid in hidden_bodies:  # the same item over the body MPFB would show (its delete group applied)
            hb = import_glb(hidden_bodies[iid])
            hparts = {"top": hb + item_o + tro_o, "bottom": hb + tee_o + item_o, "dress": hb + item_o, "shoes": hb + item_o, "hair": hb + item_o}[role]
            render_triple(hparts, os.path.join(out_dir, "renders", f"{name}__{iid}__hiddenbody.png"))
            for o in hb:
                bpy.data.objects.remove(o)
        for o in item_o:
            bpy.data.objects.remove(o)
print("PACKS DONE", name, "%.0f s" % (time.time() - T0))
