"""Build the avatar pack: bodies plus default-fit garments, checked against the spike's tolerances.

Usage: python pack/build_pack.py [--private] [--only NAME] [--jobs N] [--config FILE] [--reports-to DIR]
  (no flag)  build the synthetic bodies in spike/fixtures into pack/out and check them. Nothing is packed.
  --private  also build J and B from private/measurements_<person>.json (joe, b) into private/pack, check them, and write each pack
             (private/pack/<person>/: body.glb, tee.glb, tee_v.glb, tee_scoop.glb, trousers.glb, shorts.glb, tights.glb, sweatshirt.glb, manifest.json;
             a woman's pack also has skirt.glb and tee_tucked.glb, tee_v_tucked.glb, tee_scoop_tucked.glb, V3-01b).
             A pack is written only if every check passes. A person whose file is missing is skipped. A measurements file with
             "body_only": true is built, checked and packed as a body alone (body.glb and manifest.json).
  --only     build just one body (a fixture name such as synthetic_medium, or a person: 'joe' or 'b'); use this to try a change on one body first
  --jobs     bodies built at the same time (default 3). A woman's body also drapes the skirt (cloth, one thread) and takes about 2 minutes.
  --renders  also render the skirt views (front, side, back) for the synthetic women; the private bodies always render, into <out>/renders
  --config   fit config to use instead of pack/fit_config.json, to try a fit without editing the committed file
  --reports-to  after every check passes, copy the synthetic bodies' reports to DIR (use pack/reports to refresh the ones `npm run check`
             validates). Each report is stamped with the SHA-256 of the fit config it was built from.
Blender is found from the BLENDER environment variable, else the default Windows install path for Blender 5.3.
Garment sizes come from pack/fit_config.json and the body's own measurements (pack/fit.py). J and B each also get their own
overrides from pack/fit_people.json laid over it (V2-03); the synthetic bodies never do. Exit code 0 only if every build and check passed.
"""
import datetime, hashlib, json, os, pathlib, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import fit  # noqa: E402

BLENDER = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe")
SCRIPT = ROOT / "spike" / "blender" / "body_from_measurements.py"
SKIRT_SCRIPT = ROOT / "spike" / "cloth" / "skirt_cloth.py"  # V3-01b: runs SCRIPT itself, then drapes and checks the skirt and tucks the tops
CHECKER = ROOT / "spike" / "check_reports.py"
TOLERANCES = json.load(open(ROOT / "spike" / "tolerances.json"))
DEFAULT_CONFIG = HERE / "fit_config.json"
CFG = json.load(open(DEFAULT_CONFIG))  # replaced in main() when --config is given
PEOPLE_FIT = json.load(open(HERE / "fit_people.json"))  # V2-03: per-person overrides laid over CFG for J and B only
PEOPLE = ["joe", "b"]  # private bodies: J and B. A person is built when private/measurements_<person>.json exists.
PACK_FILES = {"body": "{n}.glb", "tee": "{n}_tee.glb", "trousers": "{n}_trousers.glb", "sweatshirt": "{n}_sweatshirt.glb",
              "tee_v": "{n}_tee_v.glb", "tee_scoop": "{n}_tee_scoop.glb", "shorts": "{n}_shorts.glb",
              "tights": "{n}_tights.glb",
              # V3-01b, women's bodies only: the skirt, and the three tees cut at its waistband (Joe: tops are tucked in)
              "skirt": "{n}_skirt.glb", "tee_tucked": "{n}_tee_tucked.glb", "tee_v_tucked": "{n}_tee_v_tucked.glb",
              "tee_scoop_tucked": "{n}_tee_scoop_tucked.glb"}
WOMENS_ONLY = ("skirt", "tee_tucked", "tee_v_tucked", "tee_scoop_tucked")


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


def person_cfg(name):
    """The fit a body is built with: the shared config, plus the person's overrides from fit_people.json (synthetic bodies have none)."""
    return fit.merge(CFG, PEOPLE_FIT.get(name, {})) if name in PEOPLE else CFG


def is_body_only(meas):
    """True if the measurements file asks for the body alone (V2-02: B's garments are fitted in V2-03)."""
    return bool(json.load(open(meas)).get("body_only", False))


def has_skirt(meas):
    """True if the skirt is built for this body: a woman's, and not body-only (V3-01b)."""
    m = json.load(open(meas))
    return m.get("sex_base") == "female" and not m.get("body_only", False)


def build(job):
    """job: (measurements path, out dir, name). Writes the default-fit garments file, runs Blender, returns 0 on success."""
    meas, out, name = job
    out.mkdir(parents=True, exist_ok=True)
    gar = out / f"{name}_garments.json"
    gar.unlink(missing_ok=True)
    if is_body_only(meas):  # the generator then uses its own throwaway garments, which the checker skips and the pack leaves out
        gar = None
    else:
        json.dump(fit.default_garments(json.load(open(meas)), person_cfg(name)), open(gar, "w"), indent=2)
    report = out / f"{name}_report.json"
    report.unlink(missing_ok=True)  # Blender exits 0 even when the script raises, so a missing report is the failure signal
    cmd = [BLENDER, "--background", "--python", str(SCRIPT), "--", str(meas), str(out), name] + ([str(gar)] if gar else [])
    if gar and has_skirt(meas):  # V3-01b: one Blender session on one thread (the cloth is then identical build to build) does the body, the skirt and the tucked tops
        skirt_cfg = out / f"{name}_skirt_cfg.json"
        json.dump(person_cfg(name)["skirt"], open(skirt_cfg, "w"), indent=2)
        cmd = [BLENDER, "--threads", "1", "--background", "--python", str(SKIRT_SCRIPT), "--", str(meas), str(gar), str(out), name,
               "--cfg", str(skirt_cfg)] + ([] if name in PEOPLE or "--renders" in sys.argv else ["--no-render"])
    with open(out / f"{name}_build.log", "w") as log:
        rc = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT).returncode
    if rc == 0 and not report.exists():
        rc = 1
    if rc == 0 and gar and has_skirt(meas) and "skirt" not in json.load(open(report)):
        rc = 1  # the body script wrote its report but the skirt script stopped before adding its own: the checks must not pass without it
    if rc == 0:
        data = json.load(open(report))
        data["fit_config_sha256"] = config_hash(person_cfg(name))
        json.dump(data, open(report, "w"), indent=2)
    print(f"{name}: {'built' if rc == 0 else 'BUILD FAILED, see ' + str(out / (name + '_build.log'))}", flush=True)
    return rc


