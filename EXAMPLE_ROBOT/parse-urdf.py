"""Read retained URDF data only; never load plugins or execute upstream code."""
import json
import pathlib
import sys
import xml.etree.ElementTree as ET


def vector(text, default):
    return [float(value) for value in (text or default).split()]


def origin(element):
    value = element.find('origin')
    return {
        'xyz': vector(value.get('xyz') if value is not None else None, '0 0 0'),
        'rpy': vector(value.get('rpy') if value is not None else None, '0 0 0'),
    }


def parse_urdf(source):
    root = ET.parse(source).getroot()
    if root.tag != 'robot':
        raise ValueError('Expected one URDF robot')
    links = []
    for link in root.findall('link'):
        visuals = []
        for visual in link.findall('visual'):
            mesh = visual.find('geometry/mesh')
            if mesh is None:
                raise ValueError('This adapter requires mesh visuals')
            filename = mesh.get('filename')
            rel = pathlib.PurePosixPath(filename)
            if rel.is_absolute() or '..' in rel.parts or not filename.startswith('meshes/'):
                raise ValueError('Only retained relative meshes/ sources are allowed')
            visuals.append({'origin': origin(visual), 'mesh': filename, 'scale': vector(mesh.get('scale'), '1 1 1')})
        links.append({'name': link.get('name'), 'visuals': visuals})
    joints = []
    for joint in root.findall('joint'):
        axis, limit, mimic = joint.find('axis'), joint.find('limit'), joint.find('mimic')
        record = {
            'name': joint.get('name'), 'type': joint.get('type'),
            'parent': joint.find('parent').get('link'), 'child': joint.find('child').get('link'),
            'origin': origin(joint), 'axis': vector(axis.get('xyz') if axis is not None else None, '1 0 0'),
            'limit': {key: float(value) for key, value in limit.attrib.items()} if limit is not None else {},
        }
        if mimic is not None:
            record['mimic'] = {'joint': mimic.get('joint'), 'multiplier': float(mimic.get('multiplier', 1)), 'offset': float(mimic.get('offset', 0))}
        joints.append(record)
    return {'robotName': root.get('name'), 'links': links, 'joints': joints}


if __name__ == '__main__':
    print(json.dumps(parse_urdf(sys.argv[1]), ensure_ascii=True))
