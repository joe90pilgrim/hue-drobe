"""Measure how a top sits over the bust (V2-08), from the exported GLBs, with numpy only.

Why: the tops are offset shells a few millimetres off the body, and on a female body they came to a point at each
breast and tucked under the bust (bug V2-08). No hard mesh check sees that, because nothing clips. This puts a number
on the shape so a fix is judged by the number and a screenshot, not by eye alone.

Usage: python pack/bust_shape.py <body.glb> <report.json> <top.glb> [<top.glb> ...]
  The bust apex is found on the body: the most forward point of each breast, within 4 cm of the bust landmark height
  (from the report) and 5 to 16 cm either side of the centre line. The top's apex is its most forward point within
  2 cm sideways and 3 cm up or down of the body's. Then, per side, in cm:
    hollow_below   how far the cloth falls back behind its apex in the 6 cm below it (the tuck under the bust)
    drop_up/in/out how far the cloth falls back 3 cm above, 3 cm towards the centre, 3 cm away from the centre
  The depth maps are sampled from cross-section outlines (0.5 cm grid, front half of the torso only).
  Limits (tolerances.json "bust_shape", once agreed) are applied when the file has them; exit code 1 if any is missed.
"""
import json, pathlib, sys
import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from measure_glb import load_glb, slice_loops, torso_circumference_cm  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
STEP = 0.5  # cm


def _dense(loop, step=0.001):
    pts, n = [], len(loop)
    for i in range(n):
        a, b = loop[i], loop[(i + 1) % n]
        k = max(1, int(np.linalg.norm(b - a) / step))
        pts.append(a + np.linspace(0, 1, k, endpoint=False)[:, None] * (b - a))
    return np.vstack(pts)


def depth_map(v, t, ymin, hs, xs):
    """Most forward surface depth (cm, +Z is the front in glTF) at each (height, x) on the grid; nan where nothing is cut."""
    out = np.full((len(hs), len(xs)), np.nan)
    for i, h in enumerate(hs):
        loops = [_dense(l) for l in slice_loops(v, t, ymin + h / 100) if len(l) > 3 and abs(l[:, 0].mean()) < 0.15]
        if not loops:
            continue
        pts = np.vstack(loops) * 100
        for j, x in enumerate(xs):
            sel = np.abs(pts[:, 0] - x) < STEP / 2
            if sel.any():
                out[i, j] = pts[sel, 1].max()
    return out


def body_apexes(body, bust_h):
    """(x cm, height cm, depth cm) of the most forward point of each breast, right (x<0) then left (x>0)."""
    v, t = body
    ymin = v[:, 1].min()
    hs = np.arange(bust_h - 4, bust_h + 4 + STEP / 2, STEP)
    xs = np.arange(-16, 16 + STEP / 2, STEP)
    dm = depth_map(v, t, ymin, hs, xs)
    out = []
    for lo, hi in ((-16, -5), (5, 16)):
        cols = (xs >= lo) & (xs <= hi)
        sub = np.where(np.isnan(dm[:, cols]), -np.inf, dm[:, cols])
        i, j = np.unravel_index(np.argmax(sub), sub.shape)
        out.append((float(xs[cols][j]), float(hs[i]), float(sub[i, j])))
    return out


def body_cup(body, bust_h, apexes):
    """V2-09: how big the body's own bust is, in cm, so a cup size can be judged by a number. Reported, not limited.
      bust_minus_underbust_cm  torso circumference at the bust line less the circumference 5 cm below it (a bra's cup is this
                               difference: about 2.5 cm is an A cup, 5 a B, 7.5 a C, 10 a D, 12.5 a DD)
      projection_cm            per breast, how far the apex stands in front of the chest wall: the apex depth less the mean
                               body depth at the same sideways position 6 cm above and 6 cm below the apex
    """
    v, t = body
    ymin = v[:, 1].min()
    circ = lambda h: float(torso_circumference_cm(v, t, ymin + h / 100))
    out = {"bust_circ_cm": round(circ(bust_h), 1), "underbust_circ_cm": round(circ(bust_h - 5), 1)}
    out["bust_minus_underbust_cm"] = round(out["bust_circ_cm"] - out["underbust_circ_cm"], 1)
    proj = []
    for ax, ah, ad in apexes:
        hs = np.array([ah - 6, ah + 6])
        xs = np.arange(ax - STEP, ax + STEP + STEP / 2, STEP)
        dm = depth_map(v, t, ymin, hs, xs)
        ref = float(np.nanmean(np.nanmax(dm, axis=1)))
        proj.append(round(ad - ref, 2))
    out["projection_cm"] = proj
    return out


