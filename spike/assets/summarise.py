"""V2-07: print the measured tables from the per-body reports as Markdown.

  python spike/assets/summarise.py [private/assets_spike]

Reads <dir>/<body>/<body>_assets_report.json. Prints one table per point of the ticket (fit, checks, weight, colour, licence),
one row per item and body. Limits are read from spike/tolerances.json (garment_mesh), so the pass/fail marks follow the same file the app's own
garments are held to.
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
TOL = json.load(open(ROOT / "spike" / "tolerances.json"))["garment_mesh"]
folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "private" / "assets_spike")
ORDER = ["joe", "b", "synthetic_medium", "synthetic_female_medium"]
LABEL = {"joe": "Joe", "b": "Beth", "synthetic_medium": "Synth male", "synthetic_female_medium": "Synth female"}
reports = {}
for n in ORDER:
    p = folder / n / f"{n}_assets_report.json"
    if p.exists():
        reports[n] = json.load(open(p))
ids = []
for r in reports.values():
    for i in r["items"]:
        if i not in ids:
            ids.append(i)


def rows():
    for i in ids:
        for n, r in reports.items():
            if i in r["items"]:
                yield i, n, r["items"][i]


def mark(ok):
    return "pass" if ok else "FAIL"


print("## Fit and hard checks (limits: body pairs %d, self pairs %d, clearance at least %.1f cm)\n" % (
    TOL["body_intersecting_pairs_max"], TOL["self_intersecting_pairs_max"], TOL["min_clearance_cm"]))
print("| Item | Asset | Body | Loads, no manual work | Body pairs | Body pairs, MPFB-hidden body | Self pairs | Min clearance (cm) | Pieces | Openings | With app tee / trousers (pairs) |")
print("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
for i, n, it in rows():
    if it["status"] != "ok":
        print(f"| {i} | {it['asset']} | {LABEL[n]} | {it['status']} | | | | | | | |")
        continue
    c, m = it["checks_glb"], it["checks_in_memory"]
    print(f"| {i} | {it['asset']} | {LABEL[n]} | yes | {c['body_intersecting_pairs']} ({mark(c['body_intersecting_pairs'] <= TOL['body_intersecting_pairs_max'])}) "
          f"| {m['body_pairs_hidden_body']} (hides {it['hides_body']['body_vertices_hidden']} verts) | {c['self_intersecting_pairs']} ({mark(c['self_intersecting_pairs'] <= TOL['self_intersecting_pairs_max'])}) "
          f"| {c['clearance_to_body_cm']['min']} ({mark(c['clearance_to_body_cm']['min'] >= TOL['min_clearance_cm'])}) | {c['pieces']} | {c['openings']} "
          f"| {c['pairs_with_app_tee']} / {c['pairs_with_app_trousers']} |")

print("\n## Phone weight (limit: pack under %d MB, 30 fps; the app's own tee and trousers for scale)\n" % 15)
print("| Item | Asset | Body | Triangles | GLB KB with texture | GLB KB plain colour | Texture (px, KB) |")
print("| --- | --- | --- | --- | --- | --- | --- |")
for i, n, it in rows():
    if it["status"] != "ok":
        continue
    t = it["material"]["texture"]
    ts = f"{t['size_px'][0]}x{t['size_px'][1]}, {t['file_kb']}" if isinstance(t, dict) else "none"
    print(f"| {i} | {it['asset']} | {LABEL[n]} | {it['checks_glb']['triangles']} | {it['glb_kb_with_texture']} | {it['glb_kb_plain_colour']} | {ts} |")
for n, r in reports.items():
    a = r["app_garments"]
    print(f"\nApp's own, {LABEL[n]}: tee {a['tee']['triangles']} triangles {a['tee']['glb_kb']} KB; trousers {a['trousers']['triangles']} triangles {a['trousers']['glb_kb']} KB; body {a['body']['triangles']} triangles {a['body']['glb_kb']} KB.")

print("\n## Colour: a plain colour-picker tint (glTF base colour multiplies the texture)\n")
print("| Item | Asset | Texture mean sRGB | Pattern contrast (CV) | Tint red 217,51,64 gives | Delta E | Tint blue 58,83,140 gives | Delta E | Other maps |")
print("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
seen = set()
for i, n, it in rows():
    if it["status"] != "ok" or (i, it["asset"]) in seen:
        continue
    seen.add((i, it["asset"]))
    t = it["material"]["texture"]
    if not isinstance(t, dict) or "mean_srgb_255" not in t:
        print(f"| {i} | {it['asset']} | none | | | | | | {it['material']['other_textures']} |")
        continue
    a, b = t["tinted"]["red_217_51_64"], t["tinted"]["blue_58_83_140"]
    print(f"| {i} | {it['asset']} | {t['mean_srgb_255']} | {t['luminance_cv']} | {a['effective_mean_srgb_255']} | {a['delta_e76_from_picked']} | {b['effective_mean_srgb_255']} | {b['delta_e76_from_picked']} | {it['material']['other_textures']}, transparent={it['material']['transparent']} |")

print("\n## Licence\n")
print("| Item | Asset | Pack | mhclo header | Pack json | Author |")
print("| --- | --- | --- | --- | --- | --- |")
seen = set()
for i, n, it in rows():
    if it["status"] != "ok" or (i, it["asset"]) in seen:
        continue
    seen.add((i, it["asset"]))
    L = it["licence"]
    print(f"| {i} | {it['asset']} | {it['category']} | {L['mhclo_header']} | {L['pack_json']} | {L['author']} |")

print("\n## Garment extent above the floor (cm), for hem and sleeve judgement\n")
print("| Item | Body | Item z (cm) | Item x (cm) | App tee z | App trousers z |")
print("| --- | --- | --- | --- | --- | --- |")
for i, n, it in rows():
    if it["status"] != "ok":
        continue
    c, a = it["checks_glb"], reports[n]["app_garments"]
    print(f"| {i} | {LABEL[n]} | {c['z_above_floor_cm']} | {c['x_cm']} | {a['tee']['z_above_floor_cm']} | {a['trousers']['z_above_floor_cm']} |")

ctrl = reports.get("synthetic_medium", {}).get("control_default_body")
if ctrl and "error" not in ctrl:
    print("\n## Control: the same male-variant items on MPFB's own default body (no targets from us), full body, same method as the 'Body pairs, MPFB-hidden body' column\n")
    print("| Item | Asset | Default body: body pairs | self pairs | min clearance (cm) | Synthetic male (our body): body pairs, same in-memory method |")
    print("| --- | --- | --- | --- | --- | --- |")
    r = reports["synthetic_medium"]
    for i in ids:
        c = ctrl.get(i)
        it = r["items"].get(i)
        if c and it and "error" not in c and it["status"] == "ok":
            print(f"| {i} | {it['asset']} | {c['body_pairs_full_body']} | {c['self_pairs']} | {c['clearance_to_body_cm_min']} | {it['checks_in_memory']['body_pairs_full_body']} |")
