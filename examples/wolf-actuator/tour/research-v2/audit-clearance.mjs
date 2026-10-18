/** Sampled section-boundary clearance, not a B-rep collision/contact solver. */
import { writeFile } from 'node:fs/promises';
import { section,radialProfile,records } from './audit-transmission.mjs';
const planets=records.filter(p=>p.name.startsWith('planet-')),n=7200,tau=2*Math.PI;
const planes=[['front-plate',-.006,'internal',0],['sun-gear',.004,'external',1],['internal-ring-gear-B',.004,'internal',-2/63],['sun-gear',.014,'external',1],['internal-ring-gear-A',.014,'internal',-2/63],['back-plate',.028,'internal',0]];
function at(a,angle){const f=((angle/tau)%1+1)%1*n,i=Math.floor(f),t=f-i;return a[i]*(1-t)+a[(i+1)%n]*t;}
function rot(a,t){return[Math.cos(t)*a[0]-Math.sin(t)*a[1],Math.sin(t)*a[0]+Math.cos(t)*a[1]];}
const rows=[];
for(const[name,y,type,speed]of planes){
 const gear=records.find(p=>p.name===name),gr=radialProfile(section(gear.id,y),[0,0],n)[type==='external'?'max':'min'];
 for(const p of planets){
  const pr=radialProfile(section(p.id,y),p.center,n).max;
  if(pr.includes(null)||gr.includes(null))throw Error(`Open section ${name}`);
  const gaps=[];
  // Input spans two complete revolutions at 121 phases; real original phases retained.
  for(let k=0;k<=120;k++){
    const input=tau*2*k/120,orbit=input*8/21,spin=input*-44/21,gearAngle=input*speed,c=rot(p.center,orbit);
    let minGap=Infinity;
    for(let j=0;j<n;j++){
      const phi=tau*j/n+spin,q=[c[0]+pr[j]*Math.cos(phi),c[1]+pr[j]*Math.sin(phi)],r=Math.hypot(...q),theta=Math.atan2(q[1],q[0])-gearAngle,g=at(gr,theta),gap=type==='external'?r-g:g-r;
      minGap=Math.min(minGap,gap);
    }
    gaps.push({inputTurns:input/tau,minGapMetres:minGap});
  }
  rows.push({name,y,pair:p.name,type,minGapMetres:Math.min(...gaps.map(g=>g.minGapMetres)),maxGapMetres:Math.max(...gaps.map(g=>g.minGapMetres)),minimumAtInputTurns:gaps.reduce((a,b)=>a.minGapMetres<b.minGapMetres?a:b).inputTurns});
 }
}
const result={method:'7200 angular samples per retained GLB triangle-plane outer/inner section; 121 phases over two input turns. Clearances are geometric samples, not certified contact, interference or tolerances.',ratios:{orbit:8/21,planetSpin:-44/21,output:-2/63},rows};
await writeFile(new URL('audit-clearance.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(rows.map(r=>`${r.name} y=${r.y}: min ${(r.minGapMetres*1000).toFixed(6)} mm, max ${(r.maxGapMetres*1000).toFixed(6)} mm`).join('\n'));
