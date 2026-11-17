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


NECKLINES = ("crew", "v", "scoop")  # V1.1-04: cut shapes on the same tee shell; "crew" is the original and is unchanged


def neckline_drop(x, y, neck):
    """How far below the highest-point-shoulder height the neckline sits at (x, y): deepest at the front centre,
    shallow at the back, zero at the shoulder ends. None if (x, y) is outside the neck opening.
    neck["style"] (V1.1-04, default "crew") changes the front only; the back stays the crew curve, because a V-shaped back
    neckline was a reported fault (docs/bug-log.md):
      crew   the front curve is an ellipse (unchanged from the MVP);
      v      the front is two straight lines from the shoulder ends to the front centre;
      scoop  a rounder, flatter-bottomed curve (a superellipse of power 3).
    neck["reach"] (m) widens how far in front of the neck centre the cut looks, so a deeper front is not cut short."""
    a, b = neck["a"], neck["b"]
    if abs(x) >= a or abs(y - neck["cy"]) > b + 0.04 + neck.get("reach", 0.0):
        return None
    u = (y - neck["cy"]) * neck["front"] / b
    t = max(0.0, min(1.0, (u + 1.0) / 2.0))
    t = t * t * (3 - 2 * t)
    ell = math.sqrt(1.0 - (x / a) ** 2)
    style = neck.get("style", "crew")
    if style == "crew":
        return (neck["drop_back"] + (neck["drop_front"] - neck["drop_back"]) * t) * ell
    s = abs(x) / a
    front_shape = 1.0 - s if style == "v" else math.sqrt(1.0 - s ** 3)
    return neck["drop_back"] * ell + (neck["drop_front"] - neck["drop_back"]) * t * front_shape


def in_neckline(p, neck, margin=0.0):
    d = neckline_drop(p.x, p.y, neck)
    return d is not None and p.z > neck["z"] - d - margin


def define_tee(ref_h, hem_frac=0.44, collar_drop=0.035, sleeve_t=0.95, long_sleeves=False):
    """Choose body faces forming a short-sleeve tee on the reference body. Returns the set of face indices.
    long_sleeves (MVP-07 sweatshirt): keep the whole upper arm and the forearm up to the wrist joint (the hand is left out),
    at any height, since in the A-pose the forearm hangs below the torso hem."""
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
        elif best in ("lup", "rup") and (long_sleeves or (t <= sleeve_t and c.z >= hem_z)):
            keep.add(f.index)
        elif long_sleeves and best in ("lfo", "rfo"):
            a, b = segs[best]
            if (c - a).dot(b - a) / (b - a).length_squared < 1.0:  # unclamped: the hand lies beyond 1
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


def _arm_segs(joints):
    segs = {"torso": (joints["joint-pelvis"], joints["joint-neck"]), "head": (joints["joint-neck"], joints["joint-head"]),
            "lup": (joints["joint-l-shoulder"], joints["joint-l-elbow"]), "rup": (joints["joint-r-shoulder"], joints["joint-r-elbow"]),
            "lfo": (joints["joint-l-elbow"], joints["joint-l-hand"]), "rfo": (joints["joint-r-elbow"], joints["joint-r-hand"])}
    radius = {"torso": 0.14, "head": 0.09, "lup": 0.045, "rup": 0.045, "lfo": 0.035, "rfo": 0.035}
    return segs, radius


ARM = ("lup", "rup", "lfo", "rfo")


