"""Measure an exported body GLB against its tape measurements, without Blender and without the generator's own code (V2-02).

Why: body_from_measurements.py reports the size of the mesh it holds in memory, before export. This reads the file the app
loads, so the numbers are for what the phone shows. It uses only numpy and the glTF file.

Usage: python pack/measure_glb.py <body.glb> <measurements.json> [<report.json>]
  Height is the vertical extent of the mesh. Bust (chest_cm), waist and hips are the length of the cross-section outline that
  surrounds the centre line, taken at the landmark heights in the report (landmark_fraction_of_height). The generator finds
  each landmark once, as the widest (bust, hips) or narrowest (waist) point of the base body, and holds it while solving, so
  the tape height is that fixed height, not the narrowest point of the final mesh. Without a report the fractions 0.725,
  0.64 and 0.485 are used. Tolerances come from spike/tolerances.json. Exit code 0 only if every measure is within tolerance.
"""
import json, pathlib, struct, sys
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOL = json.load(open(ROOT / "spike" / "tolerances.json"))
DEFAULT_FRACTIONS = {"chest_cm": 0.725, "waist_cm": 0.64, "hips_cm": 0.485}


def load_glb(path):
    """Positions (n, 3) in metres and triangles (m, 3) from a GLB with one or more triangle meshes. glTF is Y up."""
    data = pathlib.Path(path).read_bytes()
    assert data[:4] == b"glTF", "not a GLB"
    jlen, _ = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + jlen])
    blen = struct.unpack_from("<I", data, 20 + jlen)[0]
    binary = data[28 + jlen:28 + jlen + blen]

    def accessor(i):
        a = gltf["accessors"][i]
        bv = gltf["bufferViews"][a["bufferView"]]
        dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[a["componentType"]]
        n = {"SCALAR": 1, "VEC3": 3}[a["type"]]
        start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = bv.get("byteStride")
        if stride and stride != dt().itemsize * n:
            raise ValueError("interleaved buffers are not handled")
        return np.frombuffer(binary, dtype=dt, count=a["count"] * n, offset=start).reshape(a["count"], n)

    verts, tris, base = [], [], 0
    for mesh in gltf["meshes"]:
        for prim in mesh["primitives"]:
            p = accessor(prim["attributes"]["POSITION"]).astype(np.float64)
            idx = accessor(prim["indices"]).astype(np.int64).reshape(-1, 3)
            verts.append(p)
            tris.append(idx + base)
            base += len(p)
    return np.vstack(verts), np.vstack(tris)


def slice_loops(v, t, y):
    """Closed outlines where the plane height=y cuts the mesh. Returns a list of (n, 2) arrays of (x, z) points in order."""
    h = v[:, 1] - y
    segs = {}
    for tri in t:
        d = h[tri]
        if (d > 0).all() or (d < 0).all() or (d == 0).all():
            continue
        pts = []
        for a, b in ((0, 1), (1, 2), (2, 0)):
            da, db = d[a], d[b]
            if (da > 0) != (db > 0) and da != db:  # edge crosses the plane
                s = da / (da - db)
                p = v[tri[a]] + s * (v[tri[b]] - v[tri[a]])
                pts.append((round(p[0], 7), round(p[2], 7)))
        if len(pts) == 2 and pts[0] != pts[1]:
            segs.setdefault(pts[0], []).append(pts[1])
            segs.setdefault(pts[1], []).append(pts[0])
    loops, used = [], set()
    for start in list(segs):
        if start in used:
            continue
        loop, cur, prev = [start], start, None
        used.add(start)
        while True:
            nxt = [q for q in segs[cur] if q != prev and q not in used]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            used.add(cur)
            loop.append(cur)
        loops.append(np.array(loop))
    return loops


def torso_circumference_cm(v, t, y):
    """Length of the closed outline around the centre line (x = 0) at height y, in cm. NaN if there is none."""
    best = float("nan")
    for loop in slice_loops(v, t, y):
        if len(loop) < 8:
            continue
        x = loop[:, 0]
        if x.min() < 0 < x.max():  # the outline that surrounds the centre line, not an arm
            length = np.linalg.norm(np.diff(np.vstack([loop, loop[:1]]), axis=0), axis=1).sum()
            best = length * 100 if np.isnan(best) else max(best, length * 100)
    return best


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    v, t = load_glb(sys.argv[1])
    m = json.load(open(sys.argv[2]))
    rep = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else None
    ymin, ymax = v[:, 1].min(), v[:, 1].max()
    height = (ymax - ymin) * 100
    frac = dict(DEFAULT_FRACTIONS)
    if rep:
        for r in rep["results"]:
            if "landmark_fraction_of_height" in r:
                frac[r["measure"]] = r["landmark_fraction_of_height"]
    fails = 0
    err = height - m["height_cm"]
    ok = abs(err) <= TOL["length_cm"]
    fails += not ok
    print(f"{'PASS' if ok else 'FAIL'} height_cm: target {m['height_cm']:.2f} measured {height:.2f} (error {err:+.2f}, tol {TOL['length_cm']})")
    for key in ("chest_cm", "waist_cm", "hips_cm"):
        if key not in m:
            continue
        y0 = ymin + frac[key] * (ymax - ymin)
        got = torso_circumference_cm(v, t, y0)
        if np.isnan(got):
            print(f"FAIL {key}: no outline found around the centre line")
            fails += 1
            continue
        err = got - m[key]
        ok = abs(err) <= TOL["circumference_cm"]
        fails += not ok
        real = " (placeholder, not a tape value)" if key not in m.get("real", []) else ""
        print(f"{'PASS' if ok else 'FAIL'} {key}: target {m[key]:.2f} measured {got:.2f} at {frac[key] * 100:.1f}% of height "
              f"(error {err:+.2f}, tol {TOL['circumference_cm']}){real}")
    print("ALL PASSED" if not fails else f"FAILED ({fails})")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
