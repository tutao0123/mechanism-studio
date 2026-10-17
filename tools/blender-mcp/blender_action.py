"""Fixed, reviewed native Blender inspection/render. Receives enums, never Python."""
import bpy
import json
import os
from pathlib import Path
import sys
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BLEND = ROOT / 'prototype-3d/assets/lock.blend'
OUTPUT = ROOT / 'prototype-3d/mcp-preview'
CAMERAS = {
    'overview': ((.31, -.4, .24), (.09, 0, .055), .30),
    'section': ((.075, -.5, .055), (.075, 0, .055), .23),
    'end': ((-.4, -.03, .09), (.08, 0, .055), .17),
    'detail': ((.08, -.28, .10), (.08, 0, .075), .115),
    'rear': ((.4, .24, .16), (.10, 0, .045), .28),
}
expected = {'shell-back', 'shell-front', 'plug-back', 'plug-front', 'cam', 'base',
            'key-correct', 'key-wrong', 'key-blank',
            *[f'{family}-{i}' for family in ('lower', 'driver', 'spring') for i in range(1, 6)]}
args = sys.argv[sys.argv.index('--') + 1:]
if len(args) != 2 or args[0] not in ('inspect', 'render') or args[1] not in CAMERAS:
    raise ValueError('Only fixed action and camera enums are accepted')
action, camera_name = args
print('Project Blender: starting fixed ' + action + ' action', flush=True)
if not BLEND.resolve(strict=True).is_relative_to(ROOT.absolute()):
    raise ValueError('Native scene escaped project')
bpy.context.preferences.filepaths.temporary_directory = str(ROOT / '.tools/blender-mcp/temp')
bpy.ops.wm.open_mainfile(filepath=str(BLEND), load_ui=False, use_scripts=False)
print('Project Blender: loaded reviewed native lock scene', flush=True)
parts = [obj for obj in bpy.data.objects if obj.get('part_id')]
ids = [obj['part_id'] for obj in parts]
if len(ids) != 24 or set(ids) != expected:
    raise ValueError('The native scene does not contain the expected 24 part IDs')
if bpy.data.libraries:
    raise ValueError('Linked external libraries are not accepted')
for collection in (bpy.data.images, bpy.data.sounds, bpy.data.fonts, bpy.data.movieclips, bpy.data.cache_files):
    for item in collection:
        path = getattr(item, 'filepath', '')
        if path and path != '<builtin>' and not getattr(item, 'packed_file', None):
            resolved = Path(bpy.path.abspath(path)).resolve()
            if not resolved.is_relative_to(ROOT.absolute()):
                raise ValueError('External media paths are not accepted')
result = {'action': action, 'blenderVersion': bpy.app.version_string,
          'partCount': len(parts), 'partIds': sorted(ids),
          'meshCount': sum(obj.type == 'MESH' for obj in parts),
          'sourceScene': str(BLEND), 'autoExecuteScripts': False}
if action == 'inspect':
    result['parts'] = [{'id': obj['part_id'], 'category': obj.get('category', ''),
                       'locationMeters': list(obj.location), 'scale': list(obj.scale),
                       'vertices': len(obj.data.vertices) if obj.type == 'MESH' else 0}
                      for obj in parts]
else:
    scene = bpy.context.scene
    position, target, scale = CAMERAS[camera_name]
    cam = scene.camera
    if cam is None:
        raise ValueError('Reviewed native scene must have a camera')
    cam.location = position
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = scale
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 4
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 900
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.use_file_extension = True
    scene.render.filepath = str(OUTPUT / f'lock-{camera_name}.png')
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    bpy.ops.render.render(write_still=True)
    result.update(camera=camera_name, samples=4, width=900, height=600,
                  output=scene.render.filepath, savedNativeScene=False)
print('PROJECT_BLENDER_RESULT ' + json.dumps(result, separators=(',', ':')))
