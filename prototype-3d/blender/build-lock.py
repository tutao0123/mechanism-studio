"""Reproducible teaching lock assets, authored in Blender metres.

Run with the adjacent build-lock.ps1. spec.json is supplied by the shared JS
model. No mechanical animation, drivers or physics are exported. Dimensions
are illustrative; the source model tests a plane, not cylindrical contact.
"""
import bpy
import json
import math
import hashlib
import struct
from pathlib import Path
from mathutils import Vector, Matrix

PROJECT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT / "assets"
SPEC_FILE = PROJECT / "spec.json"
CONFIG = json.loads(SPEC_FILE.read_text(encoding="utf-8-sig"))
S = CONFIG["spec"]
U = CONFIG["metersPerUnit"]
ASSETS.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.unit_settings.scale_length = 1.0
bpy.context.preferences.filepaths.temporary_directory = str(PROJECT.parent / ".tools" / "blender-temp")
PARTS = []
DETAILS = []
CIRCLE_SAMPLES = 128


def material(name, rgb, metal=0.0, rough=0.4):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*rgb, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    return mat


MATS = {
    "shell": material("Blue anodised shell", (0.09, 0.28, 0.46), 0.45, 0.32),
    "plug": material("Warm brass plug", (0.65, 0.48, 0.21), 0.62, 0.32),
    "lower": material("Silver key pins", (0.7, 0.79, 0.84), 0.72, 0.28),
    "driver": material("Blue driver pins", (0.1, 0.48, 0.78), 0.38, 0.28),
    "spring": material("Orange spring wire", (0.96, 0.31, 0.07), 0.45, 0.32),
    "key": material("Golden key", (0.91, 0.63, 0.16), 0.72, 0.25),
    "base": material("Blue workshop base", (0.045, 0.12, 0.19), 0.28, 0.5),
    "screw": material("Steel fixtures", (0.38, 0.47, 0.53), 0.72, 0.26),
}


