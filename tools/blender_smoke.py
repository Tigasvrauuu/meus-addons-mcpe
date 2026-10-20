"""Real Blender CPU smoke test; run with blender --background --python this_file."""
from pathlib import Path
import json
import bpy
from mathutils import Vector

out = Path(__file__).resolve().parents[1] / 'dist' / 'blender-smoke'
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.render.resolution_x = 256
scene.render.resolution_y = 256
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('Smoke test world')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.08, 0.1, 0.16, 1)

bpy.ops.mesh.primitive_cube_add()
cube = bpy.context.object
cube.name = 'Headless verification cube — not a game asset'
material = bpy.data.materials.new('Verification red')
material.diffuse_color = (0.65, 0.025, 0.05, 1)
cube.data.materials.append(material)
bpy.ops.object.camera_add(location=(4, -6, 4))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
bpy.ops.object.light_add(type='AREA', location=(2, -3, 6))
bpy.context.object.data.energy = 900
bpy.context.object.data.size = 4
scene.render.filepath = str(out / 'smoke.png')
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'smoke.blend'))
bpy.ops.render.render(write_still=True)
assert (out / 'smoke.blend').stat().st_size > 0
assert (out / 'smoke.png').read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
report = {'blender': bpy.app.version_string, 'background': bpy.app.background,
          'engine': scene.render.engine, 'device': scene.cycles.device,
          'purpose': 'Installation smoke test, not Minecraft asset validation',
          'result': 'PASS'}
(out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
