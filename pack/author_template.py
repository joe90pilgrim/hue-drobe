"""V3-07 Stage A: prepare a garment template once, for pack/fit_template.py. Runs headlessly in Blender 5.3 with MPFB 2.0.18.

  blender --background --python pack/author_template.py -- <template folder>
      source.<obj|glb>  ->  template.obj + template.mhclo, plus authoring.json (what was done, with numbers)
  blender --background --python pack/author_template.py -- <template folder> --roundtrip <out folder>
      for a pack template (already MHCLO): make the pack's own garment into MHCLO again with MakeClothes, fit both files to a test body
      that is not the base mesh, and report how far apart they land. This proves MakeClothes runs headlessly and binds as the pack's own
      file does. Writes only to <out folder> (use pack/out/...), never to the template.

Author mode, for a mesh from outside the packs (pack items skip all of it; fit_template.py uses the pack's .mhclo):
 1. Import and normalise: apply transforms, check the scale is the MPFB base body's (MakeClothes refuses a different object scale),
    make every face the same type (MakeClothes refuses a mix of triangles and quads), recalculate normals, drop textures and UVs
    unless meta colour is "texture".
 2. Align to the MPFB base body by landmarks, picked once and stored in meta.json "authoring": {"landmarks": {<joint group>: [x, y, z]}},
    in the source's own coordinates (metres, Z up), for example joint-neck, joint-l-shoulder, joint-r-shoulder, joint-pelvis,
    joint-l-upper-leg. The body side is the centroid of the base body's joint vertex group, as the spike's garment.joint_positions().
    Fit in order: uniform scale and translation (least squares), then per-axis scale. The residual at each landmark is reported.
    Not built yet (no template from outside the packs exists to test them on; see the V3-07 decision record): the Lattice pass for
    shoulders and hips, and rotating T-pose sleeves down to the base body's A-pose. A source that needs either fails here with that reason.
 3. Convert with MPFB's bundled MakeClothes (ClothesService.create_mhclo_from_clothes_matching, the code behind the MakeClothes panel's
    "Write clothes"): every garment vertex in the base body's "body" group, the base-mesh cross-reference cache made if missing, and with
    meta delete_group true a delete group from MPFB's own generator (ClothesService.create_new_delete_group).
"""
import json, os, sys, time

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fit_template  # noqa: E402

from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.clothesservice import ClothesService  # noqa: E402
from bl_ext.user_default.mpfb.services.locationservice import LocationService  # noqa: E402
from bl_ext.user_default.mpfb.services.targetservice import TargetService  # noqa: E402
from bl_ext.user_default.mpfb.entities.meshcrossref import MeshCrossRef  # noqa: E402

LANDMARK_RESIDUAL_MAX_CM = 2.0  # garment_landmark_cm in spike/tolerances.json: beyond this the Lattice pass would be needed


def base_human(**macros):
    m = TargetService.get_default_macro_info_dict()
    m.update(macros)
    return HumanService.create_human(scale=0.1, macro_detail_dict=m)


def ensure_xref_cache(base):
    """MakeClothes needs a cross-reference cache of the base mesh (the panel's "Create xref cache"); made once per machine."""
    cache = LocationService.get_user_cache("basemesh_xref")
    if not os.path.exists(cache) or not os.listdir(cache):
        os.makedirs(cache, exist_ok=True)
        MeshCrossRef(base, after_modifiers=False, build_faces_by_group_reference=True, cache_dir=cache, write_cache=True, read_cache=False)
    return cache


def one_face_type(ob):
    """Triangulates the mesh if it mixes triangles and quads (or has n-gons). Returns True if it did."""
    sizes = {len(p.vertices) for p in ob.data.polygons}
    if sizes in ({3}, {4}):
        return False
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(ob.data)
    bm.free()
    return True


