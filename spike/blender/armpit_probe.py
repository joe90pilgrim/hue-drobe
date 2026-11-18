# V3-05 fifth pass: probe the tee's shape at the A-pose armpit under a layered top, read from the built GLBs (nothing is changed).
# Run from the repo root: blender --background --python spike/blender/armpit_probe.py -- pack/out synthetic_female_large sweatshirt_over_tee
# Prints the tee vertices the layer check fails (same rule as mesh_checks.layers), slices of body, tee and top through the worst one, and
# for each tee vertex within 2.5 cm: its distance to the body, its normal, and where a ray along that normal meets the top.
import sys, os, math
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.join(os.getcwd(), "spike", "blender"))
import mesh_checks as mc

out, name, outer = sys.argv[sys.argv.index("--") + 1:][:3]
L = lambda s: mc.merged(mc.load_glb(os.path.join(out, f"{name}{s}.glb")))
body, tee, top = L(""), L("_tee"), L(f"_{outer}")
for b in (body, tee, top):
    b.normal_update()
bt, tt, ot = BVHTree.FromBMesh(body), BVHTree.FromBMesh(tee), BVHTree.FromBMesh(top)
from mathutils.kdtree import KDTree
_e = [v.co.copy() for v in top.verts if v.is_boundary]
ekd = KDTree(len(_e))
for i, q in enumerate(_e): ekd.insert(q, i)
ekd.balance()

# 1. failing tee vertices (same rule as mesh_checks.layers), both sides
fails = []
for v in tee.verts:
    loc, nor, fi, d = ot.find_nearest(v.co)
    if loc is None or d > 0.05 or ekd.find(loc)[2] < 0.02:
        continue
    s = -(v.co - loc).dot(nor)
    if s < d - 1e-6:
        h = ot.ray_cast(v.co + v.normal * 1e-5, v.normal, 0.05)
        s = d if (h[0] is not None and h[1].dot(v.normal) > 0.0) else -d
    if s < 0.002:
        fails.append((s, v))
fails.sort(key=lambda t: t[0])
print("FAILS", len(fails))
for s, v in fails[:12]:
    lb, nb, _, db = bt.find_nearest(v.co)
    # dihedral: largest angle between this vertex's face normals
    fn = [f.normal for f in v.link_faces]
    dih = max((math.degrees(a.angle(b)) for a in fn for b in fn), default=0)
    print("  s=%.2fcm at %s  teeN=%s bodyDist=%.2f bodyN=%s maxDihedral=%.0f nFaces=%d" % (
        s * 100, tuple(round(c * 100, 1) for c in v.co), tuple(round(c, 2) for c in v.normal), db * 100,
        tuple(round(c, 2) for c in nb), dih, len(v.link_faces)))

# 2. profile slices through the worst spot: plane y = y0 (front view: x across, z up), window around the crease
if fails:
    p0 = fails[0][1].co.copy()
    for plane_no, label in ((Vector((0, 1, 0)), "y-slice (x,z)"), (Vector((1, 0, 0)), "x-slice (y,z)")):
        print("SLICE", label, "through", tuple(round(c * 100, 1) for c in p0))
        for nm, b in (("body", body), ("tee", tee), ("top", top)):
            c = b.copy()
            r = bmesh.ops.bisect_plane(c, geom=list(c.verts) + list(c.edges) + list(c.faces), plane_co=p0, plane_no=plane_no)
            pts = [v.co for v in r["geom_cut"] if isinstance(v, bmesh.types.BMVert) and (v.co - p0).length < 0.05]
            ax = (0, 2) if plane_no.y else (1, 2)
            pts = sorted(pts, key=lambda q: q[2])
            print("  ", nm, " ".join("(%.1f,%.1f)" % (q[ax[0]] * 100, q[ax[1]] * 100) for q in pts))
            c.free()
    # 3. tee vertices near the spot: distance to body, body normal vs tee normal, and the top's distance along tee normal
    print("NEAR (within 2.5 cm): x y z | tee-body | tee normal | ray to top along tee normal")
    for v in sorted((v for v in tee.verts if (v.co - p0).length < 0.025), key=lambda v: (round(v.co.z, 3), v.co.x)):
        lb, nb, _, db = bt.find_nearest(v.co)
        h = ot.ray_cast(v.co + v.normal * 1e-5, v.normal, 0.05)
        hit = "%.2f%s" % (h[3] * 100, "in" if h[1].dot(v.normal) > 0 else "OUT") if h[0] else "none"
        print("  %s  %.2f  %s  %s" % (tuple(round(c * 100, 1) for c in v.co), db * 100, tuple(round(c, 2) for c in v.normal), hit))
