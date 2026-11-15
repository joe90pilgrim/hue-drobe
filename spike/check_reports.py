"""Fail (exit 1) if any *_report.json in a folder misses a tolerance from spike/tolerances.json.

Stricter than the first version:
- every tolerance comes from tolerances.json (never from the report);
- a missing measure, garment or test is a failure, not a silent skip;
- a garment whose size calibration did not converge fails, because a number that is only true by construction proves nothing;
- garment clipping is judged by hard mesh limits (tolerances.json "garment_mesh"): zero intersecting face pairs between body
  and garment, within a garment and between tee and trousers; a minimum cloth-to-body clearance; and the expected number of
  pieces and openings. The ray test and the older nearest-point test are printed for information only.
- height and inside leg use the length tolerance; circumferences use the circumference tolerance.

Usage: python spike/check_reports.py <folder> [--no-garments]
"""
import json, sys, pathlib

tol = json.load(open(pathlib.Path(__file__).with_name("tolerances.json")))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
need_garments = "--no-garments" not in sys.argv
folder = pathlib.Path(args[0])
reports = sorted(folder.glob("*_report.json"))
failures = 0
LENGTHS = {"height_cm", "inside_leg_cm"}
gm = tol["garment_mesh"]


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
        limit = tol["length_cm"] if k in LENGTHS else tol["circumference_cm"]
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
        if ray:
            print(f"  info {g} ray test (edges excluded): {ray['fraction_excluding_edges']*100:.2f}% of {ray['samples']} samples; strict {ray['fraction_strict']*100:.2f}% (not used for pass/fail)")
        mc = r.get("mesh_checks", {}).get(g)
        if mc is None:
            check(False, f"{g} mesh checks missing from report (rebuild with the current body_from_measurements.py)")
        else:
            check(mc["pieces"] == gm[f"{g}_pieces"], f"{g} pieces: {mc['pieces']} (want {gm[g + '_pieces']}); faces/area {[(p['faces'], p['area_cm2']) for p in mc['piece_faces_area']]}")
            check(mc["openings"] == gm[f"{g}_openings"], f"{g} openings: {mc['openings']} (want {gm[g + '_openings']}); lengths cm {mc['opening_lengths_cm']}")
            check(mc["body_intersecting_pairs"] <= gm["body_intersecting_pairs_max"], f"{g} body-through-cloth intersecting face pairs: {mc['body_intersecting_pairs']} (max {gm['body_intersecting_pairs_max']}); by height cm {mc.get('body_intersections_by_z_cm')}")
            check(mc["self_intersecting_pairs"] <= gm["self_intersecting_pairs_max"], f"{g} self-intersecting face pairs: {mc['self_intersecting_pairs']} (max {gm['self_intersecting_pairs_max']}); by height cm {mc['self_intersections_by_z_cm']}")
            cl = mc["clearance_to_body_cm"]["min"]
            check(cl >= gm["min_clearance_cm"], f"{g} minimum clearance to body: {cl} cm (min {gm['min_clearance_cm']})")
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

    if "mesh_checks" in r:
        n = r["mesh_checks"]["tee_vs_trousers_intersecting_pairs"]
        check(n <= gm["tee_vs_trousers_intersecting_pairs_max"], f"tee-through-trousers intersecting face pairs: {n} (max {gm['tee_vs_trousers_intersecting_pairs_max']})")
        sg = r["mesh_checks"]["tee"]["shoulder_gap"]
        check(sg["worst_band_mean_cm"] is not None and sg["worst_band_mean_cm"] <= gm["tee_shoulder_gap_band_mean_max_cm"]
              and sg["max_cm"] <= gm["tee_shoulder_gap_max_cm"],
              f"tee shoulder gap: worst band mean {sg['worst_band_mean_cm']} cm (max {gm['tee_shoulder_gap_band_mean_max_cm']}), "
              f"max {sg['max_cm']} cm (max {gm['tee_shoulder_gap_max_cm']})")

    for lbl, cg in (r.get("tee", {}).get("circ_vs_garment_cm") or {}).items():
        if cg.get("error") is None:
            print(f"  info tee circumference at {lbl} ({cg['height_cm']} cm): {cg['tee']} cm, no garment value (hem_circ_cm missing)")
        else:
            check(abs(cg["error"]) <= tol["garment_landmark_cm"], f"tee circumference at {lbl} ({cg['height_cm']} cm): tee {cg['tee']} garment {cg['garment']} (error {cg['error']:+.1f}, tol {tol['garment_landmark_cm']})")

    if need_garments:
        lm = r.get("garment_landmarks_vs_real", [])
        if not lm:
            check(False, "no garment landmark comparison in report")
        for m in lm:
            err = m["achieved"] - m["target"]
            check(abs(err) <= tol["garment_landmark_cm"], f"{m['garment']} {m['measure']}: real {m['target']} model {m['achieved']} (error {err:+.1f}, tol {tol['garment_landmark_cm']})")

print("FAILED" if failures else "ALL PASSED", f"({failures} failures)")
sys.exit(1 if failures else 0)
