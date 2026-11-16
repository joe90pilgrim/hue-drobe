"""V2-07: run fit_pack_items.py for Joe, B and one synthetic male and female body, in parallel.

  python spike/assets/run_all.py [--packs private/assetpacks] [--out private/assets_spike] [--jobs 4] [--only joe,b] [--no-render] [--item shirt]

Needs the six CC0 packs unzipped under <packs>/<pack>/x/ (see spike/assets/README.md). Joe and B are read from private/ and are
skipped if their measurements file is missing. Output goes to --out, which is under git-ignored private/ by default because the
renders show real bodies.
"""
import json, os, pathlib, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "pack"))
import build_pack  # noqa: E402  (only for the default-fit garments, so the app's tee and trousers match the shipped pack)
import fit  # noqa: E402

BLENDER = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe")


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


packs = pathlib.Path(arg("--packs", ROOT / "private" / "assetpacks")).resolve()
out = pathlib.Path(arg("--out", ROOT / "private" / "assets_spike")).resolve()
only = arg("--only")
bodies = [("joe", ROOT / "private" / "measurements_joe.json"), ("b", ROOT / "private" / "measurements_b.json"),
          ("synthetic_medium", ROOT / "spike" / "fixtures" / "synthetic_medium.json"),
          ("synthetic_female_medium", ROOT / "spike" / "fixtures" / "synthetic_female_medium.json")]
bodies = [(n, m) for n, m in bodies if m.exists() and (not only or n in only.split(","))]


def job(b):
    n, meas = b
    folder = out / n
    folder.mkdir(parents=True, exist_ok=True)
    gar = folder / f"{n}_garments.json"
    json.dump(fit.default_garments(json.load(open(meas)), build_pack.person_cfg(n)), open(gar, "w"), indent=2)
    report = folder / f"{n}_assets_report.json"
    report.unlink(missing_ok=True)
    cmd = [BLENDER, "--background", "--python", str(HERE / "fit_pack_items.py"), "--", str(meas), str(gar), str(folder), n,
           str(packs), str(HERE / "items.json")] + (["--no-render"] if "--no-render" in sys.argv else []) \
        + ([f"--only={arg('--item')}"] if arg("--item") else [])         + (["--control"] if n == "synthetic_medium" and "--no-control" not in sys.argv else [])
    with open(folder / f"{n}_assets_build.log", "w") as log:
        rc = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT).returncode
    ok = rc == 0 and report.exists()
    print(f"{n}: {'done' if ok else 'FAILED, see ' + str(folder / (n + '_assets_build.log'))}", flush=True)
    return 0 if ok else 1


with ThreadPoolExecutor(int(arg("--jobs", 4))) as ex:
    codes = list(ex.map(job, bodies))
sys.exit(1 if any(codes) else 0)
