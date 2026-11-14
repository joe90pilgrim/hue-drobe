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


def define_tee(ref_h, hem_frac=0.44, collar_drop=0.035, sleeve_t=0.75):
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
        if best in ("torso", "lleg", "rleg") and hem_z <= c.z <= collar_z:
            keep.add(f.index)
        elif best in ("lup", "rup") and t <= sleeve_t and c.z >= hem_z:
            keep.add(f.index)
    bm.free()
    return keep


def _classify(co, segs, radius):
    best = min(((_seg_dist(co, *segs[k])[0] - radius[k], k) for k in segs))[1]
    return best


def build_tee(bm, faces, joints, ease=0.022, min_gap=0.006, smooth_iters=25, hem_z=None, sleeve_t=0.55):
    """Loose tee: offset shell, Laplacian-smoothed so it drapes instead of tracing anatomy, never closer than min_gap
    to the body, then cut straight at the hem (horizontal plane) and sleeves (plane across each arm).
    Returns (mesh, list of body vertex ids still covered)."""
    bm.normal_update()
    body_bvh = BVHTree.FromBMesh(bm)
    g = bmesh.new()
    layer = g.verts.layers.int.new("bodyidx")
    vmap = {}
    for fi in faces:
        f = bm.faces[fi]
        loop = []
        for v in f.verts:
            if v.index not in vmap:
                nv = g.verts.new(v.co + v.normal * ease)
                nv[layer] = v.index + 1
                vmap[v.index] = nv
            loop.append(vmap[v.index])
        try:
            g.faces.new(loop)
        except ValueError:
            pass
    g.verts.ensure_lookup_table()

    def push_out():
        for v in g.verts:
            loc, nor, fi, dist = body_bvh.find_nearest(v.co)
            if loc is None:
                continue
            d = (v.co - loc).dot(nor)
            if d < min_gap:
                v.co += nor * (min_gap - d)

    for it in range(smooth_iters):
        new_co = {}
        for v in g.verts:
            nb = [e.other_vert(v) for e in v.link_edges]
            if nb:
                avg = sum((n.co for n in nb), Vector()) / len(nb)
                new_co[v] = v.co.lerp(avg, 0.5)
        for v, c in new_co.items():
            v.co = c
        push_out()

    # smooth the open boundary (neckline) a few times to remove stair-steps
    for it in range(6):
        new_co = {}
        for v in g.verts:
            if v.is_boundary:
                nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
                if len(nb) == 2:
                    new_co[v] = v.co.lerp((nb[0].co + nb[1].co) / 2, 0.5)
        for v, c in new_co.items():
            v.co = c
    push_out()

    # straight hem
    if hem_z is not None:
        geom = list(g.verts) + list(g.edges) + list(g.faces)
        bmesh.ops.bisect_plane(g, geom=geom, plane_co=(0, 0, hem_z), plane_no=(0, 0, 1), clear_inner=True)
    # straight sleeve ends
    segs = {"torso": (joints["joint-pelvis"], joints["joint-neck"]), "head": (joints["joint-neck"], joints["joint-head"]),
            "lup": (joints["joint-l-shoulder"], joints["joint-l-elbow"]), "rup": (joints["joint-r-shoulder"], joints["joint-r-elbow"]),
            "lfo": (joints["joint-l-elbow"], joints["joint-l-hand"]), "rfo": (joints["joint-r-elbow"], joints["joint-r-hand"])}
    radius = {"torso": 0.14, "head": 0.09, "lup": 0.045, "rup": 0.045, "lfo": 0.035, "rfo": 0.035}
    for side, key in (("l", "lup"), ("r", "rup")):
        a, b = segs[key]
        d = (b - a).normalized()
        pc = a + (b - a) * sleeve_t
        geom = list(g.verts) + list(g.edges) + list(g.faces)
        bmesh.ops.bisect_plane(g, geom=geom, plane_co=pc, plane_no=d)
        kill = [v for v in g.verts if _classify(v.co, segs, radius) in (key, "lfo" if side == "l" else "rfo")
                and (v.co - pc).dot(d) > 1e-4]
        bmesh.ops.delete(g, geom=kill, context="VERTS")
    loose = [v for v in g.verts if not v.link_faces]
    bmesh.ops.delete(g, geom=loose, context="VERTS")
    g.normal_update()
    # bisect interpolates the int layer on new verts (garbage indices), so keep only verts still near their body vertex
    vids = []
    for v in g.verts:
        i = v[layer] - 1
        if 0 <= i < len(bm.verts) and (bm.verts[i].co - v.co).length < 0.06:
            vids.append(i)
    me = bpy.data.meshes.new("garment")
    g.to_mesh(me)
    g.free()
    for p in me.polygons:
        p.use_smooth = True
    return me, vids


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
