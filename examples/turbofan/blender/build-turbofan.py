"""Original parameterized educational two-spool turbofan, Blender 4.5.
Run from this project with blender --background --python <this file>.
All design values are illustrative millimetres, converted to metres once.
"""
import bpy
import bmesh
import math
import json
import hashlib
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
EXAMPLE = HERE.parent
ASSETS = EXAMPLE / 'assets'
ASSETS.mkdir(exist_ok=True)
(EXAMPLE / '.cache').mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
bpy.context.preferences.filepaths.temporary_directory = str(EXAMPLE / '.cache')
M = .001
parts = []
materials = {}
for role, color in [('fixed', (.78,.79,.81,1)), ('low', (.64,.68,.72,1)), ('high', (.72,.73,.74,1)), ('liner', (.70,.71,.68,1)), ('base', (.88,.88,.87,1))]:
    material = bpy.data.materials.new(role)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = .63
    bsdf.inputs['Metallic'].default_value = .12
    materials[role] = material

assembly = bpy.data.objects.new('TURBOFAN / illustrative assembly', None)
scene.collection.objects.link(assembly)
assembly['assembly_id'] = 'turbofan'

def part(identifier, label, role, explode, hidden=False, detail=''):
    obj = bpy.data.objects.new(identifier, None)
    scene.collection.objects.link(obj)
    obj.parent = assembly
    obj['part_id'] = identifier
    obj['motionOwner'] = 'model' if role in ['low', 'high'] else 'static'
    obj['spool'] = role if role in ['low', 'high'] else 'none'
    parts.append({'part_id':identifier, 'parent_id':'turbofan', 'label_zh':label,
                  'role_zh':detail or label, 'motionOwner':obj['motionOwner'], 'spool':obj['spool'],
                  'rest':{'translation':[0,0,0], 'rotationX':0}, 'axis':[1,0,0] if role in ['low','high'] else None,
                  'pivot':[0,0,0], 'explode':explode, 'cutawayHidden':hidden})
    return obj, role

def mesh_object(name, vertices, faces, parent):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x*M,y*M,z*M) for x,y,z in vertices], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.parent = parent[0]
    obj.data.materials.append(materials[parent[1]])
    return obj

def tube(parent, x0, x1, outer0, inner0, outer1=None, inner1=None, start=0, end=2*math.pi, name='annular shell', segments=80):
    outer1 = outer0 if outer1 is None else outer1
    inner1 = inner0 if inner1 is None else inner1
    steps=max(8, round(segments*(end-start)/(2*math.pi)))
    full=abs(end-start-2*math.pi)<1e-6
    count=steps if full else steps+1
    vertices=[]
    for i in range(count):
        theta=start+(end-start)*i/steps
        for x,r in [(x0,outer0),(x1,outer1),(x0,inner0),(x1,inner1)]:
            vertices.append((x,r*math.sin(theta),r*math.cos(theta)))
    faces=[]
    for i in range(steps):
        a=i*4;b=((i+1)%count)*4
        faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
    if not full:
        faces.extend([(0,1,3,2),((count-1)*4,(count-1)*4+2,(count-1)*4+3,(count-1)*4+1)])
    return mesh_object(name,vertices,faces,parent)

def cylinder(parent, x, radius, depth, name='hub'):
    return tube(parent,x-depth/2,x+depth/2,radius,.02,name=name)

def blade(parent, x, theta, root, tip, chord, pitch=.55, sweep=10, name='blade'):
    vertices=[]
    stations=5
    for i in range(stations):
        t=i/(stations-1);radius=root+(tip-root)*t
        angle=theta+.16*t*t
        c=chord*(1-.36*t)
        twist=pitch*(1-.42*t)
        thickness=max(1.5,c*.085*(1-.35*t))
        # A thick, twisted closed section. The swept tip and five span stations
        # make blade geometry visibly different from flat radial rectangles.
        for axial,tangent in [(-c/2,-thickness/2),(c/2,-thickness/2),(c/2,thickness/2),(-c/2,thickness/2)]:
            dx=axial*math.cos(twist)-tangent*math.sin(twist)
            dt=axial*math.sin(twist)+tangent*math.cos(twist)
            vertices.append((x+dx+sweep*t*t,radius*math.sin(angle)+dt*math.cos(angle),radius*math.cos(angle)-dt*math.sin(angle)))
    faces=[(3,2,1,0)]
    for i in range(stations-1):
        a=i*4;b=(i+1)*4
        for j in range(4):faces.append((a+j,a+(j+1)%4,b+(j+1)%4,b+j))
    faces.append(tuple(range((stations-1)*4,stations*4)))
    return mesh_object(name,vertices,faces,parent)

