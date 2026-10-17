export const STORIES = {
  'inline-four': {
    title: 'From fuel to motion.', subtitle: 'Inside a four-stroke engine',
    asset: '../examples/inline-four/assets/inline-four.glb', contract: '../examples/inline-four/assets/scene-contract.json',
    adapter: './adapters/inline-four.mjs', lesson: 'voice/inline-four/lesson.json', manifest: 'voice/inline-four/voice/audio-manifest.json', durations: 'voice/inline-four/durations.json',
    note: 'Illustrative geometry and ideal timing. Flow, spray and flame are teaching cues.',
    legend: [['#5193ad','Air / mixture'],['#a66d20','Port fuel'],['#dba16b','Combustion / exhaust']],
  },
  turbofan: {
    title: 'Two shafts. One journey.', subtitle: 'Inside a two-spool turbofan',
    asset: '../examples/turbofan/assets/turbofan.glb', contract: '../examples/turbofan/assets/scene-contract.json',
    adapter: './adapters/turbofan.mjs', lesson: 'voice/turbofan/lesson.json', manifest: 'voice/turbofan/voice/audio-manifest.json', durations: 'voice/turbofan/durations.json',
    note: 'Illustrative flow paths and prescribed shaft speeds. No CFD or performance calculation.',
    legend: [['#537f91','Core air'],['#8daeb8','Bypass air'],['#c88642','Combustion / hot gas']],
  },
  quadruped: {
    title: 'Four legs. Eight joints.', subtitle: 'Inside a small quadruped',
    defaultMode: 'showcase',
    modes: {
      showcase: { lesson: 'voice/quadruped-short/lesson.json', manifest: 'voice/quadruped-short/voice/audio-manifest.json', durations: 'voice/quadruped-short/durations.json' },
      explain: {},
    },
    asset: '../examples/quadruped/assets/quadruped.glb', contract: '../examples/quadruped/assets/scene-contract.json',
    adapter: './adapters/quadruped.mjs', lesson: 'voice/quadruped/lesson.json', manifest: 'voice/quadruped/voice/audio-manifest.json', durations: 'voice/quadruped/durations.json',
    note: 'Fixed-body kinematics. Paths and stance cues are prescribed; no balance, contact-force or hardware simulation.',
    legend: [['#a5a59c','Foot path'],['#6d6d65','Planned stance']],
  },
};