def build_tee(bm, faces, joints, ease=0.022, min_gap=0.006, smooth_iters=25, hem_z=None, sleeve_t=0.55, top_z=None,
              extra_mesh=None, extra_gap=0.008, extend_hem_to=None, neck=None, settle_shoulders=False,
              fork_z=None, fork_gap=0.0015, long_sleeves=False, forearm_ease_frac=1.0, hem_band=None, cuff_band=None, final_push=False,
              extra_trigger=-0.0015, extra_push=0.003, bust=None):
    """Loose tee: offset shell, Laplacian-smoothed so it drapes instead of tracing anatomy, never closer than min_gap
    to the body, then cut straight at the hem (horizontal plane) and sleeves (plane across each arm).
    settle_shoulders (needs neck): in the shoulder region (within 10 cm below the shoulder line and no wider than the
    shoulder joints plus 3 cm), fade the ease to min_gap where the body faces up and settle the cloth onto the body, so it
    rests on the shoulders instead of floating by the full ease (B23). Chest, bust and sleeves keep their ease.
    fork_z (trousers): below this height (crotch plus 3 cm), a vertex whose source body vertex is on the left leg stays
    at least fork_gap left of the centre plane, and likewise on the right, so the two leg shells cannot cross (B1).
    long_sleeves (MVP-07 sweatshirt): sleeve_t is a fraction of the forearm (elbow to wrist) instead of the upper arm, and
    the hem cut leaves the sleeves alone (in the A-pose the forearm can hang below the hem).
    forearm_ease_frac: the ease falls linearly down the forearm, from the full ease at the elbow to this fraction at the wrist.
    hem_band, cuff_band: (band height m, gap m). Ribbing: within the band above the hem or before the cuff the cloth is drawn
    in to that gap (fading in over 3 cm) from the inner garment where there is one (hem), else from the body, then kept clear
    of the body and inner garment as everywhere else.
    final_push (V2-04 tights): push the cloth clear of the body once more after the hem and top cuts. The cuts make new vertices on
    straight lines between existing ones, which on a round ankle sit a little closer to the skin than the shell's own vertices;
    a skin-close shell has no gap to spare.
    extra_trigger, extra_push (inner garment, m): the final pass moves cloth out when an inner-garment vertex is less than
    -extra_trigger inside it, by enough to put the inner vertex extra_push inside. The defaults (1.5 mm, 3 mm) suit a tee over trousers;
    shorts over skin-close tights use 0.2 mm and 0.4 mm, so they move out only where the two would touch.
    bust (V2-08, tops on a female body): {"apexes": [Vector, Vector] (the most forward body point of each breast), "front": +1/-1
    (sign of the forward axis, y), "reach": m, "slack": m per m, "halfwidth": m, "side_taper": m per m, "pad": m, "pad_radius": m}. Without it the shell rests
    on the body at min_gap everywhere, so under each breast it follows the body back in and comes to a point at the apex. With it:
    (1) gravity: below each apex, down to reach, a front-facing torso vertex is kept no further back than the cloth above it in its
    own column (within halfwidth sideways), less slack per metre of drop, so the cloth hangs from the bust instead of tucking under
    it; and (2) pad: within pad_radius of each apex the clearance to the body rises from min_gap to min_gap plus pad (smoothly), which
    rounds the apex the way a bra cup does. Both only move cloth away from the body, so neither can cause a clip. Applied inside
    every push_out, so the smoothing blends the result rather than leaving a step.
    Returns (mesh, list of body vertex ids still covered)."""
    segs, radius = _arm_segs(joints)
    bm.normal_update()
    body_bvh = BVHTree.FromBMesh(bm)
    if settle_shoulders and neck is not None:
        _sx = max(abs(joints["joint-l-shoulder"].x), abs(joints["joint-r-shoulder"].x)) + 0.03
        in_shoulders = lambda p: p.z > neck["z"] - 0.10 and abs(p.x) < _sx
    else:
        in_shoulders = lambda p: False
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
                e = ease(v.co.z) if callable(ease) else ease
                if forearm_ease_frac != 1.0:
                    k = _classify(v.co, segs, radius)
                    if k in ("lfo", "rfo"):
                        e *= 1.0 - (1.0 - forearm_ease_frac) * _seg_dist(v.co, *segs[k])[1]
                if in_shoulders(v.co) and e > min_gap:
                    t = min(1.0, max(0.0, (v.normal.z - 0.3) / 0.5))
                    e += (min_gap - e) * t * t * (3 - 2 * t)
                nv = g.verts.new(v.co + v.normal * e)
                nv[layer] = v.index + 1
                vmap[v.index] = nv
            loop.append(vmap[v.index])
        try:
            g.faces.new(loop)
        except ValueError:
            pass
    g.verts.ensure_lookup_table()

    def _gap(p):
        """Clearance wanted at p: min_gap, raised by the bust pad near each apex (V2-08)."""
        if bust is None or bust["pad"] <= 0.0:
            return min_gap
        extra = 0.0
        for a in bust["apexes"]:
            t = 1.0 - min(1.0, (p - a).length / bust["pad_radius"])
            extra = max(extra, bust["pad"] * t * t * (3 - 2 * t))
        return min_gap + extra

    def push_out():
        for v in g.verts:
            loc, nor, fi, dist = nearest(body_bvh, v.co)
            if loc is None:
                continue
            gap = _gap(v.co)
            d = (v.co - loc).dot(nor)
            if d < gap:
                v.co += nor * (gap - d)
            # nearest-point tests are unreliable in folds (crotch), so also keep each vertex outside its own source vertex's plane
            si = v[layer] - 1
            if 0 <= si < len(bm.verts):
                sv = bm.verts[si]
                if (sv.co - v.co).length < 0.08:
                    d2 = (v.co - sv.co).dot(sv.normal)
                    if d2 < min_gap:
                        v.co += sv.normal * (min_gap - d2)
            if fork_z is not None and v.co.z < fork_z and 0 <= si < len(bm.verts):
                sx = bm.verts[si].co.x
                if abs(sx) > 0.005 and v.co.x * (1.0 if sx > 0 else -1.0) < fork_gap:
                    v.co.x = fork_gap if sx > 0 else -fork_gap
            if extra_bvh is not None:
                loc2, nor2, fi2, dist2 = nearest(extra_bvh, v.co)
                if loc2 is not None and (v.co - loc2).dot(nor2) < extra_gap and (v.co - loc2).length < 0.05:
                    v.co += nor2 * (extra_gap - (v.co - loc2).dot(nor2))
        if bust is not None and bust["reach"] > 0.0:
            hang()

    def hang():
        """V2-08 gravity under the bust: a front-facing torso vertex below an apex is kept no further back than the cloth above
        it in its own column, less the slack. Columns are per vertex, so the floor tapers off sideways where the cloth above is
        lower (towards the centre and the sides), and nothing is moved where the body below is already further forward."""
        fr = bust["front"]
        for a in bust["apexes"]:
            z_lo, z_hi, side = a.z - bust["reach"], a.z + 0.01, 1.0 if a.x > 0 else -1.0
            col = []
            for v in g.verts:
                # the breast's own width, then a taper (side_taper, m back per m sideways) out to 5 cm beyond the apex: with no
                # taper the smoothing spread the hung cloth into a flat wall right round to the sides under the arms, where a
                # real top is held back by the side seam, and a hard cut-off left a step at its edge
                if not (z_lo < v.co.z < z_hi and v.co.x * side > -0.01 and abs(v.co.x) < abs(a.x) + 0.05):
                    continue
                si = v[layer] - 1
                if not (0 <= si < len(bm.verts)) or bm.verts[si].normal.y * fr < 0.1 or _classify(v.co, segs, radius) != "torso":
                    continue
                col.append(v)
            col.sort(key=lambda v: -v.co.z)  # top down, so a vertex sees the already-settled cloth above it
            for i, v in enumerate(col):
                floor = None
                for u in col[:i]:
                    if abs(u.co.x - v.co.x) < bust["halfwidth"]:
                        # over the bottom third of the reach the floor falls away at 1 in 2, so the hang ends in a slope, not a step
                        f = (u.co.y * fr - bust["slack"] * (u.co.z - v.co.z) - bust["side_taper"] * max(0.0, abs(v.co.x) - abs(a.x) - 0.01)
                             - 0.5 * max(0.0, z_lo + bust["reach"] / 3.0 - v.co.z))
                        if floor is None or f > floor:
                            floor = f
                if floor is not None and v.co.y * fr < floor:
                    v.co.y += fr * (floor - v.co.y * fr)

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
        if neck.get("style", "crew") == "v":
            # V1.1-04: the cut removes whole faces, so along a slanted edge (the V) it leaves steps. Move each vertex on the cut
            # edge to the nearest point of the neckline curve, if that is within 3 cm (the hem and sleeve edges are further).
            # Nearest point, not straight up or down: the two ends of a step then land at different points on the line.
            for v in g.verts:
                if not v.is_boundary:
                    continue
                best = None
                for k in range(-15, 16):
                    x2 = v.co.x + k * 0.002
                    d = neckline_drop(x2, v.co.y, neck)
                    if d is None:
                        continue
                    z2 = neck["z"] - d
                    dist2 = (x2 - v.co.x) ** 2 + (z2 - v.co.z) ** 2
                    if dist2 < 0.03 ** 2 and (best is None or dist2 < best[0]):
                        best = (dist2, x2, z2)
                if best:
                    v.co.x, v.co.z = best[1], best[2]
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
    if settle_shoulders and neck is not None:
        # settle: smoothing bridges the hollow between neck and shoulder point, so cloth floats there. In the shoulders, where
        # the body or the cloth faces up, draw the cloth down onto the body (at min_gap), blended by how much it faces up. The
        # cloth's own normal matters at the base of the neck, where the body turns sideways but the cloth bridging it faces up.
        for _settle in range(6):  # normals change as the cloth settles, so repeat
            g.normal_update()
            for v in g.verts:
                if not in_shoulders(v.co):
                    continue
                loc, nor, fi, dist = nearest(body_bvh, v.co)
                if loc is None:
                    continue
                t = min(1.0, max(0.0, (max(nor.z, v.normal.z) - 0.3) / 0.5))
                t = t * t * (3 - 2 * t)
                if neck is not None and v.is_boundary and abs(v.co.x) < neck["a"] + 0.03 and (
                        neck.get("style", "crew") != "v" or v.co.z > neck["z"] - 0.05):
                    # the neckline edge: a crew or scoop neck's ribbing lies against the body. Pulling the whole slanted edge of a
                    # V onto the body made it ragged, so only its top 5 cm (by the shoulder) is pulled in.
                    t = 1.0
                if t > 0.0:
                    v.co = v.co.lerp(loc + nor * min_gap, t)
            push_out()

    if hem_band is not None or cuff_band is not None:
        # ribbing: draw the cloth in towards the body inside the bands; the 3 cm fade keeps the step smooth, so no fold
        def _band_weight(p):
            k = _classify(p, segs, radius)
            s_ = None
            if hem_band is not None and hem_z is not None and k not in ARM:
                s_, (bh, gap) = p.z - hem_z, hem_band
            elif cuff_band is not None and k in ("lfo", "rfo") and sleeve_t is not None:
                a, b = segs[k]
                d = (b - a).normalized()
                s_, (bh, gap) = (a + (b - a) * sleeve_t - p).dot(d), cuff_band
            if s_ is None:
                return 0.0, 0.0
            t = 1.0 - min(1.0, max(0.0, (s_ - bh) / 0.03))
            return t * t * (3 - 2 * t), gap
        for _band in range(4):
            for v in g.verts:
                w, gap = _band_weight(v.co)
                if w <= 0.0:
                    continue
                loc, nor, fi, dist = nearest(body_bvh, v.co)
                if extra_bvh is not None and _classify(v.co, segs, radius) not in ARM:
                    # the hem band lies over the inner garment: follow its smooth surface, not the body, which would pull
                    # the cloth into the cleft between the buttocks and fold it over itself
                    loc2, nor2, fi2, dist2 = nearest(extra_bvh, v.co)
                    if loc2 is not None and dist2 < 0.06:
                        loc, nor = loc2, nor2
                if loc is not None:
                    v.co = v.co.lerp(loc + nor * gap, w)
            push_out()

    # straight hem
    # bisect interpolates the source-vertex layer on the verts it creates, which gives meaningless indices; mark them as
    # having no source vertex (0) so push_out and the covered-vertex list below ignore them
    if hem_z is not None:
        geom = list(g.verts) + list(g.edges) + list(g.faces)
        if long_sleeves:  # cut the body of the garment only; the sleeves hang below the hem in the A-pose
            body_faces = [f for f in g.faces if _classify(f.calc_center_median(), segs, radius) not in ARM]
            bv = {v for f in body_faces for v in f.verts}
            geom = list(bv) + list({e for f in body_faces for e in f.edges}) + body_faces
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
    if final_push:
        push_out()
    # straight sleeve ends
    for side, key in ((("l", "lfo"), ("r", "rfo")) if long_sleeves else (("l", "lup"), ("r", "rup"))) if sleeve_t is not None else ():
        a, b = segs[key]
        d = (b - a).normalized()
        pc = a + (b - a) * sleeve_t
        # No plane bisect (it leaves sliver triangles that read as frayed edges): remove whole arm faces beyond the cut,
        # then lay the new open edge flat on the cut plane.
        arm = (side + "up", side + "fo")
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
    if long_sleeves and sleeve_t is not None:
        push_out()  # a long sleeve ends at the narrow wrist, where laying the cut edge flat can pull it to the skin
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
                if s_ > extra_trigger:
                    need = s_ + extra_push
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


