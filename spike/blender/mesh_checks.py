"""Geometry checks on a body and its tee and trousers, shared by the build (body_from_measurements.py) and by
analyse_meshes.py. Pure bmesh and mathutils; nothing here changes the meshes it is given.

run(body, tee, trousers, hps_z) returns a JSON-ready dict:
- pieces and openings of each garment (connected face groups, closed boundary-edge loops)
- intersecting face pairs: body with each garment, tee with trousers, each garment with itself (pairs sharing a vertex ignored),
  with a count by height above the floor (5 cm bands) for body and self pairs so they can be located
- cloth-to-body clearance: signed distance from each cloth vertex to the nearest body point (positive = outside)
- shoulder gap: the same clearance for top-facing tee vertices between the neck and the shoulder point, in 2 cm bands
The build runs it on the exported GLBs (load_glb), which is what the phone shows. Inputs are bmeshes in one coordinate frame. Each is copied and its duplicate vertices merged first, so a mesh read back from
glTF (which splits vertices at seams) gives the same answers as the in-memory mesh.
"""
import collections
import bpy, bmesh
from mathutils.bvhtree import BVHTree


def load_glb(path):
    """Import a GLB and return its meshes as one world-space bmesh; the imported objects are removed again."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    bm = bmesh.new()
    for o in new:
        if o.type == "MESH":
            me = o.data.copy()
            me.transform(o.matrix_world)
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
    for o in new:
        bpy.data.objects.remove(o)
    return bm


def merged(bm):
    b = bm.copy()
    bmesh.ops.remove_doubles(b, verts=b.verts, dist=1e-6)
    # remove_doubles leaves stored indices stale; BVH overlap pairs and the piece search both rely on them
    b.verts.index_update(); b.edges.index_update(); b.faces.index_update()
    b.verts.ensure_lookup_table(); b.faces.ensure_lookup_table(); b.normal_update()
    return b


def pieces(bm):
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
    out = []
    for c in sorted(comps, key=len, reverse=True):
        cs = [f.calc_center_median() for f in c]
        out.append({"faces": len(c), "area_cm2": round(sum(f.calc_area() for f in c) * 1e4, 1),
                    "z_cm": [round(min(p.z for p in cs) * 100, 1), round(max(p.z for p in cs) * 100, 1)]})
    return out


def openings(bm):
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
    return sorted((round(sum(e.calc_length() for e in es) * 100, 1) for es in loops.values()), reverse=True)


def self_intersections(bm, tree, floor=0.0):
    n, zs = 0, []
    for a, b in tree.overlap(tree):
        if a < b and not (set(bm.faces[a].verts) & set(bm.faces[b].verts)):
            n += 1; zs.append(round((bm.faces[a].calc_center_median().z - floor) * 100))
    return n, sorted(collections.Counter(int(z // 5) * 5 for z in zs).items())


def clearance_cm(cloth, body_tree):
    ds = []
    for v in cloth.verts:
        loc, nor, fi, d = body_tree.find_nearest(v.co)
        ds.append(d * 100 if (v.co - loc).dot(nor) > 0 else -d * 100)
    ds.sort()
    n = len(ds)
    return {"min": round(ds[0], 2), "p05": round(ds[n // 20], 2), "median": round(ds[n // 2], 2), "max": round(ds[-1], 2)}


def shoulder_gap(tee, body_tree, hps_z):
    by = collections.defaultdict(list)
    for v in tee.verts:
        if v.co.z > hps_z - 0.07 and 0.04 < abs(v.co.x) < 0.20 and v.normal.z > 0.6:
            loc, nor, fi, d = body_tree.find_nearest(v.co)
            by[int(round(abs(v.co.x) * 100)) // 2 * 2].append(d * 100 if (v.co - loc).dot(nor) > 0 else -d * 100)
    bands = {str(k): {"mean": round(sum(v) / len(v), 2), "max": round(max(v), 2), "verts": len(v)} for k, v in sorted(by.items())}
    worst = max(bands.values(), key=lambda b: b["mean"]) if bands else None
    return {"bands_by_cm_from_centre": bands, "worst_band_mean_cm": worst["mean"] if worst else None,
            "max_cm": max((b["max"] for b in bands.values()), default=None)}


def run(body, tee, trousers, hps_z):
    body, tee, trousers = merged(body), merged(tee), merged(trousers)
    bt, tt, rt = BVHTree.FromBMesh(body), BVHTree.FromBMesh(tee), BVHTree.FromBMesh(trousers)
    floor = min(v.co.z for v in body.verts)  # heights below are reported above the floor
    R = {}
    for label, g, tree in (("tee", tee, tt), ("trousers", trousers, rt)):
        p = pieces(g)
        o = openings(g)
        si, si_z = self_intersections(g, tree, floor)
        bp = bt.overlap(tree)
        bz = sorted(collections.Counter(int(round((body.faces[a].calc_center_median().z - floor) * 100)) // 5 * 5 for a, _ in bp).items())
        R[label] = {"pieces": len(p), "piece_faces_area": p, "openings": len(o), "opening_lengths_cm": o,
                    "body_intersecting_pairs": len(bp), "body_intersections_by_z_cm": bz, "self_intersecting_pairs": si,
                    "self_intersections_by_z_cm": si_z, "clearance_to_body_cm": clearance_cm(g, bt)}
    R["tee_vs_trousers_intersecting_pairs"] = len(tt.overlap(rt))
    R["tee"]["shoulder_gap"] = shoulder_gap(tee, bt, hps_z)
    for b in (body, tee, trousers):
        b.free()
    return R
