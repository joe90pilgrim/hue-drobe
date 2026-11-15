"""Block 2: build a body from tape measurements with MPFB2, headless, and report the measured error.

Run:
  blender --background --python spike/blender/body_from_measurements.py -- <measurements.json> <out_dir> <name>

Measurements JSON keys (cm): sex_base (male|female), height_cm, waist_cm, hips_cm, chest_cm, "real" (list of keys that are
real tape measurements; the rest are placeholders and are reported as such).
Landmarks are found once per body as fractions of height, then held fixed while solving, so results are repeatable.
"""
import sys, json, math, os
import bpy, bmesh
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.entities.objectproperties import HumanObjectProperties

argv = sys.argv[sys.argv.index("--") + 1:]
meas_path, out_dir, name = argv[0], argv[1], argv[2]
G = json.load(open(argv[3])) if len(argv) > 3 else None  # optional flat garment measurements
M = json.load(open(meas_path))
real = set(M.get("real", []))
TOL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tolerances.json")))

TORSO = {  # measurement key -> (target stem, landmark scan range as fraction of height, 'min'|'max')
    "waist_cm": ("measure-waist-circ", (0.58, 0.68), "min"),
    "hips_cm": ("measure-hips-circ", (0.47, 0.56), "max"),
    "chest_cm": ("measure-bust-circ", (0.68, 0.74), "max"),
}


def eval_bm(h):
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    e = h.evaluated_get(dg)
    me = e.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    e.to_mesh_clear()
    return bm


def height_cm(bm):
    zs = [v.co.z for v in bm.verts]
    return (max(zs) - min(zs)) * 100.0


def circ_cm(bm, z):
    """Perimeter of the cross-section loop nearest the body centre line at height z."""
    b = bm.copy()
    geom = list(b.verts) + list(b.edges) + list(b.faces)
    res = bmesh.ops.bisect_plane(b, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1))
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
        comps.setdefault(find(ed.verts[0]), []).append(ed)
    best = None
    for edges in comps.values():
        vs = {v for ed in edges for v in ed.verts}
        cx = sum(v.co.x for v in vs) / len(vs)
        length = sum(ed.calc_length() for ed in edges)
        key = (abs(cx), -length)
        if abs(cx) < 0.05 and (best is None or length > best[0]):
            best = (length, edges)
    b.free()
    return best[0] * 100.0 if best else float("nan")


def find_landmark(bm, hgt_m, zmin, rng, mode):
    best = None
    steps = 40
    for i in range(steps + 1):
        f = rng[0] + (rng[1] - rng[0]) * i / steps
        z = zmin + f * hgt_m
        c = circ_cm(bm, z)
        if math.isnan(c):
            continue
        if best is None or (mode == "min" and c < best[0]) or (mode == "max" and c > best[0]):
            best = (c, f)
    return best[1]


def set_height_macro(h, v):
    HumanObjectProperties.set_value("height", v, entity_reference=h)
    TargetService.reapply_macro_details(h)


def load_torso_targets(h):
    for stem, _, _ in TORSO.values():
        for sfx in ("-decr", "-incr"):
            path = TargetService.target_full_path(stem + sfx)
            TargetService.load_target(h, path, weight=0.0, name=stem + sfx)


def set_signed(h, stem, v):
    v = max(-1.0, min(1.0, v))
    TargetService.set_target_value(h, stem + "-incr", max(v, 0.0))
    TargetService.set_target_value(h, stem + "-decr", max(-v, 0.0))


def bisect(f, target, lo, hi, tol, iters=14):
    """f is assumed monotonic increasing in its parameter."""
    flo, fhi = f(lo), f(hi)
    if target <= flo:
        return lo
    if target >= fhi:
        return hi
    for _ in range(iters):
        mid = (lo + hi) / 2
        val = f(mid)
        if abs(val - target) < tol:
            return mid
        if val < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


gender = 1.0 if M["sex_base"] == "male" else 0.0
macros = TargetService.get_default_macro_info_dict()
macros["gender"] = gender
h = HumanService.create_human(scale=0.1, macro_detail_dict=macros)
load_torso_targets(h)

