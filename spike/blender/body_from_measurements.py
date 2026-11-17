"""Block 2: build a body from tape measurements with MPFB2, headless, and report the measured error.

Run:
  blender --background --python spike/blender/body_from_measurements.py -- <measurements.json> <out_dir> <name>

Measurements JSON keys (cm): sex_base (male|female), height_cm, waist_cm, hips_cm, chest_cm, "real" (list of keys that are
real tape measurements; the rest are placeholders and are reported as such).
Optional "cup" (A, B, ...): the cup letter, mapped to the cupsize macro by spike/cup_sizes.json (V2-09).
Landmarks are found once per body as fractions of height, then held fixed while solving, so results are repeatable.
"""
import sys, json, math, os
import bpy, bmesh
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.entities.objectproperties import HumanObjectProperties

argv = sys.argv[sys.argv.index("--") + 1:]
DRAPE = "--drape" in argv  # task 5: settle the tee with Blender cloth (drape.py) instead of keeping the offset shell
argv = [a for a in argv if not a.startswith("--")]
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
# Optional "shape" block in the measurements file (V2-02): proportions that tape measurements do not pin down. These are chosen by eye,
# not measured, and are listed in the report. Macro keys (muscle, proportions, cupsize, firmness; 0..1, default 0.5) are set when the
# body is created. Any other key is a signed MPFB target pair (-1..1), e.g. torso-scale-depth. The tape-driven solver below
# still sets the weight macro, measure-*-circ, stomach-pregnant and hip-scale-horiz itself, so those four are not allowed here.
SHAPE = {k: v for k, v in M.get("shape", {}).items() if not k.startswith("_")}
for _k in tuple(s for s, _, _ in TORSO.values()) + ("stomach-pregnant", "hip-scale-horiz"):
    assert _k not in SHAPE, f"shape.{_k} is set by the tape-measurement solver"
WEIGHT_FIXED = SHAPE.pop("weight", None)  # a fixed weight macro replaces the solved one (the solver otherwise picks it from the mean tape circumference)
for _k in ("muscle", "proportions", "cupsize", "firmness"):
    if _k in SHAPE:
        macros[_k] = SHAPE.pop(_k)
if "cup" in M:  # V2-09: an optional cup letter (A, B, ...) sets the cupsize macro from spike/cup_sizes.json; not allowed together with shape.cupsize
    assert "cupsize" not in M.get("shape", {}), "give the cup as \"cup\" or as shape.cupsize, not both"
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "pack"))
    import cup as _cup_table
    macros["cupsize"] = _cup_table.cup_macro(M["cup"])
h = HumanService.create_human(scale=0.1, macro_detail_dict=macros)
load_torso_targets(h)
for _stem, _v in SHAPE.items():
    for _sfx in ("-decr", "-incr"):
        TargetService.load_target(h, TargetService.target_full_path(_stem + _sfx), weight=0.0, name=_stem + _sfx)
    set_signed(h, _stem, _v)

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
# V2-09: the landmarks are found on the body at MPFB's default cup (0.5), then the real cup size is set. The chest landmark is the
# widest point of the torso; on a small cup that point moves up to the armpit (112.8 cm instead of 110.5 cm on B), which would move the
# bust landmark, the tee's calibration line and the garments' bust hang off the bust. The landmark is where the tape goes, so it must not
# follow the cup. At the default cup this changes nothing.
_cup = macros.get("cupsize", 0.5)
if _cup != 0.5:
    HumanObjectProperties.set_value("cupsize", 0.5, entity_reference=h)
    TargetService.reapply_macro_details(h)
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
if _cup != 0.5:
    HumanObjectProperties.set_value("cupsize", _cup, entity_reference=h)
    TargetService.reapply_macro_details(h)
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
if WEIGHT_FIXED is not None:
    wv = WEIGHT_FIXED
    set_macro(h, "weight", wv)
    hv = bisect(lambda v: (set_height_macro(h, v), height_cm(eval_bm(h)))[1], M["height_cm"], 0.0, 1.0, 0.05, 16)
    set_height_macro(h, hv)
elif circ_keys:
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


def _tv(stem):
    """Signed value (-1..1) of a decr/incr target pair, or None if it was never loaded."""
    try:
        return round(TargetService.get_target_value(h, stem + "-incr") - TargetService.get_target_value(h, stem + "-decr"), 3)
    except Exception:
        return None


# The fine controls saturate at +/-1; a value near it means the tape numbers are being met by an extreme target (found for B, V2-02)
print("SOLVER", json.dumps({"weight_macro": round(wv, 4), "height_macro": round(hv, 4),
                            **{s: _tv(s) for s in ("measure-waist-circ", "measure-bust-circ", "measure-hips-circ", "stomach-pregnant", "hip-scale-horiz",
                                                  "torso-scale-depth", "torso-scale-horiz", "torso-scale-vert", "torso-trans-backward", "pelvis-tone",
                                                  "stomach-tone")}}))

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
    # a draped tee's armpit can hang below the body's chest line, and right at the armpit fold the section can be a
    # partial loop, so also require the reading 1 cm lower to agree within 2% (a stable torso loop, as pit to pit is read)
    for k in range(0, 15):
        c = circ_loop(gt, z0 - 0.01 * k)
        if math.isnan(c) or c >= 1.3 * body_chest_circ:
            continue
        c2 = circ_loop(gt, z0 - 0.01 * (k + 1))
        if not math.isnan(c2) and abs(c2 - c) <= 0.02 * c:
            return c
    return float("nan")  # merged or unstable at every height tried: no usable reading


TG = (G or {}).get("tee")
RG = (G or {}).get("trousers")


def bust_option(cfg):
    """V2-08: garment.build_tee's bust option from the garments file's "bust" block, on a female body only (None otherwise, so a
    male body's garments are untouched). Each apex is the most forward body vertex on its side: within 4 cm of the bust landmark
    height and 5 to 16 cm off the centre line (nearer the centre the belly can be further forward than the bust, as on B)."""
    if not cfg or M["sex_base"] != "female" or "chest_cm" not in marks:
        return None
    bz = zmin_f + marks["chest_cm"] * H_f
    band = [v.co for v in body_final.verts if abs(v.co.z - bz) < 0.04 and 0.05 < abs(v.co.x) < 0.16]
    apexes = [max((c for c in band if c.x * s > 0), key=lambda c: c.y * FRONT).copy() for s in (1, -1)]
    print("BUST apexes cm", [[round(c.x * 100, 1), round(c.y * 100, 1), round((c.z - zmin_f) * 100, 1)] for c in apexes])
    return {"apexes": apexes, "front": FRONT, "reach": cfg["hang_reach_cm"] / 100.0, "slack": cfg["hang_slack_cm_per_cm"],
            "halfwidth": cfg["hang_halfwidth_cm"] / 100.0, "side_taper": cfg["hang_side_taper_cm_per_cm"], "pad": cfg["pad_cm"] / 100.0, "pad_radius": cfg["pad_radius_cm"] / 100.0,
            "trousers_gap": cfg["tee_trousers_gap_cm"] / 100.0}  # V2-09: the hung tee is rebuilt over the trousers at this gap


BUST = bust_option((G or {}).get("bust"))
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

