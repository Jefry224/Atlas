"""Offline Blender conversion helper; invoked by prepare-nasa-assets.py, never at runtime."""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--id', required=True)
parser.add_argument('--input', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--report', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = Path(args.input).resolve()
changes = []
if source.suffix == '.blend':
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    # Snapshot evaluated geometry BEFORE dropping parents/helpers: otherwise mirrored
    # suspension pieces inherit different transforms when their parents disappear.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    snapshots = []
    excluded = []
    for obj in list(bpy.context.scene.objects):
        if obj.type != 'MESH' or obj.hide_render or obj.hide_viewport:
            excluded.append(obj.name)
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        transform = evaluated.matrix_world.copy()
        mesh.transform(transform)
        if transform.determinant() < 0:
            mesh.flip_normals()
        mesh.update()
        snapshots.append((obj.name, mesh))
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for name, mesh in snapshots:
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
    # NASA's 4.2 blend opens in 4.5 with Principled Weight=0. Repair this
    # version-migration artifact while preserving the original image/color links.
    for material in bpy.data.materials:
        if not material.use_nodes:
            color = tuple(material.diffuse_color)
            material.use_nodes = True
            bsdf = material.node_tree.nodes.get('Principled BSDF')
            bsdf.inputs['Base Color'].default_value = color
            bsdf.inputs['Metallic'].default_value = 0.65
            bsdf.inputs['Roughness'].default_value = 0.5
            changes.append('Legacy material ' + material.name + ': diffuse color → Principled; illustrative metallic=0.65, roughness=0.5.')
        for node in material.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED' and 'Weight' in node.inputs:
                if node.inputs['Weight'].default_value != 1:
                    node.inputs['Weight'].default_value = 1
                    changes.append('Restored Principled Weight=1: ' + material.name)
    changes += ['Static evaluated frame 1; world transforms baked per visible mesh, mirrored winding corrected.',
                'Excluded hidden helpers, lights and empties: ' + ', '.join(excluded),
                'Packed source images embedded; no decimation, rescaling or replacement geometry.']
elif source.suffix.lower() == '.stl':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.stl_import(filepath=str(source), global_scale=1.0, use_scene_unit=False,
                          forward_axis='Y', up_axis='Z', use_mesh_validate=True)
    material = bpy.data.materials.new('Illustrative neutral surface')
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.38, 0.34, 0.30, 1)
    bsdf.inputs['Metallic'].default_value = 0
    bsdf.inputs['Roughness'].default_value = 0.9
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.data.materials.append(material)
    changes += ['STL source coordinates retained at scale=1; physical units unknown.',
                'Neutral illustrative material added because STL has no color/texture.',
                'No decimation; Apollo exaggeration retained if applicable.']
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    changes += ['Decoded official Draco geometry offline; exported without Draco.',
                'Source node transforms, materials and images preserved by Blender glTF import/export; static scene, no animation export.']

bpy.context.view_layer.update()
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.visible_get()]
assert objects, 'No mesh objects'
vertices = sum(len(o.data.vertices) for o in objects)
triangles = 0
corners = []
for obj in objects:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
    for corner in obj.bound_box:
        p = obj.matrix_world @ Vector(corner)
        # glTF exporter standard +Y up: (x,y,z)_Blender → (x,z,-y)_glTF.
        corners.append((p.x, p.z, -p.y))
bounds = {'min': [min(p[i] for p in corners) for i in range(3)],
          'max': [max(p[i] for p in corners) for i in range(3)],
          'coordinateSystem': 'glTF +Y up; visual coordinates, physical scale unverified'}
output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB',
    export_yup=True, export_animations=False, export_cameras=False, export_lights=False,
    export_draco_mesh_compression_enable=False, export_image_format='AUTO',
    export_materials='EXPORT', export_extras=False)
changes.append('Standard Blender Z-up → glTF Y-up axis conversion; all images/buffers embedded in GLB2.')
Path(args.report).write_text(json.dumps({'blenderVersion': bpy.app.version_string,
    'transformations': changes, 'bounds': bounds, 'meshes': len(objects),
    'sourceVertices': vertices, 'triangles': triangles}, ensure_ascii=False, indent=2) + '\n')
print('PREPARED', args.id, json.dumps({'meshes': len(objects), 'triangles': triangles, 'bounds': bounds}))
