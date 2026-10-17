"""Parse retained MJCF XML only; do not load MuJoCo, plugins or upstream code.

This deliberately narrow adapter supports the pinned G1 file, not arbitrary MJCF.
"""
import json
import pathlib
import sys
import xml.etree.ElementTree as ET


def vector(value, default):
    return [float(item) for item in (value or default).split()]


def transform(element):
    if any(key in element.attrib for key in ('euler', 'axisangle', 'xyaxes', 'zaxis', 'fromto')):
        raise ValueError('This pinned adapter expects pos/quat transforms only')
    return {'pos': vector(element.get('pos'), '0 0 0'),
            'quatWxyz': vector(element.get('quat'), '1 0 0 0')}


def parse(source):
    root = ET.parse(source).getroot()
    compiler = root.find('compiler')
    if root.tag != 'mujoco' or root.findall('include') or compiler.get('angle') != 'radian' or compiler.get('meshdir') != 'assets':
        raise ValueError('Expected complete pinned G1 MJCF, radian angles and assets meshdir')
    assets = []
    for mesh in root.findall('asset/mesh'):
        file = mesh.get('file')
        rel = pathlib.PurePosixPath(file)
        if rel.is_absolute() or '..' in rel.parts or len(rel.parts) != 1 or rel.suffix.lower() != '.stl':
            raise ValueError('Only retained relative binary STL sources are allowed')
        if set(mesh.attrib) - {'name', 'file', 'scale'}:
            raise ValueError('Unhandled source mesh transform')
        assets.append({'name': mesh.get('name', rel.stem), 'file': file, 'scale': vector(mesh.get('scale'), '1 1 1')})
    bodies = []

    def walk(body, parent=None):
        name = body.get('name')
        visuals = []
        for index, geom in enumerate(body.findall('geom')):
            if geom.get('class') != 'visual':
                continue
            if not geom.get('mesh') or geom.get('type', 'mesh') != 'mesh':
                raise ValueError('Expected visual mesh')
            visuals.append({'sourceGeomIndex': index, 'mesh': geom.get('mesh'), 'material': geom.get('material', 'metal'), **transform(geom)})
        joints = []
        for joint in body.findall('joint'):
            if set(joint.attrib) - {'name', 'axis', 'range', 'actuatorfrcrange', 'type', 'pos'}:
                raise ValueError('Unhandled joint attribute')
            joints.append({'name': joint.get('name'), 'type': joint.get('type', 'hinge'),
                           'axis': vector(joint.get('axis'), '0 0 1'), 'pos': vector(joint.get('pos'), '0 0 0'),
                           'range': vector(joint.get('range'), '0 0'), 'sourceAttributes': dict(joint.attrib)})
        free = body.find('freejoint')
        inertial = body.find('inertial')
        bodies.append({'name': name, 'parent': parent, **transform(body), 'visuals': visuals, 'joints': joints,
                       'freeJoint': dict(free.attrib) if free is not None else None,
                       'inertialSource': dict(inertial.attrib) if inertial is not None else None})
        for child in body.findall('body'):
            walk(child, name)

    for body in root.findall('worldbody/body'):
        walk(body)
    if len({body['name'] for body in bodies}) != len(bodies):
        raise ValueError('Source body names must be unique')
    return {'robotName': root.get('model'), 'bodies': bodies, 'meshes': assets,
            'keyframes': [dict(key.attrib) for key in root.findall('keyframe/key')],
            'actuators': [{'type': actuator.tag, **dict(actuator.attrib)} for actuator in root.findall('actuator/*')]}


if __name__ == '__main__':
    print(json.dumps(parse(sys.argv[1]), ensure_ascii=True))