def measure_top(top, ymin, apexes):
    """Per side: the top's apex and how it falls away from it, in cm."""
    v, t = top
    res = []
    for ax, ah, _ in apexes:
        hs = np.arange(ah - 9, ah + 6 + STEP / 2, STEP)
        xs = np.arange(ax - 6, ax + 6 + STEP / 2, STEP)
        dm = depth_map(v, t, ymin, hs, xs)
        win = (np.abs(hs[:, None] - ah) <= 3) & (np.abs(xs[None, :] - ax) <= 2)
        sub = np.where(win & ~np.isnan(dm), dm, -np.inf)
        i, j = np.unravel_index(np.argmax(sub), sub.shape)
        d0, x0, h0 = float(sub[i, j]), float(xs[j]), float(hs[i])
        inward = -1 if x0 > 0 else 1

        def at(x, h):
            jj, ii = int(round((x - xs[0]) / STEP)), int(round((h - hs[0]) / STEP))
            return dm[ii, jj] if 0 <= ii < len(hs) and 0 <= jj < len(xs) else np.nan
        below = [d0 - at(x0, h0 - k * STEP) for k in range(1, int(6 / STEP) + 1)]
        res.append({"apex_x_cm": x0, "apex_height_cm": h0, "apex_depth_cm": round(d0, 2),
                    "hollow_below_cm": round(float(np.nanmax(below)), 2),
                    "drop_up_cm": round(float(d0 - at(x0, h0 + 3)), 2),
                    "drop_in_cm": round(float(d0 - at(x0 + 3 * inward, h0)), 2),
                    "drop_out_cm": round(float(d0 - at(x0 - 3 * inward, h0)), 2)})
    return res


def main():
    body_path, report_path, tops = sys.argv[1], sys.argv[2], sys.argv[3:]
    rep = json.load(open(report_path))
    frac = {r["measure"]: r["landmark_fraction_of_height"] for r in rep["results"] if "landmark_fraction_of_height" in r}
    body = load_glb(body_path)
    ymin, H = body[0][:, 1].min(), body[0][:, 1].max() - body[0][:, 1].min()
    bust_h = frac["chest_cm"] * H * 100
    apexes = body_apexes(body, bust_h)
    print(f"{pathlib.Path(body_path).name}: bust line {bust_h:.1f} cm; body apexes (x, height, depth cm) {[tuple(round(c, 1) for c in a) for a in apexes]}")
    print(f"body bust: {body_cup(body, bust_h, apexes)}")
    limits = json.load(open(ROOT / "spike" / "tolerances.json")).get("bust_shape")
    bad = 0
    print(f"{'top':32s} {'side':5s} {'apex x,h':>11s} {'hollow_below':>12s} {'drop_up':>8s} {'drop_in':>8s} {'drop_out':>9s}")
    for p in tops:
        for side, m in zip(("right", "left"), measure_top(load_glb(p), ymin, apexes)):
            flags = ""
            if limits:
                miss = [k for k in ("hollow_below_cm", "drop_up_cm", "drop_in_cm") if m[k] > limits[k]]
                bad += bool(miss)
                flags = "  FAIL " + ", ".join(miss) if miss else "  pass"
            print(f"{pathlib.Path(p).name:32s} {side:5s} {m['apex_x_cm']:5.1f},{m['apex_height_cm']:5.1f} {m['hollow_below_cm']:12.2f} {m['drop_up_cm']:8.2f} {m['drop_in_cm']:8.2f} {m['drop_out_cm']:9.2f}{flags}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
