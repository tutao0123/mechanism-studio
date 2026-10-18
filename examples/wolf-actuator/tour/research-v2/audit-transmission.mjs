/** Independent tessellated-section audit. No source geometry or runtime mutation. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { Matrix4, Vector3 } from 'three';
import { readGlb, accessorValues } from '../../../../shared/assets/glb.mjs';
const here=new URL('./',import.meta.url), asset=new URL('../../assets/',import.meta.url);
const index=JSON.parse(await readFile(new URL('scene-index.json',asset))), {json:gltf,buffer}=readGlb(await readFile(new URL('assembly.glb',asset)));
const selected=index.parts.filter(p=>/^(front-plate|back-plate|sun-gear|internal-ring-gear-[AB]|planet-)/.test(p.name));
const ids=new Map(selected.map(p=>[p.id,p])),geometry=new Map();
function visit(n,parent=new Matrix4()){
  const node=gltf.nodes[n],world=parent.clone().multiply(new Matrix4().fromArray(node.matrix));
  if(ids.has(node.extras?.part_id)){
    const tris=[];
    for(const primitive of gltf.meshes[node.mesh].primitives){
      const points=accessorValues(gltf,buffer,primitive.attributes.POSITION).map(p=>new Vector3(...p).applyMatrix4(world).toArray());
      const indices=accessorValues(gltf,buffer,primitive.indices).flat();
      for(let i=0;i<indices.length;i+=3)tris.push(indices.slice(i,i+3).map(j=>points[j]));
    }
    geometry.set(node.extras.part_id,tris);
  }
  for(const child of node.children??[])visit(child,world);
}
for(const root of gltf.scenes[gltf.scene].nodes)visit(root);
export function section(id,y){
  const result=[];
  for(const tri of geometry.get(id)){
    const points=[];
    for(let j=0;j<3;j++){
      const a=tri[j],b=tri[(j+1)%3];
      if((a[1]<y&&b[1]>y)||(a[1]>y&&b[1]<y)){const f=(y-a[1])/(b[1]-a[1]);points.push([a[0]+f*(b[0]-a[0]),a[2]+f*(b[2]-a[2])]);}
    }
    if(points.length===2)result.push(points);
  }
  return result;
}
function center(p){return p.name.startsWith('planet-')?[0,2].map(a=>(p.worldBounds.min[a]+p.worldBounds.max[a])/2):[0,0];}
export function radialProfile(segments,origin,steps=7200){
  const min=[],max=[];
  for(let i=0;i<steps;i++){
    const angle=2*Math.PI*i/steps,d=[Math.cos(angle),Math.sin(angle)],r=[];
    for(const [a0,b0] of segments){
      const a=[a0[0]-origin[0],a0[1]-origin[1]],e=[b0[0]-a0[0],b0[1]-a0[1]],cross=d[0]*e[1]-d[1]*e[0];
      if(Math.abs(cross)<1e-14)continue;
      const t=(a[0]*e[1]-a[1]*e[0])/cross,u=(a[0]*d[1]-a[1]*d[0])/cross;
      if(t>0&&u>=0&&u<=1)r.push(t);
    }
    min.push(r.length?Math.min(...r):null);max.push(r.length?Math.max(...r):null);
  }
  return {min,max};
}
export function harmonic(values,count){
  const avg=values.reduce((a,b)=>a+b,0)/values.length;
  let re=0,im=0;for(let i=0;i<values.length;i++){re+=(values[i]-avg)*Math.cos(2*Math.PI*count*i/values.length);im-=(values[i]-avg)*Math.sin(2*Math.PI*count*i/values.length);}
  return {count,amplitude:2*Math.hypot(re,im)/values.length,phase:Math.atan2(im,re)};
}
export const records=selected.map(p=>({...p,center:center(p)}));
if(process.argv.includes('--report')){
  const rows=[];
  for(const p of selected){
    const ys=p.name.startsWith('planet-')?[-.006,.004,.014,.028]:p.name==='sun-gear'?[.004,.014]:p.name==='front-plate'?[-.006]:p.name==='back-plate'?[.028]:[.004,.014];
    for(const y of ys){
      const segments=section(p.id,y);if(!segments.length)continue;
      const profile=radialProfile(segments,center(p),3600),field=/plate|ring/.test(p.name)?profile.min:profile.max;
      if(field.includes(null)){rows.push({id:p.id,name:p.name,y,warning:'not closed angular envelope'});continue;}
      const spectrum=Array.from({length:200},(_,i)=>harmonic(field,i+1)).sort((a,b)=>b.amplitude-a.amplitude);
      rows.push({id:p.id,name:p.name,y,center:center(p),minRadius:Math.min(...field),maxRadius:Math.max(...field),dominant:spectrum.slice(0,5)});
    }
  }
  await mkdir(here,{recursive:true});await writeFile(new URL('audit-sections.json',here),JSON.stringify({method:'triangle-plane section, radial extrema, Fourier harmonic; tessellation only',rows},null,2)+'\n');
  console.log(rows.map(r=>`${r.name}@${r.y}: ${r.dominant?.map(x=>`${x.count}:${(x.amplitude*1000).toFixed(3)}`).join(' ')} ${r.warning??''}`).join('\n'));
}
