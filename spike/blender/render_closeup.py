"""Close-up renders of garments on a body from a pack folder, for visual sign-off (V3-03 second pass).

blender --background --python spike/blender/render_closeup.py -- <pack folder> <out prefix> <garment[,garment]> [colour hex] [views] [centre height m] [frame size m]

  pack folder   e.g. private/pack/b (body.glb plus the garment GLBs)
  out prefix    each view is written to <out prefix>_<view>.png
  garments      pack names without .glb, e.g. shirt_short,trousers; bottoms (trousers, shorts) are drawn light grey
  colour hex    the top's colour as an sRGB hex without '#', default 1f2a44 (navy)
  views         comma list of front, q34 (three-quarter), side, back, q34r; default front,q34,back
  centre height the camera's centre height in metres; default 12 cm below the top of the garments (the collar)
  frame size    orthographic frame height in metres, default 0.5

EEVEE, lit roughly like the app (a soft sky, a key light from the front right above, a weak fill from behind) and shaded the
way three.js shades a pack file: the garment colour multiplied by the file's COLOR_0 attribute where it has one (a shirt's
drawn collar and placket shading), with the file's own normals. Not pixel-identical to the phone: a sign-off aid, not a test."""
import sys, os, math
import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
folder, prefix, items = a[0], a[1], a[2].split(",")
hexc = a[3] if len(a) > 3 and a[3] else "1f2a44"
views = a[4].split(",") if len(a) > 4 and a[4] else ["front", "q34", "back"]
tz = float(a[5]) if len(a) > 5 and a[5] else None
scale = float(a[6]) if len(a) > 6 and a[6] else 0.5
bpy.ops.wm.read_factory_settings(use_empty=True)


def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before and o.type == "MESH"]


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(obj, rgb):
    m = bpy.data.materials.new("m")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.8
    ca = obj.data.color_attributes
    if len(ca):  # COLOR_0 multiplies the colour, as in three.js
        at = nt.nodes.new("ShaderNodeVertexColor")
        at.layer_name = ca[0].name
        mx = nt.nodes.new("ShaderNodeMix")
        mx.data_type, mx.blend_type = "RGBA", "MULTIPLY"
        mx.inputs["Factor"].default_value = 1.0
        mx.inputs[6].default_value = (*rgb, 1)
        nt.links.new(at.outputs["Color"], mx.inputs[7])
        nt.links.new(mx.outputs[2], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    obj.data.materials.clear()
    obj.data.materials.append(m)


for o in imp(os.path.join(folder, "body.glb")):
    material(o, (0.3, 0.3, 0.3))
gs = []
for it in items:
    for o in imp(os.path.join(folder, it + ".glb")):
        material(o, (0.52, 0.52, 0.5) if it.startswith(("trousers", "shorts")) else lin(hexc))
        gs.append(o)

sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
w = bpy.data.worlds.new("w")
sc.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.75, 0.73, 1)
for d, e in (((2, -3, 3), 3.0), ((-3, 2, 1.5), 1.0)):
    L = bpy.data.lights.new("l", "SUN")
    L.energy = e
    lo = bpy.data.objects.new("l", L)
    sc.collection.objects.link(lo)
    lo.rotation_euler = (-Vector(d).normalized()).to_track_quat("-Z", "Y").to_euler()
sc.render.resolution_x = sc.render.resolution_y = 900

zs = [(o.matrix_world @ Vector(c)).z for o in gs for c in o.bound_box]
z = tz if tz is not None else max(zs) - 0.12
cam_d = bpy.data.cameras.new("c")
cam_d.type, cam_d.ortho_scale = "ORTHO", scale
cam = bpy.data.objects.new("c", cam_d)
sc.collection.objects.link(cam)
sc.camera = cam
az = {"front": 0, "q34": 35, "side": 90, "back": 180, "q34r": -35}  # the imported body faces -Y
for v in views:
    t = math.radians(az[v])
    cam.location = Vector((math.sin(t) * 3.0, -math.cos(t) * 3.0, z + 0.05))
    cam.rotation_euler = (math.radians(89), 0, t)
    sc.render.filepath = f"{prefix}_{v}.png"
    bpy.ops.render.render(write_still=True)
print("RENDERED", prefix, views)
