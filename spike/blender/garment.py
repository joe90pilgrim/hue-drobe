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


def neckline_drop(x, y, neck):
    """How far below the highest-point-shoulder height the crew neckline sits at (x, y): deepest at the front centre,
    shallow at the back, zero at the shoulder ends. None if (x, y) is outside the neck opening."""
    a, b = neck["a"], neck["b"]
    if abs(x) >= a or abs(y - neck["cy"]) > b + 0.04:
        return None
    u = (y - neck["cy"]) * neck["front"] / b
    t = max(0.0, min(1.0, (u + 1.0) / 2.0))
    t = t * t * (3 - 2 * t)
    return (neck["drop_back"] + (neck["drop_front"] - neck["drop_back"]) * t) * math.sqrt(1.0 - (x / a) ** 2)


def in_neckline(p, neck, margin=0.0):
    d = neckline_drop(p.x, p.y, neck)
    return d is not None and p.z > neck["z"] - d - margin


def define_tee(ref_h, hem_frac=0.44, collar_drop=0.035, sleeve_t=0.95):
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
        if (best in ("torso", "lleg", "rleg") or (best == "head" and c.z <= collar_z)) and hem_z <= c.z <= collar_z:
            keep.add(f.index)
        elif best in ("lup", "rup") and t <= sleeve_t and c.z >= hem_z:
            keep.add(f.index)
    bm.free()
    return keep


def _classify(co, segs, radius):
    best = min(((_seg_dist(co, *segs[k])[0] - radius[k], k) for k in segs))[1]
    return best


def nearest(tree, p):
    """BVHTree.find_nearest with a fixed tie-break: when a point is equally near two faces (on a shared edge) take the one
    with the lowest index, so the normal used does not depend on how the tree happens to be traversed. Together with
    canonical_faces this makes the answer depend on the geometry alone."""
    hit = tree.find_nearest(p)
    if hit[0] is None:
        return hit
    near = tree.find_nearest_range(p, hit[3] + 1e-7)
    return min(near, key=lambda h: h[2]) if near else hit


def canonical_faces(g):
    """Put the faces of g in a fixed geometric order and refresh all indices. bmesh cut and delete operations can leave
    faces in an order that changes from run to run; face indices then differ, so BVH tie-breaks and the exported mesh
    differ too, even when every vertex position is identical."""
    g.faces.index_update()
    order = sorted(g.faces, key=lambda f: (tuple(f.calc_center_median()), len(f.verts)))
    rank = [0] * len(order)
    for i, f in enumerate(order):
        rank[f.index] = i
    g.faces.sort(key=lambda f: rank[f.index])  # bmesh sort keys must be numbers
    g.verts.index_update(); g.edges.index_update(); g.faces.index_update()
    g.verts.ensure_lookup_table(); g.faces.ensure_lookup_table()


