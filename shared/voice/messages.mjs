const MESSAGES = {
  'zh-CN': {
    checking: '豆包语音 · 正在检查课程', ready: '豆包语音 · 已就绪',
    lessonFailed: '中文课程无法读取或校验', localMissing: '本地课程或音频清单尚未生成。',
    manifestInvalid: '豆包音频清单缺失完整步骤或不符合课程契约。', manifestUnreadable: '豆包语音 · 清单无法校验',
    hashChanged: '配音文案已改变，请重新生成豆包音频。', recordInvalid: '豆包音频记录缺少可核验摘要。',
    unsafePath: '音频清单包含无效或出界路径。', notReady: '本步豆包配音尚未就绪。',
    audioLoad: '豆包音频加载失败', audioRead: '豆包音频文件无法读取。',
    sizeMismatch: '豆包音频字节数不匹配。', digestMismatch: '豆包音频摘要不匹配，拒绝播放。',
    retryPlay: '豆包音频未能播放，请再次点击', playFailed: '豆包音频未能播放，请检查本地文件',
    cancelled: '课程已改变，本次音频载入已取消。', invalidTime: '音频定位需要非负有限秒数。',
    noAudio: '请先准备本步音频，再定位播放位置。', tooLarge: '整套课程音频超过 128 MiB 上限。',
  },
  'en-US': {
    checking: 'Doubao narration · Checking lesson', ready: 'Doubao narration · Ready',
    lessonFailed: 'The lesson could not be loaded or validated.', localMissing: 'The local lesson or audio manifest is not available yet.',
    manifestInvalid: 'The Doubao manifest is incomplete or does not match the lesson contract.', manifestUnreadable: 'Doubao narration · Manifest could not be verified',
    hashChanged: 'The narration has changed. Regenerate the Doubao audio.', recordInvalid: 'The audio record is missing valid integrity metadata.',
    unsafePath: 'The audio manifest contains an invalid or out-of-scope path.', notReady: 'Doubao narration is not ready for this step.',
    audioLoad: 'Doubao audio could not be loaded.', audioRead: 'The local Doubao audio file could not be read.',
    sizeMismatch: 'The audio byte count does not match the manifest.', digestMismatch: 'Audio integrity verification failed. Playback was refused.',
    retryPlay: 'Audio playback was blocked. Click to try again.', playFailed: 'Doubao audio could not play. Check the local audio file.',
    cancelled: 'The lesson changed. This audio load was cancelled.', invalidTime: 'Audio seek time must be a finite, non-negative number of seconds.',
    noAudio: 'Prepare this step before seeking its audio.', tooLarge: 'The lesson audio exceeds the 128 MiB limit.',
  },
};
export const voiceLocale = locale => String(locale ?? '').toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
export const voiceMessage = (locale, key) => MESSAGES[voiceLocale(locale)][key];
