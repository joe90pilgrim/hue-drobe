"""Read-only checks on the exported body, tee and trousers GLBs. Written for the 2026-11-15 Fable review
(docs/decisions/2026-11-15-fable-review.md). It changes nothing: it reads three GLBs and writes one JSON.

Run:
  blender --background --python spike/blender/analyse_meshes.py -- <out_dir> <name> <hps_cm> <json_out_dir>

<hps_cm> is `hps_height_cm_estimate` from <out_dir>/<name>_report.json. Output: <json_out_dir>/<name>_analysis.json.

Reports: everything in mesh_checks.py (which the build also runs and checks), plus analysis-only extras: garment piece
positions, faces above the shoulder line, the centre-line front and back profile, a positioned crotch ray test, where the tee
ray test misses, and circumference by height. Nothing here reads spike/tolerances.json or fails the build.

The camera visibility test from the review was removed: it counted legitimate sightlines into the neck opening and up the
trouser legs, so it overstated visible skin."""
import sys, os, json, math, collections
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

out_dir, name, hps_cm = sys.argv[sys.argv.index("--") + 1:][:3]
hps = float(hps_cm) / 100.0


def load(fn):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=fn)
    obs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    bm = bmesh.new()
    for o in obs:
        me = o.data.copy()
        me.transform(o.matrix_world)
        bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table(); bm.normal_update()
    return bm


body = load(f"{out_dir}/{name}.glb")
tee = load(f"{out_dir}/{name}_tee.glb")
trs = load(f"{out_dir}/{name}_trousers.glb")
zmin = min(v.co.z for v in body.verts)
for b in (body, tee, trs):
    for v in b.verts:
        v.co.z -= zmin
    b.normal_update()
R = {"name": name, "body_bbox_cm": [round(max(getattr(v.co, a) for v in body.verts) * 100 - min(getattr(v.co, a) for v in body.verts) * 100, 1) for a in "xyz"]}
bb, tb, rb = BVHTree.FromBMesh(body), BVHTree.FromBMesh(tee), BVHTree.FromBMesh(trs)
# which way is front? toes
feet = [v.co.y for v in body.verts if v.co.z < 0.05]
FRONT = -1.0 if abs(min(feet)) > abs(max(feet)) else 1.0
R["front_sign"] = FRONT


def components(bm):
    seen, comps = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, comp = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop(); comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index); stack.append(h)
        comps.append(comp)
    return comps


def comp_info(bm):
    out = []
    for c in sorted(components(bm), key=len, reverse=True):
        cs = [f.calc_center_median() for f in c]
        out.append({"faces": len(c), "area_cm2": round(sum(f.calc_area() for f in c) * 1e4, 1),
                    "z_cm": [round(min(p.z for p in cs) * 100, 1), round(max(p.z for p in cs) * 100, 1)],
                    "x_cm": [round(min(p.x for p in cs) * 100, 1), round(max(p.x for p in cs) * 100, 1)],
                    "y_front_cm": [round(min(p.y * FRONT for p in cs) * 100, 1), round(max(p.y * FRONT for p in cs) * 100, 1)]})
    return out


def boundary_loops(bm):
    edges = [e for e in bm.edges if e.is_boundary]
    parent = {}
    def find(v):
        while parent.setdefault(v, v) != v:
            parent[v] = parent[parent[v]]; v = parent[v]
        return v
    for e in edges:
        parent[find(e.verts[0].index)] = find(e.verts[1].index)
    loops = collections.defaultdict(list)
    for e in edges:
        loops[find(e.verts[0].index)].append(e)
    out = []
    for es in loops.values():
        vs = {v for e in es for v in e.verts}
        c = sum((v.co for v in vs), Vector()) / len(vs)
        out.append({"edges": len(es), "length_cm": round(sum(e.calc_length() for e in es) * 100, 1),
                    "centre_xyz_cm": [round(c.x * 100, 1), round(c.y * FRONT * 100, 1), round(c.z * 100, 1)]})
    return sorted(out, key=lambda d: -d["length_cm"])


R["tee_components"] = comp_info(tee)
R["tee_boundary_loops"] = boundary_loops(tee)
R["trs_components"] = comp_info(trs)
R["trs_boundary_loops"] = boundary_loops(trs)
R["tee_nonmanifold_edges"] = sum(1 for e in tee.edges if len(e.link_faces) > 2)
# faces above the highest-point-shoulder line
hi = [f for f in tee.faces if f.calc_center_median().z > hps + 0.005]
R["tee_faces_above_hps"] = {"count": len(hi), "max_z_above_hps_cm": round((max((f.calc_center_median().z for f in hi), default=hps) - hps) * 100, 1),
                            "front_count": sum(1 for f in hi if f.calc_center_median().y * FRONT > 0),
                            "abs_x_max_cm": round(max((abs(f.calc_center_median().x) for f in hi), default=0) * 100, 1)}


