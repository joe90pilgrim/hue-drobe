"""V3-00: an A-line midi skirt draped with Blender's own cloth solver, baked to a fixed GLB and checked.

Run (through spike/cloth/run_all.py, which does this for each body, twice):
  blender --threads 1 --background --python spike/cloth/skirt_cloth.py -- <measurements.json> <garments.json> <out_dir> <name> [--no-render]

What it does, in one Blender session:
 1. Runs spike/blender/body_from_measurements.py unchanged (runpy), so the body and the app's tee are the shipped ones.
 2. Builds the skirt's starting shell from the exported body GLB: rings from the waist to mid-calf. Waist to hip follows the
    body's own outline (convex hull of each 2 cm slice, arms left out; the top ring also clears the 4 cm above it) plus
    ease, and is never narrower than a straight line from waistband to hip; below the hip it flares linearly to HEM_RATIO x
    the hip, and turns from the hip's shape to a circle. The bottom ring is raised so the cloth length from hip to hem along
    the wall equals the hip-to-target height (the wall hangs nearly vertical once settled). The shell is the rest shape.
 3. Blender cloth (no custom physics): waistband pinned, body as collider, self-collision on, gravity ramped in over
    GRAVITY_RAMP frames, FRAMES frames. The hem ring's height and radius every 10 frames go into the report (hem_track).
 4. Exports the settled skirt to GLB (plain colour) and runs the hard mesh checks (spike/blender/mesh_checks.py) on the GLB
    read back in. Saves the vertex positions (<name>_skirt_verts.npy) so two builds can be compared.
 5. Renders front, side and back: the skirt alone on the body, and with the app's tee over it.
Writes <out_dir>/<name>_skirt_report.json, <name>_skirt.glb, renders/<name>__skirt.png and renders/<name>__skirt_tee.png.
"""
import sys, os, json, math, runpy, time
import bpy, bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER_DIR = os.path.normpath(os.path.join(HERE, "..", "blender"))
argv = sys.argv[sys.argv.index("--") + 1:]
meas_path, gar_path, out_dir, name = argv[:4]
NO_RENDER = "--no-render" in argv
os.makedirs(os.path.join(out_dir, "renders"), exist_ok=True)

# skirt pattern (A-line midi). Chosen, not calibrated; every value is written into the report.
WAIST_EASE_CM = 1.0        # clearance at the waistband
HIP_EASE_CM = 2.5          # clearance over the hips
HEM_RATIO = 1.5            # hem circumference / hip circumference of the skirt: a moderate A-line
HIP_SEARCH_STOP = 0.25     # search for the hip no lower than this fraction of waist-to-crotch above the crotch
HEM_ABOVE_FLOOR = 0.21     # mid-calf, as a fraction of height above the floor (no knee or ankle landmark in the report)
WAIST_LOOK_UP = 0.04       # m above the top ring that its outline must also clear (a belly that bulges above the waist)
N_AROUND = 96
RING_STEP = 0.02           # m between rings
# cloth (Blender's cotton preset, with a firmer collision for the 0.2 cm clearance limit)
FRAMES = 100
GRAVITY_RAMP = 40          # frames over which gravity rises from 0 to full (V3-01a: at full gravity from frame 1 the small
                           # body's hem fell inward and folded up 10 cm within 10 frames, with or without the legs)
QUALITY = 10
MASS = 0.3
TENSION = 15
COMPRESSION = 15
SHEAR = 5
BENDING = 5.0              # 0.5 (cotton preset) crumpled the hem into a bubble on synthetic_female_small; a woven skirt is stiffer
COLLISION_DIST = 0.005
SELF_DIST = 0.003          # V3-01a: 0.006 threw synthetic_female_small's hem up and under from frame 1 (its waist ring has
                           # vertices 0.8 cm apart); 0.003 holds the hem on all three bodies
PIN_RINGS = 2
FRICTION = 5.0             # body collider friction
COLOUR = (40, 60, 110)     # plain navy, sRGB
# experiment overrides, e.g. SKIRT_FRICTION=1; every value used is in the report
for _k in ("HEM_RATIO", "BENDING", "MASS", "FRICTION", "FRAMES", "TENSION", "GRAVITY_RAMP", "SELF_DIST"):
    if os.environ.get("SKIRT_" + _k):
        globals()[_k] = type(globals()[_k])(os.environ["SKIRT_" + _k])