def mesh_object(name, verts, faces, mat=None):
    mesh = bpy.data.meshes.new(name + "-mesh")
    mesh.from_pydata([tuple(c * U for c in v) for v in verts], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        mesh.materials.append(mat)
    return obj


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def box(name, center, size, mat=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=tuple(v * U for v in center))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = tuple(v * U for v in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj


def cylinder(name, radius, depth, center, axis="Z", mat=None, vertices=CIRCLE_SAMPLES):
    rot = {"X": (0, math.pi / 2, 0), "Y": (math.pi / 2, 0, 0), "Z": (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius * U,
                                      depth=depth * U, location=tuple(v * U for v in center), rotation=rot)
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj


def boolean(obj, cutter, operation="DIFFERENCE"):
    activate(obj)
    mod = obj.modifiers.new("Teaching geometry cut", "BOOLEAN")
    mod.operation = operation
    mod.solver = "EXACT"
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def bevel(obj, width=0.35, segments=3):
    activate(obj)
    mod = obj.modifiers.new("Edge bevel", "BEVEL")
    mod.width = width * U
    mod.segments = segments
    mod.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    mod = obj.modifiers.new("Weighted shading", "WEIGHTED_NORMAL")
    mod.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=mod.name)


def join_details(owner, details):
    """Keep decoration in its semantic/motion owner, never a floating GLB node."""
    if not details:
        return owner
    activate(owner)
    for detail in details:
        detail.select_set(True)
    bpy.ops.object.join()
    return owner


def note_detail(owner, kind, count=1):
    DETAILS.append({"owner": owner, "kind": kind, "count": count})


def axial_profile(name, profile, mat):
    """Axial shoulders and machined seams are actual contours, not drawn stripes."""
    n = CIRCLE_SAMPLES
    verts = [(x, r * math.cos(2 * math.pi * k / n), axis_z + r * math.sin(2 * math.pi * k / n))
             for x, r in profile for k in range(n)]
    faces = [tuple(reversed(range(n)))]
    for j in range(len(profile) - 1):
        faces.extend((j*n+k, j*n+(k+1)%n, (j+1)*n+(k+1)%n, (j+1)*n+k) for k in range(n))
    faces.append(tuple((len(profile)-1)*n+k for k in range(n)))
    return mesh_object(name, verts, faces, mat)


def annular_collar(name, outer, inner, depth, center, mat, axis="Z", finish=True):
    obj = cylinder(name, outer, depth, center, axis, mat)
    boolean(obj, cylinder(name + "-bore", inner, depth + 2, center, axis))
    if finish:
        bevel(obj, min(0.12, depth / 5), segments=2)
    return obj


def slotted_screw(name, center, radius=1.55, height=1.5, finish=True, vertices=72):
    head = cylinder(name, radius, height, center, mat=MATS["screw"], vertices=vertices)
    # Cut a real slot only into the head, leaving a continuous seated underside.
    boolean(head, box(name + "-slot", (center[0], center[1], center[2] + height/2),
                      (radius * 1.65, 0.42, 0.62)))
    if finish:
        bevel(head, 0.1, segments=2)
    return head


def rounded_rectangle(name, center, width, height, thickness, corner, mat=None):
    """Rounded planar X/Z outline extruded in Y; bevel only its own bow faces."""
    cx, cy, cz = center
    outline = []
    for dx, dz, angle0 in ((1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)):
        corner_x = cx + dx * (width/2 - corner)
        corner_z = cz + dz * (height/2 - corner)
        for k in range(17):
            a = math.radians(angle0 + 90 * k / 16)
            outline.append((corner_x + corner * math.cos(a), corner_z + corner * math.sin(a)))
    outline.reverse()
    n = len(outline)
    verts = [(x, cy+y, z) for y in (-thickness/2, thickness/2) for x,z in outline]
    faces = [tuple(reversed(range(n))), tuple(n+j for j in range(n))]
    faces.extend((j,(j+1)%n,n+(j+1)%n,n+j) for j in range(n))
    return mesh_object(name, verts, faces, mat)


def set_origin(obj, origin):
    origin_m = Vector(tuple(v * U for v in origin))
    obj.data.transform(Matrix.Translation(obj.location - origin_m))
    obj.location = origin_m


def register(obj, part_id, origin=(0, 0, 0), category="fixed", notes=""):
    set_origin(obj, origin)
    obj.name = part_id
    obj["part_id"] = part_id
    obj["category"] = category
    obj["teaching_asset"] = True
    obj["not_physics_simulation"] = True
    if notes:
        obj["notes"] = notes
    PARTS.append(obj)
    return obj


def split_front_back(obj, stem, origin, category):
    other = obj.copy()
    other.data = obj.data.copy()
    bpy.context.collection.objects.link(other)
    boolean(obj, box("cut-negative-y", (80, -100, 60), (400, 200, 400)))
    boolean(other, box("cut-positive-y", (80, 100, 60), (400, 200, 400)))
    bevel(obj, 0.22, segments=2)
    bevel(other, 0.22, segments=2)
    return (register(obj, stem + "-back", origin, category),
            register(other, stem + "-front", origin, category))


start = S["plugStartX"]
length = S["plugLength"]
axis_z = S["plugAxisZ"]
radius = S["plugRadius"]
cx = start + length / 2
origin = (0, 0, axis_z)

# Shell has a real axial bore, an upper pin chamber and five vertical holes.
shell = axial_profile("shell-body", [
    (start,radius+4.7),(start+0.35,radius+6.15),(start+1.95,radius+6.15),(start+2.25,radius+5),
    (start+4.7,radius+5),(start+5.0,radius+4.35),(start+5.8,radius+4.35),(start+6.1,radius+5),
    (start+length-6.1,radius+5),(start+length-5.8,radius+4.35),(start+length-5.0,radius+4.35),
    (start+length-4.7,radius+5),(start+length-2.25,radius+5),(start+length-1.95,radius+6.15),
    (start+length-0.35,radius+6.15),(start+length,radius+4.7)], MATS["shell"])
boolean(shell, box("pin-chamber", (cx, 0, 91), (length, 18, 60)), "UNION")
boolean(shell, cylinder("plug-bore", radius + 0.25, length + 4, (cx, 0, axis_z), "X"))
for x in S["pinXs"]:
    boolean(shell, cylinder("shell-pin-hole", S["pinRadius"] + 0.7, 88, (x, 0, 86)))
shell_details = []
for x in S["pinXs"]:
    # The spring touches the original top plane at z=118; these fixed seats
    # surround its open chamber, with their undersides sunk into the shell.
    shell_details.append(annular_collar("spring-seat-collar", 6.1, S["pinRadius"]+0.7,
                                       1.0, (x,0,121.2), MATS["shell"], finish=False))
for x in (40,64,88,112):
    for y in (-6.5,6.5):
        shell_details.append(slotted_screw("cap-retainer-screw", (x,y,121.55), finish=False))
# Joining overlapping fixture solids first creates self-intersecting topology
# that can make a subsequent section Boolean a no-op. Union these sunk-in
# details before sectioning; the exported half shells are actually cut solids.
for detail in shell_details:
    boolean(shell, detail, "UNION")
note_detail("shell-back/front", "axial bearing shoulders", 2)
note_detail("shell-back/front", "circumferential recessed seams", 2)
note_detail("shell-back/front", "spring chamber seat collars", 5)
note_detail("shell-back/front", "seated slotted retainer heads", 8)
shell_back, shell_front = split_front_back(shell, "shell", (0, 0, 0), "shell")

# The central keyway and pin holes remain open in both cut halves.
plug = axial_profile("plug-body", [
    (start,radius-0.5),(start+0.5,radius),(start+3,radius),
    (start+3.3,radius-0.75),(start+4.1,radius-0.75),(start+4.4,radius),
    (start+length-4.4,radius),(start+length-4.1,radius-0.75),
    (start+length-3.3,radius-0.75),(start+length-3,radius),
    (start+length-0.5,radius),(start+length,radius-0.5)], MATS["plug"])
boolean(plug, box("keyway", (cx, 0, 30), (length + 8, 6.6, 44)))
for x in S["pinXs"]:
    boolean(plug, cylinder("plug-pin-hole", S["pinRadius"] + 0.45, 74, (x, 0, 38)))
plug_back, plug_front = split_front_back(plug, "plug", origin, "plug")
note_detail("plug-back/front", "chamfered end shoulders", 2)
note_detail("plug-back/front", "shallow ring grooves within original bore", 2)


def lathe_pin(name, profile, mat):
    n = 72
    verts = [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n), z)
             for z, r in profile for k in range(n)]
    faces = [tuple(reversed(range(n)))]
    for j in range(len(profile) - 1):
        faces.extend((j*n+k, j*n+(k+1)%n, (j+1)*n+(k+1)%n, (j+1)*n+k) for k in range(n))
    faces.append(tuple((len(profile)-1)*n+k for k in range(n)))
    obj = mesh_object(name, verts, faces, mat)
    for poly in obj.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    return obj


