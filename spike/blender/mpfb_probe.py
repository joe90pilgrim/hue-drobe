"""Block 2 probe: can MPFB2 be driven headlessly on this Blender? Prints height, measure-target names and vertex groups.
Run: blender --background --python spike/blender/mpfb_probe.py
"""
import bpy
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

print("BLENDER", bpy.app.version_string)
human = HumanService.create_human(scale=0.1)
bpy.context.view_layer.update()
print("DIMENSIONS", tuple(round(v, 4) for v in human.dimensions), "unit scale", bpy.context.scene.unit_settings.scale_length)
print("VERTS", len(human.data.vertices))
print("GROUPS_WITH_KEYWORDS", [g.name for g in human.vertex_groups if any(k in g.name.lower() for k in ("waist", "hip", "bust", "chest", "measure"))][:40])
print("SHAPEKEYS", len(human.data.shape_keys.key_blocks) if human.data.shape_keys else 0)
for name in ("torso-measure-waist-circ-decr-incr", "measure-waist-circ-decr-incr"):
    print("TARGET_VALUE", name, TargetService.get_target_value(human, name))
print("STACK_SAMPLE", [str(s)[:80] for s in TargetService.get_target_stack(human)][:10])
