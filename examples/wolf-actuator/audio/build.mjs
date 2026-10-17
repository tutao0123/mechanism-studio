/** Reuse the project's original quiet score PCM: the four group action times
 * match exactly. Only source identity bindings change; no robot IDs survive in
 * WOLF's score. This is explicitly reused composition, not newly rendered audio. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWolfStory } from '../story.mjs';
const hash = data => createHash('sha256').update(data).digest('hex');
export async function buildMusic() {
  const index = JSON.parse(await readFile(new URL('../assets/scene-index.json', import.meta.url), 'utf8')), story = createWolfStory(index);
  const original = JSON.parse(await readFile(new URL('../../../EXAMPLE_ROBOT/audio/music-score.json', import.meta.url), 'utf8'));
  const wav = await readFile(new URL('../../../EXAMPLE_ROBOT/audio/robot-loop.wav', import.meta.url));
  if (hash(wav) !== original.sha256 || wav.length !== original.byteLength || original.bpm !== story.BPM || original.durationSeconds !== story.DURATION) throw new Error('Shared composition identity or timing mismatch.');
  const groupMap = new Map(['shoulder', 'forearm', 'wrist', 'jaws'].map((id, i) => [id, story.GROUPS[i]]));
  const bind = cue => {
    if (!cue.animation) return cue;
    const group = groupMap.get(cue.animation.groupId); if (!group) throw new Error('Unknown source composition cue.');
    const expected = cue.animation.phase === 'explode' ? group.outBeat : group.inBeat;
    if (cue.animation.firstBeat !== expected || cue.animation.lastBeat !== expected + 2) throw new Error('WOLF movement timing differs from the reused PCM cue.');
    return { ...cue, id: cue.id.replace(cue.animation.groupId, group.id), animation: { ...cue.animation, groupId: group.id, partIds: [...group.ids] } };
  };
  const score = { ...original, title: 'WOLF / Quiet Assembly', edition: 'wolf-quiet-assembly-v1', file: 'wolf-loop.wav',
    geometryRevision: index.geometryRevision, sourceSHA256: index.sourceSHA256,
    compositionReuse: { file: 'EXAMPLE_ROBOT/audio/robot-loop.wav', score: 'EXAMPLE_ROBOT/audio/music-score.json', edition: original.edition, pcmSHA256: hash(wav), method: 'Byte-identical original Mechanism Studio score and editorial effects; same four two-beat movement intervals, with new WOLF occurrence bindings. No third-party samples or voice.' },
    effects: { ...original.effects, actionCues: original.effects.actionCues.map(bind) },
    events: original.events.map(bind),
    cues: original.cues.map(cue => ({ ...cue, purpose: cue.purpose.replace('assembled robot', 'assembled WOLF actuator') })),
  };
  if (JSON.stringify(score).includes('urdf:')) throw new Error('The WOLF score contains an unrelated occurrence identity.');
  await mkdir(new URL('./', import.meta.url), { recursive: true });
  await writeFile(new URL('wolf-loop.wav', import.meta.url), wav);
  await writeFile(new URL('music-score.json', import.meta.url), JSON.stringify(score, null, 2) + '\n');
  return { file: score.file, sha256: score.sha256, durationSeconds: score.durationSeconds, cueCount: score.effects.actionCues.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildMusic(), null, 2));