def spring_mesh(name):
    # Round wire at 18 mm reference height, then normalise mesh Z to 0..1 m.
    h, r, wire, turns, segments, sides = 18, 3.5, 0.56, 5.5, 352, 12
    verts, faces = [], []
    for j in range(segments + 1):
        t = j / segments
        angle = t * turns * 2 * math.pi
        radial = Vector((math.cos(angle), math.sin(angle), 0))
        tangent = Vector((-r*math.sin(angle), r*math.cos(angle), (h-2*wire)/(turns*2*math.pi))).normalized()
        cross = tangent.cross(radial).normalized()
        center = Vector((r*math.cos(angle), r*math.sin(angle), wire+t*(h-2*wire)))
        for k in range(sides):
            a = 2 * math.pi * k / sides
            p = center + wire * (math.cos(a)*radial + math.sin(a)*cross)
            verts.append(tuple(p))
    z_min, z_max = min(v[2] for v in verts), max(v[2] for v in verts)
    verts = [(x, y, (z-z_min)/(z_max-z_min)/U) for x, y, z in verts]
    for j in range(segments):
        faces.extend((j*sides+k, j*sides+(k+1)%sides, (j+1)*sides+(k+1)%sides, (j+1)*sides+k) for k in range(sides))
    faces.extend([tuple(reversed(range(sides))), tuple(segments*sides+k for k in range(sides))])
    obj = mesh_object(name, verts, faces, MATS["spring"])
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


