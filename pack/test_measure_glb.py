"""Unit tests for measure_glb.py on small synthetic meshes (no real person's data). Run: python -m unittest discover -s pack"""
import json, math, pathlib, struct, tempfile, unittest

import numpy as np

import measure_glb


def tube(radius, height, sides=64, cx=0.0, y0=0.0, rings=5):
    """An open tube standing on y0 (glTF is Y up), as (vertices, triangles)."""
    v, t = [], []
    for r in range(rings):
        y = y0 + height * r / (rings - 1)
        for s in range(sides):
            a = 2 * math.pi * s / sides
            v.append((cx + radius * math.cos(a), y, radius * math.sin(a)))
    for r in range(rings - 1):
        for s in range(sides):
            a, b = r * sides + s, r * sides + (s + 1) % sides
            t += [(a, b, a + sides), (b, b + sides, a + sides)]
    return np.array(v, dtype=np.float32), np.array(t, dtype=np.uint32)


def write_glb(path, parts):
    """Writes the given (vertices, triangles) parts as one GLB with one mesh primitive each."""
    binary, views, accessors, prims = b"", [], [], []
    for v, t in parts:
        for arr, target in ((v, 34962), (t, 34963)):
            views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": arr.nbytes, "target": target})
            binary += arr.tobytes()
        accessors.append({"bufferView": len(views) - 2, "componentType": 5126, "count": len(v), "type": "VEC3"})
        accessors.append({"bufferView": len(views) - 1, "componentType": 5125, "count": t.size, "type": "SCALAR"})
        prims.append({"attributes": {"POSITION": len(accessors) - 2}, "indices": len(accessors) - 1})
    doc = {"asset": {"version": "2.0"}, "buffers": [{"byteLength": len(binary)}], "bufferViews": views,
           "accessors": accessors, "meshes": [{"primitives": prims}]}
    j = json.dumps(doc).encode()
    j += b" " * (-len(j) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(j) + 8 + len(binary)
    path.write_bytes(b"glTF" + struct.pack("<II", 2, total) + struct.pack("<I", len(j)) + b"JSON" + j
                     + struct.pack("<I", len(binary)) + b"BIN\0" + binary)


class MeasureGlb(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)

    def load(self, parts):
        p = pathlib.Path(self.dir.name) / "m.glb"
        write_glb(p, parts)
        return measure_glb.load_glb(p)

    def test_cylinder_circumference_is_the_polygon_perimeter(self):
        v, t = self.load([tube(0.15, 1.0)])
        want = 2 * 64 * 0.15 * math.sin(math.pi / 64) * 100
        self.assertAlmostEqual(measure_glb.torso_circumference_cm(v, t, 0.5), want, places=2)
        self.assertAlmostEqual(want, 2 * math.pi * 15, delta=0.1)  # about 94.2 cm: the polygon is a close stand-in for a circle

    def test_an_arm_beside_the_body_is_not_counted(self):
        v, t = self.load([tube(0.15, 1.0), tube(0.04, 1.0, cx=0.35)])
        want = 2 * 64 * 0.15 * math.sin(math.pi / 64) * 100
        self.assertAlmostEqual(measure_glb.torso_circumference_cm(v, t, 0.5), want, places=2)

    def test_no_outline_outside_the_mesh(self):
        v, t = self.load([tube(0.15, 1.0)])
        self.assertTrue(math.isnan(measure_glb.torso_circumference_cm(v, t, 1.5)))

    def test_a_mesh_without_a_centre_outline_gives_nan(self):
        v, t = self.load([tube(0.04, 1.0, cx=0.35)])
        self.assertTrue(math.isnan(measure_glb.torso_circumference_cm(v, t, 0.5)))


if __name__ == "__main__":
    unittest.main()
