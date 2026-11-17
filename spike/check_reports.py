"""Fail (exit 1) if any *_report.json in a folder misses a tolerance from spike/tolerances.json.

Stricter than the first version:
- every tolerance comes from tolerances.json (never from the report);
- a missing measure, garment or test is a failure, not a silent skip;
- a garment whose size calibration did not converge fails, because a number that is only true by construction proves nothing;
- garment clipping is judged by hard mesh limits (tolerances.json "garment_mesh"): zero intersecting face pairs between body
  and garment, within a garment and between tee and trousers; a minimum cloth-to-body clearance; and the expected number of
  pieces and openings. The ray test and the older nearest-point test are printed for information only.
- height and inside leg use the length tolerance; circumferences use the circumference tolerance.

- a sweatshirt (MVP-07), when the report has one, gets exactly the tee's mesh limits (pieces, openings, intersections,
  clearance, shoulder gap; sweatshirt with trousers uses the tee-with-trousers limit). --sweatshirt makes a missing one a failure.

- the other tee necklines (V1.1-04: tee_v, tee_scoop), when the report has them, get exactly the tee's mesh limits too, plus their
  own neckline width and front depth against the fit config. --necklines makes a missing one a failure.

- shorts (V1.1-05), when the report has them, get exactly the trousers' mesh limits, and every top is checked against them with
  the tee-with-trousers limit. --shorts makes missing shorts a failure.

- a report with "body_only": true (copied from the measurements file by the generator, V2-02) is judged on the body's own measures
  (height, circumferences, extra_body_checks) only. Every garment is skipped. Used for a person whose garments are not built yet;
  the synthetic bodies and the shipped garments never use it.

- tights (V2-04), when the report has them, get exactly the trousers' mesh limits, and the shorts and every top are checked against
  them with the tee-with-trousers limit. --tights makes missing tights a failure.

- skirt (V3-01b), on a female body (sex_base in the report) when the report has one: the trousers-style hard limits with its own pieces
  and openings (1 and 2), the hem's lowest point within garment_landmark_cm of the target, no cloth through the tights, and the
  tops tucked into it (tee_tucked, tee_v_tucked, tee_scoop_tucked) held to the tee's limits plus no face pairs with the skirt or
  the tights. --skirt makes a missing skirt a failure on a female body; male bodies are never judged on it.

- bust shape (V2-08): on a female body (sex_base in the report) every top must have a bust_shape record (pack/bust_shape.py, written
  by the generator) and each breast's hollow_below, drop_up and drop_in must be within tolerances.json "bust_shape". Male bodies are
  not judged on this. The body's own bust (cup macro, bust minus underbust, projection; V2-09) is printed as information, with no limit.

Usage: python spike/check_reports.py <folder> [--no-garments] [--sweatshirt] [--necklines] [--shorts] [--tights] [--skirt]
"""
import json, sys, pathlib

tol = json.load(open(pathlib.Path(__file__).with_name("tolerances.json")))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
need_garments = "--no-garments" not in sys.argv
folder = pathlib.Path(args[0])
reports = sorted(f for f in folder.glob("*_report.json") if not f.name.endswith("_skirt_report.json"))  # V3-01b: the skirt script's own detail file sits beside the body reports
failures = 0
LENGTHS = {"height_cm", "inside_leg_cm"}
gm = tol["garment_mesh"]
NECKLINE_TEES = ("tee_v", "tee_scoop")  # V1.1-04
_exc_path = pathlib.Path(__file__).with_name("known_exceptions.json")
EXCEPTIONS = {(e["body"], e["check"]): e for e in json.load(open(_exc_path))["exceptions"]} if _exc_path.exists() else {}