for i, (x, pin_length) in enumerate(zip(S["pinXs"], S["pinLengths"]), 1):
    pr = S["pinRadius"]
    lower = lathe_pin("lower", [(0,0.12),(4.8,pr),(pin_length-3.0,pr),
                                (pin_length-2.7,pr-0.16),(pin_length-2.1,pr-0.16),
                                (pin_length-1.8,pr),(pin_length-0.65,pr),(pin_length,pr-0.45)], MATS["lower"])
    lower.location.x = x * U
    register(lower, f"lower-{i}", (x, 0, 0), "lower", "Conical teaching contact; bottom local Z=0.")
    driver = lathe_pin("driver", [(0,pr-0.4),(0.5,pr),(2.6,pr),(2.85,pr-0.16),
                                  (3.4,pr-0.16),(3.65,pr),(S["driverLength"]-1.0,pr),
                                  (S["driverLength"]-0.55,pr-0.4),(S["driverLength"],pr-0.4)], MATS["driver"])
    driver.location.x = x * U
    register(driver, f"driver-{i}", (x, 0, 0), "driver", "Bottom local Z=0; model drives translation.")
    spring = spring_mesh("spring")
    spring.location.x = x * U
    register(spring, f"spring-{i}", (x, 0, 0), "spring", "Local Z bounds 0..1 metre; scale Z to requested height in metres.")
note_detail("lower-1..5", "fine upper pin relief rings", 5)
note_detail("driver-1..5", "fine lower pin relief rings and upper seats", 5)


def key_mesh(key):
    outline = [(x, S["restTipZ"] + height) for x, height in key["outline"]]
    polygon = outline + [(155, 8), (4, 8)]
    n = len(polygon)
    verts = [(x, y, z) for y in (-2.4, 2.4) for x, z in polygon]
    faces = [tuple(reversed(range(n))), tuple(n+j for j in range(n))]
    faces.extend((j, (j+1)%n, n+(j+1)%n, n+j) for j in range(n))
    obj = mesh_object("key", verts, faces, MATS["key"])
    for side in (-1,1):
        # Closed, rounded guide flute on each lower broad face. Its full
        # z=10.475..11.525 range stays above bottom=8 and below every contact
        # contour point (minimum model top=14); no blade edge is bevelled.
        boolean(obj, rounded_rectangle("blade-guide-flute",(80,side*2.35,11),
                                        136,1.05,0.7,0.5))
    # Handle sits beyond the plug entrance; an actual through-hole makes it readable.
    handle = rounded_rectangle("key-bow", (171,0,21), 33,31,4.8,6.1,MATS["key"])
    boolean(handle, cylinder("bow-through-hole",7.1,14,(175,0,23),"Y"))
    for side in (-1,1):
        # A shallow inset frame is cut into each broad face, plus three grip
        # flutes safely beyond the blade/contact polygon at x<=155.
        frame = rounded_rectangle("bow-inset-frame",(171,side*2.35,21),28,26,0.7,4.8)
        boolean(frame, rounded_rectangle("bow-inset-frame-inner",(171,side*2.35,21),26.8,24.8,2,4.2))
        boolean(handle, frame)
        for x in (160.6,162.3,164.0):
            boolean(handle, box("bow-grip-flute",(x,side*2.35,21),(0.42,0.7,13)))
    bevel(handle, 0.32)
    join_details(obj, [handle])
    # Keep the model's exact key contour: no bevel on the contact boundary.
    return register(obj, "key-" + key["id"], origin, "key", "Exact piecewise-linear model outline; pivot at lock axis.")


