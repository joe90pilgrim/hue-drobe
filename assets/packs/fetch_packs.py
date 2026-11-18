"""Download, verify and (optionally) upload the CC0 MakeHuman asset packs (V2-09).

Usage (use the real Python, not the Microsoft Store alias):
    python -I assets/packs/fetch_packs.py            # download missing zips, CRC-test, hash
    python -I assets/packs/fetch_packs.py --check    # verify existing zips only, no download
    python -I assets/packs/fetch_packs.py --upload gs://BUCKET/asset-packs   # also copy to GCS

Zips go in assets/packs/zips/ (git-ignored). Each is downloaded whole from
files.makehumancommunity.org (never the slow files2 mirror, never resumed).
Prints a results table and writes assets/packs/zips/results.json.
"""
import hashlib
import json
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ZIPS = HERE / "zips"
URL = "https://files.makehumancommunity.org/asset_packs/{p}/{p}_{l}.zip"  # l is cc0 or ccby

# sha256 prefixes recorded by the V2-07 spike (None = not in the spike).
PACKS = {
    "shirts01": "a5a723b0",
    "pants01": "e4e0ec60",
    "skirts01": "293fa0c1",
    "dress01": "f49ba54a",
    "shoes01": "ded3f704",
    "hair01": "49445d69",
    "hats01": None,
    "underwear01": None,
    "suits01": None,
    "shirts02": None,  # CC-BY (V3-07a)
    "shirts03": None,  # CC-BY (V3-07a)
}
CCBY = {"shirts02", "shirts03"}


def download(pack, dest):  # noqa
    tmp = dest.with_suffix(".part")
    with urllib.request.urlopen(URL.format(p=pack, l='ccby' if pack in CCBY else 'cc0'), timeout=60) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    tmp.replace(dest)


def licence(zf, pack):
    name = next((n for n in zf.namelist() if n.endswith(f"packs/{pack}.json")), None)
    if not name:
        return "no pack json"
    data = json.loads(zf.read(name))
    # The pack json maps item name -> {"license": ...}; report the set of licences.
    return ",".join(sorted({str(v.get("license", "not stated")) for v in data.values()})) + f" ({len(data)} items)"


def main():
    args = sys.argv[1:]
    check = "--check" in args
    upload = args[args.index("--upload") + 1] if "--upload" in args else None
    ZIPS.mkdir(exist_ok=True)
    rows, ok = [], True
    for pack, prefix in PACKS.items():
        path = ZIPS / f"{pack}_{'ccby' if pack in CCBY else 'cc0'}.zip"
        if not path.exists():
            if check:
                rows.append((pack, "missing", "", "FAIL", "", ""))
                ok = False
                continue
            download(pack, path)
        with zipfile.ZipFile(path) as zf:
            bad = zf.testzip()
            lic = licence(zf, pack)
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        crc = "pass" if bad is None else f"FAIL ({bad})"
        match = "n/a" if prefix is None else ("match" if sha.startswith(prefix) else "MISMATCH")
        if bad is not None or match == "MISMATCH":
            ok = False
        rows.append((pack, path.stat().st_size, sha, crc, match, lic))
    print("pack | bytes | sha256 | CRC | spike prefix | licence")
    for r in rows:
        print(" | ".join(str(x) for x in r))
    (ZIPS / "results.json").write_text(json.dumps(
        [dict(zip(("pack", "bytes", "sha256", "crc", "spike_prefix", "licence"), r)) for r in rows], indent=2))
    if upload and ok:
        subprocess.run(["gcloud", "storage", "cp", *map(str, ZIPS.glob("*.zip")), upload.rstrip("/") + "/"], check=True, shell=sys.platform == "win32")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
