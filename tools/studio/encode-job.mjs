import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkedPath, exportVideo, projectRoot } from '../video/export.mjs';
import { checkStaticRegion } from '../video/check-static-region.mjs';
import { getExample } from './registry.mjs';
import { validateFilm } from './export.mjs';
import { snapshotRenderer } from './fingerprints.mjs';

const ensure = (value,message)=>{if(!value)throw new Error(message);};
const sha = bytes=>createHash('sha256').update(bytes).digest('hex');
const stage = value=>console.log(JSON.stringify({studioStage:value}));
export async function encodeJob(path) {
  ensure(/^output\/studio\/[a-z0-9T.Z-]+\/job\.json$/.test(path),'Use a generated Studio job path.');
  const jobBytes = await readFile(await checkedPath(path,{output:true}));
  const job = JSON.parse(jobBytes), entry = getExample(job.example), film = validateFilm(entry);
  ensure(job.outputDirectory === path.slice(0,-'/job.json'.length),'Job output directory does not match its path.');
  ensure(JSON.stringify(job.film)===JSON.stringify(film),'Registered export adapter changed after the job started.');
  ensure(job.calibrationConfirmed && job.capture,'Calibration review is missing.');
  const renderer = await snapshotRenderer(entry);
  ensure(renderer && job.rendererSnapshot?.sha256 === renderer.sha256,'Renderer or display assets changed during rendering. Start a new export job.');
  ensure(sha(await readFile(await checkedPath(film.audioPath)))===job.audioSha256,'Original score changed during rendering.');
  const base=job.outputDirectory, frames=`${base}/frames`, out=`${base}/film.mp4`;
  const gate=async(folder,name)=>checkStaticRegion({frames:folder,reference:'00000.jpg',...film.staticRegion,'max-mae':1,out:`${base}/${name}.json`});
  stage('checking-source'); const source=await gate(frames,'source-static-region');
  ensure(source.passed && source.frameCount===film.frameCount,'Source frame geometry failed its static landmark check.');
  stage('encoding'); const encoded=await exportVideo({frames,audio:film.audioPath,out,fps:film.fps,'frame-count':film.frameCount,width:film.width,height:film.height,title:entry.title});
  stage('checking-encoded'); const decoded=`${base}/decoded`, decodedPath=await checkedPath(decoded,{output:true}); await mkdir(decodedPath);
  const decode=spawnSync('ffmpeg',['-v','error','-nostdin','-i',await checkedPath(out),'-map','0:v:0','-fps_mode','passthrough','-start_number','0','-q:v','2',resolve(decodedPath,'%05d.jpg')],{cwd:projectRoot,windowsHide:true,encoding:'utf8',maxBuffer:4*1024*1024});
  ensure(!decode.error && decode.status===0,'Could not decode the exported video for the encoded landmark check.');
  const delivered=await gate(decoded,'encoded-static-region');
  ensure(delivered.passed && delivered.frameCount===film.frameCount,'Encoded frame geometry failed its static landmark check.');
  const report={schemaVersion:1,createdAt:new Date().toISOString(),example:entry.id,passed:true,method:job.method,
    jobSha256:sha(jobBytes),rendererSnapshotSha256:renderer.sha256,rendererFileCount:renderer.fileCount,capture:job.capture,frames:film.frameCount,fps:film.fps,duration:film.duration,
    file:out,sha256:encoded.output.sha256,bytes:encoded.output.bytes,sourceFrameSequenceSha256:source.frameSequenceSha256,
    checks:{rendererInputsUnchanged:true,sourceLandmark:true,encodedLandmark:true,encoding:true,calibrationConfirmed:true,continuousPlaybackReviewed:false,subjectiveListeningReviewed:false},
    evidence:[`${base}/source-static-region.json`,`${base}/film-verification.json`,`${base}/encoded-static-region.json`],
    limitations:['Calibration confirmation records the operator action; no independent quality judgement is inferred.','Static landmarks detect scale/crop instability, not every mechanical or line-art flicker defect.','Review the complete encoded clip, mobile text and sound before public posting.'],publication:'not-performed'};
  await writeFile(await checkedPath(`${base}/delivery.json`,{output:true}),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  stage('complete'); return report;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { ensure(process.argv.length===3,'Usage: node tools/studio/encode-job.mjs output/studio/<job>/job.json'); await encodeJob(process.argv[2]); }
  catch(error){console.error(error.message);process.exitCode=1;}
}