def build_tee(bm, faces, joints, ease=0.022, min_gap=0.006, smooth_iters=25, hem_z=None, sleeve_t=0.55, top_z=None,
              extra_mesh=None, extra_gap=0.008, extend_hem_to=None, neck=None):
    """Loose tee: offset shell, Laplacian-smoothed so it drapes instead of tracing anatomy, never closer than min_gap
    to the body, then cut straight at the hem (horizontal plane) and sleeves (plane across each arm).
    Returns (mesh, list of body vertex ids still covered)."""
    bm.normal_update()
    body_bvh = BVHTree.FromBMesh(bm)
    extra_bvh = None
    extra_verts = []
    if extra_mesh is not None:  # an inner garment the new one must sit over
        eb = bmesh.new()
        eb.from_mesh(extra_mesh)
        # Fade the inner garment's top rim into the body surface, so its waistband edge does not push bumps into the outer garment
        zt = max(v.co.z for v in eb.verts)
        for v in eb.verts:
            tt = (v.co.z - (zt - 0.05)) / 0.05
            if tt > 0.0:
                tt = min(1.0, tt)
                tt = tt * tt * (3 - 2 * tt)
                loc_b = nearest(body_bvh, v.co)[0]
                if loc_b is not None:
                    v.co = v.co.lerp(loc_b, tt)
        eb.normal_update()
        extra_bvh = BVHTree.FromBMesh(eb)
        extra_verts = [v.co.copy() for v in eb.verts]
    g = bmesh.new()
    layer = g.verts.layers.int.new("bodyidx")
    vmap = {}
    for fi in faces:
        f = bm.faces[fi]
        loop = []
        for v in f.verts:
            if v.index not in vmap:
                nv = g.verts.new(v.co + v.normal * (ease(v.co.z) if callable(ease) else ease))
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
            loc, nor, fi, dist = nearest(body_bvh, v.co)
            if loc is None:
                continue
            d = (v.co - loc).dot(nor)
            if d < min_gap:
                v.co += nor * (min_gap - d)
            # nearest-point tests are unreliable in folds (crotch), so also keep each vertex outside its own source vertex's plane
            si = v[layer] - 1
            if 0 <= si < len(bm.verts):
                sv = bm.verts[si]
                if (sv.co - v.co).length < 0.08:
                    d2 = (v.co - sv.co).dot(sv.normal)
                    if d2 < min_gap:
                        v.co += sv.normal * (min_gap - d2)
            if extra_bvh is not None:
                loc2, nor2, fi2, dist2 = nearest(extra_bvh, v.co)
                if loc2 is not None and (v.co - loc2).dot(nor2) < extra_gap and (v.co - loc2).length < 0.05:
                    v.co += nor2 * (extra_gap - (v.co - loc2).dot(nor2))

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

    if neck is not None:  # crew neckline: low at the front, high at the back
        kill = [f for f in g.faces if in_neckline(f.calc_center_median(), neck)]
        bmesh.ops.delete(g, geom=kill, context="FACES_ONLY")
        # B24: the neckline test stops 12.5 cm in front of the neck centre, so the underside of the chin survives as a
        # separate island. A tee is one piece: keep the largest connected group of faces and delete the rest.
        seen, groups = set(), []
        for f in g.faces:
            if f in seen:
                continue
            stack, grp = [f], []
            seen.add(f)
            while stack:
                x = stack.pop(); grp.append(x)
                for e in x.edges:
                    for y in e.link_faces:
                        if y not in seen:
                            seen.add(y); stack.append(y)
            groups.append(grp)
        if len(groups) > 1:
            groups.sort(key=len, reverse=True)
            bmesh.ops.delete(g, geom=[f for grp in groups[1:] for f in grp], context="FACES")
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
    # bisect interpolates the source-vertex layer on the verts it creates, which gives meaningless indices; mark them as
    # having no source vertex (0) so push_out and the covered-vertex list below ignore them
    if hem_z is not None:
        geom = list(g.verts) + list(g.edges) + list(g.faces)
        res = bmesh.ops.bisect_plane(g, geom=geom, plane_co=(0, 0, hem_z), plane_no=(0, 0, 1), clear_inner=True)
        for x in res["geom_cut"]:
            if isinstance(x, bmesh.types.BMVert) and x.is_valid:
                x[layer] = 0
    if top_z is not None:
        geom = list(g.verts) + list(g.edges) + list(g.faces)
        res = bmesh.ops.bisect_plane(g, geom=geom, plane_co=(0, 0, top_z), plane_no=(0, 0, 1), clear_outer=True)
        for x in res["geom_cut"]:
            if isinstance(x, bmesh.types.BMVert) and x.is_valid:
                x[layer] = 0
    # straight sleeve ends
    segs = {"torso": (joints["joint-pelvis"], joints["joint-neck"]), "head": (joints["joint-neck"], joints["joint-head"]),
            "lup": (joints["joint-l-shoulder"], joints["joint-l-elbow"]), "rup": (joints["joint-r-shoulder"], joints["joint-r-elbow"]),
            "lfo": (joints["joint-l-elbow"], joints["joint-l-hand"]), "rfo": (joints["joint-r-elbow"], joints["joint-r-hand"])}
    radius = {"torso": 0.14, "head": 0.09, "lup": 0.045, "rup": 0.045, "lfo": 0.035, "rfo": 0.035}
    for side, key in (("l", "lup"), ("r", "rup")) if sleeve_t is not None else ():
        a, b = segs[key]
        d = (b - a).normalized()
        pc = a + (b - a) * sleeve_t
        # No plane bisect (it leaves sliver triangles that read as frayed edges): remove whole arm faces beyond the cut,
        # then lay the new open edge flat on the cut plane.
        arm = (key, "lfo" if side == "l" else "rfo")
        kill = [f for f in g.faces if _classify(f.calc_center_median(), segs, radius) in arm
                and (f.calc_center_median() - pc).dot(d) > 0.0]
        bmesh.ops.delete(g, geom=kill, context="FACES")
        loose = [v for v in g.verts if not v.link_faces]
        bmesh.ops.delete(g, geom=loose, context="VERTS")
        ring = [v for v in g.verts if v.is_boundary and _seg_dist(v.co, a, b + d * 0.25)[0] < 0.09
                and abs((v.co - pc).dot(d)) < 0.03]
        for v in ring:
            v.co -= d * (v.co - pc).dot(d)
        # a few passes of smoothing along the ring itself, then re-flatten, so the edge is a clean loop
        for _ in range(4):
            new_co = {}
            for v in ring:
                nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary and e.other_vert(v) in ring]
                if len(nb) == 2:
                    new_co[v] = v.co.lerp((nb[0].co + nb[1].co) / 2, 0.5)
            for v, c in new_co.items():
                v.co = c - d * (c - pc).dot(d)
    if extend_hem_to is not None and hem_z is not None and extend_hem_to < hem_z - 1e-4:
        # hanging tube below the crotch: extrude the hem loop straight down, then keep it clear of the body and trousers
        edges = [e for e in g.edges if e.is_boundary and all(abs(v.co.z - hem_z) < 3e-4 for v in e.verts)]
        r = bmesh.ops.extrude_edge_only(g, edges=edges)
        for x in r["geom"]:
            if isinstance(x, bmesh.types.BMVert):
                x.co.z = extend_hem_to
        bmesh.ops.recalc_face_normals(g, faces=list(g.faces))
        push_out()
    if extra_bvh is not None:
        # inner garment poking through the outer one: push the nearest outer vertices out until it is covered with a margin
        g_floor = min(v.co.z for v in g.verts) + 0.03  # below this the outer hem edge is the nearest cloth, which says nothing
        for _ in range(12):
            g.normal_update()
            # the hem extrude above creates faces in an order that varies between runs, and BVHTree.FromBMesh returns each
            # face's stored index, which the deletes and cuts leave stale; fix both before building the tree
            canonical_faces(g)
            outer = BVHTree.FromBMesh(g)
            moved = 0
            for p in extra_verts:
                if p.z < g_floor:
                    continue
                loc3, nor3, fi3, d3 = nearest(outer, p)
                if loc3 is None or d3 > 0.05:
                    continue
                s_ = (p - loc3).dot(nor3)
                if s_ > -0.0015:
                    need = s_ + 0.003
                    for fv in g.faces[fi3].verts:
                        fv.co += nor3 * need * 0.6
                    moved += 1
            if not moved:
                break
    loose = [v for v in g.verts if not v.link_faces]
    bmesh.ops.delete(g, geom=loose, context="VERTS")
    # orientation guard: recalc_face_normals can flip an open mesh as a whole, so check the cloth faces point away from the body
    g.normal_update()
    votes = 0
    for f in g.faces:
        c = f.calc_center_median()
        loc, nor, fi, dist = nearest(body_bvh, c)
        if loc is not None:
            votes += 1 if (c - loc).dot(f.normal) > 0 else -1
    if votes < 0:
        bmesh.ops.reverse_faces(g, faces=list(g.faces))
    g.normal_update()
    # bisect interpolates the int layer on new verts (garbage indices), so keep only verts still near their body vertex
    vids = []
    for v in g.verts:
        i = v[layer] - 1
        if 0 <= i < len(bm.verts) and (bm.verts[i].co - v.co).length < 0.06:
            vids.append(i)
    canonical_faces(g)
    me = bpy.data.meshes.new("garment")
    g.to_mesh(me)
    g.free()
    for p in me.polygons:
        p.use_smooth = True
    return me, vids


