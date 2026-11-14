"""Garment templates as offset shells of the MPFB2 body mesh.

A template is a set of body faces (chosen once on a reference body) plus an ease offset. Because every MPFB2 body shares
topology, the same template re-fits to any body: garment vertex i = body vertex i + ease * body normal i.
"""
import math
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length, t


def joint_positions(h, names):
    """Centroid of each joint vertex group, on the unmasked evaluated mesh (helpers included)."""
    mod = h.modifiers.get("Hide helpers")
    if mod:
        mod.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    e = h.evaluated_get(dg)
    me = e.to_mesh()
    idx = {g.name: g.index for g in h.vertex_groups}
    out = {n: [] for n in names}
    for v in me.vertices:
        for g in v.groups:
            gn = h.vertex_groups[g.group].name
            if gn in out and g.weight > 0.5:
                out[gn].append(v.co.copy())
    e.to_mesh_clear()
    if mod:
        mod.show_viewport = True
    return {n: sum(vs, Vector()) / len(vs) for n, vs in out.items()}


JOINTS = ["joint-pelvis", "joint-neck", "joint-l-shoulder", "joint-r-shoulder", "joint-l-elbow", "joint-r-elbow",
          "joint-l-hand", "joint-r-hand", "joint-l-upper-leg", "joint-r-upper-leg", "joint-l-knee", "joint-r-knee",
          "joint-head"]


def body_bm(h):
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    e = h.evaluated_get(dg)
    me = e.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    e.to_mesh_clear()
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    return bm


def define_tee(ref_h, hem_frac=0.50, collar_drop=0.035, sleeve_t=0.55):
    """Choose body faces forming a short-sleeve tee on the reference body. Returns the set of face indices."""
    j = joint_positions(ref_h, JOINTS)
    bm = body_bm(ref_h)
    zmin = min(v.co.z for v in bm.verts)
    H = max(v.co.z for v in bm.verts) - zmin
    hem_z = zmin + hem_frac * H
    collar_z = j["joint-neck"].z - collar_drop
    segs = {
        "torso": (j["joint-pelvis"], j["joint-neck"]),
        "head": (j["joint-neck"], j["joint-head"]),
        "lup": (j["joint-l-shoulder"], j["joint-l-elbow"]), "rup": (j["joint-r-shoulder"], j["joint-r-elbow"]),
        "lfo": (j["joint-l-elbow"], j["joint-l-hand"]), "rfo": (j["joint-r-elbow"], j["joint-r-hand"]),
        "lleg": (j["joint-l-upper-leg"], j["joint-l-knee"]), "rleg": (j["joint-r-upper-leg"], j["joint-r-knee"]),
    }
    # tolerance weights so that wide limbs/torso win fairly: subtract nominal radius
    radius = {"torso": 0.14, "head": 0.09, "lup": 0.045, "rup": 0.045, "lfo": 0.035, "rfo": 0.035, "lleg": 0.08, "rleg": 0.08}
    keep = set()
    for f in bm.faces:
        c = f.calc_center_median()
        best = min(((_seg_dist(c, *segs[k])[0] - radius[k], k) for k in segs))[1]
        d, t = _seg_dist(c, *segs[best])
        if best == "torso" and hem_z <= c.z <= collar_z:
            keep.add(f.index)
        elif best in ("lup", "rup") and t <= sleeve_t and c.z >= hem_z:
            keep.add(f.index)
    bm.free()
    return keep


def build_garment_mesh(bm, faces, ease):
    """Return a new mesh: the chosen faces of bm, each vertex pushed out along its normal by ease (metres)."""
    bm.normal_update()
    g = bmesh.new()
    vmap = {}
    for fi in faces:
        f = bm.faces[fi]
        loop = []
        for v in f.verts:
            if v.index not in vmap:
                vmap[v.index] = g.verts.new(v.co + v.normal * ease)
            loop.append(vmap[v.index])
        try:
            g.faces.new(loop)
        except ValueError:
            pass
    g.normal_update()
    me = bpy.data.meshes.new("garment")
    g.to_mesh(me)
    g.free()
    for p in me.polygons:
        p.use_smooth = True
    return me, sorted(vmap)


def clipping_report(body_bm, garment_obj_mesh, body_vertex_ids, tol=0.0):
    """Fraction of covered body vertices that lie outside (or on) the garment surface => body showing through."""
    gb = bmesh.new()
    gb.from_mesh(garment_obj_mesh)
    gb.normal_update()
    bvh = BVHTree.FromBMesh(gb)
    bad = 0
    worst = 0.0
    for i in body_vertex_ids:
        p = body_bm.verts[i].co
        loc, nor, fi, dist = bvh.find_nearest(p)
        if loc is None:
            continue
        s = (p - loc).dot(nor)
        if s > tol:
            bad += 1
            worst = max(worst, s)
    gb.free()
    return {"covered_body_verts": len(body_vertex_ids), "showing_through": bad,
            "fraction": round(bad / max(1, len(body_vertex_ids)), 4), "worst_penetration_cm": round(worst * 100, 2)}


def landmarks(body_bm, faces, vids, joints):
    zmin = min(v.co.z for v in body_bm.verts)
    hem = min(body_bm.verts[i].co.z for i in vids) - zmin
    # sleeve end: farthest garment vertex from shoulder joint on the left arm, measured along the arm
    sh, el = joints["joint-l-shoulder"], joints["joint-l-elbow"]
    arm_dir = (el - sh).normalized()
    sleeve = max((body_bm.verts[i].co - sh).dot(arm_dir) for i in vids
                 if body_bm.verts[i].co.x > 0 and _seg_dist(body_bm.verts[i].co, sh, el)[0] < 0.06)
    return {"hem_height_cm": round(hem * 100, 1), "sleeve_end_from_shoulder_cm": round(sleeve * 100, 1)}
