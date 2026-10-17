/** Minimal deterministic GLB writer for mesh derivatives; no engineering data is discarded from the retained source. */
import { boundsOf } from './glb.mjs';
export function writeGlb({nodes, scenes, meshes, extras, generator='Mechanism Studio CAD display exporter'}) {
  const chunks=[],bufferViews=[],accessors=[],materials=[];let offset=0;
  function accessor(values,type,componentType,target) {
    const bytes=Buffer.alloc(values.length*4);values.forEach((v,i)=>componentType===5126?bytes.writeFloatLE(v,i*4):bytes.writeUInt32LE(v,i*4));
    bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target});chunks.push(bytes);offset+=bytes.length;
    const count=values.length/(type==='VEC3'?3:1),record={bufferView:bufferViews.length-1,componentType,count,type};
    if(type==='VEC3'){const p=Array.from({length:count},(_,i)=>values.slice(i*3,i*3+3)),bounds=boundsOf(p);record.min=bounds.min;record.max=bounds.max;}
    accessors.push(record);return accessors.length-1;
  }
  const outputMeshes=meshes.map(mesh=>{
    const attrs={POSITION:accessor(mesh.positions,'VEC3',5126,34962)};
    if(mesh.normals)attrs.NORMAL=accessor(mesh.normals,'VEC3',5126,34962);
    const indices=accessor(mesh.indices,'SCALAR',5125,34963);
    materials.push({name:mesh.name+' material',pbrMetallicRoughness:{baseColorFactor:[...(mesh.color??[.73,.76,.8]),1],metallicFactor:.08,roughnessFactor:.75}});
    return {name:mesh.name,primitives:[{attributes:attrs,indices,material:materials.length-1}],extras:mesh.extras};
  });
  const binary=Buffer.concat(chunks),doc={asset:{version:'2.0',generator},scene:0,scenes,nodes,meshes:outputMeshes,materials,buffers:[{byteLength:binary.length}],bufferViews,accessors,extras};
  const jsonBytes=Buffer.from(JSON.stringify(doc)),jsonPadding=(4-jsonBytes.length%4)%4,json=Buffer.concat([jsonBytes,Buffer.alloc(jsonPadding,32)]);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,json,binHeader,binary]);
}
