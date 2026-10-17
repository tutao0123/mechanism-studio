import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from './scripts/preview-server.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4179);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');
createPreviewServer(root).listen(port, '127.0.0.1', () => console.log(`Mechanism Studio: http://127.0.0.1:${port}`));