# --- V2-04: tights. The trouser template as a skin-close shell: 2.2 mm off the body (the checks need 2 mm), from the waist
# line down to a hem a set height above the floor (the ankle; the feet are covered once shoes arrive). Nothing is calibrated:
# the gap is the size, so the report compares the hip and ankle with the body itself (tights are skin-tight; the 2 cm landmark tolerance covers the gap).
# Few smoothing passes: the trousers smooth 25 times so they drape, which on a skin-close shell pulls the ankle out towards the wider foot.
# garments.json: tights = {"gap_cm", "hem_above_floor_cm", "waist_below_trousers_cm", "smooth_iterations"}
TT = (G or {}).get("tights") if RG else None
tg_mesh = tg_vids = tg_cal = None
if TT:
    tg_hem_z = zmin_f + TT["hem_above_floor_cm"] / 100.0
    tg_gap = TT["gap_cm"] / 100.0
    tg_top_z = tr_top_z - TT["waist_below_trousers_cm"] / 100.0  # the edge stays inside the shorts' waistband, not level with it
    tg_mesh, tg_vids = garment.build_tee(body_final, tr_faces, joints_final, ease=tg_gap, min_gap=tg_gap, hem_z=tg_hem_z,
                                         sleeve_t=None, top_z=tg_top_z, fork_z=crotch_z + 0.03, smooth_iters=TT["smooth_iterations"], final_push=True,
                                         fork_gap=0.0025)  # the shorts keep 1.5 mm off the centre plane; the tights, the inner layer, 2.5 mm: each thigh tube is nearer its own leg
    _gt = bmesh.new()
    _gt.from_mesh(tg_mesh)
    tg_got = {"hip": circ_loop(_gt, hip_z), "ankle": circ_loop(_gt, tg_hem_z + 0.005, side=1)}
    _gt.free()
    tg_want = {"hip": circ_loop(body_final, hip_z),  # the hip section bridges the dips at the buttocks, so it is read against the body itself
               "ankle": circ_loop(body_final, tg_hem_z + 0.005, side=1) + two_pi * TT["gap_cm"]}  # the ankle is near round: body plus the gap all round
    print("CAL tights", {k: (round(tg_got[k], 1), round(tg_want[k], 1)) for k in tg_got})
    tg_cal = {"converged": all(abs(tg_got[k] - tg_want[k]) < 1.0 for k in tg_got), "ease_at_floor": [],  # nothing is calibrated: 1 cm is half the landmark tolerance
              "residual_cm": {k: round(tg_got[k] - tg_want[k], 2) for k in tg_got}}

# --- V1.1-05: shorts. The trouser template with the trousers' calibrated ease, cut at a shorter inseam. Only the bottom
# flare band is let out, so the leg opening is wider than the trousers at the same height; above the band the shorts are
# the trousers' shell, so every top keeps the clearance it was built with over the trousers.
# garments.json: shorts = {"inseam_cm", "leg_opening_extra_cm", "flare_band_cm"}
HG = (G or {}).get("shorts") if RG else None
sh_mesh = sh_vids = sh_cal = None
if HG:
    sh_hem_z = crotch_z - HG["inseam_cm"] / 100.0
    _sh_band = HG["flare_band_cm"] / 100.0
    _gt = bmesh.new()
    _gt.from_mesh(tr_mesh)
    sh_trousers_opening = circ_loop(_gt, sh_hem_z + 0.01, side=1)  # the trousers round the leg at the shorts' hem
    _gt.free()
    sh_want = sh_trousers_opening + HG["leg_opening_extra_cm"]
    _flare = HG["leg_opening_extra_cm"] / two_pi / 100.0

    def sh_ease(z):
        return tr_ease(z) + _flare * max(0.0, 1.0 - (z - sh_hem_z) / _sh_band)

    for it in range(6):
        sh_mesh, sh_vids = garment.build_tee(body_final, tr_faces, joints_final, ease=sh_ease, min_gap=tr_gap, hem_z=sh_hem_z,
                                             sleeve_t=None, top_z=tr_top_z, fork_z=crotch_z + 0.03,
                                             extra_mesh=tg_mesh, extra_gap=0.0005, extra_trigger=-0.0006, extra_push=0.0012)  # V2-04: worn over tights; moves out only where they would touch
        _gt = bmesh.new()
        _gt.from_mesh(sh_mesh)
        _got = circ_loop(_gt, sh_hem_z + 0.01, side=1)
        _gt.free()
        print("CAL shorts", it, round(_got, 1), round(sh_want, 1), "flare cm", round(_flare * 100, 2))
        sh_cal = {"converged": abs(_got - sh_want) < 0.5, "ease_at_floor": [],
                  "residual_cm": {"leg_opening": round(_got - sh_want, 2)}, "flare_cm": round(_flare * 100, 2)}
        if sh_cal["converged"] or math.isnan(_got):
            break
        _flare = min(0.05, max(0.0, _flare + 1.6 * (sh_want - _got) / two_pi / 100.0))

# --- V2-04: the shorts sit only 3 mm off the body and the tights 2.5 mm, so the two are drawn into place together: the shorts were
# built over the tights (moving out only where they would touch), and now any part of the tights that bulges into the shorts (the
# fold at the crotch, where the body is hollow) is drawn back towards the skin, never nearer than the gap.
tg_tuck_left = None
if TT and HG:
    tg_mesh, tg_tuck_left = garment.tuck_inside(tg_mesh, sh_mesh, body_final, tg_gap)
    print("TIGHTS tuck, triangles still crossing the shorts:", tg_tuck_left)

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
    tee_size_chest = got
    if BUST is not None:
        # V2-08: the hang under the bust is drape, not size: the calibrated ease is the garment's, so the ease is settled above
        # without it (the hung cloth reads bigger at the bust line, and calibrating on that reading shrank the tee everywhere
        # else, through the trousers' waistband). The garment is then built once more, at that ease, with the hang.
        tee_mesh, vids = garment.build_tee(body_final, tee_faces, joints_final, ease=tee_ease, min_gap=tee_gap, hem_z=tee_hem_z,
                                           sleeve_t=tee_sleeve_t, extra_mesh=tr_mesh, extra_gap=BUST["trousers_gap"], extend_hem_to=tee_extend, neck=neck, settle_shoulders=True,
                                           bust=BUST)
else:
    tee_size_chest = None
    tee_mesh, vids = garment.build_tee(body_final, tee_faces, joints_final, ease=tee_ease, min_gap=tee_gap, hem_z=tee_hem_z,
                                       sleeve_t=tee_sleeve_t, extra_mesh=tr_mesh, extra_gap=0.008, neck=neck, settle_shoulders=True, bust=BUST)

