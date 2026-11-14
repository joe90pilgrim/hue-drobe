"""Block 2: build a body from tape measurements with MPFB2, headless, and report the measured error.

Run:
  blender --background --python spike/blender/body_from_measurements.py -- <measurements.json> <out_dir> <name>

Measurements JSON keys (cm): sex_base (male|female), height_cm, waist_cm, hips_cm, chest_cm, "real" (list of keys that are
real tape measurements; the rest are placeholders and are reported as such).
Landmarks are found once per body as fractions of height, then held fixed while solving, so results are repeatable.
"""
import sys, json, math, os
import bpy, bmesh
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.entities.objectproperties import HumanObjectProperties

argv = sys.argv[sys.argv.index("--") + 1:]
meas_path, out_dir, name = argv[0], argv[1], argv[2]
M = json.load(open(meas_path))
real = set(M.get("real", []))

TORSO = {  # measurement key -> (target stem, landmark scan range as fraction of height, 'min'|'max')
    "waist_cm": ("measure-waist-circ", (0.58, 0.68), "min"),
    "hips_cm": ("measure-hips-circ", (0.47, 0.56), "max"),
    "chest_cm": ("measure-bust-circ", (0.68, 0.74), "max"),
}


def eval_bm(h):
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    e = h.evaluated_get(dg)
    me = e.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    e.to_mesh_clear()
    return bm


def height_cm(bm):
    zs = [v.co.z for v in bm.verts]
    return (max(zs) - min(zs)) * 100.0


def circ_cm(bm, z):
    """Perimeter of the cross-section loop nearest the body centre line at height z."""
    b = bm.copy()
    geom = list(b.verts) + list(b.edges) + list(b.faces)
    res = bmesh.ops.bisect_plane(b, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1))
    cut = [g for g in res["geom_cut"] if isinstance(g, bmesh.types.BMEdge)]
    parent = {}

    def find(v):
        while parent.setdefault(v, v) != v:
            parent[v] = parent[parent[v]]
            v = parent[v]
        return v
    for ed in cut:
        parent[find(ed.verts[0])] = find(ed.verts[1])
    comps = {}
    for ed in cut:
        comps.setdefault(find(ed.verts[0]), []).append(ed)
    best = None
    for edges in comps.values():
        vs = {v for ed in edges for v in ed.verts}
        cx = sum(v.co.x for v in vs) / len(vs)
        length = sum(ed.calc_length() for ed in edges)
        key = (abs(cx), -length)
        if abs(cx) < 0.05 and (best is None or length > best[0]):
            best = (length, edges)
    b.free()
    return best[0] * 100.0 if best else float("nan")


def find_landmark(bm, hgt_m, zmin, rng, mode):
    best = None
    steps = 40
    for i in range(steps + 1):
        f = rng[0] + (rng[1] - rng[0]) * i / steps
        z = zmin + f * hgt_m
        c = circ_cm(bm, z)
        if math.isnan(c):
            continue
        if best is None or (mode == "min" and c < best[0]) or (mode == "max" and c > best[0]):
            best = (c, f)
    return best[1]


def set_height_macro(h, v):
    HumanObjectProperties.set_value("height", v, entity_reference=h)
    TargetService.reapply_macro_details(h)


def load_torso_targets(h):
    for stem, _, _ in TORSO.values():
        for sfx in ("-decr", "-incr"):
            path = TargetService.target_full_path(stem + sfx)
            TargetService.load_target(h, path, weight=0.0, name=stem + sfx)


def set_signed(h, stem, v):
    v = max(-1.0, min(1.0, v))
    TargetService.set_target_value(h, stem + "-incr", max(v, 0.0))
    TargetService.set_target_value(h, stem + "-decr", max(-v, 0.0))


def bisect(f, target, lo, hi, tol, iters=14):
    """f is assumed monotonic increasing in its parameter."""
    flo, fhi = f(lo), f(hi)
    if target <= flo:
        return lo
    if target >= fhi:
        return hi
    for _ in range(iters):
        mid = (lo + hi) / 2
        val = f(mid)
        if abs(val - target) < tol:
            return mid
        if val < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


gender = 1.0 if M["sex_base"] == "male" else 0.0
macros = TargetService.get_default_macro_info_dict()
macros["gender"] = gender
h = HumanService.create_human(scale=0.1, macro_detail_dict=macros)
load_torso_targets(h)

