import {writeFile,mkdir} from 'node:fs/promises';
import {SPEC,engineState,motionPoses} from '../model.mjs';
const out=new URL('../spec.json',import.meta.url);
const camLobes=SPEC.cylinderX.map((_,i)=>({intake:Array.from({length:128},(_,j)=>9+engineState(2*(j*360/128-180)).cylinders[i].intakeLift),exhaust:Array.from({length:128},(_,j)=>9+engineState(2*(j*360/128-180)).cylinders[i].exhaustLift)}));
await writeFile(out,JSON.stringify({schemaVersion:'1.0.0',mechanismId:'teaching-inline-four',assetRevision:'1',spec:SPEC,restPoses:motionPoses(engineState(0)),camLobes,units:{body:'mm',asset:'m'},coordinateMap:'0.001*[x,z,-y]',limitations:['教学示意尺寸','不是工程 CAD','不求解气体、燃烧或动力学','理想气门时序，无重叠或提前角']},null,2)+'\n');
await mkdir(new URL('../assets/',import.meta.url),{recursive:true});
console.log('Shared engine spec and rest poses exported.');
