import { buildScore } from '../../scripts/build-audio.mjs';

/** Programmatic preview. Port 0 is useful for callers needing an available
 * loopback port; the human CLI accepts only explicit ports 1..65535. */
export async function startPreview(example, { port = example.preview.defaultPort, prepareAudio = true, log = () => {} } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Preview port must be an integer from 0 to 65535.');
  if (prepareAudio && example.audio) {
    const result = await buildScore(example.audio);
    if (result.status === 'built') log(`Built and verified original score: ${result.wav}`);
  }
  const server = await example.preview.createServer();
  await new Promise((resolve, reject) => {
    const failed = error => {
      server.off('listening', started);
      if (error.code === 'EADDRINUSE') reject(new Error(`Port ${port} is already in use. Choose another port with --port <number>; the existing server was left running.`));
      else reject(error);
    };
    const started = () => { server.off('error', failed); resolve(); };
    server.once('error', failed);
    server.once('listening', started);
    server.listen(port, '127.0.0.1');
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { server, baseUrl, url: baseUrl + example.preview.path };
}