# 1. height via macro
set_height_macro(h, 0.5)
hv = bisect(lambda v: (set_height_macro(h, v), height_cm(eval_bm(h)))[1], M["height_cm"], 0.0, 1.0, 0.05, 16)
set_height_macro(h, hv)

# 1b. inside leg (crotch height above the floor): leg-length targets, then re-solve height, because the two interact
if "inside_leg_cm" in M:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import garment as _g0
    for _stem in ("upperlegs-height", "lowerlegs-height"):
        for _sfx in ("-decr", "-incr"):
            TargetService.load_target(h, TargetService.target_full_path(_stem + _sfx), weight=0.0, name=_stem + _sfx)

    def _crotch_h(v):
        set_signed(h, "upperlegs-height", v)
        set_signed(h, "lowerlegs-height", v)
        b = eval_bm(h)
        c = _g0.crotch_height_cm(b, height_cm(b) / 100.0)
        b.free()
        return c
    _leg_v = 0.0
    for _round in range(4):
        _leg_v = bisect(_crotch_h, M["inside_leg_cm"], -1.0, 1.0, 0.25, 9)
        set_signed(h, "upperlegs-height", _leg_v)
        set_signed(h, "lowerlegs-height", _leg_v)
        hv = bisect(lambda v: (set_height_macro(h, v), height_cm(eval_bm(h)))[1], M["height_cm"], 0.0, 1.0, 0.05, 16)
        set_height_macro(h, hv)
        _b = eval_bm(h)
        _err = _g0.crotch_height_cm(_b, height_cm(_b) / 100.0) - M["inside_leg_cm"]
        _b.free()
        print("LEGS round", _round, "leg_v", round(_leg_v, 3), "crotch error cm", round(_err, 2))
        if abs(_err) < 0.4:
            break

# 2. landmarks, then circumferences
bm = eval_bm(h)
hgt_m = height_cm(bm) / 100.0
zmin = min(v.co.z for v in bm.verts)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import garment as _garment
_crotch_frac = _garment.crotch_height_cm(bm, hgt_m) / 100.0 / hgt_m
# the widest point of the hips must be above the crotch, otherwise the perimeter includes the notch between the thighs
marks = {k: find_landmark(bm, hgt_m, zmin, (max(rng[0], _crotch_frac + 0.03) if k == "hips_cm" else rng[0], rng[1]), mode)
         for k, (_, rng, mode) in TORSO.items() if k in M}
bm.free()
# 3. body-weight macro: pick the weight whose mean circumference over the given landmarks matches the mean target,
#    so the fine measure controls only have to correct small residuals (they saturate at about +/-1)
def set_macro(h, key, v):
    HumanObjectProperties.set_value(key, v, entity_reference=h)
    TargetService.reapply_macro_details(h)


def mean_circ(h):
    b = eval_bm(h)
    zmin_ = min(v_.co.z for v_ in b.verts)
    hh = height_cm(b) / 100.0
    vals = [circ_cm(b, zmin_ + marks[k] * hh) for k in marks]
    b.free()
    return sum(vals) / len(vals)


circ_keys = [k for k in TORSO if k in M]
target_mean = sum(M[k] for k in circ_keys) / len(circ_keys)
if circ_keys:
    wv = bisect(lambda v: (set_macro(h, "weight", v), mean_circ(h))[1], target_mean, 0.0, 1.0, 0.2, 14)
    set_macro(h, "weight", wv)
    # weight changes height slightly: re-solve height
    hv = bisect(lambda v: (set_height_macro(h, v), height_cm(eval_bm(h)))[1], M["height_cm"], 0.0, 1.0, 0.05, 16)
    set_height_macro(h, hv)
else:
    wv = 0.5