def cuff_above_wrist_cm(body_bm, vids, joints):
    """Long sleeves: how far the left cuff stops short of the wrist joint, measured along the forearm."""
    el, wr = joints["joint-l-elbow"], joints["joint-l-hand"]
    d = (wr - el).normalized()
    reach = max((body_bm.verts[i].co - el).dot(d) for i in vids
                if body_bm.verts[i].co.x > 0 and _seg_dist(body_bm.verts[i].co, el, wr)[0] < 0.06)
    return round(((wr - el).length - reach) * 100, 1)


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


def _loop_tri_bm(mesh):
    """A bmesh of the mesh split into the same triangles the glTF exporter writes (Blender's loop triangles)."""
    mesh.calc_loop_triangles()
    b = bmesh.new()
    vs = [b.verts.new(v.co) for v in mesh.vertices]
    for t in mesh.loop_triangles:
        try:
            b.faces.new([vs[k] for k in t.vertices])
        except ValueError:
            pass
    b.verts.index_update(); b.faces.index_update(); b.faces.ensure_lookup_table(); b.normal_update()
    return b


def tuck_inside(inner_mesh, outer_mesh, body_bm_, body_gap, body_floor=0.00203, margin=0.0006, passes=6, reach=0.02, step=0.0002,
                overlap_passes=40):
    """V2-04: fit an inner garment (tights) under an outer one (shorts). Returns (mesh, left), where left is the number of inner
    triangles still crossing the outer garment (0 when it worked).
    1. Every inner vertex within `reach` of the outer garment is pulled to `margin` inside it, and kept body_gap off the body.
    2. Nearest-point tests are unreliable in folds: at the front of the crotch a coarse outer triangle can cut through the inner wall
       while every vertex of both is on its own side. So the same face-pair overlap test the checks use is run on exactly the triangles
       that will be exported (the outer garment's loop triangles; the inner one is triangulated here), and only the inner triangles
       that cross are pressed towards the skin, `step` at a time, never nearer than body_floor (the checks need 2 mm; 2.03 is used).
       Inner triangles crossing the body are pushed back out the same way."""
    g = bmesh.new()
    g.from_mesh(inner_mesh)
    bmesh.ops.triangulate(g, faces=list(g.faces))  # the exporter keeps triangles as they are, so what is fitted here is what ships
    o = _loop_tri_bm(outer_mesh)
    outer = BVHTree.FromBMesh(o)
    body_bm_.normal_update()
    body = BVHTree.FromBMesh(body_bm_)
    _bm = bpy.data.meshes.new("body_tri")
    body_bm_.to_mesh(_bm)
    bt = _loop_tri_bm(_bm)  # the body's export triangles too
    bpy.data.meshes.remove(_bm)
    body_tri = BVHTree.FromBMesh(bt)

    def guard(v, floor):
        bl, bn, bf, bd = nearest(body, v.co)
        db = (v.co - bl).dot(bn)
        if db < floor:
            v.co += bn * (floor - db)

    for _ in range(passes):
        for v in g.verts:
            loc, nor, fi, d = nearest(outer, v.co)
            if loc is not None and d <= reach:
                s = (v.co - loc).dot(nor)
                if s > -margin:
                    v.co -= nor * (s + margin)
            guard(v, body_gap)
    left = 0
    for _ in range(overlap_passes):
        g.verts.index_update(); g.faces.index_update(); g.faces.ensure_lookup_table()
        tree = BVHTree.FromBMesh(g)
        crossing = {a for a, _b in tree.overlap(outer)}
        through_body = {a for a, _b in tree.overlap(body_tri)}
        left = len(crossing)
        if not crossing and not through_body:
            break
        for a in crossing:
            for v in g.faces[a].verts:
                bl, bn, bf, bd = nearest(body, v.co)
                v.co -= bn * step
                guard(v, body_floor)
        for a in through_body - crossing:
            for v in g.faces[a].verts:
                bl, bn, bf, bd = nearest(body, v.co)
                v.co += bn * step
    # Last, the clearance as the checks measure it: the straight distance to the nearest body point. In a cleft (the buttocks on
    # Joe) a vertex pushed off one side along its normal ends up nearer the other side, so push straight away from the nearest
    # point, a few times over, then count the crossings again.
    for _ in range(10):
        moved = 0
        for v in g.verts:
            bl, bn, bf, bd = body.find_nearest(v.co)
            if bl is not None and bd < body_floor + 0.00005 and (v.co - bl).dot(bn) > 0:
                v.co = bl + (v.co - bl).normalized() * (body_floor + 0.00005)
                moved += 1
        if not moved:
            break
    g.verts.index_update(); g.faces.index_update()
    left = len({a for a, _b in BVHTree.FromBMesh(g).overlap(outer)})
    bt.free()
    g.normal_update()
    me = bpy.data.meshes.new("garment")
    g.to_mesh(me)
    g.free()
    o.free()
    for p in me.polygons:
        p.use_smooth = True
    return me, left