# --- sweatshirt (MVP-07): an alternative top, built over the trousers like the tee. Regular fit: more ease than the tee,
# long sleeves, and the hem and cuffs drawn in as ribbing would. Its hem and cuffs are set by the body (hem above the crotch,
# cuff short of the wrist), so it sits the same way on every body. Same offset-shell method, no cloth simulation.
SG = (G or {}).get("sweatshirt")
sw_mesh = sw_vids = sw_cal = None
if SG:
    sw_faces = garment.define_tee(ref, collar_drop=-0.04, long_sleeves=True)
    sw_hem_z = crotch_z + SG["hem_above_crotch_cm"] / 100.0
    sw_neck = {**neck, "a": SG["neckline_width_cm"] / 200.0, "drop_front": SG["neckline_drop_front_cm"] / 100.0}
    fo_len = (joints_final["joint-l-hand"] - joints_final["joint-l-elbow"]).length
    sw_sleeve_t = 1.0 - SG["cuff_above_wrist_cm"] / 100.0 / fo_len
    sw_ease = 0.01
    for it in range(8):
        sw_mesh, sw_vids = garment.build_tee(body_final, sw_faces, joints_final, ease=sw_ease, min_gap=tee_gap, hem_z=sw_hem_z,
                                             sleeve_t=sw_sleeve_t, extra_mesh=tr_mesh, extra_gap=0.004, neck=sw_neck,
                                             settle_shoulders=True, long_sleeves=True, forearm_ease_frac=SG["forearm_ease_fraction"],
                                             hem_band=(SG["rib_band_cm"] / 100.0, SG["hem_rib_gap_cm"] / 100.0),
                                             cuff_band=(SG["rib_band_cm"] / 100.0, SG["cuff_rib_gap_cm"] / 100.0))
        gt = bmesh.new()
        gt.from_mesh(sw_mesh)
        got = tee_chest_circ(gt)
        gt.free()
        got_cuff = garment.cuff_above_wrist_cm(body_final, sw_vids, joints_final)
        print("CAL sweatshirt", it, round(got, 1), SG["chest_circ_cm"], "cuff above wrist", got_cuff, SG["cuff_above_wrist_cm"],
              "ease", repr(sw_ease), "sleeve_t", repr(sw_sleeve_t))
        chest_ok = abs(got - SG["chest_circ_cm"]) < 0.5
        cuff_ok = abs(got_cuff - SG["cuff_above_wrist_cm"]) < 0.7
        sw_cal = {"converged": chest_ok and cuff_ok, "ease_at_floor": ["chest"] if sw_ease <= 0.0031 else [],
                  "residual_cm": {"chest": round(got - SG["chest_circ_cm"], 2), "cuff": round(got_cuff - SG["cuff_above_wrist_cm"], 2)}}
        if chest_ok and cuff_ok:
            break
        if not cuff_ok:
            sw_sleeve_t = min(1.0, max(0.3, sw_sleeve_t + (got_cuff - SG["cuff_above_wrist_cm"]) / 100.0 / fo_len))
        if not math.isnan(got):
            sw_ease = min(0.08, max(0.003, sw_ease + (SG["chest_circ_cm"] - got) / two_pi / 100.0))
    sw_size_chest = got
    if BUST is not None:  # V2-08: as for the tee, the hang is applied after the size is settled
        sw_mesh, sw_vids = garment.build_tee(body_final, sw_faces, joints_final, ease=sw_ease, min_gap=tee_gap, hem_z=sw_hem_z,
                                             sleeve_t=sw_sleeve_t, extra_mesh=tr_mesh, extra_gap=0.004, neck=sw_neck,
                                             settle_shoulders=True, long_sleeves=True, forearm_ease_frac=SG["forearm_ease_fraction"],
                                             hem_band=(SG["rib_band_cm"] / 100.0, SG["hem_rib_gap_cm"] / 100.0),
                                             cuff_band=(SG["rib_band_cm"] / 100.0, SG["cuff_rib_gap_cm"] / 100.0), bust=BUST)

# --- V1.1-04: other tee necklines. The same offset shell as the crew-neck tee (same ease, sleeve and hem, taken from the
# calibration above), cut with a different neck shape. Each gets its own calibration record and its own mesh checks.
# garments.json: tee.necklines = {"v": {"drop_front_cm", "neckline_width_cm"}, "scoop": {...}}
var_necks, var_meshes, var_vids, var_cal = {}, {}, {}, {}


def _measured_front_drop_cm(gm):
    """How far the neckline's lowest front point sits below the highest-point-shoulder height, in cm (None if not found)."""
    nb = [v.co.z for v in gm.verts if v.is_boundary and abs(v.co.x) < 0.03 and (v.co.y - neck["cy"]) * FRONT > 0 and v.co.z > neck["z"] - 0.25]
    return round((hps_z - min(nb)) * 100, 1) if nb else None


for _style, _VG in ((TG or {}).get("necklines") or {}).items():
    # The cut edge is smoothed after cutting, which rounds a V's tip and lifts it, so the depth set in the cut is not the depth
    # that comes out. Calibrate the cut depth until the measured front depth is the one asked for (same idea as the chest and sleeve).
    _want = _VG["drop_front_cm"]
    _drop = _want / 100.0
    _best = None  # the measured depth moves in steps (whole mesh faces), so keep the closest of the tries, not the last
    for _it in range(6):
        _vn = {**neck, "style": _style, "a": _VG["neckline_width_cm"] / 200.0, "drop_front": _drop,
               "reach": max(0.0, _drop - neck["drop_front"])}
        _vm, _vv = garment.build_tee(
            body_final, tee_faces, joints_final, ease=tee_ease, min_gap=tee_gap, hem_z=tee_hem_z, sleeve_t=tee_sleeve_t,
            extra_mesh=tr_mesh, extra_gap=BUST["trousers_gap"] if BUST is not None else 0.004, extend_hem_to=tee_extend, neck=_vn, settle_shoulders=True, bust=BUST)
        _g = bmesh.new()
        _g.from_mesh(_vm)
        _got = _measured_front_drop_cm(_g)
        _g.free()
        print("CAL tee", _style, _it, "front drop", _got, _want, "cut depth cm", round(_drop * 100, 2))
        if _got is not None and (_best is None or abs(_got - _want) < abs(_best[0] - _want)):
            _best = (_got, _vn, _vm, _vv)
        if _got is None or abs(_got - _want) < 0.4:
            break
        _drop = min(0.25, max(0.03, _drop + (_want - _got) / 100.0))
    _got, _vn, _vm, _vv = _best
    var_necks[_style], var_meshes[_style], var_vids[_style] = _vn, _vm, _vv
    var_cal[_style] = {"drop_residual_cm": round(_got - _want, 2), "cut_depth_cm": round(_vn["drop_front"] * 100, 2)}

