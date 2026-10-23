import { fileURLToPath } from 'node:url';
import { SCORES } from '../../scripts/build-audio.mjs';

export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

// Keep launchable pages explicit. An example's existing server continues to
// own its read-only route allowlist; registry entries never become file paths
// derived from CLI input.
const servers = {
  studio: async () => (await import('../../scripts/preview-server.mjs')).createPreviewServer(PROJECT_ROOT),
  planetary: async () => (await import('../../examples/planetary-gears/serve.mjs')).createPlanetaryServer(),
  gearbox: async () => (await import('../../examples/gearbox/serve.mjs')).createGearboxServer(),
  allegro: async () => (await import('../../examples/allegro-hand/serve.mjs')).createHandServer(),
  robotiq: async () => (await import('../../examples/robotiq-gripper/serve.mjs')).createGripperServer(),
  humanoid: async () => (await import('../../examples/humanoid/serve.mjs')).createHumanoidServer(),
  robot: async () => (await import('../../EXAMPLE_ROBOT/serve.mjs')).createRobotServer(),
  stepBearing: async () => (await import('../../examples/step-bearing-assembly/serve.mjs')).createStepBearingServer(),
  joint: async () => (await import('../../examples/robot-joint/serve.mjs')).createJointPreviewServer(),
};
const score = metadata => {
  const found = SCORES.find(item => item.metadata === metadata);
  if (!found) throw new Error(`Unregistered original score: ${metadata}`);
  return found;
};
const film = (renderPath, apiName, duration, width, height, audioPath, reviewTime, staticHeight) => Object.freeze({
  renderPath, apiName, duration, width, height, fps: 30, audioPath, reviewTime,
  staticRegion: Object.freeze({ x: 0, y: 0, width, height: staticHeight }),
});
const entry = (id, title, server, port, path, options = {}) => Object.freeze({
  id, title,
  preview: Object.freeze({ createServer: servers[server], defaultPort: port, path }),
  audio: null, export: null, generate: false, ...options,
});

export const EXAMPLES = Object.freeze([
  entry('gallery', 'Mechanism Studio gallery', 'studio', 4179, '/'),
  entry('robot-joint', 'Original robot joint / motor and planetary reducer', 'joint', 4198, '/', {
    generate: true,
    audio: score('examples/robot-joint/audio/music-score.json'),
    export: film('/render.html', 'jointFilm', 36, 1920, 1080, 'examples/robot-joint/audio/joint-loop.wav', 12, 150),
  }),
  entry('step-bearing-assembly', 'Leader arm / real STEP assembly inspector', 'stepBearing', 4194, '/'),
  entry('planetary-gears', 'Planetary reducer / 80 parts', 'planetary', 4193, '/?clean=1', {
    generate: true,
    audio: score('examples/planetary-gears/audio/music-score.json'),
    export: film('/render.html', 'planetaryFilm', 36, 1920, 1080, 'examples/planetary-gears/audio/planetary-loop.wav', 12.4, 150),
  }),
  entry('gearbox', 'Five-speed gearbox / Atlas', 'gearbox', 4183, '/?clean=1', {
    generate: true,
    audio: score('examples/gearbox/audio/music-score.json'),
    export: film('/render.html', 'gearboxFilm', 40, 1080, 1080, 'examples/gearbox/audio/gearbox-loop.wav', 12, 125),
  }),
  entry('gearbox-blueprint', 'Five-speed gearbox / Blueprint', 'gearbox', 4183, '/blueprint/?clean=1', {
    audio: score('examples/gearbox/audio/music-score.json'),
  }),
  entry('gearbox-cinematic', 'Five-speed gearbox / Cinematic', 'gearbox', 4183, '/cinematic/', {
    audio: score('examples/gearbox/cinematic/audio/music-score.json'),
    export: film('/cinematic/render.html', 'cinematicFilm', 24, 1920, 1080, 'examples/gearbox/cinematic/audio/gearbox-cinematic-loop.wav', 10, 86),
  }),
  entry('allegro-hand', 'Allegro dexterous hand', 'allegro', 4185, '/?clean=1', {
    audio: score('examples/allegro-hand/audio/music-score.json'),
  }),
  entry('robotiq-gripper', 'Robotiq 2F-85 gripper', 'robotiq', 4186, '/?clean=1', {
    audio: score('examples/robotiq-gripper/audio/music-score.json'),
  }),
  entry('humanoid', 'Unitree G1 humanoid', 'humanoid', 4182, '/?clean=1', {
    audio: score('examples/humanoid/audio/music-score.json'),
  }),
  entry('lock', 'Five-pin lock', 'studio', 4179, '/prototype-3d/?palette=line-light'),
  entry('inline-four', 'Inline-four engine / interactive', 'studio', 4179, '/examples/inline-four/'),
  entry('turbofan', 'Two-spool turbofan / interactive', 'studio', 4179, '/examples/turbofan/'),
  entry('quadruped', 'Small quadruped / interactive', 'studio', 4179, '/examples/quadruped/'),
  entry('inline-four-showcase', 'Inline-four engine / story', 'studio', 4179, '/showcase/?story=inline-four&clean=1'),
  entry('turbofan-showcase', 'Two-spool turbofan / story', 'studio', 4179, '/showcase/?story=turbofan&clean=1'),
  entry('quadruped-showcase', 'Small quadruped / story', 'studio', 4179, '/showcase/?story=quadruped&clean=1'),
  entry('so-arm102', 'SO-ARM 102 assembly study', 'robot', 4180, '/?clean=1', {
    audio: score('EXAMPLE_ROBOT/audio/music-score.json'),
  }),
  entry('so-arm102-kinetic', 'SO-ARM 102 kinetic cut', 'robot', 4180, '/kinetic/?clean=1', {
    audio: score('EXAMPLE_ROBOT/kinetic/audio/music-score.json'),
  }),
]);

export function getExample(id) {
  const found = EXAMPLES.find(item => item.id === id);
  if (!found) throw new Error(`Unknown example "${id}". Run "npm run studio -- list" for registered IDs.`);
  return found;
}

export function listExamples() {
  return EXAMPLES.map(item => ({
    id: item.id, title: item.title, path: item.preview.path,
    defaultPort: item.preview.defaultPort, export: item.export !== null, generate: item.generate,
    ...(item.export ? { duration: item.export.duration, width: item.export.width, height: item.export.height, fps: item.export.fps } : {}),
  }));
}