def check(folder):
    """Run the spike's checks on every report in the folder. 0 means every tolerance was met."""
    print(f"\nChecks on {folder}", flush=True)
    return subprocess.run([sys.executable, str(CHECKER), str(folder), "--sweatshirt", "--necklines", "--shorts", "--tights", "--skirt"]).returncode


def config_hash(cfg):
    """SHA-256 of the config's content (key order and whitespace do not matter). fit.config_hash is the same function."""
    return fit.config_hash(cfg)


def blender_version():
    first = subprocess.run([BLENDER, "--version"], capture_output=True, text=True).stdout.splitlines()
    return first[0].strip() if first else "unknown"


def write_pack(name, build_dir, pack_dir, body_only=False):
    """Copy the checked GLBs to a stable layout and write the manifest. Fails if the pack is over the phone download limit."""
    if pack_dir.exists():
        shutil.rmtree(pack_dir)
    pack_dir.mkdir(parents=True)
    files = {}
    for key, pattern in PACK_FILES.items():
        if body_only and key != "body":
            continue
        src = build_dir / pattern.format(n=name)
        if key in WOMENS_ONLY and not src.exists():  # a man's pack has no skirt; for a woman the checks have already failed without it
            continue
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
        "body_only": body_only,
        "garments": {} if body_only else {"tee": {"fit": "regular", "necklines": {"crew": "tee.glb", "v": "tee_v.glb", "scoop": "tee_scoop.glb"}},
                     "trousers": {"fit": "regular"}, "shorts": {"fit": "regular", "inseam_cm": person_cfg(name)["shorts"]["inseam_cm"]},
                     "sweatshirt": {"fit": "regular"},
                     "tights": {"fit": "skin-close", "gap_cm": person_cfg(name)["tights"]["gap_cm"], "worn_with": ["shorts", "skirt"]},
                     **({"skirt": {"fit": "A-line midi, cloth-draped on this body", "tops": "tucked",
                                   "tucked_tops": {"crew": "tee_tucked.glb", "v": "tee_v_tucked.glb", "scoop": "tee_scoop_tucked.glb"}}}
                        if "skirt.glb" in files else {})},
        "garment_colour_srgb": person_cfg(name)["colour_srgb"],
        "fit_config": person_cfg(name),
        "fit_overrides": {k: v for k, v in PEOPLE_FIT.get(name, {}).items() if not k.startswith("_")},
        "checks": "body measures passed; garments not built (body_only)" if body_only else "all passed (spike/check_reports.py)",
    }
    json.dump(manifest, open(pack_dir / "manifest.json", "w"), indent=2)
    limit = TOLERANCES["phone_max_load_mb"] * 1024 * 1024
    print(f"\nPack for {name}: {total / 1024:.0f} KB in {pack_dir} (limit {TOLERANCES['phone_max_load_mb']} MB)")
    if total > limit:
        print("FAIL pack is over the phone download limit")
        return 1
    return 0


def main():
    global CFG
    only, jobs = arg("--only"), int(arg("--jobs", 3))
    if arg("--config"):
        CFG = json.load(open(arg("--config")))
        print(f"Using fit config {arg('--config')} (sha256 {config_hash(CFG)[:12]})")
    synthetic = [(m, ROOT / "pack" / "out", m.stem) for m in sorted((ROOT / "spike" / "fixtures").glob("*.json"))
                 if not m.stem.endswith("_garments")]
    people = [(ROOT / "private" / f"measurements_{p}.json", ROOT / "private" / "pack" / "build", p) for p in PEOPLE]
    people = [j for j in people if j[0].exists()]
    if "--private" in sys.argv and not people:
        print(f"--private given but no measurements_<person>.json exists in {ROOT / 'private'}")
        return 1
    groups = [synthetic] + ([people] if "--private" in sys.argv else [])
    if only:
        groups = [[j for j in g if j[2] == only] for g in groups]
        if not any(groups):
            print(f"no body called {only!r} (with --private, {' and '.join(repr(p) for p in PEOPLE)} are available)")
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
    if arg("--reports-to"):
        dest = pathlib.Path(arg("--reports-to"))
        if only:
            print("--reports-to ignored with --only: a partial set of reports would fail the staleness test")
        elif arg("--config"):
            print("--reports-to ignored with --config: committed reports must come from the committed pack/fit_config.json")
        else:
            dest.mkdir(parents=True, exist_ok=True)
            for old in dest.glob("*_report.json"):
                old.unlink()
            for j in synthetic:
                shutil.copyfile(j[1] / f"{j[2]}_report.json", dest / f"{j[2]}_report.json")
            print(f"Reports copied to {dest}")
    for j in jobs_all:
        if j[2] in PEOPLE:
            rc |= write_pack(j[2], j[1], ROOT / "private" / "pack" / j[2], is_body_only(j[0]))
    print("\nPACK BUILD " + ("FAILED" if rc else "OK"))
    return rc


if __name__ == "__main__":
    sys.exit(main())
