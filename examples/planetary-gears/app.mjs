import { startStudyExample } from '/shared/study/example.mjs';
import { createPlanetaryExample } from './example.mjs';
try { await startStudyExample(createPlanetaryExample()); }
catch (error) { console.error(error); }
