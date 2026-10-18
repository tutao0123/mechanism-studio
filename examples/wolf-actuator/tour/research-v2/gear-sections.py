"""Reproduce tooth counts from pinned GLB plane sections, without using nominal ratio.
Run with the local machine's Python/numpy/scipy. Writes only beside this file.
Counts are geometric observations, not recovered CAD parameters or contact proof.
"""
from pathlib import Path
import hashlib, json, struct, sys
sys.dont_write_bytecode=True
import numpy as np
from scipy.signal import find_peaks

ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).resolve().parent
ASSETS=ROOT/'examples/wolf-actuator/assets'
raw=(ASSETS/'assembly.glb').read_bytes()
jl=struct.unpack_from('<I',raw,12)[0]
g=json.loads(raw[20:20+jl]); data=raw[28+jl:]
index=json.loads((ASSETS/'scene-index.json').read_text())
parts={p['name']:p for p in index['parts']}
nodes={n.get('extras',{}).get('part_id'):n for n in g['nodes']}

def accessor(i):
    a=g['accessors'][i]; v=g['bufferViews'][a['bufferView']]
    dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]
    n={'SCALAR':1,'VEC3':3}[a['type']]
    assert 'byteStride' not in v
    return np.frombuffer(data,dtype=dtype,count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n)

def triangles(name):
    p=parts[name]; node=nodes[p['id']]; result=[]
    m=np.array(p['worldMatrix']).reshape(4,4).T
    for prim in g['meshes'][node['mesh']]['primitives']:
        vertices=accessor(prim['attributes']['POSITION']).astype(float)
        world=(np.c_[vertices,np.ones(len(vertices))]@m.T)[:,:3]
        result.append(world[accessor(prim['indices']).flatten().reshape(-1,3)])
    return np.concatenate(result)

def section(t,y):
    active=t[(t[:,:,1].min(axis=1)<y)&(t[:,:,1].max(axis=1)>y)]
    segments=[]
    for tri in active:
        hits=[]
        for a,b in [(tri[0],tri[1]),(tri[1],tri[2]),(tri[2],tri[0])]:
            if (a[1]-y)*(b[1]-y)<0:
                hits.append((a+(b-a)*((y-a[1])/(b[1]-a[1])))[[0,2]])
        if len(hits)==2: segments.append(hits)
    return np.array(segments)

def profile(segments,center,mode,rmin=0,samples=8192):
    seg=segments-np.array(center); a=seg[:,0]; e=seg[:,1]-a
    cross=lambda a,b:a[...,0]*b[...,1]-a[...,1]*b[...,0]
    ang=np.arange(samples)*2*np.pi/samples
    radii=[]
    for i in range(0,samples,64):
        d=np.stack([np.cos(ang[i:i+64]),np.sin(ang[i:i+64])],axis=1)
        det=cross(d[:,None,:],e[None,:,:]); valid=np.abs(det)>1e-16
        safe=np.where(valid,det,1)
        r=cross(a,e)[None,:]/safe; s=cross(a[None,:,:],d[:,None,:])/safe
        valid&=(s>=0)&(s<=1)&(r>rmin)
        r=np.where(valid,r,np.inf if mode=='min' else -np.inf)
        radii.extend((np.min(r,axis=1) if mode=='min' else np.max(r,axis=1)).tolist())
    return ang,np.array(radii)

SPECS=[
('sun-gear',[.003,.008,.014,.019],'max',0),
('internal-ring-gear-A',[.014,.018,.021],'min',.065),
('internal-ring-gear-B',[.002,.006,.009],'min',.065),
('front-plate',[-.011,-.008,-.004],'min',.065),
('back-plate',[.027,.031,.033],'min',.065),
('planet-12',[-.010,-.006,.003,.008,.014,.019,.027,.032],'max',0),
]
SPECS += [(f'planet-{i}',[-.006,.008,.029],'max',0) for i in range(1,12)]

def analyze():
    result={'method':'Triangle-plane section radial profile; local extrema and Fourier spectrum independently count complete turns. No nominal ratio is used.',
        'assetSHA256':hashlib.sha256(raw).hexdigest(),'sourceSHA256':index['sourceSHA256'],'sections':[]}
    saved={}
    for name,ys,mode,rmin in SPECS:
        t=triangles(name)
        center=[parts[name]['worldCenter'][0],parts[name]['worldCenter'][2]] if name.startswith('planet') else [0,0]
        for y in ys:
            seg=section(t,y); ang,r=profile(seg,center,mode,rmin)
            assert np.isfinite(r).all(),(name,y)
            amplitude=float(r.max()-r.min())
            signal=r if mode=='max' else -r
            peaks=find_peaks(np.tile(signal,3),prominence=amplitude*.2,distance=16)[0]
            peaks=peaks[(peaks>=len(r))&(peaks<2*len(r))]-len(r)
            f=np.abs(np.fft.rfft(r-r.mean())); top=np.argsort(f[1:512])[::-1][:5]+1
            rec={'name':name,'partId':parts[name]['id'],'yWorldMetres':y,'sectionSegments':len(seg),'centerXZ':center,
                 'profileSelection':mode,'rayThresholdMetres':rmin,'radialRangeMetres':[float(r.min()),float(r.max())],
                 'toothPeakCount':len(peaks),'leadingFourierHarmonics':[{'cyclesPerTurn':int(n),'amplitude':float(f[n])} for n in top],
                 'peakAngleDegrees':(ang[peaks]*180/np.pi).tolist()}
            result['sections'].append(rec)
            saved[f'{name}:{y}']=r.tolist()
            print(name,y,'peaks',len(peaks),'fourier',top.tolist(),'range',rec['radialRangeMetres'])
    (HERE/'gear-section-results.json').write_text(json.dumps(result,indent=2)+'\n')
    if '--profiles' in sys.argv:
        (HERE/'gear-radial-profiles.json').write_text(json.dumps(saved,separators=(',',':'))+'\n')
    return result

if __name__=='__main__': analyze()