# --- V3-03: shirts. The tee's offset shell in three sleeve lengths (short, mid to the elbow, long to the wrist), untucked, with a point
# collar and a raised button placket drawn as shape (garment.add_shirt_details). The chest and the sleeve are calibrated for each, like
# the tee's; on a woman the hang under the bust is applied last, as for every top (V2-08). Plain colour, no cloth simulation.
SHG = (G or {}).get("shirt") if TG else None
shirt_meshes, shirt_vids, shirt_cal, shirt_info, shirt_ease, shirt_chest, shirt_t = {}, {}, {}, {}, {}, {}, {}
LAYER_GAP = ((G or {}).get("layers") or {}).get("gap_cm", 0.4) / 100.0  # V3-05: how far a top worn over the tee is kept off it
SHIRT_KINDS = ("short", "mid", "long")
if SHG:
    shirt_faces = {"short": tee_faces, "mid": tee_faces, "long": garment.define_tee(ref, collar_drop=-0.04, long_sleeves=True)}
    shirt_hem_z = max(hps_z - SHG["length_cm"] / 100.0, crotch_z + 0.05)  # the shell stops 5 cm above the crotch, then the tail hangs straight down (as the tee's)
    shirt_extend = (hps_z - SHG["length_cm"] / 100.0) if (hps_z - SHG["length_cm"] / 100.0) < shirt_hem_z - 1e-4 else None
    shirt_neck = {**neck, "a": SHG["neckline_width_cm"] / 200.0, "drop_front": SHG["neckline_drop_front_cm"] / 100.0}
    _arm = (joints_final["joint-l-elbow"] - joints_final["joint-l-shoulder"]).length
    _fo = (joints_final["joint-l-hand"] - joints_final["joint-l-elbow"]).length
    _cuff = (SHG["cuff_band_cm"] / 100.0, SHG["cuff_gap_cm"] / 100.0)

    def _shirt_build(kind, ease, sleeve_t, bust=None, inner=None):
        long_ = kind == "long"
        m_, v_ = garment.build_tee(body_final, shirt_faces[kind], joints_final, ease=ease, min_gap=tee_gap, hem_z=shirt_hem_z, sleeve_t=sleeve_t,
                                   extra_mesh=tr_mesh, extra_gap=BUST["trousers_gap"] if bust is not None else 0.004, extend_hem_to=shirt_extend,
                                   neck=shirt_neck, settle_shoulders=True, long_sleeves=long_,
                                   forearm_ease_frac=SHG["forearm_ease_fraction"] if long_ else 1.0, cuff_band=_cuff if long_ else None, bust=bust,
                                   inner_mesh=inner, inner_gap=LAYER_GAP)  # V3-05: inner is the tee a shirt is worn over
        # the chest is calibrated on the shell before the collar and placket go on: the placket's raised edges add about 0.8 cm
        # round the chest, which is a fold of cloth, not size, and counting it took ease out of the shirt until the trousers'
        # waistband showed through on the synthetic man (second pass, 17 Nov 2026)
        gs_ = bmesh.new()
        gs_.from_mesh(m_)
        chest_ = tee_chest_circ(gs_)
        gs_.free()
        return m_, v_, garment.add_shirt_details(m_, body_final, joints_final, shirt_neck, SHG["detail"]), chest_

    _ease0 = tee_ease
    # the mid sleeve ends just above the elbow: a body with a short upper arm gets a shorter mid sleeve (the cut cannot go past 95% of the arm)
    shirt_sleeve_cm = {"short": SHG["sleeve_short_cm"], "mid": round(min(SHG["sleeve_mid_cm"], 0.93 * _arm * 100.0), 1)}
    for kind in SHIRT_KINDS:
        want_sleeve = SHG["cuff_above_wrist_cm"] if kind == "long" else shirt_sleeve_cm[kind]
        t_ = (1.0 - want_sleeve / 100.0 / _fo) if kind == "long" else min(0.95, want_sleeve / 100.0 / _arm)
        ease = _ease0
        for it in range(8):
            sm, sv, si, got = _shirt_build(kind, ease, t_)
            got_s = garment.cuff_above_wrist_cm(body_final, sv, joints_final) if kind == "long" else garment.landmarks(body_final, shirt_faces[kind], sv, joints_final)["sleeve_end_from_shoulder_cm"]
            print("CAL shirt", kind, it, round(got, 1), SHG["chest_circ_cm"], "sleeve" if kind != "long" else "cuff above wrist", got_s, want_sleeve, "ease", repr(ease), "sleeve_t", repr(t_))
            chest_ok, sleeve_ok = abs(got - SHG["chest_circ_cm"]) < 0.5, abs(got_s - want_sleeve) < 0.7
            shirt_cal[kind] = {"converged": chest_ok and sleeve_ok, "ease_at_floor": ["chest"] if ease <= 0.0031 else [],
                               "residual_cm": {"chest": round(got - SHG["chest_circ_cm"], 2), ("cuff" if kind == "long" else "sleeve"): round(got_s - want_sleeve, 2)}}
            if chest_ok and sleeve_ok:
                break
            if not sleeve_ok:
                step = (got_s - want_sleeve) / 100.0 / _fo if kind == "long" else (want_sleeve - got_s) / 100.0 / _arm
                t_ = min(1.0 if kind == "long" else 0.95, max(0.2, t_ + step))
            if not math.isnan(got):
                ease = min(0.06, max(0.003, ease + (SHG["chest_circ_cm"] - got) / two_pi / 100.0))
        shirt_chest[kind], shirt_ease[kind], shirt_t[kind] = got, ease, t_
        if BUST is not None:  # V2-08: the hang is drape, not size, so it is applied after the size is settled
            sm, sv, si, _ = _shirt_build(kind, ease, t_, bust=BUST)
        shirt_meshes[kind], shirt_vids[kind], shirt_info[kind] = sm, sv, si
        _ease0 = ease

# --- V3-05: layers. The sweatshirt and the three shirts rebuilt over the tee (the base layer), at the ease and sleeve length each was
# calibrated to on its own, with the tee as a second inner garment (garment.build_tee inner_mesh): the outer top is kept layers.gap_cm off the
# tee everywhere, so it is looser than alone where the tee pushes it out, and nowhere passes through it. Built once, over the crew tee: the V and
# scoop tees are the same shell cut deeper, so what clears the crew tee clears them (mesh_checks.layers checks all three). A shirt is not
# worn under the sweatshirt (Joe, 17 Nov 2026), so there are four layered tops, not five.
over_meshes, over_vids, over_info, over_faces, over_ease = {}, {}, {}, {}, {}
LAYER_INNER = [tee_mesh] + list(var_meshes.values())  # the tee in each neckline: the V and scoop are cut deeper but settle onto the neck a little differently
if (G or {}).get("layers") and TG:
    if SG:
        over_faces["sweatshirt_over_tee"] = sw_faces
        over_ease["sweatshirt_over_tee"] = sw_ease
        over_meshes["sweatshirt_over_tee"], over_vids["sweatshirt_over_tee"] = garment.build_tee(
            body_final, sw_faces, joints_final, ease=sw_ease, min_gap=tee_gap, hem_z=sw_hem_z, sleeve_t=sw_sleeve_t, extra_mesh=tr_mesh, extra_gap=0.004,
            neck=sw_neck, settle_shoulders=True, long_sleeves=True, forearm_ease_frac=SG["forearm_ease_fraction"],
            hem_band=(SG["rib_band_cm"] / 100.0, SG["hem_rib_gap_cm"] / 100.0), cuff_band=(SG["rib_band_cm"] / 100.0, SG["cuff_rib_gap_cm"] / 100.0),
            bust=BUST, inner_mesh=LAYER_INNER, inner_gap=LAYER_GAP)
    for kind in shirt_meshes:
        _om, _ov, _oi, _ = _shirt_build(kind, shirt_ease[kind], shirt_t[kind], bust=BUST, inner=LAYER_INNER)
        over_faces[f"shirt_{kind}_over_tee"], over_ease[f"shirt_{kind}_over_tee"] = shirt_faces[kind], shirt_ease[kind]
        over_meshes[f"shirt_{kind}_over_tee"], over_vids[f"shirt_{kind}_over_tee"], over_info[f"shirt_{kind}_over_tee"] = _om, _ov, _oi
    for _lbl in over_meshes:
        _g3 = bmesh.new()
        _g3.from_mesh(over_meshes[_lbl])
        print("LAYER", _lbl, "chest as worn over the tee", round(tee_chest_circ(_g3), 1))
        _g3.free()

# --- task 5: cloth drape (optional)
drape_info = None
if DRAPE and TG:
    import drape
    _chest_z = zmin_f + marks.get("chest_cm", 0.72) * H_f
    _hem_z = tee_extend if tee_extend else tee_hem_z
    tee_mesh, drape_info = drape.drape_tee(tee_mesh, body_final, tr_mesh, _chest_z, _hem_z,
                                           TG["chest_circ_cm"], TG.get("hem_circ_cm", TG["chest_circ_cm"]))
    print("DRAPE", drape_info)

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
if BUST is not None and tee_size_chest is not None:
    # V2-08: the size is what was calibrated (the shell without the hang); the hung cloth reads bigger at the bust line
    tee_report["chest_circ_as_worn_cm"] = tee_report["chest_circ_cm"]
    tee_report["chest_circ_cm"] = round(tee_size_chest, 1)