def rotor(identifier,label,spool,x,tip,root,count,chord,pitch,offset):
    parent=part(identifier,label,spool,offset,detail=label+'；与'+('低压轴' if spool=='low' else '高压轴')+'保持同一规定角度。')
    tube(parent,x-5.5,x+5.5,root+5,27 if spool=='high' else 10,name='machined annular hub')
    tube(parent,x-8,x+8,root+8,root+3,name='blade root band')
    for i in range(count):blade(parent,x,2*math.pi*i/count,root,tip,chord,pitch,10 if identifier=='fan' else 3,'twisted blade %02d'%i)
    # Axial grooves and a short spinner make each row recognizable in section.
    for dx in [-7,7]:tube(parent,x+dx-1,x+dx+1,root+6,root+1,name='hub retaining shoulder')
    if identifier=='fan':tube(parent,x-55,x-8,4,.1,outer1=57,inner1=50,name='fan spinner nose')
    return parent

def stator(identifier,label,x,tip,root,count,offset):
    parent=part(identifier,label,'fixed',offset)
    tube(parent,x-7,x+7,tip+6,tip+1,start=0,end=math.pi,name='stationary case half')
    for i in range(count):blade(parent,x,2*math.pi*(i+.5)/count,root,tip,14,-.42,0,'fixed guide vane %02d'%i)
    return parent

rotor('fan','风扇','low',-440,218,51,26,47,.88,[-145,0,0])
low=part('low-shaft','低压实心轴','low',[-40,-95,-30])
cylinder(low,-20,11,845,'continuous LP shaft')
for x in [-432,-338,-278,310,375]:tube(low,x-8,x+8,18,10,name='LP shaft shoulder')
# The high spool is a real annular mesh around the central low spool. A fixed
# longitudinal display section exposes the concentric shaft relationship.
high=part('high-shaft','高压空心轴（预制剖面）','high',[25,100,20])
tube(high,-241,252,27,17,start=0,end=math.pi,name='hollow HP shaft section')
for x in [-234,244]:tube(high,x-5,x+5,31,17,name='HP shaft end annulus')

for index,(x,r) in enumerate([(-338,133),(-278,120)],1):
    rotor('lp-compressor-%d'%index,'低压压气机第%d级'%index,'low',x,r,34,24,21,.67,[-80-index*8,0,90])
    stator('lp-stator-%d'%index,'低压压气机静子第%d列'%index,x+28,r+2,38,24,[0,0,155+index*8])
for index,(x,r) in enumerate([(-217,108),(-163,99),(-109,91),(-55,83)],1):
    rotor('hp-compressor-%d'%index,'高压压气机第%d级'%index,'high',x,r,39,28,18,.61,[10,0,90+index*10])
    stator('hp-stator-%d'%index,'高压压气机静子第%d列'%index,x+25,r+2,43,28,[15,0,175+index*8])

burner=part('combustor','环形燃烧室（预制剖面）','liner',[25,0,195])
tube(burner,-10,195,112,105,start=0,end=math.pi,name='outer combustor liner')
tube(burner,-10,195,57,51,start=0,end=math.pi,name='inner combustor liner')
tube(burner,-12,0,111,55,start=0,end=math.pi,name='combustor dome')
for x in [26,85,144]:
    for i in range(9):
        a=(i+.5)*math.pi/9
        # Small thick circular ribs indicate liner perforation rows without
        # claiming a fluid model or copied manufacturer combustion geometry.
        bpy.ops.mesh.primitive_torus_add(major_segments=12,minor_segments=4,location=(x*M,108*M*math.sin(a),108*M*math.cos(a)),major_radius=3.3*M,minor_radius=.8*M)
        obj=bpy.context.object;obj.name='liner aperture rim';obj.parent=burner[0];obj.rotation_euler[0]=-a;obj.data.materials.append(materials['liner'])
front=part('combustor-front','燃烧室前半观察盖','liner',[25,-190,110],True)
tube(front,-10,195,112,105,start=math.pi,end=2*math.pi,name='removable display cover')

stator('turbine-stator-1','高压涡轮导向静子',211,99,43,30,[60,0,200])
rotor('hp-turbine','高压涡轮','high',245,97,39,30,23,.72,[95,0,110])
for index,x in enumerate([310,375],1):
    stator('turbine-stator-%d'%(index+1),'低压涡轮导向静子第%d列'%index,x-30,105+index*8,39,28,[80+index*15,0,195])
    rotor('lp-turbine-%d'%index,'低压涡轮第%d级'%index,'low',x,104+index*8,34,28,25,.76,[135+index*14,0,85])

# Two halves make the cutaway a source-defined observation state.
for hidden,start,end,suffix,offset in [(False,0,math.pi,'back',[0,125,0]),(True,math.pi,2*math.pi,'front',[0,-210,0])]:
    casing=part('casing-'+suffix,'外机匣'+('前半观察盖' if hidden else '后半'),'fixed',offset,hidden)
    tube(casing,-470,440,238,232,outer1=213,inner1=207,start=start,end=end,name='outer nacelle shell')
    for x,r in [(-465,237),(-380,235),(425,214)]:tube(casing,x-5,x+5,r+4,r-2,start=start,end=end,name='nacelle reinforcement flange')
    core=part('core-case'+('-front' if hidden else ''),'核心机匣'+('前半观察盖' if hidden else ''),'fixed',[0,-155 if hidden else 125,65],hidden)
    tube(core,-245,409,126,120,start=start,end=end,name='core casing shell')
    bypass=part('bypass-front' if hidden else 'bypass-duct','旁通通道'+('前半观察盖' if hidden else ''),'fixed',[0,-185 if hidden else 125,-75],hidden)
    tube(bypass,-383,425,218,213,outer1=201,inner1=196,start=start,end=end,name='bypass duct outer wall')
    nozzle=part('nozzle-front' if hidden else 'nozzle','核心尾喷管'+('前半观察盖' if hidden else ''),'fixed',[155,-150 if hidden else 80,-20],hidden)
    tube(nozzle,415,540,113,106,outer1=70,inner1=64,start=start,end=end,name='converging core nozzle')

