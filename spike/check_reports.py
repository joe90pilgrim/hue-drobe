"""Fail (exit 1) if any *_report.json in a folder misses a tolerance from spike/tolerances.json.

Stricter than the first version:
- every tolerance comes from tolerances.json (never from the report);
- a missing measure, garment or test is a failure, not a silent skip;
- a garment whose size calibration did not converge fails, because a number that is only true by construction proves nothing;
- clipping is judged by the ray test (excluding points within 3 cm of an open fabric edge); the older nearest-point test is
  printed for information only because it misjudges folds such as the crotch.

Usage: python spike/check_reports.py <folder> [--no-garments]
"""
import json, sys, pathlib

tol = json.load(open(pathlib.Path(__file__).with_name("tolerances.json")))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
need_garments = "--no-garments" not in sys.argv
folder = pathlib.Path(args[0])
reports = sorted(folder.glob("*_report.json"))
failures = 0


def check(ok, text):
    global failures
    failures += not ok
    print(f"  {'PASS' if ok else 'FAIL'} {text}")


if not reports:
    print(f"no *_report.json files in {folder}")
    sys.exit(1)

for f in reports:
    r = json.load(open(f))
    print(f"== {r['name']}")
    got = {m["measure"]: m for m in r.get("results", [])}
    if "height_cm" not in got:
        check(False, "height_cm missing from report")
    for k, m in got.items():
        limit = tol["length_cm"] if k == "height_cm" else tol["circumference_cm"]
        err = m["achieved"] - m["target"]
        check(abs(err) <= limit, f"{k}: target {m['target']} got {m['achieved']} (error {err:+.2f}, tol {limit})")
    for k, m in r.get("extra_body_checks", {}).items():
        err = m["achieved"] - m["target"]
        check(abs(err) <= tol["circumference_cm"], f"{k}: target {m['target']} got {m['achieved']} (error {err:+.1f}, tol {tol['circumference_cm']})")

    for g in ("tee", "trousers"):
        if g not in r:
            check(False, f"{g} missing from report")
            continue
        gr = r[g]
        ray = gr.get("clipping_ray")
        if ray is None:
            check(False, f"{g} ray clipping test missing")
        else:
            frac = ray["fraction_excluding_edges"]
            check(frac <= tol["garment_clipping_max_fraction"],
                  f"{g} clipping (ray, edges excluded): {frac*100:.2f}% of {ray['samples']} samples (limit {tol['garment_clipping_max_fraction']*100:.2f}%); strict incl. edges {ray['fraction_strict']*100:.2f}%")
        old = gr.get("clipping")
        if old:
            print(f"  info {g} old nearest-point test: {old['fraction']*100:.2f}%, worst {old['worst_penetration_cm']} cm (not used for pass/fail)")
        cal = gr.get("calibration")
        if need_garments:
            if cal is None:
                check(False, f"{g} has no calibration record (was a garment fixture supplied?)")
            else:
                check(cal["converged"], f"{g} calibration converged (residuals {cal['residual_cm']}) -- landmark matches are otherwise by construction")
                if cal["ease_at_floor"]:
                    print(f"  info {g} ease at its floor for: {cal['ease_at_floor']} (real item smaller than body plus 3 mm; stretch is not modelled)")

    if need_garments:
        lm = r.get("garment_landmarks_vs_real", [])
        if not lm:
            check(False, "no garment landmark comparison in report")
        for m in lm:
            err = m["achieved"] - m["target"]
            check(abs(err) <= tol["garment_landmark_cm"], f"{m['garment']} {m['measure']}: real {m['target']} model {m['achieved']} (error {err:+.1f}, tol {tol['garment_landmark_cm']})")

print("FAILED" if failures else "ALL PASSED", f"({failures} failures)")
sys.exit(1 if failures else 0)
