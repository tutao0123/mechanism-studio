import {TtsError} from './errors.mjs';
const MAX_AUDIO_BYTES=32*1024*1024;
const MAX_FRAME_CHARS=16*1024*1024;
/**
 * Parse HTTP Chunked JSON, not SSE or WebSocket frames. Network chunks may
 * split a JSON object, a UTF-8 character, or contain several JSON objects.
 * code=0 supplies audio/metadata; code=20000000 is successful completion.
 * EOF without completion, malformed data, or any other code is a failure.
 */
export async function parseDoubaoStream(chunks) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '', cursor = 0, start = -1, depth = 0, quoted = false, escaped = false;
  let finished = false, totalBytes = 0, usage = null;
  const audio = [];
  const consume = (frame) => {
    if (finished || !frame || typeof frame !== 'object' || Array.isArray(frame)
        || !Number.isInteger(frame.code)) throw new TtsError('豆包返回的 JSON 帧不符合协议。');
    if (frame.code !== 0 && frame.code !== 20000000) {
      // Server messages/body are deliberately omitted: they may echo credentials.
      throw new TtsError('豆包合成返回错误代码 ' + frame.code + '。', frame.code);
    }
    if (frame.data != null && frame.data !== '') {
      if (typeof frame.data !== 'string'
          || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(frame.data)) {
        throw new TtsError('豆包返回的音频块不是有效的 base64。');
      }
      const data = Buffer.from(frame.data, 'base64');
      if (data.toString('base64') !== frame.data) throw new TtsError('豆包返回的音频块编码不完整。');
      totalBytes += data.length;
      if (totalBytes > MAX_AUDIO_BYTES) throw new TtsError('单段音频超过本脚本 32 MiB 上限。');
      audio.push(data);
    }
    if (Number.isInteger(frame.usage?.text_words) && frame.usage.text_words >= 0) {
      usage = { text_words: frame.usage.text_words };
    }
    if (frame.code === 20000000) finished = true;
  };
  const append = (text) => {
    buffer += text;
    for (; cursor < buffer.length; cursor += 1) {
      const character = buffer[cursor];
      if (start < 0) {
        if (/\s/.test(character)) continue;
        if (character !== '{') throw new TtsError('豆包返回的数据不是 HTTP JSON 帧。');
        start = cursor; depth = 1; quoted = false; escaped = false;
      } else if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === '{' || character === '[') depth += 1;
      else if (character === '}' || character === ']') depth -= 1;
      if (start >= 0 && cursor - start > MAX_FRAME_CHARS) throw new TtsError('豆包 JSON 帧过大。');
      if (start >= 0 && depth === 0) {
        let frame;
        try { frame = JSON.parse(buffer.slice(start, cursor + 1)); }
        catch { throw new TtsError('豆包返回的 JSON 帧无法解析。'); }
        consume(frame);
        buffer = buffer.slice(cursor + 1); cursor = -1; start = -1;
      }
    }
    if (start < 0) { buffer = ''; cursor = 0; }
  };
  try {
    for await (const chunk of chunks) append(typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true }));
    append(decoder.decode());
  } catch (error) {
    if (error instanceof TtsError) throw error;
    throw new TtsError('豆包音频流读取失败或 UTF-8 数据不完整。');
  }
  if (start >= 0) throw new TtsError('豆包音频流在 JSON 帧中途结束。');
  if (!finished) throw new TtsError('未收到豆包成功结束帧，不能把部分音频当作完成。');
  if (!totalBytes) throw new TtsError('豆包成功结束帧没有对应的非空音频。');
  return { audio: Buffer.concat(audio), usage };
}