def _smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def _boundary_loop_top(g):
    """The open edge loop that holds the highest vertex (the neck opening), as an ordered list of vertices, counter-clockwise seen
    from above. Walks the boundary edges by vertex index, so the result does not depend on how bmesh orders its sets."""
    adj = {}
    for e in g.edges:
        if e.is_boundary:
            a, b = e.verts[0].index, e.verts[1].index
            adj.setdefault(a, []).append(b)
            adj.setdefault(b, []).append(a)
    start = min(adj, key=lambda i: (-g.verts[i].co.z, i))
    order, prev, cur = [start], None, start
    while True:
        cand = [k for k in adj[cur] if k != prev]
        nxt = min(adj[cur]) if prev is None else (cand[0] if cand else None)
        if nxt is None or nxt == start:
            break
        order.append(nxt)
        prev, cur = cur, nxt
        if len(order) > len(adj):
            break
    ring = [g.verts[i] for i in order]
    area = sum(ring[i].co.x * ring[(i + 1) % len(ring)].co.y - ring[(i + 1) % len(ring)].co.x * ring[i].co.y for i in range(len(ring)))
    return ring if area > 0 else ring[::-1]


def add_shirt_details(me, body_bm, joints, neck, cfg):
    """V3-03: turn a tee-shaped shell (from build_tee) into a shirt, in place, by adding two things drawn as shape (no buttons):
      placket  a strip down the centre front, raised cfg["placket_height_cm"] off the cloth, cfg["placket_half_width_cm"] either side
               of the centre line and fading out over cfg["placket_fade_cm"]. It only moves vertices outward, so it cannot touch the body.
      collar   a point collar on the neck opening. A stand rises cfg["stand_cm"] from the opening, hugging the neck at
               cfg["neck_clearance_cm"]; a flap folds over it (cfg["fold_out_cm"] outside it) and hangs down, longer at the front
               into two points (cfg["tip_drop_cm"] below the stand's top edge, at +-cfg["tip_angle_deg"] from the front centre),
               resting cfg["flap_gap_cm"] off the cloth below it.
    Returns what was drawn, for the report: placket and collar sizes as built. Deterministic: the same shell gives the same shirt."""
    c = {k: (v / 100.0 if k.endswith("_cm") else v) for k, v in cfg.items() if not k.startswith("_")}
    g = bmesh.new()
    g.from_mesh(me)
    g.verts.ensure_lookup_table(); g.faces.ensure_lookup_table(); g.verts.index_update()
    g.normal_update()
    fr, cx, cy = neck["front"], neck["cx"], neck["cy"]
    segs, radius = _arm_segs(joints)
    body_bvh = BVHTree.FromBMesh(body_bm)

    # --- placket
    raised, top_raise = 0, 0.0
    for v in g.verts:
        ax = abs(v.co.x - cx)
        if ax >= c["placket_half_width_cm"] + c["placket_fade_cm"] or (v.co.y - cy) * fr < 0.0 or v.normal.y * fr < 0.3:
            continue
        if _classify(v.co, segs, radius) != "torso":
            continue
        w = 1.0 if ax <= c["placket_half_width_cm"] else _smoothstep(1.0 - (ax - c["placket_half_width_cm"]) / c["placket_fade_cm"])
        d = c["placket_height_cm"] * w
        if d > 1e-6:
            v.co += v.normal * d
            raised += 1 if w > 0.5 else 0
            top_raise = max(top_raise, d)

    # --- collar: stand
    g.normal_update()
    ring = _boundary_loop_top(g)
    n = len(ring)
    base = [v.co.copy() for v in ring]

    def clear(p):
        loc, nor, fi, d = nearest(body_bvh, p)
        return -9.0 if loc is None else (d if (p - loc).dot(nor) > 0 else -d)

    dirs, rho_req, phis = [], [], []
    for p in base:
        dx, dy = p.x - cx, p.y - cy
        r = math.hypot(dx, dy)
        d_ = (dx / r, dy / r)
        dirs.append(d_)
        phis.append(math.atan2(dx, dy * fr))
        z = p.z + c["stand_cm"]
        rho = r
        pt = lambda rr, d_=d_, z=z: Vector((cx + d_[0] * rr, cy + d_[1] * rr, z))
        if clear(pt(rho)) >= c["neck_clearance_cm"]:
            while rho - 0.002 > 0.02 and clear(pt(rho - 0.002)) >= c["neck_clearance_cm"]:
                rho -= 0.002
        else:
            while clear(pt(rho)) < c["neck_clearance_cm"] and rho < r + 0.06:
                rho += 0.002
        rho_req.append(rho)
    rho_s = list(rho_req)
    for _ in range(4):
        rho_s = [0.25 * rho_s[i - 1] + 0.5 * rho_s[i] + 0.25 * rho_s[(i + 1) % n] for i in range(n)]
    top = []
    for i in range(n):
        rho = max(rho_s[i], rho_req[i])
        top.append(g.verts.new(Vector((cx + dirs[i][0] * rho, cy + dirs[i][1] * rho, base[i].z + c["stand_cm"]))))
    new_faces = []
    for i in range(n):
        j = (i + 1) % n
        new_faces.append(("stand", g.faces.new((ring[i], ring[j], top[j], top[i]))))
    g.verts.index_update(); g.faces.index_update(); g.normal_update()
    base_bvh = BVHTree.FromBMesh(g)  # the shirt as it is before the flap: the flap must stand clear of it

    # --- collar: the fold and the flap with its two points
    tip, tip_drop = math.radians(c["tip_angle_deg"]), c["tip_drop_cm"]
    back_from, d0, dback = math.radians(c["back_from_deg"]), c["centre_drop_cm"], c["back_drop_cm"]

    def drop(phi):
        a = abs(phi)
        if a <= tip:
            return d0 + (tip_drop - d0) * (a / tip)
        return tip_drop + (dback - tip_drop) * _smoothstep((a - tip) / max(1e-6, back_from - tip))
    rows = 3
    fold = []
    for i in range(n):
        t = top[i].co
        fold.append(g.verts.new(Vector((t.x + dirs[i][0] * c["fold_out_cm"], t.y + dirs[i][1] * c["fold_out_cm"], t.z + 0.002))))
    flap = [fold]
    for k in range(1, rows + 1):
        flap.append([g.verts.new(Vector((fold[i].co.x, fold[i].co.y, fold[i].co.z - drop(phis[i]) * k / rows))) for i in range(n)])
    for i in range(n):
        j = (i + 1) % n
        new_faces.append(("rim", g.faces.new((top[i], top[j], fold[j], fold[i]))))
        for k in range(rows):
            new_faces.append(("flap", g.faces.new((flap[k][i], flap[k][j], flap[k + 1][j], flap[k + 1][i]))))

    def push_flap():
        for k in range(1, rows + 1):
            for v in flap[k]:
                loc, nor, fi, dist = nearest(base_bvh, v.co)
                if loc is not None:
                    s_ = (v.co - loc).dot(nor)
                    if s_ < c["flap_gap_cm"]:
                        v.co += nor * (c["flap_gap_cm"] - s_)
    for _ in range(2):
        push_flap()
        for k in range(1, rows + 1):
            row = flap[k]
            sm = [row[i].co.lerp((row[i - 1].co + row[(i + 1) % n].co) / 2, 0.25) for i in range(n)]
            for i in range(n):
                row[i].co = sm[i]
    push_flap()
    push_flap()

    # the flap is pushed clear of the shell vertex by vertex, which can leave a face of it crossing another between the vertices:
    # find such pairs and move the flap's own vertices of the pair apart (never the shell's), then push clear again, until none cross
    flap_faces = [f for kind, f in new_faces if kind == "flap"]
    movable = set(v for row in flap[1:] for v in row)
    for _ in range(25):
        g.faces.index_update(); g.verts.index_update(); g.faces.ensure_lookup_table(); g.normal_update()
        tree = BVHTree.FromBMesh(g)
        pairs = [(a, b) for a, b in tree.overlap(tree) if a < b and not (set(g.faces[a].verts) & set(g.faces[b].verts))]
        pairs = [(a, b) for a, b in pairs if g.faces[a] in flap_faces or g.faces[b] in flap_faces]
        if not pairs:
            break
        for a, b in pairs:
            fa, fb = g.faces[a], g.faces[b]
            for f, o in ((fa, fb), (fb, fa)):
                away = f.calc_center_median() - o.calc_center_median()
                if away.length > 1e-6:
                    for v in f.verts:
                        if v in movable:
                            v.co += away.normalized() * 0.0015
        push_flap()

    # face directions: the stand and flap face away from the neck and the cloth under them, the rim faces up
    g.normal_update()
    for kind, f in new_faces:
        cen = f.calc_center_median()
        if kind == "rim":
            outward = f.normal.z > 0
        elif kind == "stand":
            outward = f.normal.x * (cen.x - cx) + f.normal.y * (cen.y - cy) > 0
        else:
            loc, nor, fi, dist = nearest(base_bvh, cen)
            outward = loc is None or (cen - loc).dot(f.normal) > 0
        if not outward:
            bmesh.utils.face_flip(f)

    # what was drawn, measured on the result
    lower = flap[rows]
    drops = [top[i].co.z - lower[i].co.z for i in range(n)]
    lim = 0.75 * max(drops)
    front = [abs(phis[i]) < math.radians(100) and drops[i] >= lim for i in range(n)]  # the points are at the front; count the runs of deep flap there
    runs = sum(1 for i in range(n) if front[i] and not front[i - 1])
    report = {"placket": {"vertices_raised": raised, "height_cm": round(top_raise * 100, 2), "half_width_cm": round(c["placket_half_width_cm"] * 100, 2)},
              "collar": {"ring_vertices": n, "stand_cm": round(c["stand_cm"] * 100, 2), "tip_drop_cm": round(max(drops) * 100, 1), "points": runs,
                         "min_clearance_stand_top_to_body_cm": round(min(clear(v.co) for v in top) * 100, 2)}}
    canonical_faces(g)
    g.to_mesh(me)
    g.free()
    for p in me.polygons:
        p.use_smooth = True
    return report
