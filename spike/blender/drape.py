"""Task 5 (B22): drape the tee with Blender cloth instead of using the offset shell as the final shape.

The offset shell takes its size from the body at every height, so it narrows at the waist and widens at the hips, which
no real tee does. Here the shell is only the starting position. The cloth's rest shape is the shell with each torso ring
below the chest rescaled so its circumference follows the garment's own (chest circumference at the chest, hem
circumference at the hem, straight between), and Blender's cloth solver lets it settle under gravity onto the body and
trousers, which are collision objects. Nothing is pinned: the shoulders hold it.

drape_tee(tee_mesh, body_bm, trousers_mesh, chest_z, hem_z, chest_circ_cm, hem_circ_cm) returns a new mesh with the same
topology as tee_mesh, plus a small dict of what was done.
"""
import math
import bpy, bmesh
from mathutils import Vector

FRAMES = 60          # 2.5 s at 24 fps: enough for the cloth to settle
QUALITY = 8          # solver steps per frame
TENSION = 15         # 5 tried on Joe (94 cm hem over 98 cm jeans): removed 17 self-intersections, hem still +9.1; untested on synthetics
BENDING = 0.5        # 0.2 was tried: shoulder gap unchanged, 2 self-intersections on synthetic_small
COLLISION_DIST = 0.002


def _rings(bm, z0, z1, step=0.01):
    """Centre-line loop of bm at heights z0..z1: {z: (centre_x, centre_y, circumference_m, half_width_m)}."""
    out = {}
    z = z0
    while z <= z1 + 1e-9:
        b = bm.copy()
        res = bmesh.ops.bisect_plane(b, geom=list(b.verts) + list(b.edges) + list(b.faces), plane_co=(0, 0, z), plane_no=(0, 0, 1))
        cut = [g for g in res["geom_cut"] if isinstance(g, bmesh.types.BMEdge)]
        parent = {}

        def find(v):
            while parent.setdefault(v, v) != v:
                parent[v] = parent[parent[v]]
                v = parent[v]
            return v
        for e in cut:
            parent[find(e.verts[0])] = find(e.verts[1])
        comps = {}
        for e in cut:
            comps.setdefault(find(e.verts[0]), []).append(e)
        best = None
        for es in comps.values():
            pts = [v.co.copy() for e in es for v in e.verts]
            cx = sum(p.x for p in pts) / len(pts)
            if abs(cx) < 0.05:
                length = sum(e.calc_length() for e in es)
                if best is None or length > best[2]:
                    best = (cx, sum(p.y for p in pts) / len(pts), length, max(abs(p.x) for p in pts))
        b.free()
        if best:
            out[round(z, 4)] = best
        z += step
    return out


def _lookup(rings, z):
    keys = sorted(rings)
    if not keys:
        return None
    k = min(keys, key=lambda k_: abs(k_ - z))
    return rings[k] if abs(k - z) < 0.011 else None


def _obj(name, mesh):
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def drape_tee(tee_mesh, body_bm, trousers_mesh, chest_z, hem_z, chest_circ_cm, hem_circ_cm):
    scene = bpy.context.scene
    tb = bmesh.new()
    tb.from_mesh(tee_mesh)
    zlo = min(v.co.z for v in tb.verts)
    rings = _rings(tb, zlo + 0.005, chest_z)
    # near the armpit the torso and sleeve loops can merge into one (about 1.7x the chest); such a ring is not the torso,
    # and rescaling it pulls the sleeves inwards, so leave those heights as they are
    merged = [z for z, r in rings.items() if r[2] * 100 > 1.3 * max(chest_circ_cm, hem_circ_cm)]
    for z in merged:
        del rings[z]

    # rest shape: rescale torso rings below the chest about their own centre so circumference follows the garment
    rest = []
    scaled = 0
    for v in tb.verts:
        p = v.co.copy()
        r = _lookup(rings, p.z) if p.z < chest_z else None
        if r is not None and abs(p.x) <= r[3] + 0.01:
            t = 0.0 if hem_z >= chest_z else min(1.0, max(0.0, (chest_z - p.z) / (chest_z - hem_z)))
            target = (chest_circ_cm + (hem_circ_cm - chest_circ_cm) * t) / 100.0
            k = target / r[2]
            p.x = r[0] + (p.x - r[0]) * k
            p.y = r[1] + (p.y - r[1]) * k
            scaled += 1
        rest.append(p)
    tb.free()

    body_mesh = bpy.data.meshes.new("drape_body")
    body_bm.to_mesh(body_mesh)
    body_ob = _obj("drape_body", body_mesh)
    tr_ob = _obj("drape_trousers", trousers_mesh.copy())
    cloth_ob = _obj("drape_tee", tee_mesh.copy())
    for ob, fric in ((body_ob, 8.0), (tr_ob, 5.0)):
        ob.modifiers.new("Collision", "COLLISION")
        ob.collision.thickness_outer = 0.001
        ob.collision.cloth_friction = fric

    # Blender 5.3's cloth ignored rest_shape_key in headless tests (a 20% larger rest key changed nothing), so the
    # garment-sized rest shape is also the starting position: cloth rest lengths come from the mesh at the first frame.
    for i, p in enumerate(rest):
        cloth_ob.data.vertices[i].co = p
    mod = cloth_ob.modifiers.new("Cloth", "CLOTH")
    cs = mod.settings
    cs.quality = QUALITY
    cs.mass = 0.15                 # kg per vertex group default units: light cotton jersey
    cs.tension_stiffness = TENSION
    cs.compression_stiffness = 15
    cs.shear_stiffness = 5
    cs.bending_stiffness = BENDING
    cs.air_damping = 1.0
    cc = mod.collision_settings
    cc.use_collision = True
    cc.distance_min = COLLISION_DIST
    cc.collision_quality = 4
    cc.use_self_collision = False
    pc = mod.point_cache
    pc.frame_start = 1
    pc.frame_end = FRAMES
    scene.frame_start = 1
    scene.frame_end = FRAMES
    cloth_ob.data.update()
    bpy.context.view_layer.update()
    pc.frame_end = FRAMES  # touching the cache settings resets it, so the solver starts from the settings above
    scene.frame_set(0)
    for f in range(1, FRAMES + 1):
        scene.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    out = bpy.data.meshes.new_from_object(cloth_ob.evaluated_get(dg))
    moved = sorted((out.vertices[i].co - tee_mesh.vertices[i].co).length for i in range(len(out.vertices)))
    rest_moved = sorted((rest[i] - tee_mesh.vertices[i].co).length for i in range(len(rest)))
    for p in out.polygons:
        p.use_smooth = True
    scene.frame_set(1)
    for ob in (cloth_ob, body_ob, tr_ob):
        bpy.data.objects.remove(ob)
    return out, {"moved_cm_median_max": [round(moved[len(moved) // 2] * 100, 2), round(moved[-1] * 100, 2)],
                 "rest_offset_cm_median_max": [round(rest_moved[len(rest_moved) // 2] * 100, 2), round(rest_moved[-1] * 100, 2)],
                 "merged_rings_skipped": len(merged), "frames": FRAMES, "quality": QUALITY, "rest_scaled_verts": scaled, "rest_rings": len(rings),
                 "chest_circ_cm": chest_circ_cm, "hem_circ_cm": hem_circ_cm}
