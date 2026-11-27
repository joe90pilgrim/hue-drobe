"""V9-03 Q2/Q3/Q4: how stretched would each pattern be on Joe's garments?

A. Object-space patterns (no UVs): for every triangle, how much wider/narrower the pattern is on the cloth than its nominal
   size (dev >= 1; 2 = twice too wide or too narrow). Same formulas as the shader in pattern-material.js. Area-weighted.
B. Hypothetical UVs: copy each garment vertex's UV from the nearest body vertex (the cheapest way a pack build could give a
   shell garment UVs, since the shells are cut from the body mesh). Reports triangles that straddle UV islands, the stretch of
   the rest, and the bytes a TEXCOORD_0 attribute would add (raw and gzipped).
Run: python pack/experiments/v9-03/stretch_object_space.py [pack_dir] [out_json]
"""
import gzip, json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
import inspect_glbs as G

AX = np.array([0.0, 0.03])          # torso axis in (x, z), as in the shader
R_REF, N_STRIPES, P_X, P_Y = 0.15, 48, 0.05, 0.05

def prim(path):
    js, b = G.load(path); p = js['meshes'][0]['primitives'][0]
    pos = G.acc(js, b, p['attributes']['POSITION']).astype(np.float64)
    idx = G.acc(js, b, p['indices']).reshape(-1, 3).astype(np.int64)
    uv = G.acc(js, b, p['attributes']['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in p['attributes'] else None
    return pos, idx, uv

def tri_geo(pos, idx):
    a, b, c = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]
    cr = np.cross(b - a, c - a); area = 0.5 * np.linalg.norm(cr, axis=1)
    n = cr / np.maximum(2 * area, 1e-18)[:, None]
    return (a + b + c) / 3, n, area

def wq(x, w, q):  # area-weighted percentile
    o = np.argsort(x); x, w = x[o], w[o]; cw = np.cumsum(w) / w.sum()
    return float(x[np.searchsorted(cw, q / 100)])

def summary(dev, area):
    return {'median': round(wq(dev, area, 50), 2), 'p95': round(wq(dev, area, 95), 2),
            'area_pct_over_1.5': round(100 * area[dev > 1.5].sum() / area.sum(), 1),
            'area_pct_over_2': round(100 * area[dev > 2].sum() / area.sum(), 1)}

def object_space(pos, idx):
    c, n, area = tri_geo(pos, idx)
    ok = area > 1e-10; c, n, area = c[ok], n[ok], area[ok]
    out = {}
    out['hstripes'] = summary(1 / np.sqrt(np.maximum(1 - n[:, 1] ** 2, 1e-4)), area)
    out['vstripes_x'] = summary(1 / np.sqrt(np.maximum(1 - n[:, 0] ** 2, 1e-4)), area)
    d = c[:, [0, 2]] - AX; r = np.maximum(np.linalg.norm(d, axis=1), 0.03)
    th = np.stack([d[:, 1], 0 * d[:, 0], -d[:, 0]], 1) / r[:, None]          # unit tangent round the axis (x,y,z), y = 0
    g = (N_STRIPES / (2 * np.pi)) / r[:, None] * th                           # gradient of the stripe coordinate, stripes per metre
    gs = g - (g * n).sum(1)[:, None] * n                                      # its part along the cloth
    mag0 = N_STRIPES / (2 * np.pi * R_REF); m = np.maximum(np.linalg.norm(gs, axis=1), 1e-6)
    out['vstripes'] = summary(np.fmax(mag0 / m, m / mag0), area)
    nk = np.abs(n).max(1)                                                     # triplanar: the projection plane is the most-facing axis
    out['spots_flowers_triplanar'] = summary(1 / np.maximum(nk, 1e-3), area)
    out['spots_flowers_triplanar']['area_pct_cloth_off_plane_over_30deg'] = round(100 * area[nk < np.cos(np.radians(30))].sum() / area.sum(), 1)
    out['spots3d'] = {'note': 'isotropic, no stretch; spot size depends on how the cloth cuts the lattice (see render)'}
    return out

def nearest_uv(body_pos, body_uv, pts):
    out = np.empty((len(pts), 2)); dist = np.empty(len(pts))
    for i in range(0, len(pts), 256):
        d = ((pts[i:i + 256, None, :] - body_pos[None]) ** 2).sum(2); j = d.argmin(1)
        out[i:i + 256] = body_uv[j]; dist[i:i + 256] = np.sqrt(d[np.arange(len(j)), j])
    return out, dist

def hypothetical_uv(pos, idx, body_pos, body_uv):
    uv, dist = nearest_uv(body_pos, body_uv, pos)
    e = np.stack([np.linalg.norm(uv[idx[:, k]] - uv[idx[:, (k + 1) % 3]], axis=1) for k in range(3)], 1).max(1)
    _, _, a3 = tri_geo(pos, idx)
    # an edge that crosses an island is far longer in UV than the triangle is in 3D; 3D edges here are ~1-2 cm, so 2 cm of UV is ~ 1 % of the map
    broken = e > 0.02
    e1 = uv[idx[:, 1]] - uv[idx[:, 0]]; e2 = uv[idx[:, 2]] - uv[idx[:, 0]]
    a2 = 0.5 * np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]); ok = (~broken) & (a2 > 1e-14) & (a3 > 1e-10)
    r = a2[ok] / a3[ok]; r = r / np.median(r); dev = np.fmax(r, 1 / r)
    raw = uv.astype('<f4').tobytes()
    return {'verts': len(pos), 'tris': len(idx), 'tris_straddling_islands': int(broken.sum()), 'pct_straddling': round(100 * broken.mean(), 1),
            'stretch_median_rest': round(float(np.median(dev)), 2), 'stretch_p95_rest': round(float(np.percentile(dev, 95)), 2),
            'max_nearest_body_vertex_cm': round(float(dist.max() * 100), 1), 'added_bytes_raw': len(raw), 'added_bytes_gzip': len(gzip.compress(raw, 6))}

