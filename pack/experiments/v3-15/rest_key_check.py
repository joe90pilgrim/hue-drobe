"""V3-15 step 1: does Blender's cloth use rest_shape_key when run headless?

Run (PowerShell, repo root):
  & "C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe" --background --factory-startup --python pack/experiments/v3-15/rest_key_check.py

A 1 m square grid (21 x 21 vertices), no gravity, no pins, no collision. Each case runs 40 frames and reports the mean edge length
against the starting mesh. If the rest key is used, the cloth grows towards its rest lengths (1.2 here); if it is ignored, it stays at 1.0.
Cases: control (no key); rest key set before / after the modifier is added; the rest key on a mesh whose basis is also shown;
Blender's own shrink_min = -0.2 for comparison.
"""
import bpy, json, sys

N, SIZE, FRAMES, K = 21, 1.0, 40, 1.2


def grid(name):
    vs = [((i / (N - 1) - 0.5) * SIZE, (j / (N - 1) - 0.5) * SIZE, 1.0) for j in range(N) for i in range(N)]
    fs = [(j * N + i, j * N + i + 1, (j + 1) * N + i + 1, (j + 1) * N + i) for j in range(N - 1) for i in range(N - 1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(vs, [], fs)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def add_rest_key(ob):
    ob.shape_key_add(name="Basis")
    rk = ob.shape_key_add(name="rest", from_mix=False)
    for v in ob.data.vertices:
        rk.data[v.index].co = (v.co.x * K, v.co.y * K, v.co.z)
    rk.value = 0.0
    return rk


def add_cloth(ob):
    mod = ob.modifiers.new("Cloth", "CLOTH")
    cs = mod.settings
    cs.quality, cs.mass = 10, 0.15
    cs.tension_stiffness = cs.compression_stiffness = 15
    cs.shear_stiffness, cs.bending_stiffness = 5, 0.5
    cs.effector_weights.gravity = 0.0
    mod.collision_settings.use_collision = False
    mod.point_cache.frame_start, mod.point_cache.frame_end = 1, FRAMES
    return mod


def mean_edge(me, co):
    return sum((co[e.vertices[0]] - co[e.vertices[1]]).length for e in me.edges) / len(me.edges)


def run(case):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, FRAMES
    ob = grid(case)
    if case == "key_before_modifier":
        rk = add_rest_key(ob)
        mod = add_cloth(ob)
        mod.settings.rest_shape_key = rk
    elif case == "key_after_modifier":
        mod = add_cloth(ob)
        rk = add_rest_key(ob)
        mod.settings.rest_shape_key = rk
    elif case == "dynamic_mesh_keyed":
        rk = add_rest_key(ob)
        rk.keyframe_insert("value", frame=1)
        rk.value = 1.0
        rk.keyframe_insert("value", frame=11)
        rk.value = 0.0
        mod = add_cloth(ob)
        mod.settings.use_dynamic_mesh = True
    elif case == "shrink_min_-0.2":
        mod = add_cloth(ob)
        mod.settings.shrink_min = -0.2
    else:
        mod = add_cloth(ob)
    mod.point_cache.frame_end = FRAMES  # touching the cache resets it
    bpy.context.view_layer.update()
    co0 = [v.co.copy() for v in ob.data.vertices]
    l0 = mean_edge(ob.data, co0)
    sc.frame_set(0)
    for f in range(1, FRAMES + 1):
        sc.frame_set(f)
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    l1 = mean_edge(ob.data, [v.co.copy() for v in ev.vertices])
    rest_name = mod.settings.rest_shape_key.name if mod.settings.rest_shape_key else None
    return {"case": case, "rest_shape_key": rest_name, "edge_ratio_after": round(l1 / l0, 4)}


out = [run(c) for c in ("control", "key_before_modifier", "key_after_modifier", "dynamic_mesh_keyed", "shrink_min_-0.2")]
print("V3-15 REST KEY CHECK", bpy.app.version_string)
print(json.dumps(out, indent=1))
sys.stdout.flush()