for key in CONFIG["keys"]:
    key_mesh(key)
note_detail("key-correct/wrong/blank", "rounded bow with bevelled physical hole", 3)
note_detail("key-correct/wrong/blank", "bow face inset frames", 6)
note_detail("key-correct/wrong/blank", "shallow grip flutes", 18)
note_detail("key-correct/wrong/blank", "closed rounded lower blade guide flutes", 6)

cam = box("cam", (0, 0, axis_z + 13), (8, 10, 36), MATS["plug"])
boolean(cam, cylinder("cam-hub", 10, 8, (3, 0, axis_z), "X", MATS["plug"]), "UNION")
bevel(cam, 0.75)
register(cam, "cam", origin, "cam", "Rear cam at negative-X end; hub reaches x=7 mm to meet plug starting x=6 mm.")

base = box("base", (89, 0, 0), (224, 106, 6), MATS["base"])
bevel(base, 2.0)
# One inset contour frame gives the broad plate a machined boundary without
# covering it in hatch marks. Reuse the rounded X/Z profile, rotated into XY.
frame = rounded_rectangle("base-inset-contour",(89,0,0),212,94,0.9,4.5)
frame.rotation_euler.x = math.pi/2
frame.location.z = 2.85*U
inner = rounded_rectangle("base-inset-contour-inner",(89,0,0),210.8,92.8,3,3.9)
inner.rotation_euler.x = math.pi/2
inner.location.z = 2.85*U
boolean(frame, inner)
boolean(base, frame)
note_detail("base", "closed inset perimeter groove", 1)
extras = []
for x in (0, 154):
    for y in (-35, 35):
        # These flush heads sit in shallow pockets on the existing foot axes;
        # each head underside is below the pocket floor, so it is seated.
        boolean(base, cylinder("foot-fastener-pocket",2.22,0.9,(x,y,3),vertices=48))
        extras.append(slotted_screw("flush-foot-fastener",(x,y,2.68),radius=2.05,
                                    height=0.6,vertices=48))
        foot = cylinder("base-foot", 8, 4, (x, y, -4), mat=MATS["base"], vertices=72)
        bevel(foot, 0.5)
        extras.append(foot)
for x in (16, 138):
    support = box("cradle-support", (x, 0, 8), (12, 54, 10), MATS["shell"])
    boolean(support, cylinder("cradle-cut", radius+5.15, 18, (x,0,axis_z), "X"))
    bevel(support, 0.65)
    extras.append(support)
    for y in (-23, 23):
        washer = annular_collar("cradle-washer",3.8,2.55,0.7,(x,y,13.2),MATS["screw"])
        extras.append(washer)
        screw = slotted_screw("cradle-screw",(x,y,13.85),radius=2.6,height=1.8)
        extras.append(screw)
# A single small, fixed identity plate; engraving is physical shallow recess,
# not invented dimension marks. Plate top is only 0.22mm above the base.
plate = box("five-pin-nameplate",(70,-40,3.11),(20,8,0.22),MATS["screw"])
bevel(plate,0.08,segments=2)
bpy.ops.object.text_add(location=(70*U,-40*U,3.13*U))
engraving = bpy.context.object
engraving.name = "five-pin-engraving-cutter"
engraving.data.body = "5 PIN"
engraving.data.size = 3.8*U
engraving.data.align_x = "CENTER"
engraving.data.align_y = "CENTER"
engraving.data.extrude = 0.14*U
activate(engraving)
bpy.ops.object.convert(target="MESH")
boolean(plate, bpy.context.object)
extras.append(plate)
join_details(base, extras)
register(base, "base", (0,0,0), "fixed")
note_detail("base", "seated cradle washers and slotted heads", 4)
note_detail("base", "flush foot-axis fastener pockets and slotted heads", 4)
note_detail("base", "shallow engraved 5 PIN identity plate", 1)

