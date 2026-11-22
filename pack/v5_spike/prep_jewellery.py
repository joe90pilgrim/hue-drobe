"""V5-00: prepare the one non-MakeHuman item converted in the spike, the CC0 'Necklace' by Paul Wortmann (OpenGameArt).

  python -I pack/v5_spike/prep_jewellery.py

Reads private/v5_spike/jewellery_src/necklace/necklace_1/obj_export/necklace_1_001.obj (necklace_1.zip from
https://opengameart.org/content/necklace, CC0, no credit needed), turns it 90 degrees about the vertical (a rigid rotation of the whole
mesh, so the pendant faces front; nothing is reshaped), and writes it with pack/v5_spike/jewellery/necklace_wortmann/meta.json into
private/v5_spike/templates/jewellery/necklace_wortmann/. Then run MakeClothes on it (pack/author_template.py, see run.py author)."""
import hashlib, json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
V5 = HERE.parents[1] / "private" / "v5_spike"
src = V5 / "jewellery_src" / "necklace" / "necklace_1" / "obj_export" / "necklace_1_001.obj"
dest = V5 / "templates" / "jewellery" / "necklace_wortmann"
dest.mkdir(parents=True, exist_ok=True)
out = []
for line in src.read_text().splitlines():
    w = line.split()
    if w and w[0] in ("v", "vn"):  # OBJ is Y-up: (x, z) -> (-z, x) carries the pendant from +x to +z, which is the body's front after import
        x, y, z = map(float, w[1:4])
        line = f"{w[0]} {-z:.6f} {y:.6f} {x:.6f}"
    out.append(line)
(dest / "source.obj").write_text("\n".join(out) + "\n")
meta = json.load(open(HERE / "jewellery" / "necklace_wortmann" / "meta.json"))
meta["sha256"] = hashlib.sha256((dest / "source.obj").read_bytes()).hexdigest()
json.dump(meta, open(dest / "meta.json", "w"), indent=2)
print("wrote", dest)