def clipping_report(body_bm, garment_obj_mesh, body_vertex_ids, tol=0.0, zrange=None, edge_margin=0.012, skip=None):
    """Fraction of covered body vertices that lie outside (or on) the garment surface => body showing through."""
    gb = bmesh.new()
    gb.from_mesh(garment_obj_mesh)
    gb.normal_update()
    bvh = BVHTree.FromBMesh(gb)
    from mathutils.kdtree import KDTree
    bverts = [v for v in gb.verts if v.is_boundary]
    kd = KDTree(max(1, len(bverts)))
    for k, v in enumerate(bverts):
        kd.insert(v.co, k)
    kd.balance()
    skipped = 0
    bad = 0
    worst = 0.0
    where = []
    if zrange:
        body_vertex_ids = [i for i in body_vertex_ids if zrange[0] <= body_bm.verts[i].co.z <= zrange[1]]
    for i in body_vertex_ids:
        p = body_bm.verts[i].co
        if skip and skip(p):
            continue
        loc, nor, fi, dist = bvh.find_nearest(p)
        if loc is None:
            continue
        if bverts and kd.find(loc)[2] < edge_margin:
            skipped += 1  # next to an open fabric edge the inside/outside test is not meaningful
            continue
        s = (p - loc).dot(nor)
        if s > tol:
            bad += 1
            worst = max(worst, s)
            where.append((round(p.z * 100), round(abs(p.x) * 100), round(s * 100, 1)))
    gb.free()
    return {"covered_body_verts": len(body_vertex_ids), "showing_through": bad,
            "fraction": round(bad / max(1, len(body_vertex_ids)), 4), "worst_penetration_cm": round(worst * 100, 2), "skipped_near_edge": skipped,
            "worst_at_z_x_depth_cm": sorted(where, key=lambda w: -w[2])[:6]}


