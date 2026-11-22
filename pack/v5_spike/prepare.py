"""V5-00: turn pack/v5_spike/candidates.json into scratch garment templates and one job file per body. Plain Python, no Blender.

  python -I pack/v5_spike/prepare.py [--out private/v5_spike]

For every candidate: checks the zip against the sha256 in assets/packs/MANIFEST.md, takes the licence from the pack's own json, unpacks
just that item from the archived zip into <out>/extracted/<pack>/ (as build_pack.prepare_templates does for the real templates), and writes
a scratch template <out>/templates/<category>/<id>/meta.json that pack/fit_template.py accepts. Nothing under pack/templates/ is touched.

Settings every scratch template gets, chosen once and never tuned per item (the V3-06 shift-dress defaults): approved false (numbers are
reported, nothing is enforced), settle "none" (the MHCLO fit as it is), contact_groups ["all"], clearance_cm 0.2 (0.1 for hair, which sits
on the scalp), delete_group true for shoes only. Hats are tried alone and then over the body's best hair (see run.py).
Output: <out>/job_<body>.json (the templates for that body, and the packs dir), <out>/candidates_resolved.json.
"""
import hashlib, json, pathlib, re, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pack"))
import fit_template  # noqa: E402

ZIPS = ROOT / "assets" / "packs" / "zips"
MANIFEST = (ROOT / "assets" / "packs" / "MANIFEST.md").read_text(encoding="utf8")
LAYER = {"hair": "base", "shoes": "outer", "hats": "outer", "jewellery": "outer"}


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def template_id(c):
    return re.sub(r"[^a-z0-9_]+", "_", c["asset"].lower())


def zip_of(pack):
    return next(iter(sorted(ZIPS.glob(f"{pack}_*.zip"))))


def main():
    out = pathlib.Path(arg("--out", ROOT / "private" / "v5_spike")).resolve()
    cands = json.load(open(pathlib.Path(__file__).with_name("candidates.json")))["candidates"]
    packs = sorted({c["pack"] for c in cands if "pack" in c})
    for p in packs:  # the zip must be the archived one
        want = re.search(rf"\|\s*{p}\s*\|[^|]*\|\s*`([0-9a-f]{{64}})`", MANIFEST).group(1)
        got = hashlib.sha256(zip_of(p).read_bytes()).hexdigest()
        if want != got:
            sys.exit(f"{zip_of(p)} does not match the sha256 in MANIFEST.md")
    resolved, by_body = [], {}
    for c in cands:
        if "source_url" in c:  # not from a pack: prep_jewellery.py and pack/author_template.py have made the template
            tdir = out / "templates" / c["category"] / c["asset"]
            fit_template.load_meta(str(tdir))
            row = {**c, "id": c["asset"], "dir": str(tdir), "mhclo": str(tdir / "template.mhclo"), "mhclo_header_licence": None,
                   "mhclo_declares_delete_verts": False, "pack_json": None}
            resolved.append(row)
            for b in c["bodies"]:
                by_body.setdefault(b, []).append(row)
            continue
        zf = zipfile.ZipFile(zip_of(c["pack"]))
        pj = json.loads(zf.read(f"packs/{c['pack']}.json"))[c["asset"]]
        folder = "hair" if c["category"] == "hair" else "clothes"
        names = [n for n in zf.namelist() if n.startswith(f"{folder}/{c['asset']}/") and not n.endswith("/")]
        if not names:
            sys.exit(f"{c['asset']} is not in {c['pack']}")
        dest = out / "extracted" / c["pack"]
        for n in names:
            zf.extract(n, dest)
        mhclo = dest / folder / c["asset"] / f"{c['asset']}.mhclo"
        text = mhclo.read_text(encoding="utf8", errors="replace")
        lic = pj.get("license")
        author = pj.get("author")
        tid = template_id(c)
        meta = {"id": tid, "category": c["category"], "layer": LAYER[c["category"]], "allowed_bodies": "both",
                "source": {"pack": c["pack"], "asset": c["asset"]}, "licence": lic,
                "credit": None if lic == "CC0" else f"{author}, {c['asset']}, MakeHuman community assets ({c['pack']})",
                "sha256": hashlib.sha256(mhclo.read_bytes()).hexdigest(), "delete_group": c["category"] == "shoes",
                "settle": "none", "contact_groups": ["all"], "clearance_cm": 0.1 if c["category"] == "hair" else 0.2,
                "replaces": [], "inner_layers": [], "approved": False,
                "colour": "texture" if c["category"] in ("hair", "shoes") else "plain"}
        tdir = out / "templates" / c["category"] / tid
        tdir.mkdir(parents=True, exist_ok=True)
        json.dump(meta, open(tdir / "meta.json", "w"), indent=2)
        fit_template.load_meta(str(tdir))  # validate now, so a bad template fails here and not in Blender
        hdr = lambda k: (re.search(rf"^#\s*{k}\s+(.*)$", text, re.M) or [None, None])[1]  # the item's own header lines
        row = {**c, "id": tid, "licence": lic, "author": author, "mhclo_header_licence": (hdr("license") or "").strip() or None,
               "mhclo_header_author": (hdr("author") or "").strip() or None, "dir": str(tdir), "mhclo": str(mhclo),
               "mhclo_declares_delete_verts": bool(re.search(r"^delete_verts", text, re.M)), "pack_json": pj}
        resolved.append(row)
        for b in c["bodies"]:
            by_body.setdefault(b, []).append(row)
    for b, rows in by_body.items():
        json.dump({"templates": [r["dir"] for r in rows], "packs_dir": str(out / "extracted"), "colour_srgb": [200, 200, 200]},
                  open(out / f"job_{b}.json", "w"), indent=2)
    json.dump(resolved, open(out / "candidates_resolved.json", "w"), indent=2)
    print(f"{len(resolved)} candidates, {sum(len(v) for v in by_body.values())} fits ({', '.join(f'{b}: {len(v)}' for b, v in by_body.items())}) -> {out}")


if __name__ == "__main__":
    main()
