"""V3-00: build the cloth skirt on B and two synthetic female bodies, twice each, and compare the two builds.

  python spike/cloth/run_all.py [--out private/cloth_spike] [--jobs 3] [--only b,synthetic_female_small] [--runs 2]

Run 1 renders; later runs do not. Each run is a full rebuild (body and cloth) on one Blender thread. Output goes under
private/ by default because B's renders show a real body. Writes <out>/summary.json with the checks per body and the vertex
distance between run 1 and each later run (same topology, so vertex i is compared with vertex i).
Use the real Python, not the Microsoft Store alias (see spike/assets/README.md).
"""
import json, os, pathlib, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "pack"))
import build_pack  # noqa: E402  (default-fit garments, so the tee is the shipped one)
import fit  # noqa: E402

BLENDER = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe")


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


out = pathlib.Path(arg("--out", ROOT / "private" / "cloth_spike")).resolve()
runs = int(arg("--runs", 2))
only = arg("--only")
bodies = [("b", ROOT / "private" / "measurements_b.json"),
          ("synthetic_female_small", ROOT / "spike" / "fixtures" / "synthetic_female_small.json"),
          ("synthetic_female_large", ROOT / "spike" / "fixtures" / "synthetic_female_large.json")]
bodies = [(n, m) for n, m in bodies if m.exists() and (not only or n in only.split(","))]


def job(task):
    (n, meas), run = task
    folder = out / f"run{run}" / n
    folder.mkdir(parents=True, exist_ok=True)
    gar = folder / f"{n}_garments.json"
    json.dump(fit.default_garments(json.load(open(meas)), build_pack.person_cfg(n)), open(gar, "w"), indent=2)
    report = folder / f"{n}_skirt_report.json"
    report.unlink(missing_ok=True)  # Blender exits 0 when the script raises, so a missing report is the failure signal
    cmd = [BLENDER, "--threads", "1", "--background", "--python", str(HERE / "skirt_cloth.py"), "--", str(meas), str(gar),
           str(folder), n] + (["--no-render"] if run > 1 else [])
    with open(folder / f"{n}_skirt_build.log", "w") as log:
        rc = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT).returncode
    ok = rc == 0 and report.exists()
    print(f"{n} run {run}: {'done' if ok else 'FAILED, see ' + str(folder / (n + '_skirt_build.log'))}", flush=True)
    return ok


tasks = [(b, r) for r in range(1, runs + 1) for b in bodies]
with ThreadPoolExecutor(int(arg("--jobs", 3))) as ex:
    oks = list(ex.map(job, tasks))

summary = {}
for n, _ in bodies:
    r1 = out / "run1" / n
    if not (r1 / f"{n}_skirt_report.json").exists():
        continue
    rep = json.load(open(r1 / f"{n}_skirt_report.json"))
    s = {"build_s": rep["build_s"], "checks": rep["checks"], "landmarks_cm": rep["landmarks_cm"],
         "circumference_cm": rep["circumference_cm"], "start_shell": rep["start_shell"], "runs": {}}
    v1 = np.load(r1 / f"{n}_skirt_verts.npy")
    for r in range(2, runs + 1):
        rr = out / f"run{r}" / n
        if not (rr / f"{n}_skirt_verts.npy").exists():
            continue
        rep_r = json.load(open(rr / f"{n}_skirt_report.json"))
        d = np.linalg.norm(np.load(rr / f"{n}_skirt_verts.npy") - v1, axis=1) * 100
        s["runs"][f"run{r}"] = {"vs_run1_cm": {"median": round(float(np.median(d)), 3), "p95": round(float(np.percentile(d, 95)), 3),
                                               "max": round(float(d.max()), 3)},
                                "checks": {k: rep_r["checks"][k] for k in ("body_intersecting_pairs", "self_intersecting_pairs",
                                                                         "passes_hard_checks")},
                                "clearance_min_cm": rep_r["checks"]["clearance_to_body_cm"]["min"], "build_s": rep_r["build_s"]}
    summary[n] = s
json.dump(summary, open(out / "summary.json", "w"), indent=2)
for n, s in summary.items():
    c = s["checks"]
    print(f"{n}: body pairs {c['body_intersecting_pairs']}, self pairs {c['self_intersecting_pairs']}, "
          f"clearance min {c['clearance_to_body_cm']['min']} cm, pass {c['passes_hard_checks']}, cloth {s['build_s']['cloth']} s, "
          + ", ".join(f"{k} max {v['vs_run1_cm']['max']} cm" for k, v in s["runs"].items()))
sys.exit(0 if all(oks) else 1)
