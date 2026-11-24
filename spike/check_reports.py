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

- the shirts (V3-03: shirt_short, shirt_mid, shirt_long), when the report has them, get exactly the tee's mesh limits, calibration and
  bust-shape limits too (they are checked like the other tops: against the trousers, shorts and tights), plus what makes them shirts and
  not tees: two collar points at least tolerances.json "shirt" collar_tip_drop_cm_min below the collar's top edge, and a raised placket of at
  least placket_height_cm_min over placket_vertices_min vertices. --shirts makes a missing one a failure. Since the second pass, also
  whether the exported shirt carries the collar and placket shading (COLOR_0, darkest at most detail_colour_min_max).
- every garment in the report's "shading" (mesh_checks.shading_look: tees, sweatshirt, shirts, trousers, shorts): the plain cloth's
  shading turns at most tolerances.json "shading" kink_deg_max within 1.5 cm, so it does not draw the navel and nipples like a wrap.

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

- pack items (V3-06: the dress, later shoes), on a female body, when the report has them: judged by "body as drawn" only, not by the strict
  garment_mesh limits (Joe, 16 Nov 2026): no face pairs between the body as drawn (the hidden parts removed) and the item, and no gap ray
  where the removed body would have been seen (tolerances.json "pack_item_body_as_drawn"). The item as the pack fits it, over the whole body, must have
  face pairs, or the check proves nothing; build_pack.py --no-hide builds without hiding or our fitting and fails it. --pack-items makes a missing dress a failure on a female body.
  V3-07: these are now garment templates (pack/fit_template.py). A template with "approved": false in its report (from its meta.json) is
  printed as REPORT-ONLY and does not fail; a template that did not build at all still fails. A template with inner_layers is also held
  to the V3-05 layer limits (tolerances.json "layers") over each of them.