# diagnostics only (V3-01a), never for a shipped build: SKIRT_DIAG_NO_LEGS=1 drops the body below the crotch from the
# collider; SKIRT_DIAG_NO_SELF=1 turns self-collision off
DIAG_NO_LEGS = os.environ.get("SKIRT_DIAG_NO_LEGS") == "1"
DIAG_NO_SELF = os.environ.get("SKIRT_DIAG_NO_SELF") == "1"

T0 = time.time()
sys.argv = [sys.argv[0], "--", meas_path, out_dir, name, gar_path]
G = runpy.run_path(os.path.join(BLENDER_DIR, "body_from_measurements.py"), run_name="__main__")
T_BODY = time.time() - T0
sys.path.insert(0, BLENDER_DIR)
import mesh_checks  # noqa: E402

BODY_GLB = os.path.join(out_dir, name + ".glb")
TEE_GLB = os.path.join(out_dir, name + "_tee.glb")
body_rep = json.load(open(os.path.join(out_dir, name + "_report.json")))
for o in list(bpy.data.objects):  # the body script's objects stay hidden; only GLB copies are used from here
    o.hide_render = True
    o.hide_viewport = True

body_bm = mesh_checks.merged(mesh_checks.load_glb(BODY_GLB))
floor = min(v.co.z for v in body_bm.verts)
height = max(v.co.z for v in body_bm.verts) - floor
waist_z = floor + body_rep["trousers"]["waist_height_cm"] / 100.0
crotch_z = floor + body_rep["trousers"]["crotch_height_cm"] / 100.0
hem_z = floor + HEM_ABOVE_FLOOR * height
coords = np.array([v.co[:] for v in body_bm.verts])


def hull(pts):
    pts = sorted(set(map(tuple, pts)))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def slice_pts(z, half=0.01, above=None):
    """Body vertices in a 2 cm slice (or from z - half up to z + above), without the arms: x is split into clusters at gaps
    over 3 cm, and only clusters whose inner edge is within 12 cm of the centre line are kept (torso or legs; a hand hangs
    further out)."""
    sel = coords[(coords[:, 2] > z - half) & (coords[:, 2] < z + (half if above is None else above))]
    if len(sel) == 0:
        return sel, 0
    xs = np.sort(sel[:, 0])
    cuts = np.where(np.diff(xs) > 0.03)[0]
    bounds = np.split(xs, cuts + 1)
    keep = [(b[0], b[-1]) for b in bounds if min(abs(b[0]), abs(b[-1])) < 0.12 or (b[0] < 0 < b[-1])]
    mask = np.zeros(len(sel), bool)
    for a, b in keep:
        mask |= (sel[:, 0] >= a - 1e-9) & (sel[:, 0] <= b + 1e-9)
    return sel[mask][:, :2], len(bounds) - len(keep)


def radial(h, cx, cy, n):
    """Radius of a convex polygon h from (cx, cy) at n equal angles."""
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = (math.cos(a), math.sin(a))
        best = 0.0
        for j in range(len(h)):
            p, q = h[j], h[(j + 1) % len(h)]
            ex, ey = q[0] - p[0], q[1] - p[1]
            den = d[0] * ey - d[1] * ex
            if abs(den) < 1e-12:
                continue
            t = ((p[0] - cx) * ey - (p[1] - cy) * ex) / den
            s = ((p[0] - cx) * d[1] - (p[1] - cy) * d[0]) / den
            if t > 0 and -1e-9 <= s <= 1 + 1e-9:
                best = max(best, t)
        out.append(best)
    return np.array(out)


def perim(r):
    n = len(r)
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    x, y = r * np.cos(a), r * np.sin(a)
    return float(np.sum(np.hypot(np.roll(x, -1) - x, np.roll(y, -1) - y)))


# ---- body outline from waist to hem ---------------------------------------------------------------------------------------
wpts, _ = slice_pts(waist_z)
cx, cy = float(np.mean(wpts[:, 0])), float(np.mean(wpts[:, 1]))  # one axis for the whole skirt: it hangs straight