if __name__ == '__main__':
    root = Path(sys.argv[1] if len(sys.argv) > 1 else 'private/pack/joe')
    outp = Path(sys.argv[2] if len(sys.argv) > 2 else 'private/renders/v9-03/stretch_report.json')
    names = ['tee', 'tee_v', 'tee_scoop', 'sweatshirt', 'shirt_short', 'shirt_long', 'trousers', 'shorts', 'tights', 'blazer_male', 'cap', 'beanie']
    body_pos, _, body_uv = prim(root / 'body.glb')
    rep = {}
    for n in names:
        pos, idx, _ = prim(root / f'{n}.glb')
        rep[n] = {'object_space': object_space(pos, idx), 'hypothetical_body_uv': hypothetical_uv(pos, idx, body_pos, body_uv)}
    outp.write_text(json.dumps(rep, indent=1))
    print('Object-space stretch (area-weighted; dev 1 = true size, 2 = twice too wide or narrow): median / p95 / % area over 2')
    print(f"{'garment':13}{'hstripes':>18}{'vstripes(angle)':>20}{'vstripes(x)':>18}{'triplanar spots/flowers':>28}")
    f = lambda s: f"{s['median']}/{s['p95']}/{s['area_pct_over_2']}%"
    for n, r in rep.items():
        o = r['object_space']; print(f"{n:13}{f(o['hstripes']):>18}{f(o['vstripes']):>20}{f(o['vstripes_x']):>18}{f(o['spots_flowers_triplanar']):>28}")
    print('\nHypothetical UVs copied from the nearest body vertex')
    print(f"{'garment':13}{'verts':>7}{'straddle%':>10}{'str.med':>8}{'str.p95':>8}{'+raw B':>8}{'+gz B':>8}")
    for n, r in rep.items():
        h = r['hypothetical_body_uv']; print(f"{n:13}{h['verts']:7d}{h['pct_straddling']:10}{h['stretch_median_rest']:8}{h['stretch_p95_rest']:8}{h['added_bytes_raw']:8d}{h['added_bytes_gzip']:8d}")