def check(ok, text, known=None):
    """known: the matching entry from known_exceptions.json when the value is inside its limit."""
    global failures
    if not ok and known:
        print(f"  KNOWN {text} -- {known['reason']}")
        return
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

    if r.get("body_only"):  # V2-02: the measurements file says "body_only": true, so the body is judged on its own
        print("  info garments not judged: this body is marked body_only (its garments are V2-03)")
        continue
    variants = tuple(g for g in NECKLINE_TEES if g in r or "--necklines" in sys.argv)
    shorts = ("shorts",) if "shorts" in r or "--shorts" in sys.argv else ()  # V1.1-05
    tights = ("tights",) if "tights" in r or "--tights" in sys.argv else ()  # V2-04
    for g in ("tee", "trousers") + (("sweatshirt",) if "sweatshirt" in r or "--sweatshirt" in sys.argv else ()) + variants + shorts + tights:
        lim = "trousers" if g in ("trousers", "shorts", "tights") else "tee"  # the sweatshirt and the other necklines are held to the tee's limits, the shorts to the trousers'
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
            check(mc["pieces"] == gm[f"{lim}_pieces"], f"{g} pieces: {mc['pieces']} (want {gm[lim + '_pieces']}); faces/area {[(p['faces'], p['area_cm2']) for p in mc['piece_faces_area']]}")
            check(mc["openings"] == gm[f"{lim}_openings"], f"{g} openings: {mc['openings']} (want {gm[lim + '_openings']}); lengths cm {mc['opening_lengths_cm']}")
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
                exc = EXCEPTIONS.get((r["name"], f"{g}_calibration"))
                worst = max((abs(v) for v in cal["residual_cm"].values()), default=0)
                check(cal["converged"], f"{g} calibration converged (residuals {cal['residual_cm']}) -- landmark matches are otherwise by construction",
                      known=exc if exc and worst <= exc["limit"] else None)
                if cal["ease_at_floor"]:
                    print(f"  info {g} ease at its floor for: {cal['ease_at_floor']} (real item smaller than body plus 3 mm; stretch is not modelled)")

    if "mesh_checks" in r:
        n = r["mesh_checks"]["tee_vs_trousers_intersecting_pairs"]
        check(n <= gm["tee_vs_trousers_intersecting_pairs_max"], f"tee-through-trousers intersecting face pairs: {n} (max {gm['tee_vs_trousers_intersecting_pairs_max']})")
        if "sweatshirt" in r["mesh_checks"]:
            n = r["mesh_checks"]["sweatshirt_vs_trousers_intersecting_pairs"]
            check(n <= gm["tee_vs_trousers_intersecting_pairs_max"], f"sweatshirt-through-trousers intersecting face pairs: {n} (max {gm['tee_vs_trousers_intersecting_pairs_max']})")
        for v in variants:
            n = r["mesh_checks"].get(f"{v}_vs_trousers_intersecting_pairs")
            check(n is not None and n <= gm["tee_vs_trousers_intersecting_pairs_max"], f"{v}-through-trousers intersecting face pairs: {n} (max {gm['tee_vs_trousers_intersecting_pairs_max']})")
        for top in (("tee", "sweatshirt") + variants) if shorts else ():
            if top not in r["mesh_checks"]:
                continue
            n = r["mesh_checks"].get(f"{top}_vs_shorts_intersecting_pairs")
            check(n is not None and n <= gm["tee_vs_trousers_intersecting_pairs_max"], f"{top}-through-shorts intersecting face pairs: {n} (max {gm['tee_vs_trousers_intersecting_pairs_max']})")
        if tights:  # V2-04: tights are worn under the shorts (never the trousers), and under every top
            if shorts:
                n = r["mesh_checks"].get("tights_vs_shorts_intersecting_pairs")
                check(n is not None and n <= gm["tee_vs_trousers_intersecting_pairs_max"], f"shorts-through-tights intersecting face pairs: {n} (max {gm['tee_vs_trousers_intersecting_pairs_max']})")
            for top in ("tee", "sweatshirt") + variants:
                if top not in r["mesh_checks"]:
                    continue
                n = r["mesh_checks"].get(f"{top}_vs_tights_intersecting_pairs")
                check(n is not None and n <= gm["tee_vs_trousers_intersecting_pairs_max"], f"{top}-through-tights intersecting face pairs: {n} (max {gm['tee_vs_trousers_intersecting_pairs_max']})")
        for top in ("tee", "sweatshirt") + variants:
            if top not in r["mesh_checks"]:
                continue
            sg = r["mesh_checks"][top]["shoulder_gap"]
            check(sg["worst_band_mean_cm"] is not None and sg["worst_band_mean_cm"] <= gm["tee_shoulder_gap_band_mean_max_cm"]
                  and sg["max_cm"] <= gm["tee_shoulder_gap_max_cm"],
                  f"{top} shoulder gap: worst band mean {sg['worst_band_mean_cm']} cm (max {gm['tee_shoulder_gap_band_mean_max_cm']}), "
                  f"max {sg['max_cm']} cm (max {gm['tee_shoulder_gap_max_cm']})",
                  known=(lambda e: e if e and sg["worst_band_mean_cm"] is not None and sg["worst_band_mean_cm"] <= e["limit"]
                         and sg["max_cm"] <= gm["tee_shoulder_gap_max_cm"] else None)(EXCEPTIONS.get((r["name"], f"{top}_shoulder_gap_band_mean"))))

    if (r.get("sex_base") == "female" and "--skirt" in sys.argv) or "skirt" in r:  # V3-01b
        mc, sk = r.get("mesh_checks", {}), r.get("skirt")
        if sk is None or "skirt" not in mc:
            check(False, "skirt missing from report (rebuild with python pack/build_pack.py)")
        else:
            s_ = mc["skirt"]
            check(s_["pieces"] == gm["skirt_pieces"], f"skirt pieces: {s_['pieces']} (want {gm['skirt_pieces']})")
            check(s_["openings"] == gm["skirt_openings"], f"skirt openings: {s_['openings']} (want {gm['skirt_openings']}); lengths cm {s_['opening_lengths_cm']}")
            check(s_["body_intersecting_pairs"] <= gm["body_intersecting_pairs_max"], f"skirt body-through-cloth intersecting face pairs: {s_['body_intersecting_pairs']} (max {gm['body_intersecting_pairs_max']}); by height cm {s_['body_intersections_by_z_cm']}")
            check(s_["self_intersecting_pairs"] <= gm["self_intersecting_pairs_max"], f"skirt self-intersecting face pairs: {s_['self_intersecting_pairs']} (max {gm['self_intersecting_pairs_max']}); by height cm {s_['self_intersections_by_z_cm']}")
            check(s_["clearance_to_body_cm"]["min"] >= gm["min_clearance_cm"], f"skirt minimum clearance to body: {s_['clearance_to_body_cm']['min']} cm (min {gm['min_clearance_cm']})")
            check(abs(sk["hem_lowest_vs_target_cm"]) <= tol["garment_landmark_cm"], f"skirt hem lowest point vs target: {sk['hem_lowest_vs_target_cm']:+.1f} cm (tol {tol['garment_landmark_cm']}); target {sk['landmarks_cm']['hem_target']} cm above the floor")
            check(sk["triangles"] <= 8000 and sk["glb_kb"] <= 150, f"skirt size: {sk['triangles']} triangles, {sk['glb_kb']} KB (max 8000 and 150, about the tee's weight)")
            if tights:
                n = mc.get("skirt_vs_tights_intersecting_pairs")
                check(n is not None and n <= gm["tee_vs_trousers_intersecting_pairs_max"], f"skirt-through-tights intersecting face pairs: {n} (max {gm['tee_vs_trousers_intersecting_pairs_max']})")
            for t in ("tee_tucked", "tee_v_tucked", "tee_scoop_tucked"):
                g_ = mc.get(t)
                if g_ is None:
                    check(False, f"{t} missing from report")
                    continue
                check(g_["pieces"] == gm["tee_pieces"] and g_["openings"] == gm["tee_openings"], f"{t} pieces/openings: {g_['pieces']}/{g_['openings']} (want {gm['tee_pieces']}/{gm['tee_openings']}); lengths cm {g_['opening_lengths_cm']}")
                check(g_["body_intersecting_pairs"] <= gm["body_intersecting_pairs_max"], f"{t} body-through-cloth intersecting face pairs: {g_['body_intersecting_pairs']} (max {gm['body_intersecting_pairs_max']}); by height cm {g_['body_intersections_by_z_cm']}")
                check(g_["self_intersecting_pairs"] <= gm["self_intersecting_pairs_max"], f"{t} self-intersecting face pairs: {g_['self_intersecting_pairs']} (max {gm['self_intersecting_pairs_max']})")
                check(g_["clearance_to_body_cm"]["min"] >= gm["min_clearance_cm"], f"{t} minimum clearance to body: {g_['clearance_to_body_cm']['min']} cm (min {gm['min_clearance_cm']})")
                check(g_["vs_skirt_intersecting_pairs"] <= gm["tee_vs_trousers_intersecting_pairs_max"], f"{t}-through-skirt intersecting face pairs: {g_['vs_skirt_intersecting_pairs']} (max {gm['tee_vs_trousers_intersecting_pairs_max']}); cut {g_['cut_height_cm']} cm above the floor, {g_['vertices_drawn_in']} vertices drawn in (largest {g_['largest_draw_in_cm']} cm)")
                if tights:
                    n = g_.get("vs_tights_intersecting_pairs")
                    check(n is not None and n <= gm["tee_vs_trousers_intersecting_pairs_max"], f"{t}-through-tights intersecting face pairs: {n} (max {gm['tee_vs_trousers_intersecting_pairs_max']})")
            print(f"  info untucked tee through skirt: {mc.get('tee_vs_skirt_intersecting_pairs_info')} face pairs (why tops are tucked)")


    if r.get("sex_base") == "female" and "bust_shape" in tol:  # V2-08
        bs = r.get("bust_shape") or {}
        for top in ("tee", "sweatshirt") + variants:
            if top not in r:
                continue
            if top not in bs:
                check(False, f"{top} bust shape missing from report (rebuild with the current body_from_measurements.py)")
                continue
            for side, m in zip(("right", "left"), bs[top]):
                vals = {k: m[k] for k in ("hollow_below_cm", "drop_up_cm", "drop_in_cm")}
                check(all(vals[k] <= tol["bust_shape"][k] for k in vals),
                      f"{top} bust shape, {side}: hollow below {vals['hollow_below_cm']} cm (max {tol['bust_shape']['hollow_below_cm']}), "
                      f"drop up {vals['drop_up_cm']} cm, drop in {vals['drop_in_cm']} cm (max {tol['bust_shape']['drop_up_cm']}, {tol['bust_shape']['drop_in_cm']}); "
                      f"drop out {m['drop_out_cm']} cm (information)")
        if bs.get("body_cup"):  # V2-09: the body's own bust, reported so a cup size is judged by a number; no limit is set
            bc = bs["body_cup"]
            print(f"  info body bust (V2-09): cup macro {bs.get('cupsize_macro')}, bust minus underbust {bc['bust_minus_underbust_cm']} cm "
                  f"(2.5 A, 5 B, 7.5 C), projection {bc['projection_cm'][0]} cm")

    for lbl, cg in (r.get("tee", {}).get("circ_vs_garment_cm") or {}).items():
        if cg.get("error") is None:
            print(f"  info tee circumference at {lbl} ({cg['height_cm']} cm): {cg['tee']} cm, no garment value (hem_circ_cm missing)")
        else:
            check(abs(cg["error"]) <= tol["garment_landmark_cm"], f"tee circumference at {lbl} ({cg['height_cm']} cm): tee {cg['tee']} expected {cg.get('expected', cg['garment'])} "
                  f"(garment {cg['garment']}, stretched over what it covers {cg.get('stretched')}; error {cg['error']:+.1f}, tol {tol['garment_landmark_cm']})")

    if need_garments:
        lm = r.get("garment_landmarks_vs_real", [])
        if not lm:
            check(False, "no garment landmark comparison in report")
        for m in lm:
            err = m["achieved"] - m["target"]
            check(abs(err) <= tol["garment_landmark_cm"], f"{m['garment']} {m['measure']}: real {m['target']} model {m['achieved']} (error {err:+.1f}, tol {tol['garment_landmark_cm']})")

print("FAILED" if failures else "ALL PASSED", f"({failures} failures)")
sys.exit(1 if failures else 0)