def build_rings(hem_z):
    """Ring heights, body outline, hip ring and skirt radii for a shell whose bottom ring is at hem_z."""
    zs = []
    z = waist_z
    while z > hem_z - 1e-9:
        zs.append(z)
        z -= RING_STEP
    if zs[-1] - hem_z > 0.005:
        zs.append(hem_z)
    body_r, dropped = [], 0
    for i, z in enumerate(zs):
        # V3-01a: the top ring's outline also covers the body up to WAIST_LOOK_UP above it. On synthetic_female_large the
        # belly bulges just above the waist, and a 2 cm slice let the top edge dip into it (28 body pairs before any cloth).
        p, d = slice_pts(z, above=WAIST_LOOK_UP if i == 0 else None)
        dropped += d
        body_r.append(radial(hull(p), cx, cy, N_AROUND) if len(p) >= 3 else np.zeros(N_AROUND))
    body_r = np.array(body_r)
    # hip: widest ring in the upper 75% of waist-to-crotch (lower down, the thigh tops spread and win, which is not the hip)
    hip_i = int(np.argmax([perim(r) for r in body_r[: max(1, sum(1 for z in zs if z >= crotch_z + HIP_SEARCH_STOP * (waist_z - crotch_z)))]]))
    hip_z = zs[hip_i]
    rings, bound = [], []  # bound: how many of the N_AROUND directions the body (not the flare) sets, per ring
    for i, z in enumerate(zs):
        if i <= hip_i:
            t = (waist_z - z) / max(1e-6, waist_z - hip_z)
            ease = (WAIST_EASE_CM + (HIP_EASE_CM - WAIST_EASE_CM) * t) / 100.0
            r = np.maximum.accumulate(body_r[: i + 1], axis=0)[-1] if i else body_r[0]  # never narrower than a ring above
            rings.append(r + ease)
            bound.append(N_AROUND)
        else:
            hip_r = rings[hip_i]
            t = (hip_z - z) / max(1e-6, hip_z - hem_z)
            shape = hip_r * (1 - t) + np.full(N_AROUND, hip_r.mean()) * t
            target = perim(hip_r) * (1 + (HEM_RATIO - 1) * t)
            r = shape * target / perim(shape)
            need = body_r[i] + HIP_EASE_CM / 100.0
            bound.append(int(np.sum(need > r)))
            rings.append(np.maximum(r, need))
    # V3-01a: the hip ring can be much wider than the ring above it (on synthetic_female_large the hip outline takes in the
    # thigh tops: +6.6 cm of circumference in one 2 cm ring), which showed as a step at each side. Between the waist and the
    # hip, no ring is narrower than a straight line from the waistband to the hip ring, direction by direction.
    for i in range(1, hip_i):
        t = (waist_z - zs[i]) / max(1e-6, waist_z - hip_z)
        rings[i] = np.maximum(rings[i], rings[0] * (1 - t) + rings[hip_i] * t)
    return zs, body_r, dropped, hip_i, hip_z, rings, bound


def cloth_length(zs, rings, i0):
    """Length along the skirt wall from ring i0 down to the hem, using each ring's mean radius."""
    return sum(math.hypot(zs[i] - zs[i + 1], rings[i].mean() - rings[i + 1].mean()) for i in range(i0, len(zs) - 1))


# V3-01a: the flared wall swings nearly vertical as it settles, so a shell drafted to end at the target height hangs below it
# (2.6 cm on synthetic_female_large; stiffer tension did not change it, so it is not stretch). Pattern rule: the cloth length
# from the hip to the hem, measured along the wall, equals the hip-to-target height. The bottom ring is raised to suit.
hem_shell_z = hem_z
for _ in range(4):
    zs, body_r, dropped, hip_i, hip_z, rings, bound = build_rings(hem_shell_z)
    hem_shell_z += cloth_length(zs, rings, hip_i) - (hip_z - hem_z)
zs, body_r, dropped, hip_i, hip_z, rings, bound = build_rings(hem_shell_z)

# ---- shell mesh: rings of quads, two openings (waist, hem) ------------------------------------------------------------------
bm = bmesh.new()
grid = []
for z, r in zip(zs, rings):
    row = []
    for k in range(N_AROUND):
        a = 2 * math.pi * k / N_AROUND
        row.append(bm.verts.new((cx + r[k] * math.cos(a), cy + r[k] * math.sin(a), z)))
    grid.append(row)
