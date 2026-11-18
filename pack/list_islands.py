"""V3-07c: lists the islands (separately connected pieces) of a pack item's mesh, so a person can choose which a template keeps.

  python pack/list_islands.py <pack> <asset>          for example: python pack/list_islands.py suits01 toigo_male_suit_3

Reads the item's .mhclo and .obj straight from the archived zip (assets/packs/zips/<pack>_*.zip, V2-09); nothing is unpacked and no
Blender is needed. Islands are numbered as meta.json "keep_islands" uses them (fit_template.islands: largest first). Heights and centroids
are in MakeHuman units (decimetres, y up, the feet near -8, the head near 8). Put the chosen indices in "keep_islands" and the total it
prints for them in "keep_islands_vertices".
"""
import argparse, pathlib, sys, zipfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fit_template import islands, read_obj  # noqa: E402

ZIPS = HERE.parent / "assets" / "packs" / "zips"


def item_obj(pack, asset, zips=ZIPS):
    """The text of the item's .obj, as named by the obj_file line of its .mhclo."""
    zpath = next(iter(sorted(zips.glob(f"{pack}_*.zip"))), None)
    if zpath is None:
        sys.exit(f"no {pack}_*.zip in {zips}; fetch it with python -I assets/packs/fetch_packs.py")
    with zipfile.ZipFile(zpath) as z:
        folder = next((f"{k}/{asset}/" for k in ("clothes", "hair") if f"{k}/{asset}/{asset}.mhclo" in z.namelist()), None)
        if folder is None:
            sys.exit(f"{asset} is not in {zpath.name}")
        mhclo = z.read(folder + asset + ".mhclo").decode("utf8", "replace")
        obj = next(l.split(None, 1)[1].strip() for l in mhclo.splitlines() if l.startswith("obj_file"))
        return z.read(folder + obj).decode("utf8", "replace")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("pack")
    ap.add_argument("asset")
    a = ap.parse_args()
    verts, faces = read_obj(item_obj(a.pack, a.asset))
    isl = islands(len(verts), faces)
    print(f"{a.asset}: {len(verts)} vertices, {len(faces)} faces, {len(isl)} islands (MakeHuman units, y up)")
    print(f"{'island':>6} {'vertices':>8} {'y from':>7} {'y to':>6}   centroid (x, y, z)")
    for k, g in enumerate(isl):
        ys = [verts[i][1] for i in g]
        c = [sum(verts[i][j] for i in g) / len(g) for j in range(3)]
        print(f"{k:>6} {len(g):>8} {min(ys):>7.2f} {max(ys):>6.2f}   ({c[0]:.2f}, {c[1]:.2f}, {c[2]:.2f})")


if __name__ == "__main__":
    main()