manifest_parts = []
for obj in PARTS:
    coords = [v.co for v in obj.data.vertices]
    mins = [min(v[i] for v in coords) for i in range(3)]
    maxs = [max(v[i] for v in coords) for i in range(3)]
    p = obj.location
    manifest_parts.append({"part_id": obj["part_id"], "nodeName": obj.name, "category": obj["category"],
                           "restBlenderMeters": list(p), "restGltfMeters": [p.x,p.z,-p.y],
                           "localBoundsBlenderMeters": {"min": mins, "max": maxs},
                           "localDimensionsBlenderMeters": [maxs[i]-mins[i] for i in range(3)],
                           "motionOwner": "web-model" if obj["category"] not in ("fixed","shell") else "static",
                           "meshVertices": len(coords), "meshPolygons": len(obj.data.polygons)})

for part in manifest_parts:
    pid = part["part_id"]
    bounds = part["localBoundsBlenderMeters"]
    if pid in ("shell-back", "plug-back"):
        assert bounds["min"][1] >= -1e-8, f"{pid} was not cut to the back half"
    elif pid in ("shell-front", "plug-front"):
        assert bounds["max"][1] <= 1e-8, f"{pid} was not cut to the front half"

bpy.ops.object.select_all(action="DESELECT")
for obj in PARTS:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ASSETS / "lock.glb"), export_format="GLB", use_selection=True,
                          export_extras=True, export_yup=True, export_apply=True,
                          export_animations=False, export_cameras=False, export_lights=False)

# Save a useful assembled teaching pose in the native Blender project.
for obj in PARTS:
    category = obj["category"]
    if category in ("lower", "driver", "spring"):
        i = int(obj["part_id"].split("-")[-1]) - 1
        tip = S["restTipZ"] + S["correctLifts"][i]
        joint = tip + S["pinLengths"][i]
        if category == "lower":
            obj.location.z = tip * U
        elif category == "driver":
            obj.location.z = joint * U
        else:
            obj.location.z = (joint + S["driverLength"]) * U
            obj.scale.z = (S["springTopZ"] - joint - S["driverLength"]) * U
    obj.hide_render = obj.name in ("shell-front", "plug-front", "key-wrong", "key-blank")
    obj.hide_set(obj.hide_render)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.view_settings.exposure = -2.5
scene.world = bpy.data.worlds.new("Studio world")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.11,0.14,0.19,1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
for name, pos, energy, size in [("Key light",(.13,-.18,.28),26,.24),("Fill light",(-.1,-.02,.18),12,.2),("Rim light",(.2,.2,.25),22,.2)]:
    bpy.ops.object.light_add(type="AREA", location=pos)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    light.rotation_euler = (Vector((.085,0,.055))-light.location).to_track_quat("-Z","Y").to_euler()
bpy.ops.object.camera_add(location=(.31,-.4,.24))
camera = bpy.context.object
camera.name = "Teaching section camera"
camera.rotation_euler = (Vector((.09,0,.055))-camera.location).to_track_quat("-Z","Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = .30
scene.camera = camera
scene.render.filepath = str(ASSETS / "lock-preview.png")
scene["description"] = "Illustrative five-pin lock; section teaching view; not physical simulation."
scene["glb_pose"] = "GLB uses neutral asset rest; this blend previews a fully seated matching key."
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "lock.blend"))
bpy.ops.render.render(write_still=True)

# Verify binary glTF nodes, geometry accessors and origin mapping from actual output.
blob = (ASSETS / "lock.glb").read_bytes()
magic, version, total = struct.unpack_from("<III", blob)
assert magic == 0x46546C67 and version == 2 and total == len(blob)
chunk_len, chunk_type = struct.unpack_from("<II", blob, 12)
assert chunk_type == 0x4E4F534A
glb = json.loads(blob[20:20+chunk_len].decode("utf-8"))
nodes = {n.get("extras",{}).get("part_id"): n for n in glb["nodes"] if n.get("extras",{}).get("part_id")}
assert len(nodes) == len(PARTS) == 24
assert not glb.get("animations")
assert all(not n.get("children") for n in nodes.values())
triangle_count = sum(glb["accessors"][p["indices"]]["count"] // 3
                     for mesh in glb["meshes"] for p in mesh["primitives"])
