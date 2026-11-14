import bpy
from bl_ext.user_default.mpfb.services.humanservice import HumanService
h = HumanService.create_human(scale=0.1)
print("GROUPS", [g.name for g in h.vertex_groups][:80])
print("MODS", [(m.name, m.type) for m in h.modifiers])
dg = bpy.context.evaluated_depsgraph_get()
e = h.evaluated_get(dg)
m = e.to_mesh()
print("EVAL_VERTS", len(m.vertices), "ZRANGE", min(v.co.z for v in m.vertices), max(v.co.z for v in m.vertices))
