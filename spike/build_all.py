"""Rebuild every synthetic body in spike/fixtures (with its garments file) into spike/out, then run check_reports.py.

Usage: python spike/build_all.py [--jobs N] [--private] [--drape]
  --private  also build J and B from private/ into private/out (local only, never committed)
  --drape    settle the tee with Blender cloth (task 5, drape.py) instead of keeping the offset shell
Blender is found from the BLENDER environment variable, else the default Windows install path for Blender 5.3.
Each build's log goes to <out>/<name>_build.log. Exit code is check_reports.py's.
"""
import os, sys, subprocess, pathlib
from concurrent.futures import ThreadPoolExecutor

root = pathlib.Path(__file__).resolve().parent.parent
blender = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe")
jobs = int(sys.argv[sys.argv.index("--jobs") + 1]) if "--jobs" in sys.argv else 3
script = root / "spike" / "blender" / "body_from_measurements.py"

builds = []  # (measurements, garments, out_dir, name)
for m in sorted((root / "spike" / "fixtures").glob("*.json")):
    if m.stem.endswith("_garments"):
        continue
    gar = m.with_name(m.stem + "_garments.json")
    builds.append((m, gar if gar.exists() else None, root / "spike" / "out", m.stem))
if "--private" in sys.argv:
    for person in ("joe", "b"):
        m = root / "private" / f"measurements_{person}.json"
        gar = root / "private" / f"garments_{person}.json"
        if m.exists():
            builds.append((m, gar if gar.exists() else None, root / "private" / "out", person))


def build(b):
    m, gar, out, name = b
    out.mkdir(parents=True, exist_ok=True)
    report = out / f"{name}_report.json"
    report.unlink(missing_ok=True)  # Blender exits 0 even when the script raises, so a missing report is the failure signal
    cmd = [blender, "--background", "--python", str(script), "--", str(m), str(out), name] + ([str(gar)] if gar else [])
    if "--drape" in sys.argv:
        cmd += ["--drape"]
        cmd[1:1] = ["--threads", "1"]  # the cloth solver differs by up to 2.9 cm between multi-threaded runs; 0.4 cm on one thread
    with open(out / f"{name}_build.log", "w") as log:
        rc = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, cwd=root).returncode
    if rc == 0 and not report.exists():
        rc = 1
    print(f"{name}: {'ok' if rc == 0 else 'FAILED, see ' + name + '_build.log'}", flush=True)
    return rc


with ThreadPoolExecutor(jobs) as ex:
    codes = list(ex.map(build, builds))
if any(codes):
    print("one or more builds failed; see the *_build.log files")
rc = 0
for out in sorted({b[2] for b in builds}):
    rc |= subprocess.run([sys.executable, str(root / "spike" / "check_reports.py"), str(out)]).returncode
sys.exit(rc or (1 if any(codes) else 0))
