"""Build the avatar pack: bodies plus default-fit garments, checked against the spike's tolerances.

Usage: python pack/build_pack.py [--private] [--only NAME] [--jobs N]
  (no flag)  build the synthetic bodies in spike/fixtures into pack/out and check them. Nothing is packed.
  --private  also build Joe from private/measurements_joe.json into private/pack, check him, and write his pack
             (private/pack/joe/: body.glb, tee.glb, trousers.glb, manifest.json). The pack is written only if every check passes.
  --only     build just one body (a fixture name such as synthetic_medium, or 'joe'); use this to try a change on one body first
  --jobs     bodies built at the same time (default 3)
Blender is found from the BLENDER environment variable, else the default Windows install path for Blender 5.3.
Garment sizes come from pack/fit_config.json and the body's own measurements (pack/fit.py). Exit code 0 only if every build and check passed.
"""
import datetime, hashlib, json, os, pathlib, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import fit  # noqa: E402

BLENDER = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe")
SCRIPT = ROOT / "spike" / "blender" / "body_from_measurements.py"
CHECKER = ROOT / "spike" / "check_reports.py"
TOLERANCES = json.load(open(ROOT / "spike" / "tolerances.json"))
CFG = json.load(open(HERE / "fit_config.json"))
PACK_FILES = {"body": "{n}.glb", "tee": "{n}_tee.glb", "trousers": "{n}_trousers.glb"}


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def mpfb_visible():
    """True if a Blender started from this process can import MPFB. When this script is started through the Microsoft Store
    'python' alias, Windows hides Blender's add-on folder (%APPDATA%) from every child process, so MPFB cannot be found.
    Found 15 Nov 2026: the same script run with the interpreter's full path finds it."""
    code = "import importlib.util;print('MPFB_VISIBLE', importlib.util.find_spec('bl_ext.user_default.mpfb') is not None)"
    out = subprocess.run([BLENDER, "--background", "--python-expr", code], capture_output=True, text=True).stdout
    return "MPFB_VISIBLE True" in out


def ensure_mpfb():
    """Pre-flight. Returns an exit code to stop with, or None to carry on."""
    if mpfb_visible():
        return None
    print("Blender cannot import MPFB from here, so no body can be built.\n"
          "If MPFB is installed, the likely cause is the Microsoft Store 'python' alias, which hides Blender's add-on folder from\n"
          "everything it starts. Run this script with the interpreter's full path instead:\n"
          f'  & "{sys.executable}" pack/build_pack.py {" ".join(sys.argv[1:])}\n'
          "Otherwise install MPFB 2.0.18 into Blender 5.3 (see spike/README.md) and check BLENDER points at Blender 5.3.")
    return 1


def build(job):
    """job: (measurements path, out dir, name). Writes the default-fit garments file, runs Blender, returns 0 on success."""
    meas, out, name = job
    out.mkdir(parents=True, exist_ok=True)
    gar = out / f"{name}_garments.json"
    json.dump(fit.default_garments(json.load(open(meas)), CFG), open(gar, "w"), indent=2)
    report = out / f"{name}_report.json"
    report.unlink(missing_ok=True)  # Blender exits 0 even when the script raises, so a missing report is the failure signal
    cmd = [BLENDER, "--background", "--python", str(SCRIPT), "--", str(meas), str(out), name, str(gar)]
    with open(out / f"{name}_build.log", "w") as log:
        rc = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT).returncode
    if rc == 0 and not report.exists():
        rc = 1
    print(f"{name}: {'built' if rc == 0 else 'BUILD FAILED, see ' + str(out / (name + '_build.log'))}", flush=True)
    return rc


def check(folder):
    """Run the spike's checks on every report in the folder. 0 means every tolerance was met."""
    print(f"\nChecks on {folder}", flush=True)
    return subprocess.run([sys.executable, str(CHECKER), str(folder)]).returncode


def blender_version():
    first = subprocess.run([BLENDER, "--version"], capture_output=True, text=True).stdout.splitlines()
    return first[0].strip() if first else "unknown"


def write_pack(name, build_dir, pack_dir):
    """Copy the checked GLBs to a stable layout and write the manifest. Fails if the pack is over the phone download limit."""
    if pack_dir.exists():
        shutil.rmtree(pack_dir)
    pack_dir.mkdir(parents=True)
    files = {}
    for key, pattern in PACK_FILES.items():
        src = build_dir / pattern.format(n=name)
        dst = pack_dir / f"{key}.glb"
        shutil.copyfile(src, dst)
        files[dst.name] = {"bytes": dst.stat().st_size, "sha256": hashlib.sha256(dst.read_bytes()).hexdigest()}
    total = sum(f["bytes"] for f in files.values())
    manifest = {
        "pack_version": 1,
        "built_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "blender": blender_version(),
        "files": files,
        "total_bytes": total,
        "garments": {"tee": {"fit": "regular"}, "trousers": {"fit": "regular"}},
        "garment_colour_srgb": CFG["colour_srgb"],
        "fit_config": CFG,
        "checks": "all passed (spike/check_reports.py)",
    }
    json.dump(manifest, open(pack_dir / "manifest.json", "w"), indent=2)
    limit = TOLERANCES["phone_max_load_mb"] * 1024 * 1024
    print(f"\nPack for {name}: {total / 1024:.0f} KB in {pack_dir} (limit {TOLERANCES['phone_max_load_mb']} MB)")
    if total > limit:
        print("FAIL pack is over the phone download limit")
        return 1
    return 0


def main():
    only, jobs = arg("--only"), int(arg("--jobs", 3))
    synthetic = [(m, ROOT / "pack" / "out", m.stem) for m in sorted((ROOT / "spike" / "fixtures").glob("*.json"))
                 if not m.stem.endswith("_garments")]
    joe = (ROOT / "private" / "measurements_joe.json", ROOT / "private" / "pack" / "build", "joe")
    if "--private" in sys.argv and not joe[0].exists():
        print(f"--private given but {joe[0]} does not exist")
        return 1
    groups = [synthetic] + ([[joe]] if "--private" in sys.argv else [])
    if only:
        groups = [[j for j in g if j[2] == only] for g in groups]
        if not any(groups):
            print(f"no body called {only!r} (with --private, 'joe' is available)")
            return 1
    jobs_all = [j for g in groups for j in g]
    stop = ensure_mpfb()
    if stop is not None:
        return stop
    # a stale body from an earlier run would be checked as if it were part of this one
    for folder in {j[1] for j in jobs_all}:
        for old in folder.glob("*_report.json") if folder.exists() else []:
            old.unlink()
    with ThreadPoolExecutor(jobs) as ex:
        codes = list(ex.map(build, jobs_all))
    rc = 1 if any(codes) else 0
    if rc:
        print("one or more builds failed; see the *_build.log files")
        return rc
    for folder in sorted({j[1] for j in jobs_all}):
        rc |= check(folder)
    if rc:
        print("\nChecks failed: no pack written")
        return rc
    if any(j[2] == "joe" for j in jobs_all):
        rc |= write_pack("joe", joe[1], ROOT / "private" / "pack" / "joe")
    print("\nPACK BUILD " + ("FAILED" if rc else "OK"))
    return rc


if __name__ == "__main__":
    sys.exit(main())
