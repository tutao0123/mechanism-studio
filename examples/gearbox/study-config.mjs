/** Atlas and blueprint bind the same plan, mechanics and common bootstrap. */
import { startStudyExample } from '/shared/study/example.mjs';
import { createGearboxExample } from './example.mjs';

export async function startGearboxStudy(options = {}) {
  try { return await startStudyExample(createGearboxExample(options)); }
  catch (error) { console.error(error); return null; }
}
