import { startStudyExample } from '/shared/study/example.mjs';
import { createGripperExample } from './example.mjs';

try {
  const study = await startStudyExample(createGripperExample());
  window.robotiqRig = study.presentation.rig;
} catch (error) { console.error(error); }