# 3b. thigh circumference (tape, just below the crotch): leg fat first, then leg width scale if still short
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import garment as _garment
if "thigh_cm" in M:
    _b0 = eval_bm(h)
    _H0 = height_cm(_b0) / 100.0
    _zmin0 = min(v_.co.z for v_ in _b0.verts)
    _z_th = _zmin0 + _garment.crotch_height_cm(_b0, _H0) / 100.0 - 0.04
    _b0.free()
    _thigh_zdrop = _z_th - _zmin0
    for _stem in ("upperleg-fat", "upperleg-scale-horiz", "upperleg-scale-depth"):
        for _side in ("l", "r"):
            for _sfx in ("-decr", "-incr"):
                TargetService.load_target(h, TargetService.target_full_path(_side + "-" + _stem + _sfx), weight=0.0,
                                          name=_side + "-" + _stem + _sfx)

    def _thigh(v, stem):
        for _side in ("l", "r"):
            set_signed(h, _side + "-" + stem, v)
        b = eval_bm(h)
        c = None
        try:
            from_floor = min(v_.co.z for v_ in b.verts)
            c = _leg_circ(b, from_floor + _thigh_zdrop)
        finally:
            b.free()
        return c

    def _leg_circ(b_, z):
        bb = b_.copy()
        res = bmesh.ops.bisect_plane(bb, geom=list(bb.verts) + list(bb.edges) + list(bb.faces), plane_co=(0, 0, z), plane_no=(0, 0, 1))
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
            comps.setdefault(find(ed.verts[0]), []).append(ed)
        best = None
        for edges in comps.values():
            vs = {v for ed in edges for v in ed.verts}
            cx = sum(v.co.x for v in vs) / len(vs)
            length = sum(ed.calc_length() for ed in edges)
            if 0.03 < cx < 0.3 and (best is None or length > best):
                best = length
        bb.free()
        return best * 100.0 if best else float("nan")

    for _stem in ("upperleg-fat", "upperleg-scale-horiz", "upperleg-scale-depth"):
        _cur = _thigh(0.0, _stem)
        if abs(_cur - M["thigh_cm"]) < 0.5:
            break
        _v = bisect(lambda v: _thigh(v, _stem), M["thigh_cm"], -1.0, 1.0, 0.3, 12)
        for _side in ("l", "r"):
            set_signed(h, _side + "-" + _stem, _v)

for _pass in range(3):
    for key, (stem, _, _) in TORSO.items():
        if key not in M:
            continue
        z0 = marks[key]

        def f(v, stem=stem, z0=z0):
            set_signed(h, stem, v)
            b = eval_bm(h)
            c = circ_cm(b, min(v_.co.z for v_ in b.verts) + z0 * (height_cm(b) / 100.0))
            b.free()
            return c
        set_signed(h, stem, bisect(f, M[key], -1.0, 1.0, 0.1, 12))
    if "waist_cm" in M:
        for sfx in ("-decr", "-incr"):
            TargetService.load_target(h, TargetService.target_full_path("stomach-pregnant" + sfx), weight=0.0, name="stomach-pregnant" + sfx)
        zw = marks["waist_cm"]

        def fw(v):
            set_signed(h, "stomach-pregnant", v)
            b = eval_bm(h)
            c = circ_cm(b, min(v_.co.z for v_ in b.verts) + zw * (height_cm(b) / 100.0))
            b.free()
            return c
        if abs(fw(0.0) - M["waist_cm"]) > 0.5:
            set_signed(h, "stomach-pregnant", bisect(fw, M["waist_cm"], -1.0, 1.0, 0.1, 12))
    # fallback: hips measure control saturates at +/-1 for extreme targets, so add hip width scale
    if "hips_cm" in M:
        for sfx in ("-decr", "-incr"):
            TargetService.load_target(h, TargetService.target_full_path("hip-scale-horiz" + sfx), weight=0.0, name="hip-scale-horiz" + sfx)
        zh = marks["hips_cm"]

        def fh(v):
            set_signed(h, "hip-scale-horiz", v)
            b = eval_bm(h)
            c = circ_cm(b, min(v_.co.z for v_ in b.verts) + zh * (height_cm(b) / 100.0))
            b.free()
            return c
        set_signed(h, "hip-scale-horiz", bisect(fh, M["hips_cm"], -1.0, 1.0, 0.1, 12))
    # height may drift slightly after torso edits; leave as measured and report it

bm = eval_bm(h)
hgt = height_cm(bm)
zmin = min(v.co.z for v in bm.verts)
results = [{"measure": "height_cm", "target": M["height_cm"], "achieved": round(hgt, 2),
            "error": round(hgt - M["height_cm"], 2), "tolerance": TOL["length_cm"], "real_measurement": "height_cm" in real}]