def make_mhclo(base, clothes, path, meta, delete_group=None, generate_delete_group=False):
    """Writes path (.mhclo) and the .obj beside it with MakeClothes. Returns facts for the report."""
    t0 = time.time()
    ensure_xref_cache(base)
    for g in list(clothes.vertex_groups):
        clothes.vertex_groups.remove(g)
    vg = clothes.vertex_groups.new(name="body")
    vg.add([v.index for v in clothes.data.vertices], 1.0, "REPLACE")
    tri = one_face_type(clothes)
    check = ClothesService.mesh_is_valid_as_clothes(clothes, base)
    if not check["all_checks_ok"]:
        raise RuntimeError(f"MakeClothes refuses the mesh: {check}")
    props = {"name": meta["id"], "license": meta["licence"], "author": meta.get("credit") or "", "description": f"Hue-drobe template {meta['id']}"}
    mhclo = ClothesService.create_mhclo_from_clothes_matching(base, clothes, properties_dict=props, delete_group=delete_group)
    if generate_delete_group:
        ClothesService.create_new_delete_group(base, clothes, mhclo, group_name="Delete")
        g = base.vertex_groups["Delete"]
        mhclo.delverts = sorted(v.index for v in base.data.vertices if any(x.group == g.index and x.weight > 0 for x in v.groups))
        mhclo.delete_group, mhclo.delete = "Delete", True
    mhclo.write_mhclo(path, reference_scale=ClothesService.get_reference_scale(base))
    return {"vertices": len(clothes.data.vertices), "triangulated_for_makeclothes": tri, "delete_vertices": len(mhclo.delverts or []) if getattr(mhclo, "delete", False) else 0,
            "seconds": round(time.time() - t0, 1)}


def attach(mhclo, human):
    ob = HumanService.add_mhclo_asset(mhclo, human, asset_type="Clothes", subdiv_levels=0, material_type="GAMEENGINE", set_up_rigging=False,
                                      interpolate_weights=False, import_subrig=False, import_weights=False)
    bpy.context.view_layer.update()
    return ob


def world_coords(ob):
    return [ob.matrix_world @ v.co for v in ob.data.vertices]