for i in range(len(grid) - 1):
    for k in range(N_AROUND):
        k2 = (k + 1) % N_AROUND
        bm.faces.new((grid[i][k], grid[i][k2], grid[i + 1][k2], grid[i + 1][k]))
bm.normal_update()
shell_me = bpy.data.meshes.new("skirt_shell")
bm.to_mesh(shell_me)
bm.free()
for f in shell_me.polygons:
    f.use_smooth = True
shell = bpy.data.objects.new("skirt", shell_me)
bpy.context.scene.collection.objects.link(shell)
if any(p.normal.dot(Vector((p.center.x - cx, p.center.y - cy, 0))) < 0 for p in shell_me.polygons[:N_AROUND]):
    shell_me.flip_normals()
pin = shell.vertex_groups.new(name="pin")
pin.add(list(range(PIN_RINGS * N_AROUND)), 1.0, "REPLACE")

# start-shape clearance and pairs (before any simulation), so a fault can be put down to the shell or the solver
shell_bm = bmesh.new(); shell_bm.from_mesh(shell_me); bmesh.ops.triangulate(shell_bm, faces=shell_bm.faces[:])
body_tree = BVHTree.FromBMesh(body_bm)
start = {"body_intersecting_pairs": len(body_tree.overlap(BVHTree.FromBMesh(shell_bm))),
         "clearance_to_body_cm": mesh_checks.clearance_cm(shell_bm, body_tree)}
shell_bm.free()

# ---- cloth ------------------------------------------------------------------------------------------------------------------
sc = bpy.context.scene
body_ob = bpy.data.objects.new("collider", bpy.data.meshes.new("collider"))
if DIAG_NO_LEGS:
    _c = body_bm.copy()
    bmesh.ops.delete(_c, geom=[v for v in _c.verts if v.co.z < crotch_z - 0.02], context="VERTS")
    _c.to_mesh(body_ob.data)
    _c.free()
else:
    body_bm.to_mesh(body_ob.data)
sc.collection.objects.link(body_ob)
body_ob.hide_render = True
if os.environ.get("SKIRT_DIAG_NO_BODY") != "1":  # diagnostic only: no body collider at all
    body_ob.modifiers.new("Collision", "COLLISION")
    body_ob.collision.thickness_outer = 0.002
    body_ob.collision.cloth_friction = FRICTION
mod = shell.modifiers.new("Cloth", "CLOTH")
cs = mod.settings
cs.quality = QUALITY
cs.mass = MASS
cs.tension_stiffness = TENSION
cs.compression_stiffness = COMPRESSION
cs.shear_stiffness = SHEAR
cs.bending_stiffness = BENDING
cs.air_damping = 1.0
cs.vertex_group_mass = "pin"
cs.pin_stiffness = 1.0
if GRAVITY_RAMP > 0:
    cs.effector_weights.gravity = 0.0
    cs.effector_weights.keyframe_insert("gravity", frame=1)
    cs.effector_weights.gravity = 1.0
    cs.effector_weights.keyframe_insert("gravity", frame=1 + GRAVITY_RAMP)
    for _fc in (shell.animation_data.action.fcurves if hasattr(shell.animation_data.action, "fcurves") else []):
        for _kp in _fc.keyframe_points:
            _kp.interpolation = "LINEAR"
cc = mod.collision_settings
cc.use_collision = True
cc.distance_min = COLLISION_DIST
cc.collision_quality = 5
cc.use_self_collision = not DIAG_NO_SELF
cc.self_distance_min = SELF_DIST
pc = mod.point_cache
sc.frame_start, sc.frame_end = 1, FRAMES
pc.frame_start, pc.frame_end = 1, FRAMES
bpy.context.view_layer.update()
T1 = time.time()
sc.frame_set(0)
HEM0 = (len(zs) - 1) * N_AROUND  # first vertex of the hem ring
hem_track = []  # hem ring every 10 frames: mean and lowest height above the floor, mean radius from the axis (cm)
gravity_seen = {}  # the gravity weight actually in effect, so the report proves the ramp ran
for f in range(1, FRAMES + 1):
    sc.frame_set(f)
    if f % 10 == 0 or f == 1:
        gravity_seen[f] = float(cs.effector_weights.gravity)
        _ev = shell.evaluated_get(bpy.context.evaluated_depsgraph_get())
        _me = _ev.to_mesh()
        _h = np.array([v.co[:] for v in _me.vertices[HEM0:]])
        _ev.to_mesh_clear()
        hem_track.append({"frame": f, "mean_z": round((float(_h[:, 2].mean()) - floor) * 100, 1),
                          "low_z": round((float(_h[:, 2].min()) - floor) * 100, 1),
                          "mean_r": round(float(np.hypot(_h[:, 0] - cx, _h[:, 1] - cy).mean()) * 100, 1)})