if "inside_leg_cm" in M:
    import garment as _g1
    _il = _g1.crotch_height_cm(bm, hgt / 100.0)
    results.append({"measure": "inside_leg_cm", "target": M["inside_leg_cm"], "achieved": round(_il, 2),
                    "error": round(_il - M["inside_leg_cm"], 2), "tolerance": TOL["length_cm"], "real_measurement": "inside_leg_cm" in real})
for key in TORSO:
    if key in M:
        c = circ_cm(bm, zmin + marks[key] * hgt / 100.0)
        results.append({"measure": key, "target": M[key], "achieved": round(c, 2), "error": round(c - M[key], 2),
                        "tolerance": TOL["circumference_cm"], "real_measurement": key in real, "landmark_fraction_of_height": round(marks[key], 3)})
for r in results:
    r["pass"] = abs(r["error"]) <= r["tolerance"]

# garments: templates defined once on a neutral reference body, re-fitted to this body
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import garment
ref = HumanService.create_human(scale=0.1)
tee_faces = garment.define_tee(ref, collar_drop=-0.04)
tr_faces = garment.define_trousers(ref, hem_frac=0.0)  # extend to the sole; the hem plane cuts it where the real jeans end
body_final = garment.body_bm(h)
joints_final = garment.joint_positions(h, garment.JOINTS + ["joint-l-ankle", "joint-r-ankle"])
zmin_f = min(v.co.z for v in body_final.verts)
H_f = max(v.co.z for v in body_final.verts) - zmin_f
crotch_z = zmin_f + garment.crotch_height_cm(body_final, H_f) / 100.0
# highest shoulder point estimate: top of the trapezius line, 6-14 cm either side of the centre line, upper torso
_nz = joints_final["joint-neck"].z
_nw = ((G or {}).get("tee", {}).get("neckline_width_cm", 20.0)) / 200.0
hps_z = max(v.co.z for v in body_final.verts if _nw - 0.012 < abs(v.co.x) < _nw + 0.012 and _nz - 0.12 < v.co.z < _nz + 0.05)


# MPFB bodies face -Y. Check with the feet: toes extend further forward of the ankle than the heel does behind it.
_ank = (joints_final["joint-l-ankle"].y + joints_final["joint-r-ankle"].y) / 2
_feet = [v.co.y for v in body_final.verts if v.co.z < zmin_f + 0.05]
FRONT = -1.0 if (min(_feet) - _ank) < -(max(_feet) - _ank) else 1.0
print("FRONT_SIGN", FRONT)


def circ_loop(bm_, z, side=None):
    """Cross-section perimeter (cm). side=None: loop nearest the centre line; side=1: the loop of the leg at x>0."""
    b = bm_.copy()
    res = bmesh.ops.bisect_plane(b, geom=list(b.verts) + list(b.edges) + list(b.faces), plane_co=(0, 0, z), plane_no=(0, 0, 1))
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
        comps.setdefault(find(ed.verts[0]), []).append(ed)
    best = None
    for edges in comps.values():
        vs = {v for ed in edges for v in ed.verts}
        cx = sum(v.co.x for v in vs) / len(vs)
        length = sum(ed.calc_length() for ed in edges)
        ok = abs(cx) < 0.05 if side is None else (0.03 < cx < 0.3)
        if ok and (best is None or length > best):
            best = length
    b.free()
    return best * 100.0 if best else float("nan")


body_chest_circ = circ_loop(body_final, zmin_f + marks["chest_cm"] * H_f) if "chest_cm" in marks else None
def tee_chest_circ(gt):
    """Chest circumference of the tee. If the section at the chest height runs through the armpit web the torso and sleeve loops
    merge into one (reads about 1.7x too large), so step down a centimetre at a time until the loop is torso-only."""
    z0 = zmin_f + marks["chest_cm"] * H_f
    c = float("nan")
    for k in range(0, 12):
        c = circ_loop(gt, z0 - 0.01 * k)
        if not math.isnan(c) and c < 1.3 * body_chest_circ:
            return c
    return float("nan")  # merged at every height tried: no usable reading


TG = (G or {}).get("tee")
RG = (G or {}).get("trousers")
two_pi = 2 * math.pi

