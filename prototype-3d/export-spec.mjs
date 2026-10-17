import { SPEC, KEY_PROFILES, keyOutline } from '../model.mjs';
import { writeFile } from 'node:fs/promises';

const data = { units: 'illustrative-mm', metersPerUnit: .001, spec: SPEC,
  keys: KEY_PROFILES.map(key => ({ ...key, outline: keyOutline(key.id) })) };
await writeFile(new URL('./spec.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log('已从同一原理模型导出 Blender 尺寸与钥匙轮廓。');
