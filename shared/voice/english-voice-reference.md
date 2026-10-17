# English Doubao voice reference

Verified on 2026-10-14 against the public official Doubao documentation. No credential file or paid synthesis request was used for this verification.

The [official voice list](https://docs.volcengine.com/docs/DoubaoVoice/Tonelist-1?lang=zh), updated 2026-10-13, places Jane (`en_female_jane_uranus_bigtts`) in the model 2.0 list, identifies American English, and includes video narration among its uses. This is the documented English voice selected for the showcase; it is an available preset, rather than a cloned voice.

The [official HTTP synthesis reference](https://docs.volcengine.com/docs/DoubaoVoice/unidirectional-streaming-text-to-speech-http?lang=zh) associates resource `seed-tts-2.0` with model 2.0 voices. Its `additions` field is a JSON string, and its supported `explicit_language` values include `en`. The shared generator therefore sends:

```js
req_params: {
  speaker: 'en_female_jane_uranus_bigtts',
  additions: JSON.stringify({ explicit_language: 'en' }),
  // Other request fields are unchanged.
}
```

The voice-list page currently requires JavaScript. Its official public page-content endpoint was also checked to read the same list: `https://docs.volcengine.com/api/doc/getDocDetail?LibraryCode=DoubaoVoice&DocumentCode=Tonelist-1`. The returned document title was `音色列表`, with `UpdatedTime: 2026-10-13T08:17:11Z`.

This confirms documented model and language compatibility. Actual account entitlement is established only by an explicitly authorized request using the user's local configuration. No availability or permission is inferred from the presence of credentials. English generation should pass `--speaker en_female_jane_uranus_bigtts` explicitly; the default Chinese speaker remains unchanged for existing lessons.