tr_cal = None
tee_cal = None
# --- trousers: ease is calibrated so the garment's measured circumferences hit the real garment's numbers
# (smoothing shrinks the shell, so a nominal ease would give the wrong size)
tr_hem_z = zmin_f + 0.06 * H_f
tr_top_z = zmin_f + (marks.get("waist_cm", 0.625) + 0.012) * H_f
tr_ease = 0.018
tr_gap = 0.006
hip_z = max(zmin_f + marks.get("hips_cm", 0.5) * H_f, crotch_z + 0.05)  # garment hip is read 5 cm above the crotch
if RG:
    tr_gap = 0.003
    tr_hem_z = crotch_z - RG["inseam_cm"] / 100.0
    # B3: the leg opening is measured above the foot. If the body is too big round at the inseam hem for the opening plus
    # the minimum gap, raise the hem to the lowest height where it fits; the leftover inseam is fabric that would stack
    # over the foot, reported separately (the taper over the heel is not modelled).
    tr_hem_inseam_z = tr_hem_z
    _z = tr_hem_z
    while _z < crotch_z - 0.10:
        _g = circ_loop(body_final, _z, side=1)
        if not math.isnan(_g) and _g + two_pi * tr_gap * 100 <= RG["leg_opening_circ_cm"]:
            break
        _z += 0.005
    tr_hem_z = _z
    tr_top_z = crotch_z + RG["rise_cm"] / 100.0
    knots = {"hem": 0.01, "hip": 0.01, "waist": 0.01}


    def ease_fn(z, k=knots):
        if z <= hip_z:
            t = max(0.0, (z - tr_hem_z) / max(0.01, hip_z - tr_hem_z))
            return k["hem"] + (k["hip"] - k["hem"]) * t
        t = min(1.0, (z - hip_z) / max(0.01, tr_top_z - hip_z))
        return k["hip"] + (k["waist"] - k["hip"]) * t


    for it in range(9):
        tr_mesh, tr_vids = garment.build_tee(body_final, tr_faces, joints_final, ease=ease_fn, min_gap=tr_gap, hem_z=tr_hem_z,
                                             sleeve_t=None, top_z=tr_top_z, fork_z=crotch_z + 0.03)
        gt = bmesh.new()
        gt.from_mesh(tr_mesh)
        got = {"hem": circ_loop(gt, tr_hem_z + 0.01, side=1), "hip": circ_loop(gt, hip_z),
               "waist": circ_loop(gt, tr_top_z - 0.015)}
        gt.free()
        want = {"hem": RG["leg_opening_circ_cm"], "hip": RG["hip_circ_cm"], "waist": RG["waist_circ_cm"]}
        print("CAL trousers", it, {k: (round(got[k], 1), want[k]) for k in want})
        tr_cal = {"converged": all(abs(got[k] - want[k]) < 0.5 for k in want),
                  "ease_at_floor": [k for k in knots if knots[k] <= 0.0031],
                  "residual_cm": {k: round(got[k] - want[k], 2) for k in want}}
        if all(abs(got[k] - want[k]) < 0.5 for k in want):
            break
        for k in knots:
            if not math.isnan(got[k]):
                knots[k] = min(0.06, max(0.003, knots[k] + 1.6 * (want[k] - got[k]) / two_pi / 100.0))
    tr_ease = ease_fn
else:
    tr_mesh, tr_vids = garment.build_tee(body_final, tr_faces, joints_final, ease=tr_ease, min_gap=tr_gap, hem_z=tr_hem_z,
                                         sleeve_t=None, top_z=tr_top_z, fork_z=crotch_z + 0.03)

# --- tee (built over the trousers)
tee_hem_z = zmin_f + 0.49 * H_f
tee_extend = None
tee_sleeve_t = 0.55
tee_ease = 0.022
tee_gap = 0.006
neck_w = (TG or {}).get("neckline_width_cm", 20.0) / 100.0
neck = {"z": hps_z, "cx": 0.0, "cy": joints_final["joint-neck"].y, "a": neck_w / 2, "b": 0.085, "front": FRONT,
        "drop_front": (TG or {}).get("neckline_drop_front_cm", 7.5) / 100.0, "drop_back": 0.02}
