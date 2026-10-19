"""Read the retained Allegro/Robotiq MJCF subset. No MuJoCo or upstream code runs.

This resolves XML defaults, not physics. Collision-only geometry and constraints
remain evidence and are not exported as invented manufacturing components.
"""
import copy
import json
import math
import pathlib
import sys
import xml.etree.ElementTree as ET


def vector(value, default, length):
    result = [float(item) for item in (value if value is not None else default).split()]
    if len(result) != length or not all(math.isfinite(item) for item in result):
        raise ValueError('Expected finite %d-vector' % length)
    return result


def transform(attributes):
    if any(key in attributes for key in ('euler', 'axisangle', 'xyaxes', 'zaxis', 'fromto')):
        raise ValueError('Pinned subset supports pos/quat transforms only')
    quat = vector(attributes.get('quat'), '1 0 0 0', 4)
    if math.hypot(*quat) == 0:
        raise ValueError('Zero quaternion')
    return {'pos': vector(attributes.get('pos'), '0 0 0', 3), 'quatWxyz': quat}


def tree(element):
    return {'type': element.tag, 'attributes': dict(element.attrib),
            'children': [tree(child) for child in element]}


def parse(source):
    text = pathlib.Path(source).read_text(encoding='utf-8')
    if '<!DOCTYPE' in text or '<!ENTITY' in text:
        raise ValueError('XML entity declarations are unsupported')
    root = ET.fromstring(text)
    if root.tag != 'mujoco':
        raise ValueError('Expected MJCF mujoco root')
    allowed = {'compiler', 'option', 'default', 'asset', 'worldbody', 'contact', 'tendon', 'equality', 'actuator', 'keyframe'}
    if any(child.tag not in allowed for child in root):
        raise ValueError('Unsupported top-level MJCF syntax')
    if any(item.tag in {'include', 'plugin', 'composite', 'flexcomp', 'replicate', 'attach', 'frame'} for item in root.iter()):
        raise ValueError('External/compound MJCF syntax is unsupported')
    compiler = root.find('compiler')
    if compiler is None or compiler.get('angle') != 'radian' or compiler.get('meshdir') != 'assets':
        raise ValueError('Expected explicit radian and assets mesh directory')
    if set(compiler.attrib) - {'angle', 'meshdir', 'autolimits'}:
        raise ValueError('Unhandled compiler option may change geometry')
    classes = {'main': {}}
    class_parents = {'main': None}

    def defaults(element, parent='main', top=False):
        name = element.get('class', 'main' if top else None)
        if not name or (name in classes and name != 'main'):
            raise ValueError('Defaults require unique classes')
        values = copy.deepcopy(classes[parent])
        for child in element:
            if child.tag == 'default':
                continue
            if list(child):
                raise ValueError('Unsupported nested default element')
            values[child.tag] = {**values.get(child.tag, {}), **child.attrib}
        classes[name] = values
        class_parents[name] = None if name == 'main' else parent
        for child in element.findall('default'):
            defaults(child, name)

    for element in root.findall('default'):
        defaults(element, top=True)

    def resolved(element, inherited='main'):
        name = element.get('class', inherited)
        if name not in classes:
            raise ValueError('Unknown defaults class: ' + name)
        return {**classes[name].get(element.tag, {}), **element.attrib}, name

    def under(name, ancestor):
        while name is not None:
            if name == ancestor:
                return True
            name = class_parents[name]
        return False

    meshes = []
    asset = root.find('asset')
    if asset is None or any(item.tag not in {'mesh', 'material'} for item in asset):
        raise ValueError('Pinned asset subset supports STL meshes and materials')
    for element in asset.findall('mesh'):
        # Body childclass never applies to assets outside that body subtree.
        attributes, class_name = resolved(element)
        if set(attributes) - {'name', 'file', 'scale', 'class'}:
            raise ValueError('Unhandled mesh transform or compiler attribute')
        file = attributes.get('file', '')
        relative = pathlib.PurePosixPath(file)
        if '\\' in file or ':' in file or relative.is_absolute() or '..' in relative.parts or len(relative.parts) != 1 or relative.suffix.lower() != '.stl':
            raise ValueError('Only retained local STL assets are supported')
        scale = vector(attributes.get('scale'), '1 1 1', 3)
        if any(value <= 0 for value in scale):
            raise ValueError('Mesh scale must be positive in this subset')
        meshes.append({'name': attributes.get('name', relative.stem), 'file': file,
                       'scale': scale, 'class': class_name, 'sourceAttributes': dict(element.attrib)})
    if len({mesh['name'] for mesh in meshes}) != len(meshes):
        raise ValueError('Duplicate source mesh names')
    mesh_names = {mesh['name'] for mesh in meshes}
    bodies = []

    def walk(element, parent=None, inherited='main'):
        if set(element.attrib) - {'name', 'pos', 'quat', 'childclass'}:
            raise ValueError('Unhandled body transform/attribute')
        name = element.get('name')
        if not name:
            raise ValueError('Source body needs an explicit stable name')
        childclass = element.get('childclass', inherited)
        if childclass not in classes:
            raise ValueError('Unknown body childclass')
        if any(child.tag not in {'body', 'geom', 'joint', 'inertial', 'site'} for child in element):
            raise ValueError('Unhandled body element (free/ball bodies are unsupported)')
        visuals, geoms, joints = [], [], []
        for index, geom in enumerate(element.findall('geom')):
            attributes, class_name = resolved(geom, childclass)
            placement = transform(attributes)
            record = {'sourceGeomIndex': index, 'class': class_name, 'sourceAttributes': dict(geom.attrib),
                      'resolvedAttributes': attributes, **placement}
            geoms.append(record)
            if under(class_name, 'visual'):
                if attributes.get('type') != 'mesh' or attributes.get('mesh') not in mesh_names:
                    raise ValueError('Visual subset requires a declared retained mesh')
                unsupported = {'hfield', 'fromto', 'fitscale', 'size'} & set(attributes)
                if unsupported:
                    raise ValueError('Unhandled visual sizing/transform')
                visuals.append({**record, 'mesh': attributes['mesh'], 'material': attributes.get('material')})
            elif not under(class_name, 'collision'):
                raise ValueError('Geom must derive from visual or collision class')
        for joint in element.findall('joint'):
            attributes, class_name = resolved(joint, childclass)
            allowed_joint = {'name', 'class', 'type', 'axis', 'pos', 'range', 'ref', 'limited', 'damping', 'armature', 'stiffness', 'springref', 'solimplimit', 'solreflimit'}
            if set(attributes) - allowed_joint or attributes.get('type', 'hinge') != 'hinge':
                raise ValueError('Unhandled source joint; only pinned hinge subset is supported')
            axis = vector(attributes.get('axis'), '0 0 1', 3)
            joint_range = vector(attributes.get('range'), '0 0', 2)
            ref = float(attributes.get('ref', '0'))
            if not joint.get('name') or math.hypot(*axis) == 0 or joint_range[0] > joint_range[1] or not math.isfinite(ref):
                raise ValueError('Invalid named hinge definition')
            limited = attributes.get('limited', 'auto')
            if limited not in {'auto', 'true', 'false'}:
                raise ValueError('Unsupported limited flag')
            if limited == 'auto':
                if 'range' in attributes and compiler.get('autolimits') != 'true':
                    raise ValueError('Explicit autolimits=true required for inherited ranges')
                limited = 'true' if 'range' in attributes else 'false'
            joints.append({'name': joint.get('name'), 'type': 'hinge', 'axis': axis,
                           'pos': vector(attributes.get('pos'), '0 0 0', 3), 'range': joint_range,
                           'limited': limited == 'true', 'ref': ref, 'class': class_name,
                           'sourceAttributes': dict(joint.attrib), 'resolvedAttributes': attributes})
        bodies.append({'name': name, 'parent': parent, **transform(element.attrib), 'childclass': childclass,
                       'visuals': visuals, 'geoms': geoms, 'joints': joints,
                       'inertialSource': dict(element.find('inertial').attrib) if element.find('inertial') is not None else None,
                       'sites': [tree(item) for item in element.findall('site')]})
        for body in element.findall('body'):
            walk(body, name, childclass)

    world = root.find('worldbody')
    if world is None or any(item.tag != 'body' for item in world):
        raise ValueError('Pinned worldbody subset contains only retained robot bodies')
    for body in world:
        walk(body)
    if not bodies or len({body['name'] for body in bodies}) != len(bodies):
        raise ValueError('Source bodies must have unique names')
    joints = [joint for body in bodies for joint in body['joints']]
    if len({joint['name'] for joint in joints}) != len(joints):
        raise ValueError('Source joints must have unique names')
    equalities = []
    for item in root.findall('equality/*'):
        if item.tag not in {'connect', 'joint'}:
            raise ValueError('Unhandled equality constraint kind')
        equalities.append({'type': item.tag, 'sourceAttributes': dict(item.attrib)})
    return {'robotName': root.get('model'), 'compiler': dict(compiler.attrib), 'bodies': bodies, 'meshes': meshes,
            'equalities': equalities, 'constraintsSolved': False,
            'actuators': [tree(item) for item in root.findall('actuator/*')],
            'tendons': [tree(item) for item in root.findall('tendon/*')],
            'contacts': [tree(item) for item in root.findall('contact/*')],
            'keyframes': [dict(item.attrib) for item in root.findall('keyframe/key')],
            'defaultsSource': [tree(item) for item in root.findall('default')]}


if __name__ == '__main__':
    print(json.dumps(parse(sys.argv[1]), ensure_ascii=True, allow_nan=False))