T_SIM = time.time() - T1
dg = bpy.context.evaluated_depsgraph_get()
baked = bpy.data.meshes.new_from_object(shell.evaluated_get(dg))
verts = np.array([v.co[:] for v in baked.vertices])
np.save(os.path.join(out_dir, f"{name}_skirt_verts.npy"), verts)
moved = np.linalg.norm(verts - np.array([v.co[:] for v in shell_me.vertices]), axis=1)
sc.frame_set(1)
bpy.data.objects.remove(shell)
bpy.data.objects.remove(body_ob)

skirt = bpy.data.objects.new("skirt", baked)
sc.collection.objects.link(skirt)
for p in baked.polygons:
    p.use_smooth = True
m = bpy.data.materials.new("skirt")
m.use_nodes = True
lin = [((c / 255) / 12.92 if c / 255 <= 0.04045 else (((c / 255) + 0.055) / 1.055) ** 2.4) for c in COLOUR]
m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*lin, 1)
baked.materials.append(m)
SKIRT_GLB = os.path.join(out_dir, f"{name}_skirt.glb")
bpy.ops.object.select_all(action="DESELECT")
skirt.select_set(True)
bpy.context.view_layer.objects.active = skirt
bpy.ops.export_scene.gltf(filepath=SKIRT_GLB, export_format="GLB", use_selection=True)
bpy.data.objects.remove(skirt)

