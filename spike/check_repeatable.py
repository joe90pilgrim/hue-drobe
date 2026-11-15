"""Compare two build folders built from the same inputs.

Usage: python spike/check_repeatable.py <folder_a> <folder_b> [--tol CM]
Without --tol, every GLB must be byte-identical and every report must hold the same values.
With --tol, GLBs must have the same vertex count and no vertex may differ by more than CM centimetres, and every number
in the reports may differ by at most CM (report values are mostly in cm). Use it for the cloth drape, whose solver is
not bit-for-bit repeatable.
Exit 1 if anything differs beyond that or a file is missing from either folder.
"""
import sys, json, struct, hashlib, pathlib, math

args = [a for a in sys.argv[1:] if not a.startswith("--")]
tol = float(sys.argv[sys.argv.index("--tol") + 1]) if "--tol" in sys.argv else None
if tol is not None:
    args = [a for a in args if a != str(sys.argv[sys.argv.index("--tol") + 1])]
a, b = (pathlib.Path(p) for p in args[:2])


def glb_positions(path):
    """Vertex positions (metres) of every mesh primitive in a GLB, in file order."""
    data = path.read_bytes()
    jlen = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + jlen])
    bin_off = 20 + jlen + 8
    out = []
    for mesh in gltf["meshes"]:
        for prim in mesh["primitives"]:
            acc = gltf["accessors"][prim["attributes"]["POSITION"]]
            view = gltf["bufferViews"][acc["bufferView"]]
            start = bin_off + view.get("byteOffset", 0) + acc.get("byteOffset", 0)
            stride = view.get("byteStride", 12)
            out += [struct.unpack_from("<3f", data, start + i * stride) for i in range(acc["count"])]
    return out


def json_diff(x, y):
    """Largest numeric difference between two JSON values, or inf if their structure differs."""
    if isinstance(x, dict) and isinstance(y, dict):
        return max((json_diff(x[k], y[k]) for k in x), default=0.0) if x.keys() == y.keys() else math.inf
    if isinstance(x, list) and isinstance(y, list):
        return max((json_diff(u, v) for u, v in zip(x, y)), default=0.0) if len(x) == len(y) else math.inf
    if isinstance(x, (int, float)) and isinstance(y, (int, float)) and not isinstance(x, bool):
        if math.isnan(x) and math.isnan(y):
            return 0.0
        return abs(x - y)
    return 0.0 if x == y else math.inf


names = sorted({p.name for p in a.glob("*.glb")} | {p.name for p in a.glob("*_report.json")}
               | {p.name for p in b.glob("*.glb")} | {p.name for p in b.glob("*_report.json")})
bad = 0
for n in names:
    fa, fb = a / n, b / n
    if not (fa.exists() and fb.exists()):
        print(f"MISSING {n}"); bad += 1
        continue
    if tol is None:
        if n.endswith(".glb"):
            same = hashlib.sha256(fa.read_bytes()).digest() == hashlib.sha256(fb.read_bytes()).digest()
        else:
            same = json.loads(fa.read_text()) == json.loads(fb.read_text())
        print(f"{'SAME' if same else 'DIFFERENT'} {n}")
    else:
        if n.endswith(".glb"):
            pa, pb = glb_positions(fa), glb_positions(fb)
            d = math.inf if len(pa) != len(pb) else max((math.dist(u, v) * 100 for u, v in zip(pa, pb)), default=0.0)
        else:
            d = json_diff(json.loads(fa.read_text()), json.loads(fb.read_text()))
        same = d <= tol
        print(f"{'WITHIN' if same else 'BEYOND'} {n}: largest difference {d:.3f} (tol {tol})")
    bad += not same
print("REPEATABLE" if not bad else f"NOT REPEATABLE ({bad} files)")
sys.exit(1 if bad else 0)
