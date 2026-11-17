"""Geometry checks on a body and its tee and trousers, shared by the build (body_from_measurements.py) and by
analyse_meshes.py. Pure bmesh and mathutils; nothing here changes the meshes it is given.

run(body, tee, trousers, hps_z, sweatshirt=None, tee_variants=None) returns a JSON-ready dict:
- pieces and openings of each garment (connected face groups, closed boundary-edge loops)
- intersecting face pairs: body with each garment, tee with trousers, each garment with itself (pairs sharing a vertex ignored),
  with a count by height above the floor (5 cm bands) for body and self pairs so they can be located
- cloth-to-body clearance: signed distance from each cloth vertex to the nearest body point (positive = outside)
- shoulder gap: the same clearance for top-facing tee vertices between the neck and the shoulder point, in 2 cm bands
- with a sweatshirt (MVP-07): the same checks for it as for the tee, and sweatshirt with trousers. It is an alternative top, not a
  layer, so it is not checked against the tee.
- with tee_variants (V1.1-04, {'tee_v': bmesh, 'tee_scoop': bmesh}): the same checks as for the tee, and each with trousers.
- with shorts (V1.1-05): the same checks as for the trousers, and every top (tee, sweatshirt, tee variants) with the shorts.
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
        ds.append((d * 100 if (v.co - loc).dot(nor) > 0 else -d * 100, v.co))
    ds.sort(key=lambda t: t[0])
    n = len(ds)
    lo = ds[0][1]
    return {"min": round(ds[0][0], 2), "p05": round(ds[n // 20][0], 2), "median": round(ds[n // 2][0], 2), "max": round(ds[-1][0], 2),
            "min_at_xyz_cm": [round(c * 100, 1) for c in (lo.x, lo.y, lo.z)]}


def shoulder_gap(tee, body_tree, hps_z, x_min=0.04):
    by = collections.defaultdict(list)
    for v in tee.verts:
        if v.co.z > hps_z - 0.07 and x_min < abs(v.co.x) < 0.20 and v.normal.z > 0.6:
            loc, nor, fi, d = body_tree.find_nearest(v.co)
            by[int(round(abs(v.co.x) * 100)) // 2 * 2].append(d * 100 if (v.co - loc).dot(nor) > 0 else -d * 100)
    bands = {str(k): {"mean": round(sum(v) / len(v), 2), "max": round(max(v), 2), "verts": len(v)} for k, v in sorted(by.items())}
    worst = max(bands.values(), key=lambda b: b["mean"]) if bands else None
    return {"bands_by_cm_from_centre": bands, "worst_band_mean_cm": worst["mean"] if worst else None,
            "max_cm": max((b["max"] for b in bands.values()), default=None)}


def body_as_drawn(full, hidden, item, floor, cfg, collect=None):
    """V3-06: the check for a pack item (dress, later shoes) that hides the body under it. The app's own garments keep the strict
    check (run); this one asks what a viewer sees. Bmeshes in one frame: `full` the whole body, `hidden` the body with the item's
    hidden parts removed (what the app draws while the item is worn), `item` the garment. cfg is tolerances.json "pack_item_body_as_drawn".
    - visible_body_intersecting_pairs: face pairs between the drawn body and the item (no skin through the cloth).
    - gap_rays: parallel rays from many directions (cfg azimuth_step_deg, elevations_deg, ray_spacing_cm) over the item's silhouette.
      A ray is a gap when the full body would be hit but, with the hidden parts removed, the first thing drawn is nothing or the
      inside (back face) of the cloth, lying beyond where the body was: the viewer looks through the hole where the body was removed
      and sees the inside of the cloth or the background. Seeing the outside of the cloth, or skin, is never a gap, even if the removed
      skin was a few millimetres nearer than the cloth (the body may bulge slightly outside a close-fitting item).
    collect: an optional list; each gap ray appends (azimuth, elevation, the point on the full body it would have seen), to find holes.
    Nothing here changes the meshes it is given."""
    import math
    import numpy as np
    from mathutils import Vector
    full, hidden, item = merged(full), merged(hidden), merged(item)
    ft, ht, it = BVHTree.FromBMesh(full), BVHTree.FromBMesh(hidden), BVHTree.FromBMesh(item)
    pairs = ht.overlap(it)
    by_z = sorted(collections.Counter(int(round((hidden.faces[a].calc_center_median().z - floor) * 100)) // 5 * 5 for a, _ in pairs).items())
    pts = np.array([(v.co.x, v.co.y, v.co.z) for v in item.verts])
    centre = Vector(pts.mean(axis=0).tolist())
    step, eps, reach = cfg["ray_spacing_cm"] / 100.0, 1e-4, 3.0
    on_body, gaps, gap_z, worst, first_cloth = 0, 0, collections.Counter(), None, collections.Counter()
    for el in cfg["elevations_deg"]:
        for az in range(0, 360, cfg["azimuth_step_deg"]):
            a, e = math.radians(az), math.radians(el)
            d = -Vector((math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e)))  # from the viewer towards the body
            u = d.cross(Vector((0, 0, 1))).normalized()
            v = u.cross(d).normalized()
            pu, pv = pts @ np.array(u), pts @ np.array(v)
            cu, cv = float(np.dot(centre, u)), float(np.dot(centre, v))
            n_view = 0

            def classify(o):
                """None if the full body is not on this ray; else (is_gap, point on the full body, t_b, t_h, t_i)."""
                loc_b, _n, _i, t_b = ft.ray_cast(o, d)
                if loc_b is None:
                    return None
                _, _, _, t_h = ht.ray_cast(o, d)
                _, n_i, _, t_i = it.ray_cast(o, d)
                if t_i is not None and (t_h is None or t_i <= t_h):  # the cloth is the first thing drawn
                    outside = n_i.dot(d) < 0
                    first_cloth[outside] += 1
                    return (not outside and t_i > t_b - eps), loc_b, t_b, t_h, t_i
                return t_h is None, loc_b, t_b, t_h, t_i  # skin, or nothing

            for x in np.arange(pu.min(), pu.max() + step, step):
                for y in np.arange(pv.min(), pv.max() + step, step):
                    o = centre + u * (x - cu) + v * (y - cv) - d * reach
                    c0 = classify(o)
                    if c0 is None:
                        continue
                    on_body += 1
                    if c0[0]:
                        # a ray that slips between two triangles on an edge is not a hole: it counts only if the rays 0.5 mm either side also see through
                        j, seam = 0.0005, False
                        for du, dv in ((j, 0), (-j, 0), (0, j), (0, -j)):
                            cj = classify(o + u * du + v * dv)
                            if cj is not None and not cj[0]:
                                seam = True
                                break
                        if seam:
                            continue
                        gaps += 1
                        n_view += 1
                        if collect is not None:
                            collect.append((az, el, tuple(c0[1]), c0[2], c0[3], c0[4]))
                        gap_z[int(round((c0[1].z - floor) * 100)) // 5 * 5] += 1
            if n_view and (worst is None or n_view > worst["rays"]):
                worst = {"azimuth_deg": az, "elevation_deg": el, "rays": n_view}
    # the same pair count if the body were not hidden: the check must fail then, or it proves nothing
    n_off = len(ft.overlap(it))
    n_full, n_hidden = len(full.faces), len(hidden.faces)
    for b in (full, hidden, item):
        b.free()
    return {"body_faces_full": n_full, "body_faces_as_drawn": n_hidden, "visible_body_intersecting_pairs": len(pairs), "visible_body_intersections_by_z_cm": by_z, "rays_on_body": on_body, "gap_rays": gaps,
            "gap_by_z_cm": sorted(gap_z.items()), "cloth_first_hits_outside_face": first_cloth[True], "cloth_first_hits_inside_face": first_cloth[False], "worst_view": worst, "intersecting_pairs_with_hiding_off": n_off}


def shading_look(path, radius=0.015, edge_margin=0.04, skip=None):
    """V3-03: how the exported garment will be shaded, read from the GLB as the app gets it (its NORMAL and COLOR_0 attributes).
    - kink: for each corner of a face at least edge_margin from an open edge (neckline, collar, hem, sleeve ends) and not in
      skip(point) (a garment's own drawn details), the largest angle between its normal and the normal of any corner within
      radius. Cloth bridges small bumps, so its shading turns slowly; a shell shaded from the body template's own vertex layout
      turns sharply at the navel, the nipples and the ribs (17 to 40 degrees in 1.5 cm on B's first shirt) and reads as a
      skin-tight wrap (Joe, 17 Nov 2026). Reported as the maximum, the 99th percentile and where the maximum is.
    - colour: whether the file has a COLOR_0 attribute, its darkest value and the share of corners darker than 0.8 (the drawn
      shading of a shirt's collar and placket; a file exported without it would show a flat, collarless shirt).
    Imports the file and removes it again; nothing is changed."""
    import math
    from mathutils.kdtree import KDTree
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    pts, nrm, cols, bm = [], [], [], bmesh.new()
    for o in new:
        if o.type != "MESH":
            continue
        me, mw = o.data, o.matrix_world
        rot = mw.to_3x3()
        cn = me.corner_normals
        for li, l in enumerate(me.loops):
            pts.append(mw @ me.vertices[l.vertex_index].co)
            nrm.append((rot @ cn[li].vector).normalized())
        ca = me.color_attributes[0] if len(me.color_attributes) else None  # the first is COLOR_0, the only one the app reads
        if ca is not None:
            for d in ca.data:
                cols.append(sum(d.color[:3]) / 3.0)
        m2 = me.copy()
        m2.transform(mw)
        bm.from_mesh(m2)
        bpy.data.meshes.remove(m2)
    for o in new:
        bpy.data.objects.remove(o)
    g = merged(bm)
    bm.free()
    edge = [v.co.copy() for v in g.verts if v.is_boundary]
    # neighbours are looked for along the cloth (within 3 edges), so a sleeve hanging beside the side seam or the other
    # trouser leg, near in space but another part of the surface, is never compared
    vkd = KDTree(len(g.verts))
    for v in g.verts:
        vkd.insert(v.co, v.index)
    vkd.balance()
    ring = {}

    def ring3(vi):
        if vi not in ring:
            seen, front = {vi}, {vi}
            for _ in range(3):
                front = {e.other_vert(g.verts[k]).index for k in front for e in g.verts[k].link_edges} - seen
                seen |= front
            ring[vi] = seen
        return ring[vi]
    vof = [vkd.find(p)[1] for p in pts]
    ekd = KDTree(max(1, len(edge)))
    for i, co in enumerate(edge):
        ekd.insert(co, i)
    ekd.balance()
    kd = KDTree(len(pts))
    for i, p in enumerate(pts):
        kd.insert(p, i)
    kd.balance()
    worst, cache = [], {}
    for i, p in enumerate(pts):
        if (edge and ekd.find(p)[2] < edge_margin) or (skip is not None and skip(p)):
            continue
        key = (round(p.x, 5), round(p.y, 5), round(p.z, 5), round(nrm[i].x, 3), round(nrm[i].y, 3), round(nrm[i].z, 3))
        if key in cache:
            continue
        m, near = 0.0, ring3(vof[i])
        for co, j, d in kd.find_range(p, radius):
            if vof[j] in near:
                m = max(m, math.degrees(nrm[i].angle(nrm[j], 0.0)))
        cache[key] = m
        worst.append((m, p))
    g.free()
    worst.sort(key=lambda t: -t[0])
    n = len(worst)
    out = {"corners": n, "radius_cm": round(radius * 100, 2)}
    if n:
        out.update({"kink_max_deg": round(worst[0][0], 1), "kink_p99_deg": round(worst[n // 100][0], 1),
                    "kinks_over_15deg": sum(1 for m, _ in worst if m > 15.0),
                    "kink_max_at_xyz_cm": [round(c * 100, 1) for c in worst[0][1]],
                    "worst_at_xyz_cm_deg": [[round(c * 100, 1) for c in p] + [round(m, 1)] for m, p in worst[:6]]})
    out["colour"] = {"present": bool(cols), "min": round(min(cols), 3) if cols else None,
                     "share_below_0_8": round(sum(1 for c in cols if c < 0.8) / len(cols), 3) if cols else None}
    return out


def tights_faces_z(bm, i):
    return bm.faces[i].calc_center_median().z


def run(body, tee, trousers, hps_z, sweatshirt=None, tee_variants=None, shorts=None, tights=None, shirt_shoulder_x_min=0.04):
    body, tee, trousers = merged(body), merged(tee), merged(trousers)
    bt, tt, rt = BVHTree.FromBMesh(body), BVHTree.FromBMesh(tee), BVHTree.FromBMesh(trousers)
    garments = [("tee", tee, tt), ("trousers", trousers, rt)]
    if sweatshirt is not None:
        sweatshirt = merged(sweatshirt)
        st = BVHTree.FromBMesh(sweatshirt)
        garments.append(("sweatshirt", sweatshirt, st))
    variants = {}  # V1.1-04: other tee necklines, each held to the tee's limits and checked against the trousers like the tee
    for label, vm in (tee_variants or {}).items():
        vm = merged(vm)
        variants[label] = (vm, BVHTree.FromBMesh(vm))
        garments.append((label, vm, variants[label][1]))
    if shorts is not None:  # V1.1-05: an alternative bottom, held to the trousers' limits
        shorts = merged(shorts)
        sht = BVHTree.FromBMesh(shorts)
        garments.append(("shorts", shorts, sht))
    tit = None
    if tights is not None:  # V2-04: a skin-close layer, held to the trousers' limits; worn under the shorts, never under the trousers
        tights = merged(tights)
        tit = BVHTree.FromBMesh(tights)
        garments.append(("tights", tights, tit))
    floor = min(v.co.z for v in body.verts)  # heights below are reported above the floor
    R = {}
    for label, g, tree in garments:
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
    if shorts is not None:
        for label, _g, tree in garments:
            if label not in ("trousers", "shorts"):
                R[f"{label}_vs_shorts_intersecting_pairs"] = len(tree.overlap(sht))
                if label == "tights":  # where, as the shorts-tights margin is only 0.5 mm: height above the floor and distance from the centre line
                    R["tights_vs_shorts_at_z_x_cm"] = sorted({(round((tights_faces_z(tights, a) - floor) * 100), round(abs(tights.faces[a].calc_center_median().x) * 100)) for a, _ in tree.overlap(sht)})
        shorts.free()
    if tights is not None:  # every other layer that can be worn over the tights must clear them
        for label, _g, tree in garments:
            if label not in ("trousers", "tights", "shorts"):  # shorts are covered above, as tights_vs_shorts
                R[f"{label}_vs_tights_intersecting_pairs"] = len(tree.overlap(tit))
        tights.free()
    if sweatshirt is not None:
        R["sweatshirt_vs_trousers_intersecting_pairs"] = len(st.overlap(rt))
        R["sweatshirt"]["shoulder_gap"] = shoulder_gap(sweatshirt, bt, hps_z)
        sweatshirt.free()
    for label, (vm, vt) in variants.items():
        R[f"{label}_vs_trousers_intersecting_pairs"] = len(vt.overlap(rt))
        # V3-03: a shirt's collar stands on the neck and its folded flap lies over the base of it, so the shoulder is judged outside the collar
        R[label]["shoulder_gap"] = shoulder_gap(vm, bt, hps_z, shirt_shoulder_x_min if label.startswith("shirt_") else 0.04)
        vm.free()
    for b in (body, tee, trousers):
        b.free()
    return R
