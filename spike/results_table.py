"""Print a markdown results table from the *_report.json files in one or more folders.

Usage: python spike/results_table.py <folder> [<folder> ...]
Errors are model minus target in cm. Mesh columns come from the build's mesh checks (limits in tolerances.json "garment_mesh"):
pieces/openings, body-through-cloth face pairs, self-intersecting pairs, tee-through-trousers pairs, minimum clearance (cm).
"""
import json, sys, pathlib

tol = json.load(open(pathlib.Path(__file__).with_name("tolerances.json")))
rows = []
for folder in sys.argv[1:]:
    for f in sorted(pathlib.Path(folder).glob("*_report.json")):
        r = json.load(open(f))
        body = {m["measure"]: m for m in r["results"]}
        lm = {(m["garment"], m["measure"].split(" ")[0]): m for m in r.get("garment_landmarks_vs_real", [])}

        def e(d, k):
            m = d.get(k)
            return "-" if m is None else f"{m['error']:+.1f}"

        def g(garment, k):
            m = lm.get((garment, k))
            return "-" if m is None else f"{m['error']:+.1f}"
        mc = r.get("mesh_checks")

        def m(fn):
            return "-" if mc is None else fn(mc)
        rows.append([r["name"], e(body, "height_cm"), e(body, "inside_leg_cm"), e(body, "chest_cm"), e(body, "waist_cm"), e(body, "hips_cm"),
                     g("tee", "chest_circ_cm"), g("tee", "length_cm") if ("tee", "length_cm") in lm else g("tee", "worn_hem_height_cm"),
                     g("tee", "sleeve_cm"), g("tee", "neckline_width_cm"),
                     g("trousers", "waist_circ_cm"), g("trousers", "hip_circ_cm"), g("trousers", "rise_cm"), g("trousers", "inseam_cm"),
                     g("trousers", "leg_opening_circ_cm"),
                     m(lambda c: f"{c['tee']['pieces']}/{c['tee']['openings']}"), m(lambda c: f"{c['trousers']['pieces']}/{c['trousers']['openings']}"),
                     m(lambda c: f"{c['tee']['body_intersecting_pairs']}/{c['trousers']['body_intersecting_pairs']}"),
                     m(lambda c: f"{c['tee']['self_intersecting_pairs']}/{c['trousers']['self_intersecting_pairs']}"),
                     m(lambda c: str(c["tee_vs_trousers_intersecting_pairs"])),
                     m(lambda c: f"{c['tee']['clearance_to_body_cm']['min']}/{c['trousers']['clearance_to_body_cm']['min']}")])
head = ["body", "height", "inside leg", "chest", "waist", "hips", "tee chest", "tee length", "tee sleeve", "tee neck",
        "trs waist", "trs hip", "trs rise", "trs inseam", "trs opening",
        "tee pieces/openings", "trs pieces/openings", "body through tee/trs", "self tee/trs", "tee through trs", "min clearance tee/trs"]
print("| " + " | ".join(head) + " |")
print("|" + "---|" * len(head))
for row in rows:
    print("| " + " | ".join(row) + " |")
print(f"\nTolerances: lengths {tol['length_cm']} cm, circumferences {tol['circumference_cm']} cm, garment landmarks {tol['garment_landmark_cm']} cm, mesh {tol['garment_mesh']}.")