for index,x in enumerate([-392,400],1):
    support=part('bearing-support-%d'%index,'轴承与固定支架第%d组'%index,'fixed',[0,100 if index==1 else -100,-80])
    tube(support,x-11,x+11,35,28,name='bearing outer race')
    tube(support,x-9,x+9,24,13,name='bearing inner race')
    for i in range(12):
        angle=2*math.pi*i/12
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=4.2*M,location=(x*M,25*M*math.sin(angle),25*M*math.cos(angle)))
        obj=bpy.context.object;obj.parent=support[0];obj.data.materials.append(materials['fixed'])
    for i in range(5):blade(support,x,2*math.pi*i/5,38,190,17,.05,0,'bearing support strut')

base=part('display-base','展示底座','base',[0,0,-170])
for x in [-320,320]:
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x*M,0,-252*M))
    obj=bpy.context.object;obj.name='mounting pedestal';obj.dimensions=(80*M,125*M,38*M);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.parent=base[0];obj.data.materials.append(materials['base'])
bpy.ops.mesh.primitive_cube_add(size=1,location=(15*M,0,-287*M))
obj=bpy.context.object;obj.name='machined display plinth';obj.dimensions=(1050*M,480*M,32*M);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.parent=base[0];obj.data.materials.append(materials['base'])

# Join only mesh children within each semantic part: stable source identity,
# fewer browser draw calls, and feature edges still follow the actual solids.
for record in parts:
    parent=bpy.data.objects[record['part_id']]
    children=[obj for obj in parent.children if obj.type=='MESH']
    if not children:raise RuntimeError('part has no geometry: '+parent.name)
    bpy.ops.object.select_all(action='DESELECT')
    for child in children:child.select_set(True)
    bpy.context.view_layer.objects.active=children[0]
    if len(children)>1:bpy.ops.object.join()
    solid=bpy.context.object;solid.name=parent.name+'/solid'
    # Convert operators' world-space location to the part's global-axis pivot.
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bm=bmesh.new();bm.from_mesh(solid.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(solid.data);bm.free();solid.data.update()
    solid['source_role']=record['motionOwner']

contract={'schemaVersion':'1.0.0','mechanismId':'teaching-two-spool-turbofan','assetRevision':'1',
          'units':{'body':'mm','asset':'m'},'coordinateMap':'0.001*[x,z,-y]',
          'source':'Original parameterized teaching geometry',
          'limitations':['Illustrative dimensions; no actual engine model','Prescribed independent angular motion, no forces or thermodynamics','Source-defined longitudinal cutaway; not engineering sectioning','Explosion vectors are display offsets, not maintenance or collision-free paths'],
          'parts':parts}
(ASSETS/'scene-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# A native editable camera/light setup, independent of web rendering.
bpy.ops.object.camera_add(location=(-1.4,-1.55,.9))
camera=bpy.context.object;camera.name='Teaching overview';camera.rotation_euler=(Vector((0,0,-.01))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=1.6;scene.camera=camera
for location,energy,size in [((-1,-1,2),400,3),((1,.5,1),180,2)]:
    bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='BLENDER_EEVEE_NEXT';scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world.color=(.8,.8,.8)
# Leave front covers hidden in the editable scene; export every part so the
# browser can switch between assembled shell and teaching section.
for record in parts:
    bpy.data.objects[record['part_id']]['cutaway_hidden']=record['cutawayHidden']
bpy.ops.object.select_all(action='DESELECT')
assembly.select_set(True)
for obj in assembly.children_recursive:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ASSETS/'turbofan.glb'),export_format='GLB',use_selection=True,
                          export_extras=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
for record in parts:
    if record['cutawayHidden']:
        cover=bpy.data.objects[record['part_id']]
        for obj in [cover]+list(cover.children_recursive):
            obj.hide_render=True
            obj.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS/'turbofan.blend'))
raw=(ASSETS/'turbofan.glb').read_bytes()
triangles=sum(len(poly.vertices)-2 for obj in assembly.children_recursive if obj.type=='MESH' for poly in obj.data.polygons)
report={'mechanismId':contract['mechanismId'],'partCount':len(parts),'meshCount':sum(obj.type=='MESH' for obj in assembly.children_recursive),
        'triangles':triangles,'glbBytes':len(raw),'glbSha256':hashlib.sha256(raw).hexdigest(),
        'builderSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'blenderVersion':bpy.app.version_string,
        'mcpUsed':False,'sourceGeometry':'original parameterized teaching mesh','bodyUnits':'mm','assetUnits':'m'}
(ASSETS/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('TURBOFAN_BUILD '+json.dumps(report))
