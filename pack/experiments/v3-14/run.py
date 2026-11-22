"""V3-14 experiment: cloth with garment-side pins, collision with the body and inner garments, and hiding the covered inner layer.

Not part of the pack build. Run from the repo root with the real Python (pack/README.md):
  python pack/experiments/v3-14/run.py <body> [--cases shirt_alone,shirt_over_tee,blazer_over_tee] [--round r1] [--no-render]

<body> is a synthetic body (spike/fixtures/<body>.json) or joe / b (private/measurements_<body>.json).
Output: pack/out/v3-14/<round>/<body>/ (private bodies: private/out/v3-14/<round>/<body>/), with <body>_v3-14.json holding the numbers;
renders in pack/out/renders/v3-14/ (private bodies: private/renders/v3-14/) as <body>_<case>_<round>_<view>.png, next to
<body>_<case>_before_<view>.png copied from the V3-08 and V3-09 renders where they exist.

How it works. One Blender session (one thread, so builds repeat) runs pack/fit_template.py's run() unchanged on copies of the templates
(pack/experiments/v3-14/templates/: inner_layers emptied so nothing is pushed off the tee, settle off). The only thing swapped is MPFB's
HumanService.add_mhclo_asset: straight after MPFB attaches a garment, this script runs Blender's cloth on it before fit_template carries on
(keep_islands, the 0.2 cm push off the body, body hiding, export, checks: all fit_template's own code):
 1. pins on the garment itself: chosen once per template on its own .obj (MakeHuman base space), the same vertex indices on every body:
    in each 2 cm column across the shoulders (out to the shoulder tip, where the top line drops steeply), the front and back cloth
    within PIN_BAND of that side's top (collar, neckline, shoulder seams; a deeper band at the back is the shirt's yoke);
 2. Blender cloth from the MHCLO fit as it is (no inflate), gravity on, colliding with the body, the trousers and (over the tee) the tee,
    single-sided colliders so cloth that starts inside the tee is pushed out; separate small pieces (buttons, pockets, cuffs) follow the
    main cloth with a Surface Deform modifier;
 3. after fit_template: the tee faces the outer garment covers (a ray out along the tee's normal, from 3 cm under it, meets the outer
    garment) are removed from what is drawn, as the body is under the dress, and the layer and gap checks run on what is left.
"""
import json, os, sys, time, shutil, subprocess, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
PACK = os.path.join(ROOT, "pack")
BLENDER_DIR = os.path.join(ROOT, "spike", "blender")
TEMPLATES = os.path.join(HERE, "templates")
CASES = {"shirt_alone": ["mid/shirt_alone"], "shirt_over_tee": ["mid/shirt_over_tee"],
         "blazer_over_tee": {"male": ["outer/blazer_m_over_tee"], "female": ["outer/blazer_f_over_tee"]}}
# Cloth per garment kind, shared by every body (no per-body tuning). Shirt: V3-00 / drape.py cotton values with a little more bending;
# blazer: a heavier, stiffer wool with canvas.
CLOTH = {"shirt": {"frames": 60, "quality": 10, "mass": 0.15, "tension": 15, "compression": 15, "shear": 5, "bending": 0.3, "air": 1.0},
         "blazer": {"frames": 60, "quality": 10, "mass": 0.3, "tension": 40, "compression": 40, "shear": 20, "bending": 10.0, "air": 1.0}}
PIN_BAND = {"shirt": {"front": 0.35, "back": 0.8}, "blazer": {"front": 0.35, "back": 0.5}}  # MakeHuman units (1 = 10 cm)
COLLIDE = {"thickness_outer": 0.002, "friction": 1.0, "cloth_distance": 0.004, "self_distance": 0.002}
GROW_FRAMES = 25   # round 2: the inner garment's collider starts on the skin and moves out to its own place over these frames
FOLLOW_FALLOFF = 16.0  # round 2: Surface Deform falloff (higher keeps each small piece bound to the cloth right under it)
SEW_KINDS = ("blazer",)  # round 3: sew the centre front of a closed jacket
SEW_DIST = 0.15  # MakeHuman units (1.5 cm) on the template
MORPH_FRAMES = 20  # V3-15 (--rest template): frames over which the cloth's rest shape goes from the fit to the template as made
BIG_ISLAND = 0.10 # an island with at least this share of the kept vertices is cloth; smaller ones follow it (Surface Deform)
CUFF_BAND = 0.4   # V3-16 (--pin-cuffs): cloth within this of a sleeve opening (MakeHuman units, 4 cm) is pinned, under the cuff piece