# ---- hard mesh checks on the GLB read back in -------------------------------------------------------------------------------
sk = mesh_checks.merged(mesh_checks.load_glb(SKIRT_GLB))
skt = BVHTree.FromBMesh(sk)
tee = mesh_checks.merged(mesh_checks.load_glb(TEE_GLB))
si, si_z = mesh_checks.self_intersections(sk, skt, floor)
bp = body_tree.overlap(skt)
import collections  # noqa: E402
bz = sorted(collections.Counter(int(round((body_bm.faces[a].calc_center_median().z - floor) * 100)) // 5 * 5 for a, _ in bp).items())
low = min(v.co.z for v in sk.verts)
checks = {"pieces": len(mesh_checks.pieces(sk)), "openings": len(mesh_checks.openings(sk)),
          "opening_lengths_cm": mesh_checks.openings(sk), "body_intersecting_pairs": len(bp), "body_intersections_by_z_cm": bz,
          "self_intersecting_pairs": si, "self_intersections_by_z_cm": si_z,
          "clearance_to_body_cm": mesh_checks.clearance_cm(sk, body_tree),
          "tee_over_skirt_intersecting_pairs_info": len(BVHTree.FromBMesh(tee).overlap(skt)),
          "triangles": len(sk.faces), "glb_kb": round(os.path.getsize(SKIRT_GLB) / 1024)}
tol = json.load(open(os.path.join(HERE, "..", "tolerances.json")))["garment_mesh"]
checks["passes_hard_checks"] = (checks["body_intersecting_pairs"] <= tol["body_intersecting_pairs_max"]
                                and checks["self_intersecting_pairs"] <= tol["self_intersecting_pairs_max"]
                                and checks["clearance_to_body_cm"]["min"] >= tol["min_clearance_cm"]
                                and checks["pieces"] == 1 and checks["openings"] == 2)
report = {"name": name, "blender": bpy.app.version_string, "build_s": {"body": round(T_BODY), "cloth": round(T_SIM),
          "total_to_checks": round(time.time() - T0)},
          "pattern": {"waist_ease_cm": WAIST_EASE_CM, "hip_ease_cm": HIP_EASE_CM, "hem_ratio": HEM_RATIO, "hip_search_stop": HIP_SEARCH_STOP,
                      "hem_above_floor_fraction": HEM_ABOVE_FLOOR, "n_around": N_AROUND, "ring_step_cm": RING_STEP * 100,
                      "rings": len(zs), "arm_clusters_dropped": dropped},
          "cloth": {"frames": FRAMES, "gravity_ramp_frames": GRAVITY_RAMP,
                    "gravity_at": {str(f): round(_g, 3) for f, _g in gravity_seen.items()}, "quality": QUALITY, "mass": MASS, "tension": TENSION, "compression": COMPRESSION,
                    "shear": SHEAR, "bending": BENDING, "friction": FRICTION, "collision_dist_cm": COLLISION_DIST * 100, "self_dist_cm": SELF_DIST * 100,
                    "self_collision": True, "pinned_rings": PIN_RINGS, "threads": bpy.context.scene.render.threads},
          "landmarks_cm": {"floor": round(floor * 100, 1), "height": round(height * 100, 1), "waist": round((waist_z - floor) * 100, 1),
                           "hip": round((hip_z - floor) * 100, 1), "crotch": round((crotch_z - floor) * 100, 1),
                           "hem_target": round((hem_z - floor) * 100, 1), "hem_shell": round((hem_shell_z - floor) * 100, 1),
                           "hem_mean_after": hem_track[-1]["mean_z"],"hem_lowest_after": round((low - floor) * 100, 1)},
          "circumference_cm": {"body_waist": round(perim(body_r[0]) * 100, 1), "body_hip": round(perim(body_r[hip_i]) * 100, 1),
                               "skirt_waist": round(perim(rings[0]) * 100, 1), "skirt_hip": round(perim(rings[hip_i]) * 100, 1),
                               "skirt_hem": round(perim(rings[-1]) * 100, 1)},
          "moved_by_cloth_cm": {"median": round(float(np.median(moved)) * 100, 2), "max": round(float(moved.max()) * 100, 2)},
          "start_shell": start, "hem_track": hem_track, "diagnostics": {"no_legs": DIAG_NO_LEGS, "no_self": DIAG_NO_SELF},
          "ring_profile": [{"z": round((z - floor) * 100, 1), "perim": round(perim(r) * 100, 1), "body_bound": int(b)}
                           for z, r, b in zip(zs, rings, bound)],
          "checks": checks}
json.dump(report, open(os.path.join(out_dir, f"{name}_skirt_report.json"), "w"), indent=2)
print("SKIRT", json.dumps({"name": name, "cloth_s": round(T_SIM), "body_pairs": len(bp), "self_pairs": si,
                           "clearance_min": checks["clearance_to_body_cm"]["min"], "start_pairs": start["body_intersecting_pairs"]}))


# ---- renders: front, side and back in one picture (as V2-07) ----------------------------------------------------------------
def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        o.hide_render = True
        o.hide_viewport = True
    return [o for o in new if o.type == "MESH"]


def render_triple(objs, path):
    made = []
    for dx, rot in ((-1.0, 0.0), (0.0, 90.0), (1.0, 180.0)):
        e = bpy.data.objects.new("rig", None)
        e.location = (dx, 0, 0)
        e.rotation_euler = (0, 0, math.radians(rot))
        sc.collection.objects.link(e)
        made.append(e)
        for o in objs:
            c = o.copy()
            c.hide_render = False
            c.hide_viewport = False
            c.parent = e
            sc.collection.objects.link(c)
            made.append(c)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in made:
        bpy.data.objects.remove(o)


if not NO_RENDER:
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 24
    sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = 1500, 1000
    sc.view_settings.view_transform = "Standard"
    w = sc.world or bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.30, 0.30, 0.32, 1)
    for nm, en, rx, rz in (("sun", 3.0, 55, -25), ("fill", 1.2, 60, 155)):
        s = bpy.data.objects.new(nm, bpy.data.lights.new(nm, "SUN"))
        s.data.energy = en
        s.rotation_euler = (math.radians(rx), 0, math.radians(rz))
        sc.collection.objects.link(s)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 3.0
    cam.location = (0, -8, floor + height / 2)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.collection.objects.link(cam)
    sc.camera = cam
    body_o, tee_o, sk_o = import_glb(BODY_GLB), import_glb(TEE_GLB), import_glb(SKIRT_GLB)
    render_triple(body_o + sk_o, os.path.join(out_dir, "renders", f"{name}__skirt.png"))
    render_triple(body_o + sk_o + tee_o, os.path.join(out_dir, "renders", f"{name}__skirt_tee.png"))
print("SKIRT DONE", name, "%.0f s" % (time.time() - T0))