tee_report["drape"] = drape_info
if TG:
    # task 5 exit check: tee circumference (path length round the section, folds included) against the garment's own,
    # straight from chest to hem, at the waist and 2 cm above the hem
    _cz = zmin_f + marks.get("chest_cm", 0.72) * H_f
    _hz = gz_min_tee
    _hc = TG.get("hem_circ_cm")
    def _garment_circ(z):
        if _hc is None:
            return None
        t = min(1.0, max(0.0, (_cz - z) / max(0.01, _cz - _hz)))
        return TG["chest_circ_cm"] + (_hc - TG["chest_circ_cm"]) * t
    def _under_hull_cm(z):
        """Perimeter of the 2D convex hull of the body and trousers sections at height z: what the tee has to go round,
        bridging the gap between the legs and over hollows."""
        pts = []
        for _b in (body_final, gtr):
            _c = _b.copy()
            _r = bmesh.ops.bisect_plane(_c, geom=list(_c.verts) + list(_c.edges) + list(_c.faces), plane_co=(0, 0, z), plane_no=(0, 0, 1))
            _cut = [e for e in _r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
            _par = {}

            def _f(v):
                while _par.setdefault(v, v) != v:
                    _par[v] = _par[_par[v]]
                    v = _par[v]
                return v
            for e in _cut:
                _par[_f(e.verts[0])] = _f(e.verts[1])
            _groups = {}
            for e in _cut:
                for v in e.verts:
                    _groups.setdefault(_f(v), set()).add(v)
            for _g in _groups.values():
                # torso or legs only: arms and hands hang at waist height in the A-pose, well away from the centre line
                if abs(sum(v.co.x for v in _g) / len(_g)) < 0.15:
                    pts += [(v.co.x, v.co.y) for v in _g]
            _c.free()
        pts = sorted(set(pts))
        if len(pts) < 3:
            return float("nan")
        cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
        lower, upper = [], []
        for q in pts:
            while len(lower) >= 2 and cross(lower[-2], lower[-1], q) <= 0:
                lower.pop()
            lower.append(q)
        for q in reversed(pts):
            while len(upper) >= 2 and cross(upper[-2], upper[-1], q) <= 0:
                upper.pop()
            upper.append(q)
        hull = lower[:-1] + upper[:-1]
        return sum(math.dist(hull[i], hull[(i + 1) % len(hull)]) for i in range(len(hull))) * 100.0

    # Joe's decision (docs/decisions/2026-11-15-hem-stretched-size.md): expect the larger of the garment's own size and
    # its stretched size, the girth of what it sits on plus the cloth's 3 mm clearance all round
    tee_report["circ_vs_garment_cm"] = {}
    for _lbl, _z in (("waist", zmin_f + marks.get("waist_cm", 0.62) * H_f), ("hem", _hz + 0.02)):
        _got = circ_loop(gtee, _z)
        _want = _garment_circ(_z)
        _under = _under_hull_cm(_z)
        _stretched = None if math.isnan(_under) else _under + two_pi * 0.3
        _expect = None if _want is None else (max(_want, _stretched) if _stretched is not None else _want)
        tee_report["circ_vs_garment_cm"][_lbl] = {"height_cm": round((_z - zmin_f) * 100, 1), "tee": round(_got, 1),
                                                  "garment": None if _want is None else round(_want, 1),
                                                  "stretched": None if _stretched is None else round(_stretched, 1),
                                                  "expected": None if _expect is None else round(_expect, 1),
                                                  "error": None if (_expect is None or math.isnan(_got)) else round(_got - _expect, 1)}
sw_report = None
if SG:
    gsw = bmesh.new()
    gsw.from_mesh(sw_mesh)
    _segs, _rad = garment._arm_segs(joints_final)
    _sw_body_z = [v.co.z for v in gsw.verts if garment._classify(v.co, _segs, _rad) not in garment.ARM]
    _swtop = [v for v in gsw.verts if v.is_boundary and v.co.z > joints_final["joint-neck"].z - 0.10 and abs(v.co.x) < 0.2]
    sw_report = {"template_faces": len(sw_faces), "ease_cm": round(sw_ease * 100, 2), "calibration": sw_cal,
                 "chest_circ_cm": round(sw_size_chest if BUST is not None else tee_chest_circ(gsw), 1),
                 **({"chest_circ_as_worn_cm": round(tee_chest_circ(gsw), 1)} if BUST is not None else {}),
                 "hem_height_cm": round((min(_sw_body_z) - zmin_f) * 100, 1),
                 "hem_above_crotch_cm": round((min(_sw_body_z) - crotch_z) * 100, 1),
                 "hem_from_hps_cm": round((hps_z - min(_sw_body_z)) * 100, 1),
                 "cuff_above_wrist_cm": garment.cuff_above_wrist_cm(body_final, sw_vids, joints_final),
                 "neckline_width_cm": round((max(v.co.x for v in _swtop) - min(v.co.x for v in _swtop)) * 100, 1) if _swtop else None,
                 "clipping_ray": garment.clipping_report_ray(body_final, sw_mesh, sw_vids, zrange=(sw_hem_z + 0.01, 10.0), skip=_in_neck_hole)}
    # circumference just above the hem band, at the hem and round the forearm above the cuff: shows the ribbing drawing in
    sw_report["circ_cm"] = {"above_band": round(circ_loop(gsw, sw_hem_z + SG["rib_band_cm"] / 100.0 + 0.04), 1),
                            "hem": round(circ_loop(gsw, sw_hem_z + 0.01), 1)}
    gsw.free()
tee_report["neckline_drop_front_cm"] = _measured_front_drop_cm(gtee)  # information for the crew neck: how deep the 6 cm really is
var_reports = {}
for _style, _vm in var_meshes.items():
    _vn, _VG = var_necks[_style], TG["necklines"][_style]
    _vids = var_vids[_style]
    _gv = bmesh.new()
    _gv.from_mesh(_vm)
    _top = [v for v in _gv.verts if v.is_boundary and v.co.z > joints_final["joint-neck"].z - 0.10 and abs(v.co.x) < 0.2]
    _got_chest = tee_chest_circ(_gv)
    _got_sleeve = garment.landmarks(body_final, tee_faces, _vids, joints_final)["sleeve_end_from_shoulder_cm"]
    _skip = lambda p, _vn=_vn: garment.in_neckline(p, {**_vn, "a": _vn["a"] + 0.03, "b": _vn["b"] + 0.03}, margin=0.03)
    _zr = ((tee_extend if tee_extend else tee_hem_z) + 0.01, 10.0)
    var_reports[_style] = {
        "template_faces": len(tee_faces), "ease_cm": round(tee_ease * 100, 2),
        "clipping": garment.clipping_report(body_final, _vm, _vids, zrange=_zr, skip=_skip),
        "clipping_ray": garment.clipping_report_ray(body_final, _vm, _vids, zrange=_zr, skip=_skip),
        **garment.landmarks(body_final, tee_faces, _vids, joints_final),
        # chest and sleeve: the shell is the crew tee's, so the variant must match what the crew tee reached (within 0.3 cm),
        # as well as the crew tee itself having converged; the depth is the variant's own calibration
        "calibration": {"converged": tee_cal["converged"]
                        and abs(_got_chest - tee_report.get("chest_circ_as_worn_cm", tee_report["chest_circ_cm"])) < 0.3
                        and abs(_got_sleeve - tee_report["sleeve_end_from_shoulder_cm"]) < 0.3
                        and abs(var_cal[_style]["drop_residual_cm"]) < 0.6,
                        "ease_at_floor": ["chest"] if tee_ease <= 0.0031 else [],
                        "residual_cm": {"chest": round(_got_chest - TG["chest_circ_cm"], 2), "sleeve": round(_got_sleeve - TG["sleeve_cm"], 2),
                                        "front_drop": var_cal[_style]["drop_residual_cm"]},
                        "cut_depth_cm": var_cal[_style]["cut_depth_cm"]},
        "neckline_style": _style, "chest_circ_cm": tee_report["chest_circ_cm"] if BUST is not None else round(_got_chest, 1),
        **({"chest_circ_as_worn_cm": round(_got_chest, 1)} if BUST is not None else {}),
        "neckline_width_cm": round((max(v.co.x for v in _top) - min(v.co.x for v in _top)) * 100, 1) if _top else None,
        "neckline_drop_front_cm": _measured_front_drop_cm(_gv),
    }
    _gv.free()
shirt_reports = {}
for _kind, _sm in shirt_meshes.items():  # V3-03
    _sv = shirt_vids[_kind]
    _gs2 = bmesh.new()
    _gs2.from_mesh(_sm)
    _segs2, _rad2 = garment._arm_segs(joints_final)
    _body_z = [v.co.z for v in _gs2.verts if garment._classify(v.co, _segs2, _rad2) not in garment.ARM]  # the long sleeves hang below the tail in the A-pose
    _worn = tee_chest_circ(_gs2)
    _skip = lambda p: garment.in_neckline(p, {**shirt_neck, "a": shirt_neck["a"] + 0.03, "b": shirt_neck["b"] + 0.03}, margin=0.03)
    _zr = ((shirt_extend if shirt_extend else shirt_hem_z) + 0.01, 10.0)
    shirt_reports[_kind] = {
        "sleeve": _kind, "template_faces": len(shirt_faces[_kind]), "ease_cm": round(shirt_ease[_kind] * 100, 2),
        "clipping": garment.clipping_report(body_final, _sm, _sv, zrange=_zr, skip=_skip),
        "clipping_ray": garment.clipping_report_ray(body_final, _sm, _sv, zrange=_zr, skip=_skip),
        "hem_height_cm": round((min(_body_z) - zmin_f) * 100, 1), "hem_from_hps_cm": round((hps_z - min(_body_z)) * 100, 1),
        **({"cuff_above_wrist_cm": garment.cuff_above_wrist_cm(body_final, _sv, joints_final)} if _kind == "long"
           else {"sleeve_end_from_shoulder_cm": garment.landmarks(body_final, shirt_faces[_kind], _sv, joints_final)["sleeve_end_from_shoulder_cm"]}),
        "calibration": shirt_cal[_kind],
        "chest_circ_cm": round(shirt_chest[_kind] if BUST is not None else _worn, 1),
        **({"chest_circ_as_worn_cm": round(_worn, 1)} if BUST is not None else {}),
        "details": shirt_info[_kind],
    }
    _gs2.free()
over_reports = {}
for _lbl, _om in over_meshes.items():  # V3-05: one record per layered top (the hard mesh limits are in mesh_checks, run on the exported file)
    _g4 = bmesh.new()
    _g4.from_mesh(_om)
    _alone_worn = {"sweatshirt_over_tee": sw_report["chest_circ_as_worn_cm"] if (SG and BUST is not None) else (sw_report["chest_circ_cm"] if SG else None),
                   **{f"shirt_{k}_over_tee": shirt_reports[k].get("chest_circ_as_worn_cm", shirt_reports[k]["chest_circ_cm"]) for k in shirt_reports}}[_lbl]
    _worn4 = tee_chest_circ(_g4)
    over_reports[_lbl] = {"over": "tee", "ease_cm": round(over_ease[_lbl] * 100, 2), "layer_gap_cm": round(LAYER_GAP * 100, 2),
                          "chest_circ_as_worn_cm": round(_worn4, 1), "chest_circ_alone_as_worn_cm": _alone_worn,
                          "chest_extra_from_tee_cm": None if _alone_worn is None else round(_worn4 - _alone_worn, 1),
                          **({"details": over_info[_lbl]} if _lbl in over_info else {})}
    _g4.free()
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
sh_report = None
if HG:
    _gs = bmesh.new()
    _gs.from_mesh(sh_mesh)
    _zr = (sh_hem_z + 0.01, tr_top_z - 0.01)
    sh_report = {"template_faces": len(tr_faces), "calibration": sh_cal,
                 "clipping": garment.clipping_report(body_final, sh_mesh, sh_vids, zrange=_zr),
                 "clipping_ray": garment.clipping_report_ray(body_final, sh_mesh, sh_vids, zrange=_zr),
                 "hem_height_cm": round((sh_hem_z - zmin_f) * 100, 1), "inseam_cm": round((crotch_z - sh_hem_z) * 100, 1),
                 "leg_opening_circ_cm": round(circ_loop(_gs, sh_hem_z + 0.005, side=1), 1),
                 "trousers_at_same_height_circ_cm": round(sh_trousers_opening, 1),
                 "leg_opening_target_circ_cm": round(sh_want, 1),
                 "thigh_at_hem_circ_cm": round(circ_loop(body_final, sh_hem_z + 0.005, side=1), 1),
                 "hip_circ_cm": round(circ_loop(_gs, hip_z), 1), "waist_circ_cm": round(circ_loop(_gs, tr_top_z - 0.015), 1)}
    _gs.free()
tg_report = None
if TT:
    _gg = bmesh.new()
    _gg.from_mesh(tg_mesh)
    _zr = (tg_hem_z + 0.01, tg_top_z - 0.01)
    tg_report = {"template_faces": len(tr_faces), "calibration": tg_cal,
                 "clipping": garment.clipping_report(body_final, tg_mesh, tg_vids, zrange=_zr),
                 "clipping_ray": garment.clipping_report_ray(body_final, tg_mesh, tg_vids, zrange=_zr),
                 "hem_height_cm": round((tg_hem_z - zmin_f) * 100, 1), "waist_height_cm": round((tg_top_z - zmin_f) * 100, 1),
                 "gap_cm": TT["gap_cm"], "triangles_crossing_shorts_after_tuck": tg_tuck_left, "hip_circ_cm": round(tg_got["hip"], 1), "hip_target_circ_cm": round(tg_want["hip"], 1),
                 "ankle_circ_cm": round(tg_got["ankle"], 1), "ankle_target_circ_cm": round(tg_want["ankle"], 1)}
    _gg.free()
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
if SG:
    add("sweatshirt", "chest_circ_cm", SG["chest_circ_cm"], sw_report["chest_circ_cm"])
    add("sweatshirt", "hem_above_crotch_cm", SG["hem_above_crotch_cm"], sw_report["hem_above_crotch_cm"])
    add("sweatshirt", "cuff_above_wrist_cm", SG["cuff_above_wrist_cm"], sw_report["cuff_above_wrist_cm"])
    add("sweatshirt", "neckline_width_cm", SG["neckline_width_cm"], sw_report["neckline_width_cm"])
for _style, _vr in var_reports.items():
    _VG = TG["necklines"][_style]
    add(f"tee_{_style}", "chest_circ_cm", TG["chest_circ_cm"], _vr["chest_circ_cm"])
    add(f"tee_{_style}", "sleeve_cm", TG["sleeve_cm"], _vr["sleeve_end_from_shoulder_cm"])
    add(f"tee_{_style}", "neckline_width_cm", _VG["neckline_width_cm"], _vr["neckline_width_cm"])
    add(f"tee_{_style}", "neckline_drop_front_cm", _VG["drop_front_cm"], _vr["neckline_drop_front_cm"])
for _kind, _sr in shirt_reports.items():  # V3-03
    add(f"shirt_{_kind}", "chest_circ_cm", SHG["chest_circ_cm"], _sr["chest_circ_cm"])
    add(f"shirt_{_kind}", "length_cm (shoulder to hem)", SHG["length_cm"], _sr["hem_from_hps_cm"])
    if _kind == "long":
        add("shirt_long", "cuff_above_wrist_cm", SHG["cuff_above_wrist_cm"], _sr["cuff_above_wrist_cm"])
    else:
        add(f"shirt_{_kind}", "sleeve_cm", shirt_sleeve_cm[_kind], _sr["sleeve_end_from_shoulder_cm"])
if RG:
    add("trousers", "waist_circ_cm", RG["waist_circ_cm"], tr_report["waist_circ_cm"])
    add("trousers", "hip_circ_cm", RG["hip_circ_cm"], tr_report["hip_circ_cm"])
    add("trousers", "rise_cm", RG["rise_cm"], tr_report["rise_cm"])
    add("trousers", "inseam_cm (visible + stacked over the foot)", RG["inseam_cm"], round(tr_report["inseam_cm"] + tr_report["inseam_leftover_cm"], 1))
    add("trousers", "leg_opening_circ_cm", RG["leg_opening_circ_cm"], tr_report["leg_opening_circ_cm"])
if HG:
    add("shorts", "inseam_cm", HG["inseam_cm"], sh_report["inseam_cm"])
    add("shorts", "leg_opening_circ_cm (trousers at that height + extra)", sh_report["leg_opening_target_circ_cm"], sh_report["leg_opening_circ_cm"])
    add("shorts", "waist_circ_cm", RG["waist_circ_cm"], sh_report["waist_circ_cm"])
    add("shorts", "hip_circ_cm", RG["hip_circ_cm"], sh_report["hip_circ_cm"])
if TT:
    add("tights", "hem_height_cm (above the floor)", TT["hem_above_floor_cm"], tg_report["hem_height_cm"])
    add("tights", "waist_height_cm (trousers' waist line less waist_below_trousers_cm)", round((tr_top_z - zmin_f) * 100 - TT["waist_below_trousers_cm"], 1), tg_report["waist_height_cm"])
    add("tights", "hip_circ_cm (body)", tg_report["hip_target_circ_cm"], tg_report["hip_circ_cm"])
    add("tights", "ankle_circ_cm (body + gap)", tg_report["ankle_target_circ_cm"], tg_report["ankle_circ_cm"])
bpy.data.objects.remove(ref)
results_extra = {"tee": tee_report, "trousers": tr_report, **({"shorts": sh_report} if HG else {}), **({"tights": tg_report} if TT else {}),**({"sweatshirt": sw_report} if SG else {}), **{f"tee_{s}": r_ for s, r_ in var_reports.items()}, **{f"shirt_{k}": r_ for k, r_ in shirt_reports.items()}, **over_reports, "garment_landmarks_vs_real": cmp_, "extra_body_checks": extra, "hps_height_cm_estimate": round((hps_z - zmin_f) * 100, 1)}

os.makedirs(out_dir, exist_ok=True)
report = {"name": name, "sex_base": M["sex_base"], "body_only": bool(M.get("body_only", False)), "shape_by_eye": M.get("shape", {}), "height_macro": round(hv, 4), "weight_macro": round(wv, 4), "results": results, **results_extra}
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
# V3-03 follow-up: every offset-shell garment the app draws is shaded with normals averaged over a radius (fit_config "shading"),
# so the body template's dense vertices at the navel and nipples do not draw anatomy on the cloth; the shape is unchanged.
# Not the tights (skin-close by design). A garments file from before this setting leaves the files' own normals.
_SHADE_R = (G or {}).get("shading_radius_cm")


def _shade(me):
    if _SHADE_R:
        garment.set_shading_normals(me, _SHADE_R / 100.0)


_shade(tee_mesh)
tee_ob = bpy.data.objects.new(name + "_tee", tee_mesh)
mat = bpy.data.materials.new("tee"); mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = _lin((TG or {}).get("colour_srgb", [217, 51, 64]))
tee_mesh.materials.append(mat)
bpy.context.scene.collection.objects.link(tee_ob)
bpy.ops.object.select_all(action="DESELECT")
tee_ob.select_set(True)
bpy.context.view_layer.objects.active = tee_ob
bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + "_tee.glb"), export_format="GLB", use_selection=True)
_shade(tr_mesh)
tr_ob = bpy.data.objects.new(name + "_trousers", tr_mesh)
mat2 = bpy.data.materials.new("trousers"); mat2.use_nodes = True
mat2.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = _lin((RG or {}).get("colour_srgb", [58, 83, 140]))
tr_mesh.materials.append(mat2)
bpy.context.scene.collection.objects.link(tr_ob)
bpy.ops.object.select_all(action="DESELECT")
tr_ob.select_set(True)
bpy.context.view_layer.objects.active = tr_ob
bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + "_trousers.glb"), export_format="GLB", use_selection=True)
if SG:
    _shade(sw_mesh)
    sw_ob = bpy.data.objects.new(name + "_sweatshirt", sw_mesh)
    mat3 = bpy.data.materials.new("sweatshirt"); mat3.use_nodes = True
    mat3.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = _lin(SG.get("colour_srgb", [214, 214, 214]))
    sw_mesh.materials.append(mat3)
    bpy.context.scene.collection.objects.link(sw_ob)
    bpy.ops.object.select_all(action="DESELECT")
    sw_ob.select_set(True)
    bpy.context.view_layer.objects.active = sw_ob
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + "_sweatshirt.glb"), export_format="GLB", use_selection=True)
if HG:  # V1.1-05: shorts.glb, same material setup as the trousers
    _shade(sh_mesh)
    sh_ob = bpy.data.objects.new(name + "_shorts", sh_mesh)
    mat4 = bpy.data.materials.new("shorts"); mat4.use_nodes = True
    mat4.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = _lin(HG.get("colour_srgb", [214, 214, 214]))
    sh_mesh.materials.append(mat4)
    bpy.context.scene.collection.objects.link(sh_ob)
    bpy.ops.object.select_all(action="DESELECT")
    sh_ob.select_set(True)
    bpy.context.view_layer.objects.active = sh_ob
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + "_shorts.glb"), export_format="GLB", use_selection=True)
if TT:  # V2-04: tights.glb, same material setup as the trousers (the app sets colour and sheerness)
    tg_ob = bpy.data.objects.new(name + "_tights", tg_mesh)
    mat5 = bpy.data.materials.new("tights"); mat5.use_nodes = True
    mat5.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = _lin(TT.get("colour_srgb", [214, 214, 214]))
    tg_mesh.materials.append(mat5)
    bpy.context.scene.collection.objects.link(tg_ob)
    bpy.ops.object.select_all(action="DESELECT")
    tg_ob.select_set(True)
    bpy.context.view_layer.objects.active = tg_ob
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + "_tights.glb"), export_format="GLB", use_selection=True)
for _style, _vm in var_meshes.items():  # V1.1-04: tee_v.glb, tee_scoop.glb, same material setup as the crew tee
    _shade(_vm)
    _vo = bpy.data.objects.new(f"{name}_tee_{_style}", _vm)
    _mv = bpy.data.materials.new(f"tee_{_style}"); _mv.use_nodes = True
    _mv.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = _lin((TG or {}).get("colour_srgb", [217, 51, 64]))
    _vm.materials.append(_mv)
    bpy.context.scene.collection.objects.link(_vo)
    bpy.ops.object.select_all(action="DESELECT")
    _vo.select_set(True)
    bpy.context.view_layer.objects.active = _vo
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, f"{name}_tee_{_style}.glb"), export_format="GLB", use_selection=True)
for _kind, _sm in shirt_meshes.items():  # V3-03: shirt_short.glb, shirt_mid.glb, shirt_long.glb, same material setup as the tee
    _so = bpy.data.objects.new(f"{name}_shirt_{_kind}", _sm)
    _ms = bpy.data.materials.new(f"shirt_{_kind}"); _ms.use_nodes = True
    _ms.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = _lin(SHG.get("colour_srgb", [214, 214, 214]))
    _sm.materials.append(_ms)
    _shade(_sm)  # smooth cloth, crisp collar and placket (set_shading_normals reads the "detail" attribute)
    bpy.context.scene.collection.objects.link(_so)
    bpy.ops.object.select_all(action="DESELECT")
    _so.select_set(True)
    bpy.context.view_layer.objects.active = _so
    # the collar and placket shading (the "Color" attribute) goes out as COLOR_0, by name: "ACTIVE" also wrote a blank attribute
    # the shell carries over from the body, as COLOR_0, with the shading as COLOR_1, which the app does not read
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, f"{name}_shirt_{_kind}.glb"), export_format="GLB", use_selection=True,
                              export_vertex_color="NAME", export_vertex_color_name="Color")