if TG:
    real_hem = hps_z - TG["length_cm"] / 100.0
    if "worn_hem_height_cm" in TG:  # hem height as worn, read off a photo; overrides the flat length
        real_hem = zmin_f + TG["worn_hem_height_cm"] / 100.0
    tee_hem_z = max(real_hem, crotch_z + 0.05)  # shell stops 5 cm above the crotch, then hangs straight down
    tee_extend = real_hem if real_hem < tee_hem_z - 1e-4 else None
    arm_len = (joints_final["joint-l-elbow"] - joints_final["joint-l-shoulder"]).length
    tee_sleeve_t = min(0.95, TG["sleeve_cm"] / 100.0 / arm_len)
    tee_gap = 0.003
    tee_ease = 0.005
    for it in range(8):
        tee_mesh, vids = garment.build_tee(body_final, tee_faces, joints_final, ease=tee_ease, min_gap=tee_gap, hem_z=tee_hem_z,
                                           sleeve_t=tee_sleeve_t, extra_mesh=tr_mesh, extra_gap=0.004, extend_hem_to=tee_extend, neck=neck, settle_shoulders=True)
        gt = bmesh.new()
        gt.from_mesh(tee_mesh)
        got = tee_chest_circ(gt)
        gt.free()
        got_sleeve = garment.landmarks(body_final, tee_faces, vids, joints_final)["sleeve_end_from_shoulder_cm"]
        print("CAL tee", it, round(got, 1), TG["chest_circ_cm"], "sleeve", got_sleeve, TG["sleeve_cm"], "ease", repr(tee_ease), "sleeve_t", repr(tee_sleeve_t),
              "mesh", len(tee_mesh.vertices), round(sum(v.co.x * 3.1 + v.co.y * 1.7 + v.co.z for v in tee_mesh.vertices), 9))
        tee_cal = {"converged": abs(got - TG["chest_circ_cm"]) < 0.5 and abs(got_sleeve - TG["sleeve_cm"]) < 0.7,
                   "ease_at_floor": ["chest"] if tee_ease <= 0.0031 else [],
                   "residual_cm": {"chest": round(got - TG["chest_circ_cm"], 2), "sleeve": round(got_sleeve - TG["sleeve_cm"], 2)}}
        sleeve_ok = abs(got_sleeve - TG["sleeve_cm"]) < 0.7
        if abs(got - TG["chest_circ_cm"]) < 0.5 and sleeve_ok:
            break
        if not sleeve_ok:
            tee_sleeve_t = min(0.95, max(0.2, tee_sleeve_t + (TG["sleeve_cm"] - got_sleeve) / 100.0 / arm_len))
        if not math.isnan(got):  # no usable reading this round: keep the ease as it is
            tee_ease = min(0.06, max(0.003, tee_ease + (TG["chest_circ_cm"] - got) / two_pi / 100.0))
else:
    tee_mesh, vids = garment.build_tee(body_final, tee_faces, joints_final, ease=tee_ease, min_gap=tee_gap, hem_z=tee_hem_z,
                                       sleeve_t=tee_sleeve_t, extra_mesh=tr_mesh, extra_gap=0.008, neck=neck, settle_shoulders=True)

# --- reports
def _in_neck_hole(p):
    return garment.in_neckline(p, {**neck, "a": neck["a"] + 0.03, "b": neck["b"] + 0.03}, margin=0.03)


tee_report = {"template_faces": len(tee_faces), "ease_cm": round(tee_ease * 100, 2),
              "clipping": garment.clipping_report(body_final, tee_mesh, vids, zrange=((tee_extend if tee_extend else tee_hem_z) + 0.01, 10.0), skip=_in_neck_hole),
              **garment.landmarks(body_final, tee_faces, vids, joints_final)}