def landmarks(body_bm, faces, vids, joints):
    zmin = min(v.co.z for v in body_bm.verts)
    hem = min(body_bm.verts[i].co.z for i in vids) - zmin
    # sleeve end: farthest garment vertex from shoulder joint on the left arm, measured along the arm
    sh, el = joints["joint-l-shoulder"], joints["joint-l-elbow"]
    arm_dir = (el - sh).normalized()
    sleeve = max((body_bm.verts[i].co - sh).dot(arm_dir) for i in vids
                 if body_bm.verts[i].co.x > 0 and _seg_dist(body_bm.verts[i].co, sh, el)[0] < 0.06)
    return {"hem_height_cm": round(hem * 100, 1), "sleeve_end_from_shoulder_cm": round(sleeve * 100, 1)}


def define_trousers(ref_h, hem_frac=0.03, waist_frac=0.66):
    """Body faces for trousers on the reference body: pelvis and both legs between hem and a little above the waist."""
    j = joint_positions(ref_h, JOINTS + ["joint-l-ankle", "joint-r-ankle"])
    bm = body_bm(ref_h)
    zmin = min(v.co.z for v in bm.verts)
    H = max(v.co.z for v in bm.verts) - zmin
    hem_z, top_z = zmin + hem_frac * H, zmin + waist_frac * H
    segs = {
        "torso": (j["joint-pelvis"], j["joint-neck"]),
        "lup": (j["joint-l-shoulder"], j["joint-l-elbow"]), "rup": (j["joint-r-shoulder"], j["joint-r-elbow"]),
        "lfo": (j["joint-l-elbow"], j["joint-l-hand"]), "rfo": (j["joint-r-elbow"], j["joint-r-hand"]),
        "lleg": (j["joint-l-upper-leg"], j["joint-l-knee"]), "rleg": (j["joint-r-upper-leg"], j["joint-r-knee"]),
        "lshin": (j["joint-l-knee"], j["joint-l-ankle"]), "rshin": (j["joint-r-knee"], j["joint-r-ankle"]),
    }
    radius = {"torso": 0.14, "lup": 0.045, "rup": 0.045, "lfo": 0.035, "rfo": 0.035,
              "lleg": 0.08, "rleg": 0.08, "lshin": 0.05, "rshin": 0.05}
    keep = set()
    for f in bm.faces:
        c = f.calc_center_median()
        if hem_z <= c.z <= top_z and _classify(c, segs, radius) in ("torso", "lleg", "rleg", "lshin", "rshin"):
            keep.add(f.index)
    bm.free()
    return keep


