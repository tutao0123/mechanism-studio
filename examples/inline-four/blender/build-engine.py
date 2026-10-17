"""Reproducible cutaway inline-four. Shared JS exports dimensions/rest/cam profiles.
Metres in Blender and GLB; no animation/drivers/physics are exported.
This is an illustrative teaching mesh, not a native CAD assembly.
"""
import bpy, json, math, hashlib, struct
from pathlib import Path

HERE=Path(__file__).resolve().parents[1]
CFG=json.loads((HERE/'spec.json').read_text(encoding='utf-8'))
S=CFG['spec']; U=S['metersPerUnit']; ASSETS=HERE/'assets'; ASSETS.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
bpy.context.preferences.filepaths.temporary_directory=str(HERE/'.cache'/'temp')
PARTS=[]; MESHES=[]

def mat(name,c):
    m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Roughness'].default_value=.72
    return m
M={'metal':mat('Ivory machined metal',(.88,.88,.86)),'dark':mat('Graphite detail',(.3,.31,.32)),'piston':mat('Aluminium piston',(.97,.97,.95)),'spring':mat('Steel spring',(.6,.62,.64))}
root=bpy.data.objects.new('Engine assembly',None); bpy.context.collection.objects.link(root)
root['mechanismId']=CFG['mechanismId']; root['assetRevision']=CFG['assetRevision']; root['units']='metres'
root['assembly_id']='engine'

def part(pid,zh,owner='static',pos=(0,0,0),explode=(0,0,0),role='',cut=False):
    p=bpy.data.objects.new(pid,None); bpy.context.collection.objects.link(p); p.parent=root; p.location=[v*U for v in pos]
    p['part_id']=pid; p['label_zh']=zh; p['motionOwner']=owner; p['role_zh']=role; p['cutawayHidden']=cut
    rec={'part_id':pid,'parent_id':'engine','label_zh':zh,'motionOwner':owner,'rest':{'translation':list(pos),'rotationX':0},'pivot':[0,0,0],'axis':[1,0,0] if owner=='model' else None,'explode':list(explode),'cutawayHidden':cut,'role_zh':role}
    PARTS.append(rec); return p

def mesh(name,verts,faces,parent,material='metal',smooth=False):
    d=bpy.data.meshes.new(name+' mesh'); d.from_pydata([[v*U for v in p] for p in verts],[],faces); d.update()
    ob=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(ob); ob.parent=parent; d.materials.append(M[material])
    ob['lineArtSmooth']=smooth
    for f in d.polygons: f.use_smooth=smooth
    MESHES.append(ob); return ob

def box(name,pos,size,parent,material='metal',bevel=0.8):
    x,y,z=pos; a,b,c=[v/2 for v in size]
    verts=[(x+dx*a,y+dy*b,z+dz*c) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    ob=mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],parent,material)
    if bevel:
        bpy.context.view_layer.objects.active=ob; ob.select_set(True)
        mod=ob.modifiers.new('Machined edge fillet','BEVEL'); mod.width=bevel*U; mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name); ob.select_set(False)
    return ob

