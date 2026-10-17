import { createAssemblyStudy } from '/shared/study/study.mjs';
import { createStudyShell } from '/shared/study/shell.mjs';
import { createKineticStory } from './story.mjs';
import { createKineticFraming } from './framing.mjs';
import { createKineticAnnotations } from './annotations.mjs';
import { createRobotJointRig } from './joints.mjs';

const title = 'SO-ARM 102, in motion.';
createStudyShell({ title });
document.querySelector('.eyebrow').textContent = 'A study in connected motion.';
document.querySelector('.figure-index').textContent = 'Robot study / Kinetic cut';
document.querySelector('.intro-note').replaceChildren('Move. Reveal. Reconnect.');
document.getElementById('color-cues').title = 'A pale blue accent follows the current action or named part; switch off for neutral line art';
const original = document.createElement('a');
original.className = 'original-study'; original.href = '/?clean=1'; original.textContent = 'Original study ↗';
document.querySelector('.transport').append(original);

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function appearanceCues(state, labels, timeline) {
  const cues = labels.map(cue => ({ id: cue.id, weight: cue.opacity }));
  if (state.chapter.id === 'grasp' || state.chapter.id === 'resolve') {
    const weight = state.jointValues.clamp1 / .012;
    for (const id of ['urdf:clamp1_1', 'urdf:clamp2_1']) cues.push({ id, weight });
  }
  if (state.chapter.id === 'open' || state.chapter.id === 'return') {
    const returning = state.chapter.id === 'return';
    for (const group of timeline.GROUPS) {
      const progress = (state.beat - (returning ? group.inBeat : group.outBeat)) / timeline.MOVEMENT_BEATS;
      const weight = progress > 0 && progress < 1 ? Math.sin(Math.PI * progress) * .8 : 0;
      for (const id of group.ids) cues.push({ id, weight });
    }
  }
  return cues;
}

try {
  const [index, sourceAssembly] = await Promise.all([json('/planning/scene-index.json'), json('/assets/source-assembly.json')]);
  const timeline = createKineticStory(index), rig = createRobotJointRig(sourceAssembly, index);
  const study = createAssemblyStudy({
    timeline, annotations: createKineticAnnotations(timeline),
    createFraming: loadedIndex => createKineticFraming(loadedIndex, timeline, rig),
    detailIds: timeline.detailIds,
    cameraTransitionSeconds: .55,
    cameraCuts: timeline.CAMERA_CUTS,
    workingPoses: state => Object.fromEntries(rig.posesAt(state.jointValues)),
    appearanceCues: (state, labels) => appearanceCues(state, labels, timeline),
    indexUrl: '/planning/scene-index.json', sourceUrl: '/source/provenance.json',
    assetUrl: '/assets/robot.glb', contractUrl: '/assets/scene-contract.json',
    scoreUrl: '/kinetic/audio/music-score.json', audioUrl: '/kinetic/audio/kinetic-loop.wav',
    title, documentTitle: 'SO-ARM 102 · Kinetic cut · Mechanism Studio',
    sourceName: 'Robonine SO-ARM 102 · CC BY 4.0',
    creditLabel: 'SO-ARM 102 by Robonine · CC BY 4.0\ncreativecommons.org/licenses/by/4.0/\nKinematic presentation & original score: Mechanism Studio',
    initialStatus: '25.71 s · Source-joint gestures and editorial exploded views. Not a collision-checked disassembly.',
    playingStatus: 'Original score · A quiet pulse, cascading motion and soft seating cues.',
  });
  // Inspection keeps the native values and their owner separate from display offsets.
  const snapshot = study.snapshot.bind(study);
  study.snapshot = () => { const frame = snapshot(); return { ...frame, edition: 'kinetic-v1', workingPoseOwner: rig.workingOwner, jointValues: timeline.stateAt(frame.time).jointValues }; };
  window.kineticShowcase = study;
  study.ready.then(result => {
    if (result || !document.getElementById('status').textContent.includes('WebGL')) return;
    document.getElementById('chapter-title').textContent = 'The 3D preview is unavailable.';
    document.getElementById('chapter-copy').textContent = 'This browser session could not start WebGL. Reload the preview, or open this local link in a browser with WebGL 2 support.';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = 'Reload 3D preview';
    retry.addEventListener('click', () => location.reload());
    document.querySelector('.transport-actions').prepend(retry);
  });
} catch (error) {
  document.getElementById('status').textContent = 'Could not prepare this motion study: ' + error.message;
  console.error(error);
}