# --- B22: centre-front and centre-back profile. y-extent (front-to-back depth) of body torso and tee at x=0 by height
prof = []
zt_lo = min(v.co.z for v in tee.verts); zt_hi = hps
z = zt_lo + 0.01
while z < zt_hi - 0.08:
    row = [round(z * 100, 1)]
    for sign in (FRONT, -FRONT):  # front then back
        o = Vector((0.0, sign * 0.6, z)); dr = Vector((0.0, -sign, 0.0))
        hb = bb.ray_cast(o, dr, 1.0)[0]
        ht = tb.ray_cast(o, dr, 1.0)[0]
        hr = rb.ray_cast(o, dr, 1.0)[0]
        yb = hb.y * sign * 100 if hb else float("nan")
        yt = ht.y * sign * 100 if ht else float("nan")
        yr = hr.y * sign * 100 if hr else float("nan")
        row += [round(yb, 1), round(yt, 1), round(yt - max(yb, yr if not math.isnan(yr) else -1e9), 1)]
    prof.append(row)
    z += 0.04
R["centre_profile_z_|front: body, tee, gap over body-or-trousers|back: same| cm"] = prof
# cloth slope reversal: how far the tee back surface moves inward below its most-outward point above (cling measure)
back = [(r[0], r[5]) for r in prof if not math.isnan(r[5])]
front = [(r[0], r[2]) for r in prof if not math.isnan(r[2])]
def tuck(series):
    series = sorted(series, reverse=True)  # top down
    worst, peak = 0.0, -1e9
    for z_, y_ in series:
        peak = max(peak, y_)
        worst = max(worst, peak - y_)
    return round(worst, 1)
R["tee_tuck_in_below_widest_cm"] = {"front": tuck(front), "back": tuck(back)}

# --- crotch: repeat the ray test with positions, and classify
def ray_test(cloth_bm, cloth_bvh, zr, xmax=None):
    res = collections.Counter(); ex = []
    for v in body.verts:
        if not (zr[0] <= v.co.z <= zr[1]) or (xmax and abs(v.co.x) > xmax):
            continue
        o = v.co - v.normal * 0.02
        loc, nor, fi, d = cloth_bvh.ray_cast(o, v.normal, 0.32)
        if loc is None:
            kind = "miss"
        elif nor.dot(v.normal) < 0:
            kind = "front_beyond" if (loc - v.co).dot(v.normal) > 0 else "front_inside_body"
        else:
            kind = "ok" if (loc - v.co).dot(v.normal) >= 0 else "cloth_inside_body"
        res[kind] += 1
        if kind != "ok" and len(ex) < 400:
            nl, nn, nf, nd = cloth_bvh.find_nearest(v.co)
            ex.append((kind, round(v.co.x * 100, 1), round(v.co.y * FRONT * 100, 1), round(v.co.z * 100, 1),
                       [round(c, 2) for c in v.normal], round(nd * 100, 2), round((v.co - nl).dot(nn) * 100, 2)))
    return res, ex


cz = None
for r_ in json.load(open(f"{out_dir}/{name}_report.json"))["trousers"].items():
    if r_[0] == "crotch_height_cm":
        cz = r_[1] / 100.0
res, ex = ray_test(trs, rb, (cz - 0.12, cz + 0.08), xmax=0.12)
R["crotch_ray"] = dict(res)
R["crotch_examples kind,x,y_front,z,normal,nearest_cloth_cm,signed_outside_cloth_cm"] = ex[:40]
# pieces, openings, intersections, clearance and shoulder gap: the same code the build runs
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mesh_checks
R["mesh_checks"] = mesh_checks.run(body, tee, trs, hps)
# tee: where do ray misses sit
zt = min(v.co.z for v in tee.verts)
res2, ex2 = ray_test(tee, tb, (zt + 0.02, hps - 0.03))
R["tee_ray_all_body_verts_in_z_band (includes uncovered arms/neck: expect misses there)"] = dict(res2)
arm = [e for e in ex2 if e[0] != "miss"]
R["tee_non_miss_examples"] = arm[:30]
def loop_circ(bm, z):
    b = bm.copy()
    res = bmesh.ops.bisect_plane(b, geom=list(b.verts) + list(b.edges) + list(b.faces), plane_co=(0, 0, z), plane_no=(0, 0, 1))
    cut = [g for g in res["geom_cut"] if isinstance(g, bmesh.types.BMEdge)]
    parent = {}
    def find(v):
        while parent.setdefault(v, v) != v:
            parent[v] = parent[parent[v]]; v = parent[v]
        return v
    for e in cut:
        parent[find(e.verts[0])] = find(e.verts[1])
    comps = collections.defaultdict(list)
    for e in cut:
        comps[find(e.verts[0])].append(e)
    best = float("nan")
    for es in comps.values():
        vs = {v for e in es for v in e.verts}
        cx = sum(v.co.x for v in vs) / len(vs)
        L = sum(e.calc_length() for e in es)
        if abs(cx) < 0.05 and not (L <= best):
            best = L
    b.free()
    return round(best * 100, 1)
zt0 = min(v.co.z for v in tee.verts)
R["circ_by_z: z, body, trousers, tee (cm)"] = [[round(zz * 100), loop_circ(body, zz), loop_circ(trs, zz), loop_circ(tee, zz)] for zz in [zt0 + 0.02 + 0.05 * i for i in range(int((hps - 0.2 - zt0) / 0.05) + 1)]]
print("ANALYSIS_JSON " + json.dumps(R))
json.dump(R, open(f"{sys.argv[sys.argv.index('--') + 4]}/{name}_analysis.json", "w"), indent=1)
