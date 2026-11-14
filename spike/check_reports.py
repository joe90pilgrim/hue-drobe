"""Fail (exit 1) if any *_report.json in a folder misses a tolerance from spike/tolerances.json.
Usage: python spike/check_reports.py <folder>
"""
import json, sys, pathlib

tol = json.load(open(pathlib.Path(__file__).with_name("tolerances.json")))
folder = pathlib.Path(sys.argv[1])
failures = 0
for f in sorted(folder.glob("*_report.json")):
    r = json.load(open(f))
    print(f"== {r['name']}")
    for m in r["results"]:
        ok = abs(m["error"]) <= m["tolerance"]
        failures += not ok
        print(f"  {'PASS' if ok else 'FAIL'} {m['measure']}: target {m['target']} got {m['achieved']} (error {m['error']:+}, tol {m['tolerance']})")
    for g in ("tee", "trousers"):
        c = r[g]["clipping"]
        ok = c["fraction"] <= tol["garment_clipping_max_fraction"] and c["worst_penetration_cm"] <= tol["garment_clipping_max_depth_cm"]
        failures += not ok
        print(f"  {'PASS' if ok else 'FAIL'} {g} clipping: {c['showing_through']}/{c['covered_body_verts']} ({c['fraction']*100:.2f}%), worst {c['worst_penetration_cm']} cm")
print("FAILED" if failures else "ALL PASSED", f"({failures} failures)")
sys.exit(1 if failures else 0)