def roundtrip(meta, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    pack_mhclo = fit_template.mhclo_path(meta, os.path.join(HERE, "..", "assets", "packs", "extracted"))
    if not os.path.exists(pack_mhclo):
        raise FileNotFoundError(f"{pack_mhclo}: build once with pack/build_pack.py so the item is unpacked")
    base = base_human()
    before = {g.name for g in base.vertex_groups}
    worn = attach(pack_mhclo, base)
    pack_delete = next((g.name for g in base.vertex_groups if g.name not in before), None)  # the pack's delete group, as MPFB set it up
    clothes = bpy.data.objects.new("roundtrip", worn.data.copy())
    clothes.data.transform(worn.matrix_world)
    bpy.context.scene.collection.objects.link(clothes)
    bpy.data.objects.remove(worn)
    for m in [m for m in base.modifiers if m.type == "MASK" and m.vertex_group == pack_delete]:
        base.modifiers.remove(m)
    path = os.path.join(out_dir, "roundtrip.mhclo")
    R = {"template": meta["id"], "pack_mhclo": os.path.relpath(pack_mhclo, os.path.join(HERE, "..")), "makeclothes": make_mhclo(base, clothes, path, meta, delete_group=pack_delete)}
    bpy.data.objects.remove(clothes)
    for label, macros in (("base body", {}), ("test body (female, weight 0.8, height 0.3)", {"gender": 0.0, "weight": 0.8, "height": 0.3})):
        hb = base_human(**macros)
        a, b = attach(pack_mhclo, hb), attach(path, hb)
        pa, pb = world_coords(a), world_coords(b)
        assert len(pa) == len(pb), "the two fits differ in vertex count"
        d = sorted((p - q).length * 100 for p, q in zip(pa, pb))
        R[label] = {"vertices": len(d), "mean_cm": round(sum(d) / len(d), 3), "p95_cm": round(d[int(len(d) * 0.95)], 3), "max_cm": round(d[-1], 3)}
    json.dump(R, open(os.path.join(out_dir, "roundtrip.json"), "w"), indent=2)
    print("ROUNDTRIP", json.dumps(R), flush=True)


def author(meta, folder):
    src = next((os.path.join(folder, f) for f in ("source.obj", "source.glb") if os.path.exists(os.path.join(folder, f))), None)
    if src is None:
        raise FileNotFoundError(f"{folder}: no source.obj or source.glb")
    lm = (meta.get("authoring") or {}).get("landmarks") or {}
    if len(lm) < 3:
        raise ValueError('meta.json "authoring": {"landmarks": {...}} needs at least three joint groups with the source\'s matching points')
    base = base_human()
    before = set(bpy.data.objects)
    (bpy.ops.wm.obj_import if src.endswith(".obj") else bpy.ops.import_scene.gltf)(filepath=src)
    meshes = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"{src}: {len(meshes)} meshes; a template is one mesh (join the pieces first)")
    ob = meshes[0]
    ob.data.transform(ob.matrix_world)  # 1. apply transforms
    ob.parent, ob.matrix_world = None, Matrix.Identity(4)
    ob.scale = base.scale
    if ob.scale != base.scale:
        raise ValueError("garment and base body scales differ")
    if meta["colour"] != "texture":
        ob.data.materials.clear()
        while ob.data.uv_layers:
            ob.data.uv_layers.remove(ob.data.uv_layers[0])
    # 2. align by landmarks: the base body's joint group centroids (spike/blender/garment.joint_positions)
    sys.path.insert(0, os.path.join(HERE, "..", "spike", "blender"))
    from garment import joint_positions
    body = joint_positions(base, list(lm))
    src_pts = [Vector(lm[k]) for k in lm]
    dst_pts = [body[k] for k in lm]
    cs, cd = sum(src_pts, Vector()) / len(src_pts), sum(dst_pts, Vector()) / len(dst_pts)
    num = sum((d - cd).dot(s - cs) for s, d in zip(src_pts, dst_pts))
    den = sum((s - cs).length_squared for s in src_pts)
    k = num / den if den > 0 else 1.0
    M = Matrix.Translation(cd) @ Matrix.Scale(k, 4) @ Matrix.Translation(-cs)
    moved = [M @ s for s in src_pts]
    axis = []
    for i in range(3):  # per-axis scale about the landmarks' centre, where they spread along that axis
        spread = sum((p[i] - cd[i]) ** 2 for p in moved)
        axis.append(sum((d[i] - cd[i]) * (p[i] - cd[i]) for p, d in zip(moved, dst_pts)) / spread if spread > 1e-6 else 1.0)
    A = Matrix.Translation(cd) @ Matrix.Diagonal((*axis, 1.0)) @ Matrix.Translation(-cd) @ M
    ob.data.transform(A)
    ob.data.update()
    resid = {k_: round(((A @ Vector(lm[k_])) - body[k_]).length * 100, 2) for k_ in lm}
    import bmesh
    bm = bmesh.new()  # 1. recalculate normals (consistent, facing out)
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(ob.data)
    bm.free()
    R = {"template": meta["id"], "source": os.path.basename(src), "uniform_scale": round(k, 4), "axis_scale": [round(a, 4) for a in axis],
         "landmark_residual_cm": resid}
    if max(resid.values()) > LANDMARK_RESIDUAL_MAX_CM:
        R["status"] = f"stopped: a landmark is over {LANDMARK_RESIDUAL_MAX_CM} cm off after scale and translation; the Lattice pass is not built yet"
    else:
        ob.name = "template"
        R["makeclothes"] = make_mhclo(base, ob, os.path.join(folder, "template.mhclo"), meta, generate_delete_group=meta["delete_group"])
        R["status"] = "ok"
    json.dump(R, open(os.path.join(folder, "authoring.json"), "w"), indent=2)
    print("AUTHORED", json.dumps(R), flush=True)


def main():
    a = sys.argv[sys.argv.index("--") + 1:]
    folder = os.path.abspath(a[0])
    m = json.load(open(os.path.join(folder, "meta.json"), encoding="utf8"))
    meta = {**fit_template.validate_meta(m, folder), "dir": folder}
    if "--roundtrip" in a:
        if "pack" not in meta["source"]:
            raise SystemExit("--roundtrip is for pack templates")
        roundtrip(meta, os.path.abspath(a[a.index("--roundtrip") + 1]))
    elif "pack" in meta["source"]:
        print(f"{meta['id']} is a pack item, already MHCLO: nothing to author (fit_template.py uses the pack's own .mhclo)")
    else:
        author(meta, folder)


main()
