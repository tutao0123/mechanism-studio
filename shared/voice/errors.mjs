export class TtsError extends Error {
  constructor(message, code = null) { super(message); this.name = 'TtsError'; this.code = code; }
}