for _lbl, _om in over_meshes.items():  # V3-05: sweatshirt_over_tee.glb, shirt_*_over_tee.glb (a shirt keeps its collar and placket shading)
    _oo = bpy.data.objects.new(f"{name}_{_lbl}", _om)
    _mo = bpy.data.materials.new(_lbl); _mo.use_nodes = True
    _mo.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = _lin((SHG if _lbl.startswith("shirt") else SG).get("colour_srgb", [214, 214, 214]))
    _om.materials.append(_mo)
    _shade(_om)
    bpy.context.scene.collection.objects.link(_oo)
    bpy.ops.object.select_all(action="DESELECT")
    _oo.select_set(True)
    bpy.context.view_layer.objects.active = _oo
    if _lbl.startswith("shirt"):
        bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, f"{name}_{_lbl}.glb"), export_format="GLB", use_selection=True,
                                  export_vertex_color="NAME", export_vertex_color_name="Color")
    else:
        bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, f"{name}_{_lbl}.glb"), export_format="GLB", use_selection=True)
# mesh checks run on the exported GLBs read back in, because glTF export splits quads into its own triangles and the phone
# shows those triangles; checking the in-memory quads gives lower intersection counts
import mesh_checks
report["mesh_checks"] = mesh_checks.run(*(mesh_checks.load_glb(os.path.join(out_dir, name + sfx + ".glb")) for sfx in ("", "_tee", "_trousers")), hps_z,
                                        sweatshirt=mesh_checks.load_glb(os.path.join(out_dir, name + "_sweatshirt.glb")) if SG else None,
                                        tee_variants={**{f"tee_{s}": mesh_checks.load_glb(os.path.join(out_dir, f"{name}_tee_{s}.glb")) for s in var_meshes},
                                                     **{f"shirt_{k}": mesh_checks.load_glb(os.path.join(out_dir, f"{name}_shirt_{k}.glb")) for k in shirt_meshes},
                                                     **{_l: mesh_checks.load_glb(os.path.join(out_dir, f"{name}_{_l}.glb")) for _l in over_meshes}},
                                        shorts=mesh_checks.load_glb(os.path.join(out_dir, name + "_shorts.glb")) if HG else None,
                                        tights=mesh_checks.load_glb(os.path.join(out_dir, name + "_tights.glb")) if TT else None,
                                        shirt_shoulder_x_min=TOL["shirt"]["shoulder_gap_from_x_cm"] / 100.0)