primitive_count = sum(len(mesh["primitives"]) for mesh in glb["meshes"])
for part in manifest_parts:
    node = nodes[part["part_id"]]
    actual = node.get("translation", [0,0,0])
    assert max(abs(a-b) for a,b in zip(actual, part["restGltfMeters"])) < 1e-7
    part["actualGltfTranslationMeters"] = actual
    part["actualGltfRotationQuaternion"] = node.get("rotation", [0,0,0,1])
    part["actualGltfScale"] = node.get("scale", [1,1,1])
    position_accessors = [glb["accessors"][primitive["attributes"]["POSITION"]]
                          for primitive in glb["meshes"][node["mesh"]]["primitives"]]
    part["localBoundsGltfMeters"] = {
        "min": [min(a["min"][i] for a in position_accessors) for i in range(3)],
        "max": [max(a["max"][i] for a in position_accessors) for i in range(3)]}
manifest = {"schemaVersion":"0.1.0", "status":"generated-and-checked", "blenderVersion":bpy.app.version_string,
            "sourceSpecSha256":hashlib.sha256(SPEC_FILE.read_bytes()).hexdigest(),
            "assetUnits":"meters", "sourceUnits":CONFIG["units"], "metersPerSourceUnit":U,
            "axisMapping":"Blender [x,y,z] -> glTF [x,z,-y]", "lockAxisBlender":[1,0,0],
            "plugPivotBlenderMeters":[0,0,axis_z*U], "plugPivotGltfMeters":[0,axis_z*U,0],
            "parts":manifest_parts, "defaultHiddenPartIds":["shell-front","plug-front","key-wrong","key-blank"],
            "geometricFinesse":{"circleSamples":CIRCLE_SAMPLES,"pinCircleSamples":72,
                                "springPathSegments":352,"springTubeSides":12,
                                "semanticDetails":DETAILS,"detailCount":sum(d["count"] for d in DETAILS),
                                "keyContactProfilePreserved":True,"rigidDetailsJoinedToOriginalOwners":True},
            "glbState":"neutral asset rest; all nodes top-level; webpage owns all mechanism motion",
            "blendPreviewState":"matching key fully seated, angle zero; springs scaled for preview",
            "springGeometry":{"localZMinMeters":0,"localZMaxMeters":1,"referenceRoundWireHeightMm":18,
                              "localGltfYMinMeters":0,"localGltfYMaxMeters":1,
                              "runtimeScaleGltfY":"requested spring height in metres", "deformation":"teaching scale, not spring physics"},
            "limitations":["illustrative dimensions, not a real lock model","planar shear rule from shared model",
                           "no rigid-body physics or contact solver","conical lower tips are teaching geometry"],
            "verification":{"glbBinaryValid":True,"partIdsUnique":True,"topLevelParts":True,"nodeRestMatchesManifest":True,
                             "sectionHalvesActuallyCut":True,"animationCount":0,"partCount":len(PARTS),
                             "meshCount":len(glb.get("meshes",[])),"triangleCount":triangle_count,
                             "primitiveCount":primitive_count,"glbBytes":len(blob)},
            "download":{"version":"4.5.14 LTS","officialRouter":"https://mirror.blender.org/release/Blender4.5/blender-4.5.14-windows-x64.zip",
                        "officialChecksum":"https://mirror.blender.org/release/Blender4.5/blender-4.5.14.sha256",
                        "zipSha256":"b9533d2397ac1984db4466fb23a7a4649391cca93f6e84209f9bcc60d071c8b9"}}
(ASSETS / "asset-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
print("ASSET_CHECK_PASSED: 24 unique top-level parts, exact exported origins, no animation.")
print("GLB_BYTES:",len(blob))
print("GLB_TRIANGLES:",triangle_count)
print("SEMANTIC_DETAIL_INSTANCES:",sum(d["count"] for d in DETAILS))