# ---------------------------------------------------------------- inside Blender

def blender_main():
    import traceback
    import bpy, bmesh
    from mathutils.bvhtree import BVHTree
    sys.path.insert(0, PACK)
    sys.path.insert(0, BLENDER_DIR)
    import fit_template as ft
    import mesh_checks
    from bl_ext.user_default.mpfb.services.humanservice import HumanService

    args = sys.argv[sys.argv.index("--") + 1:]
    sep = args.index("::")
    job_path, inner_args = args[1], args[sep + 1:]
    out_dir, name = inner_args[1], inner_args[2]
    job = json.load(open(job_path))
    metas = sorted((ft.load_meta(d) for d in job["templates"]), key=lambda m: (ft.LAYERS.index(m["layer"]), m["id"]))
    queue, info = list(metas), {}
    sc = bpy.context.scene
    T0 = time.time()

    def to_bm(path):
        return mesh_checks.load_glb(path)

    def bm_object(nm, bm):
        me = bpy.data.meshes.new(nm)
        bm.to_mesh(me)
        ob = bpy.data.objects.new(nm, me)
        sc.collection.objects.link(ob)
        return ob

    def signed(tree, co):
        loc, nor, _i, d = tree.find_nearest(co)
        if loc is None:
            return None
        return d if (co - loc).dot(nor) > 0 else -d

    def pin_vertices(V0, main, band):
        """Garment-side pins from the template's own base-space vertices (x, y up, z forward): see the module docstring."""
        bins = {}
        for i in main:
            bins.setdefault(round(V0[i][0] / 0.2), []).append(i)
        ytop = {b: max(V0[i][1] for i in g) for b, g in bins.items()}

        def tip(sign):
            b = 6 * sign  # start outside the collar (|x| = 1.2 units)
            while (b + sign) in ytop and ytop[b] - ytop[b + sign] <= 0.3:
                b += sign
            return b
        bl, br = tip(-1), tip(1)
        pins = set()
        for b, g in bins.items():
            if not bl <= b <= br:
                continue
            top = [i for i in g if V0[i][1] > ytop[b] - 1.5]
            zmid = (min(V0[i][2] for i in top) + max(V0[i][2] for i in top)) / 2
            for part, bd in (([i for i in g if V0[i][2] >= zmid], band["front"]), ([i for i in g if V0[i][2] < zmid], band["back"])):
                if part:
                    yt = max(V0[i][1] for i in part)
                    pins.update(i for i in part if V0[i][1] >= yt - bd)
        return pins, round(bl * 0.2, 1), round(br * 0.2, 1)

    def cloth_fit(ob, meta, mhclo):
        """Blender cloth on the attached garment, in place (ob.data), before fit_template goes on. Returns the numbers."""
        cfg = meta["v3_14"]
        kind = cfg["cloth"]
        C = dict(CLOTH[kind])
        C.update({k: job[k] for k in ("frames", "bending") if job.get(k) is not None})  # V3-16 overrides
        t0 = time.time()
        me = ob.data
        M = ob.matrix_world.copy()
        Mi = M.inverted()
        n = len(me.vertices)
        faces = [list(p.vertices) for p in me.polygons]
        isl = ft.islands(n, faces)
        kept = ft.kept_vertices(isl, meta["keep_islands"], meta["keep_islands_vertices"]) if meta.get("keep_islands") is not None else list(range(n))
        keptset = set(kept)
        big = [g for g in isl if g[0] in keptset and len(g) >= BIG_ISLAND * len(kept)]
        cloth_v = sorted(i for g in big for i in g)
        follow_v = sorted(keptset - set(cloth_v))
        obj_file = next(l.split(None, 1)[1].strip() for l in open(mhclo, encoding="utf8", errors="replace") if l.startswith("obj_file"))
        V0, F0 = ft.read_obj(open(os.path.join(os.path.dirname(mhclo), obj_file), encoding="utf8", errors="replace").read())
        assert len(V0) == n, f"obj has {len(V0)} vertices, attached mesh {n}"
        assert [len(g) for g in ft.islands(len(V0), F0)] == [len(g) for g in isl], "obj and attached mesh islands differ"
        band = dict(PIN_BAND[kind])
        if job.get("back_band") is not None:  # V3-16: a narrow line along the back's top (collar and shoulder seam) instead of the yoke
            band["back"] = job["back_band"]
        pins, x_l, x_r = pin_vertices(V0, cloth_v, band)
        shoulder_pins = set(pins)
        cuff_pins = set()
        if job.get("pin_cuffs"):
            # V3-16: the sleeve openings are the two open-edge loops furthest out in x on the template; pin the cloth within CUFF_BAND of
            # them (the sleeve end under the cuff piece) so it keeps its made shape. Chosen on the template, the same indices on every body.
            cset = set(cloth_v)
            ec = {}
            for f in F0:
                if f[0] in cset:
                    for a_, b_ in zip(f, f[1:] + f[:1]):
                        k_ = (min(a_, b_), max(a_, b_))
                        ec[k_] = ec.get(k_, 0) + 1
            adj = {}
            for (a_, b_), c_ in ec.items():
                if c_ == 1:
                    adj.setdefault(a_, set()).add(b_)
                    adj.setdefault(b_, set()).add(a_)
            loops, seen = [], set()
            for s0 in adj:
                if s0 not in seen:
                    st, comp = [s0], []
                    seen.add(s0)
                    while st:
                        x_ = st.pop()
                        comp.append(x_)
                        for y_ in adj[x_] - seen:
                            seen.add(y_)
                            st.append(y_)
                    loops.append(comp)
            loops.sort(key=lambda L: -abs(sum(V0[i][0] for i in L) / len(L)))
            ring = [i for L in loops[:2] for i in L]
            cuff_pins = {i for i in cloth_v if min(sum((V0[i][t] - V0[j][t]) ** 2 for t in range(3)) for j in ring) <= CUFF_BAND ** 2}
            pins |= cuff_pins
        W = {i: M @ me.vertices[i].co for i in kept}
        # round 3: a closed jacket's fronts meet edge to edge with only separate button pieces between them, so under cloth they swing
        # apart. Sew them (Blender's sewing springs on loose edges in the cloth object only; the garment's own mesh is unchanged):
        # pairs of open-edge vertices, one each side of the centre front, within SEW_DIST of each other on the template itself.
        sew = []
        if kind in SEW_KINDS:
            cset = set(cloth_v)
            ec = {}
            for f in F0:
                if f[0] in cset:
                    for a_, b_ in zip(f, f[1:] + f[:1]):
                        k_ = (min(a_, b_), max(a_, b_))
                        ec[k_] = ec.get(k_, 0) + 1
            bnd = {i for k_, c_ in ec.items() if c_ == 1 for i in k_}
            left = [i for i in bnd if -0.6 < V0[i][0] < 0]
            right = [i for i in bnd if 0 <= V0[i][0] < 0.6]
            for i in left:
                j = min(right, key=lambda j_: sum((V0[i][t] - V0[j_][t]) ** 2 for t in range(3)), default=None)
                if j is not None and sum((V0[i][t] - V0[j][t]) ** 2 for t in range(3)) ** 0.5 < SEW_DIST:
                    sew.append((i, j))

        # colliders: the body as exported, the trousers, and the inner garment
        colliders = [("body", os.path.join(out_dir, name + ".glb")), ("trousers", os.path.join(out_dir, f"{name}_trousers.glb"))]
        if cfg["inner"]:
            colliders.append((cfg["inner"], os.path.join(out_dir, f"{name}_{cfg['inner']}.glb")))
        grow = {cfg["inner"]} | ({"trousers"} if job.get("grow_trousers") else set())  # V3-16: the trousers grow out from the skin too
        temp, trees, top_z = [], {}, {}
        for cn, path in colliders:
            bm = to_bm(path)
            top_z[cn] = max(v.co.z for v in bm.verts)
            bmesh.ops.triangulate(bm, faces=bm.faces[:])
            bm.normal_update()
            trees[cn] = BVHTree.FromBMesh(bm)
            co = bm_object(f"v314_col_{cn}", bm)
            bm.free()
            if cn in grow and GROW_FRAMES:
                # the garment starts inside the inner one (the MHCLO fit lies on the skin): animate the inner collider out from the
                # skin (its basis shape: each vertex on the nearest body point) to where it really is, so the cloth is carried out
                # with it instead of being thrown out of it on the first frame. A collider animation; the garment is not touched.
                btree = trees["body"]
                sk0 = co.shape_key_add(name="on_skin")
                for v in co.data.vertices:
                    loc, nor, _i, _d = btree.find_nearest(v.co)
                    sk0.data[v.index].co = loc + nor * 0.001
                sk1 = co.shape_key_add(name="worn", from_mix=False)
                for v in co.data.vertices:
                    sk1.data[v.index].co = v.co
                sk1.value = 0.0
                sk1.keyframe_insert("value", frame=1)
                sk1.value = 1.0
                sk1.keyframe_insert("value", frame=1 + GROW_FRAMES)
            co.modifiers.new("Collision", "COLLISION")
            c = co.collision
            c.thickness_outer = COLLIDE["thickness_outer"]
            c.cloth_friction = COLLIDE["friction"]
            c.use_culling = True   # single sided: cloth on the wrong side is pushed out along the collider's normals
            c.use_normal = True
            temp.append(co)

        def inside_counts():
            out = {}
            for cn, tr in trees.items():
                if cn == "trousers":  # V3-16: above the trousers' open top the nearest point is the rim, whose sign means nothing
                    out["trousers_cloth_above_top"] = sum(W[i].z > top_z["trousers"] for i in cloth_v)
                    ds = [signed(tr, W[i]) if W[i].z <= top_z["trousers"] else None for i in cloth_v]
                    ds = [d for d in ds if d is not None and d > -0.05]
                    ins = [i for i in cloth_v if W[i].z <= top_z["trousers"] and (lambda d: d is not None and -0.05 < d < 0)(signed(tr, W[i]))]
                    out[cn] = {"inside": sum(d < 0 for d in ds), "deepest_cm": round(-min(ds, default=0) * 100, 2),
                               "inside_pinned": sum(i in pins for i in ins), "top_z_cm": round(top_z["trousers"] * 100, 1),
                               "inside_z_cm_min_max": [round(min(W[i].z for i in ins) * 100, 1), round(max(W[i].z for i in ins) * 100, 1)] if ins else None}
                    continue
                ds = [signed(tr, W[i]) for i in cloth_v]
                ds = [d for d in ds if d is not None and d > -0.05]  # within 5 cm: the cloth near this collider
                ins = [i for i in cloth_v if (lambda d: d is not None and -0.05 < d < 0)(signed(tr, W[i]))]
                out[cn] = {"inside": sum(d < 0 for d in ds), "deepest_cm": round(-min(ds, default=0) * 100, 2),
                           "inside_pinned": sum(i in pins for i in ins),
                           "inside_z_cm_min_max": [round(min(W[i].z for i in ins) * 100, 1), round(max(W[i].z for i in ins) * 100, 1)] if ins else None}
            return out
        before = inside_counts()

        ci = {v: k for k, v in enumerate(cloth_v)}
        cm = bpy.data.meshes.new("v314_cloth")
        cm.from_pydata([W[v] for v in cloth_v], [(ci[i], ci[j]) for i, j in sew], [[ci[i] for i in f] for f in faces if f[0] in ci])
        cloth_ob = bpy.data.objects.new("v314_cloth", cm)
        sc.collection.objects.link(cloth_ob)
        temp.append(cloth_ob)
        cloth_ob.vertex_groups.new(name="pin").add([ci[i] for i in pins], 1.0, "REPLACE")
        # V3-15 (--rest template): the cloth starts at the MHCLO fit but its rest lengths and bend angles are the template as made (its own
        # .obj, base space to Blender: (x, -z, y) / 10), scaled once, uniformly, so its pinned shoulder span matches the fit's. Only the
        # rest shape key is set; the garment's starting positions are the fit as before.
        rest_key, rest_info = None, None
        if job.get("rest") == "template":
            from mathutils import Vector
            R = [Vector((V0[v][0], -V0[v][2], V0[v][1])) * 0.1 for v in cloth_v]
            pk = [ci[i] for i in shoulder_pins]  # scale and centre from the shoulder pins only (not the cuffs)
            pin_all = {ci[i] for i in pins}
            span_fit = max(W[cloth_v[k]].x for k in pk) - min(W[cloth_v[k]].x for k in pk)
            span_t = max(R[k].x for k in pk) - min(R[k].x for k in pk)
            s = span_fit / span_t
            # rest_shape_key is ignored headless (rest_key_check.py in pack/experiments/v3-15), so use Blender's dynamic base mesh:
            # the cloth's rest lengths follow its input mesh each frame. The input mesh is keyed from the fit (frame 1) to the scaled
            # template (by frame 1 + MORPH_FRAMES), moved so its pins' centre is the fit's; pinned vertices stay at the fit (their goal).
            pin_k = pin_all
            c_fit = sum((W[cloth_v[k]] for k in pk), Vector()) / len(pk)
            c_t = sum((R[k] * s for k in pk), Vector()) / len(pk)
            T = [W[cloth_v[k]] if k in pin_k else R[k] * s + (c_fit - c_t) for k in range(len(R))]
            cloth_ob.shape_key_add(name="Basis")
            rest_key = cloth_ob.shape_key_add(name="rest", from_mix=False)
            for k, p in enumerate(T):
                rest_key.data[k].co = p
            rest_key.value = 0.0
            rest_key.keyframe_insert("value", frame=1)
            rest_key.value = 1.0
            rest_key.keyframe_insert("value", frame=1 + MORPH_FRAMES)
            R = [p / s for p in T]  # report lengths against the rest shape actually used
            ratios = sorted((W[cloth_v[a]] - W[cloth_v[b]]).length / max((R[a] - R[b]).length * s, 1e-9) for a, b in (e.vertices for e in cm.edges))
            rest_info = {"rest": "template", "scale": round(s, 4), "pin_span_fit_cm": round(span_fit * 100, 1),
                         "fit_over_rest_edge_ratio_p10_median_p90": [round(ratios[int(len(ratios) * q)], 3) for q in (0.1, 0.5, 0.9)]}
        follow_ob, bound = None, None
        if follow_v:
            fi = {v: k for k, v in enumerate(follow_v)}
            fm = bpy.data.meshes.new("v314_follow")
            fm.from_pydata([W[v] for v in follow_v], [], [[fi[i] for i in f] for f in faces if f[0] in fi])
            follow_ob = bpy.data.objects.new("v314_follow", fm)
            sc.collection.objects.link(follow_ob)
            temp.append(follow_ob)

        mod = cloth_ob.modifiers.new("Cloth", "CLOTH")
        cs = mod.settings
        cs.quality, cs.mass = C["quality"], C["mass"]
        cs.tension_stiffness, cs.compression_stiffness = C["tension"], C["compression"]
        cs.shear_stiffness, cs.bending_stiffness = C["shear"], C["bending"]
        cs.air_damping, cs.vertex_group_mass, cs.pin_stiffness = C["air"], "pin", 1.0
        if sew:
            cs.use_sewing_springs = True
        if rest_key is not None:
            cs.use_dynamic_mesh = True
            rest_info["morph_frames"] = MORPH_FRAMES
        cc = mod.collision_settings
        cc.use_collision, cc.distance_min, cc.collision_quality = True, COLLIDE["cloth_distance"], 5
        cc.use_self_collision, cc.self_distance_min = True, COLLIDE["self_distance"]
        was = (sc.frame_start, sc.frame_end, sc.frame_current)
        sc.frame_start, sc.frame_end = 1, C["frames"]
        mod.point_cache.frame_start, mod.point_cache.frame_end = 1, C["frames"]
        bpy.context.view_layer.update()
        sc.frame_set(0)
        if follow_ob is not None:
            sd = follow_ob.modifiers.new("SD", "SURFACE_DEFORM")
            sd.target = cloth_ob
            sd.falloff = FOLLOW_FALLOFF
            bpy.context.view_layer.objects.active = follow_ob
            with bpy.context.temp_override(object=follow_ob, active_object=follow_ob, selected_objects=[follow_ob]):
                bpy.ops.object.surfacedeform_bind(modifier="SD")
            bound = bool(sd.is_bound)
        for f in range(1, C["frames"] + 1):
            sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = cloth_ob.evaluated_get(dg).data
        moved = []
        for v, k in ci.items():
            p = ev.vertices[k].co.copy()
            moved.append((p - W[v]).length)
            W[v] = p
        if follow_ob is not None:
            fe = follow_ob.evaluated_get(dg).data
            for v, k in fi.items():
                W[v] = fe.vertices[k].co.copy()
        if rest_info is not None:
            ra = sorted((ev.vertices[a].co - ev.vertices[b].co).length / max((R[a] - R[b]).length * s, 1e-9) for a, b in (e.vertices for e in cm.edges))
            rest_info["after_over_rest_edge_ratio_p10_median_p90"] = [round(ra[int(len(ra) * q)], 3) for q in (0.1, 0.5, 0.9)]
        for v in kept:
            me.vertices[v].co = Mi @ W[v]
        me.update()
        after = inside_counts()
        for o in temp:
            bpy.data.objects.remove(o)
        sc.frame_start, sc.frame_end = was[:2]
        sc.frame_set(was[2])
        moved.sort()
        return {"cloth": kind, "settings": C, "collide": COLLIDE, "grow_frames": GROW_FRAMES, "follow_falloff": FOLLOW_FALLOFF, "sewn_pairs": len(sew),"pin_band_units": PIN_BAND[kind], "pinned_vertices": len(pins), "cuff_pinned_vertices": len(cuff_pins), "pin_band_used": band, "grown_colliders": sorted(g for g in grow if g),
                "pin_shoulder_x_units": [x_l, x_r], "cloth_vertices": len(cloth_v), "follower_vertices": len(follow_v),
                "followers_bound": bound, "colliders": [c for c, _ in colliders], "rest_shape": rest_info,
                "moved_cm_median_p99_max": [round(moved[len(moved) // 2] * 100, 2), round(moved[int(len(moved) * 0.99)] * 100, 2), round(moved[-1] * 100, 2)],
                "cloth_inside_colliders_before": before, "cloth_inside_colliders_after": after, "cloth_seconds": round(time.time() - t0, 1)}

    orig = HumanService.add_mhclo_asset

    def wrapped(mhclo_file, basemesh, *a, **kw):
        t0 = time.time()
        ob = orig(mhclo_file, basemesh, *a, **kw)
        meta = queue.pop(0)
        assert os.path.normcase(os.path.abspath(ft.mhclo_path(meta, job["packs_dir"]))) == os.path.normcase(os.path.abspath(mhclo_file))
        try:
            info[meta["pack_file"]] = cloth_fit(ob, meta, mhclo_file)
        except Exception:
            info[meta["pack_file"]] = {"cloth_failed": traceback.format_exc()}
            raise
        info[meta["pack_file"]]["attach_and_cloth_seconds"] = round(time.time() - t0, 1)
        return ob

    HumanService.add_mhclo_asset = staticmethod(wrapped)
    t_fit = time.time()
    ft.run()  # fit_template exactly as it is
    fit_seconds = time.time() - t_fit
    HumanService.add_mhclo_asset = staticmethod(orig)

    report = json.load(open(os.path.join(out_dir, name + "_report.json")))
    tol = json.load(open(os.path.join(ROOT, "spike", "tolerances.json")))["pack_item_body_as_drawn"]
    full_body = to_bm(os.path.join(out_dir, name + ".glb"))
    floor = min(v.co.z for v in full_body.verts)

    def joined(a, b):
        out = bmesh.new()
        for x in (a, b):
            me_ = bpy.data.meshes.new("j")
            x.to_mesh(me_)
            out.from_mesh(me_)
            bpy.data.meshes.remove(me_)
        return out

    results = {"body": name, "fit_template_seconds_all": round(fit_seconds, 1), "cases": {}}
    for meta in metas:
        pf, inner = meta["pack_file"], meta["v3_14"]["inner"]
        R = report["pack_items"].get(pf, {})
        res = {"status": R.get("status"), "cloth": info.get(pf), "fit_template": {k: R.get(k) for k in (
            "body_as_drawn", "min_clearance_to_body_after_push_cm", "item_vertices_pushed_out_of_skin", "deepest_push_cm", "top_z_m",
            "bottom_z_m", "pieces", "openings", "info_self_intersecting_pairs", "info_clearance_to_full_body_cm", "body_vertices_hidden",
            "repair_rounds", "triangles")}}
        if R.get("status") == "ok" and inner:
            t1 = time.time()
            outer = to_bm(os.path.join(out_dir, f"{name}_{pf}.glb"))
            tee = to_bm(os.path.join(out_dir, f"{name}_{inner}.glb"))
            res["layers_whole_inner"] = mesh_checks.layers({pf: outer}, {inner: tee})[pf][inner]
            otb = outer.copy()
            bmesh.ops.triangulate(otb, faces=otb.faces[:])
            otree = BVHTree.FromBMesh(otb)
            otb.free()
            tee.normal_update()
            covered = []
            for f in tee.faces:
                c, nrm = f.calc_center_median(), f.normal
                hit = otree.ray_cast(c - nrm * 0.03, nrm, 0.08)
                if hit[0] is not None:
                    covered.append(f)
            res["inner_faces"], res["inner_faces_hidden"] = len(tee.faces), len(covered)
            drawn = tee.copy()
            drawn.faces.ensure_lookup_table()
            cov_idx = {f.index for f in covered}
            bmesh.ops.delete(drawn, geom=[f for f in drawn.faces if f.index in cov_idx], context="FACES")
            bmesh.ops.delete(drawn, geom=[v for v in drawn.verts if not v.link_faces], context="VERTS")
            dob = bm_object(f"{name}_{inner}_under_{pf}", drawn)
            bpy.ops.object.select_all(action="DESELECT")
            dob.select_set(True)
            bpy.context.view_layer.objects.active = dob
            bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, f"{name}_{inner}_under_{pf}.glb"), export_format="GLB", use_selection=True)
            bpy.data.objects.remove(dob)
            if len(drawn.faces):
                res["layers_visible_inner"] = mesh_checks.layers({pf: outer}, {inner: drawn})[pf][inner]
            body_drawn_path = os.path.join(out_dir, f"{name}_body_{pf}.glb") if meta["delete_group"] else os.path.join(out_dir, name + ".glb")
            body_drawn = to_bm(body_drawn_path)
            full = joined(full_body, tee)
            hidden = joined(body_drawn, drawn)
            bad = mesh_checks.body_as_drawn(full, hidden, outer, floor, tol)
            res["body_and_inner_as_drawn"] = {k: bad[k] for k in ("visible_body_intersecting_pairs", "gap_rays", "gap_by_z_cm", "worst_view",
                                                                    "intersecting_pairs_with_hiding_off")}
            res["inner_hiding_seconds"] = round(time.time() - t1, 1)
            for b in (outer, tee, drawn, body_drawn, full, hidden):
                b.free()
        results["cases"][pf] = res
    results["blender_seconds"] = round(time.time() - T0, 1)
    json.dump(results, open(os.path.join(out_dir, f"{name}_v3-14.json"), "w"), indent=2)
    print("V3-14 DONE", name, flush=True)


# ---------------------------------------------------------------- driver (plain Python)

def driver():
    sys.path.insert(0, PACK)
    import build_pack as bp
    import fit
    import fit_template as ft
    a = sys.argv[1:]
    body = a[0]
    opt = lambda f, d=None: a[a.index(f) + 1] if f in a else d
    cases = opt("--cases", "shirt_alone,shirt_over_tee,blazer_over_tee").split(",")
    rnd = opt("--round", "r1")
    private = body in bp.PEOPLE
    meas = os.path.join(ROOT, "private", f"measurements_{body}.json") if private else os.path.join(ROOT, "spike", "fixtures", f"{body}.json")
    sex = json.load(open(meas)).get("sex_base")
    out = os.path.join(ROOT, "private" if private else os.path.join("pack", "out"), "v3-14", rnd, body)
    renders = os.path.join(ROOT, "private", "renders", "v3-14") if private else os.path.join(ROOT, "pack", "out", "renders", "v3-14")
    os.makedirs(out, exist_ok=True)
    os.makedirs(renders, exist_ok=True)
    dirs = []
    for c in cases:
        t = CASES[c]
        dirs += t[sex] if isinstance(t, dict) else t
    metas = [ft.load_meta(os.path.join(TEMPLATES, d)) for d in dirs]
    err = bp.prepare_templates(metas)
    if err:
        sys.exit(err)
    gar = os.path.join(out, f"{body}_garments.json")
    json.dump(fit.default_garments(json.load(open(meas)), bp.person_cfg(body)), open(gar, "w"), indent=2)
    job = os.path.join(out, f"{body}_job.json")
    json.dump({"templates": [m["dir"] for m in metas], "packs_dir": str(bp.PACKS_EXTRACTED), "colour_srgb": bp.person_cfg(body)["colour_srgb"],
               "rest": opt("--rest", "fitted"),
               # V3-16 tuning (all off by default, so earlier rounds repeat): back pin band, cuff pins, frames, bending, trousers grown out
               "back_band": float(opt("--back-band")) if opt("--back-band") else None, "pin_cuffs": "--pin-cuffs" in a,
               "frames": int(opt("--frames")) if opt("--frames") else None,
               "bending": float(opt("--bending")) if opt("--bending") else None, "grow_trousers": "--grow-trousers" in a},
              open(job, "w"), indent=2)
    res_path = os.path.join(out, f"{body}_v3-14.json")
    if os.path.exists(res_path):
        os.remove(res_path)
    cmd = [bp.BLENDER, "--threads", "1", "--background", "--python", os.path.abspath(__file__), "--", str(bp.SCRIPT), job, "::", meas, out, body, gar]
    t0 = time.time()
    with open(os.path.join(out, f"{body}_build.log"), "w") as log:
        subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
    if not os.path.exists(res_path):
        sys.exit(f"{body}: no results; see {os.path.join(out, body + '_build.log')}")
    res = json.load(open(res_path))
    res["wall_seconds"] = round(time.time() - t0, 1)
    if "--no-render" not in a:
        for c, meta in zip([c for c in cases for _ in (CASES[c][sex] if isinstance(CASES[c], dict) else CASES[c])], metas):
            pf, r = meta["pack_file"], res["cases"].get(meta["pack_file"], {})
            if r.get("status") != "ok":
                continue
            stage = os.path.join(out, "stage", pf)
            os.makedirs(stage, exist_ok=True)
            shutil.copyfile(os.path.join(out, f"{body}_body_{pf}.glb" if meta["delete_group"] else f"{body}.glb"), os.path.join(stage, "body.glb"))
            items = [pf, "trousers"]
            shutil.copyfile(os.path.join(out, f"{body}_{pf}.glb"), os.path.join(stage, f"{pf}.glb"))
            shutil.copyfile(os.path.join(out, f"{body}_trousers.glb"), os.path.join(stage, "trousers.glb"))
            inner = meta["v3_14"]["inner"]
            if inner:  # render_closeup draws files named trousers* light grey: the tee as drawn, so it shows against the navy outer
                shutil.copyfile(os.path.join(out, f"{body}_{inner}_under_{pf}.glb"), os.path.join(stage, f"trousers_{inner}_as_drawn.glb"))
                items.append(f"trousers_{inner}_as_drawn")
            top, bottom = r["fit_template"]["top_z_m"], r["fit_template"]["bottom_z_m"]
            prefix = os.path.join(renders, f"{body}_{c}_{rnd}")
            rc = [bp.BLENDER, "--background", "--python", str(bp.RENDER_SCRIPT), "--", stage, prefix, ",".join(items), "", "",
                  f"{(top + bottom) / 2:.3f}", f"{top - bottom + 0.15:.3f}"]
            with open(os.path.join(out, f"{body}_render_{pf}.log"), "w") as log:
                subprocess.run(rc, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
            r["renders"] = prefix + "_{front,q34,back}.png"
            before = {"shirt_alone": ["v3-08/{b}_{v}.png"], "shirt_over_tee": [],
                      "blazer_over_tee": ["v3-09-r3/{b}_tee_blazer_{v}.png", "v3-09-r2/{b}_tee_blazer_{v}.png", "v3-09/{b}_tee_blazer_{v}.png"]}[c]
            for v in ("front", "q34", "back"):
                for pat in before:
                    src = os.path.join(os.path.dirname(renders), pat.format(b=body, v=v))
                    if os.path.exists(src):
                        shutil.copyfile(src, os.path.join(renders, f"{body}_{c}_before_{v}.png"))
                        break
    json.dump(res, open(res_path, "w"), indent=2)
    print(summary(res))


def summary(res):
    rows = [f"{res['body']}: Blender {res.get('blender_seconds')} s, wall {res.get('wall_seconds')} s"]
    for pf, r in res["cases"].items():
        if r.get("status") != "ok":
            rows.append(f"  {pf}: {r.get('status')} {(r.get('cloth') or {}).get('cloth_failed', '')[-300:]}")
            continue
        b, c = r["fit_template"]["body_as_drawn"], r["cloth"]
        s = (f"  {pf}: body as drawn {b['visible_body_intersecting_pairs']} pairs / {b['gap_rays']} gap rays; min clearance "
             f"{r['fit_template']['min_clearance_to_body_after_push_cm']} cm; pushed {r['fit_template']['item_vertices_pushed_out_of_skin']}"
             f" (deepest {r['fit_template']['deepest_push_cm']} cm); hem z {r['fit_template']['bottom_z_m']}; self pairs "
             f"{r['fit_template']['info_self_intersecting_pairs']}; cloth {c['cloth_seconds']} s, moved {c['moved_cm_median_p99_max']}, "
             f"pinned {c['pinned_vertices']}, followers bound {c['followers_bound']}; inside before {c['cloth_inside_colliders_before']} after {c['cloth_inside_colliders_after']}")
        if "layers_whole_inner" in r:
            w, v = r["layers_whole_inner"], r.get("layers_visible_inner", {})
            s += (f"\n    layer vs whole tee {w['intersecting_pairs']} pairs (min {w['inner_inside_clearance_cm']['min']} cm); tee faces hidden "
                  f"{r['inner_faces_hidden']}/{r['inner_faces']}; visible tee {v.get('intersecting_pairs')} pairs (min "
                  f"{(v.get('inner_inside_clearance_cm') or {}).get('min')} cm); body+tee as drawn "
                  f"{r['body_and_inner_as_drawn']['visible_body_intersecting_pairs']} pairs / {r['body_and_inner_as_drawn']['gap_rays']} gap rays")
        rows.append(s)
    return "\n".join(rows)


if __name__ == "__main__":
    try:
        import bpy  # noqa: F401
        IN_BLENDER = True
    except ImportError:
        IN_BLENDER = False
    blender_main() if IN_BLENDER else driver()
