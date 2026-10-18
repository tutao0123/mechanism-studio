/** Deterministic authoring manifest for the source-motion edition.
 * The runtime remains the story/framing/kinematics modules; this is evidence,
 * not a second JSON animation engine. Run after changing those modules/music.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Box3,Vector3} from 'three';
import {createWolfTourV2Story} from './story.mjs';
import {createWolfTourV2Framing} from './framing.mjs';
import {createWolfTourV2Annotations} from './annotations.mjs';
import {createWolfTourV2Motion} from './kinematics.mjs';
const read=async file=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const corners=b=>[b.min[0],b.max[0]].flatMap(x=>[b.min[1],b.max[1]].flatMap(y=>[b.min[2],b.max[2]].map(z=>new Vector3(x,y,z))));

export async function buildPlan(){
  const index=await read('../assets/scene-index.json'),story=createWolfTourV2Story(index),rig=createWolfTourV2Motion(index),framing=createWolfTourV2Framing(index,story,rig),annotations=createWolfTourV2Annotations(story);
  const score=await read('music-score.json'),wav=await readFile(new URL('audio/tour-loop.wav',import.meta.url));
  if(score.sha256!==hash(wav)||score.byteLength!==wav.length||score.bpm!==story.BPM||score.totalBeats!==story.TOTAL_BEATS||score.storyRevision!==story.PLAN_REVISION||score.geometryRevision!==index.geometryRevision||Math.abs(score.durationSeconds-story.DURATION)>1/score.sampleRate)throw new Error('Actual continuous PCM and score must match this story and geometry before building the plan');
  const leafIds=new Set(index.parts.map(p=>p.id)),owned=[...rig.gear.ownedIds,...rig.bearing.ownedIds];
  if(owned.length!==200||new Set(owned).size!==200||owned.some(id=>!leafIds.has(id)))throw new Error('The two mechanical adapters must own 200 distinct retained leaves');
  for(const e of story.MOTION_EVENTS)if(e.firstBeat<0||e.lastBeat>story.TOTAL_BEATS||e.firstBeat>=e.lastBeat||e.partIds.some(id=>!leafIds.has(id)))throw new Error(`Invalid global action event ${e.id}`);

  // The story intentionally delegates original local paths to its base study.
  // Its inherited GROUPS/SCOPES still contain base times; serialize explicit
  // new-time copies here, never silently publish those old global beat values.
  const scopes=Object.fromEntries(Object.entries(story.base.SCOPES).map(([name,s])=>{const delta=name==='motor'?16:32;return[name,{...s,firstBeat:s.firstBeat+delta,lastBeat:s.lastBeat+delta,knots:s.knots.map(([sourceBeat,oldGlobalBeat])=>[sourceBeat,oldGlobalBeat+delta])}];}));
  const groups=story.base.GROUPS.map(g=>{
    const delta=g.scope==='motor'?16:g.scope==='bearing'?32:0;
    return {...g,outBeat:g.outBeat+delta,outEndBeat:g.outEndBeat+delta,inBeat:g.inBeat+(g.scope==='whole'?32:delta),inEndBeat:g.inEndBeat+(g.scope==='whole'?32:delta)};
  });
  const mechanicalEnvelope=framing.fullEnvelope.clone();
  for(const[first,last]of[[20,44],[88,104]])for(let i=0;i<=48;i++){
    const s=story.stateAt((first+(last-first)*i/48)*60/story.BPM),bounds=rig.boundsAt(s);
    for(const p of index.parts)for(const point of corners(bounds.get(p.id)))mechanicalEnvelope.expandByPoint(point.add(new Vector3(...s.offsetsWorld[p.id])));
  }
  const files=['story.mjs','framing.mjs','annotations.mjs','kinematics.mjs','gearing.mjs','bearings.mjs','bearing-data.mjs','app.mjs'];
  const runtimeFiles=[];for(const file of files){const bytes=await readFile(new URL(file,import.meta.url));runtimeFiles.push({file,sha256:hash(bytes),byteLength:bytes.length});}
  const bearingSource=await read('../tour/research-v2/bearing-source.json');
  const evidenceFiles=['gear-evidence.md','gear-section-results.json','audit-transmission.md','audit-sections.json','audit-clearance.json','bearing-evidence.md','bearing-bindings.json','bearing-geometry.json','bearing-source.json'];
  const evidence=[];for(const name of evidenceFiles){const file=`../tour/research-v2/${name}`,bytes=await readFile(new URL(file,import.meta.url));evidence.push({file,sha256:hash(bytes),byteLength:bytes.length});}
  const plan={
    schemaVersion:'1.3.0',stage:'bound',manifestRole:'Deterministic authoring and evidence manifest; runtime modules remain authoritative.',planRevision:story.PLAN_REVISION,
    geometryRevision:index.geometryRevision,sourceSHA256:index.sourceSHA256,sourceRevision:index.sourceRevision,sourcePartCount:index.parts.length,durationSeconds:story.DURATION,bpm:story.BPM,totalBeats:story.TOTAL_BEATS,
    identityPolicy:'One retained 245-leaf scene. No substituted source parts, synthetic carrier, duplicated focus mesh, mesh scaling or changed source rest transforms. Local studies restore within the persistent whole-level expansion before complete final restoration.',
    chapters:story.CHAPTERS,scopes,groups,motionEvents:story.MOTION_EVENTS,bindings:story.bindings,
    timeMapping:{reference:'../tour/story.mjs',segments:[{firstBeat:0,lastBeat:20,baseBeat:'beat'},{firstBeat:20,lastBeat:44,baseBeat:20,override:'source gears gather and operate'},{firstBeat:44,lastBeat:88,baseBeat:'beat - 16'},{firstBeat:88,lastBeat:104,baseBeat:72,override:'bearing A stays internally assembled and operates'},{firstBeat:104,lastBeat:160,baseBeat:'beat - 32'}],scopeKnots:'[local source-study beat, new global tour beat]',exactIntegerBeatSnapTolerance:1e-10},
    observation:{macroMaximumOffsets:story.MACRO_MAXIMUM_OFFSETS,combinedEndpointOffsets:story.MAXIMUM_OFFSETS,pathEndpointOffsets:story.PATH_MAXIMUM_OFFSETS,offsetOwnership:story.offsetOwnership,
      gearGather:{ids:story.gearIds,fromBeat:20,assembledBeat:23,holdUntilBeat:41,reopenEndBeat:44,rule:'Multiply the current whole-level gear display offset by 1-gather; keep original mechanical source placements while operating.'},
      bearingRoles:story.bearingRoles,finalRestoredBeat:154,finalMatchingViewBeat:156},
    workingMotion:{
      runtimeOwner:'kinematics.workingPoses -> viewer model wrappers; poses are parent-relative deltas P^-1 W P, with immutable source TRS and separate display offsets.',
      composition:{gearOwnedIds:rig.gear.ownedIds,bearingOwnedIds:rig.bearing.ownedIds,ownedCount:owned.length,otherSourceLeafCount:index.parts.length-owned.length,policy:'Merge only declared disjoint ownedIds from full-reset pose maps. Derive all angles from one seekable story time; no integration or independent clock.'},
      gear:{...rig.gear.evidence,demonstration:{chapter:'gearing',firstBeat:20,lastBeat:44,inputAngleUnit:'radians',forwardFirstBeat:25,turnaroundBeat:32,reverseCompleteBeat:39,maximumInputRadians:Math.PI/2,easing:'quintic smoothstep on each leg; return to exact zero before parts reopen',orbitCoordinates:'8/21 input',absolutePlanetSpin:'-44/21 input',outputAngle:'-2/63 input',bearings:'Both bearing outer races follow the derived gearbox output during this passage.'}},
      bearing:{...rig.bearing.evidence,demonstration:{chapter:'bearing-roll',side:'A',firstBeat:88,lastBeat:104,innerAngle:0,outerForwardFirstBeat:90,turnaroundBeat:96,reverseCompleteBeat:102,maximumOuterRadians:Math.PI/3,easing:'quintic smoothstep on each leg; return to exact zero before local bearing teardown',formula:'cage=((R+h)*outer+(R-h)*inner)/(2R); rollerSpinRelativeToCage=(R*R-h*h)*(outer-inner)/(2Rr)',h:'r*cos(contactAngle)',gearInputDuringThisPassage:0,interpretation:'An isolated bearing observation drives its outer race independently while the rest of the transmission is hidden; it is not a claim of simultaneous whole-transmission operation.'}},
      resetPolicy:'Gear angle is zero at beat39; isolated bearing angle is zero at beat102. Zero-angle model identity persists through final reassembly and loop. No arbitrary one-revolution reset is used.'
    },
    presentation:{cameraRevision:framing.cameraRevision,cameraModule:'framing.mjs',cameraContinuity:'authored',cameraUp:[0,0,1],
      envelope:{min:mechanicalEnvelope.min.toArray(),max:mechanicalEnvelope.max.toArray()},envelopeMethod:'Existing whole/local/focus envelope plus combined real gear/roller transformed source AABBs and current display offsets at 49 samples in each new mechanical passage. This is an observation envelope, not collision proof.',
      opacity:'Gear context fades while gathering; fixed toothed plates remain faint for orientation. Gear view fades at39–41 before scatter41–44 and motor fade-in. Bearing outer race/support become transparent for the roller view; the cage remains faint. Visibility changes do not remove mechanical load paths.',
      annotationWindows:annotations.CUE_WINDOWS,annotationWindowCoordinates:'Seconds relative to the corresponding chapter. New mechanical chapters have no moving-target leader labels. Existing study cues use the remapped base state.',
      typography:'Shared atlas-serif study style; capture profile uses36px annotations/body and46px chapter headings at1920x1080. CSS remains the typography authority.',macroType:'One actual occurrence moves out and returns; camera magnification changes viewing scale, not geometry.'},
    music:{file:'audio/tour-loop.wav',edition:score.edition,sha256:score.sha256,byteLength:score.byteLength,sampleRate:score.sampleRate,frames:score.frames,channels:score.channels,durationSeconds:score.durationSeconds,narration:false,authorship:score.authorship,license:score.originalScoreLicense,style:score.musicalFeel,clock:'One continuous PCM buffer; no segment resets or narration API.',effectPolicy:'Motion-event cues are editorial synthesis. Gear and roller motion has music only; no recorded or physically solved contact sound is claimed.'},
    sourceEvidence:{gearAndBearing:evidence,bearingGenerator:bearingSource,runtimeFiles},
    limits:['The retained CAD derives a reverse31.5:1 gear ratio while the upstream README states34:1; discrepancy remains unresolved.','Source tooth phases and original identities are preserved. Sampled tessellated sections support kinematics but do not certify continuous3D tooth contact or exact manufacturing clearance.','The crossed-roller model is ideal no-slip and neglects the source10-micrometre rolling clearance; the imported bearing is triangulated source geometry.','No recovered CAD mates, contact force, preload, slip, backlash, friction, deformation, torque, dynamics, fatigue or load-life simulation.','Internal motor co-rotation remains an explicitly authored mechanical interpretation.','Display explosion and single-part excursions are editorial, not service procedures or collision-checked dismantling.','Bound manifest generation, automated tests, actual browser playback and encoded-video review are separate evidence; this file does not declare a completed video export.'],
    licensing:{originalCodeAndMusic:'MIT',sourceGeometryAndDerivedVisuals:'CC-BY-SA-4.0',attribution:'Anthrobotics and WOLF/modular-bearing contributors; retain upstream RFX inspiration credit and source notices.'}
  };
  await writeFile(new URL('plan.json',import.meta.url),`${JSON.stringify(plan,null,2)}\n`);
  return plan;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const plan=await buildPlan();console.log(JSON.stringify({planRevision:plan.planRevision,durationSeconds:plan.durationSeconds,chapters:plan.chapters.length,motionEvents:plan.motionEvents.length,sourcePartCount:plan.sourcePartCount,mechanicalOwners:plan.workingMotion.composition.ownedCount,audioSha256:plan.music.sha256}));
}
