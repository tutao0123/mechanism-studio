"""Read-only geometry audit of the retained WOLF GLB; writes only sibling research evidence."""
import json, struct, math
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
b = (ROOT / 'assets/assembly.glb').read_bytes()
jl = struct.unpack_from('<I', b, 12)[0]
g = json.loads(b[20:20+jl])
binary = b[28+jl:]
index = json.loads((ROOT / 'assets/scene-index.json').read_text())
nodes = {n.get('extras', {}).get('part_id'): n for n in g['nodes']}

def accessor(i):
    a=g['accessors'][i]; v=g['bufferViews'][a['bufferView']]
    types={5126:'<f4',5125:'<u4',5123:'<u2'}
    components={'VEC3':3,'SCALAR':1}
    return np.frombuffer(binary,dtype=types[a['componentType']],count=a['count']*components[a['type']],offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape((a['count'],components[a['type']]))

def points(p):
    n=nodes[p['id']]
    prim=g['meshes'][n['mesh']]['primitives'][0]
    v=accessor(prim['attributes']['POSITION']).astype(float)
    m=np.array(p['worldMatrix']).reshape(4,4,order='F')
    return (np.c_[v,np.ones(len(v))]@m.T)[:,:3]

def audit(p):
    v=points(p); u=np.unique(np.round(v,9),axis=0)
    c=np.mean(u,axis=0); vc=u-c
    values,vectors=np.linalg.eigh(vc.T@vc/len(u))
    axis=vectors[:,-1]
    if axis[1]<0:axis=-axis
    axial=vc@axis
    radial=np.linalg.norm(vc-np.outer(axial,axis),axis=1)
    r=np.hypot(u[:,0],u[:,2])
    return {'id':p['id'],'name':p['name'],'definitionId':p['definitionId'],
            'uniqueVertices':len(u),'center':c.tolist(),'bounds':[u.min(axis=0).tolist(),u.max(axis=0).tolist()],
            'radialRange':[float(r.min()),float(r.max())],'pcaEigenvalues':values.tolist(),
            'pcaAxis':axis.tolist(),'axisLength':float(np.ptp(axial)), 'maxRadiusAboutAxis':float(radial.max())}

parts=[p for p in index['parts'] if '-923-' in p['id'] or '-850-' in p['id']]
report=[audit(p) for p in parts]
(OUT/'bearing-geometry.json').write_text(json.dumps({'method':'Unique GLB vertices transformed by retained source world matrix; PCA gives cylinder axes, not recovered mates.','parts':report},indent=2))
for p in report:
    if p['name'] in ['outer-ring-A','Part 59','Part 69','Part 62','Part 1','Part 2','Part 3']:
        print(json.dumps(p))
small=[p for p in report if p['axisLength']<.01]
print('small count',len(small),'centres radii',min(np.hypot(*np.array(p['center'])[[0,2]]) for p in small),max(np.hypot(*np.array(p['center'])[[0,2]]) for p in small))
groups={}
axis=np.array([0.,-1.,0.])
for side,part in [('A','-923-'),('B','-850-')]:
    rollers=[]
    for p in small:
        if part not in p['id']:continue
        center=np.array(p['center']); radial=center.copy();radial[1]=0;radial/=np.linalg.norm(radial)
        measured=np.array(p['pcaAxis'])
        if measured@axis<0:measured=-measured
        sign=1 if measured@radial>0 else -1
        ideal=(axis+sign*radial)/math.sqrt(2)
        error=float(np.linalg.norm(measured-ideal))
        if error>2e-6:raise ValueError('Measured roller axis fails source +/-45 degree geometry')
        rollers.append({'id':p['id'],'sourceName':p['name'],'center':center.tolist(),'axis':ideal.tolist(),'measuredAxisError':error})
    group=[p for p in report if part in p['id']]
    named=lambda name:next(p['id'] for p in group if p['name']==name)
    groups[side]={'pivot':[0.,float(np.mean([p['center'][1] for p in rollers])),0.], 'innerRace':named('Part 59'),'outerRace':named('Part 69'),'cage':named('Part 62'),'rollers':rollers}
data={'sourceSHA256':index['sourceSHA256'],'geometryRevision':index['geometryRevision'],'axis':[0,-1,0],'pitchRadius':.08825,'rollerRadius':.00299,'rollerLength':.0055,'contactAngle':math.pi/4,'sourceRollingClearance':.00001,'groups':groups}
(OUT/'bearing-bindings.json').write_text(json.dumps(data,indent=2))
module=ROOT/'tour-v2/bearing-data.mjs';module.parent.mkdir(exist_ok=True)
module.write_text('/** Generated from retained source vertices by ../tour/research-v2/bearing-probe.py. */\nexport const BEARING_DATA = '+json.dumps(data,separators=(',',':'))+';\n')
