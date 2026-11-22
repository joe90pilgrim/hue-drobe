"""V5-00: render an item with its own textures on the body, to see the look the colour picker would start from (the V2-07 shoes read as
pale, sock-like). Companion to spike/blender/render_closeup.py, which replaces every material with a plain colour.

  blender --background --python pack/v5_spike/render_textured.py -- <folder with body.glb and <item>.glb> <out prefix> <item> [centre height m] [frame m]

Draws body.glb in grey and <item>.glb with the materials it was exported with. Front, three-quarter and back, EEVEE, lit as render_closeup.py is.
"""
import sys, os, math
import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
folder, prefix, item = a[0], a[1], a[2]
tz = float(a[3]) if len(a) > 3 else None
scale = float(a[4]) if len(a) > 4 else 0.4
bpy.ops.wm.read_factory_settings(use_empty=True)


def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before and o.type == "MESH"]


for o in imp(os.path.join(folder, "body.glb")):
    m = bpy.data.materials.new("skin")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.3, 0.3, 0.3, 1)
    o.data.materials.clear()
    o.data.materials.append(m)
items = imp(os.path.join(folder, item + ".glb"))
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.world = bpy.data.worlds.new("w")
sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.75, 0.73, 1)
for d, e in (((2, -3, 3), 3.0), ((-3, 2, 1.5), 1.0)):
    L = bpy.data.lights.new("l", "SUN")
    L.energy = e
    lo = bpy.data.objects.new("l", L)
    sc.collection.objects.link(lo)
    lo.rotation_euler = (-Vector(d).normalized()).to_track_quat("-Z", "Y").to_euler()
sc.render.resolution_x = sc.render.resolution_y = 900
zs = [(o.matrix_world @ Vector(c)).z for o in items for c in o.bound_box]
z = tz if tz is not None else (max(zs) + min(zs)) / 2
cd = bpy.data.cameras.new("c")
cd.type, cd.ortho_scale = "ORTHO", scale
cam = bpy.data.objects.new("c", cd)
sc.collection.objects.link(cam)
sc.camera = cam
for v, az in (("front", 0), ("q34", 35), ("back", 180)):
    t = math.radians(az)
    cam.location = Vector((math.sin(t) * 3.0, -math.cos(t) * 3.0, z + 0.05))
    cam.rotation_euler = (math.radians(89), 0, t)
    sc.render.filepath = f"{prefix}_{v}.png"
    bpy.ops.render.render(write_still=True)
print("RENDERED", prefix)
