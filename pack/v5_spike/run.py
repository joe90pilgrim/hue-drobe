"""V5-00: run the spike for Joe and B. Blender work only; nothing here touches the app, pack/out or a shipped asset.

  python -I pack/v5_spike/prepare.py                       # once: unpack the candidates, write the scratch templates and jobs
  python -I pack/v5_spike/run.py stage1 [--only joe,b] [--items id1,id2] [--tag name]   # every candidate on each body, alone
  python -I pack/v5_spike/run.py hats   [--only joe,b]     # each hat over that body's best hair (hide the covered hair faces)
  python -I pack/v5_spike/run.py renders [--only joe,b]    # front, three-quarter and back close-ups (spike/blender/render_closeup.py)

Use the real Python, not the Microsoft Store alias (see spike/assets/README.md). Output goes to private/v5_spike/out/<body>/ (git-ignored:
the renders show real bodies). "Best hair" is the hair candidate with the fewest hair vertices in the eye, face and ear regions as the MHCLO
fit gives them (the hair check in session.py), ties broken by the fewest face pairs with the whole body; run.py writes the choice and the
numbers to <out>/<body>/best_hair.json before any hat is run.
"""
import json, os, pathlib, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "pack"))
import build_pack  # noqa: E402  (only person_cfg, so the app's own tee and trousers match the shipped pack)
import fit  # noqa: E402

BLENDER = os.environ.get("BLENDER", r"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe")
BODIES = {"joe": ROOT / "private" / "measurements_joe.json", "b": ROOT / "private" / "measurements_b.json"}
CLOSEUP = ROOT / "spike" / "blender" / "render_closeup.py"
TEXTURED = HERE / "render_textured.py"


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


V5 = pathlib.Path(arg("--out", ROOT / "private" / "v5_spike")).resolve()
only = [b for b in BODIES if not arg("--only") or b in arg("--only").split(",")]
rows = {r["id"]: r for r in json.load(open(V5 / "candidates_resolved.json"))}


def session(body, folder, job_path):
    """One Blender session: the body, the app's garments, then the job's templates. Returns True if both reports were written."""
    meas = BODIES[body]
    folder.mkdir(parents=True, exist_ok=True)
    gar = folder / f"{body}_garments.json"
    json.dump(fit.default_garments(json.load(open(meas)), build_pack.person_cfg(body)), open(gar, "w"), indent=2)
    for f in (folder / f"{body}_report.json", folder / f"{body}_v5.json"):
        f.unlink(missing_ok=True)
    cmd = [BLENDER, "--background", "--python", str(HERE / "session.py"), "--", str(ROOT / "spike" / "blender" / "body_from_measurements.py"),
           str(job_path), "::", str(meas), str(folder), body, str(gar)]
    with open(folder / f"{body}_session.log", "w") as log:
        subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
    ok = (folder / f"{body}_v5.json").exists()
    print(f"{body}: {'done' if ok else 'FAILED, see ' + str(folder / (body + '_session.log'))}", flush=True)
    return ok


def stage1(body):
    job = json.load(open(V5 / f"job_{body}.json"))
    if arg("--items"):
        want = set(arg("--items").split(","))
        job["templates"] = [d for d in job["templates"] if os.path.basename(d) in want]
    tag = arg("--tag", "stage1")  # a second run (such as the converted necklace) goes in its own folder: stage1_<tag> is read by summarise.py
    folder = V5 / "out" / body / tag
    (V5 / "out").mkdir(exist_ok=True)
    json.dump(job, open(V5 / "out" / f"job_{body}_{tag}.json", "w"), indent=2)
    return session(body, folder, V5 / "out" / f"job_{body}_{tag}.json")