# V3-03: how each garment will be shaded, read from its GLB (mesh_checks.shading_look), over the panels of plain cloth: for a top
# the torso clear of the arms and below the shoulders, for a shirt also clear of the placket and the collar (drawn details,
# meant to be crisp); for a bottom from the knee up, but not the crotch, where trousers really crease. Every garment here is held to
# tolerances.json "shading" (check_reports.py).
_segs3, _rad3 = garment._arm_segs(joints_final)


def _top_skip(p):
    return (garment._classify(p, _segs3, _rad3) != "torso" or p.z > hps_z - 0.08
            or any(garment._seg_dist(p, *_segs3[k])[0] < _rad3[k] + 0.05 for k in ("lup", "rup")))


def _shirt_skip(p):
    if _top_skip(p):
        return True
    _d = SHG["detail"]
    if (p.y - shirt_neck["cy"]) * FRONT > 0 and abs(p.x - shirt_neck["cx"]) < (_d["placket_half_width_cm"] + _d["placket_edge_cm"]) / 100.0 + 0.02:
        return True
    _ex, _ey = (p.x - shirt_neck["cx"]) / (shirt_neck["a"] + 0.05), (p.y - shirt_neck["cy"]) / (shirt_neck["b"] + 0.05)
    return _ex * _ex + _ey * _ey < 1.0 and p.z > hps_z - _d["tip_drop_cm"] / 100.0 - 0.04


