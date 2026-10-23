import { startStudyExample } from '/shared/study/example.mjs';
import { createJointExample } from './example.mjs';
import { attachJointInspector } from './inspect.mjs';
try { const study = await startStudyExample(createJointExample()); study.inspector = attachJointInspector(study); } catch (error) { console.error(error); }