# 1. height via macro
set_height_macro(h, 0.5)
hv = bisect(lambda v: (set_height_macro(h, v), height_cm(eval_bm(h)))[1], M["height_cm"], 0.0, 1.0, 0.05, 16)
set_height_macro(h, hv)

# 2. landmarks, then circumferences
bm = eval_bm(h)
hgt_m = height_cm(bm) / 100.0
zmin = min(v.co.z for v in bm.verts)
marks = {k: find_landmark(bm, hgt_m, zmin, rng, mode) for k, (_, rng, mode) in TORSO.items() if k in M}
bm.free()
for _pass in range(2):
    for key, (stem, _, _) in TORSO.items():
        if key not in M:
            continue
        z0 = marks[key]

        def f(v, stem=stem, z0=z0):
            set_signed(h, stem, v)
            b = eval_bm(h)
            c = circ_cm(b, min(v_.co.z for v_ in b.verts) + z0 * (height_cm(b) / 100.0))
            b.free()
            return c
        set_signed(h, stem, bisect(f, M[key], -1.0, 1.0, 0.1, 12))
    # height may drift slightly after torso edits; leave as measured and report it

bm = eval_bm(h)
hgt = height_cm(bm)
zmin = min(v.co.z for v in bm.verts)
results = [{"measure": "height_cm", "target": M["height_cm"], "achieved": round(hgt, 2),
            "error": round(hgt - M["height_cm"], 2), "tolerance": 1.5, "real_measurement": "height_cm" in real}]
for key in TORSO:
    if key in M:
        c = circ_cm(bm, zmin + marks[key] * hgt / 100.0)
        results.append({"measure": key, "target": M[key], "achieved": round(c, 2), "error": round(c - M[key], 2),
                        "tolerance": 2.0, "real_measurement": key in real, "landmark_fraction_of_height": round(marks[key], 3)})
for r in results:
    r["pass"] = abs(r["error"]) <= r["tolerance"]

# garments: one tee template defined on a neutral reference body, re-fitted to this body
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import garment
ref = HumanService.create_human(scale=0.1)
faces = garment.define_tee(ref)
body_final = garment.body_bm(h)
joints_final = garment.joint_positions(h, garment.JOINTS)
HEM_FRAC = 0.49
zmin_f = min(v.co.z for v in body_final.verts)
H_f = max(v.co.z for v in body_final.verts) - zmin_f
tee_mesh, vids = garment.build_tee(body_final, faces, joints_final, hem_z=zmin_f + HEM_FRAC * H_f)
tee_report = {"template_faces": len(faces), "ease_cm": 2.2, "min_gap_cm": 0.6,
              "clipping": garment.clipping_report(body_final, tee_mesh, vids),
              **garment.landmarks(body_final, faces, vids, joints_final)}
zs = [v.co.z for v in tee_mesh.vertices]
bpy.data.objects.remove(ref)
results_extra = {"tee": tee_report}

os.makedirs(out_dir, exist_ok=True)
json.dump({"name": name, "sex_base": M["sex_base"], "height_macro": round(hv, 4), "results": results, **results_extra},
          open(os.path.join(out_dir, name + "_report.json"), "w"), indent=2)

# export baked body only (no helpers, no shape keys)
e = h.evaluated_get(bpy.context.evaluated_depsgraph_get())
mesh = bpy.data.meshes.new_from_object(e)
ob = bpy.data.objects.new(name, mesh)
bpy.context.scene.collection.objects.link(ob)
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
glb = os.path.join(out_dir, name + ".glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=False)
tee_ob = bpy.data.objects.new(name + "_tee", tee_mesh)
mat = bpy.data.materials.new("tee"); mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.85, 0.2, 0.25, 1)
tee_mesh.materials.append(mat)
bpy.context.scene.collection.objects.link(tee_ob)
bpy.ops.object.select_all(action="DESELECT")
tee_ob.select_set(True)
bpy.context.view_layer.objects.active = tee_ob
bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + "_tee.glb"), export_format="GLB", use_selection=True)
print("TEE", json.dumps(tee_report))
print("REPORT", json.dumps(results))
print("GLB_BYTES", os.path.getsize(glb))
