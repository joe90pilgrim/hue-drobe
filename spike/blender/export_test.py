"""Block 0 smoke test: build a simple capsule 'body' in headless Blender and export glTF.
Run: blender --background --python spike/blender/export_test.py -- <out.glb>
"""
import sys
import bpy

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "test_body.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(0, 0, 1.5), segments=32, ring_count=16)  # head
bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.9, location=(0, 0, 1.0), vertices=32)  # torso
bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.8, location=(0.09, 0, 0.4), vertices=24)  # leg
bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.8, location=(-0.09, 0, 0.4), vertices=24)  # leg
for o in bpy.context.scene.objects:
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_smooth()
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB")
print("BLENDER_VERSION", bpy.app.version_string)
print("EXPORTED", out)