_knee_z = max(joints_final["joint-l-knee"].z, joints_final["joint-r-knee"].z)
# a bottom from the knee up (hips, seat, thighs, where a wrap would show anatomy), not the crotch; below the knee the straight leg
# leaves the calf on purpose, a turn of the cut, not of the body (40 degrees on Joe's trousers, with or without smoothing)
_bottom_skip = lambda p: p.z < _knee_z or (abs(p.x) < 0.08 and p.z < crotch_z + 0.10)
report["shading"] = {}
for _g, _sk in ([("tee", _top_skip), ("trousers", _bottom_skip)] + ([("sweatshirt", _top_skip)] if SG else []) + ([("shorts", _bottom_skip)] if HG else [])
                + [(f"tee_{s}", _top_skip) for s in var_meshes] + [(f"shirt_{k}", _shirt_skip) for k in shirt_meshes]
                + [(_l, _shirt_skip if _l.startswith("shirt") else _top_skip) for _l in over_meshes]):
    report["shading"][_g] = mesh_checks.shading_look(os.path.join(out_dir, f"{name}_{_g}.glb"), skip=_sk)
    print("SHADING", _g, report["shading"][_g])
if BUST is not None:  # V2-08: how each top sits over the bust, measured on the exported GLBs (pack/bust_shape.py, numpy only)
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "pack"))
    import bust_shape
    _body = bust_shape.load_glb(glb)
    _apx = bust_shape.body_apexes(_body, marks["chest_cm"] * H_f * 100)
    report["bust_shape"] = {"body_apexes_x_height_depth_cm": [[round(c, 1) for c in a] for a in _apx],
                            "cup": M.get("cup"), "cupsize_macro": _cup, "body_cup": bust_shape.body_cup(_body, marks["chest_cm"] * H_f * 100, _apx),  # V2-09: reported, not limited
                            **{top: bust_shape.measure_top(bust_shape.load_glb(os.path.join(out_dir, f"{name}_{top}.glb")), _body[0][:, 1].min(), _apx)
                               for top in ["tee"] + [f"tee_{s}" for s in var_meshes] + [f"shirt_{k}" for k in shirt_meshes] + (["sweatshirt"] if SG else []) + list(over_meshes)}}
    print("BUST_SHAPE", json.dumps(report["bust_shape"]))
if over_meshes:  # V3-05: each layered top against each tee it can be worn over (crew, V, scoop), read from the exported files
    report["layers"] = mesh_checks.layers(
        {_l: mesh_checks.load_glb(os.path.join(out_dir, f"{name}_{_l}.glb")) for _l in over_meshes},
        {"tee": mesh_checks.load_glb(os.path.join(out_dir, name + "_tee.glb")),
         **{f"tee_{s}": mesh_checks.load_glb(os.path.join(out_dir, f"{name}_tee_{s}.glb")) for s in var_meshes}})
    print("LAYERS", json.dumps({_l: {_t: (_m["intersecting_pairs"], _m["inner_inside_clearance_cm"]["min"]) for _t, _m in _d.items()} for _l, _d in report["layers"].items()}))
json.dump(report, open(os.path.join(out_dir, name + "_report.json"), "w"), indent=2)
print("TEE", json.dumps(tee_report))
print("TROUSERS", json.dumps(tr_report))
if SG:
    print("SWEATSHIRT", json.dumps({k: v for k, v in sw_report.items() if k != "clipping_ray"}))
for _style, _vr in var_reports.items():
    print(f"TEE_{_style.upper()}", json.dumps({k: v for k, v in _vr.items() if k not in ("clipping_ray", "clipping")}))
for _kind, _sr in shirt_reports.items():
    print(f"SHIRT_{_kind.upper()}", json.dumps({k: v for k, v in _sr.items() if k not in ("clipping_ray", "clipping")}))
print("REPORT", json.dumps(results))
print("GLB_BYTES", os.path.getsize(glb))