gtee = bmesh.new()
gtee.from_mesh(tee_mesh)
gtr = bmesh.new()
gtr.from_mesh(tr_mesh)
gz_min_tee = min(v.co.z for v in gtee.verts)
tee_report["clipping_ray"] = garment.clipping_report_ray(body_final, tee_mesh, vids, zrange=((tee_extend if tee_extend else tee_hem_z) + 0.01, 10.0), skip=_in_neck_hole)
tee_report["calibration"] = tee_cal
tee_report["hem_height_from_hps_cm"] = round((hps_z - gz_min_tee) * 100, 1)
_top = [v for v in gtee.verts if v.is_boundary and v.co.z > joints_final["joint-neck"].z - 0.10 and abs(v.co.x) < 0.2]
_nb = [v.co.z for v in gtee.verts if v.is_boundary and abs(v.co.x) < 0.03 and (v.co.y - neck["cy"]) * FRONT > 0 and v.co.z > neck["z"] - 0.2]
tee_report["front_neck_bottom_to_hem_cm"] = round((min(_nb) - gz_min_tee) * 100, 1) if _nb else None
tee_report["neckline_width_cm"] = round((max(v.co.x for v in _top) - min(v.co.x for v in _top)) * 100, 1) if _top else None
tee_report["chest_circ_cm"] = round(tee_chest_circ(gtee), 1) if "chest_cm" in marks else None
tr_report = {"template_faces": len(tr_faces), "ease_cm": None if callable(tr_ease) else round(tr_ease * 100, 2),
             "clipping": garment.clipping_report(body_final, tr_mesh, tr_vids, zrange=(tr_hem_z + 0.01, tr_top_z - 0.01)),
             "waist_height_cm": round((tr_top_z - zmin_f) * 100, 1), "hem_height_cm": round((tr_hem_z - zmin_f) * 100, 1),
             "crotch_height_cm": round((crotch_z - zmin_f) * 100, 1), "inseam_cm": round((crotch_z - tr_hem_z) * 100, 1),
             "inseam_leftover_cm": round((tr_hem_z - tr_hem_inseam_z) * 100, 1) if RG else None,
             "rise_cm": round((tr_top_z - crotch_z) * 100, 1),
             "hip_circ_cm": round(circ_loop(gtr, hip_z), 1) if "hips_cm" in marks else None,
             "waist_circ_cm": round(circ_loop(gtr, tr_top_z - 0.015), 1),
             "leg_opening_circ_cm": round(circ_loop(gtr, tr_hem_z + 0.005, side=1), 1)}
tr_report["calibration"] = tr_cal
tr_report["clipping_ray"] = garment.clipping_report_ray(body_final, tr_mesh, tr_vids, zrange=(tr_hem_z + 0.01, tr_top_z - 0.01))
_zmin = zmin_f
tr_report["body_self_intersections_crotch"] = garment.self_intersections_band(body_final, crotch_z - 0.10, crotch_z + 0.05)
_hole = [v for v in gtr.verts if v.is_boundary and abs(v.co.x) < 0.06 and crotch_z - 0.08 < v.co.z < crotch_z + 0.1]
tr_report["boundary_verts_near_crotch"] = len(_hole)
prof = []
for zc in (12, 20, 40, 60, 70, 80, 88, 95, 100, 105):
    z_ = zmin_f + zc / 100.0
    sd = 1 if z_ < crotch_z else None
    prof.append([zc, round(circ_loop(body_final, z_, sd), 1), round(circ_loop(gtr, z_, sd), 1)])
tr_report["profile_z_body_garment_circ_cm"] = prof
extra = {}
if "thigh_cm" in M:
    extra["thigh_cm"] = {"target": M["thigh_cm"], "achieved": round(circ_loop(body_final, crotch_z - 0.04, side=1), 1)}
cmp_ = []


def add(g, k, target, got):
    if got is not None and not (isinstance(got, float) and math.isnan(got)):
        cmp_.append({"garment": g, "measure": k, "target": target, "achieved": got, "error": round(got - target, 1),
                     "tolerance": TOL["garment_landmark_cm"], "pass": abs(got - target) <= TOL["garment_landmark_cm"]})


if TG:
    add("tee", "chest_circ_cm", TG["chest_circ_cm"], tee_report["chest_circ_cm"])
    if "worn_hem_height_cm" in TG:
        add("tee", "worn_hem_height_cm (from photo)", TG["worn_hem_height_cm"], round((gz_min_tee - zmin_f) * 100, 1))
    else:
        add("tee", "length_cm (shoulder to hem)", TG["length_cm"], tee_report["hem_height_from_hps_cm"])
    add("tee", "sleeve_cm", TG["sleeve_cm"], tee_report["sleeve_end_from_shoulder_cm"])
    add("tee", "neckline_width_cm", TG["neckline_width_cm"], tee_report["neckline_width_cm"])
    if "collar_bottom_to_hem_cm" in TG:
        add("tee", "collar_bottom_to_hem_cm", TG["collar_bottom_to_hem_cm"], tee_report["front_neck_bottom_to_hem_cm"])
