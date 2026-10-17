"""Original teaching geometry, driven by model.mjs build-input; no downloaded meshes."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'blender/build-input.json').read_text(encoding='utf-8'))
SPEC, REST = data['spec'], data['rest']
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1
parts = []
material = bpy.data.materials.new('Studio porcelain aluminium')
material.diffuse_color = (.76, .77, .76, 1)
material.use_nodes = True
material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .72

assembly = bpy.data.objects.new('Quadruped 8DOF assembly', None)
bpy.context.collection.objects.link(assembly)
assembly['assembly_id'] = 'quadruped'

def v(point): return tuple(float(c) * .001 for c in point)
def newpart(id, label, role, location=(0,0,0), angle=0, explode=(0,0,0), cutaway=False):
    obj = bpy.data.objects.new(id, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = assembly
    obj.location = v(location)
    obj.rotation_euler[1] = -math.radians(angle)
    obj['part_id'] = id
    obj['label_zh'] = label
    obj['motionOwner'] = 'model' if id.startswith(('thigh-','shin-','foot-')) else 'static'
    parts.append(dict(part_id=id, parent_id='quadruped', label_zh=label, role_zh=role,
        rest=dict(translation=list(location), rotationY=-math.radians(angle)),
        explode=v(explode), cutawayHidden=cutaway, motionOwner='model' if id.startswith(('thigh-','shin-','foot-')) else 'static'))
    return obj

def finish(obj, parent, name, smooth=False, bevel=0):
    obj.name = name
    obj.parent = parent
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new('Machined edge', 'BEVEL'); modifier.width = bevel * .001; modifier.segments = 2
        modifier = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL'); modifier.keep_sharp = True
    if smooth:
        for polygon in obj.data.polygons: polygon.use_smooth = True
    return obj

def box(parent, name, location, size, bevel=.5):
    bpy.ops.mesh.primitive_cube_add(size=1, location=v(location))
    obj=bpy.context.object; obj.dimensions=v(size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj,parent,name,bevel=bevel)

def cylinder(parent,name,location,radius,depth,axis='Y',vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius*.001, depth=depth*.001, location=v(location))
    obj=bpy.context.object
    if axis=='Y': obj.rotation_euler[0]=math.pi/2
    elif axis=='X': obj.rotation_euler[1]=math.pi/2
    finish(obj,parent,name)
    for face in obj.data.polygons: face.use_smooth = len(face.vertices)==4
    return obj

def ring(parent,name,location,outer,inner,depth,vertices=48):
    verts=[]
    for y in [-depth/2,depth/2]:
        for radius in [outer,inner]:
            for i in range(vertices):
                angle=2*math.pi*i/vertices
                verts.append(v((location[0]+radius*math.cos(angle),location[1]+y,location[2]+radius*math.sin(angle))))
    faces=[]
    n=vertices
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,2*n+j,2*n+i),(n+j,n+i,3*n+i,3*n+j),
            (j,i,n+i,n+j),(2*n+i,2*n+j,3*n+j,3*n+i)])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);finish(obj,parent,name)
    for i,face in enumerate(mesh.polygons): face.use_smooth=i%4<2
    return obj

def bolts(parent, center, radius, count=6, y=0):
    for i in range(count):
        angle=2*math.pi*i/count
        pos=(center[0]+radius*math.cos(angle),center[1]+y,center[2]+radius*math.sin(angle))
        cylinder(parent,'socket screw',pos,1.5,2,vertices=6)
        ring(parent,'screw rim',(pos[0],pos[1]+1.1,pos[2]),1.05,.55,.35,24)

body=newpart('body','机架与固定横梁','固定机身及四个髋支架；本例不模拟浮动基座。',explode=(0,0,20))
for y in [-65,65]: box(body,'longitudinal rail',(0,y,210),(280,12,22),1)
for x in [-122,0,122]: box(body,'cross member',(x,0,205),(12,142,14),1)
for x in [-110,110]:
    for y in [-65,65]:
        box(body,'motor mount tongue',(x,y*1.13,200),(36,28,8),1)
        for xx in [-10,10]: cylinder(body,'frame screw',(x+xx,y,224),2,3,'Z',6)

cover=newpart('cover','通风上盖','可隐藏上盖，观察电池和控制板。',explode=(0,0,115),cutaway=True)
for y in [-67,67]: box(cover,'cover lip',(0,y,238),(280,7,4),.8)
for x in [-137,137]: box(cover,'end lip',(x,0,238),(6,134,4),.8)
for x in range(-120,121,16): box(cover,'vent rib',(x,0,238),(7,125,3),.6)
for x in [-125,125]:
    for y in [-55,55]: cylinder(cover,'cover screw',(x,y,241),2.5,2,'Z',6)

battery=newpart('battery','电池示意模块','仅标示能源模块位置，不求解电路、电量或质量。',explode=(-45,0,65))
box(battery,'battery enclosure',(-63,0,220),(94,86,25),2)
for x in [-92,-35]: box(battery,'retaining strap',(x,0,233),(10,92,3),.8)
box(battery,'power socket',(-10,-18,220),(12,18,12),1)

board=newpart('controller','控制板与连接器','仅展示控制器布局；网页不发送硬件指令。',explode=(40,0,80))
box(board,'PCB',(63,0,220),(92,94,3),.5)
box(board,'processor',(61,0,224),(24,24,5),.4)
for x in [30,40,50,70,80,90]:
    for y in [-35,35]: box(board,'connector',(x,y,225),(6,15,8),.4)
for y in [-22,22]:
    for x in [35,45,80,90]: cylinder(board,'capacitor',(x,y,225),3.2,7,'Z',24)
for x in [25,100]:
    for y in [-40,40]: cylinder(board,'board standoff',(x,y,214),2.5,10,'Z',20)

for leg in REST['legs']:
    id, label, sign=leg['id'],leg['label'],1 if leg['y']>0 else -1
    hip=newpart('hip-'+id,label+'固定髋支架', '固定外展方向；髋俯仰由上腿驱动。',location=leg['hipPosition'],explode=(0,sign*70,30))
    box(hip,'servo body',(0,-sign*18,0),(36,30,32),1.5)
    ring(hip,'output bearing',(0,0,0),18,7,8)
    for x in [-16,16]:
        box(hip,'mount ear',(x,-sign*18,0),(8,32,8),.8)
        cylinder(hip,'mount fastener',(x,-sign*19,0),2.2,34,vertices=6)
    bolts(hip,(0,sign*5,0),13,6)
    upper=newpart('thigh-'+id,label+'上腿与膝电机','100 mm 两轴中心距；髋转角来自逆运动学。',location=leg['hipPosition'],angle=leg['hip'],explode=(0,sign*110,0))
    ring(upper,'hip rotor',(0,sign*9,0),13,4.5,5)
    for y in [-7,7]:
        for x in [-7,7]: box(upper,'upper side rail',(x,y,-50),(5,4,88),.6)
        for z in [-12,-43,-80]: box(upper,'upper bridge',(0,y,z),(18,4,6),.5)
    box(upper,'knee servo',(0,0,-SPEC['thigh']),(30,26,27),1.4)
    ring(upper,'knee bearing',(0,sign*15,-SPEC['thigh']),14,5,5)
    bolts(upper,(0,sign*19,-SPEC['thigh']),10,6)
    lower=newpart('shin-'+id,label+'小腿','115 mm 膝轴到足心；运动角为髋角加膝角。',location=leg['kneePosition'],angle=leg['hip']+leg['knee'],explode=(20,sign*150,-20))
    ring(lower,'knee rotor',(0,sign*22,0),11,4,4)
    # The working link is in the same plane as FK; a visible dogleg returns from its rotor.
    box(lower,'rotor spacer',(0,sign*10,-9),(14,28,8),.8)
    for x in [-5,5]: box(lower,'shin rail',(x,0,-60),(5,10,103),.7)
    for z in [-20,-58,-94]: box(lower,'shin bridge',(0,0,z),(14,12,5),.6)
    ring(lower,'ankle eye',(0,0,-SPEC['shin']),8,3,14)
    foot=newpart('foot-'+id,label+'球形足垫','足心来自正运动学，半径 10 mm；不模拟压缩或接触力。',location=leg['footPosition'],explode=(20,sign*180,-60))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=SPEC['footRadius']*.001,location=(0,0,0))
    finish(bpy.context.object,foot,'elastomer foot',smooth=True)
    cylinder(foot,'ankle pin',(0,0,0),3,18)
    for y in [-10,10]: cylinder(foot,'ankle cap',(0,y,0),4,2,vertices=6)

bpy.context.scene.world.color = (1,1,1)
for obj in bpy.context.scene.objects:
    if obj.type=='MESH': obj.select_set(False)
ROOT.joinpath('assets').mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/quadruped.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/quadruped.glb'),export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
contract=dict(schemaVersion='1.0.0',mechanismId=SPEC['mechanismId'],assetRevision='1',assemblyRoot='quadruped',asset='quadruped.glb',source='quadruped.blend',
    units=dict(body='mm',asset='m'),coordinateMap='0.001*[x,z,-y]',motionConvention='Flat semantic nodes receive absolute GLTF poses; independent display wrappers own explosion.',
    limitations=['原创示意尺寸，不对应量产机器人','8DOF：每腿髋俯仰与膝俯仰，外展固定','固定机身的正逆运动学与原地步态，不求解平衡、接触力或碰撞','网格教学资产，不是工程CAD'],parts=parts,
    export=dict(blender=bpy.app.version_string,gltf_yup=True,gltf_extras=True,animations=False))
(ROOT/'assets/scene-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report=dict(parts=len(parts),meshes=sum(o.type=='MESH' for o in bpy.context.scene.objects),source='self-authored-parametric-teaching-geometry',spec=SPEC)
(ROOT/'assets/build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('QUADRUPED_BUILD_OK '+json.dumps(report))
