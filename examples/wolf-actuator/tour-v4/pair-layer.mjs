import {Color,Float32BufferAttribute,Vector3} from 'three';
import {createToothPhase} from './tooth-phase.mjs';
import {createDirectionCues} from './direction-cues.mjs';

/** Appearance only. Original coordinates and all rig transforms are untouched. */
export function createPairLayer({viewer,index,viewport,timeline,rig}){
  const phase=createToothPhase(index),directions=createDirectionCues(index,timeline,rig);
  const colors={sun:new Color('#c99d61'),planet:new Color('#68a49f')};
  const owned=[];
  for(const role of ['sun','planet']){
    for(const mesh of viewer.meshes.filter(m=>m.userData.selectionId===phase.specs[role].id)){
      const geometry=mesh.geometry.clone(),positions=geometry.getAttribute('position');
      const bindings=[],vector=new Vector3();
      for(let i=0;i<positions.count;i++)bindings.push(phase.vertexBinding(role,vector.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).toArray()));
      const attribute=new Float32BufferAttribute(new Float32Array(positions.count*3).fill(1),3);
      geometry.setAttribute('color',attribute);mesh.geometry=geometry;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){material.vertexColors=true;material.needsUpdate=true;}
      owned.push({role,attribute,bindings,dirty:false});
    }
  }
  if(!owned.some(o=>o.role==='sun')||!owned.some(o=>o.role==='planet'))throw new Error('Tooth-pair source meshes missing');
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('aria-hidden','true');svg.classList.add('mating-direction-cues');
  Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'2',overflow:'hidden'});
  viewport.append(svg);
  let snapshot={opacity:0,pairs:[],cues:[]};
  const project=(p,w,h)=>{const v=new Vector3(...p).project(viewer.camera);return {x:(v.x+1)*w/2,y:(1-v.y)*h/2,z:v.z};};
  const path=points=>points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  function update({state,colorCues,capturing,manualCamera}){
    const current=phase.sample(state),enabled=colorCues&&!manualCamera;
    if(!enabled)current.opacity=0;
    for(const record of owned){
      if(!current.opacity&&!record.dirty)continue;
      const target=colors[record.role],a=record.attribute.array;
      for(let i=0;i<record.bindings.length;i++){
        const weight=phase.toothWeight(record.role,record.bindings[i],current);
        a[3*i]=1+(target.r-1)*weight;a[3*i+1]=1+(target.g-1)*weight;a[3*i+2]=1+(target.b-1)*weight;
      }
      record.attribute.needsUpdate=true;record.dirty=current.opacity>0;
    }
    const width=viewport.clientWidth,height=viewport.clientHeight;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const cues=manualCamera?[]:directions.sample(state),nodes=[],visible=[];
    for(const cue of cues){
      const points=cue.pointsWorld.map(p=>project(p,width,height)),head=cue.headWorld.map(p=>project(p,width,height));
      if([...points,...head].some(p=>p.z< -1||p.z>1||p.x<0||p.x>width||p.y<0||p.y>height))continue;
      const group=document.createElementNS(ns,'g');group.setAttribute('opacity',cue.opacity.toFixed(4));
      const curve=document.createElementNS(ns,'path');curve.setAttribute('d',path(points));
      const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d',path([head[1],head[0],head[2]]));
      for(const element of [curve,arrow]){element.setAttribute('fill','none');element.setAttribute('stroke','#555a59');element.setAttribute('stroke-width',capturing?'2.1':'1.2');element.setAttribute('stroke-linecap','round');element.setAttribute('stroke-linejoin','round');group.append(element);}
      const middle=points[Math.floor(points.length/2)],font=capturing?32:16;
      // Keep the whole label clear of the arc and arrowhead, not just its anchor.
      const left=Math.min(...points.map(p=>p.x),...head.map(p=>p.x));
      const top=Math.min(...points.map(p=>p.y),...head.map(p=>p.y));
      const bottom=Math.max(...points.map(p=>p.y),...head.map(p=>p.y));
      const sideLabel=cue.role==='planet-spin'&&width>=600;
      const position=cue.role==='sun-spin'||(cue.role==='planet-spin'&&!sideLabel)?[middle.x,bottom+font*1.1]:sideLabel?[left-font*.5,middle.y+font*.3]:[middle.x,top-font*.5];
      const label=document.createElementNS(ns,'text');label.textContent=cue.label;
      label.setAttribute('x',position[0].toFixed(2));label.setAttribute('y',position[1].toFixed(2));
      label.setAttribute('text-anchor',sideLabel?'end':'middle');label.setAttribute('font-family','Georgia, Times New Roman, serif');label.setAttribute('font-style','italic');label.setAttribute('font-size',font);label.setAttribute('fill','#464b4b');
      label.setAttribute('paint-order','stroke');label.setAttribute('stroke','#fff');label.setAttribute('stroke-width',capturing?'4':'2');label.setAttribute('stroke-linejoin','round');
      group.append(label);nodes.push(group);visible.push({role:cue.role,label:cue.label,sign:cue.sign,opacity:cue.opacity});
    }
    svg.replaceChildren(...nodes);snapshot={opacity:current.opacity,pairs:current.pairs,cues:visible};
  }
  return {update,snapshot:()=>structuredClone(snapshot),evidence:phase.evidence};
}
