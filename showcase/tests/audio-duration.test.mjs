import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProbeResult } from '../voice/measure-durations.mjs';

const valid = () => ({ format: { duration: '14.208000' }, streams: [{ codec_type: 'audio', codec_name: 'mp3', sample_rate: '24000', channels: 1 }] });

test('audio measurement accepts a positive MP3 duration and the prescribed sample rate', () => {
  assert.deepEqual(parseProbeResult(JSON.stringify(valid()), { sampleRate: 24000 }),
    { codec: 'mp3', sampleRate: 24000, channels: 1, durationSeconds: 14.208 });
});

test('audio measurement refuses malformed durations, alternate streams and sample-rate mismatches', () => {
  for (const duration of ['N/A', 'NaN', 'Infinity', '0', '-1']) {
    const probe = valid(); probe.format.duration = duration;
    assert.throws(() => parseProbeResult(probe), /valid positive duration/);
  }
  const alternate = valid(); alternate.streams[0].codec_name = 'aac';
  assert.throws(() => parseProbeResult(alternate), /MP3/);
  const duplicate = valid(); duplicate.streams.push({ ...duplicate.streams[0] });
  assert.throws(() => parseProbeResult(duplicate), /MP3/);
  assert.throws(() => parseProbeResult(valid(), { sampleRate: 48000 }), /Sample rate differs/);
  const badChannels = valid(); badChannels.streams[0].channels = 0;
  assert.throws(() => parseProbeResult(badChannels), /channel/);
});
