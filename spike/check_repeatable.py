"""Compare two build folders: every GLB must be byte-identical and every report must hold the same values.

Usage: python spike/check_repeatable.py <folder_a> <folder_b>
Build the same inputs into both folders first (for example copy spike/out after one build_all.py run, then run it again).
Exit 1 if anything differs or a file is missing from either folder.
"""
import sys, json, hashlib, pathlib

a, b = (pathlib.Path(p) for p in sys.argv[1:3])
names = sorted({p.name for p in a.glob("*.glb")} | {p.name for p in a.glob("*_report.json")}
               | {p.name for p in b.glob("*.glb")} | {p.name for p in b.glob("*_report.json")})
bad = 0
for n in names:
    fa, fb = a / n, b / n
    if not (fa.exists() and fb.exists()):
        print(f"MISSING {n}"); bad += 1
        continue
    if n.endswith(".glb"):
        same = hashlib.sha256(fa.read_bytes()).digest() == hashlib.sha256(fb.read_bytes()).digest()
    else:
        same = json.loads(fa.read_text()) == json.loads(fb.read_text())
    print(f"{'SAME' if same else 'DIFFERENT'} {n}")
    bad += not same
print("REPEATABLE" if not bad else f"NOT REPEATABLE ({bad} files)")
sys.exit(1 if bad else 0)
