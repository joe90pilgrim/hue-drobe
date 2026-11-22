"""V5-00: print the spike's tables as Markdown from the reports run.py wrote (private/v5_spike/out/<body>/...). Plain Python.

  python -I pack/v5_spike/summarise.py [--out private/v5_spike] > private/v5_spike/out/summary.md

Pass rule: the check the build enforces on a shipped pack item (spike/check_reports.py, spike/tolerances.json "pack_item_body_as_drawn"):
face pairs between the body as drawn and the item at most 0, gap rays at most 0. Self pairs and clearance are reported against the app's own
limits (self pairs 0, clearance 0.2 cm) but are information for pack items in the build, so they do not decide pass. A hat over hair also
needs 0 face pairs with the hair as drawn and the hair at least 0.2 cm inside it (the layer check). Hair has no limit of its own yet; the
hair check (hair vertices inside or within 2 mm of the skin, in the eye, face and ear regions) is reported beside the pack-item check.
Phone sizes: Pixel 8, 1080 x 2400 px. The stage is assumed 1080 x 1700 px (the screen less the app's bars; the app's .stage is flex), the
camera is app/src/viewer.ts's: vertical field of view 30 degrees, distance 5.2 m by default, closest zoom 2 m.
"""
import json, math, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
V5 = pathlib.Path(sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else ROOT / "private" / "v5_spike").resolve()
rows = {r["id"]: r for r in json.load(open(V5 / "candidates_resolved.json"))}
TOL = json.load(open(ROOT / "spike" / "tolerances.json"))
STAGE_H_PX = 1700


def load(body, folder, v5=True):
    d = V5 / "out" / body / folder
    if not (d / f"{body}_report.json").exists():
        return {}, {}
    rep = json.load(open(d / f"{body}_report.json")).get("pack_items", {})
    ext = json.load(open(d / f"{body}_v5.json")) if v5 and (d / f"{body}_v5.json").exists() else {}
    return rep, ext


def data(body):
    rep, ext = load(body, "stage1")
    r2, e2 = load(body, "stage1_necklace")
    rep.update(r2)
    ext.update(e2)
    best = json.load(open(V5 / "out" / body / "best_hair.json"))["best_hair"]
    hrep = {}  # hat id -> [(hair id, how it was picked, the pipeline's entry)]
    for d in sorted((V5 / "out" / body).glob("hats_over_*")):
        hair, how = (best, "fewest hair-check vertices") if d.name == "hats_over_hair" else (d.name[len("hats_over_"):], "chosen by eye: best look, or closest to the real hair")
        r_, _e = load(body, d.name, v5=False)
        for pf, R in r_.items():
            hrep.setdefault(pf.rsplit("_over_", 1)[0], []).append((hair, how, R))
    return rep, ext, hrep, None


def passes(R):
    b = (R or {}).get("body_as_drawn")
    return bool(R and R.get("status") == "ok" and b and b["visible_body_intersecting_pairs"] <= 0 and b["gap_rays"] <= 0)


BROWN = (60, 40, 28)  # a dark brown, for Joe's and B's own hair colour (Joe, 22 Nov 2026: both dark brown); same method as V2-07's tints


def _lin(c):
    c = [x / 255 for x in c]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def _srgb(l):
    return [min(max(12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055, 0), 1) for x in l]


def _lab(rgb01):
    l = [(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in rgb01]
    M = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]
    xyz = [sum(M[i][j] * l[j] for j in range(3)) / n for i, n in enumerate((0.95047, 1.0, 1.08883))]
    f = [x ** (1 / 3) if x > 216 / 24389 else (24389 / 27 * x + 16) / 116 for x in xyz]
    return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])]


def brown_de(mean_srgb):
    """dE76 from the dark brown picked, of the texture's mean colour tinted by it (the picker multiplies the texture by the colour)."""
    eff = _srgb([a * b for a, b in zip(_lin(BROWN), _lin(mean_srgb))])
    return round(math.dist(_lab(eff), _lab([x / 255 for x in BROWN])), 1)


def colour(E, hair=False):
    c = (E or {}).get("colour")
    if not c or "tinted" not in c:
        return "plain, no texture" if E else "n/a"
    t = c["tinted"]
    return (f"mean {c['mean_srgb_255']}; dE red {t['red_217_51_64']['delta_e76_from_picked']}, blue {t['blue_58_83_140']['delta_e76_from_picked']}"
            + (f", dark brown {brown_de(c['mean_srgb_255'])}" if hair else ""))


