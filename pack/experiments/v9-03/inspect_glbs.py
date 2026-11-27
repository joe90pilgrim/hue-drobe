"""V9-03 Q1/Q2: do Joe's pack GLBs have UVs, and how stretched are they?

Pure Python + numpy, reads GLB files directly (no Blender). Run:
    python pack/experiments/v9-03/inspect_glbs.py [pack_dir] [out_json]
Defaults: private/pack/joe, private/renders/v9-03/uv_report.json
Stretch: for each triangle, ratio = (UV area / 3D area); normalised by the area-weighted median
so 1.0 is the typical scale. Reports median and 95th percentile of ratio/median (and of its inverse,
taking the larger deviation), area-weighted not used; plain per-triangle.
"""
import json, struct, sys
from pathlib import Path
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def load(path):
    b = Path(path).read_bytes()
    _, _, _ = struct.unpack_from('<4sII', b, 0)
    off = 12; js = None; bin_ = b''
    while off < len(b):
        n, t = struct.unpack_from('<II', b, off); off += 8
        if t == 0x4E4F534A: js = json.loads(b[off:off + n])
        elif t == 0x004E4942: bin_ = b[off:off + n]
        off += n
    return js, bin_

def acc(js, bin_, i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']]); nc = NC[a['type']]
    stride = bv.get('byteStride', dt.itemsize * nc)
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = a['count']
    if stride == dt.itemsize * nc:
        arr = np.frombuffer(bin_, dtype=dt, count=n * nc, offset=base).reshape(n, nc)
    else:
        arr = np.stack([np.frombuffer(bin_, dtype=dt, count=nc, offset=base + k * stride) for k in range(n)])
    return arr

def inspect(path):
    js, bin_ = load(path)
    out = {'file': Path(path).name, 'kb': round(Path(path).stat().st_size / 1024, 1), 'prims': []}
    out['materials'] = len(js.get('materials', [])); out['textures'] = len(js.get('textures', []))
    for m in js.get('meshes', []):
        for p in m['primitives']:
            at = p['attributes']; pos = acc(js, bin_, at['POSITION']).astype(np.float64)
            idx = acc(js, bin_, p['indices']).reshape(-1, 3).astype(np.int64) if 'indices' in p else np.arange(len(pos)).reshape(-1, 3)
            d = {'verts': len(pos), 'tris': len(idx), 'TEXCOORD_0': 'TEXCOORD_0' in at, 'COLOR_0': 'COLOR_0' in at, 'attrs': sorted(at)}
            if 'TEXCOORD_0' in at:
                uv = acc(js, bin_, at['TEXCOORD_0']).astype(np.float64)
                a3 = 0.5 * np.linalg.norm(np.cross(pos[idx[:, 1]] - pos[idx[:, 0]], pos[idx[:, 2]] - pos[idx[:, 0]]), axis=1)
                e1 = uv[idx[:, 1]] - uv[idx[:, 0]]; e2 = uv[idx[:, 2]] - uv[idx[:, 0]]
                a2 = 0.5 * np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0])
                ok = (a3 > 1e-12)
                r = a2[ok] / a3[ok]
                med = np.median(r[r > 0]) if (r > 0).any() else 1.0
                n = r / med
                n = np.where(n > 0, n, np.nan)
                dev = np.fmax(n, 1 / n)  # >=1; 2 = twice too big or too small
                dev = dev[np.isfinite(dev)]
                d['uv_range'] = [float(uv.min()), float(uv.max())]
                d['stretch_median'] = round(float(np.median(dev)), 3)
                d['stretch_p95'] = round(float(np.percentile(dev, 95)), 3)
                d['degenerate_uv_tris'] = int((a2[ok] <= 1e-12).sum())
            out['prims'].append(d)
    return out

if __name__ == '__main__':
    root = Path(sys.argv[1] if len(sys.argv) > 1 else 'private/pack/joe')
    outp = Path(sys.argv[2] if len(sys.argv) > 2 else 'private/renders/v9-03/uv_report.json')
    rep = [inspect(f) for f in sorted(root.glob('*.glb'))]
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(json.dumps(rep, indent=1))
    print(f"{'file':32}{'KB':>8}{'tris':>7}{'UV':>5}{'COL0':>6}{'mat':>4}{'tex':>4}{'str.med':>9}{'str.p95':>9}")
    for r in rep:
        for p in r['prims']:
            print(f"{r['file']:32}{r['kb']:8.1f}{p['tris']:7d}{'yes' if p['TEXCOORD_0'] else 'NO':>5}{'yes' if p['COLOR_0'] else '-':>6}{r['materials']:4d}{r['textures']:4d}{p.get('stretch_median','-'):>9}{p.get('stretch_p95','-'):>9}")