- layers (V3-05), when the report has them: the sweatshirt and the three shirts built over the tee (sweatshirt_over_tee, shirt_short_over_tee,
  shirt_mid_over_tee, shirt_long_over_tee) are held to the tee's hard mesh limits, to the shading and bust-shape limits, and against the trousers,
  shorts and tights like any top, except that their shoulders may stand tolerances.json "layers" shoulder_gap_extra_cm further off the body (the
  tee is under them). They are not calibrated to a size of their own (they are the standalone garment's ease, pushed out by the tee), so the
  calibration record is not asked for. The layer check proper: against each tee it can be worn over (crew, V, scoop) there are no intersecting
  face pairs, and no tee vertex under the outer top is less than tolerances.json "layers" inner_clearance_cm_min inside it. --layers makes
  missing ones a failure.

Usage: python spike/check_reports.py <folder> [--no-garments] [--sweatshirt] [--necklines] [--shirts] [--layers] [--shorts] [--tights] [--skirt] [--pack-items]
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
SHIRTS = ("shirt_short", "shirt_mid", "shirt_long")  # V3-03
OVERS = ("sweatshirt_over_tee", "shirt_short_over_tee", "shirt_mid_over_tee", "shirt_long_over_tee")  # V3-05
_exc_path = pathlib.Path(__file__).with_name("known_exceptions.json")
EXCEPTIONS = {(e["body"], e["check"]): e for e in json.load(open(_exc_path))["exceptions"]} if _exc_path.exists() else {}


omitted = {}  # V3-05 (Joe, 17 Nov 2026): over-tee tops that failed a check, {top: {tee or None for all tees: [texts]}}; they are left out of the pack, not failed


def check(ok, text, known=None):
    """known: the matching entry from known_exceptions.json when the value is inside its limit."""
    global failures
    if not ok and known:
        print(f"  KNOWN {text} -- {known['reason']}")
        return
    top_ = next((o for o in OVERS if text.startswith(o + " ") or text.startswith(o + "-")), None)
    if top_ and not ok:  # a layered top that fails is not fixed, only left out of this body's pack (the layer check names the tee it was worn over)
        import re
        m_ = re.match(rf"{top_} over (\w+):", text)
        omitted.setdefault(top_, {}).setdefault(m_.group(1) if m_ else None, []).append(text)
        print(f"  OMIT {text}")
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
    shirts = tuple(g for g in SHIRTS if g in r or "--shirts" in sys.argv)  # V3-03: held to the tee's limits like the necklines, so they join `variants` below
    variants += shirts
    overs = tuple(g for g in OVERS if g in r or "--layers" in sys.argv)  # V3-05: held to the tee's limits too, with the shoulder allowance below
    variants += overs
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
        if need_garments and g not in overs:
            if cal is None:
                check(False, f"{g} has no calibration record (was a garment fixture supplied?)")
            else:
                exc = EXCEPTIONS.get((r["name"], f"{g}_calibration"))
                worst = max((abs(v) for v in cal["residual_cm"].values()), default=0)
                check(cal["converged"], f"{g} calibration converged (residuals {cal['residual_cm']}) -- landmark matches are otherwise by construction",
                      known=exc if exc and worst <= exc["limit"] else None)
                if cal["ease_at_floor"]:
                    print(f"  info {g} ease at its floor for: {cal['ease_at_floor']} (real item smaller than body plus 3 mm; stretch is not modelled)")

    for g in shirts + tuple(o for o in overs if o.startswith("shirt")):  # V3-03: what makes it a shirt and not a tee with a neckline
        d_ = (r.get(g) or {}).get("details")
        if d_ is None:
            check(False, f"{g} collar and placket record missing from report")
            continue
        st = tol["shirt"]
        check(d_["collar"]["points"] == 2 and d_["collar"]["tip_drop_cm"] >= st["collar_tip_drop_cm_min"],
              f"{g} collar: {d_['collar']['points']} points (want 2), the flap hangs {d_['collar']['tip_drop_cm']} cm below the band's top edge at the tips (min {st['collar_tip_drop_cm_min']}); band {d_['collar']['stand_cm']} cm high")
        check(d_["placket"]["height_cm"] >= st["placket_height_cm_min"] and d_["placket"]["vertices_raised"] >= st["placket_vertices_min"],
              f"{g} placket: raised {d_['placket']['height_cm']} cm (min {st['placket_height_cm_min']}) over {d_['placket']['vertices_raised']} vertices (min {st['placket_vertices_min']})")
        sh_ = (r.get("shading") or {}).get(g)  # second pass: cloth shading and the drawn collar and placket shading, read from the GLB
        if sh_ is None:
            check(False, f"{g} shading record missing from report")
            continue
        col_ = sh_["colour"]
        check(col_["present"] and col_["min"] <= st["detail_colour_min_max"],
              f"{g} collar and placket shading in the file (COLOR_0): present {col_['present']}, darkest {col_['min']} (at most {st['detail_colour_min_max']})")
    for g, sh_ in (r.get("shading") or {}).items():  # V3-03: every offset-shell garment's plain cloth, so none draws anatomy like a wrap
        check(sh_.get("kink_max_deg", 999) <= tol["shading"]["kink_deg_max"],
              f"{g} shading of the plain cloth: turns up to {sh_.get('kink_max_deg')} deg within {sh_['radius_cm']} cm at {sh_.get('kink_max_at_xyz_cm')} cm (max {tol['shading']['kink_deg_max']})")
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
            extra_ = tol["layers"]["shoulder_gap_extra_cm"] if top in OVERS else 0.0  # V3-05: a top over a tee stands the tee's thickness further off the shoulder
            check(sg["worst_band_mean_cm"] is not None and sg["worst_band_mean_cm"] <= gm["tee_shoulder_gap_band_mean_max_cm"] + extra_
                  and sg["max_cm"] <= gm["tee_shoulder_gap_max_cm"] + extra_,
                  f"{top} shoulder gap: worst band mean {sg['worst_band_mean_cm']} cm (max {round(gm['tee_shoulder_gap_band_mean_max_cm'] + extra_, 2)}), "
                  f"max {sg['max_cm']} cm (max {round(gm['tee_shoulder_gap_max_cm'] + extra_, 2)})",
                  known=(lambda e: e if e and sg["worst_band_mean_cm"] is not None and sg["worst_band_mean_cm"] <= e["limit"]
                         and sg["max_cm"] <= gm["tee_shoulder_gap_max_cm"] else None)(EXCEPTIONS.get((r["name"], f"{top}_shoulder_gap_band_mean"))))

    if overs:  # V3-05: the layer check, against each tee the top can be worn over
        lt, ly = tol["layers"], r.get("layers") or {}
        for o in overs:
            if o not in ly:
                check(False, f"{o} layer check missing from report (rebuild with python pack/build_pack.py)")
                continue
            for tee_, m_ in ly[o].items():
                c_ = m_["inner_inside_clearance_cm"]
                check(m_["intersecting_pairs"] <= lt["intersecting_pairs_max"], f"{o} over {tee_}: intersecting face pairs {m_['intersecting_pairs']} (max {lt['intersecting_pairs_max']})")
                check(c_["min"] is not None and c_["min"] >= lt["inner_clearance_cm_min"],
                      f"{o} over {tee_}: the tee is at least {c_['min']} cm inside it (min {lt['inner_clearance_cm_min']}); p05 {c_['p05']}, median {c_['median']}, "
                      f"{c_['vertices']} tee vertices tested, tightest at {c_['min_at_xyz_cm']} cm")
            ov_ = r.get(o, {})
            print(f"  info {o}: chest as worn {ov_.get('chest_circ_as_worn_cm')} cm, {ov_.get('chest_extra_from_tee_cm')} cm more than the same top alone")
        passing = {o: [t for t in ly.get(o, {}) if None not in omitted.get(o, {}) and t not in omitted.get(o, {})] for o in overs}
        if "--layers" in sys.argv:  # only the pack build asks for the list; a checked-in reports folder is not written to
            json.dump({"passing": {o: t for o, t in passing.items() if t}}, open(folder / f"{r['name']}_layers_pass.json", "w"), indent=2)
        for o in overs:
            print(f"  info {o} is offered over: {passing[o] or 'nothing (left out of the pack)'}")
        omitted.clear()

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

    if (r.get("sex_base") == "female" and "--pack-items" in sys.argv) or "pack_items" in r:  # V3-06
        pi, pt = r.get("pack_items", {}), tol["pack_item_body_as_drawn"]
        if not pi:
            check(False, "pack items missing from report (rebuild with python pack/build_pack.py)")
        for iid, p_ in pi.items():
            b_ = p_.get("body_as_drawn")
            if p_.get("status") != "ok" or b_ is None:  # a template that did not build has no numbers to report: always a failure
                check(False, f"pack item {iid}: {p_.get('status')}")
                continue
            # V3-07: a template Joe has not approved yet (meta.json "approved": false) is reported, not enforced. Reports from before
            # V3-07 have no "approved" and are enforced, as they were.
            ck = check
            if p_.get("approved") is False:
                ck = lambda ok, text, known=None: print(f"  REPORT-ONLY ({'pass' if ok else 'would fail'}; not approved) {text}")
            if p_.get("delete_group", True):
                ck(p_["hides_body"] and p_["body_vertices_hidden"] > 0, f"pack item {iid} hides the body: {p_['body_vertices_hidden']} body vertices removed (the pack's delete group, less {p_['body_vertices_restored_where_cloth_does_not_cover']} the cloth does not cover), after {p_['item_vertices_pushed_out_of_skin']} item vertices were pushed out of the skin (deepest {p_['deepest_push_cm']} cm), {p_['body_faces_trimmed_where_skin_pokes_through']} body faces still crossed the cloth and were removed")
                ck(0 < b_["body_faces_as_drawn"] < b_["body_faces_full"], f"pack item {iid} body as drawn has fewer faces than the whole body: {b_['body_faces_as_drawn']} of {b_['body_faces_full']} (more means helper geometry is showing)")
            ck(b_["visible_body_intersecting_pairs"] <= pt["visible_body_intersecting_pairs_max"],
               f"pack item {iid} body as drawn, intersecting face pairs: {b_['visible_body_intersecting_pairs']} (max {pt['visible_body_intersecting_pairs_max']}); by height cm {b_['visible_body_intersections_by_z_cm']}")
            ck(b_["gap_rays"] <= pt["gap_rays_max"],
               f"pack item {iid} body as drawn, gap rays: {b_['gap_rays']} of {b_['rays_on_body']} on the body (max {pt['gap_rays_max']}); by height cm {b_['gap_by_z_cm']}; worst view {b_['worst_view']}")
            if p_.get("delete_group", True):
                ck(p_["pairs_with_whole_body_as_shipped"] > pt["visible_body_intersecting_pairs_max"],
                   f"pack item {iid} check has teeth: the item as the pack fits it, over the whole body, has {p_['pairs_with_whole_body_as_shipped']} face pairs (must be over {pt['visible_body_intersecting_pairs_max']}); "
                   f"after our fitting, with no hiding: {b_['intersecting_pairs_with_hiding_off']} (information)")
            for inner_, lc in (p_.get("layers") or {}).items():  # V3-07: over each inner layer, as V3-05's layer check
                cl = lc["inner_inside_clearance_cm"]["min"]
                skip = inner_ in (p_.get("clearance_min_skipped") or [])  # the template says this inner layer shows below the item's hem (blazers over trousers)
                ck(lc["intersecting_pairs"] <= tol["layers"]["intersecting_pairs_max"] and (skip or cl is None or cl >= tol["layers"]["inner_clearance_cm_min"]),
                   f"pack item {iid} over {inner_}: {lc['intersecting_pairs']} intersecting face pairs (max {tol['layers']['intersecting_pairs_max']}), "
                   + (f"inside-clearance minimum not held ({cl} cm; skip_clearance_min in the template's meta.json)" if skip else
                      f"inner garment at least {cl} cm inside it (min {tol['layers']['inner_clearance_cm_min']})"))
            for inner_ in p_.get("inner_layers", []):
                if inner_ not in (p_.get("layers") or {}):
                    ck(False, f"pack item {iid} over {inner_}: layer check missing from report")
            print(f"  info pack item {iid}: {p_['triangles']} triangles, {p_['glb_kb']} KB item + {p_['body_glb_kb']} KB body-as-drawn, "
                  f"{p_['pieces']} piece(s), {p_['openings']} opening(s), {p_['info_self_intersecting_pairs']} self-intersecting pairs, "
                  f"min clearance to the full body {p_['info_clearance_to_full_body_cm']['min']} cm (all information; not the app's strict limits)")

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