def crotch_height_cm(body_bm_, H_m):
    """Highest height at which the body cross-section splits into two separate leg loops (scanning down from 0.55H)."""
    zmin = min(v.co.z for v in body_bm_.verts)
    z = zmin + 0.55 * H_m
    while z > zmin + 0.30 * H_m:
        b = body_bm_.copy()
        res = bmesh.ops.bisect_plane(b, geom=list(b.verts) + list(b.edges) + list(b.faces),
                                     plane_co=(0, 0, z), plane_no=(0, 0, 1))
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
            for v in ed.verts:
                comps.setdefault(find(v), []).append(v.co.x)
        legs = [xs for xs in comps.values() if len(xs) > 12 and 0.03 < abs(sum(xs) / len(xs)) < 0.3]
        b.free()
        if len(legs) >= 2:
            return (z - zmin) * 100.0
        z -= 0.005
    return float("nan")


def clipping_report_ray(body_bm, garment_mesh, body_vertex_ids, zrange=None, max_dist=0.30, edge_margin=0.03, skip=None):
    """Second, independent clipping test. From each covered body vertex AND each covered face centre, cast a ray outward
    along the body normal at the garment. The point is covered if the first hit is the garment's inside (the garment's
    outward normal points the same way as the ray). It is showing through if the first hit is a front face (the ray started
    outside the cloth) or nothing is hit within max_dist.
    Misses next to an open fabric edge are also counted separately, so both a strict and an edge-tolerant figure are reported."""
    from mathutils.kdtree import KDTree
    gb = bmesh.new()
    gb.from_mesh(garment_mesh)
    gb.normal_update()
    bvh = BVHTree.FromBMesh(gb)
    bverts = [v for v in gb.verts if v.is_boundary]
    kd = KDTree(max(1, len(bverts)))
    for k, v in enumerate(bverts):
        kd.insert(v.co, k)
    kd.balance()
    body_bm.normal_update()
    ids = set(body_vertex_ids)
    if zrange:
        ids = {i for i in ids if zrange[0] <= body_bm.verts[i].co.z <= zrange[1]}
    samples = [(body_bm.verts[i].co.copy(), body_bm.verts[i].normal.copy()) for i in ids]
    for f in body_bm.faces:
        if all(v.index in ids for v in f.verts):
            samples.append((f.calc_center_median(), f.normal.copy()))
    if skip:
        samples = [(p, n) for p, n in samples if not skip(p)]
    strict = tolerant = front_hits = misses = 0
    where = []
    for p, n in samples:
        origin = p - n * 0.02  # start 2 cm inside the body so a tight garment is not missed at the origin
        loc, nor, fi, dist = bvh.ray_cast(origin, n, max_dist + 0.02)
        bad = False
        if loc is None:
            bad = True
            misses += 1
        else:
            # first hit must be the garment's inside; the first hit along the ray from inside the body
            if nor.dot(n) < 0:
                bad = True
                front_hits += 1
        if bad:
            where.append((round(p.z * 100), round(p.x * 100), round(p.y * 100), 'miss' if loc is None else 'front'))
            strict += 1
            near_edge = bool(bverts) and kd.find(loc if loc is not None else p)[2] < edge_margin
            if not near_edge:
                tolerant += 1
    gb.free()
    n_s = max(1, len(samples))
    return {"samples": len(samples), "showing_through_strict": strict, "fraction_strict": round(strict / n_s, 4),
            "showing_through_excluding_edges": tolerant, "fraction_excluding_edges": round(tolerant / n_s, 4),
            "front_face_hits": front_hits, "no_hit": misses,
            "where_z_x_y_kind_cm": where[:400]}


def self_intersections_band(body_bm_, z_lo, z_hi):
    """Count pairs of body faces that overlap each other (ignoring faces that share a vertex) inside a height band."""
    body_bm_.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(body_bm_)
    pairs = tree.overlap(tree)
    seen = set()
    for a, b in pairs:
        if a >= b:
            continue
        fa, fb = body_bm_.faces[a], body_bm_.faces[b]
        if set(fa.verts) & set(fb.verts):
            continue
        za, zb = fa.calc_center_median().z, fb.calc_center_median().z
        if z_lo <= za <= z_hi and z_lo <= zb <= z_hi:
            seen.add((a, b))
    return len(seen)
