/** Read-only, source-mesh sightline diagnostic for a local sun/planet macro.
 * Rays sample a small pitch-region patch, not a visibility or contact proof.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {Matrix4,Vector3,BufferGeometry,Float32BufferAttribute,Mesh,MeshBasicMaterial,DoubleSide,Raycaster} from 'three';
import {readGlb,accessorValues} from '../../../../shared/assets/glb.mjs';
import {createWolfGearRig} from '../../tour-v2/gearing.mjs';
const assets=new URL('../../assets/',import.meta.url);
const index=JSON.parse(await readFile(new URL('scene-index.json',assets)));
const {json:gltf,buffer}=readGlb(await readFile(new URL('assembly.glb',assets)));
const rig=createWolfGearRig(index),selected=index.parts.filter(p=>/^(sun-gear|planet-)/.test(p.name)),ids=new Set(selected.map(p=>p.id)),meshes=new Map();
function visit(n,parent=new Matrix4()){
  const node=gltf.nodes[n],world=parent.clone().multiply(new Matrix4().fromArray(node.matrix));
  if(ids.has(node.extras?.part_id)){
    const list=[];
    for(const primitive of gltf.meshes[node.mesh].primitives){
      const positions=accessorValues(gltf,buffer,primitive.attributes.POSITION).flatMap(p=>new Vector3(...p).applyMatrix4(world).toArray());
      const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));
      geometry.setIndex(accessorValues(gltf,buffer,primitive.indices).flat());geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new Mesh(geometry,new MeshBasicMaterial({side:DoubleSide}));mesh.matrixAutoUpdate=false;mesh.name=node.name;list.push(mesh);
    }
    meshes.set(node.extras.part_id,list);
  }
  for(const child of node.children??[])visit(child,world);
}
for(const root of gltf.scenes[gltf.scene].nodes)visit(root);
const direction=new Vector3(.25,-.95,.35).normalize(),sun=selected.find(p=>p.name==='sun-gear'),rows=[];
for(const p of selected.filter(p=>p.name!=='sun-gear')){
 for(const inputRadians of [.3,.8,Math.PI/2]){
  const world=rig.worldMotionsForAngle(inputRadians),planetCenter=new Vector3(...p.worldCenter).applyMatrix4(world.get(p.id));
  const radial=new Vector3(planetCenter.x,0,planetCenter.z).normalize(),tangent=new Vector3(-radial.z,0,radial.x);
  const target=radial.clone().multiplyScalar(Math.hypot(p.worldCenter[0],p.worldCenter[2])*.8);target.y=.004;
  const pair=[...meshes.get(sun.id),...meshes.get(p.id)];
  for(const [id,items]of [[sun.id,meshes.get(sun.id)],[p.id,meshes.get(p.id)]])for(const mesh of items){mesh.matrix.copy(world.get(id));mesh.updateMatrixWorld(true);}
  const hits={sunCentral:0,planetCentral:0,sunFrontOrEnd:0,planetEnd:0,miss:0};
  for(let r=-3;r<=3;r++)for(let t=-5;t<=5;t++){
    const point=target.clone().addScaledVector(radial,r*.001).addScaledVector(tangent,t*.001),ray=new Raycaster(point.clone().addScaledVector(direction,.4),direction.clone().negate(),0,1),hit=ray.intersectObjects(pair,false)[0];
    if(!hit)hits.miss++;else if(hit.object.name==='sun-gear')hits[hit.point.y>=-.00001?'sunCentral':'sunFrontOrEnd']++;else hits[hit.point.y>=-.00001&&hit.point.y<=.02201?'planetCentral':'planetEnd']++;
  }
  rows.push({planet:p.name,id:p.id,inputRadians,pitchRegionTarget:target.toArray(),sampleCount:77,hits});
 }
}
const result={method:'Raycast 77 points in a 6×10mm patch at ideal sun/planet pitch interface y=.004m. Existing camera direction [.25,-.95,.35], input angles .3,.8,pi/2. Only selected real sun/planet visible; counts diagnose occluding end/front geometry, not complete screen visibility or contact.',rows};
await writeFile(new URL('mesh-sightlines.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(rows.map(r=>`${r.planet} input=${r.inputRadians.toFixed(2)}: ${JSON.stringify(r.hits)}`).join('\n'));