def best_hair(body):
    folder = V5 / "out" / body / "stage1"
    rep = json.load(open(folder / f"{body}_report.json"))["pack_items"]
    v5 = json.load(open(folder / f"{body}_v5.json"))
    scored = []
    for tid, e in v5.items():
        r = rows[tid]
        if r["category"] == "hair" and e.get("status") == "ok" and rep[tid].get("status") == "ok":
            scored.append((e["hair_check_as_fitted"]["eye_face_ear"], rep[tid].get("pairs_with_whole_body_as_shipped", 0), tid))
    scored.sort()
    pick = {"body": body, "best_hair": scored[0][2] if scored else None,
            "ranking": [{"id": t, "hair_vertices_in_eye_face_ear_as_fitted": a, "pairs_with_whole_body_as_shipped": b} for a, b, t in scored]}
    json.dump(pick, open(V5 / "out" / body / "best_hair.json", "w"), indent=2)
    return pick["best_hair"]


def hats(body):
    """Each hat over a hair style: the one best_hair() picks by the hair check, or with --hair joe=<id>,b=<id> the one named (the second run
    for the style that looks best in the renders, because the hair check does not see a fringe over the eyes). Output: hats_over_hair, or
    hats_over_<id> for a named hair."""
    pick = best_hair(body)
    named = dict(x.split("=") for x in arg("--hair", "").split(",") if "=" in x)
    hair = named.get(body, pick)
    tag = "hats_over_hair" if hair == pick and body not in named else f"hats_over_{hair}"
    if not hair:
        print(f"{body}: no hair to put a hat over")
        return False
    folder = V5 / "out" / body / tag
    folder.mkdir(parents=True, exist_ok=True)
    tdirs = []
    for tid, r in rows.items():
        if r["category"] == "hats" and body in r["bodies"]:
            meta = json.load(open(pathlib.Path(r["dir"]) / "meta.json"))
            meta.update({"id": tid + "_over_" + ("hair" if tag == "hats_over_hair" else hair), "inner_layers": [hair]})  # worn over the best hair; hide_inner defaults on for an outer layer
            d = V5 / "templates_over" / body / "hats" / meta["id"]
            d.mkdir(parents=True, exist_ok=True)
            json.dump(meta, open(d / "meta.json", "w"), indent=2)
            tdirs.append(str(d))
    shutil.copyfile(V5 / "out" / body / "stage1" / f"{body}_{hair}.glb", folder / f"{body}_{hair}.glb")  # the inner layer, built in stage 1
    job = {**json.load(open(V5 / f"job_{body}.json")), "templates": tdirs}
    json.dump(job, open(V5 / "out" / f"job_{body}_{tag}.json", "w"), indent=2)
    return session(body, folder, V5 / "out" / f"job_{body}_{tag}.json")


def blender(script, *a, log, views=("front", "q34", "back"), tries=3):
    """Runs a render script, skipping it when its three images exist, and trying again when Blender crashed first (headless EEVEE does,
    now and then, especially with several running at once)."""
    prefix = pathlib.Path(a[1])
    for _ in range(tries):
        if all(pathlib.Path(f"{prefix}_{v}.png").exists() for v in views):
            return
        with open(log, "w") as lf:
            subprocess.run([BLENDER, "--background", "--python", str(script), "--", *map(str, a)], stdout=lf, stderr=subprocess.STDOUT, cwd=ROOT)