def cyl(name,pos,radius,length,parent,axis='Z',material='metal',segments=64):
    verts=[]
    for side in [-.5,.5]:
        for i in range(segments):
            a=2*math.pi*i/segments; q=(radius*math.cos(a),radius*math.sin(a),length*side)
            if axis=='X':q=(q[2],q[0],q[1])
            if axis=='Y':q=(q[0],q[2],q[1])
            verts.append(tuple(pos[j]+q[j] for j in range(3)))
    faces=[tuple(range(segments-1,-1,-1)),tuple(range(segments,segments*2))]
    faces += [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
    ob=mesh(name,verts,faces,parent,material)
    for f in ob.data.polygons[2:]:f.use_smooth=True
    return ob

def ring(name,pos,ro,ri,length,parent,axis='Z',material='metal',start=0,end=2*math.pi,n=64):
    closed=abs(end-start-2*math.pi)<1e-6; count=n if closed else n+1; verts=[]
    for r in [ro,ri]:
        for side in [-.5,.5]:
            for i in range(count):
                a=start+(end-start)*i/n; q=(r*math.cos(a),r*math.sin(a),length*side)
                if axis=='X':q=(q[2],q[0],q[1])
                if axis=='Y':q=(q[0],q[2],q[1])
                verts.append(tuple(pos[j]+q[j] for j in range(3)))
    faces=[]
    for i in range(n):
        j=(i+1)%count
        faces += [(i,j,j+count,i+count),(i+2*count,i+3*count,j+3*count,j+2*count),(i,i+2*count,j+2*count,j),(i+count,j+count,j+3*count,i+3*count)]
    if not closed:faces += [(0,count,3*count,2*count),(n,n+2*count,n+3*count,n+count)]
    return mesh(name,verts,faces,parent,material)

def curve(name,coords,parent,rad=1,material='metal',closed=False):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=rad*U; c.bevel_resolution=2
    spline=c.splines.new('POLY'); spline.points.add(len(coords)-1)
    for p,q in zip(spline.points,coords):p.co=(*[v*U for v in q],1)
    spline.use_cyclic_u=closed; ob=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(ob); ob.parent=parent; c.materials.append(M[material])
    bpy.context.view_layer.objects.active=ob; ob.select_set(True); bpy.ops.object.convert(target='MESH'); ob=bpy.context.object; ob.select_set(False)
    ob['lineArtSmooth']=True
    for f in ob.data.polygons:f.use_smooth=True
    MESHES.append(ob); return ob

def bolt(name,pos,parent,axis='Z',radius=3.4):
    cyl(name+' hex',pos,radius,3,parent,axis,'dark',6)
    q=list(pos); j={'X':0,'Y':1,'Z':2}[axis];q[j]+=2
    ring(name+' washer',q,radius+1,radius*.5,1.3,parent,axis,'metal',n=24)

block=part('block','缸体与主轴承座',explode=(0,70,0),role='固定四个缸位并支撑曲轴；预制前剖面只改变观察。')
box('back casting wall',(0,58,138),(440,15,206),block)
box('rear crankcase rail',(0,47,-27),(446,18,35),block)
for x in [-208,-104,0,104,208]:
    box('bearing saddle'+str(x),(x,29,3),(18,39,40),block)
    ring('main bearing cap'+str(x),(x,0,0),24,17,12,block,'X',start=math.pi,end=2*math.pi,n=32)
    for y in [-28,28]:bolt('cap bolt'+str(x)+str(y),(x,y,-18),block)
for z in [70,100,130,160,190]:box('casting rib'+str(z),(0,68,z),(410,5,3),block,bevel=.5)
front=part('block-front','缸体前侧外壁',explode=(0,-110,0),cut=True,role='切换剖视时隐藏的教学外壳。')
box('front casting',(0,-54,145),(438,12,184),front)
for z in [80,110,140,170,200]:box('front casting fin'+str(z),(0,-62,z),(426,5,3),front)
for x in [-208,208]:
    end_face=box('end casting'+str(x),(x,0,145),(10,114,184),block)
    end_face['endCutaway']=True

crank=part('crankshaft','曲轴',owner='model',explode=(0,0,-120),role='四个曲拐把连杆往复转换成同一输出轴的转动。')
for x in [-208,-104,0,104,208]:cyl('main journal'+str(x),(x,0,0),16,24,crank,'X')
for i,x in enumerate(S['cylinderX']):
    sign=1 if i in [0,3] else -1
    cyl('crankpin'+str(i),(x,0,45*sign),11,36,crank,'X')
    for side in [-24,24]:
        box('crank web'+str(i)+str(side),(x+side,0,22.5*sign),(12,34,77),crank,bevel=4)
        ring('counterweight'+str(i)+str(side),(x+side,0,0),62,22,12,crank,'X',start=math.pi if sign==1 else 0,end=2*math.pi if sign==1 else math.pi,n=36)
    cyl('connecting journal left'+str(i),(x-39,0,0),16,24,crank,'X')
    cyl('connecting journal right'+str(i),(x+39,0,0),16,24,crank,'X')
cyl('shaft front',(-234,0,0),13,28,crank,'X'); cyl('shaft rear',(234,0,0),13,28,crank,'X')

oil=part('oil-pan','油底壳',explode=(0,0,-210),role='仅展示储油与外壳位置；本例不模拟润滑循环。')
box('pan floor',(0,0,-84),(428,116,10),oil,bevel=5)
box('pan rear',(0,57,-61),(428,8,43),oil,bevel=3)
for x in [-211,211]:box('pan end'+str(x),(x,0,-61),(8,114,43),oil,bevel=3)
for x in range(-180,181,40):bolt('oil flange bolt'+str(x),(x,54,-34),oil)
panfront=part('oil-pan-front','油底壳前侧',explode=(0,-100,-160),cut=True,role='剖面显示中的可隐藏外壳。')
box('pan front',(0,-57,-61),(428,8,43),panfront,bevel=3)

head=part('cylinder-head','缸盖与气门座',explode=(0,0,110),role='固定气门和火花塞；教学剖面让气缸顶部保持可见。')
box('head rear rail',(0,45,250),(446,16,36),head)
for x in [-208,-104,0,104,208]:
    box('head web'+str(x),(x,0,248),(10,96,32),head)
    for y in [-42,42]:bolt('head bolt'+str(x)+str(y),(x,y,270),head)
for i,x in enumerate(S['cylinderX']):
    n=i+1; h=195 if i in [0,3] else 105
    liner=part(f'liner-{n}',f'{n} 缸缸套',explode=(0,40,55),role='半圆缸套是预制剖视网格；内径示意为 82 mm。')
    ring('cylinder liner'+str(n),(x,0,157.5),44,41,125,liner,start=0,end=math.pi,n=64)
    ring('deck bore'+str(n),(x,0,224),49,41,9,head,start=0,end=math.pi,n=64)
    piston=part(f'piston-{n}',f'{n} 缸活塞',owner='model',pos=(x,0,h),explode=(0,-85,90),role='活塞销中心由曲柄连杆模型给出；活塞环和裙部用于辨识装配。')
    cyl('piston skirt'+str(n),(0,0,-6),40.5,51,piston,'Z','piston')
    cyl('piston crown'+str(n),(0,0,20),40.5,4,piston,'Z','piston')
    for z in [13,8,3]:ring('piston ring'+str(n)+str(z),(0,0,z),41,40,1.2,piston,material='dark')
    cyl('wrist pin'+str(n),(0,0,0),6,75,piston,'X','dark')
    for y in [-25,25]:box('skirt relief'+str(n)+str(y),(0,y,-25),(26,12,6),piston,'piston',bevel=2)
    rod=part(f'rod-{n}',f'{n} 缸连杆',owner='model',pos=(x,0,45 if i in [0,3] else -45),explode=(0,-110,-30),role='曲轴销到活塞销的示意杆长恒为 150 mm。')
    ring('rod big eye'+str(n),(0,0,0),19,11.2,24,rod,'X')
    ring('rod small eye'+str(n),(0,0,150),11,6.2,16,rod,'X')
    box('rod I beam web'+str(n),(0,0,77),(7,10,123),rod,bevel=2)
    for xface in [-6,6]:box('rod I flange'+str(n)+str(xface),(xface,0,77),(4,17,121),rod,bevel=1.5)
    for y in [-22,22]:bolt('rod fastener'+str(n)+str(y),(0,y,-2),rod,'X')
    for typ,y in [('intake',-17),('exhaust',17)]:
        valve=part(f'{typ}-valve-{n}',f'{n} 缸'+('进气门' if typ=='intake' else '排气门'),owner='model',pos=(x,y,232),explode=(0,-100 if typ=='intake' else 100,170),role='理想行程时序驱动下移开启；最大示意升程 9 mm，无气门重叠。')
        cyl(typ+' valve disk'+str(n),(0,0,0),13.5 if typ=='intake' else 12.5,3,valve,'Z')
        cyl(typ+' valve stem'+str(n),(0,0,38),2.5,74,valve,'Z','spring',32)
        ring(typ+' spring retainer'+str(n),(0,0,66),9,2.6,3,valve,n=32)
        spring=part(f'{typ}-spring-{n}',f'{n} 缸'+('进气' if typ=='intake' else '排气')+'气门弹簧',pos=(x,y,265),explode=(0,-100 if typ=='intake' else 100,205),role='示意弹簧显示位置，不模拟弹性或动态压缩。')
        coords=[(8*math.cos(a*2*math.pi*6),8*math.sin(a*2*math.pi*6),a*26) for a in [j/216 for j in range(217)]]
        curve(typ+' helical spring'+str(n),coords,spring,.8,'spring')
        ring(typ+' spring seat'+str(n),(x,y,263),10,3,3,head,n=32)
    spark=part(f'spark-plug-{n}',f'{n} 缸火花塞',pos=(x,0,242),explode=(0,0,200),role='只在理想做功起点标记点火；不使用实际点火提前角。')
    cyl('spark threaded body'+str(n),(0,0,9),4,24,spark,'Z','dark',32)
    cyl('spark ceramic'+str(n),(0,0,28),4.5,16,spark,'Z','piston',32)
    cyl('spark hex'+str(n),(0,0,21),6,5,spark,'Z','metal',6)
    cyl('spark contact'+str(n),(0,0,39),2.5,8,spark,'Z','dark',24)

def cam_profile(name,x,radii,parent):
    n=len(radii); verts=[]
    for side in [-5,5]:
        for j,r in enumerate(radii):a=2*math.pi*j/n;verts.append((x+side,r*math.sin(a),r*math.cos(a)))
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    ob=mesh(name,verts,faces,parent)
    for f in ob.data.polygons[2:]:f.use_smooth=True

for typ,y in [('intake',-17),('exhaust',17)]:
    cam=part(typ+'-camshaft',('进气' if typ=='intake' else '排气')+'凸轮轴',owner='model',pos=(0,y,315),explode=(0,-60 if typ=='intake' else 60,250),role='角速度为曲轴的一半；凸轮轮廓从同一气门升程模型采样。')
    cyl(typ+' camshaft',(0,0,0),7,474,cam,'X')
    for i,x in enumerate(S['cylinderX']):cam_profile(typ+' cam lobe'+str(i),x,CFG['camLobes'][i][typ],cam)
    for x in [-208,-104,0,104,208]:ring(typ+' journal collar'+str(x),(x,0,0),10,7,12,cam,'X',n=32)
    cyl(typ+' cam pulley',(-245,0,0),27,10,cam,'X')
    for j in range(18):
        a=2*math.pi*j/18;cyl(typ+' pulley perforation'+str(j),(-251,17*math.sin(a),17*math.cos(a)),2,1,cam,'X','dark',16)

fly=part('flywheel','飞轮与输出端',owner='model',pos=(251,0,0),explode=(130,0,0),role='飞轮与曲轴同转；这里不求解转动惯量。')
ring('flywheel rim',(0,0,0),74,61,18,fly,'X')
cyl('flywheel disk',(0,0,0),63,10,fly,'X')
for j in range(8):
    a=2*math.pi*j/8;bolt('flywheel bolt'+str(j),(7,30*math.sin(a),30*math.cos(a)),fly,'X')
for j in range(60):
    a=2*math.pi*j/60;box('ring gear tooth'+str(j),(0,75*math.sin(a),75*math.cos(a)),(12,3,3),fly,bevel=.4)
pulley=part('timing-drive','曲轴正时带轮',owner='model',pos=(-248,0,0),explode=(-100,0,0),role='曲轴带轮与上方凸轮带轮表达 2:1 转速关系。')
cyl('crank timing pulley',(0,0,0),13.5,12,pulley,'X')
bolt('crank pulley bolt',(-8,0,0),pulley,'X',radius=6)
belt=part('timing-belt','正时带与张紧器',explode=(-90,0,0),role='带路径只显示传动连接；网页不模拟皮带材料或啮合。')
curve('timing belt outline',[(-254,-18,-14),(-254,-44,315),(-254,-35,337),(-254,35,337),(-254,44,315),(-254,18,-14)],belt,2,'dark',True)
cyl('belt tensioner',(-254,40,150),14,10,belt,'X')

cover=part('cam-cover','气门室盖',explode=(0,0,330),cut=True,role='剖视时隐藏以观察凸轮和气门。')
box('cam cover',(0,0,337),(443,80,28),cover,bevel=7)
for x in [-200,200]:
    for y in [-29,29]:bolt('cover bolt'+str(x)+str(y),(x,y,353),cover)
manifold=part('intake-manifold','进气歧管',explode=(0,-170,55),cut=True,role='四个进气支路只标示通道位置，不求解流量。')
curve('intake collector',[(-185,-99,257),(185,-99,257)],manifold,12)
for x in S['cylinderX']:curve('intake runner'+str(x),[(x,-99,257),(x,-73,257),(x,-46,246)],manifold,9)
exhaust=part('exhaust-manifold','排气歧管',explode=(0,150,25),role='四个排气支路与缸盖背面连接；不求解气流。')
curve('exhaust collector',[(-185,98,222),(185,98,222)],exhaust,10)
for x in S['cylinderX']:curve('exhaust runner'+str(x),[(x,46,245),(x,76,239),(x,98,222)],exhaust,8)

scene.world=bpy.data.worlds.new('Teaching studio world');scene.world.color=(.8,.8,.8)
scene['Build note']='All motion belongs to shared JavaScript model; display cutaway is prefabricated.'
scene['Bore_mm']=82;scene['Stroke_mm']=90;scene['Rod_length_mm']=150
for p in PARTS:
    if p['motionOwner']=='model':
        p['poseSpace']='absolute-local-to-engine'
        if p['part_id'].startswith(('piston-','intake-valve-','exhaust-valve-')):p['axis']=[0,0,1]
contract={k:CFG[k] for k in ['schemaVersion','mechanismId','assetRevision','units','coordinateMap','limitations']}
contract.update({'parts':PARTS,'assemblyRoot':'engine','asset':'inline-four.glb','source':'inline-four.blend','export':{'blender':bpy.app.version_string,'gltf_yup':True,'gltf_extras':True,'animations':False},'motionConvention':'GLB rest is retained on load; model-owned nodes receive absolute engine-local pose once; independent display wrapper contributes only explode.'})
(ASSETS/'scene-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS/'inline-four.blend'))
bpy.ops.export_scene.gltf(filepath=str(ASSETS/'inline-four.glb'),export_format='GLB',export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=True)
raw=(ASSETS/'inline-four.glb').read_bytes(); jslen=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jslen])
ids=[n.get('extras',{}).get('part_id') for n in doc['nodes'] if n.get('extras',{}).get('part_id')]
assert len(ids)==len(set(ids))==len(PARTS)
triangles=sum(len(ob.data.loop_triangles) for ob in MESHES if ob.type=='MESH')
for ob in MESHES:
    if ob.type=='MESH':ob.data.calc_loop_triangles()
triangles=sum(len(ob.data.loop_triangles) for ob in MESHES if ob.type=='MESH')
report={'build':'executed','builder':'authorized-local-Blender-script','mcpUsed':False,'blender':bpy.app.version_string,'partCount':len(PARTS),'meshCount':len(MESHES),'triangles':triangles,'glbBytes':len(raw),'glbSHA256':hashlib.sha256(raw).hexdigest(),'blendSHA256':hashlib.sha256((ASSETS/'inline-four.blend').read_bytes()).hexdigest(),'sourceSpecSHA256':hashlib.sha256((HERE/'spec.json').read_bytes()).hexdigest(),'verified':['GLB JSON readable','part IDs unique and complete'],'limitations':CFG['limitations']}
(ASSETS/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