def line(tid, R, E, hat_over=None):
    r = rows[tid]
    if not R or R.get("status") != "ok":
        return f"| {tid} ({r.get('pack', 'OpenGameArt')}, {r['licence']}) | no: {(R or {}).get('status')} |" + " |" * 7
    b, w = R["body_as_drawn"], (E or {}).get("weight", {})
    cl = R["info_clearance_to_full_body_cm"]["min"]
    tex = f"{w.get('glb_kb_with_texture') or ('~' + str(w.get('glb_kb_with_texture_estimate')) if w.get('glb_kb_with_texture_estimate') else 'none')} / {w.get('glb_kb_plain_colour')}"
    ex = []
    e = E or {}
    if "with_app_garments" in e:
        g = e["with_app_garments"]
        ex.append(f"trousers pairs {g['pairs_with_app_trousers']}; drawn with trousers: pairs {g['body_as_drawn_with_trousers']['visible_body_intersecting_pairs']}, gaps {g['body_as_drawn_with_trousers']['gap_rays']}")
    if "hair_check_as_fitted" in e:
        h = e["hair_check_as_fitted"]
        ex.append(f"hair check as fitted: eye {h['eye']}, face {h['face']}, ear {h['ear']} (of {h['hair_vertices']} vertices); exported {e['hair_check_exported']['eye_face_ear']}")
    for hair, how, ho in (hat_over or []):
        l = next(iter((ho.get("layers") or {}).values()), None)
        ih = next(iter((ho.get("inner_hidden") or {}).values()), None)
        if l and ih:
            ex.append(f"over {hair} ({how}): hair pairs before hiding {ih['info_pairs_with_whole_inner']}, after {l['intersecting_pairs']}; "
                      f"{ih['faces_hidden']} hair faces hidden; layer check {'pass' if l['intersecting_pairs'] <= 0 and (l['inner_inside_clearance_cm']['min'] or 0) >= 0.2 else 'fails'}")
    return (f"| {tid} ({r.get('pack', 'OpenGameArt')}, {r['licence']}) | yes | {b['visible_body_intersecting_pairs']} / {b['gap_rays']} | "
            f"{R['pairs_with_whole_body_as_shipped']} | {R['info_self_intersecting_pairs']} / {cl} | {R['triangles']} tris; {tex} KB; texture {w.get('texture_file_kb')} KB | "
            f"{colour(E, r['category'] == 'hair')} | {'; '.join(ex)} | **{'PASS' if passes(R) else 'no'}** |")


HEAD = ("| Item (pack, licence) | Fits | Pairs as drawn / gap rays (0 / 0) | Pairs as the pack fits it | Self pairs / min clearance cm (0 / 0.2) | "
        "Weight (GLB KB texture / plain) | Colour | Extra | Check |\n" + "|" + " --- |" * 9)


def main():
    D = {b: data(b) for b in ("joe", "b")}
    out = ["# V5-00 spike tables (generated by pack/v5_spike/summarise.py)", ""]
    counts = {}
    for cat in ("shoes", "hair", "hats", "jewellery"):
        out += [f"## {cat}", ""]
        counts[cat] = {"both": [], "joe": [], "b": [], "neither": []}
        tried = {b: [t for t, r in rows.items() if r["category"] == cat and b in r["bodies"]] for b in D}
        for b, (rep, ext, hrep, hext) in D.items():
            out += [f"### {'Joe' if b == 'joe' else 'B'}", "", HEAD]
            for tid in tried[b]:
                hat = hrep.get(tid) if cat == "hats" else None
                out.append(line(tid, rep.get(tid), ext.get(tid), hat))
            out.append("")
        for tid in sorted({t for b in tried.values() for t in b}):
            where = [b for b in D if tid in tried[b]]
            ok = [b for b in where if passes(D[b][0].get(tid))]
            key = "both" if len(ok) == 2 else ok[0] if len(ok) == 1 else "neither"
            counts[cat][key].append(tid + ("" if len(where) == 2 else f" (tried on {where[0]} only)"))
    out += ["## Shared versus separate", "", "| Category | Pass on both | Pass on Joe only | Pass on B only | Pass on neither |", "| --- | --- | --- | --- | --- |"]
    for cat, c in counts.items():
        out.append(f"| {cat} | {len(c['both'])}: {', '.join(c['both'])} | {len(c['joe'])}: {', '.join(c['joe'])} | {len(c['b'])}: {', '.join(c['b'])} | {len(c['neither'])}: {', '.join(c['neither'])} |")
    out += ["", "## Jewellery: projected size on a Pixel 8", ""]
    out += ["| Body | Item | Width x depth x height (cm) | Default framing px (wide x high) | Closest zoom px (wide x high) |", "| --- | --- | --- | --- | --- |"]
    d_default, d_close = 5.2, 2.0
    for b, (rep, ext, _h, _hx) in D.items():
        for tid, r in rows.items():
            if r["category"] == "jewellery" and b in r["bodies"] and ext.get(tid, {}).get("extent"):
                e = ext[tid]["extent"]
                pm = [STAGE_H_PX / (2 * d * math.tan(math.radians(15))) for d in (d_default, d_close)]
                out.append(f"| {b} | {tid} | {e['width_cm']} x {e['depth_cm']} x {e['height_cm']} | " + " | ".join(
                    f"{e['width_cm'] / 100 * p:.0f} x {e['height_cm'] / 100 * p:.0f}" for p in pm) + " |")
    out += ["", "Reference items on the same screen: a 2 cm ring is "
            + " and ".join(f"{0.02 * STAGE_H_PX / (2 * d * math.tan(math.radians(15))):.0f} px" for d in (d_default, d_close))
            + " wide (default, closest); a 4 cm watch face "
            + " and ".join(f"{0.04 * STAGE_H_PX / (2 * d * math.tan(math.radians(15))):.0f} px" for d in (d_default, d_close)) + "."]
    print("\n".join(out))


if __name__ == "__main__":
    main()