def renders(body):
    """Close-ups per candidate: the item on the body as it would be drawn (the body with the hidden parts removed, for shoes). Shoes also
    with the app's trousers, and textured (render_textured.py) for the pale, sock-like look. Hats over the best hair use the hair as drawn."""
    s1 = V5 / "out" / body / "stage1"
    rdir = V5 / "out" / body / "renders"
    rdir.mkdir(parents=True, exist_ok=True)
    srcs = {}  # template id -> (the folder that built it, its report entry): the main run, then the necklace run
    for fld in (s1, V5 / "out" / body / "stage1_necklace"):
        if (fld / f"{body}_report.json").exists():
            for tid_, R_ in json.load(open(fld / f"{body}_report.json"))["pack_items"].items():
                srcs[tid_] = (fld, R_)
    todo = []
    for tid, r in rows.items():
        if body not in r["bodies"] or srcs.get(tid, (None, {}))[1].get("status") != "ok":
            continue
        fld, R = srcs[tid]
        f = rdir / "_stage" / tid
        f.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(fld / (f"{body}_body_{tid}.glb" if R["delete_group"] else f"{body}.glb"), f / "body.glb")
        shutil.copyfile(fld / f"{body}_{tid}.glb", f / f"{tid}.glb")
        top, bot = R["top_z_m"], R["bottom_z_m"]
        cat = r["category"]
        centre, frame, colour_hex = ((top - 0.07, 0.45, "5a3b25") if cat == "hair" else (top - 0.05, 0.35, "8a6a4a") if cat == "hats"
                                     else ((top + bot) / 2, 0.40, "d4af37") if cat == "jewellery" else ((top + bot) / 2, 0.62, "3b2f2a"))  # shoes: both feet in the frame
        todo.append((f, rdir / tid, tid, centre, frame, colour_hex, cat))
        if cat == "shoes" and (fld / f"{body}_trousers.glb").exists():
            f2 = rdir / "_stage" / (tid + "__trousers")
            f2.mkdir(parents=True, exist_ok=True)
            for n in ("body.glb", f"{tid}.glb"):
                shutil.copyfile(f / n, f2 / n)
            shutil.copyfile(fld / f"{body}_trousers.glb", f2 / "trousers.glb")
            todo.append((f2, rdir / (tid + "__trousers"), tid + ",trousers", 0.30, 0.9, colour_hex, "shoes+trousers"))
    for s2 in sorted((V5 / "out" / body).glob("hats_over_*")):  # hats_over_hair (the best hair by the hair check) and hats_over_<id> (named)
        if not (s2 / f"{body}_report.json").exists():
            continue
        rep2 = json.load(open(s2 / f"{body}_report.json"))["pack_items"]
        hair = json.load(open(V5 / "out" / body / "best_hair.json"))["best_hair"] if s2.name == "hats_over_hair" else s2.name[len("hats_over_"):]
        for pf, R in rep2.items():
            if R.get("status") != "ok":
                continue
            f = rdir / "_stage" / pf
            f.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(s2 / f"{body}.glb", f / "body.glb")
            shutil.copyfile(s2 / f"{body}_{pf}.glb", f / f"{pf}.glb")
            under = (R.get("inner_hidden") or {}).get(hair, {}).get("glb")
            shown = pf
            if under:
                shutil.copyfile(s2 / under, f / f"hair_{hair}_as_drawn.glb")
                shown = f"hair_{hair}_as_drawn,{pf}"
            todo.append((f, rdir / pf, shown, R["top_z_m"] - 0.07, 0.45, "8a6a4a", "hats"))
    def one(t):
        f, prefix, shown, centre, frame, hexc, _cat = t
        blender(CLOSEUP, f, prefix, shown, hexc, "", f"{centre:.3f}", f"{frame:.3f}", log=str(prefix) + "_render.log")
        return prefix.name
    with ThreadPoolExecutor(int(arg("--jobs", 4))) as ex:
        done = list(ex.map(one, todo))
    # textured shoes, for the pale, sock-like look from V2-07
    for tid, r in rows.items():
        if r["category"] == "shoes" and body in r["bodies"] and (rdir / "_stage" / tid).exists():
            R_ = srcs[tid][1]
            blender(TEXTURED, rdir / "_stage" / tid, rdir / (tid + "__textured"), tid, f"{(R_['top_z_m'] + R_['bottom_z_m']) / 2:.3f}", "0.62",
                    log=str(rdir / (tid + "__textured_render.log")))
    print(f"{body}: {len(done)} render sets in {rdir}", flush=True)
    return True


def main():
    cmd = sys.argv[1]
    fn = {"stage1": stage1, "hats": hats, "renders": renders}[cmd]
    jobs = int(arg("--jobs", len(only)))
    with ThreadPoolExecutor(jobs) as ex:
        ok = list(ex.map(fn, only))
    sys.exit(0 if all(ok) else 1)


if __name__ == "__main__":
    main()
