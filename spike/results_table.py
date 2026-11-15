"""Print a markdown results table from the *_report.json files in one or more folders.

Usage: python spike/results_table.py <folder> [<folder> ...]
Errors are model minus target in cm; clipping is the ray-test percentage with fabric edges excluded (limit in tolerances.json).
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
        tc = r["tee"].get("clipping_ray", {}).get("fraction_excluding_edges")
        rc = r["trousers"].get("clipping_ray", {}).get("fraction_excluding_edges")
        rows.append([r["name"], e(body, "height_cm"), e(body, "inside_leg_cm"), e(body, "chest_cm"), e(body, "waist_cm"), e(body, "hips_cm"),
                     g("tee", "chest_circ_cm"), g("tee", "length_cm") if ("tee", "length_cm") in lm else g("tee", "worn_hem_height_cm"),
                     g("tee", "sleeve_cm"), g("tee", "neckline_width_cm"),
                     g("trousers", "waist_circ_cm"), g("trousers", "hip_circ_cm"), g("trousers", "rise_cm"), g("trousers", "inseam_cm"),
                     g("trousers", "leg_opening_circ_cm"),
                     "-" if tc is None else f"{tc*100:.2f}", "-" if rc is None else f"{rc*100:.2f}"])
head = ["body", "height", "inside leg", "chest", "waist", "hips", "tee chest", "tee length", "tee sleeve", "tee neck",
        "trs waist", "trs hip", "trs rise", "trs inseam", "trs opening", "tee clip %", "trs clip %"]
print("| " + " | ".join(head) + " |")
print("|" + "---|" * len(head))
for row in rows:
    print("| " + " | ".join(row) + " |")
print(f"\nTolerances: lengths {tol['length_cm']} cm, circumferences {tol['circumference_cm']} cm, garment landmarks {tol['garment_landmark_cm']} cm, clipping {tol['garment_clipping_max_fraction']*100:.2f}%.")