if RG:
    add("trousers", "waist_circ_cm", RG["waist_circ_cm"], tr_report["waist_circ_cm"])
    add("trousers", "hip_circ_cm", RG["hip_circ_cm"], tr_report["hip_circ_cm"])
    add("trousers", "rise_cm", RG["rise_cm"], tr_report["rise_cm"])
    add("trousers", "inseam_cm (visible + stacked over the foot)", RG["inseam_cm"], round(tr_report["inseam_cm"] + tr_report["inseam_leftover_cm"], 1))
    add("trousers", "leg_opening_circ_cm", RG["leg_opening_circ_cm"], tr_report["leg_opening_circ_cm"])
bpy.data.objects.remove(ref)
results_extra = {"tee": tee_report, "trousers": tr_report, "garment_landmarks_vs_real": cmp_, "extra_body_checks": extra, "hps_height_cm_estimate": round((hps_z - zmin_f) * 100, 1)}

os.makedirs(out_dir, exist_ok=True)
report = {"name": name, "sex_base": M["sex_base"], "height_macro": round(hv, 4), "weight_macro": round(wv, 4), "results": results, **results_extra}
json.dump(report, open(os.path.join(out_dir, name + "_report.json"), "w"), indent=2)

def _lin(rgb):
    """sRGB 0-255 to the linear RGBA that glTF/Blender expect."""
    f = lambda c: (c / 255.0) / 12.92 if c / 255.0 <= 0.04045 else (((c / 255.0) + 0.055) / 1.055) ** 2.4
    return (f(rgb[0]), f(rgb[1]), f(rgb[2]), 1)


# export baked body only (no helpers, no shape keys)
e = h.evaluated_get(bpy.context.evaluated_depsgraph_get())
mesh = bpy.data.meshes.new_from_object(e)
ob = bpy.data.objects.new(name, mesh)
bpy.context.scene.collection.objects.link(ob)
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
glb = os.path.join(out_dir, name + ".glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=False)
tee_ob = bpy.data.objects.new(name + "_tee", tee_mesh)
mat = bpy.data.materials.new("tee"); mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = _lin((TG or {}).get("colour_srgb", [217, 51, 64]))
tee_mesh.materials.append(mat)
bpy.context.scene.collection.objects.link(tee_ob)
bpy.ops.object.select_all(action="DESELECT")
tee_ob.select_set(True)
bpy.context.view_layer.objects.active = tee_ob
bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + "_tee.glb"), export_format="GLB", use_selection=True)
tr_ob = bpy.data.objects.new(name + "_trousers", tr_mesh)
mat2 = bpy.data.materials.new("trousers"); mat2.use_nodes = True
mat2.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = _lin((RG or {}).get("colour_srgb", [58, 83, 140]))
tr_mesh.materials.append(mat2)
bpy.context.scene.collection.objects.link(tr_ob)
bpy.ops.object.select_all(action="DESELECT")
tr_ob.select_set(True)
bpy.context.view_layer.objects.active = tr_ob
bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + "_trousers.glb"), export_format="GLB", use_selection=True)
# mesh checks run on the exported GLBs read back in, because glTF export splits quads into its own triangles and the phone
# shows those triangles; checking the in-memory quads gives lower intersection counts
import mesh_checks
report["mesh_checks"] = mesh_checks.run(*(mesh_checks.load_glb(os.path.join(out_dir, name + sfx + ".glb")) for sfx in ("", "_tee", "_trousers")), hps_z)
json.dump(report, open(os.path.join(out_dir, name + "_report.json"), "w"), indent=2)
print("TEE", json.dumps(tee_report))
print("TROUSERS", json.dumps(tr_report))
print("REPORT", json.dumps(results))
print("GLB_BYTES", os.path.getsize(glb))
